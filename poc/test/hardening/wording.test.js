// Phase 0.2: the wording guard. Every public surface (charter, READMEs, the dashboard, the API documents) must keep saying
// what DepositX is: simulated, a proof of concept, no bank partner, not regulated, not live. The claim-word scan in
// claims.test.js separately refuses final / live / settled / regulated ... without a qualifier in the same sentence; this
// file is the positive half (the disclaimer must be PRESENT) and the uppercase badge check.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { Network, dollars } from '../../src/network.js';
import { openapiDocument } from '../../src/flashy/mesh/openapi.js';
import { receiptView } from '../../src/flashy/mesh/receipt.js';
import { computeMeasures } from '../../src/flashy/measures.js';
import { labelState } from '../../src/flashy/mesh/surface.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (f) => fs.readFileSync(path.join(REPO, f), 'utf8');
const norm = (s) => String(s).toLowerCase().replace(/[*`_]/g, '').replace(/&mdash;|—|–/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

export const PHRASES = {
  simulated: /\bsimulated\b/,
  'proof of concept': /proof[- ]of[- ]concept/,
  'no bank partner': /no bank partner/,
  'not regulated': /not regulated/,
  'not live': /not live/,
};
const ALL = Object.keys(PHRASES);
const STATUS = ['simulated', 'proof of concept'];

/** which required phrases a text lacks */
export const missing = (text, required) => required.filter((k) => !PHRASES[k].test(norm(text)));

const FILES = [
  ['root README', 'README.md', ALL],
  ['poc README', 'poc/README.md', ALL],
  ['dashboard', 'poc/public/index.html', ALL],
  ['readiness notes', 'flashy/mesh/READINESS.md', ALL],
  ['evidence story', 'flashy/mesh/EVIDENCE.md', ALL],
];
for (const [name, file, required] of FILES) {
  test(`${name} keeps the whole disclaimer: ${required.join(', ')}`, () => { assert.deepEqual(missing(read(file), required), [], file); });
}

test('the charter description and every role carry the disclaimer', () => {
  const c = JSON.parse(read('flashy/mesh/flashyos-charter.json'));
  assert.deepEqual(missing(c.description, [...ALL, 'not live']), []);
  assert.match(norm(c.description), /not final/);
  for (const r of c.roles) assert.deepEqual(missing(`${r.purpose} ${r.measure}`, ['simulated']), [], r.name);
});

test('the OpenAPI description carries the disclaimer', () => {
  const d = openapiDocument();
  assert.deepEqual(missing(d.info.description, ALL), []);
  assert.equal(d['x-simulated'], true);
});

test('every machine-readable document says it is simulated: state, receipt, measures', () => {
  const n = new Network();
  n.pay('MPL:acme', 'NSR:cedar', dollars(5));
  const state = labelState(n.snapshot());
  assert.equal(state.simulated, true); assert.match(norm(state.simulationNote), /simulated validators/);
  const rc = receiptView(n, n.blocks.at(-1).height);
  assert.equal(rc.simulated, true); assert.match(norm(rc.label), /simulated validators/);
  const m = computeMeasures(n);
  assert.equal(m.simulated, true); assert.match(norm(m.basis), /simulated/); assert.match(norm(m.basis), /proof of concept/);
});

// ---- over HTTP: the schema document too (what an agent reads first) ----
let nextPort = 19500 + Math.floor(Math.random() * 200) * 2;
const get = (port, p) => new Promise((resolve, reject) => { const r = request({ host: '127.0.0.1', port, path: p }, (res) => { let b = ''; res.on('data', (c) => (b += c)); res.on('end', () => resolve({ status: res.statusCode, text: b })); }); r.on('error', reject); r.end(); });
test('GET /api/schema, /api/state and the dashboard page say simulated, over a real socket', async () => {
  const port = nextPort;
  const child = spawn(process.execPath, [path.join(REPO, 'poc/src/server.js')], { env: { PATH: process.env.PATH, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; child.stdout.on('data', (d) => (out += d));
  try {
    for (let i = 0; i < 100 && !/running at/.test(out); i++) await new Promise((r) => setTimeout(r, 50));
    const schema = JSON.parse((await get(port, '/api/schema')).text);
    assert.equal(schema.simulated, true); assert.match(norm(schema.simulationNote), /simulated/);
    assert.equal(JSON.parse((await get(port, '/api/state')).text).simulated, true);
    assert.deepEqual(missing((await get(port, '/')).text, ALL), []);
  } finally { child.kill('SIGTERM'); await once(child, 'close'); }
});

test('no public text shows a LIVE badge or the phrases "live network", "goes live", "final settlement" outside a negation', () => {
  for (const f of ['README.md', 'poc/README.md', 'poc/public/index.html', 'flashy/mesh/READINESS.md', 'poc/src/server.js', 'poc/src/network.js', 'poc/src/flashy/mesh/surface.js']) {
    const t = read(f);
    assert.ok(!/\bLIVE\b/.test(t), `${f}: uppercase LIVE`);
    for (const m of t.matchAll(/live network|goes live|go live|now live|is live|final settlement/gi)) {
      const before = t.slice(Math.max(0, m.index - 80), m.index).split(/[.;\n]/).pop();
      assert.ok(/\b(not|no|never|nor|nothing|simulated|until|before|neither)\b/i.test(before), `${f}: "${m[0]}" with no negation or simulated qualifier in "${before.trim()}"`);
    }
  }
});

// ---- the guard itself must be able to fail ----
test('REFUSAL: the guard reports each missing phrase', () => {
  for (const k of ALL) {
    const text = ALL.filter((x) => x !== k).map((x) => ({ simulated: 'simulated', 'proof of concept': 'proof of concept', 'no bank partner': 'no bank partner', 'not regulated': 'not regulated', 'not live': 'not live' }[x])).join('. ');
    assert.deepEqual(missing(text, ALL), [k]);
  }
});
test('REFUSAL: look-alikes do not satisfy the guard', () => {
  for (const t of ['Fully regulated and live.', 'a regulated bank rail', 'simulate', 'proof, of concept', 'no banks partner', 'now live', 'unregulated', 'not alive']) assert.ok(missing(t, ALL).length > 0, t);
  assert.ok(missing('not live', ['not live']).length === 0);
  assert.deepEqual(missing('', STATUS), STATUS);
});
