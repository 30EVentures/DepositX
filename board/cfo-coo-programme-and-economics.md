# DepositX Network: Programme Plan and Business Model

**Seat:** Chief Financial Officer and Chief Operating Officer / Programme Director, founding board
**Date:** 25 September 2026
**Status:** Board memo, v1.0. All figures CAD, constant 2026 dollars, unless stated.
**Source:** Blueprint v0.9 (KPMG, 2 Sep 2026), including its "Known issues" list.
**Convention:** Every number below is either (a) an assumption, labelled as such, or (b) arithmetic on stated assumptions, shown so it can be challenged. Anything I recall about outside benchmarks (fees, volumes, timelines of other programmes) is marked **[verify]**; do not quote it externally until checked. Legal and regulatory points are hypotheses for counsel, not opinions.

---

## 0. Executive summary

### 0.1 What the blueprint says, and what I conclude

| Blueprint statement | My finding |
|---|---|
| "9 figures CAD over ~3 years, shared" | Technically supportable, practically uninformative. Base case to end of Phase 3 is **$473M** for the whole ecosystem (low $317M, high $821M). Every case sits in the 9-figure band, but the base is 2 to 4 times what most readers will anchor on ($100M to $250M), and the high case is within $179M of ten figures. |
| "Peak build team 120-160 across all participants" | The operator's own build team peaks at about 126 to 140 FTE, which fits the range. It is the operator only. Six founding banks add roughly 140 to 180 FTE of their own. **Ecosystem peak is about 320 FTE.** |
| "Operator run team 40-60" | That is the 24/7 operations subset. A licensed FMI utility that also changes its software, runs security and compliance, and serves members needs about **100 FTE** at steady state. |
| "Phase 3 Production H2 2028" | Not achievable. Base plan: capped pilot February 2029, **Production 30 November 2029**, accepted September 2030. Downside: Production 30 November 2030. Regulatory non-objection is the critical path. |
| No revenue model | Cost-recovery utility. Steady-state run cost is about **$58.8M/yr**. On my base volume assumption the network needs roughly $0.64 average net per instruction plus $13.4M/yr of participation fees; the founders' build capital is not recoverable from wholesale-only volumes. |

### 0.2 Headline numbers (base case unless stated)

| Item | Low | **Base** | High |
|---|---:|---:|---:|
| Operator programme cost, Phases 0 to 3 ($M) | 174.4 | **258.2** | 444.3 |
| Six founding banks' internal cost, Phases 0 to 3 ($M) | 142.8 | **215.1** | 376.5 |
| **Ecosystem total to end of Phase 3 ($M)** | **317.2** | **473.3** | **820.8** |
| Operator funding envelope incl. capital buffer and ramp deficits ($M) | 243.6 | **330.8** | 522.6 |
| Steady-state operator run cost ($M/yr) | 52 | **58.8** | 70.2 |
| Production go-live date | 30 Sep 2029 | **30 Nov 2029** | 30 Nov 2030 |
| Tier A bank: 10-year NPV at 9% of joining ($M) | -99 | **-78** | +58 |

### 0.3 Six decisions I ask the board to take now

1. **Adopt the base plan of record** (Section 4) and stop using the KPMG dates. Communicate quarters, not days. The outer commitment date to banks and regulators is P80, which is November 2030.
2. **Fund on gates, not on a lump sum.** Six tranches (Section 2.3); no tranche released without its gate. First tranche is $12.9M (pre-formation, equal shares).
3. **Structure operator funding as equity with a return-of-capital cap**, not debt or profit-seeking equity. Recommend cost-recovery stance (Section 3.2).
4. **Adopt the anti-domination governance package** (Section 2.5): 50/50 equal/usage contribution weights with a 25% cap, triple majority on economic matters (board, weight, and 4 of 6 founders by head), two-thirds by head on reserved matters, four independent directors, independent Design Authority.
5. **Require each founding bank's CFO to validate its own benefit case by Gate G1** (March 2028), against the Go / Conditional / Stop bands in Section 3.6. The quantified base case does not clear a 9% hurdle without those validated benefits.
6. **Re-scope three blueprint targets that drive cost or cannot be met as written** (Section 0.4): the availability gate, the 5,000 instr/s provisioning, and the 10,000-transfer par test.

### 0.4 Resolution of the blueprint's known issues (finance and programme seat)

| # | Known issue | Resolution proposed |
|---|---|---|
| 1 | Title says four phases, defines five | Call it the **five-phase plan (Phases 0 to 4)**. Fix in v1.0. |
| 2 | Phase 3 exit needs 99.999% for two quarters inside a phase that contains go-live | **Split Phase 3** into 3a (onboard, go live, cap lift) and 3b (sustain and accept). The availability test moves to Gate **G3b**, measured over the first two full quarters after go-live. Also challenge the number: 99.999% is 77.8 seconds of downtime per 90-day quarter (90 x 86,400 x 0.001% = 77.8 s). One incident fails the gate. Recommend the **gate at 99.99%** (13.0 minutes per quarter) and keep 99.999% as the design target and Phase 4 exit. |
| 3 | Bank of Canada as validator/observer node assumed | Register as **Dependency D1** with a written-confirmation deadline of G0-R (June 2027). Fallback: BoC receives a supervisory read-node feed rather than running a consensus node. Cost effect is small; the settlement-anchor role is the real unknown (see Section 4.4). |
| 4 | Legal finality asserted, basis unspecified | Treat as **the critical-path workstream**. Hypothesis for counsel: designation and oversight under the Payment Clearing and Settlement Act regime plus rulebook and insolvency-protection analysis **[verify]**. Costed in Legal/regulatory (Section 1.5). |
| 5 | ZK + formal verification + 5,000 tps is the largest technical bet; fallback not designed | **Fund the fallback design now** (about $1.5M inside the Ledger pod in Phase 1) and put a hard decision at December 2027, before contract freeze. Costed as lever L1 (Section 1.9). |
| 6 | No cost breakdown, funding or revenue | This memo. |
| 7 | No large-bank onboarding model | Integration tiers A/B/C, five readiness stages BR0 to BR4, wave plan, and separate bank-side costing (Sections 1.7 and 4.5). |

Two further findings from my seat that the blueprint does not list:

- **Capacity target versus demand.** 5,000 instr/s sustained is 432M instructions a day. My high volume scenario (250M a year) averages **7.9 instructions per second**. The target is about 600 times the high-case average. It drives cloud, HSM, verification and bank node sizing. It is a Phase 4 retail sizing, not a wholesale Phase 3 need.
- **The "10,000 simulated transfers" Phase 1 test proves almost nothing.** At the 5,000/s target, 10,000 transfers is 2 seconds of traffic. Recommend at least 100 million transfers in soak simulation with fault injection (about 5.6 hours at 5,000/s) as the par-break evidence.

---

## 1. Programme cost model

### 1.1 Basis and scope

**Time windows.** I model non-overlapping cost windows so no person is counted twice. Phase windows are chosen to match the schedule in Section 4.

| Phase | Base window | Months | Low (best case) | High (downside) |
|---|---|---:|---|---|
| 0 Foundations and mobilisation | Oct 2026 to Mar 2027 | 6 | Oct 2026 to Feb 2027 (5) | Oct 2026 to Jun 2027 (9) |
| 1 Sandbox testnet | Apr 2027 to Mar 2028 | 12 | Mar 2027 to Jan 2028 (11) | Jul 2027 to Sep 2028 (15) |
| 2 Regulated pilot | Apr 2028 to Sep 2029 | 18 | Feb 2028 to Apr 2029 (15) | Oct 2028 to Jun 2030 (21) |
| 3 Production (3a go-live, 3b accept) | Oct 2029 to Sep 2030 | 12 | May 2029 to Mar 2030 (11) | Jul 2030 to Sep 2031 (15) |
| **Calendar span** | Oct 2026 to Sep 2030 | **48** | 42 months | 60 months |

**Cost is measured to Gate G3b** (Production accepted), not to go-live. Base ecosystem cost to go-live (30 Nov 2029) is about $330M to $360M of the $473M total (Phases 0 to 2 are $300M, plus the first two months of Phase 3 at its front-loaded cut-over cost); the rest is the ten months of live operation and acceptance that the blueprint's "Phase 3" includes.

**Key assumptions (all challengeable):**

- A1. **Six founding issuers**: four large "Tier A" banks with complex legacy cores and two mid-sized "Tier B" banks. The blueprint does not fix the number; the cost scales roughly linearly on the bank side and weakly on the operator side.
- A2. Operator is a new federal corporation, employer of record, with its own risk and finance functions.
- A3. Platform stack is chosen by April 2027 (commercial support on an open-source-based enterprise ledger; not selected here).
- A4. No new statute is required. If one is, every date moves right by 18 to 36 months (Section 7, kill criteria K1/K2).
- A5. Constant 2026 dollars. **Excluded:** wage and price inflation (add about 5%, roughly $20M to $25M); irrecoverable sales tax on external spend, since financial services are largely exempt supplies (potential $8M to $12M, tax counsel to confirm **[verify]**); SR&ED or other credits; interest income; Phase 4.
- A6. Base durations and FTE are averages inside each window; peaks are 5% to 10% higher.
- A7. FTE counts include employees, secondees and contractors/SI staff. Permanent employees lag the total by two to three quarters (Section 5.4).

### 1.2 Rate card (Canadian market, loaded)

**Loaded cost = base salary x 1.40.** Components: employer payroll taxes, benefits and pension about 17% to 18%; bonus/LTIP about 10% to 12%; tooling, workspace, training and overhead about 8%. (1.30 x 1.08 = 1.40.) Executives use 1.5 because of long-term incentive. Salary bands are my estimates for Toronto, Montreal and Ottawa in 2026; **validate against a compensation survey and the executive-search talent map (Section 5.7)**.

| Role family | Base salary band ($k) | Loaded used ($k/FTE-yr) |
|---|---|---:|
| Executive (CEO, CFO, COO, CRO) | 400 to 500 | 650 |
| Principal engineer, architect, cryptographer | 220 to 280 | 340 |
| Senior engineer | 165 to 185 | 245 |
| Mid engineer, QA/SDET | 120 to 140 | 180 |
| Security, HSM, key-management specialist | 170 to 210 | 265 |
| ISO 20022 / product / business analyst | 130 to 165 | 205 |
| In-house counsel and regulatory affairs | 230 to 300 | 360 |
| PMO / technical programme manager | 130 to 170 | 210 |
| SRE | 135 to 170 | 215 |
| NOC operator (24/7, with shift premium about 12%) | 85 to 110 | 150 |
| SI / contractor, blended (about 215 billable days at $1,100 to $1,600/day) | n/a | 300 |
| Boutique specialist (ZK, formal methods; $1,800 to $2,500/day) | n/a | 390 to 540 |
| Bank-internal blended (60% staff at $205k, 40% contractors at $300k) | n/a | 240 |

**Pod blended rates used in the model ($k/FTE-yr)**: Ledger 330; Settlement 285; Compliance and Identity 255; Integration/SDK and Onboarding 270; Security and SRE 270 (240 in Phase 3 as NOC operators dilute the mix); Rulebook (legal/regulatory) 340; PMO/Design Authority/QA 250; Operator corporate 400 / 440 / 370 / 335 by phase (a small, executive-heavy team that dilutes as finance and HR staff join).

**Peak workforce mix (operator, about 126 FTE):** about 60 employees, 18 secondees, 48 SI/contractor/boutique. Resulting blended rate by phase: Phase 0 $314k, Phase 1 $303k, Phase 2 $292k, Phase 3 $279k per FTE-year (labour dollars divided by FTE-years).

### 1.3 Operator headcount by pod and phase (base, average FTE in window)

Six delivery pods from the blueprint, plus two enabling functions I add. Pod 6 in the blueprint is "Rulebook"; I take it to include legal, regulatory affairs and membership.

| Pod / function | Layers | P0 | P1 | P2 | P3 | FTE-years (window-weighted) |
|---|---|---:|---:|---:|---:|---:|
| 1 Ledger (consensus, contracts, par module, ZK) | L1, L2 | 2 | 13 | 20 | 16 | 60.0 |
| 2 Settlement (DvP/PvP, templates, netting) | L3 | 1 | 9 | 15 | 14 | 46.0 |
| 3 Compliance and Identity | L4 | 1 | 7 | 12 | 12 | 37.5 |
| 4 Integration/SDK and Onboarding (gateway, ISO 20022, reference adapter, bank certification) | L5 | 2 | 11 | 22 | 26 | 71.0 |
| 5 Security and SRE (keys, HSM, infra, observability, NOC build then run) | Cross-cutting | 3 | 9 | 18 | 34 | 71.5 |
| 6 Rulebook (rulebook, legal, regulatory, membership) | L0 | 8 | 8 | 9 | 8 | 33.5 |
| Programme Office, Design Authority, QA and assurance | n/a | 6 | 11 | 18 | 14 | 55.0 |
| Operator corporate (CEO, CFO, risk, HR, finance, procurement) | n/a | 5 | 8 | 12 | 16 | 44.5 |
| **Operator total** | | **28** | **76** | **126** | **140** | **419.0** |

Check: 28 x 0.5 + 76 x 1 + 126 x 1.5 + 140 x 1 = 14 + 76 + 189 + 140 = 419.0 FTE-years.

**Ecosystem headcount (base):**

