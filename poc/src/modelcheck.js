// Explicit-state model checker for the kernel + adapter protocol.
//
// Breadth-first search over every reachable state of a small network, driving the REAL kernel (not a
// re-implementation). At each state it applies every enabled action, including adversarial ones, and
// checks:
//   SAFETY   S1  no invariant violation and no halt is ever reached through legitimate actions
//            S2  a rejected instruction changes nothing (atomicity)
//            S3  attacks (forged signature, replay, unbacked mint, overdraft) are always rejected
//            S4  when the core has fully caught up, ledger supply == core control balance, per issuer
//            S5  when the core has fully caught up, money is conserved across core, ledger and anchor
//   LIVENESS L1  from EVERY reachable state, letting the core drain its backlog reaches a quiescent state
//                where every invariant holds (no state is a dead end, including "slow core" states)
//
// State space is finite because amounts are small ($1 and $2 steps against fixed balances). A visited-set
// keyed on the canonical state prunes revisits, so depth can be large. This is a bounded check: it proves
// nothing about states beyond the bound or amounts outside the alphabet. It is a much stronger test than
// sampling, and it is what TLC would do on a TLA+ model if a Java runtime were available.

import { Network, dollars } from './network.js';
import { canon } from './crypto.js';

const ACCTS = ['MPL:acme', 'NSR:cedar'];
const isA = (a) => a.startsWith('MPL');

function snapshotAll(net) {
  return {
    s: structuredClone(net.ledger.s),
    banks: Object.fromEntries(Object.entries(net.banks).map(([k, b]) => [k, b.snapshot()])),
    tasks: structuredClone(net.coreTasks),
    paused: net.corePaused,
  };
}
function restoreAll(net, snap) {
  net.ledger.s = structuredClone(snap.s);
  net.ledger.s.dedup = new Map(); // instruction ids are unique per action; the dedup window is irrelevant here
  for (const [k, b] of Object.entries(snap.banks)) net.banks[k].restore(b);
  net.coreTasks = structuredClone(snap.tasks);
  net.corePaused = snap.paused;
  net.blocks = [];
  net.log = [];
}
// canonical state key: everything that can influence future behaviour, minus heights, hashes and ids
function key(net) {
  const s = net.ledger.s;
  return canon({
    a: [...s.accounts].map(([k, v]) => [k, v.balance, v.status, [...v.sec]]),
    i: [...s.issuers].map(([k, v]) => [k, v.status, v.minted, v.burned, v.convIn, v.convOut, v.L, v.seq === 0 ? 0 : 1, v.sp, [...v.holds.values()].map((x) => x.amount), [...v.redemptions.values()].map((x) => x.amount), [...v.pendingOut.values()].map((x) => x.amount), [...v.pendingIn.values()].map((x) => x.amount)]),
    an: s.anchor,
    q: s.queue.length,
    h: s.halt && s.halt.reason,
    banks: Object.values(net.banks).map((b) => [b.controlGL, b.cbBalance, [...b.customers.values()].map((c) => c.ordinary)]),
    tasks: net.coreTasks.map((t) => [t.kind, t.issuer, t.amount, !!t.posted]),
    paused: net.corePaused,
    escrows: [...net.ledger.s.escrows].map(([k, v]) => [k, v.from, v.to, v.amount, v.eventName]),
    sweeps: [...net.ledger.s.sweeps].map(([k, v]) => [k, v.from, v.to, v.keep]),
  });
}
// state as the safety properties see it (no ids)
const coreState = (net) => canon({ a: net.ledger.s.accounts, i: net.ledger.s.issuers, an: net.ledger.s.anchor, q: net.ledger.s.queue, e: net.ledger.s.escrows, sw: net.ledger.s.sweeps });

const totalMoney = (net) => {
  let t = net.ledger.s.anchor.A;
  for (const b of Object.values(net.banks)) {
    t += b.controlGL + b.cbBalance;
    for (const c of b.customers.values()) t += c.ordinary;
  }
  return t;
};

