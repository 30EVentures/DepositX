import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';
import { Ledger } from '../src/kernel.js';
import { canon } from '../src/crypto.js';

const inv = (n) => n.ledger.checkInvariants(n.ledger.s.time);
const allOk = (n) => {
  const v = inv(n).violations;
  assert.deepEqual(v, [], 'no invariant violations');
  assert.equal(n.ledger.s.halt, null, 'network not halted');
};
const S = (n, id) => n.ledger.supplyOf(id);
const bal = (n, acct) => n.ledger.s.accounts.get(acct).balance;
const sp = (n, id) => n.ledger.s.issuers.get(id).sp;
// everything except height/time/dedup: what "state unchanged" means for an atomic rejection
const core = (n) => canon({ a: n.ledger.s.accounts, i: n.ledger.s.issuers, an: n.ledger.s.anchor, q: n.ledger.s.queue });

test('bootstrap: network is live and every invariant holds', () => {
  const n = new Network();
  allOk(n);
  for (const id of ['MPL', 'NSR', 'LKS']) {
    assert.equal(S(n, id), n.ledger.s.issuers.get(id).L, `${id} supply equals core control balance`);
    assert.equal(sp(n, id), dollars(2_000_000));
  }
  assert.equal(n.ledger.s.anchor.A, dollars(6_000_000));
});

test('mint then redeem returns the customer to the same deposit, with supply and core in step', () => {
  const n = new Network();
  const dep = n.banks.MPL.customer('acme').ordinary;
  assert.ok(n.mint('MPL', 'acme', dollars(1000)).ok);
  assert.equal(n.banks.MPL.customer('acme').ordinary, dep - dollars(1000));
  assert.ok(n.redeem('MPL', 'acme', dollars(1000)).ok);
  assert.equal(n.banks.MPL.customer('acme').ordinary, dep);
  allOk(n);
  assert.equal(S(n, 'MPL'), n.ledger.s.issuers.get('MPL').L);
});

test('no unbacked mint: mint needs a hold registered by the independent attestation key', () => {
  const n = new Network();
  const before = core(n);
  const r = n.chaos('unbacked_mint');
  assert.equal(r.error, 'NO_MATCHING_HOLD');
  assert.equal(core(n), before);
  // the mint key alone cannot register a hold either
  const t = n.tx('OPEN_HOLD', { issuer: 'MPL', holdId: 'X1', amount: '100', L_after: String(n.ledger.s.issuers.get('MPL').L + 100n), seq: 9999 }, ['mint:MPL']);
  t.sigs['attest:MPL'] = t.sigs['mint:MPL'];
  const b = n.submit([t]);
  assert.equal(b.results[0].error, 'BAD_SIGNATURE');
  allOk(n);
});

test('authority: forged, missing and cross-bank signatures are rejected and change nothing', () => {
  const n = new Network();
  const before = core(n);
  assert.equal(n.chaos('forged_sig').error, 'BAD_SIGNATURE');
  const noScreen = n.submit([n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: '500' }, ['ops:LKS'])]);
  assert.equal(noScreen.results[0].error, 'MISSING_SIGNATURE');
  const noAccept = n.submit([n.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: '500', queueIfShort: false }, ['ops:MPL', 'screen:MPL'])]);
  assert.equal(noAccept.results[0].error, 'MISSING_SIGNATURE');
  // the operator holds governance keys but cannot move a customer balance
  const op = n.submit([n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: '500' }, ['gov:operator', 'gov:neutral'])]);
  assert.equal(op.results[0].error, 'MISSING_SIGNATURE');
  assert.equal(core(n), before);
});

test('rejections: overdraft, value cap, replay, stale validity, unknown type, malformed amounts', () => {
  const n = new Network();
  const before = core(n);
  assert.equal(n.chaos('overdraft').error, 'INSUFFICIENT_FUNDS');
  assert.equal(n.chaos('over_cap').error, 'VALUE_CAP_EXCEEDED');
  const rep = n.chaos('replay');
  assert.equal(rep.error, 'DUPLICATE_INSTRUCTION');
  const stale = n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: '5' }, ['ops:LKS', 'screen:LKS'], { ttl: -5 });
  assert.equal(n.submit([stale]).results[0].error, 'BAD_VALIDITY');
  assert.equal(n.submit([n.tx('SELF_DESTRUCT', {}, [])]).results[0].error, 'UNKNOWN_TYPE');
  for (const bad of ['0', '-5', '1.5', '1e3', '', 'abc']) {
    const b = n.submit([n.tx('TRANSFER', { from: 'LKS:elm', to: 'LKS:fjord', amount: bad }, ['ops:LKS', 'screen:LKS'])]);
    assert.equal(b.results[0].error, 'BAD_AMOUNT', `amount "${bad}"`);
  }
  // only the replayed 1-cent-ish transfer succeeded (100 cents), everything else changed nothing
  assert.equal(bal(n, 'LKS:elm') + bal(n, 'LKS:fjord'), dollars(500_000));
  allOk(n);
  void before;
});

