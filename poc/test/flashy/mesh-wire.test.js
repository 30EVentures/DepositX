// The reporter wired to the simulated network: fixed labels only, a no-op without the three env vars, and it can
// never change a block, the kernel, or the graded halt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Network, dollars } from '../../src/network.js';
import { attachMeshReporter, TASKS } from '../../src/flashy/mesh/wire.js';
import { createReporter, STATUSES } from '../../src/flashy/mesh/reporter.js';

const TOKEN = 'agt_test_0123456789abcdef';
const ENV = { FLASHYOS_ORG_ID: 'org_abc123', FLASHYOS_AGENT_TOKEN: TOKEN, FLASHYOS_AGENT_NAME: 'demo-agent' };

// a recording reporter + a fake clock/timer set, so every test is instant and deterministic
function rig(over = {}) {
  const sent = [];
  const reporter = over.reporter ?? { configured: true, heartbeat: async (status, task, progress) => { sent.push({ status, task, progress }); return { sent: true }; } };
  const clock = { t: 1_000_000, now() { return this.t; } };
  const timers = { set: [], setInterval(fn, ms) { const h = { fn, ms, unref() {} }; this.set.push(h); return h; }, clearInterval(h) { h.cleared = true; } };
  const net = over.net ?? new Network();
  const ctl = attachMeshReporter(net, { reporter, now: () => clock.now(), timers, minIntervalMs: 10_000, idleAfterMs: 60_000, keepaliveMs: 60_000, ...over.opts });
  return { net, ctl, sent, clock, timers };
}
const flush = () => new Promise((r) => setImmediate(r));

test('REFUSAL: not configured -> no listener, no timer, nothing sent, even after activity', async () => {
  let calls = 0;
  const net = new Network();
  const before = net.listeners.size;
  const ctl = attachMeshReporter(net, { reporter: createReporter({ env: {}, fetchImpl: async () => { calls++; return { ok: true, status: 200 }; } }), timers: { setInterval() { throw new Error('no timer expected'); }, clearInterval() {} } });
  assert.equal(ctl.configured, false);
  assert.equal(net.listeners.size, before);
  net.pay('MPL:acme', 'NSR:cedar', dollars(5));
  await flush();
  assert.equal(calls, 0);
  ctl.tick(); ctl.detach(); // inert, never throw
});

test('configured: a start heartbeat, then ACTIVE on a block, using only fixed labels', async () => {
  const { net, sent } = rig();
  await flush();
  assert.deepEqual(sent[0], { status: 'ACTIVE', task: TASKS.started, progress: 0 });
  net.pay('MPL:acme', 'NSR:cedar', dollars(5));
  await flush();
  assert.ok(sent.length >= 1);
  for (const s of sent) { assert.ok(STATUSES.includes(s.status)); assert.ok(Object.values(TASKS).includes(s.task)); assert.equal(s.progress, 0); }
});

test('block heartbeats are throttled, but a halt is sent at once and exactly once', async () => {
  const { net, sent, clock } = rig();
  await flush(); sent.length = 0;
  for (let i = 0; i < 6; i++) net.pay('MPL:acme', 'NSR:cedar', dollars(1));
  await flush();
  assert.ok(sent.filter((s) => s.task === TASKS.block).length <= 1, 'six blocks inside the minimum interval send at most one');
  sent.length = 0;
  net.chaos('core_loss'); // real over-issuance: network halt
  await flush();
  assert.deepEqual(sent.filter((s) => s.status === 'INCIDENT'), [{ status: 'INCIDENT', task: TASKS.halted, progress: 0 }]);
  net.heartbeat(); net.heartbeat(); await flush();
  assert.equal(sent.filter((s) => s.task === TASKS.halted).length, 1, 'the same state is not re-announced');
  clock.t += 5;
});

test('a quarantined issuer is reported as an incident with a fixed label, never the issuer', async () => {
  const { net, sent } = rig();
  await flush(); sent.length = 0;
  net.chaos('fire_alarm', { issuer: 'LKS' });
  await flush();
  assert.deepEqual(sent.at(-1), { status: 'INCIDENT', task: TASKS.quarantined, progress: 0 });
  assert.ok(!JSON.stringify(sent).includes('LKS'));
});

test('idle: no block for the idle window -> IDLE on the keepalive tick; recovery -> ACTIVE again', async () => {
  const { net, ctl, sent, clock } = rig();
  await flush(); sent.length = 0;
  clock.t += 61_000; ctl.tick(); await flush();
  assert.deepEqual(sent.at(-1), { status: 'IDLE', task: TASKS.idle, progress: 0 });
  clock.t += 20_000; net.pay('MPL:acme', 'NSR:cedar', dollars(1)); await flush();
  assert.equal(sent.at(-1).status, 'ACTIVE');
});

