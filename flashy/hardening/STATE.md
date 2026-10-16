# Hardening report: phases 0 to 2

Branch `harden/phases-0-2` (local, not pushed), built on `mesh/readiness` (also local, unmerged). Written 2026-10-15. DepositX is a proof of concept: consensus is simulated in one process, there is no bank partner, and it is not regulated, not final and not live. Nothing here was pushed, merged, deployed or published; no FlashyOS endpoint was called; no token or key was created, read or printed.

## Bad news first

1. **This branch is not mergeable on its own.** It sits on top of `mesh/readiness`, which is itself local and unmerged. Nothing in this report is in `main` or on GitHub.
2. **Phase 1 items 5 and 6 (X1, X2) were already done and merged** (pull request 4). I added tests, not code, for them. X2 changes the settlement core and had been flagged as needing explicit sign-off first. **Resolved (N3), 2026-10-16:** on the owner's instruction "do N3", the merge of pull request 4 is recorded as the sign-off for X2. If that is not what was meant, say so and this line is wrong.
3. **The conformance numbers moved and the brief's are stale.** The corpus result is now 15 agreed, 7 disagreed, 22 abstained, not 17, 5, 22. Hardening X1 changed two answers on purpose (an unauthenticated caller must not learn which accounts or grants exist); both are pinned with reasons. [RAN]
4. **"Every ledger line carries its rail" is true of the reporting layer only.** `RailBook` lines and `routeInstruction` results now carry rail, unit, amount, reference, a label that says simulated or testnet, and kind. The kernel's own block events (for example `TRANSFERRED`) carry no rail, because the kernel is single-rail by construction (simulated CAD cents). A consumer reading blocks directly sees amounts without a rail. Adding a field to kernel events is a kernel change: not made (N8).
5. **The secrets scan cannot know the real token's shape.** The depositx-agent token format is opaque in the audit notes, so the scan is heuristic: token-like prefixes, private key blocks, JWT and bearer shapes, long hex next to a secret-sounding name, and any literal value assigned to the three FlashyOS variables. A secret of an unknown shape in a plain sentence would pass. The belt-and-braces rules (nothing from the agent init command, `.gitignore` entries) are exact.
6. **Presence is derived from the block listener, not from inside the kernel loop.** It reads the recorded block (results, sweep fires, violations) after the fact. The kernel was not touched. It cannot see a refused authorization that never became a block (none exists: every submission becomes a block).
7. **Three things the brief points at do not exist:** `flashy/mesh/TONIGHT.md` (removed on `mesh/readiness` because it named another product; replaced by `flashy/mesh/READINESS.md`), a DepositX file in `~/FlashyDemo/notes` (only three other products have notes), and a `docs/flashy` directory.
8. **Mutation checking found weak tests of mine, then fixed them.** The first evidence-snapshot tests let 8 of 16 mutants survive because every edit also broke the signature, so the specific checks were never exercised. Added 23 tests that re-sign after the edit; all 16 are now caught. Also one pre-existing weakness in my own earlier work: a presence test could not fail on a mislabelled sweep until a mutant exposed it.
9. **Property tests found no kernel bug.** That is a result, not a gap in effort: 600 random amounts, 400 random sub-grant envelopes, six random revocation walks and six random freeze/quarantine/halt walks all agree with independent oracles. [RAN] (One failure along the way was my generator, not the product.)
10. **Open by design:** batch binding is opt-in (a leg signed without a batch digest can be relayed alone). Pinned as such so a change is visible.

## Counts

| | tests |
|---|---:|
| `npm test` before (tip of `mesh/readiness`, `b794b06`) | 444 |
| `npm test` after | **618**, all passing |
| of which new hardening tests (`test/hardening/`) | 174, 66% named as refusals |
| `npm run test:pending` (red on purpose, not in `npm test`) | 19: 16 red, 3 controls green |
| policy-guard corpus | 15 agreed, 7 disagreed, 22 abstained (matches the 29-entry pinned table) |

The brief expected 173 before; `main` has grown since.

## What was done, by item