test('cross-issuer payment is par: value moves 1:1, positions move with it, invariants hold, total supply conserved', () => {
  const n = new Network();
  const total = () => S(n, 'MPL') + S(n, 'NSR') + S(n, 'LKS');
  const t0 = total();
  const r = n.pay('MPL:acme', 'NSR:cedar', dollars(12_345.67));
  assert.ok(r.ok, r.message);
  assert.equal(bal(n, 'MPL:acme'), dollars(500_000 - 12_345.67));
  assert.equal(bal(n, 'NSR:cedar'), dollars(400_000 + 12_345.67));
  assert.equal(sp(n, 'MPL'), dollars(2_000_000 - 12_345.67));
  assert.equal(sp(n, 'NSR'), dollars(2_000_000 + 12_345.67));
  assert.equal(total(), t0);
  allOk(n);
  // the core caught up through the adapter: nothing left in flight
  for (const id of ['MPL', 'NSR']) assert.equal(inv(n).per.find((x) => x.issuer === id).diff, 0n);
});

test('payment beyond the prefunded position is refused, and nothing is debited', () => {
  const n = new Network();
  n.mint('MPL', 'acme', dollars(4_000_000));
  const before = core(n);
  const r = n.pay('MPL:acme', 'NSR:cedar', dollars(2_500_000));
  assert.equal(r.error, 'INSUFFICIENT_SETTLEMENT_POSITION');
  assert.equal(core(n), before, 'no partial state');
});

test('DvP is atomic: a failing cash leg rolls back the security leg; a failing security leg debits no cash', () => {
  const n = new Network();
  // security leg would succeed, cash leg fails (position too small)
  n.defund('NSR', dollars(1_990_000));
  n.mint('NSR', 'pinnacle', dollars(3_000_000));
  const before = core(n);
  const r = n.dvp('MPL:harbour', 'NSR:pinnacle', 'CAN-2031', 100n, dollars(1_000_000));
  assert.equal(r.error, 'INSUFFICIENT_SETTLEMENT_POSITION');
  assert.equal(core(n), before, 'security leg rolled back with the cash leg');
  // cash leg fine, security leg impossible
  const n2 = new Network();
  const b2 = core(n2);
  const r2 = n2.dvp('MPL:harbour', 'NSR:pinnacle', 'CAN-2031', 5000n, dollars(10));
  assert.equal(r2.error, 'INSUFFICIENT_SECURITIES');
  assert.equal(core(n2), b2);
  // and the happy path settles both legs in one block
  const r3 = n2.dvp('MPL:harbour', 'NSR:pinnacle', 'CAN-2031', 10n, dollars(10_000));
  assert.ok(r3.ok, r3.message);
  assert.equal(n2.ledger.s.accounts.get('NSR:pinnacle').sec.get('CAN-2031'), 10n);
  assert.equal(n2.ledger.s.accounts.get('MPL:harbour').sec.get('CAN-2031'), 990n);
  allOk(n2);
});

test('sanctions screening: the payer bank will not issue a receipt, so nothing reaches the ledger', () => {
  const n = new Network();
  const h = n.ledger.s.height;
  const r = n.pay('MPL:acme', 'LKS:shadow', dollars(10));
  assert.equal(r.error, 'SANCTIONS_HIT');
  assert.equal(n.ledger.s.height, h, 'no block was produced');
});

