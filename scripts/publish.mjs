import { readFile, writeFile } from 'node:fs/promises';
import { run } from './process.mjs';
import { api, releases } from './github.mjs';
import { inspectArtifacts, makeManifest, validateArtifactReuse } from './artifacts.mjs';
import { repository } from './channel-config.mjs';
import { verifySignature } from './signature.mjs';

const signingKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
const signingPassword = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
delete process.env.TAURI_SIGNING_PRIVATE_KEY;
delete process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD;
const expected = JSON.parse(await readFile('prepared.json', 'utf8'));
const inspect = await inspectArtifacts('artifacts', expected);
await run('python3', ['scripts/verify-archive.py', 'artifacts/BuzzKorean.app.tar.gz', expected.version], { inherit: true });
const nativeEnv = { ...process.env };
delete nativeEnv.GH_TOKEN;
delete nativeEnv.GITHUB_TOKEN;
await run(process.execPath, ['scripts/verify-native-bundle.mjs', 'artifacts/BuzzKorean.app.tar.gz', 'artifacts/BuzzKorean.dmg', expected.version], { env: nativeEnv, inherit: true, timeoutMs: 10 * 60 * 1000 });
const release = await api(`repos/${repository}/releases/${expected.releaseId}`);
const journal = JSON.parse(release.body);
for (const key of ['version', 'sourceCommit', 'candidateCommit', 'controlCommit', 'fingerprint']) if (journal[key] !== expected[key]) throw new Error(`Draft journal mismatch: ${key}`);
if (!release.draft || release.tag_name !== `korean-v${expected.version}` || release.target_commitish !== expected.candidateCommit) throw new Error('Release reservation mismatch');
const latest = (await releases()).filter(r => !r.draft && !r.prerelease && /^korean-v1\.0\.\d+$/.test(r.tag_name));
if (latest.some(r => Number(r.tag_name.split('.').at(-1)) >= Number(expected.version.split('.').at(-1)))) throw new Error('Refusing stale publication');
const main = await api(`repos/${repository}/git/ref/heads/main`);
if (main.object.sha !== expected.controlCommit) throw new Error('Main changed during validation; release remains draft');
if (!signingKey) throw new Error('Dedicated signing key missing');
// Fixed trusted CLI outside candidate. This process never runs app build hooks.
const cli = process.env.TRUSTED_TAURI_CLI;
if (!cli || !cli.startsWith('/')) throw new Error('Expected absolute trusted signer path');
const oldSignature = release.assets.find(a => a.name === 'BuzzKorean.app.tar.gz.sig');
if (oldSignature) {
  if (oldSignature.size > 8192) throw new Error('Existing signature size exceeds bound');
  const previous = await run('gh', ['api', `repos/${repository}/releases/assets/${oldSignature.id}`, '-H', 'Accept: application/octet-stream'], { maxBytes: 8192 });
  await writeFile('artifacts/BuzzKorean.app.tar.gz.sig', previous);
} else {
  const signerEnv = { ...process.env, TAURI_SIGNING_PRIVATE_KEY: signingKey, TAURI_SIGNING_PRIVATE_KEY_PASSWORD: signingPassword ?? '' };
  delete signerEnv.GH_TOKEN;
  delete signerEnv.GITHUB_TOKEN;
  await run(process.execPath, [cli, 'signer', 'sign', 'artifacts/BuzzKorean.app.tar.gz'], { sensitive: true, env: signerEnv });
}
const signature = (await readFile('artifacts/BuzzKorean.app.tar.gz.sig', 'utf8')).trim();
const channel = JSON.parse(await readFile('channel.json', 'utf8'));
await verifySignature('artifacts/BuzzKorean.app.tar.gz', signature, channel.publicKey);
// Fixed reservation timestamp makes retries byte-identical, including metadata.
const manifest = makeManifest({ version: expected.version, signature, publishedAt: release.created_at, notes: `Buzz Korean ${expected.version}. Source block/buzz@${expected.sourceCommit}.`, repository });
await writeFile('artifacts/latest.json', JSON.stringify(manifest, null, 2) + '\n');
await writeFile('artifacts/SHA256SUMS', inspect.artifacts.map(a => `${a.sha256}  ${a.name}\n`).join(''));
// A failed upload leaves an immutable draft journal. Rerunning this job uses
// the original same-run build artifact and never silently clobbers public bits.
for (const name of ['BuzzKorean.app.tar.gz', 'BuzzKorean.dmg', 'build.json', 'BuzzKorean.app.tar.gz.sig', 'latest.json', 'SHA256SUMS']) {
  const existing = release.assets.find(a => a.name === name);
  if (existing) {
    const { createHash } = await import('node:crypto');
    const data = await readFile(`artifacts/${name}`);
    validateArtifactReuse(existing, { name, sha256: createHash('sha256').update(data).digest('hex'), size: data.length });
  } else await run('gh', ['release', 'upload', `korean-v${expected.version}`, `artifacts/${name}`, '--repo', repository]);
}
const complete = await api(`repos/${repository}/releases/${expected.releaseId}`);
if (complete.assets.length !== 6 || complete.assets.some(a => a.state !== 'uploaded')) throw new Error('Release is incomplete');
const finalMain = await api(`repos/${repository}/git/ref/heads/main`);
if (finalMain.object.sha !== expected.controlCommit) throw new Error('Main changed before publication');
const finalReleases = await releases();
if (finalReleases.some(r => !r.draft && !r.prerelease && /^korean-v1\.0\.\d+$/.test(r.tag_name) && Number(r.tag_name.split('.').at(-1)) >= Number(expected.version.split('.').at(-1)))) throw new Error('A newer channel version was published during signing; refusing stale latest pointer');
await api(`repos/${repository}/releases/${expected.releaseId}`, { method: 'PATCH', data: { draft: false, make_latest: 'true', body: JSON.stringify({ ...journal, status: 'published', manifest, artifacts: inspect.artifacts.map(({ name, sha256, size }) => ({ name, sha256, size })) }) } });
// Publication is valid before source promotion. Failure propagates; the next
// prepare run explicitly repairs this completed publication's fast-forward.
await run('git', ['fetch', 'origin', expected.candidateCommit]);
await run('git', ['push', 'origin', `${expected.candidateCommit}:refs/heads/main`]);
console.log(`Published https://github.com/${repository}/releases/tag/korean-v${expected.version}`);
