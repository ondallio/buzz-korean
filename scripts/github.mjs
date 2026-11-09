import { run } from './process.mjs';
import { repository } from './channel-config.mjs';

export async function api(path, { method = 'GET', data, maxBytes } = {}) {
  if (!/^(repos\/(block\/buzz|ondallio\/buzz-korean)\/|user$)/.test(path)) throw new Error('Repository outside channel allowlist');
  const args = ['api', path, '--method', method];
  if (data !== undefined) args.push('--input', '-');
  return JSON.parse(await run('gh', args, { input: data === undefined ? undefined : JSON.stringify(data), maxBytes }));
}

export async function releases(repo = repository) {
  const values = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await api(`repos/${repo}/releases?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('Invalid release list');
    values.push(...batch);
    if (batch.length < 100) return values;
  }
  throw new Error('Release pagination exceeded bound; refusing incomplete history');
}

export async function resolveTag(tag) {
  if (!/^desktop-v\d+\.\d+\.\d+$/.test(tag)) throw new Error('Invalid official tag');
  let ref = await api(`repos/block/buzz/git/ref/tags/${tag}`);
  const tagObject = ref.object.sha;
  for (let depth = 0; depth < 5; depth++) {
    if (!/^[0-9a-f]{40}$/.test(ref.object.sha)) throw new Error('Invalid tag SHA');
    if (ref.object.type === 'commit') return { tag, commit: ref.object.sha, tagObject };
    if (ref.object.type !== 'tag') throw new Error('Unexpected tag object');
    ref = await api(`repos/block/buzz/git/tags/${ref.object.sha}`);
  }
  throw new Error('Annotated tag depth exceeded');
}

export async function downloadReleaseAsset(id, file) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid asset id');
  // gh writes to an explicit file, never stdout and never a supplied remote URL.
  const { open } = await import('node:fs/promises');
  const { spawn } = await import('node:child_process');
  const handle = await open(file, 'wx', 0o600);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('gh', ['api', `repos/${repository}/releases/assets/${id}`, '-H', 'Accept: application/octet-stream'], { stdio: ['ignore', handle.fd, 'ignore'] });
      const timer = setTimeout(() => child.kill('SIGKILL'), 120000);
      child.on('error', reject);
      child.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error('Asset download failed')); });
    });
  } finally { await handle.close(); }
}
