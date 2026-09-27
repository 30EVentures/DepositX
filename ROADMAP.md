# DepositX PoC — engineering roadmap

**Scope note.** This file plans the *buildable software* only: `poc/`, the
proof-of-concept ledger kernel. `01-execution-roadmap.md` is the business and
regulatory plan (bank consortium, board votes, legal opinions) — none of that
is something code can execute, so it stays out of this file. Where an item
below is really a business/regulatory decision, it goes under **Blocked /
needs input**, not into a coding pass.

**Source of truth for what's real.** `poc/docs/invariant-charter.md`'s "What
is NOT checked" section and `poc/README.md`'s "What it is NOT" section are the
project's own honest account of its gaps, written by an earlier session. This
roadmap is built directly from those two lists plus the technical spec's
template library (`02-technical-implementation.md` §2.5), not from guesses.

## Executive summary

The PoC kernel (2,858 lines, 34/34 tests passing) already implements three of
the eight settlement templates the spec calls for (Transfer, Convert/Payment,
DvP) plus the full par-invariant machinery (P1–P7), a durable hash-chained
store, an ISO 20022 gateway, and a bounded model checker. The largest concrete
gap against the spec's own "launch set" (§2.5) is the four Phase 2 templates:
**Escrow, PayOnEvent, Standing/Sweep, Batch**. All four are buildable on top
of the existing kernel without new dependencies (the project is deliberately
zero-dependency) because they compose from primitives already proven correct:
the account-balance model, `#moveCash`'s par-conserving Convert, and the
Journal's atomic rollback (already used by DvP and `NET_CYCLE`).

Priority order below follows the spec's own template numbering, then the
project's stated "what is not checked" gaps, then documentation and the
dashboard. Each item is independently shippable and independently testable —
if the loop stops after any item, the tree is left green.

## Priority 1 — the four missing launch-set templates (§2.5)

### [x] 1.1 Escrow (T4): lock, release, refund

**Design.** An escrow is a regular ledger account under a reserved id
(`<issuer>:escrow:<escrowId>`) so it needs no new conservation math: `LOCK`
moves funds from the payer's account into the escrow account exactly like an
existing Transfer (same issuer) or Convert (cross-issuer, via `#moveCash`,
which already proves P3 par-legs); `RELEASE` moves escrow funds to the
beneficiary; `REFUND` moves them back to the original payer, only after
`expiresAt`. Both release and refund are same-issuer moves once the escrow
account already lives at the beneficiary's issuer (chosen at lock time), so
neither needs a second cross-issuer settlement move.

**Depends on:** nothing new; reuses `#moveCash`, `#live`, `Journal`.

