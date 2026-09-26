# Concord Network — Bank Onboarding Playbook (master)

**Status:** Consolidated for ratification. Full detail (integration patterns, GL/accounting, member-support model, use-case ladder, RACI, 16-item verification register) is in `board/onboarding-playbook.md`; this file fixes the model and reconciles it with the master schedule.
**Why this document matters most:** the Onboarding seat's finding, echoed by Legal, CFO and CTO, is that **onboarding, not technology, is the critical path.** Effort and cost figures are ±40% estimates until Phase 0 discovery replaces them. **[V]** items are unverified.

---

## 1. The arithmetic that shapes everything

- A Big-Six-scale bank takes **24–30 months** from first engagement to production the first time and **18–22 months** once a due-diligence pack and certified adapter exist. Mid-tier: 12–15. Node-as-a-service participant: 6–9.
- Unaided, a large bank's internal approval path (12 functions, largely serial) takes **12–18 months**. With a shared pack, parallel tracks and staged approvals it takes **5–8 months**.
- Legal independently estimates **9–12 months** for the legal and third-party-risk review of a Big-Six bank.
- Therefore: **any founding issuer not in Assess by end of Q1 2027 cannot be production-live in 2028**, and on the reconciled plan (`01`) it cannot be live before the second half of 2029. The founding cohort must commit in Phase 0, before there is much to show them.

## 2. Participant tiers

| | **Founding Issuer** | **Issuer** | **Non-issuing Participant / Agent Bank** | **Observer / Regulator** | **Technology Partner** |
|---|---|---|---|---|---|
| Who | Founding cohort: D-SIBs automatically, others by founder invitation; Desjardins-scale institutions need their provincial regulator engaged in parallel **[V]** | Later-admitted deposit-takers: mid-tier banks, foreign bank subsidiaries, credit-union centrals | Regulated firms holding tokens as principal: non-issuing banks, dealers, trust companies, depositories | BoC, OSFI, CDIC, FINTRAC, Finance Canada | Core, hub, GL, treasury, HSM vendors; integrators; node-as-a-service |
| Issues tokens | Yes | Yes | No | No | No |
| Validator | Voting after staged promotion | Voting after staged promotion, subject to set-size cap | Non-voting participant gateway | Read-only (voting/non-voting observer only if BoC confirms) | No; certified to operate on behalf of an issuer |
| Governance | Board nomination, rulebook vote, all councils | Council seats (non-founders always ≥⅓ of each technical council) | Participant Assembly | Standing observer, no vote | Partner Forum |

- **Agent Banks** offer Concord-settled services to their own clients from **Phase 3 only**, holding tokens as principal and booking clients in their own cores. That preserves Invariant III: tokens are only ever claims on the issuing bank and the agent never becomes an issuer or custodian of client tokens.
- The founder cohort **closes at signature of the Operator shareholders' agreement (target end Q1 2027)** and is capped at eight voting issuers.
- **Objective admission criteria** for later Issuers (published in the rulebook, applied identically): OSFI-regulated (or equivalent) deposit-taker in good standing and a CDIC member **[V]**; direct Lynx participation or an equivalent route to a BoC settlement position; regulator non-objection on supervisory standing; AML/sanctions and B-13-aligned cyber baseline; ability to fund the settlement position; and headroom in the network and the onboarding queue. **No bank holds a veto over another's admission or timing.**
- **Validator-set ceiling:** CISO/CTO: 13 (n/f = 13/4). Onboarding's working assumption was about 15. **Adopt 13 as the design cap** until the Phase 1 benchmark says otherwise; later issuers beyond it join as sponsored, non-voting participants, which changes the blueprint's "each issuer is a validator" and must be decided at the end of Phase 1.
- **7th issuer** admitted only if: objective criteria met; projected load < 60% of certified throughput at the new validator count; no onboarding-attributable Sev-1 in 90 days; at most one new voting validator per quarter after production (none in the first two quarters); Membership Committee supermajority with independent chair breaking ties.

