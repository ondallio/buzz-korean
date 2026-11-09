import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, chmod, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const publisher = fileURLToPath(new URL('../scripts/publish.mjs', import.meta.url));
// Public minisign-verify vectors sign the exact bytes "test". These tests use
// real signature verification without creating or reading a private key.
const publicLine = 'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3';
const publicKey = Buffer.from(`untrusted comment: minisign public key\n${publicLine}\n`).toString('base64');
const primary = 'RUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=';
const signatures = [
  ['timestamp:1556193335\tfile:test', 'y/rUw2y8/hOUYjZU71eHp/Wo1KZ40fGy2VJEDl34XMJM+TX48Ss/17u3IvIfbVR1FkZZSNCisQbuQY+bHwhEBg=='],
  ['timestamp:1633700835\tfile:test\tprehashed', 'wLMDjy9FLAuxZ3q4NlEvkgtyhrr0gtTu6KC4KBJdITbbOeAi1zBIYo0v4iTgt8jJpIidRJnp94ABQkJAgAooBQ=='],
].map(([comment, global]) => Buffer.from([
  'untrusted comment: signature from minisign secret key', primary, `trusted comment: ${comment}`, global,
].join('\n')).toString('base64'));
const expected = {
  version: '1.0.1', sourceCommit: 'a'.repeat(40), candidateCommit: 'b'.repeat(40),
  controlCommit: 'c'.repeat(40), fingerprint: 'd'.repeat(64), releaseId: 1,
};
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

