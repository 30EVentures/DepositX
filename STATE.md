> **Update 2026-10-13 (branch `feature/agent-outcomes-p3`, local, not pushed):** this file is the overnight report as written; the integration work below changed some of its items.
> - **D7 resolved:** the overnight branch, grant-binding, hardening-x1, hardening-x2 and the X3/X4 proposals were cherry-picked in that order onto one branch (`integration/all-in-order`, 22 commits above `origin/main`); all conflicts resolved, nothing dropped (reviewer-verified), 283/283. Interplay found and fixed on the way: X1 changes two error codes the policy-guard corpus pins (two new reasoned entries in `policy-guard-divergences.json`: `records/transfer-without-destination`, `envelopes/no-envelope`); X2 and X3/X4 docs needed 9 reasoned entries in `claims-allowlist.json` (technical uses of "live", "final", "production", "guaranteed"); the X3 proposal's model grant is renamed `g5` because `g4` is now the grant-binding model grant. Delegation model re-measured on the integrated code: 25 actions, 12,478 states, 311,950 transitions, depth 16, exhausted, 0 failures (unchanged).
> - **D3 / P3 done:** `GET /api/instruction/<inst_id>?digest=<sha256 of the signed message>` and `Network#outcome`, plus `original:{ok,height,hash}` on a duplicate. Lookups are bound to the signed digest (a reviewer showed an id-only index confirmed a *different* instruction that reused an id, and that a garbage flood could evict a real outcome; both fixed: accepted outcomes and rejections live in separate bounded maps, duplicates are never recorded, `found:false` means unknown, not "never ran"). Kernel, digests and block hashes untouched; an institution-only scenario gives identical block hashes and state roots on `origin/main` and here.
> - **P8 done:** `test/field-mutation.test.js` + `field-mutation-accepted.json` (the mutation probe as a committed regression harness; 92 reviewed accepted values; fails on any new or vanished acceptance and on a new instruction type with no case).
> - **Also fixed:** a queued PAYMENT that rode in a *bound* batch dropped its signed `batch_digest` in the stored copy and never netted (present on `origin/main`).
> - **Still open:** P2 (Merkle inclusion proofs) changes every block hash and so breaks existing durable stores: it should land together with the one-time domain-tag bump (`depositx-poc-v1` to `v2`) that grant binding and the `canon` change also call for, as a deliberate break; B1-B5 unchanged. Test count on this branch: 296.

# Overnight run: DepositX bugs (branch `overnight/depositx-bugs`, from origin/main `c672a5b`)

Written unattended on 2026-10-12. Nothing here was merged, deployed, published or sent. The branch is pushed (plain push, branch only); no PR is open.

## Summary (bad news first)

**My mistakes**
1. **I called the kernel "total" too early.** After fix 1 I believed no input could make `executeBlock` throw after it had advanced the height. An independent reviewer found a second way in: a payload nested about 10,000 levels deep (an HTTP caller can send it) overflowed the stack in `canon(txs)`, which ran *after* the first mutation. Run on origin/main: `height 24, log 23`. My own `Object.create(null)` change to `canon` (fix 11) made it worse (threshold fell from about 7,000 to about 3,000 levels) until fix 13 moved all validation before the first mutation and bounded nesting at 24.
2. **One of my tests was vacuous.** The second receipts test passed on the old code because it kept the old validator signatures and failed the signature check first. Rewritten to re-sign with the genuine validator keys; now red on the old code (checked).
3. **Several of my first-round tests did not pin their fixes** (reviewer B, confirmed by mutating the fix): strict parsing of `L_after`/`A_after` (the old code already refused junk that did not equal the expected number; only a different *spelling* of the right number slipped through), `seq` as a safe integer, `UNFREEZE`/`CREDIT_SECURITY` on an escrow account. Pins added in `test/overnight-review-followups.test.js`.
4. **A first draft of the 04 flag cited a risk (S4) as saying "fewer than 4 banks"**; in 04 it says "2-3 banks" (the "fewer than 4" is in the strategy memo). Caught by re-reading my own diff before the reviewers did; corrected.

**Bugs found and NOT fixed** (details under Deferred): sweeps skip the per-instruction value cap and screening signature (D1); every rejected submission becomes a block (D2); retries cannot learn the original outcome (D3); receipts cannot prove a specific instruction was in the block (D4); one attest key can halt the network (D5); grants have no maximum lifetime (D6); this branch conflicts with all four sibling branches (D7).

**A caveat on the fixes themselves:** several tighten what the kernel accepts (reserved escrow accounts, `caller` shape, strict numerics, `queueIfShort` boolean, `kycRef`/`holdId` types). **There is no activation height.** A durable store written by old code that contains an instruction the new rules refuse would fail recovery with `STORE_CORRUPT` (a reviewer reproduced six such cases). The proof of concept has no deployed chain, and a chain written by old code with ordinary traffic replays byte-identically (64 blocks, every instruction type, same final hash and state root, [RAN] by a reviewer). Any real store would need an activation height or a domain-tag bump.

