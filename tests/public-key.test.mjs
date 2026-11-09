import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelConfig } from '../scripts/channel-config.mjs';
import { verifySignature } from '../scripts/signature.mjs';

const inner = 'RWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3';
const encode = value => Buffer.from(value).toString('base64');
const key = value => encode(`untrusted comment: minisign public key\n${value}\n`);
test('release config accepts a real minisign public key and rejects invalid algorithm bytes', async () => {
  assert.equal(channelConfig('1.0.0', key(inner)).version, '1.0.0');
  const bad = Buffer.from(inner, 'base64'); bad[1] = 0x60;
  const invalid = key(bad.toString('base64'));
  assert.throws(() => channelConfig('1.0.0', invalid), /key|algorithm/i);
  await assert.rejects(verifySignature('/nonexistent', '', invalid), /key|algorithm/i);
});
test('garbage, noncanonical base64, UTF8 replacement and extra key lines fail closed', () => {
  for (const value of [key(inner) + '!', key(inner).slice(0, -1), key(inner + '!'), encode(`untrusted comment: minisign public key\n${inner}\nextra`), encode(Buffer.from([255, 255])), encode(`untrusted comment: minisign encrypted secret key\n${inner}\n`)]) {
    assert.throws(() => channelConfig('1.0.0', value));
  }
});
