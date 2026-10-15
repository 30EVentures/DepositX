// Phase 0.3: presence from the block loop, with FIXED PHASES only:
//   block processed = ACTIVE, a sweep fired = BUILDING, a refused authorization = REVIEWING,
//   an invariant breach (halt or quarantine) = INCIDENT, idle = IDLE.
// Never an account, amount, grant, institution name, hash or error code; silent without the three env vars; read-only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';
import { attachMeshReporter, classifyBlock, TASKS, AUTH_REFUSALS } from '../../src/flashy/mesh/wire.js';

const flush = () => new Promise((r) => setImmediate(r));
function rig(opts = {}) {
  const sent = [];
  const reporter = { configured: true, heartbeat: async (status, task, progress) => { sent.push({ status, task, progress }); return { sent: true }; } };
  const clock = { t: 5_000_000 };
  const timers = { setInterval: () => ({ unref() {} }), clearInterval() {} };
  const net = opts.net ?? new Network();
  const ctl = attachMeshReporter(net, { reporter, now: () => clock.t, timers, minIntervalMs: 10_000, idleAfterMs: 60_000, keepaliveMs: 60_000 });
  return { net, ctl, sent, clock };
}
const last = (sent) => sent.at(-1);

test('a plain payment is ACTIVE with the block label', async () => {
  const { net, sent, clock } = rig(); await flush(); sent.length = 0; clock.t += 20_000;
  net.pay('MPL:acme', 'NSR:cedar', dollars(5)); await flush();
  assert.deepEqual(last(sent), { status: 'ACTIVE', task: TASKS.block, progress: 0 });
});

test('a sweep that moves money is BUILDING', async () => {
  const { net, sent, clock } = rig(); await flush();
  assert.ok(net.registerSweep('s1', 'MPL:acme', 'MPL:harbour', dollars(1)).ok);
  sent.length = 0; clock.t += 20_000;
  net.pay('NSR:cedar', 'MPL:acme', dollars(50)); // pushes acme above its keep amount; the sweep fires at the end of the block
  await flush();
  assert.deepEqual(last(sent), { status: 'BUILDING', task: TASKS.sweep, progress: 0 });
});

test('a refused authorization is REVIEWING', async () => {
  const { net, sent, clock } = rig(); await flush(); sent.length = 0; clock.t += 20_000;
  net.chaos('forged_sig'); // a payment signed with the wrong key
  await flush();
  assert.deepEqual(last(sent), { status: 'REVIEWING', task: TASKS.refused, progress: 0 });
});

test('an invariant breach is INCIDENT, immediately, even inside the throttle window', async () => {
  const { net, sent } = rig(); await flush();
  net.pay('MPL:acme', 'NSR:cedar', dollars(1)); sent.length = 0;
  net.chaos('inflate'); await flush();
  assert.deepEqual(last(sent), { status: 'INCIDENT', task: TASKS.halted, progress: 0 });
});

test('priority: an incident wins over a refused authorization, which wins over a sweep, which wins over a plain block', () => {
  const mk = (over) => ({ results: [], sweepFires: [], violations: [], ...over });
  const refused = { ok: false, error: 'BAD_SIGNATURE' };
  assert.equal(classifyBlock(mk({}), false), 'block');
  assert.equal(classifyBlock(mk({ sweepFires: [{ amount: '5' }] }), false), 'sweep');
  assert.equal(classifyBlock(mk({ sweepFires: [{ amount: '5' }], results: [refused] }), false), 'refused');
  assert.equal(classifyBlock(mk({ sweepFires: [{ amount: '5' }], results: [refused], violations: [{ id: 'P1' }] }), false), 'incident');
  assert.equal(classifyBlock(mk({}), true), 'incident');
});

test('REFUSAL: a suspended or empty sweep is not BUILDING, and a non-authorization refusal is not REVIEWING', () => {
  const mk = (over) => ({ results: [], sweepFires: [], violations: [], ...over });
  assert.equal(classifyBlock(mk({ sweepFires: [{ amount: '0', suspended: true }] }), false), 'block');
  assert.equal(classifyBlock(mk({ sweepFires: [{ amount: '0' }] }), false), 'block');
  for (const code of ['INSUFFICIENT_FUNDS', 'VALUE_CAP_EXCEEDED', 'DUPLICATE_INSTRUCTION', 'BAD_VALIDITY', 'UNKNOWN_ACCOUNT', 'ACCOUNT_FROZEN']) assert.equal(classifyBlock(mk({ results: [{ ok: false, error: code }] }), false), 'block', code);
});

