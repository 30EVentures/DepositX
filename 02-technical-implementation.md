# Concord Network — Technical Implementation Specification

**Status:** Consolidated design for ratification at the Architecture Review Board (target 11 Dec 2026). Synthesises the CTO and CISO/SRE seat memos and applies the board resolutions in `00-board-resolutions.md` §3.
**Depth:** this document fixes decisions, interfaces, invariants, targets and the build plan. The full component detail, threat tables and runbook outlines live in `board/cto-technical-implementation.md` and `board/ciso-security-resilience.md`; section references below point there.
**Convention:** every performance number is a **planning estimate until the named spike (S1–S10) measures it.** **[V]** = unverified. Nothing here has been built or measured.

---

## 1. Decisions of record (proposed)

| ID | Decision | Rationale | Source |
|---|---|---|---|
| T-1 | **Ledger = purpose-built deterministic Rust state machine ("Concord Ledger Core") on a BFT engine, CometBFT first, engine swappable behind a `ConsensusHost` interface. No general-purpose VM.** Templates are native reviewed modules. | The blueprint's own non-goals (no user code) make a VM pure attack surface; the invariants can live in a ~10 kLoC verifiable kernel. | CTO §1 |
| T-2 | **Decide by measurement, not matrix.** 10-week bake-off, 12 Oct–18 Dec 2026: custom vs Canton/Daml vs Besu QBFT, identical workload, hard thresholds. **Plan B = Besu QBFT** (staffing/schedule failure); **Plan C = Canton** (confidentiality failure). | Matrix score is 80.2 custom / 72.6 Besu / 69.3 Canton / 66.0 Corda, but a schedule-heavy weighting flips the winner to Besu (74.8). Nine-figure money should not ride on a scored guess. | CTO §1.2–1.3 |
| T-3 | **Par is enforced in the state machine, below any contract layer.** Seven invariants P1–P7 checked at end of every block; graded halt. | Only place a halt is enforceable against a buggy or malicious template. | CTO §2.3 |
| T-4 | **Token model X:** a cross-issuer payment burns payer-issuer tokens and mints payee-issuer tokens, with issuer-to-issuer value moving through prefunded settlement positions. Payee ends up holding a claim on their own bank. Account-based, novation-style. **Drop "bearer".** | Bearer circulation (model Y) creates cross-issuer exposure and changes CDIC attribution. | CTO §0, Legal §5 |
| T-5 | **Settlement anchor:** each issuer holds a prefunded settlement position, backed 1:1 by central-bank funds or collateral, **held in issuer or Payments Canada-member accounts, never by the Operator.** `SettlementAsset` abstraction supports A1 (segregated BoC balance mirrored on ledger), A2 (collateralised bilateral plus default waterfall), later wholesale digital CAD. | Without it, cross-issuer payments carry unsecured interbank credit and finality/par cannot be claimed. | CTO §2.6, Legal §0, Strategy §0 |
| T-6 | **Confidentiality is a kernel mode.** M0 plain (testnet, synthetic data); M1 ZK committed amounts (Pedersen + range proofs); M2 issuer-domain need-to-know (fully designed now). **Selected at G1.2, 14 May 2027.** Phase 3 does not depend on ZK. | Removes the blueprint's biggest bet from the critical path. | CTO §3 |
| T-7 | **Bank core stays the legal source of truth for the deposit liability; the ledger is authoritative for who owns which token at the consensus instant.** Customer-level balances live in a bank-hosted Tokenised Deposit Subledger (TDS). Legacy cores see only mint, redeem and aggregate postings. | Only design where a batch-era core and a high-rate network coexist. | CTO §5 |
| T-8 | **Consensus ladder:** n/f = 4/1 (Phase 1), 7/2 (Phase 2), 10/3 (Phase 3), 13/4 (cap). One organisation, one vote. Operator (2 seats) + neutral seat = exactly f at n=10 so they cannot break safety alone. **≥4 failure domains, ≤f validators per domain.** BoC is a non-voting observer and the design does not rely on it. | Placement, not "3 AZs / 2 regions", is what buys zero-touch survivability under BFT. | CTO §2.1, CISO §2.3 |
| T-9 | **Fail-stop doctrine.** Above f failures the network halts; reads and supervisory queries continue. Above f Byzantine faults safety is lost; mitigation is detective and legal. | No degraded mode that accepts value-moving instructions without full quorum. | CISO §0.1 |
| T-10 | **Keys:** HSMs at FIPS 140-3 Level 3 **[V vendor status; 140-2 certificates went historical about 21 Sep 2026 per CISO]**. Governance actions use on-ledger m-of-n multisig across independent organisations. MPC only where one off-ledger key must exist. Mint needs two independent keys (mint-policy + liability attestation, separate admin domains). Operator holds no member keys and has no admin transfer or clawback path. | "Boring cryptography"; MPC is harder to audit and generally not FIPS-validated. | CTO D8, CISO §1 |
| T-11 | **Capacity:** requirement is demand-derived (start 250/s sustained, 1,000/s burst, sizing model due 23 Oct); **provision 500/s at go-live; prove 5,000/s in the lab.** | Sustained 5,000/s is about 5× the entire Canadian all-rail volume **[V]** and ~600× the CFO's high-case average. | 00 §3 C3 |
| T-12 | **SLO ladder:** 99.9% pilot → 99.95% at G2 → 99.99% contractual at go-live → 99.999% as measured design objective. Freeze the SLI definition and attribution rules in the rulebook by end of Phase 2. | 99.999% is 5.26 min/yr; the 15-min RTO alone is ~3 years of budget; region loss is arithmetically incompatible with BFT quorum at 2 regions. | CISO §4.1, CTO C1 |
| T-13 | **Crypto-agility (`suite_id`) from day one; PQ-hybrid encryption for on-ledger confidential data by Phase 2–3, PQ signatures Phase 4.** | Harvest-now-decrypt-later applies to confidential data today. | CISO §0.1 |
| T-14 | **Mandatory Concord Customer Security Programme (CSP)** for member endpoints (tiers A/B/C, annual attestation) as a condition of membership. | Payment networks are historically breached at the member endpoint, not the core. | CISO §0.1 |

