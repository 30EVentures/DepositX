// The machine-callable surface of the SIMULATED network: discovery files, an OpenAPI description with closed schemas,
// receipts, measures, a closed schema for the demo action endpoint, and an opt-in agent mode that refuses by default
// every endpoint where the server signs on the caller's behalf.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Network, dollars } from '../../src/network.js';
import { meshRoute, modeGate, labelState, CHARTER_FILE } from '../../src/flashy/mesh/surface.js';
import { validateAction, ACTION_KINDS } from '../../src/flashy/mesh/action-schema.js';
import { openapiDocument } from '../../src/flashy/mesh/openapi.js';
import { verifyReceiptDocument } from '../../src/flashy/mesh/verify-receipt.mjs';

const net = new Network();
net.pay('MPL:acme', 'NSR:cedar', dollars(5));
const route = (pathname, { method = 'GET', search = '', env = {} } = {}) => meshRoute({ net, method, pathname, search, env });
const err = (r) => r.body.error;

test('the charter is served byte for byte as a public JSON document', () => {
  const r = route('/.well-known/flashyos-charter.json');
  assert.equal(r.status, 200);
  assert.match(r.type, /^application\/json/);
  assert.equal(r.headers['access-control-allow-origin'], '*');
  assert.equal(r.raw, fs.readFileSync(CHARTER_FILE, 'utf8'));
});

test('REFUSAL: the handshake is not served until a public profile URL is configured', () => {
  const r = route('/.well-known/flashyos.json');
  assert.equal(r.status, 404);
  assert.equal(err(r), 'NOT_CONFIGURED');
});

for (const bad of ['http://example.com', 'ftp://example.com', 'javascript:alert(1)', 'https://u:p@example.com', 'https://example.com/?a=1', 'https://example.com/#x', 'nonsense', '', 'https://', 'https://localhost', 'https://127.0.0.1', 'https://[::1]/', 'file:///etc/passwd', 'https://exa mple.com']) {
  test(`REFUSAL: handshake profile ${JSON.stringify(bad)}`, () => {
    const r = route('/.well-known/flashyos.json', { env: { DEPOSITX_PROFILE_URL: bad } });
    assert.equal(r.status, 404);
    assert.equal(err(r), 'NOT_CONFIGURED');
  });
}

test('the handshake, once a public https profile is configured, declares no capabilities', () => {
  const r = route('/.well-known/flashyos.json', { env: { DEPOSITX_PROFILE_URL: 'https://depositx.example.org' } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { mesh: 'flashyos/1', org: { slug: 'depositx', name: 'DepositX', profile: 'https://depositx.example.org' } });
  assert.ok(!('capabilities' in r.body));
});

test('the API catalog is an RFC 9727 linkset pointing at the OpenAPI description', () => {
  const r = route('/.well-known/api-catalog');
  assert.equal(r.status, 200);
  assert.match(r.type, /^application\/linkset\+json/);
  assert.equal(r.body.linkset[0]['service-desc'][0].href, '/api/openapi.json');
});

test('REFUSAL: an unknown well-known file is a closed 404, and a write to a read-only file is a 405', () => {
  const nf = route('/.well-known/other.json');
  assert.deepEqual([nf.status, err(nf)], [404, 'NOT_FOUND']);
  for (const p of ['/.well-known/flashyos-charter.json', '/.well-known/api-catalog', '/api/openapi.json', '/api/measures', '/api/receipt/1']) for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
    const r = route(p, { method });
    assert.equal(r.status, 405, `${method} ${p}`);
    assert.equal(r.headers.allow, 'GET');
    assert.equal(err(r), 'METHOD_NOT_ALLOWED');
  }
});