**Phase 0**
- 0.1 Secrets: `test/hardening/secrets.test.js` (29 tests): no tracked file may hold a token-shaped string, private key block, literal agent token or a file the agent init command writes (`.env`, generated reporter, inference and agent files, `depositx.aao.json`); `.gitignore` now keeps `.env*`, key files, `keys.json`, `data/` and `.flashyos/` out. The scanner is tested against 14 things it must flag and 9 it must leave alone; fixtures are excused by exact string only. Mutation: 3 rule mutants and 3 planted faults (a token in a tracked file, a tracked `.env`, a lost ignore entry) all caught.
- 0.2 Wording guard: `test/hardening/wording.test.js` (12): the disclaimer (simulated, proof of concept, no bank partner, not regulated, not live) must be present in both READMEs, the dashboard, the charter, the OpenAPI document, the readiness notes and the evidence story; state, receipt, measures and `/api/schema` carry a simulated label. Real gaps found and fixed: both READMEs and the dashboard lacked "no bank partner / not regulated / not live"; `/api/schema` was unlabelled. One more claim word is now scanned for in `claims.test.js` and needs a simulated qualifier in its sentence (two sentences reworded).
- 0.3 Presence from fixed phases: block processed is ACTIVE, a sweep that moved money is BUILDING, a refused authorization is REVIEWING, an invariant breach is INCIDENT, idle is IDLE. Fixed labels only, throttled, silent without the three variables, read-only. 11 tests, 4 mutants caught.
- 0.4 Phase-0 fixes, checked by behaviour on this branch: the old wording that overstated consensus (landed; the text now says ledger-accepted, simulated), escrow against a revoked grant (landed), sibling-grant CANCEL_SWEEP and ESCROW_REFUND (landed), batch atomicity (landed; the binding that stops a split is opt-in, so STILL OPEN by design). 5 tests.

**Phase 1**
- 5 X1: `test/hardening/preauth-oracle.test.js` (35): for 11 instruction shapes and 6 target states (missing, ordinary, frozen, KYC-expired, escrow holding account, missing escrow) an unauthenticated caller gets the identical answer under three signature states. It proves the checks added since X1 (reserved escrow accounts, caller shape, grant binding, strict numerics) did not reopen the oracle. Two leak mutants caught.
- 6 X2: confirmed merged; the existing 13 sweep-liveness tests plus a new random-walk property (six walks of freezes, quarantines and halts: a sweep never moves money where a manual transfer would be refused). Gate-removal mutant caught.
- 7 Rails: `lines()`, `kind` and unit/amount on routing results in `src/flashy/rails.js` (additive; one existing expectation extended); `test/hardening/rails-properties.test.js` (10 property tests: exact BigInt sums per rail, 400 random non-canonical amounts refused, 400 random wrong-unit records refused, a stablecoin instruction never touches the simulated network, a refused instruction records nothing). `authority-properties.test.js` (6): canonical amounts, authority only narrows (400 random envelopes against an independent oracle), revocation and expiry checked at enforcement (random walks). 14 mutants caught.
- 8 Conformance question: `poc/docs/design-questions/over-cap-escalate-or-deny.md` with options A (keep), B (refuse) and C (two tiers), measured: B is worse on the corpus (12 agreed, or 15 with matching codes, no net gain); C is the only option that can move the number. Tests: `conformance-options.test.js` (Option A pinned and the measurements) and the red tests for B and C in `test/pending/`.

**Phase 2**
- 9 X3, X4: failing tests only, in `test/pending/` (`x3-aggregate-cap.pending.test.js`, `x4-idempotency.pending.test.js`), each tied to the existing design note. No kernel change.
- 10 Evidence: `src/flashy/evidence/` (builder, standalone verifier, canonical form) and `flashy/mesh/EVIDENCE.md`: a sealed, deterministic snapshot of the simulated settlement model that a stranger verifies offline against a pinned key, with the wording inside the seal. 59 tests; 16 mutants caught after strengthening. The repository holds no key and has no command that reads one.
- 11 See NEEDS CALEB.

## NEEDS CALEB

- **N1 Counsel gate** before any user-facing version (including the public listing, the evidence story and the dashboard text). Not contacted; nothing sent.
- **N2 Public listing** of the organisation only with the charter wording as it stands (simulated, proof of concept, no bank partner, not regulated, not final, not live). The earlier public ask for partner banks (`wants`) stays removed unless you decide otherwise.
- **N3 X2 sign-off: RESOLVED 2026-10-16.** Recorded on the owner's instruction ("do N3") that merging pull request 4 stands as the sign-off for the settlement-core change. Correct me if I read that wrongly.
- **N4 Over-cap question:** A, B or C (section 6 of the design question). Recommended: C if the aim is to be checkable against an outside corpus, A otherwise; not B.
- **N5 X3 and X4:** go or no-go to build. The failing tests and design notes are ready; both are additive and need the single digest-version change.
- **N6 Merge order and the digest-version change:** `mesh/readiness` then this branch; and when to bump the signed-digest tag once for grant binding, the canonical-form fix and any X3/X4/C fields.
- **N7 Evidence key:** where the signer's public key is pinned, and who holds the private key. Nothing was generated.
- **N8 Rail on kernel events:** whether to add a rail field to the kernel's block events (a kernel change, additive, would alter block hashes for chains that record them).
- **N9 Still-public material:** the root README names a third-party blueprint that is public on `main`; flagged earlier, unchanged.

## How to check

```bash
cd poc && npm test                 # 618 tests, about 2.5 minutes
npm run test:pending               # 19 tests; 16 are red on purpose
npm run corpus:policy-guard        # 15 agreed, 7 disagreed, 22 abstained, matches the pinned table
node src/flashy/evidence/verify-snapshot.mjs snapshot.json --pin signer-public-key.txt
```
