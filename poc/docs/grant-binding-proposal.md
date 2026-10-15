# Proposal: bind the grant an agent signs under (same-holder splice), and a money check on GRANT

Status: **IMPLEMENTED 2026-10-12 as Option A, mandatory** (on branch `grant-binding-mandatory`, not merged), on the
project owner's instruction to implement the fix and make it mandatory. Sections 1 to 3 are the
original finding and are left as written; section 9 records what was built and measured. The test file
`test/grant-binding.test.js` was red by exactly one test before the fix and is green now. Follows
`agent-native-access-proposal.md`; the open items X3 and X4 there are separate.

## 1. The question, answered

The question was whether each grant link carries the parent's exact identifier and whether a same-holder splice is
refused. Both halves were run against the kernel, with two root grants of one issuer sharing a single agent key
(p1 narrow: $100 per instruction, $1,000 per window; p2 broad: $10,000 and $100,000).

| Probe | Result |
|---|---|
| A1. A child signed for parent p1, signer role relabelled `agent:p2` | refused, `MISSING_SIGNATURE` |
| A2. The same child re-pointed to parent p2 (`payload.parent`), original signature kept | refused, `BAD_SIGNATURE` |
| A3. Control: the child exactly as signed | accepted, parent recorded as `p1` |
| B1. A $500 transfer signed under p1 (over its $100 maximum) | refused, `ESCALATION_REQUIRED` |
| B2. **The same signed bytes, signer role relabelled `agent:p2`** | **accepted**, recorded caller `grant_id=p2`, p2's window charged, p1's untouched |

So:

- **Grant links are bound.** A child carries its parent's exact `grant_id` inside the signed GRANT payload and in
  stored state. A same-holder splice of a child link is refused. This is an *identifier*, not a content hash:
  ids are unique (`GRANT_EXISTS`) and a grant record never changes except for revocation and its window counter, so
  on one ledger an id binds exactly one parent. An offline-verifiable export would need a hash (section 6).
- **Instructions are not bound to the grant they were signed under.** The grant that authorises an ordinary
  instruction is chosen by the role label on the signature, and that label is not inside the signed digest. The
  kernel also does not forbid two grants sharing one agent key. Together these let anyone who relays a signed
  instruction choose which of the signer's grants it executes under.

## 2. Why it matters, and what it does not mean

This is **not** a way for a key holder to do more than the holder could already do: whoever holds the shared key can
sign under the broad grant directly. The harm is to the parties who rely on *which grant* was meant:

- **A relayer, not the signer, picks the envelope.** An instruction the signer signed under a narrow, purpose-limited
  grant (which demanded an institution co-signature) executes inside a broader grant with no co-signature.
- **The audit trail names the wrong grant.** The kernel *derives* the recorded caller from the grant, and the
  derived caller is presented as a fact. Here it is whatever label the relayer attached.
- **Window accounting moves.** The spend is charged to p2, so p1's headroom and any sibling accounting is wrong.

The pattern needs a shared agent key. The kernel allows it and the documentation says a real agent brings its own
key, so one agent holding several grants of one issuer is a natural configuration, not an exotic one.

## 3. The failing test

`test/grant-binding.test.js`, run with `node --test test/grant-binding.test.js`:

- **ATTACK (1, red before the fix):** a signed instruction cannot be moved onto a different grant that shares the signer key. It
  asserts the *property*, not a remedy, so either fix below turns it green (Option B by making the second grant
  impossible to create).
- **PINS (3, green today, must stay green):** a child link carries the parent's exact id; a same-holder splice of a
  child link is refused; the instruction as signed under the narrow grant still needs the co-signature and still
  passes with it.

One thing about how the red test was built, recorded because it nearly shipped wrong: the first draft replaced the
whole `sigs` object when relabelling, which also dropped the `screen:MPL` signature, so it was refused for *that* and
passed vacuously. It now relabels only the agent signature and asserts the remaining signatures are intact.

