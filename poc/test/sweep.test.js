// Roadmap 1.4: Standing/Sweep (T6). A registered same-issuer rule fires at #endOfBlock - the
// same deterministic, every-validator-agrees hook the graded halt already runs from - so a
// sweep firing needs no separate submitted instruction and replays identically from the log.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Network, dollars } from '../src/network.js';

const bal = (n, acct) => n.ledger.s.accounts.get(acct).balance;
const inv = (n) => n.ledger.checkInvariants(n.ledger.s.time);
const allOk = (n) => assert.deepEqual(inv(n).violations, [], 'no invariant violations');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'concord-'));

test('sweep: registering where the source already exceeds keepAmount fires immediately, at that block\'s end', () => {
  const n = new Network();
  const before = bal(n, 'MPL:harbour');
  const r = n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'sw1', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: dollars(400_000).toString() }, ['ops:MPL'])]);
  assert.ok(r.results[0].ok, r.results[0].message);
  assert.equal(bal(n, 'MPL:acme'), dollars(400_000));
  assert.equal(bal(n, 'MPL:harbour'), before + dollars(100_000));
  assert.deepEqual(r.sweepFires.map((f) => f.sweepId), ['sw1']);
  allOk(n);
});

test('sweep: never fires while at or below keepAmount; fires the instant a later block pushes it over', () => {
  const n = new Network();
  const r = n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'sw2', from: 'LKS:fjord', to: 'LKS:elm', keepAmount: dollars(150_000).toString() }, ['ops:LKS'])]);
  assert.equal(bal(n, 'LKS:fjord'), dollars(150_000), 'exactly at keep: not a fire (strictly greater only)');
  assert.equal(r.sweepFires.length, 0);
  const t = n.submit([n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: dollars(10_000).toString() }, ['ops:LKS', 'screen:LKS'])]);
  assert.ok(t.results[0].ok);
  assert.equal(bal(n, 'LKS:fjord'), dollars(150_000), 'the sweep fired at this very block\'s end, bringing it right back to keep');
  assert.equal(bal(n, 'LKS:elm'), dollars(350_000), 'elm sent 10,000 out by transfer and received it right back by the sweep, same block');
  assert.deepEqual(t.sweepFires.map((f) => f.sweepId), ['sw2']);
  allOk(n);
});

test('sweep: cancel stops future firings; cancelling twice fails cleanly', () => {
  const n = new Network();
  n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'sw3', from: 'NSR:pinnacle', to: 'NSR:cedar', keepAmount: dollars(700_000).toString() }, ['ops:NSR'])]);
  assert.equal(bal(n, 'NSR:pinnacle'), dollars(600_000), 'below keep: no fire yet');
  const cancel = n.submit([n.tx('CANCEL_SWEEP', { sweepId: 'sw3' }, ['ops:NSR'])]);
  assert.ok(cancel.results[0].ok, cancel.results[0].message);
  n.mint('NSR', 'pinnacle', dollars(200_000));
  assert.equal(bal(n, 'NSR:pinnacle'), dollars(800_000), 'no sweep fired: the rule was cancelled before this credit');
  assert.equal(n.submit([n.tx('CANCEL_SWEEP', { sweepId: 'sw3' }, ['ops:NSR'])]).results[0].error, 'UNKNOWN_SWEEP');
});

test('sweep: registration is rejected across issuers, to the same account, by the wrong signer, or twice under the same id', () => {
  const n = new Network();
  assert.equal(n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'x1', from: 'MPL:acme', to: 'NSR:cedar', keepAmount: '0' }, ['ops:MPL'])]).results[0].error, 'SWEEP_SAME_ISSUER_ONLY');
  assert.equal(n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'x2', from: 'MPL:acme', to: 'MPL:acme', keepAmount: '0' }, ['ops:MPL'])]).results[0].error, 'SELF_TRANSFER');
  assert.equal(n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'x3', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: '0' }, ['ops:NSR'])]).results[0].error, 'MISSING_SIGNATURE');
  assert.equal(n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'x4', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: 'abc' }, ['ops:MPL'])]).results[0].error, 'BAD_AMOUNT');
  const ok = n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'x5', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: dollars(500_000).toString() }, ['ops:MPL'])]);
  assert.ok(ok.results[0].ok, ok.results[0].message);
  assert.equal(n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'x5', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: '0' }, ['ops:MPL'])]).results[0].error, 'SWEEP_EXISTS');
});

