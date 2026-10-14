// P3 (STATE.md proposals): retrievable outcomes. An agent whose response was lost retries the same signed bytes and
// used to get a bare DUPLICATE_INSTRUCTION with no way to learn what happened the first time. The network now keeps an
// index of instruction outcomes (rebuilt from the block log on recovery) and answers it by inst_id.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Network, dollars } from '../src/network.js';

const xfer = (n, amt = 1) => n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(amt).toString() }, ['ops:MPL', 'screen:MPL']);

test('the outcome of an accepted instruction can be fetched by inst_id', () => {
  const n = new Network();
  const t = xfer(n);
  const r = n.submitSigned(t);
  assert.ok(r.ok);
  const o = n.outcome(t.inst_id, n.digestOf(t));
  assert.equal(o.found, true);
  assert.equal(o.ok, true);
  assert.equal(o.type, 'TRANSFER');
  assert.equal(o.height, r.height);
  assert.equal(o.hash, r.hash);
  assert.equal(o.error, null);
});

test('a retry of an accepted instruction says DUPLICATE_INSTRUCTION and points at the original outcome', () => {
  const n = new Network();
  const t = xfer(n);
  const first = n.submitSigned(t);
  const again = n.submitSigned(t);
  assert.equal(again.ok, false);
  assert.equal(again.error, 'DUPLICATE_INSTRUCTION');
  assert.deepEqual(again.original, { ok: true, height: first.height, hash: first.hash });
  assert.equal(n.outcome(t.inst_id, n.digestOf(t)).height, first.height, 'the retry did not overwrite the first outcome');
});

test('a rejected instruction has an outcome too, and an unknown id is reported as not found', () => {
  const n = new Network();
  const bad = xfer(n, 999_999_999);
  const r = n.submitSigned(bad);
  assert.equal(r.ok, false);
  const o = n.outcome(bad.inst_id, n.digestOf(bad));
  assert.equal(o.found, true);
  assert.equal(o.ok, false);
  assert.equal(o.error, r.error);
  assert.deepEqual(n.outcome('never-seen-0001', 'a'.repeat(64)), { found: false });
  assert.deepEqual(n.outcome(42, 'a'.repeat(64)), { found: false });
  assert.deepEqual(n.outcome(undefined, undefined), { found: false });
});

test('legs of an accepted batch are answered with the batch block, so a standalone retry of a leg finds it', () => {
  const n = new Network();
  const a = xfer(n);
  const b = xfer(n, 2);
  const outer = n.tx('BATCH', { legs: [a, b] }, []);
  const r = n.submitSigned(outer);
  assert.ok(r.ok, `${r.error}: ${r.message}`);
  const o = n.outcome(a.inst_id, n.digestOf(a));
  assert.equal(o.found, true);
  assert.equal(o.ok, true);
  assert.equal(o.height, r.height);
  assert.equal(o.via, outer.inst_id);
  const retry = n.submitSigned(a);
  assert.equal(retry.error, 'DUPLICATE_INSTRUCTION');
  assert.equal(retry.original.height, r.height);
});

test('outcomes survive a restart: they are rebuilt from the block log', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'depositx-outcomes-'));
  try {
    const n = new Network({ dataDir: dir });
    const t = xfer(n);
    const r = n.submitSigned(t);
    assert.ok(r.ok);
    n.store.close();
    const m = new Network({ dataDir: dir });
    const o = m.outcome(t.inst_id, m.digestOf(t));
    assert.equal(o.found, true);
    assert.equal(o.height, r.height);
    assert.equal(o.hash, r.hash);
    assert.equal(m.submitSigned(t).original.height, r.height);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the index is bounded: the oldest outcomes are dropped, never the newest', () => {
  const n = new Network();
  n.outcomeLimit = 5;
  const ids = [];
  const txs = [];
  for (let i = 0; i < 9; i++) { const t = xfer(n); ids.push(t.inst_id); txs.push(t); n.submitSigned(t); }
  assert.equal(n.outcome(ids[0], n.digestOf(txs[0])).found, false);
  assert.equal(n.outcome(ids[8], n.digestOf(txs[8])).found, true);
});

test('an outcome is only given to someone who holds the signed bytes: the digest must match', () => {
  const n = new Network();
  const t = xfer(n);
  assert.ok(n.submitSigned(t).ok);
  assert.deepEqual(n.outcome(t.inst_id, undefined), { found: false }, 'no digest, no answer');
  assert.deepEqual(n.outcome(t.inst_id, 'f'.repeat(64)), { found: false }, 'wrong digest, no answer');
  assert.equal(n.outcome(t.inst_id, n.digestOf(t)).found, true);
});

test('a DIFFERENT instruction that reuses an accepted inst_id is refused without being told the original succeeded', () => {
  const n = new Network();
  const a = xfer(n, 1);
  assert.ok(n.submitSigned(a).ok);
  const b = n.tx('TRANSFER', { from: 'MPL:acme', to: 'MPL:harbour', amount: dollars(9000).toString() }, ['ops:MPL', 'screen:MPL'], { instId: a.inst_id });
  const r = n.submitSigned(b);
  assert.equal(r.error, 'DUPLICATE_INSTRUCTION');
  assert.equal(r.original, undefined, 'the id was used, but not by these bytes');
  assert.equal(n.outcome(a.inst_id, n.digestOf(b)).found, false);
  assert.equal(n.outcome(a.inst_id, n.digestOf(a)).ok, true, 'the real owner of the id still gets the true answer');
});

test('a duplicate rejection is never recorded as the outcome, even when the original was evicted', () => {
  const n = new Network();
  n.outcomeLimit = 2;
  const a = xfer(n);
  assert.ok(n.submitSigned(a).ok);
  for (let i = 0; i < 3; i++) assert.ok(n.submitSigned(xfer(n, 1 + i)).ok); // pushes a out of the accepted index
  assert.equal(n.outcome(a.inst_id, n.digestOf(a)).found, false);
  const retry = n.submitSigned(a);
  assert.equal(retry.error, 'DUPLICATE_INSTRUCTION');
  assert.equal(retry.original, undefined, 'unknown, not denied');
  assert.deepEqual(n.outcome(a.inst_id, n.digestOf(a)), { found: false }, 'found:false means unknown, not "never executed"');
});

test('a flood of garbage submissions cannot evict an accepted outcome', () => {
  const n = new Network();
  n.rejectionLimit = 20;
  const t = xfer(n);
  assert.ok(n.submitSigned(t).ok);
  for (let i = 0; i < 200; i++) n.submitSigned({ inst_id: `garbage-${i}-xxxxxxxx`, type: 'TRANSFER', valid_until: n.now() + 10, sigs: {}, payload: {} });
  assert.equal(n.outcome(t.inst_id, n.digestOf(t)).ok, true);
  assert.ok(n.rejections.size <= 20);
});