**BLOCKED** (a human decision is needed): B1 G0 bank-count thresholds; B2 bake-off vs Architecture Review Board dates; B3 the "Approved wording now" finality sentence; B4 merge order of the sibling branches and an activation height; B5 whether to open a PR.

**Fixes with proof** (each had a failing test first, run on the unmodified code): 16 changes, listed below. Headline ones, reproduced by a reviewer on a clean archive of origin/main:
- One unauthenticated payload-less instruction made the live ledger and its own block log disagree for good (`height 25, log 24`, `verifyReplay()` false).
- The beneficiary's own bank could `TRANSFER` an event-gated $1,000 out of an escrow account with no oracle event; the escrow stayed open at zero.
- `canon()` dropped any `__proto__` member, so two different documents shared one signed digest and one block hash.

**Ranked improvement proposals:** P1 netting that understands grants; P2 Merkle inclusion proofs in receipts; P3 retrievable outcomes for retried instructions; P4 pre-execution rejections are not blocks; P5 sweeps as instructions; P6 grant purpose/audience/max lifetime; P7 surface `internalErrors`; P8 one strict field-validation layer plus a committed mutation probe. Details under PROPOSALS.

**Test count:** 173 before, **224 after**, all passing (`cd poc && npm test`). `npm run corpus:policy-guard` unchanged (agreed 17, disagreed 5, abstained 22; matches the pinned table).

**Branch and SHA:** `overnight/depositx-bugs`; last code commit `d0b93a8`; the commit that adds this file version is the tip (`git log -1`).

**Do this first:** read B1 and B3 (one-line decisions), then decide the merge order in B4; everything else is mechanical.

## Baseline
- `cd poc && npm test` (`node --test test/*.test.js`): 173 tests, 173 pass, on `c672a5b` [RAN].
- Sibling branches read first and not touched: `grant-binding-mandatory` (`e565e49`, the `grant`-in-digest fix, unmerged), `hardening-x1` (`48be21b`), `hardening-x2` (`986ccdd`, sweeps vs frozen/halted accounts), `proposals-x3-x4` (`67e9502`). What they already cover is logged as KNOWN (D8), not re-fixed.

## Found and fixed
Each: failing test first (run on the unmodified code), smallest fix, full suite, local commit. Evidence tags: [RAN] executed here, [READ] from code or text, [VERIFIED] cross-checked against a second source.

