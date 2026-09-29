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
//            S6  delegation soundness (roadmap 6.3), checked by an ORACLE that shares no code with the kernel:
//                (a) every accepted agent-signed instruction was inside its grant's envelope, in the state
//                    BEFORE it ran, counting revocation/expiry of every ancestor (topology is fixed by the model);
//                (b) every grant in every reachable state narrows its parent on every field;
//                (c) a revoked grant is never un-revoked; (d) the recorded caller of an accepted agent-signed
//                    instruction is the grant, not a label. (A rejected instruction leaving a window counter
//                    behind is caught by S2, because grants are part of the compared state.)
//   LIVENESS L1  from EVERY reachable state, letting the core drain its backlog reaches a quiescent state
//                where every invariant holds (no state is a dead end, including "slow core" states)
//
// State space is finite because amounts are small ($1 and $2 steps against fixed balances). A visited-set
// keyed on the canonical state prunes revisits, so depth can be large. This is a bounded check: it proves
// nothing about states beyond the bound or amounts outside the alphabet. It is a much stronger test than
// sampling, and it is what TLC would do on a TLA+ model if a Java runtime were available.

import { Network, dollars } from './network.js';
import { canon, genKey } from './crypto.js';

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
    grants: [...net.ledger.s.grants].map(([k, v]) => [k, v.revoked, v.win.spent]),
  });
}
// state as the safety properties see it (no ids)
const coreState = (net) => canon({ a: net.ledger.s.accounts, i: net.ledger.s.issuers, an: net.ledger.s.anchor, q: net.ledger.s.queue, e: net.ledger.s.escrows, sw: net.ledger.s.sweeps, g: net.ledger.s.grants });

const totalMoney = (net) => {
  let t = net.ledger.s.anchor.A;
  for (const b of Object.values(net.banks)) {
    t += b.controlGL + b.cbBalance;
    for (const c of b.customers.values()) t += c.ordinary;
  }
  return t;
};

// ---- delegation (roadmap 6.3). Fixed topology and fixed keys, so a state restored from a snapshot can
// always sign for the grants it contains. g1: root, MPL, may TRANSFER/PAYMENT and sub-delegate, max $2 per
// instruction and $2 per window. g2: sub-grant of g1, TRANSFER only, $1 / $2. g3 only ever appears in
// attacks. The amounts are chosen so a numeric-vs-lexicographic comparison bug is reachable: "1000" <= "200".
const GK = { g1: genKey(), g2: genKey(), g3: genKey() };
const TOPO = { g1: null, g2: 'g1', g3: 'g1' };
const SWEEP_OWNER = { s9: 'g1' }; // the sweep only g1's agent ever registers (the institution's own is s1)
const G1 = { grantId: 'g1', issuer: 'MPL', label: 'model agent', allowTypes: ['TRANSFER', 'PAYMENT', 'GRANT', 'REGISTER_SWEEP'], perInstructionMax: dollars(2), window: { seconds: 86400, maxTotal: dollars(2) }, key: GK.g1 };
const G2 = { grantId: 'g2', issuer: 'MPL', label: 'sub agent', parent: 'g1', allowTypes: ['TRANSFER'], perInstructionMax: dollars(1), window: { seconds: 86400, maxTotal: dollars(2) }, key: GK.g2 };
const agentXfer = (net, gid, amt, opts) => net.submitSigned(net.agentTx(gid, 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(amt).toString() }, ['screen:MPL'], opts));
const agentPay = (net, gid, amt) => net.submitSigned(net.agentTx(gid, 'PAYMENT', { from: 'MPL:acme', to: 'NSR:cedar', amount: dollars(amt).toString(), queueIfShort: false }, ['screen:MPL', 'accept:NSR']));

