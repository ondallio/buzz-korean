import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, symlink, mkdir, truncate } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// These tests exercise the real filesystem and public validator exports.
const modulePath = new URL('../scripts/artifacts.mjs', import.meta.url);
let api;
test.before(async () => { api = await import(modulePath); });
const expected = { version: '1.0.7', sourceCommit: 'a'.repeat(40), candidateCommit: 'b'.repeat(40) };
const hash = (data) => createHash('sha256').update(data).digest('hex');
const signatureText = [
  'untrusted comment: signature from minisign secret key',
  'RUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=',
  'trusted comment: timestamp:1633700835\tfile:test\tprehashed',
  'wLMDjy9FLAuxZ3q4NlEvkgtyhrr0gtTu6KC4KBJdITbbOeAi1zBIYo0v4iTgt8jJpIidRJnp94ABQkJAgAooBQ==',
].join('\n');
const signature = Buffer.from(signatureText).toString('base64');
const manifestInput = { version: '1.0.7', signature, publishedAt: '2026-11-09T01:02:03.000Z', notes: '한국어판 업데이트' };

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'buzz-artifact-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const artifacts = [];
  for (const [name, bytes] of [['BuzzKorean.app.tar.gz', 'signed-app-archive'], ['BuzzKorean.dmg', 'disk-image']]) {
    await writeFile(join(dir, name), bytes);
    artifacts.push({ name, sha256: hash(bytes), size: Buffer.byteLength(bytes) });
  }
  const receipt = { schemaVersion: 1, ...expected, platform: 'darwin-aarch64', artifacts };
  await writeFile(join(dir, 'build.json'), JSON.stringify(receipt));
  return { dir, receipt, save: () => writeFile(join(dir, 'build.json'), JSON.stringify(receipt)) };
}

test('only the exact receipt-bound files become trusted artifact paths and digests', async (t) => {
  const { dir, receipt } = await fixture(t);
  const result = await api.inspectArtifacts(dir, expected);
  assert.equal(result.repository, 'ondallio/buzz-korean');
  assert.equal(result.platform, 'darwin-aarch64');
  assert.equal(result.version, '1.0.7');
  assert.deepEqual(result.receipt, receipt);
  assert.equal(result.receiptPath, join(dir, 'build.json'));
  for (const entry of result.artifacts) {
    assert.equal(entry.path, join(dir, entry.name));
    assert.equal(entry.sha256, hash(await readFile(entry.path)));
    assert.equal(entry.size, receipt.artifacts.find((x) => x.name === entry.name).size);
  }
});

test('artifact bytes and receipt sizes are checked independently, not trusted as claims', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.dir, 'BuzzKorean.dmg'), 'disk-imagE');
  await assert.rejects(api.inspectArtifacts(f.dir, expected), /digest|sha256/i);
  f.receipt.artifacts[1].sha256 = hash('disk-imagE');
  f.receipt.artifacts[1].size++;
  await f.save();
  await assert.rejects(api.inspectArtifacts(f.dir, expected), /size/i);
});

for (const [label, mutate] of [
  ['wrong version', (r) => { r.version = '1.0.8'; }],
  ['wrong source commit', (r) => { r.sourceCommit = 'c'.repeat(40); }],
  ['wrong candidate commit', (r) => { r.candidateCommit = 'c'.repeat(40); }],
  ['foreign platform', (r) => { r.platform = 'darwin-x86_64'; }],
  ['unknown schema', (r) => { r.schemaVersion = 2; }],
  ['foreign receipt field', (r) => { r.script = 'curl evil'; }],
  ['duplicate artifact', (r) => { r.artifacts[1] = { ...r.artifacts[0] }; }],
  ['path traversal', (r) => { r.artifacts[0].name = '../BuzzKorean.app.tar.gz'; }],
  ['missing digest', (r) => { delete r.artifacts[0].sha256; }],
  ['extra artifact field', (r) => { r.artifacts[0].url = 'https://evil.test'; }],
  ['unsafe size', (r) => { r.artifacts[0].size = Number.MAX_SAFE_INTEGER; }],
]) test(`receipt rejects ${label}`, async (t) => {
  const f = await fixture(t); mutate(f.receipt); await f.save();
  await assert.rejects(api.inspectArtifacts(f.dir, expected));
});

test('unexpected files, missing files and directories cannot pass as a release package', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.dir, 'credentials.key'), 'not acceptable');
  await assert.rejects(api.inspectArtifacts(f.dir, expected), /unexpected|exact|foreign/i);
  await rm(join(f.dir, 'credentials.key'));
  await rm(join(f.dir, 'BuzzKorean.dmg'));
  await assert.rejects(api.inspectArtifacts(f.dir, expected), /missing|exact/i);
  await mkdir(join(f.dir, 'BuzzKorean.dmg'));
  await assert.rejects(api.inspectArtifacts(f.dir, expected), /regular|file/i);
});