test('every authorization refusal the kernel can give is recognised', () => {
  for (const code of ['BAD_SIGNATURE', 'MISSING_SIGNATURE', 'ESCALATION_REQUIRED', 'ENVELOPE_DENIED', 'GRANT_REVOKED', 'GRANT_EXPIRED', 'GRANT_MISMATCH', 'GRANT_WRONG_ISSUER', 'CALLER_MISMATCH', 'UNKNOWN_GRANT', 'REVOKE_NOT_AUTHORISED', 'SWEEP_WRONG_GRANT', 'ESCROW_WRONG_GRANT', 'MULTIPLE_AGENT_SIGS']) assert.ok(AUTH_REFUSALS.has(code), code);
});

test('REFUSAL: a flood of refused instructions sends at most one REVIEWING heartbeat per interval', async () => {
  const { net, sent, clock } = rig(); await flush(); sent.length = 0; clock.t += 20_000;
  for (let i = 0; i < 25; i++) net.chaos('forged_sig');
  await flush();
  assert.equal(sent.filter((s) => s.status === 'REVIEWING').length, 1);
  clock.t += 11_000; net.chaos('forged_sig'); await flush();
  assert.equal(sent.filter((s) => s.status === 'REVIEWING').length, 2);
});

test('REFUSAL: no account, amount, grant, institution, hash or error code ever appears in any heartbeat', async () => {
  const { net, ctl, sent, clock } = rig(); await flush();
  net.grantAgent({ grantId: 'treasury-bot', issuer: 'MPL', label: 'Maple treasury', allowTypes: ['TRANSFER'], perInstructionMax: dollars(100), window: { seconds: 86400, maxTotal: dollars(1000) }, counterparties: null, notAfter: null });
  net.registerSweep('s1', 'MPL:acme', 'MPL:harbour', dollars(1));
  net.pay('MPL:acme', 'NSR:cedar', dollars(7777)); net.pay('NSR:cedar', 'MPL:acme', dollars(50));
  net.chaos('forged_sig'); net.chaos('core_loss'); net.chaos('fire_alarm', { issuer: 'LKS' });
  clock.t += 120_000; ctl.tick(); await flush();
  const text = JSON.stringify(sent);
  for (const f of ['acme', 'cedar', 'harbour', 'treasury', 'bot', 'Maple', 'MPL', 'NSR', 'LKS', '7777', '777700', 'BAD_SIGNATURE', 'FORGED', 'sweep s1', 's1', net.blocks.at(-1).hash.slice(0, 10)]) assert.ok(!text.includes(f), f);
  assert.ok(sent.every((s) => ['ACTIVE', 'BUILDING', 'REVIEWING', 'INCIDENT', 'IDLE'].includes(s.status)));
  assert.ok(sent.every((s) => Object.values(TASKS).includes(s.task)));
});

test('idle after the idle window; and without the three variables nothing at all is attached or sent', async () => {
  const { sent, ctl, clock } = rig(); await flush(); sent.length = 0;
  clock.t += 61_000; ctl.tick(); await flush();
  assert.deepEqual(last(sent), { status: 'IDLE', task: '', progress: 0 });
  const quiet = attachMeshReporter(new Network(), { reporter: { configured: false, heartbeat: () => { throw new Error('must not be called'); } } });
  assert.equal(quiet.configured, false); quiet.tick();
});

test('the wiring only reads: with and without it, the same scenario gives the same results, blocks and halt', async () => {
  const scenario = (n) => [n.pay('MPL:acme', 'NSR:cedar', dollars(5)).ok, n.chaos('forged_sig').ok, n.registerSweep('s9', 'MPL:acme', 'MPL:harbour', dollars(1)).ok, n.chaos('core_loss').ok];
  const plain = new Network(); const a = scenario(plain);
  const wired = new Network(); attachMeshReporter(wired, { reporter: { configured: true, heartbeat: async () => ({ sent: true }) }, timers: { setInterval: () => ({ unref() {} }), clearInterval() {} } });
  const b = scenario(wired);
  assert.deepEqual(a, b); assert.equal(wired.blocks.length, plain.blocks.length);
  assert.deepEqual(wired.ledger.s.halt && wired.ledger.s.halt.reason, plain.ledger.s.halt && plain.ledger.s.halt.reason);
  assert.ok(wired.verifyReplay().ok);
});
