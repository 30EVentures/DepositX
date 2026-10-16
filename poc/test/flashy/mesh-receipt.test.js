// Block receipts: labelled as coming from SIMULATED validators, and verifiable offline by a script that shares no code
// with the network. A receipt carries its own validator keys, so on its own it proves only that it is self-consistent;
// proving who signed needs the validator keys pinned out of band, and the verifier says so.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Network, dollars } from '../../src/network.js';
import { receiptView, ReceiptError, RECEIPT_LABEL } from '../../src/flashy/mesh/receipt.js';
import { verifyReceiptDocument } from '../../src/flashy/mesh/verify-receipt.mjs';
import { genKey, sign, sha256, canon } from '../../src/crypto.js';

const CLI = new URL('../../src/flashy/mesh/verify-receipt.mjs', import.meta.url).pathname;
const fresh = () => { const n = new Network(); n.pay('MPL:acme', 'NSR:cedar', dollars(5)); return n; };
const doc = (n, h = n.blocks[n.blocks.length - 1].height) => receiptView(n, h);
const clone = (d) => JSON.parse(JSON.stringify(d));

test('a receipt is labelled simulated, names its chain, and its validators are public keys only', () => {
  const n = fresh(); const d = doc(n);
  assert.equal(d.simulated, true);
  assert.equal(d.label, RECEIPT_LABEL);
  assert.match(d.label, /simulated/i);
  assert.equal(d.chainId, n.genesis.chainId);
  assert.equal(d.validators.length, 4);
  assert.ok(d.validators.every((v) => /^[0-9a-f]{88}$/.test(v.pub)));
  assert.ok(!/priv/i.test(JSON.stringify(d)));
});

test('the standalone verifier accepts a genuine receipt, and says plainly that nothing is pinned', () => {
  const r = verifyReceiptDocument(doc(fresh()));
  assert.equal(r.valid, true);
  assert.equal(r.pinned, false);
  assert.equal(r.identityProven, false);
  assert.equal(r.simulated, true);
  assert.match(r.note, /simulated/i);
});

test('with the validator keys pinned out of band, a genuine receipt is identity-checked', () => {
  const n = fresh(); const d = doc(n);
  const r = verifyReceiptDocument(d, { pinned: Object.fromEntries(n.genesis.validators.map((v) => [v.id, v.pub])) });
  assert.deepEqual([r.valid, r.pinned, r.identityProven], [true, true, true]);
});

test('REFUSAL: a different set of validator keys than the pinned one is rejected even though the receipt is self-consistent', () => {
  const n = fresh(); const d = doc(n);
  const attacker = Object.fromEntries(['operator', 'MPL', 'NSR', 'LKS'].map((id) => [id, genKey()]));
  const header = d.receipt.header; const hash = sha256(canon(header));
  const forged = { ...clone(d), validators: Object.entries(attacker).map(([id, k]) => ({ id, pub: k.pub })), receipt: { ...clone(d).receipt, hash, sigs: Object.fromEntries(Object.entries(attacker).map(([id, k]) => [id, sign(k.priv, hash)])) } };
  assert.equal(verifyReceiptDocument(forged).valid, true, 'self-consistent: this is exactly why a receipt alone proves nothing about WHO signed');
  const r = verifyReceiptDocument(forged, { pinned: Object.fromEntries(n.genesis.validators.map((v) => [v.id, v.pub])) });
  assert.equal(r.valid, false);
  assert.ok(r.problems.includes('PINNED_KEYS_DIFFER'));
});

