import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readConfig, createReporter, describeHeartbeat, STATUSES } from '../../../poc/src/flashy/mesh/reporter.js';

const TOKEN = 'agt_test_0123456789abcdef';
const ENV = { FLASHYOS_ORG_ID: 'org_abc123', FLASHYOS_AGENT_TOKEN: TOKEN, FLASHYOS_AGENT_NAME: 'demo-agent' };

test('unconfigured: nothing is sent and the reason is coded', async () => {
  let calls = 0; const f = async () => { calls++; return { ok: true, status: 200 }; };
  for (const env of [{}, { FLASHYOS_ORG_ID: 'org_abc123' }, { ...ENV, FLASHYOS_AGENT_NAME: '' }, { ...ENV, FLASHYOS_AGENT_TOKEN: '' }]) {
    const r = await createReporter({ env, fetchImpl: f }).idle();
    assert.deepEqual([r.sent, r.reason], [false, 'NOT_CONFIGURED']);
  }
  assert.equal(calls, 0);
});
test('config refuses: non-https api, credentials in url, query, bad org, bad agent name, odd token', () => {
  for (const [k, v, why] of [['FLASHYOS_API_URL', 'http://api.flashyos.com', 'API_URL_NOT_HTTPS'], ['FLASHYOS_API_URL', 'http://localhost:1', 'API_URL_NOT_HTTPS'], ['FLASHYOS_API_URL', 'https://u:p@api.flashyos.com', 'BAD_API_URL'], ['FLASHYOS_API_URL', 'https://api.flashyos.com/?x=1', 'BAD_API_URL'], ['FLASHYOS_API_URL', 'nonsense', 'BAD_API_URL'], ['FLASHYOS_ORG_ID', 'a b', 'BAD_ORG_ID'], ['FLASHYOS_AGENT_NAME', 'Has Caps', 'BAD_AGENT_NAME'], ['FLASHYOS_AGENT_TOKEN', 'short', 'BAD_TOKEN_SHAPE'], ['FLASHYOS_AGENT_TOKEN', 'has space in it ok?', 'BAD_TOKEN_SHAPE']])
    assert.equal(readConfig({ ...ENV, [k]: v }).reason, why, `${k}=${v}`);
  assert.equal(readConfig(ENV).configured, true);
});
test('refuses unknown statuses and bad progress before touching the network', async () => {
  let calls = 0; const r = createReporter({ env: ENV, fetchImpl: async () => { calls++; return { ok: true, status: 200 }; } });
  for (const s of ['idle', 'LIVE', '', undefined, 'DROP TABLE']) assert.equal((await r.heartbeat(s)).reason, 'BAD_STATUS');
  for (const p of [-1, 101, 1.5, '5', NaN]) assert.equal((await r.heartbeat('IDLE', '', p)).reason, 'BAD_PROGRESS');
  assert.equal(calls, 0); assert.equal(STATUSES.length, 9);
});
test('network failure, timeout and non-2xx never throw and never leak the token', async () => {
  const outs = [];
  outs.push(await createReporter({ env: ENV, fetchImpl: async () => { throw new Error('boom ' + TOKEN); } }).idle());
  outs.push(await createReporter({ env: ENV, fetchImpl: async () => ({ ok: false, status: 401 }) }).idle());
  outs.push(await createReporter({ env: ENV, fetchImpl: async () => ({ ok: false, status: 503 }) }).idle());
  assert.deepEqual(outs.map((o) => o.reason), ['NETWORK_ERROR', 'HTTP_401', 'HTTP_503']);
  for (const o of outs) assert.ok(!JSON.stringify(o).includes(TOKEN));
});
test('describeHeartbeat redacts the token; task text is stripped of control characters and capped', () => {
  const cfg = readConfig(ENV); const d = describeHeartbeat(cfg, 'ACTIVE', 'a\n\u0000b' + 'x'.repeat(300), 5);
  assert.ok(!JSON.stringify(d).includes(TOKEN)); assert.equal(d.body.token, '[redacted]');
  assert.ok(d.body.currentTask.length <= 120); assert.ok(!/[\n\u0000]/.test(d.body.currentTask));
  assert.equal(d.url, 'https://api.flashyos.com/api/v1/agents/heartbeat');
});
test('LOCAL wire check: exact request shape (same as @flashyos/agent 0.21.0), no redirects followed', async () => {
  const seen = [];
  const server = createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { seen.push({ method: req.method, url: req.url, body: JSON.parse(b), ct: req.headers['content-type'] }); res.writeHead(200).end('{}'); }); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const env = { ...ENV, FLASHYOS_API_URL: `http://127.0.0.1:${server.address().port}` };
    const out = await createReporter({ env }).heartbeat('TESTING', 'running checks', 40);
    assert.deepEqual([out.sent, out.httpStatus], [true, 200]);
    assert.deepEqual(seen[0], { method: 'POST', url: '/api/v1/agents/heartbeat', ct: 'application/json', body: { orgId: 'org_abc123', token: TOKEN, agentName: 'demo-agent', status: 'TESTING', currentTask: 'running checks', progress: 40 } });
  } finally { server.close(); }
});
test('a redirect is never followed: the token is not forwarded to the redirect target', async () => {
  let landed = 0;
  const target = createServer((q, s) => { landed++; s.writeHead(200).end('{}'); });
  await new Promise((r) => target.listen(0, '127.0.0.1', r));
  const hop = createServer((q, s) => { q.resume(); s.writeHead(307, { Location: `http://127.0.0.1:${target.address().port}/steal` }).end(); });
  await new Promise((r) => hop.listen(0, '127.0.0.1', r));
  try {
    const out = await createReporter({ env: { ...ENV, FLASHYOS_API_URL: `http://127.0.0.1:${hop.address().port}` } }).idle();
    assert.equal(out.sent, false); assert.equal(landed, 0);
  } finally { hop.close(); target.close(); }
});
test('presence script is a DRY RUN by default: prints a redacted request and sends nothing', async () => {
  let hit = 0; const server = createServer((q, s) => { hit++; s.writeHead(200).end('{}'); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const env = { ...process.env, ...ENV, FLASHYOS_API_URL: `http://127.0.0.1:${server.address().port}` };
    const run = (args) => new Promise((res) => { const c = spawn(process.execPath, [new URL('../../../poc/src/flashy/mesh/presence.mjs', import.meta.url).pathname, ...args], { env }); let o = ''; c.stdout.on('data', (d) => (o += d)); c.stderr.on('data', (d) => (o += d)); c.on('close', (code) => res({ code, o })); });
    const dry = await run([]); assert.equal(dry.code, 0); assert.match(dry.o, /dry run/); assert.ok(!dry.o.includes(TOKEN)); assert.equal(hit, 0);
    const bad = await run(['--send', '--every', '3']); assert.equal(bad.code, 2); assert.equal(hit, 0);
    const sent = await run(['--send']); assert.equal(sent.code, 0); assert.match(sent.o, /sent/); assert.ok(!sent.o.includes(TOKEN)); assert.equal(hit, 1);
    const none = await new Promise((res) => { const c = spawn(process.execPath, [new URL('../../../poc/src/flashy/mesh/presence.mjs', import.meta.url).pathname, '--send'], { env: { PATH: process.env.PATH } }); let o = ''; c.stderr.on('data', (d) => (o += d)); c.on('close', (code) => res({ code, o })); });
    assert.equal(none.code, 2); assert.match(none.o, /not configured/);
  } finally { server.close(); }
});
