# DepositX Network — Board Seat Memo: Chief Legal & Regulatory Officer

Date: 2026-09-25 · Source of truth: `source/blueprint-v0.9.md` (KPMG, 2 Sep 2026) · Status: DRAFT workplan for counsel to validate.

**This is not legal advice.** It is a regulatory and legal workplan drafted for external counsel (FMI/payments, Bank Act, insolvency, competition, privacy, securities, Quebec civil law) to validate. Every statutory or regulatory citation carries a confidence tag:

| Tag | Meaning |
|---|---|
| **[P]** | Read this session on an official source (OSFI, Bank of Canada, Justice Laws, Finance Canada). Section numbers came through a summarising tool, so counsel should still pin-cite. |
| **[S]** | Reported by law-firm or press sources found this session. Not checked against the primary text. |
| **[VC]** | From my own background knowledge, or not confirmable. **Verify with counsel** before anyone relies on it. |

Web access was available. Sources and gaps are in Appendix A. Read the "What changed in the last 15 days" box first.

---

## 0. Executive position (read this if nothing else)

### What changed in the last 15 days (the blueprint is stale on these)

1. **OSFI published a Statement on Tokenized and Other Digitally Represented Deposits on 10 Sep 2026 [P].**
   - It says the underlying technology does not determine legal nature, and tokenized deposits are not legally distinct from traditional deposits.
   - It points to B-13 (technology and cyber) and B-10 (third-party risk) [P].
   - It tells institutions to engage their OSFI lead supervisor before launching novel products [P].
   - It is silent on CDIC, capital, liquidity, consumer protection, and consortium or shared networks [P].
   - Press reports of a specific "Group 1a" capital treatment did **not** appear in the primary text I read. Treat the capital claim as unverified [S/VC].
2. **The Big Six banks announced a joint exploration of tokenized CAD deposits on a shared ledger on 22 Sep 2026 (Bloomberg, BNN Bloomberg, Globe and Mail) [S].**
   - It is described as "exploratory."
   - No entity, platform, timeline or governance was disclosed [S].
   - I cannot tell from the blueprint whether the "Canadian Tokenized Deposit Working Group" is the same group, a subset, or a competitor.
   - **This is the single largest strategic-legal fact on the table.** It changes the antitrust posture, the admission model and the scope of what we are asking regulators for. See Risk R1.
3. **Canada's Stablecoin Act is law (Bill C-15, Royal Assent 26 Mar 2026) [S].**
   - The Bank of Canada is the supervisor and keeps a registry [S].
   - Federally regulated financial institutions (FRFIs) are excluded "subject to regulations" [S].
   - Supporting regulations are expected to take 12-18 months, with the framework in force around 2027 [S].
   - **The perimeter is not yet closed for us** (see 5.4).
4. **Payments Canada's Real-Time Rail (RTR) by-law and rules were approved and come into force 24 Aug 2026, with launch targeted for Q4 2026 and phased access through 2027 [S].**
   - RTR is 24/7/365, irrevocable, ISO 20022, and settled in central bank money [S].
   - DepositX will be judged against RTR and Lynx in its first regulator meeting. "Non-goal: displace Lynx/RTR" needs a concrete interoperability position.

### Ten headline positions