## 2. Architecture

### 2.1 Layers and trust domains

```
 Bank i (own DC, own HSM)                                   Operator (2+ sites)       BoC / OSFI
 ┌─────────────────────────────────────────┐          ┌─────────────────────┐   ┌────────────────────┐
 │ Channels (portal, ERP, treasury)        │          │ Validators OP-1, 2  │   │ Observer (non-vote)│
 │  → Wallet SDK / bank wallet service     │          │ Sentry nodes        │   │ Anchor gateway     │
 │  → Institutional API gateway (L5)       │          │ Sponsored-access GW │   │ Supervisory query  │
 │  → Compliance service (L4, bank-side)   │          │ Governance console  │   └────────────────────┘
 │  → Core adapter + outbox (L5) ──MQ/API──▶ Core     └─────────────────────┘
 │  → Tokenised Deposit Subledger (TDS)    │                    ▲
 │  → Validator process (L1/L2) + HSM ───────── private WAN, mTLS ──┘
 └─────────────────────────────────────────┘
```

- Validator process and signing key are a separate trust domain from adapter and gateway. Gateway compromise must not yield validator keys; one bank's validator compromise must not yield another's.
- Consensus runs on dedicated private circuits with mutual TLS and identities from the operator's private PKI, enforced at sentry nodes. Validators are not internet-addressable.
- The Operator never holds client money or issuer keys.

### 2.2 Layer map

