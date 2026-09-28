# DepositX Network — Execution Roadmap

**Status:** Proposed plan of record, for ratification. Supersedes the v0.9 roadmap once adopted.
**Date:** 25 September 2026 · **Basis:** six seat memos; reconciliation choices are explained in `00-board-resolutions.md` §3 (C1–C11).
**Convention:** dates are quarter-precision plan dates. **Plan (P50)** is the management target. **Commit** is the date to give banks, regulators and the press. Anything marked **[V]** is unverified.

---

## 1. Plan on a page

| Phase | Blueprint | **Plan of record** | Commit externally | What it is |
|---|---|---|---|---|
| **0a** Mobilise | Q4 2026 | Oct–Dec 2026 | — | Decide relationship to the six banks. Antitrust protocol. Interim operator shell. Platform bake-off. First regulator meeting. Discovery. |
| **0b** Constitute | (in Phase 0) | Jan–Mar 2027 → **G0 31 Mar 2027** | Jun 2027 | Chair, permanent board, Founding Members Cooperation Agreement, funding committed, architecture ratified. **G0-R** (written regulator engagement) Jun 2027. |
| **1** Sandbox testnet | H1 2027 | Q2–Q4 2027 → **G1 15 Dec 2027** | Mar 2028 | Testnet with real bank-side integration; par kernel; confidentiality decision; PFMI gap assessment. |
| **2** Capped live pilot (wholesale) | H2 2027–H1 2028 | **Live from Q2 2028** (earliest Q1 2028); **G2 Q1 2029** | Live Q1 2029; G2 Q3 2029 | Real value, capped, 2–3 issuers. Audit, proofs, DR drill, SOC 2 Type I then II window. |
| **3a** Production go-live | H2 2028 | Limited production Q2–Q3 2029; **all founding issuers live 30 Nov 2029 (G3a)** | 30 Nov 2030 | Netting and bond cash-leg live. Cap lifted. 24/7 NOC. |
| **3b** Acceptance | (inside Phase 3) | **G3b Sep 2030** | Sep 2031 | Two full quarters at 99.99%, independent PFMI rating, SOC 2 Type II. |
| **4** Scale | 2029+ | **Not before Oct 2030**, separately gated (**G4**). Retail is out of the committed plan. | — | Cross-border corridors, Real-Time Rail interoperability, PQ migration, retail only if CDIC and FCAC positions allow. |

**Net movement against the blueprint:** production moves about 11 months (H2 2028 → Nov 2029). Best case is still about 9 months late (CFO). If a statute or regulation must change, add 18–36 months (CFO, Legal). The board should not repeat the v0.9 dates externally.

**Earliest technically possible** (engineering only, CTO): all founding issuers live H2 2028, provided banks 3–7 begin integration in Q3 2027 and the regulatory route is short. That is a ceiling, not a plan.

## 2. Critical path

The critical path is **regulatory and bank-readiness, not engineering.**

```
Big Six decision (D1) → F1 term sheet & funding → F2 operator incorporated/antitrust cleared
  → R1 regulator engagement (G0-R Jun 2027) → R2 PFMI gap + rulebook v0.5/v0.9 + finality opinions
  → G1 (Dec 2027) → R3 designation dossier + OSFI lead-supervisor engagement per bank
  → G1.5 go-live readiness → T9 capped live pilot (Q2 2028) → R5 cap-lift + designation decision
  → G2 (Q1 2029) → B3 Wave 2 cut-over (before bank change freeze) → G3a (30 Nov 2029)
  → T13 two quarters availability → R6 PFMI rating → G3b (Sep 2030)
```

Three chains are within one to two months of critical: regulatory (not ours to control), platform (kernel freeze → audit → live), and bank integration (Wave 1 and 2). Regulator review time is the least defensible number in the plan (CFO: 8 months P50, 11 months P80 for one element). Ask each regulator, in the first joint meeting, what would make them unwilling to proceed.

**What makes it worse than P80:** a statute or regulation must be amended (+18–36 months); the Bank of Canada will not provide settlement-anchor access (+6–12 months to redesign via Lynx or a sponsor); banks' change capacity is consumed by the Real-Time Rail and ISO 20022 work **[V]**.

## 3. Phase 0 in detail (25 Sep 2026 – 31 Mar 2027)

### 3.1 Days 1–30 (25 Sep – 23 Oct)