1. **Invariant II ("finality is one thing") is not true today as a matter of Canadian law.**
   - Technical BFT finality does not by itself give legal finality. Only a rulebook, an insolvency-protection regime and (for the interbank leg) central-bank-money settlement can.
   - The strongest available mechanism is **designation of DepositX under the Payment Clearing and Settlement Act (PCSA)**, which makes settlement rules "valid and binding" despite insolvency laws and stops payments being reversed [P: PCSA s.8, summary].
   - Designation is discretionary (Governor of the Bank of Canada, with the Minister of Finance's agreement) [P: s.4]. It is therefore the schedule's gating item.
2. **Recommended path: a dual track.**
   - Contractual and rulebook finality plus formal Canadian legal opinions for the capped pilot.
   - A **PCSA designation dossier filed by Q3 2027**, with designation in force before any value cap is lifted or production goes live.
   - Payments Canada engaged as interoperability partner, not host (decision at 2.3).
3. **The blueprint dates are not executable.**
   - Phase 0 cannot exit in Q4 2026.
   - "Value cap lifted by supervisory non-objection" is not an instrument any regulator issues.
   - Wholesale production in H2 2028 is realistic only if designation lands early. My baseline is **H1 2029** for limited wholesale production (section 7).
4. **Operator entity: a federal not-for-profit, non-share-capital corporation (CNCA), cost-recovery, with an independent chair and a four-independent board.**
   - No profit distribution, no dominant owner, and a clean "utility" story for the Competition Bureau and the Bank of Canada.
   - It should also keep each bank's Bank Act "substantial investment" analysis simple (counsel to confirm) [VC].
5. **Antitrust is a design constraint, not a formality.**
   - The 2024 Competition Act amendments expanded s.90.1 and removed the efficiency defence for competitor-collaboration agreements [S].
   - The Bureau is actively pursuing bank-owned payments infrastructure access issues (the Interac matter) [S].
   - Adopt a written antitrust protocol before the next joint session. Seek a Bureau advisory opinion on the governance term sheet.
6. **Deposit-token characterisation: it is a deposit, recorded on the ledger.**
   - Drop the word "bearer."
   - Legal model: the ledger is the authoritative transfer register for a claim on a named bank. A cross-bank payment is a **novation** (debit A's liability, create B's liability), not the transfer of a bearer asset.
   - The token must carry the issuer's LEI and a deposit-insurance category code, so the network can support CDIC and provincial-insurer payout.
7. **CDIC has not spoken.** Neither OSFI's statement nor the CDIC material I found addresses tokenized-deposit eligibility or payout mechanics [P/S].
   - A written CDIC position is needed before any retail claim.
   - Provincially insured institutions (Desjardins/caisses, credit unions) are not CDIC members. The blueprint's "CDIC-insurable wherever the underlying deposit is" must be reworded [VC].
8. **The Stablecoin Act perimeter must be closed.**
   - The FRFI exclusion is "subject to regulations."
   - Provincially regulated deposit-takers are not FRFIs [S/VC].
   - The Operator is not an FRFI.
   - Get Finance Canada to confirm, in the regulations, that deposit tokens and shared bank ledgers are outside the Act.
9. **The interbank settlement anchor is undefined and legally constrained.**
   - Bank of Canada settlement-account access is limited to Payments Canada members meeting prudential-regulation, investment-grade, collateral and cyber tests [P].
   - The Operator will not qualify directly. Settlement runs through the issuers' own settlement accounts or a Bank of Canada-provided mechanism.
   - Between "debit A/credit B" and central-bank settlement there is real inter-issuer credit exposure. It needs prefunding or collateral plus a default waterfall.
10. **Onboarding a Big Six bank is a 9-12 month legal and third-party-risk process** (B-10 due diligence, B-13, E-21, privacy, compliance, treasury, board risk committee). It is the critical path for Phase 2. Start the Standard Bank Legal Pack now.

### Decisions I need from the board in the next 30 days (by 26 Oct 2026)

- **D1.** The DepositX and Big Six relationship: merge, become the neutral operator for the Big Six effort, interoperate, or compete. Sequencing: counsel review first, then a board decision, then outreach.
- **D2.** Approve the operator structure (CNCA not-for-profit) and instruct incorporation of an interim shell.
- **D3.** Approve the antitrust protocol and freeze all commercially sensitive discussion until it is adopted.
- **D4.** Approve the dual-track finality strategy and authorise external counsel for a PCSA designation pre-dossier and the insolvency and finality opinion.
- **D5.** Approve the "legal-realistic" schedule as the planning baseline (section 7).
- **D6.** Approve the marketing constraint in 0.1 below.

### 0.1 Marketing and claims constraint (effective immediately)

The blueprint's brand voice says "settles in under two seconds with legal finality." **Do not use that sentence externally until (a) a Canadian insolvency and finality opinion is in hand and (b) designation, or an explicit regulator position on the finality basis, exists.** Use "designed for legal finality; finality basis set out in the Rulebook" until then. Likewise, do not say "insured" or "CDIC-insurable" without the standard CDIC-compliant disclosure, and confirm with CDIC how its by-laws on signage and advertising apply [VC].

---

## 1. Regulatory perimeter map

### 1.1 Threshold observation: who supervises the Operator?

The blueprint says "direct supervisory oversight" of the Operator. **Nobody supervises the Operator by default.**

- OSFI regulates FRFIs. It reaches DepositX only indirectly, through each bank's B-10 third-party obligations and B-13/E-21.
- FINTRAC supervises reporting entities. The Operator may or may not be one (see FINTRAC row).
- The Bank of Canada route is **PCSA designation**, which brings the Operator under Bank of Canada oversight and the Risk Management Standards (PFMI-based) [P].
- So designation is not only the finality mechanism. **It is also how the "regulated operator" claim becomes true.** That doubles its importance and its schedule risk.

### 1.2 Perimeter table

| Regulator | What it decides about DepositX | What we need | Form of instrument | When |
|---|---|---|---|---|
| **OSFI** (FRFIs; B-10, B-13, E-21, E-23) | Whether each bank may participate, and on what conditions. It treats DepositX as a material third-party arrangement and a critical operation input for each bank. It does not authorise DepositX itself. B-10 has applied to arrangements since 1 May 2024 [S]. B-13 (technology and cyber) has applied since 2024 [VC]. E-21 (operational risk and resilience): full adherence expected by 1 Sep 2026, with scenario testing for critical operations by 1 Sep 2027 [S]. E-23 (model risk incl. AI/ML) takes effect 1 May 2027 [S]. | (1) Each bank's lead supervisor is engaged, and OSFI records no supervisory objection to that bank's participation, and to issuing tokens. (2) OSFI confirms how a shared ledger and validator role fits B-10 and concentration expectations. (3) OSFI states its view on capital and liquidity treatment of tokenized deposits (the 10 Sep statement is silent) [P]. (4) OSFI states its view on model risk for the compliance-engine and anomaly-detection models under E-23 [VC]. | Supervisory engagement via each bank's lead supervisor (the route OSFI's 10 Sep statement points to) [P]. Written guidance or an FAQ for capital and liquidity. Not a "no-action" instrument. | Bank-level engagement starts now. Written OSFI positions are needed before live money (Phase 2 gate G3). |
| **Bank of Canada** (PCSA, RPAA, Stablecoin Act; settlement accounts; research) | (a) Whether and how DepositX is designated under the PCSA (systemically important FMI vs prominent payment system) [P]. (b) Risk Management Standards, PFMI-based, and oversight intensity [P]. (c) The central-bank-money settlement mechanism. (d) Whether it participates as an observer, and on what statutory footing. (e) Stablecoin Act boundary. | (1) An early written view on designation category, process and timeline. (2) Position on the interbank settlement anchor: issuers' own Lynx/RTR settlement accounts, or a Samara-style wholesale central bank digital money [S]. (3) A defined observer role: read-only, non-voting, no consensus participation, documented as oversight access rather than a network role. (4) Confirmation that the Stablecoin Act does not apply. | Guidance and consultation, then designation (Governor decision with the Minister's agreement, published in the Canada Gazette) [P]. Settlement-account agreements are per-bank. | First joint meeting (Nov 2026). Designation dossier by Q3 2027. Designation decision is the gate for cap-lift and production. |
| **FINTRAC** (PCMLTFA) | (a) Whether deposit tokens are "funds" (EFT/wire rules) or "virtual currency" (Travel Rule, LVCTR). (b) Whether the Operator is a reporting entity. (c) Whether the confidentiality layer meets record-keeping and reporting duties. The virtual-currency Travel Rule (PCMLTFR s.124.1) has applied since 1 Jun 2021 [S]. 2026 PCMLTFA amendments came in via the Budget 2025 Implementation Act [S]. | (1) A written policy interpretation on classification. (2) Confirmation of the Travel Rule data set for token transfers. (3) Confirmation that supervisory read-node access satisfies record-access expectations. (4) Position on information sharing between banks through the compliance engine [VC]. | Written policy interpretation and compliance-program review. FINTRAC does not issue no-action letters, so ask for an interpretation and a supervisory meeting record [VC]. | Interpretation request in Nov 2026. Answer needed before Phase 2 (G5). |
| **CDIC** (and provincial insurers: AMF, provincial credit-union DICs) | Eligibility of tokenized deposits, the records the insurer needs, payout process, and advertising and signage rules. The CDIC Act definition of "deposit" is the balance of money received that the member institution is obliged to repay [P: Finance consultation paper]. Eligible deposits must be payable in Canada in CAD [S]. Neither CDIC nor OSFI has addressed tokenized-deposit records or payout [P/S]. | (1) Written confirmation of eligibility and category attribution. (2) The data and system standard a tokenized deposit must meet to be paid out on failure. (3) The disclosure and advertising rules for token wallets. (4) An operating protocol for issuer failure (freeze, snapshot, successor issuer). | Interpretive letter or guidance. By-law amendment if standards change [VC]. | Interpretation request Nov 2026. Answer required before retail (Phase 4) and, for the record-keeping and failure protocol, before Phase 2 (G6). |
| **Department of Finance** | Owns the policy framework. Minister agrees to PCSA designation [P: s.4]. Approves Payments Canada by-laws (as for RTR). Makes Stablecoin Act regulations. Approves certain Bank Act investments. Runs the deposit insurance review [P]. | (1) Regulations under the Stablecoin Act confirming deposit tokens issued by deposit-taking institutions, including provincially regulated ones, are outside the Act. (2) Confirmation that no statute needs amending for the chosen finality path, or a defined gap list. (3) Support for designation. (4) Bank Act substantial-investment approvals if required [VC]. | Policy consultation. Regulation. Ministerial agreement or approval. | Consultation Q4 2026 to Q1 2027. Stablecoin regulations are expected around 2027 [S], so this is time-sensitive. |
| **Competition Bureau** | Enforces s.45 (criminal conspiracy), s.90.1 (civil competitor and other agreements) and s.79 (abuse of dominance). The Bureau has said collaborations that prevent or lessen competition are approved only in exceptional circumstances [S]. Its enforcement guidelines are being revised (draft 31 Oct 2025) [S]. | (1) An advisory opinion on the governance term sheet, admission criteria and pricing principles. (2) Confirmation that pre-launch information exchange under the protocol is acceptable. (3) A view on whether the JV formation needs notification or review [VC]. | Advisory opinion (non-binding on the Tribunal) [VC]. No formal clearance route for a collaboration comparable to a merger ARC. | Antitrust protocol before the joint meeting. Advisory opinion request Q1 2027, once the term sheet is stable. |
| **Payments Canada** (Canadian Payments Act; Lynx, ACSS, RTR) | Not a regulator, but it makes rules and runs national systems (rules and by-laws approved by the Minister, as for RTR) [S]. Membership eligibility was expanded from June 2024 to include operators of PCSA-designated systems and RPAA-supervised PSPs [S]. Eligibility for Bank of Canada settlement accounts depends on membership [P]. | (1) A decision on relationship: partner (interoperability with Lynx and RTR) or host (see 2.3). (2) Interoperability standards. (3) Membership route for the Operator, if designated [S/VC]. | Bilateral agreement. By-law or rule amendments if hosting. | First session Q4 2026. Position by Q2 2027. |
| **OPC** (PIPEDA) and **CAI** (Quebec Law 25), plus Alberta and BC | Whether the data model and disclosures comply. They do not approve. They can investigate and order. PIPEDA remains the federal law. The replacement Bill C-36 (introduced 15 Jun 2026) is at second reading [S, low-quality sources]. Quebec Law 25 is fully in force [S]. | (1) An informal consultation on the privacy-by-architecture design (PII off-ledger, need-to-know disclosure, supervisory read-node). (2) A privacy impact assessment (PIA) per bank. Law 25 requires a PIA before certain transfers of personal information outside Quebec [VC]. | Informal consultation. Advisory. | Phase 1. |
| **Provincial securities regulators** (OSC lead; AMF, BCSC, ASC; CIRO for dealers) | Whether deposit tokens or DepositX's programmable templates trigger securities, derivatives or clearing-agency rules, for the Phase 3 tokenized-bond cash leg. Project Samara was approved by the OSC, AMF and CIRO [S]. | (1) Confirmation that deposit tokens are not securities. (2) Confirmation that providing only the cash leg of a securities DvP does not need clearing-agency recognition, if the securities leg settles on a separate recognised platform. (3) A per-template derivatives characterisation. | Exemptive relief, CSA regulatory sandbox, or staff no-action [VC]. | Phase 2 (relief in place before Phase 3 integration). |

### 1.3 Other authorities worth a line

- **FCAC** (Financial Consumer Agency of Canada): Phase 4 retail. See 5.6 [VC].
- **AMF Québec** as prudential and deposit-insurance authority for Desjardins and caisses [VC]. Needed if they are issuers.
- **Critical cyber legislation:** Bill C-8, the critical cyber systems bill, could designate clearing and settlement systems as vital. I could not confirm its current status. **Verify with counsel** [VC].
- **Sanctions** (SEMA, Criminal Code, UN Act): handled inside L4. Add Global Affairs and RCMP contact points to the protocol [VC].

### 1.4 Sequencing (the order matters)

1. **Now to 26 Oct:** internal alignment (D1-D6). Resolve the Big Six relationship. Adopt the antitrust protocol.
2. **Late Oct to mid-Nov:** bilateral pre-meetings in this order.
   - Bank of Canada first, because designation shapes everything.
   - Finance Canada.
   - Each bank's OSFI lead supervisor, coordinated so OSFI hears one story from all founding issuers.
   - FINTRAC.
3. **Week of 16 Nov 2026:** first joint meeting (ask list in section 8B).
4. **Q4 2026 to Q1 2027:** CDIC and Payments Canada sessions. File the FINTRAC and CDIC interpretation requests. Consult Finance on Stablecoin regulations.
5. **Q1 2027:** Bureau advisory opinion request. Privacy consultation.
6. **Q2 to Q3 2027:** designation pre-dossier, then filing. Securities relief applications.
7. **Q4 2027:** Phase 2 gate review (G1-G10). Written regulator positions collected.

Regulators rarely give joint written confirmations. Plan on separate letters and a tracked **Regulatory Issues Register** that the Operator owns and shares with all parties.

---

## 2. The legal-finality problem (Invariant II)

### 2.1 Restate the invariant so it can be tested

"Technical and legal settlement in the same instant" bundles four separate questions. Each needs its own legal answer.

