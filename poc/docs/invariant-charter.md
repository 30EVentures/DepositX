# Invariant Charter (proof-of-concept edition)

The seven invariants of the DepositX ledger kernel, stated precisely, with the code that enforces each and
the evidence that checks it. This is the PoC counterpart of the CTO memo's epic E0.2. The TLA+ version is
**not written**: no Java runtime is installed here, so nothing could be machine-checked. The Node model
checker (`src/modelcheck.js`) plays that role for now.

Why this document exists in this form: an invariant a human has to trust a UI to believe in isn't really
an invariant. Every row below is checkable by re-running the code cited in "Checked by," independent of
the dashboard, of who's asking, and of whether the asker is a person or another program — that's the
actual point of a machine-verifiable charter, not a nicety.

**Notation.** For issuer *i*: `S_i` token supply (sum of account balances); `M_i`/`B_i` cumulative minted/
burned; `In_i`/`Out_i` cumulative converted in/out; `L_i` last attested core control balance; `H_i` open
mint holds; `R_i` pending core debits (redemptions and convert-outs); `P_i` pending core credits
(convert-ins); `SP_i` settlement position; `A` anchor total.

| ID | Statement | Enforced in | On break | Checked by |
|---|---|---|---|---|
| **P1 Conservation** | `S_i = M_i − B_i + In_i − Out_i`, exactly | `checkInvariants`, every block | halt network | fuzz (every 25 ops), model check S1, mutation "double mint", mutation "escrow release prints money" |
| **P2 Backing** | `S_i ≤ L_i + P_i` (never over-issued) and `L_i + P_i − S_i = H_i + R_i` (the gap is exactly the enumerated in-flight items); nothing in flight older than 900 s | `checkInvariants`; `tx_OPEN_HOLD/MINT/REDEEM/CLOSE_*` maintain it | over-issuance: halt; unexplained gap or aged item: quarantine issuer; quarantine older than 900 s: halt | fuzz, model check S1/S4/L1, halt tests, mutation "core credit dropped" |
| **P3 Par transfer** | every cross-issuer instruction burns and mints the same amount and moves each settlement position by exactly that amount; no fee, rate or rounding in the kernel | `assertParLegs` (Transfer/Payment/DvP legs; Escrow's lock/refund reuse the same `#moveCash` path, so they are proven by the same code, not a parallel implementation) | reject | cross-bank payment test, fuzz vs reference model |
| **P4 Settlement backing** | `SP_i ≥ 0` and `Σ SP_i = A − F` | `tx_PAYMENT` check, `checkInvariants` | reject / halt | model check S1, netting test, mutation "ignores position" |
| **P5 Non-negativity** | every balance `≥ 0` | `#debit`, `checkInvariants` | reject / halt | overdraft attack, fuzz |
| **P6 Authority** | mint needs the issuer's mint key AND a hold registered by its attestation key; debits need the payer issuer's key; payee issuer must accept; the operator can move no balance | `#sig` per handler | reject | forged/missing-signature tests, "operator cannot move a balance" test |
| **P7 Halt monotonicity** | once halted only `RESUME` (governance ×2 + observer, + issuer key for an issuer resume, and only if the invariants hold), `ATTEST` and `REPORT_PAR_BREAK` are accepted | `#execTx` gate, `tx_RESUME` | structural | halt/resume tests |

## Properties beyond the seven

| Property | Evidence |
|---|---|
| **Atomicity**: an instruction with any failing leg changes nothing | undo journal; DvP atomicity tests; Batch tests (2-5 legs; a failing first or last leg rolls back the rest); model check S2; fuzz "rejected op changed state"; mutation "failed redeem leaves burn"; mutation "batch: an earlier leg is not rolled back" |
| **Attacks are always refused and inert**: forged signature, replay, unbacked mint, overdraft, over-cap, release under the wrong PayOnEvent oracle | model check S3 in every reachable state (not just the initial one) |
| **Liveness**: no reachable state is a dead end; draining the core always returns to a consistent state | model check L1 at every visited state |
| **Money is conserved** across core, ledger and anchor when the core is caught up | model check S5 |
| **Determinism / replay**: state is a pure function of genesis + block log, including Escrow, Sweep and Batch state | `verifyReplay`, block-by-block replay test, crash recovery test, sweep durable-recovery test |
| **Tamper evidence**: an edited, dropped or reordered block fails recovery | `store.test.js` |
| **Idempotency**: a payment's UETR is its instruction id; a resubmission is a duplicate; a Batch leg cannot be replayed by wrapping it in a fresh outer batch | `iso20022.test.js` (within the kernel's 180 s window; a production gateway needs its own persistent UETR table); `batch.test.js` |