test('liquidity-saving netting: mutual payments that each exceed the position settle as a net cycle', () => {
  const n = new Network();
  n.defund('MPL', dollars(1_999_000)); // MPL position now $1,000
  n.defund('NSR', dollars(1_999_000));
  n.mint('MPL', 'acme', dollars(50_000));
  n.mint('NSR', 'cedar', dollars(50_000));
  const a = n.pay('MPL:acme', 'NSR:cedar', dollars(5_000), { queue: true });
  const b = n.pay('NSR:cedar', 'MPL:acme', dollars(5_000), { queue: true });
  const c = n.pay('MPL:acme', 'NSR:cedar', dollars(9_000), { queue: true }); // one-sided: cannot fit
  assert.ok(a.ok && b.ok && c.ok);
  assert.equal(n.ledger.s.queue.length, 3, 'all three wait; nothing has been debited');
  assert.equal(bal(n, 'MPL:acme'), dollars(550_000));
  const acmeBefore = bal(n, 'MPL:acme');
  const r = n.netCycle();
  assert.ok(r.ok, r.message);
  const settled = n.ledger.s.queue;
  assert.equal(settled.length, 1, 'only the one-sided payment stays queued');
  assert.equal(bal(n, 'MPL:acme'), acmeBefore, 'mutual $5,000 payments net to zero');
  assert.equal(sp(n, 'MPL'), dollars(1_000), 'positions untouched by a perfectly offsetting cycle');
  allOk(n);
});

test('finality receipts verify offline; tampering is detected', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(1));
  const b = n.blocks.at(-1);
  assert.ok(Network.verifyReceipt(n.genesis, b));
  const evil = { ...b, header: { ...b.header, stateRoot: 'f'.repeat(64) } };
  assert.equal(Network.verifyReceipt(n.genesis, evil), false);
  const thin = { ...b, sigs: { operator: b.sigs.operator, MPL: b.sigs.MPL } };
  assert.equal(Network.verifyReceipt(n.genesis, thin), false, 'below quorum');
});

test('determinism: replaying the transaction log from genesis reproduces every state root and hash', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(777));
  n.dvp('MPL:harbour', 'NSR:pinnacle', 'CAN-2031', 3n, dollars(3000));
  n.redeem('LKS', 'elm', dollars(1000));
  n.chaos('overdraft'); // rejected instructions replay identically too
  n.chaos('core_restore', { issuer: 'NSR' });
  assert.ok(n.verifyReplay().ok);
  // block by block, not just the tip
  const l = new Ledger(n.genesis);
  n.log.forEach((b, i) => assert.equal(l.executeBlock(b).hash, n.blocks[i].hash, `block ${i + 1}`));
});

test('replay detects out-of-band corruption: a state change that is not in the transaction log cannot be reproduced', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(5));
  assert.ok(n.verifyReplay().ok);
  n.chaos('inflate'); // mutates state without a transaction
  assert.equal(n.verifyReplay().ok, false, 'an independent replay from genesis disagrees with the live state root');
});

test('graded halt, kernel defect: unminted tokens halt the whole network; resume is co-signed and only works once repaired', () => {
  const n = new Network();
  n.chaos('inflate');
  assert.equal(n.ledger.s.halt.reason, 'P1_CONSERVATION');
  // settlement stops, consensus does not: blocks keep being produced
  const h = n.ledger.s.height;
  const r = n.pay('MPL:acme', 'NSR:cedar', dollars(1));
  assert.equal(r.error, 'NETWORK_HALTED');
  assert.equal(n.ledger.s.height, h + 1, 'heartbeat and rejected blocks still commit');
  // resume attempts
  assert.equal(n.resume('network').error, 'INVARIANTS_STILL_VIOLATED');
  const missingObs = n.submit([n.tx('RESUME', { scope: 'network' }, ['gov:operator', 'gov:neutral'])]);
  assert.equal(missingObs.results[0].error, 'MISSING_SIGNATURE');
  const oneGov = n.submit([n.tx('RESUME', { scope: 'network' }, ['gov:operator', 'observer'])]);
  assert.equal(oneGov.results[0].error, 'MISSING_SIGNATURE');
  n.chaos('repair');
  assert.ok(n.resume('network').ok);
  assert.equal(n.ledger.s.halt, null);
  assert.ok(n.pay('MPL:acme', 'NSR:cedar', dollars(1)).ok);
  allOk(n);
});

test('graded halt, core data loss at a higher sequence is real over-issuance: network halts; re-attesting the true balance lets it resume', () => {
  const n = new Network();
  n.chaos('core_loss', { issuer: 'MPL' });
  assert.equal(n.ledger.s.halt.reason, 'OVER_ISSUANCE');
  assert.equal(n.ledger.s.halt.issuer, 'MPL');
  assert.equal(n.resume('network').error, 'INVARIANTS_STILL_VIOLATED');
  n.chaos('reattest', { issuer: 'MPL' });
  assert.ok(n.resume('network').ok);
  allOk(n);
});