| Layer | Question | What can give it |
|---|---|---|
| **F1 Irrevocability** | From what moment can neither the payer nor the network unwind the instruction? | Rulebook: defined point of entry and point of irrevocability. Consistent with PFMI Principle 8 [VC]. Contract binding all participants. |
| **F2 Insolvency protection** | If a participant, or the Operator, becomes insolvent, is the settled transfer safe from stay, reversal or clawback? | Statute. PCSA s.8 makes settlement rules valid and binding despite insolvency laws and stops payments being reversed, repaid or set aside [P summary]. Netting and financial-collateral protections in PCSA ss.13-14 [P summary]. Contract alone does not override insolvency statutes. |
| **F3 Discharge** | Does the payee's bank credit discharge the payer's obligation to the payee? | Account terms and the Rulebook. Under a novation model, B's credit is B's own liability to the payee, as in existing account-based payments. |
| **F4 Interbank settlement finality** | Is the inter-issuer obligation (A owes B) settled in central bank money, on a defined schedule, with a default waterfall? | Central bank settlement, prefunding or collateral, and PCSA-protected settlement rules. |

**BFT deterministic finality delivers only F1 in code.** The legal claim "same instant" is really "F1 is defined to coincide with the consensus decision, F2 is guaranteed by statute, F3 is guaranteed by contract, and F4 is completed under protected settlement rules." The Rulebook must say exactly that.

Three more points the blueprint glosses over:

- **Ledger finality cannot stop court orders, sanctions freezes or criminal seizures.** The Rulebook must recognise compensating transactions and legal holds rather than promise the impossible. It should never describe them as "reversals."
- **"Nothing debited until all three checkpoints pass; failure rejects the whole"** is fine for screening. But it means the Operator cannot offer any pending or exception state. Compliance escalations (for example, a sanctions hit that needs analyst review) must be handled by rejecting and re-submitting, not by holding.
- **"Par break = system-halting event"** is a legal choice as well as a technical one. A halt that is caused by one issuer's reconciliation failure and spreads to all issuers creates operator liability and systemic disruption. I recommend the halt be **issuer-scoped by default** (that issuer's token domain), with a network-wide halt only on a defined systemic trigger.

### 2.2 The options

| Option | Mechanism | Strength | Timing | Dependency | Verdict |
|---|---|---|---|---|---|
| **A. PCSA designation of DepositX** | Governor designates under s.4 with the Minister's agreement. The Operator comes under Bank of Canada oversight and the Risk Management Standards. Settlement rules get s.8 protection. Netting protections apply [P]. | **Highest.** Statutory override of insolvency law. Regulator-visible. Also delivers the "regulated operator" claim. | 12-24 months from a complete dossier (my planning range). Lynx was designated in 2021 after years of Bank of Canada involvement in its design [S]. | Bank of Canada and Finance discretion. Definitional fit of "clearing and settlement system" (participants, CAD, settlement via the Bank) [P summary; VC on details]. | **Destination.** |
| **B. Payments Canada route** (host DepositX within Payments Canada, or make it a Payments Canada system with statutory by-law and rules) | Rules made under the Canadian Payments Act and approved by the Minister, as for RTR [S]. PCSA designation would follow the same pattern. | High. Familiar to regulators. | Slow. Payments Canada is busy launching RTR through 2027 [S]. | Payments Canada capacity and appetite. Governance dilution: all members, not just issuers. | **Partner and interoperate. Do not make host the base case.** Revisit if the Bank of Canada signals it prefers this route. |
| **C. Contractual finality only** (Rulebook, multilateral agreement, legal opinions) | Contract, with the argument that netting and set-off are enforceable. | Medium for capped pilot. Weak at scale. Contract cannot override bank insolvency law (winding-up, CDIC resolution powers). A bank in resolution is subject to stay powers. Eligible financial contract protections cover specified contract types and may not cover payment settlement [VC]. | Immediate. | Quality of the opinions. Value caps sized to the residual risk. | **Bridge for Phases 1-2 only**, with caps and opinions. |
| **D. Statutory change** (new Act, or amendments to the PCSA, Canadian Payments Act or CDIC Act for tokenized-deposit systems) | Parliament. | Highest and broadest. | 2-4 years. | Political priority. | **Fallback only for identified gaps.** Ask Finance for a gap list rather than a new statute. |
| **E. Regulatory-instrument route** (Bank of Canada directive, Stablecoin Act regulation) | Not a fit: the Stablecoin Act concerns stablecoin issuers, not deposit-token settlement [S/VC]. | n/a | n/a | n/a | Reject. |

### 2.3 Recommendation

**Dual track, with Option A as the destination and Option C as the bridge.** Payments Canada is a partner (Option B interoperability), not the host.

- **Track 1, contractual bridge (Phases 1-2).**
  - Rulebook chapters 6-8 (transfer finality, interbank settlement, default) drafted as PCSA-ready settlement rules from day one.
  - Formal Canadian opinions on capacity, enforceability, finality and insolvency, netting, and the novation model.
  - Value caps sized to the exposure the opinions leave open.
- **Track 2, designation (Phases 1-3).**
  - Designation pre-dossier in Phase 1: system description, PFMI gap assessment, governance, settlement mechanism, default waterfall, operator financials.
  - Formal application in Q3 2027 to Q1 2028, after Rulebook v0.9 stabilises.
  - Ask the Bank of Canada which designation category it has in mind. Given the north-star of ≥95% of eligible wholesale interbank flow by end of Phase 3, expect systemically important treatment by then, with full PFMI observance (as for Lynx) [P/VC].
  - Aim for designation **before the value cap is lifted**, not before go-live. If the Bank of Canada will designate a pilot early, take that route: it removes the F2 gap during Phase 2.
- **Track 3, Payments Canada.**
  - Interoperability standards and a membership route for the Operator (Canadian Payments Act expansion to operators of designated systems, in force from June 2024) [S].
  - Note that Bank of Canada settlement-account eligibility also requires prudential regulation, investment-grade standing and collateral [P]. **The Operator will not qualify directly**, so settlement runs through issuers' own settlement accounts or a mechanism the Bank of Canada provides.
- **Track 4, Finance gap list.** A short statutory-gap memo (bank-insolvency and CDIC stay interaction, eligible-financial-contract scope, recognition of ledger entries as deposit records, Stablecoin Act regulations) so that legislative fixes, if any, ride existing vehicles.

### 2.4 The settlement-anchor design problem (legal side)

- The blueprint says central-bank money is "the settlement anchor between issuers." It does not say how.
- **Between a token transfer (debit A, credit B) and central-bank settlement, B holds a claim on A.** That is credit exposure. The blueprint has no mechanism for it.
- The legal options:
  1. **Prefunded pool.** Issuers pre-position central-bank money or Bank-of-Canada-eligible collateral against limits. Losses in A's default are covered by A's collateral first.
  2. **Deferred net settlement in Lynx or RTR,** with collateralised limits. This must be at least as frequent as the exposure the collateral supports. It also raises the question of whether Lynx and RTR settle continuously enough for 24/7 use. I could not verify Lynx operating hours [VC].
  3. **Wholesale central-bank digital money on the DepositX ledger** (the Project Samara model, where wholesale CAD was represented on the ledger by the Bank of Canada [S]). This is the cleanest for legal finality. It needs a Bank of Canada policy decision and probably legal authority analysis [VC].
- Recommendation: design for option 1 in Phase 2 (least dependent on the Bank of Canada) and open option 3 as a joint policy question.
- **Tokenized-bond cash leg:** PFMI Principle 9 favours central-bank money for settlement. A DvP settled in commercial deposit tokens needs the Bank of Canada's and securities regulators' acceptance and a short-cycle central-bank settlement of the interbank leg [VC].

### 2.5 Gating risk to the schedule

- **Gate:** no value cap lifted and no production go-live without (i) designation, or an explicit written Bank of Canada position that the pilot's finality basis is adequate, and (ii) the Canadian finality and insolvency opinion.
- **Slip risk:** each 3 months of delay in the Bank of Canada's decision to open a designation file moves Phase 3 by roughly 3 months. The critical path runs through the Bank of Canada and Finance, which are outside our control. That is why the first joint meeting must produce a named designation workplan.
- **Mitigations:** file the dossier early and incrementally, invite the Bank of Canada to co-design (as with Lynx), keep the Rulebook PCSA-shaped so it does not need rewriting, and size the pilot cap to what the opinion supports.

---

## 3. Operator entity and governance

### 3.1 Structure options

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| **Federal not-for-profit, non-share-capital (CNCA)** | No profit distribution. Cost-recovery pricing answers competition and public-interest concerns. Members are members, not shareholders. May simplify each bank's Bank Act investment analysis [VC]. Matches Payments Canada in spirit. | Capital must come as member contributions and loans. Banks want a return of capital. Some counterparties are unfamiliar with it. | **Recommended.** |
| For-profit CBCA with unanimous shareholder agreement (Interac and CDS-style) | Familiar. Equity can be raised. | Profit motive inside a bank-owned utility invites price scrutiny, and the Bureau is looking at exactly that pattern with Interac [S]. Shareholding triggers Bank Act substantial-investment analysis per bank [VC]. | Reject as base case. |
| Cooperative under the Canada Cooperatives Act | One member, one vote. | Patronage-return mechanics are awkward for a settlement utility. | Reject. |
| Payments Canada (host) or a Payments Canada subsidiary | Statutory footing. | Slow, diluted governance, capacity. See 2.2. | Partner, not host. |
| Statutory corporation | Strongest. | Needs legislation. | Not now. |

**Design of the CNCA entity:**

- Federal incorporation, head office in Toronto, with a Quebec presence and bilingual documents [VC].
- **Funding.** Founding Member Development Notes (member advances, subordinated and repayable from surplus). A cost-recovery fee model with a reserve for operating expenses (PFMI Principle 15 requires liquid net assets to cover general business risk, commonly at least six months of operating expenses) [VC].
- **Reserves and a Recovery and Wind-down Plan** approved by the Bank of Canada on designation.
- **Hard bans in the constitution:** no holding of client money, no deposit-taking, no issuance of tokens (Invariant III). The by-laws should restate them.
- The IP sits in the Operator (see 3.8).

