// Wires the presence reporter to the SIMULATED network. Presence only: a status and one fixed label per state, never an
// account, amount, issuer, hash or instruction. Inert (no listener, no timer) unless the reporter is configured.
// It only READS the ledger's halt flag and issuer statuses; it cannot change a block, the kernel or the graded halt, and
// nothing it does can throw into the network: every call is guarded and no heartbeat is awaited.
export const TASKS = Object.freeze({
  started: 'simulated network started',
  block: 'simulated block processed',
  halted: 'simulated network halted',
  quarantined: 'simulated issuer quarantined',
  running: 'simulated network running',
  sweep: 'simulated sweep fired',
  refused: 'simulated authorization refused',
  idle: '',
});

// Refusals that mean "a caller was not authorised" (a signature, a grant, an envelope). A refusal for any other reason
// (funds, caps, duplicates, validity) is an ordinary block, not a review.
export const AUTH_REFUSALS = new Set(['BAD_SIGNATURE', 'MISSING_SIGNATURE', 'ESCALATION_REQUIRED', 'ENVELOPE_DENIED', 'GRANT_REVOKED', 'GRANT_EXPIRED', 'GRANT_MISMATCH', 'GRANT_WRONG_ISSUER', 'CALLER_MISMATCH', 'UNKNOWN_GRANT', 'REVOKE_NOT_AUTHORISED', 'SWEEP_WRONG_GRANT', 'ESCROW_WRONG_GRANT', 'MULTIPLE_AGENT_SIGS']);

/** The phase of one recorded block: incident > refused > sweep > block. Reads only booleans and counts, never contents. */
export function classifyBlock(block, halted) {
  if (halted) return 'incident';
  if (!block || typeof block !== 'object') return 'block';
  if (Array.isArray(block.violations) && block.violations.length > 0) return 'incident';
  if (Array.isArray(block.results) && block.results.some((r) => r && r.ok === false && AUTH_REFUSALS.has(r.error))) return 'refused';
  if (Array.isArray(block.sweepFires) && block.sweepFires.some((f) => f && !f.suspended && typeof f.amount === 'string' && f.amount !== '0')) return 'sweep';
  return 'block';
}

const INERT = Object.freeze({ configured: false, tick() {}, detach() {}, state() { return 'inert'; } });

export function attachMeshReporter(net, { reporter, now = Date.now, timers = globalThis, minIntervalMs = 10_000, idleAfterMs = 60_000, keepaliveMs = 60_000 } = {}) {
  if (!reporter || !reporter.configured) return INERT;

  let lastKey = null;
  let lastBlockAt = now();
  let lastBlockSentAt = -Infinity;
  let alive = true;

  const send = (status, task, key) => {
    lastKey = key;
    try {
      const p = reporter.heartbeat(status, task, 0);
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* presence must never reach the network */ }
  };
  const read = () => {
    try {
      const s = net.ledger.s;
      if (s.halt) return 'halted';
      for (const i of s.issuers.values()) if (i.status !== 'ACTIVE') return 'quarantined';
    } catch { /* unreadable: report nothing alarming */ }
    return 'ok';
  };
  const incident = (st) => send('INCIDENT', TASKS[st], st);

  const onEvent = (ev) => {
    if (!ev || ev.type !== 'block' || !Number.isSafeInteger(ev.height)) return;
    const t = now();
    lastBlockAt = t;
    const st = read();
    if (st !== 'ok') { if (lastKey !== st) incident(st); return; }
    if (lastKey === 'halted' || lastKey === 'quarantined') { send('ACTIVE', TASKS.running, 'running'); return; }
    if (t - lastBlockSentAt >= minIntervalMs) {
      lastBlockSentAt = t;
      const kind = classifyBlock(net.blocks[net.blocks.length - 1], false);
      if (kind === 'refused') send('REVIEWING', TASKS.refused, 'refused');
      else if (kind === 'sweep') send('BUILDING', TASKS.sweep, 'sweep');
      else send('ACTIVE', TASKS.block, 'block');
    }
  };
  const listener = (ev) => { try { onEvent(ev); } catch { /* never throws into submit() */ } };

  const tick = () => {
    try {
      const st = read();
      if (st !== 'ok') incident(st);
      else if (now() - lastBlockAt > idleAfterMs) send('IDLE', TASKS.idle, 'idle');
      else send('ACTIVE', TASKS.running, 'running');
    } catch { /* keepalive is best effort */ }
  };

  net.listeners.add(listener);
  send('ACTIVE', TASKS.started, 'started');
  let handle = null;
  try {
    handle = timers.setInterval(tick, keepaliveMs);
    if (handle && typeof handle.unref === 'function') handle.unref();
  } catch { handle = null; }

  return {
    configured: true,
    tick,
    state: () => lastKey,
    detach() {
      if (!alive) return;
      alive = false;
      net.listeners.delete(listener);
      try { timers.clearInterval(handle); } catch { /* already gone */ }
    },
  };
}