| # | Lens | Finding | Proof | Commit |
|---|---|---|---|---|
| 1 | ledger | A handler that threw (no payload, non-string `releaseRole`, `BigInt()` of junk from a trusted key) escaped `executeBlock` after height and clock advanced but before the block was logged: one unauthenticated payload-less submit made `verifyReplay()` false on origin/main | [RAN] `height 25, log 24, replay ok false` on a clean archive of origin/main; 4 tests red | `0e167c9` `#execTx` converts a non-`KernelError` into `MALFORMED` (journal rolled back, counted in `counters.internalErrors`) |
| 2 | ledger | An agent PAYMENT with `queueIfShort` and a short position was queued, charged to the grant window, and never settled (NET_CYCLE needs the ops signature the agent payment lacks; the stored caller no longer matches the signed digest) | [RAN] `NET_CYCLE settled 0 remaining 1` with enough position; the ops-signed control nets | `a2b8bce` refused up front, `AGENT_QUEUE_UNSUPPORTED` |
| 3 | ledger | `#pubFor` used plain-object lookups: `constructor`/`toString`/`__proto__` passed the known-oracle and known-release-role checks; `agent:p1:zz` was read as grant p1 | [RAN] 21 tests red | `ad1a4a3` `Object.hasOwn`, at most two role segments |
| 4 | consensus | `Network.verifyReceipt` never compared `header.chainId` with the genesis | [RAN] red test | `fd1f44d` chain-id check; tolerates a missing `sigs` |
| 5 | authority | An institution-signed `caller` could be any object, including `{kind:'agent', grant_id, label}`, the exact shape the kernel stamps when it derives a caller from a grant (forged provenance), plus unbounded junk into the log and queue | [RAN] 2 tests red | `42c6e49` `CALLER_MISMATCH` unless `{kind, label?}` with length caps |
| 6 | documents | `01` section 8 listed five tranches (sum 274.8) against a 330.8 envelope; the CFO memo's sixth tranche T4 (56.2 standby) was missing | [VERIFIED] CFO memo section 2.3 table and its rounding line (sum 331.0), re-added by a reviewer | `6a9768b` |
| 7 | documents | G0 bank-count thresholds contradict: GO at 4+ banks (2 of the top 3), NO-GO below 3, kill trigger K3 below 5 founding issuers, S4 says 2-3 banks, `01` 3.3 item 5 says "six signed commitments" | [VERIFIED] every cited line re-checked by a reviewer | `6a9768b` flagged in `04`; no number chosen (B1) |
| 8 | overclaims | ROADMAP 8.1 spec said the reworded text "says the block is final"; block view field `finalSigs`; "live dashboard" in `package.json` (not scanned); two test titles; a receipt comment | [READ]; claims scan extended to `package.json` (red before) | `6b11fe6` |
| 9 | overclaims | `04` section 7 "Approved wording now" for legal finality cites a measurement nobody has made | [READ] | `6b11fe6` flagged, wording NOT changed (B3) |
| 10 | agent | An event-gated escrow's money could be `TRANSFER`red out of the reserved-id escrow account by the beneficiary's own bank with no oracle event; also `REDEEM`, `PAYMENT` in, `DVP`, `FREEZE`, sweeps, nested lock | [RAN] on the unmodified kernel: cedar +$1,000, escrow open at zero, invariants green | `c74c1a8` escrow accounts reserved (`ESCROW_ACCOUNT_RESERVED`), detected from the holder prefix so no state shape changes |
| 11 | crypto | `canon()` dropped any `__proto__` member, so distinct documents shared one signed digest and block hash | [RAN] `canon(JSON.parse('{"a":1,"__proto__":{"b":2}}')) === canon({a:1})` on origin/main | `d71cb58` null-prototype objects in `norm()`; every other canonical form pinned byte-for-byte |
| 12 | ledger (mutation probe) | `ATTEST.L`, `L_after`, `A_after` went through `BigInt()` (`""` is 0, `" 5"` is 5, `true` is 1, `[]` is 0, `"-5"` is -5); `Number.isInteger` accepted 1e21 for seq/kycExpires/expiresAt/not_after; the string `"false"` queued a payment; `kycRef` was `String()`-coerced; `holdId` could be any type | [RAN] probe of 22 instruction types x every field x 26 junk values (1,716 cases): 52 internal errors and 159 accepted values before; 0 and 92 after (every remaining one in-domain) | `6ff04ca` |
| 13 | ledger | `executeBlock` still threw after advancing height when `canon(txs)` overflowed on a deeply nested payload (reviewer A) | [RAN] origin/main, nesting 10,000: `height 24, log 23` | `d0b93a8` depth check and `txRoot` before the first mutation; nesting bounded at 24 |
| 14 | ledger | A queued institution-signed PAYMENT with a declared caller `{kind:'unspecified', label}` lost the caller in the stored copy and could never net (reviewer A) | [RAN] red test | `d0b93a8` stored as signed unless it is exactly the default |
| 15 | authority | `#pubFor` read issuer keys through the prototype (`constructor:MPL` passed `BAD_RELEASE_ROLE`); `CREDIT_SECURITY` could credit an escrow account (reviewer A) | [RAN] red tests | `d0b93a8` |
| 16 | tests | vacuous receipts test, hard-coded handler list, unpinned fixes (reviewer B) | [RAN] mutation of each fix | `d0b93a8` |

## Bugs found, NOT fixed (deferred)
- **D1 Sweep firings skip the per-instruction value cap and the `screen:` signature** [READ `#runSweeps`]. A sweep moves the whole excess over `keep` at end of block; TRANSFER caps at `maxTx` ($5M) and needs the issuer's screening signature. `hardening-x2` covers freeze/halt/quarantine only. Not demonstrated with a balance above $5M. Needs a design decision (is a sweep an instruction?).
- **D2 Every rejected submission becomes a block and a fsync'd store record** [RAN: height 24 to 25 on a rejected HTTP request]. An unauthenticated caller can grow the log without limit. The missing transport authentication is a known limit, but pre-execution rejections need not be blocks (P4).
- **D3 `DUPLICATE_INSTRUCTION` carries no pointer to the original outcome** [RAN]. An agent whose first response was lost cannot learn what happened by retrying (P3).
- **D4 A receipt does not prove a particular instruction was in the block** [READ]: `txRoot` is a flat hash of the whole instruction list (P2).
- **D5 One attest key can halt the whole network** (`ATTEST` with a low `L` is accepted, then over-issuance halts) [RAN]. That is the designed graded response, recorded because it is a single-key network-wide denial of service.
- **D6 Grants have no maximum lifetime**: `not_after` is bounded only by being a safe integer in the future [RAN, after fix 12]. Policy decision.
- **D7 Sibling-branch conflicts** [RAN `git merge-tree`, re-checked by a reviewer in a scratch clone]: this branch conflicts in `poc/src/kernel.js` and `poc/src/network.js` with `grant-binding-mandatory`, `hardening-x1`, `hardening-x2` and `proposals-x3-x4` (and in `poc/README.md` with the last three). The hunks are small and independent (envelope caller check, `#pubFor`, reserved escrow accounts, `executeBlock`, receipt check); the merge order is not mine to choose.
- **D8 Already known, not re-fixed here:** the same-holder grant splice (fixed on `grant-binding-mandatory`, unmerged, so origin/main still has it), error codes that leak state before signature checks (`hardening-x1`), sweeps firing from frozen/halted/quarantined accounts (`hardening-x2`), aggregate cap and retry double-pay (proposals X3/X4).
- **D9 Wording left alone:** `02-technical-implementation.md` line 78 and `board/cto-technical-implementation.md` line 269 say "ledger burn is final first" about the target system's redeem ordering. "Final" is about order, not settlement finality; a wording call for the document owner.
- **D10 `internalErrors` is counted but surfaced nowhere** except a test, so a genuine kernel `TypeError` is reported as `MALFORMED` (P7).
- **D11 `#runSweeps` does not re-check sweeps registered by old code against the reserved-escrow rule** (only reachable with a store written before fix 10).