### 3.2 Membership classes

- **Class A, Issuer Members:** deposit-taking institutions that issue tokens and run validators. Full votes.
- **Class B, Participant Members:** direct participants that do not issue (for example, wholesale participants). Voting limited to matters that affect them (fees, access, technical standards).
- **Class C, Access Members:** sponsored or indirect users and service providers. No vote. Rights under the Rulebook.
- **Observers:** Bank of Canada, OSFI, FINTRAC, CDIC, Finance Canada. No vote, no board seat, standing information rights. Observer status is by regulatory access, not membership. The Bank of Canada must not appear to be a consensus participant, because that compromises its independent oversight. I recommend the blueprint's "BoC observer node" be defined as a **read-only, non-voting supervisory node**.

### 3.3 Board and voting

**Board of 13.**

| Seats | Who | Notes |
|---|---|---|
| 1 | Independent Chair | Not employed by any member for the previous 3 years. Three-year term, renewable once. |
| 3 | Independent directors | Financial-market infrastructure and risk; technology and security; public interest and consumer. |
| 7 | Founding large-issuer seats | One per founding large issuer, up to 7 (Big Six plus one more if a seventh large issuer joins). If fewer join, the remaining seats go to smaller issuers. |
| 2 | Elected by other Class A members | Smaller issuers. Prevents the network being a large-bank club. |

**No member or affiliated group may hold more than one board seat or more than 20% of any weighted vote.**

**Vote tiers:**

| Tier | Matters | Threshold |
|---|---|---|
| **1 Constitutional** | The three invariants, par rule, finality mechanism, core admission criteria, amendment procedure, dissolution or merger, IP licence terms, fee methodology | 80% of Class A members by number **and** 75% of the board **and** the Chair's concurrence. A blocking minority of about 3 in 10 is intended: it protects the invariants. |
| **2 Material Rulebook changes** | New chapters, liability and loss-allocation changes, settlement design changes, annual budget | Two-thirds of the board (9 of 13), including at least one independent director, plus a majority of Class A members by number. |
| **3 Operational and technical standards** | Template additions, technical standards, certification updates | Technical Committee (independent chair). Comply-or-explain. Board notified. |
| **4 Emergency** | Security or resilience patches | CEO and Risk Committee may act immediately. The board ratifies within 30 days. Regulators are notified at once. |

Fees and budget follow usage-weighted input but pass by the Tier 2 vote, so large banks cannot set price alone and small banks cannot block funding.

**Committees:** Audit, Risk, Technology and Security, Governance and Nominations, Admission and Compliance, Regulatory Liaison.

### 3.4 Neutral chair and independent directors

- Nominated by a Nominations Committee of the independent directors (for the first chair: a search committee of three founding-bank general counsels plus one outside expert).
- Approved by 75% of Class A members.
- Regulators are informed and may comment. They do not appoint, because that compromises independence.
- Conflict rules: no bank employment or advisory within 3 years, no vendor relationship, annual conflict declarations.

### 3.5 Admission and exit

**Admission (objective, published, non-discriminatory):**

1. **Issuer eligibility:** a regulated deposit-taking institution (bank, trust and loan company, credit union central or federation, caisse) that is a member of CDIC or a provincial deposit insurer [VC].
2. **Prudential standing:** meets minimum capital and liquidity requirements and has no active supervisory intervention (attestation, plus evidence on request).
3. **Settlement capability:** access to central-bank settlement (own settlement account or a sponsor).
4. **Conformance:** passes the certification tier for its integration model.
5. **Compliance:** AML/ATF and sanctions programme attestation, FINTRAC registration where relevant.
6. **Financial contribution:** settlement collateral and the loss-allocation fund contribution.
7. **Insurance and security standards.**

**Tiers:** Tier 1 direct issuer with its own validator. Tier 2 issuer on a sponsored or hosted node (this is how smaller banks get in without a full build). Tier 3 indirect participants via a sponsor.

**Process rules:** decision within 90 days of a complete application, written reasons, appeal to an independent Admission Review Panel, no exclusivity, no requirement that a member give up any other network (multi-homing allowed). These rules are what the Bureau will test.

**Exit:**
- **Voluntary:** 12 months' notice (18 for a Tier 1 issuer with material volume), orderly redemption or migration of tokens, continuing obligations for settled items, cost-recovery exit fee only.
- **Suspension or termination triggers:** insolvency, regulator direction, loss of licence or deposit-insurance status, failed reconciliation, sanctions, uncured material breach. Objective triggers, due process, and an immediate-suspension power on regulator direction or a security event.
- **Step-in:** a failing member's node can be run by the Operator or a designated custodian-of-last-resort under the Resolution Playbook (5.3).

### 3.6 Deadlock resolution (escalation ladder)

1. 15-day cooling-off and working group.
2. 30-day mediation by the independent Chair.
3. **Independent expert determination** on technical and risk deadlocks (binding, expedited).
4. **Confidential arbitration** (Toronto seat, Ontario law; counsel to choose the institution) for constitutional or commercial deadlocks.
5. **Safety-first default** while unresolved: the more conservative risk position applies, and operations continue. No status-quo freeze that threatens continuity.
6. **Regulator override:** where the Operator is designated, Bank of Canada directives prevail over any Rulebook process [P/VC].

The Chair has a casting vote on operational matters only, never on Tier 1 or Tier 2.

### 3.7 Antitrust safeguards for competitor collaboration

Legal basis: s.45 (agreements among competitors to fix prices, allocate markets or restrict output; ancillary-restraints defence) and s.90.1 (civil review of agreements likely to prevent or lessen competition; since 15 Dec 2024 it reaches non-competitor agreements and the efficiencies defence was removed; penalties up to the greater of C$10 million, or three times the benefit, or 3% of worldwide gross revenues) [S]. Consult counsel on whether PCSA designation gives any regulated-conduct defence. Do not assume it does [VC].

**Antitrust Protocol (adopt before the joint meeting):**

- Counsel-attended meetings. Written agendas. Minutes reviewed by counsel.
- **Banned topics:** any bank's pricing, interest rates, fees to customers, customer lists, pipeline, strategy for competing products (including stablecoins, RTR, or e-Transfer), wages or hiring.
- **Clean team** for sensitive data (volumes, costs). Aggregated and anonymised outputs only.
- Each issuer prices its own customer products independently. The Operator sets only cost-based network fees.
- **No exclusivity, no most-favoured-nation clauses, no restrictions on multi-homing.** Members may use Lynx, RTR, other networks or issue anything else.
- Open, objective, published admission criteria. Non-discriminatory access. This is what the Bureau's Interac matter shows it cares about [S].
- Standard-setting is procedure-based, open to all members.
- Annual competition-law training and audit. A named Competition Compliance Officer at the Operator.
- The Bureau engaged early through an advisory opinion request on the governance term sheet.

### 3.8 IP and open-source licensing model

- **Ownership:** the Operator owns the Rulebook, the trademark and the certification mark. It holds the reference implementation under licence-back or assignment from contributors.
- **Contributions:** Contributor Licence Agreements with a patent grant, signed by every bank, vendor and individual contributor.
- **Code:** **Apache-2.0** for the reference ledger software, SDKs and audited par and settlement contracts. It has an express patent grant and is bank-friendly. **No copyleft (GPL/AGPL)** in anything a bank integrates. Publish an SBOM and run licence scanning. Check that ZK libraries have no restrictive or source-available licences (for example BSL) [VC].
- **Specifications and Rulebook:** published under a permissive documentation licence (for example CC BY) with a royalty-free patent commitment for essential claims (W3C-style) [VC].
- **Members' mutual patent licence:** royalty-free for essential claims, surviving exit for continued use during transition.
- **Escrow:** source-code and build-environment escrow with a Canadian agent, released on Operator insolvency or step-in. Supports the B-10 exit expectation.
- **Vendor IP:** licensed to the Operator with a right to sublicense to members and step-in rights.
- **Trademark:** the "DepositX" name and par mark controlled by the Operator under a trademark policy. Certification mark ("DepositX Certified") licensed on conformance.
- **Data:** each member owns its data. The Operator gets a limited operating licence and may keep anonymised aggregate metrics.

### 3.9 Liability allocation (operator, issuers, vendors)

| Party | Liable for | Cap and treatment |
|---|---|---|
| **Issuer** | Its own token contract reconciliation, its node and keys, its customer relationship, its own default. Always fully liable to its depositors: the Rulebook must not let it limit liability to depositors. | Indemnifies the Operator and other members for losses from its breach, node compromise or misreporting. |
| **Operator** | Platform operation, rules administration, change management, security of its own systems. | Direct losses caused by Operator breach capped at the greater of a fixed sum and a multiple of annual fees, backed by an insurance tower (counsel and broker to size). **Uncapped for fraud, wilful misconduct, confidentiality breach and IP infringement.** Consequential loss waiver with those carve-outs. |
| **Vendors** | Their components. | Direct contract with the Operator, flow-down of Rulebook duties, audit and regulator access, IP indemnity uncapped, data-breach liability at super-cap, and step-in. Tri-party terms for critical vendors so members can enforce directly. |
| **Network (mutualised)** | A systemic loss that no single party caused or can fund. | **Loss-allocation waterfall:** (1) the responsible party; (2) that party's posted collateral; (3) Operator reserves and insurance; (4) Network Reserve Fund contributed by issuers; (5) capped assessment on issuers pro rata. Waterfall drafted as PCSA default rules. |

