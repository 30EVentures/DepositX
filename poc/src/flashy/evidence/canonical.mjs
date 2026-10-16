// Canonical JSON for evidence documents: sorted keys, whole numbers only, undefined members dropped. Standalone.
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
export function canonical(v) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'number') { if (!Number.isSafeInteger(v)) throw new TypeError('only whole numbers'); return String(v); }
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  throw new TypeError('unsupported value');
}
export const SEAL_DOMAIN = 'depositx-evidence/1\0';
