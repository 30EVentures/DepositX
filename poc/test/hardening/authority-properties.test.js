// Phase 1.7 (properties on the kernel): money in canonical integer minor units; authority only narrows; revocation and
// expiry are checked when an instruction is ENFORCED; a sweep never moves money where a manual transfer would be refused.
// Seeded generators with an independent oracle, so a failure reproduces exactly and the kernel is not its own judge.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';
import { GRANTABLE_TYPES } from '../../src/kernel.js';

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

// ------------------------------------------------------------------ money: canonical integer minor units
const CANON = /^[1-9][0-9]{0,17}$/;
function junkOrCanon(r) {
  const k = int(r, 0, 14);
  const digits = (n) => Array.from({ length: n }, () => int(r, 0, 9)).join('');
  switch (k) {
    case 0: return String(int(r, 1, 99999));
    case 1: return '0' + String(int(r, 1, 999));
    case 2: return String(int(r, 1, 999)) + '.' + digits(2);
    case 3: return '-' + String(int(r, 1, 999));
    case 4: return ' ' + String(int(r, 1, 999));
    case 5: return String(int(r, 1, 999)) + 'e3';
    case 6: return digits(19).replace(/^0/, '1');
    case 7: return digits(18).replace(/^0/, '7');
    case 8: return int(r, 1, 99999); // a JS number
    case 9: return BigInt(int(r, 1, 999));
    case 10: return '';
    case 11: return '+' + int(r, 1, 999);
    case 12: return String(int(r, 1, 999)) + '٠'; // arabic-indic digit
    case 13: return '0';
    default: return String(int(r, 1, 9)) + digits(int(r, 0, 8));
  }
}
test('PROPERTY: an amount is refused as BAD_AMOUNT exactly when it is not a canonical positive integer string (600 random)', () => {
  const r = rng(101); const n = new Network();
  let canon = 0, junk = 0;
  for (let i = 0; i < 600; i++) {
    const amount = junkOrCanon(r);
    const t = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount }, ['ops:MPL', 'screen:MPL']);
    const res = n.submitSigned(t);
    const isCanon = typeof amount === 'string' && CANON.test(amount);
    if (isCanon) { canon++; assert.notEqual(res.error, 'BAD_AMOUNT', String(amount)); } else { junk++; assert.equal(res.error, 'BAD_AMOUNT', `${typeof amount} ${String(amount)}`); }
  }
  assert.ok(canon > 100 && junk > 250, `${canon}/${junk}`);
  assert.deepEqual(n.ledger.checkInvariants(n.ledger.s.time).violations, []);
});
test('PROPERTY: the same rule holds for every amount field a grant carries (per-instruction max and window cap)', () => {
  const r = rng(102);
  for (let i = 0; i < 200; i++) {
    const n = new Network();
    const max = junkOrCanon(r), cap = junkOrCanon(r);
    const tx = n.grantTx({ grantId: 'g1', issuer: 'MPL', label: 'x', allowTypes: ['TRANSFER'], perInstructionMax: dollars(1), window: { seconds: 3600, maxTotal: dollars(10) }, counterparties: null, notAfter: null }).tx;
    const payload = JSON.parse(JSON.stringify(tx.payload)); payload.per_instruction_max = typeof max === 'bigint' ? max : max; payload.window.max_total = cap;
    const t = n.tx('GRANT', JSON.parse(JSON.stringify(payload, (k, v) => (typeof v === 'bigint' ? Number(v) : v))), ['ops:MPL']);
    const res = n.submitSigned(t);
    const okMax = typeof max === 'string' && CANON.test(max), okCap = typeof cap === 'string' && CANON.test(cap);
    if (okMax && okCap) assert.equal(res.ok, true, `${max} ${cap}: ${res.error}`); else assert.equal(res.ok, false, `${String(max)} ${String(cap)}`);
  }
});

