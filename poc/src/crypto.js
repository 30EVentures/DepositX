// Canonical serialisation, hashing and Ed25519 signatures (node:crypto only).
import crypto from 'node:crypto';

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');

// Deterministic JSON: sorted keys, BigInt/Map/Set normalised. Used for state roots and signed messages.
function norm(v) {
  if (typeof v === 'bigint') return 'n:' + v.toString();
  if (v instanceof Map) return { $map: [...v.entries()].map(([k, x]) => [k, norm(x)]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)) };
  if (v instanceof Set) return { $set: [...v].map(norm).sort() };
  if (Array.isArray(v)) return v.map(norm);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v).sort()) if (v[k] !== undefined) o[k] = norm(v[k]);
    return o;
  }
  return v;
}
export const canon = (v) => JSON.stringify(norm(v));

export function genKey() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return { pub: publicKey.export({ type: 'spki', format: 'der' }).toString('hex'), priv: privateKey };
}
export const sign = (priv, msg) => crypto.sign(null, Buffer.from(msg), priv).toString('hex');

const pubCache = new Map();
export function verify(pubHex, msg, sigHex) {
  try {
    let k = pubCache.get(pubHex);
    if (!k) {
      k = crypto.createPublicKey({ key: Buffer.from(pubHex, 'hex'), format: 'der', type: 'spki' });
      pubCache.set(pubHex, k);
    }
    return crypto.verify(null, Buffer.from(msg), k, Buffer.from(sigHex, 'hex'));
  } catch {
    return false;
  }
}

// Dev keystore helpers. The PoC keeps private keys in a 0600 file; production uses HSMs.
export const exportKey = (k) => ({ pub: k.pub, priv: k.priv.export({ type: 'pkcs8', format: 'der' }).toString('hex') });
export const importKey = (o) => ({ pub: o.pub, priv: crypto.createPrivateKey({ key: Buffer.from(o.priv, 'hex'), format: 'der', type: 'pkcs8' }) });
