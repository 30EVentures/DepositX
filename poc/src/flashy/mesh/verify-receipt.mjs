#!/usr/bin/env node
// Offline verifier for a DepositX block receipt. Standalone on purpose: node:crypto only, no import from the network,
// kernel or store, so it can be read and run by someone who trusts none of them.
//   node verify-receipt.mjs <receipt.json> [--pin <validator-keys.json>]
// exit 0 valid, 1 invalid, 2 misuse. The receipt comes from a SIMULATED network (every validator key is in one
// process); without --pin the result says only that the document is self-consistent, never who signed.
import { createHash, createPublicKey, verify as edVerify } from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const HEX = (n) => new RegExp(`^[0-9a-f]{${n}}$`);
const TOP = ['simulated', 'label', 'trust', 'chainId', 'receipt', 'validators', 'verifyWith'];
const REC = ['height', 'hash', 'header', 'sigs', 'quorum'];
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// canonical JSON, same rule as the network: sorted keys, undefined members dropped (headers hold only strings, whole numbers, null)
function canonical(v) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
  if (typeof v === 'number') { if (!Number.isSafeInteger(v)) throw new TypeError('only whole numbers'); return String(v); }
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (isObj(v)) return '{' + Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  throw new TypeError('unsupported value');
}

function sigOk(pubHex, message, sigHex) {
  try {
    return edVerify(null, Buffer.from(message), createPublicKey({ key: Buffer.from(pubHex, 'hex'), format: 'der', type: 'spki' }), Buffer.from(sigHex, 'hex'));
  } catch { return false; }
}