test('keepalive: a timer is registered, unref-able, and cleared by detach (which also removes the listener)', async () => {
  const { net, ctl, timers } = rig();
  assert.equal(timers.set.length, 1);
  assert.equal(timers.set[0].ms, 60_000);
  const n = net.listeners.size;
  ctl.detach();
  assert.equal(timers.set[0].cleared, true);
  assert.equal(net.listeners.size, n - 1);
});

test('no account name, amount, hash, instruction content or token ever appears in a heartbeat', async () => {
  const { net, ctl, sent, clock } = rig({ reporter: undefined });
  await flush();
  net.pay('MPL:acme', 'NSR:cedar', dollars(777));
  net.redeem('LKS', 'elm', dollars(100));
  net.chaos('core_loss'); net.chaos('fire_alarm', { issuer: 'LKS' });
  clock.t += 120_000; ctl.tick();
  await flush();
  const text = JSON.stringify(sent);
  for (const forbidden of ['acme', 'cedar', 'elm', 'MPL', 'NSR', 'LKS', '777', '77700', TOKEN, 'org_', net.blocks.at(-1).hash.slice(0, 12)]) assert.ok(!text.includes(forbidden), forbidden);
  assert.ok(sent.length > 0);
});

test('NEVER AFFECTS THE KERNEL: a reporter that throws, rejects or never answers changes no result', async () => {
  const makers = {
    throws: () => ({ configured: true, heartbeat() { throw new Error('boom'); } }),
    rejects: () => ({ configured: true, heartbeat: async () => { throw new Error('boom'); } }),
    never: () => ({ configured: true, heartbeat: () => new Promise(() => {}) }),
  };
  const scenario = (n) => { const out = []; out.push(n.pay('MPL:acme', 'NSR:cedar', dollars(5)).ok); out.push(n.redeem('LKS', 'elm', dollars(1)).ok); out.push(n.chaos('overdraft').ok); out.push(n.chaos('core_loss').ok); return out; };
  const plain = new Network(); const baseline = scenario(plain);
  for (const [name, make] of Object.entries(makers)) {
    const net = new Network();
    attachMeshReporter(net, { reporter: make(), timers: { setInterval: () => ({ unref() {} }), clearInterval() {} } });
    assert.deepEqual(scenario(net), baseline, name);
    assert.equal(net.blocks.length, plain.blocks.length, `${name}: same number of blocks`);
    assert.ok(net.verifyReplay().ok, `${name}: the log still replays`);
    assert.equal(net.ledger.s.halt && net.ledger.s.halt.reason, plain.ledger.s.halt && plain.ledger.s.halt.reason, `${name}: the same graded halt`);
  }
});

test('the graded halt still works end to end with a failing reporter attached: halt, then co-signed resume after repair', async () => {
  const net = new Network();
  attachMeshReporter(net, { reporter: { configured: true, heartbeat() { throw new Error('boom'); } }, timers: { setInterval: () => ({ unref() {} }), clearInterval() {} } });
  net.chaos('inflate');
  assert.ok(net.ledger.s.halt);
  net.chaos('repair');
  const r = net.resume('network');
  assert.ok(r.ok, `${r.error}`);
  assert.equal(net.ledger.s.halt, null);
});

test('REFUSAL: a listener that sees a malformed event does nothing and does not throw', async () => {
  const { net, sent } = rig();
  await flush(); sent.length = 0;
  for (const bad of [null, undefined, 5, 'x', {}, { type: 'other' }, { type: 'block' }, { type: 'block', height: 'x' }]) for (const l of net.listeners) assert.doesNotThrow(() => l(bad));
  await flush();
  assert.ok(sent.every((s) => Object.values(TASKS).includes(s.task)));
});

test('the status vocabulary used is a subset of the reporter\'s own list', () => {
  for (const s of ['ACTIVE', 'INCIDENT', 'IDLE']) assert.ok(STATUSES.includes(s));
});

test('NEVER AFFECTS THE KERNEL: even if the wiring itself fails (a clock that throws), submit() and the block are untouched', () => {
  let boom = false;
  const net = new Network();
  attachMeshReporter(net, { reporter: { configured: true, heartbeat: async () => ({ sent: true }) }, now: () => { if (boom) throw new Error('clock failed'); return 1; }, timers: { setInterval: () => ({ unref() {} }), clearInterval() {} } });
  boom = true;
  const before = net.blocks.length;
  const r = net.pay('MPL:acme', 'NSR:cedar', dollars(5));
  assert.equal(r.ok, true);
  assert.equal(net.blocks.length > before, true);
  assert.ok(net.verifyReplay().ok);
});
