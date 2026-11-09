import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifySignature } from '../scripts/signature.mjs';

// Public upstream minisign-verify prehashed test vector. No private key.
const key = Buffer.from('untrusted comment: minisign public key\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3\n').toString('base64');
const payload = 'untrusted comment: signature from minisign secret key\nRUQf6LRCGA9i559r3g7V1qNyJDApGip8MfqcadIgT9CuhV3EMhHoN1mGTkUidF/z7SrlQgXdy8ofjb7bNJJylDOocrCo8KLzZwo=\ntrusted comment: timestamp:1556193335\tfile:test\ny/rUw2y8/hOUYjZU71eHp/Wo1KZ40fGy2VJEDl34XMJM+TX48Ss/17u3IvIfbVR1FkZZSNCisQbuQY+bHwhEBg==';
test('real minisign signature verifies; corrupt bytes/key/comment fail', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ko-signature-'));
  try {
    const file = join(dir, 'app'); await writeFile(file, 'test');
    assert.equal(await verifySignature(file, Buffer.from(payload).toString('base64'), key), true);
    await assert.rejects(verifySignature(file, Buffer.from(payload.replace('file:test', 'file:evil')).toString('base64'), key), /signature/i);
    await assert.rejects(verifySignature(file, Buffer.from(payload).toString('base64'), key.slice(0, -8) + 'AAAAAAAA'), /key|signature/i);
    await writeFile(file, 'corrupt');
    await assert.rejects(verifySignature(file, Buffer.from(payload).toString('base64'), key), /signature/i);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
