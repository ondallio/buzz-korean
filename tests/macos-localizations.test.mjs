import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdtemp, mkdir, readFile, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = fileURLToPath(new URL('../scripts/prepare-plist.py', import.meta.url));
const english = JSON.parse(await readFile(new URL('../locales/macos.en.json', import.meta.url), 'utf8'));
const korean = JSON.parse(await readFile(new URL('../locales/macos.ko.json', import.meta.url), 'utf8'));
const sourceInfo = () => ({ CFBundleName: 'Buzz', CFBundleDisplayName: 'Buzz', ExistingBoolean: true, NSAppTransportSecurity: { NSAllowsLocalNetworking: true }, ...english });
function python(args, input) { return spawnSync('python3', args, { input, encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 }); }
async function fixture(t, { source = sourceInfo(), en = english, ko = korean } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'buzz-macos-locales-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'scripts')); await mkdir(join(dir, 'locales'));
  // Exact production code with isolated catalogs. No app/ code or data is read.
  const program = join(dir, 'scripts', 'prepare-plist.py'); await copyFile(script, program);
  await writeFile(join(dir, 'locales', 'macos.en.json'), JSON.stringify(en));
  await writeFile(join(dir, 'locales', 'macos.ko.json'), JSON.stringify(ko));
  const input = join(dir, 'source.plist'), output = join(dir, 'Info.plist'), resources = join(dir, 'resources');
  const writer = python(['-c', 'import json,plistlib,sys; plistlib.dump(json.load(sys.stdin),open(sys.argv[1],"wb"))', input], JSON.stringify(source));
  assert.equal(writer.status, 0, writer.stderr);
  return { input, output, resources, run: (localized = true) => python([program, input, output, ...(localized ? [resources] : [])]) };
}
async function readPlist(file) {
  const decoded = python(['-c', 'import plistlib,json,sys; print(json.dumps(plistlib.load(open(sys.argv[1],"rb"))))', file]);
  assert.equal(decoded.status, 0, decoded.stderr); return JSON.parse(decoded.stdout);
}
async function absent(file) { return access(file).then(() => false, () => true); }

test('legacy source/destination CLI preserves English permissions and unrelated metadata', async t => {
  const f = await fixture(t); const result = f.run(false); assert.equal(result.status, 0, result.stderr);
  const output = await readPlist(f.output);
  assert.equal(output.CFBundleName, 'Buzz Korean'); assert.equal(output.CFBundleDisplayName, 'Buzz Korean');
  assert.equal(output.ExistingBoolean, true); assert.deepEqual(output.NSAppTransportSecurity, { NSAllowsLocalNetworking: true });
  for (const [key, value] of Object.entries(english)) assert.equal(output[key], value);
  assert.equal(output.CFBundleDevelopmentRegion, undefined); assert.equal(output.CFBundleLocalizations, undefined);
  assert.equal(await absent(f.resources), true);
});

test('requested resources declare English fallback and emit complete binary English/Korean strings', async t => {
  const f = await fixture(t); const result = f.run(); assert.equal(result.status, 0, result.stderr);
  const output = await readPlist(f.output);
  assert.equal(output.CFBundleDevelopmentRegion, 'en'); assert.deepEqual(output.CFBundleLocalizations, ['en', 'ko']);
  assert.equal(output.CFBundleName, 'Buzz Korean'); assert.equal(output.CFBundleDisplayName, 'Buzz Korean');
  for (const [key, value] of Object.entries(english)) assert.equal(output[key], value);
  for (const [locale, expected] of [['en', english], ['ko', korean]]) {
    const file = join(f.resources, `${locale}.lproj`, 'InfoPlist.strings');
    assert.equal((await readFile(file)).subarray(0, 8).toString(), 'bplist00');
    assert.deepEqual(await readPlist(file), expected);
    assert.equal(Object.keys(expected).length, 3);
  }
  assert.equal(korean.NSMicrophoneUsageDescription, 'Buzz에서 음성 허들과 음성 메모를 사용하려면 마이크 접근이 필요합니다.');
  assert.equal(korean.NSCameraUsageDescription, 'Buzz에서 움직이는 아바타를 녹화하려면 카메라 접근이 필요합니다.');
  assert.equal(korean.NSLocalNetworkUsageDescription, '선택 기능인 컴퓨팅 공유와 로컬 릴레이 연결에 로컬 네트워크를 사용합니다. 원격 메시지 전송에는 이 권한이 필요하지 않습니다.');
});

for (const [name, mutate] of [
  ['new upstream permission key', (source) => { source.NSBluetoothAlwaysUsageDescription = 'New permission'; }],
  ['changed upstream English sentence', (source) => { source.NSCameraUsageDescription = 'Changed source sentence'; }],
  ['missing Korean key', (_, __, ko) => { delete ko.NSCameraUsageDescription; }],
  ['empty Korean value', (_, __, ko) => { ko.NSCameraUsageDescription = ' '; }],
  ['unexpected Korean key', (_, __, ko) => { ko.Unexpected = '예상하지 못한 문구'; }],
  ['missing English key', (_, en) => { delete en.NSCameraUsageDescription; }],
]) test(`${name} rejects before any output is written`, async t => {
  const source = sourceInfo(), en = { ...english }, ko = { ...korean }; mutate(source, en, ko);
  const f = await fixture(t, { source, en, ko }); const result = f.run();
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(await absent(f.output), true); assert.equal(await absent(f.resources), true);
});

test('validation failure preserves existing outputs for a retry', async t => {
  const source = sourceInfo(); source.NSMicrophoneUsageDescription = 'Changed';
  const f = await fixture(t, { source }); await writeFile(f.output, 'previous-output');
  await mkdir(f.resources); await writeFile(join(f.resources, 'keep'), 'previous-resources');
  assert.equal(f.run().status, 1);
  assert.equal(await readFile(f.output, 'utf8'), 'previous-output');
  assert.equal(await readFile(join(f.resources, 'keep'), 'utf8'), 'previous-resources');
});
