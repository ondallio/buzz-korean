import { createHash, createPublicKey, verify, timingSafeEqual } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { parsePublicKey, decodeBase64 } from './public-key.mjs';

// Minisign ED is Ed25519 over a BLAKE2b-512 prehash. Also verify the global
// signature over signature bytes + trusted comment, as minisign-verify does.
export async function verifySignature(file, signature, publicKey) {
  const key = parsePublicKey(publicKey);
  const lines = new TextDecoder('utf-8', { fatal: true }).decode(decodeBase64(signature, 'signature')).trim().split(/\r?\n/);
  if (lines.length !== 4 || !lines[0].startsWith('untrusted comment: signature from ') || !lines[2].startsWith('trusted comment: ')) throw new Error('Invalid signature encoding');
  const sig = decodeBase64(lines[1], 'signature payload');
  const global = decodeBase64(lines[3], 'global signature');
  if (key.length !== 42 || sig.length !== 74 || global.length !== 64 || sig.subarray(0, 2).toString() !== 'ED' || !timingSafeEqual(key.subarray(2, 10), sig.subarray(2, 10))) throw new Error('Signature key or algorithm mismatch');
  const publicObject = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key.subarray(10)]), format: 'der', type: 'spki' });
  const hash = createHash('blake2b512');
  for await (const data of createReadStream(file)) hash.update(data);
  if (!verify(null, hash.digest(), publicObject, sig.subarray(10)) || !verify(null, Buffer.concat([sig.subarray(10), Buffer.from(lines[2].slice(17))]), publicObject, global)) throw new Error('Invalid artifact signature');
  return true;
}
