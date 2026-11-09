import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { run } from './process.mjs';

// These checks deliberately exercise app/ code or data. Run them only in the
// candidate build job, which has no publishing credentials.
export const appTests = ['nested-check.test.mjs', 'plist.test.mjs'];
export function managementTestFiles(names) {
  return names.filter(name => /^[A-Za-z][A-Za-z0-9.-]*\.test\.mjs$/.test(name) && !appTests.includes(name)).sort().map(name => `tests/${name}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await run(process.execPath, ['--test', ...managementTestFiles(await readdir('tests'))], { inherit: true, timeoutMs: 5 * 60 * 1000, maxBytes: 16 * 1024 * 1024 });
}