// ------------------------------------------------------------------ authority only narrows
test('PROPERTY: a sub-grant is accepted exactly when it narrows its parent in every dimension (400 random envelopes)', () => {
  const r = rng(103);
  const now0 = new Network().now();
  const parent = { types: ['TRANSFER', 'PAYMENT', 'GRANT'], max: 1000, cap: 5000, notAfter: now0 + 7 * 86400, cps: null };
  const CP = ['MPL:acme', 'MPL:harbour', 'NSR:cedar', 'NSR:pinnacle', 'LKS:elm'];
  let accepted = 0, refused = 0;
  for (let i = 0; i < 400; i++) {
    const n = new Network();
    const parentCps = r() < 0.5 ? null : CP.slice(0, int(r, 2, 4));
    assert.ok(n.grantAgent({ grantId: 'root', issuer: 'MPL', label: 'p', allowTypes: parent.types, perInstructionMax: dollars(parent.max), window: { seconds: 86400, maxTotal: dollars(parent.cap) }, counterparties: parentCps, notAfter: parent.notAfter }).ok);
    // biased so both outcomes are common: usually inside the parent, sometimes one dimension too wide
    const types = [...new Set(Array.from({ length: int(r, 1, 3) }, () => pick(r, r() < 0.8 ? parent.types : GRANTABLE_TYPES)))];
    const max = r() < 0.8 ? int(r, 1, 1000) : int(r, 1, 1400), cap = r() < 0.8 ? int(r, 1, 5000) : int(r, 1, 7000);
    const notAfter = parent.notAfter - (r() < 0.8 ? int(r, 1, 5) * 3600 : -int(r, 1, 3) * 3600);
    const cps = parentCps && r() < 0.7 ? parentCps.slice(0, int(r, 1, parentCps.length)) : r() < 0.4 ? null : CP.slice(int(r, 0, 2), int(r, 3, 5));
    const narrows = types.every((t) => parent.types.includes(t))
      && dollars(max) <= dollars(parent.max) && dollars(cap) <= dollars(parent.cap)
      && notAfter <= parent.notAfter && notAfter > n.now()
      && (parentCps === null || (cps !== null && cps.every((a) => parentCps.includes(a))));
    const res = n.grantAgent({ grantId: 'kid', parent: 'root', issuer: 'MPL', label: 'c', allowTypes: types, perInstructionMax: dollars(max), window: { seconds: 3600, maxTotal: dollars(cap) }, counterparties: cps, notAfter });
    assert.equal(res.ok, narrows, `types=${types} max=${max} cap=${cap} dNotAfter=${notAfter - parent.notAfter} cps=${cps} parentCps=${parentCps} -> ${res.error}`);
    if (!narrows) { assert.ok(['GRANT_WIDENS_PARENT', 'GRANT_BAD_COUNTERPARTIES'].includes(res.error), res.error); assert.equal(n.ledger.s.grants.has('kid'), false); refused++; } else accepted++;
  }
  assert.ok(accepted > 30 && refused > 100, `${accepted} accepted, ${refused} refused`);
});

// ------------------------------------------------------------------ revocation and expiry are checked at enforcement time
test('PROPERTY: an agent instruction is accepted exactly when every grant in its chain is unrevoked and unexpired at that moment (random walks)', () => {
  let totalAccepted = 0, totalRefused = 0;
  for (const seed of [201, 202, 203, 204, 205, 206]) {
    const r = rng(seed); const n = new Network();
    const ids = []; const parentOf = new Map(); const notAfter = new Map();
    const make = (id, parent) => {
      const na = parent ? Math.min(notAfter.get(parent), n.now() + int(r, 300, 4000)) : n.now() + int(r, 600, 5000);
      const res = n.grantAgent({ grantId: id, parent, issuer: 'MPL', label: id, allowTypes: ['TRANSFER', 'GRANT'], perInstructionMax: dollars(500), window: { seconds: 86400, maxTotal: dollars(100_000) }, counterparties: null, notAfter: na });
      assert.ok(res.ok, `${id}: ${res.error}`); ids.push(id); parentOf.set(id, parent ?? null); notAfter.set(id, na);
    };
    make('r0'); make('r1');
    const depth = (id) => { let d = 1; for (let c = parentOf.get(id); c; c = parentOf.get(c)) d++; return d; };
    for (let i = 2; i < 9; i++) make(`g${i}`, pick(r, ids.filter((x) => depth(x) < 4))); // the kernel's own limit is five levels
    const revoked = new Set();
    const chainLive = (id) => { for (let c = id; c; c = parentOf.get(c)) { if (revoked.has(c) || n.now() > notAfter.get(c)) return false; } return true; };
    let accepted = 0, refused = 0;
    for (let step = 0; step < 90; step++) {
      const op = r();
      if (op < 0.7) {
        const id = pick(r, ids);
        const live = chainLive(id);
        const res = n.submitSigned(n.agentTx(id, 'TRANSFER', { from: 'MPL:acme', to: 'MPL:spareX'.replace('spareX', 'harbour'), amount: dollars(1).toString() }, ['screen:MPL']));
        if (live) { assert.equal(res.ok, true, `seed ${seed} step ${step}: ${id} should be live: ${res.error} ${res.message}`); accepted++; }
        else { assert.equal(res.ok, false, `seed ${seed} step ${step}: ${id} should be dead`); assert.ok(['GRANT_REVOKED', 'GRANT_EXPIRED'].includes(res.error), res.error); refused++; }
      } else if (op < 0.8) {
        const id = pick(r, ids);
        if (!revoked.has(id)) { assert.ok(n.revokeGrant(id).ok); revoked.add(id); }
      } else n.advance(int(r, 20, 240));
    }
    totalAccepted += accepted; totalRefused += refused;
    assert.deepEqual(n.ledger.checkInvariants(n.ledger.s.time).violations, []);
  }
  assert.ok(totalAccepted > 30 && totalRefused > 30, `both outcomes must be common: ${totalAccepted} accepted, ${totalRefused} refused`);
});