| By | Action | Owner |
|---|---|---|
| 2 Oct | Programme office up; interim Programme Director (D-CEO) named | Chair |
| 2 Oct | Antitrust counsel engaged; clean-team protocol adopted; commercially sensitive discussion frozen until then | GC |
| 2 Oct | Communications freeze; claims register v0 | Head of Comms, CCO |
| 2 Oct | First contact with the six banks; fact sheet on their plans | Chair, CSO |
| 9 Oct | **D1 decided** (relationship to the six); independent chair search launched | Board |
| 12 Oct | **Platform bake-off starts** (10 weeks, to 18 Dec) | CTO |
| 12 Oct | Discovery interviews begin (target 60 by 18 Dec) | Head of Product |
| 9 Oct | Meetings requested: BoC, Payments Canada, OSFI, FINTRAC, CDIC, Finance Canada, Competition Bureau | Head of Regulatory Affairs |
| 16 Oct | Settlement-asset options paper; draft ask to BoC | HRA, CTO, GC |
| 16 Oct | Obtain RTR rules, value limits, settlement design, Lynx hours from Payments Canada | HRA |
| 30 Oct | RFPs out: formal-methods firm, 2 security + 2 cryptography auditors, HSM, WAN carriers | CTO |
| 30 Oct | Secondment commitments in writing from each founding bank (≥55 engineers on payroll or secondment by 11 Jan 2027) | CTO, bank sponsors |
| 23 Oct | Operator options paper; funding and cost key; gate framework; risk register v1; demand-derived sizing model | CSO, CFO, GC, CRO, CTO |
| 23 Oct | Seven-bank core-banking discovery questionnaire issued | CTO |

### 3.2 Days 31–90 (24 Oct – 24 Dec; board on 18 Dec)

- **Regulators:** first joint meeting targeted **week of 16 Nov** (OSFI, BoC, FINTRAC; CDIC and Finance as observers). Pre-read sent 10 days ahead. The 20-item ask list is in `board/legal-regulatory.md` §8B.
- **Legal:** commission two independent opinions (finality/insolvency and perimeter); file FINTRAC and CDIC interpretation requests; Rulebook v0.1 outline; interim CNCA shell.
- **Technical:** bake-off results 4 Dec; TLA+ spec of invariants P1–P7 frozen 27 Nov; threat model 4 Dec; core-discovery packs from seven banks 20 Nov; ZK-fallback (M2) design note; settlement-anchor and token-model paper 4 Dec; **Architecture Review Board 11 Dec.**
- **Commercial:** 60 interviews complete by 18 Dec; target 8 corporate and 3 dealer letters of intent; use-case scorecard and price curves.
- **Money:** Phase 0 funding commitments signed; first tranche **$12.9M** at term sheet (equal shares, about $2.15M each).
- **18 Dec board:** approve or amend this plan; confirm Phase 0 to 31 Mar 2027; choose anchor-use-case and vendor shortlist.

**Good looks like at day 90:** written position from the six banks on how DepositX relates; a regulator response on the settlement asset (even provisional); 60 interviews and LOIs in hand; bottom-up cost model with funding commitments; chair search live and operator form chosen; claims register and freeze in force. **If two or more are missing, the CRO must tell the independent directors G0 is at risk and the board should pick a scope-down path before spending Phase 1 money** (`04` §2).

### 3.3 Phase 0b exit (G0, 31 Mar 2027)

Go requires all of the following (Strategy, tightened by CFO and Legal):
1. Six-bank relationship resolved in writing; four or more banks including two of the top three committed to fund Phase 1.
2. BoC / Payments Canada written response on the settlement-asset pathway.
3. Governance charter adopted (independent chair, vote caps, antitrust protocol signed off by counsel).
4. Discovery complete: 60 interviews, 8+ corporate and 3+ dealer LOIs, indicative flow ≥ C$1B/day, at least one use case scoring high value and low RTR overlap.
5. Bottom-up cost model ±25%, and Phase 1–2 funding 100% committed; six signed funding commitments and wave dates.
6. Two legal opinions delivered (finality, perimeter).
7. Each founder CFO has submitted a first benefit estimate.

## 4. Phase 1 — Sandbox testnet (Q2–Q4 2027; engineering starts at risk 11 Jan 2027)

