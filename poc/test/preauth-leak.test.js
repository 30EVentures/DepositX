// Hardening X1: no pre-authentication information leak through error codes.
//
// POST /api/submit (Network.submitSigned) is callable by anyone. Before this fix the kernel resolved
// accounts / escrows / sweeps / grants BEFORE it verified a signature, so an unauthenticated caller could
// learn from the error code alone whether an account exists, whether it is frozen or KYC-expired, which
// grant ids exist and which issuer owns them, and so on.
//
// Group 1 (indistinguishability): for every affected instruction type, a bad / missing / partly-valid
// signature gets the IDENTICAL result (error, message, retryable, remedy) whatever the target's state.
// Group 2 (regression): once the signer IS authenticated the specific errors are exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../src/network.js';
import { genKey } from '../src/crypto.js';

const pick = (r, gid) => ({ ok: r.ok, error: r.error, message: gid ? String(r.message).replaceAll(gid, '<grant>') : r.message, retryable: r.retryable, remedy: r.remedy });
const must = (r, what) => assert.ok(r.ok, `${what}: ${r.error} ${r.message}`);

// One shared world holding every kind of target an attacker might probe.
function world() {
  const n = new Network();
  const now = n.now();
  const open = (holderRef, kycExpires = now + 1e8) => must(n.submitSigned(n.tx('OPEN_ACCOUNT', { issuer: holderRef.startsWith('n') ? 'NSR' : 'MPL', holderRef, kycRef: 'k', kycExpires }, [holderRef.startsWith('n') ? 'ops:NSR' : 'ops:MPL'])), `open ${holderRef}`);
  open('stale', now - 10); // KYC expired
  open('frozen');
  open('nfrozen');
  open('nstale', now - 10);
  must(n.submitSigned(n.tx('FREEZE_ACCOUNT', { account: 'MPL:frozen' }, ['ops:MPL'])), 'freeze');
  must(n.submitSigned(n.tx('FREEZE_ACCOUNT', { account: 'NSR:nfrozen' }, ['ops:NSR'])), 'freeze n');
  const grant = (grantId, issuer, o = {}) => must(n.grantAgent({ grantId, issuer, label: grantId, allowTypes: ['TRANSFER', 'PAYMENT', 'ESCROW_LOCK', 'ESCROW_REFUND', 'REGISTER_SWEEP', 'CANCEL_SWEEP', 'GRANT'], perInstructionMax: dollars(10_000), window: { seconds: 86400, maxTotal: dollars(100_000) }, ...o }), `grant ${grantId}`);
  grant('g-mpl', 'MPL');
  grant('g-child', 'MPL', { parent: 'g-mpl' });
  grant('g-other', 'MPL'); // a live grant that is NOT an ancestor of g-child
  grant('g-nsr', 'NSR');
  grant('g-rev', 'MPL');
  must(n.revokeGrant('g-rev'), 'revoke');
  const lock = (escrowId, from, to, o = {}) => {
    const cross = from.slice(0, 3) !== to.slice(0, 3);
    return must(n.submitSigned(n.tx('ESCROW_LOCK', { escrowId, from, to, amount: '100', expiresAt: now + 3600, ...o }, ['ops:MPL', 'screen:MPL', ...(cross ? [`accept:${to.slice(0, 3)}`] : [])])), `lock ${escrowId}`);
  };
  lock('e-live', 'MPL:acme', 'NSR:cedar');
  lock('e-same', 'MPL:acme', 'MPL:harbour');
  lock('e-gated', 'MPL:acme', 'NSR:cedar', { eventName: 'delivery' });
  lock('e-short', 'MPL:acme', 'MPL:harbour', { expiresAt: now + 3 });
  must(n.submitSigned(n.tx('REGISTER_SWEEP', { sweepId: 'sw-live', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: '99999999999' }, ['ops:MPL'])), 'sweep');
  n.clockOffset += 10; // e-short is now past its expiry
  return n;
}

const wrong = () => genKey().priv;
// Signature states the caller can present. `valid` roles are signed correctly, the rest are bad or absent.
function build(n, type, payload, roles, mode) {
  const bad = (rs) => Object.fromEntries(rs.map((r) => [r, wrong()]));
  switch (mode) {
    case 'missing': return n.tx(type, payload, []);
    case 'allBad': return n.tx(type, payload, roles, { keyOverride: bad(roles) });
    case 'firstOkRestMissing': return n.tx(type, payload, [roles[0]]);
    case 'firstBadRestOk': return n.tx(type, payload, roles, { keyOverride: bad([roles[0]]) });
    default: throw new Error(mode);
  }
}
const canSign = (n, role) => { try { n.sk(role); return true; } catch { return false; } };

