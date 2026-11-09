import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../scripts/process.mjs';

test('command arguments stay literal and stdin is supported', async () => {
  const output = await run(process.execPath, ['-e', 'process.stdin.pipe(process.stdout)'], { input: 'literal $(echo key)\n' });
  assert.equal(output, 'literal $(echo key)\n');
});
test('failure, output overflow and timeout propagate', async () => {
  await assert.rejects(run(process.execPath, ['-e', 'process.exit(3)']), /exit 3/);
  await assert.rejects(run(process.execPath, ['-e', 'process.stdout.write("x".repeat(20000))'], { maxBytes: 1000 }), /output limit/);
  await assert.rejects(run(process.execPath, ['-e', 'setInterval(()=>{}, 1000)'], { timeoutMs: 100 }), /timeout/);
});
test('a detached descendant holding pipes cannot defer the timeout failure', async () => {
  if (process.platform === 'win32') return;
  const script = `const {spawn}=require('node:child_process'); spawn(process.execPath,['-e','setTimeout(()=>{},1200)'],{detached:true,stdio:['ignore',1,2]}).unref(); setInterval(()=>{},1000);`;
  const started = performance.now();
  await assert.rejects(run(process.execPath, ['-e', script], { timeoutMs: 100 }), /timeout/);
  assert.ok(performance.now() - started < 900, 'deadline rejection must not wait for the escaped child to close inherited pipes');
});
