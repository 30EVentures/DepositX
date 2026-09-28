# DepositX Network — Board Synthesis and Resolutions

**Status:** Chair's synthesis of six seat memos, for ratification. Nothing here has been approved by anyone.
**Date:** 25 September 2026 · **Source:** Blueprint v0.9 (KPMG, 2 Sep 2026) · **Seat memos:** `board/*.md`
**Read order:** this file → `01-execution-roadmap.md` → `02-technical-implementation.md` → `03-bank-onboarding-playbook.md` → `04-gates-risks-amendments.md`.

Conventions: figures are CAD, 2026 dollars. **[V]** = unverified, verify before relying. Legal points are hypotheses for counsel, not advice. Where seats disagreed, section 3 says how this synthesis resolved it and why. Every resolution can be overturned by the board.

---

## 1. The verdict in one page

**Conditional GO on Phase 0 only, re-scoped. Do not approve the v0.9 roadmap, its dates or its north stars as written.** All six seats independently reached the same core findings:

1. **The market changed on 22 September.** BMO, CIBC, National Bank, RBC, Scotiabank and TD jointly announced an exploration of a CAD tokenized-deposit system (verified: [BMO newsroom](https://newsroom.bmo.com/2026-09-22-Six-Canadian-banks-explore-development-of-a-secure-CAD-tokenized-deposit-solution), [CoinDesk](https://www.coindesk.com/business/2026/09/22/canada-s-big-six-banks-unite-to-launch-interbank-tokenized-deposit-initiative), [Globe and Mail](https://www.theglobeandmail.com/business/article-canadas-big-six-banks-tokenized-deposits-digital-money-push/)). Phase one is interbank movement of tokenized deposits; others may join later. No vendor, governance vehicle, timeline or Payments Canada role has been reported. **DepositX's central question, "will the largest banks join?", is now "is DepositX that initiative, its neutral operator, its second-tier complement, or redundant?"** We do not know how the Canadian Tokenized Deposit Working Group relates to the six.
2. **OSFI's 10 September statement** ([primary](https://www.osfi-bsif.gc.ca/en/news/statement-tokenized-other-digitally-represented-deposits)) says tokenized deposits are not legally distinct from deposits. That closes the *product* perimeter question and leaves the *network* questions open: legal finality, operator oversight, CDIC treatment, capital, settlement asset.
3. **The plan's biggest hole is the settlement asset.** The blueprint calls central-bank money the "settlement anchor" but makes the Bank of Canada only an observer. Without a written arrangement, there is no interbank finality and no interbank par. Strategy, Legal, CTO and Onboarding each flagged it separately. The Operator cannot itself hold a Bank of Canada settlement account.
4. **Two invariants are not true in law or engineering as written.** "Finality is one thing" is not true in Canadian law today (Legal). "Par, always" is a design goal and a measured outcome, not an absolute (Strategy, CTO). The blueprint's own approved sentence, "settles in under two seconds with legal finality", **must not be used externally** until an insolvency and finality opinion exists and the designation route is settled.
5. **The dates cannot hold.** The Phase 3 availability exit is impossible inside its own window (all six seats). Regulatory timing, not technology, is the critical path. Production moves from H2 2028 to **30 Nov 2029 (plan) / Nov 2030 (commit externally)**.
6. **Onboarding is the true critical path**, not technology. A Big-Six bank needs 24–30 months first time, 18–22 with a ready due-diligence pack (Onboarding). Any founding issuer not in Assess by end Q1 2027 cannot be live in 2028.
7. **The economics are a strategic option, not an ROI case.** Ecosystem cost to Phase 3 is $473M base ($317M–$821M). A large bank's 10-year NPV at 9% is about −$78M on base assumptions (CFO).

## 2. What we are building, restated

DepositX is a **permissioned settlement network on which regulated Canadian deposit-takers issue deposit tokens: recorded, account-based claims on a named bank, redeemable at par, moved by atomic settlement.** Wholesale first; retail is removed from the committed plan.

**Positioning (proposed):** *the neutral, standards-based settlement layer for tokenized CAD deposits: atomic delivery-versus-payment and payment-versus-payment, conditional payments, and 24/7 cross-bank liquidity, interoperable with Lynx and the Real-Time Rail rather than competing with them.* The Real-Time Rail (Q4 2026 launch, phased) already covers instant credit transfers; DepositX competes only where atomicity, conditionality and programmable liquidity matter.

**Five things must be true for DepositX to matter** (Strategy): (i) a settlement asset arrangement exists; (ii) a legal-finality route exists; (iii) at least two of the top-three banks are committed; (iv) at least one anchor use case has 5+ repeat counterparties and low RTR overlap; (v) governance is credibly neutral. If any fails at a gate, the plan pivots (see `04`).

## 3. Where the seats disagreed, and how this synthesis resolves it

| # | Issue | Positions | Resolution (proposed) |
|---|---|---|---|
| C1 | **Live pilot timing** | CTO/Legal/Strategy: capped live ~Q1 2028. CFO: Feb 2029 (assumes a formal "pilot permission" and an 8-month review). | Legal notes no "supervisory non-objection" instrument exists; the pilot gates are opinions, lead-supervisor engagement, a BoC written position and the bank B-10 approvals. **Plan of record: capped live pilot Q2 2028; earliest credible Q1 2028; commit externally to Q1 2029 (CFO base).** |
| C2 | **Production date** | CTO: H2 2028 go-live, plus a Phase 3b. Legal: limited H1 2029, full H2 2029. Strategy: Q1 2029. CFO: 30 Nov 2029 (P50), 30 Nov 2030 (P80). | Limited wholesale production Q2–Q3 2029 (designation or explicit BoC position in hand); **all founding issuers live 30 Nov 2029**; accepted Sep 2030. External commitment: Nov 2030. CTO's H2 2028 is the *engineering-earliest* date, not a plan date. |
| C3 | **Throughput target** | CTO: 5,000/s is easy, a capacity target. Strategy: demand is ~250/s sustained, 1,000 burst; 5,000 forces ZK. CFO: 5,000 is ~600× high-case average of 7.9/s. | **Requirement = demand-derived (start at 250 sustained / 1,000 burst; sizing model due 23 Oct). Provision 500/s at go-live. Prove 5,000/s in the lab as headroom.** Table 2 stays as a lab certification, not a production requirement. |
| C4 | **Availability** | All: 99.999% with 2 regions is impossible under BFT if a region is lost; ~5.26 min/yr. | **SLO ladder: 99.9% pilot → 99.95% at G2 → 99.99% contractual at go-live and at G3b → 99.999% as a measured design objective.** Gate G3b tests 99.99% over two full quarters after go-live. |
| C5 | **Governance keys** | Blueprint: MPC. CTO: ledger multisig. CISO: layered. | **On-ledger m-of-n multisig across independent organisations over HSM keys (FIPS 140-3 L3). MPC only where a single off-ledger key must exist.** |
| C6 | **Operator form and capital** | Legal: federal not-for-profit (CNCA), non-share capital. CFO: equity with return-of-capital cap, assumes share corporation. | **CNCA, cost-recovery, funded by capital notes with a capped return of capital (no dividends).** Counsel to confirm the instrument is available to a non-share corporation and the Bank Act "substantial investment" position **[V]**. |
| C7 | **Vote caps** | Legal: 13-seat board, 7 large-issuer seats, 80%+75%+chair for constitutional matters. CFO: 20% weight cap, 4 of 6 founders. Strategy: 15% cap, 2/3 by count and value. | **One issuer, one seat on the board; no group above 20% of weighted vote on economic matters; two-thirds by count *and* funding on risk rules; independent chair plus 3 independents.** Final numbers for counsel and the Competition Bureau. |
| C8 | **Settlement anchor mechanics** | CTO: segregated BoC funds mirrored by a DepositX settlement position (A1). Legal: Operator cannot hold a BoC account. | **Prefunded settlement positions held in issuer or Payments Canada-member settlement accounts, never by the Operator.** A2 (collateralised bilateral plus default waterfall) as fallback. Wholesale digital CAD (Samara-style) as the aspiration. Requires a BoC answer. |
| C9 | **Confidentiality** | Blueprint: ZK. Strategy/CFO: not required at demanded scale. CTO: three modes. | **Kernel supports M0 plain / M1 ZK committed amounts / M2 issuer-domain need-to-know. M2 is fully designed now. Decision at G1.2, 14 May 2027. Phase 3 does not depend on ZK.** |
| C10 | **Bank-side cost inside "9 figures"?** | Onboarding: ~$85–135M for six Tier A banks. CFO: bank internal spend $215M base. | Both are bank-side and **outside the operator's budget**. Reported separately; re-based in Phase 0 discovery. The $473M ecosystem figure includes both. |
| C11 | **Phase 1 par test** | Blueprint: 10,000 transfers. All: proves little (2 seconds of target load; bounds failure rate only at ~0.03%). | **≥100M adversarial simulated instructions plus a 72-hour soak at 1,000/s, backed by formal verification.** |

## 4. Decisions the board must take (in order, with dates)

| # | Decision | Recommended | By |
|---|---|---|---|
| D1 | Relationship to the six-bank initiative: merge / neutral operator / interoperate / compete | Open outreach now. Aim for neutral operator; floor is second-tier complement. Counsel first, then board, then outreach. | **9 Oct** |
| D2 | Antitrust protocol; freeze on commercially sensitive discussion until adopted | Adopt counsel-drafted clean-team protocol | **2 Oct** |
| D3 | Public-claims freeze and claims register (no claim without evidence, owner, 90-day expiry) | Adopt; single spokesperson | **2 Oct** |
| D4 | Scope: wholesale only; retire retail 2029 and the 95% north star | Adopt replacement north stars (`04` §3) | 16 Oct |
| D5 | Settlement-asset approach to take to BoC and Payments Canada | Prefunded positions proposed; digital CAD as aspiration | 16 Oct |
| D6 | Operator form, chair and independents | CNCA; launch chair search; interim shell | 23 Oct |
| D7 | Phase 0 budget and cost key | ~$6–10M for six months (Strategy) with equal-plus-usage split; first funding tranche $12.9M (CFO) covers pre-formation. Reconcile at 23 Oct. | 23 Oct |
| D8 | Technology stance | Fund the 10-week bake-off (custom Rust/CometBFT vs Canton vs Besu QBFT), 12 Oct–18 Dec; ledger-neutral spec; demand-derived sizing | **12 Oct start** |
| D9 | Adopt this synthesis's gates and dates as working baseline | Yes, subject to amendment | 23 Oct |
| D10 | Fund CISO-designate, SRE lead, General Counsel, Head of Regulatory Affairs hires; start HSM procurement (8–16 week lead **[V]**) | Yes | 31 Oct / 31 Dec |
| D11 | Each founding bank's Treasury validates its own benefit case by Gate G1 (bands: Go >$187M/yr aggregate, Stop <$70M/yr) | Adopt | G1 |

## 5. What is not yet known (open items carried forward)

- How the Working Group relates to the six banks. **Unresolved. Decision D1.**
- Whether the Bank of Canada will hold a role (read-only supervisory node, settlement provision). Not confirmed.
- CDIC's position on tokenized-deposit eligibility and payout; provincial insurers (Desjardins, credit unions) sit outside CDIC. The blueprint's "CDIC-insurable wherever the underlying deposit is" must be reworded.
- Primary text of the Stablecoin Act and its coming regulations (FRFI exclusion is "subject to regulations"; the Operator and provincial institutions are not FRFIs).
- PCSA designation route, section numbers and timing; FINTRAC's treatment of deposit tokens; capital and liquidity treatment (press reports of "Group 1a" not found in OSFI's text).
- Real-Time Rail value limits and settlement design; Lynx hours; Canadian volume data (the demand model depends on it).
- All performance figures in `02` are planning estimates until the spikes S1–S10 run.

Each seat memo carries its own verification register; these are the ones that block decisions.

## 6. Provenance

| Seat | Memo | Length |
|---|---|---|
| CTO / Chief Architect | `board/cto-technical-implementation.md` | 16.7k words |
| CISO / Head of SRE | `board/ciso-security-resilience.md` | 17.0k |
| Chief Legal & Regulatory | `board/legal-regulatory.md` | 12.3k |
| Head of Bank Onboarding | `board/onboarding-playbook.md` | 12.9k |
| CFO / COO | `board/cfo-coo-programme-and-economics.md` | 18.2k |
| CSO / CRO (skeptic) | `board/strategy-risk-challenge.md` | 11.8k |

The seat memos were produced by AI agents role-playing each seat, with web access for Legal and Strategy only. The CTO, CISO, CFO and Onboarding memos are from model knowledge (cutoff Jan 2026) and their own arithmetic. **They are inputs to a real board and real counsel, not substitutes for them.**