// cases: { ref, others: {label: payload}, roles }. Every payload must yield the reference's result.
function indistinguishable(name, type, roles, ref, others, modes = ['missing', 'allBad', 'firstOkRestMissing', 'firstBadRestOk']) {
  test(`pre-auth leak: ${name} (${type})`, () => {
    const n = world();
    for (const mode of modes) {
      if (roles.length < 2 && (mode === 'firstOkRestMissing' || mode === 'firstBadRestOk')) continue;
      if ((mode === 'firstOkRestMissing') && !canSign(n, roles[0])) continue;
      const base = pick(n.submitSigned(build(n, type, ref, roles, mode)));
      assert.equal(base.ok, false);
      for (const [label, payload] of Object.entries(others)) {
        const got = pick(n.submitSigned(build(n, type, payload, roles, mode)));
        assert.deepEqual(got, base, `${mode}: "${label}" is distinguishable from the reference`);
      }
    }
  });
}

const A = '100';
indistinguishable('transfer', 'TRANSFER', ['ops:MPL', 'screen:MPL'],
  { from: 'MPL:acme', to: 'MPL:harbour', amount: A },
  { 'ghost payer': { from: 'MPL:ghost', to: 'MPL:harbour', amount: A }, 'ghost payee': { from: 'MPL:acme', to: 'MPL:ghost', amount: A }, 'frozen payer': { from: 'MPL:frozen', to: 'MPL:harbour', amount: A }, 'frozen payee': { from: 'MPL:acme', to: 'MPL:frozen', amount: A }, 'kyc-expired payer': { from: 'MPL:stale', to: 'MPL:harbour', amount: A }, 'kyc-expired payee': { from: 'MPL:acme', to: 'MPL:stale', amount: A }, 'cross-issuer payee (exists)': { from: 'MPL:acme', to: 'NSR:cedar', amount: A }, 'cross-issuer payee (ghost)': { from: 'MPL:acme', to: 'NSR:ghost', amount: A }, 'self': { from: 'MPL:acme', to: 'MPL:acme', amount: A } });

indistinguishable('payment', 'PAYMENT', ['ops:MPL', 'screen:MPL', 'accept:NSR'],
  { from: 'MPL:acme', to: 'NSR:cedar', amount: A },
  { 'ghost payer': { from: 'MPL:ghost', to: 'NSR:cedar', amount: A }, 'ghost payee': { from: 'MPL:acme', to: 'NSR:ghost', amount: A }, 'frozen payer': { from: 'MPL:frozen', to: 'NSR:cedar', amount: A }, 'frozen payee': { from: 'MPL:acme', to: 'NSR:nfrozen', amount: A }, 'kyc-expired payer': { from: 'MPL:stale', to: 'NSR:cedar', amount: A }, 'kyc-expired payee': { from: 'MPL:acme', to: 'NSR:nstale', amount: A } });

indistinguishable('escrow lock', 'ESCROW_LOCK', ['ops:MPL', 'screen:MPL', 'accept:NSR'],
  { escrowId: 'e-new', from: 'MPL:acme', to: 'NSR:cedar', amount: A, expiresAt: 4_000_000_000 },
  { 'escrow id already used': { escrowId: 'e-live', from: 'MPL:acme', to: 'NSR:cedar', amount: A, expiresAt: 4_000_000_000 }, 'ghost payer': { escrowId: 'e-new', from: 'MPL:ghost', to: 'NSR:cedar', amount: A, expiresAt: 4_000_000_000 }, 'ghost payee': { escrowId: 'e-new', from: 'MPL:acme', to: 'NSR:ghost', amount: A, expiresAt: 4_000_000_000 }, 'frozen payer': { escrowId: 'e-new', from: 'MPL:frozen', to: 'NSR:cedar', amount: A, expiresAt: 4_000_000_000 }, 'release role is a live grant': { escrowId: 'e-new', from: 'MPL:acme', to: 'NSR:cedar', amount: A, expiresAt: 4_000_000_000, releaseRole: 'agent:g-mpl' }, 'release role is a ghost grant': { escrowId: 'e-new', from: 'MPL:acme', to: 'NSR:cedar', amount: A, expiresAt: 4_000_000_000, releaseRole: 'agent:g-ghost' } });