test('PROPERTY: revoking any ancestor kills every descendant at once, and reviving is impossible (no un-revoke)', () => {
  const r = rng(210); const n = new Network();
  const ids = ['a']; assert.ok(n.grantAgent({ grantId: 'a', issuer: 'MPL', label: 'a', allowTypes: ['TRANSFER', 'GRANT'], perInstructionMax: dollars(500), window: { seconds: 86400, maxTotal: dollars(1e5) }, counterparties: null, notAfter: null }).ok);
  const parent = new Map([['a', null]]);
  for (const id of ['b', 'c', 'd', 'e']) { const p = pick(r, ids); assert.ok(n.grantAgent({ grantId: id, parent: p, issuer: 'MPL', label: id, allowTypes: ['TRANSFER'].concat(id < 'e' ? ['GRANT'] : []), perInstructionMax: dollars(100), window: { seconds: 86400, maxTotal: dollars(1e4) }, counterparties: null, notAfter: null }).ok, id); ids.push(id); parent.set(id, p); }
  const victim = pick(r, ids.slice(0, 4));
  assert.ok(n.revokeGrant(victim).ok);
  const under = (id) => { for (let c = id; c; c = parent.get(c)) if (c === victim) return true; return false; };
  for (const id of ids) {
    const res = n.submitSigned(n.agentTx(id, 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(1).toString() }, ['screen:MPL']));
    assert.equal(res.ok, !under(id), `${id} (victim ${victim})`);
  }
  assert.equal(n.revokeGrant(victim).ok, false, 'a second revoke is refused; nothing un-revokes');
});

// ------------------------------------------------------------------ a sweep is gated like a manual transfer
test('PROPERTY: over 6 random walks of freezes, quarantines and halts, a sweep moves money only where a manual transfer would be allowed', () => {
  for (const seed of [301, 302, 303, 304, 305, 306]) {
    const r = rng(seed); const n = new Network();
    const SRC = 'MPL:acme', DST = 'MPL:harbour';
    n.submit([n.tx('OPEN_ACCOUNT', { issuer: 'MPL', holderRef: 'spare', kycRef: 'k', kycExpires: n.now() + 1e7 }, ['ops:MPL'])]);
    const keep = n.ledger.s.accounts.get(SRC).balance - dollars(1000);
    assert.ok(n.registerSweep('sw', SRC, DST, keep).ok);
    const frozen = new Set(); let quarantined = false; let halted = false; let moved = 0, held = 0;
    const bal = () => n.ledger.s.accounts.get(SRC).balance;
    for (let step = 0; step < 40; step++) {
      const op = r();
      if (op < 0.2) { const a = pick(r, [SRC, DST]); if (!frozen.has(a)) { n.submit([n.tx('FREEZE_ACCOUNT', { account: a }, ['ops:MPL'])]); frozen.add(a); } }
      else if (op < 0.4) { const a = pick(r, [SRC, DST]); if (frozen.has(a)) { n.submit([n.tx('UNFREEZE_ACCOUNT', { account: a }, ['ops:MPL'])]); frozen.delete(a); } }
      else if (op < 0.5 && !quarantined && !halted) { n.chaos('fire_alarm', { issuer: 'MPL' }); quarantined = true; }
      else if (op < 0.6 && quarantined && !halted) { const rs = n.resume('issuer', 'MPL'); if (rs.ok) quarantined = false; }
      else if (op < 0.66 && !halted) { n.chaos('inflate'); halted = true; }
      else if (op < 0.72 && halted) { n.chaos('repair'); if (n.resume('network').ok) halted = false; }
      // re-arm: put an excess over the keep amount in the source, whatever state things are in, then run one more block
      n.ledger.unsafeMutate((s) => { s.accounts.get(SRC).balance = keep + dollars(1000); s.accounts.get(DST).balance = s.accounts.get(DST).balance; });
      const before = bal();
      const blockedByState = frozen.has(SRC) || frozen.has(DST) || quarantined || halted;
      n.heartbeat();
      const after = bal();
      if (blockedByState) { held++; assert.equal(after, before, `seed ${seed} step ${step}: a sweep moved money while frozen=${[...frozen]} quarantined=${quarantined} halted=${halted}`); }
      else moved += after < before ? 1 : 0;
    }
    assert.ok(held > 5, `seed ${seed}: the walk must spend time in blocked states (${held})`);
  }
});
