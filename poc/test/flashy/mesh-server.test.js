// End to end over real sockets on loopback: the actual server process, a fake FlashyOS collector, and plain HTTP.
// Nothing leaves the machine and no FlashyOS endpoint is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { verifyReceiptDocument } from '../../src/flashy/mesh/verify-receipt.mjs';
import { TASKS } from '../../src/flashy/mesh/wire.js';

const SERVER = new URL('../../src/server.js', import.meta.url).pathname;
let nextPort = 19100 + Math.floor(Math.random() * 400) * 2;
const TOKEN = 'agt_test_0123456789abcdef';

function http(port, method, path, body) {
  return new Promise((resolve, reject) => {
    const r = request({ host: '127.0.0.1', port, method, path, headers: body ? { 'content-type': 'application/json' } : {} }, (res) => {
      let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text: b, json: () => JSON.parse(b) }));
    });
    r.on('error', reject); if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body)); r.end();
  });
}
async function startServer(env = {}) {
  const port = nextPort; nextPort += 2;
  const child = spawn(process.execPath, [SERVER], { env: { PATH: process.env.PATH, PORT: String(port), ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', (d) => (out += d)); child.stderr.on('data', (d) => (out += d));
  for (let i = 0; i < 100 && !/running at/.test(out); i++) await new Promise((r) => setTimeout(r, 50));
  assert.match(out, /running at/, out);
  return { port, out: () => out, stop: async () => { child.kill('SIGTERM'); await once(child, 'close'); } };
}
async function collector() {
  const beats = [];
  const srv = createServer((q, s) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { try { beats.push({ url: q.url, body: JSON.parse(b) }); } catch { /* ignore */ } s.writeHead(200).end('{}'); }); });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  return { beats, url: `http://127.0.0.1:${srv.address().port}`, stop: () => srv.close() };
}
const wait = async (cond, ms = 4000) => { for (let t = 0; t < ms; t += 40) { if (cond()) return true; await new Promise((r) => setTimeout(r, 40)); } return cond(); };
const MESH = (url) => ({ FLASHYOS_ORG_ID: 'org_abc123', FLASHYOS_AGENT_TOKEN: TOKEN, FLASHYOS_AGENT_NAME: 'depositx-agent', FLASHYOS_API_URL: url });

test('discovery, OpenAPI, receipts and measures answer over HTTP, and a receipt verifies offline', async () => {
  const s = await startServer();
  try {
    const ch = await http(s.port, 'GET', '/.well-known/flashyos-charter.json');
    assert.equal(ch.status, 200); assert.equal(ch.json().slug, 'depositx'); assert.match(ch.text, /simulated/i);
    assert.equal((await http(s.port, 'GET', '/api/openapi.json')).json().openapi, '3.1.0');
    const st = (await http(s.port, 'GET', '/api/state')).json();
    assert.equal(st.simulated, true); assert.ok(st.blocks.every((b) => /simulated/i.test(b.receiptLabel)));
    const rc = await http(s.port, 'GET', `/api/receipt/${st.height}`);
    assert.equal(rc.status, 200); assert.equal(verifyReceiptDocument(rc.json()).valid, true);
    const m = (await http(s.port, 'GET', '/api/measures')).json();
    assert.equal(m.replay.percent, '100.00');
    assert.equal((await http(s.port, 'GET', '/.well-known/flashyos.json')).status, 404, 'no handshake without a public profile URL');
  } finally { await s.stop(); }
});

test('REFUSAL: the demo action endpoint is a closed schema', async () => {
  const s = await startServer();
  try {
    const bad = [{ kind: 'nope' }, { kind: 'net', extra: 1 }, {}, [], { kind: 'pay', from: 'MPL:acme', to: 'NSR:cedar', amount: '1', sneaky: true }, { kind: 'pay', from: 5, to: 'x', amount: '1' }];
    for (const b of bad) { const r = await http(s.port, 'POST', '/api/action', b); assert.equal(r.status, 400, JSON.stringify(b)); assert.equal(r.json().error, 'BAD_REQUEST'); }
    assert.equal((await http(s.port, 'POST', '/api/action', '{not json')).status, 400);
    const ok = await http(s.port, 'POST', '/api/action', { kind: 'pay', from: 'MPL:acme', to: 'NSR:cedar', amount: '5' });
    assert.equal(ok.status, 200); assert.equal(ok.json().ok, true);
  } finally { await s.stop(); }
});

test('REFUSAL: read-only mesh paths refuse writes, queries and bad heights over HTTP', async () => {
  const s = await startServer();
  try {
    assert.equal((await http(s.port, 'POST', '/api/measures', {})).status, 405);
    assert.equal((await http(s.port, 'GET', '/api/measures?x=1')).status, 400);
    assert.equal((await http(s.port, 'GET', '/api/receipt/abc')).status, 400);
    assert.equal((await http(s.port, 'GET', '/api/receipt/999999')).status, 404);
    assert.equal((await http(s.port, 'GET', '/.well-known/nothing')).status, 404);
    assert.equal((await http(s.port, 'GET', '/api/nothing')).status, 404);
  } finally { await s.stop(); }
});

test('REFUSAL: agent mode turns off every endpoint where the server signs for the caller; submit still works', async () => {
  const s = await startServer({ DEPOSITX_MODE: 'agent' });
  try {
    for (const [m, p, b] of [['POST', '/api/action', { kind: 'net' }], ['POST', '/api/iso/pacs008', '<x/>'], ['GET', '/api/bench']]) {
      const r = await http(s.port, m, p, b); assert.equal(r.status, 403, p); assert.equal(r.json().error, 'DEMO_ACTIONS_DISABLED');
    }
    const sub = await http(s.port, 'POST', '/api/submit', { inst_id: 'x', type: 'TRANSFER' });
    assert.equal(sub.status, 200); assert.equal(sub.json().ok, false); assert.equal(sub.json().error, 'MALFORMED');
    assert.equal((await http(s.port, 'GET', '/api/schema')).status, 200);
    assert.match(s.out(), /agent mode/);
  } finally { await s.stop(); }
});

test('REFUSAL: with the three variables unset the server sends nothing anywhere', async () => {
  const c = await collector();
  const s = await startServer({ FLASHYOS_API_URL: c.url });
  try {
    await http(s.port, 'POST', '/api/action', { kind: 'pay', from: 'MPL:acme', to: 'NSR:cedar', amount: '5' });
    await http(s.port, 'POST', '/api/action', { kind: 'chaos', type: 'core_loss' });
    await new Promise((r) => setTimeout(r, 400));
    assert.deepEqual(c.beats, []);
    assert.match(s.out(), /mesh presence off/);
  } finally { await s.stop(); c.stop(); }
});

test('with the variables set: a start heartbeat, then activity and a halt, using fixed labels only', async () => {
  const c = await collector();
  const s = await startServer(MESH(c.url));
  try {
    assert.ok(await wait(() => c.beats.some((b) => b.body.currentTask === TASKS.started)), 'start heartbeat');
    await http(s.port, 'POST', '/api/action', { kind: 'pay', from: 'MPL:acme', to: 'NSR:cedar', amount: '777' });
    await http(s.port, 'POST', '/api/action', { kind: 'chaos', type: 'core_loss' });
    assert.ok(await wait(() => c.beats.some((b) => b.body.status === 'INCIDENT' && b.body.currentTask === TASKS.halted)), 'halt heartbeat');
    // a reset builds a new network: presence must follow it
    await http(s.port, 'POST', '/api/action', { kind: 'reset' });
    await http(s.port, 'POST', '/api/action', { kind: 'chaos', type: 'core_loss' });
    assert.ok(await wait(() => c.beats.filter((b) => b.body.currentTask === TASKS.halted).length >= 2), 'presence survives a reset');
    for (const b of c.beats) {
      assert.equal(b.url, '/api/v1/agents/heartbeat');
      assert.deepEqual(Object.keys(b.body).sort(), ['agentName', 'currentTask', 'orgId', 'progress', 'status', 'token']);
      assert.ok(Object.values(TASKS).includes(b.body.currentTask));
    }
    const text = JSON.stringify(c.beats.map((b) => ({ ...b.body, token: undefined })));
    for (const forbidden of ['acme', 'cedar', 'MPL', 'NSR', 'LKS', '777', '77700', 'core_loss']) assert.ok(!text.includes(forbidden), forbidden);
    assert.ok(!s.out().includes(TOKEN), 'the token never reaches the server log');
  } finally { await s.stop(); c.stop(); }
});

test('the kernel is unaffected when the mesh endpoint is down: actions work and the log still replays', async () => {
  const s = await startServer(MESH('http://127.0.0.1:1')); // nothing listens there
  try {
    const r = await http(s.port, 'POST', '/api/action', { kind: 'pay', from: 'MPL:acme', to: 'NSR:cedar', amount: '5' });
    assert.equal(r.json().ok, true);
    await http(s.port, 'POST', '/api/action', { kind: 'chaos', type: 'core_loss' });
    assert.equal((await http(s.port, 'GET', '/api/verify')).json().ok, true);
    const st = (await http(s.port, 'GET', '/api/state')).json();
    assert.ok(st.halt, 'the graded halt still happens');
  } finally { await s.stop(); }
});