| | P0 | P1 | P2 | P3 |
|---|---:|---:|---:|---:|
| Operator (above) | 28 | 76 | 126 | 140 |
| Tier A bank, each (x4) | 4 | 10 | 28 | 36 |
| Tier B bank, each (x2) | 2 | 5 | 14 | 18 |
| Six banks combined | 20 | 50 | 140 | 180 |
| **Ecosystem** | **48** | **126** | **266** | **320** |

Blueprint says 120 to 160 across all participants. Operator alone matches; ecosystem is about twice the top of that range.

### 1.4 Operator cost by phase and category (base, $M)

Contingency rates: P0 10%, P1 20%, P2 25%, P3 20% of the pre-contingency subtotal, stepping with residual uncertainty. Split of the 21.6% overall: about 15 points project contingency held by the Programme Director and about 6.6 points management reserve held by the Steering Committee.

| Category | P0 | P1 | P2 | P3 | Total | % |
|---|---:|---:|---:|---:|---:|---:|
| Labour (FTE x years x blended rate) | 4.4 | 23.0 | 55.1 | 39.1 | 121.6 | 47% |
| Vendor and licensing | 0.5 | 4.0 | 9.0 | 6.0 | 19.5 | 8% |
| Cloud, HSM and infrastructure | 0.2 | 2.5 | 8.0 | 10.0 | 20.7 | 8% |
| Audits and certifications | 0.3 | 1.5 | 8.0 | 4.5 | 14.3 | 6% |
| Legal and regulatory (external) | 4.0 | 2.5 | 4.0 | 3.0 | 13.5 | 5% |
| Advisors and independent assurance | 1.5 | 2.0 | 3.5 | 2.5 | 9.5 | 4% |
| Recruiting, facilities, training, travel | 0.8 | 3.0 | 3.5 | 2.5 | 9.8 | 4% |
| Insurance | 0.0 | 0.2 | 1.2 | 2.0 | 3.4 | 1% |
| Contingency and management reserve | 1.2 | 7.7 | 23.1 | 13.9 | 45.9 | 18% |
| **Total** | **12.9** | **46.5** | **115.4** | **83.5** | **258.2** | 100% |

Worked labour check, Phase 2: 126 FTE x 1.5 years x $0.2915M blended = $55.1M. Phase 3: 140 x 1.0 x $0.279M = $39.1M. Column totals differ from the sum of rounded cells by up to $0.1M.

### 1.5 Non-labour detail (base, $M, Phases 0 to 3)

| Category | Total | What is in it (assumption) |
|---|---:|---|
| Vendor and licensing | 19.5 | Ledger platform licence and enterprise support 8.0 (about $1.5M/yr in build, $2.5M/yr in pilot and production); ZK proving R&D partner and tooling 4.0; CI/CD, observability, SIEM, static/dynamic analysis 5.0; sanctions lists, screening and Travel Rule messaging licences 2.5. Quotes needed. |
| Cloud, HSM and infrastructure | 20.7 | Build, test and performance environments 8.0; production active-active across 3 Canadian AZs and 2 regions, DR, gateway and supervisory read-node 8.5; operator HSMs (about 12 units incl. ceremony and DR sets) capex and support 1.5; private connectivity to six banks and BoC 1.5; GPU proving capacity 1.2. |
| Audits and certifications | 14.3 | Formal verification services 3.5; smart-contract and cryptographic audits by two firms 1.8; penetration and red-team 2.7; SOC 2 Type I and II, ISO 27001, CSAE 3416 1.4; PFMI gap assessment 0.8 and independent PFMI observance rating 1.5; bug bounty (private, then public) 1.6; first external audit 0.6; architecture and threat-model reviews 0.4. |
| Legal and regulatory (external) | 13.5 | Structure, competition and Bank Act clearance 3.0; regulatory strategy and applications (designation, CDIC/AMF, OSFI, FINTRAC) 4.0; settlement-finality and insolvency opinions 2.0; technology and vendor contracts 1.5; privacy, Quebec Law 25, incident readiness 0.8; IP and open-source licensing 0.7; rulebook drafting support 1.5. |
| Advisors and assurance | 9.5 | Independent programme assurance (IV&V) 4.5; regulatory-readiness and PFMI advisory (KPMG-type) 3.0; funding structure, tax and financial model 1.0; talent mapping and search support 1.0. |
| Recruiting, facilities, training, travel | 9.8 | Agency fees (about 90 hires x $34k = 3.1); relocation and immigration 1.2; training and certification 1.5; travel 1.5; premises for Toronto and Montreal sites 2.5. |
| Insurance | 3.4 | Cyber, crime, E&O, D&O tower. Run-rate about $2.5M to $3M/yr at production. **Broker quote needed;** insurability of an FMI-grade ledger operator is itself a risk (R11 in Section 4.9). |

### 1.6 Operator cost by pod (base, $M, contingency included, non-labour allocated)

Allocation keys: vendor licences (Ledger 45%, Compliance 20%, Integration 15%, Settlement 10%, Security 10%); infrastructure (Security 60%, Ledger 20%, Settlement 10%, Integration 10%); audits (Security 45%, Ledger 25%, Settlement 15%, Compliance 10%, Rulebook 5%); legal to Rulebook; advisors to PMO/DA; insurance to corporate; recruiting and facilities pro rata to FTE.

| Pod / function | P0 | P1 | P2 | P3 | Total | Share |
|---|---:|---:|---:|---:|---:|---:|
| Ledger | 0.8 | 9.0 | 22.6 | 13.7 | 46.1 | 17.8% |
| Settlement | 0.3 | 4.6 | 12.2 | 7.8 | 24.8 | 9.6% |
| Compliance and Identity | 0.3 | 3.6 | 9.4 | 5.9 | 19.2 | 7.5% |
| Integration/SDK and Onboarding | 0.5 | 5.1 | 14.6 | 11.3 | 31.4 | 12.2% |
| Security and SRE | 0.9 | 6.4 | 21.4 | 20.9 | 49.5 | 19.2% |
| Rulebook (legal, regulatory) | 6.2 | 6.7 | 11.6 | 7.3 | 31.8 | 12.3% |
| PMO, Design Authority, QA | 2.7 | 6.2 | 13.4 | 7.5 | 29.8 | 11.5% |
| Operator corporate | 1.3 | 4.8 | 10.2 | 9.2 | 25.5 | 9.9% |
| **Total** | 12.9 | 46.5 | 115.4 | 83.5 | **258.2** | 100% |

Security and SRE plus Ledger are 37% of operator spend, which is where the ZK, capacity and availability targets bite.

### 1.7 Bank-side integration cost (separate from operator cost)

**Tier definitions.**

- **Tier A:** large bank, legacy core(s) with batch cycles, multiple client channels, own validator node, full issuer. Base 30 to 36 months from BR0 to live.
- **Tier B:** mid-sized bank, simpler core estate, own validator node. About 20 to 24 months.
- **Tier C (later joiners, not costed to Phase 3):** small institution using an operator-hosted or sponsor-connected node. About 9 to 12 months, roughly $3M to $6M each **[assumption]**.

**Tier A base cost, per bank ($M):**

| Component | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| Labour (4 / 10 / 28 / 36 FTE at $240k) | 0.48 | 2.40 | 10.08 | 8.64 | 21.6 |
| Non-labour | 0.30 | 1.00 | 6.00 | 6.00 | 13.3 |
| Contingency 25% | 0.20 | 0.85 | 4.02 | 3.66 | 8.7 |
| **Total (rounded)** | **0.98** | **4.25** | **20.10** | **18.30** | **43.6** |

**Tier A labour at Phase 3 (36 FTE):** core-banking integration 10; treasury, liquidity and payments operations 6; technology infrastructure and security 5; compliance, AML and sanctions 4; programme office 3; wallet, channels and client onboarding 3; risk, third-party risk, model risk and internal audit 3; legal and regulatory 2.

**Tier A non-labour ($13.3M):** validator node, HSM, DR node and ZK proving hardware 6.0; core-banking vendor, middleware and adapter licences 2.8; screening, KYC and AML integration 1.7; external testing, penetration test and third-party-risk assessment of the operator 1.2; legal and advisory 1.0; training and change 0.6.

**Tier B base, per bank ($M):** labour 10.8 (2 / 5 / 14 / 18 FTE), non-labour 5.5, contingency 4.1, **total 20.3** (40% of Tier A non-labour, half the FTE).

**Six banks (4 x A + 2 x B), base by phase ($M):** P0 4.9; P1 21.3; P2 99.0; P3 90.0; **total 215.1**.

**Why the bank-side number is this large.** The dominant driver is that core banking platforms built around a nightly batch cannot post 24/7 with finality inside two seconds. Each Tier A bank must either modernise posting for the affected products or build a stand-in sub-ledger with reconciliation. The reference core-banking adapter (Pod 4) reduces but does not remove this. **Calibration:** each founding bank has actuals from its own Lynx, ISO 20022 and Real-Time Rail programmes. Ask each Treasury/CIO to reprice this table against them by G0. That is the best cost benchmark available and it is free.

### 1.8 Low, base and high cases, and the verdict on "9 figures"

**Scenario parameters:**

| Parameter | Low | Base | High |
|---|---|---|---|
| Operator FTE factor | 0.90 | 1.00 | 1.20 |
| Operator rate factor | 0.95 | 1.00 | 1.10 |
| Operator non-labour factor | 0.85 | 1.00 | 1.30 |
| Phase durations (months, P0/P1/P2/P3) | 5/11/15/11 | 6/12/18/12 | 9/15/21/15 |
| Operator contingency | 10% flat | 10/20/25/20% | 30% flat |
| Bank FTE / rate / non-labour factor | 0.85 / 0.95 / 0.85 | 1 / 1 / 1 | 1.25 / 1.08 / 1.30 |
| Bank contingency | 15% | 25% | 35% |

Non-labour scales with phase duration relative to base as well as with its factor. Ranges are deliberately asymmetric (-32%/+72% on the operator) because this is a first-of-kind programme at Class 5 estimate maturity, and because schedule slip is the biggest cost driver.

| $M | P0 | P1 | P2 | P3 | Total |
|---|---:|---:|---:|---:|---:|
| **Operator: Low** | 9.1 | 33.3 | 72.2 | 59.8 | **174.4** |
| **Operator: Base** | 12.9 | 46.5 | 115.4 | 83.5 | **258.2** |
| **Operator: High** | 29.8 | 82.6 | 183.7 | 148.3 | **444.3** |
| Six banks: Low (A 29.0, B 13.5) | | | | | 142.8 |
| Six banks: Base (A 43.6, B 20.3) | 4.9 | 21.3 | 99.0 | 90.0 | 215.1 |
| Six banks: High (A 76.3, B 35.6) | | | | | 376.5 |
| **Ecosystem: Low** | | | | | **317.2** |
| **Ecosystem: Base** | 17.8 | 67.8 | 214.4 | 173.5 | **473.3** |
| **Ecosystem: High** | | | | | **820.8** |

**Verdict.** "9 figures" is supported: 317, 473 and 821 all lie between $100M and $999M. It is also nearly useless as a planning number:

- The base is about **2 to 4 times** a $100M to $250M reading.
- The high case is 82% of the way to $1B. Add inflation (about $40M in the high case), irrecoverable tax, or any Phase 4 spend and it crosses ten figures.
- "Shared" hides that **45% of the money is spent inside the banks**, invisible to the operator's budget and to any founding-bank board paper that only shows the capital call.
- **Cost of delay:** in Phase 2 the ecosystem burns about **$11.9M a month** (operator $6.4M plus banks $5.5M). Post-go-live run-rate is about $9.1M a month (operator $4.9M, banks $4.2M). A 12-month slip therefore costs roughly $110M to $140M, which is most of the difference between base and high.

### 1.9 Operator versus bank split, and per-founder total

| | Operator | Each Tier A bank | Each Tier B bank | Six banks combined | Ecosystem |
|---|---:|---:|---:|---:|---:|
| Programme cost to G3b, base ($M) | 258.2 | 43.6 | 20.3 | 215.1 | 473.3 |
| Share of ecosystem | 54.6% | 9.2% | 4.3% | 45.4% | 100% |

**Per-founder total cash commitment (base).** Contribution weights are defined in Section 2.4 (illustrative usage metrics 28/22/18/14/10/8, blended 50/50 with equal shares). The operator envelope ($330.8M) includes the PFMI capital buffer and ramp deficits from Section 2.

| Founder (illustrative) | Weight | Operator share of $258.2M programme | Operator share of $330.8M envelope | Internal bank cost | **Total cash need ($M)** |
|---|---:|---:|---:|---:|---:|
| Bank A (Tier A) | 22.33% | 57.7 | 73.9 | 43.6 | **117.5** |
| Bank B (Tier A) | 19.33% | 49.9 | 63.9 | 43.6 | **107.5** |
| Bank C (Tier A) | 17.33% | 44.7 | 57.3 | 43.6 | **100.9** |
| Bank D (Tier A) | 15.33% | 39.6 | 50.7 | 43.6 | **94.3** |
| Bank E (Tier B) | 13.33% | 34.4 | 44.1 | 20.3 | **64.4** |
| Bank F (Tier B) | 12.33% | 31.8 | 40.8 | 20.3 | **61.1** |
| **Total** | 100.00% | 258.2 | 330.8 | 215.1 | **545.9** |

Reconciliation: 473.3 programme cost + 29.4 capital buffer + 56.2 ramp deficits - 13.0 revenue in Phases 2 and 3 = 545.9. **A Tier A founder should plan for $95M to $118M of cash over four years**, about two-thirds of it recoverable only through the strategic benefits in Section 3.6. The board should hear this number before it signs a term sheet.

