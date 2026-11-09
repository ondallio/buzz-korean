import { parsePublicKey } from './public-key.mjs';

export const repository = 'ondallio/buzz-korean';
export const endpoint = `https://github.com/${repository}/releases/latest/download/latest.json`;

function version(value) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value) || value.split('.').some(n => !Number.isSafeInteger(Number(n)))) throw new Error('Invalid stable version');
}

export function channelConfig(releaseVersion, publicKey, infoPlist = 'Info.korean.plist') {
  version(releaseVersion);
  parsePublicKey(publicKey);
  return {
    productName: 'Buzz Korean', version: releaseVersion, identifier: 'io.github.ondallio.buzz-korean',
    app: { windows: [{ title: 'Buzz Korean', width: 900, height: 650, maximized: true, visible: false, titleBarStyle: 'Overlay', hiddenTitle: true, dragDropEnabled: false, trafficLightPosition: { x: 16, y: 25 }, backgroundThrottling: 'disabled', minWidth: 900, minHeight: 650 }] },
    plugins: { updater: { endpoints: [endpoint], pubkey: publicKey }, 'deep-link': { desktop: { schemes: ['buzz-korean'] } } },
    bundle: { createUpdaterArtifacts: false, targets: ['app', 'dmg'], macOS: { signingIdentity: '-', infoPlist } },
  };
}

export function setPackageVersion(text, value) {
  version(value);
  let count = 0;
  const output = text.replace(/(\[package\][\s\S]*?^version\s*=\s*)"[^"]+"/m, (_, prefix) => { count++; return `${prefix}"${value}"`; });
  if (count !== 1) throw new Error('Expected one Cargo package version');
  return output;
}
