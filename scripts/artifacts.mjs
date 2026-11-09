import { constants } from 'node:fs';
import { lstat, open, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const REPOSITORY = 'ondallio/buzz-korean';
const PLATFORM = 'darwin-aarch64';
const ARCHIVE = 'BuzzKorean.app.tar.gz';
const DMG = 'BuzzKorean.dmg';
const RECEIPT = 'build.json';
const ARTIFACT_NAMES = [ARCHIVE, DMG];
const PACKAGE_NAMES = [...ARTIFACT_NAMES, RECEIPT].sort();
const MAX_ARTIFACT_SIZE = 2 ** 31;
const MAX_RECEIPT_SIZE = 32 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const COMMIT_PATTERN = /^[a-f0-9]{40}$/;

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function stableVersion(version) {
  requireThat(typeof version === 'string' && version.length <= 64 &&
    /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(version) &&
    version.split('.').every((part) => Number.isSafeInteger(Number(part))),
  'Expected a strict stable X.Y.Z version');
  return version;
}

function channel(repository = REPOSITORY) {
  requireThat(repository === REPOSITORY, 'Foreign repository is not an accepted update channel');
  return repository;
}

function exactKeys(value, keys, label) {
  requireThat(value !== null && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  requireThat(JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort()), `${label} has missing or unexpected fields`);
}

function validSize(size, maximum) {
  return Number.isSafeInteger(size) && size > 0 && size <= maximum;
}

function sameFile(a, b) {
  return a.dev === b.dev && a.ino === b.ino && a.size === b.size &&
    a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs;
}

async function inspectFile(path, maximum, collect = false) {
  const before = await lstat(path);
  requireThat(before.isFile() && !before.isSymbolicLink(), 'Expected a regular non-symlink file');
  requireThat(validSize(before.size, maximum), 'File size is empty or exceeds the size limit');
  // NOFOLLOW closes the lstat/open symlink race. A file descriptor keeps the
  // hashed object fixed; a final path/stat comparison detects replacement.
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = await handle.stat();
    requireThat(opened.isFile() && sameFile(before, opened), 'Artifact file changed while opening');
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(64 * 1024);
    const chunks = [];
    let size = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      size += bytesRead;
      requireThat(size <= maximum && size <= opened.size, 'Artifact grew beyond its size limit while reading');
      hash.update(buffer.subarray(0, bytesRead));
      if (collect) chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    const after = await handle.stat();
    const pathAfter = await lstat(path);
    requireThat(size === opened.size && sameFile(opened, after) && pathAfter.isFile() &&
      !pathAfter.isSymbolicLink() && sameFile(opened, pathAfter), 'Artifact file changed during inspection');
    return { path, sha256: hash.digest('hex'), size, ...(collect ? { data: Buffer.concat(chunks) } : {}) };
  } finally {
    await handle.close();
  }
}

function validateReceipt(receipt, expected) {
  exactKeys(receipt, ['schemaVersion', 'version', 'sourceCommit', 'candidateCommit', 'platform', 'artifacts'], 'Build receipt');
  requireThat(receipt.schemaVersion === 1, 'Unsupported receipt schema version');
  requireThat(receipt.platform === PLATFORM, 'Unexpected receipt platform');
  for (const field of ['version', 'sourceCommit', 'candidateCommit']) {
    requireThat(receipt[field] === expected[field], `Build receipt ${field} does not match expected identity`);
  }
  requireThat(Array.isArray(receipt.artifacts) && receipt.artifacts.length === 2, 'Build receipt must contain exactly two artifacts');
  const names = new Set();
  for (const artifact of receipt.artifacts) {
    exactKeys(artifact, ['name', 'sha256', 'size'], 'Receipt artifact');
    requireThat(ARTIFACT_NAMES.includes(artifact.name) && !names.has(artifact.name), 'Unexpected or duplicate receipt artifact name');
    names.add(artifact.name);
    requireThat(typeof artifact.sha256 === 'string' && HASH_PATTERN.test(artifact.sha256), 'Invalid artifact sha256 digest');
    requireThat(validSize(artifact.size, MAX_ARTIFACT_SIZE), 'Invalid receipt artifact size');
  }
}

/** Inspect the exact unsigned package against a caller-pinned source identity.
 * Returns computed digests, never receipt claims alone. The caller must retain
 * exclusive ownership of the accepted directory until signing or uploading.
 */