**Commercial structure.** Cost-recovery operator; same tier, same price; **no side letters**; published fee schedule in the rulebook; no volume lock-in or exclusivity. Founding Issuers: programme funding share plus 5-year fee cap and MFN. Issuers: catch-up contribution (pro-rata share of founders' funded build, discounted 40%, amortised over 5 years) plus indicative onboarding fee (Tier A ~$2.5M, Tier B ~$1.1M, Tier C ~$0.5M; 20–30% lower once the pack is amortised). Exit plan compliant with OSFI B-10 expectations **[V]**: a bank can leave, retain a verifiable copy of its own ledger state, and run its validator standalone. Detailed funding and pricing: `board/cfo-coo-programme-and-economics.md` §2–3.

## 3. The stage-gated funnel

Eight stages, seven gates, decided by a **Gate Review Board** (Head of Onboarding, Head of Assurance, Head of Legal/Regulatory, one rotating member from another issuing bank; a bank never sits on its own gate). Outcomes: pass / pass with dated conditions / hold.

| # | Stage | Gate | Key output | Tier A repeat duration |
|---|---|---|---|---|
| S1 | Engage | G1 Sponsor Commitment | Executive sponsor LOI, named programme director, capacity slot, tier classification | 2 mo |
| S2 | Assess | G2 Assessment Pass | **Approve-to-Build**; TPRM classification of Concord as material third party; InfoSec design approval | 3–4 mo |
| S3 | Contract | G3 Build Authorisation | Membership Agreement **or** a spend-capped Build Authorisation Letter. *Banks should be building by month 4 even if paper closes by month 8.* | 3–5 mo (overlaps S2) |
| S4 | Build | G4 Test Entry | Adapter and node deployed; **Thin Pilot Profile** (≈40% of build effort, live in 9–12 months) then **Full Production Profile** | 9–12 mo |
| S5 | Certify | G5 Pilot-Certified; G6 Production-Certified | Conformance evidence; badges | 2–3 mo |
| S6 | Pilot-live | G6 Production Go/No-Go | **Approve-to-Pilot**; 30 days zero unexplained breaks and zero par events; live DR failover; **Approve-to-Produce** from the bank's board risk committee | 4–6 mo |
| S7 | Production | G7 Stabilisation Exit | 90 days meeting SLOs; hypercare closed | 2–3 mo |
| S8 | Steady-state | Annual recertification | Health review; drills twice a year | ongoing |

**Worked calendar (Tier A repeat, Engage = month 0):** Build Authorisation Letter M3–4; Thin Profile complete M10; pilot go-live M11–12; Production-Certified M15–16; production go-live M17–19; stabilisation exit ≈M20–22.

### Internal approvals a Tier A bank runs (and the Concord artefact that answers each)

Executive sponsor and investment committee → business-case kit. New-initiative committee → initiative paper template. Architecture Review Board → reference architecture, ADRs, data flows. InfoSec (B-13-aligned) → threat model, HSM/ceremony docs, SBOM, pen-test summaries. Third-party risk (B-10-aligned) → B-10 dossier, subcontractor map, exit plan, BCP, insurance. Legal → Membership Agreement, finality and insolvency opinions. Compliance/AML/privacy → control mapping, PIA template. Treasury/ALM → liquidity impact model, position-feed spec. Finance/accounting → accounting position paper, GL templates. Operations → runbook catalogue, OLAs. Model risk (E-23-aligned) → model inventory. Enterprise risk and board risk committee → pre-drafted board paper. **[V] regulator-guideline citations throughout.**

### Bank Due-Diligence Pack (BDDP)

A single Trust Centre organised by those 12 functions, versioned, every answer owned and dated, with security-questionnaire crosswalks pre-filled. **Evidence maturity, not evidence promises:** v1.0 (designs) **1 Feb 2027**; v2.0 (Phase 1 evidence) **Aug 2027**; v3.0 (SOC 2 Type I, first audit, published proofs, bounty and DR results) **Q2 2028**. SOC 2 Type II will not exist at pilot; banks approve-to-produce on Type I plus a bridge letter, with Type II a condition subsequent. Five-business-day answer SLA on the question ledger and **no bespoke answers** that other banks cannot see. Target pack reuse above 80% by Wave 2. Onboarding assigns a named "approval navigator" per bank tracking committee calendars.

## 4. Integration model

- **Deployment menu:** bank-operated node (Tier A default); node-as-a-service by a certified provider (Tier B/C default); co-managed in the bank's data centre. **Fixed rule: the issuer owns its validator identity and signing keys, HSM-resident and issuer-controlled, whoever runs the hardware.**
- **Core-agnostic adapter with certified core connectors** (mainframe/MQ, ISO 20022 gateways, Temenos, FIS, Finastra, Fiserv, in-house **[V each bank's stack, 24/7 posting capability, RPO and freeze calendar via the seven-bank discovery]**). Legacy cores use pre-funded token accounts so they see only mint, redeem and net settlement. Technical detail in `02` §2.7.
- **Bank-side effort (ROM ±40%):** Tier A ~**450 person-months** ($14–22M each), Tier B ~180 ($5–8M), Tier C ~60 (~$3–6M). Six Tier A banks: ~$85–135M, average ~120 FTE, peak ~180. **This is bank-side spend, outside the operator budget** (`00` §3 C10); CFO's ecosystem model carries $215M base for six founding banks' internal cost in total.
- **Accounting and prudential treatment** (booking of token liabilities, LCR/NSFR, CDIC premium reporting, capital) is **unresolved and flagged for verification**. OSFI's 10 Sep statement is silent on capital, liquidity and CDIC. An independent accounting and regulatory-treatment paper (not by any member's auditor of record) must be commissioned in Phase 0.

## 5. Certification and release management

**Sandbox ladder:** E0 Playground → E1 Integration Sandbox (per-bank tenant plus **Concord-run Bot Banks** so no bank waits on another) → E2 Certification Environment (production-identical, pinned versions; the only place badges are issued) → E3 Pilot Ring (live, capped, real regulator read-nodes) → E4 Production; plus a Sim Lab for latency and validator-failure injection.

**Conformance suites** (~2,000+ vectors and cases): F functional (~400), M ISO 20022 (~1,200), R reconciliation and accounting (~150), X failure injection (~80), **P par-break drills (~15, all mandatory)**, N performance (6 profiles incl. 72-hour soak), S security (independent assessor), D DR/BCP (8 exercises, one live; RTO < 15 min, RPO 0 evidenced bank-side), O operational readiness (12), C compliance (~60), U upgrade compatibility (nightly).

**Zero-tolerance list (cannot be waived by scoring):** any par-break drill failure; any atomicity failure; an unresolved level-1 reconciliation break; any key-handling failure; any open critical or high security finding.

**Badges (12-month validity, bound to a version range):** C1 Sandbox-Ready → C2 Pilot-Certified → C3 Production-Certified (requires 30 days in the Pilot Ring with zero unexplained breaks and zero par events, 24/7 operations proven, operator SOC 2 Type I with Type II in progress). Certification Board: Head of Assurance (chair), independent assessor, a rotating member from another issuing bank; BoC and OSFI invited to observe.

**Release train:** quarterly minors, annual major (24-month support line), out-of-band security patches (critical 72 h, high 14 days). Network supports **N and N-1** (a participant may lag one minor at most 90 days; a major, six months). **Expand-contract activation:** all nodes dual-read; governance sets an activation height only when every voting validator reports ready; old behaviour deprecated next release. A laggard drops to shadow-voting after a defined warning sequence (T-30/14/7 days, waiver review by council); **the network is never held back by one bank.** Each bank registers change freezes 12 months ahead; activation heights avoid major participants' freezes. Bank agrees at contract that Concord patches meeting criteria are **pre-approved standard changes** in its ITSM.

## 6. Waves (reconciled to the master schedule in `01`)

| Wave | Who | Window | Scope |
|---|---|---|---|
| **0 Design partners** | 2 Tier A founders with **different core archetypes** (one modern hub, one heritage core); BoC observer if confirmed; 1 core vendor, 1 HSM vendor | Q4 2026–H1 2027 | S1–S4 to Sandbox-Ready; bank 1 deep real-core connector, bank 2 via payments-hub façade and mock core, real core in Phase 2 |
| **1 Pilot issuers** | Wave 0 banks pilot-live; 2–3 further founders begin Build **no later than Q2 2027** (banks 3–7 integration start by Q3 2027 per CTO) | Live capped pilot **Q2 2028** on the Thin Profile | S6 for Wave 0; S4–S5 for the rest; regulator read-nodes; first tokenized-securities counterparty |
| **2 Production founders** | All founding issuers production-certified | Cut-over before the bank change freeze; **all live by 30 Nov 2029**; limited production from Q2–Q3 2029 | Cap lifted by designation or written supervisory position |
| **3 Second cohort** | 2–4 Tier B issuers, 4–6 non-issuing participants, first Agent Banks, credit-union central on sponsored track | From Q1 2030; capacity ≤ 2 onboardings/quarter until G3b (CFO) | One new voting validator at most per quarter |
| **4 Long tail and foreign** | Foreign subsidiaries, further centrals; cross-border peer networks as a separate interoperability track | 2030+ | Phase 4 |

**Note:** the Onboarding memo targeted at least four founders in production by end of 2028; on the reconciled schedule that becomes limited production in 2029. **Phase and gate wording should use quorum language, never "all"**: *"at least N founding issuers live"*, so a slow bank loses its slot instead of blocking the network. Bank-slot rules: each bank has its own stage clock; slippage of 25% of a stage is amber (executive-sponsor call within a week); 50% is red (escalation and the slot is released with a re-entry path). Consequences for missing a go-live covenant are proportionate and pre-agreed (suspended roadmap-nomination rights, slot reallocation, catch-up funding), never penalties that make banks avoid signing.

**Founding Issuer Charter.** A binding term sheet with **Build authorisation and funding commitment signed by end of Q1 2027** is the mechanism that keeps Wave 1 on schedule. The alternative is to move the production date again.

## 7. Onboarding office and member operations

- **Bank Onboarding & Integration Office (BOIO):** 8 FTE (Q4 2026), 18 (H1 2027), **34 at peak (Phase 2)**, 36–40 (Phase 3), 20–25 steady state. At 34 FTE it runs **4 concurrent Tier A onboardings plus 1 Tier B and up to 3 Tier C**; a fifth Tier A needs +5 FTE and 6–8 weeks to hire and train. A Tier A bank needs a ~5 FTE Concord pod (peak 7).
- **24/7 Concord Network Operations Centre** (about 5.4 FTE per always-staffed seat, CFO arithmetic), member-facing SLAs, incident communication, Network Change Advisory Board, member councils, an open improvement-proposal process. Member-success KPIs in `board/onboarding-playbook.md` §6.
- **Fairness is an onboarding feature.** Objective admission, one-participant-one-vote in technical councils, no side letters, and a written competition-law protocol for every forum where competitors sit together. Without it the largest banks hedge and the smaller ones do not join.

## 8. First flows: the use-case ladder

Every bank needs a business case that does not depend on other banks being live. Strategy's adoption analysis says the wedge needs **2–3 banks, not six**, because it does not need counterparties on both sides.

1. **24/7 cross-bank treasury sweeps** (own-account liquidity movement for multi-banked corporates). Lowest counterparty dependence.
2. **Corporate 24/7 conditional B2B payments.** Compete only where conditionality and atomicity matter; the Real-Time Rail already covers plain instant transfers.
3. **Tokenized-bond DvP cash leg** (Samara lineage).
4. **Repo intraday liquidity.**

Each rung has a **pre-registered baseline and a stop rule**; discovery must confirm the top use case scores high value and low RTR overlap before G0. Strategy's illustrative reachable-share figures (22% of random payments with RBC+TD, 37% with the top three) are the seat's own estimates and should be replaced with real data.

## 9. Decisions requested (30 days)

1. Approve the **Founding Issuer Charter** concept with Build Authorisation Letters by end of Q1 2027.
2. Approve the BOIO (34 FTE at peak) and start hiring the first 8.
3. Approve BDDP v1.0 by **1 Feb 2027** with named function owners in Legal, Risk, Finance and Security.
4. Confirm **two-speed integration** as standard; reword Phase 2/3 exits in quorum language.
5. Decide whether bank-side integration cost sits inside the programme envelope (this synthesis recommends: reported separately, outside the operator budget).
6. Commission the independent accounting and regulatory-treatment paper and open the OSFI/CDIC/BoC feedback channel.
7. Confirm the prefunded settlement position as the working anchor assumption so Treasury/ALM work can start.
8. Commission the competition-law protocol for all councils and clean teams.