test('graded halt, core restored from backup (sequence regression) is core lag: only that issuer is quarantined', () => {
  const n = new Network();
  n.chaos('core_restore', { issuer: 'NSR' });
  assert.equal(n.ledger.s.halt, null, 'no network halt');
  assert.equal(n.ledger.s.issuers.get('NSR').status, 'QUARANTINED');
  assert.equal(n.ledger.s.issuers.get('MPL').status, 'ACTIVE');
  // the healthy pair keeps trading
  assert.ok(n.pay('MPL:acme', 'LKS:elm', dollars(50)).ok);
  // the quarantined issuer cannot send, mint or redeem, but can still receive
  assert.equal(n.pay('NSR:cedar', 'MPL:acme', dollars(50)).error, 'ISSUER_QUARANTINED');
  assert.equal(n.mint('NSR', 'cedar', dollars(50)).error, 'ISSUER_QUARANTINED');
  assert.equal(n.redeem('NSR', 'cedar', dollars(50)).error, 'ISSUER_QUARANTINED');
  assert.ok(n.pay('MPL:acme', 'NSR:cedar', dollars(50)).ok, 'inbound is allowed');
  // resume needs the issuer's own signature as well as governance and the observer
  const noIssuer = n.submit([n.tx('RESUME', { scope: 'issuer', issuer: 'NSR' }, ['gov:operator', 'gov:neutral', 'observer'])]);
  assert.equal(noIssuer.results[0].error, 'MISSING_SIGNATURE');
  assert.ok(n.resume('issuer', 'NSR').ok);
  assert.equal(n.ledger.s.issuers.get('NSR').status, 'ACTIVE');
  assert.ok(n.pay('NSR:cedar', 'MPL:acme', dollars(50)).ok);
  allOk(n);
});

test('an unresolved quarantine escalates to a network halt after 15 minutes; resume issuer first, then network', () => {
  const n = new Network();
  n.chaos('fire_alarm', { issuer: 'LKS' });
  assert.equal(n.ledger.s.issuers.get('LKS').status, 'QUARANTINED');
  assert.equal(n.ledger.s.halt, null);
  n.advance(600);
  assert.equal(n.ledger.s.halt, null, 'not yet');
  n.advance(400);
  assert.equal(n.ledger.s.halt.reason, 'QUARANTINE_ESCALATION');
  assert.equal(n.resume('network').error, 'INVARIANTS_STILL_VIOLATED', 'the quarantine itself is what is breaching');
  assert.ok(n.resume('issuer', 'LKS').ok);
  assert.ok(n.resume('network').ok);
  allOk(n);
});

test('slow core: in-flight amounts are tracked exactly, then age out into a quarantine; catching up clears them', () => {
  const n = new Network();
  n.setCorePaused(true);
  assert.ok(n.pay('MPL:acme', 'NSR:cedar', dollars(1000)).ok);
  const i = inv(n);
  assert.equal(i.per.find((x) => x.issuer === 'MPL').R, dollars(1000), 'payer core has not yet debited');
  assert.equal(i.per.find((x) => x.issuer === 'NSR').In, dollars(1000), 'payee core has not yet credited');
  assert.deepEqual(i.violations, [], 'a slow core is not a violation while the gap is fully explained');
  n.advance(950);
  assert.equal(n.ledger.s.issuers.get('MPL').status, 'QUARANTINED');
  assert.equal(n.ledger.s.issuers.get('NSR').status, 'QUARANTINED');
  n.setCorePaused(false); // adapters catch up: closing postings are allowed while quarantined
  assert.equal(inv(n).per.find((x) => x.issuer === 'MPL').R, 0n);
  assert.ok(n.resume('issuer', 'MPL').ok);
  assert.ok(n.resume('issuer', 'NSR').ok);
  allOk(n);
});

