import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { run } from './process.mjs';
import { channelConfig, setPackageVersion, endpoint } from './channel-config.mjs';
import { createUpdaterArchive } from './package-archive.mjs';

const root = process.cwd();
const lock = JSON.parse(await readFile('upstream.lock.json', 'utf8'));
const channel = JSON.parse(await readFile('channel.json', 'utf8'));
const candidateCommit = (await run('git', ['rev-parse', 'HEAD'])).trim();
if (process.env.TAURI_SIGNING_PRIVATE_KEY || process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD) throw new Error('Signing secrets must never enter the build job');
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw new Error('Release requires an Apple Silicon Mac');
await mkdir('.local', { recursive: true });
const plistFile = resolve('.local/Info.korean.plist');
const localizations = resolve('.local/macos-localizations');
await run('python3', ['scripts/prepare-plist.py', 'app/desktop/src-tauri/Info.plist', plistFile, localizations]);
const config = channelConfig(lock.channelVersion, channel.publicKey, plistFile, localizations);
const configFile = resolve('.local/tauri.korean.json');
await writeFile(configFile, JSON.stringify(config));
const cargoFile = 'app/desktop/src-tauri/Cargo.toml';
await writeFile(cargoFile, setPackageVersion(await readFile(cargoFile, 'utf8'), lock.channelVersion));
for (const file of ['app/desktop/package.json', 'app/desktop/src-tauri/tauri.conf.json']) {
  const json = JSON.parse(await readFile(file, 'utf8')); json.version = lock.channelVersion;
  await writeFile(file, JSON.stringify(json, null, 2) + '\n');
}
const env = { ...process.env, BUZZ_BUILD_CHANNEL: 'korean', VITE_BUZZ_BUILD_CHANNEL: 'korean', BUZZ_UPDATER_PUBLIC_KEY: channel.publicKey, BUZZ_UPDATER_ENDPOINT: endpoint, VITE_BUZZ_BESTIE: '0', CARGO_BUILD_JOBS: '2', CARGO_PROFILE_RELEASE_DEBUG: '0', CARGO_PROFILE_RELEASE_LTO: 'off' };
const execute = (command, args, cwd = resolve('app')) => run(command, args, { cwd, env, timeoutMs: 90 * 60 * 1000, maxBytes: 32 * 1024 * 1024, inherit: true });
const target = 'aarch64-apple-darwin';
await execute('cargo', ['build', '--release', '--target', target, '-p', 'buzz-acp', '-p', 'buzz-agent', '-p', 'buzz-backend-kubernetes', '-p', 'buzz-dev-mcp', '-p', 'git-credential-nostr', '-p', 'buzz-cli']);
await execute('bash', ['scripts/bundle-sidecars.sh', target]);
await execute('node', ['scripts/tauri-command.mjs', 'build', '--target', target, '--config', configFile], resolve('app/desktop'));
const bundle = resolve(`app/desktop/src-tauri/target/${target}/release/bundle`);
const app = `${bundle}/macos/Buzz Korean.app`;
const info = JSON.parse(await run('plutil', ['-convert', 'json', '-o', '-', `${app}/Contents/Info.plist`]));
if (info.CFBundleIdentifier !== config.identifier || info.CFBundleShortVersionString !== lock.channelVersion) throw new Error('Bundled app identity/version mismatch');
if (info.CFBundleName !== 'Buzz Korean' || info.CFBundleDisplayName !== 'Buzz Korean') throw new Error('Bundled app display name mismatch');
const schemes = (info.CFBundleURLTypes ?? []).flatMap(type => type.CFBundleURLSchemes ?? []);
if (schemes.length !== 2 || !schemes.includes('buzz') || !schemes.includes('buzz-korean')) throw new Error('Bundled URL scheme mismatch');
await execute('codesign', ['--verify', '--deep', '--strict', app], root);
const arch = await run('lipo', ['-archs', `${app}/Contents/MacOS/${info.CFBundleExecutable}`]);
if (arch.trim() !== 'arm64') throw new Error('Unexpected application architecture');
let checked = 0;
async function inspectMachO(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (++checked > 20000) throw new Error('Application file count exceeds inspection bound');
    const file = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await inspectMachO(file);
    else if (entry.isFile() && (await run('file', ['-b', file])).includes('Mach-O')) {
      const architectures = (await run('lipo', ['-archs', file])).trim().split(/\s+/);
      if (!architectures.includes('arm64')) throw new Error(`Bundled native helper lacks ARM64: ${entry.name}`);
    }
  }
}
await inspectMachO(app);
await mkdir('artifacts', { recursive: true });
await createUpdaterArchive(app, 'artifacts/BuzzKorean.app.tar.gz');
const dmgs = (await readdir(`${bundle}/dmg`)).filter(name => name.endsWith('.dmg'));
if (dmgs.length !== 1) throw new Error('Expected exactly one DMG');
await copyFile(`${bundle}/dmg/${dmgs[0]}`, 'artifacts/BuzzKorean.dmg');
const artifacts = [];
for (const name of ['BuzzKorean.app.tar.gz', 'BuzzKorean.dmg']) {
  const data = await readFile(`artifacts/${name}`);
  artifacts.push({ name, sha256: createHash('sha256').update(data).digest('hex'), size: (await stat(`artifacts/${name}`)).size });
}
await writeFile('artifacts/build.json', JSON.stringify({ schemaVersion: 1, version: lock.channelVersion, sourceCommit: lock.sourceCommit, candidateCommit, platform: 'darwin-aarch64', artifacts }, null, 2) + '\n');
console.log(`Packaged Buzz Korean ${lock.channelVersion} from ${lock.sourceCommit}`);