## 4. Proposed fix

**Option A (recommended): put the signing grant's id inside the signed bytes.** Add an envelope field `grant`,
included in the signed digest in the same way `caller` and `batch_digest` already are, and require that an
agent-signed instruction carries `grant` equal to the grant named by its `agent:<id>` role, else `GRANT_MISMATCH`.
Relabelling the role then no longer matches the signed `grant`, and changing `grant` breaks the signature. Details:

- **Instructions that carry no agent signature are unaffected, byte for byte.** The digest is built with
  `grant: tx.grant || undefined`, and `canon` drops undefined keys, so every non-agent digest is identical to today's.
- **The co-signature path is unaffected.** An institution `ops:` signature added for an escalation does not change
  the digest, so it does not invalidate the agent's signature. (Binding the full set of signer roles instead would
  break escalation, and is rejected for that reason.)
- **Sub-grants and revocation by an ancestor** name their signing grant the same way; the builders (`agentTx`,
  `grantTx`, `revokeGrant`) set it, so callers using them change nothing.
- **Schema and errors:** `GET /api/schema` lists `grant` in the envelope and `GRANT_MISMATCH` in the error catalogue
  with a remedy. An external agent that builds instructions by hand must now set `grant`.
- **Ordering with the pre-authentication work (hardening X1, still unmerged):** the comparison is between two
  caller-supplied strings, so it reveals nothing about which grants exist and may run before or after signature
  verification.