---

## 4. Rulebook table of contents

### 4.1 Chapters

| # | Chapter | One-line content |
|---|---|---|
| 1 | Purpose, invariants, interpretation | The three invariants restated as testable rules, definitions, order of precedence (statute, regulator directive, Rulebook, schedules). |
| 2 | Governance and amendment | Board, committees, vote tiers, emergency changes, regulator observer rights, conflicts. |
| 3 | Membership and admission | Classes and tiers, criteria, process, appeals, suspension, exit, step-in. |
| 4 | Token standard and legal nature | Deposit-claim model, issuer identification (LEI), insurance category code, ledger as authoritative transfer register, relationship to the issuer's core books. |
| 5 | Issuance, redemption and reconciliation | Par rule, 24/7 mint and redeem, continuous supply-to-liability reconciliation, exception handling, breach consequences. |
| 6 | Transfer, settlement and finality | Point of entry, irrevocability, finality, novation model, legal holds and compensating transactions (never "reversals"). PCSA-shaped settlement rules. |
| 7 | Interbank settlement and liquidity | Central-bank-money anchor, prefunding or collateral, limits, netting, the liquidity-saving mechanism. |
| 8 | Default, recovery and resolution | Issuer distress protocol, CDIC and OSFI interface, successor-issuer substitution, loss-allocation waterfall, Operator wind-down. |
| 9 | Risk management | PFMI mapping, limits, stress testing, model risk. |
| 10 | Compliance | AML/ATF, sanctions screening, Travel Rule data, reporting hooks, information sharing. |
| 11 | Data, privacy and supervisory access | PII off-ledger, need-to-know disclosure, read-node scope and logging, data residency, breach notice. |
| 12 | Resilience, security and change | Availability targets, RTO/RPO, key ceremonies, incident notification, change management, DR testing. |
| 13 | Certification and conformance | Integration tiers, test suites, recertification, evidence. |
| 14 | Programmability and template library | Governance of templates, legal review per template (securities or derivatives characterisation), retirement. |
| 15 | Third-party risk, outsourcing and assurance | B-10 flow-downs, audit rights, SOC reports, sub-contracting, concentration. |
| 16 | Fees and cost recovery | Cost-based fees, budget process, capital contributions, transparency. |
| 17 | Liability, indemnity and insurance | The allocation in 3.9, caps, carve-outs, insurance. |
| 18 | Disputes and error handling | Exception process, member-to-member disputes, expert determination, arbitration. |
| 19 | Retail and consumer provisions | **Reserved for Phase 4.** Consumer protections, dispute and refund alignment, disclosure, CDIC signage. |
| 20 | Interoperability and cross-border | Lynx and RTR interfaces, PvP corridors, foreign law and recognition. |
| 21 | Intellectual property and licensing | Section 3.8. |
| 22 | Competition-law protocol and conflicts | Section 3.7 as binding rules. |
| 23 | Governing law, language, notices | Ontario law, French version, notices, severability. |
| Sch. | Schedules | Token standard; ISO 20022 message specs; SLAs; certification; fee schedule; forms; regulator contact protocol. |

### 4.2 Drafting sequence tied to phases

| Version | Phase | Content | Legal status |
|---|---|---|---|
| **v0.1 "Constitution"** (Dec 2026 to Feb 2027) | Phase 0 | Ch. 1-3, 22, plus principles for 4-8 and 21. | Non-binding heads of terms, except confidentiality, antitrust protocol and cost sharing. |
| **v0.5 "Sandbox Rules"** (Q1 to Q2 2027) | Phase 1 | Adds ch. 4, 5, 11-14 (test scope), 23. Rules for test participants. | Binding only for testing, NDA and IP. No money at risk. |
| **v0.9 "Pilot"** (Q3 to Q4 2027) | Phase 2 entry | Full text of ch. 1-18 and 21-23, in PCSA-shaped settlement-rule form. Submitted to the Bank of Canada as draft settlement rules. | **Binding.** Executed by pilot issuers. Backed by opinions. |
| **v1.0 "Production"** (H1 2029 baseline) | Phase 3 | v0.9 amended after pilot lessons and regulator feedback. Adds netting (ch. 7), tokenized-bond DvP templates, PFMI observance mapping, full fee schedule. Designation-ready. | Binding and, on designation, statutorily protected. |
| **v2.0 "Retail and cross-border"** (2030+) | Phase 4 | Ch. 19 and 20 completed. | Binding. |

Each version goes through counsel drafting, founding-bank counsel group review, regulator pre-read, and an independent plain-language read.

---

## 5. Deposit-token legal characterisation

### 5.1 Deposit, security or payment instrument

- **Deposit.** A deposit is a balance of money received by a member institution that it is obliged to repay [P: Finance consultation paper]. A tokenized deposit is that same claim, recorded on a ledger. OSFI's 10 Sep 2026 statement supports this: technology does not determine legal nature [P]. **Conclusion: a deposit.**
- **Security.** Bank deposits are generally outside the securities regime, and prospectus exemptions exist for evidence of deposit [VC: verify NI 45-106 and provincial exemptions]. Risks arise if a token gains investment features (yield differentials between issuers, free transferability outside the bank relationship, secondary markets). **Keep tokens non-transferable outside the network, with no yield differential.** Review each programmable template for derivatives characterisation. The CSA has guidance on tokens (for example Staff Notice 46-308) [S].
- **Payment instrument.** Deposit tokens are a means of payment, but banks are not the payment service providers regulated under the Retail Payment Activities Act [VC: confirm the exclusion]. The Operator is a settlement infrastructure, probably outside the RPAA if designated under the PCSA [VC]. **Watch item:** March 2026 amendments add the transmission or maintenance of an end user's encrypted or tokenized payment instrument or private key to the RPAA "payment function" list, pending an order in council [S]. Wallet-SDK and key-management vendors may be caught.
- **Not a negotiable instrument.** Drop "bearer-recorded claim." It implies negotiability and holder-in-due-course concepts and unhosted wallets, which conflict with L4/L5 (bank-hosted wallets, KYC).

### 5.2 Legal model: account-based, with novation

- A customer holds a claim on **its own bank** (the named issuer). The ledger is the authoritative transfer register for that claim.
- A cross-bank payment **extinguishes A's liability to the payer and creates B's liability to the payee.** B's credit is B's own promise. This avoids proprietary-tracing and bona-fide-purchaser questions and matches existing payment law.
- **Model M1** (recommended for Phases 2-3): each customer holds only its own bank's tokens.
- **Model M2** (later gate): customers hold other banks' tokens. This creates claims on a bank that the holder does not bank with, complicates CDIC record-keeping and failure handling, and should wait until CDIC has confirmed the record standard.
- **Two books problem.** The issuer's core banking and general ledger remain the legal liability record. The ledger is the authoritative transfer register. The Rulebook must say which prevails in a discrepancy (proposal: the ledger prevails for entitlement between customers after finality; the issuer must reconcile to the core within a fixed time; CDIC payout uses the issuer's core after a snapshot at the freeze instant).

### 5.3 How the token records the debtor bank

Minimum on-ledger fields per token contract and account:

- Issuer **LEI** (immutable except by the resolution procedure below).
- Currency (CAD only).
- **Deposit-insurance category code** and insurer (CDIC, AMF, provincial DIC, none).
- Account-holder reference (a pointer or attestation to off-ledger KYC, no PII on ledger).
- Product flags (eligible for insurance or not, for example term over 5 years, foreign currency) [VC].

**Successor-issuer substitution:** a governance-controlled, multi-party-authorised function that re-points the token contract to a successor or bridge institution on the direction of the resolution authority. The Rulebook and deposit agreements must permit it in advance.

### 5.4 Stablecoin Act boundary

- The Act defines a stablecoin as a digital asset intended to maintain a stable value relative to one fiat currency [S]. A literal reading could catch a par-pegged deposit token.
- FRFIs are excluded **"subject to regulations"** [S]. So the protection depends on regulations that do not yet exist.
- **Provincially regulated institutions (Desjardins and caisses, provincial credit unions) are not FRFIs** [S/VC]. Their tokens may need express exclusion.
- The Operator is not an FRFI. It does not issue, but counsel must confirm it is not a "stablecoin issuer" or facilitator.
- Do not rely on a "closed-loop" exclusion [S]. A shared multi-bank network is unlikely to qualify.
- **Ask Finance and the Bank of Canada to confirm, in the regulations, exclusion of deposit tokens issued by deposit-taking institutions of any regulator, and of the Operator.**

### 5.5 CDIC treatment and insolvency

- **Coverage.** Eligible deposits are payable in Canada in CAD, insured up to C$100,000 per category per member institution [S]. CDIC's own consultation paper excludes cryptocurrencies from "deposit" [P] and does not address tokenized deposits. **Written CDIC confirmation is required.**
- **Wholesale reality.** Phase 2-3 balances are mostly uninsured (above the limit). Their real protection is the issuer's credit and OSFI supervision. Disclosures to participants must say so.
- **On issuer failure (proposed protocol; CDIC and OSFI to agree):**
  1. **Freeze** the failing issuer's token domain on the direction of OSFI or CDIC. The Rulebook must bind the network to honour statutory stays and directions. The halt is issuer-scoped.
  2. **Snapshot** the ledger at the freeze instant and reconcile to the issuer's core.
  3. **Who is paid:** token holders are depositors. CDIC pays insured amounts per category from the issuer's records, using the ledger snapshot and the KYC mapping the bank holds. Uninsured balances are creditor claims (or are transferred to a bridge institution or acquirer, or, for a designated systemically important bank, are handled under the bail-in regime, in which deposits are generally not bail-inable [VC]).
  4. **Interbank exposures** already settled and final under the settlement rules stay final (PCSA). Unsettled net positions are covered first from the failed issuer's collateral, then the waterfall.
  5. **Tokens continue** if a successor issuer is substituted. Otherwise they are redeemed or converted at the resolution authority's direction.