indistinguishable('escrow refund', 'ESCROW_REFUND', ['ops:MPL'],
  { escrowId: 'e-short' },
  { 'unknown escrow': { escrowId: 'e-ghost' }, 'live, not yet expired': { escrowId: 'e-live' }, 'cross-issuer, not expired': { escrowId: 'e-gated' } });

indistinguishable('escrow release', 'ESCROW_RELEASE', ['ops:MPL'],
  { escrowId: 'e-same' },
  { 'unknown escrow': { escrowId: 'e-ghost' }, 'event-gated escrow': { escrowId: 'e-gated' } });

indistinguishable('event release', 'EVENT_RELEASE', ['event:delivery'],
  { escrowId: 'e-gated', event: 'delivery' },
  { 'unknown escrow': { escrowId: 'e-ghost', event: 'delivery' }, 'not event-gated': { escrowId: 'e-same', event: 'delivery' } });

indistinguishable('register sweep', 'REGISTER_SWEEP', ['ops:MPL'],
  { sweepId: 'sw-new', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: '0' },
  { 'sweep id taken': { sweepId: 'sw-live', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: '0' }, 'ghost source': { sweepId: 'sw-new', from: 'MPL:ghost', to: 'MPL:harbour', keepAmount: '0' }, 'ghost target': { sweepId: 'sw-new', from: 'MPL:acme', to: 'MPL:ghost', keepAmount: '0' }, 'cross issuer target (exists)': { sweepId: 'sw-new', from: 'MPL:acme', to: 'NSR:cedar', keepAmount: '0' }, 'same account': { sweepId: 'sw-new', from: 'MPL:acme', to: 'MPL:acme', keepAmount: '0' } });

indistinguishable('cancel sweep', 'CANCEL_SWEEP', ['ops:MPL'],
  { sweepId: 'sw-live' },
  { 'unknown sweep': { sweepId: 'sw-ghost' } });

indistinguishable('root grant', 'GRANT', ['ops:MPL'],
  { grant_id: 'g-fresh', issuer: 'MPL', agent_key: genKey().pub, label: 'x', parent: null, allow_types: ['TRANSFER'], per_instruction_max: '100', window: { seconds: 3600, max_total: '1000' }, counterparties: null, not_after: 4_000_000_000 },
  { 'grant id already used': { grant_id: 'g-mpl', issuer: 'MPL', agent_key: genKey().pub, label: 'x', parent: null, allow_types: ['TRANSFER'], per_instruction_max: '100', window: { seconds: 3600, max_total: '1000' }, counterparties: null, not_after: 4_000_000_000 } });

const sub = (parent, id = 'g-fresh') => ({ grant_id: id, issuer: 'MPL', agent_key: genKey().pub, label: 'x', parent, allow_types: ['TRANSFER'], per_instruction_max: '100', window: { seconds: 3600, max_total: '1000' }, counterparties: null, not_after: 1_900_000_000 });
indistinguishable('sub-grant (agent-signed)', 'GRANT', ['agent:g-mpl'],
  sub('g-mpl'),
  { 'grant id already used': sub('g-mpl', 'g-child') });
indistinguishable('revoke grant (institution)', 'REVOKE_GRANT', ['ops:MPL'],
  { grant_id: 'g-child' },
  { 'unknown grant': { grant_id: 'g-ghost' }, 'already revoked': { grant_id: 'g-rev' }, 'other issuer': { grant_id: 'g-nsr' } });

indistinguishable('redeem', 'REDEEM', ['ops:MPL'],
  { account: 'MPL:acme', amount: A },
  { 'ghost': { account: 'MPL:ghost', amount: A }, 'frozen': { account: 'MPL:frozen', amount: A }, 'kyc-expired': { account: 'MPL:stale', amount: A } });

indistinguishable('freeze', 'FREEZE_ACCOUNT', ['ops:MPL'], { account: 'MPL:acme' }, { 'ghost': { account: 'MPL:ghost' }, 'already frozen': { account: 'MPL:frozen' } });
indistinguishable('unfreeze', 'UNFREEZE_ACCOUNT', ['ops:MPL'], { account: 'MPL:frozen' }, { 'ghost': { account: 'MPL:ghost' }, 'not frozen': { account: 'MPL:acme' } });

indistinguishable('open account', 'OPEN_ACCOUNT', ['ops:MPL'],
  { issuer: 'MPL', holderRef: 'brandnew', kycRef: 'k', kycExpires: 4_000_000_000 },
  { 'holder already exists': { issuer: 'MPL', holderRef: 'acme', kycRef: 'k', kycExpires: 4_000_000_000 } });