### 1.10 Phase 4 (indicative only; not approved by this memo)

Phase 4 (retail deposit tokens, programmable consumer payments, cross-border corridors, Real-Time Rail interoperability, post-quantum migration) is outside the cost window and I have low confidence in it. Indicative for October 2030 to September 2032: operator incremental **$90M to $150M** (about 90 FTE for two years at $270k = $48.6M, non-labour about $30M to $40M, contingency 25%), plus **$30M to $70M** per Tier A bank for retail channels, consumer protection and deposit-insurance operations. It must be a separately gated business case funded from operating surplus and a new capital call, not an extension of the Phase 3 mandate.

### 1.11 Cost levers (recommend adopting; base-case effect on ecosystem)

| # | Lever | Saving ($M) | Trade-off |
|---|---|---:|---|
| L1 | Defer production ZK confidentiality to a later Phase 3b/4 release; ship the designed fallback (encrypted off-ledger amounts, selective disclosure) at go-live. Removes about 5 Ledger FTE, proving GPUs, bank-side proving hardware, part of verification scope | 15 (range 10 to 20) | Weakens "privacy by default" at launch. Design Authority decision at December 2027. |
| L2 | Provision production for 500 instr/s (about 2x expected peak); prove 5,000 sustained and 20,000 burst in the performance lab only | 7 one-off plus about 4/yr | Phase 4 needs re-provisioning. Requires board to accept a lower production capacity target. |
| L3 | Operator-funded reference adapter and certification kit; cuts bank integration labour about 12% (12% x $108M bank labour = $13M) | 13 | Operator must ship the kit early (Phase 1). |
| L4 | Fixed-price, risk-sharing SI contracts for adapters and test automation | 8 (expected value) | Higher unit price; less flexibility. |
| L5 | Secondees in place of contractors (18 FTE x 2 years x $60k premium) | 2.2 | Conflict and neutrality protocols needed. |
| L6 | Shared penetration-test programme for DepositX components (six banks x $0.3M avoided) | 1.8 | Independence from the operator's own testing. |
| | **Total** | **about 47 (10% of base)** | |

Levers do not rescue the bank NPV (Section 3.6); they lower the hurdle from $38M to $36M of annual benefit per Tier A bank.

**Stage-gate hiring** (no Phase 2 ramp before G1 and the June 2027 regulatory pathway letter) is not a saving in the base case. It is stop-loss insurance: it avoids roughly $25M of stranded cost if the board triggers a kill criterion at G1.

---

## 2. Funding and ownership model

### 2.1 Funding requirement

| Component | $M (base) | Note |
|---|---:|---|
| Operator programme cost to G3b | 258.2 | Section 1.4 |
| Less revenue in Phases 2 and 3 | (13.0) | Pilot about 1; first ten months of production at about 25% of steady-state revenue |
| PFMI Principle 15 liquid-asset buffer | 29.4 | Six months of steady-state opex: 58.8 / 2. PFMI requires liquid net assets funded by equity of at least six months of operating expenses **[verify against the Bank of Canada standards]** |
| Ramp deficits, Oct 2030 to Sep 2033 | 56.2 | Section 3.4: 30.5 + 17.5 + 8.2 at list prices |
| **Operator funding envelope** | **330.8** | Low 243.6; high 522.6 |

Envelope formula: programme cost - Phase 2/3 revenue + buffer + ramp deficits. Low uses 174.4, buffer 26.0 and the base deficits; high uses 444.3, buffer 35.1 and the base deficits.

### 2.2 Funding instruments compared

| Instrument | Fit | Recommendation |
|---|---|---|
| **Equity with capped return of capital** | PFMI 15 wants the buffer equity-funded. Aligns founders as owners and users. Cost-recovery stance means dividends are impossible, so return is capped. | **Primary instrument** for all capital. |
| Founder loans / notes | Turns build cost into liabilities the operator cannot repay at base volumes; leaves negative equity, which a regulator will not accept for an FMI. | Reject for programme cost. Acceptable only for a short bridge before a capital call. |
| Capital calls (committed, gated) | Matches spend to gates; limits stranded cost. | **Mechanism** for delivering the equity (Section 2.3). |
| Tiered founder contributions | Necessary to be fair between large and mid-sized founders. | **Use** (Section 2.4). |
| Pre-paid usage credits | Small liquidity benefit; creates deferred revenue and take-or-pay. Best used to enforce volume commitment, not to raise capital. | **Use only as commitment device:** each founder signs a Minimum Annual Participation Fee credited against usage (Section 2.6). |
| Third-party investors (strategic, government, exchange) | Erodes neutrality and complicates cost-recovery. A grant or concessional facility for interoperability work could be useful. | Do not pursue now; revisit at G2. |

**Legal form (for counsel).** A federal share corporation with a constitutional cap on distributions (return of contributed capital plus CPI, no dividends above that) is my preference over a not-for-profit corporation, because banks need to hold equity and the operator needs to hold a capital buffer. Bank Act investment limits, OSFI capital treatment of the stake, and competition-law clearance of a consortium of competitors all need early opinions **[verify]**.

### 2.3 Capital call schedule (base)

| Tranche | Trigger | Amount ($M) | Purpose | Allocation basis |
|---|---|---:|---|---|
| T0 | Founders' term sheet (Dec 2026) | 12.9 | Phase 0 (pre-formation funding agreement) | **Equal** shares (about $2.15M each), to keep the operator neutral before it exists |
| T1 | Gate G0 (Mar 2027) | 46.5 | Phase 1 | Contribution weights |
| T2a | Gate G1 (Mar 2028) | 57.7 | Phase 2, first half | Weights |
| T2b | Pilot permission letter (target Jan 2029) | 57.7 | Phase 2, second half; **regulator-gated** | Weights |
| T3 | Gate G2 (Sep 2029) | 100.0 | Phase 3 net of revenue (70.5) plus PFMI buffer (29.4), rounded | Weights |
| T4 | Standby: committed but uncalled | 56.2 | Ramp deficits Oct 2030 to Sep 2033 | Weights |
| **Total** | | **330.8** | | |

Rounding: 12.9 + 46.5 + 57.7 + 57.7 + 100.0 + 56.2 = 331.0. Each founder signs at T0 a **legally binding commitment to the whole envelope**, callable only on the stated triggers. A withdrawing founder forfeits its contributions at cost (no refund of sunk spend) and its voting rights on economics, but keeps issuer rights on its own token contract for a wind-down period. Pre-gate at-risk spend authority is capped at 10% of the next phase's budget, so work does not stop between gate meeting dates.

### 2.4 Tiered contributions