/** @returns {{valid:boolean, problems:string[], simulated:true, pinned:boolean, identityProven:boolean, validSignatures:number, required:number, note:string}} never throws. */
export function verifyReceiptDocument(doc, { pinned } = {}) {
  const problems = [];
  const out = (extra = {}) => {
    const valid = problems.length === 0;
    const isPinned = pinned !== undefined && pinned !== null;
    return {
      valid, problems, simulated: true, pinned: isPinned, identityProven: valid && isPinned,
      validSignatures: 0, required: 0,
      note: valid
        ? (isPinned ? 'Self-consistent AND signed by the pinned keys. Those keys are held by a simulated network in one process, so this shows host signing, not independent agreement.' : 'Self-consistent only: nothing is pinned, so this does not show who signed. The validators of this simulated network are all held by the host.')
        : 'INVALID: see problems. Receipts from this simulated network prove nothing when they fail any check.',
      ...extra,
    };
  };
  if (!isObj(doc)) { problems.push('NOT_A_DOCUMENT'); return out(); }
  for (const k of Object.keys(doc)) if (!TOP.includes(k)) problems.push(`UNKNOWN_FIELD:${k}`);
  if (doc.simulated !== true) problems.push('NOT_LABELLED_SIMULATED');
  if (typeof doc.label !== 'string' || !/simulated/i.test(doc.label)) problems.push('LABEL_MISSING');
  if (typeof doc.chainId !== 'string' || !doc.chainId) problems.push('NO_CHAIN_ID');
  const r = doc.receipt;
  if (!isObj(r)) { problems.push('NO_RECEIPT'); return out(); }
  for (const k of Object.keys(r)) if (!REC.includes(k)) problems.push(`UNKNOWN_RECEIPT_FIELD:${k}`);
  if (!Number.isSafeInteger(r.height) || r.height < 1) problems.push('BAD_HEIGHT');
  if (typeof r.hash !== 'string' || !HEX(64).test(r.hash)) problems.push('BAD_HASH');
  if (!isObj(r.header)) { problems.push('NO_HEADER'); return out(); }
  if (!Number.isSafeInteger(r.quorum) || r.quorum < 1) problems.push('BAD_QUORUM');
  if (!isObj(r.sigs)) problems.push('NO_SIGNATURES');

  const vs = doc.validators;
  if (!Array.isArray(vs) || vs.length < 1 || vs.length > 64) { problems.push('NO_VALIDATORS'); return out(); }
  const ids = new Set(); const pubs = new Set();
  for (const v of vs) {
    if (!isObj(v) || typeof v.id !== 'string' || typeof v.pub !== 'string' || !HEX(88).test(v.pub)) { problems.push('BAD_VALIDATOR'); return out(); }
    if (ids.has(v.id)) problems.push('DUPLICATE_VALIDATOR_ID');
    if (pubs.has(v.pub)) problems.push('DUPLICATE_VALIDATOR_KEY');
    ids.add(v.id); pubs.add(v.pub);
  }
  const required = Math.floor((2 * vs.length) / 3) + 1; // strictly more than two thirds; the document's own claim cannot lower it
  if (r.header.chainId !== doc.chainId) problems.push('CHAIN_MISMATCH');
  let hash = null;
  try { hash = createHash('sha256').update(canonical(r.header)).digest('hex'); } catch { problems.push('HEADER_NOT_CANONICAL'); }
  if (hash !== null && hash !== r.hash) problems.push('HASH_MISMATCH');
  if (Number.isSafeInteger(r.quorum) && r.quorum < required) problems.push('QUORUM_TOO_LOW');

  let valid = 0;
  if (isObj(r.sigs) && typeof r.hash === 'string') {
    for (const v of vs) {
      const s = r.sigs[v.id];
      if (typeof s === 'string' && HEX(128).test(s) && sigOk(v.pub, r.hash, s)) valid += 1;
      else if (s !== undefined && !(typeof s === 'string' && HEX(128).test(s))) problems.push('BAD_SIGNATURE_ENCODING');
    }
    for (const id of Object.keys(r.sigs)) if (!ids.has(id)) problems.push(`UNLISTED_SIGNER:${id}`);
  }
  if (valid < required) problems.push('TOO_FEW_VALID_SIGNATURES');

  if (pinned !== undefined && pinned !== null) {
    const pinnedPubs = Array.isArray(pinned) ? pinned : isObj(pinned) ? Object.values(pinned) : null;
    if (!pinnedPubs || !pinnedPubs.every((p) => typeof p === 'string' && HEX(88).test(p))) problems.push('BAD_PIN_FILE');
    else if (pinnedPubs.length !== pubs.size || !pinnedPubs.every((p) => pubs.has(p))) problems.push('PINNED_KEYS_DIFFER');
  }
  return out({ validSignatures: valid, required });
}

function main(argv) {
  const args = argv.slice(2);
  const pi = args.indexOf('--pin');
  const pinFile = pi >= 0 ? args[pi + 1] : undefined;
  const files = args.filter((a, i) => (pi < 0 || (i !== pi && i !== pi + 1)) && !a.startsWith('--'));
  if (files.length !== 1 || (pi >= 0 && !pinFile)) { console.error('usage: node verify-receipt.mjs <receipt.json> [--pin <validator-keys.json>]'); return 2; }
  let doc; let pin;
  try { doc = JSON.parse(fs.readFileSync(files[0], 'utf8')); } catch (e) { console.error(`cannot read a receipt from ${files[0]}: ${e.code || 'not JSON'}`); return 2; }
  if (pinFile) { try { pin = JSON.parse(fs.readFileSync(pinFile, 'utf8')); } catch { console.error(`cannot read pinned keys from ${pinFile}`); return 2; } }
  const r = verifyReceiptDocument(doc, { pinned: pin });
  console.log(`${r.valid ? 'VALID' : 'INVALID'} (simulated validators; ${r.validSignatures} of ${r.required} required signatures verified; ${r.pinned ? 'keys pinned' : 'nothing is pinned'})`);
  if (r.problems.length) console.log(`problems: ${r.problems.join(', ')}`);
  console.log(r.note);
  return r.valid ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv));
