# DepositX Network — Gates, Risks and Blueprint Amendments

**Status:** Proposed for ratification. Sources: `board/strategy-risk-challenge.md` (gates, register, red-team, claims), `board/cfo-coo-programme-and-economics.md` §7 (kill/pivot, KPIs), `board/legal-regulatory.md` §8 (risks). Gate dates are aligned to the master schedule in `01`, so they differ slightly from the individual memos (noted in §1).

---

## 1. Decision gates

**Who decides.** Gate Committee: independent chair (deciding vote only on ties), two independent directors (one with risk/regulatory background), one senior executive per founding issuer. BoC, OSFI, FINTRAC and CDIC are invited non-voting observers; their non-objection is an input, not a vote. **Go = two-thirds of founding issuers by count *and* by committed funding, plus CRO independent-assurance sign-off. No-Go = simple majority. Pivot = simple majority.** The CRO reports to the independent directors on gate evidence. Standing kill triggers apply at any time (§3). The board cannot waive the three invariants.

| Gate | Date (plan) | GO if all true | NO-GO if any true | PIVOT to |
|---|---|---|---|---|
| **G0** Constitute | 31 Mar 2027 | See `01` §3.3: six-bank relationship resolved; 4+ banks incl. 2 of the top 3 committing to Phase 1; BoC/Payments Canada written response on the settlement asset; governance charter with vote caps and independent chair; discovery complete (60 interviews, 8+ corporate and 3+ dealer LOIs, indicative flow ≥C$1B/day, one high-value/low-RTR-overlap use case); bottom-up cost ±25% and Phase 1–2 funding 100% committed; two legal opinions; competition protocol signed off | Fewer than 3 banks commit; BoC declines any settlement role; no use case with 5+ repeat counterparties | Path C, B or D |
| **G0-R** | Jun 2027 | Written engagement protocol acknowledged by each regulator; named contacts and cadence; BoC role stated (read-only supervisory node vs other); condition on releasing Phase 2 at-risk spend | Any regulator states in writing it cannot treat tokens as deposits (K1); BoC declines observer and anchor role (K8) | Pivot P2 |
| **G1** Testnet exit | 15 Dec 2027 | Three or more issuer nodes on testnet, two on real bank-side integration; **≥100M simulated instructions with zero unreconciled events** (Strategy's floor was 1M; the CTO/CFO test is 100M) plus 72 h soak at 1,000/s; 500+ fault scenarios with all Sev-1 closed; consensus p99 <5 s at 100/s sustained and 500 burst; confidentiality mode selected (M1 passes or M2 adopted); PFMI gap assessment with no open high gaps; designation route defined in writing; regulator non-objection to a capped live pilot or documented BoC position; cost variance <15%; 5+ corporate/dealer pilot contracts; founder-validated benefit in Go/Conditional band | Fewer than 2 issuers will go live; settlement asset unresolved; critical audit finding open; **no written route to legal finality (K2)** | Path A |
| **G1.5** Live-money readiness | Q1–Q2 2028 | All Legal live-entry gates G1–G10 met (`01` §5); proofs complete; SOC 2 Type I; audit #1 clean; DR rehearsed; NOC in shadow mode; Wave 1 banks Pilot-Certified | Any Legal gate open | Delay; Path A |
| **G2** Pilot exit / cap lift | Q1 2029 | 3+ issuers and 15+ live clients; cumulative settled value ≥C$50B (re-base to observed demand); availability ≥99.95% over last 6 months; no unreconciled supply event >15 min; par exceptions 0 in N >10M; ≥4 successful DR runs (RTO <15 min); independent audit with no open critical/high; SOC 2 Type II window complete; **supervisory non-objection to lift caps; legal-finality route confirmed in writing**; 80% of pilot clients active in last 8 weeks; run-cost recovery ≥70% at planned production volumes | Any client-money loss; settlement asset not in place; <8 clients; availability <99.9% | Extend once (max 2 quarters); Path A |
| **G3a** Production | 30 Nov 2029 | All founding issuers (or the quorum the charter specifies) live and Production-Certified; 24/7/365; netting and bond cash-leg live; designation in force or explicit written BoC position; no open regulatory conditions | Open regulatory conditions; fewer than 4 issuers live | Path A; Path C |
| **G3b** Acceptance | Sep 2030 | ≥99.99% over two full quarters after G3a (99.999% is the design target); ≥10% of defined eligible flow in the anchor use case among participating banks; fees cover ≥100% of run cost on the year-2 plan; independent PFMI assessment "observed" or "broadly observed" with plan; supervisory query <60 s in 4 unscripted tests; no unresolved Sev-1 | Availability <99.9%; fee coverage <70% with no path; regulator objection | Path A; Path B |
| **G4** Expansion | Not before Oct 2030 | CDIC written confirmation; consumer-protection regime agreed; RTR interoperability assessed; ≥1 cross-border corridor under supervision; PQ hybrid signatures deployed | CDIC or regulators object; retail economics negative | Stay wholesale |

**Differences from the individual memos:** Strategy's G2 (Dec 2028) and G3 (Q4 2029) assumed an earlier live pilot; CFO's G2 was Sep 2029 on a later pilot. This plan puts capped live in Q2 2028, G2 in Q1 2029, all-founders production 30 Nov 2029 and acceptance Sep 2030. Gate criteria are the substance; dates move with the pilot start.

## 2. Scope-down paths

| Path | What it is | Trigger | Effect |
|---|---|---|---|
| **A. Wholesale single-use-case network** | Bank/dealer cash-leg DvP (Samara lineage) and interbank weekend liquidity; 3 banks; no corporate access; permissioned-privacy fallback; no netting at go-live | G1 or G2 stumble on settlement or timeline; discovery shows only wholesale demand | Run team 15–20; cost ~30–40% of base; production ~2 quarters after G2 |
| **B. Standard and certification body** | DepositX publishes the rulebook, interface spec and certification suite; runs no production ledger; the six banks' initiative or a vendor operates | The six proceed without an operator role for DepositX | Team ~10–15; keeps the standard-setting asset |
| **C. Second-tier network and interoperability layer** | Serves institutions the six's rail does not (credit-union centrals, Desjardins, mid-size and foreign subsidiaries), interoperable with the six | The six proceed and are open in principle | Smaller economics; realistic if access rules are fair |
| **D. CAD gateway to global networks** | CAD deposit tokens made available on Canton, Swift ledger or Kinexys | Domestic demand fails but cross-border demand exists | Needs BoC/legal work on cross-ledger finality |
| **E. Sunset** | Wind down; publish learning, specifications and test artefacts | Two consecutive gate failures or a standing kill trigger | Budget a wind-down reserve (~3 months of run cost) from the start |

CFO's **pivots**: P1 lean operator (~60 FTE, outsourced 24/7 NOC, ~$39M/yr run cost; programme cost −$60–80M, CFO estimate); P2 alternative settlement anchor via Lynx or a sponsor bank (+6–12 months); P3 interoperate, do not compete (operator cost falls by more than half); P4 narrow launch.

**Stop-loss discipline.** Every gate memo shows spend to date and stranded cost if the board stops there. Operator-only, CFO base: ~$13M at G0, ~$60M at G1, ~$175M at G2 (bank-side spend is additional). **Stage-gate hiring** (no Phase 2 ramp before G1 and the Jun 2027 regulatory letter) is stop-loss insurance that avoids ~$25M of stranded cost.

## 3. Kill triggers (Steering Committee decision, ratified by reserved-matter vote)

| # | Trigger | Measured | Response |
|---|---|---|---|
| K1 | A regulator states in writing that deposit tokens cannot be treated as deposits or as CDIC/AMF-covered and no acceptable structure exists | Any time; G0-R latest | Stop or re-scope to wholesale-only, non-insured with a fresh case |
| K2 | **No written route to legal finality** (designation or equivalent) by G1, or a statutory change is required with no dated legislative path | G1 | Hold all Phase 2 spend; if unresolved after 6 more months, stop |
| K3 | Fewer than **five** founding issuers, or fewer than three of the six largest banks, sign funding and readiness covenants | G0 | Re-scope to lean variant or halt |
| K4 | Founder-validated steady-state gross benefit **below $70M/yr** in aggregate | G1 | Stop or pivot to lean operator (P1) |
| K5 | Par or settlement design flaw found in formal verification that cannot be fixed in 6 months; or the fallback confidentiality design cannot sustain 500 instr/s at <2 s median in the Phase 2 lab | G1–G2 | Stop the production path; re-design |
| K6 | Two consecutive failed reserved-matter votes on rulebook v1 or fee methodology; or founder withdrawal leaving <4 issuers | Any time | Re-scope; independent mediation first |
| K7 | Forecast at completion >130% of the G1 baseline without approved re-baseline, or spend >15% over gate budget | Monthly | Freeze new hires and vendor commitments |
| K8 | The Bank of Canada declines an observer and settlement-anchor role | G0-R | Pivot P2 |
| K9 | Any par break in pilot or production; or a critical audit finding unremediated after 90 days | Any time | Halt issuance and redemption; independent review; resume only by reserved-matter vote |
| K10 | An overlapping national rail delivers the same capability with regulator preference | Any time | Pivot P3 |
| K11 | A loss of client money attributable to DepositX; withdrawal of funding below 100% of the next phase | Any time | Standing kill triggers (Strategy) |

## 4. Risk register (top of 41; full register in `board/strategy-risk-challenge.md` §3)

**Reading (Strategy):** 15 of 41 risks score ≥15 and 9 of those 15 are strategic, regulatory or legal. **The programme's risk is dominated by "will it be allowed and adopted," not "will the technology work."**

### Five existential (pre-launch)

| ID | Risk | L×I | Owner | Early warning | Mitigation |
|---|---|---|---|---|---|
| **R1** | **Settlement asset unresolved**: no BoC/Payments Canada arrangement, so no interbank finality or par | 4×5 | Head of Regulatory Affairs, sponsored by Chair | No written BoC position by G0 | Prefunded-position proposal; joint working group; **do not go live without it** |
| **S1** | **Six-bank initiative bypasses or absorbs DepositX** | 4×5 | Chair / CSO | No reply to outreach in 10 days; the six name a vendor or governance without DepositX | D1 by 9 Oct; outreach now; tell regulators DepositX is the neutral option |
| **S2** | **Governance deadlock or dominance** | 4×5 | Chair | Repeated no-decision meetings; first economic vote splits | Vote caps, independent chair and directors, two-thirds by count and value, expert determination, safety-first default |
| **R2** | **No legal finality or insolvency protection**; PCSA designation timing | 3×5 | General Counsel | Counsel cannot opine without qualification | Dual track (rulebook + opinions for the pilot; designation dossier filed Q3 2027–Q1 2028); no "legal finality" claim until confirmed |
| **S3** | **No anchor use case that Lynx + RTR cannot serve** | 3×5 | CSO / Head of Product | <8 LOIs by day 90; RTR covers 80%+ of hypothesised flow | Discovery; Path A/B; drop the generic "instant payments" pitch |

**Post-launch existential (managed by design):** a par or reconciliation failure (T2, O3) amplified by overclaiming (RP1).

### Other high-scoring risks

| ID | Risk | L×I | Notes |
|---|---|---|---|
| T4 | Core-banking integration cost/timeline per bank | 5×4 | Highest likelihood; tiers, hold-based mint, certification suite, bank-funded budgets |
| S4 | Partial participation; no network effect | 4×4 | Wedge needs 2–3 banks; routing fallback to RTR/Lynx |
| R3 | Operator classified as FMI/PSP/other; obligations drift | 4×4 | Design to PFMI from day one |
| O1 | 24/7/365 shortfall (bank cores have batch windows) | 4×4 | SLO ladder; separate network vs bank availability |
| L1 | Liability allocation unresolved | 4×4 | Rulebook loss allocation, caps, insurance |
| S5, T2, O3, F1, RP1 | Marginalised by a national platform; par/settlement defect; supply–liabilities drift; screening evasion via confidentiality; marketing outruns evidence | 3×5 | See register |

**Legal top-10 (Legal §8A)** adds: Competition Act exposure (s.45, s.90.1 — efficiency defence removed in 2024 **[S]**), CDIC/provincial-insurer treatment, Stablecoin Act perimeter (FRFI exclusion depends on regulations), OSFI B-10/B-13/E-21 expectations, interbank credit exposure before central-bank settlement, AML/Travel Rule vs confidentiality, operator viability and liability.

**CFO top-10 adds:** business case does not close (NPV −$78M base for a Tier A bank), talent scarcity, bank capacity contention (RTR/ISO 20022/OSFI deadlines/year-end freezes), vendor and concentration risk, competing rails.

## 5. KPIs by gate (selected; full set in `board/strategy-risk-challenge.md` §6.1 and CFO §6)

| Domain | Metric | Target at G2 / G3b |
|---|---|---|
| Adoption | Live issuers; live clients; active in last 8 weeks | 3 / 4+ issuers; 15+ clients; 80%+ active |
| Liquidity | Share of participating banks' eligible cross-bank flow (defined per use case); fallback rate to RTR/Lynx | ≥10% at G3b |
| Concentration | Top-issuer share of volume | <40% |
| Integrity | Unreconciled supply minutes; time to detect/clear | Zero over 15 min; detect <5 min |
| Reliability | Rolling-90-day availability; end-to-end p95; consensus p99 | 99.95% / 99.99%; p95 <10 s |
| Supervision | Unscripted supervisory query time | <60 s on-ledger; entity roll-up in 15 min |
| Economics | Fee coverage of run cost; integration cost vs plan | ≥70% / ≥100%; within 15% |
| Governance | Decision cycle time; deadlocks | <30 days; zero |
| Trust | Incident disclosure time | Within 24 hours |

**Anti-metrics:** exclude intra-group and circular transfers from volume claims and publish that exclusion; reward retained clients, not gross volume.

## 6. Replacement north stars (proposed; retire the v0.9 set at D4)

| v0.9 north star | Status | Replacement |
|---|---|---|
| Zero par breaks and zero client-money loss events, cumulative, for the life of the network | **Doubtful** as absolute | "0 par exceptions in N settled instructions over D days, as of [date]" with a published definition (any credit or redemption not 1:1 to the issuer's liability, or unreconciled supply over tolerance for more than 15 minutes); upper bound reported (3/N at 95% confidence). Client-money loss: standing kill trigger |
| Finality <2 s median, <5 s p99 | **Plausible** but only measures consensus | Two SLOs: consensus p99 <2 s at design load; end-to-end initiate-to-credit p95 <10 s including bank side |
| ≥95% of eligible wholesale flow settle-able on DepositX by end Phase 3 | **Doubtful** ("eligible" undefined; capacity, not usage) | By use case: e.g. ≥30% of participating banks' cross-bank own-account transfers and 100% of pilot-scope DvP cash legs on DepositX by G3b, with a published definition of eligible. (The CTO's capability test "≥95% settle-able" remains a Phase 3 engineering exit, not a north star.) |
| Supervisory query <60 s | **Plausible** for on-ledger | On-ledger positions <60 s; entity-level roll-up in 15 min; demonstrated in unscripted tests |

## 7. Claims discipline (effective now)

**No public claim without a claim ID, an evidence source, a date, an owner and a re-verification date within 90 days. Claims that lose evidence are withdrawn within 48 hours.** Publish a plain-language incident summary within 24 hours of any Sev-1.

| v0.9 phrase | Approved wording now | When evidence exists | Never say |
|---|---|---|---|
| "Zero par breaks" | "Designed so each token remains redeemable at par at its issuing bank. In testing to date: 0 par exceptions in N transfers (upper bound at 95% confidence 3/N)." | "0 par exceptions in N settled instructions over D days, as of [date]; definition and audit report at [link]." | "Never breaks par"; "zero risk"; "guaranteed" |
| "Regulated" | "Designed against OSFI and PFMI expectations. Issuers are OSFI-regulated banks." | "Operated by [entity], [designated/overseen] under [statute] by [authority]." | "Regulator-approved"; "fully compliant"; "regulated network" (before designation) |
| "Legal finality" / "settles in under two seconds with legal finality" | "Reaches consensus finality in under two seconds (median, measured). Finality basis is set out in the Rulebook." | "Settlements are final under [statute/rulebook clause]." | "Instant legal finality" until an insolvency and finality opinion and designation (or written regulator position) exist |
| "CDIC-insurable" | "Deposits underlying tokens are deposits at a regulated bank. CDIC coverage rules apply to the underlying deposit; CDIC's treatment of the token form is pending." | As CDIC confirms | "Insured tokens"; "fully protected"; anything implying CDIC covers Desjardins or credit unions |
| "24/7/365" | "Built to operate around the clock. Measured network availability: X% over the last 90 days." | Same | "Always on"; "never down"; "five nines" before measured |
| "Sub-two-second" | "Median consensus finality Ys, p99 Zs, as of [date], on [load]." | Same | "Instant"; "lightning-fast" |
| "Not a stablecoin" | "A deposit at a regulated bank, recorded on a shared ledger." | Same | "New digital currency" |
| "Bearer-recorded claim" | Drop | | "Bearer" (an account-based deposit is not a bearer instrument) |

## 8. Blueprint amendments (v0.9 → v1.0), consolidated

| # | v0.9 statement | Amendment |
|---|---|---|
| 1 | Roadmap "four-phase" but five phases | Five phases (0–4), with 0a/0b and 3a/3b sub-phases |
| 2 | Invariant I "Par, always … system-halting" | Par is each issuer's legal obligation; network enforces 1:1 accounting/settlement, detects deviations within a stated time, and responds gradedly: issuer quarantine first, network halt for ledger-integrity failure or over-issuance |
| 3 | Invariant II "Finality is one thing" | Consensus finality <2 s; legal finality as defined by the rulebook, dual track to PCSA designation; interbank settlement in central-bank money via prefunded positions; gaps stated and collateralised |
| 4 | Invariant III | Keep; state exactly who holds settlement positions and under what legal form (never the Operator) |
| 5 | "Bearer-recorded claim" | Account-based, novation-model claim on a named bank; token carries issuer LEI and deposit-insurance category code |
| 6 | "CDIC-insurable wherever the underlying deposit is" | Reword: CDIC treatment pending; provincial insurers cover Desjardins and credit unions |
| 7 | BoC as validator/observer node | Read-only, non-voting supervisory node; design does not rely on it; settlement role requested separately |
| 8 | MPC for operator actions | On-ledger multisig across independent organisations; MPC only where a single off-ledger key must exist |
| 9 | Quarterly key ceremonies | Quarterly cadence retained for operational keys; root keys live for years |
| 10 | Table 2: ≥5,000 instr/s sustained | Demand-derived requirement (start 250 sustained / 1,000 burst); provision 500/s; prove 5,000/s in the lab |
| 11 | Table 2: 99.999% availability | SLO ladder 99.9 → 99.95 → 99.99 (contractual) → 99.999 (objective) |
| 12 | Phase 1 exit: 10,000 transfers, zero par breaks | ≥100M adversarial instructions, 72 h soak, formal verification of the kernel |
| 13 | Phase 2 exit: "value cap lifted by supervisory non-objection" | No such instrument exists. Replace with gates G1–G10 (Legal) and G1.5/G2 |
| 14 | Phase 3 exit: 99.999% sustained over two quarters inside H2 2028 | Split 3a/3b; G3b at 99.99% over two full quarters after go-live |
| 15 | Phase 3 exit "all founding issuers live" | Quorum language ("at least N live") to avoid a slow-bank veto |
| 16 | Phase 4 retail 2029+ | Removed from the committed plan; separate gate G4, not before Oct 2030 |
| 17 | PQ migration Phase 4 | Hybrid PQ encryption for confidential on-ledger data by Phase 2–3; PQ signatures Phase 4 |
| 18 | ZK confidentiality is the design | Three kernel modes; M2 fully designed now; decision 14 May 2027; Phase 3 does not depend on ZK |
| 19 | "One reference core-banking adapter" | Core-agnostic adapter with certified core connectors; integration tiers A/B/C; bank-funded budgets |
| 20 | "No bridges" | "No unsupervised bridges"; a small number of governed interoperability links, each with a rulebook annex |
| 21 | Supervisory read-node answers any query <60 s | On-ledger classes only; identity/beneficial-owner resolution has its own SLO |
| 22 | "9 figures CAD over ~3 years" | Bottom-up: $473M ecosystem to G3b (range $317–821M), operator $258M; timeline to Sep 2030 |
| 23 | Peak build 120–160; run team 40–60 | Operator build 126–140, ecosystem ~320; run ~100 FTE (40–60 is the 24/7 ops subset) |
| 24 | Operator entity newly created | Options paper (new CNCA, Payments Canada extension, JV, vendor-operated); recommendation CNCA |
| 25 | Brand line "settles in under two seconds with legal finality" | Withdraw until evidence exists (§7) |

## 9. Open items that gate decisions (unverified; carried from all seats)

CDIC's position; primary text of the Stablecoin Act and its regulations; PCSA sections and definitional fit; FINTRAC classification of deposit tokens; capital and liquidity treatment (press reports of a "Group 1a" treatment were **not** found in OSFI's statement); RTR value limits and settlement design; Lynx hours; Canadian volumes; whether the Working Group is the six banks, a subset or a competitor; whether the BoC will provide settlement access; Bank Act substantial-investment limits on bank ownership of the Operator; FIPS 140-3 vendor status; SOC 2 Type II observation-period rules for a new operator; Canadian talent-pool sizes; every performance number before its spike; **whether the compliance engine's screening and audit-log model needs to distinguish an institution's software-agent-initiated instructions from its human-initiated ones (added by the operator, not a seat memo — see `02` §10).**
