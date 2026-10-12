// Grant binding: which grant did the signer actually authorise under?
//
// A grant is bound to its parent by the parent's exact grant_id inside the signed GRANT payload, and a
// child link cannot be re-pointed or re-labelled onto another parent (the three PINS below are green and
// must stay green). But the grant that authorises an ordinary instruction is chosen by the ROLE LABEL on
// the signature (`agent:<grant_id>`), and that label is not inside the signed digest. When two grants of
// one issuer share an agent key, the same signed bytes verify under either label, so a relayer can move an
// instruction from a narrow grant into a broad one. The first test below demonstrates it (it was red before the fix).
//
// STATUS: the fix (mandatory `grant` inside the signed digest, docs/grant-binding-proposal.md Option A) is in the
// kernel and this file is green. The ATTACK test asserts the property, not the remedy, so it would equally have gone
// green under Option B (a shared agent key refused). The BOUND tests pin the mechanism.
//
//   node --test test/grant-binding.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';
import { genKey, canon } from '../src/crypto.js';
import { messageOf } from '../src/kernel.js';

const one = (n, t) => n.submit([t]).results[0];
const acme = (n) => n.ledger.s.accounts.get('MPL:acme').balance;

// Two root grants of one issuer sharing ONE agent key: p1 is narrow, p2 is broad.
function sharedKeyGrants(n) {
  const K = genKey();
  const mk = (id, perMax, cap) => n.grantAgent({ grantId: id, issuer: 'MPL', label: id, allowTypes: ['TRANSFER', 'GRANT'], perInstructionMax: dollars(perMax), window: { seconds: 86400, maxTotal: dollars(cap) }, counterparties: null, notAfter: null, key: K });
  const p1 = mk('p1', 100, 1000);
  assert.ok(p1.ok, `${p1.error}: ${p1.message}`);
  return { p1, p2: mk('p2', 10_000, 100_000) };
}
const over = (n) => n.agentTx('p1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(500).toString() }, ['screen:MPL']); // $500 > p1's $100 per-instruction max

// ------------------------------------------------------------------ ATTACK (red before the fix)
test('ATTACK: an agent-signed instruction cannot be moved onto a different grant that shares the signer key', () => {
  const n = new Network();
  const { p2 } = sharedKeyGrants(n);
  if (!p2.ok) { assert.equal(typeof p2.error, 'string'); return; } // remedy B: a shared key cannot be registered, so no splice is possible

  const t = over(n);
  assert.equal(one(n, t).error, 'ESCALATION_REQUIRED', 'precondition: under p1 this instruction needs the institution co-signature');

  const before = acme(n);
  // The same signed bytes, relabelled to the broad grant by a relayer. ONLY the agent signature is relabelled:
  // every other signature (screen:MPL) is kept, so a refusal can only come from grant binding, not from this
  // test having broken the instruction (an earlier draft replaced the whole sigs object and passed vacuously).
  const { 'agent:p1': agentSig, ...others } = t.sigs;
  t.sigs = { ...others, 'agent:p2': agentSig };
  assert.deepEqual(Object.keys(t.sigs).sort(), ['agent:p2', 'screen:MPL'], 'the relabelled instruction is otherwise complete');
  const r = one(n, t);
  assert.equal(r.ok, false, `SPLICED: the instruction signed under p1 was accepted under p2 (recorded caller ${JSON.stringify(r.caller)})`);
  assert.equal(acme(n), before, 'no money moved');
  assert.equal(n.ledger.s.grants.get('p2').win.spent, 0n, "p2's window was not charged");
});

// ------------------------------------------------------------------ PINS (green today, must stay green)
test('PIN: a child link carries its parent\'s exact grant_id, in the signed payload and in state', () => {
  const n = new Network();
  sharedKeyGrants(n);
  const { tx } = n.grantTx({ grantId: 'c1', issuer: 'MPL', parent: 'p1', label: 'child', allowTypes: ['TRANSFER'], perInstructionMax: dollars(50), window: { seconds: 86400, maxTotal: dollars(200) }, counterparties: null, notAfter: null, key: genKey() });
  assert.equal(tx.payload.parent, 'p1');
  assert.ok(one(n, tx).ok);
  assert.equal(n.ledger.s.grants.get('c1').parent, 'p1');
});

test('PIN: a same-holder splice of a child link is refused, by relabelling the signer or by re-pointing the parent', () => {
  const n = new Network();
  sharedKeyGrants(n);
  const child = (id) => n.grantTx({ grantId: id, issuer: 'MPL', parent: 'p1', label: 'child', allowTypes: ['TRANSFER'], perInstructionMax: dollars(50), window: { seconds: 86400, maxTotal: dollars(200) }, counterparties: null, notAfter: null, key: genKey() }).tx;

  const relabelled = child('c2'); // signed for parent p1, role relabelled to the other same-key grant
  relabelled.sigs = { 'agent:p2': relabelled.sigs['agent:p1'] };
  assert.ok(['MISSING_SIGNATURE', 'GRANT_MISMATCH'].includes(one(n, relabelled).error)); // GRANT_MISMATCH once the signing grant is bound; before it, a sub-grant not signed under agent:<payload.parent> was MISSING_SIGNATURE

  const repointed = child('c3'); // payload.parent changed to p2, signature kept
  const sig = repointed.sigs['agent:p1'];
  repointed.payload.parent = 'p2';
  repointed.sigs = { 'agent:p2': sig };
  // BAD_SIGNATURE today (the parent is inside the signed bytes); GRANT_MISMATCH once the signing grant is bound.
  // The pin guards the property - refused, and nothing created - not one particular error code.
  assert.ok(['BAD_SIGNATURE', 'GRANT_MISMATCH'].includes(one(n, repointed).error));
  assert.equal(n.ledger.s.grants.has('c2') || n.ledger.s.grants.has('c3'), false, 'neither spliced child exists');
});

test('PIN: the instruction exactly as signed under the narrow grant still needs the institution co-signature, and passes with it', () => {
  const n = new Network();
  sharedKeyGrants(n);
  assert.equal(one(n, over(n)).error, 'ESCALATION_REQUIRED');
  const escalated = n.agentTx('p1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(500).toString() }, ['screen:MPL'], { escalate: true });
  assert.ok(one(n, escalated).ok, 'a fix must not weaken the escalation path');
});

// ------------------------------------------------------------------ MANDATORY BINDING (the fix)
test('BOUND: every agent-signed instruction must name its grant inside the signed bytes', () => {
  const n = new Network();
  sharedKeyGrants(n);
  const mk = () => n.agentTx('p2', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(5).toString() }, ['screen:MPL']);

  const t = mk();
  assert.equal(t.grant, 'p2', 'the builder binds the grant it signs under');

  const missing = mk(); // signed with no grant in the digest, as an old client would
  delete missing.grant;
  assert.equal(one(n, missing).error, 'GRANT_MISMATCH');

  const wrong = mk();
  wrong.grant = 'p1'; // declared grant differs from the agent role
  assert.equal(one(n, wrong).error, 'GRANT_MISMATCH');

  const stray = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(5).toString() }, ['ops:MPL', 'screen:MPL']);
  stray.grant = 'p2'; // a grant named on an instruction no agent signed
  assert.equal(one(n, stray).error, 'GRANT_MISMATCH');

  assert.ok(one(n, t).ok, 'the correctly bound instruction is accepted');
  assert.equal(n.ledger.s.grants.get('p2').win.spent, dollars(5), 'and charged to the grant it named');
});