## BLOCKED (decisions only a human can make)
- **B1 G0 bank-count thresholds** (finding 7): which number governs: GO at 4, kill below 5, NO-GO below 3, wedge at 2-3? Flag is in `04`; nothing chosen.
- **B2 Bake-off dates:** `02` T-2/S1 and `01` call a 10-week bake-off 12 Oct-18 Dec, but the same documents list "bake-off results 4 Dec" and an Architecture Review Board on 11 Dec, a week before the bake-off ends. Which governs the ARB decision? Not edited and no flag added; recorded only here.
- **B3 "Approved wording now" for legal finality** (finding 9): withdraw the sentence until measured, or keep it with the placeholder form?
- **B4 Merge order** of the sibling branches and this one (D7), and whether an activation height is wanted for the tightened rules.
- **B5** Whether this branch should become a PR. Pushed as a branch only, as allowed.

## PROPOSALS (architecture; nothing implemented)
1. **P1 Netting that understands grants** (replaces the refusal in finding 2). Store the agent's signed fields exactly (caller as signed, `batch_digest`, the grant id) beside the derived caller; make NET_CYCLE verify `agent:<id>` instead of `ops:` for such entries and re-check `#chain` liveness at netting time (revocation at enforcement). The window was already charged at queue time.
2. **P2 Inclusion proofs.** Make `txRoot` a Merkle root over canonical instruction hashes and serve `GET /api/receipt?inst_id=` with the path, so an agent can verify offline that "my instruction is in a block the quorum signed" without fetching the block. Append-only hash-chained ledgers that export Merkle snapshots with inclusion proofs are the closest prior art; no contact has been made.
3. **P3 Retrievable outcomes.** `GET /api/instruction/<inst_id>` returning `{height, hash, ok, error, events}`, and on a duplicate return the original outcome beside `DUPLICATE_INSTRUCTION`. Makes retries safe for an agent that lost a response.
4. **P4 Pre-execution rejections are not blocks** (D2), or go to a rejection log outside the chain.
5. **P5 Sweeps as instructions:** fire them through the same cap and screening checks as TRANSFER, or document that a sweep is an institution-internal rule outside the cap (D1).
6. **P6 Grant `purpose`, `audience`, `enforcedBy`** and a content-hash `parent` for export (the gap table in `poc/docs/grant-binding-proposal.md` section 6, on `grant-binding-mandatory`); plus a maximum grant lifetime (D6).
7. **P7 Surface `counters.internalErrors`** in `/api/state`.
8. **P8 One strict field-validation layer** (`parseId`, `parseAmount`, `parseTime`, `parseBool`) used by every handler. The payload-mutation probe used in this run is the regression harness; it is a scratch script today, not a committed test, and a trimmed version (handler list derived from `Ledger.prototype`) is a small follow-up.

## Method
- Lens rotation: 1 ledger/money, 2 consensus/settlement, 3 authority/keys, 4 documents, 5 overclaims, 6 agent-native (proposals, plus the escrow-custody bug it surfaced), then 7 (ledger again, via a payload-mutation probe) and 8 (canonical form).
- Review: three independent fresh-context reviewers read the diff (code and replay compatibility; tests and red-before; documents and report accuracy). Their findings produced fixes 13-16 and the mistakes listed above. Reviewer A found the nesting hole; reviewer B found the vacuous test and the unpinned fixes; reviewer C found no blocking issue in the documents and re-ran the three headline reproductions.
- Anything that could not be demonstrated was dropped. Not touched: `main`, any sibling worktree, the user's home configuration; only throwaway scripts in the session scratchpad were created outside this worktree.