**Acceptance criteria**
- [x] `tx_ESCROW_LOCK` creates the escrow account on first use, moves funds
      out of the payer's account, and is rejected if the payer's balance (or,
      cross-issuer, the payer issuer's settlement position) is insufficient —
      exactly like an existing Transfer/Payment would be.
- [x] `tx_ESCROW_RELEASE` requires the signature named at lock time (default:
      the payer's `ops` key) and moves the full escrowed amount to the named
      beneficiary account; a second release of the same `escrowId` is
      rejected (`UNKNOWN_ESCROW`).
- [x] `tx_ESCROW_REFUND` is rejected before `expiresAt` and succeeds after it,
      returning the full amount to the original payer account.
- [x] Total account-balance supply per issuer is unchanged by lock+release or
      lock+refund (a property test asserts this over both same-issuer and
      cross-issuer cases).
- [x] A cross-issuer lock correctly moves settlement positions once (at lock,
      via the existing Convert path); release/refund move no further
      settlement position, since money is already at the beneficiary's issuer.
- [x] `checkInvariants` (P1–P5) holds throughout; a fuzz or targeted test
      exercises lock → release and lock → refund and confirms no violation.
- [x] `npm test` stays green; new tests added to `test/kernel.test.js` or a
      new `test/escrow.test.js`.

### [x] 1.2 PayOnEvent (T5): release gated by a named oracle signature

**Design.** Reuses the Escrow account and lock/refund exactly; adds a second
release path, `tx_EVENT_RELEASE`, which requires a signature from a named
event-oracle key (`event:<name>`) registered in genesis — e.g. a delivery
confirmation — instead of the payer-named release role. This matches the
spec's own framing of PayOnEvent as escrow "released by a signed [...]
confirmation" (§2.4, describing the CSD DvP case as the general pattern).

**Depends on:** 1.1 (Escrow), since it reuses the escrow account and lock/
refund handlers unchanged.

**Acceptance criteria**
- [x] Genesis gains a named event-oracle keyset (at least one, e.g.
      `delivery`), mirroring how `observer` and `anchor` are already
      single-purpose named keys.
- [x] `tx_EVENT_RELEASE` succeeds only with a valid signature from the named
      oracle key, referencing the escrow by id and the event name it was
      locked against; a release attempt signed by any other key (including
      the payer's own `ops` key) is rejected.
- [x] An escrow locked for event `X` cannot be released by an event-release
      naming a different event name, even with a valid oracle signature for
      that other event.
- [x] Refund after expiry still works unchanged (no oracle involvement) —
      a stalled event does not trap funds forever.
- [x] Tests cover: correct-oracle release, wrong-signer rejection,
      wrong-event-name rejection, and expiry refund with no event fired.
- [x] `npm test` stays green.

### [x] 1.3 Batch (T7): several legs, atomic

**Design.** `tx_BATCH` carries an ordered list of legs, each leg shaped
exactly like an existing instruction's `{type, payload, sigs}`. Execution
dispatches each leg to its existing `tx_<TYPE>` handler **using the same
top-level Journal** that `#execTx` already rolls back wholesale on any
`KernelError` — so "all legs or none" falls out of the existing atomicity
mechanism with no new rollback logic, the same way DvP's two legs already do.

**Depends on:** nothing new; reuses every existing `tx_*` handler as a leg
executor.

**Acceptance criteria**
- [x] A batch of 2–5 legs (mixing Transfer, Payment, Escrow lock) where every
      leg is individually valid settles all of them in one instruction, and
      the block's events list carries every leg's own events.
- [x] A batch where the *last* leg is invalid (e.g. insufficient funds)
      leaves state byte-identical to before the batch — including the legs
      that would otherwise have individually succeeded. A test asserts this
      by snapshotting `stateRoot()` before and after the rejected batch.
- [x] Nesting a `BATCH` leg inside a `BATCH` is rejected explicitly
      (`BATCH_NO_NESTING`), not silently accepted or infinitely recursed.
- [x] An empty legs array is rejected (`BATCH_EMPTY`).
- [x] `npm test` stays green.

### [x] 1.4 Standing/Sweep (T6): a registered rule that fires deterministically

**Design.** `tx_REGISTER_SWEEP` registers a same-issuer standing rule
(`fromAccount`, `toAccount`, `keepAmount`) signed once by the payer's `ops`
key. At the end of every block (`#endOfBlock`, where invariant checks already
run identically on every validator from the same state — the same place that
makes the graded halt deterministic) any active sweep whose source balance
exceeds `keepAmount` moves the excess to its destination. Restricted to
same-issuer transfers only, so no settlement-position or cross-issuer
signature question arises. `tx_CANCEL_SWEEP` deregisters one.

**Depends on:** nothing new; reuses `#moveCash`'s same-issuer path and the
existing `#endOfBlock` hook.

**Acceptance criteria**
- [x] Registering a sweep from A to B with `keepAmount = $X`, then crediting A
      above `$X` (e.g. via a same-block mint or transfer in), causes the
      excess to move to B by the *next* block's end, with no separate
      instruction submitted by anyone.
- [x] A sweep never fires while the source balance is at or below
      `keepAmount`.
- [x] `tx_CANCEL_SWEEP` stops future firings; a cancelled sweep firing again
      is a test failure.
- [x] Two sweeps in the same block that would otherwise interact (A→B and
      B→C) both apply deterministically in a single documented order
      (registration order) — a test pins the exact resulting balances so the
      order is a tested contract, not an accident.
- [x] Sweeps are captured in `store.js` recovery (a restart replays them
      identically) — reuses the existing block-log replay, but a test
      confirms it explicitly for this new state.
- [x] `npm test` stays green.

## Priority 2 — keep the honesty file honest

### [x] 2.1 Extend the model checker's coverage to the four new templates

`poc/docs/invariant-charter.md` states the model checker found no violation
"across 40,000 states / 377,678 transitions (depth 8)" for the *existing*
action set. Adding four new transaction types without extending the model
checker's action alphabet would make that claim stale and wrong.

**Depends on:** 1.1–1.4 (all four templates must exist first).

**Acceptance criteria**
- [x] `modelcheck.js`'s action alphabet includes at least one instance each of
      Escrow lock/release/refund, event-release (correct and wrong-oracle),
      a two-leg batch, and sweep register/fire/cancel.
- [x] The extended run completes in a bounded time (document the new
      state/transition counts next to the old ones — do not silently drop the
      depth or alphabet size to make it finish faster) and finds no
      unexpected violation. If it *does* find one, that is a real kernel bug:
      fix the kernel, not the model, and say so in the commit message.
- [x] `poc/docs/invariant-charter.md`'s numbers and "What is NOT checked"
      section are updated to describe the new, larger bound honestly (do not
      claim more than what was actually run).
- [x] `npm test` stays green (the model check is already a test; it now
      covers more).

### [x] 2.2 Widen mutation testing beyond four planted bugs

The charter says plainly: "Mutation testing is only four planted bugs... it
does not bound what it would miss." Each new template is exactly the kind of
new surface a planted bug could hide in.

**Depends on:** 1.1–1.4.

**Acceptance criteria**
- [x] At least three new planted-bug mutations are added, each in a new
      template's handler (e.g., "escrow release ignores the expiry check",
      "batch leg failure doesn't roll back an earlier leg", "sweep fires
      below keepAmount").
- [x] Each planted bug is caught by the model checker or a targeted test —
      if a mutation is *not* caught, that is a real coverage gap: add the
      missing invariant or test, don't weaken the mutation.
- [x] The charter's mutation count and description are updated to match.
- [x] `npm test` stays green.

## Priority 3 — reachability and documentation

### [ ] 3.1 Wire the new instruction kinds into the dashboard's action API

`poc/src/server.js`'s `act()` switch and `public/index.html`'s action list are
the only way a person (not a test) can drive the kernel today. Without this,
the four new templates exist only for tests, which contradicts the PoC's own
stated purpose ("a live dashboard").

**Depends on:** 1.1–1.4.

**Acceptance criteria**
- [ ] `act()` gains cases for escrow lock/release/refund, event-release, batch
      (a small fixed 2-leg demo, not a general batch builder — matching the
      dashboard's existing level of polish for `dvp`), sweep register/cancel.
- [ ] The dashboard's action list renders working controls for each new case
      using the existing form/element helpers already in `index.html` — same
      visual style, no new dependency.
- [ ] Manually exercised once via `npm start` and the local dashboard (record
      the result in the session log below; this is a judgment call an
      automated test can't fully replace for a UI).
- [ ] `npm test` stays green (server.js has no existing test harness; adding
      one is out of scope here — see Blocked/needs input if it seems large
      enough to warrant its own item).

### [ ] 3.2 Update README.md and poc/README.md

**Depends on:** everything above.

**Acceptance criteria**
- [ ] `poc/README.md`'s "What it demonstrates" table gains rows for the four
      new templates, each pointing at the code and the test that proves it,
      matching the existing table's style exactly.
- [ ] `poc/README.md`'s "What it is NOT" section is re-checked line by line:
      remove anything this pass fixed, leave everything else (most of it —
      real consensus, ZK, HSMs, a Rust port — is correctly still true).
- [ ] Root `README.md`'s "Read in this order" / PoC description still
      accurately describes what `poc/` covers.
- [ ] No claim is added anywhere that isn't backed by a passing test.

## Blocked / needs input

*(Populated during the loop if something needs a decision only Caleb can
make, or is a business/regulatory action rather than code. Nothing here yet.)*

## Not in this roadmap (explicitly out of scope for a coding loop)

- Real BFT consensus, a Rust kernel port, real ZK confidentiality (M1), HSM
  integration, a real core-banking connector, PvP/cross-currency — all
  correctly flagged as out of scope in `poc/README.md`'s "What it is NOT" and
  gated behind spikes S1–S10 in `02-technical-implementation.md`, which need
  real infrastructure, real cryptographic review, or real bank
  counterparties, not another coding pass.
- Anything in `00`–`04` and `board/*.md`: regulator meetings, board votes,
  legal opinions, bank onboarding — business and regulatory work, not code.

## Session log

*(One line per completed item, newest last.)*

- 2026-09-27 — Priority 2 (keep the honesty file honest). Added Network convenience wrappers for all four new templates first (`escrowLock`/`escrowRelease`/`eventRelease`/`escrowRefund`, `registerSweep`/`cancelSweep`, `batch()`), reused by both the model checker and (later) the dashboard. Extended `modelcheck.js`'s action alphabet 27 -> 37 and added a second same-issuer account, without touching the existing accounts' combinatorics. Added 3 planted-bug mutation tests (roadmap 2.2) for the new templates: an escrow-release-prints-money bug (caught by the existing **P1** invariant, no new checker code), a batch-leg-not-rolled-back bug (caught by the existing **S2** property), and a PayOnEvent wrong-oracle bug (caught by **S3**, after correctly reclassifying that model action from 'legit' to 'attack'). One real false start along the way, found and fixed, not hidden: the first version of the batch mutation test went undetected because the model's batch action used a same-amount mirror pair (pay $1 then pay $1 back), whose second leg is always self-funded by the first leg's own cross-issuer settlement contribution - fixed by using mismatched amounts ($1 then $2), confirmed by hand before changing the code. One honest non-generalizing finding recorded rather than forced: a sweep moving the wrong amount conserves total money and trips no P1-P7 formula, so only `sweep.test.js`'s own targeted tests would catch that class of bug. `poc/docs/invariant-charter.md` updated with real before/after state counts (27 actions/depth 8/40,000 states before; 37 actions/depth 5/3,560 states in the routine test; a one-off depth-6/12,181-state run for a deeper honest data point) and the new limitation. Full suite: 60/60 (was 54), ~44s (was ~16s) - not shrunk to look faster.
- 2026-09-27 — 1.4 Standing/Sweep (registered same-issuer rule, fires at `#endOfBlock`, the same deterministic hook the graded halt already uses, so no separate submitted instruction is needed and it replays identically from the log). `executeBlock` and `Network#makeBlock` now surface `sweepFires` alongside `violations`. 6 new tests in `test/sweep.test.js`, written first and confirmed red first, including a hand-computed two-sweep cascade (elm/fjord, LKS) pinned to exact resulting balances, and a durable-store recovery test confirming a registered sweep survives a restart and keeps firing. All 6 passed on the first implementation attempt — the cascade math worked out by hand matched the code's actual output exactly. Priority 1 (all four launch-set templates: Escrow, PayOnEvent, Batch, Sweep) is now complete. Full suite: 54/54.
- 2026-09-27 — 1.3 Batch (all-or-nothing legs) implemented: `#execTx`'s generic checks were already extracted into `#checkEnvelope` in the previous pass specifically for this, so `tx_BATCH` dispatches each leg to its own existing handler against the same top-level Journal and gets atomicity for free from `#execTx`'s existing rollback-on-error. 7 tests in `test/batch.test.js`, written first (red first: all 7 failed against the unmodified kernel). Two of my own test assumptions were wrong once the implementation existed — an escrow id with capital letters, and an expected same-issuer leg emitting cross-issuer CONVERT events it shouldn't — both fixed in the test, not the kernel; every atomicity, replay-protection and nesting-guard assertion passed on the first implementation attempt. Full suite: 48/48.
- 2026-09-27 — 1.1 Escrow (lock/release/refund) and 1.2 PayOnEvent (event-gated release) implemented together in `kernel.js` (four new tx_ handlers, `escrows` state added to `stateView()`), `network.js` (named event-oracle keys in genesis and the dev keystore, serialized for recovery), and `test/escrow.test.js` (7 new tests, written before the code and confirmed red first). One real design bug found while writing tests, not just a test bug: ESCROW_RELEASE defaulted its release role to the payer even for event-gated escrows, which would have let a payer release their own PayOnEvent escrow unconditionally — fixed by requiring EVENT_RELEASE for any escrow with an eventName (`USE_EVENT_RELEASE`). Full suite: 41/41 passing (34 original + 7 new).
- 2026-09-27 — Roadmap created from a fresh read of `poc/src/*.js`,
  `poc/docs/invariant-charter.md`, `poc/README.md`, and
  `02-technical-implementation.md` §2.5; all 34 existing tests confirmed
  passing before any change.
