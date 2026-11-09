import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { managementTestFiles, appTests } from '../scripts/test-management.mjs';

test('privileged jobs use a pinned management runtime and execute no app tools or tests', async () => {
  const source = await readFile('.github/workflows/korean-release.yml', 'utf8');
  const prepare = source.split(/^  prepare:\s*$/m)[1].split(/^  build:\s*$/m)[0];
  const build = source.split(/^  build:\s*$/m)[1].split(/^  sign-publish:\s*$/m)[0];
  const signer = source.split(/^  sign-publish:\s*$/m)[1];
  for (const job of [prepare, signer]) {
    assert.doesNotMatch(job, /activate-hermit|working-directory: app/);
    assert.match(job, /actions\/setup-node@[a-f0-9]{40}/);
    assert.match(job, /node-version: '24\.15\.0'/);
  }
  assert.match(prepare, /node scripts\/test-management\.mjs/);
  assert.match(build, /contents: read/);
  assert.doesNotMatch(build, /secrets\./);
  for (const name of appTests) assert.ok(build.includes(`tests/${name}`));
  assert.match(signer, /ref: \$\{\{ github.sha \}\}/);
  assert.deepEqual(managementTestFiles(['prepare.test.mjs', ...appTests, '../unsafe.test.mjs']), ['tests/prepare.test.mjs']);
});
