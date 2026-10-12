# Overnight run state (branch overnight/depositx-bugs, from origin/main c672a5b)

> Summary goes here at the end. Working log below.

## Baseline
- `cd poc && npm test` (`node --test test/*.test.js`): 173 tests, 173 pass, 0 fail, on c672a5b [RAN].
- Sibling branches read first, not touched: grant-binding-mandatory (e565e49, the grant `grant`-in-digest fix, unmerged), hardening-x1 (48be21b), hardening-x2 (986ccdd, sweeps vs frozen accounts), proposals-x3-x4 (67e9502). Anything they already cover is logged as KNOWN, not re-fixed.

## Found / fixed (each: red test first, then smallest fix; suite after each)
| # | Round | Finding | Proof | Fix commit |
|---|---|---|---|---|
| 1 | 1 ledger | A handler that throws (no payload, non-string releaseRole, BigInt of junk from a trusted key) escaped executeBlock after height/clock advanced but before the block was logged: one unauthenticated payload-less submit made `verifyReplay()` false for good on origin/main | [RAN] `ledger height 25 log 24, replay ok? false` on a git-archive of origin/main; 4 tests red | 0e167c9 `#execTx` converts non-KernelError to MALFORMED (counted in `counters.internalErrors`) |
| 2 | 1 ledger | Agent PAYMENT with `queueIfShort` and a short position was queued, charged to the grant window, and never settled (NET_CYCLE needs the ops signature the agent payment lacks; stored copy's caller no longer matches the signed digest) | [RAN] NET_CYCLE `settled:0 remaining:1` with enough position; control (ops-signed) nets | refused up front: `AGENT_QUEUE_UNSUPPORTED` |
| 3 | 1 ledger | `#pubFor` used plain-object lookups: `constructor`/`toString`/`__proto__` passed the known-oracle (`UNKNOWN_EVENT`) and known-release-role checks, and `agent:p1:zz` was read as grant p1 | [RAN] 21 tests red | `Object.hasOwn`, max two role segments |
| 4 | 2 consensus | `Network.verifyReceipt` never compared `header.chainId` with the genesis, so a receipt verified against another chain's genesis | [RAN] red test | chain-id check; tolerates missing sigs |
| 5 | 3 authority | Institution-signed `caller` could be any object, including `{kind:'agent', grant_id, label}` = the exact shape the kernel stamps when it derives a caller from a grant (forged provenance), plus unbounded junk into log/queue | [RAN] 2 tests red | `CALLER_MISMATCH` unless `{kind, label?}` with length caps |

| 6 | 4 docs | `01` section 8 listed five tranches (sum 274.8) against a 330.8 envelope; the CFO memo's sixth tranche T4 (56.2 standby) was missing | [VERIFIED] CFO memo section 2.3 table + its rounding line (sum 331.0) | 6a9768b added T4 to `01` |
| 7 | 4 docs | G0 bank-count thresholds contradict: GO at 4+ banks (2 of top 3), NO-GO below 3, kill trigger K3 below 5 founding issuers, S4 says 2-3 banks, `01` 3.3 item 5 says "six signed commitments" | [VERIFIED] by reading `01` 3.3, `04` G0/K3/S4, `board/strategy-risk-challenge.md`, CFO K3 | flagged in `04` (no number chosen: BLOCKED on a board decision) |
| 8 | 5 overclaims | ROADMAP 8.1 spec still said the reworded ISO text "says the block is final"; block view field `finalSigs`; "live dashboard" in package.json (not scanned); two test titles ("network is live", "finality receipts"); a receipt comment | [READ] + claims scan extended to package.json (red before) | 6b11fe6 |
| 9 | 5 overclaims | `04` section 7 "Approved wording now" for legal finality cites a measurement nobody has made | [READ] | flagged in `04`, wording NOT changed |
| 10 | 6 agent | An event-gated escrow's money could be TRANSFERred out of the reserved-id escrow account by the beneficiary's own bank with no oracle event (also REDEEM, PAYMENT in, DVP, FREEZE, sweeps, nested lock) | [RAN] on unmodified kernel: cedar +$1,000, escrow open at zero, invariants green | escrow accounts reserved (`ESCROW_ACCOUNT_RESERVED`), no state shape change |
| 11 | 8 crypto | `canon()` dropped any `__proto__` member, so distinct documents shared one signed digest / block hash | [RAN] `canon(JSON.parse('{"a":1,"__proto__":{"b":2}}')) === canon({a:1})` | null-prototype objects in `norm()`; other canonical forms pinned unchanged |

| 12 | 7 ledger (mutation probe) | `ATTEST.L`, `OPEN_HOLD.L_after`, `FUND_SP`/`DEFUND_SP.A_after` went through `BigInt()` (`""` is 0, `" 5"` is 5, `true` is 1, `[]` is 0, `"-5"` is -5, junk threw); `Number.isInteger` accepted 1e21 for seq/kycExpires/expiresAt/not_after; the string `"false"` queued a payment; `kycRef` was `String()`-coerced from any value; `holdId` could be any type | [RAN] probe of 22 instruction types x every field x 26 junk values (1,716 cases): 52 internal errors, 159 accepted values before; 0 and 92 after (every remaining one in-domain). 4 tests red first | 6ff04ca |

Test count: 173 -> 217 (+44 across 8 new test files and 1 extended scan), all passing. `npm run corpus:policy-guard`: unchanged (agreed 17, disagreed 5, abstained 22; matches the pinned table).

## Bugs found, NOT fixed (deferred)
- **D1 Sweep firings skip the per-instruction value cap and the `screen:` signature** [READ `#runSweeps`]. A sweep moves the whole excess over `keep` at end of block; TRANSFER caps at `maxTx` ($5M) and needs the issuer's screening signature. hardening-x2 covers freeze/halt/quarantine only. Not demonstrated with a >$5M balance; needs a design decision (is a sweep an instruction?).
- **D2 Every rejected submission becomes a block and a fsync'd store record** [RAN: height 24 -> 25 on a rejected HTTP request]. An unauthenticated caller can grow the log without limit. Known "no transport auth" limit, but the growth is worth a rule: pre-execution rejections (bad shape, bad inst_id, bad validity) need not be blocks.
- **D3 `DUPLICATE_INSTRUCTION` carries no pointer to the original outcome** [RAN]. An agent whose first response was lost cannot learn what happened by retrying (see P3).
- **D4 A receipt does not prove a particular instruction was in the block** [READ]: `txRoot = sha256(canon(txs))` is a flat hash (see P2).
- **D5 One attest key can halt the whole network** (`ATTEST` with a low `L` is accepted, then over-issuance halts) [RAN]. That is the designed graded response, recorded here because it is a single-key network-wide DoS.
- **D6 Grants have no maximum lifetime**: `not_after` is bounded only by being a safe integer in the future [RAN, after fix 12]. Policy decision.
- **D7 Sibling-branch conflicts** [RAN `git merge-tree`]: this branch conflicts in `poc/src/kernel.js` and `poc/src/network.js` with grant-binding-mandatory, hardening-x1, hardening-x2 and proposals-x3-x4 (and in `poc/README.md` with the last three). The hunks are small and independent (envelope caller check, `#pubFor`, reserved escrow accounts, `submit`/receipt); merge order is not mine to choose.
- **D8 Already known and NOT re-fixed here**: the same-holder grant splice (fixed on grant-binding-mandatory, unmerged, so origin/main still has it), error codes that leak state before signature checks (hardening-x1), sweeps firing from frozen/halted/quarantined accounts (hardening-x2), aggregate cap and retry double-pay (proposals X3/X4).
- **D9 Wording left alone**: `02-technical-implementation.md` line 78 and `board/cto-technical-implementation.md` line 269 say "ledger burn is final first" about the target system's redeem ordering. Ambiguous ("final" is about order, not settlement finality); a wording call for the document owner.

## BLOCKED (decisions only a human can make)
- **B1 G0 bank-count thresholds** (finding 7). Which number is it: GO at 4, kill below 5, NO-GO below 3, wedge at 2-3?
- **B2 Bake-off dates**: `02` T-2/S1 and `01` call a 10-week bake-off 12 Oct-18 Dec, but the same documents list "bake-off results 4 Dec" and an Architecture Review Board on 11 Dec, a week before the bake-off ends. Which date governs the ARB decision? Not edited (no flag added either; recorded here only).
- **B3 "Approved wording now" for legal finality** (finding 9): withdraw until measured, or keep with the placeholder form?
- **B4 Merge order** of the sibling branches and this one (D7).
- **B5 Whether this branch should be pushed to a PR at all**: pushed as a branch only, as allowed; no PR opened.

## PROPOSALS (architecture; nothing implemented)
1. **P1 Netting that understands grants** (replaces the refusal in finding 2). Store the agent's signed fields exactly (caller as signed, `batch_digest`, and the grant id) beside the derived caller; make NET_CYCLE verify `agent:<id>` instead of `ops:` for such entries and re-check `#chain` liveness at netting time (revocation at enforcement). The window was already charged at queue time.
2. **P2 Inclusion proofs.** Make `txRoot` a Merkle root over canonical instruction hashes and serve `GET /api/receipt?inst_id=` with the path. An agent can then verify "my instruction is in a block the quorum signed" offline without fetching the block. Same shape as the Merkle snapshots with inclusion proofs that FlashyLabs' flashy-ledger exports (per the local audit notes, `commerce-wallet-ledger.md`); useful prior art, no contact.
3. **P3 Retrievable outcomes.** `GET /api/instruction/<inst_id>` returning `{height, hash, ok, error, events}`, and on a duplicate return the original outcome next to `DUPLICATE_INSTRUCTION`. Makes retries safe for an agent that lost a response.
4. **P4 Pre-execution rejections are not blocks** (D2), or are batched into a rejection log outside the chain.
5. **P5 Sweeps as instructions**: either fire them through the same cap/screen checks as TRANSFER, or document that a sweep is an institution-internal rule outside P-cap (D1).
6. **P6 Grant `purpose`, `audience` and `enforcedBy`** and a content-hash `parent` for export (the AIP gap table in `poc/docs/grant-binding-proposal.md` section 6, on grant-binding-mandatory); plus a maximum grant lifetime (D6).
7. **P7 Surface `counters.internalErrors`** in `/api/state` so a handler that trips on bad input is visible instead of just counted.
8. **P8 One strict field-validation layer** (`parseId`, `parseAmount`, `parseTime`, `parseBool`) used by every handler; the mutation probe in this run is the regression harness (it is a scratch script today, not a committed test; turning it into one is a small follow-up).

## Method
- Lens rotation: 1 ledger/money, 2 consensus/settlement, 3 authority/keys, 4 documents, 5 overclaims, 6 agent-native (proposals only), then 7 (ledger again, via a payload-mutation probe) and 8 (canonical form / crypto). Each code bug: failing test first, smallest fix, full suite, local commit.
- Evidence tags: [RAN] executed here, [READ] from reading code or text, [VERIFIED] cross-checked against a second source, [INFERENCE] reasoned. Anything that could not be demonstrated was dropped.
- Not touched: main, any sibling worktree, `~/.claude`, anything outside this worktree except throwaway scripts in the session scratchpad.

## Deferred
## BLOCKED
## PROPOSALS
