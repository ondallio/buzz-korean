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

test('publication requires both candidate build and independent browser checks', async () => {
  const source = await readFile('.github/workflows/korean-release.yml', 'utf8');
  const build = source.split(/^  build:\s*$/m)[1]?.split(/^  browser:\s*$/m)[0];
  const browser = source.split(/^  browser:\s*$/m)[1]?.split(/^  sign-publish:\s*$/m)[0];
  const signer = source.split(/^  sign-publish:\s*$/m)[1];
  assert.ok(browser, 'Browser checks must run independently before signing');
  for (const job of [build, browser]) {
    assert.match(job, /contents: read/);
    assert.match(job, /ref: \$\{\{ needs.prepare.outputs.candidate \}\}/);
    assert.doesNotMatch(job, /secrets\./);
  }
  assert.match(build, /run: just ci/);
  assert.match(build, /node scripts\/build-release\.mjs/);
  assert.match(browser, /pnpm test:e2e:smoke/);
  assert.match(browser, /VITE_BUZZ_BESTIE: '1'[\s\S]*pnpm exec playwright test --project=smoke tests\/e2e\/bestie\.spec\.ts/);
  assert.match(signer, /needs: \[prepare, build, browser\]/);
  assert.match(signer, /if: needs\.build\.result == 'success' && needs\.browser\.result == 'success'/);
});