- **Engineering (CTO):** kernel v0.1 with par checker (26 Feb); settlement primitives and anchor gateway mock (31 Mar); compliance MVP (30 Apr); adapter plus ISO 20022 against pilot bank #1 pre-production (30 Apr); **confidentiality decision G1.2 on 14 May 2027**; gateway, SDKs (TypeScript, JVM) (31 May); **closed pilot live 11 Jun** (2 banks plus BoC read-only observer, synthetic data); **kernel v1.0-rc freeze 31 Aug**; security audit #1 (Sep–Nov).
- **Legal:** Rulebook v0.5; Sandbox Rules; PFMI gap assessment mapped to rulebook chapters; **designation pre-dossier accepted by BoC for review with a named workplan** (dossier filed Q3 2027–Q1 2028); Bank Legal Pack v1.
- **Onboarding:** banks 3–7 start integration work no later than **Q3 2027** (otherwise "all founders live" in 2029 is at risk).
- **Exit gate G1 (15 Dec 2027), Go if all true:**
  1. Three or more issuer nodes on testnet; two or more on real bank-side integration (not mocks).
  2. **≥100M adversarial simulated instructions with zero violations, plus a 72-hour soak at 1,000/s**; 100 of 100 injected par breaks halt or quarantine in the same block, zero false halts.
  3. 500+ fault-injection scenarios, all Sev-1 closed; consensus p99 < 5 s at 100/s sustained and 500 burst on the WAN topology.
  4. Confidentiality mode selected with the benchmark numbers attached (M1 only if it passes; otherwise M2).
  5. PFMI gap assessment with no open "high" gaps; designation route defined in writing.
  6. Regulator letter of non-objection to a capped live pilot **or** a documented BoC position on the pilot's finality basis.
  7. Cost variance < 15%; five or more corporate/dealer pilot contracts signed; founder-validated benefit case in the Go or Conditional band.

## 5. Phase 2 — Capped live pilot (live from Q2 2028; G2 Q1 2029)

**Live-money entry gates (Legal G1–G10), all met before value moves:** Rulebook v0.9 executed by ≥3 pilot issuers; Canadian legal opinions (capacity, enforceability, finality/insolvency, netting, novation, Quebec); each pilot issuer's OSFI lead-supervisor engagement complete and no objection recorded; BoC written position on oversight and settlement anchor; FINTRAC interpretation; CDIC letter on eligibility and failure-record protocol; privacy impact assessments including Law 25; Competition Bureau advisory opinion or documented counsel decision; insurance tower bound; each bank's B-10 pack approved by its board risk committee.

**Engineering:** live mint/redeem against real cores; Travel Rule in production; formal proofs of P1, P3, P5, P6, P7 (Verus, TLA+) published with assumptions; public bug bounty on a production mirror (private from Phase 1); DR drill (region loss, RTO ≤ 15 min, RPO 0); performance 2,500/s for 4 h with median < 1 s and p99 < 3 s on n=7 with WAN emulation; SOC 2 Type I; certification programme live.

**Exit gate G2 (Q1 2029):** three or more issuers and 15+ live clients; cumulative settled value ≥ C$50B **[Strategy threshold, to be re-based to observed demand]**; availability ≥ 99.95% over the last six months; no unreconciled supply event over 15 minutes; par exceptions 0 in N > 10M; ≥4 successful DR runs; independent audit with no open critical or high findings; SOC 2 Type II window complete; **supervisory non-objection to lift caps and legal-finality route confirmed in writing**; five or more months of live evidence with zero par breaks; 80% of pilot clients active in the last eight weeks.

## 6. Phase 3 — Production (Q2 2029 → 30 Nov 2029 → Sep 2030)

- **3a:** cut-over of Wave 2 issuers before the bank year-end change freeze (Oct–Nov 2029); n=10 validators across ≥4 failure domains; liquidity-saving netting after replay validation on anonymised Lynx data **[V data access]**; tokenized-bond cash-leg integration; 24/7 operator NOC; designation in force (or explicit written BoC position). **G3a on 30 Nov 2029:** all founding issuers live and certified, no open regulatory conditions, ≥95% of eligible wholesale flow **settle-able** (capability, not adoption).
- **3b:** two full quarters of measurement at 99.99% (design target 99.999%); independent PFMI observance assessment; supervisory position queries < 60 s on ≥1B-record data (on-ledger classes; identity resolution has its own SLO); SOC 2 Type II report. **G3b Sep 2030.**
- Quarterly DR and chaos drills; PQ readiness study starts.

## 7. Workstreams