test('BOUND: relabel plus re-declare is not a way round it - the declared grant is signed, so the signature breaks', () => {
  const n = new Network();
  sharedKeyGrants(n);
  const t = over(n);
  const { 'agent:p1': sig, ...others } = t.sigs;
  t.sigs = { ...others, 'agent:p2': sig };
  t.grant = 'p2';
  assert.equal(one(n, t).error, 'BAD_SIGNATURE');
  assert.equal(n.ledger.s.grants.get('p2').win.spent, 0n);
});

test('BOUND: two agent signatures are refused; instructions without an agent signature keep their old digest byte for byte', () => {
  const n = new Network();
  sharedKeyGrants(n);
  const two = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(5).toString() }, ['agent:p1', 'agent:p2', 'screen:MPL'], { keyOverride: {} });
  assert.equal(two.grant, undefined, 'ambiguous: no single grant is named');
  assert.equal(one(n, two).error, 'MULTIPLE_AGENT_SIGS');

  const plain = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(5).toString() }, ['ops:MPL', 'screen:MPL']);
  assert.equal('grant' in plain, false);
  const legacy = { d: 'depositx-poc-v1', chain: n.genesis.chainId, inst_id: plain.inst_id, type: plain.type, payload: plain.payload, valid_until: plain.valid_until, caller: plain.caller, batch_digest: plain.batch_digest };
  assert.equal(messageOf(plain, n.genesis.chainId), canon(legacy), 'the digest of a non-agent instruction is unchanged');
});

test('BOUND: a sub-grant and a revocation by an ancestor name their signing grant, name their signing grant', () => {
  const n = new Network();
  sharedKeyGrants(n);
  const { tx } = n.grantTx({ grantId: 'c9', issuer: 'MPL', parent: 'p1', label: 'child', allowTypes: ['TRANSFER'], perInstructionMax: dollars(50), window: { seconds: 86400, maxTotal: dollars(200) }, counterparties: null, notAfter: null, key: genKey() });
  assert.equal(tx.grant, 'p1');
  assert.ok(one(n, tx).ok);
  const rv = n.tx('REVOKE_GRANT', { grant_id: 'c9' }, ['agent:p1']);
  assert.equal(rv.grant, 'p1');
  rv.grant = 'p2';
  assert.equal(one(n, rv).error, 'GRANT_MISMATCH');
  assert.ok(n.revokeGrant('c9', { by: 'p1' }).ok);
});
