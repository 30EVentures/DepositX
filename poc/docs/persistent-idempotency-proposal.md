# Proposal X4: persistent idempotency beyond the 180 s window (not built)

Status: **proposal only, 2026-10-02, for review. No kernel code.** Companion to
`agent-native-access-proposal.md` (agents retry; this is what makes a retry safe). It answers the line in
`invariant-charter.md` (Idempotency row, ~L38) that "a production gateway needs its own persistent UETR table".

## 1. The gap, measured, and why it is more than a documented limit

What is already safe: **the same signed bytes cannot be replayed after the window.** `valid_until` must be within
60 s of block time (`MAX_TTL_S`), and the dedup window is 180 s (`DEDUP_WINDOW_S`), so by the time an `inst_id`
is forgotten the original signature has long expired (`BAD_VALIDITY`).

What is **not** safe is a *retry*: the same `inst_id`, signed again with a fresh `valid_until`. The kernel's
only memory of an id is `s.dedup`, pruned at the start of every block (`t < time - DEDUP_WINDOW_S`), so after 180 s
the id is simply new. Two probes against the code, not assumptions:

| Probe | Result |
|---|---|
| One $100 `PAYMENT`, retried immediately with the same `inst_id` | `DUPLICATE_INSTRUCTION` (correct) |
| The same `PAYMENT`, same `inst_id`, re-signed 200 s later | **accepted**: the payee received $200 for one logical $100 payment |
| One `pacs.008` (one UETR), resent immediately | `RJCT (DUPL)` (correct) |
| The same `pacs.008`, resent 200 s later | **`ACSC`: paid again**; $200 received for one $100 message |

The ISO gateway uses the UETR as the `inst_id`, and builds a fresh `valid_until` for every message it submits,
so a message resent after three minutes (a perfectly ordinary client timeout-and-retry) is a second payment.
The charter's wording makes this read like an abstract limit. It is a concrete, reachable double payment.
Agents make it likelier, not less: retry-on-timeout is the default behaviour of a robust autonomous client.

Three further properties of the current design, relevant to any fix:

- **One global namespace.** `s.dedup` is keyed by `inst_id` alone. Issuer A's accepted id blocks issuer B's
  identical id for 180 s. Entries are written only for *accepted* instructions, so nobody can burn an id by
  failing, but a predictable id is claimable by whoever uses it first.
- **No payload binding.** The map stores a time, not what the instruction said. Within the window a
  duplicate is refused regardless of payload, which is safe; but a persistent design must decide what a
  *different* payload under a known id means (see 3).
- **`dedup` is committed state.** It is part of `stateView()`, hence of the state root. Pruning is
  deterministic and replays identically, but changing the shape of an entry changes state roots for any chain
  that records it. Whatever is built must be additive for chains that do not opt in.

## 2. The prior art, and what to copy and what not to

`flashy-ledger` (audited in `~/flashy-audit/notes/commerce-wallet-ledger.md`) enforces a **permanent**
`idempotencyKey`: a unique index on `(tenantId, idempotencyKey)`; a repeat returns the original entry flagged
`deduplicated`. It is the right instinct, and its history is exactly what DepositX is missing. Taking it
verbatim would be a mistake in three places, all documented in that audit:

1. **It does not compare the replay to the original.** The same key with a different amount, identity or asset
   silently returns the *original* entry as deduplicated. A client that reuses a key by mistake is told
   "done" about a payment it never made. Stripe rejects parameter mismatches; DepositX should too.
2. **Its derived keys share the caller's namespace.** Transfers derive `<k>:out` and `<k>:in`, so a caller key
   literally `x:out` collides with transfer `x`. DepositX has the same hazard in miniature: batch legs, escrow
   ids and sweep ids are all caller-chosen strings; a design must not let one namespace shadow another.
3. **It is permanent.** That is fine for a database with a unique index, and wrong for a replicated state
   machine: DepositX's dedup set is *committed state*, so a permanent set grows without bound inside every
   validator and every state root. flashy-ledger never faces that cost; DepositX must.

