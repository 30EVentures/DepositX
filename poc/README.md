# Concord proof of concept

A working, runnable model of the Concord ledger kernel from `../02-technical-implementation.md`:
per-issuer deposit tokens, prefunded settlement positions, atomic cross-bank payment and DvP,
Escrow/PayOnEvent/Batch/Standing-Sweep (the spec's full Phase 1+2 template launch set, §2.5),
liquidity-saving netting, the seven par invariants (P1–P7), and the graded halt
(quarantine one issuer vs halt the network). Zero dependencies; Node 20+.

```
cd ~/Concord/poc
npm test                                  # 60 tests (~45 s)
npm start                                 # dashboard at http://127.0.0.1:8787 (in memory)
CONCORD_DATA=./data npm start             # same, durable: survives restarts, tamper-evident
npm run bench                             # kernel throughput
node src/modelcheck.js 6                  # explicit-state model check: ~12,000 states, ~100 s
```

ISO 20022 over HTTP (with the server running):

```
curl -s 'http://127.0.0.1:8787/api/iso/sample?amount=250.00' > pay.xml
curl -s -X POST --data-binary @pay.xml http://127.0.0.1:8787/api/iso/pacs008     # -> pacs.002 (ACSC)
curl -s -X POST --data-binary @pay.xml http://127.0.0.1:8787/api/iso/pacs008     # -> RJCT / DUPL
```

## What it demonstrates

| Spec claim | Where it is proven |
|---|---|
| Atomic: all legs or none | `kernel.js` undo journal; tests: failed DvP/payment leaves state byte-identical |
| No unbacked mint (two independent keys) | `tx_OPEN_HOLD` (attestation key) + `tx_MINT` (mint key); test + "Unbacked mint" button |
| Par transfer, settlement backing | `assertParLegs`, P3/P4; cross-bank payment moves tokens and positions 1:1 |
| Graded halt | `checkInvariants` + `#endOfBlock`: over-issuance and conservation breaks halt the network; core lag quarantines one issuer; quarantine escalates after 15 min |
| Restart is expensive (P7) | `tx_RESUME` needs both governance keys + BoC observer key (+ the issuer's key for an issuer resume) and the invariants must hold again |
| Anyone can pull the fire alarm | `tx_REPORT_PAR_BREAK` with any reconciler key |
| Netting | `tx_NET_CYCLE` gridlock resolution; mutual $5k payments net to zero on a $1k position |
| Escrow, held at the beneficiary's issuer (T4) | `tx_ESCROW_LOCK/RELEASE/REFUND`: lock is a Transfer/Convert into a reserved-id account, so no new conservation math; refund only after expiry (`escrow.test.js`) |
| PayOnEvent (T5) | `tx_EVENT_RELEASE`: release gated on a named oracle signature registered in genesis, checked against the escrow's *own* stored event name, not the caller's claim (`escrow.test.js`) |
| Batch, several legs atomic (T7) | `tx_BATCH` dispatches each leg to its own existing handler against the same journal `#execTx` already rolls back on any error — no separate rollback logic; nesting is rejected explicitly (`batch.test.js`) |
| Standing/Sweep, same-issuer (T6) | `tx_REGISTER_SWEEP` + `#runSweeps`, fired deterministically at `#endOfBlock` — the same hook the graded halt already runs from, so no separate instruction is needed for it to take effect (`sweep.test.js`) |
| Deterministic, replayable | `verifyReplay()` rebuilds every block hash and state root from genesis, including Escrow/Sweep/Batch state; also detects out-of-band corruption |
| Offline-verifiable finality receipt | `Network.verifyReceipt`: header hash + ≥3 of 4 validator signatures |
| Crash recovery, tamper evidence | `store.js`: fsync'd hash-chained block log; recovery replays every block and requires the same hash; a torn tail is dropped; an edited, dropped or reordered block is refused (`store.test.js`) |
| Every state, not just sampled ones, is safe | `modelcheck.js`: explicit-state search over the real kernel incl. a lagging core, attacks, and the four new templates (37 actions; safety S1–S5, liveness L1). Routine test: 3,560 states / 36,556 transitions to depth 5; a one-off deeper run reached 12,181 states / 131,720 transitions to depth 6. No violation either way. Seven planted bugs are all caught (`modelcheck.test.js`) — three of them by the *existing* P1/S2/S3 properties with no new checker code, and one honest limit found: a sweep moving the wrong amount trips no safety invariant (see `docs/invariant-charter.md`) |
| ISO 20022 in and out (L5) | `iso20022.js`: `pacs.008` in, `pacs.002` out with reason codes; UETR is the instruction id; DTD/entity/malformed input refused |
| Screening enforced at the edge | bank compliance refuses to sign; the kernel refuses any instruction without the screening signature |
| M2 confidentiality: issuer-domain need-to-know | `confidentialView` in `network.js`, a pure view over `snapshot()` — an issuer sees its own book in full and every other issuer's status only, never its balances or customers; the Bank of Canada observer / operator sees everything, unchanged. The kernel and its invariants are untouched — this is access control, not cryptography, matching the spec's own description of M2 (`confidentiality.test.js`; the dashboard's "Viewing as" selector) |

## What it is NOT

- **No consensus.** A four-validator quorum is simulated in one process (real Ed25519 signatures over the block hash; nothing ever disagrees). CometBFT / a real BFT engine is the next step.
- **Not the production stack.** The spec calls for a Rust kernel; this is Node so it runs anywhere today. The semantics are what matter; the port is mechanical.
- **The model checker is bounded** (small alphabet, two banks plus one extra account so Escrow/Sweep have a same-issuer destination, state cap). A sweep moving the wrong amount is a bug class its safety properties do not cover at all - see `docs/invariant-charter.md` for exactly what is and is not covered.
- **No real cryptographic confidentiality**: no ZK (mode M1), no HSMs (the dev keystore is a 0600 file), no real network. Mode **M2** (issuer-domain need-to-know) is built as an access-control view — see `confidentialView` in `src/network.js` and the dashboard's "Viewing as" selector — since the spec itself says M2 needs no cryptography, only the default mode M0 (everyone sees everything) is still what a fresh network runs unless a view is requested.
- **Toy core banking.** The bank simulator is a few dozen lines; real cores are the hard part (see the onboarding playbook).
- **Simplifications:** account IDs are readable (`MPL:acme`), not hashed commitments; one screening key per bank; the anchor is a mock; time is supplied per block.
- The benchmark measures one validator's execution stage on one core with everything signed and verified. It is an upper bound, not end-to-end finality.

## Files

- `src/kernel.js` — the state machine (pure, deterministic; no clock, randomness or I/O)
- `src/network.js` — banks, adapters, anchor, simulated validators, action layer, snapshots
- `src/bank.js` — toy core banking
- `src/server.js` + `public/index.html` — dashboard (binds to 127.0.0.1 only)
- `src/store.js` — durable hash-chained block log
- `src/modelcheck.js` — explicit-state model checker
- `src/iso20022.js` — pacs.008 / pacs.002 gateway
- `docs/invariant-charter.md` — the seven invariants, where each is enforced, what checks it, and the limits
- `test/*.test.js` — kernel, escrow/PayOnEvent, batch, sweep, storage, model check (with mutation tests), ISO 20022
