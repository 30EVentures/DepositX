# DepositX Network: Strategy and Risk Challenge Memo

**Seat:** Chief Strategy Officer / Chief Risk Officer (board's designated skeptic)
**To:** Founding Board, DepositX Network
**Date:** 2026-09-25
**Source document:** Blueprint v0.9 (KPMG, 2 Sept 2026), including its "Known issues" list
**Status:** Board challenge. Recommends a re-scoped, gated plan; does not endorse the v0.9 roadmap as written.

---

## 0. Bottom line

**Recommendation: conditional GO on Phase 0 only, re-scoped. Do not approve the v0.9 roadmap, its five phases, or its north-star targets as they stand.**

Three things changed in the 23 days since the blueprint was dated. The board must react to them in the next 30 days.

1. **On 22 September 2026, six Canadian banks (BMO, CIBC, National Bank, RBC, Scotiabank, TD) jointly announced an exploration of a CAD tokenized-deposit system.** TD led the announcement. Phase one is interbank movement of tokenized deposits. The banks said other banks could join later. Press coverage says no vendor, governance vehicle, timeline, or Payments Canada role was named. This is the single most important fact for DepositX. The blueprint's central adoption problem, "will the largest banks join?", is now a question of whether DepositX is that initiative, a supplier to it, a second-tier complement to it, or irrelevant to it. **The founders must know within ten days which of those it is.** I could not verify how the Canadian Tokenized Deposit Working Group relates to the six banks' announcement.
2. **On 10 September 2026, OSFI stated that tokenized deposits are "not legally distinct from traditional deposits."** It finalized a crypto-asset capital and liquidity guideline effective 1 Nov 2026 (Oct FYE) or 1 Jan 2027 (Dec FYE). This removes the "regulatory perimeter" risk for the *product*. It leaves open the far harder questions about the *network*: legal settlement finality, operator oversight, and the settlement asset.
3. **The Real-Time Rail is launching in Q4 2026 (phased, with broader availability through 2027).** Payments Canada's own Lynx completed its ISO 20022 migration in Nov 2025. Bank of Canada Project Samara (March 2026) settled a C$100M tokenized bond in wholesale central-bank money with RBC and TD, and concluded that efficiency gains were partly offset by complexity, liquidity costs, and new governance needs. The Bank of Canada joined BIS Project Agora in May 2026. Canada's wholesale tokenization agenda now has a state-backed track that DepositX does not control.

**The five sentences the board should take away:**

- DepositX's thesis is sound only if it solves one problem the blueprint does not: **what settles between Bank A and Bank B when a token moves.** The blueprint says central-bank money is the "settlement anchor" (Vision) but makes the Bank of Canada only an observer node (Architecture). That gap is the plan's largest hole, and it is larger than the ZK bet.
- "Finality is one thing" and "par, always" are marketing sentences, not engineering or legal facts. Neither can be delivered by the network alone. Both should be rewritten as *designed-for, measured, and cited* claims (Section 6).
- The 5,000 tps target is not derived from any demand. It is likely 100 to 1,000 times what Canadian wholesale flow needs. It is self-inflicted risk, and it is what forces ZK at scale.
- The lowest-regret wedge is **cross-bank, 24/7 own-account liquidity movement for multi-banked corporates and bank-to-bank/dealer securities cash legs**. It needs 2 to 3 banks, not 6, because it does not need counterparties on both sides of a payment.
- Every phase needs a hard gate with a real "no" (Section 5). The blueprint's Phase 3 exit cannot be met in its own dates, and none of its exits names who decides.

---

## Verification ledger (what I checked, and how well)

Today is 2026-09-25. My training knowledge ends earlier. I used web search and fetched primary pages where possible. Many 22-23 Sept results come from crypto and aggregator sites; I treat those as *reported*, not confirmed. Where the primary page blocked me (HTTP 403 or timeout), I say so.

| Claim | Source | Confidence |
|---|---|---|
| Six banks announced joint tokenized-CAD-deposit exploration, 22 Sept 2026; open to more banks later; no vendor/governance/date named | CoinDesk 2026-09-22; Cointelegraph; American Banker; Tech Times (fetched) | Medium-high on the announcement. Low on any detail beyond it. No bank press release read. |
| OSFI 10 Sept 2026: tokenized deposits "not legally distinct"; must consult OSFI supervisors before novel products; third-party risk rules apply | Yahoo Finance/Crowdfund Insider summaries (fetched) | Medium. OSFI's own statement not read. |
| OSFI crypto-asset guideline (banking) effective 1 Nov 2026 / 1 Jan 2027; tokenized deposits with same legal rights can be Group 1a; infrastructure-risk add-on set at zero but OSFI may increase it; requires legal enforceability, settlement finality, defined network access/node roles/consensus | osfi-bsif.gc.ca guideline page (fetched) | High |
| CDIC has not published explicit guidance on coverage of tokenized deposits | Secondary aggregator summaries only | **Low. Not verified against CDIC.** Must be confirmed with CDIC directly. |
| Payments Canada RTR: launch Q4 2026, phased, broader through 2027; rules/by-law approved | payments.ca RTR page (fetched); PaymentExpert/BetaKit via search | Medium-high. Value limits, settlement model, hours: **not verified**. |
| Lynx: full ISO 20022 (MX) since 22 Nov 2025 | payments.ca via search | High. **Lynx operating hours / any 24/7 extension: not found. Not verified.** |
| Project Samara (Mar 2026): C$100M EDC tokenized bond, RBC/TD leads, wholesale CAD central-bank money on a purpose-built DLT; benefits "partially offset" by complexity, liquidity costs, governance needs; adoption outlook "preliminary and illustrative" | bankofcanada.ca staff paper (fetched) | High |
| Bank of Canada joined BIS Project Agora (May 2026) with 7 other central banks and 40+ firms | bankofcanada.ca (fetched); BIS press p260527 via search | High. July 2026 real-value test (28 institutions, ~CHF 800k) is search-summary only: medium. |
| Canada Stablecoin Act: enacted (reported March 2026 via Bill C-15); Bank of Canada supervises non-financial-institution issuers; framework expected 2027 | bankofcanada.ca page (fetched, no date given); Yahoo Finance via search | Medium. Effective date not confirmed from primary. |
| JPMorgan Kinexys: >$3T processed cumulatively, >$5B/day average; JPMD deposit token live for institutional clients on Base; Canton deployment being phased through 2026 | jpmorgan.com Kinexys milestones page (fetched); CoinDesk 2026-01-07 | High on figures as JPM's own claims |
| HSBC Tokenised Deposit Service live in HK, SG, LU, UK, UAE; US launched 13 Apr 2026; Canton pilot | HSBC press pages, PYMNTS via search | Medium-high |
| Citi Token Services live for institutional clients; Japan expansion planned by end-2026; "~$1B of ~$6T daily" tokenized | Citi, American Banker, Banking Exchange via search | Medium. The daily figure came from an aggregator: low. |
| Partior: four settlement banks (DBS, Deutsche, JPM, StanChart); LSEG DiSH tie-up announced Sept 2026 to add multi-settlement-bank liquidity, targeting Q1 2027 production; reported "single-digit billions" daily | LSEG/PRNewswire/PaymentExpert via search | Medium. Volume figure is a secondary summary. Industry Spread critique fetched but timed out: only headline seen. |
| Swift blockchain ledger (Linea-based, permissioned): 17 pilot banks, live pilot from July 2026, final settlement still via existing rails | Swift press release (403 blocked); CoinDesk/Ledger Insights via search | Medium. No Canadian bank appears in the 17-bank list I saw. |
| UK GBTD: first live tokenized-deposit customer transactions (remortgages, marketplace purchase), Sept 2026; Barclays, HSBC UK, Lloyds, Monzo, Nationwide, NatWest, Santander | UK Finance page; PYMNTS; Fintech Garden via search | Medium |
| ECB launched Pontes 21 Sept 2026 (settle DLT transactions in central-bank money; interconnect DLT platforms with TARGET); Appia blueprint targeted 2028 | ECB press release via search | Medium-high |
| SNB Project Helvetia (wholesale CBDC on SDX) extended to at least mid-2027; not a commitment to permanent introduction | snb.ch via search | High |
| Regulated Liability Network: NY Fed Innovation Center-led 2022-23 proof of concept; UK RLN pilot through mid-2026 | Finextra/Addleshaw Goddard via search | Medium. **"Regulated Settlement Network" as a distinct entity: not found. Not verified.** |

**Not verified at all:** who the six banks' announcement was coordinated with; whether any Canadian bank is a Partior, Canton, or Kinexys participant; RTR value limits and settlement design; Lynx hours; CDIC's position; current Canadian deposit market shares (I use illustrative shares below, labelled as assumptions); Lynx daily transaction counts (my recollection is tens of thousands per day, which I flag wherever used).

---

## 1. Strategic thesis stress-test

### 1.1 Why a consortium network, and what the honest answer is

The blueprint asserts a consortium network. It never argues it. There are four alternatives, each with live prior art.

| Option | Prior art | What it does well | Why it is not enough for Canada |
|---|---|---|---|
| **Each bank builds its own token** | JPM Coin/JPMD (Base, Canton), HSBC TDS, Citi Token Services | Fast to launch; bank controls the client; strong for a bank's own branches and clients across borders | A single-issuer token is a closed loop. RBC clients paying TD clients need a common settlement mechanism. The value in a concentrated domestic market is interbank |
| **Bilateral interoperability standards** | Agora-style interlinks; Pontes bridging platforms to central-bank money | No new operator; ledger-agnostic | Atomicity across issuers without a shared ledger needs cross-ledger protocols that are not production-proven for CAD, and the legal finality problem remains |
| **Join a global network** | Partior (multi-bank, USD/EUR/SGD), Canton (JPM, HSBC, DTCC), Swift ledger (17 pilot banks), Kinexys | Cross-border reach; existing ecosystems and client demand | CAD is a small share of global turnover. None settles CAD in Bank of Canada money. None gives Canadian legal finality, OSFI/BoC oversight, or Canadian data residency. They serve Canadian banks' *cross-border* need, not the domestic one |
| **Regulator-run wholesale platform** | Samara (BoC wholesale CAD), Helvetia (SNB), Pontes (ECB) | Central-bank money is native; strongest legal footing | BoC reported adoption "will likely be slow" (integration challenges, limited appetite for core changes). It is a research track, not a commercial roadmap |

**Where a consortium genuinely wins:** N banks connecting to one shared rulebook, one compliance surface, and one atomic-settlement space needs N integrations, not N(N-1)/2. For 6 banks that is 6 versus 15. For 20 institutions it is 20 versus 190. It also gives one legal finality framework, shared cost, and one voice to regulators.

**Where it loses:** technology lock-in to one ledger, governance friction, and the fact that the banks that matter can convene without DepositX (which they just did).

**Board principle I recommend:** *the rulebook and the interfaces are the asset, not the chain.* DepositX should be **ledger-neutral by specification** (ISO 20022 messages, a certified interface, portable token-contract templates) and **single-ledger by launch** (one production ledger chosen through a competitive RFI). That preserves interoperability with Canton, Partior, Swift, and Agora-style platforms without the blueprint's "no bridges" absolutism (see Section 4, A-27).

### 1.2 The Big Six question, restated

The blueprint asks how DepositX gets the largest banks to join. As of 22 September the question is different, and there are exactly four positions DepositX can take:

| Position | Meaning | When it is right | Risk |
|---|---|---|---|
| **A. DepositX *is* the vehicle** | The six banks adopt DepositX's operator, rulebook, and design as their initiative | Working Group members include most of the six and they intend this as the same effort | Perceived as a bank cartel; competition-law and access-fairness scrutiny (Section 3, R6); smaller institutions and fintechs locked out |
| **B. DepositX is the neutral operator/standard the six select** | The six own economics; DepositX (or its operator) wins the mandate to run the utility | The six are exploring and have no operator, which matches what was reported | Depends on winning a competitive process; may lose to Payments Canada or a vendor |
| **C. DepositX is the second-tier and interoperability layer** | Six-bank network for the big banks; DepositX for Desjardins, credit-union centrals, mid-size and foreign-bank subsidiaries, and non-bank participants, interoperable with the six's rail | The six proceed independently of DepositX | Structurally subordinate; the interop price is set by the larger network |
| **D. DepositX is redundant** | Six banks build their own; DepositX has no reason to exist | If Working Group has no overlap with the six and they will not engage | Programme should stop and publish learning |

**My recommendation:** open outreach *this week* aiming for B, with A as the fallback if the six are already DepositX's members, and C as the planned floor. Do not launch anything that positions DepositX publicly as a rival to the six's initiative until this is resolved. Two quantified reasons:

- The six will handle the vast majority of Canadian domestic deposits (illustrative shares below). A network without at least 4 of them is not a Canadian settlement network.
- RBC and TD already worked together on Samara. The two are not each other's strangers. The "RBC joins a network TD governs" problem is really "does any single bank appear to control the utility?"

### 1.3 "Why would RBC join a network TD also governs?"

RBC will join only if it is better off than its outside option. Its outside options are: (i) the six's own initiative, (ii) its own token plus interoperability, (iii) waiting for Payments Canada/BoC. DepositX must therefore beat all three on cost, control, and time. Concretely:

1. **No bank controls the operator.** Recommend: no issuer group holds more than 15% of votes or board seats; an independent chair and two independent directors; issuer-majority to change economics; **two-thirds of issuers by count *and* by value** to change the rulebook's risk provisions; any issuer holds a veto over changes to its own liability treatment.
2. **The operator is a utility, not a franchise.** Cost-recovery pricing, no dividend, published pricing, a published cap on operator margin. Precedent: Payments Canada's member-governance model. Interac's history with the Competition Bureau (recollection; counsel to verify) is the cautionary tale of a bank-owned network that drew antitrust scrutiny.
3. **Vendor and technology neutrality.** Escrowed source, reproducible builds (already in the blueprint), and a standing right to run a certified node on any conforming stack.
4. **Symmetric data rules.** The operator cannot see any issuer's client positions. The supervisory read-node is scoped to mandate and logged. This matters more than any voting rule: banks fear losing competitive information more than losing votes.
5. **Exit and step-in rights.** Clean exit terms, a defined wind-down, and a step-in right if the operator fails.
6. **A defensive rationale everyone shares.** The Stablecoin Act (framework expected 2027) will let non-bank issuers register with the Bank of Canada. Banks that do nothing risk losing fast-payment share outside the deposit franchise. This is the shared motive, and it is the same one press reports attribute to the six.

### 1.4 Competitive and substitute landscape

| Competitor / substitute | Type | Threat to DepositX | DepositX's honest response |
|---|---|---|---|
| **Six-bank initiative (22 Sept)** | Direct, in-market | **Existential**: may bypass or absorb | Position B/A/C per 1.2 |
| **Lynx** (Payments Canada, BoC-settled, ISO 20022 since Nov 2025) | Incumbent wholesale rail | Extending hours or adding atomic features would remove DepositX's 24/7 pitch | Interoperate; never claim to replace |
| **Real-Time Rail** (Q4 2026, phased) | Instant 24/7 rail, data-rich payments | High for supplier payments and any "instant" pitch | Do not compete on speed; compete on atomic multi-leg, conditionality, DvP/PvP |
| **Interac e-Transfer / card rails** | Retail and SMB | Low for wholesale, high for a 2029 retail phase | Drop retail from the plan |
| **Stablecoins** (Stablecoin Act regime, 2027) | Non-bank issuers | Medium: speed outside the deposit franchise | DepositX's answer is bank deposits with the same speed |
| **Kinexys/JPMD, HSBC TDS, Citi Token Services** | Bank-proprietary tokens | Medium: multinational corporates in Canada already use them for cross-border | DepositX should be the CAD leg they interoperate with |
| **Partior, Swift ledger, Canton** | Multi-bank global networks | Medium: could add CAD | Partner as CAD gateway (Path D, Section 5) |
| **BoC wholesale CAD (Samara lineage), Agora** | Central-bank track | High if the BoC builds it and Payments Canada operates it | Align with it; be the commercial layer above it |
| **Status quo** | Do nothing | **Most likely competitor** | Discovery must prove the pain exists (Section 2.3) |

### 1.5 Lynx and the Real-Time Rail: precise positioning

**What is known (verified):** Lynx is Canada's high-value system, in ISO 20022 since 22 Nov 2025. RTR launches Q4 2026 in phases, with broader access through 2027.

**What I could not verify:** Lynx operating hours, RTR value limits, and RTR's settlement design with the Bank of Canada. Obtain these from Payments Canada in the first 30 days; they change the analysis.

**How DepositX can interoperate. There are three modes, and only one is entirely under DepositX's control:**

| Mode | Mechanism | Needs from BoC/Payments Canada | Failure exposure |
|---|---|---|---|
| **1. Net settlement through Lynx** | DepositX net positions are settled at defined intervals via Lynx | Lynx access for a DepositX settlement agent; a defined cut-off | Credit exposure between issuers from the last Lynx window to the next (nights and weekends) |
| **2. Prefunded settlement positions (recommended near-term)** | Each issuer funds a DepositX settlement position in central-bank money during Lynx hours. On-ledger transfers draw down and increase positions and can never exceed prefunded amounts | A settlement account or equivalent arrangement at the BoC for a DepositX settlement agent; regulatory status for the arrangement | Bounded by prefunding; cost is trapped liquidity (Risk FN2) |
| **3. Tokenized central-bank reserves on DepositX** | Bank of Canada issues wholesale CAD on DepositX's ledger (Samara-style) | A BoC policy and possibly legal decision | Lowest risk; **not in DepositX's control** |

**Design constraint:** architect for Modes 1 and 2 first. Treat Mode 3 as upside. **Do not sell "legal finality" until Mode 2 or 3 is agreed in writing.** Without a settlement asset, an instant token transfer from Bank A to Bank B leaves A owing B. Par between issuers is then only as good as A's credit until the next settlement, which is the exact risk the blueprint says it eliminates. Swift's ledger and Partior both work this way in practice (settlement "the old way" via banks or existing rails), which is why Partior added LSEG DiSH for always-on settlement-bank liquidity.

**Marginalisation risk, stated precisely.** DepositX is marginalised if any of the following happens:

1. Payments Canada extends Lynx to near-24/7 operation or launches its own wholesale-token service.
2. RTR's value limits are high enough to absorb corporate supplier and sweep flows.
3. The BoC picks the six-bank rail as its settlement counterparty.

**Stress test for every board paper:** "If Lynx were 24/7 and RTR had no value limit, what would remain?" Only atomic multi-party settlement (DvP/PvP), conditional payments, and programmable liquidity remain. **That residue is DepositX's real product.** It is a narrower product than "instant payments," which RTR already offers.

**Routing principle.** DepositX should sit inside bank treasury platforms as a *routing option with automatic fallback* to RTR or Lynx when a counterparty bank is not on DepositX. Then "share of eligible flow" becomes a routing statistic, not a network-wide adoption claim.

### 1.6 Positioning statement

> **DepositX is the shared, supervised settlement layer on which Canadian deposit-taking institutions issue and exchange deposit tokens, so that bank money can settle against an asset, a condition, or another bank's deposit in one atomic step, at any hour. It runs alongside Lynx and the Real-Time Rail and routes to them where a counterparty is not on the network.**

Not for: retail, non-bank issuers, stablecoins, or anything that does not stay a deposit at a regulated institution.

### 1.7 Five things that must be true

1. **A settlement asset is agreed in writing with the Bank of Canada / Payments Canada** (Mode 2 at minimum) before any live pilot. Without it there is no interbank finality, only a fast messaging layer.
2. **At least 4 of the six largest banks, including at least 2 of the top 3 by wholesale payments, commit to fund and use DepositX**, or the six's initiative adopts DepositX's operator/rulebook. Fewer than 4 makes the reachable share of flows too small (Section 2.1).
3. **Statutory or equivalent legal finality exists before production.** In practice: designation and oversight under the Payment Clearing and Settlement Act (my recollection; counsel to confirm the exact route), plus insolvency-protection opinions from two independent firms.
4. **One anchor use case delivers measurable value that Lynx plus RTR cannot**, evidenced by signed customer commitments, not hypotheses. Target thresholds are in Sections 2.3 and 5.
5. **Bank-side integration is affordable and scheduled.** Each founding bank has an approved integration budget and date. Blueprint has none.

---

## 2. Adoption strategy

### 2.1 The chicken-and-egg problem, quantified

For a *random* corporate payment, the chance both banks are on the network is (share of participating banks)². Using illustrative shares (an assumption, not sourced): RBC 25%, TD 22%, BMO 14%, BNS 14%, CIBC 12%, NBC 5%, others 8%.

| Participating banks | Combined share | Share of random cross-bank payments with both banks on DepositX |
|---|---|---|
| RBC + TD | 47% | **22%** |
| Top 3 | 61% | **37%** |
| Top 4 | 75% | **56%** |
| Top 5 | 87% | **76%** |
| Big Six | 92% | **85%** |

**Implication.** Payment-style network value is convex. Two or three banks deliver little value for random supplier payments. So the wedge must be a use case that does **not** need a counterparty network:

1. **Own-account, cross-bank liquidity** (a multi-banked corporate moves cash between its own RBC and TD accounts at any hour). This needs the corporate plus 2 banks.
2. **Bank-to-bank and dealer securities cash legs** (dealers *are* the counterparties; the flows are concentrated in a few desks).
3. **Weekend and holiday liquidity between participating banks.**
4. **Payment-on-condition for a small set of repeat counterparties** (real-estate closings and lawyer trust flows, as UK GBTD showed with remortgages; commodity/energy deliveries).

Random supplier payments come last and are the use case RTR is designed for.

### 2.2 Sequencing

| Wave | Window | Use case | Participants | Why here |
|---|---|---|---|---|
| **0** | Q4 2026-Q1 2027 | Discovery, design partners, settlement-asset design | 3-4 banks, BoC/Payments Canada, 60 interviews | Prove demand and access before building |
| **1** | Q2-Q4 2027 (testnet) | Own-account cross-bank liquidity; interbank weekend liquidity (simulated) | 3 issuers minimum; 5+ corporate design partners | No network effect needed |
| **2** | 2028 (capped live pilot) | Above, live, plus government/agency bond and money-market DvP cash legs (Samara lineage) | 3-4 issuers; 2+ dealers; 1-2 asset issuers; a depository/CSD counterpart | Wholesale flows are concentrated |
| **3a** | Q1 2029 (limited production) | Anchor use case(s) proven in pilot | All committed founding issuers | Only what passed Gate 2 |
| **3b** | H2 2029-2030 | Conditional supplier payments, ERP integration, second-tier institutions, cross-border corridors | + Desjardins, credit-union centrals, mid-size, foreign bank subsidiaries | Network effect becomes real |
| **4** | Not before Gate 4 | Retail | Only if the retail question survives RTR and CDIC confirmation | Blueprint's 2029 date is unsupported |

**Minimum viable participant set (Wave 2):** 3 issuers (at least 2 of the top 3), 1 BoC/Payments Canada settlement counterpart (not observer only), 2 dealer desks, 1 tokenized-asset issuer, 8+ live corporate or institutional clients, and one operator. **Success at that scale** means at least C$200M/day average cross-bank value with 70%+ of design-partner clients active in the last 8 weeks.

### 2.3 Corporate demand: hypotheses and pre-build discovery

**Hypotheses to test (each with a kill threshold):**

| # | Hypothesis | Test | Kill if |
|---|---|---|---|
| H1 | Multi-banked corporates have weekend/holiday cash they would move between banks if they could | Treasury interviews plus clean-team aggregated bank data on Friday-to-Monday cash positions | Fewer than 40% of the 15 largest interviewed corporates quantify a cost |
| H2 | The value is material. Upper bound: non-business days are about 31% of the year (about 113 of 365). At an assumed 2.5% short rate, idle-day carry is about 75 bp a year on movable cash. Realistic capture is perhaps 10-20% of that, so roughly 8-15 bp a year on moved balances. This is a sizing sanity check, not a forecast | Willingness-to-pay conversations | Buyers will not pay 1 bp a year on moved balances, or per-instruction prices near C$0.25-1 |
| H3 | Dealers and asset managers lose money or capital on T+1 or bridged cash legs of tokenized securities | 10 desk interviews; Samara team debrief | Fewer than 3 desks can name a P&L or capital impact |
| H4 | Conditional payments (closings, escrow, commodity delivery) have repeat counterparties and a clear pain | 10 interviews (real-estate lawyers, energy/agri, trade) | No use case with 5+ repeat counterparties |
| H5 | Corporates will use a bank-branded token service (not a network brand) if it appears in their TMS/ERP | 5 TMS/ERP vendor interviews | Vendors decline to build connectors for less than a named volume commitment |
| H6 | 24/7 mobility does not make banks' deposit bases less stable in ways that cost them LCR/run-off capital | Bank treasury and OSFI conversation | Banks estimate a cost above the benefit |
| H7 | RTR does not already cover the target flows | Read RTR rules; interview Payments Canada | RTR limits and features cover 80%+ of H1/H4 flows |

**Discovery plan (10 weeks, starting 12 Oct 2026; finish by 18 Dec 2026):**

| Segment | Interviews | Notes |
|---|---|---|
| Large corporates (>C$5B revenue) and Crown corporations | 12 | Treasurer/Head of Cash |
| Mid-cap multi-banked corporates | 10 | Fastest cash-management pain |
| Energy, agri, resource, real estate, lawyers/notaries (conditional-payment) | 10 | H4 |
| Pension funds, asset managers, insurers | 8 | Cash-leg and collateral pain |
| Dealers and capital-markets desks | 8 | H3 |
| TMS/ERP/payment-software vendors | 5 | H5 |
| Bank cash-management product heads (each founding bank) | 7 | Deposit-mobility and pricing concerns |
| **Total** | **60** | Target: 20 done by 13 Nov; 40 by 4 Dec; 60 by 18 Dec |

**Deliverables at day 90:** a ranked use-case scorecard (value, frequency, repeat counterparties, RTR overlap, integration effort); at least 8 non-binding LOIs from corporates and 3 from dealers with an aggregated indicative flow of at least C$1B/day; a price sensitivity curve.

**Conduct rules.** Interviews must follow a competition-law protocol drafted by counsel (Section 7). No bank shares client-level or price data except through a clean team and only in aggregate. This is not optional.

### 2.4 Pricing the wedge

Banks earn on deposit spread. A token that makes corporate deposits more mobile can lower that spread (H6). Price accordingly.

- **Design partners (Waves 1-2):** no network fee to clients. Costs are shared by founding issuers per the cost-sharing key (Section 7, decision D6).
- **Network fee at production (hypothesis to test):** a per-instruction charge to issuers in the range **C$0.10-0.50** for standard transfers, and **0.05-0.25 bp of notional** for DvP, plus a participation fee by tier (e.g., C$0.5-3M per year per issuer). Banks choose their client price; the target is parity with current wire fees or below, not a premium.
- **Break-even check.** Blueprint's operator run team is 40-60 people. At about C$250k fully loaded per head plus infrastructure, security, audit, insurance and legal, steady-state run cost is roughly **C$30-40M per year** (my estimate). At C$0.25 per instruction, break-even is about 120-160 million instructions a year (about 330-440k a day). That is roughly 4-5 tps on average and about one-thousandth of the 5,000 tps the blueprint sizes for. **Pricing is not the constraint; the anchor use case volume is.** If discovery cannot identify hundreds of thousands of instructions a day (or notional-based equivalents), the operator model must shrink (Path A, Section 5).
- **No profit motive.** Treat DepositX as a cost-recovery utility with a published margin cap. That answers the "why join a network another bank governs" question (1.3) and the antitrust question (R6).

---

## 3. Enterprise risk register

**Scoring:** Likelihood (L) and Impact (I) each 1-5. Score = L × I. Likelihood is over the plan's life to Gate 3. Impact 5 means threatens DepositX's existence or causes systemic harm. Owners are roles (see Section 7 for the role list). EWI = early-warning indicator.

### 3.1 Register

| ID | Cat. | Risk | L | I | Score | Owner | Early-warning indicator | Mitigation |
|---|---|---|---|---|---|---|---|---|
| S1 | Strategic | Six-bank initiative bypasses or absorbs DepositX | 4 | 5 | **20** | Chair / CSO | No reply to outreach in 10 days; six announce vendor/governance without DepositX | Position B/A/C (1.2); outreach this week; regulators told DepositX is the neutral option |
| S2 | Strategic | Governance deadlock, or one bank seen to dominate | 4 | 5 | **20** | Chair | Repeated no-decision board meetings; first vote splits on economics | Vote caps, independent chair and directors, two-thirds by count and value on risk rules, deadlock-breaker (expert determination) |
| S3 | Strategic | No anchor use case beats Lynx plus RTR | 3 | 5 | 15 | CSO / Head of Product | Fewer than 8 LOIs by day 90; H7 shows RTR covers 80%+ | Discovery (2.3); Path A/B fallback; drop generic "instant payments" pitch |
| S4 | Strategic | Partial participation; no network effect | 4 | 4 | 16 | CSO | Fewer than 4 banks committed by G0 | Wedge that needs no counterparty (2.1); routing with fallback |
| S5 | Strategic | Marginalised by Payments Canada/BoC platform or Lynx extension | 3 | 5 | 15 | Head of Regulatory Affairs | Payments Canada roadmap announces 24/7 wholesale; BoC picks another counterpart | Engage Payments Canada as partner; design Mode 3 compatibility |
| S6 | Strategic | Global-network gravity pulls CAD volume to Kinexys/Canton/Swift | 3 | 3 | 9 | CSO | Big banks join Swift ledger or Canton for CAD | CAD gateway role (Path D); interoperability MoUs |
| S7 | Strategic | Business case fails; banks defund at a gate | 3 | 4 | 12 | CFO | Cost variance above 15%; benefit case not signed by bank CFOs | Bottom-up model; benefits owned by banks; gated funding |
| R1 | Regulatory | **Settlement asset unresolved (no BoC/Payments Canada arrangement)** | 4 | 5 | **20** | Head of Regulatory Affairs | No written BoC position by G0 | Mode 2 proposal; joint working group with BoC and Payments Canada; do not go live without it |
| R2 | Regulatory | No statutory/equivalent legal finality; insolvency unwind risk | 3 | 5 | 15 | General Counsel | Counsel cannot opine without qualification; designation timeline unknown | Two legal opinions; PCSA designation path; rulebook plus statute; no "legal finality" claim until confirmed |
| R3 | Regulatory | Operator classified as FMI/PSP/other; obligations and timeline drift | 4 | 4 | 16 | General Counsel | Regulators ask for PFMI compliance before pilot | Pre-consultation; design to PFMI from day one; budget the time |
| R4 | Regulatory | CDIC treatment of token form unconfirmed | 3 | 3 (I=4 in retail) | 9 | General Counsel | No CDIC engagement by G1 | Direct CDIC engagement; do not use "insured" wording; irrelevant to corporates above the C$100k limit |
| R5 | Regulatory | OSFI capital/liquidity: deposit mobility raises run-off assumptions; infrastructure add-on may rise | 3 | 3 | 9 | CRO | OSFI signals add-on or LCR treatment | Early supervisor consultation (required by OSFI); weekend flow monitoring |
| R6 | Regulatory | Competition-law exposure (competitors coordinating; access rules) | 3 | 4 | 12 | General Counsel | Counsel objects to interview protocol; excluded institutions complain | Clean-team protocol; open, fair-access rules; consult Competition Bureau before launch |
| R7 | Regulatory | Privacy law (PIPEDA, Quebec Law 25), language requirements | 2 | 3 | 6 | General Counsel | Quebec participants raise issues | Privacy-by-design review; bilingual materials |
| T1 | Technology | ZK confidentiality misses performance or maturity | 4 | 3 | 12 | CTO | Proving latency above target in Phase 1 benchmark | Design fallback now (permissioned confidentiality: party-scoped data with hash commitments); ZK optional |
| T2 | Technology | Defect in par or settlement contract | 3 | 5 | 15 | CTO / CISO | Audit findings; formal-verification gaps | Verify a small kernel; independent audits; bug bounty; staged caps |
| T3 | Technology | BFT across two regions and 7-15 validators misses latency/availability | 4 | 3 | 12 | CTO | p99 finality above 5s at 100 tps in testnet | Test early; simplify topology; measure end-to-end vs consensus separately |
| T4 | Technology | Core-banking integration cost/timeline per bank | 5 | 4 | 20 | CTO / bank sponsors | Bank integration estimates differ by more than 2x; slip against plan | Integration tiers; hold-based mint design; bank-funded integration budget; certification suite |
| T5 | Technology | Key compromise or failed ceremony | 2 | 5 | 10 | CISO | Ceremony failures; HSM vendor advisories | HSM/MPC; rehearsed break-glass; independent attestation |
| T7 | Technology | Platform/vendor lock-in; vendor failure | 3 | 3 | 9 | CTO | Single-vendor dependency in RFI results | Ledger-neutral spec; escrow; reproducible builds; second-source plan |
| O1 | Operational | 24/7/365 availability shortfall (bank cores have batch windows) | 4 | 4 | 16 | COO | Sev-1/2 incidents in testnet; bank-side downtime | Realistic SLO (Section 4, A-14); store-and-forward; separate network and bank availability |
| O2 | Operational | No 24/7 ops model at operator or banks | 4 | 3 | 12 | COO | On-call gaps; unresourced night shifts | Follow-the-sun or 24/7 NOC; runbooks; bank operating agreements |
| O3 | Operational | Token supply and bank liabilities fall out of reconciliation | 3 | 5 | 15 | CRO / COO | Unreconciled minutes above tolerance | Mint only against a core-banking hold/lien; intraday reconciliation; hard issuance limits |
| O4 | Operational | Weekend run: 24/7 mobility speeds deposit outflows when the central bank window is closed | 2 | 5 | 10 | CRO | Large weekend outflows from one issuer | Per-issuer velocity limits; circuit breakers; agreed BoC contingency; scenario exercises with OSFI/BoC |
| O5 | Operational | Delivery capacity and multi-party coordination (120-160 people, 6 pods, 6+ banks) | 4 | 3 | 12 | Programme Director | Pod velocity; secondment fill rate below 80% | Single delivery office; fixed secondment commitments; small kernel first |
| F1 | Financial crime | Sanctions/Travel Rule evasion through confidentiality layer | 3 | 5 | 15 | CCO (Chief Compliance Officer) | Regulator questions about screening in private transfers | Screening before confidentiality; attested KYC; supervisory read-node; test with red team |
| F2 | Financial crime | Irreversible instant transfers speed fraud and misdirected payments | 3 | 3 | 9 | CCO | Misdirection incidents in pilot | Payee verification; limits; recall protocol in rulebook |
| F3 | Financial crime | Layering across issuers; fragmented FINTRAC reporting | 3 | 4 | 12 | CCO | Unmatched cross-issuer alerts | Shared typologies; cross-issuer analytics inside privacy limits |
| F4 | Financial crime | Tokens leak outside the perimeter through API resale | 2 | 4 | 8 | CISO | Off-perimeter API usage | Participant contracts; API monitoring |
| C1 | Conduct | Marketing outruns evidence | 3 | 4 | 12 | CCO / Head of Comms | Claims not in the register; press asks for guarantees | Claims register (Section 6); legal sign-off; 90-day expiry |
| C2 | Conduct | Access discrimination or operator conflicts of interest | 3 | 3 | 9 | Chair | Complaints from non-founders | Published access criteria; independent admission committee |
| C3 | Conduct | Consumer protection gaps if retail is added | 3 | 3 | 9 | CCO | Retail added without regime | No retail before Gate 4 |
| TP1 | Third-party | Cloud/region concentration; OSFI third-party risk rules | 3 | 4 | 12 | CISO / COO | All nodes on one provider | Multi-provider; exit plan; testing against OSFI third-party expectations |
| TP2 | Third-party | Critical suppliers (HSM, proving library, consensus client maintainers) | 3 | 3 | 9 | CTO | Maintainer churn; CVE backlog | Supplier register; SBOM; support contracts |
| RP1 | Reputational | An early incident becomes a public trust event because the brand promised "zero par breaks" | 3 | 5 | 15 | Chair / Head of Comms | Marketing copy uses absolutes | Claims discipline (Section 6); incident-disclosure policy |
| RP2 | Reputational | "Banks vs crypto" or "cartel" narrative | 2 | 3 | 6 | Head of Comms | Media/political criticism | Open access; plain language |
| L1 | Legal | Liability allocation among participants for a defect or loss is unresolved | 4 | 4 | 16 | General Counsel | No agreed allocation by G1 | Rulebook loss-allocation; insurance; caps; participant agreement |
| L2 | Legal | Participant bank insolvency/resolution: treatment of tokens and settlement positions | 2 | 5 | 10 | General Counsel | Counsel opinion qualified | Opinions; CDIC/OSFI input; rules on failed-participant handling |
| L3 | Legal | Data sovereignty (foreign-law reach into Canadian cloud) | 3 | 3 | 9 | General Counsel / CISO | Provider structure exposes data | Canadian-controlled operating model; customer-managed keys |
| FN1 | Financial | Funding gap and bank exit | 3 | 4 | 12 | CFO | Funding commitments below 100% of next phase | Committed funding per gate; step-in and exit terms |
| FN2 | Financial | Prefunding traps liquidity | 4 | 3 | 12 | CFO / Treasury | Prefund above 10% of participants' HQLA sizing | Size positions from flows; intraday top-ups; central-bank arrangement |

### 3.2 Heat map (risk IDs by likelihood and impact)

| L \ I | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| **5** | | | | T4 | |
| **4** | | | T1, T3, O2, O5, FN2 | S4, R3, O1, L1 | **S1, S2, R1** |
| **3** | | | S6, R4, R5, T7, F2, C2, C3, TP2, L3 | S7, R6, F3, C1, TP1, FN1 | **S3, S5, R2, T2, O3, F1, RP1** |
| **2** | | | R7, RP2 | F4 | T5, O4, L2 |
| **1** | | | | | |

**Reading.** 15 of 41 risks score 15 or more, and 9 of those 15 are strategic, regulatory, or legal (S1-S5, R1-R3, L1). Only T2 and T4 are primarily technical. **The programme's risk is dominated by "will it be allowed and adopted," not "will the technology work."** That is the opposite of how the blueprint distributes attention.

### 3.3 The top-5 existential risks (pre-launch killers)

1. **R1: no settlement asset.** Without central-bank-money settlement of interbank positions, there is no legal finality and no interbank par. Prerequisite for everything else. Owner: Head of Regulatory Affairs, sponsored by the Chair.
2. **S1: six-bank bypass or absorption.** DepositX can be right and irrelevant. Owner: Chair and CSO.
3. **S2: governance deadlock or dominance.** Known to the KPMG draft as "High"; correctly so. Fix the vote structure before naming an operator.
4. **R2: legal finality and insolvency protection not established.** Invariant II is unsupported until it is.
5. **S3: no anchor use case that Lynx plus RTR cannot serve.** If discovery fails, everything technical was wasted.

**Post-launch existential (managed by design, not avoidable):** a par or reconciliation failure (T2, O3) amplified by overclaiming (RP1). The blueprint itself calls a par break "system-halting"; that is a reason to define, measure, and worded-claim it carefully (Sections 4 and 6), not a reason to promise zero.

---

## 4. Red-team of the blueprint

**Grades:** **Sound** (evidence supports it), **Plausible** (reasonable but untested), **Doubtful** (contradicted or needs heavy conditions), **Unsupported** (no evidence in the document or in what I could verify).

| # | Blueprint assumption | Grade | Why | Replacement |
|---|---|---|---|---|
| A-1 | A deposit token is a representation of an existing bank liability, not a new one | **Sound** | Consistent with OSFI's 10 Sept statement (technology does not determine legal nature) | Keep. Drop the word "bearer-recorded": a bearer instrument has different legal characteristics from an account-based deposit |
| A-2 | Redeemable 1:1, "CDIC-insurable wherever the underlying deposit is" | **Plausible** | CDIC has not, as far as I could verify, published explicit token guidance. Also mostly irrelevant to wholesale balances above the C$100k limit | "Each token balance maps to an identifiable deposit record designed to support CDIC coverage rules. CDIC treatment is subject to CDIC confirmation." Retail-only relevance |
| A-3 | Not a stablecoin, CBDC, MMF wrapper | **Sound** | Aligned with OSFI and the Stablecoin Act's scope (non-financial-institution issuers) | Keep |
| A-4 | Invariant I: "Par, always. Par break = system-halting event" | **Doubtful** | Par is a property of issuer solvency and interbank settlement, not of the network. A halt-on-any-break rule gives one issuer's problem power over all issuers and lets a rumour become a system stop | "Par is a legal obligation of each issuer. The network enforces 1:1 accounting and settlement, detects deviations within a stated time, and applies graded responses: issuer-level suspension first, network halt only for ledger integrity failure." Report as "0 in N", never "never" |
| A-5 | Invariant II: "Technical and legal finality in the same instant" | **Unsupported** | Legal basis not specified (Known issue). Settlement-asset gap (1.5) means legal finality of interbank obligations occurs later, or never | "Consensus finality in under 2 seconds. Legal finality as defined by the rulebook and, once obtained, designation under statute. Settlement in central-bank money per Mode 2 or 3. Gaps are stated and collateralised." |
| A-6 | Invariant III: everything inside the perimeter; operator never holds client money | **Plausible** | But Mode 2 involves a settlement agent holding central-bank-money positions for issuers | State exactly who holds settlement positions and under what legal form |
| A-7 | Tokens "fungible at par via settlement, never pooled" | **Plausible** | Requires a defined settlement asset (R1) | As A-5 |
| A-8 | Treasurers want sub-2s, 24/7 sweeps and supplier payments on goods scan | **Unsupported** | No customer evidence; RTR overlaps supplier payments | Discovery (2.3); treat as hypotheses |
| A-9 | Supervisory position query under 60 seconds from read-node | **Plausible** | Easy for on-ledger data; entity-level roll-ups depend on issuer data | "On-ledger positions per issuer under 60 seconds; entity-level roll-up in 15 minutes." Demonstrate in unscripted tests |
| A-10 | Non-goal: not displacing Lynx/RTR | **Sound** | But the 95% north star contradicts it | Keep; delete the 95% target |
| A-11 | North star: at least 95% of eligible wholesale interbank flow settle-able on DepositX by end of Phase 3 | **Doubtful** | "Eligible" is undefined; "settle-able" is a capacity claim not a usage claim; needs all banks; Samara found adoption slow | By use case: e.g., "at least 30% of participating banks' cross-bank own-account transfers and 100% of pilot-scope DvP cash legs run through DepositX by Gate 3", plus a published definition of eligible |
| A-12 | Finality under 2s median, under 5s p99 (instruction accepted to consensus final) | **Plausible** | Achievable for consensus within Canada (short regional distances). It excludes screening, ZK proving, and core posting | Two SLOs: network (consensus) p99 under 2s at 250 tps; end-to-end initiate-to-credit p95 under 10s including bank side |
| A-13 | Sub-2s finality "across regions" | **Plausible** | Canadian regions are close; measure, do not assume | Test in Phase 1 with realistic fault injection |
| A-14 | 99.999% availability, 24/7/365, no maintenance windows | **Doubtful** | About 5 minutes a year. Bank cores have batch windows; a multi-party network's availability is the product of its parts. The exit cannot be measured inside the phase (Known issue 2) | 99.95% network availability over 90 days at pilot exit; 99.99% by Gate 3; bank-side availability reported separately; rolling upgrades |
| A-15 | RTO under 15 min, RPO zero, 3 AZs, 2 regions | **Plausible** | RPO 0 across two regions couples availability to the inter-region link, which fights A-14 | Keep RTO/RPO; state that synchronous cross-region replication is a deliberate trade against availability |
| A-16 | Canadian data residency, including DR and keys | **Sound** as requirement; **Doubtful** as a sovereignty claim | Foreign-provider ownership can leave legal exposure | Requirement stays; claim becomes "stored in Canada" not "sovereign" |
| A-17 | BFT, deterministic finality; validators = issuers + operator + BoC observer | **Sound** for BFT; **Unsupported** for BoC | BoC participation "assumed, not confirmed" (Known issue 3). Observer nodes also add a non-voting party with no settlement role | Architecture must not depend on a BoC node. Ask BoC for a *settlement* role (R1), and offer data-feed read access |
| A-18 | ZK confidential balances at scale | **Doubtful** | Largest technical bet (Known issue 5); no fallback designed | Staged privacy: party-scoped data with hash commitments first; ZK optional and benchmarked on a small pilot; fallback designed before Phase 1 entry, not at exit |
| A-19 | Formal verification of par and settlement contracts | **Plausible** for a small kernel; **Doubtful** for the full set | Verification is tractable for a few thousand lines | Verify the kernel (mint, burn, transfer, atomic swap, par accounting); property-based testing and audits for the template library |
| A-20 | Reviewed template library only, no user-deployed contracts | **Sound** | Bounded attack surface | Keep |
| A-21 | Continuous reconciliation of token supply to deposit liabilities | **Doubtful** on legacy cores | Core-banking general ledgers update in batches | Mint only against a hold/lien in the core; intraday reconciliation at a defined interval; hard issuance limits |
| A-22 | Screening (sanctions, limits, Travel Rule) at mint/transfer/redeem within the sub-2s path | **Plausible** | Feasible only if screening rests on pre-attested participants and pushed list updates | Screen at the participant and instruction-batch level; publish latency budget |
| A-23 | ISO 20022 end to end | **Sound** | Lynx is on ISO 20022; RTR is data-rich | Keep |
| A-24 | One reference core-banking adapter | **Doubtful** | Large banks run heterogeneous cores; integration is the largest schedule risk (Known issue 7) | Integration tiers: (1) certified message-based interface built by the bank; (2) a reference adapter as an accelerator; (3) batch-bridge for legacy. Certification suite; bank-funded budgets |
| A-25 | Bank-hosted wallets; no direct customer access | **Sound** | Keeps the perimeter | Keep |
| A-26 | Throughput at least 5,000 instructions per second sustained, 20,000 burst | **Unsupported** | Not derived from any demand. Lynx is, to my recollection, in the tens of thousands of payments a day. Even a 10x uplift from 24/7 and programmability gives roughly 12 tps average and a few hundred at peak. The blueprint's target is on the order of 100 to 1,000 times that | Demand-derived: 250 tps sustained, 1,000 burst for Gate 3; scale test to 2,000 as capacity headroom. Re-derive after discovery |
| A-27 | "No bridges" | **Doubtful** | Every real design needs governed links (to Lynx/RTR, Swift, Agora-style platforms) | "No unsupervised bridges. A small number of governed interoperability links, each with a rulebook annex and risk assessment." |
| A-28 | Phase 0 (Q4 2026): operator incorporated with a neutral chair; architecture ratified | **Doubtful** | Three months, after 22 Sept; chair search and governance disputes take longer | Phase 0 runs to 31 Mar 2027. Interim chartered governance company by Feb 2027; operator form decided after options paper |
| A-29 | Phase 1 (H1 2027): 10,000 simulated transfers with zero par breaks | **Unsupported** as evidence | Zero events in 10,000 trials gives only about a 3-in-10,000 upper bound on failure rate at 95% confidence (rule of three). That is nowhere near a settlement-grade claim | Gate 1: at least 1,000,000 simulated transfers with zero unreconciled events (upper bound about 3 in a million), plus fault-injection scenarios and independent testing |
| A-30 | Phase 2 (H2 2027-H1 2028): live multi-issuer wholesale pilot, SOC 2 Type I, first external audit, formal verification, Travel Rule | **Doubtful** on dates | Requires settlement asset, supervisory non-objection, and multi-bank integrations in about 12 months | Live capped pilot 2028 (12 months). Cap: C$100M per issuer per day to start |
| A-31 | Phase 3 (H2 2028): all founding issuers live, 24/7/365; exit requires 99.999% for two quarters "within" the phase | **Doubtful** (Known issue 2 makes the exit impossible as dated) | Go-live and two quarters of measurement cannot both fit in H2 2028 | Split: 3a limited production Q1 2029; Gate 3 in Q4 2029 after two quarters of measurement |
| A-32 | Phase 4 (2029+): retail deposit tokens, unchanged deposit-insurance treatment | **Unsupported** | CDIC unconfirmed; RTR is the retail instant rail; consumer-protection regime absent | Remove retail from the plan. Revisit at Gate 4 only |
| A-33 | Cross-border PvP with peer networks by Phase 4 | **Plausible** | BoC is in Agora; Swift and Canton are moving | Interoperability MoUs from Phase 2; first corridor after Gate 3 |
| A-34 | PQ migration in Phase 4 | **Plausible** | Sensible, but late | Crypto-agility required from Phase 1; hybrid-signature pilot in Phase 3 |
| A-35 | Cost "9 figures" CAD over three years; peak build team 120-160; operator run team 40-60 | **Unsupported** | No breakdown (Known issue 6). My top-down envelope: build C$105M (140 people, 3 years, C$250k) plus 30-40% for infrastructure, audit, legal, security, plus 30% contingency, so roughly C$180-200M to limited production. Bank-side integration at perhaps C$10-25M a bank adds C$60-150M across six. Ecosystem total roughly C$250-350M. Run cost about C$30-40M a year | Replace with a bottom-up cost model by G0 (±25%) and funding commitments |
| A-36 | Programme risk ratings: liquidity fragmentation "Medium"; CDIC "High" | **Doubtful** | Fragmentation and governance are the existential risks; CDIC matters chiefly for retail | Adopt this memo's register |
| A-37 | An operator entity must be newly created | **Unsupported** | Alternatives (Payments Canada extension, joint venture, vendor-operated) not evaluated | Options paper by day 30; decision by day 45 (Section 7) |
| A-38 | Brand line: "settles in under two seconds with legal finality" | **Unsupported** | Legal finality unestablished (A-5); the line is in the brand voice guide as a preferred phrase | "Reaches consensus finality in under two seconds (median, measured). Legal finality per the rulebook." Reissue only when evidence permits |
| A-39 | Premise text: "without ever breaking par" | **Doubtful** | Absolute claim | "Built so every token remains redeemable at par at its issuing bank" |
| A-40 | Threat model completeness | **Doubtful** | Omits settlement-asset failure, participant insolvency, weekend run, and liability allocation | Add R1, L2, O4, L1 to the threat model |

---

## 5. Decision gates

### 5.1 Who decides

- **Gate Committee:** the independent chair (chairs, casts a deciding vote only on ties), two independent directors (one with risk/regulatory background), and one senior executive per founding issuer. BoC, OSFI, FINTRAC and CDIC are **invited non-voting observers**. Their non-objection is an input, not a vote.
- **Decision rule:** GO requires two-thirds of founding issuers by count *and* by share of committed funding, *and* CRO independent assurance sign-off. NO-GO requires only a majority. PIVOT requires a simple majority.
- **Independence:** the CRO reports to the independent directors on gate evidence.
- **Standing kill triggers (any time):** a loss of client money attributable to DepositX; a regulator's written objection; withdrawal of funding commitments below 100% of the next phase.

### 5.2 Gates

| Gate | Date | GO if all true (thresholds) | NO-GO if any true | PIVOT if |
|---|---|---|---|---|
| **G0** End of Phase 0 | 31 Mar 2027 | (1) Six-bank position resolved (A/B/C) in writing, with 4+ banks incl. 2 of the top 3 committing to fund Phase 1; (2) BoC/Payments Canada written response on settlement asset (Mode 2 or 3 pathway); (3) governance charter adopted with vote caps and independent chair; (4) discovery complete: 60 interviews, 8+ corporate and 3+ dealer LOIs, indicative flow at least C$1B/day, at least one use case scoring "high value, low RTR overlap"; (5) bottom-up cost model ±25% and Phase 1-2 funding 100% committed; (6) two legal opinions on finality and perimeter; (7) competition-law protocol signed off | Fewer than 3 banks commit; BoC declines any settlement role; no use case with 5+ repeat counterparties | Path C (second tier), Path B (standard body) or Path D |
| **G1** End of Phase 1 (testnet) | 15 Dec 2027 | (1) 3+ issuer nodes on testnet, 2+ on a real bank-side integration (not mocks); (2) at least 1,000,000 simulated transfers with zero unreconciled events; (3) 500+ fault-injection scenarios, all Sev-1 closed; (4) consensus p99 under 5s at 100 tps sustained, 500 burst; (5) privacy design final: ZK meets at least 100 tps at target latency, or fallback adopted; (6) PFMI gap assessment with no open "high" gaps; (7) regulator letter of non-objection to a capped live pilot; (8) cost variance under 15%; (9) 5+ corporate/dealer pilot contracts signed | Fewer than 2 issuers will go live; settlement asset still unresolved; a critical audit finding open | Path A (single use case) |
| **G2** End of Phase 2 (12-month live pilot) | 15 Dec 2028 | (1) 3+ issuers and 15+ live clients; (2) cumulative settled value at least C$50B (about C$200M a day average); (3) network availability at least 99.95% over the last 6 months; (4) no unreconciled supply event over 15 minutes; par exceptions reported as 0 in N with N above 10 million; (5) DR drill, RTO under 15 minutes, at least 4 successful runs; (6) independent audit with no open critical or high findings; SOC 2 Type II period under way; (7) supervisory non-objection to lift caps; legal finality route confirmed in writing; (8) 80%+ of pilot clients active in the last 8 weeks; (9) run-cost recovery path at least 70% at planned Gate 3 volumes | Any client-money loss; settlement asset not in place; clients below 8; availability under 99.9% | Extend once (max 2 quarters); Path A |
| **G3** After two full quarters of production | Q4 2029 | (1) At least 4 issuers live; (2) network availability at least 99.95% for two consecutive quarters (99.99% target); (3) at least 10% of defined eligible flow in the anchor use case among participating banks; (4) fees cover at least 100% of run costs on the year-2 plan; (5) independent PFMI assessment "observed" or "broadly observed" with plan; (6) supervisory query under 60 seconds demonstrated in 4 unscripted tests; (7) no unresolved Sev-1 incident | Availability under 99.9%; fee coverage under 70% with no path; regulator objection | Path A (wind back scope); Path B |
| **G4** Retail / cross-border expansion | Not before 2030 | CDIC written confirmation; consumer-protection regime agreed with regulators; RTR interoperability assessed; at least 1 cross-border corridor running under supervision; PQ hybrid signatures deployed | CDIC or regulators object; retail economics negative | Stay wholesale |

### 5.3 Scope-down paths if a gate fails

| Path | What it is | Trigger | Size and effect |
|---|---|---|---|
| **A. Wholesale single-use-case network** | Bank-to-bank/dealer cash-leg DvP (Samara lineage) and interbank weekend liquidity, 3 banks, no corporate access, permissioned-privacy fallback instead of ZK | G1 or G2 stumble on settlement/timeline; discovery shows only wholesale demand | Run team 15-20; cost about 30-40% of base; production about 2 quarters after G2 |
| **B. Standard and certification body** | DepositX publishes the rulebook, interface spec, and certification suite; runs no production ledger; the six's initiative or a vendor operates | Six banks proceed without an operator role for DepositX | Team about 10-15; keeps the standard-setting asset and ISO 20022 discipline |
| **C. Second-tier network and interoperability layer** | DepositX serves institutions the six's rail does not (credit union centrals, Desjardins, mid-size and foreign-bank subsidiaries, other regulated deposit-takers), interoperable with the six | Six proceed and are open in principle | Smaller economics; realistic if access rules are fair |
| **D. CAD gateway to global networks** | DepositX's CAD deposit tokens are made available on Canton, Swift ledger, or Kinexys | Domestic demand fails but cross-border demand exists | Requires BoC/legal work on cross-ledger finality |
| **E. Sunset** | Wind down; publish learning, specifications, and test artefacts | Two consecutive gate failures or standing kill trigger | Budget a wind-down reserve (about 3 months of run cost) from the start |

---

## 6. Metrics, and how claims are worded

### 6.1 Metrics beyond the blueprint's north stars

The north stars (zero par breaks, finality, 95% flow, 60-second query) do not show whether DepositX is *useful* or *safe to scale*. Track these, with definitions published and audited.

| Domain | Metric | Target at G2 / G3 |
|---|---|---|
| **Adoption** | Live issuers; live clients; active clients in the last 8 weeks; value settled by use case | 3 / 4+ issuers; 15+ clients; 80%+ active |
| **Liquidity** | Share of participating banks' eligible cross-bank flow via DepositX (defined per use case); routing fallback rate to RTR/Lynx | 10%+ at G3 |
| **Concentration** | Share of volume from the top issuer; Herfindahl index of participants | Top issuer under 40% |
| **Integrity** | Unreconciled supply minutes; time to detect and clear exceptions; reconciliation coverage | Zero over 15 minutes; detect under 5 minutes |
| **Reliability** | Network availability (rolling 90 days); end-to-end p95; consensus p99; DR drill success | 99.95% / 99.99%; p95 under 10s |
| **Compliance** | Screening false positive rate; alert-to-clear time; STR filing lag; open audit findings by severity | No open high |
| **Supervision** | Supervisory query time (unscripted); regulator requests closed on time | Under 60s on-ledger |
| **Economics** | Cost per instruction; fee coverage of run cost; participant NPV; integration cost per bank versus plan | 70%+ / 100%+ coverage; within 15% |
| **Client** | Onboarding time per bank (weeks); client onboarding time; NPS among treasurers | Trending down |
| **Stability** | Net weekend outflows per issuer; velocity-limit triggers; stress-test results | No limit breach |
| **Governance** | Decision cycle time; count of deadlocks; independent director attendance | Under 30 days; zero deadlocks |
| **Trust** | Incident disclosure time; claims corrected or withdrawn | Disclose within 24 hours |

**Anti-metrics.** Exclude intra-group and circular transfers from volume claims, and publish that exclusion. Reward retained clients, not gross volume.

### 6.2 Claims discipline (ties to the blueprint's "plain, precise, cited" voice)

The brand rule says to be cited. The blueprint's own recommended sentence ("settles in under two seconds with legal finality") is not currently supportable. Adopt this rule:

> **No public claim without a claim ID, an evidence source, a date, an owner, and a re-verification date within 90 days. Claims that lose evidence are withdrawn within 48 hours.**

| Claim (v0.9 phrase) | Evidence needed | Approved wording now | Approved wording when evidence exists | Never say |
|---|---|---|---|---|
| "Zero par breaks" | Definition of a par break (any credit or redemption not 1:1 to the issuer's liability, or unreconciled supply over tolerance for more than 15 minutes); audited counts | "Designed so each token remains redeemable at par at its issuing bank. In testing to date: 0 par exceptions in N transfers (upper bound at 95% confidence: 3/N)." | "0 par exceptions in N settled instructions over D days, as of [date]; definition and audit report at [link]." | "Never breaks par"; "zero risk"; "guaranteed" |
| "Regulated" | Which regulator supervises which entity, in writing | "Designed against OSFI and PFMI expectations. Issuers are OSFI-regulated banks." | "Operated by [entity], [designated/overseen] under [statute] by [authority]." | "Regulator-approved"; "fully compliant"; "regulated network" (before designation) |
| "Legal finality" | Two legal opinions; designation or equivalent; rulebook | "Reaches consensus finality in under two seconds (median, measured)." | "Settlements are final under [statute/rulebook clause]." | "Instant legal finality" before then |
| "CDIC-insurable" | CDIC written confirmation | "Deposits underlying tokens are deposits at a regulated bank. CDIC coverage rules apply to the underlying deposit; CDIC's treatment of the token form is pending." | As CDIC confirms | "Insured tokens"; "fully protected" |
| "24/7/365" | Measured availability | "Built to operate around the clock. Measured network availability: X% over the last 90 days." | Same | "Always on"; "never down"; "five nines" before measured |
| "Sub-two-second" | Published percentile method | "Median consensus finality Ys, p99 Zs, as of [date], on [load]." | Same | "Instant"; "lightning-fast" |
| "Not a stablecoin" | Legal characterisation | "A deposit at a regulated bank, recorded on a shared ledger." | Same | "New digital currency" |
| "The clearing house, re-issued" | Governance in fact | Use only if governance and access rules are published | Same | "Standard" for anything not yet ratified |

**Incident honesty rule.** Publish a plain-language incident summary within 24 hours of any Sev-1, whether or not clients were affected. Brand value comes from being cited and correct, not from having a spotless record.

---

## 7. 30/60/90-day plan (2026-09-25 to 2026-12-24)

**Roles used:** Chair; Programme Director (interim CEO); CSO; CRO; General Counsel (GC); Head of Regulatory Affairs (HRA); CTO; CISO; CFO; Head of Product/Adoption (HPA); CCO (Chief Compliance Officer); Head of Comms; bank executive sponsors (BES, one per founding bank).

### 7.1 Decisions the founders must make in the first 30 days

| # | Decision | Recommended answer | By |
|---|---|---|---|
| D1 | Relationship to the 22 Sept six-bank initiative: which of A/B/C/D | Open outreach now; aim for B, floor at C; decide after first contact | 9 Oct |
| D2 | Founding membership and governance principles | Vote caps (no group above 15%), independent chair, two independent directors, two-thirds by count and value on risk rules | 23 Oct |
| D3 | Scope | Wholesale only; formally retire the 2029 retail phase and the 95% target; adopt the replacement north stars | 16 Oct |
| D4 | Settlement-asset approach to take to BoC and Payments Canada | Mode 2 (prefunded positions) as the proposal; Mode 3 as the aspiration | 16 Oct |
| D5 | Operator form | Options paper (new company, Payments Canada extension, JV, vendor-operated); decide at day 45 | 23 Oct (paper) |
| D6 | Phase 0 budget and cost-sharing key | Indicative C$6-10M for six months (secondees, advisers, counsel, discovery); equal base plus volume-weighted share | 23 Oct |
| D7 | Technology stance | Ledger-neutral specification; competitive RFI; demand-derived sizing (250 tps sustained); design the ZK fallback now | 23 Oct |
| D8 | Competition-law protocol | Counsel-drafted; clean team; no client-level or price data shared among banks | 2 Oct |
| D9 | Independent chair and directors | Launch search; interim chair acts | 9 Oct |
| D10 | Public communications | Freeze on any claim not in the claims register; single spokesperson | 2 Oct |
| D11 | Adopt this memo's gates and dates as the working baseline | Yes, subject to amendment | 23 Oct |

### 7.2 Days 1-30 (25 Sept - 23 Oct)

| When | Action | Owner | Output |
|---|---|---|---|
| Week 1 (by 2 Oct) | Stand up programme office; appoint interim Programme Director | Chair | Charter, budget request |
| By 2 Oct | Engage antitrust counsel; adopt clean-team protocol | GC | Protocol memo (D8) |
| By 2 Oct | Communications freeze; claims register template | Head of Comms, CCO | Register v0 (D10) |
| By 2 Oct | Confirm founders' relationship to the six-bank announcement; first calls with the six | Chair, CSO | Fact sheet on the six's plans and contacts |
| By 9 Oct | Decide D1 and D9 | Board | Written decisions |
| By 9 Oct | Request meetings: BoC (payments oversight), Payments Canada, OSFI, FINTRAC, CDIC, Department of Finance, Competition Bureau | HRA | Meeting calendar; read-ahead pack |
| By 16 Oct | Obtain RTR rules, value limits, settlement design, Lynx hours from Payments Canada | HRA | RTR/Lynx fact base (fills the gaps in my ledger) |
| By 16 Oct | Settlement-asset options paper (Modes 1-3) | HRA, CTO, GC | Paper and draft ask for BoC |
| By 16 Oct | Discovery design: hypotheses H1-H7, screener, interview guide, recruit list of 60 | HPA, CSO | Ready to start interviews 12 Oct |
| By 23 Oct | Operator options paper; funding and cost key; gate framework tabled | CSO, CFO, GC | Board pack for D2, D5, D6, D11 |
| By 23 Oct | Risk register v1 (this memo's register, owners confirmed); threat model gap list | CRO, CISO | Register with named owners |
| By 23 Oct | RFI for ledger platform and integration partners (vendor neutral) | CTO | RFI issued |
| By 23 Oct | Demand-derived sizing model (tps, latency) | CTO | Requirement replacing 5,000 tps |

### 7.3 Days 31-60 (24 Oct - 24 Nov)

| Action | Owner | Output |
|---|---|---|
| Discovery interviews: 20 complete by 13 Nov, 30 by 24 Nov | HPA | Interview log; interim findings |
| First regulator meetings held; written questions on finality, settlement asset, CDIC, PCSA route | HRA, GC | Responses tracked; gaps list |
| Commission two independent legal opinions (finality/insolvency/perimeter) | GC | Engagement letters; scope |
| Bottom-up cost model v1 (build, run, bank-side integration by bank) | CFO, CTO, BES | Model with ±25% range |
| Governance term sheet (votes, admission, exit, IP, loss allocation) | GC, Chair | Term sheet for all founders |
| Operator form decision (D5) | Board | Decision at day 45 (about 9 Nov) |
| Integration assessment: core-banking landscape per founding bank; tier assignment | CTO, BES | Integration heat map |
| Prototype the hold-based mint and reconciliation design on paper; formal-methods scope | CTO | Design note |
| ZK fallback design (party-scoped confidentiality) | CTO, CISO | Design note |
| Claims register populated; brand voice guide amended per Section 6 | Head of Comms, CCO | v1 |

### 7.4 Days 61-90 (25 Nov - 24 Dec; board on 18 Dec because of the holiday period)

| Action | Owner | Output |
|---|---|---|
| Complete 60 interviews by 18 Dec; synthesis | HPA, CSO | Scorecard and price curves (2.3) |
| Collect LOIs: target 8 corporate, 3 dealer | HPA, BES | LOIs |
| Draft roadmap v1.0 with gates G0-G4 (Section 5) | CSO | Executable plan |
| Shortlist 3 technology stacks from RFI; proof-of-concept plan | CTO | Shortlist and plan |
| Draft rulebook v0 outline aligned with PFMI | GC | Outline |
| Regulator pre-consultation package (OSFI consultation before novel products) | HRA | Package to OSFI, BoC, FINTRAC, CDIC |
| Funding commitments for Phase 0 completion and Phase 1 | CFO, Chair | Signed letters |
| Board 18 Dec: approve or amend the plan; confirm Phase 0 through 31 Mar 2027; decide anchor-use-case shortlist and vendor shortlist | Board | Decisions |

### 7.5 What "good" looks like at day 90

- Written position from the six banks on how DepositX relates to them.
- A regulator response on the settlement asset, even if provisional.
- 60 interviews, 8+ corporate and 3+ dealer LOIs.
- Bottom-up cost model and funding commitments.
- Independent chair search under way; operator form chosen.
- A public claims register and a communications freeze in force.

If two or more of these are missing at day 90, the CRO must report to the independent directors that G0 is at risk, and the board should choose Path B or C before spending Phase 1 money.

---

## Sources

Primary or near-primary:
- Bank of Canada, Project Samara staff analytical paper (Mar 2026): https://www.bankofcanada.ca/2026/03/staff-analytical-paper-2026-8/
- Bank of Canada joins BIS Project Agora (May 2026): https://www.bankofcanada.ca/2026/05/bank-canada-joins-bis-project-agora-test-improvements-wholesale-cross-border-payments/
- Bank of Canada, Stablecoins oversight page: https://www.bankofcanada.ca/regulatory-oversight/stablecoins/
- OSFI, Capital and Liquidity Treatment of Crypto-asset Exposures (Banking) Guideline (2027): https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/capital-liquidity-treatment-crypto-asset-exposures-banking-guideline-2027
- Payments Canada, Real-Time Rail: https://www.payments.ca/systems-services/payment-systems/real-time-rail-payment-system
- Payments Canada, Lynx ISO 20022: https://www.payments.ca/bringing-data-rich-high-value-payments-canada-lynx-fully-adopts-iso-20022-standard
- J.P. Morgan, Kinexys 2026 milestones: https://www.jpmorgan.com/payments/newsroom/kinexys-milestones-2026
- BIS, Project Agora press release: https://www.bis.org/press/p260527.htm
- SNB, Project Helvetia: https://www.snb.ch/en/the-snb/mandates-goals/payment-transactions/projekt_helvetia
- ECB, Pontes launch: https://www.ecb.europa.eu/press/pr/date/2026/html/ecb.pr260921~e754847a7b.en.html
- UK Finance, GBTD initiative: https://www.ukfinance.org.uk/tokenised-sterling-deposits
- HSBC Tokenised Deposit Service: https://www.business.hsbc.com/en-gb/products/tokenised-deposit-service
- LSEG/Partior DiSH release: https://www.lseg.com/en/media-centre/press-releases/2026/partior-lseg-dish-always-on-settlement-bank-liquidity-cross-border-payments-network
- Swift ledger release (page blocked; content via search): https://www.swift.com/news-events/press-releases/swifts-blockchain-ledger-ready-use-17-banks-set-pioneer-tokenised-cross-border-payments-trusted-global-infrastructure

Secondary (treat as reported):
- CoinDesk, six banks: https://www.coindesk.com/business/2026/09/22/canada-s-big-six-banks-unite-to-launch-interbank-tokenized-deposit-initiative
- Cointelegraph: https://cointelegraph.com/news/canada-six-largest-banks-explore-tokenized-canadian-dollar-deposits
- American Banker: https://www.americanbanker.com/news/canadas-biggest-banks-team-up-on-tokenized-deposits
- Tech Times: https://www.techtimes.com/articles/327948/20260923/tokenized-deposits-canada-big-six-banks-build-stablecoin-defense-shared-blockchain.htm
- Cryptopolitan: https://www.cryptopolitan.com/canada-big-six-banks-tokenized-deposit-rails/
- Yahoo Finance on OSFI: https://finance.yahoo.com/markets/crypto/articles/canada-clears-tokenized-bank-deposits-102221740.html
- The Industry Spread on Partior settlement (fetch timed out): https://theindustryspread.com/partior-lseg-dish-settlement-bank-leg-q1-2027/
- Citi coverage: https://www.americanbanker.com/payments/news/citi-wins-bank-support-for-tokenized-deposit-tools
- CoinDesk on Swift ledger: https://www.coindesk.com/business/2026/07/09/swift-rolls-out-24-7-blockchain-payment-systems-with-17-global-banks-across-six-continents
- Ledger Insights on HSBC/Canton: https://www.ledgerinsights.com/hsbc-conducts-tokenized-deposit-pilot-on-canton-network/

**Figures that are my own estimates, not sourced:** deposit market shares (2.1); idle-day carry (2.3 H2); run cost, break-even volume, and programme cost envelope (2.4, A-35); Lynx daily transaction counts and the demand-derived tps range (A-26); prefunding sizes. Each should be replaced with bank and Payments Canada data in Phase 0.