indistinguishable('dvp', 'DVP', ['ops:MPL', 'screen:MPL', 'ops:NSR', 'accept:NSR'],
  { seller: 'NSR:cedar', buyer: 'MPL:acme', secId: 'CAN-2031', qty: '1', cash: A },
  { 'ghost seller': { seller: 'NSR:ghost', buyer: 'MPL:acme', secId: 'CAN-2031', qty: '1', cash: A }, 'ghost buyer': { seller: 'NSR:cedar', buyer: 'MPL:ghost', secId: 'CAN-2031', qty: '1', cash: A }, 'frozen buyer': { seller: 'NSR:cedar', buyer: 'MPL:frozen', secId: 'CAN-2031', qty: '1', cash: A }, 'unknown security': { seller: 'NSR:cedar', buyer: 'MPL:acme', secId: 'NOPE-1', qty: '1', cash: A } });

test('pre-auth leak: batch (the first leg decides, so a ghost or frozen account in it is invisible without a signature)', () => {
  const n = world();
  const leg = (to) => n.tx('TRANSFER', { from: 'MPL:acme', to, amount: A }, ['ops:MPL'], {}); // screen missing: not fully signed
  const run = (to) => pick(n.submitSigned(n.tx('BATCH', { legs: [leg(to)] }, [])));
  const base = run('MPL:harbour');
  assert.equal(base.ok, false);
  for (const to of ['MPL:ghost', 'MPL:frozen', 'MPL:stale']) assert.deepEqual(run(to), base, to);
});

// ---- agent-signed (delegated) calls: the grant lookup is state too -------------------------------
// The agent role is chosen by the caller (`agent:<grant_id>`), so which grants exist, which issuer owns them and
// whether they are revoked must be invisible until the agent signature itself verifies.
for (const [type, mk, extra] of [
  ['TRANSFER', () => ({ from: 'MPL:acme', to: 'MPL:harbour', amount: A }), ['screen:MPL']],
  ['PAYMENT', () => ({ from: 'MPL:acme', to: 'NSR:cedar', amount: A }), ['screen:MPL', 'accept:NSR']],
  ['ESCROW_LOCK', () => ({ escrowId: 'e-new', from: 'MPL:acme', to: 'MPL:harbour', amount: A, expiresAt: 4_000_000_000 }), ['screen:MPL']],
  ['ESCROW_REFUND', () => ({ escrowId: 'e-short' }), []],
  ['REGISTER_SWEEP', () => ({ sweepId: 'sw-new', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: '0' }), []],
  ['CANCEL_SWEEP', () => ({ sweepId: 'sw-live' }), []],
  ['REVOKE_GRANT', () => ({ grant_id: 'g-child' }), []],
  ['GRANT', () => sub('g-mpl'), []],
]) {
  test(`pre-auth leak: ${type} with a forged agent signature reveals nothing about the grant`, () => {
    const n = world();
    for (const mode of ['allBad', 'firstBadRestOk']) {
      const roles = (gid) => [`agent:${gid}`, ...extra.filter((r) => canSign(n, r))];
      // For GRANT the signing grant is the payload's parent; for the rest it is the one the caller names.
      const payloadFor = (gid) => (type === 'GRANT' ? sub(gid) : mk());
      // the message may echo the caller's OWN claimed grant id (`bad signature: agent:<id>`); that is input, not state
      const base = pick(n.submitSigned(build(n, type, payloadFor('g-mpl'), roles('g-mpl'), mode)), 'g-mpl');
      assert.equal(base.ok, false);
      for (const gid of ['g-ghost', 'g-nsr', 'g-rev', 'g-other', 'g-child']) {
        const got = pick(n.submitSigned(build(n, type, payloadFor(gid), roles(gid), mode)), gid);
        assert.deepEqual(got, base, `${mode}: agent:${gid} is distinguishable from agent:g-mpl`);
      }
    }
  });
}

test('pre-auth leak: a forged agent signature on a frozen / ghost / kyc-expired account is the same as on a healthy one', () => {
  const n = world();
  const t = (from, to) => build(n, 'TRANSFER', { from, to, amount: A }, ['agent:g-mpl', 'screen:MPL'], 'allBad');
  const base = pick(n.submitSigned(t('MPL:acme', 'MPL:harbour')));
  for (const [f, to] of [['MPL:ghost', 'MPL:harbour'], ['MPL:frozen', 'MPL:harbour'], ['MPL:stale', 'MPL:harbour'], ['MPL:acme', 'MPL:ghost'], ['MPL:acme', 'MPL:frozen']]) assert.deepEqual(pick(n.submitSigned(t(f, to))), base, `${f} -> ${to}`);
});