What it gets right and is worth copying: the key is **scoped to a tenant** (here: the signing institution, so
issuers cannot squat on one another's ids), and the check is a first-class, single, atomic step.

## 3. Options

**Option A: make the kernel's dedup permanent.** Never prune. Simplest; unbounded state; every state root
grows forever; needs a commitment structure (a sparse Merkle tree) and snapshotting to stay tractable. A
valid end state for a production chain, wrong for the PoC, and it still has the payload-binding question.

**Option B (recommended): a signed, bounded idempotency horizon, kept in the kernel.** An instruction may carry
`idem: { until }`, **inside the signed digest** (same pattern as `caller` and `batch_digest`), where `until` is
a block-time instant at most `MAX_IDEM_HORIZON` (say 30 days) ahead. The kernel then:
  - keeps the dedup entry until `until` instead of 180 s, as `{ at, until, digest }` where `digest` is a hash of
    the instruction's signed content (`messageOf`), so growth is bounded by *horizon x rate*, chosen by the signer
    within a kernel-enforced ceiling;
  - scopes the key to the signing institution (`<issuer>:<inst_id>`), so namespaces cannot collide across issuers;
  - on a repeat with the **same digest**, refuses it as `DUPLICATE_INSTRUCTION` and says which block holds the
    original, which is what a retrying client actually needs;
  - on a repeat with a **different digest** under a live key, refuses it as `IDEMPOTENCY_CONFLICT` (retry with
    the same bytes, or use a new id) rather than flashy-ledger's silent "already done".
  Omitting `idem` leaves the instruction on today's 180 s behaviour exactly, so **existing state, replay and
  every existing test are unchanged**. The ISO gateway signs the institution's instruction itself, so it can
  simply set a horizon on every message it builds (for example 7 days): the charter's "persistent UETR table"
  then falls out of the kernel for free instead of being a separate store that the kernel does not know about.

**Option C: a gateway-level persistent table, outside the kernel** (what the charter currently says). Cheapest,
and the right *interim* for the ISO endpoint. But it is not enforced by consensus, so it protects only callers
who go through that gateway. `POST /api/submit` is the **agent** path and bypasses the gateway entirely, so
under C the agents, the very callers most likely to retry, keep only the 180 s guarantee. If C is chosen it
must front `/api/submit` as well, and it must store the payload digest, not just the id.

**Option D: per-signer sequence numbers** (a nonce that must strictly increase) instead of a dedup set at all.
Exactly-once with no retention window. Rejected for now: it serialises each signer's instructions, which is
hostile to several agents under one grant, and it is a different protocol, not a retrofit.

## 4. Invariant and model-checker changes it would need

**New invariant I (idempotency horizon).** For any instruction accepted at time `t` with horizon `until`, no other
instruction with the same `(issuer, inst_id)` is accepted at any time before `until`, whatever its payload; at or
after `until` the id is free. Exactly-once within the horizon, and a bounded set otherwise.

**New safety property S8, judged by an oracle that shares no code with the kernel**: from the block log, every
pair of accepted instructions with the same `(issuer, inst_id)` is separated by at least the earlier one's
`until`; and any repeat refused as `IDEMPOTENCY_CONFLICT` genuinely had a different digest.

**A prerequisite the model does not meet today: it does not advance the clock.** `modelCheck` takes no
clock-advance action, and its own state key leaves time out, so a retry *after* a window can never occur in
the search. The depth-6 state count already varies between runs for a related reason (`net.now()` is real
wall-clock time, and the escrow actions bake `expiresAt: net.now() + 60` into transactions; with the clock
frozen the count is stable at 13,442). X4 therefore needs the model's clock to be **injected and deterministic**,
and a deliberate `advance` action whose effect on the state key is thought through. That is groundwork worth
doing regardless of X4.

**Actions:** pay with a horizon; retry the identical payment (must be refused as a duplicate); retry with a
different amount (**attack**, must be `IDEMPOTENCY_CONFLICT`); advance the clock past the horizon; retry again
(legit, allowed); the same id from a second issuer (must not collide).

**Planted bugs the checker must catch:** pruning at 180 s regardless of `until`; the key not scoped to the
issuer; the digest not compared (flashy-ledger's flaw); a horizon above `MAX_IDEM_HORIZON` accepted; the
entry written for a *rejected* instruction (which would let an attacker burn someone else's id).

**State and hashing.** Entries for instructions without `idem` keep their present shape, so state roots of
existing chains do not move. Entries with `idem` change `stateView().dedup`, so mixing both in one chain is
fine but old validators could not replay a chain that uses it: protocol-versioned, as the envelope additions
before it were.

## 5. Honest limits

- **It is exactly-once only inside a horizon the signer chose.** After `until` the same id is new again. A
  client that needs exactly-once for a year needs Option A, or a different identifier discipline.
- **It does not make external side effects idempotent.** It guarantees the *ledger* does not move money twice
  for one logical instruction; whatever the caller does outside is its own problem.
- **It cannot save a caller that loses its id.** A retry must reuse the same id and the same bytes.
- **The ceiling is a retention decision, not a technical one.** How long an institution must be able to prove
  "this id was already processed" is a question for counsel and operations, not for this document.
- **State growth is bounded, not free.** Horizon x acceptance rate, per validator. Size it before choosing a
  ceiling.

## 6. Decisions needed

1. **Option B (recommended)**, A (permanent, with the commitment structure it implies), or C as an interim?
2. **`MAX_IDEM_HORIZON`**: 30 days is a placeholder with no regulatory basis.
3. **Conflict behaviour**: reject a different payload under a live id (recommended, deliberately unlike
   flashy-ledger), or return the original.
4. **Should the ISO gateway set a horizon by default?** Recommended yes (7 days), which closes the concrete
   double payment in section 1 for the ISO path.
5. **Do the model-checker clock groundwork first**, as its own item, or fold it into X4?

## 7. Proposed roadmap items (not added to `ROADMAP.md`)

- **X4.0** Make the model checker's clock injectable and deterministic (fixes the depth-6 nondeterminism as a
  side effect; re-baseline the recorded numbers).
- **X4.1** Spec and acceptance criteria into `ROADMAP.md`, unchecked, including the two probes in section 1 as
  red-first tests (they fail today, which is the point).
- **X4.2** `idem` in the signed digest, scoped bounded dedup, `IDEMPOTENCY_CONFLICT`, error-catalog and
  `schema()` entries; the ISO gateway sets a default horizon.
- **X4.3** Model checker: clock-advance action, the idempotency actions, S8, five planted bugs; real numbers
  into the charter.
- **X4.4** Docs: README row and limits, charter entry, update the Idempotency row's "(production gateway needs
  a persistent UETR table)" note.