for (const name of ['build.json', 'BuzzKorean.dmg', 'BuzzKorean.app.tar.gz']) {
  test(`symlink ${name} is rejected even when its target bytes are valid`, async (t) => {
    const f = await fixture(t);
    const outside = await mkdtemp(join(tmpdir(), 'buzz-artifact-link-'));
    t.after(() => rm(outside, { recursive: true, force: true }));
    const dest = join(outside, name);
    await writeFile(dest, await readFile(join(f.dir, name)));
    await rm(join(f.dir, name));
    await symlink(dest, join(f.dir, name));
    await assert.rejects(api.inspectArtifacts(f.dir, expected), /regular|symlink/i);
  });
}

test('symlink root, oversized receipt, sparse oversized archive and empty files fail before acceptance', async (t) => {
  const f = await fixture(t);
  const parent = await mkdtemp(join(tmpdir(), 'buzz-artifact-root-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const link = join(parent, 'package'); await symlink(f.dir, link);
  await assert.rejects(api.inspectArtifacts(link, expected), /directory|symlink/i);
  await writeFile(join(f.dir, 'build.json'), ' '.repeat(65537));
  await assert.rejects(api.inspectArtifacts(f.dir, expected), /size|large|limit/i);
  await f.save();
  await truncate(join(f.dir, 'BuzzKorean.app.tar.gz'), 2 ** 31 + 1);
  await assert.rejects(api.inspectArtifacts(f.dir, expected), /size|large|limit/i);
  await truncate(join(f.dir, 'BuzzKorean.app.tar.gz'), 0);
  await assert.rejects(api.inspectArtifacts(f.dir, expected), /size|empty/i);
});

test('expectation rejects ambiguous version, commit or repository before trusting receipts', async (t) => {
  const f = await fixture(t);
  for (const overrides of [{ version: '1.0.7+ko.2' }, { version: '01.0.7' }, { sourceCommit: 'main' }, { candidateCommit: 'abc' }, { repository: 'block/buzz' }]) {
    await assert.rejects(api.inspectArtifacts(f.dir, { ...expected, ...overrides }));
  }
});

test('malformed and non-object receipts fail rather than creating trusted empty metadata', async (t) => {
  const f = await fixture(t);
  for (const bytes of ['{', 'null', '[]', '"receipt"', Buffer.from([0xff, 0xfe, 0x7b])]) {
    await writeFile(join(f.dir, 'build.json'), bytes);
    await assert.rejects(api.inspectArtifacts(f.dir, expected), /receipt|JSON|object/i);
  }
});

test('manifest fixes the Korean ARM64 channel and preserves actual notes and signature bytes', () => {
  assert.deepEqual(api.makeManifest(manifestInput), {
    version: '1.0.7', notes: '한국어판 업데이트', pub_date: '2026-11-09T01:02:03.000Z',
    platforms: { 'darwin-aarch64': { signature, url: 'https://github.com/ondallio/buzz-korean/releases/download/korean-v1.0.7/BuzzKorean.app.tar.gz' } },
  });
  assert.equal(api.makeManifest({ ...manifestInput, signature: `${signature}\n` }).platforms['darwin-aarch64'].signature, signature);
});

test('manifest rejects prerelease, metadata, foreign repository, invalid dates and oversized notes', () => {
  for (const overrides of [{ version: '1.0.7-rc.1' }, { version: '1.0.7+ko.1' }, { version: '1.0.07' }, { repository: 'block/buzz' }, { publishedAt: 'tomorrow' }, { publishedAt: '2026-02-30T00:00:00.000Z' }, { notes: 'x'.repeat(65537) }]) {
    assert.throws(() => api.makeManifest({ ...manifestInput, ...overrides }));
  }
});

test('manifest rejects malformed, truncated, key-like and algorithm-invalid signatures', () => {
  const invalid = ['', 'https://evil.test/sig', 'not base64', Buffer.from('secret key').toString('base64'),
    'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3',
    Buffer.from('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----').toString('base64'),
    Buffer.from(signatureText.split('\n').slice(0, 3).join('\n')).toString('base64'),
    Buffer.from(signatureText.replace('RUQf', 'WFgf')).toString('base64'),
    Buffer.from(`${signatureText}\nprivate key: leak`).toString('base64'),
    signature.replace(/.$/, '!'), 'A'.repeat(20000)];
  for (const bad of invalid) assert.throws(() => api.makeManifest({ ...manifestInput, signature: bad }));
});

test('asset reuse permits exact GitHub digest and size, rejects overwrite or missing integrity metadata', () => {
  const wanted = { name: 'BuzzKorean.dmg', sha256: 'd'.repeat(64), size: 42 };
  const asset = { name: wanted.name, digest: `sha256:${wanted.sha256}`, size: 42, state: 'uploaded' };
  assert.equal(api.validateArtifactReuse(asset, wanted), true);
  for (const bad of [null, {}, { ...asset, digest: null }, { ...asset, digest: `sha256:${'e'.repeat(64)}` }, { ...asset, size: 41 }, { ...asset, name: 'Buzz.dmg' }, { ...asset, state: 'starter' }]) {
    assert.throws(() => api.validateArtifactReuse(bad, wanted));
  }
  assert.throws(() => api.validateArtifactReuse(asset, { ...wanted, sha256: 'not-a-hash' }));
});