export const DELEGATION_ACTIONS = [
  { name: 'grant g1 (MPL: TRANSFER/PAYMENT/GRANT, max $2, cap $2)', kind: 'legit', run: (net) => net.grantAgent(G1) },
  { name: 'sub-grant g2 under g1 (TRANSFER, max $1, cap $2)', kind: 'legit', run: (net) => net.grantAgent(G2) },
  { name: 'revoke g1 (institution)', kind: 'legit', run: (net) => net.revokeGrant('g1') },
  { name: 'revoke g2 (by its parent g1)', kind: 'legit', run: (net) => net.revokeGrant('g2', { by: 'g1' }) },
  { name: 'agent g1 transfer acme->harbour $1', kind: 'legit', run: (net) => agentXfer(net, 'g1', 1) },
  { name: 'agent g1 transfer acme->harbour $2', kind: 'legit', run: (net) => agentXfer(net, 'g1', 2) },
  { name: 'agent g1 pay acme->cedar $1', kind: 'legit', run: (net) => agentPay(net, 'g1', 1) },
  { name: 'agent g2 transfer acme->harbour $1', kind: 'legit', run: (net) => agentXfer(net, 'g2', 1) },
  { name: 'agent g1 transfer $3 co-signed by the institution (escalation)', kind: 'legit', run: (net) => agentXfer(net, 'g1', 3, { escalate: true }) },
  // roadmap 7.1: a sweep under g1 (keep $0, so it wants to move everything) - bounded by g1's headroom, suspended if g1 dies
  { name: 'agent g1 registers sweep s9 (acme -> harbour, keep $0)', kind: 'legit', run: (net) => net.submitSigned(net.agentTx('g1', 'REGISTER_SWEEP', { sweepId: 's9', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: '0' }, [])) },
  // roadmap 7.2: a batch of one grant's legs is fine; one that mixes callers must always be refused
  { name: 'batch: two g1 transfers $1', kind: 'legit', run: (net) => net.submitSigned(net.tx('BATCH', { legs: [net.agentTx('g1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['screen:MPL']), net.agentTx('g1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['screen:MPL'])] }, [])) },
  { name: 'ATTACK batch mixing a g1 leg with an institution-signed leg', kind: 'attack', run: (net) => net.submitSigned(net.tx('BATCH', { legs: [net.agentTx('g1', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['screen:MPL']), net.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['ops:MPL', 'screen:MPL'])] }, [])) },
  { name: 'ATTACK agent g1 transfer $3 WITHOUT the institution co-signature', kind: 'attack', run: (net) => agentXfer(net, 'g1', 3) },
  { name: 'ATTACK agent g2 signs a PAYMENT (not in its allow_types)', kind: 'attack', run: (net) => agentPay(net, 'g2', 1) },
  { name: 'ATTACK sub-grant g3 under g1 widening max to $10', kind: 'attack', run: (net) => net.grantAgent({ ...G2, grantId: 'g3', key: GK.g3, allowTypes: ['TRANSFER'], perInstructionMax: dollars(10) }) },
  { name: 'ATTACK sub-grant g3 under g1 adding ESCROW_LOCK', kind: 'attack', run: (net) => net.grantAgent({ ...G2, grantId: 'g3', key: GK.g3, allowTypes: ['TRANSFER', 'ESCROW_LOCK'] }) },
];