| Layer | Delivers | Key design points (detail in seat memos) |
|---|---|---|
| **L0 Governance & legal** | Rulebook, operator (CNCA), admission | See `01` §9 and `board/legal-regulatory.md` §3–4 (23-chapter rulebook outline) |
| **L1 Network & consensus** | Validator ladder, sentries, rotation | Canonical block ordering (no proposer discretion); deterministic execution (no floats, wall-clock or map iteration); height-gated governed upgrades with N/N-1 wire compatibility; remote signer with persisted (height, round, step) high-water mark; engine escape hatch (~3–4 engineer-months **[V]**) |
| **L2 Ledger & assets** | Merkleised state: Registry, Asset, Account, SupplyLedger, Instruction; token classes per issuer | Amounts are u128 CAD cents behind an `Amount` trait so M0/M1/M2 share one kernel; account IDs are opaque H(issuer‖holder-ref commitment‖salt); no identity on ledger |
| **L3 Settlement** | Atomic Transfer / Convert / DvP; templates; LSM netting; 24/7 mint/redeem | One instruction, one block, all legs or none; finality receipt = header + ≥quorum commit signatures + Merkle proof, verifiable offline |
| **L4 Compliance** | Screening at mint/transfer/redeem; Travel Rule; limits; FINTRAC hooks | Validators cannot re-screen; they verify that the responsible issuer did (signed screening receipts); PII stays off-ledger at the bank |
| **L5 Access & integration** | API gateway, ISO 20022 adapter, wallet SDK (TS, JVM), bank-hosted custody | No end-customer network access; idempotency keys plus ISO UETR give exactly-once |

### 2.3 Par enforcement (T-3)

For issuer *i* at height *h*: S_i = sum of token balances; M_i/B_i = cumulative minted/burned; L_i = the issuer's tokenised-deposit control balance per latest attestation; H_i = open mint holds; R_i = open redemption credits; SP_i = settlement position.

| ID | Invariant | Break class |
|---|---|---|
| **P1 Conservation** | S_i = M_i − B_i exactly; every transition's net delta is zero | Global Halt |
| **P2 Backing (par)** | S_i ≤ L_i always, and L_i − S_i = H_i + R_i exactly | Over-issuance: Global Halt. Unexplained under-issuance or aged in-flight item: Issuer Quarantine |
| **P3 Par transfer** | Every Convert debits and credits identical CAD minor units; no in-kernel fee, discount or rounding (fees are separate instructions) | Reject; block-level failure = Global Halt |
| **P4 Settlement backing** | SP_i ≥ 0 and Σ SP_i = anchor total − in-flight funding | SP<0: reject. Anchor mismatch: Global Halt |
| **P5 Non-negativity** | No account or asset balance < 0; no overdraft in Phases 1–3 | Reject |
| **P6 Authority** | Only issuer i's mint-policy key set changes M_i; only its signature debits its accounts; operator keys change no balance | Reject |
| **P7 Halt monotonicity** | Once halted, only a `Resume` co-signed by governance threshold + affected issuer(s) + BoC observer key clears it | Structural |

**Graded halt (needs regulator agreement; rulebook item).** Kernel-integrity breaks and over-issuance halt the whole network. Unexplained under-issuance or core-side lag **quarantines only the issuer** (freezes its mint, redeem and outbound Convert); escalation to global halt if uncleared in 15 minutes (proposed). **Anyone with a registered reconciler key can pull the fire alarm; restart is expensive** (P7). The check is a deterministic end-of-block hook, so every validator reaches the same verdict from the same state; **settlement stops, consensus does not**, so observers stay in sync. Banks must hold rehearsed "Concord-off" fallback playbooks (Lynx or wires) because Concord has no bridge to another rail by design.

**Three-way reconciliation** every 60 s and on each mint/redeem completion: (1) ledger S_i, (2) core control-GL L_i, (3) the enumerated in-flight registry on both sides, recomputed independently by the operator and by each observer.

**Mint ordering:** core places a durable hold and reclass first → adapter registers `OpenHold` → ledger `Mint` closes it. **Redeem ordering:** ledger burn is final first → adapter observes → core credits customer and debits control GL. Result: S_i ≤ L_i at every instant and a crash at any step never loses customer money or over-issues.

### 2.4 Settlement services