test('pre-auth leak: a wrong-issuer grant and an unknown grant look exactly like a bad signature', () => {
  const n = world();
  const mk = (gid, key) => n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: A }, [`agent:${gid}`, 'screen:MPL'], { keyOverride: { [`agent:${gid}`]: key } });
  const badOwn = pick(n.submitSigned(mk('g-mpl', wrong())), 'g-mpl');
  assert.equal(badOwn.error, 'BAD_SIGNATURE');
  assert.deepEqual(pick(n.submitSigned(mk('g-nsr', wrong())), 'g-nsr'), badOwn);
  assert.deepEqual(pick(n.submitSigned(mk('g-nobody', wrong())), 'g-nobody'), badOwn);
});

// ---- regression: once the signature verifies, the specific errors are exactly as before -----------
const one = (n, tx) => pick(n.submitSigned(tx));
const T = (n, payload, roles = ['ops:MPL', 'screen:MPL']) => n.tx('TRANSFER', payload, roles);

test('regression (signed): transfer errors are unchanged for an authenticated caller', () => {
  const n = world();
  assert.equal(one(n, T(n, { from: 'MPL:ghost', to: 'MPL:harbour', amount: A })).error, 'UNKNOWN_ACCOUNT');
  assert.equal(one(n, T(n, { from: 'MPL:acme', to: 'MPL:ghost', amount: A })).error, 'UNKNOWN_ACCOUNT');
  assert.equal(one(n, T(n, { from: 'MPL:frozen', to: 'MPL:harbour', amount: A })).error, 'ACCOUNT_FROZEN');
  assert.equal(one(n, T(n, { from: 'MPL:stale', to: 'MPL:harbour', amount: A })).error, 'KYC_EXPIRED');
  assert.equal(one(n, T(n, { from: 'MPL:acme', to: 'NSR:cedar', amount: A })).error, 'USE_PAYMENT');
  assert.equal(one(n, T(n, { from: 'MPL:acme', to: 'MPL:acme', amount: A })).error, 'SELF_TRANSFER');
  assert.equal(one(n, T(n, { from: 'MPL:acme', to: 'MPL:harbour', amount: A })).ok, true);
});

test('regression (signed): payment, escrow lock, redeem, freeze, dvp errors are unchanged', () => {
  const n = world();
  const pay = (p) => n.tx('PAYMENT', p, ['ops:MPL', 'screen:MPL', 'accept:NSR']);
  assert.equal(one(n, pay({ from: 'MPL:ghost', to: 'NSR:cedar', amount: A })).error, 'UNKNOWN_ACCOUNT');
  assert.equal(one(n, pay({ from: 'MPL:frozen', to: 'NSR:cedar', amount: A })).error, 'ACCOUNT_FROZEN');
  assert.equal(one(n, n.tx('PAYMENT', { from: 'MPL:acme', to: 'MPL:harbour', amount: A }, ['ops:MPL', 'screen:MPL'])).error, 'USE_TRANSFER');
  const lock = (p) => n.tx('ESCROW_LOCK', { amount: A, expiresAt: n.now() + 600, ...p }, ['ops:MPL', 'screen:MPL']);
  assert.equal(one(n, lock({ escrowId: 'e-same', from: 'MPL:acme', to: 'MPL:harbour' })).error, 'ESCROW_EXISTS');
  assert.equal(one(n, lock({ escrowId: 'e-x1', from: 'MPL:ghost', to: 'MPL:harbour' })).error, 'UNKNOWN_ACCOUNT');
  assert.equal(one(n, lock({ escrowId: 'e-x2', from: 'MPL:frozen', to: 'MPL:harbour' })).error, 'ACCOUNT_FROZEN');
  assert.equal(one(n, lock({ escrowId: 'e-x3', from: 'MPL:acme', to: 'MPL:harbour', releaseRole: 'agent:g-ghost' })).error, 'BAD_RELEASE_ROLE');
  assert.equal(one(n, n.tx('REDEEM', { account: 'MPL:ghost', amount: A }, ['ops:MPL'])).error, 'UNKNOWN_ACCOUNT');
  assert.equal(one(n, n.tx('REDEEM', { account: 'MPL:frozen', amount: A }, ['ops:MPL'])).error, 'ACCOUNT_FROZEN');
  assert.equal(one(n, n.tx('REDEEM', { account: 'MPL:stale', amount: A }, ['ops:MPL'])).error, 'KYC_EXPIRED');
  assert.equal(one(n, n.tx('FREEZE_ACCOUNT', { account: 'MPL:ghost' }, ['ops:MPL'])).error, 'UNKNOWN_ACCOUNT');
  const dvp = (p) => n.tx('DVP', { secId: 'CAN-2031', qty: '1', cash: A, ...p }, ['ops:MPL', 'screen:MPL', 'ops:NSR', 'accept:NSR']);
  assert.equal(one(n, dvp({ seller: 'NSR:ghost', buyer: 'MPL:acme' })).error, 'UNKNOWN_ACCOUNT');
  assert.equal(one(n, n.tx('DVP', { seller: 'NSR:cedar', buyer: 'NSR:cedar', secId: 'CAN-2031', qty: '1', cash: A }, ['ops:NSR', 'screen:NSR'])).error, 'SELF_TRADE');
  assert.equal(one(n, dvp({ seller: 'NSR:cedar', buyer: 'MPL:acme', secId: 'NOPE-1' })).error, 'UNKNOWN_SECURITY');
});

