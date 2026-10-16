#!/usr/bin/env node
// Offline verifier for a DepositX evidence snapshot (simulated settlement model). Standalone: node:crypto and the
// standalone receipt verifier only; no import from the network, kernel or store.
//   node verify-snapshot.mjs <snapshot.json> [--pin <file holding the signer's public key, hex>]
// exit 0 valid, 1 invalid, 2 misuse. Without --pin the embedded key proves only self-consistency, never who signed.
import { createHash, createPublicKey, verify as edVerify } from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { canonical, SEAL_DOMAIN } from './canonical.mjs';
import { verifyReceiptDocument } from '../mesh/verify-receipt.mjs';

const HEX = (n) => new RegExp(`^[0-9a-f]{${n}}$`);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const TOP = ['format', 'simulated', 'label', 'chainId', 'head', 'measures', 'receipt', 'seal'];
const REQUIRED_WORDS = [/\bsimulated\b/i, /proof of concept/i, /no bank partner/i, /not regulated/i, /not final/i, /not live/i];
const CLAIM = /\b(regulated|final|finality|live|settled|guaranteed|insured|licensed|production)\b/gi;
const NEGATION = /\b(not|no|never|nor|nothing)\b/i;
const INVARIANTS_PER_BLOCK = 4;
const closedKeys = (o, allowed, where, problems) => { for (const k of Object.keys(o)) if (!allowed.includes(k)) problems.push(`UNKNOWN_FIELD:${where}.${k}`); };
const pct = (a, b) => { if (b === 0) return null; const h = Number((BigInt(a) * 10000n) / BigInt(b)); return `${Math.floor(h / 100)}.${String(h % 100).padStart(2, '0')}`; };
const int0 = (v) => Number.isSafeInteger(v) && v >= 0;

