import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '../scripts/process.mjs';
import { createUpdaterArchive } from '../scripts/package-archive.mjs';

test('production archive creator excludes macOS AppleDouble outside the app envelope', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ko-tar-'));
  try {
    const app = join(dir, 'Buzz Korean.app'); await mkdir(app);
    const file = join(app, 'fixture'); await writeFile(file, 'fixture');
    if (process.platform === 'darwin') await run('xattr', ['-w', 'com.buzzkorean.test', 'metadata', file]);
    const archive = join(dir, 'bundle.tar.gz'); await createUpdaterArchive(app, archive);
    const names = JSON.parse(await run('python3', ['-c', 'import tarfile,json,sys; print(json.dumps(tarfile.open(sys.argv[1]).getnames()))', archive]));
    assert.deepEqual(names.sort(), ['Buzz Korean.app', 'Buzz Korean.app/fixture']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
