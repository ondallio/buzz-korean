import { createHash } from 'node:crypto';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { run } from './process.mjs';
import { api, releases, resolveTag } from './github.mjs';
import { integrateTrees } from './git-integration.mjs';
import { selectStableRelease, parseVersion, assertTagUnchanged, assertSourceFreshness } from './release-policy.mjs';
import { repository } from './channel-config.mjs';

const cwd = process.cwd();
const git = args => run('git', args, { cwd });
const sha = value => { if (!/^[0-9a-f]{40}$/.test(value)) throw new Error('Expected full SHA'); return value; };
const numeric = text => { const v = parseVersion(text); return [v.major, v.minor, v.patch]; };
const compare = (a, b) => { const av = numeric(a), bv = numeric(b); for (let i = 0; i < 3; i++) if (av[i] !== bv[i]) return Math.sign(av[i] - bv[i]); return 0; };

export function nextVersion(all, minimum = '1.0.0') {
  let max;
  for (const release of all) {
    const match = /^korean-v(1\.0\.(?:0|[1-9]\d*))$/.exec(release.tag_name);
    if (match && (!max || compare(match[1], max) > 0)) max = match[1];
  }
  if (!max) return minimum;
  const patch = numeric(max)[2] + 1;
  if (!Number.isSafeInteger(patch)) throw new Error('Channel version exhausted');
  return `1.0.${patch}`;
}

export async function prepare({ buildCurrent = false } = {}) {
  if ((await git(['status', '--porcelain'])).trim()) throw new Error('Prepare requires a clean checkout');
  const rootCommit = sha((await git(['rev-parse', 'HEAD'])).trim());
  const lock = JSON.parse(await readFile('upstream.lock.json', 'utf8'));
  if (lock.upstreamRepository !== 'block/buzz' || lock.channelRepository !== repository) throw new Error('Unexpected source/channel repository');
  const all = await releases();
  // Repair a previous successful publication whose final source fast-forward failed.
  const published = all.filter(r => !r.draft && !r.prerelease && /^korean-v1\.0\.\d+$/.test(r.tag_name)).sort((a, b) => compare(b.tag_name.slice(8), a.tag_name.slice(8)))[0];
  if (published && published.target_commitish !== rootCommit) {
    const journal = JSON.parse(published.body);
    if (journal.controlCommit === rootCommit && /^[0-9a-f]{40}$/.test(published.target_commitish)) {
      await git(['fetch', 'origin', published.target_commitish]);
      await git(['push', 'origin', `${published.target_commitish}:refs/heads/main`]);
      throw new Error('Recovered published source head. Re-run from updated main.');
    }
  }
  const official = selectStableRelease(await releases('block/buzz'));
  if (!official) throw new Error('No official stable desktop release');
  const observed = await resolveTag(official.tag_name);
  if (observed.tag === lock.lastObservedRelease.tag) assertTagUnchanged(lock.lastObservedRelease, observed);
  let sourceCommit = lock.sourceCommit;
  let sourceTree = lock.sourceTree;
  const isNew = official.tag_name !== lock.lastObservedRelease.tag && compare(official.tag_name.slice(9), lock.upstreamVersion) > 0;
  if (!isNew && !buildCurrent) { console.log('No new stable release. Existing source preserved.'); return { build: false }; }
  if (isNew) {
    const commit = await api(`repos/block/buzz/commits/${observed.commit}`);
    if (commit.commit?.verification?.verified !== true) throw new Error('Official source commit is not verified');
    assertSourceFreshness({ sourceCommit: observed.commit, commitDate: commit.commit.committer.date, publishedAt: official.published_at, upstreamVersion: official.tag_name.slice(9) }, { sourceCommit: lock.sourceCommit, sourceDate: '2026-11-03T02:50:08Z', upstreamVersion: lock.upstreamVersion });
    await git(['fetch', '--depth=1', 'upstream', observed.commit]);
    sourceCommit = observed.commit;
    sourceTree = sha((await git(['rev-parse', `${sourceCommit}^{tree}`])).trim());
    const pkg = JSON.parse(await git(['show', `${sourceCommit}:desktop/package.json`]));
    const tauri = JSON.parse(await git(['show', `${sourceCommit}:desktop/src-tauri/tauri.conf.json`]));
    const cargo = await git(['show', `${sourceCommit}:desktop/src-tauri/Cargo.toml`]);
    const cargoVersion = /\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m.exec(cargo)?.[1];
    if ([pkg.version, tauri.version, cargoVersion].some(value => value !== official.tag_name.slice(9))) throw new Error('Release tag/package/Tauri/Cargo version mismatch');
    assertTagUnchanged(observed, await resolveTag(official.tag_name));
  }
  const fingerprint = createHash('sha256').update([sourceCommit, await git(['rev-parse', 'HEAD:app']), await git(['rev-parse', 'HEAD:scripts']), await git(['rev-parse', 'HEAD:.github'])].join('\n')).digest('hex');
  const attempts = all.filter(r => r.draft && (() => { try { return JSON.parse(r.body).fingerprint === fingerprint; } catch { return false; } })());
  if (attempts.length >= 3) throw new Error('Three release attempts failed for this source/config. Repair code or re-run a failed job; scheduled builds paused for this fingerprint.');
  const version = nextVersion(all);
  const merged = await integrateTrees({ cwd, baseSourceTree: lock.sourceTree, nextSourceTree: sourceTree });
  const branch = `candidates/${version}-${fingerprint.slice(0, 12)}`;
  await git(['checkout', '-b', branch]);
  await git(['read-tree', '-u', '-m', 'HEAD', merged]);
  lock.sourceCommit = sourceCommit; lock.sourceTree = sourceTree; lock.channelVersion = version;
  if (isNew) { lock.upstreamVersion = official.tag_name.slice(9); lock.lastObservedRelease = { ...observed, releaseId: official.id }; }
  await writeFile('upstream.lock.json', JSON.stringify(lock, null, 2) + '\n');
  await git(['add', 'app', 'upstream.lock.json']);
  await git(['-c', 'core.hooksPath=/dev/null', 'commit', '--allow-empty', '-s', '-m', `release: prepare Korean ${version} from ${sourceCommit.slice(0, 12)}`]);
  const candidateCommit = sha((await git(['rev-parse', 'HEAD'])).trim());
  await git(['push', 'origin', `HEAD:refs/heads/${branch}`]);
  const journal = { schemaVersion: 1, version, upstreamVersion: lock.upstreamVersion, sourceCommit, candidateCommit, controlCommit: rootCommit, fingerprint, status: 'awaiting-validation', runId: process.env.GITHUB_RUN_ID };
  const draft = await api(`repos/${repository}/releases`, { method: 'POST', data: { tag_name: `korean-v${version}`, target_commitish: candidateCommit, name: `Buzz Korean ${version}`, body: JSON.stringify(journal), draft: true, prerelease: false, make_latest: 'false' } });
  return { build: true, ...journal, releaseId: draft.id, branch };
}

if (process.argv[1]?.endsWith('/prepare.mjs')) {
  const result = await prepare({ buildCurrent: process.env.BUILD_CURRENT === 'true' });
  await writeFile('prepared.json', JSON.stringify(result, null, 2) + '\n');
  if (process.env.GITHUB_OUTPUT) for (const [key, value] of Object.entries(result)) await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  console.log(JSON.stringify(result));
}