// ---------------------------------------------------------------- fuzz vs an independent reference model
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('fuzz: 1,500 random operations (valid and invalid) never break an invariant and always agree with a reference model', () => {
  const R = rng(20260925);
  const n = new Network();
  const accts = ['MPL:acme', 'MPL:harbour', 'NSR:cedar', 'NSR:pinnacle', 'LKS:elm', 'LKS:fjord'];
  const issuers = ['MPL', 'NSR', 'LKS'];
  const model = { bal: new Map(accts.map((a) => [a, bal(n, a)])), sp: new Map(issuers.map((i) => [i, sp(n, i)])) };
  const pick = (xs) => xs[Math.floor(R() * xs.length)];
  const amt = () => {
    const c = R();
    return c < 0.1 ? 0n : c < 0.2 ? dollars(10_000_000) : BigInt(Math.floor(R() * 200_000_00) + 1);
  };
  let accepted = 0;
  let rejected = 0;
  for (let step = 0; step < 1500; step++) {
    const op = pick(['pay', 'pay', 'pay', 'mint', 'redeem', 'fund', 'defund']);
    const x = amt();
    const before = core(n);
    let r;
    if (op === 'pay') {
      const from = pick(accts);
      const to = pick(accts.filter((a) => a !== from));
      const [a] = from.split(':');
      const [b] = to.split(':');
      // reference model decides what SHOULD happen
      const should = x > 0n && x <= dollars(5_000_000) && model.bal.get(from) >= x && (a === b || model.sp.get(a) >= x);
      r = x === 0n ? { ok: false } : n.pay(from, to, x);
      assert.equal(r.ok, should, `step ${step}: ${op} ${from}->${to} ${x} model=${should} kernel=${r.ok} ${r.error}`);
      if (should) {
        model.bal.set(from, model.bal.get(from) - x);
        model.bal.set(to, model.bal.get(to) + x);
        if (a !== b) {
          model.sp.set(a, model.sp.get(a) - x);
          model.sp.set(b, model.sp.get(b) + x);
        }
      }
    } else if (op === 'mint') {
      const acct = pick(accts);
      const [i, c] = acct.split(':');
      const should = x > 0n && x <= dollars(5_000_000) && n.banks[i].customer(c).ordinary >= x;
      r = x === 0n ? { ok: false } : n.mint(i, c, x);
      assert.equal(!!r.ok, should, `step ${step}: mint ${acct} ${x} ${r.error}`);
      if (should) model.bal.set(acct, model.bal.get(acct) + x);
    } else if (op === 'redeem') {
      const acct = pick(accts);
      const [i, c] = acct.split(':');
      const should = x > 0n && x <= dollars(5_000_000) && model.bal.get(acct) >= x;
      r = x === 0n ? { ok: false } : n.redeem(i, c, x);
      assert.equal(!!r.ok, should, `step ${step}: redeem ${acct} ${x} ${r.error}`);
      if (should) model.bal.set(acct, model.bal.get(acct) - x);
    } else if (op === 'fund') {
      const i = pick(issuers);
      const should = x > 0n && n.banks[i].cbBalance >= x;
      r = x === 0n ? { ok: false } : n.fund(i, x);
      assert.equal(!!r.ok, should, `step ${step}: fund ${i} ${x}`);
      if (should) model.sp.set(i, model.sp.get(i) + x);
    } else {
      const i = pick(issuers);
      const should = x > 0n && model.sp.get(i) >= x;
      r = x === 0n ? { ok: false } : n.defund(i, x);
      assert.equal(!!r.ok, should, `step ${step}: defund ${i} ${x}`);
      if (should) model.sp.set(i, model.sp.get(i) - x);
    }
    if (r.ok) accepted++;
    else {
      rejected++;
      if (x !== 0n && op !== 'mint') assert.equal(core(n), before, `step ${step}: a rejected ${op} changed state`);
    }
    if (step % 25 === 0) {
      allOk(n);
      for (const a of accts) assert.equal(bal(n, a), model.bal.get(a), `step ${step}: balance of ${a}`);
      for (const i of issuers) assert.equal(sp(n, i), model.sp.get(i), `step ${step}: position of ${i}`);
    }
  }
  allOk(n);
  for (const a of accts) assert.equal(bal(n, a), model.bal.get(a));
  for (const i of issuers) {
    assert.equal(sp(n, i), model.sp.get(i));
    assert.equal(S(n, i), n.ledger.s.issuers.get(i).L, `${i} supply equals core control balance after the run`);
  }
  assert.ok(accepted > 300 && rejected > 100, `mix of outcomes (accepted ${accepted}, rejected ${rejected})`);
  assert.ok(n.verifyReplay().ok, 'and the whole run replays identically from genesis');
});