// The S6 oracle. Deliberately re-derives the rules from the spec in docs/agent-native-access-proposal.md
// instead of calling the kernel, so a kernel bug cannot hide behind itself.
const AMOUNT_TYPES = new Set(['TRANSFER', 'PAYMENT', 'ESCROW_LOCK']);
function checkDelegation(pre, net) {
  const out = [];
  const post = net.ledger.s;
  for (const [id, g] of post.grants) {
    const par = TOPO[id];
    if ((g.parent || null) !== par) out.push(`${id} is stored with parent ${g.parent}, the model's topology says ${par}`);
    if (par) {
      const p = post.grants.get(par);
      if (!p) out.push(`${id} exists without its parent ${par}`);
      else {
        const narrows = g.issuer === p.issuer && g.allow_types.every((t) => p.allow_types.includes(t)) && g.per_instruction_max <= p.per_instruction_max && g.window.max_total <= p.window.max_total && g.not_after <= p.not_after && (p.counterparties === null || (g.counterparties !== null && g.counterparties.every((a) => p.counterparties.includes(a))));
        if (!narrows) out.push(`${id} is wider than its parent ${par}`);
      }
    }
    const before = pre.grants.get(id);
    if (before && before.revoked && !g.revoked) out.push(`${id} was un-revoked`);
  }
  // Walk this action's blocks in order. `used` is what THIS action has already charged to each grant window
  // (instructions, batch legs and sweep firings alike), on top of the pre-state window, so a second leg or a
  // firing is judged against what the first one left, computed here and not read back from the kernel.
  const used = new Map();
  const spentAt = (l, time) => (l.win.spent === 0n || time >= l.win.start + l.window.seconds ? 0n : l.win.spent) + (used.get(l.id) || 0n);
  const chainOf = (gid) => {
    const chain = [];
    for (let c = gid; c; c = TOPO[c]) chain.push(pre.grants.get(c));
    return chain;
  };
  const isLive = (chain, time) => chain.every((c) => c && !c.revoked && time <= c.not_after);
  // a grant chain is also dead in the model if the ACTION itself revoked something in it (revocations are monotone
  // and the only revoking instruction of an action is its first block, so the final state is the state at end-of-block)
  const deadInPost = (gid) => {
    for (let c = gid; c; c = TOPO[c]) {
      const g = post.grants.get(c);
      if (!g || g.revoked) return true;
    }
    return false;
  };
  const effectiveCaller = (leg) => {
    const role = Object.keys(leg.sigs || {}).find((r) => r.startsWith('agent:'));
    if (role) return { kind: 'agent', grant_id: role.slice(6), label: (pre.grants.get(role.slice(6)) || {}).label };
    return leg.caller && typeof leg.caller === 'object' ? leg.caller : { kind: 'unspecified' };
  };
  const checkAgentTx = (tx, time, resultCaller, isLeg) => {
    const role = Object.keys(tx.sigs || {}).find((r) => r.startsWith('agent:'));
    if (!role) return;
    const gid = role.slice(6);
    const chain = chainOf(gid);
    if (tx.type === 'REVOKE_GRANT') {
      let anc = false;
      for (let c = TOPO[tx.payload.grant_id]; c; c = TOPO[c]) if (c === gid) anc = true;
      if (!anc || !isLive(chain, time)) out.push(`${gid} revoked ${tx.payload.grant_id} but is not a live ancestor`);
      return;
    }
    const leaf = chain[0];
    if (!isLive(chain, time)) return out.push(`accepted ${tx.type} under dead grant ${gid} (revoked, expired or ancestor gone)`);
    if (!leaf.allow_types.includes(tx.type)) out.push(`accepted ${tx.type} outside ${gid}'s allow_types`);
    if (!isLeg) {
      const c = resultCaller;
      if (!c || c.kind !== 'agent' || c.grant_id !== gid) out.push(`accepted ${tx.type} under ${gid} but recorded caller ${JSON.stringify(c)}`);
    }
    if (!AMOUNT_TYPES.has(tx.type)) return;
    if (tx.sigs[`ops:${leaf.issuer}`]) return; // institution co-signed: escalated, outside the envelope by design, and not charged
    const amt = BigInt(tx.payload.amount);
    if (amt > leaf.per_instruction_max) out.push(`accepted ${amt} cents under ${gid} above its per-instruction max without the institution signature`);
    for (const l of chain) {
      if (spentAt(l, time) + amt > l.window.max_total) out.push(`accepted ${amt} cents under ${gid}, over ${l.id}'s window cap, without the institution signature`);
      used.set(l.id, (used.get(l.id) || 0n) + amt);
    }
  };
  net.log.forEach((entry, i) => {
    const blk = net.blocks[i];
    const time = blk.header.time;
    entry.txs.forEach((tx, k) => {
      const res = blk.results[k];
      if (!res.ok) return;
      if (tx.type === 'BATCH') {
        // roadmap 7.2: an accepted batch's legs share ONE effective caller, and that is the batch's caller
        const callers = tx.payload.legs.map((l) => JSON.stringify(effectiveCaller(l)));
        if (!callers.every((c) => c === callers[0])) out.push('accepted a batch whose legs have different effective callers');
        else if (JSON.stringify(res.caller) !== callers[0] && JSON.stringify({ kind: res.caller.kind, grant_id: res.caller.grant_id, label: res.caller.label }) !== callers[0]) out.push(`batch reports caller ${JSON.stringify(res.caller)}, its legs share ${callers[0]}`);
        for (const leg of tx.payload.legs) checkAgentTx(leg, time, null, true);
        return;
      }
      checkAgentTx(tx, time, res.caller, false);
    });
    // roadmap 7.1: sweep firings. In this model a sweep with id s9 is only ever registered by g1's agent action
    // (the institution's own sweep is s1), so its owner is known from the model, not read from the kernel's record.
    for (const f of blk.sweepFires || []) {
      const owner = SWEEP_OWNER[f.sweepId];
      if (!owner || BigInt(f.amount) === 0n) continue;
      const a = BigInt(f.amount);
      const chain = chainOf(owner);
      if (deadInPost(owner)) out.push(`sweep ${f.sweepId} moved ${a} cents although grant ${owner}'s chain is dead`);
      const leaf = chain[0];
      if (leaf && a > leaf.per_instruction_max) out.push(`sweep ${f.sweepId} moved ${a} cents, above ${owner}'s per-instruction max`);
      for (const l of chain) {
        if (!l) continue;
        if (spentAt(l, time) + a > l.window.max_total) out.push(`sweep ${f.sweepId} moved ${a} cents, over ${l.id}'s window cap`);
        used.set(l.id, (used.get(l.id) || 0n) + a);
      }
    }
  });
  return out;
}

