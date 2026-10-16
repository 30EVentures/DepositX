// Phase 2.10: an evidence snapshot of the SIMULATED settlement model, sealed with a signing key and verifiable by a
// stranger offline against a PINNED public key. Prepared, not published. Ephemeral keys only: no real key is created,
// read or printed by these tests. The seal covers the wording, so a snapshot cannot be re-labelled after signing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Network, dollars } from '../../src/network.js';
import { buildSnapshot, publicKeyHex, EVIDENCE_LABEL } from '../../src/flashy/evidence/snapshot.js';
import { verifySnapshot } from '../../src/flashy/evidence/verify-snapshot.mjs';
import { canonical, SEAL_DOMAIN } from '../../src/flashy/evidence/canonical.mjs';
import { sign as edSign } from 'node:crypto';

const CLI = new URL('../../src/flashy/evidence/verify-snapshot.mjs', import.meta.url).pathname;
const ephemeral = () => generateKeyPairSync('ed25519');
const world = () => { const n = new Network(); n.pay('MPL:acme', 'NSR:cedar', dollars(5)); n.redeem('LKS', 'elm', dollars(1)); return n; };
const clone = (v) => JSON.parse(JSON.stringify(v));

test('a snapshot is simulated-labelled, carries the head, the measures and a receipt, and verifies against its pinned key', () => {
  const { privateKey, publicKey } = ephemeral(); const n = world();
  const s = buildSnapshot(n, privateKey);
  assert.equal(s.format, 'depositx-evidence/1'); assert.equal(s.simulated, true); assert.equal(s.label, EVIDENCE_LABEL);
  assert.equal(s.head.hash, n.blocks.at(-1).hash); assert.equal(s.head.stateRoot, n.blocks.at(-1).header.stateRoot);
  assert.equal(s.measures.replay.percent, '100.00');
  const r = verifySnapshot(s, { pinned: publicKeyHex(publicKey) });
  assert.deepEqual([r.valid, r.pinned, r.identityProven], [true, true, true], JSON.stringify(r.problems));
  assert.match(r.note, /simulated/i);
});
test('unpinned, it is only self-consistent: the embedded key proves nothing about who signed', () => {
  const { privateKey } = ephemeral(); const r = verifySnapshot(buildSnapshot(world(), privateKey));
  assert.deepEqual([r.valid, r.pinned, r.identityProven], [true, false, false]);
  assert.match(r.note, /nothing is pinned|not pinned/i);
});
test('it is deterministic: the same network and key give the same bytes (no wall clock inside)', () => {
  const { privateKey } = ephemeral(); const n = world();
  assert.equal(JSON.stringify(buildSnapshot(n, privateKey)), JSON.stringify(buildSnapshot(n, privateKey)));
});
test('the snapshot carries no private key, account, grant or amount', () => {
  const { privateKey } = ephemeral(); const text = JSON.stringify(buildSnapshot(world(), privateKey));
  assert.ok(!/priv|acme|cedar|elm|MPL:|NSR:|LKS:/i.test(text));
});

