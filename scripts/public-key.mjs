export function decodeBase64(value, label) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 8192 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error(`Invalid ${label} base64`);
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error(`Noncanonical ${label} base64`);
  return bytes;
}

/** Decode the same key envelope and algorithm accepted by minisign-verify. */
export function parsePublicKey(value) {
  const decoded = new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64(value, 'public key'));
  const lines = decoded.replaceAll('\r\n', '\n').replace(/\n$/, '').split('\n');
  if (lines.length !== 2 || !lines[0].startsWith('untrusted comment: minisign public key') || /[\x00-\x1f\x7f]/.test(lines[0])) throw new Error('Invalid minisign public key envelope');
  const bytes = decodeBase64(lines[1], 'public key payload');
  if (bytes.length !== 42 || bytes[0] !== 0x45 || ![0x64, 0x44].includes(bytes[1])) throw new Error('Invalid minisign public key algorithm or length');
  return bytes;
}
