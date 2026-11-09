import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, truncate, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const validator = fileURLToPath(new URL('../scripts/verify-archive.py', import.meta.url));
const root = 'Buzz Korean.app';
const helpers = ['buzz-acp', 'buzz-agent', 'buzz-backend-kubernetes', 'buzz-dev-mcp', 'git-credential-nostr', 'buzz'];
function macho(cpu = 0x100000c, type = 2) {
  const bytes = Buffer.alloc(32);
  bytes.writeUInt32LE(0xfeedfacf, 0); bytes.writeUInt32LE(cpu, 4); bytes.writeUInt32LE(type, 12);
  return bytes;
}
function file(name, bytes, mode = 0o644) { return { name: `${root}/${name}`, data: Buffer.from(bytes).toString('base64'), mode }; }
function contents(overrides = {}) {
  return [
    { name: root, type: 'dir' }, { name: `${root}/Contents`, type: 'dir' }, { name: `${root}/Contents/MacOS`, type: 'dir' },
    { name: `${root}/Contents/Info.plist`, plist: { CFBundleIdentifier: 'io.github.ondallio.buzz-korean', CFBundleShortVersionString: '1.0.1', CFBundleExecutable: 'buzz-desktop', ...overrides } },
    ...['buzz-desktop', ...helpers].map(name => file(`Contents/MacOS/${name}`, macho(), 0o755)),
  ];
}
const writer = `import base64,gzip,io,json,plistlib,sys,tarfile
items=json.load(sys.stdin)
with tarfile.open(sys.argv[1],'w:gz',format=tarfile.PAX_FORMAT) as archive:
 for item in items:
  member=tarfile.TarInfo(item['name']);member.mode=item.get('mode',493 if item.get('type')=='dir' else 420)
  kind=item.get('type','file')
  if kind=='dir': member.type=tarfile.DIRTYPE
  elif kind=='symlink': member.type=tarfile.SYMTYPE;member.linkname=item['target']
  elif kind=='hardlink': member.type=tarfile.LNKTYPE;member.linkname=item['target']
  elif kind=='device': member.type=tarfile.CHRTYPE
  if 'pax' in item: member.pax_headers=item['pax']
  data=plistlib.dumps(item['plist']) if 'plist' in item else base64.b64decode(item.get('data',''))
  member.size=len(data) if kind=='file' else 0
  archive.addfile(member,io.BytesIO(data) if kind=='file' else None)
`;
async function fixture(t, entries = contents()) {
  const dir = await mkdtemp(join(tmpdir(), 'buzz-archive-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const archive = join(dir, 'app.tar.gz');
  const write = spawnSync('python3', ['-c', writer, archive], { input: JSON.stringify(entries), encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
  assert.equal(write.status, 0, write.stderr);
  return { archive, run: (version = '1.0.1') => spawnSync('python3', [validator, archive, version], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 }) };
}
function rejected(result, pattern) {
  assert.equal(result.status, 1, result.stdout + result.stderr);
  if (pattern) assert.match(result.stderr, pattern);
}

test('actual streamed validator accepts ARM64 bundle metadata and all six executable sidecars', async t => {
  const f = await fixture(t);
  const result = f.run(); assert.equal(result.status, 0, result.stderr);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.bundle, root); assert.equal(summary.version, '1.0.1'); assert.equal(summary.executables, 7);
});

test('normal framework symlink chains remain inside the archive and resolve to real ARM64 data', async t => {
  const entries = contents();
  entries.push({ name: `${root}/Contents/Frameworks`, type: 'dir' }, { name: `${root}/Contents/Frameworks/Foo.framework`, type: 'dir' }, { name: `${root}/Contents/Frameworks/Foo.framework/Versions`, type: 'dir' }, { name: `${root}/Contents/Frameworks/Foo.framework/Versions/A`, type: 'dir' }, file('Contents/Frameworks/Foo.framework/Versions/A/Foo', macho(0x100000c, 6)), { name: `${root}/Contents/Frameworks/Foo.framework/Versions/Current`, type: 'symlink', target: 'A' }, { name: `${root}/Contents/Frameworks/Foo.framework/Foo`, type: 'symlink', target: 'Versions/Current/Foo' });
  const f = await fixture(t, entries); const result = f.run(); assert.equal(result.status, 0, result.stderr);
});

for (const [label, mutate, pattern] of [
  ['foreign envelope', e => { e.push({ name: 'Other.app/a' }); }, /envelope|bundle/i],
  ['absolute name', e => { e.push({ name: '/Buzz Korean.app/a' }); }, /path|absolute/i],
  ['parent traversal', e => { e.push({ name: `${root}/Contents/../evil` }); }, /path|traversal/i],
  ['backslash name', e => { e.push({ name: `${root}/Contents\\evil` }); }, /path|backslash/i],
  ['NUL extended path', e => { e.push({ name: `${root}/safe`, pax: { path: `${root}/bad\0name` } }); }, /NUL|path/i],
  ['excessive path depth', e => { e.push({ name: `${root}/${'d/'.repeat(129)}file` }); }, /depth|limit/i],
  ['duplicate file', e => { e.push(e[3]); }, /duplicate|collision/i],
  ['case-colliding plist', e => { e.push({ ...e[3], name: `${root}/Contents/info.plist` }); }, /duplicate|collision/i],
  ['hardlink', e => { e.push({ name: `${root}/linked`, type: 'hardlink', target: `${root}/Contents/Info.plist` }); }, /type|hardlink/i],
  ['device', e => { e.push({ name: `${root}/device`, type: 'device' }); }, /type|special/i],
  ['wrong version', e => { e[3].plist.CFBundleShortVersionString = '9.9.9'; }, /version/i],
  ['wrong identity', e => { e[3].plist.CFBundleIdentifier = 'xyz.block.buzz.app'; }, /identity|identifier/i],
  ['unsafe executable', e => { e[3].plist.CFBundleExecutable = '../buzz'; }, /executable/i],
  ['missing helper', e => { e.pop(); }, /missing|sidecar|executable/i],
  ['non-executable helper', e => { e.at(-1).mode = 0o644; }, /mode|executable/i],
  ['helper executable only for other users', e => { e.at(-1).mode = 0o401; }, /owner|executable|mode/i],
  ['unreadable regular file', e => { e[3].mode = 0o000; }, /owner|read|mode/i],
  ['unsearchable directory', e => { e[2].mode = 0o400; }, /owner|directory|mode/i],
  ['unreadable directory', e => { e[2].mode = 0o100; }, /owner|directory|mode/i],
  ['x86 helper', e => { e.at(-1).data = macho(0x1000007).toString('base64'); }, /ARM64|architecture/i],
  ['truncated MachO helper', e => { e.at(-1).data = macho().subarray(0, 8).toString('base64'); }, /Mach.O|header|truncat/i],
  ['x86 dylib', e => { e.push(file('Contents/Frameworks/libbad.dylib', macho(0x1000007, 6))); }, /ARM64|architecture/i],
  ['outside symlink', e => { e.push({ name: `${root}/Contents/escape`, type: 'symlink', target: '../../outside' }); }, /symlink|bundle/i],
  ['absolute symlink', e => { e.push({ name: `${root}/Contents/escape`, type: 'symlink', target: '/tmp/outside' }); }, /symlink|absolute/i],
  ['dangling symlink', e => { e.push({ name: `${root}/Contents/missing`, type: 'symlink', target: 'absent' }); }, /symlink|missing|dangling/i],
  ['cyclic symlinks', e => { e.push({ name: `${root}/a`, type: 'symlink', target: 'b' }, { name: `${root}/b`, type: 'symlink', target: 'a' }); }, /cycle|symlink/i],
  ['member written through symlink', e => { e.push({ name: `${root}/Contents/alias`, type: 'symlink', target: 'MacOS' }, file('Contents/alias/unvalidated', macho())); }, /ancestor|symlink/i],
]) test(`rejects ${label} before signing`, async t => { const entries = contents(); mutate(entries); const f = await fixture(t, entries); rejected(f.run(), pattern); });

test('fat executables require a real ARM64 slice rather than a claimed fat CPU type', async t => {
  const x86 = macho(0x1000007), arm = macho();
  const fat = Buffer.alloc(48 + 64); fat.writeUInt32BE(0xcafebabe); fat.writeUInt32BE(2, 4);
  for (const [index, cpu, offset] of [[0, 0x1000007, 48], [1, 0x100000c, 80]]) {
    const start = 8 + index * 20; fat.writeUInt32BE(cpu, start); fat.writeUInt32BE(offset, start + 8); fat.writeUInt32BE(32, start + 12);
  }
  x86.copy(fat, 48); arm.copy(fat, 80);
  const entries = contents(); entries.at(-1).data = fat.toString('base64');
  const valid = await fixture(t, entries); assert.equal(valid.run().status, 0);
  x86.copy(fat, 80); entries.at(-1).data = fat.toString('base64');
  const invalid = await fixture(t, entries); rejected(invalid.run(), /slice|CPU|architecture/i);
});

test('non-TAR and oversized compressed inputs fail before inspection', async t => {
  const f = await fixture(t); await writeFile(f.archive, 'test'); rejected(f.run());
  await truncate(f.archive, 2 ** 31 + 1); rejected(f.run(), /compressed|size|limit/i);
});

test('entry count is bounded even for zero-sized entries', async t => {
  const entries = contents(); for (let i = 0; i < 20000; i++) entries.push({ name: `${root}/empty-${i}` });
  const f = await fixture(t, entries); rejected(f.run(), /entry|count|limit/i);
});


test('declared uncompressed and extended metadata sizes are bounded before reading bodies', async t => {
  const f = await fixture(t);
  for (const [type, size, pattern] of [['file', 4 * 1024 ** 3 + 1, /Uncompressed|limit/i], ['metadata', 1024 ** 2 + 1, /metadata|limit/i], ['solaris', 1024 ** 2 + 1, /metadata|limit/i]]) {
    const writer = spawnSync('python3', ['-c', `import gzip,sys,tarfile
member=tarfile.TarInfo('Buzz Korean.app/declared')
member.type=tarfile.SOLARIS_XHDTYPE if sys.argv[2]=='solaris' else tarfile.XHDTYPE if sys.argv[2]=='metadata' else tarfile.REGTYPE
member.size=int(sys.argv[3])
with gzip.open(sys.argv[1],'wb') as stream: stream.write(member.tobuf()+bytes(1024))`, f.archive, type, String(size)], { encoding: 'utf8', timeout: 10000 });
    assert.equal(writer.status, 0, writer.stderr);
    rejected(f.run(), pattern);
  }
});

test('invalid XML plist produces a bounded rejection instead of an accepted bundle', async t => {
  const entries = contents(); delete entries[3].plist; entries[3].data = Buffer.from('<?xml version="1.0"?><plist><dict>').toString('base64');
  const f = await fixture(t, entries); const result = f.run(); rejected(result);
  assert.doesNotMatch(result.stderr, /Traceback/);
});

test('all archive parents must be explicitly listed usable directory entries', async t => {
  const entries = contents(); entries.push(file('Contents/not-listed/file', 'user bytes'));
  const f = await fixture(t, entries); rejected(f.run(), /explicit|directory|ancestor/i);
});


test('invalid checksum header after a complete valid bundle is never treated as TAR EOF', async t => {
  const f = await fixture(t);
  const corrupt = spawnSync('python3', ['-c', `import gzip,sys,tarfile
with tarfile.open(sys.argv[1],'r:gz') as archive:
 members=list(archive)
 end=max(member.offset_data+((member.size+511)//512)*512 for member in members)
with gzip.open(sys.argv[1],'rb') as stream: data=stream.read()
with gzip.open(sys.argv[1],'wb') as stream: stream.write(data[:end]+b'X'*512+data[end:])`, f.archive], { encoding: 'utf8', timeout: 10000 });
  assert.equal(corrupt.status, 0, corrupt.stderr);
  rejected(f.run(), /header|checksum/i);
});

for (const [format, pax] of [
  ['GNU', null],
  ['00', { 'GNU.sparse.size': '0', 'GNU.sparse.numblocks': '0' }],
  ['01', { 'GNU.sparse.map': '0,1' }],
  ['10', { 'GNU.sparse.major': '1', 'GNU.sparse.minor': '0', 'GNU.sparse.realsize': '0' }],
]) test(`rejects ${format} sparse metadata before the stdlib sparse allocator runs`, async t => {
  const entries = contents();
  if (pax) entries.push({ name: `${root}/sparse`, pax });
  const f = await fixture(t, entries);
  if (!pax) {
    const raw = spawnSync('python3', ['-c', `import gzip,sys,tarfile
member=tarfile.TarInfo('Buzz Korean.app/sparse');member.type=tarfile.GNUTYPE_SPARSE
header=bytearray(member.tobuf(format=tarfile.GNU_FORMAT));header[482]=1
header[148:156]=b' '*8;header[148:156]=(('%06o' % sum(header))+'\\0 ').encode()
extension=bytearray(512)
for index in range(21): extension[index*24:index*24+12]=tarfile.itn(1,12);extension[index*24+12:index*24+24]=tarfile.itn(1,12)
with gzip.open(sys.argv[1],'wb') as stream:
 stream.write(header)
 for index in range(16): extension[504]=int(index<15);stream.write(extension)
 stream.write(bytes(1024))`, f.archive], { encoding: 'utf8', timeout: 10000 });
    assert.equal(raw.status, 0, raw.stderr);
  }
  const checked = spawnSync('python3', ['-B', '-c', `import runpy,sys,tarfile
api=runpy.run_path(sys.argv[1])
def allocation_tripwire(*args): raise RuntimeError('SPARSE_PARSE_ALLOCATION_REACHED')
for method in ('_proc_sparse','_proc_gnusparse_00','_proc_gnusparse_01','_proc_gnusparse_10'): setattr(tarfile.TarInfo,method,allocation_tripwire)
try: api['verify_archive'](sys.argv[2],'1.0.1')
except ValueError as error: print(str(error),file=sys.stderr);sys.exit(1)`, validator, f.archive], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 1024 });
  rejected(checked, /Unsupported.*sparse/i);
  assert.doesNotMatch(checked.stderr, /SPARSE_PARSE_ALLOCATION_REACHED/);
});


for (const [alias, child] of [['ALIAS', 'alias'], ['caf\u00e9', 'cafe\u0301']]) {
  test(`Mac normalized symlink ancestor cannot overwrite a validated helper (${JSON.stringify(alias)})`, async t => {
    const entries = contents();
    entries.push({ name: `${root}/Contents/${alias}`, type: 'symlink', target: 'MacOS' }, file(`Contents/${child}/buzz`, 'overwritten through alias'));
    const f = await fixture(t, entries); rejected(f.run(), /explicit|directory|symlink|ancestor/i);
  });
}