export function verifySnapshot(doc, { pinned } = {}) {
  const problems = [];
  const isPinned = pinned !== undefined && pinned !== null;
  const done = (extra = {}) => {
    const valid = problems.length === 0;
    return {
      valid, problems, simulated: true, pinned: isPinned, identityProven: valid && isPinned,
      note: valid
        ? (isPinned ? 'Self-consistent and sealed by the pinned key. This is a record of a SIMULATED run (a proof of concept, no bank partner): it shows what the signer sealed, not any real settlement.' : 'Self-consistent only: nothing is pinned, so the embedded key proves nothing about who sealed it. This records a SIMULATED run.')
        : 'INVALID: see problems. Nothing in an invalid snapshot is evidence of anything.',
      ...extra,
    };
  };
  if (!isObj(doc)) { problems.push('NOT_A_DOCUMENT'); return done(); }
  closedKeys(doc, TOP, 'doc', problems);
  if (doc.format !== 'depositx-evidence/1') problems.push('BAD_FORMAT');
  if (doc.simulated !== true) problems.push('NOT_LABELLED_SIMULATED');
  if (typeof doc.chainId !== 'string' || !doc.chainId) problems.push('NO_CHAIN_ID');
  // the wording is part of what is sealed, and it must keep saying what this is
  const label = typeof doc.label === 'string' ? doc.label : '';
  for (const re of REQUIRED_WORDS) if (!re.test(label)) problems.push(`LABEL_MISSING:${re.source}`);
  for (const m of label.matchAll(CLAIM)) {
    const sentence = label.slice(0, m.index).split(/[.;]/).pop();
    if (!NEGATION.test(sentence.trim().split(/\s+/).slice(-6).join(' '))) problems.push(`LABEL_OVERCLAIMS:${m[0].toLowerCase()}`);
  }
  const h = doc.head;
  if (!isObj(h)) problems.push('NO_HEAD');
  else {
    closedKeys(h, ['height', 'hash', 'stateRoot', 'time'], 'head', problems);
    if (!Number.isSafeInteger(h.height) || h.height < 1) problems.push('BAD_HEIGHT');
    if (typeof h.hash !== 'string' || !HEX(64).test(h.hash)) problems.push('BAD_HASH');
    if (typeof h.stateRoot !== 'string' || !HEX(64).test(h.stateRoot)) problems.push('BAD_STATE_ROOT');
    if (!Number.isSafeInteger(h.time)) problems.push('BAD_TIME');
  }
  const m = doc.measures;
  if (!isObj(m) || !isObj(m.replay) || !isObj(m.invariants)) problems.push('NO_MEASURES');
  else {
    closedKeys(m, ['retainedBlocks', 'replay', 'invariants'], 'measures', problems);
    closedKeys(m.replay, ['matched', 'total', 'percent'], 'replay', problems);
    closedKeys(m.invariants, ['passed', 'run', 'percent'], 'invariants', problems);
    const { matched, total } = m.replay; const { passed, run } = m.invariants;
    if (![m.retainedBlocks, matched, total, passed, run].every(int0)) problems.push('BAD_MEASURE_NUMBER');
    else {
      if (matched > total) problems.push('MATCHED_ABOVE_TOTAL');
      if (passed > run) problems.push('PASSED_ABOVE_RUN');
      if (m.retainedBlocks !== total) problems.push('RETAINED_TOTAL_MISMATCH');
      if (run !== total * INVARIANTS_PER_BLOCK) problems.push('RUN_NOT_FOUR_PER_BLOCK');
      if (m.replay.percent !== pct(matched, total)) problems.push('REPLAY_PERCENT_WRONG');
      if (m.invariants.percent !== pct(passed, run)) problems.push('INVARIANT_PERCENT_WRONG');
    }
  }
  if (!isObj(doc.receipt)) problems.push('NO_RECEIPT');
  else {
    const rv = verifyReceiptDocument(doc.receipt);
    if (!rv.valid) problems.push(...rv.problems.map((p) => `RECEIPT:${p}`));
    const r = doc.receipt.receipt;
    if (isObj(h) && isObj(r) && isObj(r.header)) {
      if (r.height !== h.height) problems.push('RECEIPT_HEIGHT_DIFFERS');
      if (r.hash !== h.hash) problems.push('RECEIPT_HASH_DIFFERS');
      if (r.header.stateRoot !== h.stateRoot) problems.push('RECEIPT_STATE_ROOT_DIFFERS');
      if (r.header.time !== h.time) problems.push('RECEIPT_TIME_DIFFERS');
    }
    if (doc.receipt.chainId !== doc.chainId) problems.push('RECEIPT_CHAIN_DIFFERS');
  }
  const s = doc.seal;
  if (!isObj(s)) { problems.push('NO_SEAL'); return done(); }
  closedKeys(s, ['alg', 'keyId', 'publicKey', 'sig'], 'seal', problems);
  if (s.alg !== 'ed25519') problems.push('BAD_ALGORITHM');
  if (typeof s.publicKey !== 'string' || !HEX(88).test(s.publicKey)) problems.push('BAD_EMBEDDED_KEY');
  else if (typeof s.keyId !== 'string' || s.keyId !== createHash('sha256').update(Buffer.from(s.publicKey, 'hex')).digest('hex').slice(0, 16)) problems.push('KEY_ID_MISMATCH');
  if (typeof s.sig !== 'string' || !HEX(128).test(s.sig)) problems.push('BAD_SIGNATURE_ENCODING');
  if (isPinned) {
    if (typeof pinned !== 'string' || !HEX(88).test(pinned.trim().toLowerCase())) problems.push('BAD_PIN');
    else if (pinned.trim().toLowerCase() !== s.publicKey) problems.push('PINNED_KEY_DIFFERS');
  }
  if (!problems.some((p) => /^(BAD_EMBEDDED_KEY|BAD_SIGNATURE_ENCODING|NOT_A_DOCUMENT)/.test(p))) {
    try {
      const { sig, ...sealBase } = s;
      const { seal: _drop, ...body } = doc;
      const ok = edVerify(null, Buffer.from(SEAL_DOMAIN + canonical({ ...body, seal: sealBase })), createPublicKey({ key: Buffer.from(s.publicKey, 'hex'), format: 'der', type: 'spki' }), Buffer.from(sig, 'hex'));
      if (!ok) problems.push('SIGNATURE_INVALID');
    } catch { problems.push('SIGNATURE_INVALID'); }
  }
  return done();
}

function main(argv) {
  const args = argv.slice(2); const pi = args.indexOf('--pin');
  const pinFile = pi >= 0 ? args[pi + 1] : undefined;
  const files = args.filter((a, i) => (pi < 0 || (i !== pi && i !== pi + 1)) && !a.startsWith('--'));
  if (files.length !== 1 || (pi >= 0 && !pinFile)) { console.error('usage: node verify-snapshot.mjs <snapshot.json> [--pin <public-key-hex-file>]'); return 2; }
  let doc; let pin;
  try { doc = JSON.parse(fs.readFileSync(files[0], 'utf8')); } catch (e) { console.error(`cannot read a snapshot from ${files[0]}: ${e.code || 'not JSON'}`); return 2; }
  if (pinFile) { try { pin = fs.readFileSync(pinFile, 'utf8').trim(); } catch { console.error(`cannot read the pinned key from ${pinFile}`); return 2; } }
  const r = verifySnapshot(doc, { pinned: pin });
  console.log(`${r.valid ? 'VALID' : 'INVALID'} (simulated settlement model; ${r.pinned ? 'signer key pinned' : 'nothing is pinned'})`);
  if (r.problems.length) console.log(`problems: ${r.problems.join(', ')}`);
  console.log(r.note);
  return r.valid ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv));