export const ACTIONS = [
  ...[1, 2].flatMap((n) => ACCTS.flatMap((a) => [
    { name: `mint ${a} $${n}`, kind: 'legit', run: (net) => net.mint(a.split(':')[0], a.split(':')[1], dollars(n)) },
    { name: `redeem ${a} $${n}`, kind: 'legit', run: (net) => net.redeem(a.split(':')[0], a.split(':')[1], dollars(n)) },
    { name: `pay ${a}→other $${n}`, kind: 'legit', run: (net) => net.pay(a, ACCTS.find((x) => x !== a), dollars(n)) },
    { name: `pay-queued ${a}→other $${n}`, kind: 'legit', run: (net) => net.pay(a, ACCTS.find((x) => x !== a), dollars(n), { queue: true }) },
  ])),
  ...['MPL', 'NSR'].flatMap((i) => [
    { name: `fund ${i} $1`, kind: 'legit', run: (net) => net.fund(i, dollars(1)) },
    { name: `defund ${i} $1`, kind: 'legit', run: (net) => net.defund(i, dollars(1)) },
  ]),
  { name: 'net-cycle', kind: 'legit', run: (net) => net.netCycle() },
  // Escrow (T4) / PayOnEvent (T5): 'e1' cross-issuer, 'e2' same-issuer and event-gated. Fixed ids
  // reused at every explored state - re-locking an already-open id legitimately fails with
  // ESCROW_EXISTS, which S2 already checks leaves state unchanged, exactly like any other legit
  // action that happens not to apply from a given state.
  { name: 'escrow lock e1 (cross-issuer) $1', kind: 'legit', run: (net) => net.escrowLock('MPL:acme', 'NSR:cedar', 'e1', dollars(1), { expiresAt: net.now() + 60 }) },
  { name: 'escrow release e1', kind: 'legit', run: (net) => net.escrowRelease('e1') },
  { name: 'escrow refund e1', kind: 'legit', run: (net) => net.escrowRefund('e1') },
  { name: 'escrow lock e2 (same-issuer, event-gated) $1', kind: 'legit', run: (net) => net.escrowLock('MPL:acme', 'MPL:harbour', 'e2', dollars(1), { expiresAt: net.now() + 60, eventName: 'delivery' }) },
  { name: 'event-release e2 delivery (correct)', kind: 'legit', run: (net) => net.eventRelease('e2', 'delivery') },
  { name: 'ATTACK event-release e2 with the wrong oracle (inspection, not delivery)', kind: 'attack', run: (net) => net.eventRelease('e2', 'inspection') },
  { name: 'escrow refund e2', kind: 'legit', run: (net) => net.escrowRefund('e2') },
  // Standing/Sweep (T6): keep=$0 so any positive acme balance is swept, exercising the firing
  // path from as many reachable states as possible.
  { name: 'register sweep s1 (acme -> harbour, keep $0)', kind: 'legit', run: (net) => net.registerSweep('s1', 'MPL:acme', 'MPL:harbour', 0n) },
  { name: 'cancel sweep s1', kind: 'legit', run: (net) => net.cancelSweep('s1') },
  // Batch (T7): two independently-valid legs in one atomic instruction. Deliberately NOT a
  // mirrored pair ($1 then $2, not $1 then $1): a same-amount round trip would make the second
  // leg's settlement-position requirement always exactly satisfied by the first leg's own
  // cross-issuer contribution, which would hide an atomicity bug rather than exercise it (found
  // by hand while testing roadmap 2.2's planted "earlier leg not rolled back" mutation).
  {
    name: 'batch: pay acme->cedar $1, pay cedar->acme $2',
    kind: 'legit',
    run: (net) => net.batch([
      net.tx('PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(1).toString(), queueIfShort: false }, ['ops:MPL', 'screen:MPL', 'accept:NSR']),
      net.tx('PAYMENT', { from: 'NSR:cedar', to: 'MPL:acme', amount: dollars(2).toString(), queueIfShort: false }, ['ops:NSR', 'screen:NSR', 'accept:MPL']),
    ]),
  },
  { name: 'pause core', kind: 'env', run: (net) => net.setCorePaused(true) },
  { name: 'unpause core (drain)', kind: 'env', run: (net) => net.setCorePaused(false) },
  // adversarial actions: must always be rejected and must never change state
  { name: 'ATTACK forged signature', kind: 'attack', run: (net) => net.chaos('forged_sig') },
  { name: 'ATTACK unbacked mint', kind: 'attack', run: (net) => net.chaos('unbacked_mint') },
  { name: 'ATTACK overdraft', kind: 'attack', run: (net) => net.chaos('overdraft') },
  { name: 'ATTACK over cap', kind: 'attack', run: (net) => net.chaos('over_cap') },
];

export function modelCheck({ maxDepth = 6, maxStates = 40000, log = () => {} } = {}) {
  // A closed toy economy: two banks, one customer each, $4 of deposits and $4 of central-bank funds apiece,
  // nothing minted and no positions funded yet. Everything else has to be created by the actions below,
  // so the reachable state space is finite.
  const net = new Network({ bare: true });
  const kyc = net.now() + 10 * 365 * 86400;
  // 'harbour' at MPL exists only so a SAME-issuer Escrow/Sweep has a second account to move to -
  // it is not added to ACCTS, so it does not multiply the combinatorics of the existing actions.
  for (const [i, c] of [['MPL', 'acme'], ['MPL', 'harbour'], ['NSR', 'cedar']]) net.submit([net.tx('OPEN_ACCOUNT', { issuer: i, holderRef: c, kycRef: 'k', kycExpires: kyc }, [`ops:${i}`])]);
  for (const [i, c] of [['MPL', 'acme'], ['NSR', 'cedar']]) {
    net.banks[i].customer(c).ordinary = dollars(4);
    net.banks[i].cbBalance = dollars(4);
  }
  const initialMoney = totalMoney(net);
  const failures = [];
  const fail = (kind, trail, detail) => {
    if (failures.length < 5) failures.push({ kind, trail: [...trail], detail });
  };
  const seen = new Set();
  const start = snapshotAll(net);
  let frontier = [{ snap: start, trail: [] }];
  seen.add(key(net));
  let transitions = 0;
  let quiescent = 0;
  let maxSeenDepth = 0;
  let capped = false;

  const checkQuiescent = (trail) => {
    // drain the core, then everything must be consistent
    net.setCorePaused(false);
    net.pumpCore();
    const v = net.ledger.checkInvariants(net.ledger.s.time).violations;
    if (v.length || net.ledger.s.halt) fail('L1_LIVENESS', trail, `after draining the core: ${JSON.stringify(v)} halt=${net.ledger.s.halt && net.ledger.s.halt.reason}`);
    if (net.coreTasks.length) fail('L1_LIVENESS', trail, 'core backlog did not drain');
    for (const i of ['MPL', 'NSR']) {
      const S = net.ledger.supplyOf(i);
      if (S !== net.ledger.s.issuers.get(i).L) fail('S4_SUPPLY_EQ_CORE', trail, `${i}: supply ${S} vs core ${net.ledger.s.issuers.get(i).L}`);
    }
    if (totalMoney(net) !== initialMoney) fail('S5_MONEY_CONSERVED', trail, `total ${totalMoney(net)} vs initial ${initialMoney}`);
    quiescent++;
  };

  for (let depth = 0; depth < maxDepth && frontier.length && !capped; depth++) {
    const next = [];
    for (const node of frontier) {
      // L1 at every reachable state
      restoreAll(net, node.snap);
      checkQuiescent(node.trail);
      for (const act of ACTIONS) {
        restoreAll(net, node.snap);
        const before = coreState(net);
        const r = act.run(net);
        transitions++;
        const trail = [...node.trail, act.name];
        const viol = net.ledger.checkInvariants(net.ledger.s.time).violations;
        if (viol.length || net.ledger.s.halt) fail('S1_INVARIANT', trail, JSON.stringify(viol) + ' ' + (net.ledger.s.halt && net.ledger.s.halt.reason));
        if (act.kind === 'attack') {
          if (r.ok !== false) fail('S3_ATTACK_ACCEPTED', trail, JSON.stringify(r));
          if (coreState(net) !== before) fail('S3_ATTACK_CHANGED_STATE', trail, act.name);
        } else if (act.kind === 'legit' && r.ok === false && r.stage !== 'core' && r.stage !== 'central-bank') {
          // a rejection must leave the ledger untouched, except adapters' own follow-ups which pump separately
          if (coreState(net) !== before && !net.coreTasks.length) fail('S2_REJECTION_CHANGED_STATE', trail, JSON.stringify(r));
        }
        const k = key(net);
        if (!seen.has(k)) {
          seen.add(k);
          if (seen.size > maxStates) {
            capped = true;
            break;
          }
          next.push({ snap: snapshotAll(net), trail });
          maxSeenDepth = depth + 1;
        }
      }
      if (capped) break;
      if (failures.length >= 5) break;
    }
    log(`depth ${depth + 1}: ${next.length} new states, ${seen.size} total, ${transitions} transitions`);
    frontier = next;
    if (failures.length >= 5) break;
  }
  return { states: seen.size, transitions, quiescentChecks: quiescent, depthReached: maxSeenDepth, exhausted: frontier.length === 0 && !capped, capped, failures, actions: ACTIONS.length };
}

if (process.argv[1] && process.argv[1].endsWith('modelcheck.js')) {
  const depth = Number(process.argv[2]) || 6;
  const t0 = Date.now();
  const r = modelCheck({ maxDepth: depth, log: console.log });
  console.log(JSON.stringify({ ...r, seconds: +((Date.now() - t0) / 1000).toFixed(1) }, null, 2));
  process.exit(r.failures.length ? 1 : 0);
}