test('regression (signed): escrow, event and sweep errors are unchanged', () => {
  const n = world();
  assert.equal(one(n, n.tx('ESCROW_REFUND', { escrowId: 'e-ghost' }, ['ops:MPL'])).error, 'UNKNOWN_ESCROW');
  assert.equal(one(n, n.tx('ESCROW_REFUND', { escrowId: 'e-live' }, ['ops:MPL'])).error, 'ESCROW_NOT_EXPIRED');
  assert.equal(one(n, n.tx('ESCROW_RELEASE', { escrowId: 'e-ghost' }, ['ops:MPL'])).error, 'UNKNOWN_ESCROW');
  assert.equal(one(n, n.tx('ESCROW_RELEASE', { escrowId: 'e-gated' }, ['ops:MPL'])).error, 'USE_EVENT_RELEASE');
  assert.equal(one(n, n.tx('EVENT_RELEASE', { escrowId: 'e-ghost', event: 'delivery' }, ['event:delivery'])).error, 'UNKNOWN_ESCROW');
  assert.equal(one(n, n.tx('EVENT_RELEASE', { escrowId: 'e-same', event: 'delivery' }, ['event:delivery'])).error, 'NOT_EVENT_GATED');
  assert.equal(one(n, n.tx('EVENT_RELEASE', { escrowId: 'e-gated', event: 'inspection' }, ['event:inspection'])).error, 'EVENT_MISMATCH');
  assert.equal(one(n, n.tx('CANCEL_SWEEP', { sweepId: 'sw-ghost' }, ['ops:NSR'])).error, 'UNKNOWN_SWEEP');
  assert.equal(one(n, n.tx('CANCEL_SWEEP', { sweepId: 'sw-live' }, ['ops:NSR'])).error, 'MISSING_SIGNATURE'); // authenticated as NSR, but not the owner
  const reg = (p) => n.tx('REGISTER_SWEEP', { keepAmount: '0', ...p }, ['ops:MPL']);
  assert.equal(one(n, reg({ sweepId: 'sw-live', from: 'MPL:acme', to: 'MPL:harbour' })).error, 'SWEEP_EXISTS');
  assert.equal(one(n, reg({ sweepId: 'sw-a', from: 'MPL:acme', to: 'NSR:cedar' })).error, 'SWEEP_SAME_ISSUER_ONLY');
  assert.equal(one(n, reg({ sweepId: 'sw-a', from: 'MPL:acme', to: 'MPL:acme' })).error, 'SELF_TRANSFER');
  assert.equal(one(n, reg({ sweepId: 'sw-a', from: 'MPL:ghost', to: 'MPL:harbour' })).error, 'UNKNOWN_ACCOUNT');
  // and the happy paths still work
  assert.equal(one(n, n.tx('ESCROW_REFUND', { escrowId: 'e-short' }, ['ops:MPL'])).ok, true);
  assert.equal(one(n, n.tx('ESCROW_RELEASE', { escrowId: 'e-same' }, ['ops:MPL'])).ok, true);
  assert.equal(one(n, n.tx('EVENT_RELEASE', { escrowId: 'e-gated', event: 'delivery' }, ['event:delivery'])).ok, true);
  assert.equal(one(n, n.tx('CANCEL_SWEEP', { sweepId: 'sw-live' }, ['ops:MPL'])).ok, true);
});