- **Deposit preference:** I understand Canada has no general depositor preference and deposits rank with other senior unsecured claims in a bank liquidation [VC]. Counsel to confirm.
- **Operator insolvency:** the Operator holds no client money. Continuity depends on: ledger state replicated at all validators, a licence to operate the software, the source-code escrow, and step-in rights. Confirm these work under the Bank Act, Winding-up and Restructuring Act, BIA and CCAA [VC].

### 5.6 Consumer-protection implications for retail Phase 4

- **Regulators:** FCAC and the Bank Act financial consumer protection framework (disclosure, complaints, unauthorised-use rules, plain language), the Quebec Consumer Protection Act and Charter of the French Language, provincial consumer statutes, accessibility law [VC].
- **Finality versus recourse.** A customer must still be able to get help with fraud, error and unauthorised transactions even though settlement is irrevocable. The Rulebook must separate **network finality** (interbank, irrevocable) from **customer recourse** (the issuer's obligation to its customer, funded by the issuer and recoverable through compensating transactions with counterparty consent). Align with RTR Rules on fraud and error liability [VC].
- **Custodial wallets only.** Bank-hosted wallets with key recovery. No unhosted wallets in scope.
- **Disclosure and advertising.** CDIC signage and advertising rules, and the standard "not a stablecoin, a claim on [Bank]" statement. Confirm the by-law route with CDIC [VC].
- **Contract changes.** Amend each bank's deposit agreement and privacy notice for tokenization (change-of-terms notice periods under the Bank Act [VC]). French versions.
- **Fraud and scams.** Decide the reimbursement stance before launch. Irrevocable instant payments are a proven scam channel.
- **Complaint handling and ADR:** through the existing external complaints body.
- **Gate:** no retail launch until CDIC's written position, FCAC engagement completed, and the consumer chapter (ch. 19) approved.

---

## 6. Big-bank onboarding legal stack

### 6.1 The contract set

| # | Document | Parties | Purpose and key terms |
|---|---|---|---|
| 1 | **Founding Members Cooperation Agreement** (Phase 0) | Founding banks | Pre-incorporation. Antitrust protocol, cost sharing, confidentiality, no exclusivity, IP contribution terms, non-binding on future participation. |
| 2 | **Operator by-laws and Membership Agreement** | Operator, each member | Membership class, rights, fees, and accession to the Rulebook. |
| 3 | **Participation Agreement and Rulebook adherence** | Operator, each member | Binds the member to the Rulebook including amendments under the vote tiers, with a right to object and exit on Tier 1 changes. |
| 4 | **Settlement and Collateral Agreement** | Operator, members (and Bank of Canada arrangements per bank) | Prefunding or collateral, limits, default waterfall. Each bank's own Bank of Canada settlement-account agreement is separate. |
| 5 | **Service Level Agreement** | Operator, each member | Contractual availability (start at 99.99%, ramp to the 99.999% design target once measured), RTO/RPO, incident notice fast enough (2-4 hours) for the bank to meet OSFI's incident reporting expectations [VC], service credits, no unlimited maintenance windows. Reconcile with each bank's E-21 impact tolerances. |
| 6 | **Data Processing and Confidentiality Agreement** | Operator, each member | Banks are controllers or organisations accountable under PIPEDA and Law 25. The Operator is a service provider. Canadian residency including DR, sub-processor approvals, breach notification, PII off-ledger commitment, supervisory read-node disclosures. |
| 7 | **Third-Party Risk Schedule (B-10 conformity annex)** | Operator, each member | See 6.2. |
| 8 | **Audit and assurance schedule** | Operator, each member, regulators | Annual SOC 1/2 Type II reports, independent PFMI assessment, pooled member audit (one collective audit a year plus for-cause audits), direct regulator access. |
| 9 | **Liability and insurance schedule** | Operator, each member | Section 3.9 caps, carve-outs, insurance evidence. |
| 10 | **IP licence and Contributor Licence Agreement** | Operator, members, contributors | Section 3.8. |
| 11 | **Exit, step-in and transition schedule** | Operator, each member | Transition assistance, escrow release triggers, member step-in rights to Operator technology and data, Operator failure playbook. |
| 12 | **Critical vendor tri-party agreements** | Operator, vendor, members | Direct enforceability by members, flow-down, audit access, step-in. |
| 13 | **Node hosting agreement** (Tier 2) | Sponsor or host, issuer | Hosted node terms, key custody boundaries, liability. |
| 14 | **Customer terms addendum** | Each issuer, its customers | Deposit agreement changes: token as ledger representation, ledger as transfer register, consent to disclosures, French version. Required before live use. |
| 15 | **Regulatory undertakings and access protocol** | Operator, members, regulators | Standing supervisory read-node access, scope, logging, notification duties. |
| 16 | **Legal opinions** | Canadian counsel | Capacity and authority, enforceability, finality and insolvency, netting, novation model, Quebec civil law. |

### 6.2 B-10 conformity (what the third-party schedule must contain)

B-10 (in force for arrangements from 1 May 2024) [S] expects, among other things, the following from a material third party. The clauses below are my working summary. Map each to the B-10 text with counsel [VC].

- Risk-based due diligence and criticality assessment, with the Operator supplying evidence.
- Defined scope and service levels, and sub-contracting limits with prior notice and flow-down.
- Security controls aligned to B-13, and incident notification.
- Data location and protection.
- Business continuity, DR and exit.
- **Audit and access rights for the bank and for OSFI**, including on-site.
- Regulatory cooperation, insurance and indemnities.
- Concentration-risk information.
- Termination and transition support, with step-in.

The Operator should hand each bank a **pre-completed B-10 evidence pack** (control matrix, SOC reports, penetration-test summaries, BCP/DR results, sub-contractor list, financials) to compress the bank's due diligence.

### 6.3 Timeline for a bank's legal review (planning estimates, 9-12 months for a Big Six bank, 6-9 months for a bank using the standard kit)

| Weeks | Workstream | Output |
|---|---|---|
| 0-4 | Executive sponsor, intake, scoping, conflicts, antitrust briefing | Legal and risk review plan |
| 2-10 | Rulebook legal review (v0.9), membership and participation terms | Issues list, redlines |
| 4-16 | Third-party risk (B-10 due diligence, criticality, concentration), InfoSec (B-13), resilience (E-21 mapping), model risk (E-23) | Risk assessment and approvals |
| 6-18 | Privacy PIA (PIPEDA and Law 25), compliance (FINTRAC, sanctions), Quebec and French-language review | PIA, compliance sign-off |
| 8-20 | Finance, tax, accounting and treasury: liability recognition, capital and liquidity, ALM, settlement collateral, funding | Capital and treasury memo |
| 12-28 | Negotiation of the contract set (items 2-15 above) | Agreed forms |
| 16-30 | OSFI lead supervisor engagement, product and new-activity governance | Recorded supervisory position |
| 24-40 | Board and Board Risk Committee (usually two cycles), final internal approvals | Authority to sign |
| 36-48 | Signing, certification, go-live readiness | Executed agreements |

**Ways to compress:** the Standard Bank Legal Pack, a small named founding-bank counsel group with delegated authority (one lawyer per bank), a common issues list, pre-agreed non-negotiables (the invariants, finality rules, audit access, data residency), and a single set of regulator positions everyone can cite.

---

## 7. Phased legal and regulatory plan (Phases 0-4), reconciled to the blueprint

### 7.1 What is unrealistic in the blueprint

| Blueprint item | Problem | Recommendation |
|---|---|---|
| **Phase 0 in Q4 2026 (about 14 weeks left)** | Incorporation is quick. But a neutral chair search, bank sign-off, antitrust protocol, Founding Members Cooperation Agreement, ratification of architecture by **all** founding issuers, and a first regulator meeting cannot all close by 31 Dec. The Big Six announcement (22 Sep) also forces a scope decision. | Split Phase 0. **0a (Q4 2026):** interim shell, antitrust protocol, D1-D6, first joint meeting, Rulebook v0.1 outline. **0b (Q1 to Q2 2027):** chair, permanent board, v0.1 ratified, Founding Members Cooperation Agreement signed. |
| **"Regulators confirm consultation pathway"** | Regulators will agree a contact protocol, not "confirm a pathway" in a formal sense. Achievable by Q1 2027 as a letter or record of meeting. | Redefine the exit test as a written engagement protocol acknowledged by each regulator. |
| **"Value cap lifted by supervisory non-objection"** | No such instrument exists. The real gates are designation (or explicit Bank of Canada position), each bank's OSFI lead-supervisor engagement, and the finality opinion. | Replace with the gate set G1-G10 below. |
| **Phase 2 live issuance in H2 2027** | Requires all G-gates, including a 9-12 month Big Six review cycle. | Start live capped value **no earlier than Q1 2028.** |
| **Phase 3 production H2 2028** | Designation is discretionary and needs an operating record. 12-24 months from complete dossier. | Baseline **H1 2029** for limited wholesale production with designation in force. Broad founding-issuer production H2 2029. |
| **Phase 3 exit: 99.999% over two quarters inside H2 2028** | Already flagged in the blueprint's known issues. Not achievable in the window. | Exit test: 99.99% over a rolling 90 days in pilot. 99.999% is the design and measured target from go-live. The two-quarter test becomes a Phase 3b test, with the independent PFMI rating. |
| **"Bank of Canada observer node" assumed** | Not confirmed. Also a conflict with independent oversight if it looks like a participant. | Define as read-only, non-voting supervisory node. Make it a joint-meeting ask. |
| **Phase 4 retail 2029+** | Retail needs CDIC, FCAC, consumer chapter and Finance framework. | 2030+. |

### 7.2 Baseline schedule (legal-realistic)

| Phase | Blueprint | Legal-realistic baseline | Note |
|---|---|---|---|
| 0 | Q4 2026 | 0a Oct to Dec 2026; 0b Q1 to Q2 2027 | Technical work continues. |
| 1 | H1 2027 | Q2 to Q4 2027 | Testnet has no money at risk. It needs only Sandbox Rules v0.5, NDA, IP terms and the antitrust protocol. |
| 2 | H2 2027 to H1 2028 | Live capped value Q1 2028 to Q1 2029 | Gates G1-G10 met by Dec 2027. Designation dossier filed Q3 2027 to Q1 2028. |
| 3 | H2 2028 | Limited wholesale production H1 2029; all founding issuers H2 2029 | Designation in force is the precondition. |
| 4 | 2029+ | 2030+ | Retail gated by CDIC, FCAC, Finance. |

**Net slip: roughly 6 to 12 months against the blueprint.** Levers that could recover 3 to 6 months: Bank of Canada and Finance co-design from the start (Lynx pattern), early designation of the pilot, the Standard Bank Legal Pack, and running the G-gates in parallel rather than in sequence. Do not promise the blueprint dates externally.

### 7.3 Gates to live money (Phase 2 entry)

| Gate | Requirement |
|---|---|
| G1 | Rulebook v0.9 executed as binding by at least three pilot issuers, with membership agreements. |
| G2 | Canadian legal opinions delivered: capacity, enforceability, finality and insolvency, netting, novation model, Quebec. |
| G3 | Each pilot issuer's OSFI lead-supervisor engagement completed and no objection recorded (bank-level). |
| G4 | Bank of Canada written position on oversight and the settlement anchor for the pilot (or designation). |
| G5 | FINTRAC policy interpretation received. |
| G6 | CDIC letter on eligibility and failure-record protocol. |
| G7 | Privacy: PIAs completed, Law 25 review completed. |
| G8 | Competition Bureau advisory opinion received or a documented counsel decision. |
| G9 | Insurance tower bound. |
| G10 | Each bank's B-10 pack approved by its board risk committee. Stablecoin Act regulation position confirmed. |

### 7.4 Phase-by-phase plan

**Phase 0 (0a Oct to Dec 2026, 0b Q1 to Q2 2027)**
- *Deliverables:* the Big Six relationship decision; antitrust protocol; interim CNCA shell, then permanent board and chair; Founding Members Cooperation Agreement; Rulebook v0.1; perimeter paper and Finality Options Paper (this memo's 1 and 2 in publishable form); Regulatory Issues Register; first joint meeting held; bilateral meetings held; FINTRAC and CDIC interpretation requests filed.
- *Staffing:* 6-8 FTE equivalent, including secondments. General Counsel (FMI regulatory background), Head of Regulatory Affairs, Rulebook lead, FMI and payments counsel, competition counsel (external, in-house liaison), Bank Act and insolvency counsel (external), regulatory project manager. Legal Steering Group with one general-counsel delegate per founding bank. Neutral Operator counsel that is not any founding bank's regular firm, plus Quebec civil-law counsel.
- *Indicative external legal spend:* C$2-3M (my planning estimate, not sourced).
- *Exit tests:* (1) Operator incorporated. Interim board at least one-third independent. Chair appointed and conflict-checked (by end of 0b). (2) Antitrust protocol adopted and 100% of participants trained. (3) Founding Members Cooperation Agreement signed by all founding issuers. (4) Rulebook v0.1 approved. (5) Joint meeting held and each regulator has acknowledged a written engagement protocol (named contacts and cadence). (6) Finality Options Paper delivered to the Bank of Canada and Finance with written feedback logged. (7) Big Six relationship resolved and documented. (8) Bureau advisory opinion request filed, or documented counsel decision not to file. (9) Legal risk register with owners.

**Phase 1 (Q2 to Q4 2027)**
- *Deliverables:* Rulebook v0.5; Sandbox Rules and pilot participation agreements (two banks plus the Bank of Canada observer terms); PIAs; IP and Contributor Licence Agreement; Standard Bank Legal Pack v1 (B-10 evidence pack, term sheets); designation pre-dossier; draft finality and insolvency opinion; securities regulator engagement; FINTRAC and CDIC responses tracked.
- *Staffing:* 10-12 FTE. Add privacy counsel, securities counsel, legal operations and a bilingual drafter.
- *Indicative external legal spend:* C$3-4M.
- *Exit tests:* (1) Sandbox Rules executed by pilot participants. (2) Pre-dossier accepted by the Bank of Canada for review, with a written workplan and timeline. (3) PFMI gap assessment mapped to Rulebook chapters. (4) Standard Bank Legal Pack reviewed by at least two banks' third-party-risk teams. (5) Draft opinion structure agreed with counsel. (6) Bureau feedback received (or documented). (7) Written positions requested from FINTRAC and CDIC, with response dates set.

**Phase 2 (Q1 2028 to Q1 2029)**
- *Deliverables:* Rulebook v0.9 binding; membership and participation agreements executed; opinions delivered; all G1-G10 gates met before live money; formal designation application (Q3 2027 to Q1 2028); securities relief in place before Phase 3; legal-hold and compensating-transaction procedures exercised in tests; issuer-failure protocol tabletop with OSFI and CDIC; supervisory read-node access tested; regulatory reporting cadence started; Operator's compliance officer appointed.
- *Staffing:* 16-20 FTE. Add regulatory reporting, contracts and onboarding counsel, a Chief Compliance Officer, and a competition compliance officer.
- *Indicative external legal spend:* C$6-8M.
- *Exit tests:* (1) Designation decision issued, or an explicit written Bank of Canada position that the pilot's finality basis is adequate for the next cap step. (2) Zero unresolved critical regulator findings. (3) One live-money issuer-failure tabletop completed with OSFI and CDIC participation. (4) A supervisory position query answered within 60 seconds, witnessed by a regulator. (5) Legal opinions refreshed for the production design. (6) All pilot banks' board risk committees have approved production participation.

**Phase 3 (H1 2029 limited, H2 2029 full)**
- *Deliverables:* designation in force; Rulebook v1.0; all founding issuers onboarded via the Standard Bank Legal Pack; Operator Recovery and Wind-down Plan approved by the Bank of Canada; PFMI observance assessment; tokenized-bond cash-leg relief and templates; fee schedule; steady-state legal desk for onboarding and rule changes; SOC 2 Type II (per blueprint).
- *Staffing:* 20-25 FTE.
- *Indicative external legal spend:* C$8-10M (higher during onboarding).
- *Exit tests:* (1) Designation and Risk Management Standards compliance confirmed by the Bank of Canada. (2) Independent PFMI observance rating (per blueprint). (3) 99.99% measured over rolling 90 days, ramping to the 99.999% target, with the two-quarter measurement as a Phase 3b test. (4) Zero par breaks and zero client-money loss events. (5) All founding issuers signed and live.

**Phase 4 (2030+)**
- *Deliverables:* Rulebook v2.0 (retail chapter 19, cross-border chapter 20); CDIC written position and any by-law changes; FCAC engagement; consumer contract set; cross-border legal frameworks (foreign settlement-finality recognition, sanctions, FX, peer network agreements); Real-Time Rail interoperability agreements.
- *Staffing:* 25-30 FTE.
- *Exit tests:* (1) Retail launch only after CDIC's written position and FCAC engagement. (2) At least one cross-border corridor legally documented and supervisor-reviewed. (3) Unchanged deposit-insurance treatment confirmed in writing (blueprint exit test).

Spend and staffing figures above are **planning assumptions I have not benchmarked**. The board should ask the neutral counsel and the founding banks' general counsels to calibrate them in November.

---

## 8. Risks and asks

### 8A. Top 10 legal and regulatory risks

| # | Risk | Rating | Mitigation | Owner |
|---|---|---|---|---|
| **R1** | **The Big Six announced a joint tokenized-deposit effort on 22 Sep 2026** [S]. DepositX could be duplicated, sidelined, or seen as a second overlapping bank consortium or an exclusionary one. It sharpens antitrust exposure and confuses the regulator message. | High | Resolve within 30 days (D1). Options: merge into one network; make DepositX the neutral operator; or agree interoperability. Keep membership open to non-Big-Six issuers and non-bank participants at Tier 2/3. Give regulators one story. | Board, CLO |
| **R2** | **Legal finality gap and designation timing.** Statutory finality depends on PCSA designation, a discretionary decision with a 12-24 month planning range. | High | Dual track (2.3). PCSA-shaped Rulebook from day one. Early pre-dossier. Caps sized to opinions. Ask the Bank of Canada for a named workplan. | CLO, Head of Regulatory Affairs |
| **R3** | **Competition Act exposure** (s.45, s.90.1, s.79). The efficiencies defence is gone from s.90.1. The Bureau is scrutinising bank-controlled payments infrastructure [S]. | High | Antitrust Protocol, CNCA not-for-profit cost recovery, open admission, no exclusivity, multi-homing, Bureau advisory opinion. | Competition counsel |
| **R4** | **CDIC and provincial-insurer treatment unsettled.** No published position on tokenized-deposit eligibility, records or payout [P/S]. | High | Written CDIC interpretation request. Token metadata (LEI, category code). Failure protocol tabletop. Reword "CDIC-insurable" claims. | Regulatory Affairs |
| **R5** | **Stablecoin Act perimeter.** FRFI exclusion depends on regulations. Provincial institutions and the Operator are outside "FRFI." | Medium-High | Get exclusion into the regulations (Finance ask). Legal opinion. Avoid marketing that resembles stablecoins. | CLO, Finance liaison |
| **R6** | **Governance deadlock or capture** among competing issuers. | High (blueprint already rates it High) | Independent chair and four independents, vote tiers, expert determination, safety-first default, 20% cap, elected small-issuer seats. | Board, Governance Committee |
| **R7** | **OSFI third-party and resilience expectations** (B-10, B-13, E-21) and the "critical third party" and concentration view. The 99.999% target versus banks' impact tolerances. Supervisory positions arrive slowly, bank by bank. | High | Engage lead supervisors now (OSFI's 10 Sep statement asks for it [P]). B-10 evidence pack. SLA ramp. Coordinated messages. Track OSFI positions in the Issues Register. | Regulatory Affairs, bank CROs |
| **R8** | **Interbank settlement credit exposure and central-bank access.** Operator cannot hold a Bank of Canada settlement account [P]. Unclear 24/7 central-bank settlement. Deposit-token DvP for bonds conflicts with PFMI Principle 9 preference. | High | Prefunded or collateralised design (2.4). Joint policy question to the Bank of Canada on wholesale central-bank digital money (Samara model). | CLO, Treasury and risk leads |
| **R9** | **AML, sanctions, Travel Rule and privacy conflicts with the confidentiality layer.** Classification of tokens (funds versus virtual currency) unresolved. PIPEDA, Law 25 and immutable ledgers. | Medium-High | FINTRAC interpretation. PII off-ledger. Supervisory read-node scope. PIAs. Compliance-engine controls. Legal-hold procedure. | CCO, Privacy counsel |
| **R10** | **Operator viability and liability.** Not-for-profit capitalisation, insurance capacity, vendor concentration and open-source licence contamination, and bank sign-off on liability caps. | Medium | Note-funded capital, six-month reserve, insurance tower, tri-party vendor agreements, escrow, Apache-2.0 with no copyleft, Recovery and Wind-down Plan. | CLO, CFO |

**Watch list (not top 10):** Bank Act substantial-investment limits on bank ownership of the Operator [VC]; Quebec civil-law transfer-of-claims and language requirements [VC]; Bill C-8 critical cyber designation [VC]; the Bank of Canada observer role and conflict with oversight independence; Bill C-36 privacy reform timing [S]; derivatives characterisation of programmable templates; sanctions and court-order freezes on a ledger that promises no reversals.

### 8B. Ask list for the first joint meeting (OSFI, Bank of Canada, FINTRAC; invite CDIC and Finance as observers)

**What we bring (pre-read, sent 10 days ahead):** a 10-page perimeter paper; the Finality Options Paper; a two-page governance and admission term sheet; a data-flow and privacy diagram; the antitrust protocol; the proposed engagement protocol; a statement of how the Big Six effort and DepositX relate (once D1 is decided).

**Joint asks**
1. Agree a **named single point of contact per regulator** and a meeting cadence (proposal: monthly working group, quarterly principal-level session).
2. Agree a **tracked Regulatory Issues Register** owned by the Operator and shared with all.
3. Confirm each regulator's view of the proposed **DepositX and Big Six relationship** and whether any of them prefers one network or interoperable networks.

**Bank of Canada**
4. Which designation category does the Bank expect, and what is the process and realistic timeline from a complete dossier?
5. Will the Bank open a designation file for a pilot, and what evidence does it need first?
6. What is the Bank's view on the interbank settlement anchor (issuer settlement accounts, prefunding or collateral, or wholesale central-bank digital money as in Project Samara [S])? Is 24/7 central-bank settlement available or planned?
7. What is the Bank's intended role: read-only supervisory node, observer, or none? Does it need a statutory or Governing Council decision?
8. Confirm that a deposit token issued by a deposit-taking institution, and the Operator, sit outside the Stablecoin Act, and what regulation will say so.
9. How does the Bank expect DepositX to relate to Lynx and RTR (interoperability and non-duplication)?

**OSFI**
10. Confirm the route: each founding bank engages its lead supervisor (per the 10 Sep statement [P]). Will OSFI coordinate its lead supervisors so the banks get consistent positions?
11. How does OSFI view a shared ledger with bank validators under B-10 (material third party, concentration) and E-21 (critical operations)?
12. Capital and liquidity treatment of tokenized deposits (the statement is silent [P]). Any expected guidance?
13. Expectations on model risk (E-23) for the compliance-engine and anomaly-detection models.
14. Any expectations for consortium-run infrastructure not directly supervised by OSFI.

**FINTRAC**
15. Are deposit tokens "funds" (EFT and wire rules) or "virtual currency" (Travel Rule, LVCTR)? Please provide a written policy interpretation.
16. Is the Operator a reporting entity, and if so in what category?
17. Does a supervisory read-node and the compliance engine's screening and reporting hooks satisfy record-access and reporting expectations with a confidentiality layer?
18. Position on information sharing among banks through the compliance engine.

**CDIC and Finance (if present)**
19. CDIC: written position on eligibility, category attribution, the record standard for payout, advertising and signage, and an issuer-failure protocol.
20. Finance: support for designation, the Stablecoin Act regulation position, and a statutory gap list for any needed amendments.

**What we ask each regulator to state, in their own words:** what would make them unwilling to proceed. We want the objections early.

---

## Appendix A. Sources used and what I could not verify

**Read this session**
- OSFI, *Statement on Tokenized and Other Digitally Represented Deposits* (10 Sep 2026). [P]
- Justice Laws, *Payment Clearing and Settlement Act*. Summarised by tool; section numbers and definitions to be pin-cited by counsel. [P summary]
- Bank of Canada oversight pages: designated systems (Lynx, CDSX, CDCS, CLS, SwapClear; prominent payment systems ACSS, Interac e-Transfer, Interac IMN, Visa, Mastercard), Risk Management Standards based on PFMI, and the designation process. [P]
- Bank of Canada settlement account access policy (Payments Canada membership plus eight conditions). [P]
- Finance Canada, *Deposit Insurance Review: Consultation Paper* (2025): definition of deposit and exclusion of crypto. [P]
- Osler summary of Project Samara (OSC, AMF, CIRO approval; Bank of Canada wholesale digital CAD). [S]
- DLA Piper and Fasken summaries of the Stablecoin Act (Bill C-15, Royal Assent 26 Mar 2026). [S]
- Bloomberg, BNN Bloomberg, Globe and Mail, The Block, TechTimes on the Big Six announcement (22 Sep 2026). [S]
- Payments Canada and press on RTR by-law and rules (in force 24 Aug 2026, Q4 2026 launch). [S]
- Competition Bureau and law-firm summaries on the 2024 Competition Act amendments and the Interac matter. [S]
- OSFI E-21 timelines, B-10 in force 1 May 2024, E-23 effective 1 May 2027 (law-firm and vendor summaries). [S]
- FINTRAC Travel Rule and 2026 amendment summaries, RPAA amendments (Mar 2026), Payments Canada membership expansion (June 2024). [S]
- Privacy status (Bill C-36, Law 25). Sources were lower-quality aggregators. [S, low confidence]

**Could not verify (verify with counsel)**
- The primary text of the Stablecoin Act and its FRFI exclusion wording; when the regulations and framework come into force.
- PCSA definitional fit for DepositX ("clearing and settlement system": participants, Canadian dollars, settlement via the Bank) and the exact section numbers.
- Bank Act substantial-investment thresholds and whether a not-for-profit membership avoids them.
- CDIC by-laws on advertising and signage; the CDIC Act's exact deposit definition; provincial deposit insurers' treatment of caisses and credit unions.
- Whether FINTRAC will classify deposit tokens as "funds" or "virtual currency."
- Group 1a capital treatment (reported by press, not seen in OSFI's text).
- RTR designation status; Lynx operating hours; RTR settlement model (prefunded or not).
- The Competition Bureau advisory-opinion provision and whether the JV needs merger notification.
- NI 45-106 deposit exemptions and CSA views on programmable-template derivatives.
- Quebec Law 25 PIA trigger for transfers outside Quebec; Charter of the French Language application to the Rulebook.
- Bill C-8 status; OSFI incident-reporting timing; deposit preference in bank liquidation; the bail-in treatment of deposits.
- The Big Six announcement's details beyond the press coverage, and whether it is linked to the Working Group.
- **Added by the operator, not a legal finding:** when a member institution's own software agent initiates an instruction under that institution's existing key (e.g. an automated treasury sweep), is legal responsibility/authorization identical to a human employee initiating the same instruction, or does an autonomous-agent-initiated instruction need its own representation in the Membership Agreement and the audit trail? No seat has looked at this; flagging it for counsel, not answering it here.

**Blueprint items to correct, from the legal seat:** "bearer-recorded claim" (drop); "legal finality = technical finality" (replace with F1-F4); "CDIC-insurable wherever the underlying deposit is" (add provincial insurers and caveats); "direct supervisory oversight" of the Operator (true only on designation); "BoC observer node" (define as read-only supervisory node); "Par break = system-halting" (issuer-scoped by default); "settles in under two seconds with legal finality" (do not use until opinion and designation).