**Weight = 50% equal share + 50% pro rata to a usage metric** (three-year average of each bank's large-value and wholesale payment value, from Payments Canada data **[verify availability]**), subject to a **cap of 25% and a floor of 8%**. The equal half keeps mid-sized founders' stake meaningful; the usage half stops mid-sized founders subsidising the largest users.

Worked example, illustrative usage shares 28/22/18/14/10/8 and equal share 1/6 = 16.67%:

| | A | B | C | D | E | F |
|---|---:|---:|---:|---:|---:|---:|
| 50% x 16.67% | 8.33 | 8.33 | 8.33 | 8.33 | 8.33 | 8.33 |
| 50% x usage share | 14.00 | 11.00 | 9.00 | 7.00 | 5.00 | 4.00 |
| **Weight (%)** | **22.33** | **19.33** | **17.33** | **15.33** | **13.33** | **12.33** |

Weights sum to 100.00 before rounding. No cap or floor binds in this example.

### 2.5 Governance rights and the "big bank dominates" problem

**Board (10 voting):** six founder directors (one per founder), an independent chair, three independent directors (FMI/regulatory, technology/cybersecurity, corporate treasury user). CEO attends, non-voting. Bank of Canada, OSFI and FINTRAC attend as observers **[unconfirmed]**.

| Decision class | Examples | Rule |
|---|---|---|
| Ordinary | Operating plan within budget, appointments below CEO | Simple majority of the board, including at least two independent directors |
| Economic | Budget, capital calls, fee methodology, reserve policy | **Triple majority:** (i) a majority of board votes including at least two independents, (ii) a majority of founder weight, with **no member counted above 20%** (excess reallocated pro rata), and (iii) at least 4 of 6 founder directors by head |
| Reserved | Rulebook changes touching par, finality or settlement; admission criteria; change of control; wind-down; change to this table | **Two-thirds of founder directors by head (4 of 6)** plus a majority of independents plus a Design Authority certificate that invariants I to III are not weakened |
| Issuer protection | Any change to a bank's own token contract or liability treatment | That bank's consent, and nobody else's veto |

**Properties this gives (checkable):**

- No single bank has a unilateral veto, except over its own liability treatment.
- **Economic decisions need at least 4 of 6 founders and a majority of weight.** Every winning set therefore contains at least one of the three largest and at least one of the three smallest founders (only three founders are smaller than the top three). The top three hold about 57% of weight after the 20% cap but only 3 heads, so they cannot carry an economic decision; the bottom three hold 41.0% and 3 heads and cannot either.
- **Reserved matters need 4 of 6 founders plus an independent majority plus the Design Authority certificate.** Any three founders can block. Blocking is symmetric by head, not by size, which is what a mid-sized bank needs to feel safe.
- Independents cannot carry anything alone: ordinary matters need at least 3 founders alongside them (3 + 3 = 6 of 10), economic and reserved matters at least 4. Independents are appointed by 4 of 6 founders, cannot be current or former (within 3 years) employees of a member, and serve fixed terms.
- The residual risk is that the largest banks lobby the independents and smaller founders. That is what the published fee methodology, the independent Design Authority and the regulator notice on fee changes are for.

**Neutrality safeguards beyond voting.**

- Design Authority (Section 4.6) is independent: chaired by the operator CTO, one seat per founder, two independent experts. The Programme Steering Committee cannot override invariants; only the reserved-matter route can.
- Fee methodology is published and cost-based. Any change needs the independent majority and prior regulator notice. This is the practical answer to a large bank shaping fees to suit its own flows.
- Operator staff report to the operator CEO, not to any member. Secondees are capped at 20% of any pod and cannot lead a pod.
- No critical vendor contract goes to a founder-owned entity without competitive bid scored by independents.
- Founder privileges (reserved-matter thresholds and priority onboarding) **sunset after seven years or when there are 15 members**, whichever comes first, so they do not calcify.

**Rights by class:**

| Right | Founder | Equity member (later joiner) | Participant (fee-only) |
|---|---|---|---|
| Board seat | One each (6) | Two seats elected by the class (board grows to 12; reserved-matter threshold stays at two-thirds of founder and member directors, 6 of 8) | None; user committee seat |
| Reserved-matter vote | Yes | Class vote on fee methodology and admission only | Consultation |
| Design Authority seat | Yes | One shared seat | Observer |
| Onboarding priority | Wave 1 and 2 | Next available wave | Next available wave |
| Fee treatment | Same list price; credits for Minimum Annual Participation Fee | Same | Same |
| Access to information | Full | Full, except other members' commercial data | Own data and published operator data |

### 2.6 The free-rider problem

There are three free-riders, each needing its own mechanism.

1. **Founder who commits capital but under-uses or under-delivers** (a "strategic waiter"). Mechanism: each founder is assigned a wave date at T0 and signs a **readiness covenant** (BR0 to BR4 dates). Missing a readiness date suspends its reserved-matter vote after 90 days and triggers a delay contribution of 1% of its remaining envelope share per month, paid to the operator as compensation for stranded cost. Each also signs a **Minimum Annual Participation Fee** equal to its weight share of 40% of steady-state fixed cost (0.40 x $58.8M = $23.5M, times weight; for Bank A 22.33% = $5.3M/yr), credited against its usage fees, from the first full year of production.
2. **Non-founder bank using the network without paying for the build.** Mechanism (both apply): (a) all users pay a **capital recovery component in the per-instruction fee** until founders' contributed capital is returned at 1.0x plus CPI, so late users pay for usage as the founders do, with no discrimination; (b) an equity joiner pays a **true-up** (Section 2.7).
3. **Large bank that shapes standards but underinvests.** Mechanism: the usage half of the contribution weight, plus the 20% weight cap on votes.

### 2.7 Later joiners: joining fee versus founder true-up

| Class | What they pay | Formula |
|---|---|---|
| **Participant (fee-only)** | Onboarding and certification (cost-based one-off), annual participation fee by tier, per-instruction fees including the capital recovery component | No equity, no true-up |
| **Equity member** | The above, plus a **true-up** buying units from founders | **True-up = usage share x capital funded to date x (1 + risk premium)** |

**Risk premium by joining date:** 0% before G1 (joins as a late founder on the same terms); 10% from G1 to G2; 20% from G2 to G3b; 30% thereafter (cap). The premium compensates founders for the risk they bore before the network was proven. Proceeds go to the founders pro rata (secondary sale, diluting founder weights), not to the operator.

Worked example, capital funded to G3b of $245.2M (programme cost 258.2 less revenue 13.0):

- Mid-sized joiner with 3% usage share joining between G2 and G3b: 3% x 245.2 x 1.20 = **$8.8M**.
- Small joiner with 0.5% usage share joining after G3b: 0.5% x 245.2 x 1.30 = **$1.6M**.
- Four joiners with 10% combined usage at 20% premium: 10% x 245.2 x 1.2 = $29.4M returned to founders, about 12% of the programme cost.

**Fair-access constraint.** PFMI Principle 18 requires fair and open, risk-based access **[verify]**. Regulators will test whether the true-up excludes a competitor. Defence: the premium schedule is published, formulaic, dated and applied to everyone alike; participants can use the network without buying equity. Counsel to confirm.

---

## 3. Revenue, pricing and unit economics

### 3.1 The cost base at steady state (base, Year 2 after go-live)

| Line | FTE | Loaded $k | $M/yr |
|---|---:|---:|---:|
| Operations: NOC, SRE, service desk | 40 | 215 | 8.60 |
| Security operations, key management, GRC | 12 | 270 | 3.24 |
| Member services and onboarding | 8 | 260 | 2.08 |
| Platform engineering and change | 28 | 280 | 7.84 |
| Compliance, risk, internal audit, legal | 6 | 300 | 1.80 |
| Executive, finance, HR, procurement | 6 | 330 | 1.98 |
| **Labour (100 FTE, average $255k)** | **100** | | **25.54** |
| Cloud, HSM, infrastructure (production, DR, test) | | | 11.0 |
| Platform licences, support, tooling | | | 7.0 |
| Audits, certifications, bounty | | | 4.0 |
| External legal and regulatory | | | 2.5 |
| Insurance | | | 3.0 |
| Facilities, training, travel, recruiting | | | 3.0 |
| Subtotal | | | 56.0 |
| Contingency 5% | | | 2.8 |
| **Steady-state run cost F** | | | **58.8** |

Range: $45M (lean, outsourced NOC, about 60 FTE, about $39M at floor) to $80M (high resilience, insurance and audit costs). Roughly 85% is fixed with respect to volume. Variable cost is assumed **$0.06 per incremental instruction** (infrastructure scaling; assumption).

### 3.2 Recommended stance: cost recovery with a reserve, not profit

**Recommendation.** Run DepositX as a **cost-recovery utility**: fees set to recover run cost, fund a reinvestment reserve of about 8% of run cost until the reserve equals 12 months of opex, and return founders' contributed capital at **1.0x plus CPI** through a capital recovery component. No dividends above that. After capital is returned, surplus goes to fee rebates.

**Why:**

1. **Neutrality.** A profit-maximising operator owned by six competing banks would optimise price against its own owners' customers, and a regulator will read it as a toll booth on an essential settlement service. Cost recovery makes the fee methodology the object of governance, not the margin.
2. **Regulatory fit.** PFMI Principle 21 (efficiency) and Principle 23 (disclosure of fees and rules) point the same way **[verify]**. Peers DepositX is measured against (Payments Canada) are not-for-profit **[verify]**.
3. **Adoption.** The addressable market is the banks themselves. A low, transparent fee helps small institutions join, which is what makes the network effect and the north-star metric (95% of eligible wholesale flow) reachable.
4. **The economics do not support profit anyway.** At base volumes the network does not recover its run cost at the assumed list price, let alone $258M of build capital.
5. **Founders are customers first.** Their return is deposit retention, liquidity savings and reconciliation savings (Section 3.6), not distributions.

**Counter-risk:** cost recovery removes the profit incentive for efficiency. Mitigate with an annual independent cost benchmark, a published unit-cost trajectory (target -3% per year real from Year 3), and CEO incentives tied to unit cost and availability.

**Where a margin is defensible:** value-based pricing on programmable templates (Section 3.3) may earn a surplus that funds the reserve, provided it is disclosed and capped.

### 3.3 Fee model

| Element | Who pays | Basis | Initial hypothesis | Purpose |
|---|---|---|---|---|
| Onboarding and certification | New participant | Cost-based one-off | Tier 1 issuer $1.5M; Tier 2 $0.8M; Tier 3 $0.4M | Recover the Onboarding Office (about 8 FTE plus test environments) |
| **Annual participation fee** | Every member | Fixed, by tier | Tier 1 (issuer-validator) $2.4M; Tier 2 (non-validating issuer or large user) $0.8M; Tier 3 (sponsor-connected) $0.15M | Recover about 23% of fixed cost; signals commitment |
| **Per-instruction fee, volume-tiered** | Sending participant | Per settled instruction, declining marginal rate per participant per month | Illustrative ladder: first 50k/month $0.90; 50k to 250k $0.60; 250k to 1M $0.40; above 1M $0.20. The model uses blended effective rates of $0.70 / $0.50 / $0.30 by scenario | Recover volume-sensitive cost; discount for scale |
| **Value-based, programmable templates** | Initiating participant | Fee on notional for DvP, escrow, payment-on-event | About **$1.50 average premium** per template instruction (for example 0.15 bp of notional, floor $0.25, cap $25) | Prices the value delivered; low marginal cost; possible disclosed surplus |
| Liquidity-saving netting | Nobody | Free | $0 | Incentive; reduces intraday liquidity for everyone |
| Supervisory read-node | Regulators | Free | $0 | Regulatory access |
| Capital recovery component | All users | Embedded in per-instruction fee | Sized so founders' capital returns at 1.0x plus CPI; zero if surplus is insufficient | Anti-free-rider (Section 2.6) |

Volumes and unit prices are **assumptions for testing**, not forecasts. The board should treat Section 3.4 as a sensitivity map.

**Benchmarks (all recollection; do not rely on them).** Lynx (Payments Canada, high-value) charges a fixed participation fee plus per-payment fees; my recollection is per-payment charges well under $1 and daily volumes in the tens of thousands, with average daily value on the order of $200B **[verify with the Payments Canada fee schedule and annual report]**. ACSS retail item fees are fractions of a cent **[verify]**. Fedwire Funds per-transfer fees are of the order of tens of US cents to under US$1 depending on volume tier **[verify]**. If those recollections hold, $0.50 to $0.75 an instruction is in the neighbourhood of large-value fees, not retail-rail fees, which is why volume mix matters more than price.

### 3.4 Break-even analysis under volume scenarios

**Volume assumptions (instructions per year, steady state, Year 3 after go-live; assumptions, not forecasts):**

| Scenario | Instr./yr | Per business day | Average per second | Composition |
|---|---:|---:|---:|---|
| Low | 15M | 60k | 0.5 | Wholesale interbank flows and a few tokenised-bond cash legs only; roughly Lynx-like counts **[verify]** |
| Base | 60M | 240k | 1.9 | Adds corporate 24/7 treasury sweeps and supplier payments |
| High | 250M | 1.0M | 7.9 | Adds broad corporate migration from wire/EFT and tokenised-securities settlement |

**Revenue at list price (blended per-instruction rate; templates 3% / 8% / 10% of instructions at $1.50):**

| $M/yr | Low | Base | High |
|---|---:|---:|---:|
| Participation fees (members: 6 / 12 / 20) | 11.2 | 13.4 | 15.9 |
| Per-instruction (15M x $0.70 / 60M x $0.50 / 250M x $0.30) | 10.5 | 30.0 | 75.0 |
| Templates (0.45M / 4.8M / 25M x $1.50; low uses 3%, base 8%, high 10%) | 0.7 | 7.2 | 37.5 |
| **Revenue** | **22.4** | **50.6** | **128.4** |
| Run cost (low: lean 52.0; base 58.8; high 58.8 + 190M x $0.06 = 70.2) | 52.0 | 58.8 | 70.2 |
| **Operating result** | **(29.6)** | **(8.2)** | **+58.2** |

**Participation-fee build.** Low: 4 Tier 1 x $2.4M + 2 Tier 2 x $0.8M = $11.2M. Base: the same plus 2 more Tier 2 (1.6) and 4 Tier 3 (0.6) = $13.4M. High: the same as low plus 4 Tier 2 (3.2) and 10 Tier 3 (1.5) = $15.9M. (Founders Tier B pay Tier 2 fees in this build.)

**Required all-in net revenue per instruction to break even at each volume** (after participation fees): (F - participation) / N: Low (52.0 - 11.2) / 15M = **$2.72**; Base (58.8 - 13.4) / 60M = **$0.76**; High (70.2 - 15.9) / 250M = **$0.22**. The base figure of $0.76 is all-in, meaning per-instruction plus template revenue. Splitting out templates at $7.2M, the per-instruction rate alone must be **$0.64** at base volume (list $0.50).

**Break-even volume at different list prices** (base cost, net per instruction = price + 8% x $1.50, variable cost $0.06, participation $13.4M): N* = (58.8 - 13.4) / (net - 0.06).

| List price per instruction | Net incl. templates | Break-even volume | Per business day |
|---|---:|---:|---:|
| $0.40 | $0.52 | 98.7M | 395k |
| $0.50 | $0.62 | 81.1M | 324k |
| $0.60 | $0.72 | 68.8M | 275k |
| $0.75 | $0.87 | 56.0M | 224k |
| $1.00 | $1.12 | 42.8M | 171k |

**Reading.**

- **Low is not a business.** A required $2.72 per instruction is not competitive against any rail I know of **[verify]**. It needs a lean redesign (Section 7, pivot P1).
- **Base loses $8.2M a year at list.** It needs about $0.64 per instruction or 81M instructions at $0.50. That is a modest price change, not a structural problem.
- **High over-recovers ($58.2M a year).** Under a cost-recovery stance that surplus would first return founders' capital ($245M in about 4 to 5 years) and then cut prices.
- **Base volume may itself be optimistic** for a wholesale-only network. 60M a year is 240k a business day, several times Lynx's count as I recall it **[verify]**. A wholesale-only Phase 3 is more likely to land between low and base. Corporate treasury and tokenised-securities cash legs must carry the count. **Volume commitments from founders (Section 2.6) are therefore a gate condition, not a nicety.**
- **Ramp deficits (base, at list prices, from Oct 2030):** Year 1 at 40% of steady-state usage revenue: 13.4 + 0.4 x (30.0 + 7.2) = $28.3M revenue against $58.8M cost = $30.5M deficit; Year 2 at 75%: $41.3M revenue, $17.5M deficit; Year 3 at 100%: $50.6M revenue, $8.2M deficit. **Cumulative $56.2M.** This is the standby tranche T4.
- **Capital recovery is not achievable in the base case.** Founders' $245M cannot be returned from surplus if the base case merely breaks even. Say so in the term sheet: the build is a strategic investment, recoverable only in the high-volume case or through Phase 4.

### 3.5 Operator sensitivities

- Each $0.10 on the blended rate at base volume moves revenue by $6.0M (60M x $0.10).
- Each 10 FTE in steady state moves run cost by about $2.6M (10 x $255k).
- Insurance and audit are the least-known lines; a 50% rise adds about $3.5M a year.
- A lean operator (outsourced 24/7 NOC, about 60 FTE, cloud-managed) has a run cost of about $39M: 60 FTE x $250k = $15M, non-labour $22M, subtotal $37M, plus 5% = $39M. At $0.50 and 40M instructions it nearly breaks even ($13.4M + $20M + $4.8M = $38.2M). This is the pivot P1 design.

### 3.6 The bank's own business case

All benefits are **assumptions for each bank's Treasury to overwrite**. They are the weakest part of this memo and the most important. I model a Tier A bank at steady state (Year 3 after go-live), dollars per year.

| Benefit / cost | Basis | Low | Base | High |
|---|---|---:|---:|---:|
| Intraday liquidity | Reduction in intraday buffer x buffer size x funding spread. Low 5% x $8B x 25 bp; Base 10% x $12B x 35 bp; High 20% x $15B x 50 bp | 1.0 | 4.2 | 15.0 |
| Deposit franchise defence | Corporate operating deposits retained against stablecoin leakage x net spread. Low 0.1% x $100B x 1.2%; Base 0.4% x $120B x 1.5%; High 1.0% x $150B x 1.8% | 1.2 | 7.2 | 27.0 |
| Reconciliation and operations | FTE avoided x $160k. Low 10; Base 25; High 50 FTE | 1.5 | 4.0 | 8.0 |
| New revenue from programmable payments to clients | Fee income | 0 | 5.0 | 20.0 |
| **Gross benefit** | | **3.7** | **20.4** | **70.0** |
| DepositX fees paid (19% share of the lesser of list revenue and run cost + $10M capital recovery) | | (4.3) | (9.6) | (15.2) |
| Offset: legacy rail fees avoided | | 1.0 | 2.5 | 6.0 |
| Bank's own incremental run cost | | (9.0) | (10.0) | (12.0) |
| **Net steady-state annual benefit** | | **(8.6)** | **+3.3** | **+48.8** |
| Upfront: internal cost (Section 1.7) | | 29.0 | 43.6 | 76.3 |
| Upfront: share of operator programme (20% avg Tier A) | | 34.9 | 51.6 | 88.9 |
| **Total upfront** | | **63.9** | **95.2** | **165.2** |
| **NPV at 9%, 10 years after go-live** | | **(99)** | **(78)** | **+58** |
| NPV excluding deposit franchise defence | | (104) | (109) | (60) |

**NPV method.** Discounted to October 2026. Upfront spend spread by phase in proportion to base operator spend at mid-window (0.25, 1.0, 2.25, 3.5 years). Benefits ramp 30% and 70% in the first two years, 100% thereafter for eight years; fees and run cost apply in full from Year 1; no terminal value; no Phase 4 upside. The low case excludes the operator's structural deficit of about $30M a year, which would make it worse.

**Findings.**

1. **The quantified base case does not clear a 9% hurdle.** Net annual benefit is $3.3M against $95M upfront; simple payback is about 29 years.
2. **NPV break-even needs about $38M a year of gross benefit per Tier A bank**, 1.9 times the base $20.4M. With the 10% cost levers (Section 1.11) it needs $36M.
3. **Deposit franchise defence is the swing item** and the most contestable. Without it, even the high case is negative. It is a strategic argument that needs to be made honestly to each bank's board as such.
4. The case is **a strategic option with positive skew**, not a base-case ROI. That is a legitimate basis to invest, but the board should say it and price it, not hide behind "9 figures".

**Go / Conditional / Stop bands for aggregate validated gross benefit** (four Tier A banks plus two Tier B at 45% of Tier A; base aggregate = 20.4 x (4 + 0.9) = $100M a year; total steady-state cost of ownership, operator $58.8M plus banks 4 x $10M + 2 x $5M = $108.8M):

| Band | Aggregate validated gross benefit | Action at G1 |
|---|---:|---|
| **Go** | At least $187M/yr (NPV break-even; $179M with levers) | Release Phase 2 tranches |
| **Conditional (strategic option)** | $100M to $187M/yr | Proceed only if founders' boards explicitly approve the strategic premium and volume commitments are signed |
| **Stop / re-scope** | Below $70M/yr (70% of base) | Trigger K4 (Section 7.2) |

---

## 4. Programme management

### 4.1 Schedule: KPMG versus base, downside and best case

| Milestone | KPMG draft | **Base (P50)** | Downside (P80) | Best case |
|---|---|---|---|---|
| Founders' term sheet and T0 funding | n/a | Dec 2026 | Feb 2027 | Nov 2026 |
| **G0 Foundations:** operator incorporated, neutral chair, architecture and invariants ratified | End Q4 2026 | **Mar 2027** | Jun 2027 | Feb 2027 |
| **G0-R** Regulators confirm consultation pathway in writing | End Q4 2026 | Jun 2027 | Sep 2027 | Apr 2027 |
| ZK go/no-go and fallback decision | Within Phase 1 | Dec 2027 | Jun 2028 | Oct 2027 |
| **G1 Sandbox exit** | H1 2027 | **Mar 2028** | Sep 2028 | Jan 2028 |
| Regulatory application filed | n/a | May 2028 | Oct 2028 | Feb 2028 |
| Pilot permission letter | n/a | Jan 2029 | Sep 2029 | Oct 2028 |
| Live capped pilot starts | H2 2027 | **Feb 2029** | Oct 2029 | Nov 2028 |
| **G2 Pilot exit:** clean audit, proofs, cap lifted by non-objection, DR drill | H1 2028 | **Sep 2029** | Jun 2030 | Apr 2029 |
| **G3a Production:** all founding issuers live, cap lifted, 24/7/365 | H2 2028 | **30 Nov 2029** | 30 Nov 2030 | 30 Sep 2029 |
| **G3b Production accepted:** two quarters at target, supervisory queries under 60 s, independent PFMI rating | Undatable as drafted | **Sep 2030** | Sep 2031 | Mar 2030 |
| Phase 4 start | 2029+ | Oct 2030 | Oct 2031 | Apr 2030 |

**Slip versus KPMG:** base production is about 11 months after end of 2028; downside 23 months; **even the best case is 9 months late**. The blueprint's H2 2028 is a capped-pilot date at best, and only if everything goes right.

**Commitment policy.** P50 is the plan of record and the management target. **P80 (Nov 2030) is the date the board should use when making commitments to banks, the regulator and any external party.** The board holds a **3-month schedule reserve** at Steering Committee level, released only by a change request.

### 4.2 Integrated master schedule and critical path (base)

| ID | Activity | Start | Finish | Predecessors | On critical path |
|---|---|---|---|---|---|
| F1 | Founders' term sheet, T0 funding, secondees named | Oct 2026 | Dec 2026 | none | Yes |
| F2 | Shareholders' agreement, incorporation, competition and Bank Act clearances | Dec 2026 | Mar 2027 | F1 | Yes |
| F3 | Neutral chair appointed; CEO search | Jan 2027 | Feb / Jun 2027 | F1 | Chair yes; CEO 3-month float |
| R1 | Joint pre-consultation: OSFI, BoC, FINTRAC, Finance Canada, CDIC and AMF; **G0-R written pathway** | Nov 2026 | Jun 2027 | F1 | **Yes (near-critical)** |
| A1 | Reference architecture, invariants, threat model ratified | Oct 2026 | Mar 2027 | none | Float about 1 month |
| T1 | Platform and HSM vendor selection | Jan 2027 | Apr 2027 | A1 | Float 2 months |
| T2 | Single-issuer testnet: par module, atomic DvP | Apr 2027 | Sep 2027 | T1 | Float about 1 month |
| T3 | Compliance engine MVP; ISO 20022 adapter v0 against reference core stack | Apr 2027 | Nov 2027 | T1 | Float 2 months |
| T4 | ZK benchmark and fallback design; decision December 2027 | Jul 2027 | Dec 2027 | T2 | **Yes** (gates contract freeze) |
| T5 | Closed pilot on testnet: 2 banks plus BoC observer | Oct 2027 | Feb 2028 | T2, T3 | Float 1 month |
| R2 | PFMI gap assessment and remediation plan; rulebook v1; finality legal opinion | Jul 2027 | Mar 2028 | R1, A1 | **Yes** |
| **G1** | **Gate G1** | | **Mar 2028** | T4, T5, R2 | **Yes** |
| T6 | Core v1 freeze; formal verification of par and settlement contracts | Apr 2028 | Dec 2028 | G1, T4 | **Yes** (float about 1 month) |
| R3 | Regulatory application pack filed (designation and oversight, CDIC/AMF, OSFI issuer notices, FINTRAC) | Apr 2028 | May 2028 | G1, R2 | **Yes** |
| R4 | Regulator review and questions; **pilot permission** | May 2028 | Jan 2029 | R3 | **Yes (zero float)** |
| B1 | Bank Wave 1 (2 to 3 issuers): core integration, 24/7 posting design, third-party-risk sign-off on the operator, runbooks | Jul 2027 | Jan 2029 | R1, T3 | Near-critical, float about 1 month |
| T7 | Multi-issuer testnet with all founding issuers | Jun 2028 | Sep 2028 | T2, T3 | Float 3 months |
| T8 | SOC 2 Type I; independent audit 1; private bug bounty | Jul 2028 | Nov 2028 | T7 | Float 2 months |
| **G1.5** | **Go-live readiness review** | | **Jan 2029** | R4, T6, T8, B1 | **Yes** |
| T9 | Live capped pilot, Wave 1 | Feb 2029 | Sep 2029 | G1.5 | **Yes** |
| T10 | SOC 2 Type II observation window (6 months) | Feb 2029 | Aug 2029 | T9 | Float about 1 month |
| B2 | Bank Wave 2 (remaining 3 to 4 issuers): readiness and dress rehearsal | Jan 2028 | Sep 2029 | B1 | Near-critical, float 2 months |
| T12 | Liquidity-saving netting; tokenised-bond cash-leg integration | Jan 2029 | Sep 2029 | T9 | Float 3 months |
| R5 | Cap-lift request; supervisory non-objection and designation decision | Jul 2029 | Sep 2029 | T9 (at least 5 months of live evidence) | **Yes** |
| **G2** | **Gate G2** | | **Sep 2029** | R5, T6, T10 | **Yes** |
| B3 | Wave 2 cut-over, before bank year-end change freeze | Oct 2029 | Nov 2029 | G2, B2 | **Yes** |
| **G3a** | **Production declared** | | **30 Nov 2029** | B3 | **Yes** |
| T13 | Two full quarters of availability measurement | Jan 2030 | Jun 2030 | G3a | **Yes** |
| R6 | Independent PFMI observance assessment | Jul 2030 | Aug 2030 | T13 | Float about 1 month |
| **G3b** | **Production accepted** | | **Sep 2030** | T13, R6 | **Yes** |

**Critical path (base):** F1 -> F2 -> R1 -> R2 -> G1 -> R3 -> R4 (regulator clock) -> G1.5 -> T9 (live pilot) -> R5 -> G2 -> B3 -> G3a -> T13 -> G3b. The platform path (T4 -> T6) and the bank path (B1, B2) are each within about one to two months of critical, so the plan has **three near-critical chains, one of which (regulatory) we do not control.**

### 4.3 Dependency map: regulatory gates versus platform versus bank readiness

| Gate | Regulatory and legal dependency | Platform dependency | Bank-readiness dependency |
|---|---|---|---|
| **G0** (Mar 2027) | Consortium structure cleared (competition, Bank Act) [verify]; operator incorporated; consultation meetings held | Architecture, invariants and threat model ratified by all founders | Six funding commitments signed; wave dates agreed; secondees named; each bank starts BR0 |
| **G0-R** (Jun 2027) | Written pathway from OSFI, BoC, FINTRAC, Finance Canada; named CDIC/AMF contact; BoC observer role stated (D1) | Platform selected | Third-party-risk pre-assessment of the operator begun by each bank |
| **G1** (Mar 2028) | PFMI gap assessment and remediation plan; rulebook v1; legal opinion on finality route | Single-issuer testnet; par and DvP proven; ZK meets target or fallback chosen; 2-bank closed pilot; reference adapter v1 | Wave 1 banks at BR1 (sandbox conformance); founder-validated business case (Section 3.6 bands) |
| **G1.5** (Jan 2029) | **Pilot permission letter** with value cap and conditions | Core v1 proofs complete; SOC 2 Type I; audit 1 clean; private bounty running; NOC in shadow mode | Wave 1 banks at BR3 (dress rehearsal, DR drill); their third-party-risk sign-off; board approvals |
| **G2** (Sep 2029) | **Cap-lift non-objection and designation decision**; proofs published; clean audit | DR drill RTO under 15 min RPO 0; SOC 2 Type II observation complete; netting and bond cash leg live | Wave 2 banks at BR3; all founders' 24/7 operations ready |
| **G3a** (Nov 2029) | No open regulatory conditions; regulator notified of production | 24/7 NOC live; public bug bounty | All founding issuers at BR4 and live |
| **G3b** (Sep 2030) | Independent PFMI observance rating; supervisory query under 60 s demonstrated | Two quarters at availability gate | Bank-realised benefits baselined |

**Regulatory gate register (hypotheses; counsel to confirm the legal route for each):**

| # | Gate | Likely authority | Why it matters |
|---|---|---|---|
| RG1 | Treatment of deposit tokens as deposits, and CDIC/AMF coverage | Finance Canada, CDIC, AMF (for Quebec-based institutions and Desjardins, whose deposits I believe are insured by the AMF rather than CDIC **[verify]**) | Premise of the network: "CDIC-insurable wherever the underlying deposit is". Note the blueprint's CDIC language does not cover credit unions or Desjardins. |
| RG2 | Oversight and legal finality (designation under the payment clearing and settlement regime, plus rulebook and insolvency protections) | Bank of Canada; Minister of Finance consent | Underpins invariant II. **Highest schedule risk.** |
| RG3 | Bank of Canada role: observer node and settlement anchor | Bank of Canada | Blueprint assumes central-bank money anchors interbank settlement; not confirmed (D1). |
| RG4 | Prudential treatment: capital, liquidity, third-party risk, technology and cyber, operational resilience | OSFI (B-10, B-13, E-21 and the model-risk guideline **[verify current status]**) | Each bank's own approval to issue |
| RG5 | Federal stablecoin regime carve-out for bank-issued deposit tokens | Finance Canada, Bank of Canada **[verify status of legislation]** | Avoids DepositX being classified with stablecoins |
| RG6 | Travel Rule and reporting applicability to token transfers | FINTRAC | Compliance engine design |
| RG7 | Privacy and data residency | OPC, Quebec CAI (Law 25) | Privacy-by-default design; Canadian residency |

### 4.4 Challenging the schedule: the realistic Production date

**If regulatory non-objection is the critical path, what is the realistic date?** Base: **30 November 2029**. Downside: **30 November 2030**.

**How I built it.**

| Regulatory chain element | Base | Downside | Reason |
|---|---|---|---|
| Pre-consultation to written pathway (R1) | 8 months (Nov 2026 to Jun 2027) | 11 months | Six regulators, no single lead; all founders must brief their own supervisors |
| Evidence preparation (R2: gap assessment, rulebook v1, finality opinion) to filing | Filing 2 months after G1 (May 2028) | 7 months after G1 (Oct 2028) | PFMI remediation and finality opinion may not be clean at G1 |
| Regulator review to pilot permission (R4) | **8 months** | **11 months** | The least defensible number in the plan. It is a P50 guess. Regulator elapsed time is not ours to control. |
| Capped live pilot before cap-lift request | 5 to 7 months | 8 to 9 months | Supervisory comfort needs observed operation; SOC 2 Type II needs a 6-month window |
| Cap-lift and designation decision (R5) | 2 months | 2 to 4 months | Assumes designation is decided alongside pilot evidence |
| Wave 2 cut-over before the bank change freeze | 2 months | 5 months | December to January freezes push cut-over to autumn or the following spring |

**What would make it worse than P80:**

- **A statute or regulation must be amended** (deposit-token definition, designation criteria). Add 18 to 36 months: Production 2031 to 2032. This is kill criterion K1/K2.
- **Bank of Canada will not provide settlement-anchor access.** Redesign of the interbank settlement leg through Lynx or a sponsor: 6 to 12 months.
- **Banks' regulatory-change capacity is consumed elsewhere** (Real-Time Rail, ISO 20022 obligations, OSFI's operational-resilience deadlines) **[verify current dates]**. Bank readiness moves from near-critical to critical.
- **Analogues (from memory, verify):** Lynx modernisation ran multiple years and slipped from its original date before going live in 2021; the Real-Time Rail target date has moved more than once; the UK's Fnality took roughly four years from launch of the venture to a live regulated payment system. None is a controlled comparison, but none supports a 24-month plan.