| Workstream | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|---|
| **Platform & ledger** | bake-off; invariants in TLA+; ARB 11 Dec | kernel; par module; confidentiality decision; n=4 | multi-issuer n=7; proofs; audit | n=10; perf certification; PQ study | n=13; PQ hybrid signatures; re-baseline for retail |
| **Settlement & programmability** | anchor and token-model paper | Transfer, Convert, DvP; anchor mock | live mint/redeem; PvP design | netting; bond cash-leg | consumer templates; corridors |
| **Compliance & identity** | control design; FINTRAC request | engine MVP; ISO 20022 | Travel Rule live; screening at mint/transfer/redeem | full FINTRAC hooks | retail KYC at scale |
| **Legal / governance / regulatory** | antitrust; shell; regulators; opinions | rulebook v0.5; pre-dossier | rulebook v0.9; designation dossier; live gates | designation; rulebook v1.0 | retail chapter; CDIC position |
| **Integration & assurance** | core discovery; RFPs | conformance suite; 2 banks | certification; SOC 2 I; audit; bounty | Wave 2 cut-over; SOC 2 II; PFMI rating | corridor onboarding |
| **Bank onboarding** | founder charter; design partners | Wave 0 (2 design partners) | Wave 1 pilot issuers | Wave 2 production founders | Wave 3+ |

## 8. Money and people (CFO memo; base case; re-base after Phase 0 discovery)

| $M, constant 2026 | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| Operator programme cost | 12.9 | 46.5 | 115.4 | 83.5 | **258.2** |
| Ecosystem to end of Phase 3 (operator + six founding banks) | | | | | **473.3** (range 317–821) |

- **Operator funding envelope:** $330.8M ($258.2M programme − $13M revenue + $29M capital buffer + $56M ramp deficits). Tranches on gates: T0 $12.9M at term sheet; T1 $46.5M at G0; T2a $57.7M at G1; T2b $57.7M at the pilot-readiness gate; T3 $100.0M at G2. **No tranche is released without its gate.** The CFO's tranche dates were built on a later pilot; re-date them to this plan.
- **Headcount:** operator peaks at about 126–140 FTE; ecosystem peak about 320 FTE (operator plus banks). Operator run team at steady state is about 100 FTE, not 40–60; the 40–60 is the 24/7 operations subset. Steady-state run cost about **$58.8M/yr**.
- **Cost of delay:** about $11.9M a month ecosystem-wide during Phase 2; a 12-month slip costs roughly $110–140M.
- **Cost levers (about $47M, 10%):** defer production ZK to the designed fallback; shared adapter and certification kit; provision 500/s not 5,000/s (about $7M plus $4M/yr).
- **Phase 4** is outside the cost window; the CFO's low-confidence indication is $90–150M operator plus $30–70M per Tier A bank for retail. It needs its own business case.
- **Security and SRE** (a subset of operator cost): CISO's rough estimate is $30–45M to Phase 3 (low confidence); run team about 26 at Phase 3.
- **Hiring:** first 30 hires and order in `board/cfo-coo-programme-and-economics.md` §5; CISO-designate and SRE lead by 31 Dec 2026; two to three formal-methods and cryptography apprentices.

## 9. Governance of the programme

| Body | Members | Cadence | Decides |
|---|---|---|---|
| **Board** | Independent chair, 3 independents, one seat per large issuer, 2 seats for smaller issuers (Legal proposes 13) | Quarterly + gates | Economic and reserved matters; kills and pivots |
| **Steering Committee** | One executive per founder, chair, operator CEO, Programme Director; regulators as observers where accepted | Monthly | Gates, tranches, change > $2M or 6 weeks on the critical path |
| **Design Authority** | Operator CTO (chair), one architect per founder, 2 independent experts | Fortnightly | Anything touching an invariant, cryptography or consensus |
| **Programme Board** | One programme director per founder + pod leads | Fortnightly | Integration, waves, readiness |
| **Change Control Board** | Programme Director, finance, security, one rotating bank rep | Weekly | Below-threshold changes |
| **Independent Assurance (IV&V)** | External firm reporting to the Steering Committee | At each gate and quarterly | Gate readiness opinion |

Gate decision rule (Strategy): **Go = two-thirds of founding issuers by count and by committed funding, plus CRO sign-off. No-Go = majority. Pivot = simple majority.** The board cannot waive the three invariants.

## 10. Reporting

Weekly pod reports; fortnightly dashboard; monthly steering pack; quarterly bank-board summary; quarterly regulator update and at each gate; independent assurance at each gate; monthly bank-specific readiness scorecard. KPI set by gate in `04` §3.