## Roadmap 1.1-1.4: how the four new templates fit the existing invariants (2026-09-27)

Escrow (T4), PayOnEvent (T5), Batch (T7) and Standing/Sweep (T6) were added without any new
conservation formula:

- **Escrow/PayOnEvent** move money by calling the *same* `#moveCash` that Transfer, Payment and
  DvP already call, into a regular ledger account under a reserved id. P1-P5 apply to it exactly
  as to any other account, with no special-casing - the mutation "escrow release prints money"
  (skip the debit half of a release) is caught by **P1**, the same invariant that would catch a
  buggy mint, with zero new checker code.
- **Batch** reuses `#execTx`'s own rollback: each leg runs against the *same* journal
  `#execTx` already rolls back wholesale on any error. The mutation "an earlier leg is not
  rolled back" (a decoy journal that applies a leg's mutation directly, bypassing the undo
  record) is caught by the existing **S2** ("a rejected instruction changes nothing") property.
- **Sweep** is the one template that is genuinely new machinery (`#runSweeps`, run at
  `#endOfBlock`), because "move the excess, not the whole balance, only above a threshold" is not
  an existing primitive. It is exercised by 6 targeted tests (`sweep.test.js`), not by the model
  checker's own safety properties directly, since a sweep moving the *wrong* amount between two
  valid accounts does not by itself break P1-P5 or total money conservation - see the honest
  finding below.

## Model checker: coverage extended (2026-09-27)

The action alphabet grew from 27 to **37**: the four escrow/PayOnEvent actions (`e1` cross-issuer,
`e2` same-issuer and event-gated, plus the wrong-oracle release reclassified as an **attack**, not
a routine action - it belongs with the S3 property, not S1/S2), two sweep actions (register/cancel
at `keep=$0` so any positive balance is swept, exercising the firing path from as many states as
possible), and one Batch action (two independently-valid legs, deliberately *not* a same-amount
mirror pair - a same-amount round trip would make the second leg's settlement-position need always
exactly satisfied by the first leg's own cross-issuer contribution, hiding an atomicity bug rather
than exercising it; found by hand while testing the planted Batch mutation below). A second,
same-issuer account (`MPL:harbour`) was opened so same-issuer Escrow and Sweep have somewhere to
move to; it is **not** added to the existing `ACCTS`-driven mint/pay/redeem loops, so it does not
multiply their combinatorics.