**What would make it faster (best case):** early, written regulator alignment (a joint statement by G0-R); a regulator willing to run review in parallel with the pilot; a founding group that is aligned on rulebook v1 by Q3 2027; a smaller initial scope (fewer templates, no netting at go-live). Even then, Production cannot land before 30 September 2029.

**Acceleration option, if the founders insist on an earlier date:** a **capped, two-bank "controlled live" pilot in Q4 2028** is the earliest credible live use of value (best-case pilot start November 2028). Call it exactly that. Do not call it Production.

### 4.5 Bank onboarding model (integration tiers, certification, waves)

**Certification stages (each bank passes all five):**

| Stage | Name | Evidence | Typical Tier A duration |
|---|---|---|---|
| BR0 | Commitment and design | Signed covenant; solution design reviewed by Design Authority; named programme lead | 3 to 4 months |
| BR1 | Sandbox conformance | Passes the operator's conformance suite on the testnet (mint, transfer, redeem, screening, reconciliation) | 6 to 9 months |
| BR2 | Integration test | Issuer node, core banking, screening, HSM ceremony and reconciliation run end to end in a prod-like environment | 6 to 8 months |
| BR3 | Dress rehearsal | DR drill, 24/7 stand-in, incident exercise, third-party-risk sign-off on the operator | 4 to 6 months |
| BR4 | Live authorisation | Supervisory notice, board approval, go/no-go by the operator's NOC | 1 to 2 months |

