import { basename, dirname, resolve } from 'node:path';
import { run } from './process.mjs';

/** Archive the final signed app without macOS AppleDouble/xattr sidecars. */
export async function createUpdaterArchive(app, output) {
  const source = resolve(app);
  if (basename(source) !== 'Buzz Korean.app') throw new Error('Expected the Korean app bundle');
  await run('tar', ['-czf', resolve(output), '-C', dirname(source), basename(source)], {
    env: { ...process.env, COPYFILE_DISABLE: '1' },
    timeoutMs: 120000,
  });
}
