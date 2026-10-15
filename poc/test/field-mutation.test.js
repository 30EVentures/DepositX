// P8: a payload-mutation regression harness. For each instruction type below, every top-level payload field is
// replaced in turn by each junk value, the instruction is RE-SIGNED with the right keys (so it gets past the signature
// check and into the handler), and the kernel must (1) never throw, (2) never need its catch-all (internalErrors stays
// 0: a handler tripping over bad input is a validation gap, not a rejection), (3) keep every invariant and keep the
// ledger and its own log in step, and (4) accept ONLY the junk values pinned in field-mutation-accepted.json, each of
// which was reviewed as in-domain (a valid id, a legitimate default, an "off" flag...). A new acceptance, or one that
// disappears, fails the test: review it, then regenerate with FIELD_MUTATION_UPDATE=1 node --test test/field-mutation.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Network, dollars } from '../src/network.js';
import { Ledger } from '../src/kernel.js';

const D = (x) => dollars(x).toString();
const exp = (n) => n.now() + 3600;
const cases = [
  ['TRANSFER', (n) => ['TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: D(5) }, ['ops:MPL', 'screen:MPL']]],
  ['PAYMENT', (n) => ['PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: D(5), queueIfShort: false }, ['ops:MPL', 'screen:MPL', 'accept:NSR']]],
  ['REDEEM', (n) => ['REDEEM', { account: 'MPL:acme', amount: D(5) }, ['ops:MPL']]],
  ['DVP', (n) => ['DVP', { seller: 'MPL:harbour', buyer: 'NSR:cedar', secId: 'CAN-2031', qty: '1', cash: D(5) }, ['ops:NSR', 'screen:NSR', 'ops:MPL', 'accept:MPL']]],
  ['ESCROW_LOCK', (n) => ['ESCROW_LOCK', { from: 'MPL:acme', to: 'MPL:harbour', amount: D(5), escrowId: 'e1', expiresAt: exp(n), releaseRole: 'ops:MPL', eventName: null }, ['ops:MPL', 'screen:MPL']]],
  ['ESCROW_RELEASE', (n) => { n.escrowLock('MPL:acme', 'MPL:harbour', 'e1', dollars(5)); return ['ESCROW_RELEASE', { escrowId: 'e1' }, ['ops:MPL']]; }],
  ['EVENT_RELEASE', (n) => { n.escrowLock('MPL:acme', 'MPL:harbour', 'e1', dollars(5), { eventName: 'delivery' }); return ['EVENT_RELEASE', { escrowId: 'e1', event: 'delivery' }, ['event:delivery']]; }],
  ['ESCROW_REFUND', (n) => { n.escrowLock('MPL:acme', 'MPL:harbour', 'e1', dollars(5), { expiresAt: n.now() + 100 }); n.advance(200); return ['ESCROW_REFUND', { escrowId: 'e1' }, ['ops:MPL']]; }],
  ['REGISTER_SWEEP', (n) => ['REGISTER_SWEEP', { sweepId: 's1', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: D(5) }, ['ops:MPL']]],
  ['CANCEL_SWEEP', (n) => { n.registerSweep('s1', 'MPL:acme', 'MPL:harbour', dollars(5)); return ['CANCEL_SWEEP', { sweepId: 's1' }, ['ops:MPL']]; }],
  ['GRANT', (n) => ['GRANT', { grant_id: 'g1', issuer: 'MPL', agent_key: n.grantTx({ grantId: 'z', issuer: 'MPL', label: 'a', allowTypes: ['TRANSFER'], perInstructionMax: 1n, window: { seconds: 60, maxTotal: 1n } }).tx.payload.agent_key, label: 'a', parent: null, allow_types: ['TRANSFER'], per_instruction_max: D(10), window: { seconds: 3600, max_total: D(100) }, counterparties: null, not_after: n.now() + 86400 }, ['ops:MPL']]],
  ['REVOKE_GRANT', (n) => { n.grantAgent({ grantId: 'g1', issuer: 'MPL', label: 'a', allowTypes: ['TRANSFER'], perInstructionMax: dollars(10), window: { seconds: 3600, maxTotal: dollars(100) }, counterparties: null, notAfter: null }); return ['REVOKE_GRANT', { grant_id: 'g1' }, ['ops:MPL']]; }],
  ['FREEZE_ACCOUNT', (n) => ['FREEZE_ACCOUNT', { account: 'MPL:acme' }, ['ops:MPL']]],
  ['OPEN_ACCOUNT', (n) => ['OPEN_ACCOUNT', { issuer: 'MPL', holderRef: 'newco', kycRef: 'k', kycExpires: n.now() + 1e7 }, ['ops:MPL']]],
  ['CREDIT_SECURITY', (n) => ['CREDIT_SECURITY', { account: 'MPL:harbour', secId: 'CAN-2031', qty: '5' }, ['gov:operator', 'gov:neutral']]],
  ['FUND_SP', (n) => ['FUND_SP', { issuer: 'MPL', amount: D(5), A_after: (n.ledger.s.anchor.A + dollars(5)).toString() }, ['ops:MPL', 'anchor']]],
  ['DEFUND_SP', (n) => ['DEFUND_SP', { issuer: 'MPL', amount: D(5), A_after: (n.ledger.s.anchor.A - dollars(5)).toString() }, ['ops:MPL', 'anchor']]],
  ['OPEN_HOLD', (n) => { const b = n.banks.MPL; const h = b.placeHold('acme', dollars(5)); return ['OPEN_HOLD', { issuer: 'MPL', holdId: h.holdId, amount: D(5), L_after: h.L_after.toString(), seq: h.seq }, ['attest:MPL']]; }],
  ['ATTEST', (n) => ['ATTEST', { issuer: 'MPL', seq: n.ledger.s.issuers.get('MPL').seq + 1, L: n.ledger.s.issuers.get('MPL').L.toString() }, ['attest:MPL']]],
  ['REPORT_PAR_BREAK', (n) => ['REPORT_PAR_BREAK', { reporter: 'operator', issuer: 'MPL' }, ['reconciler:operator']]],
  ['BATCH', (n) => ['BATCH', { legs: [n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: D(1) }, ['ops:MPL', 'screen:MPL'])] }, []]],
];
const JUNK = [null, undefined, '', 'x', ' 5', '0', '00', '-5', '1.5', '1e3', '9'.repeat(19), 0, -1, 1.5, 1e21, NaN, true, false, [], {}, [1], { a: 1 }, 'constructor', '__proto__', 'ops:MPL', 'A'.repeat(100)];
const label = (j) => (j === undefined ? '<missing>' : Number.isNaN(j) ? 'NaN' : JSON.stringify(j).slice(0, 24));
const ACCEPTED_FILE = fileURLToPath(new URL('./field-mutation-accepted.json', import.meta.url));

// types with no free-form payload worth mutating here (no payload, or covered by dedicated tests)
const NOT_PROBED = ['RELEASE_HOLD', 'MINT', 'CLOSE_REDEMPTION', 'CLOSE_CONVERT_OUT', 'CLOSE_CONVERT_IN', 'UNFREEZE_ACCOUNT', 'NET_CYCLE', 'RESUME'];

test('every instruction type is either probed or knowingly not', () => {
  const types = Object.getOwnPropertyNames(Ledger.prototype).filter((k) => k.startsWith('tx_')).map((k) => k.slice(3));
  const covered = new Set([...cases.map(([name]) => name), ...NOT_PROBED]);
  assert.deepEqual(types.filter((t) => !covered.has(t)), [], 'a new instruction type needs a case in this harness (or an entry in NOT_PROBED with a reason)');
});

test('payload mutation: never throws, never needs the catch-all, keeps invariants and the log in step, accepts only the pinned values', () => {
  const accepted = {};
  const problems = [];
  for (const [name, build] of cases) {
    const base = new Network();
    const [, bp] = build(base);
    for (const f of Object.keys(bp)) {
      for (const j of JUNK) {
        const n = new Network();
        const [type, payload, roles] = build(n);
        const p = { ...payload };
        if (j === undefined) delete p[f]; else p[f] = j;
        const t = n.tx(type, p, roles);
        let r;
        try { r = n.submitSigned(t); } catch (e) { problems.push(`${name}.${f}=${label(j)} threw ${e.message}`); continue; }
        if ((n.ledger.counters.internalErrors || 0) > 0) problems.push(`${name}.${f}=${label(j)} reached the catch-all`);
        if (n.ledger.s.height !== n.log.length) problems.push(`${name}.${f}=${label(j)} desynchronised the ledger and its log`);
        // invariants: only a sound attestation may leave one violated (that is the designed halt), so report any other
        if (n.ledger.checkInvariants(n.ledger.s.time).violations.length && name !== 'ATTEST') problems.push(`${name}.${f}=${label(j)} violated an invariant`);
        if (r.ok) (accepted[`${name}.${f}`] ||= []).push(label(j));
      }
    }
  }
  assert.deepEqual(problems, []);
  if (process.env.FIELD_MUTATION_UPDATE) fs.writeFileSync(ACCEPTED_FILE, JSON.stringify(accepted, null, 1) + '\n');
  assert.deepEqual(accepted, JSON.parse(fs.readFileSync(ACCEPTED_FILE, 'utf8')), 'the set of accepted junk values changed: review it, then regenerate');
});