Sum for a Tier A bank: 20 to 29 months of gated work, plus the up-front decision time. That matches the 30 to 36 month figure in Section 1.7 once procurement and change windows are included.

**Waves:**

| Wave | Who | Dates (base) |
|---|---|---|
| Wave 1 | 2 to 3 founding issuers (one Tier A, one Tier B, one optional) | Live pilot Feb 2029 |
| Wave 2 | Remaining 3 to 4 founding issuers | Cut-over Oct to Nov 2029 |
| Wave 3 | Later equity members and participants, hosted-node path for Tier C | From Q1 2030; capacity limited to two onboardings a quarter until G3b |

**Bank change calendars and the real constraint.** Large banks freeze change from late November through January, and every large bank has competing regulatory-mandated programmes. Schedule cut-overs for autumn and spring. Ask each founder to put DepositX on the same Enterprise change calendar as its Real-Time Rail and ISO 20022 work so the conflicts are visible at G0.

### 4.6 Stage-gate governance

| Body | Members | Cadence | Decides |
|---|---|---|---|
| **Steering Committee** | One executive per founder (typically a CFO, COO or head of payments), independent chair, operator CEO, Programme Director; regulators as observers where they accept | Monthly; extraordinary at gates | Gate decisions, tranche release, change requests above $2M or 6 weeks on the critical path, management reserve |
| **Design Authority** | Operator CTO (chair), one architect per founder, two independent experts (applied cryptography, resilience) | Fortnightly | Architecture, consensus and contract changes, non-functional targets, ZK go/no-go, "does this weaken invariant I, II or III?" |
| **Programme Board** | One programme director per founder plus the operator's pod leads | Fortnightly | Integration, wave scheduling, readiness scores, cross-bank dependencies, changes from $250k to $2M or 2 to 6 weeks |
| **Change Control Board** | Programme Director (chair), PMO, finance, security, one bank representative on rotation | Weekly | Everything below the Programme Board thresholds; log of every change |
| **Independent Assurance (IV&V)** | External firm, reports to the Steering Committee, not to the Programme Director | At each gate and quarterly | Gate readiness opinion; cost and schedule reality check |

**Change control thresholds:**

| Change | Approver |
|---|---|
| Up to $250k, or up to 2 weeks off non-critical path | Programme Director |
| $250k to $2M, or 2 to 6 weeks, or scope moved between pods or phases | Programme Board |
| Over $2M, or over 6 weeks on the critical path, or change to gate criteria, or contingency draw over $5M cumulative in a quarter | Steering Committee |
| Anything touching an invariant, cryptographic choice or consensus parameter | Design Authority, then reserved-matter route |
| Baseline re-set above 10%, kill-criterion change, capital call outside plan | Board (economic or reserved matter) |

**Gate rules.** A gate has criteria written before the phase starts (Section 4.8), evidence assembled by the PMO, an independent readiness opinion, and a decision recorded as Go, Conditional Go (with dated conditions) or No-Go. Tranche release follows the gate, not the calendar. The board cannot waive the invariants.

### 4.7 Reporting cadence to founding banks

| Report | Audience | Frequency | Content |
|---|---|---|---|
| Pod delivery report | Programme Board | Weekly | Progress, blockers, dependencies, hiring |
| Programme dashboard | Programme Board, bank programme directors | Fortnightly | Section 6 dashboard, critical-path float, change log |
| **Steering pack** | Steering Committee | Monthly | Dashboard, gate outlook, financial forecast against baseline, top 10 risks, decisions needed |
| **Board and bank-board summary** | Founders' boards and risk committees | Quarterly | One-page dashboard, capital call outlook, regulatory status, distance-to-kill-criteria |
| Regulator update | OSFI, BoC, FINTRAC, Finance Canada (separately) | Quarterly and at each gate | Status against the pathway letter, risks, incidents |
| Independent assurance report | Steering Committee | At each gate and quarterly | Readiness, cost and schedule confidence |
| Bank-specific readiness scorecard | Each founder | Monthly | BR-stage progress, spend against that bank's plan, dependencies on the operator |

### 4.8 Gate exit criteria (blueprint criteria, tightened)

| Gate | Blueprint criterion | Tightened criterion (proposed) |
|---|---|---|
| **G0** | Operator incorporated with neutral chair; regulators confirm consultation pathway; architecture and invariants ratified by all founders | As drafted, plus six signed funding commitments; wave dates and readiness covenants signed; each founder CFO has submitted a first benefit estimate. G0-R (written regulator pathway) by June 2027 as a condition on releasing Phase 2 at-risk spend. |
| **G1** | 10,000 simulated transfers with zero par breaks; PFMI gap assessment and remediation plan; ZK meets target or fallback chosen | **At least 100M simulated transfers** with fault injection and zero par breaks; supply-to-liabilities reconciliation exact throughout; PFMI plan accepted by the operator's board; ZK decision made with a costed fallback; founder-validated business case in the Go or Conditional band; regulatory application pack complete. |
| **G1.5** | (new) | Pilot permission letter in hand; proofs complete; SOC 2 Type I; audit 1 clean; DR rehearsed; NOC in shadow mode; Wave 1 banks at BR3. |
| **G2** | Clean audit; proofs published; cap lifted by supervisory non-objection; DR drill RTO under 15 min RPO 0 | As drafted, plus SOC 2 Type II observation window complete; five months of live evidence with zero par breaks; regulator non-objection in writing. |
| **G3a** | (new) | All founding issuers live; 24/7/365 operation; netting and bond cash leg live; no open regulatory conditions. |
| **G3b** | 99.999% availability for two quarters; supervisory queries under 60 s; independent PFMI rating | Availability **at least 99.99%** over the two full quarters after G3a (99.999% remains the design target); supervisory queries under 60 s demonstrated; independent PFMI observance rating; realised bank benefits baselined; unit cost on trajectory. |

### 4.9 RAID log seed

**Risks.** R1 to R10 are the top ten in Section 7.1. Additional seeds:

| ID | Risk | Owner |
|---|---|---|
| R11 | Insurers will not provide cyber and E&O cover on acceptable terms for an FMI-grade ledger operator | CFO |
| R12 | Competition Bureau scrutiny of a consortium of competitors, including information exchange among founders | General Counsel |
| R13 | Quebec Law 25, PIPEDA and data-residency constraints on the ZK and read-node designs | General Counsel |
| R14 | Key-person dependency on the cryptography, formal-methods and HSM leads | Programme Director |
| R15 | Founder merger, exit or change of strategy | Steering Committee chair |
| R16 | Irrecoverable sales tax on operator spend larger than assumed | CFO |
| R17 | Post-quantum standards or cryptographic obsolescence forces re-verification earlier than Phase 4 | Design Authority |

**Assumptions.** A1 six founders (four Tier A, two Tier B). A2 federal share corporation. A3 platform selected by April 2027. A4 no statutory change. A5 regulator review in 8 months. A6 salary and vendor rates in Section 1.2 and 1.5. A7 each bank's Treasury validates or replaces the Section 3.6 benefits by G1. A8 production capacity of 500 instr/s at go-live (subject to Design Authority). A9 constant 2026 dollars. A10 the BoC observer role and a settlement anchor are available (D1).

**Issues (known today).** I1 title/phase-count error (Section 0.4). I2 Phase 3 exit criterion undatable as drafted. I3 ZK fallback undesigned. I4 no cost, funding or revenue model (this memo). I5 no onboarding model (Section 4.5). I6 legal basis of finality unspecified. I7 capacity target 5,000 instr/s is not tied to a demand forecast.

**Dependencies.** D1 Bank of Canada role (observer and settlement anchor) in writing. D2 OSFI position on capital, liquidity, third-party risk for deposit tokens. D3 CDIC/AMF coverage opinion. D4 Finance Canada and BoC designation route. D5 FINTRAC guidance. D6 Payments Canada position on interoperability with Lynx and the Real-Time Rail. D7 core-banking vendor roadmaps. D8 HSM supply lead times. D9 platform vendor viability and roadmap. D10 each bank's change calendar and competing regulatory programmes.

---

## 5. Organisation design

### 5.1 Operator organisation by phase

Headcounts are average FTE in the window (Section 1.3), including secondees and contractors.

**Phase 0 (28 FTE): mobilise, incorporate, regulate**

```
Board (independent chair + 6 founder directors + 3 independents)
  Programme Director / interim CEO
    PMO and Design Authority secretariat (incl. Chief Architect)   6
    General Counsel & Head of Regulatory Affairs (Rulebook pod)    8
    Interim CFO / finance & corporate                              5
    Security architecture (CISO-designate)                         3
    Ledger 2 | Settlement 1 | Compliance 1 | Integration 2 (design leads)   6
```

**Phase 1 (76 FTE): sandbox**

```
Board
  CEO (permanent from ~Jun 2027)
    CTO / Chief Architect ──► Ledger 13 | Settlement 9 | Compliance & Identity 7 | Integration/SDK 10 | Onboarding 1
    CISO ─────────────────► Security & SRE 9
    General Counsel ──────► Rulebook 8
    CFO ──────────────────► Finance, HR, procurement 8
    Head of Risk & Compliance (CRO/CCO)   (within corporate)
    Programme Director ───► PMO, DA secretariat, QA & release 11
```

**Phase 2 (126 FTE): regulated pilot**

```
Board
  CEO
    CTO ──► Ledger 20 | Settlement 15 | Compliance & Identity 12 | Integration/SDK 16 | Onboarding Office 6
    CISO / Head of SRE ──► Security & SRE 18 (NOC in shadow mode from Q3 2028)
    General Counsel ──► Rulebook 9
    CFO / CRO ──► Corporate 12 (incl. internal audit, third-party-risk, vendor management)
    Programme Director / COO ──► PMO, DA, QA & assurance 18
```

**Phase 3 (140 FTE) transitioning to steady state (100 FTE)**

```
Board
  CEO
    COO ──► Operations (24/7 NOC, SRE, service desk) 40
            Member services & onboarding 8
    CTO ──► Platform engineering & change 28 (Ledger, Settlement, Integration, Compliance)
    CISO ──► Security operations, key management, GRC 12
    CRO/CCO/GC ──► Compliance, risk, internal audit, legal 6
    CFO ──► Finance, HR, procurement 6
```

The Phase 3 total of 140 includes about 40 build FTE tailing off. Between G3b and the end of 2031 the team steps from 140 to about 100 as build roles are released or converted to change roles.

### 5.2 Pod structure (the six blueprint pods, with my additions)

| Pod | Lead role | Scope | Interfaces to banks |
|---|---|---|---|
| 1 Ledger | Principal Ledger Engineer | L1 consensus, L2 token contracts, par module, supply reconciliation, ZK layer or fallback | Validator-node specification; issuer key ceremonies |
| 2 Settlement | Settlement Lead | L3 DvP/PvP, template library, liquidity-saving netting, 24/7 mint and redeem | Treasury and liquidity teams; tokenised-bond cash leg |
| 3 Compliance and Identity | Compliance Engineering Lead | L4 screening, Travel Rule, limits and velocity, identity attestations, FINTRAC hooks | Bank AML, sanctions and KYC teams |
| 4 Integration/SDK | Integration Lead | L5 gateway, ISO 20022 adapter, reference core-banking adapter, wallet SDK, conformance suite | Core-banking and channels teams |
| 5 Security and SRE | CISO and Head of SRE | HSM, MPC, key ceremonies, infra, observability, NOC, chaos and DR | Bank security and resilience teams |
| 6 Rulebook | General Counsel | L0 rulebook, membership, legal opinions, regulatory reporting | Bank legal and regulatory affairs |
| Enabling: PMO, DA secretariat, QA and assurance | Programme Director | Schedule, change control, test strategy, independent assurance | Bank programme directors |
| Enabling: Onboarding Office | Head of Onboarding | BR0 to BR4, certification, waves | Bank programme leads |

### 5.3 The first 30 hires and the hiring order

Principles: hire leaders first (they hire the rest); hire the scarcest skills early (cryptography, formal methods, HSM, FMI regulatory counsel); hire security and legal before scale; use secondees and boutique contractors to bridge the first two quarters.