const MUTATIONS = {
  'header field changed': (d) => { d.receipt.header.height += 1; },
  'header time changed': (d) => { d.receipt.header.time += 1; },
  'state root changed': (d) => { d.receipt.header.stateRoot = 'a'.repeat(64); },
  'hash replaced': (d) => { d.receipt.hash = 'b'.repeat(64); },
  'chain id changed in header': (d) => { d.receipt.header.chainId = 'other'; },
  'all signatures removed': (d) => { d.receipt.sigs = {}; },
  'one signature flipped, two left': (d) => { const k = Object.keys(d.receipt.sigs)[0]; d.receipt.sigs[k] = d.receipt.sigs[k].replace(/^./, (c) => (c === 'a' ? 'b' : 'a')); d.receipt.sigs = Object.fromEntries(Object.entries(d.receipt.sigs).slice(0, 3)); delete d.receipt.sigs[Object.keys(d.receipt.sigs).pop()]; },
  'only two valid signatures': (d) => { d.receipt.sigs = Object.fromEntries(Object.entries(d.receipt.sigs).slice(0, 2)); },
  'signature from an unlisted validator': (d) => { const s = Object.values(d.receipt.sigs)[0]; d.receipt.sigs = { stranger: s, other: s, third: s }; },
  'one signature copied under three ids': (d) => { const s = Object.values(d.receipt.sigs)[0]; d.receipt.sigs = { operator: s, MPL: s, NSR: s, LKS: s }; },
  'quorum claim lowered': (d) => { d.receipt.quorum = 1; d.receipt.sigs = Object.fromEntries(Object.entries(d.receipt.sigs).slice(0, 1)); },
  'same key listed twice': (d) => { d.validators[1].pub = d.validators[0].pub; },
  'validator list emptied': (d) => { d.validators = []; },
  'chain id of the document changed': (d) => { d.chainId = 'other'; },
  'unknown top-level field': (d) => { d.extra = 1; },
  'unknown receipt field': (d) => { d.receipt.extra = 1; },
  'label removed': (d) => { delete d.label; },
  'simulated flag false': (d) => { d.simulated = false; },
  'not an object receipt': (d) => { d.receipt = 'x'; },
  'sig not hex': (d) => { d.receipt.sigs.operator = 'zz'; },
};
for (const [name, mutate] of Object.entries(MUTATIONS)) {
  test(`REFUSAL: ${name}`, () => {
    const d = clone(doc(fresh()));
    mutate(d);
    const r = verifyReceiptDocument(d);
    assert.equal(r.valid, false, JSON.stringify(r.problems));
    assert.ok(r.problems.length > 0);
  });
}

test('REFUSAL: non-documents never throw out of the verifier', () => {
  for (const bad of [null, undefined, 5, 'x', [], {}, { receipt: null }, { receipt: {}, validators: 'x' }]) {
    const r = verifyReceiptDocument(bad);
    assert.equal(r.valid, false);
  }
});

test('differential: the standalone verifier agrees with Network.verifyReceipt on genuine and mutated blocks', () => {
  const n = fresh();
  const block = n.blocks[n.blocks.length - 1];
  const cases = [block, { ...block, hash: 'c'.repeat(64) }, { ...block, header: { ...block.header, time: block.header.time + 1 } }, { ...block, sigs: {} }, { ...block, sigs: Object.fromEntries(Object.entries(block.sigs).slice(0, 2)) }, { ...block, header: { ...block.header, chainId: 'x' } }];
  for (const b of cases) {
    const asDoc = { ...clone(receiptView(n, block.height)), receipt: { height: b.height, hash: b.hash, header: b.header, sigs: b.sigs, quorum: b.quorum } };
    assert.equal(verifyReceiptDocument(asDoc).valid, Network.verifyReceipt(n.genesis, b), JSON.stringify(Object.keys(b.sigs)));
  }
});

test('REFUSAL: an unknown, past-the-end, negative, fractional or non-numeric height is refused', () => {
  const n = fresh();
  for (const h of [0, -1, 1.5, 99999, '5', NaN, null, undefined, '1e1']) assert.throws(() => receiptView(n, h), (e) => e instanceof ReceiptError && /^BAD_HEIGHT|^NOT_RETAINED/.test(e.code), String(h));
});

test('the command line verifier: exit 0 for a genuine receipt, 1 for a tampered one, 2 for misuse; offline and read-only', () => {
  const n = fresh(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'receipt-'));
  try {
    const good = path.join(dir, 'good.json'); fs.writeFileSync(good, JSON.stringify(doc(n)));
    const badDoc = clone(doc(n)); badDoc.receipt.header.time += 1;
    const bad = path.join(dir, 'bad.json'); fs.writeFileSync(bad, JSON.stringify(badDoc));
    const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' });
    const g = run(good); assert.equal(g.status, 0); assert.match(g.stdout, /simulated/i); assert.match(g.stdout, /not pinned|nothing is pinned/i);
    const b = run(bad); assert.equal(b.status, 1); assert.match(b.stdout, /INVALID/);
    assert.equal(run().status, 2);
    assert.equal(run(path.join(dir, 'missing.json')).status, 2);
    fs.writeFileSync(path.join(dir, 'junk.json'), 'not json');
    assert.equal(run(path.join(dir, 'junk.json')).status, 2);
    const pins = path.join(dir, 'pins.json'); fs.writeFileSync(pins, JSON.stringify(Object.fromEntries(n.genesis.validators.map((v) => [v.id, v.pub]))));
    const p = run(good, '--pin', pins); assert.equal(p.status, 0); assert.match(p.stdout, /pinned/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