| Run | Actions | Depth | States | Transitions | Time | Failures |
|---|---|---|---|---|---|---|
| Before (this session's baseline) | 27 | 8 | 40,000 (capped) | 377,678 | not recorded | 0 |
| After, routine (`modelcheck.test.js`, every test run) | 37 | 5 | 3,560 | 36,556 | ~27 s | 0 |
| After, one-off deeper check (this update, not part of the routine suite) | 37 | 6 | 12,181 | 131,720 | 99.5 s | 0 |

The routine test's depth was kept at 5 (not raised to match the old depth-8 claim) because each of
the 37 actions is more expensive per state than the old 27, and 5 already gives a stronger state
count (3,560) than a shallow run of the old alphabet would; CI time matters more than matching the
old run's depth number exactly. The depth-6 run above is the honest "we went deeper once and
still found nothing" data point the roadmap asked for - it is not re-run automatically.

## Model checker: External-CSD DvP added (roadmap 4.3, 2026-09-28)

The action alphabet grew again, 37 to **40**: `externalCsdDvp` (a fixed small cash-only lock,
`csd1`, cross-issuer acme -> cedar), the matching correct `csdConfirm`, and a wrong-event-name
release reclassified as an **attack** (claiming the CSD escrow is actually the generic `delivery`
event). Unlike M1's escrow/event-release actions, these do not exercise new kernel code -
`externalCsdDvp`/`csdConfirm` are the same `tx_ESCROW_LOCK`/`tx_EVENT_RELEASE` handlers already
covered - but they exercise that mechanism **in combination** with sweeps, batches and every other
action reachable from the same states for the first time, which is the actual point of exhaustive
search over scripted scenarios. No new mutation test was added for this: a bug in the shared
`tx_ESCROW_LOCK`/`tx_EVENT_RELEASE` code is already caught by the existing escrow-prints-money and
wrong-oracle mutations (roadmap 2.2) regardless of which named convenience method called it, and
both of those mutations still pass with the extended alphabet (confirmed, not assumed).

| Run | Actions | Depth | States | Transitions | Time | Failures |
|---|---|---|---|---|---|---|
| After 2.1 (previous baseline) | 37 | 5 | 3,560 | 36,556 | ~27 s | 0 |
| After 4.3, routine (`modelcheck.test.js`, every test run) | 40 | 5 | 3,793 | 40,680 | ~31 s | 0 |
| After 4.3, one-off deeper check (this update, not part of the routine suite) | 40 | 6 | 13,673 | 151,720 | 116.9 s | 0 |

## Roadmap 4.1: M2 confidentiality is deliberately not model-checked

`confidentialView` (`src/network.js`) is a pure, read-only transform of `Network#snapshot()`'s
already-built output. It runs entirely outside the transaction path - it cannot call a `tx_*`
handler, touch the Journal, or run before or after `#endOfBlock` - so it cannot itself produce a
state the kernel would not otherwise reach, and cannot cause a P1-P7 violation. Model-checking
existing actions under different *viewers* would test the same reachable states already covered,
rendered differently; it would not exercise anything new. What is worth testing, and is
(`test/confidentiality.test.js`, 6 tests): that a view never mutates the real network or the
snapshot it was given, that two issuers' views of the identical state genuinely disagree, and that
a quarantined issuer's status stays visible to a viewer that cannot see its book.

## What is NOT checked (be honest about the bounds)

- The model checker is **bounded** (state cap and depth cap, small alphabet of $1/$2 amounts,
  three accounts). It found no violation in any of the runs in the table above and is not a proof
  for all states or all amounts.
- **A sweep moving the wrong amount is not caught by any existing safety property.** Tried and
  confirmed while writing roadmap 2.2: a sweep that moves the *entire* source balance instead of
  just the excess above `keepAmount` still conserves total money and violates no P1-P7 formula -
  it is a functional-correctness bug, not a safety-invariant bug, and only `sweep.test.js`'s own
  targeted assertions ("never fires while at or below keepAmount") would catch it. Recorded here
  rather than forcing a mutation test to "pass" against a property that does not actually cover
  the bug class.
- **Consensus** is simulated; safety under Byzantine validators is untested. Needs the real engine and fault injection (spikes S6, S7).
- **Timing attacks, resource exhaustion, key compromise** are out of scope for a single-process kernel.
- The kernel's Node implementation has not been audited. A Rust port with Verus/Kani proofs (spike S2) is the path to machine-checked guarantees.
- Amount arithmetic uses BigInt (no overflow); a fixed-width port must prove the absence of overflow.
- **Mutation testing is now seven planted bugs** (four from before, three added for the new templates in roadmap 2.2). It shows the checker can find *classes* of bug; it does not bound what it would miss.