Measured on a **throwaway copy outside the repository** (the repository's kernel is untouched): 9 changed lines in two
source files.

| Measure | Result |
|---|---|
| `grant-binding.test.js` | 4/4 (the red test goes green) |
| Full suite | 175/177 |
| The 2 failures | `delegation.test.js` "an unknown grant is rejected" *relabels an agent signature to `agent:nope`* to provoke `UNKNOWN_GRANT`; that is exactly what Option A forbids, so it now gets `GRANT_MISMATCH` (still refused). `policy-guard-divergences.test.js`: its adapter builds agent instructions by hand without `grant`, so the amount-validation cases now stop at `GRANT_MISMATCH` first. Both are test-support changes, not safety changes. |
| Delegation model check, `node src/modelcheck.js 20 delegation` | 1,767 states / 37,107 transitions, exhausted, 0 failures (identical; the model builds instructions through `agentTx`, which binds) |

One thing the measurement does *not* settle: whether `grant` should be **mandatory** for agent-signed instructions
(closes the hole completely, but a stored chain containing older agent-signed instructions would then fail replay and
needs an activation height or a domain-tag bump) or **optional** (no replay problem, but an unbound instruction can
still be relabelled, so the hole stays open for exactly those instructions). The measurement used mandatory.

**Option B: forbid reusing an agent key across active grants** (`AGENT_KEY_IN_USE`). Smallest change and it removes
the shared-key precondition. It does not bind intent, it breaks the legitimate "one agent, several grants" pattern,
and it needs a rule for keys of revoked or expired grants. Reasonable as a complement, not as the fix.

**Option C: content-hash the parent**, for an export format rather than the kernel record. See section 6.

## 5. Invariant and model-checker changes it would need

- **Invariant:** extend P6 (Authority) with one clause: the grant charged and recorded for an agent-signed
  instruction is the grant named inside its signed bytes.
- **Property S6(f), grant binding**, judged by the existing oracle style: from the block log and the model's own record
  of which grants share keys, never from the kernel.
- **Model actions:** a root grant `g4` that shares `g1`'s key; the attack "relabel a signed `g1` instruction as `g4`"
  (must always be refused and inert); its legitimate counterpart signed under `g4`.
- **Planted bugs the checker must catch:** `grant` ignored by the kernel; `grant` left out of the digest; compared
  only for GRANT and not for other types; compared after the window was already charged.
- Re-measure and record real numbers in the charter, as in earlier items.

## 6. If DepositX GRANT is to be representable beside other grant formats

I have **not** seen the convergence specification or the note asking for it; this section rests only on the AIP v0.1
grant table (section 8 of `~/flashy-audit/spec/agent-interop-profile-v0.1.md`) and is my reading, to be checked.
Nothing here recommends adopting a format, and no contact has been made.

| AIP grant field | DepositX today | Gap |
|---|---|---|
| `id` | `grant_id` | none |
| `parent`: `sha256` of the parent's canonical bytes | the parent's `grant_id` | an export needs a content hash; the id binds on-ledger |
| `issuerKey` / `subjectKey` (child issuer must equal parent subject) | the root signer is the issuer's `ops` key; the holder is `agent_key`; a child is signed by its parent's `agent_key` | the key chain exists but is implicit; an export would state it |
| `scopes` | `allow_types` (a fixed deny-by-default list) | a mapping is needed |
| `cap` as `{amount, currency}` | two limits (`per_instruction_max`, window cap) and an implicit single currency | the mapping is lossy toward a single cap, and `currency` would be added as CAD |
| `expires` (RFC 3339 with offset) | `not_after`, epoch seconds | format |
| `audience`, `purpose`, `enforcedBy` | none; the chain id inside the signed digest plays the audience role | none of the three is expressible today |
| `nonce`, `signature` | `grant_id` is unique; the signature is on the GRANT instruction in the block log, not on the record | an export must carry the signed instruction |
| over-limit behaviour | ESCALATE (needs the institution's co-signature) | the other format denies; this is one of the five recorded policy-guard disagreements |

## 7. Money on every GRANT path: confirmed

The question was whether money is integer minor units everywhere GRANT touches it. Every case below was run
against the kernel, not read from the parser.

- **At the kernel boundary** (`per_instruction_max`, `window.max_total`, an instruction amount under a grant, a
  sweep `keepAmount`): only a canonical decimal **string of cents**, positive, no leading zero, at most 18 digits, is
  accepted (`^[1-9][0-9]{0,17}$`; `keepAmount` also allows `"0"`). Refused: JSON numbers, JS bigint, `"100.5"`,
  `"1e3"`, `"-5"`, `"0"`, `"0100"`, `" 100"`, `"+100"`, empty string, `null`, `true`, full-width digits, 19 digits,
  and `0.1+0.2` as a number. The 18-digit maximum is accepted. A missing `per_instruction_max` is `GRANT_UNBOUNDED`.
- **In state:** `per_instruction_max`, `window.max_total` and the window counter are BigInt. **In the API:**
  `GET /api/grants` serves all three as strings and the JSON round-trip is lossless. The schema states
  "decimal strings of integer cents".
- **No float arithmetic anywhere in `kernel.js`.** In the other source files the only non-integer arithmetic is
  `dollars()`, time, port and bond quantity. The dashboard's `cents()` is regex-gated and BigInt-based.

Two soft spots, neither on the ledger path, recorded rather than ignored:

1. `dollars(n)` is `BigInt(Math.round(n * 100))`: `dollars(1.005)` is 100 cents, where exact decimal arithmetic gives 101.
   Every one of its 255 call sites (30 in `src/`, 225 in `test/`) passes an integer, so nothing is wrong today; a
   fractional call site would be silently rounded.
2. `grantAgent` and `grantTx` stringify whatever they are given: `perInstructionMax: 1000` is accepted as 1,000
   **cents** ($10), not $1,000. Not a kernel defect (the kernel only ever sees strings) but a unit trap for callers.
   Suggested, as its own small item: make `grantTx` require a BigInt and make `dollars` accept only integers.

## 8. Decisions needed

1. **Option A (recommended)**, B, or A and B together?
2. **Mandatory or optional `grant`** for agent-signed instructions, and if mandatory, an activation height or a domain-tag
   bump for any stored chain that contains agent-signed instructions?
3. **Fix the two helper soft spots** (section 7) as a separate small item?
4. **Is a branch with one intentionally red test acceptable** until the fix is confirmed? It is not for merge in that state.

## 9. What was implemented and measured (2026-10-12)

Option A, mandatory, as sketched in section 4.

- `src/kernel.js`: `messageOf` adds `grant: tx.grant || undefined` to the signed digest; `#checkEnvelope` requires
  `tx.grant` to equal the id of the single `agent:` signature (`GRANT_MISMATCH`, `MULTIPLE_AGENT_SIGS` hoisted
  there) and refuses a stray `grant` on an instruction with no agent signature.
- `src/network.js`: `tx()` binds the grant when exactly one `agent:` role is signed for and signs it; the error
  catalogue has `GRANT_MISMATCH` with a remedy; `GET /api/schema` lists `grant?` and the new digest.
- Tests: `grant-binding.test.js` now 8 (the attack test and three pins, plus four BOUND tests: missing, wrong and
  stray `grant`; relabel-and-re-declare is `BAD_SIGNATURE`; two agent signatures; a non-agent digest identical to
  the old one; sub-grant and ancestor revocation). Two existing tests were changed because they relied on
  relabelling a signature: `delegation.test.js` (an unknown grant is now provoked by an honestly signed
  instruction naming it; the relabel gets `GRANT_MISMATCH`) and `agent-interface.test.js` (an unsigned instruction
  that still names a grant gets `GRANT_MISMATCH`; a fully stripped one still gets `MISSING_SIGNATURE`). The
  same-holder-splice pin now accepts `GRANT_MISMATCH` as well as `MISSING_SIGNATURE`, as it already did for
  `BAD_SIGNATURE`. The policy-guard adapter needed no change (it signs through `Network.tx()`, which binds).
- Model checker: 25 delegation actions (including a relabel-and-re-declare attack), oracle clause S6(f), one new planted bug; see
  `invariant-charter.md`, "Roadmap 8.5", for the numbers.

| Measure | Result |
|---|---|
| Full suite (`npm test`) | 184/184 |
| Delegation model, exhaustive | 12,478 states, 311,950 transitions, depth 16, 0 failures, 235.6 s |
| Base model, `Date.now` pinned | depth 5: 3,793 / 40,680; depth 6: 13,442 / 151,720; unchanged |

The earlier estimate for the throwaway copy was 175/177 with two explained failures; the real change needed the
same two test edits and the numbers above supersede that estimate.

Still open: whether a real store needs an activation height or domain-tag bump (not needed here, there is no
deployed chain); option B (refuse reuse of an agent key) was not built and is not needed for the property; the
two helper soft spots in section 7 are untouched; the AIP content-hash `parent` (option C) is an export concern.

### 9.1 Review follow-up (independent review, 2026-10-12)

An independent reviewer found no path that still lets signed bytes move onto another grant, and three smaller things,
all fixed:

1. **Model gap.** The model's relabel attack never also re-declared `grant`, so removing `grant` from the signed digest
   alone went undetected by the search. A second attack action does that now (checked on a throwaway copy: it is
   accepted there and the model check goes red).
2. **Stale digest cache.** The cached digest of a mutated instruction object was reused. Executed instructions are now
   deep-frozen (see the charter, "Frozen once executed"); a variant is a copy with its own digest. The statement in
   section 4 that changing `grant` "breaks the signature" holds for a fresh or copied instruction.
3. **Junk agent keys.** Any `agent:*` key in `sigs` now demands a matching `grant` even where the handler ignores it,
   so a relayer can get an institution-signed instruction refused by adding one; the clean instruction still runs.
   Pinned by a test and written up in the charter.

Not fixed, pre-existing and unrelated: an `ESCROW_LOCK` whose `releaseRole` is `agent:p1:zz` is accepted but can never
be released (it fails closed).

