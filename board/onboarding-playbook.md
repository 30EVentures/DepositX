# DepositX Network: Bank Onboarding & Integration Playbook

**Seat:** Head of Bank Onboarding & Integration
**To:** Founding board
**Date:** 25 September 2026
**Status:** v1.0 for board decision. Source of truth: Blueprint v0.9 (2 Sept 2026)
**Convention:** `[V#]` marks a fact, regulatory treatment or assumption that must be verified before anyone relies on it. The register is in Appendix A. Effort and cost figures are rough-order-of-magnitude (ROM, plus or minus 40%) and will be replaced by Phase 1 actuals. At the time of writing `board/` holds no other seat memos, so cross-seat dependencies are stated as assumptions (Appendix B).

---

## 0. The position in one page

The blueprint's own known-issues list is right: onboarding large banks is the board's central job, and it is the critical path of the whole programme. The technology can be finished on schedule and DepositX still misses H2 2028 if banks are not integrated, approved and certified in time.

**The arithmetic.** A Big-Six-scale bank takes 24-30 months from first engagement to production the first time, and 18-22 months once a due-diligence pack and certified adapter exist. Blueprint Phase 3 (H2 2028) says "all founding issuers live". Working backwards, **any founding issuer that has not started Assess by end of Q1 2027 cannot be production-live in H2 2028.** The founding cohort must therefore commit in Phase 0 (Q4 2026), before there is much to show them.

**Recommendations (decisive, in priority order):**

1. **Two-speed integration.** Every bank builds a *Thin Pilot Profile* (about 40% of build effort, live in 9-12 months, capped value, some manual reconciliation) first, then a *Full Production Profile* (straight-through, 24/7). This is how Phase 2 (H2 2027) gets multi-issuer live at all.
2. **Bank Due-Diligence Pack (BDDP).** Build it once, publish it in a Trust Centre, and let each bank's 10-12 internal approval functions pull from it in parallel. Target: bank internal approval 5-8 months instead of 12-18 for a Tier A bank.
3. **Staged, conditional internal approvals** (Approve-to-Build, Approve-to-Pilot, Approve-to-Produce) matched to the evidence DepositX can actually produce at each date. SOC 2 Type I, formal-verification proofs and audit exist only in Phase 2; banks must not be asked for them in 2026.
4. **Deployment options as a menu, with one fixed rule:** the issuer always owns its validator identity and signing keys (HSM-resident, issuer-controlled), whoever runs the hardware. Tier A defaults to bank-operated; Tier B/C default to certified node-as-a-service.
5. **Certification Programme with three badges** (Sandbox-Ready, Pilot-Certified, Production-Certified), 12-month validity, version-bound, with a mandatory par-break drill and three-way reconciliation soak. A DepositX-run "Bot Bank" counterparty removes dependence on other banks being ready.
6. **Release train and skew policy** built for a 24/7 network with 6+ change calendars: quarterly minors, annual major, N and N-1 supported, activation by governance-set height only when all voting validators report ready, pre-approved "standard change" status for DepositX patches in each bank's ITSM.
7. **Lanes, not lockstep.** Every bank has its own lane and stage clock. Network phase exits are defined on quorum ("at least N live"), never on "all". No bank has a veto over another's slot, and no slow bank blocks the network.
8. **Realistic sizing.** ROM bank-side effort to production: Tier A ~450 person-months (PM), Tier B ~180, Tier C ~60. Six Tier A banks alone average ~120 FTE and peak near 180 FTE, against the blueprint's 120-160 "across all participants". **Bank-side integration cost (~CAD 85-135M for six Tier A banks) may equal the entire "9 figures" programme figure; the board must decide whether it is inside or outside it.**
9. **Use-case ladder:** (1) 24/7 cross-bank treasury sweeps, (2) corporate 24/7 conditional B2B payments, (3) tokenized-bond DvP cash leg; repo intraday liquidity is rung 4. Each rung is measured against a pre-registered baseline so every bank gets a business case that does not depend on other banks being live.
10. **Fair governance is an onboarding feature.** Objective admission criteria, one-participant-one-vote in technical councils, an open improvement-proposal process, and a competition-law protocol for every forum where competitors sit together. Without these, the largest banks will hedge and the smaller ones will not join.

**Decisions requested in the next 30 days** are in section 5.6.

---

## 1. Participant model

### 1.1 Tiers at a glance

| | **Founding Issuer (FI)** | **Issuer (I)** | **Non-issuing Participant (NIP) / Agent Bank** | **Observer / Regulator** | **Technology Partner (TP)** |
|---|---|---|---|---|---|
| Who | Founding cohort of deposit-taking institutions, expected Big Six and Desjardins-scale | Later-admitted deposit-taking institutions: mid-tier banks, foreign bank subsidiaries, credit-union centrals | Regulated firms that hold and move others' tokens as principal: banks that choose not to issue, dealers, trust companies, securities depositories, credit-union centrals acting as agent | Bank of Canada, OSFI, CDIC, FINTRAC, Finance Canada; provincial prudential regulators for the credit-union track | Core-banking, payments-hub, GL, treasury, HSM vendors; systems integrators; node-as-a-service providers |
| Issue deposit tokens | Yes | Yes | No | No | No |
| Validator | Voting (after staged promotion) | Voting (after staged promotion; subject to set-size cap, see 5.4) | No. Non-voting Participant Gateway (API access, optional light replica) | Read-only (or non-voting/voting observer node if BoC confirms, `[V1]`) | No. Certified to operate a node on behalf of an issuer |
| Hold / transfer tokens | Yes | Yes | Yes, as principal only (wholesale liquidity); no end-customer wallets in own name | No | No |
| Governance | Board nomination right; rulebook vote; all councils | Council seats; rulebook vote on technical matters, weighted vote on economic matters as per rulebook | Participant Assembly seat; non-voting on economic matters | Standing observer; no vote, no liability | Partner Forum; no vote |
| Onboarding track | Full (S1-S8) | Full (S1-S8) | Reduced (Tier C profile) | Regulator track (MOU, read-node, scoped mandate) | Certification track (connector, integrator or service provider) |

### 1.2 What each tier can do, and what it owes

**Founding Issuer**
- Can: issue and redeem tokens against its own deposit liabilities; host bank-facing wallets; run a voting validator; nominate a board seat; sponsor roadmap items; take priority onboarding slots; receive most-favoured-participant pricing and a 5-year fee cap.
- Owes:
  - A binding *go-live covenant* in the Membership Agreement: pilot-live and production-live dates with an agreed slip allowance (see 5.3).
  - Its programme funding share.
  - A validator run to published SLOs.
  - Continuous supply-to-liabilities integrity, with the issuer, not DepositX, accountable for backing.
  - Certification currency.
  - Two senior secondees (architecture and operations) to DepositX pods, plus named SMEs in each of the 10-12 functions in 2.3.
  - Hosting of regulator drills, and participation in the Network Change Advisory Board (NCAB) and councils.
- Eligibility: any D-SIB automatically; any other OSFI-regulated deposit-taking institution by invitation of the founders. Provincially regulated institutions such as Desjardins need their prudential regulator engaged in parallel `[V12]`. Cohort closes at signature of the Operator shareholders' agreement (target end of Q1 2027) and is capped at 8 voting issuers to protect BFT performance `[V15]`.
- Commercial: see 1.3.