// ---- refusals ----
const MUT = {
  'head height changed': (s) => { s.head.height += 1; },
  'head hash changed': (s) => { s.head.hash = 'a'.repeat(64); },
  'state root changed': (s) => { s.head.stateRoot = 'b'.repeat(64); },
  'a measure raised': (s) => { s.measures.replay.matched = s.measures.replay.total; s.measures.invariants.passed += 1; },
  'a measure percent rewritten': (s) => { s.measures.replay.percent = '100.00'; s.measures.replay.matched -= 1; },
  'matched above total': (s) => { s.measures.replay.matched = s.measures.replay.total + 1; s.measures.replay.percent = '100.00'; },
  'retained blocks changed': (s) => { s.measures.retainedBlocks += 1; },
  'receipt header changed': (s) => { s.receipt.receipt.header.time += 1; },
  'receipt for another block': (s) => { s.head.height = s.receipt.receipt.height + 1; },
  'chain id changed': (s) => { s.chainId = 'other'; },
  'label removed': (s) => { delete s.label; },
  'label weakened': (s) => { s.label = 'Evidence snapshot'; },
  'label claims it is live': (s) => { s.label += ' This network is live.'; },
  'label claims finality': (s) => { s.label = s.label.replace('not final', 'final'); },
  'simulated flag false': (s) => { s.simulated = false; },
  'unknown top-level field': (s) => { s.extra = 1; },
  'unknown seal field': (s) => { s.seal.extra = 1; },
  'signature flipped': (s) => { s.seal.sig = s.seal.sig.replace(/^./, (c) => (c === 'a' ? 'b' : 'a')); },
  'signature removed': (s) => { delete s.seal.sig; },
  'seal algorithm changed': (s) => { s.seal.alg = 'none'; },
  'key id changed': (s) => { s.seal.keyId = '0'.repeat(16); },
  'embedded key swapped for another': (s) => { s.seal.publicKey = publicKeyHex(ephemeral().publicKey); },
  'format changed': (s) => { s.format = 'depositx-evidence/2'; },
  'receipt removed': (s) => { delete s.receipt; },
  'receipt marked not simulated': (s) => { s.receipt.simulated = false; },
};
for (const [name, mutate] of Object.entries(MUT)) {
  test(`REFUSAL: ${name}`, () => {
    const { privateKey } = ephemeral(); const s = clone(buildSnapshot(world(), privateKey));
    mutate(s);
    const r = verifySnapshot(s);
    assert.equal(r.valid, false, name); assert.ok(r.problems.length > 0);
  });
}
test('REFUSAL: a snapshot signed by a different key than the pinned one is rejected, even if it is internally consistent', () => {
  const a = ephemeral(), b = ephemeral(); const s = buildSnapshot(world(), a.privateKey);
  const r = verifySnapshot(s, { pinned: publicKeyHex(b.publicKey) });
  assert.equal(r.valid, false); assert.ok(r.problems.includes('PINNED_KEY_DIFFERS'));
});
test('REFUSAL: a snapshot re-signed by an attacker with their own key passes unpinned and fails pinned (why pinning matters)', () => {
  const victim = ephemeral(), attacker = ephemeral(); const n = world();
  const forged = buildSnapshot(n, attacker.privateKey); // same network, attacker's seal
  assert.equal(verifySnapshot(forged).valid, true);
  assert.equal(verifySnapshot(forged, { pinned: publicKeyHex(victim.publicKey) }).valid, false);
});
test('REFUSAL: a pin that is not a public key is refused', () => {
  const { privateKey } = ephemeral(); const s = buildSnapshot(world(), privateKey);
  for (const bad of ['', 'zz', 'abcd', 5, {}, [], 'a'.repeat(87), 'g'.repeat(88)]) assert.equal(verifySnapshot(s, { pinned: bad }).valid, false, String(bad));
});
test('REFUSAL: non-documents never throw', () => { for (const v of [null, undefined, 5, 'x', [], {}, { seal: null }]) assert.equal(verifySnapshot(v).valid, false); });
test('REFUSAL: building refuses anything that is not an Ed25519 private key', () => {
  for (const bad of [null, undefined, 'key', {}, ephemeral().publicKey, Buffer.from('x')]) assert.throws(() => buildSnapshot(world(), bad), /KEY/);
});
test('REFUSAL: a network with no blocks cannot be sealed (an empty record is not evidence)', () => {
  const n = world(); n.blocks.length = 0;
  assert.throws(() => buildSnapshot(n, ephemeral().privateKey), /EMPTY/);
});