test('regression (signed): grant errors are unchanged', () => {
  const n = world();
  const g = (p, roles = ['ops:MPL']) => n.tx('GRANT', p, roles);
  assert.equal(one(n, g({ ...sub(null, 'g-mpl') })).error, 'GRANT_EXISTS');
  assert.equal(one(n, n.tx('REVOKE_GRANT', { grant_id: 'g-ghost' }, ['ops:MPL'])).error, 'UNKNOWN_GRANT');
  assert.equal(one(n, n.tx('REVOKE_GRANT', { grant_id: 'g-rev' }, ['ops:MPL'])).error, 'GRANT_ALREADY_REVOKED');
  assert.equal(one(n, n.tx('REVOKE_GRANT', { grant_id: 'g-nsr' }, ['ops:MPL'])).error, 'MISSING_SIGNATURE'); // authenticated as MPL, but not NSR's grant
  const byAgent = (gid, by) => n.tx('REVOKE_GRANT', { grant_id: gid }, [`agent:${by}`]);
  assert.equal(one(n, byAgent('g-mpl', 'g-child')).error, 'REVOKE_NOT_AUTHORISED');
  assert.equal(one(n, byAgent('g-ghost', 'g-mpl')).error, 'UNKNOWN_GRANT');
  assert.equal(one(n, byAgent('g-rev', 'g-mpl')).error, 'GRANT_ALREADY_REVOKED');
  assert.equal(one(n, byAgent('g-child', 'g-mpl')).ok, true);
});

