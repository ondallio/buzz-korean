import { test } from 'node:test';
import assert from 'node:assert/strict';
import { channelConfig, setPackageVersion } from '../scripts/channel-config.mjs';

test('release config pins Korean identity, signature key and HTTPS channel', () => {
  const key = Buffer.from('untrusted comment: minisign public key\nRWQf6LRCGA9i53mlYecO4IzT51TGPpvWucNSCh1CBM0QTaLn73Y7GFO3\n').toString('base64');
  const config = channelConfig('1.0.12', key);
  assert.equal(config.identifier, 'io.github.ondallio.buzz-korean');
  assert.equal(config.version, '1.0.12');
  assert.equal(config.productName, 'Buzz Korean');
  assert.deepEqual(config.plugins['deep-link'].desktop.schemes, ['buzz', 'buzz-korean']);
  assert.deepEqual(config.plugins.updater.endpoints, ['https://github.com/ondallio/buzz-korean/releases/latest/download/latest.json']);
  assert.equal(config.plugins.updater.pubkey, key);
  assert.equal(config.bundle.createUpdaterArtifacts, false);
  assert.equal(config.bundle.macOS.signingIdentity, '-');
  assert.deepEqual(config.bundle.macOS.files, {
    'Resources/en.lproj/InfoPlist.strings': 'korean-localizations/en.lproj/InfoPlist.strings',
    'Resources/ko.lproj/InfoPlist.strings': 'korean-localizations/ko.lproj/InfoPlist.strings',
  });
});

test('invalid versions/keys fail before config can be written', () => {
  for (const version of ['1.0.0+ko', '01.2.3', '1.2', 'x']) assert.throws(() => channelConfig(version, 'bad'));
  for (const key of ['', 'private key', Buffer.from('untrusted comment: minisign encrypted secret key').toString('base64')]) assert.throws(() => channelConfig('1.0.0', key));
});

test('Cargo version replacement changes package only and is falsifiable', () => {
  const text = '[package]\nname = "buzz-desktop"\nversion = "0.5.28"\n[dependencies]\nfoo = { version = "2" }\n';
  assert.equal(setPackageVersion(text, '1.0.2'), text.replace('version = "0.5.28"', 'version = "1.0.2"'));
  assert.throws(() => setPackageVersion('[dependencies]\nversion = "2"\n', '1.0.0'));
});