- **Cross-issuer payment:** `bal_payer(T_A) −= x; bal_payee(T_B) += x; SP_A −= x; SP_B += x`, requires A's and B's signatures. B's acceptance is pre-collected over the bilateral channel so nothing is ever debited then stuck.
- **DvP.** Bond native on Concord (Phase 3): fully atomic in one block. Bond at an external CSD (CDS): **conditional, not atomic**, via an Escrow/PayOnEvent template released by a signed CSD confirmation (sese.025) with deadline and refund path. Say so plainly; the residual risk window is defined. **[V CDS interface and ISO 20022 readiness]**
- **PvP (cross-currency):** Phase 4; needs cross-network atomicity (timelock, coordinator or light-client relay); design deferred.
- **Liquidity-saving netting (Phase 3):** instructions failing only on SP sufficiency enter a queue (they have debited nothing). Once per second and on funding events a deterministic in-consensus function runs bilateral offset then multilateral gridlock resolution, bounded by queue cap (10,000) and iteration cap. Target ≥30% lower peak liquidity need on replayed anonymised Lynx data **[V; depends on data access]**. **Rulebook wording:** a queued instruction has debited nothing and is not yet a payment (this reconciles the blueprint's "no pending state").
- **Funding and defunding** of SP against the anchor via `camt.050`/`camt.054` in anchor hours (Lynx is not 24/7 **[V hours]**); per-issuer minimum-buffer alerts at 30% of trailing-week peak outflow; weekend liquidity facility is a Legal/BoC question.

### 2.5 Template library

Four fund-movement primitives touch balances (`Lock`, `Release`, `Refund`, `Convert`); conservation is proven once for these. A total, bounded guard language (no loops, no recursion). Launch set: T1 Transfer, T2 Convert, T3 DvP (Phase 1); T4 Escrow, T5 PayOnEvent, T6 Standing/Sweep, T7 Batch (Phase 2); T8 NetCycle (Phase 3). Six-gate review: proposal (risk class C0/C1/C2), spec + TLA+ model, implementation with two-person rule, class-based verification (C0 property tests + bounded model check; C1 adds TLA+; C2 adds Verus proofs + external audit), independent review with **per-issuer veto/opt-in for model-risk reasons**, then governance with 30 days' supervisor notice **[V with Legal]** and staged rollout with per-template value caps.

### 2.6 Confidentiality

| Mode | What | When |
|---|---|---|
| **M0** | Plain amounts | Testnet, synthetic data only |
| **M1** | ZK committed amounts | Chosen only if it passes the 8-part benchmark T1–T8 at G1.2 (14 May 2027) |
| **M2** | Global settlement ledger plus issuer-held account domains (need-to-know) | Fully designed and prototyped in Phase 1; the fallback that Phase 3 ships on if M1 fails |

A **leakage budget** (which party class may see which field) must be ratified by Legal before the mode can be chosen. Screening evasion through the confidentiality layer is handled by signed screening receipts and supervisory sampling.

### 2.7 Reference core-banking adapter

- Core-agnostic adapter SPI with certified core connectors; **hold-based mint**, ledger-first redeem, outbox **outside the core's recovery point**, `CORE_LAG` classification that quarantines rather than halts.
- **Worst case:** a bank restores its core from backup with data loss; that looks like over-issuance. The outbox and Core-Loss Recovery Mode handle it; spike **S5** injects it 1,000 times with target 100% detection and zero false global halts.
- Legacy cores use **pre-funded token accounts** so the core sees only mint, redeem and net settlement (Onboarding pattern P2). Deployment menu: bank-operated (Tier A default), node-as-a-service (Tier B/C), co-managed in the bank's DC. **The issuer always owns its validator identity and HSM keys.**
- ISO 20022 mapping: pain.001, pacs.008, pacs.002, camt.050, camt.053, camt.054, sese.025 (CSD confirmation) **[V Lynx/Payments Canada usage guidelines and versions]**.

## 3. Security and resilience (CISO)

- **Key classes:** 10, with named owners; operational-key rotation quarterly, **root keys live for years**; ceremonies are an attack surface, so cadence is kept but routine regeneration is limited to operational keys. Halt needs f+1 signatures (Byzantine validators cannot halt alone); Resume needs 2f+1 plus attestation.
- **Threat model:** STRIDE per layer L0–L5 plus supply chain; blueprint classes B1–B7 plus nine added (X1–X9) in `board/ciso-security-resilience.md` §2.
- **Topology:** BFT across bank sites gives network availability; ledger RPO 0 comes from consensus (≥f+1 honest copies of every final block). Toronto–Montréal synchronous replication adds only ~10–15 ms **[V]**, so the <2 s median finality target is not threatened by distance; **p99 < 5 s is threatened by leader-failure view changes.** Two regions cannot fail over automatically without a third failure domain: use a remote witness (5-replica quorum 2+2+1) and require validators outside the Toronto–Montréal corridor. Two independent infrastructure providers; Canadian-controlled key custody; no single hyperscaler control plane.
- **Availability arithmetic:** 99.999% ≈ 5.26 min/yr (77.8 s per 90-day quarter); 99.99% ≈ 13 min per quarter.
- **Supervisory 60-second claim** holds only for on-ledger query classes (positions, issuer supply, transfer proofs). Identity and beneficial-owner resolution is off-ledger at issuing banks and gets its own SLO and bank endpoints. Audit log is Merkle-chained, HSM-signed, member-witnessed and anchored on-ledger.
- **Assurance:** map to OSFI B-13, B-10, E-21 and PFMI principles 8, 16, 17 **(all "verify with counsel")**; add ISO 27001 and probably SOC 1; SOC 2 Type II observation window must open by about Jan 2028; PCI DSS not applicable; independence rules between development, audit and formal verification; private bug bounty from Phase 1, public on a production mirror in Phase 2; **TLPT before go-live.**
- **Bank due-diligence pack:** 34 items with production dates in `board/ciso-security-resilience.md` §7.
- **Board decisions due 31 Oct 2026:** ratify validator ladder and fail-stop; adopt SLO ladder; make CSP a membership condition; adopt independence rules; hosting principles; authorise HSM procurement; fund CISO-designate and SRE lead by 31 Dec; instruct counsel on open legal questions.

## 4. Engineering

- **Monorepo (Bazel), Rust kernel, TypeScript and JVM SDKs.** Two-party bit-for-bit reproducible builds, SLSA L3 provenance, CycloneDX SBOMs, vendored vetted dependencies, two-person review for kernel and crypto. Apache-2.0 under a neutral foundation with source escrow **[Legal to confirm]**.
- **Formal verification:** TLA+ for protocols (mint/redeem, settlement, DR fencing); Verus and Kani on the kernel; a Lean reference model with differential fuzzing (a second implementation of the kernel semantics). **A 6-week Verus spike (S2) decides how far "proofs published" can go**; fallback is Kani + TLA+ + Lean + external audit, with "specified and model-checked" wording.
- **Environments:** dev, test, perf (WAN-emulated), certification (prod-like), production; certification is what banks integrate against; a Concord-run **Bot Bank** counterparty removes dependence on other banks being ready.
- **CI gates:** determinism (10M-transaction corpus produces byte-identical state roots on x86_64 and aarch64, on every commit); invariant property tests; fuzzing; SBOM and provenance; independent rebuild on every release candidate.
- **Release policy:** quarterly minor releases, annual major; N and N-1 supported; protocol changes activate at a governance-set height only when every voting validator reports ready; validator activation staged (learner → shadow → voting); Concord patches get pre-approved standard-change status in each bank's ITSM.

## 5. Capacity and performance model (planning estimates)

- Sequential Rust state machine: ~20k+ kernel transitions/s per core **[V by S1]**; median finality ~0.3–0.9 s against the 2 s target; **5,000/s is comfortable as lab headroom**.
- p99 < 5 s is marginal if several validators fail together; leader-failure behaviour is a bake-off criterion (can CometBFT suppress a known-dead proposer without forking the engine? if not, evaluate a HotStuff-class engine with leader reputation).
- Bake-off thresholds for Plan A: sustained ≥6,000 tx/s for 1 h on M0, median ≤1.0 s, p99 ≤3 s, at inter-site RTTs of 1/10/15 ms; spike team (≤8 engineers × 8 weeks) delivers Transfer, Mint, Redeem, par checker and a Verus-checked conservation lemma; ≥8 credible Rust/BFT hires or secondees identified.
- Consensus starting configuration: CometBFT v1.x **[V]**, ABCI 2.0, equal voting power, `next_block_delay` 250 ms, `timeout_propose` 800 ms with 200 ms increments, 16 MB / 10,000-tx blocks, direct gateway-to-proposer submission (no all-to-all mempool gossip).

## 6. Phased engineering plan

| Phase | Central FTE (bank-side) | Headline deliverables | Measurable exit tests |
|---|---|---|---|
| **0** Oct–Dec 2026 | ~26 | Bake-off (S1) results 4 Dec; TLA+ P1–P7 frozen 27 Nov; threat model 4 Dec; seven-bank core discovery; anchor and token-model paper; RFPs 30 Oct; ARB 11 Dec | S1 decision taken against pre-agreed thresholds; TLC clean on 4-issuer crash-fault model; all seven discovery packs incl. core-DR RPO; leakage-budget table ratified by Legal; ≥70% of Phase 1 staffing committed; architecture and invariants ratified |
| **1** Jan–Dec 2027 | ~62 (+10) | Kernel v0.1 (26 Feb); settlement primitives; compliance MVP; adapter live vs pilot bank #1 pre-prod (30 Apr); G1.2 decision (14 May); closed pilot (11 Jun); kernel rc freeze (31 Aug); audit #1 (Sep–Nov) | ≥100M adversarial instructions, zero violations, plus 72 h soak at 1,000/s; 100/100 injected breaks halt or quarantine, 0 false halts; cross-arch determinism; ISO 20022 golden files; 14-day closed pilot with BoC observer reconciler agreeing |
| **2** 2028 | ~98 (+40) | Multi-issuer n=7; live mint/redeem; Travel Rule; proofs published; SOC 2 Type I; public bounty; DR drill; performance 2,500/s | No open critical/high audit findings; proofs machine-checked in CI; DR RTO ≤15 min, RPO 0 with fencing shown; 2,500/s for 4 h (median <1 s, p99 <3 s); 30-day live-pilot record with zero par breaks, zero client-money loss, zero false halts; ≥4 issuers certified |
| **3** 2029 | ~105 (+50) | n=10; NetCycle; bond cash-leg; 24/7 NOC | Lab certification 5,000/s for 6 h, 20,000/s burst for 60 s, median <2 s, p99 <5 s with 3 validators killed; supervisory query <60 s on ≥1B records; 99.99% measured over rolling 90 days; independent PFMI self-assessment submitted |
| **4** 2030+ | sketch | Retail wallets, PvP corridors, RTR interoperability, PQ hybrid on all validators | Separately gated (G4) |

The CTO's engineering plan assumes a start at risk on 11 Jan 2027 and ≥55 engineers on payroll or secondment by then, and pilot-bank pre-production access by 1 March 2027. Phases 0–2 are feasible with the rewritten exit tests; Phase 2 has no float on the path kernel freeze → audit → live issuance → non-objection → cap lift. **Full code-level proofs for every template are not achievable; proofs cover the four primitives and P1–P7.**

## 7. Spike programme

| ID | Spike | Window | Drives | Pass |
|---|---|---|---|---|
| S1 | Platform bake-off | 12 Oct–18 Dec 2026 | T-1/T-2 | Thresholds in §5 |
| S2 | Verus proofs of P1/P3 for `apply_transfer`/`apply_convert` | 6 weeks | Verification scope, Phase 2 exit wording | Proof:code ≤ ~15:1 |
| S3 | M1 committed-amount benchmark (T1–T8) | Jan–Mar 2027 | G1.2 | Table in CTO §3.3 |
| S4 | M2 issuer-domain prototype | Jan–Apr 2027 | G1.2 | CTO §3.4 |
| S5 | Core emulator and reconciliation chaos | Nov 2026–Apr 2027 | Adapter design | 100% detection, 0 false global halts over 1,000 runs |
| S6 | Three-site WAN, leader failure, DR fencing | Nov 2026–Mar 2027 | Consensus config | p99 <3 s with 1 dead; no fork |
| S7 | Cross-architecture determinism | Continuous from Oct 2026 | Release gating | Byte-identical roots |
| S8 | Anchor liquidity and LSM simulation on replayed Lynx data | Jan–Apr 2027 (data permitting) | Settlement-position design | ≥30% saving target; weekend stress sizing |
| S9 | HSM, remote signer, ceremony dry-run | Nov 2026–Feb 2027 | Key architecture | Refuses double-sign; failover <2 s |
| S10 | Two-party reproducible build | From first release candidate | Release process | Hash match |

## 8. Top technical risks (retiring spike)

| # | Risk | Severity | Retired by |
|---|---|---|---|
| R1 | Par-kernel defect or specification gap | Critical | S2, plus 100M adversarial instructions before Phase 1 exit |
| R2 | Bespoke platform, key-person dependence, bank model-risk acceptance | High | S1; open-source under neutral foundation; Lean second implementation; Plans B/C priced |
| R3 | Confidentiality fails performance/assurance or leaks more than the budget | High | S3, S4; G1.2 |
| R4 | Legacy core cannot support 24/7 hold/posting; core-DR RPO>0 makes control GL lag ledger | High | S5 |
| R5 | Non-determinism or state divergence; unsafe upgrades | High | S7; rehearsed live upgrade in perf environment |
| R6 | Region/site failure, DR fork, availability arithmetic, DoS | High | S6 |
| R7 | Settlement anchor and prefunding unconfirmed; weekend liquidity fragmentation | High | S8; BoC answer |
| R8 | Supply-chain compromise | High | S10; red-team injection exercise |
| R9 | Key management: HSM residency/throughput, ceremony error, double-sign, governance-key loss | High | S9 |
| R10 | Talent and schedule; seven bank integrations in parallel; year-end freezes | High | Leading indicators: ≥55 engineers by 11 Jan 2027; conformance suite run by 2 banks by 30 Jun 2027; banks 3–4 in certification stage 2 by 30 Sep 2027. Failure triggers scope cut (templates T5–T7 to Phase 3), not a date slip |

## 9. Immediate technical actions (next 30 days)

1. Approve S1 funding and the 12 Oct kick-off; name the spike lead and bank secondees.
2. Issue the seven-bank core-banking discovery questionnaire and the RFPs (30 Oct).
3. Commission Legal on: leakage budget, anchor A1 vs A2, token model X vs Y, queued-instruction wording, graded-halt wording.
4. Start the Invariant Charter and TLA+ specification; freeze P1–P7 wording by 27 Nov.
5. Request pre-production core access from pilot bank #1 (long lead time).
6. Open recruiting for Rust/BFT, formal-methods and HSM/SRE roles; obtain written secondment commitments.
7. Begin HSM procurement (lead time 8–16 weeks **[V]**).

## 10. Open technical questions for the board

Who holds the neutral validator seat; whether the BoC will ever want a voting seat; the leakage budget; Model X vs Y; anchor A1 vs A2; who maintains the reference adapter long-term (operator or a bank consortium); whether founders accept a 99.99% contractual SLO. The CTO's consolidated **verify list of 15 items** (CometBFT stewardship and version, Canton licence split, Besu privacy status, HSM support for chosen suites, Canadian volumes, Lynx hours, ISO 20022 usage guidelines, SOC 2 observation-period rules, bounty platform residency) is in `board/cto-technical-implementation.md` §10.
