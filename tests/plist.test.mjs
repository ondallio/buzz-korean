import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run } from '../scripts/process.mjs';
test('Korean bundle names override upstream names while permissions survive', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ko-plist-'));
  try {
    const file = join(dir, 'Info.plist');
    await run('python3', ['scripts/prepare-plist.py', 'app/desktop/src-tauri/Info.plist', file]);
    const output = JSON.parse(await run('python3', ['-c', 'import plistlib,json,sys; print(json.dumps(plistlib.load(open(sys.argv[1],"rb"))))', file]));
    assert.equal(output.CFBundleName, 'Buzz Korean');
    assert.equal(output.CFBundleDisplayName, 'Buzz Korean');
    assert.equal(output.NSMicrophoneUsageDescription, 'Buzz needs microphone access for voice huddles and voice notes.');
    assert.ok(output.NSCameraUsageDescription);
    assert.ok(output.NSLocalNetworkUsageDescription);
    assert.ok((await readFile(resolve('app/desktop/src-tauri/Info.plist'), 'utf8')).includes('<string>Buzz</string>'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
