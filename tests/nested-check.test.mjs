import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { run } from '../scripts/process.mjs';
import { spawnSync } from 'node:child_process';

test('repository file-size gate detects a new oversized file under nested app/', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ko-nested-'));
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
  const git = args => run('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: dir, env });
  try {
    await git(['init']); await git(['config', 'user.name', 'Test']); await git(['config', 'user.email', 'test@example.com']);
    const project = join(dir, 'app/desktop'); await mkdir(join(project, 'src'), { recursive: true });
    await writeFile(join(project, 'src/large.ts'), 'x\n'.repeat(3));
    await git(['add', '.']); await git(['commit', '-m', 'base']);
    const base = (await git(['rev-parse', 'HEAD'])).trim();
    await writeFile(join(project, 'src/large.ts'), 'x\n'.repeat(10));
    const module = pathToFileURL(resolve('app/scripts/check-file-sizes-core.mjs')).href;
    const script = `import {runFileSizeCheck} from ${JSON.stringify(module)}; await runFileSizeCheck({projectRoot:${JSON.stringify(project)},label:'Fixture',rules:[{root:'src',extensions:new Set(['.ts']),maxLines:5}]});`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: dir, env: { ...env, CHECK_FILE_SIZES_BASE: base }, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Fixture file size ratchet failed/);
    assert.match(result.stderr, /src\/large\.ts: 4 -> 11/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