test('the command line verifier: 0 valid, 1 invalid, 2 misuse; --pin takes a file holding the public key hex', () => {
  const { privateKey, publicKey } = ephemeral(); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-'));
  try {
    const s = buildSnapshot(world(), privateKey); const f = path.join(dir, 's.json'); fs.writeFileSync(f, JSON.stringify(s));
    const bad = clone(s); bad.head.height += 1; const fb = path.join(dir, 'bad.json'); fs.writeFileSync(fb, JSON.stringify(bad));
    const pin = path.join(dir, 'pin.txt'); fs.writeFileSync(pin, publicKeyHex(publicKey) + '\n');
    const wrong = path.join(dir, 'wrong.txt'); fs.writeFileSync(wrong, publicKeyHex(ephemeral().publicKey));
    const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8' });
    const ok = run(f, '--pin', pin); assert.equal(ok.status, 0); assert.match(ok.stdout, /VALID/); assert.match(ok.stdout, /simulated/i); assert.match(ok.stdout, /pinned/i);
    assert.equal(run(f).status, 0); assert.match(run(f).stdout, /nothing is pinned/i);
    assert.equal(run(fb, '--pin', pin).status, 1);
    assert.equal(run(f, '--pin', wrong).status, 1);
    assert.equal(run().status, 2); assert.equal(run(path.join(dir, 'missing.json')).status, 2); assert.equal(run(f, '--pin').status, 2);
    assert.ok(!ok.stdout.includes('PRIVATE'));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- the checks must each work on their own: edit the document, then RE-SIGN it with the same key, so only the
// specific check (not the signature) can be what refuses it ----
function resign(doc, privateKey) { const { seal, ...body } = doc; const { sig: _s, ...base } = seal; return { ...body, seal: { ...base, sig: edSign(null, Buffer.from(SEAL_DOMAIN + canonical({ ...body, seal: base })), privateKey).toString('hex') } }; }
const SPECIFIC = {
  'receipt header edited': [(s) => { s.receipt.receipt.header.time += 1; }, /^RECEIPT:/],
  'receipt names a different hash than the head': [(s) => { s.head.hash = 'c'.repeat(64); }, /^RECEIPT_HASH_DIFFERS$/],
  'receipt names a different state root than the head': [(s) => { s.head.stateRoot = 'd'.repeat(64); }, /^RECEIPT_STATE_ROOT_DIFFERS$/],
  'receipt for a different height': [(s) => { s.head.height += 1; }, /^RECEIPT_HEIGHT_DIFFERS$/],
  'receipt for a different chain': [(s) => { s.chainId = 'other'; }, /^RECEIPT_CHAIN_DIFFERS$/],
  'replay percent rewritten': [(s) => { s.measures.replay.percent = '50.00'; }, /^REPLAY_PERCENT_WRONG$/],
  'invariant percent rewritten': [(s) => { s.measures.invariants.percent = '1.00'; }, /^INVARIANT_PERCENT_WRONG$/],
  'matched above total': [(s) => { s.measures.replay.matched = s.measures.replay.total + 1; s.measures.replay.percent = pctOf(s.measures.replay.matched, s.measures.replay.total); }, /^MATCHED_ABOVE_TOTAL$/],
  'passed above run': [(s) => { s.measures.invariants.passed = s.measures.invariants.run + 1; s.measures.invariants.percent = pctOf(s.measures.invariants.passed, s.measures.invariants.run); }, /^PASSED_ABOVE_RUN$/],
  'run not four per block': [(s) => { s.measures.invariants.run += 1; }, /^RUN_NOT_FOUR_PER_BLOCK$/],
  'retained blocks differ from the total': [(s) => { s.measures.retainedBlocks += 1; }, /^RETAINED_TOTAL_MISMATCH$/],
  'label says it is live': [(s) => { s.label += ' It is live.'; }, /^LABEL_OVERCLAIMS:live$/],
  'label says final': [(s) => { s.label = s.label.replace('not final', 'final'); }, /^LABEL_(OVERCLAIMS:final|MISSING)/],
  'a claim far from its negation in the same sentence': [(s) => { s.label += ' It is not a bank, and the network described here is, for the moment and in every respect that matters, live.'; }, /^LABEL_OVERCLAIMS:live$/],
  'label says regulated': [(s) => { s.label += ' It is a regulated rail.'; }, /^LABEL_OVERCLAIMS:regulated$/],
  'label says settled': [(s) => { s.label += ' Payments are settled.'; }, /^LABEL_OVERCLAIMS:settled$/],
  'label without no bank partner': [(s) => { s.label = s.label.replace('no bank partner', 'some bank partners'); }, /^LABEL_MISSING:no bank partner$/],
  'label without simulated': [(s) => { s.label = s.label.replace(/simulated/gi, 'modelled'); }, /^LABEL_MISSING:/],
  'unknown top-level field': [(s) => { s.extra = 1; }, /^UNKNOWN_FIELD:doc\.extra$/],
  'unknown head field': [(s) => { s.head.extra = 1; }, /^UNKNOWN_FIELD:head\.extra$/],
  'unknown measures field': [(s) => { s.measures.extra = 1; }, /^UNKNOWN_FIELD:measures\.extra$/],
  'not labelled simulated': [(s) => { s.simulated = false; }, /^NOT_LABELLED_SIMULATED$/],
};
function pctOf(a, b) { if (b === 0) return null; const h = Number((BigInt(a) * 10000n) / BigInt(b)); return `${Math.floor(h / 100)}.${String(h % 100).padStart(2, '0')}`; }
for (const [name, [mutate, expected]] of Object.entries(SPECIFIC)) {
  test(`REFUSAL (signature intact): ${name}`, () => {
    const { privateKey } = ephemeral(); const s = clone(buildSnapshot(world(), privateKey));
    mutate(s);
    const r = verifySnapshot(resign(s, privateKey));
    assert.equal(r.valid, false);
    assert.ok(!r.problems.includes('SIGNATURE_INVALID'), 'the signature was re-made, so the refusal must come from the specific check: ' + r.problems);
    assert.ok(r.problems.some((p) => expected.test(p)), `expected ${expected} in ${r.problems}`);
  });
}
test('key order does not matter: a snapshot with every object\'s keys in reverse order verifies identically', () => {
  const { privateKey, publicKey } = ephemeral(); const s = buildSnapshot(world(), privateKey);
  const rev = (v) => (Array.isArray(v) ? v.map(rev) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, rev(v[k])])) : v);
  assert.equal(verifySnapshot(rev(s), { pinned: publicKeyHex(publicKey) }).valid, true);
});