| # | Role | Needed by | Why now | Sourcing |
|---|---|---|---|---|
| 1 | CEO (permanent; interim = Programme Director) | Jun 2027 (search starts Oct 2026) | Regulators need a named accountable head | Retained search; former FMI or regulator; neutral to founders |
| 2 | Programme Director / COO | Oct 2026 | Runs mobilisation | Founder secondment or senior external |
| 3 | Chief Architect / CTO | Nov 2026 | Ratify architecture and invariants by G0 | External; distributed-systems and payments |
| 4 | General Counsel and Head of Regulatory Affairs | Nov 2026 | Critical path (R1, R2) | External; FMI regulatory background |
| 5 | CFO | Dec 2026 | Funding, PFMI 15, tranches | External; regulated FMI or bank finance |
| 6 | CISO / Head of Key Management | Dec 2026 | Threat model, keys, third-party risk | External |
| 7 | Head of Risk and Compliance (CRO/CCO) | Jan 2027 | FMI risk framework, PFMI self-assessment | External |
| 8 | Head of Rulebook and Membership | Jan 2027 | Rulebook v0 and v1 | Secondee or external |
| 9 | Principal Ledger / Consensus Engineer (Pod 1 lead) | Feb 2027 | Platform selection (T1) | External |
| 10 | Principal Applied Cryptographer / ZK Lead | Feb 2027 | Scarcest skill; ZK decision by Dec 2027 | External, or boutique plus academic partner |
| 11 | Settlement Lead (Pod 2) | Mar 2027 | DvP, ISO 20022 securities background | Secondee |
| 12 | Compliance Engineering Lead (Pod 3) | Mar 2027 | Screening, Travel Rule | External or secondee |
| 13 | Integration Lead (Pod 4) | Mar 2027 | Reference adapter | External |
| 14 | Head of SRE (Pod 5) | Mar 2027 | Environments, observability | External |
| 15 | PMO Lead and Planner | Nov 2026 | Baseline and change control | External |
| 16 | QA, Test and Release Lead | Apr 2027 | Reproducible builds, SBOM, soak testing | External |
| 17 | HSM / PKI / Key Ceremony Engineer | Apr 2027 | HSM selection and ceremony design | Bank or government security talent |
| 18 | ISO 20022 Data and Business Architect | Apr 2027 | Message design, adapter | Secondee or external |
| 19 | Formal Methods Lead | May 2027 | Contract freeze and proofs from Apr 2028 | External or boutique |
| 20 | Regulatory Affairs Manager | Apr 2027 | Day-to-day regulator liaison | External |
| 21 to 22 | Two Senior Smart-Contract Engineers | May to Jun 2027 | Par module, settlement contracts | External |
| 23 to 24 | Two Senior SREs | Jun 2027 | Testnet and pilot environments | External |
| 25 | Core-Banking Integration Architect | Jun 2027 | Reference adapter | Secondee |
| 26 | Compliance Engineer (screening) | Jul 2027 | Compliance engine MVP | External |
| 27 | Head of Bank Onboarding and Certification | Jul 2027 | BR0 to BR4 scheme | Secondee or external |
| 28 | Technical Programme Manager | Jul 2027 | Pod dependencies | External |
| 29 | Financial Controller / FP&A | Jul 2027 | Reporting, tranches | External |
| 30 | Third-Party Risk and Procurement Lead | Aug 2027 | Vendor risk, contracts | External |

Permanent hires 1 to 30 complete by August 2027. Hiring agency time-to-fill for specialist roles is 4 to 6 months, so search starts 4 to 6 months before "needed by". Plan for 12% to 15% annual attrition and keep named deputies for every critical role by G1.

### 5.4 Headcount build by quarter (operator, end of quarter, base)

| | Q4'26 | Q1'27 | Q2'27 | Q3'27 | Q4'27 | Q1'28 | Q2'28 | Q3'28 | Q4'28 | Q1'29 | Q2'29 | Q3'29 | Q4'29 | Q1'30 | Q2'30 | Q3'30 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Total FTE | 30 | 42 | 62 | 80 | 92 | 100 | 112 | 122 | 128 | 132 | 136 | 138 | 142 | 142 | 140 | 138 |

Window averages check against Section 1.3: Phase 0 about 28 (quarter averages 19 and 36), Phase 1 about 76, Phase 2 about 125, Phase 3 about 140. **In Q4 2026 the 30 FTE are mostly secondees, contractors and embedded advisors:** about 6 employees, 8 secondees and 16 contractors. The permanent share rises to about 50% by Q4 2027.

### 5.5 Build, buy and partner

| Capability | Build | Buy | Partner | Rationale |
|---|---|---|---|---|
| Par-enforcement module; settlement contracts; template library | **Build** (own the IP and the assurance) | | Boutique for formal verification and audit | Invariants live here; cannot outsource accountability |
| Ledger and consensus platform | Configure and harden | **Buy** enterprise support for an open-source-based platform | | Boring cryptography principle; avoid inventing a consensus stack |
| ZK confidentiality | Design authority and integration | | **Partner** with a specialist and an academic lab; fallback in house | Scarce skills, high uncertainty |
| Key management, HSM, MPC | Ceremony design and operations | **Buy** HSMs (network and cloud) | Attestation by an independent firm | Regulated custody-grade practice |
| Compliance engine | Rules and orchestration | **Buy** screening lists and engines | Data vendors | Not differentiating |
| Reference core-banking adapter and bank integrations | Reference adapter and conformance suite | Middleware | **Partner** with SIs for bank-side delivery under fixed-price, risk-sharing contracts | Volume of bank-side work exceeds what any operator should employ |
| Cloud and infrastructure | Architecture, IaC, SRE | **Buy** Canadian regions from a hyperscaler (two regions, three AZs) | | Data residency and resilience |
| Programme assurance, PFMI readiness, regulatory strategy | | | **Partner** with a KPMG-type advisor and independent IV&V (separate from the advisor who drafted the blueprint, to preserve independence) | Independence and speed |
| Legal opinions (finality, competition, corporate) | | | **Partner** with two law firms; opinions from more than one | Regulators discount a single opinion |
| NOC 24/7 | **Build** the core team | Managed tooling | Optional overflow partner for L1 | Accountability stays in the operator |

**Peak mix (about 126 FTE):** roughly 60 employees, 18 secondees, 48 SI/contractor/boutique.

### 5.6 Secondments from member banks

- **Number:** 18 (three per founder), about 14% of the peak operator workforce. Twelve-to-twenty-four month terms.
- **Where they go:** payments operations and NOC design; treasury and liquidity; core-banking architecture; risk and compliance; legal; security.
- **Cost treatment:** the parent bank continues to pay the salary; the operator credits up to 15% of that bank's capital commitment at $240k per FTE-year, and the operator budget shows the same cost so the plan is not double-counted. About $8.6M over two years (18 x $240k x 2).
- **Rules:** cap of 20% of any pod; cannot lead a pod; report only to the operator; clean-team protocols on competitor information (competition-law counsel to approve); secondees return to the bank with a documented handover, which also seeds bank-side capability.
- **Why:** they bring bank operating reality to the design, speed up adapter certification, and give each founder trust that the operator understands its constraints.

### 5.7 Canadian talent-market realism

Pool sizes below are **my estimates; validate with a two-week retained talent map (about $50k to $80k)** before the Phase 1 hiring plan is locked.

| Skill | Need at peak | Canadian pool (estimate) | Time to fill | Plan |
|---|---:|---|---|---|
| Distributed-systems and consensus engineers | 8 | Dozens with production experience; concentrated in Toronto, Montreal, Waterloo | 5 to 6 months | Hire 3 to 4 in Canada; contract 3; two secondees; targeted recruiting from enterprise-ledger vendors |
| Applied cryptographers and ZK engineers | 4 to 6 | Fewer than a few dozen experienced practitioners **[verify]** | 6 to 9 months | Boutique and academic partnership; 30% pay premium; hire the lead early; fallback design as insurance |
| Formal-methods and verification engineers | 3 to 4 | Very small | 6 to 9 months | Boutique for the bulk; one in-house lead |
| Smart-contract engineers | 6 to 8 | Moderate; supply improved after crypto-sector layoffs | 4 to 5 months | Hire; audit externally |
| HSM, PKI and key-management specialists | 4 | Moderate; bank, defence and government pools (Ottawa) | 4 to 5 months | Hire; recruit from government and defence |
| ISO 20022 and payments architects | 5 | Good; banks and Payments Canada | 3 to 4 months | Secondments plus hires |
| SRE and platform engineers | 20 | Good | 3 to 4 months | Hire |
| NOC operators (24/7) | 22 | Good, but night-shift retention is hard | 3 months | Two sites, night differential, defined career path into SRE; overtime cap |
| FMI-experienced regulatory counsel and risk | 6 | Scarce | 4 to 6 months | Law-firm secondments; ex-regulator hires; retain external counsel |
| Compliance-engine and AML technology | 8 | Good; bank pools | 3 to 4 months | Hire and secondees |

**Levers:** recruit from enterprise-ledger vendors, bank technology and defence; use the Global Talent Stream and remote hiring for scarce specialists (privileged access to production and keys stays with Canada-resident, security-cleared staff; **verify immigration timelines**); train two to three internal apprentices in formal methods and ZK in Phase 1. **Data residency constrains where systems and keys sit, not where every engineer sits;** the operator's access-control policy must say so explicitly.

### 5.8 Run team shape and the 24/7 NOC

**Steady-state operator (about 100 FTE)** (Section 3.1): Operations 40; Security operations, key management and GRC 12; Member services and onboarding 8; Platform engineering and change 28; Compliance, risk, audit, legal 6; Executive and corporate 6. The blueprint's 40 to 60 corresponds to Operations plus Security operations plus Member services (60).

**NOC staffing arithmetic.** One always-staffed seat needs 168 hours a week of cover. A person works about 36 effective hours a week after breaks and handover. 168 / 36 = 4.67 FTE, plus 15% for leave, sickness and training = **5.4 FTE per seat**.

| Seat (24/7) | Role | FTE |
|---|---|---:|
| 1 | Network, consensus and platform health (L1) | 5.4 |
| 2 | Settlement operations, liquidity and exception desk; issuer-bank liaison | 5.4 |
| 3 | Security operations analyst | 5.4 |
| 4 | Duty incident manager | 5.4 |
| | **NOC seats** | **21.6, round to 22** |
| | L2 SRE on-call rota (1 in 10 for sustainable on-call) | 10 |
| | Member service desk and change/release management | 8 |
| | **Operations total** | **40** |

**Design points.** Two sites, Toronto and Montreal, both in Canada (data residency rules out follow-the-sun from abroad). Active-active with no maintenance windows means the NOC also runs change execution, so change management is part of the run team, not an afterthought. L3 engineers from the Platform Engineering team take a secondary on-call with compensation. Chaos and DR drills quarterly. The NOC runs in shadow mode from Q3 2028 and goes live at pilot start (February 2029), so the team has 9 months of pilot before production.

---

## 6. KPIs and board dashboard

### 6.1 KPI set and targets by phase

Targets are at the gate ending each phase. G0 Mar 2027, G1 Mar 2028, G2 Sep 2029, G3b Sep 2030.

**Programme health**

| KPI | G0 | G1 | G2 | G3b | Red trigger |
|---|---|---|---|---|---|
| Schedule performance index (SPI) | at least 0.90 | at least 0.90 | at least 0.92 | at least 0.95 | under 0.80 for two months |
| Cost performance index (CPI) | at least 0.95 | at least 0.95 | at least 0.95 | at least 0.95 | under 0.85 |
| Forecast at completion versus baseline | Baselined | within +10% of G1 baseline | within +10% | within +10% | over +15% (K7) |
| Contingency used versus risk retired | at most 40% used by G1 | at most 65% by G2 | at most 85% by G3b | | draw ahead of risk retirement |
| Critical-path float (base plan), months | at least 0 | at least 0 | at least 0 | n/a | negative for two months |
| Critical roles filled versus plan | 85% | 85% | 90% | 95% | under 70% |
| Annualised attrition, operator | n/a | at most 15% | at most 12% | at most 12% | over 20% |
| Key-person cover (named deputy) | n/a | 100% | 100% | 100% | any critical role uncovered |
| Founders with signed funding and readiness covenants | 6 of 6 | 6 of 6 | 6 of 6 | 6 of 6 | fewer than 5 |
| Bank readiness index (share of Wave 1/2 banks on plan BR stage) | n/a | at least 80% | at least 85% | 100% live | under 60% |

**Technical**

| KPI | G1 | G2 | G3b |
|---|---|---|---|
| Par breaks (cumulative) | 0 | 0 | **0 (any is system-halting)** |
| Unexplained supply-to-liabilities reconciliation exceptions over 1 minute | 0 | 0 | 0 |
| Finality: median / p99 (instruction accepted to consensus-final) | under 2 s / under 5 s at at least 500 instr/s, single issuer | same at at least 2,500 instr/s, multi-issuer, lab; pilot at demand | same at 5,000 sustained and 20,000 burst in lab; production at observed peak with 3x headroom |
| Availability | n/a | at least 99.9% during pilot | **at least 99.99% over two quarters (gate); 99.999% design target** |
| Formal-verification coverage of specified par and settlement properties | Scope agreed | 100% proved and independently reviewed | 100%, re-proved on every change |
| Critical/high audit findings open more than 30 days | 0 | 0 | 0 |
| Mean time to patch critical vulnerabilities | n/a | at most 7 days | at most 3 days |
| Key ceremonies on schedule | n/a | 100% | 100% |
| Reproducible builds and SBOM coverage of releases | 100% | 100% | 100% |
| DR drill RTO under 15 min, RPO 0 | n/a | passed | passed each quarter |
| Supervisory query time from read-node | n/a | under 5 min in pilot | **under 60 s** |