**Issuer**
- Can and owes: same technical rights and obligations as a Founding Issuer, without founding governance privileges, pricing protection or priority slots. Council seats are guaranteed: non-founders always hold at least one third of the seats in each technical council.
- Eligibility (objective, published in the rulebook, applied identically to all):
  - OSFI-regulated (or equivalent prudential regulator) deposit-taking institution and CDIC member, in good standing `[V5]`.
  - Direct participant in Lynx, or a demonstrated route to a Bank of Canada settlement position on equivalent terms `[V1, V11]`.
  - Not under any supervisory intervention stage that OSFI or the provincial regulator would treat as impairing (regulator confirms non-objection, not the operator's judgment) `[V9]`.
  - Passes the AML/ATF programme review, sanctions programme review, and cyber-maturity baseline (B-13 aligned) `[V9]`.
  - Can fund the settlement position and intraday liquidity requirements set by the rulebook.
  - Passes a capacity test: network headroom and onboarding slot available (5.4).

**Non-issuing Participant / Agent Bank**
- Can: hold other issuers' tokens as principal; originate and receive transfers; act as cash-leg counterparty in DvP; use tokens as a liquidity instrument. An **Agent Bank** is an NIP that also offers DepositX-settled payment services to its own clients (indirect participation). Its clients do not hold tokens; the agent books their accounts in its own core and settles in tokens it holds as principal. This preserves Invariant III because tokens are only ever claims on the issuing bank, and the agent does not become an issuer or custodian of client tokens.
- Owes: Participant Gateway certification, own-key custody to certified standard (or a sponsor issuer's hosted wallet), sanctions and KYC responsibility for its clients, indirect-participant caps set by the rulebook, incident reporting.
- Eligibility: regulated financial institution. Agent Bank status is available from Phase 3 only, with a cap on indirect participants per agent until concentration ("tiering") risk is measured.
- Rulebook question for Legal: the blueprint says "bank-hosted wallets". Self-custody by an NIP extends this to non-issuing regulated firms and needs an explicit rulebook clause `[V11]`.

**Observer / Regulator**
- Can: run a supervisory read-node with standing access scoped to mandate; query "where is this money, who owes it" in under 60 seconds; observe councils and drills; witness certification for the regulator's own purposes.
- Owes nothing commercially. Operator owes each regulator: an MOU, scoped credentials, logged queries, 60-second query SLO, and a heads-up on material incidents and rulebook changes.
- Design rule: the regulator track works whether or not the Bank of Canada ends up as a validator-observer. Onboarding supports read-only, non-voting and voting variants `[V1]`.

**Technology Partner**
- TP-1 *Certified Connector Vendor*: core-banking, payments-hub, GL, treasury and reconciliation vendors who ship a DepositX connector.
- TP-2 *Certified Integrator*: systems integrators with named, trained engineers.
- TP-3 *Certified Service Provider*: node-as-a-service operators and hosted-custody providers. These become material third parties for each bank they serve.
- TP-4 *Approved Component*: HSMs, network and monitoring components on the Approved Component List.
- Owes: certification (per version), insurance (cyber and E&O), Canadian data residency, sub-contractor disclosure, OSFI B-10 flow-down clauses `[V9]`, source escrow for TP-1 and TP-3, personnel screening, published connector interface (no lock-in), no exclusivity with any single bank.

### 1.3 Commercial terms structure

The blueprint has no funding or revenue model (known issue). I do not own that model. The Finance and Governance seats do. What onboarding needs from it is a structure banks can take to their approval committees. My proposal:

| Component | Founding Issuer | Issuer | NIP / Agent Bank | Observer | Tech Partner |
|---|---|---|---|---|---|
| Programme funding share | Yes, floor plus size-weighted formula, capped; funds shared build to Phase 3 | Catch-up contribution: pro-rata share of founders' funded build, discounted 40%, amortised over 5 years | None | None | None |
| Onboarding fee | Underwritten by programme funding | Cost-recovery, fixed schedule (see below) | Cost-recovery, fixed schedule | None | Certification fee, cost-recovery |
| Annual membership | Yes | Yes | Yes, lower | None | Annual listing fee |
| Usage fee | Per-instruction at cost, volume-banded, published | Same schedule | Same schedule | None | None |
| Pricing protection | 5-year cap, MFN | MFN with founders on identical usage bands | MFN within tier | n/a | n/a |
| Term | 5 years plus renewals; exit for regulatory event or change of control | 3 years plus renewals | 3 years | MOU | 1 year, renewed by recertification |

Principles I would hold to: cost-recovery operator (no profit motive that competes with members); same tier, same price (no side letters); schedule published in the rulebook; no volume lock-in and no exclusivity; termination and exit plan compliant with OSFI B-10 expectations (bank can exit, retains a verifiable copy of its own ledger state, and can run its validator standalone) `[V9]`.

**Indicative onboarding fee** (equals DepositX-side effort at ~CAD 25k per PM; see 3.7): Tier A late joiner about CAD 2.5M; Tier B about CAD 1.1M; Tier C about CAD 0.5M. Pack reuse should push these 20-30% lower once the pack is amortised. Service-level remedies (credits capped as a share of annual fees, plus termination for chronic failure) will be demanded by bank TPRM and should be in the standard Membership Agreement, not negotiated per bank `[V10]`.

---

## 2. The onboarding funnel

### 2.1 Stages and gates

Eight stages, seven gates. Each stage has a DepositX owner and a bank owner. Gates are decided by a **Gate Review Board** made of the DepositX Head of Onboarding (chair), Head of Assurance, Head of Legal/Regulatory, and one *rotating* member from another issuing bank's operations or risk function. A bank never sits on its own gate. Every gate decision is written with evidence references. Gate decisions can be *pass*, *pass with conditions subsequent* (dated, owned) or *hold*.

| # | Stage | Gate to exit | DepositX owner | Bank owner |
|---|---|---|---|---|
| S1 | Engage | G1 Sponsor Commitment | Bank Relationship Lead (BRL) | Executive Sponsor (EVP, Payments/Global Transaction Banking or Treasury) |
| S2 | Assess | G2 Assessment Pass | Solution Architect + Due-Diligence Lead | Programme Director + Enterprise Architect + TPRM lead |
| S3 | Contract | G3 Build Authorisation | Legal Counsel | Bank legal + procurement |
| S4 | Build | G4 Test Entry, then G5 Pilot Certificate (C2) | Integration Lead | Delivery Lead + Core/Payments owners |
| S5 | Certify | G5 Pilot Certificate (C2) and G6 Production Certificate (C3) | Certification Lead | Test Manager + Operations lead |
| S6 | Pilot-live | G6 Production Go/No-Go | Ops Readiness Manager | COO delegate + Head of Payments Ops |
| S7 | Production | G7 Stabilisation Exit (90 days) | Member Success Manager | Product Owner + Head of Ops |
| S8 | Steady-state | Annual recertification and health review | Member Success Manager | Product Owner |

### 2.2 Stage definitions

**S1 Engage**
- Entry: signed mutual NDA and clean-team protocol (competition-law protocol `[V10]`); named executive sponsor.
- Activities: strategy briefing, use-case workshop (section 7), initial architecture fit, initial regulator posture, capacity slot request, Tier classification (A/B/C).
- Exit (G1): Executive Sponsor letter of intent; named programme director; slot reserved in the capacity plan (5.5); agreed hypothesis for first three flows (7).
- Artefacts: Tier classification, slot reservation, LOI, Engagement Plan with dated stage clocks.

**S2 Assess**
- Entry: G1.
- Activities: the bank works its 10-12 internal approval functions in *parallel* using the Bank Due-Diligence Pack (2.3-2.4); joint architecture sessions; joint threat-model review; regulatory pre-briefing to the bank's OSFI relationship manager (DepositX attends only if the bank asks); integration discovery against the bank's core, payments hub, GL and treasury.
- Exit (G2): *Approve-to-Build* from the bank's architecture review and NIAP-equivalent new-initiative committee; TPRM classification of DepositX as a material third party completed with residual risks accepted; InfoSec design approval; legal position on Membership Agreement agreed in principle; integration discovery report and estimate.
- Artefacts: Discovery Report; Integration Approach Paper (deployment option, core pattern, posting pattern, GL model); gap register; risk-acceptance register.

**S3 Contract**
- Entry: G1 (contracting starts in parallel with the back half of S2; it is not serial).
- Activities: Membership Agreement, Rulebook adherence, data-processing and outsourcing schedules, SLAs, exit plan, audit and regulator access rights, insurance, service-level remedies.
- Exit (G3): signed agreement, **or** signed *Build Authorisation Letter* (spend-capped LOI, terms frozen except named open points). I want banks building by month 4 even if paper closes by month 8.
- Artefacts: Membership Agreement, Schedules, Build Authorisation Letter.

**S4 Build**
- Entry: G3 (or letter) and G2.
- Activities: deploy adapter and node per the chosen option; core, payments-hub, GL, treasury, compliance and operations integration; runbooks; key ceremony rehearsal; environment build. Two profiles (3.6):
  - **Thin Pilot Profile** (target: month 9-12 from Engage).
  - **Full Production Profile**.
- Exit: G4 Test Entry (Sandbox-Ready badge: integration sandbox connected; smoke suite green). Later, G5 and G6 via certification.
- Artefacts: as-built design, integration test evidence, runbook set, data-flow diagrams, operational readiness plan.

**S5 Certify**
- Entry: G4.
- Activities: run the Conformance Programme (section 4) in the certification environment with DepositX witnessing; independent assessor for security and DR suites.
- Exit: G5 = Pilot-Certified (C2). Later G6 = Production-Certified (C3).
- Artefacts: signed Conformance Report, defect log, badge certificate (version-bound).

**S6 Pilot-live**
- Entry: G5 plus *Approve-to-Pilot* (bank governance) plus written supervisory posture on capped live pilot.
- Activities: live issuance and redemption under value caps; real regulator read-node; daily reconciliation ceremonies; weekly pilot review; use-case data collection (section 7).
- Exit (G6): pilot exit criteria met: 30 consecutive days with zero unexplained reconciliation breaks and zero par events; live DR failover executed; operations on-call proven; Production-Certified (C3); *Approve-to-Produce* from the bank's board risk committee.
- Artefacts: pilot report, value evidence pack, DR drill report, go/no-go paper.

**S7 Production**
- Entry: G6.
- Activities: value cap lifting is a *network* decision under supervisory non-objection, not a bank one; hypercare with named DepositX engineers; first quarterly release train adoption.
- Exit (G7): 90 days meeting SLOs; hypercare closed; Steady-state handover.

**S8 Steady-state**
- Annual recertification, quarterly health review, DR/par-break drill twice a year, release adoption within window, and member-success KPI reporting (6.6).

### 2.3 What a large bank's internal approval path actually looks like

Assume a Tier A bank, and assume nothing is coordinated. In my experience of large regulated institutions, a new external-network dependency of this kind runs through the functions below. Names vary by bank; the questions do not.

| Function | What they will ask | Gate role | Unaided elapsed | DepositX artefact that answers it |
|---|---|---|---|---|
| Executive sponsor and investment committee | Business case, cost, strategic alternatives, competitor moves | Funding | 2-4 months | Business case kit (section 7), cost model, peer-adoption briefing |
| New-initiative / new-product approval committee (NIAP-equivalent) | Does this create a new product or risk type; who signs off | Hard gate | 2-4 months | Initiative paper template, function sign-off matrix |
| Architecture Review Board (ARB) | Fit with target architecture; reuse; resiliency; data flows; exit | Hard gate | 3-5 months | Reference architecture, ADRs, adapter design, deployment options, data-flow diagrams |
| Information security / cyber (B-13 aligned) `[V9]` | Threat model, key management, segmentation, pen test, secure SDLC, SBOM | Hard gate | 3-6 months | Threat model, HSM and ceremony docs, SBOM and reproducible-build attestations, pen-test summaries |
| Third-party risk management (B-10 aligned) `[V9]` | Materiality, concentration, sub-contractors, exit plan, financial health, audit rights, BCP | Hard gate | 4-8 months | B-10 dossier: operator governance, financials, subcontractor map, exit plan, BCP evidence, insurance |
| Legal | Membership Agreement, liability, finality, insolvency, regulatory position, IP | Hard gate | 4-8 months | Membership Agreement, legal opinions on finality and insolvency `[V11]`, data-processing schedules |
| Compliance / AML / sanctions / privacy | Programme mapping, FINTRAC hooks, Travel Rule, privacy (PIPEDA; Quebec Law 25 where relevant) `[V8, V12]` | Hard gate | 2-4 months | Control mapping, screening design, attestation model, privacy impact assessment template |
| Treasury / ALM / ALCO | Intraday liquidity, funding, 24/7 liquidity, LCR/NSFR, limits, FTP | Hard gate | 3-6 months | Liquidity impact model and stress scenarios; position feed spec (3.4); flagged treatments `[V1-V4]` |
| Finance / accounting (Chief Accountant, Controllers, Tax) | Recognition, classification, GL, regulatory returns, CDIC premium reporting | Hard gate | 4-8 months | Accounting position paper, GL journal templates, return-mapping schedules (3.5) `[V5-V7]` |
| Operations | Runbooks, on-call, incident model, staffing, BCP | Hard gate for pilot | 3-5 months | Runbook catalogue, OLAs, NOC integration spec, training material (3.8) |
| Model risk (E-23 aligned) `[V9]` | Any models: anomaly detection, velocity limits, ZK/verification claims | Hard gate if models in scope | 2-4 months | Model inventory, validation summaries, formal-verification artefacts |
| Enterprise risk and Board Risk Committee | Risk appetite fit, residual risk, regulator posture, board paper | Final gate | 2-3 months (calendar-bound) | Pre-drafted board paper, residual-risk register, regulator correspondence summary |

Unaided, and run largely in series because each function waits for the previous one's conclusions, this is **12-18 months**. Two problems dominate. First, each function asks the same questions in a different template. Second, several functions want evidence (SOC 2, audit, proofs) that does not exist until Phase 2.

### 2.4 How we shorten it: the Bank Due-Diligence Pack (BDDP)

**Design.** One authoritative library, published via a secured Trust Centre, versioned, with every answer traceable to an owner and date. Structure follows the 12 functions above, so each bank function opens one folder.

**Contents (v1.0, target 1 Feb 2027, before founders start S2):**
1. Architecture: reference architecture, ADRs, invariants statement, data-flow diagrams, resilience design, exit design.
2. Security: threat model, key-management design, ceremony scripts, secure-SDLC description, SBOM and reproducible-build process, pen-test plan.
3. TPRM: B-10-shaped dossier, subcontractor and concentration map, financial and insurance summary, BCP/DR plan, incident-notification commitments, audit and regulator access rights.
4. Legal: draft Membership Agreement, Rulebook, opinion scopes (finality, insolvency, perimeter), privacy and data-residency schedules.
5. Compliance: AML/ATF control mapping, sanctions and Travel Rule design, KYC-attestation model, FINTRAC reporting hooks.
6. Treasury/ALM: liquidity impact model, intraday scenarios, position-feed specification, limits framework.
7. Finance/accounting: position paper (drafted by an independent adviser who is not any member's auditor of record, for each bank's auditor to review), GL journal templates, return-mapping schedules.
8. Operations: runbook catalogue, OLA templates, NOC integration spec, incident-communication templates.
9. Model risk: model inventory and validation approach.
10. Board kit: board paper template, residual-risk statement template, decision-tree of regulator engagements.
11. Crosswalks: our answers pre-mapped to the common industry security-questionnaire formats banks already use (so a bank's standard TPRM questionnaire is pre-filled), plus a regulator-guideline crosswalk (B-10, B-13, E-21, E-23) `[V9]`.

**Evidence maturity, not evidence promises.** Pack v1.0 has designs. v2.0 (target Aug 2027) adds Phase 1 evidence (10,000 simulated transfers, zero par breaks, PFMI gap assessment, benchmark results). v3.0 (target Q2 2028) adds SOC 2 Type I, first external audit, published formal-verification proofs, bug-bounty results, DR drill results. Type II does not exist until well after Phase 3 starts, so banks approve-to-produce on Type I plus a bridge letter and an in-progress Type II observation window, with the commitment written as a condition subsequent `[V9]`.

**Service model.**
- Question ledger with a 5-business-day answer SLA and a rule that no bank gets a bespoke answer that other banks do not also see in the pack (clean-team rules apply to the *bank's* confidential data, not to DepositX's own answers).
- Pre-booked joint review sessions for every function, on a bank-agreed calendar aligned to its committee dates.
- A named "approval navigator" (from Onboarding) per bank who tracks committee calendars.
- Metrics: pack reuse rate (share of bank questions answered from the pack) target >80% by Wave 2; average questions per bank falling with each wave.

**Expected effect (Tier A, repeat wave):**

| | Unaided | With BDDP, parallel tracks, staged approvals |
|---|---|---|
| Internal approval elapsed (S2 plus S3) | 12-18 months | 5-8 months |
| Bank PM in S2 | 70+ | ~45 |
| Approval structure | one big approval | Approve-to-Build (month 5), Approve-to-Pilot (month ~10), Approve-to-Produce (month ~17) |

For a Tier B bank the same path is 3-5 months. The three staged approvals are the biggest single lever. Banks already run stage-gated approvals with conditions precedent, so the pack gives each stage its own evidence set.

### 2.5 Typical durations (calendar months, with overlaps)

| Stage | Tier A first wave (co-design, no pack) | Tier A repeat (pack, certified adapter) | Tier B (mid-tier, foreign sub) | Tier C (NIP, node-as-a-service) |
|---|---|---|---|---|
| S1 Engage | 2-3 | 2 | 1-2 | 1 |
| S2 Assess | 5-7 | 3-4 | 2-3 | 1-2 |
| S3 Contract | 5-8 (overlaps S2) | 3-5 (overlaps S2) | 2-3 (overlaps S2) | 1-2 |
| S4 Build | 12-15 | 9-12 | 6-9 | 3-5 |
| S5 Certify | 3-4 (overlaps end of S4) | 2-3 | 2 | 1-2 |
| S6 Pilot-live | 6 | 4-6 | 3-4 | 2-3 |
| S7 Production | 3 | 2-3 | 2 | 1-2 |
| **Critical path, Engage to production** | **24-30** | **18-22** | **12-15** | **6-9** |

Worked calendar for a Tier A repeat bank starting Engage in month 0:
- M0-2 Engage; M1-5 Assess; M3-8 Contract (Build Authorisation Letter at M3-4).
- M4-14 Build. Thin Pilot Profile complete at M10; Full Production Profile at M14.
- Pilot-Certified (C2) at M10-11; pilot go-live at M11-12.
- Production-Certified (C3) at M15-16; production go-live at M17-19; stabilisation exit around M20-22.

A bank starting Engage in October 2026 is pilot-live around Q3 2027 (Phase 2 start) and production-ready around Q3 2028. That is the schedule Phase 3 assumes, and it leaves essentially no slack.

---

## 3. Integration architecture from the bank's side

### 3.1 Reference adapter: the DepositX Bank Adapter (CBA)

Blueprint principle: "one reference core-banking adapter". I recommend the reference adapter be **core-agnostic by design**, with core-specific *connectors* as thin, certified plug-ins. If we ship a single vendor-specific adapter, we have built for one bank.

**Shape: hexagonal (ports and adapters), containerised, no cloud lock-in.** Runs on Kubernetes or OpenShift, on-premises or in a Canadian cloud region; Helm and infrastructure-as-code; signed images, SBOM, reproducible builds; supported on the bank's own hardened base images.

| Component | Function |
|---|---|
| Instruction Gateway | Accepts bank-side instructions (pain.001, pacs.008/009, camt.056, sese for DvP) and returns status (pain.002, pacs.002, camt.029); idempotency keys; schema and business-rule validation |
| Canonical Model and Mapping Service | Versioned mappings between the bank's internal formats and DepositX ISO 20022 Message Usage Guidelines; mapping changes are governed artefacts |
| Core Posting Service (connector plug-ins) | Executes mint-hold, redeem-credit and net-settlement postings via MQ, REST, file, or database-view connectors; outbox/inbox pattern; retries with exactly-once effect |
| Position and Reconciliation Engine | Continuous three-way reconciliation (3.6); break management; auto-freeze rule when tolerances are breached |
| Wallet and Key Service | Bank-hosted wallets; HSM integration (PKCS#11/KMIP); issuer-key signing; ceremony hooks |
| Compliance Hooks | KYC attestation issuance from the bank's KYC system; screening callbacks; Travel Rule payload assembly; FINTRAC reporting hooks |
| Treasury Feed | Real-time position, headroom and forecast API (3.4) |
| Accounting Event Publisher | Emits accounting events mapped to GL journal templates (3.5) |
| Payments-Hub Bridge | Routing rules, fallback to other rails, status mapping (3.5) |
| Observability and Audit | Signed audit log, OpenTelemetry metrics/traces, NOC alert forwarding |
| Ops Console and Runbook Automation | Break triage, replay, stand-in controls, four-eyes actions |

**Non-negotiable design rules:**
1. **Par logic lives in L2 contracts, not in the adapter.** The adapter cannot override or bypass the par-enforcement module.
2. **No mint beyond backing.** The adapter pre-checks that supply after mint does not exceed the bank's backing GL balance, and the L2 module checks again. Two independent checks.
3. **Deterministic replay.** Any instruction can be replayed from the audit log and produce the same result.
4. **Fail closed.** If the adapter cannot verify backing or reconciliation state, it stops minting and stops accepting redemptions that would require unverifiable postings, and raises a Sev-1.
5. **Four-eyes on every manual action**, all actions signed and logged.
6. **No customer PII on the ledger.** The adapter holds attestation references only; identity data stays in the bank.

### 3.2 Deployment options

The issuer must always own its validator identity and issuer signing keys in an HSM partition it controls. The options differ in who operates the hardware and software.

| | **A. Bank-operated validator** | **B. Managed node-as-a-service (NaaS)** | **C. Hosted in bank DC, co-managed** |
|---|---|---|---|
| What it is | Bank builds and runs validator plus adapter on its own infrastructure (own DC or own Canadian cloud tenancy) | Certified TP-3 provider hosts and operates the validator and adapter in its Canadian facilities; bank's HSM partition (in provider DC or bank-DC HSM with remote signing) stays under bank control | Sealed reference stack (validated cluster) installed in the bank's DC; operated jointly through a bank-controlled bastion; updated by signed bundles delivered by DepositX or a TP-3 |
| Default for | Tier A | Tier B (common), Tier C (default) | Tier A/B that want DC residency but not build-and-run |
| Control | Highest | Medium | High |
| Time to first node | 4-6 months | 4-8 weeks | 2-4 months |
| Upgrade agility | Bank-paced (needs skew policy) | Fast, provider-paced within release train | Bundle-paced |
| Bank effort (see 3.7) | Highest | Lowest | Medium |
| TPRM implication | DepositX operator is the material third party | Adds a second material third party (the provider); needs exit plan and step-in rights | DepositX/TP is a supplier of managed components; bank owns the environment |
| Regulatory posture | Simplest | Needs B-10 evidence on the provider `[V9]` | Middle |

**Minimum validator standard (any option):** two Canadian sites; hardware security modules certified to a recognised level (FIPS 140-3 Level 3 or bank-policy equivalent) `[V16]`; diverse dedicated network paths; time synchronisation from two independent sources; measured inter-validator latency budget consistent with the sub-2-second median finality target; separate non-production topology; ledger, keys and backups in Canada, including DR copies.

**Validator activation is staged (proposed; Ledger pod to confirm consensus supports it `[V15]`):**
1. *Learner replica:* syncs and verifies but does not vote.
2. *Shadow voting:* votes recorded and scored, not counted in consensus, for at least 14 days.
3. *Voting validator:* promoted by governance action (MPC-signed), only after certification C2/C3 as relevant.
A validator that repeatedly fails SLOs can be demoted back to shadow by the same governance action. This is how the network is protected from a slow or unstable bank once live.

### 3.3 Integration patterns for legacy cores

The design intent (and the sales pitch to a bank CIO): **the core sees far less than a payment rail would ask of it.** Transfers between token holders do not touch the core. Only three event types do: mint (deposit to token), redeem (token to deposit), and inter-issuer net settlement. All three are low-frequency compared with payment instructions.

| Core situation | Pattern | Notes |
|---|---|---|
| **Mainframe / in-house core with MQ** | Adapter is an MQ client exchanging ISO 20022 XML; COBOL copybook and CICS wrappers or z/OS Connect for mapping; posting via existing online transaction or batch-input queues | Typical for Tier A. The mainframe rarely has 24/7 posting; use posting pattern P2 (below). Load is small, latency budget is generous because the core is not on the finality path. |
| **ISO 20022 gateway / payments hub already in place** | DepositX becomes a new *rail* on the hub: routing rule, scheme configuration, status mapping, fallback | Preferred for Tier A/B: reuse the bank's repair, enrichment, cut-off logic and sanctions hooks; keep DepositX's own screening as authoritative for the network |
| **Temenos, FIS, Finastra, Fiserv (vendor cores)** | Use the vendor's supported integration surface: event streaming and REST APIs where the deployed version supports them, otherwise MQ or file; connector shipped as a TP-1 certified component | Vendor names indicate integration families only. **What each deployed version can actually do (24/7 posting, API coverage, custom-field support) must be confirmed per bank per version** `[V13]`. |
| **In-house / heritage core with no API** | Adapter reads and writes through an anti-corruption layer (database view, batch file, or vendor-neutral service the bank builds) | Highest effort. Likely to need a bank-built shim. The certification suite tests the shim, not the core. |
| **Multiple cores** (retail core, commercial core, wire system) | One adapter instance per issuing legal entity; per-core connectors behind the same Core Posting Service | Big banks will have this. The token backing GL is the single point where they converge. |

**24/7 posting patterns.** Cores have batch windows; DepositX has no maintenance window. Three patterns:
- **P1: Real-time core posting.** Core (or payments hub) accepts postings 24/7. Simplest; use where it exists.
- **P2: Pre-funded token accounts (default for legacy cores).** During core-online hours the customer moves funds into a segregated "tokenisation backing" balance. Mint and redeem after hours consume or replenish that backing pool through the adapter's durable ledger; the core catches up at next window. Supply is exactly the backing GL balance at every instant, so par integrity does not depend on core availability.
- **P3: Adapter stand-in with queued posting.** Limited to redemptions below a cap, with holds. Higher risk; requires explicit issuer risk acceptance. Not permitted in production for a bank's first year.

### 3.4 Treasury and ALM integration

Treasurers will sign off only if they can see and control liquidity in real time, 24/7. Outputs the adapter must publish (per-second where relevant):
- Token supply per issuer and per wallet segment.
- Net inter-issuer position and headroom against limits.
- Settlement-balance position and forecast; time-to-shortfall.
- Mint/redeem flow, with weekend and holiday patterns.

Inputs the bank sets: bilateral and multilateral caps, minimum settlement balance, auto-top-up rules, kill-switches, and a "liquidity stress" mode that tightens limits.

**Unresolved and blocking for Treasury sign-off:** the blueprint does not say how central-bank money anchors the interbank leg. Does the issuer pre-fund a settlement position at the Bank of Canada, settle net at intervals via Lynx or a DepositX-specific arrangement, or hold collateral? My working assumption for the pack is a **pre-funded settlement position** per issuer, replenished from the bank's own accounts. That is the conservative case and the easiest for ALCOs to approve. It must be confirmed by the Settlement, Finance and Regulatory seats `[V1]`. Further items ALM will ask about and that need verified answers:
- Intraday liquidity monitoring and reporting obligations `[V4]`.
- Funds transfer pricing for tokenised deposits.
- Weekend/holiday liquidity management for a 24/7 deposit rail.

### 3.5 GL, accounting, regulatory reporting, payments hub

**Accounting model (proposed for the position paper; flagged for verification).** A deposit token is a *representation of an existing deposit liability* (blueprint). So minting moves a customer's deposit from a traditional account type to a tokenised account type. **Total deposit liabilities do not change on mint or redeem.** New GL accounts:

| GL account | Type |
|---|---|
| Deposits, tokenised (by holder segment) | Liability |
| Tokenisation backing account (P2 pattern) | Liability, transitional |
| Settlement balance, DepositX | Asset |
| Inter-issuer settlement receivable / payable | Asset / Liability |
| Reconciliation suspense (with ageing) | Clearing |
| DepositX fees | Expense / income |

| Event | Journal (illustrative) |
|---|---|
| Mint | Dr Deposits (conventional) / Cr Deposits, tokenised (same holder) |
| Redeem | Reverse of mint |
| Transfer, same issuer | No GL entry between customers; wallet movement only |
| Transfer, inter-issuer, sender side | Dr Deposits, tokenised (payer) / Cr Settlement obligation or Settlement balance |
| Transfer, inter-issuer, receiver side | Dr Settlement claim or Settlement balance / Cr Deposits, tokenised (payee) |
| Net settlement (Phase 3 netting) | Dr/Cr Settlement obligation / Settlement balance |
| Break or timing difference | Dr/Cr Reconciliation suspense; ageing rules; auto-escalate |

**Questions flagged for verification (they gate Finance and Treasury sign-off):**
- Recognition and classification under IFRS for the issuer's tokenised deposit liability and for a bank's holding of another issuer's token, including cash-equivalent status for corporate holders `[V6]`.
- LCR: run-off rate for tokenised deposits given 24/7 instant mobility, and whether the pre-funded settlement position counts as HQLA (central-bank reserves) `[V2]`.
- NSFR: available-stable-funding factor for tokenised deposits, and required-stable-funding factor for a bank's holdings of other issuers' tokens `[V3]`.
- Intraday-liquidity reporting `[V4]`.
- Mapping to OSFI returns and deposit categories (wholesale vs retail, operational deposits) `[V7]`.
- CDIC: insurability, deposit-holder identification for the single customer view and premium reporting `[V5]`.
- FINTRAC: Travel Rule applicability to domestic tokenised transfers `[V8]`.
- Large-exposure and counterparty-risk-weight treatment of inter-issuer exposures and of NIP holdings `[V7]`.

I recommend the operator commission a single independent accounting and regulatory-treatment paper for the pack (not from any member's auditor of record), and that OSFI be asked for written feedback on it *before* Wave 1 banks reach Approve-to-Pilot. No bank Chief Accountant will sign a novel classification on a vendor's assertion.

**Payments-hub integration.**
- DepositX appears as a rail with routing rule: "payee's bank is a participant, both accounts eligible, value within limits". Status mapping from DepositX outcomes to pain.002 / pacs.002.
- **Fallback routing**: if DepositX is unavailable or an instruction is ambiguous, fall back to Lynx or the Real-Time Rail only after querying deterministic status by transfer ID (pacs.028-style status request). Because DepositX has no partial or pending state, an instruction has exactly one of two outcomes; the hub must never double-send.
- Reporting: camt.052/053/054 mapping into the bank's cash-management channels so corporates see tokenised balances in their normal statements.
- Returns: implemented as new payments (pacs.004-style semantics), never as ledger reversal. Finality means finality.

**Reconciliation (four levels, all continuous):**
1. *Supply to backing:* token supply per issuer equals the backing GL balance. Tolerance for in-flight items measured in seconds. Any breach unresolved beyond the configured window freezes minting. This is the par control's bank-side twin.
2. *Wallet to core mirror:* holder-level balances vs the bank's customer-facing views.
3. *Settlement:* inter-issuer obligations vs Bank of Canada / settlement-account statements.
4. *Instruction to outcome:* every accepted instruction has a terminal status; nothing older than a threshold is unresolved.

**Operational runbook catalogue** (each with trigger, severity, decision authority, RACI, comms template, success criteria, drill frequency): node start/stop; validator promotion/demotion; HSM failure; key ceremony participation; key compromise; mint or redeem outage; reconciliation break triage; stuck instruction; core down but token up; token down but core up; consensus stall; validator failover; DR failover and return; par-break/halt response; sanctions hit; suspected wallet compromise; certificate rotation; release upgrade and rollback; vendor outage; weekend/holiday liquidity event; regulator query surge; comms and disclosure.

### 3.6 Two-speed integration: Thin Pilot vs Full Production Profile

| | **Thin Pilot Profile** | **Full Production Profile** |
|---|---|---|
| Purpose | Get live under caps for Phase 2; prove flows and value | Meet Phase 3 and production SLOs |
| Posting | P2 pre-funded accounts; batch GL posting acceptable | P1 where possible, otherwise P2 with automated GL |
| Reconciliation | Levels 1 and 4 automated; 2 and 3 semi-manual, daily | All four automated and continuous |
| Treasury | Position feed to a dashboard; manual limit setting | Full feed and automated limit control |
| Payments hub | Direct API from a pilot client channel | Full rail integration with fallback routing |
| Operations | Business-hours plus on-call | 24/7 with runbook automation |
| Effort | ~40% of Build | Remaining ~60% |
| Live value cap | Set by supervisory posture | Cap lifted by supervisory non-objection |

### 3.7 Effort estimate (ROM) and where cost sits

**Bank-side person-months, Engage to production, repeat-wave (pack and certified adapter available):**

| Stage | Tier A (Big Six / Desjardins-scale) | Tier B (mid-tier, foreign sub base case) | Tier C (NIP, NaaS) |
|---|---|---|---|
| S1 Engage | 6 | 3 | 2 |
| S2 Assess | 45 (70+ without pack) | 20 | 8 |
| S3 Contract | 25 | 12 | 6 |
| S4 Build | 240 | 90 | 25 |
| S5 Certify | 40 | 18 | 6 |
| S6 Pilot-live | 55 | 22 | 8 |
| S7 Production | 40 | 15 | 6 |
| **Total** | **~450 (range 350-550)** | **~180 (range 130-220)** | **~60 (range 40-90)** |
| S8 steady-state per year | ~100 (8-10 FTE) | ~40 | ~12 |

Modifiers: first-wave co-design Tier A +40% (~630 PM); foreign bank subsidiary +30% for parent-group approvals; a bank on option B (NaaS) saves about 20-25% of Build.

**DepositX-side onboarding effort per bank (person-months):** Tier A ~100 (S1 4, S2 14, S3 10, S4 28, S5 18, S6 14, S7 10); Tier B ~45; Tier C ~20. First-wave Tier A ~160.

**Where cost sits (Tier A Build, 240 PM):**

| Work | PM | Share |
|---|---|---|
| Adapter deployment, core connectors, core changes | 70 | 29% |
| Security, infrastructure, HSM, network, DR | 35 | 15% |
| GL, accounting events, regulatory-reporting changes | 30 | 12% |
| Test automation and environments | 30 | 12% |
| Payments-hub and routing | 25 | 10% |
| Compliance integration | 20 | 8% |
| Treasury/ALM feeds | 15 | 6% |
| Operations tooling, runbooks, monitoring | 15 | 6% |

Across the whole path, testing, risk/legal/finance governance and operational readiness together are roughly as large as the core integration. Boards routinely underestimate this.

**ROM dollar costs (CAD, all-in to production).** At ~CAD 22k blended per PM plus infrastructure, vendor change fees and external assessments:

| | Tier A | Tier B | Tier C |
|---|---|---|---|
| One-time to production | 14-22M | 5-8M | 1.5-2.5M |
| Annual run | 3-6M | 1.2-2.5M | 0.3-0.8M |

**Two consequences for the board:**
1. Six Tier A banks are ~CAD 85-135M in bank-side one-time cost. That alone approaches the blueprint's "9 figures". Decide explicitly whether bank-side integration cost is inside or outside the programme envelope.
2. The blueprint's "peak build team 120-160 across all participants" looks understated. Six Tier A banks at ~450 PM over ~22 months average ~120 FTE and peak near 180 on bank integration alone, before the operator's six pods.

---

## 4. Certification and conformance

### 4.1 Conformance test catalogue

The catalogue is owned by DepositX Assurance (Integration & assurance workstream) and executed by the bank with DepositX witnessing. Results are signed evidence, not attestations.

| Suite | Scope | Examples | Indicative size |
|---|---|---|---|
| **F Functional** | End-to-end flows | Wallet setup; mint; same-issuer transfer; inter-issuer transfer; redeem; DvP cash leg; conditional and escrow payments; limits and velocity; KYC attestation; sanctions hit; returns as new payments | ~400 cases |
| **M ISO 20022 conformance** | Message-level | Schema validation; DepositX Message Usage Guideline business rules; negative tests; duplicates; version handling; character set; round-trip mapping | ~1,200 vectors |
| **R Reconciliation and accounting** | Bank-side books | GL posting correctness per event; four-level reconciliation; break injection and ageing; end-of-day positions | ~150 cases |
| **X Failure injection** | Resilience | Core down; MQ backlog; adapter crash mid-saga; duplicate and reordered messages; clock skew; HSM unavailable; network partition; validator crash; grey-failure (slow validator); consensus stall; API gateway flood | ~80 scenarios |
| **P Par-break drills** | The invariant | Inject supply > backing; tampered mint; contract-defect simulation; verify detection time, halt behaviour and scope (issuer freeze vs network halt), recovery and resumption criteria, comms and regulator notification | ~15 drills, all mandatory |
| **N Performance** | Throughput and latency | Adapter sustained load at 2x forecast peak share and burst 5x; adapter-added latency budget; 72-hour soak; core posting throughput for mint/redeem | 6 profiles |
| **S Security** | Assurance | Independent penetration test; API security; HSM and key ceremony rehearsal; segmentation validation; SBOM and reproducible-build verification; insider-abuse scenarios; red-team of the adapter | Independent assessor |
| **D DR and BCP** | Recovery | Site failover; region failover; return to primary; core-down/token-up and token-down/core-up modes; cyber-recovery from immutable backups; RTO under 15 min and RPO zero evidenced on the bank side | 8 exercises, one live |
| **O Operational readiness** | People and process | Runbook walkthroughs; tabletop exercises; on-call proof; NOC alert routing; incident-comms drill | 12 exercises |
| **C Compliance** | Controls | Sanctions at mint/transfer/redeem; Travel Rule payload; FINTRAC hooks; audit-log integrity; regulator read-node query under 60 seconds | ~60 cases |
| **U Upgrade and compatibility** | Version skew | N and N-1 interop matrix; rolling upgrade under load; rollback; feature-flag activation | Nightly automated |

**Zero-tolerance list:** any par-break drill failure; any atomicity failure; an unresolved level-1 reconciliation break; any key-handling failure; any open critical or high security finding. These cannot be waived by scoring.

### 4.2 Sandbox and simulation environments

| Env | Purpose | Who | Data | Notes |
|---|---|---|---|---|
| **E0 Playground** | Learn and prototype: single-node network, documented examples, ISO 20022 validators, SDK | Anyone in onboarding; TPs | Synthetic | Open to prospective participants after G1 |
| **E1 Integration Sandbox** | Shared multi-issuer testnet with per-bank tenant; **Bot Banks** (DepositX-run counterparties that generate traffic and inject faults) | Banks in S4; TPs | Synthetic | Refreshed weekly or on demand. Bot Banks mean no bank depends on another bank being ready. |
| **E2 Certification Environment** | Production-identical topology, versions pinned, scripted harness. Only place badges are issued | Banks in S5 | Synthetic | Reserved slots; DepositX-controlled |
| **E3 Pilot Ring** | Live topology with real regulator read-nodes; capped real value | Banks in S6 | Live, capped | Supervisory posture required |
| **E4 Production** | | | Live | |
| **Sim Lab** (cross-cutting) | Network simulator with latency and validator-failure injection; traffic replay; par-break simulator using a deliberately faulty contract build | DepositX Assurance with banks | Synthetic | Used for suites X, P, N |

### 4.3 Badge criteria

| Badge | Criteria | Unlocks |
|---|---|---|
| **C1 Sandbox-Ready** | Adapter running against E1; smoke suite green; ISO 20022 conformance at least 95%; named operations contacts registered | G4 Test Entry; Build to continue |
| **C2 Pilot-Certified** | Thin Pilot Profile: F, M, R (levels 1 and 4), X (core subset), P (all), O (tabletop), C, and S with no open critical/high findings; DR tabletop; zero open Sev-1 defects; bank's CRO/COO readiness attestation | G5; pilot-live under caps |
| **C3 Production-Certified** | All suites; N passed; live DR failover executed; 30 consecutive days in the Pilot Ring with zero unexplained reconciliation breaks and zero par events; 24/7 operations proven; Operator SOC 2 Type I complete (Type II in progress) `[V9]` | G6; production |
| **Connector / Integrator / Service Provider certificates (TP)** | Connector: suites F, M, X against the vendor's reference environment and named versions. Integrator: named certified engineers plus two supervised reference deliveries. Service provider: full node-operation certification, DR, B-10 evidence | Listing on the Approved Partner Register |

**Certification decisions** are taken by a Certification Board: DepositX Head of Assurance (chair), an independent assessor, and a rotating member from another issuing bank; the Bank of Canada and OSFI are invited to observe. A bank never certifies itself or a direct competitor's bank alone.

### 4.4 Recertification triggers

Badges are valid for **12 months** and bound to a **version range** (for example "Certified for release train 2027.3 to 2027.5").

| Trigger | Response |
|---|---|
| Network major version | Full delta certification (affected suites) |
| Network minor version | Automated regression pack (suite U plus F/M subset); self-service with DepositX verification |
| Adapter or connector version change | Delta certification of impacted suites |
| Core or payments-hub major upgrade; hosting move; change of node provider; HSM firmware or crypto-suite change (mandatory for PQ migration in Phase 4) | Delta certification plus DR retest where topology changes |
| Sev-1 incident attributed to the participant | Root-cause-based recertification of the affected suites |
| Volume above 3x certified throughput | Suite N re-run |
| 12 months elapsed | Annual recertification incl. DR and par-break drills |

### 4.5 Release management and compatibility policy

The tension: six or more banks with different change calendars, versus a network that targets 99.999% availability and no maintenance windows.

**Release train**
- Calendar published 12 months ahead: **quarterly minor releases, one annual major**, out-of-band security patches. Each annual major is a long-term-support line, supported 24 months.
- **T-30 days:** Release Readiness Review and release notes; **GA;** **8-week adoption window** for all participants; **activation date** set by governance.
- **Canary:** operator node and one rotating volunteer issuer run the release for two weeks before GA.

**Version skew policy**
- Network supports **N and N-1** simultaneously. A participant can lag one minor for at most 90 days after GA. For a major, N-1 is supported for 6 months.
- **Activation of protocol changes uses expand-contract:** (1) all nodes deploy a version that understands both old and new behaviour (dual-read); (2) a governance-approved *activation height* is scheduled only once all voting validators report ready; (3) old behaviour is deprecated in the next release.
- If a voting validator is not ready at activation, governance may proceed with the supermajority. The laggard drops to shadow-voting status until it upgrades. The network is never held back by one bank, but demoting a Tier A bank is a systemic step, so it requires a defined warning sequence (T-30, T-14, T-7 days, waiver review by Council).

**Change calendars and freezes**
- Every participant registers its change freezes 12 months ahead (fiscal year-end, December, quarter-ends; verify each bank's calendar in Contract `[V14]`). The NCAB merges them into a network change calendar and schedules activation heights outside any *major* participant's freeze wherever possible.
- **Pre-approved standard-change status:** at Contract, each bank agrees that DepositX *patch* releases meeting defined criteria (signed, regression pack green, no schema change) are a pre-approved standard change in its ITSM, so a critical patch does not wait for a monthly change board. Critical security patch deployment SLA: 72 hours; high: 14 days.
- **Zero-downtime mechanics:** rolling node upgrades; blue/green for adapters; rollback tested as part of suite U.
- A nightly compatibility matrix (N and N-1 against every certified adapter and connector version) runs in E2.

---

## 5. Wave plan

### 5.1 Wave assignment rubric

Banks are assigned to waves by a published, weighted rubric, not by who shouts loudest. Naming which banks fall in which wave is a founder decision. I use archetypes here.

| Criterion | Weight |
|---|---|
| Executive sponsor and funding committed | 25% |
| Architecture openness (payments hub or ISO 20022 gateway in place; team available) | 20% |
| Core-archetype diversity for the network (we need at least two different patterns proven early) | 20% |
| Business-case pull (corporate demand for 24/7) | 15% |
| Regulatory posture and calendar capacity | 10% |
| Dependency readiness (Lynx access, HSM, DR sites) | 10% |

### 5.2 Waves

| Wave | Phase alignment | Participants | Scope |
|---|---|---|---|
| **0 Design Partners** | Phase 0 to Phase 1 (Q4 2026 to H1 2027) | 2 Founding Issuers, Tier A, of *different core archetypes* (one with a mature payments hub and modern integration; one heritage/in-house core). Bank of Canada observer (if confirmed `[V1]`). 1 core vendor and 1 HSM vendor as TPs | S1 to S4 (Sandbox-Ready). Bank 1 goes deep on a real core connector; Bank 2 integrates through a payments-hub façade and a mock core, taking its real core in Phase 2. That proves the adapter against two patterns, not one. |
| **1 Pilot Issuers** | Phase 2 (H2 2027 to H1 2028) | Wave 0 banks go pilot-live. 2-3 further Founding Issuers (Tier A) begin Build no later than Q2 2027, pilot-live by Q1-Q2 2028 on the Thin Profile. OSFI, CDIC, FINTRAC read-nodes. 2 TP-1 connectors, 1 TP-3 node provider, 1 tokenized-securities counterpart for DvP | S6 for Wave 0; S4-S5 for the others; regulator track |
| **2 Production Founders** | Phase 3 (H2 2028) | All Founding Issuers production-certified. Target at least 4 of the founding issuers in production by end of 2028, the rest by Q2 2029 under the slow-bank policy. First NIPs begin S6 within production. Tier B issuers admitted to S1-S3 in H1 2028 | Production; value cap lifted by supervisory non-objection |
| **3 Second Cohort** | Late Phase 3 to early Phase 4 (H1 to H2 2029) | 2-4 Tier B issuers; 4-6 NIPs; first Agent Banks; credit-union central on the sponsored track | New voting validators added at most one per quarter, and none in the first two quarters after production go-live |
| **4 Long Tail and Foreign** | 2029 onwards | Foreign bank subsidiaries, further credit-union centrals, retail-adjacent participants; cross-border corridor peer networks as a distinct interoperability track | Under Phase 4 objectives |

**Consequence of the critical path.** Wave 1 Founding Issuers must be in Assess in Q1 2027 and in Build by Q2 2027. That requires a binding **Founding Issuer Charter** (term sheet with Build authorisation and funding commitment) signed by end of Q1 2027, not the end of Phase 1. The alternative is to move the Phase 3 date. Phase 3 should be reworded to "at least N founding issuers production-live" instead of "all", which also fixes the known-issue problem that the blueprint's 99.999% "sustained over two quarters" exit criterion cannot be met inside a phase that starts with go-live. I recommend Phase 3 exit be measured over two quarters *after* first production go-live, without requiring the phase to be dated to end at that point.

### 5.3 Handling a slow bank without blocking the network

1. **Lanes with stage clocks.** Each bank has its own dated stage plan. Slippage of 25% of a stage's planned duration triggers *amber*: an executive-sponsor call within a week. 50% triggers *red*: escalation to the Board member and Technology & Operations Council chair, and the bank's onboarding slot is released to the next in the queue (with a re-entry path).
2. **Phase and network milestones use quorum language**, never "all".
3. **Bot Banks and the certification environment** mean no bank is blocked by another's readiness.
4. **Open door:** a late-arriving Big Six bank uses the same pack, badges and slot process. The network is designed to be valuable and safe with them absent, and easy to join when they arrive.
5. **Founding Issuer covenant consequences** for a missed go-live date beyond the slip allowance are proportionate and pre-agreed: suspended rights to nominate roadmap items, reallocation of priority slot, and catch-up funding; never penalties that make banks avoid signing.
6. **No bank holds a veto** on another bank's admission or timing. Admission is by objective criteria (1.2), decided by the Membership Committee with the independent chair breaking ties.
7. **Live-network protection:** demotion of a voting validator to shadow status if it repeatedly fails SLOs (3.2), with the warning sequence in 4.5.

### 5.4 Adding the 7th and later participants

A 7th issuer is admitted only if all of the following hold:
1. **Objective eligibility** (1.2) met and the regulator has raised no objection.
2. **Capacity headroom:** after admission, projected network load under 60% of certified throughput, and the Ledger pod confirms consensus performance at the new validator count. **Voting validator set cap of about 15** is my working assumption; BFT message cost grows with validator count `[V15]`. Beyond the cap, later issuers would need a sponsored, non-voting model, which changes the blueprint's "each issuer is a validator" and must be decided at the end of the Phase 1 benchmark.
3. **Fault-tolerance arithmetic:** with n voting validators the network tolerates f faulty where n is at least 3f+1. With 4 voting validators f=1 (fine for pilot); production with 99.999% target needs f=2, so at least 7 voting validators. This makes the count of live validators a production entry condition, and it depends on whether the Bank of Canada and a second operator-run node are counted `[V1, V15]`.
4. **Network health:** no Sev-1 in the prior 90 days attributable to onboarding activity; no release train in mid-activation.
5. **Cadence limit:** at most one new voting validator per quarter after production; at most two in shadow at once.
6. **Governance:** Membership Committee supermajority under the rulebook, with objective grounds required for any refusal.
7. **Onboarding slot available** (5.5).

### 5.5 Onboarding team capacity

The blueprint's six delivery pods have no bank-facing onboarding function. I propose a seventh standing function, the **Bank Onboarding & Integration Office (BOIO)**, working alongside the Integration/SDK pod (which builds the adapter and SDK; BOIO applies them at banks).

| Phase | BOIO headcount |
|---|---|
| Phase 0 (Q4 2026) | 8 |
| Phase 1 (H1 2027) | 18 |
| Phase 2 (H2 2027 to H1 2028) | 34 (peak) |
| Phase 3 (H2 2028) | 36-40 |
| Steady state (2029+) | 20-25 |

**Roles:** Head; wave directors; Bank Relationship Leads (one per bank); solution architects; integration engineers; certification and test engineers; sandbox and Sim Lab operations; due-diligence and pack team (with Legal, Risk, Finance liaisons); operations-readiness managers; technology-partner manager; member-success managers.

**Capacity rule of thumb:** a Tier A bank needs a pod of ~5 FTE (peaking at 7); Tier B ~2.5; Tier C ~1; shared services (pack, sandbox, Sim Lab, certification tooling) ~10. **Concurrency at 34 FTE: 4 Tier A in Build, plus 1 Tier B and up to 3 Tier C.** A fifth concurrent Tier A in Build needs another 5 FTE and a 6-8 week lead time to hire and train.

### 5.6 Decisions requested within 30 days

1. Approve the Founding Issuer Charter concept with a Build Authorisation Letter due by end of Q1 2027.
2. Approve the BOIO (34 FTE at peak) and start hiring the first 8.
3. Approve pack v1.0 delivery by 1 February 2027 with named function owners in Legal, Risk, Finance and Security.
4. Confirm two-speed integration (Thin Pilot and Full Production Profiles) as the standard, and reword the Phase 2 and Phase 3 exit criteria in quorum language.
5. Decide whether bank-side integration cost is inside the programme envelope.
6. Commission the independent accounting and regulatory-treatment paper and initiate the OSFI/CDIC/BoC feedback channel.
7. Confirm the settlement-anchor mechanism working assumption (pre-funded settlement position) so Treasury/ALM work can start.
8. Commission a competition-law protocol for all councils and clean-team arrangements `[V10]`.

---

## 6. Member support operating model

### 6.1 DepositX Network Operations Centre (CNOC)

- **Phase 1:** business hours plus on-call. **Phase 2:** 24/7 staffed, 2 seats plus an on-call incident commander. **Phase 3:** 24/7 with 3 seats plus a duty incident commander and a dedicated member service desk.
- Staff and tooling in Canada. Two Canadian sites; five-shift roster (one seat around the clock needs about 5.5 FTE; the full CNOC is ~14-18 FTE within the blueprint's 40-60 operator run team).
- Integrates with each bank's operations through **Operational Level Agreements** (named 24/7 contacts, escalation ladders, joint bridge, out-of-band comms that do not depend on the network or the same cloud).
- Authenticated status page and multi-channel notifications (voice, SMS, email, secure messaging).

### 6.2 Member-facing SLAs

| Item | Commitment |
|---|---|
| Network availability | 99.999% (blueprint target; measured monthly, reported quarterly; earlier phases have published lower interim objectives) |
| Finality | Median under 2 s, p99 under 5 s, reported monthly |
| Sev-1 (par risk, halt, finality outage, security compromise) | Acknowledge 5 min; bridge open 15 min; updates every 15 min |
| Sev-2 (degradation, single issuer or partial impact) | Acknowledge 15 min; updates every 30 min |
| Sev-3 | Acknowledge 1 h; resolve target 1 business day |
| Sev-4 | Next business day |
| Regulator read-node query | Under 60 s |
| Due-diligence questions | 5 business days |
| Support entitlement | FI and Issuers: 24/7 for Sev-1/2, named Member Success Manager. NIP: 24/7 Sev-1, business hours otherwise. TP: business hours. Regulators: dedicated liaison |

Remedies: service credits capped as a share of annual fees, plus termination rights for chronic failure, standard for all members `[V10]`.

### 6.3 Incident communications

Detect; T+5 min internal incident declared; **T+15 min all members notified** with severity, scope and initial status; T+30 min first written update; then hourly. **Preliminary root cause within 24 hours** (so banks can meet their own regulator-notification expectations, which I understand to be 24 hours for material technology and cyber incidents `[V9]`); final root-cause report in 5 business days; joint post-incident review with members in 10 business days. Regulators are notified per MOU. **Par-break protocol:** par break is a system-halting event (Invariant I). The halt decision, comms and resumption criteria are pre-agreed in the rulebook and drilled twice a year.

### 6.4 Change Advisory Board and councils

- **Network Change Advisory Board (NCAB):** weekly; chaired by Operator Head of Operations; one operations or technology representative per issuer; regulators as observers. Handles normal and emergency changes and owns the merged change calendar. Standard changes follow pre-approved models.
- **Councils** (quarterly unless stated):
  - *Technology & Operations Council* (CTO/COO level): one participant, one vote.
  - *Risk & Compliance Council* (CRO/CCO level).
  - *Treasury & Finance Council* (ALM and Chief Accountant level; semi-annual; aligns reporting treatments).
  - *Product & Use-Case Council* (business heads).
  - *Participant Assembly* (for NIPs and non-founding issuers).
  - *Partner Forum* (technology partners).
  - Regulator liaison meeting, with regulators invited to any of the above.
- **Competition-law protocol** for all forums: written agenda, counsel present, no exchange of pricing or client-level data, minutes reviewed. `[V10]`
- **Information barriers:** each bank's confidential material is held in segregated data rooms; DepositX staff do not carry one bank's confidential information to another; clean-team arrangements for any cross-bank data sharing.

### 6.5 Roadmap-influence process (so competing banks feel governed fairly)

1. **DepositX Improvement Proposals (CIPs):** any participant, or any two members jointly, can submit. Every submission is public to members with a status and rationale.
2. **Triage** by the Operator within 10 business days: completeness, regulatory necessity, duplicates.
3. **Impact analysis:** cost, risk, cross-participant effect, effect on invariants (anything weakening Par, Finality or Perimeter is rejected outright, per the blueprint).
4. **Scoring** (published rubric): network value; risk reduction; regulatory necessity; cost; number of participants requesting it.
5. **Council review**, then **quarterly Roadmap Board decision**. Technical matters: one participant, one vote. Economic matters: weighting set in the rulebook.
6. **Transparency:** decisions with reasons published to members; annual report on origin of roadmap items (share from non-founders is a KPI).
7. **Escalation:** the independent chair breaks ties; disputes go to a standing dispute panel.

### 6.5a Fairness safeguards

No side letters; MFN pricing; identical SLAs by tier; identical certification criteria; rotating membership of the Certification Board and Gate Review Board; the independent chair holds the casting vote on admission disputes.

### 6.6 Member-success KPI set

| Domain | KPI | Target |
|---|---|---|
| **Onboarding** | Time in stage vs plan | Within +25% |
| | First-time gate pass rate | >80% |
| | Pack reuse rate | >80% by Wave 2 |
| | Due-diligence questions per bank | Falling wave over wave |
| | Certification first-time pass, and defects per bank | >70%, falling |
| | Onboarding cost vs estimate | Within +20% |
| **Operations** | Adapter availability | 99.99%+ |
| | Reconciliation breaks per million instructions; breaks unresolved beyond threshold | Track; unresolved beyond threshold = 0 |
| | Mean time to acknowledge / resolve by severity | Per SLA |
| | Participant validator SLO attainment | >99.99% |
| | Release adoption within window | 100% |
| | Certification currency and drill completion | 100% |
| **Adoption and value** | Active corporate clients per bank | Growing |
| | Instructions, value settled | Growing |
| | Share of eligible flow settled on DepositX | Toward 95% wholesale by end of Phase 3 |
| | Use-case value realised vs hypothesis (section 7) | Reported quarterly |
| **Fairness and health** | Roadmap items originating from non-founders | >30% by 2029 |
| | Council attendance | >85% |
| | Escalations and disputes | Tracked |
| | Member health score (composite) | Red/amber/green per member |
| | Member satisfaction (CSAT/NPS) by tier | Tracked |

---

## 7. The "first three flows" use-case ladder

Each bank needs a business case that does not depend on many other banks being live. The ladder is sequenced by dependency and risk.

| Rung | Flow | Depends on | Phase |
|---|---|---|---|
| **1** | 24/7 cross-bank treasury sweeps (own-account, intra-group liquidity) | 2+ issuers, basic L3 | 2 |
| **2** | Corporate 24/7 conditional B2B payments (supplier on goods scan, on-demand payroll) | 2+ issuers; conditional-payment template library | 2-3 |
| **3** | Tokenized-bond DvP cash leg | Atomic DvP; a tokenized-securities counterpart; a dealer; L3 DvP integration | 3 |
| 4 (pull forward if a partner is willing) | Repo and intraday liquidity | Netting, collateral-system integration | 3+ |
| Later | PvP FX; cross-border corridors | Phase 4 | 4 |

### Rung 1: 24/7 cross-bank treasury sweeps and intra-group liquidity
- **Value hypothesis:** corporate groups with cash across several banks lose value to cut-offs, weekends and float. Moving own-account cash between banks continuously at par removes trapped cash, reduces overdraft and short-term borrowing, and lets the bank hold more of the corporate's operating balances.
- **Prove it with:** baseline (12 weeks pre-live) of daily balances by time-of-day, cut-off misses, weekend and holiday float, overdraft days, borrowing cost; pilot equivalents. **Metrics:** hours to funds availability; idle-balance days times rate differential; exceptions and failures; manual treasury hours; balances retained per client.

### Rung 2: Corporate 24/7 conditional payments
- **Value hypothesis:** pay-on-condition and 24/7 payment shorten days sales outstanding and payables cycles, capture early-payment discounts, reduce payment disputes and investigations.
- **Prove it with:** matched-pair pilot with corporate clients on both sides. **Metrics:** payment-to-availability time; DSO/DPO change; early-payment discounts captured; failed-payment and investigation rates and cost; client-reported value.

### Rung 3: Tokenized-bond DvP cash leg
- **Value hypothesis:** atomic DvP with a tokenised deposit cash leg replaces T+1 or bridge-based settlement, lowering fails, pre-funding cost and counterparty exposure during settlement.
- **Prove it with:** paper trades first (with a dealer and a tokenised-securities venue), then live capped trades. **Metrics:** settlement time; fail rate; funding and carry cost; capital or exposure reduction; operational touches per trade.

### Rung 4: Repo and intraday liquidity
- **Value hypothesis:** intraday and overnight liquidity moves atomically with collateral, at any hour, improving liquidity efficiency in stress.
- Metrics: intraday liquidity usage; peak-to-average funding; collateral mobility time; failed settlements.

### Value evidence framework
1. **Pre-registered metrics** and baselines agreed at S1 for each bank and flow.
2. **Baseline capture** for 12 weeks before pilot-live.
3. **Instrumentation** by the adapter: timestamps at every hop, outcomes, limits used, reconciliation state. No client-identifying data leaves the bank; aggregated for cross-bank views.
4. **Finance validation:** the bank's finance function signs off any benefit claim.
5. **Client evidence:** structured interviews and a short survey per pilot corporate.
6. **Monthly value review** per bank; quarterly anonymised aggregate to the Product & Use-Case Council under the competition-law protocol `[V10]`.
7. **Stop rule:** if a rung's hypothesis fails at the pre-agreed threshold, we say so and re-scope; we do not manufacture a business case.

---

## 8. Risks and RACI

### 8.1 Top 10 onboarding risks

| # | Risk | Rating | Mitigation | Owner |
|---|---|---|---|---|
| 1 | **Serial approvals stall banks** (12-18 months unaided) | High | BDDP; parallel tracks; staged approvals; approval navigators; committee-calendar planning; Build Authorisation Letters | Head of Onboarding |
| 2 | **Regulatory, accounting and liquidity treatment unresolved** (LCR/NSFR, CDIC, settlement anchor, finality basis) so Finance, Treasury and Board cannot sign | High | Independent position paper; OSFI/CDIC/BoC feedback before Approve-to-Pilot; conditional approvals; no live value without written supervisory posture; settlement-anchor decision (5.6) `[V1-V8, V11]` | Regulatory seat, with Finance |
| 3 | **Legacy core cannot support 24/7 or integration cost overruns** | High | Posting pattern P2; Thin Pilot Profile; core-agnostic adapter and connectors; per-version capability confirmation `[V13]`; contingency in estimates | Integration Lead |
| 4 | **Weak business case, or a use case depends on other banks being live** | Med-High | Use-case ladder with pre-registered metrics; rung 1 needs only two issuers; Bot Banks; stop rule | Product & Use-Case Council |
| 5 | **Governance deadlock or competition-law friction** between competing banks | High | Objective admission criteria; one participant one vote in technical councils; CIP process; competition-law protocol; rotating boards; independent chair `[V10]` | Governance seat |
| 6 | **Slow bank or wave slippage vs phase dates** | High | Lanes and clocks; quorum-based phase exits; Founding Issuer Charter by end Q1 2027; slot release; Bot Banks; staged validator demotion | Head of Onboarding |
| 7 | **Bank-side operational failure after go-live** (reconciliation, keys, runbooks) leading to a par event | High impact | Certification zero-tolerance list; par-break drills; fail-closed adapter; 30-day soak; dual checks on mint; hypercare | Head of Assurance |
| 8 | **DepositX itself as a concentration risk** and an immature operator under OSFI B-10 (no SOC 2 Type II until later) | Med-High | B-10 dossier; exit plan and ledger-copy rights; bridge letters; independent audit; step-in and standalone-validator capability `[V9]` | Operator CEO / Risk seat |
| 9 | **Vendor, SI and talent capacity** (few engineers with this skill set; vendors prioritising other clients) | Med | TP certification programme; Approved Partner Register; training academy; secondments; connector interface published; escrow | Technology-partner manager |
| 10 | **Version skew and change-calendar conflicts** cause an outage or stall upgrades | Med-High | Release train; N/N-1 skew; expand-contract activation; standard-change status; merged change calendar; canary issuer; nightly compatibility matrix | Head of Release & Operations |

### 8.2 One-page RACI

R = does the work; A = accountable (one per row); C = consulted; I = informed; a dash means not involved. Regulators are accountable only for their own decisions.

| Activity | DepositX Operator | Issuing Bank | Technology Vendor(s) | Regulators |
|---|---|---|---|---|
| Admission decision (eligibility, Membership Committee) | A/R | C | - | I |
| Supervisory consultation and non-objection | R | C | - | A |
| Due-diligence pack: authoring and upkeep | A/R | C | C | - |
| Bank internal approvals (NIAP, ARB, TPRM, board) | C | A/R | I | I |
| Reference adapter and SDK build and release | A/R | C | R | - |
| Bank-specific connector (core, hub, GL, treasury) | C | A | R | - |
| Core, GL and regulatory-reporting changes | C | A/R | R | I |
| Validator node operation (issuer's node) | C | A/R | R (if NaaS) | - |
| Issuer key custody and ceremonies | C | A/R | C (HSM vendor) | I |
| Operator key and MPC actions | A/R | C | C | I |
| Mint and redeem; supply equals backing | C | A/R | - | I |
| Continuous reconciliation and break resolution | C | A/R | C | I |
| KYC/AML programme and attestations at the bank | C | A/R | C | I |
| Network screening engine and Travel Rule messaging | A/R | C | R | I |
| Certification suite authoring and upkeep | A/R | C | C | I |
| Certification execution and badge decision | A/R (decision) | R (execution) | C | I |
| Bank readiness attestation (pilot, production) | C | A/R | C | I |
| Network go/no-go (pilot, production) | A | R | C | C |
| Value cap lifting | R | C | - | A |
| Sev-1 incident management | A | R (own domain) | R | I |
| Bank's regulatory incident notification | R (supply facts) | A/R | C | I |
| Release management and compatibility (NCAB) | A/R | R (adoption) | R | I |
| Recertification | A | R | R | I |
| DR and BCP testing | A (network) | R (own) | C | I |
| Member support and SLAs | A/R | C | C | - |
| Regulatory returns and CDIC reporting | C (data feeds) | A/R | C | I |
| Supervisory read-node access and queries | A/R | C | - | R (user) |
| Rulebook and roadmap decisions (through governance) | A | R | C | C |
| Exit plan and step-in rights | R | A | R | I |

---

## Appendix A. Assumptions and verification register

Nothing below should be treated as established. Each item needs an owner and a date; none of these are legal or accounting advice.

| ID | Item | Why it matters | Suggested owner |
|---|---|---|---|
| V1 | Settlement anchor mechanism (BoC settlement position, prefunding, netting); Bank of Canada as validator-observer (assumed in blueprint, not confirmed); BoC account access for issuers | Treasury/ALM sign-off; validator count; issuer eligibility | Settlement, Regulatory, Finance seats |
| V2 | LCR treatment of tokenised deposits (run-off rates); whether pre-funded settlement balance counts as HQLA | Bank Treasury, ALCO, Finance | Finance, Regulatory, with OSFI |
| V3 | NSFR factors for tokenised deposits and for holdings of other issuers' tokens | Same | Same |
| V4 | Intraday-liquidity reporting and monitoring obligations | Treasury tooling | Same |
| V5 | CDIC insurability, deposit-holder identification (single customer view) and premium reporting for tokenised deposits | Finance, Compliance, marketing claims | Regulatory, with CDIC |
| V6 | IFRS recognition and classification for issuers; holders' cash-equivalent treatment | Chief Accountant sign-off | Finance; bank auditors |
| V7 | Mapping to OSFI returns, deposit categories, large-exposure and counterparty risk weights | Regulatory reporting build | Finance, Regulatory |
| V8 | FINTRAC and PCMLTFA Travel Rule applicability to domestic tokenised deposit transfers | Compliance design | Compliance seat |
| V9 | Applicability and current effective dates of OSFI guidelines B-10, B-13, E-21, E-23 to the operator and to participants; materiality classification; incident-notification timeline; SOC 2 Type I/II acceptance and bridge letters | TPRM, infosec, model risk | Risk seat |
| V10 | Competition Act treatment of council collaboration and shared data; clean-team protocol; service-level remedies and liability terms | Every council and every data-sharing step | Legal seat |
| V11 | Legal basis of finality; Payments Canada membership and Payment Clearing and Settlement Act oversight; Retail Payments Activities Act relevance; legal opinions on insolvency; rulebook clause for NIP self-custody | Legal sign-off at every bank | Legal seat |
| V12 | Provincial regulators (AMF for Desjardins, FSRA, BCFSA and others for credit unions); Quebec Law 25 | Desjardins-scale and credit-union tracks | Legal, Regulatory |
| V13 | Actual 24/7 posting, API and custom-field capability of each vendor core version at each bank | Integration approach, effort estimate | Integration Lead, per bank |
| V14 | Each bank's fiscal year-end, freeze periods and change calendar | Release scheduling | Member Success, per bank |
| V15 | Consensus behaviour: staged validator promotion and demotion; validator-set size cap (~15 assumed); n = 3f+1 arithmetic and count of live validators needed for production | Wave plan, admission criteria | Platform & Ledger pod |
| V16 | HSM certification level, bank policy equivalents | Minimum validator standard | Security & SRE pod |

## Appendix B. Dependencies on other seats

- **Platform & Ledger:** staged validator promotion and demotion; N/N-1 protocol compatibility and dual-read activation; validator-set size and performance; adapter hooks for supply commitments.
- **Settlement & programmability:** DepositX Message Usage Guidelines (ISO 20022) for suite M; DvP and conditional templates for rungs 2-3; netting design for treasury.
- **Compliance & identity:** KYC-attestation model the adapter consumes; screening callbacks; Travel Rule payload spec.
- **Legal / governance / regulatory:** Membership Agreement, Rulebook clauses (go-live covenant, NIP self-custody, service-level remedies, exit and step-in), competition-law protocol, finality and insolvency opinions, regulator MOUs.
- **Finance (funding and revenue model):** programme funding shares, catch-up formula, fee schedule; the inside/outside decision on bank-side integration cost.
- **Security & SRE:** validator hardening standard, HSM requirements, CNOC design, DR drill calendar, Sim Lab.
- **Rulebook pod:** admission criteria and dispute process as stated in 1.2, 5.3-5.4 and 6.5.

## Appendix C. How this memo resolves the blueprint's known issues

- **"No onboarding model"**: this memo (sections 1-8).
- **Phase 3 exit cannot be met inside the phase as dated**: propose exit measured over two quarters after first production go-live and expressed in quorum terms (5.2).
- **Bank of Canada observer assumed, not confirmed**: regulator track works with read-only, non-voting or voting variants; validator arithmetic shown (5.4) `[V1]`.
- **Legal finality asserted, basis unspecified**: listed as a gating dependency for every bank's Legal function `[V11]`.
- **No cost breakdown or funding model**: bank-side ROM costs and where they sit (3.7) and commercial terms structure (1.3); the inside/outside decision is put to the board.
- **Four vs five phases**: not an onboarding matter; recommend the title read "five-phase (0-4)".
- **ZK plus formal verification plus BFT schedule bet**: onboarding does not depend on the confidentiality layer performing; the adapter and certification suite are designed to be identical under the named fallback, so a fallback decision does not restart bank certification.