// -------------------------------------------------------------------- OpenAPI
function closedProblems(node, path = '#') {
  const out = [];
  if (Array.isArray(node)) { node.forEach((v, i) => out.push(...closedProblems(v, `${path}/${i}`))); return out; }
  if (node && typeof node === 'object') {
    if (node.type === 'object' && node.properties && node.additionalProperties !== false) out.push(path);
    for (const [k, v] of Object.entries(node)) out.push(...closedProblems(v, `${path}/${k}`));
  }
  return out;
}
test('the OpenAPI description closes every object schema it defines', () => {
  const d = openapiDocument();
  assert.equal(d.openapi.startsWith('3.1'), true);
  assert.deepEqual(closedProblems(d), []);
});
test('the OpenAPI description says what this is, lists the refusals, and offers no remote server', () => {
  const d = openapiDocument();
  assert.match(d.info.description, /simulated/i);
  assert.match(d.info.description, /proof of concept/i);
  assert.match(d.info.description, /no bank partner/i);
  assert.ok(!('servers' in d) || d.servers.every((s) => /^http:\/\/127\.0\.0\.1/.test(s.url)));
  for (const [p, ops] of Object.entries(d.paths)) for (const [m, op] of Object.entries(ops)) {
    assert.ok(op.summary, `${m} ${p}`);
    assert.ok(Object.keys(op.responses).some((c) => /^4/.test(c)), `${m} ${p} documents a refusal`);
  }
  assert.ok(d.paths['/api/submit'].post.requestBody.content['application/json'].schema.additionalProperties === false);
  assert.ok(d.paths['/api/receipt/{height}']);
  assert.ok(d.paths['/api/measures']);
  assert.ok(d.paths['/api/instruction/{inst_id}']);
});
test('every documented path is a path the server actually answers (no phantom endpoints)', () => {
  const server = fs.readFileSync(new URL('../../src/server.js', import.meta.url), 'utf8') + fs.readFileSync(new URL('../../src/flashy/mesh/surface.js', import.meta.url), 'utf8');
  for (const p of Object.keys(openapiDocument().paths)) assert.ok(server.includes(p.replace(/\/\{.*$/, '')), p);
});

// -------------------------------------------------------------------- receipts and measures over the route
test('a receipt route answers with a document the standalone verifier accepts', () => {
  const h = net.blocks.at(-1).height;
  const r = route(`/api/receipt/${h}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.simulated, true);
  assert.equal(verifyReceiptDocument(r.body).valid, true);
});
for (const [what, p, status, code] of [
  ['zero', '/api/receipt/0', 400, 'BAD_HEIGHT'], ['negative', '/api/receipt/-1', 400, 'BAD_HEIGHT'], ['fraction', '/api/receipt/1.5', 400, 'BAD_HEIGHT'],
  ['letters', '/api/receipt/abc', 400, 'BAD_HEIGHT'], ['exponent', '/api/receipt/1e1', 400, 'BAD_HEIGHT'], ['leading zero', '/api/receipt/01', 400, 'BAD_HEIGHT'],
  ['hex', '/api/receipt/0x1', 400, 'BAD_HEIGHT'], ['empty', '/api/receipt/', 400, 'BAD_HEIGHT'], ['huge', '/api/receipt/99999999999999999999', 400, 'BAD_HEIGHT'],
  ['past the end', '/api/receipt/999999', 404, 'NOT_RETAINED'], ['traversal', '/api/receipt/../state', 400, 'BAD_HEIGHT'], ['nested', '/api/receipt/1/2', 400, 'BAD_HEIGHT'],
  ['encoded slash', '/api/receipt/1%2f2', 400, 'BAD_HEIGHT'], ['bad escape', '/api/receipt/%E0%A4%A', 400, 'BAD_HEIGHT'],
]) test(`REFUSAL: receipt height ${what}`, () => { const r = route(p); assert.deepEqual([r.status, err(r)], [status, code]); });
test('REFUSAL: receipts and measures take no query parameters', () => {
  for (const p of [`/api/receipt/${net.blocks.at(-1).height}`, '/api/measures', '/api/openapi.json', '/.well-known/api-catalog']) {
    const r = route(p, { search: '?x=1' });
    assert.deepEqual([r.status, err(r)], [400, 'UNKNOWN_PARAMETER'], p);
  }
});
test('the measures route reports the two charter numbers, labelled simulated', () => {
  const r = route('/api/measures');
  assert.equal(r.status, 200);
  assert.equal(r.body.simulated, true);
  assert.ok(r.body.replay.total > 0);
});

// -------------------------------------------------------------------- agent mode refuses by default
test('REFUSAL: in agent mode every endpoint where the server signs for the caller (or burns CPU) is refused', () => {
  for (const [method, pathname] of [['POST', '/api/action'], ['POST', '/api/iso/pacs008'], ['GET', '/api/bench']]) {
    const r = modeGate({ method, pathname, env: { DEPOSITX_MODE: 'agent' } });
    assert.equal(r.status, 403, `${method} ${pathname}`);
    assert.equal(r.body.error, 'DEMO_ACTIONS_DISABLED');
  }
});
test('REFUSAL: any DEPOSITX_MODE other than the exact word demo is agent mode (fail closed)', () => {
  for (const v of ['agent', 'AGENT', 'Demo', 'demo ', '1', 'true', 'prod', 'x']) assert.equal(modeGate({ method: 'POST', pathname: '/api/action', env: { DEPOSITX_MODE: v } }).status, 403, JSON.stringify(v));
});
test('demo mode (the default) leaves the demo endpoints alone, and agent mode leaves the agent endpoints alone', () => {
  assert.equal(modeGate({ method: 'POST', pathname: '/api/action', env: {} }), null);
  assert.equal(modeGate({ method: 'POST', pathname: '/api/action', env: { DEPOSITX_MODE: 'demo' } }), null);
  for (const [method, pathname] of [['POST', '/api/submit'], ['GET', '/api/schema'], ['GET', '/api/state'], ['GET', '/api/verify'], ['GET', '/api/grants']]) assert.equal(modeGate({ method, pathname, env: { DEPOSITX_MODE: 'agent' } }), null, pathname);
});

// -------------------------------------------------------------------- closed schema for the demo action endpoint
test('every action the dashboard sends passes the closed schema (ground truth read from the dashboard source)', () => {
  const html = fs.readFileSync(new URL('../../public/index.html', import.meta.url), 'utf8');
  const kinds = new Set();
  for (const m of html.matchAll(/act\(\{ kind: '(\w+)'([^}]*)\}/g)) {
    kinds.add(m[1]);
    const body = { kind: m[1] };
    for (const f of m[2].matchAll(/,\s*(\w+):/g)) body[f[1]] = f[1] === 'queue' || f[1] === 'eventGated' || f[1] === 'on' ? true : f[1] === 'seconds' || f[1] === 'qty' ? 10 : f[1] === 'scope' ? 'network' : f[1] === 'type' ? 'inflate' : f[1] === 'issuer' ? 'MPL' : 'x1';
    if (m[1] === 'resume' && body.issuer) body.scope = 'issuer';
    assert.deepEqual(validateAction(body), [], `${m[1]} ${JSON.stringify(body)}`);
  }
  assert.ok(kinds.size >= 15, `found ${kinds.size} kinds in the dashboard`);
  for (const k of kinds) assert.ok(ACTION_KINDS.includes(k), k);
});
test('REFUSAL: the action schema is closed: unknown kinds, unknown fields, wrong types, bad bodies', () => {
  const bad = [
    null, undefined, 5, 'x', [], [{ kind: 'pay' }], {}, { kind: 5 }, { kind: 'nope' }, { kind: '__proto__' }, { kind: 'constructor' }, { kind: 'toString' },
    { kind: 'net', extra: 1 }, { kind: 'reset', force: true }, { kind: 'pay', from: 'MPL:acme', to: 'NSR:cedar', amount: '1', secret: 'x' },
    { kind: 'pay', from: 5, to: 'NSR:cedar', amount: '1' }, { kind: 'pay', from: 'MPL:acme', to: 'NSR:cedar', amount: {} }, { kind: 'pay', from: 'MPL:acme', to: 'NSR:cedar', amount: '1', queue: 'yes' },
    { kind: 'pay', from: 'MPL:acme' }, { kind: 'mint', issuer: 'ZZZ', customer: 'x', amount: '1' }, { kind: 'chaos', type: 'format-disk' }, { kind: 'chaos' },
    { kind: 'advance', seconds: 'soon' }, { kind: 'corePause', on: 'true' }, { kind: 'resume', scope: 'everything' }, { kind: 'pay', from: 'x'.repeat(500), to: 'y', amount: '1' },
    JSON.parse('{"kind":"net","__proto__":{"admin":true}}'),
  ];
  for (const b of bad) assert.ok(validateAction(b).length > 0, JSON.stringify(b));
});

// -------------------------------------------------------------------- state labelling
test('the state view is labelled simulated at the top and on every block, without losing a field', () => {
  const s = { height: 3, blocks: [{ height: 3, hash: 'h', receiptOk: true }, { height: 2, hash: 'g', receiptOk: true }], issuers: [] };
  const copy = JSON.parse(JSON.stringify(s));
  const out = labelState(s);
  assert.deepEqual(s, copy, 'the input is not mutated');
  assert.equal(out.simulated, true);
  assert.match(out.simulationNote, /simulated/i);
  assert.ok(out.blocks.every((b) => /simulated/i.test(b.receiptLabel)));
  for (const k of Object.keys(s)) assert.ok(k in out);
  assert.equal(out.blocks[0].hash, 'h');
});
test('REFUSAL: the labelling helper does not throw on odd input', () => {
  for (const v of [null, undefined, 5, 'x', [], {}, { blocks: 'x' }]) assert.doesNotThrow(() => labelState(v));
});
test('REFUSAL: paths the surface does not own fall through untouched', () => {
  for (const p of ['/api/state', '/api/schema', '/api/other', '/', '/index.html', '/api/receipts', '/api/receiptx/1']) assert.equal(route(p), null, p);
});
