# DepositX proof of concept

A working, runnable model of the DepositX ledger kernel from `../02-technical-implementation.md`:
per-issuer deposit tokens, prefunded settlement positions, atomic cross-bank payment and DvP,
Escrow/PayOnEvent/Batch/Standing-Sweep (the spec's full Phase 1+2 template launch set, §2.5),
liquidity-saving netting, the seven par invariants (P1–P7), and the graded halt
(quarantine one issuer vs halt the network). Zero dependencies; Node 20+.

The dashboard is a human-convenience shell, not the primary interface: every button in
`public/index.html` calls the same `GET /api/state` / `POST /api/action` JSON API that any
other caller — a script, a test, or an autonomous agent — can call directly (see `curl`
examples below and the ISO 20022 endpoints). That's deliberate: state is machine-readable
and independently verifiable (offline-checkable finality receipts, replayable block log)
before it is human-readable, not the other way around. Every instruction can also declare
who produced it — `caller: { kind: 'human'|'agent' }`, cryptographically bound to the
signature (roadmap 5.1) — so a supervisory query can tell a bank's own automation from a
human at that same bank's terminal. See "What it is NOT" for the honest limit of that: it's
self-attested by the key holder, not independently verified.

```
cd ~/DepositX/poc
npm test                                  # 209 tests (~75 s)
npm start                                 # dashboard at http://127.0.0.1:8787 (in memory)
DEPOSITX_DATA=./data npm start             # same, durable: survives restarts, tamper-evident
npm run bench                             # kernel throughput
node src/modelcheck.js 6                  # explicit-state model check: ~12,000 states, ~100 s
node src/modelcheck.js 20 delegation      # agent-delegation model, exhausted: 1,767 states, ~27 s
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
| External-CSD DvP (section 2.4's own named scenario) | `Network.externalCsdDvp`/`csdConfirm`: the spec's own conditional (not atomic) bond settlement — the security lives at an outside depository, so only the cash leg is on DepositX, released by a signed `csd-confirmation` oracle with a deadline and refund path. **Residual risk window, stated plainly:** from lock to confirmation-or-deadline, exactly `[now, now + deadlineSeconds]` — cash cannot be refunded early, and cannot be stranded past the deadline. A confirmation that arrives after the deadline still succeeds if nobody has refunded first; this is a documented real risk of the design, not a silently-assumed one (`external-csd-dvp.test.js`) |
| Batch, several legs atomic (T7) | `tx_BATCH` dispatches each leg to its own existing handler against the same journal `#execTx` already rolls back on any error — no separate rollback logic; nesting is rejected explicitly (`batch.test.js`) |
| Standing/Sweep, same-issuer (T6) | `tx_REGISTER_SWEEP` + `#runSweeps`, fired deterministically at `#endOfBlock` — the same hook the graded halt already runs from, so no separate instruction is needed for it to take effect (`sweep.test.js`). A sweep is held to the liveness TRANSFER enforces: it is *suspended* (registered, visible, moving nothing, reported with a reason) during a network halt, while its issuer is quarantined, and from or to a frozen or KYC-expired account, and fires again by itself when the condition clears (hardening X2, `sweep-liveness.test.js`). Suspending under quarantine is stricter than TRANSFER, which still accepts same-issuer moves there; the model checker does not exercise any of these conditions (see `docs/invariant-charter.md`) |
| Deterministic, replayable | `verifyReplay()` rebuilds every block hash and state root from genesis, including Escrow/Sweep/Batch state; also detects out-of-band corruption |
| Offline-verifiable finality receipt | `Network.verifyReceipt`: header hash + ≥3 of 4 validator signatures |
| Crash recovery, tamper evidence | `store.js`: fsync'd hash-chained block log; recovery replays every block and requires the same hash; a torn tail is dropped; an edited, dropped or reordered block is refused (`store.test.js`) |
| Every state, not just sampled ones, is safe | `modelcheck.js`: explicit-state search over the real kernel incl. a lagging core, attacks, and the four new templates (37 actions; safety S1–S5, liveness L1). Routine test: 3,560 states / 36,556 transitions to depth 5; a one-off deeper run reached 12,181 states / 131,720 transitions to depth 6. No violation either way. Seven planted bugs are all caught (`modelcheck.test.js`) — three of them by the *existing* P1/S2/S3 properties with no new checker code, and one honest limit found: a sweep moving the wrong amount trips no safety invariant (see `docs/invariant-charter.md`) |
| ISO 20022 in and out (L5) | `iso20022.js`: `pacs.008` in, `pacs.002` out with reason codes; UETR is the instruction id; DTD/entity/malformed input refused |
| Screening enforced at the edge | bank compliance refuses to sign; the kernel refuses any instruction without the screening signature |
| M2 confidentiality: issuer-domain need-to-know | `confidentialView` in `network.js`, a pure view over `snapshot()` — an issuer sees its own book in full and every other issuer's status only, never its balances or customers; the Bank of Canada observer / operator sees everything, unchanged. The kernel and its invariants are untouched — this is access control, not cryptography, matching the spec's own description of M2 (`confidentiality.test.js`; the dashboard's "Viewing as" selector) |
| Caller-type attribution: a supervisory query can tell a human-initiated instruction from an agent-initiated one | `caller: { kind, label? }` on every instruction, included in the signed digest via `messageOf()` — as tamper-evident as `payload` itself; relabelling it after signing is a `BAD_SIGNATURE`, not a silent edit. Self-attested by whoever holds the signing key, not independently verified — the key still authenticates the institution, `caller.kind` is that signer's own declaration. Omitted, it defaults to `unspecified` with no migration needed. Surfaced in the block log and the dashboard (`caller-attribution.test.js`) |
| Agent-native access: bounded, narrowing, revocable delegation; the caller is derived, not declared | An institution's `ops` key signs an on-ledger `GRANT`: an agent key may sign only the named types (`TRANSFER`, `PAYMENT`, `ESCROW_LOCK`/`REFUND`, `REGISTER_SWEEP`/`CANCEL_SWEEP`, and the right to sub-delegate) inside a mandatory envelope — per-instruction max, tumbling-window cap, counterparty allow-list, expiry. A sub-grant can only narrow its parent, and its spend counts against *every ancestor's* window. In-envelope is ALLOW; over it needs the institution's own signature as well (ESCALATE) or is refused; out-of-scope is refused (DENY). Revocation is in-block and cascades to every descendant. For an agent-signed instruction the kernel *derives* `caller` from the grant. Mint, redeem, DvP, funding, halt/resume and netting can never be granted. Agent-facing interface: `POST /api/submit` (the caller signs; the server never does), `GET /api/schema` (types, required signatures, error catalog with `retryable`/`remedy`), `GET /api/grants` (live status and window headroom). A sweep registered under a grant is bounded by it at every firing, and a batch takes its caller from its legs. Unlike 5.1, this gates authority (P6), so it *is* model-checked: property S6 by an oracle that shares no code with the kernel, exhausted at depth 13 (1,767 states, 37,107 transitions), with seven planted bugs caught (`delegation.test.js`, `agent-interface.test.js`, `modelcheck.test.js`; design and amendments in `docs/agent-native-access-proposal.md`) |
| No pre-authentication state leak (hardening X1) | Every handler verifies the signatures it needs before it looks anything up, so a caller who cannot sign cannot tell a missing, frozen or KYC-expired account, an existing or absent escrow / sweep / grant id, or a grant's owning issuer from a healthy one: same `error`, `message`, `retryable`, `remedy`. Where the signer itself lives in state (escrow release role, sweep or grant owner) a `#gate` first requires that *some* presented signature verifies against a key that exists without that lookup. An `agent:<grant_id>` signature naming a grant that does not exist is `BAD_SIGNATURE`, exactly like a wrong key. Once the signature verifies, the specific errors are returned as before (`test/preauth-leak.test.js`) |

## What it is NOT

- **No consensus.** A four-validator quorum is simulated in one process (real Ed25519 signatures over the block hash; nothing ever disagrees). CometBFT / a real BFT engine is the next step.
- **Not the production stack.** The spec calls for a Rust kernel; this is Node so it runs anywhere today. The semantics are what matter; the port is mechanical.
- **The model checker is bounded** (small alphabet, two banks plus one extra account so Escrow/Sweep have a same-issuer destination, state cap). A sweep moving the wrong amount is a bug class its safety properties do not cover at all - see `docs/invariant-charter.md` for exactly what is and is not covered.
- **No real cryptographic confidentiality**: no ZK (mode M1), no HSMs (the dev keystore is a 0600 file), no real network. Mode **M2** (issuer-domain need-to-know) is built as an access-control view — see `confidentialView` in `src/network.js` and the dashboard's "Viewing as" selector — since the spec itself says M2 needs no cryptography, only the default mode M0 (everyone sees everything) is still what a fresh network runs unless a view is requested.
- **Toy core banking.** The bank simulator is a few dozen lines; real cores are the hard part (see the onboarding playbook).
- **Pre-auth envelope checks and a residual.** `MALFORMED`, `BAD_INST_ID`, `BAD_VALIDITY`, `UNKNOWN_TYPE`, `NETWORK_HALTED` and `DUPLICATE_INSTRUCTION` still run before authorisation: they depend only on the caller's own bytes, the block time, the (public) halt flag, or - for `DUPLICATE_INSTRUCTION` - an `inst_id` that is recorded only for an *accepted* instruction (a probe leaves no trace) and is useful only to someone who already holds it; kept pre-auth because it is what makes a retry exactly-once. Residual: a client using *predictable* ids (e.g. a guessable UETR) lets a stranger test whether that one instruction was accepted in the last 180 s - use high-entropy ids. A caller authenticated as one participant can still tell an absent escrow / sweep / grant from one owned by another issuer (404-not-403 semantics would hide that but change tested codes). Verification time is not equalised between an unknown and a known grant (timing is out of scope here). The server-signed demo paths (`POST /api/action`, `/api/iso/pacs008`) sign on the caller's behalf and are not the agent interface; they still report account state.
- **Simplifications:** account IDs are readable (`MPL:acme`), not hashed commitments; one screening key per bank; the anchor is a mock; time is supplied per block.
- The benchmark measures one validator's execution stage on one core with everything signed and verified. It is an upper bound, not end-to-end finality.
- **Caller type is self-attested when signed with an institution key; derived when signed with a grant key.** `caller.kind` on an `ops`-signed instruction (roadmap 5.1) is cryptographically bound to it but declared by the signer, who can still say `human` while being an agent. For an `agent:<grant_id>`-signed instruction (roadmap 6.1) the kernel records the caller from the grant, so that case is not a claim. Still not proven: that the *holder* of an agent key is autonomous software rather than a person with the key (that needs attestation of the running software), and key custody, rotation and compromise of an agent key are out of scope — the envelope bounds the damage, it does not prevent it.
- **Delegation limits, stated plainly.** A sweep registered under a grant is bounded by it at every firing (roadmap 7.1): it moves only the chain's remaining headroom and waits for the next window for the rest, so a sweep can be *slow* but never exceeds the envelope; if the grant chain dies the sweep is suspended (registered, visible, moving nothing) and only the institution can cancel it. A sweep firing is not an instruction, so there is no escalation path for it. A batch's caller is what its legs share, and legs with different effective callers are rejected (roadmap 7.2). Hardened after an external audit (roadmap 8.2-8.4): an escrow whose `releaseRole` names an agent grant stops being releasable the moment that grant (or an ancestor) is revoked or expires; a grant can cancel a sweep or refund an escrow only if it is the grant that registered/locked it or an ancestor of it (an institution-created record can be cancelled/refunded only by the institution's own key); and a batch can be *bound* — each leg signs a `batch_digest` over the exact ordered `inst_id`s it rides with (`Network.buildBoundBatch`), after which the kernel refuses it standalone, in a subset, reordered, or padded (`BATCH_LEG_MISBOUND`). Binding is opt-in: a leg signed without a `batch_digest` can still be relayed on its own, exactly as before. The pacs.002 `ACSC` text now says "ledger-accepted (simulated consensus)" rather than claiming consensus finality, since consensus here is simulated in one process. What is still open: demo agent keys are held by `Network` and are not persisted across a durable-store restart (a real agent supplies only its public key in the `GRANT`), and nothing proves the holder of an agent key is software rather than a person.

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