test('regression (signed): an authenticated agent still gets the specific grant errors', () => {
  const n = world();
  const as = (gid, from, to, extra = []) => n.agentTx(gid, 'TRANSFER', { from, to, amount: A }, ['screen:MPL'], {});
  assert.equal(one(n, as('g-nsr', 'MPL:acme', 'MPL:harbour')).error, 'GRANT_WRONG_ISSUER');
  assert.equal(one(n, as('g-rev', 'MPL:acme', 'MPL:harbour')).error, 'GRANT_REVOKED');
  assert.equal(one(n, as('g-mpl', 'MPL:frozen', 'MPL:harbour')).error, 'ACCOUNT_FROZEN');
  assert.equal(one(n, as('g-mpl', 'MPL:ghost', 'MPL:harbour')).error, 'UNKNOWN_ACCOUNT');
  assert.equal(one(n, n.agentTx('g-mpl', 'TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(20_000).toString() }, ['screen:MPL'])).error, 'ESCALATION_REQUIRED');
  assert.equal(one(n, as('g-mpl', 'MPL:acme', 'MPL:harbour')).ok, true);
  const cs = n.agentTx('g-mpl', 'CANCEL_SWEEP', { sweepId: 'sw-ghost' }, []);
  assert.equal(one(n, cs).error, 'UNKNOWN_SWEEP');
  const cn = n.agentTx('g-nsr', 'CANCEL_SWEEP', { sweepId: 'sw-live' }, []);
  assert.equal(one(n, cn).error, 'GRANT_WRONG_ISSUER');
});

// ---- decision record: envelope-level checks that still run before authorisation ------------------
test('envelope checks stay pre-auth by design: MALFORMED / BAD_VALIDITY / UNKNOWN_TYPE / NETWORK_HALTED / DUPLICATE_INSTRUCTION', () => {
  // Decision (X1). Each of these depends only on the caller's own bytes, the block time, or the public halt flag
  // (GET /api/state), EXCEPT DUPLICATE_INSTRUCTION, which says "an instruction with this inst_id was ACCEPTED in the
  // last 180 s". We keep it pre-auth deliberately:
  //  - the id is recorded only when an instruction succeeded (a failed or probed instruction leaves no trace);
  //  - the answer is only useful to someone who already holds the id (ids are client-chosen; tx() makes them
  //    high-entropy). Residual: a client that uses PREDICTABLE ids (e.g. a guessable ISO UETR) lets a stranger test
  //    "was payment X accepted recently", and only that;
  //  - it is what makes a retry safe (exactly-once). Hiding it behind a signature would need every handler's
  //    signature set verified before the envelope check, a bigger change than this item.
  const n = world();
  const ok = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: A }, ['ops:MPL', 'screen:MPL']);
  assert.equal(n.submitSigned(ok).ok, true);
  const replay = { ...ok, sigs: {} }; // an unauthenticated replay of a known inst_id: told it is a duplicate, nothing more
  assert.equal(n.submitSigned(replay).error, 'DUPLICATE_INSTRUCTION');
  // an inst_id that was never accepted (e.g. one that failed on a ghost account) is NOT reported as seen
  const failed = n.tx('TRANSFER', { from: 'MPL:ghost', to: 'MPL:harbour', amount: A }, ['ops:MPL', 'screen:MPL']);
  assert.equal(n.submitSigned(failed).error, 'UNKNOWN_ACCOUNT');
  assert.notEqual(n.submitSigned({ ...failed, sigs: {} }).error, 'DUPLICATE_INSTRUCTION');
});

// ---- interaction with Phase 0 (roadmap 8.2 / 8.3): ownership and liveness checks survive, but only after the signature ----
function ownedWorld() {
  const n = world();
  const now = n.now();
  // g-child (a descendant of g-mpl) registers a sweep and locks a refundable escrow; g-other is a live, unrelated grant.
  must(n.submitSigned(n.agentTx('g-child', 'REGISTER_SWEEP', { sweepId: 'sw-child', from: 'MPL:acme', to: 'MPL:harbour', keepAmount: '99999999999' }, [])), 'child sweep');
  must(n.submitSigned(n.agentTx('g-child', 'ESCROW_LOCK', { escrowId: 'e-child', from: 'MPL:acme', to: 'MPL:harbour', amount: '100', expiresAt: now + 3 }, ['screen:MPL'])), 'child escrow');
  // an escrow whose release role is a grant, which is then revoked
  must(n.submitSigned(n.tx('ESCROW_LOCK', { escrowId: 'e-rr', from: 'MPL:acme', to: 'MPL:harbour', amount: '100', expiresAt: now + 3600, releaseRole: 'agent:g-other' }, ['ops:MPL', 'screen:MPL'])), 'rr escrow');
  n.clockOffset += 10;
  return n;
}

test('Phase 0 x X1: the grant-ownership checks (SWEEP_WRONG_GRANT / ESCROW_WRONG_GRANT) still fire, and only for a verified agent', () => {
  const n = ownedWorld();
  // verified signature: the specific ownership errors are returned as on main
  assert.equal(one(n, n.agentTx('g-other', 'CANCEL_SWEEP', { sweepId: 'sw-child' }, [])).error, 'SWEEP_WRONG_GRANT');
  assert.equal(one(n, n.agentTx('g-other', 'ESCROW_REFUND', { escrowId: 'e-child' }, [])).error, 'ESCROW_WRONG_GRANT');
  // an ancestor is allowed; the owner itself is allowed
  assert.equal(one(n, n.agentTx('g-mpl', 'CANCEL_SWEEP', { sweepId: 'sw-child' }, [])).ok, true);
  assert.equal(one(n, n.agentTx('g-child', 'ESCROW_REFUND', { escrowId: 'e-child' }, [])).ok, true);
  // forged signature: the owner, a non-owner and a ghost grant are all the same answer, so ownership is not probeable
  const n2 = ownedWorld();
  for (const [type, payload] of [['CANCEL_SWEEP', { sweepId: 'sw-child' }], ['ESCROW_REFUND', { escrowId: 'e-child' }]]) {
    const forged = (gid) => pick(n2.submitSigned(n2.tx(type, payload, [`agent:${gid}`], { keyOverride: { [`agent:${gid}`]: wrong() } })), gid);
    const base = forged('g-child');
    assert.equal(base.error, 'BAD_SIGNATURE');
    for (const gid of ['g-other', 'g-mpl', 'g-ghost', 'g-nsr']) assert.deepEqual(forged(gid), base, `${type} as ${gid}`);
  }
});

test('Phase 0 x X1: a revoked release-role grant is still refused (8.2), but liveness is only reported after the signature', () => {
  const n = ownedWorld();
  must(n.revokeGrant('g-other'), 'revoke release role');
  // the grant's own key signs: GRANT_REVOKED, as on main
  assert.equal(one(n, n.tx('ESCROW_RELEASE', { escrowId: 'e-rr' }, ['agent:g-other'])).error, 'GRANT_REVOKED');
  // a forged signature on the revoked-role escrow looks like a forged signature on an unknown escrow
  const forged = (escrowId) => pick(n.submitSigned(n.tx('ESCROW_RELEASE', { escrowId }, ['agent:g-other'], { keyOverride: { 'agent:g-other': wrong() } })));
  assert.deepEqual(forged('e-rr'), forged('e-ghost'));
  assert.deepEqual(pick(n.submitSigned(n.tx('ESCROW_RELEASE', { escrowId: 'e-rr' }, []))), pick(n.submitSigned(n.tx('ESCROW_RELEASE', { escrowId: 'e-ghost' }, []))));
});