export const BASE_ACTIONS = [
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
  // External-CSD DvP (roadmap 4.2): a correctly-configured composition of Escrow + PayOnEvent
  // under a dedicated oracle - reuses the mechanism the escrow/event-release actions above
  // already exercise in isolation, but not yet in COMBINATION with sweeps, batches and attacks
  // reachable from the same states. 'csd1' is a separate id from 'e1'/'e2', so no collision.
  { name: 'external-CSD DvP lock csd1 (acme -> cedar) $1', kind: 'legit', run: (net) => net.externalCsdDvp('MPL:acme', 'NSR:cedar', 'csd1', dollars(1), { deadlineSeconds: 60 }) },
  { name: 'csd confirm csd1 (correct oracle)', kind: 'legit', run: (net) => net.csdConfirm('csd1') },
  { name: 'ATTACK csd confirm csd1 with the delivery oracle', kind: 'attack', run: (net) => net.eventRelease('csd1', 'delivery') },
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

// Everything, delegation included. Not the default: at 53 actions the routine state cap is reached at
// depth 5, so a default run would silently explore less of the ORIGINAL model than before. Use it for
// one-off deep runs (`node src/modelcheck.js 5 all`); the routine tests run BASE_ACTIONS and, separately,
// the focused DELEGATION_MODEL below.
export const ACTIONS = [...BASE_ACTIONS, ...DELEGATION_ACTIONS];

// A small alphabet for the delegation properties alone: funding, the grant lifecycle and agent
// instructions. Keeps the reachable space small enough to search deep (a delegation counterexample
// needs mint, mint, grant, sub-grant, revoke, use = six steps), which the full alphabet's state cap cannot.
export const DELEGATION_MODEL = [...BASE_ACTIONS.filter((a) => /^(mint MPL:acme|fund MPL)/.test(a.name)), ...DELEGATION_ACTIONS];

export function modelCheck({ maxDepth = 6, maxStates = 40000, log = () => {}, actions = BASE_ACTIONS } = {}) {
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
  Object.assign(net.agentKeys, GK); // agent keys are part of the model, not of any one state
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
      for (const act of actions) {
        restoreAll(net, node.snap);
        const before = coreState(net);
        const r = act.run(net);
        transitions++;
        const trail = [...node.trail, act.name];
        for (const d of checkDelegation(node.snap.s, net)) fail('S6_DELEGATION', trail, d);
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
  return { states: seen.size, transitions, quiescentChecks: quiescent, depthReached: maxSeenDepth, exhausted: frontier.length === 0 && !capped, capped, failures, actions: actions.length };
}

if (process.argv[1] && process.argv[1].endsWith('modelcheck.js')) {
  const depth = Number(process.argv[2]) || 6;
  const t0 = Date.now();
  const r = modelCheck({ maxDepth: depth, log: console.log, actions: process.argv[3] === 'all' ? ACTIONS : process.argv[3] === 'delegation' ? DELEGATION_MODEL : BASE_ACTIONS });
  console.log(JSON.stringify({ ...r, seconds: +((Date.now() - t0) / 1000).toFixed(1) }, null, 2));
  process.exit(r.failures.length ? 1 : 0);
}