async function fixture(t, options = {}) {
  const cwd = await mkdtemp(join(tmpdir(), 'buzz-publish-retry-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await mkdir(join(cwd, 'bin'));
  await mkdir(join(cwd, 'scripts'));
  await symlink(fileURLToPath(new URL('../scripts/verify-archive.py', import.meta.url)), join(cwd, 'scripts', 'verify-archive.py'));
  // The orchestration fixtures use public signatures for bytes "test", not a
  // runnable archive. The Python and native envelope gates are explicitly
  // stubbed here; their own tests exercise actual validation. The non-TAR
  // publisher case below invokes the real Python gate before any native gate.
  if (!options.realArchiveCheck) {
    const python = join(cwd, 'bin', 'python3');
    await writeFile(python, `#!/usr/bin/env node
const args=process.argv.slice(2);
if(args.length!==3||!args[0].endsWith('verify-archive.py')||args[1]!=='artifacts/BuzzKorean.app.tar.gz'||args[2]!=='1.0.1')process.exit(2);
console.log(JSON.stringify({bundle:'Buzz Korean.app',version:'1.0.1',executables:7}));`);
    await chmod(python, 0o755);
    await writeFile(join(cwd, 'scripts', 'verify-native-bundle.mjs'), `import fs from 'node:fs';
const args=process.argv.slice(2);
if(JSON.stringify(args)!==JSON.stringify(['artifacts/BuzzKorean.app.tar.gz','artifacts/BuzzKorean.dmg','1.0.1']))throw new Error('Unexpected native gate arguments');
if(process.env.TAURI_SIGNING_PRIVATE_KEY||process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD||process.env.GH_TOKEN)throw new Error('Native gate inherited a signing key or GitHub token');
const state=JSON.parse(fs.readFileSync('state.json'));state.nativeChecks++;fs.writeFileSync('state.json',JSON.stringify(state));
console.log(JSON.stringify({fixtureOnly:true}));`);
  }
  await writeFile(join(cwd, 'prepared.json'), JSON.stringify(expected));
  await writeFile(join(cwd, 'channel.json'), JSON.stringify({ publicKey }));
  const stateFile = join(cwd, 'state.json');
  await writeFile(stateFile, JSON.stringify({
    signs: 0, nativeChecks: 0, failedUpload: false, failOnce: options.failOnce ?? true,
    injectNewerRelease: options.injectNewerRelease ?? false,
    published: 0, uploads: [], git: [],
    release: {
      id: 1, body: JSON.stringify(expected), draft: true, prerelease: false,
      tag_name: 'korean-v1.0.1', target_commitish: expected.candidateCommit,
      created_at: '2026-11-09T00:00:00Z', assets: [],
    },
  }));
  const signer = join(cwd, 'signer.mjs');
  // A second invocation would create a different valid signature for the same
  // archive. The production retry must use the previously uploaded bytes.
  await writeFile(signer, `import fs from 'node:fs';
const state=JSON.parse(fs.readFileSync('state.json'));
fs.writeFileSync('artifacts/BuzzKorean.app.tar.gz.sig',${JSON.stringify(signatures)}[Math.min(state.signs++,1)]);
fs.writeFileSync('state.json',JSON.stringify(state));`);
  const gh = join(cwd, 'bin', 'gh');
  await writeFile(gh, `#!/usr/bin/env node
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const args=process.argv.slice(2),state=JSON.parse(fs.readFileSync('state.json'));
const save=()=>fs.writeFileSync('state.json',JSON.stringify(state));
const fail=message=>{console.error(message);save();process.exit(2)};
let output;
if(args[0]==='api') {
  const endpoint=args[1],method=args[args.indexOf('--method')+1];
  if(endpoint==='repos/ondallio/buzz-korean/git/ref/heads/main') output={object:{sha:${JSON.stringify(expected.controlCommit)}}};
  else if(endpoint.startsWith('repos/ondallio/buzz-korean/releases?')) {
    output=state.injectNewerRelease&&state.release.assets.length===6 ? [{draft:false,prerelease:false,tag_name:'korean-v1.0.2'}] : [];
  } else if(endpoint.startsWith('repos/ondallio/buzz-korean/releases/assets/')) {
    const asset=state.release.assets.find(asset=>asset.id===Number(endpoint.split('/').at(-1)));
    if(!asset) fail('missing asset');
    process.stdout.write(Buffer.from(asset.content,'base64'));save();process.exit(0);
  } else if(endpoint==='repos/ondallio/buzz-korean/releases/1'&&method==='PATCH') {
    const data=JSON.parse(fs.readFileSync(0,'utf8'));
    if(data.draft!==false||data.make_latest!=='true') fail('unexpected publication');
    state.published++;Object.assign(state.release,data);output=state.release;
  } else if(endpoint==='repos/ondallio/buzz-korean/releases/1') output=state.release;
  else fail('unexpected API endpoint '+endpoint);
} else if(args[0]==='release'&&args[1]==='upload') {
  if(args[2]!=='korean-v1.0.1'||args.includes('--clobber')) fail('unsafe upload');
  const file=args[3],name=path.basename(file);
  if(name==='latest.json'&&state.failOnce&&!state.failedUpload) {state.failedUpload=true;save();process.exit(1)}
  if(state.release.assets.some(asset=>asset.name===name)) fail('duplicate immutable asset');
  const bytes=fs.readFileSync(file);
  state.release.assets.push({id:state.release.assets.length+10,name,size:bytes.length,digest:'sha256:'+crypto.createHash('sha256').update(bytes).digest('hex'),state:'uploaded',content:bytes.toString('base64')});
  state.uploads.push(name);output={};
} else fail('unexpected gh command');
save();console.log(JSON.stringify(output));`);
  await chmod(gh, 0o755);
  const git = join(cwd, 'bin', 'git');
  await writeFile(git, `#!/usr/bin/env node
const fs=require('node:fs'),state=JSON.parse(fs.readFileSync('state.json'));state.git.push(process.argv.slice(2));fs.writeFileSync('state.json',JSON.stringify(state));`);
  await chmod(git, 0o755);
  async function freshBuildArtifact() {
    await rm(join(cwd, 'artifacts'), { recursive: true, force: true });
    await mkdir(join(cwd, 'artifacts'));
    const artifacts = [];
    for (const [name, bytes] of [['BuzzKorean.app.tar.gz', 'test'], ['BuzzKorean.dmg', 'disk-image']]) {
      await writeFile(join(cwd, 'artifacts', name), bytes);
      artifacts.push({ name, size: Buffer.byteLength(bytes), sha256: digest(bytes) });
    }
    await writeFile(join(cwd, 'artifacts/build.json'), JSON.stringify({
      schemaVersion: 1, version: expected.version, sourceCommit: expected.sourceCommit,
      candidateCommit: expected.candidateCommit, platform: 'darwin-aarch64', artifacts,
    }));
  }
  return {
    cwd, freshBuildArtifact,
    state: async () => JSON.parse(await readFile(stateFile, 'utf8')),
    wrongKey: async () => {
      const bytes = Buffer.from(publicLine, 'base64'); bytes[41] ^= 1;
      const wrong = Buffer.from(`untrusted comment: minisign public key\n${bytes.toString('base64')}\n`).toString('base64');
      await writeFile(join(cwd, 'channel.json'), JSON.stringify({ publicKey: wrong }));
    },
    run: ({ signingSecret = true } = {}) => spawnSync(process.execPath, [publisher], {
      cwd, env: { ...process.env, PATH: `${join(cwd, 'bin')}:${process.env.PATH}`,
        TAURI_SIGNING_PRIVATE_KEY: signingSecret ? 'test-double-only-no-private-key' : '', GH_TOKEN: 'fixture-channel-token', TRUSTED_TAURI_CLI: signer },
      encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024,
    }),
  };
}

test('actual publisher resumes an interrupted draft with identical signature and manifest bytes', async t => {
  const f = await fixture(t);
  await f.freshBuildArtifact();
  const first = f.run();
  assert.equal(first.status, 1, first.stderr);
  const interrupted = await f.state();
  assert.equal(interrupted.release.draft, true);
  assert.equal(interrupted.published, 0);
  assert.deepEqual(interrupted.release.assets.map(a => a.name), ['BuzzKorean.app.tar.gz', 'BuzzKorean.dmg', 'build.json', 'BuzzKorean.app.tar.gz.sig']);
  await f.freshBuildArtifact();
  const retry = f.run();
  assert.equal(retry.status, 0, retry.stderr);
  const completed = await f.state();
  assert.equal(completed.release.draft, false);
  assert.equal(completed.published, 1);
  assert.equal(completed.signs, 1, 'retry must preserve the already signed asset');
  assert.equal(completed.nativeChecks, 2, 'both jobs must validate native bytes before signing');
  assert.equal(completed.release.assets.length, 6);
  assert.equal(new Set(completed.uploads).size, 6, 'each immutable asset is uploaded once');
  const manifest = JSON.parse(Buffer.from(completed.release.assets.find(a => a.name === 'latest.json').content, 'base64').toString());
  assert.equal(manifest.version, '1.0.1');
  assert.equal(manifest.pub_date, '2026-11-09T00:00:00Z');
  assert.equal(manifest.platforms['darwin-aarch64'].signature, signatures[0]);
  assert.equal(manifest.platforms['darwin-aarch64'].url, 'https://github.com/ondallio/buzz-korean/releases/download/korean-v1.0.1/BuzzKorean.app.tar.gz');
  assert.deepEqual(completed.git.at(-1), ['push', 'origin', `${expected.candidateCommit}:refs/heads/main`]);
});

for (const retry of [false, true]) {
  test(`actual publisher rejects a wrong pinned key ${retry ? 'when reusing uploaded signature' : 'before first upload'}`, async t => {
    const f = await fixture(t, { failOnce: retry });
    await f.freshBuildArtifact();
    if (retry) {
      assert.equal(f.run().status, 1);
      await f.freshBuildArtifact();
    }
    const before = await f.state();
    await f.wrongKey();
    const result = f.run();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /signature|key/i);
    const after = await f.state();
    assert.equal(after.release.draft, true);
    assert.equal(after.published, 0);
    assert.deepEqual(after.uploads, before.uploads);
    assert.deepEqual(after.git, []);
  });
}

test('actual publisher refuses a newer channel release that appears during upload', async t => {
  const f = await fixture(t, { failOnce: false, injectNewerRelease: true });
  await f.freshBuildArtifact();
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /newer|stale/i);
  const state = await f.state();
  assert.equal(state.release.assets.length, 6, 'race appears after all immutable assets uploaded');
  assert.equal(state.release.draft, true);
  assert.equal(state.published, 0);
  assert.deepEqual(state.git, []);
});


test('actual publisher rejects non-TAR payload before requiring a signing key or invoking signer', async t => {
  const f = await fixture(t, { realArchiveCheck: true });
  await f.freshBuildArtifact();
  const result = f.run({ signingSecret: false });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Archive rejected/);
  assert.doesNotMatch(result.stderr, /Dedicated signing key missing/);
  const state = await f.state();
  assert.equal(state.signs, 0);
  assert.equal(state.nativeChecks, 0);
  assert.equal(state.published, 0);
  assert.deepEqual(state.uploads, []);
  assert.deepEqual(state.git, []);
});