test('sweep: two rules in one block cascade deterministically, in registration order', () => {
  const n = new Network();
  // neither fires at its own registration: elm=350,000 <= keep 360,000; fjord=150,000 == keep 150,000
  n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'c1', from: 'LKS:elm', to: 'LKS:fjord', keepAmount: dollars(360_000).toString() }, ['ops:LKS'])]);
  n.submit([n.tx('REGISTER_SWEEP', { sweepId: 'c2', from: 'LKS:fjord', to: 'LKS:elm', keepAmount: dollars(152_000).toString() }, ['ops:LKS'])]);
  assert.equal(bal(n, 'LKS:elm'), dollars(350_000));
  assert.equal(bal(n, 'LKS:fjord'), dollars(150_000));

  // one credit to elm triggers both, in the same end-of-block pass, in registration order (c1 then c2):
  //   elm 350,000 +20,000 mint = 370,000
  //   c1 (elm->fjord, keep 360,000): excess 10,000 -> elm=360,000, fjord=160,000
  //   c2 (fjord->elm, keep 152,000): sees fjord's UPDATED 160,000 -> excess 8,000 -> fjord=152,000, elm=368,000
  const mint = n.mint('LKS', 'elm', dollars(20_000));
  assert.ok(mint.ok, mint.message);
  assert.equal(bal(n, 'LKS:elm'), dollars(368_000));
  assert.equal(bal(n, 'LKS:fjord'), dollars(152_000));
  assert.equal(bal(n, 'LKS:elm') + bal(n, 'LKS:fjord'), dollars(350_000 + 150_000 + 20_000), 'total conserved: only the one mint added value');
  allOk(n);
});

test('sweep: state is captured in the durable store and a restart replays the same firings', () => {
  const dir = tmp();
  const a = new Network({ dataDir: dir });
  a.submit([a.tx('REGISTER_SWEEP', { sweepId: 'd1', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: dollars(450_000).toString() }, ['ops:MPL'])]);
  a.mint('MPL', 'acme', dollars(100_000)); // acme settled at 450,000 after registration's own fire; this pushes it over keep again
  const snap = a.snapshot();
  a.store.close();
  const b = new Network({ dataDir: dir });
  assert.equal(b.recovered.blocks, a.ledger.s.height);
  assert.equal(b.ledger.stateRoot(), a.ledger.stateRoot());
  assert.equal(bal(b, 'MPL:acme'), bal(a, 'MPL:acme'));
  assert.equal(bal(b, 'MPL:harbour'), bal(a, 'MPL:harbour'));
  assert.deepEqual(b.snapshot().issuers, snap.issuers);
  // the recovered rule is still live: another credit fires it again with no re-registration
  b.mint('MPL', 'acme', dollars(100_000));
  const acmeAfter = bal(b, 'MPL:acme');
  assert.ok(acmeAfter <= dollars(450_000), `sweep still active after recovery (acme=${acmeAfter})`);
  allOk(b);
  b.store.close();
});

test('Network wrappers: registerSweep/cancelSweep match the raw tx()+submit() path', () => {
  const n = new Network();
  const reg = n.registerSweep('sw-w1', 'MPL:acme', 'MPL:harbour', dollars(400_000));
  assert.ok(reg.ok, reg.message);
  assert.equal(bal(n, 'MPL:acme'), dollars(400_000));
  assert.ok(n.cancelSweep('sw-w1').ok);
  assert.equal(n.cancelSweep('sw-w1').error, 'UNKNOWN_SWEEP');
  n.mint('MPL', 'acme', dollars(50_000));
  assert.equal(bal(n, 'MPL:acme'), dollars(450_000), 'cancelled: no sweep fires');
});