**Commercial**

| KPI | G0 | G1 | G2 | G3b |
|---|---|---|---|---|
| Founder capital called versus plan | 100% of T0 | 100% of T0 + T1 | 100% of T0 to T2b | 100% of T3 |
| Aggregate validated annual gross benefit | First estimates in | In Go or Conditional band (at least $100M/yr) | At least $100M/yr, re-confirmed | Baselined and measured |
| Founder volume commitments (Minimum Annual Participation Fee signed) | Term sheet | Non-binding at least 30M instr/yr | Binding at least 45M instr/yr | Annualised live run-rate at least 25M instr/yr (40% of base) |
| Founding issuers live | n/a | 0 (testnet) | 2 to 3 | 6 |
| Additional participants signed | n/a | n/a | at least 2 | at least 4 |
| Operator run cost versus budget | n/a | n/a | within +/-5% | within +/-5% |
| Unit cost per instruction | n/a | n/a | tracked | on trajectory to -3%/yr real |
| Onboarding cycle time per bank (BR0 to live) | n/a | plan | Wave 1 at most 36 months | Tier C hosted at most 12 months |
| Member satisfaction survey | n/a | n/a | at least 7 of 10 | at least 8 of 10 |

**Risk**

| KPI | G0 | G1 | G2 | G3b | Red trigger |
|---|---|---|---|---|---|
| Open High-rated risks | at most 8 | at most 5 | at most 3 | at most 3 | over 8 |
| Risk-weighted exposure versus remaining contingency | at most 1.0 | at most 1.0 | at most 1.0 | at most 1.0 | over 1.2 |
| Regulatory milestones on time versus pathway letter | n/a | at least 80% | at least 80% | 100% | any regulator says "not on track" |
| Open regulator queries older than 30 days | 0 | at most 3 | at most 3 | 0 | over 5 |
| Critical third parties with a tested exit plan | n/a | 50% | 100% | 100% | any critical vendor untested at G2 |
| Severity-1 incidents | n/a | n/a | at most 1 per quarter | 0 per quarter | par break (stop) |
| Distance to kill criteria (Section 7.2), tracked as a tile | Reported | Reported | Reported | Reported | any criterion within 20% of its trigger |

### 6.2 Board dashboard: twelve tiles

One page, monthly to the Steering Committee, quarterly to founder boards. Each tile shows current value, trend, target, and Red/Amber/Green.

1. Schedule: critical-path float and next gate date (P50 and P80).
2. Cost: spend to date, forecast at completion versus baseline, contingency remaining.
3. Funding: capital called versus plan, undrawn commitments, funding covenant status.
4. Regulatory: status of RG1 to RG7, letters received, queries outstanding.
5. Bank readiness: BR-stage of each founder against its wave date.
6. Technical integrity: par breaks, reconciliation exceptions, verification coverage.
7. Performance: finality p50 and p99, sustained throughput in lab, availability.
8. Security: open critical findings, patch time, key-ceremony status, incidents.
9. People: critical roles filled, attrition, key-person cover.
10. Commercial: volume commitments, participants signed, projected revenue against run cost.
11. Business case: aggregate validated benefit versus Go/Conditional/Stop bands.
12. Kill-criteria distance: one bar per criterion showing how close each is to its trigger.

**RAG rule.** Green: within tolerance. Amber: outside tolerance but a recovery plan is dated and owned. Red: outside tolerance and no credible plan, or any invariant breach. Two consecutive Red months on any tile go to the Steering Committee as a formal decision item.

---

## 7. Risks and kill / pivot criteria

### 7.1 Top ten business and programme risks

Likelihood and impact on a 1 to 5 scale. Exposure in dollars or months of delay to Production. Cost of delay is about $11.9M a month in Phase 2 (Section 1.8).

| # | Risk | L | I | Exposure | Mitigation | Owner |
|---|---|---:|---:|---|---|---|
| 1 | **Regulatory perimeter and legal finality not resolved in time**, or requires a statute or regulation change; CDIC/AMF treatment of deposit tokens unsettled | 4 | 5 | +12 to +24 months; up to $140M carrying cost; possible stop | Written regulator pathway by G0-R; legal-opinion programme starts in Phase 0 with two firms; joint regulatory working group; scope options prepared for a narrower launch (fewer features, capped value) | General Counsel |
| 2 | **Governance deadlock or big-bank domination** among competing issuers | 3 | 5 | Stalls gates; founder exit | Governance package in Section 2.5; independent directors; Design Authority independence; escalation to independent chair; readiness covenants | Board chair |
| 3 | **Business case does not close** (volume or benefits below break-even; Section 3.4 and 3.6) | 4 | 4 | Standalone base loses $8M/yr at list; Tier A NPV -$78M in base | Founder-validated benefits by G1; volume commitments; lean-operator pivot; cost levers; Phase 4 case separately gated | CFO |
| 4 | **ZK confidentiality, formal verification and throughput** miss target | 3 | 4 | +6 to +9 months; $20M to $40M | Fallback designed and costed now; hard decision December 2027; lab-only capacity proof; boutique verification | CTO |
| 5 | **Core-banking integration cost and timeline at large banks** (batch cores cannot post 24/7 with sub-2-second finality) | 4 | 4 | +$30M to $80M; +6 months on Wave 1 or 2 | Reference adapter and conformance suite in Phase 1; stand-in sub-ledger pattern; fixed-price SI contracts; each bank reprices Section 1.7 against its own Lynx/ISO 20022 actuals | Head of Onboarding |
| 6 | **Talent scarcity and attrition** (ZK, formal methods, HSM, NOC) | 4 | 3 | +3 to +6 months; +10% labour | Early hires of leads; boutique and academic partnerships; secondments; named deputies; apprenticeship; night-shift retention plan | Programme Director |
| 7 | **Bank capacity contention** (Real-Time Rail, ISO 20022, OSFI operational-resilience deadlines, year-end freezes) | 4 | 3 | +3 to +9 months on bank readiness | Single enterprise change calendar at G0; cut-overs in autumn and spring; steering-level escalation; covenant with delay contribution | Steering Committee |
| 8 | **Security event, par break or key compromise during pilot** | 2 | 5 | Existential; stop-and-review | HSM plus MPC; formal verification; two independent audits; red team; bug bounty; chaos and DR; stop rule on any par break | CISO |
| 9 | **Vendor, platform and concentration risk** (platform vendor viability, single hyperscaler or region, HSM lead times, founder-owned vendors) | 3 | 4 | +3 to +9 months; $10M to $25M | Open-source-based platform with escrow and multiple support options; multi-region design; early HSM orders; competitive bidding; tested exit plans | CTO / CFO |
| 10 | **Competing rails and strategic drift** (Payments Canada or the Bank of Canada launches an overlapping tokenised rail; stablecoin regime evolves; Lynx/RTR liquidity fragmentation) | 3 | 4 | Volume below Low case | Interoperability by design; maintain regulator alignment; scenario review at each gate; pivot P3 | CEO |

### 7.2 Kill and pivot criteria

**Kill (stop the programme or stop further spend)** requires a Steering Committee decision, ratified by a reserved-matter vote at the board.

| # | Trigger | Measured at | Response |
|---|---|---|---|
| K1 | A regulator states in writing that deposit tokens cannot be treated as deposits or as CDIC/AMF-covered, and no acceptable structure exists | Any time; G0-R at latest | Stop, or re-scope to a wholesale-only, non-insured structure with a fresh business case |
| K2 | **No written route to legal finality** (designation or equivalent) by G1 (Mar 2028), or a statutory change is required with no dated legislative path | G1 | Hold all Phase 2 spend; if not resolved within a further 6 months, stop |
| K3 | Fewer than **five** founding issuers, or fewer than three of the six largest banks, sign funding and readiness covenants by G0 | G0 | Re-scope to a lean variant or halt: network effect fails below this size |
| K4 | Founder-validated aggregate steady-state gross benefit **below $70M a year** (70% of the base $100M) | G1 | Stop or pivot to lean operator (P1). At $70M the network delivers under two-thirds (64%) of its steady-state total cost of ownership of $108.8M. |
| K5 | Par or settlement design flaw found in formal verification that cannot be fixed within 6 months; or the fallback confidentiality design cannot sustain 500 instr/s at under 2 s median in the Phase 2 lab | G1 to G2 | Stop the production path; re-design |
| K6 | Two consecutive failed reserved-matter votes on rulebook v1 or fee methodology; or a founder withdrawal that leaves fewer than four issuers | Any time | Re-scope; independent mediation first |
| K7 | Forecast at completion exceeds **130%** of the G1 baseline without an approved re-baseline, or cumulative spend exceeds gate budget by more than 15% | Monthly | Freeze new hires and vendor commitments; re-baseline decision at Steering Committee |
| K8 | The Bank of Canada declines an observer and settlement-anchor role | G0-R | Pivot P2 (interbank settlement through an alternative anchor) |
| K9 | Any par break in pilot or production; or a critical audit finding unremediated after 90 days | Any time | Halt issuance and redemption at once; independent review; resume only by reserved-matter vote |
| K10 | An overlapping national rail is announced that delivers the same capability with regulator preference | Any time | Pivot P3 (interoperate or co-build) |

**Pivot options.**

| # | Pivot | When | Effect |
|---|---|---|---|
| P1 | **Lean operator:** outsourced 24/7 NOC, about 60 FTE, cloud-managed, wholesale only | K4, or low-volume forecast | Run cost about $39M a year (Section 3.5); programme cost falls by about $60M to $80M (my estimate) |
| P2 | **Alternative settlement anchor:** interbank settlement through Lynx or a sponsor bank rather than direct central-bank money | K8 | +6 to 12 months; changes the legal-finality argument |
| P3 | **Interoperate, do not compete:** re-scope DepositX as a standard and reference implementation to be operated by an existing FMI | K10, or K2 partial | Operator cost falls by more than half; ownership passes to the FMI |
| P4 | **Narrow launch:** capped value, fewer templates, no netting at go-live, single issuer class | Schedule risk at G2 | Earlier live date; lower revenue |

**Stop-loss discipline.** Each gate memo shows the spend committed to date and the stranded cost if the board stops at that gate. Operator-only estimate: at G0 about $13M, at G1 about $60M (12.9 + 46.5, plus at-risk commitments), at G2 about $175M (12.9 + 46.5 + 115.4). Bank-side spend is additional and sits with each bank. The board should look at these numbers before every release.

---

## 8. First 90 days (October to December 2026) and open items

### 8.1 Actions

| # | Action | Owner | By |
|---|---|---|---|
| 1 | Sign founders' term sheet and T0 funding ($12.9M, equal shares) | Founders' CFOs | 15 Dec 2026 |
| 2 | Appoint Programme Director / interim CEO and the PMO; publish the plan of record | Board | 31 Oct 2026 |
| 3 | Name the independent chair; start CEO search | Board | 30 Nov 2026 |
| 4 | Retain two law firms (structure/competition and financial regulatory) | General Counsel | 31 Oct 2026 |
| 5 | Open regulator pre-consultation with a joint agenda and named leads; request written pathway | General Counsel | Meetings begin Nov 2026 |
| 6 | Each founder Treasury and CIO reprices Sections 1.7 and 3.6 against its own Lynx, ISO 20022 and Real-Time Rail actuals | Founder CFOs / CIOs | 31 Jan 2027 |
| 7 | Talent map and search retainers for the first 30 hires | Programme Director | 30 Nov 2026 |
| 8 | Choose independent assurance firm (not the blueprint's author) | Steering Committee | 15 Dec 2026 |
| 9 | Design Authority convened; ZK fallback design commissioned; capacity target re-examined (500 versus 5,000) | Chief Architect | Dec 2026 |
| 10 | Broker and vendor soundings: insurance capacity, HSM lead time, platform support quotes | CFO | Jan 2027 |

### 8.2 Items to verify before anything here is quoted externally

1. Lynx, ACSS, Fedwire and CHAPS fee levels and volumes (Section 3.3, 3.4).
2. Regulatory framework references: the payment clearing and settlement designation regime, CDIC and AMF coverage of deposit tokens, federal stablecoin legislation status, OSFI guideline titles and effective dates, PFMI Principles 15, 18, 21 and 23 wording (Sections 0.4, 2, 3, 4.3).
3. Bank Act and competition-law constraints on a consortium of banks holding and governing an operator.
4. Compensation bands (Section 1.2) and talent-pool sizes (Section 5.6).
5. Irrecoverable sales-tax treatment of external spend.
6. Insurance capacity and pricing for an FMI-grade ledger operator.
7. Analogue programme timelines (Lynx, Real-Time Rail, Fnality).
8. Whether the Bank of Canada will operate an observer node, and in what form settlement-anchor access is available.

### 8.3 What I need from other seats

- **Architecture seat:** platform stack decision timeline; the designed ZK fallback; whether a 500 instr/s provisioned capacity is acceptable for Phase 3.
- **Legal and regulatory seat:** the likely legal route for finality and designation; an early read on whether a statute change is needed (this decides between base and severe cases).
- **Risk and security seat:** confirmation of the gate at 99.99% versus 99.999%; the independence requirements for the audit and assurance firms.
- **Business/product seat:** first cut of the founder volume estimates that replace my Section 3.4 assumptions.

*End of memo.*