export async function inspectArtifacts(dir, expected) {
  requireThat(expected && typeof expected === 'object', 'Expected artifact identity is required');
  stableVersion(expected.version);
  const repository = channel(expected.repository);
  for (const field of ['sourceCommit', 'candidateCommit']) {
    requireThat(typeof expected[field] === 'string' && COMMIT_PATTERN.test(expected[field]), `Invalid expected ${field}`);
  }
  requireThat(typeof dir === 'string' && dir.length > 0, 'Artifact directory is required');
  const directory = resolve(dir);
  const initialDir = await lstat(directory);
  requireThat(initialDir.isDirectory() && !initialDir.isSymbolicLink(), 'Expected a non-symlink artifact directory');
  const names = (await readdir(directory)).sort();
  requireThat(JSON.stringify(names) === JSON.stringify(PACKAGE_NAMES), 'Artifact directory must contain the exact package files, with no missing or unexpected files');
  // Bound every file before hashing anything, including sparse oversized files.
  for (const name of names) {
    const stat = await lstat(join(directory, name));
    requireThat(stat.isFile() && !stat.isSymbolicLink(), 'Expected regular non-symlink package files');
    requireThat(validSize(stat.size, name === RECEIPT ? MAX_RECEIPT_SIZE : MAX_ARTIFACT_SIZE), 'Package file size is empty or exceeds the size limit');
  }
  const receiptFile = await inspectFile(join(directory, RECEIPT), MAX_RECEIPT_SIZE, true);
  let receipt;
  try {
    receipt = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(receiptFile.data));
  } catch (cause) {
    throw new Error('Build receipt must be valid UTF-8 JSON', { cause });
  }
  validateReceipt(receipt, expected);
  const artifacts = [];
  for (const name of ARTIFACT_NAMES) {
    const actual = await inspectFile(join(directory, name), MAX_ARTIFACT_SIZE);
    const recorded = receipt.artifacts.find((entry) => entry.name === name);
    requireThat(actual.size === recorded.size, `Artifact size mismatch: ${name}`);
    requireThat(actual.sha256 === recorded.sha256, `Artifact sha256 digest mismatch: ${name}`);
    artifacts.push({ name, ...actual });
  }
  const finalDir = await lstat(directory);
  requireThat(finalDir.isDirectory() && !finalDir.isSymbolicLink() && sameFile(initialDir, finalDir) &&
    JSON.stringify((await readdir(directory)).sort()) === JSON.stringify(PACKAGE_NAMES), 'Artifact directory changed during inspection');
  return {
    version: expected.version, sourceCommit: expected.sourceCommit, candidateCommit: expected.candidateCommit,
    repository, platform: PLATFORM, receipt, receiptPath: receiptFile.path,
    receiptSha256: receiptFile.sha256, receiptSize: receiptFile.size, artifacts,
  };
}

function base64Bytes(value, label) {
  requireThat(typeof value === 'string' && value.length > 0 && value.length % 4 === 0 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value), `Invalid ${label} base64 encoding`);
  const bytes = Buffer.from(value, 'base64');
  requireThat(bytes.toString('base64') === value, `Noncanonical ${label} base64 encoding`);
  return bytes;
}

function signaturePayload(value) {
  requireThat(typeof value === 'string' && value.length <= 8192, 'Invalid signature payload size');
  const signature = value.trim();
  const bytes = base64Bytes(signature, 'signature');
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replaceAll('\r\n', '\n');
  const lines = (decoded.endsWith('\n') ? decoded.slice(0, -1) : decoded).split('\n');
  requireThat(lines.length === 4 && lines[0].startsWith('untrusted comment: signature from ') &&
    lines[2].startsWith('trusted comment: ') && !/[\x00-\x08\x0b-\x1f\x7f]/.test(lines[0] + lines[2]),
  'Expected a minisign signature payload, not a key or arbitrary content');
  const primary = base64Bytes(lines[1], 'minisign signature');
  const global = base64Bytes(lines[3], 'minisign global signature');
  requireThat(primary.length === 74 && global.length === 64 && primary[0] === 0x45 &&
    (primary[1] === 0x44 || primary[1] === 0x64), 'Invalid minisign signature length or algorithm');
  return signature;
}

/** Build the fixed Korean ARM64 feed. This validates signature encoding only;
 * the signing/publishing caller must verify it cryptographically with its key.
 */
export function makeManifest({ version, signature, publishedAt, notes = '', repository } = {}) {
  stableVersion(version);
  const repo = channel(repository);
  requireThat(typeof publishedAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(publishedAt), 'Expected an RFC3339 UTC publication date');
  const parsed = new Date(publishedAt);
  requireThat(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 19) === publishedAt.slice(0, 19), 'Invalid publication date');
  requireThat(typeof notes === 'string' && Buffer.byteLength(notes) <= 16384 && !notes.includes('\0'), 'Invalid update notes size or content');
  return {
    version, notes, pub_date: publishedAt,
    platforms: { [PLATFORM]: { signature: signaturePayload(signature),
      url: `https://github.com/${repo}/releases/download/korean-v${version}/${ARCHIVE}` } },
  };
}

/** Permit an existing public asset only when the exact expected bytes exist.
 * A mismatch is an error; callers must never replace it using --clobber.
 */
export function validateArtifactReuse(existingAsset, expected) {
  requireThat(expected && typeof expected.name === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(expected.name) && !expected.name.includes('..') &&
    typeof expected.sha256 === 'string' && HASH_PATTERN.test(expected.sha256) &&
    validSize(expected.size, MAX_ARTIFACT_SIZE), 'Invalid expected asset identity');
  requireThat(existingAsset && typeof existingAsset === 'object' && existingAsset.state === 'uploaded' &&
    existingAsset.name === expected.name && existingAsset.size === expected.size &&
    existingAsset.digest === `sha256:${expected.sha256}`, 'Refusing public asset overwrite or reuse with missing/mismatched digest, size or name');
  return true;
}
