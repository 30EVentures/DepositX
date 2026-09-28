# DepositX Network — CTO / Chief Architect Seat Memo: Technical Implementation

Seat: Chief Technology Officer / Chief Architect, founding board
Date: 25 September 2026
Source: Blueprint v0.9 (KPMG, 2 Sep 2026), including its "Known issues" list
Status: Recommendation to the board. Decisions in section 0 require ratification at Architecture Review (target 11 Dec 2026).

**Convention.** Anything tagged **(verify)** is from my own knowledge (cutoff Jan 2026) or is an engineering estimate, not a measured fact. I did no live research for this memo. Every numeric performance figure in sections 1, 3 and 6 is a planning estimate that a named spike (section 8) must confirm or kill. Where I say "kill", I mean a pre-agreed pass/fail threshold that changes the plan.

---

## 0. Headline decisions and what I need from the board

| # | Decision | One-line rationale |
|---|---|---|
| D1 | **Build the ledger as a purpose-built, deterministic Rust state machine ("DepositX Ledger Core") on a BFT engine (CometBFT first; engine swappable behind a `ConsensusHost` interface).** No general-purpose VM. Templates are native, reviewed, versioned modules. | The blueprint's own non-goals (no user-deployed contracts, reviewed templates only) mean a smart-contract VM is pure attack surface. Invariants I–III can live in a ~10 kLoC verified kernel rather than in userland contracts. |
| D2 | **Run a funded 10-week platform bake-off (custom vs Canton/Daml vs Besu QBFT) from 12 Oct to 18 Dec 2026, with hard pass/fail thresholds.** Plan B = Besu (schedule/staffing failure). Plan C = Canton (confidentiality failure). | Reasonable people pick Canton or Besu on schedule alone. The matrix is sensitive to how you weight time-to-testnet (section 1.3). I will not commit 9-figure money on a matrix; I want measurements. |
| D3 | **Par is enforced in the state machine, not in contracts:** seven named invariants (P1–P7, section 2.3) checked at end of every block; graded halt (issuer quarantine vs network-wide halt). | Invariant I is "system-halting". The only place a halt is enforceable against a buggy or malicious contract is below the contract layer. |
| D4 | **Confidentiality is a mode of the kernel, not a bolt-on.** Three modes: M0 plain (testnet, synthetic data only), M1 committed amounts (ZK: Pedersen + range proofs), M2 issuer domains (need-to-know two-tier ledger). M2 is fully designed now (section 3.4). The mode is chosen at Gate G1.2 (14 May 2027). Phase 3 does not depend on ZK. | This removes the blueprint's "largest technical bet" from the critical path and makes the fallback real. |
| D5 | **Bank core stays legal source of truth for the deposit liability; the ledger is authoritative for who owns which token at the consensus instant.** Customer-level token balances live in a bank-hosted Tokenised Deposit Subledger (TDS) fed exactly-once from ledger events. Legacy cores see only mint/redeem and aggregate postings, never 5,000 postings/s. | This is the only design in which a 1970s-vintage core and a 5,000 instr/s network can coexist. |
| D6 | **Two documented target conflicts I will not paper over:** (a) 99.999% availability with 2 regions is arithmetically impossible for region loss under BFT (section 6.5); (b) 5,000 sustained instr/s is roughly 5x the entire Canadian all-rail payment volume (verify) and should be a capacity target proven in the perf environment, not a demand forecast. I recommend a contractual SLO of 99.99% with 99.999% as a single-fault design target. | Honest baselines beat a failed Phase 3 exit. |
| D7 | **Placement rule: at least 4 failure domains, at most f validators per domain** (with n=10, f=3, at most 3 per domain), validator rotation interleaved across domains. | This, not "3 AZs / 2 regions", is what actually buys zero-touch survivability under BFT. |
| D8 | **Governance signatures are ledger-native m-of-n multisig over HSM-resident keys, not MPC threshold signatures.** MPC is reserved for operator infrastructure secrets. | "Boring cryptography" is a blueprint principle; threshold-ECDSA MPC is not boring. I am deviating from the blueprint's cross-cutting text on purpose. |
| D9 | **Onboarding model: four participant tiers and a certification programme (section 5.6).** Banks 3–7 must start integration no later than Q3 2027 to make "all founding issuers live" in H2 2028. | The blueprint's own list calls the missing onboarding model "the board's central job". |
| D10 | **Schedule verdict (section 7.6):** Phases 0–2 are achievable with named exit-criteria rewrites; Phase 3 as dated is **not** achievable for 99.999%-over-two-quarters, SOC 2 Type II issuance, or an independent PFMI observance rating. I propose a Phase 3b (Q1–Q2 2029) for those, with Phase 3 go-live dates unchanged. | The Known-issues list is right; I supply the arithmetic. |

**Decisions needed from other seats (blocking the design):**

1. **Settlement anchor (Legal/Regulatory, BoC).** I need one of: A1, funds in a segregated Bank of Canada account mirrored by a DepositX settlement position (my design); or A2, fully collateralised bilateral settlement with a default waterfall. My design supports both behind a `SettlementAsset` abstraction, but the legal answer changes the liquidity model. BoC participation is assumed, not confirmed (blueprint Known issue).
2. **Token model (Product/Legal).** I recommend **Model X**: cross-issuer payment burns payer-issuer tokens and mints payee-issuer tokens, with issuer-to-issuer value moving as a settlement position. Payee ends up holding a claim on their own bank. **Model Y** (bearer tokens of issuer A circulating in bank B's wallets) creates cross-issuer exposure and changes CDIC attribution. I have designed for X; Y needs a separate design and I would resist it before Phase 4.
3. **Leakage budget (Legal/Privacy).** An explicit table of which party class may see which field (section 3.1). I cannot choose between M1 and M2 without it.
4. **Queued instruction wording (Rulebook).** Liquidity-saving netting requires a queue. The blueprint says "no partial/pending state". A queued instruction has debited nothing and is not yet a payment; the rulebook must say so.

---

## 1. Platform selection

### 1.1 Candidates evaluated

| Candidate | What it is | Relevant facts (all verify unless stated) |
|---|---|---|
| **A. Purpose-built state machine on CometBFT** (my pick) | Rust deterministic state machine attached over ABCI 2.0 (PrepareProposal / ProcessProposal / FinalizeBlock) to CometBFT. Consensus engine swappable (Malachite, a Rust Tendermint implementation, or a HotStuff-class engine). | Apache-2.0. Instant, deterministic finality (no reorgs). Large installed base in Cosmos-ecosystem chains. Maintenance funding and steward concentration are a risk (verify current stewardship). Malachite reportedly used by Circle's Arc (verify). |
| **B. Canton / Daml** (Digital Asset) | Sub-transaction privacy, multi-party atomic workflows, participant nodes hosted by each bank, synchronizer (sequencer + mediator). | Daml is open source (Apache-2.0); some enterprise capabilities (HA, higher-throughput backends, BFT sequencer maturity) are commercially licensed (verify exact split). Production use at large institutions for repo and collateral (e.g. Broadridge DLR; verify). Single dominant steward. UTXO-style contracts create hot-contract contention. Small Canadian Daml talent pool. |
| **C. Hyperledger Besu with QBFT** | EVM client, IBFT-family consensus with immediate finality. Prior-art lineage: Quorum-based systems (Partior, JPMorgan Onyx/Kinexys) (verify current stacks). | Apache-2.0, Linux Foundation Decentralized Trust project; multiple maintainers. Sequential EVM execution; realistic sustained throughput in the low thousands of tx/s on tuned hardware (verify). Built-in private transactions (Tessera) are deprecated/unsupported going forward (verify); privacy would be ours to build. Block period floor of ~1 s historically, sub-second configurable in recent versions (verify). Large Solidity hiring pool; mature formal-verification tooling for Solidity (Certora Prover, Halmos, K/Kontrol, SMTChecker). |
| **D. R3 Corda** | UTXO-like states, notary finality, need-to-know by design. | Canadian regulators know it from Project Jasper phases (verify). R3 licensing and strategy shifts (Corda 4 vs 5) are a vendor risk (verify). Throughput bounded by notary and flow model; hires shrinking. |
| **E. Hyperledger Fabric** | Channels and private data collections, endorsement policies, pluggable ordering. | Raft ordering is crash-fault-tolerant only, so it violates the blueprint's BFT requirement; SmartBFT ordering arrived in Fabric 3.x (verify maturity). Cross-channel atomic swaps are hard, which fights "one liquidity space". |
| **F. Move-based permissioned fork (Aptos/Diem lineage)** | Move language with the Move Prover; Block-STM parallel execution; HotStuff-family consensus. | Best-in-class native formal verification story and strong throughput claims. Vendor concentration (Aptos Labs), licence and fork-maintenance burden, no privacy story, small Canadian hiring pool (all verify). Runner-up for the *kernel language* idea, not for the platform. |
| **G. Prior art as reference, not candidates** | Partior (multi-bank, permissioned, EVM-lineage, deposit mirroring); Kinexys / JPM Coin (bank-run, JPMD on a public L2 announced 2025 (verify)); Fnality (BoE-account-backed); Project Jasper (BoC/Payments Canada, Ethereum-lineage and Corda phases); BIS Project Agorá (verify BoC involvement). | Lessons taken: (1) the deposit token mirrors a ledger balance at the issuing bank; (2) single-bank or few-bank operation is the norm, and none of them is a 7-issuer, regulator-observed, formally verified rail, so I cannot claim a proven template for DepositX's exact shape; (3) Canadian regulators have seen DLT DvP before. |

### 1.2 Decision matrix

Weights sum to 100. Scores are 1–5 (5 best). Weighted score = sum(weight x score) / 5, so the maximum is 100. Scores marked with a tilde are my estimate, pending the bake-off.

| Criterion (weight) | A. Custom on CometBFT | B. Canton/Daml | C. Besu QBFT | D. Corda | E. Fabric | F. Move fork |
|---|---|---|---|---|---|---|
| Par enforceability and verifiability (20) | **5** | 3 | 4 | 3 | 3 | 5 |
| Single-instant deterministic finality (10) | **5** | 4 | 5 | 4 | 4 | 5 |
| Inside perimeter / issuer sovereignty (10) | **5** | 5 | 4 | 5 | 4 | 3 |
| Confidentiality: native need-to-know and path to ZK (15) | 3 | **5** | 2 | 4 | 3 | 2 |
| Throughput and latency headroom to 5k/s, <2 s (15) | 4~ | 2.5~ | 2~ | 2~ | 4~ | 5~ |
| Vendor / licence risk (10) | 4 | 2 | 4 | 2 | 4 | 2 |
| Hiring pool, Canada (8) | 3 | 2 | **5** | 3 | 3 | 2 |
| Canadian residency / self-hostable (5) | 5 | 4 | 5 | 5 | 5 | 5 |
| Time to Phase 1 testnet and build cost (7) | 1 | 4 | 4 | 3 | 3 | 3 |
| **Weighted total (/100)** | **80.2** | 69.3 | 72.6 | 66.0 | 71.0 | 73.4 |

**Why the scores are what they are:**

- *Par (20).* In A the invariant is a state-machine property over a small pure-Rust transition function (verifiable with Verus / Kani, section 4.6). In C it is a Solidity contract inside an EVM whose global state any contract can touch; Certora/Halmos make that tractable but the trusted base is the EVM plus every co-deployed contract. In B, Daml is small and typed, but industrial-strength prover tooling for Daml is thin (verify) and a *global* supply-versus-liabilities invariant fights sub-transaction privacy. F scores 5 because of the Move Prover.
- *Confidentiality (15).* B is the only candidate where need-to-know is native. A scores 3 because we build M1 or M2 ourselves, but the state machine controls the data model so it is a bounded build. C scores 2: no supported privacy path, so we would build the same thing as A on a worse substrate.
- *Throughput (15).* A: the execution path is a sequential native state machine; I estimate a single core does 20k+ kernel transitions/s (section 6.2), so consensus and I/O are the limits. C: sequential EVM, mid-single-digit-thousands at best (verify). B: each transaction needs sequencer plus mediator plus per-participant confirmation, and contention on hot holdings forces contract splitting; whether one synchronizer sustains 5k/s with p99 <5 s is the single biggest unknown for B (verify). Sharding over multiple synchronizers breaks "one liquidity space" or adds reassignment latency.
- *Time (7).* A scores 1 honestly: everything is ours to write. The mitigation is that the platform-independent artefacts (kernel spec, TLA+ models, gateway, adapter, SDK, ISO 20022 mapper, compliance hooks) are needed on *every* candidate, so A's true delta is about 8–12 engineer-years, not the whole programme.

**Sensitivity (the honest part).** If time-to-testnet weight is raised to 23 (par 15, finality 8, perimeter 8, confidentiality 12, throughput 12, vendor 8, hiring 10, residency 4), totals become: Besu 74.8, Canton 70.2, Move 69.6, Custom 68.8, Fabric 68.8, Corda 64.8. **A schedule-obsessed board would pick Besu.** I am recommending A because the blueprint's core promises (par, verifiable halting, no arbitrary contracts, ZK-or-fallback confidentiality, 5k/s) are exactly where A leads, and because a Besu-to-A migration later is far costlier than an A-to-Besu retreat now. The bake-off decides.

### 1.3 Decision tree after the spike (11 Dec 2026)

- **Plan A holds** if the custom kernel slice runs at n=10 with all of: sustained >= 6,000 tx/s for 1 h (M0), median finality <= 1.0 s, p99 <= 3 s, with injected inter-site RTTs of 1 / 10 / 15 ms; the spike team (<= 8 engineers x 8 weeks) delivered Transfer + Mint + Redeem + par checker + a Verus-checked conservation lemma; and >= 8 credible Rust/BFT-capable hires or secondees are identified.
- **Plan B (Besu QBFT)** if A fails on staffing or schedule but passes on design. Cost: give up the small-TCB kernel argument; par module becomes a Solidity contract verified with Certora/Halmos; re-baseline throughput to what Besu measures (I expect <= 2,500/s, verify); privacy reduced to M2-style application-layer encryption. The kernel spec, TLA+ models, adapters, gateway and SDK carry over unchanged.
- **Plan C (Canton)** if M1 and M2 both fail their gates *and* the founders will not accept M2's leakage. Cost: re-baseline throughput to the measured synchronizer ceiling; par verification degrades to TLA+ plus property tests plus Daml-level review; single-vendor dependency must be mitigated by a source-escrow and a licence covering the Canadian consortium (counsel).
- **Rejected outright:** Corda (throughput and vendor risk, no advantage over Canton on privacy); Fabric (CFT default, cross-channel atomicity); Move fork (vendor and fork-maintenance burden, no privacy, thin hiring pool) though I will borrow its idea of a prover-friendly kernel language.

### 1.4 What the spike must verify before commitment (S1, section 8)

1. Sustained throughput and latency at n=10 with the stated WAN model, for all three candidates on an *identical* workload (Transfer, Convert, DvP; 1M accounts; Zipf-skewed hot accounts).
2. Implementation effort for an identical feature slice, measured in engineer-weeks, not estimated.
3. Verification tractability: Verus proof of `apply_transfer` conservation (A); Certora or Halmos on the ERC-20-plus-par contract (C); Daml property tests plus a written argument (B).
4. Leader-failure behaviour: p99 finality with 1 and 3 validators killed; whether CometBFT can suppress a known-dead proposer without forking the engine (if it cannot, that is the trigger to evaluate a HotStuff-class engine with leader reputation).
5. Canton and Besu licence terms read by counsel, including any restriction on a regulated multi-bank operating entity and on source access.
6. A recruiter-market probe: number of realistically hireable Canadian engineers for each stack in 90 days.
7. Determinism: same block replayed on x86_64 and aarch64 builds yields byte-identical state roots.

---

## 2. Component-by-component design (L1–L5 and cross-cutting)

### 2.0 Topology and trust domains

```
 Bank i (own DC, own HSM)                                  Operator (2+ sites)        BoC / OSFI
 +-------------------------------------------+         +----------------------+    +--------------------+
 | Channels (corp portal, ERP, treasury)     |         | Validator OP-1, OP-2 |    | Observer (non-vote)|
 |   -> Wallet SDK / Bank wallet service     |         | Sentry nodes         |    | Anchor gateway     |
 |   -> Institutional API gateway (L5)       |         | Sponsored-access GW  |    | Supervisory query  |
 |   -> Compliance service (L4, bank-side)   |         | Governance console   |    +--------------------+
 |   -> Core adapter + Outbox (L5) --MQ/API--> Core     +----------------------+
 |   -> Tokenised Deposit Subledger (TDS)    |                 ^
 |   -> Validator process (L1/L2) + HSM ---- consensus WAN ----+
 +-------------------------------------------+
```

Trust boundaries that matter:

- The **validator process and its signing key** are separate trust domains from the adapter and gateway. Compromise of the gateway must not yield validator keys; compromise of one bank's validator must not yield another's.
- Validators talk only to a static allow-list of peers over a private WAN (dedicated cross-connects or private circuits; I do not want consensus traffic on the public internet) with mutual TLS and identities issued by the operator's private PKI, enforced at sentry nodes. Validators are not internet-addressable.
- The **operator never holds client money or issuer keys.** Operator keys can co-sign governance actions (with issuers and BoC where the rulebook says so); they cannot mint, burn or move balances.

### 2.1 L1: Network and consensus

**Node roles.**

- *Voting validator* (issuer or operator or one neutral seat, see below).
- *Observer* (non-voting full node): BoC and OSFI, plus the operator-hosted supervisory read-node.
- *Participant node* (Tier 2, section 5.6): a bank that runs gateway, adapter and TDS and a full node, but is not a voting validator.

**Validator set.**

| Phase | n | f | Quorum | Composition |
|---|---|---|---|---|
| 1 testnet | 4 | 1 | 3 | 2 pilot banks + 2 operator (two domains) |
| 2 pilot | 7 | 2 | 5 | 4 issuers + 2 operator + 1 neutral |
| 3 production | 10 | 3 | 7 | 7 issuers (RBC, TD, BMO, Scotia, CIBC, NBC, Desjardins) + 2 operator + 1 neutral |
| Cap | 13 | 4 | 9 | Hard ceiling; further members join as Tier 2 participants |

- Operator (2) plus the neutral seat (1) equal exactly f=3, so they cannot break safety without a bank's help; the seven banks hold a supermajority. The *neutral seat* (an independent technical steward, or a designated FMI) is a governance question for Legal; technically I recommend it so the operator's two votes never look like control of the halting decision.
- The BoC is a non-voting observer per the blueprint. If the BoC later wants a voting seat that is a rulebook change, not a technical one. Engine quorum arithmetic differs (CometBFT requires more than 2/3 of voting power; QBFT uses ceil(2n/3)); the numbers above are for n = 3f+1 sets where both agree (verify per engine at each size).

**Consensus configuration (starting values; the perf spike tunes them).** CometBFT v1.x (verify current version), ABCI 2.0; equal voting power of 1; `next_block_delay` (formerly `timeout_commit`, verify) 250 ms; `timeout_propose` 800 ms with 200 ms increments; max block 16 MB and 10,000 tx; vote extensions unused at launch; app-side mempool via PrepareProposal (gateways forward transactions directly to the current and next proposer over authenticated channels; no all-to-all mempool gossip, which halves bandwidth).

**Design rules that are non-negotiable:**

1. *No proposer discretion.* ProcessProposal rejects a block whose transactions are not in the canonical order (priority class, then per-issuer sequence, then hash). A malicious proposer cannot front-run, starve, or selectively delay within a block; it can only omit, and omission is bounded by a per-transaction inclusion deadline monitored on-chain (transaction not included within N blocks raises an alert and counts against the proposer's score).
2. *Deterministic execution.* No floating point, no wall-clock, no unordered map iteration, no thread-dependent behaviour in the state machine. Time = the BFT block time. All amounts are unsigned 128-bit integers in CAD minor units (cents).
3. *Rotation interleaved across failure domains* (D7) so that no two consecutive proposers share a domain.
4. *Upgrades are governed, height-gated and reproducible.* A new binary is admitted by a governance transaction naming the artefact hash and an activation height; validators do not auto-update. N and N-1 wire compatibility for one epoch; state-machine version gating; no flag-day upgrades.
5. *Remote signing with double-sign protection.* Consensus keys in an HSM behind a remote signer that persists a high-water mark of (height, round, step) (KMS-signer pattern; tmkms-class, verify support for the chosen HSM). Consensus signing is ~8 signatures/s per validator, which is trivial for HSMs.
6. *Validator-set changes* are governance transactions (issuer-plus-operator-plus-neutral threshold, per rulebook), never operational actions.

**Engine escape hatch.** All engine access goes through a `ConsensusHost` trait (start, submit, finalised-block callback, validator-set update, snapshot import/export). If CometBFT fails the perf or leader-suppression spike, the state machine moves to Malachite or a HotStuff-class engine with pipelined commits and reputation-based leader election. I estimate 3–4 engineer-months for that swap (verify).

### 2.2 L2: Ledger and assets

**State (all Merkleised, committed each block, in a Jellyfish-Merkle-tree-class structure over RocksDB, verify library choice):**

- `Registry`: issuers, validators, roles, governance keys, template registry, network parameters (value caps, limits), block-lists.
- `Asset`: `DepositToken(issuer)`, `SettlementPosition(issuer)`, later `SecurityToken(issuer)`.
- `Account`: 32-byte opaque ID = H(issuer_id || holder_ref_commitment || salt). No identity on ledger. Fields: home issuer, status (active / frozen / closed), KYC attestation reference and expiry, per-asset balance.
- `SupplyLedger[issuer]`: cumulative minted M_i, cumulative burned B_i, latest core attestation (signed value L_i, as-of height, sequence), in-flight registry (open holds and open redemption credits, each individually identified).
- `Instruction`: dedup set keyed by instruction ID with expiry-based pruning; timer queue for scheduled and conditional templates; LSM queue.
- `Amount` is a trait with `add`, `sub`, `conserves(inputs, outputs)`, `nonneg`. Two implementations: `Plain(u128)` (M0, M2) and `Committed(Pedersen, RangeProof)` (M1). The kernel is written against the trait so confidentiality mode does not fork the kernel.

**Transaction envelope.**
`{chain_id, version, suite_id, inst_id (UUIDv7 + issuer-scoped sequence), template_id@version, payload, screening_receipt, customer_authorisation_hash, signatures[], valid_until}`.
`valid_until` is at most 60 s ahead of block time; the dedup set therefore holds about 120 s of instruction IDs (at 5k/s, about 600,000 entries, trivial). Exactly-once semantics come from `inst_id` dedup plus gateway idempotency keys plus the UETR carried in ISO 20022 (section 2.7).

**Token contract model.** There is no deployed contract. Each issuer has a `TokenClass{issuer, currency=CAD, decimals=2, policy_hash}` instantiated by governance. Operations, all native:

| Op | Authority | Effect |
|---|---|---|
| `Mint` | issuer mint-policy key set (HSM, m-of-n), *and* a matching open hold in the in-flight registry | S_i up; in-flight hold closes |
| `Redeem` (burn) | account holder via issuer (authorised instruction) | S_i down; opens an in-flight redemption credit |
| `Transfer` | issuer of the payer account | same-issuer balance move |
| `Convert` (cross-issuer par swap) | both issuers (see 2.4) | payer-issuer token down, payee-issuer token up, settlement positions moved |
| `Freeze / Unfreeze` | issuer, or regulator-signed directive via governance path | account status |
| `Attest` | issuer core-attestation key | posts L_i with as-of and sequence |

**Fungibility.** Tokens of different issuers are never pooled or netted on the ledger; they meet only through `Convert` at par against settlement positions. This preserves CDIC attribution (blueprint: "token records which institution owes").

### 2.3 L2: Par-enforcement module and reconciliation (exact statements)

Notation. For issuer i at block height h: S_i(h) = sum over accounts a of bal_a(T_i); M_i(h) and B_i(h) cumulative minted and burned; L_i(h) = the issuer's tokenised-deposit control balance per the latest attestation at height h_a(i) <= h; H_i(h) = sum of open mint holds; R_i(h) = sum of open redemption credits; SP_i(h) = settlement position; A(h) = anchor total per the latest BoC-observer attestation; F(h) = in-flight anchor funding.

| ID | Invariant | Checked | Break class |
|---|---|---|---|
| **P1 Conservation** | For all i: S_i = M_i - B_i, in exact integers. Every transition's net delta over all accounts and supply is zero. | Every block, incrementally maintained totals; full recompute every 10,000 blocks | Kernel defect or corruption: **Global Halt** |
| **P2 Backing (par)** | For all i, at every attestation and every block in between: **S_i <= L_i** always (safe direction), and the *difference is exactly explained*: L_i - S_i = H_i + R_i, where H_i = mint holds placed at core but not yet minted on ledger, and R_i = redemptions burned on ledger but not yet credited at core. | Each attestation and each block (using the latest attestation plus ledger deltas since) | Over-issuance (S_i > L_i): **Global Halt**. Unexplained under-issuance or an in-flight item older than threshold: **Issuer Quarantine** |
| **P3 Par transfer** | Every `Convert` has debit amount = credit amount in CAD minor units; there is no in-kernel fee, discount, rate or rounding. Fees are separate instructions. | Per transaction (reject) and per block (assert) | Reject; a block-level failure is Global Halt |
| **P4 Settlement backing** | For all i: SP_i >= 0 (prefunded, never overdrawn); and sum_i SP_i = A - F (ledger settlement positions equal the anchor balance less in-flight funding). | Per transaction (SP_i) and per attestation (anchor total) | SP_i < 0: reject. Anchor mismatch: **Global Halt** |
| **P5 Non-negativity** | For all accounts and assets: balance >= 0. No overdraft facility in Phase 1–3. | Per transaction | Reject |
| **P6 Authority** | Only the mint-policy key set of issuer i can change M_i; only that issuer's signature debits its accounts; operator keys cannot change any balance. | Per transaction | Reject |
| **P7 Halt monotonicity** | Once the network is in Halt, only a `Resume` transaction co-signed by (governance threshold) + (affected issuer(s)) + (BoC observer key) clears it; no other transaction type succeeds. | Structural | Structural |

**Three-way reconciliation.** For each issuer, three numbers must agree at each attestation: (1) S_i from the ledger, (2) L_i from the bank's core control GL (a dedicated "tokenised deposits control" account, see 5.2), (3) the enumerated in-flight registry on both sides. The adapter posts an attestation every 60 s and on every mint/redeem completion. A reconciler run by the operator *and* an independent reconciler at each observer node recompute from their own copies; any of them can submit `ReportParBreak` with evidence.

**How a break halts the system.** The check is a deterministic end-of-block hook in FinalizeBlock, so every validator reaches the same verdict from the same state; there is no vote to halt, and no discretion.

1. P1, P3, P4-anchor or over-issuance under P2 fails: the block still commits (validators must agree on the state that shows the violation), the state flag `HALTED(reason, height, issuer)` is set, and from the next block only `Resume`, `ReportParBreak`, `Attest` and read queries are accepted. Consensus keeps producing blocks (heartbeat) so observers stay in sync and no fork or divergence appears; **settlement stops, consensus does not.**
2. P2 under-issuance or in-flight age breach: `QUARANTINED(issuer)` freezes that issuer's mint, redeem and outbound Convert, but incoming transfers and other issuers continue. If not cleared within a rulebook-set period (I propose 15 minutes) it escalates to Global Halt.
3. Anyone with a registered reconciler key (any validator, observer or the operator) can trigger Quarantine on evidence ("anyone can pull the fire alarm"); Resume requires the P7 co-signature set ("expensive to restart").

**Design honesty.** The blueprint says any par break is system-halting. I have made *kernel-integrity* breaks and *over-issuance* system-halting and graded the rest, because a single bank's core-side posting lag halting all of Canada's wholesale settlement would be an availability own-goal. This grading needs regulator agreement and is a rulebook item (Legal request in section 11).

### 2.4 L3: Atomic DvP and PvP

**Atomicity model.** One instruction, one block, all legs or none. An instruction is a list of legs `{from, to, asset, amount}` plus a template ID. The kernel validates every leg and every invariant against a scratch copy of state; if any check fails the entire instruction is rejected with an ISO reason code and no state changes. There is no partial or pending state on the ledger. Finality receipt = block header + aggregated commit signatures (>= quorum) + Merkle inclusion proof; verifiable offline by a wallet or a court.

**Cross-issuer payment (`Convert` + `Transfer`).**
Payer account at issuer A pays payee account at issuer B amount x:
`bal_payer(T_A) -= x; bal_payee(T_B) += x; SP_A -= x; SP_B += x` with SP_A >= x. Requires signatures of issuer A (payer's debit and screening receipt) and issuer B (payee's account is open and unfrozen and B accepts). B's acceptance is pre-collected (the two issuer services exchange a signed `Accept` over the bilateral channel before submission; if B is unreachable the instruction is never submitted, so nothing is ever debited and then stuck).

**DvP.** Same mechanism with a security leg: `{securities: seller -> buyer, cash: buyer -> seller}`. Two cases:

- *Bond token native on DepositX* (Phase 3 tokenised-bond integration): fully atomic in one block.
- *Bond held at an external CSD (CDS)*: **not atomic on-ledger**, and I will not pretend it is. The cash leg is an `Escrow`/`PayOnEvent` template released by a signed CSD confirmation (sese.025) from a registered event-oracle key, with a deadline and a refund path. That gives conditional, not atomic, DvP, with a defined residual risk window. No bridge; the oracle is a bank-grade attestation gateway. (verify CDS interface and ISO 20022 readiness.)

**PvP.** Same-currency inter-issuer swaps are already `Convert`. True cross-currency PvP is a Phase 4 problem between two separate BFT networks; atomicity across networks needs a timelock protocol or a trusted coordinator or light-client-verified relay. I defer the design and flag it (verify); it is not on the 2027–2028 critical path.

### 2.5 L3: Template library and review process

**Design.** Templates are parameterised instances of a small set of audited native primitives; there is no dynamic code loading.

- **Four fund-movement primitives**, the only code that touches balances: `Lock`, `Release`, `Refund`, `Convert`. Conservation (P1, P3, P5) is proven once, for these four.
- **A total, bounded expression language** for guards (no loops, no recursion, bounded depth and cost; Marlowe-style finite contracts as prior art). Guards read: block time, signed attestations from registered oracles, instruction state.
- **Templates at launch:**

| ID | Template | Phase |
|---|---|---|
| T1 | `Transfer` (same-issuer) | 1 |
| T2 | `Convert` (cross-issuer par swap) | 1 |
| T3 | `DvP` (native asset legs) | 1 |
| T4 | `Escrow` (timeout, refund) | 2 |
| T5 | `PayOnEvent` (quorum of registered oracles) | 2 |
| T6 | `Standing / Sweep` (timer-queue driven) | 2 |
| T7 | `Batch` (multi-payee, single instruction) | 2 |
| T8 | `NetCycle` (system template, section 2.6) | 3 |

- **Activation.** New templates ship in the next kernel release and are switched on at a governance-set height. No template can invoke another arbitrarily; composition is a fixed, reviewed set.

**Review process (six gates).**

1. *Proposal.* Business case, risk class: **C0** composition of existing primitives with existing guard types; **C1** new guard or new oracle class; **C2** new fund-movement primitive. Owner, threat model, value-at-risk cap.
2. *Specification.* Template Definition Language spec and a TLA+ model for anything with time or oracle behaviour; reviewed by the Architecture Review Board (ARB).
3. *Implementation.* Two-person rule; only primitives and audited guards; fuzz harness required.
4. *Verification by class.* C0: property tests + bounded model check (Kani). C1: adds TLA+ model check of the protocol. C2: adds Verus proofs and an external audit.
5. *Independent review.* External security review for C1/C2; each issuer's model-risk function may veto the template for its own institution (per-issuer admission list, opt-in), because banks' third-party and model-risk regimes (OSFI B-10, B-13, verify current) will require it.
6. *Governance.* Template Committee approval; 30 days' notice to supervisors (verify with Legal); staged rollout testnet -> pilot with per-template value cap -> production; deprecation and sunset procedure.

**Rejected:** an EVM or WASM VM with deployable contracts (contradicts the blueprint's non-goal and enlarges the attack surface); a general Daml-style contract runtime (same).

### 2.6 L3: Liquidity-saving netting and settlement positions

**Why settlement positions exist.** A cross-issuer payment is a par claim of B on A. Invariant II (legal and technical finality in one instant) means that claim must be discharged *at that instant*, in central-bank-anchored value. Therefore each issuer holds a **prefunded settlement position** SP_i on DepositX that is backed 1:1 by the anchor (A1: a segregated BoC balance; A2: collateral). Cross-issuer payments move SP; no payment ever creates an unsecured interbank exposure. This is my most important structural addition to the blueprint; the blueprint names the anchor but does not define how 24/7 flows interact with an anchor that operates on Lynx business hours (Lynx is not 24/7; verify hours).

**Funding and defunding.** Issuer treasury moves value between its Lynx account and its SP during anchor hours via `camt.050` (LiquidityCreditTransfer), confirmed with `camt.054`; the BoC-observer anchor gateway signs `AnchorAttestation{per-issuer balances, as-of}`. P4 ties them together. Weekend and overnight risk: SP can run dry when the anchor is closed. Mitigations: per-issuer minimum-buffer policy enforced as an alert at 30% of trailing-week peak outflow; LSM (below); a rulebook item for an intraday/weekend liquidity facility (Legal/BoC) (verify what BoC allows).

**LSM.** Instructions that fail only on SP sufficiency enter a queue; they have debited nothing. Once per second, and on any funding event, a deterministic pure function of (queue, SP, block time) runs in-consensus:

1. Bilateral offset: for each pair (A,B) with queued A->B of x and B->A of y, settle both if the net satisfies SP.
2. Multilateral gridlock resolution (Bech–Soramäki-style heuristic): find a maximal subset S of queued instructions such that for all issuers SP_i + net_i(S) >= 0; settle S atomically. Complexity bounded by a queue cap (10,000) and an iteration cap so every validator does the same bounded work.
3. Unsettled instructions expire at `valid_until` and are rejected whole.

A settled cycle is one atomic commit; finality is not deferred. The success metric is liquidity saved versus gross RTGS on replayed anonymised Lynx data (S8, verify data access); my planning target is >= 30% lower peak liquidity need (verify; depends on the data).

### 2.7 L3/L5: 24/7 mint and redeem against core banking and the anchor

Full mechanics are in section 5. Summary of ordering, chosen so that a crash at any point leaves the customer's money safe and the ledger never over-issued:

- **Mint:** core places a *durable hold and reclass* (debit customer's ordinary account, credit "tokenised deposits control" GL, same bank, no new liability) -> adapter registers the hold on-ledger (`OpenHold`) -> ledger `Mint` closes the hold. Core-first means S_i <= L_i always.
- **Redeem:** ledger `Redeem` (burn) is final first -> adapter observes the burn event -> core credits the customer and debits the control GL -> `CloseRedemption`. Ledger-first means the customer's claim is never lost, and L_i >= S_i holds during the window.
- **Anchor:** mint and redeem do *not* move settlement positions (they are intra-bank reclassifications). Only `Convert` and funding events move SP.

### 2.8 L4: Compliance engine hooks

Principle from the blueprint's data model: identity and KYC evidence stay off-ledger at the issuing bank; the ledger carries attestations. The consequence I accept: **validators cannot re-screen; they verify that the responsible issuers did.**

| Hook | Where | What |
|---|---|---|
| H1 Account admission | Issuer | KYC/KYB level and expiry recorded as an on-ledger attestation reference (`KycAtt{account, level, expiry, issuer_sig}`); account cannot transact after expiry |
| H2 Pre-submission screening | Issuer compliance service (integrates the bank's existing sanctions/watchlist engines, e.g. Fircosoft/Actimize-class (verify)) | Screen payer and payee (payee data received from counterparty issuer via a Travel Rule exchange over the bilateral channel, IVMS 101-style payload (verify applicability of FINTRAC rules to domestic bank deposit tokens)); emit `ScreeningReceipt{inst_hash, result, engine_version, list_version_hash, timestamp, issuer_sig}` |
| H3 In-consensus enforcement | Kernel | Reject if receipt missing, stale (> 30 s), result not CLEAR, or list version below the network-minimum; enforce network-level limits (per-issuer daily net debit cap, pilot value caps, per-template caps) from governance parameters |
| H4 Network block-list | Kernel | `BlockList` updated by a governance transaction carrying a regulator-signed directive (e.g. Canadian sanctions list changes (verify authority path)); effective from the next block, applies to accounts and issuers |
| H5 Limits and velocity | Issuer (customer-level, plaintext) and operator (aggregate metadata) | Per-account and per-corporate limits live at the issuer; the network only sees issuer-level aggregates, which is what the network can legitimately police |
| H6 Post-final reporting | Issuer | Every final instruction emits `camt.054` plus an enriched event to the bank's FINTRAC reporting pipeline (LCTR, EFTR, STR, etc.); banks file, the operator does not (verify thresholds and applicability with counsel) |
| H7 Anomaly detection | Issuer + operator | Streaming rules over metadata; supervisory alerts |

**Sanctions/Travel Rule evasion through confidentiality** (blueprint threat): under M1 or M2 the screening receipt is bound to the instruction hash and issuer-signed, so hiding amounts does not hide the *fact* of screening; the supervisory read-node can open any instruction (section 2.11). A validator cannot detect a *lying* issuer; that is a supervisory and audit control (sampling plus signed receipts creating non-repudiable evidence), which is stated as a residual risk.

### 2.9 L5: Institutional API gateway

- **Deployment:** bank-hosted (Tier 2 and 3), plus an operator-hosted *sponsored-access* gateway for Tier 1 institutions. Stateless gateway processes, state in a transactional outbox (PostgreSQL) so acceptance is durable before acknowledgement.
- **Protocols:** gRPC (internal and high-volume), REST/JSON with OpenAPI 3.1, ISO 20022 XML endpoints for message-native institutions. **Rejected:** GraphQL (unbounded query cost on a settlement system), raw ledger RPC to banks (leaks internals; upgrade coupling).
- **Security:** mutual TLS; OAuth 2.0 with private_key_jwt client authentication at the bank's own IAM (FAPI 2.0-style profile, verify); HTTP Message Signatures (RFC 9421) on instruction submission; per-participant token-bucket rate limiting with priority classes (settlement > status > query).
- **Semantics:** `POST /instructions` returns 202 with `instruction_id` once durably outboxed; `Idempotency-Key` mandatory; state via `GET`, server-sent events, gRPC streams and webhooks. States: `RECEIVED -> SCREENED -> SUBMITTED -> FINAL | REJECTED(reason) | EXPIRED`. There is no `PENDING_SETTLEMENT` a customer can be stuck in.
- **SLIs:** gateway acceptance p99 < 100 ms; instruction-accepted to finality (t0 = gateway durable ack of a complete, screened, proof-carrying instruction; t1 = finality receipt) < 2 s median, < 5 s p99, matching the blueprint's definition. I also track the *customer-visible* SLI including screening and proving (section 6.4).
- **Language:** Java 21 / Kotlin, because bank integration teams operate and extend JVM services; the SPI is gRPC so they may write adapters in any language.

### 2.10 L5: ISO 20022 message mapping

Canonical internal model is a Protobuf `DepositXInstruction`; ISO 20022 is a translator library (XSD plus Schematron business rules, golden-file tested), version-pinned per usage guideline. Versions (`.08` vs `.10` vs `.12`) and the Payments Canada HVPS+/Lynx usage guidelines are to be confirmed (verify).

| DepositX event | ISO 20022 message | Notes |
|---|---|---|
| Corporate initiates payment / conditional payment | `pain.001.001.11` CustomerCreditTransferInitiation | Conditions carried in `SplmtryData`; mapped to T1/T2/T5 |
| Cross-issuer customer transfer instruction (issuer-to-issuer wire form) | `pacs.008.001.xx` FIToFICustomerCreditTransfer | Debtor, creditor, agents, UETR (idempotency); regulatory data for Travel Rule |
| Issuer-to-issuer / funding movement | `pacs.009.001.xx` FinancialInstitutionCreditTransfer (and COV where needed) | Settlement position funding and interbank items |
| Final / rejected status | `pacs.002.001.xx` FIToFIPaymentStatusReport | Finality -> `TxSts=ACSC` (AcceptedSettlementCompleted); reject -> `RJCT` with `StsRsnInf` codes such as `AM04` (insufficient funds), `AG01` (transaction forbidden), `DUPL`, `RR04` (regulatory reason) (verify code list) |
| Status enquiry | `pacs.028` FIToFIPaymentStatusRequest | Returns pacs.002 |
| Return of a *final* payment | `pacs.004` PaymentReturn | A return is a **new** transfer; finality means no reversal. Triggered by `camt.056` cancellation request, resolved by `camt.029` |
| Real-time debit/credit notice | `camt.054` BankToCustomerDebitCreditNotification | Primary event to core adapters and TDS; one per final instruction |
| Intraday account report | `camt.052` BankToCustomerAccountReport | Treasurers, TDS reconciliation |
| End-of-day statement | `camt.053` BankToCustomerStatement | Statements for token accounts; reconciliation of the core control GL |
| Liquidity funding of settlement positions | `camt.050` LiquidityCreditTransfer; `camt.019`, `camt.025` | Anchor funding/defunding (verify Lynx messaging) |
| Balance / limit queries | `camt.060` AccountReportingRequest; `camt.009`/`camt.010` | |
| Securities settlement instruction (bond DvP) | `sese.023` SecuritiesSettlementTransactionInstruction | Delivery vs payment; native legs or CSD-linked |
| Securities status | `sese.024` StatusAdvice; `sese.025` Confirmation | `sese.025` from the CSD is the event-oracle attestation for conditional DvP |
| Securities cancellation | `sese.027` SecuritiesTransactionCancellationRequest | Pre-finality only |
| Holdings / postings | `semt.017` SecuritiesTransactionPostingReport; `semt.002` | Custody reporting |

Regulatory reporting to FINTRAC is not ISO 20022; it goes through FINTRAC's own reporting channel from the bank (verify). ISO 8583 (card-message) appears only in the core-adapter card-rail path (5.3).

### 2.11 L5: Wallet SDK

- **Custody model.** Bank-hosted, as in the blueprint. In Phases 2–3 the *issuer* signs on-ledger instructions; the customer's authority is captured as a **Customer Authorisation Object (CAO)** (signed by the corporate's approved signers per the bank's existing dual-control workflow), whose hash rides on the instruction and whose body stays in the bank. Non-repudiation evidence is preserved without customer keys on the network. In Phase 4 retail, CAOs are signed by device-bound passkeys (WebAuthn, P-256), bank countersigns.
- **SDKs:** TypeScript (web, Node), Java/Kotlin (server, Android), Swift (iOS; Phase 4). Functions: build and sign instructions, ISO 20022 conversion, status subscription, **offline verification of finality receipts** against a pinned validator set (this is the "legal-technical instant" made checkable), sandbox mocks for the conformance suite.
- **Rejected:** customer-held on-chain keys for wholesale (contradicts bank-hosted custody, adds key-recovery liability to banks).

### 2.12 Supervisory read-node

- A **non-voting full node** hosted on OSFI/BoC premises (or operator-hosted per mandate) plus a **Supervisory Query Service**: an indexed replica (PostgreSQL / ClickHouse-class, verify) with pre-materialised views: exposure by issuer, by holder class, concentration, settlement positions, in-flight registry, halt state, template usage, top-N flows. SLO: any mandated position query < 60 s on the full production dataset (test at >= 1B records, section 7).
- **Scoped access** by mandate. M1: auditor keys (regulator decryption key shares held m-of-n; opening yields a verifiable proof). M2: an automated **Supervisory Disclosure Service** in each issuer node answers mandate-authenticated queries within SLA and returns signed openings against the on-ledger domain checkpoints.
- **Tamper-evident audit log:** all queries and all governance actions written to an append-only Merkle transparency log (Trillian-class, verify) with signed tree heads witnessed by BoC and OSFI observer keys.

### 2.13 Cross-cutting

**Key management.**

| Key | Custody | Notes |
|---|---|---|
| Issuer mint-policy and instruction-signing keys | Bank-owned HSM (FIPS 140-3 Level 3) in Canada | m-of-n approver quorum in the bank; ECDSA P-256 at launch |
| Consensus keys | HSM behind remote signer with double-sign guard | Per validator |
| Governance keys (operator, issuers, BoC observer, neutral seat) | One HSM-resident key per human role, combined by **ledger-native m-of-n multisig** | Replaces MPC for governance (D8); auditable on-ledger; no novel crypto |
| Operator infrastructure secrets (data-at-rest master keys, log-signing keys) | Threshold (Shamir with HSM-wrapped shares); MPC only where a threshold *signature* is unavoidable | Quarterly attested ceremonies, break-glass rehearsed as blueprint requires |
| Anchor attestation key | BoC-controlled | |

Signature suite: ECDSA P-256 first (broadest HSM and FIPS support; Ed25519 is FIPS-approved in 186-5 but HSM support varies (verify)); `suite_id` in every envelope enables **crypto-agility**; ML-DSA (FIPS 204) hybrid signatures in Phase 4 with a dual-signature transition period. HSM residency: Canadian data centres; check cloud-HSM regional availability if any operator component is cloud-hosted (verify).

**Observability and assurance.** OpenTelemetry traces; Prometheus metrics; per-bank SIEM export; signed audit log (2.12); continuous PFMI self-assessment mapped to controls-as-code evidence (each CI gate and runbook drill produces a signed artefact mapped to a PFMI principle).

**Resilience.** See sections 6.5 and 7 for the region-loss arithmetic and DR procedure. Every validator persists each committed block with fsync before voting to commit; RPO is zero for committed blocks by construction.

---

## 3. The confidentiality decision

### 3.1 Requirement first: the leakage budget

Before choosing a technology the rulebook must state who may see what. My working proposal (for Legal and Privacy to approve or amend):

| Field | Counterparty issuer | Non-party validator issuers | Operator | BoC/OSFI mandated | Public |
|---|---|---|---|---|---|
| Customer identity, KYC, narrative | No (Travel Rule payload only, bilateral) | No | No | Via issuer disclosure | No |
| Customer account balances | Own accounts only | No | No | Via mandate | No |
| Instruction amount | Yes | **Target: No (M1). M2: Yes, at issuer-pair level only** | No (M1) | Via mandate | No |
| Issuer pair (A pays B) | Yes | M1: yes (needed for SP). M2: yes | Yes | Yes | No |
| Issuer settlement positions | Own only | **Target: No. Achievable only in M1 for positions with more work; otherwise visible** | Aggregates | Yes | No |
| Supply and reconciliation status | Yes | Yes | Yes | Yes | Aggregate status only |

The uncomfortable row is the last-but-one: in a shared ledger where every validator executes every transaction, competitor banks see each other's interbank flows unless amounts are hidden. Lynx participants do not see one another's payments; the operator does. That is the bar the founders' privacy language implies (verify with Legal that this is their intent).

### 3.2 The options

**M1: committed amounts (ZK).** Account-based balances held as Pedersen commitments; transfers carry range proofs (Bulletproofs+-class, no trusted setup) and equality/conservation proofs; validators check homomorphic conservation and proof validity, never amounts. Supply commitments sum homomorphically (P1 and P2 are checked on commitments, with the issuer opening L_i to auditors). Screening receipts bind to the commitment. Supervisory opening via auditor keys.

Why this shape rather than a general zk-SNARK circuit system: proof generation for general circuits is seconds per proof (verify), which threatens the 2 s budget; Bulletproofs-class range proofs are tens of milliseconds to generate and about 1–3 ms single-proof verify, lower in batch (verify, all figures). The cost is proof size (~700 bytes for an aggregated two-value range proof, verify) and the contention problem below.

**M1's hardest problem is not verification, it is hot accounts.** An account-model proof references the sender's current committed balance; two concurrent sends from one account invalidate each other. Issuer settlement positions and large corporate treasurers are exactly hot accounts. Design: pending/available balance split (receives credit a *pending* commitment that rolls into *available* at epoch boundaries, so credits never invalidate a sender's proof) and **outbox batching** (the issuer's prover coalesces an account's payments within a 250 ms window into one proof covering N transfers). Target: a single hot account sustains >= 200 payments/s. This complexity is real and is why M1 may lose.

**M2: issuer domains (need-to-know two-tier ledger)** (section 3.4) is the fallback and I treat it as a production-grade design.

**Rejected:** general-purpose zk-rollup or zkEVM (immature, proving latency, wrong trust model); TEE-only confidentiality (hardware trust root, side-channel record, residency and attestation dependency on a foreign vendor); "fully transparent" ledger (fails privacy requirement and probably PIPEDA/bank-secrecy expectations, verify with counsel); Zcash-style shielded UTXO pool (note management and nullifier growth, multi-second proofs, no bank-hosted custody fit).

### 3.3 Phase 1 benchmark for M1 (spike S3)

**Environment.** 10 validator servers (32 vCPU, 128 GB, NVMe), three sites with injected RTT 1 / 10 / 15 ms; per-issuer prover pool of 8 vCPU per 500 tx/s; 1M accounts, Zipf-skewed (top 100 accounts receive 40% of traffic); workload mix 80% Transfer, 15% Convert, 5% DvP; 5,000/s sustained 1 h, then 20,000/s burst for 60 s.

**Pass/fail (all must pass):**

| # | Metric | Pass | Fail = M2 |
|---|---|---|---|
| T1 | Validator CPU at 5,000/s sustained | <= 50% of 32 vCPU (so a 20k/s burst queues rather than fails) | > 70% |
| T2 | Proof generation latency at the issuer prover | p50 <= 150 ms, p99 <= 400 ms | p99 > 800 ms |
| T3 | End-to-end finality with proofs (t0 = acceptance of a complete proof-carrying instruction) | median <= 1.5 s, p99 <= 4 s at 5,000/s | median > 2 s or p99 > 5 s |
| T4 | Per-transaction on-ledger size | <= 2.5 KB | > 4 KB |
| T5 | Hot account | one account sustains >= 200 payments/s; proof-retry rate <= 1% | < 50/s |
| T6a | Supply check on commitments (P1, P2) each block | correct, adds <= 20 ms per block | any miss |
| T6b | Halt on injected over-issuance (commitment mode) | halts in the same block, 100 of 100 trials | any miss |
| T6c | Supervisory opening | any instruction opened and verified in <= 1 s; 1M-record aggregate exposure query <= 60 s | fail |
| T6d | Screening receipt binding | receipt bound to commitment; replay/malleability fuzz clean | any finding |
| T7 | Cryptographic assurance | library reviewed by **two** independent cryptography firms with no open critical/high issues, scheduled before Phase 2 go-live (verify availability of reviewers and audit slot) | cannot be scheduled by 30 Jun 2027 |
| T8 | Cost | prover fleet <= 40 vCPU per 1,500 tx/s originated by one issuer | > 100 vCPU |

**Timeline.** Interim checkpoint 26 Feb 2027; results 31 Mar 2027; **Gate G1.2 decision 14 May 2027**. **Decision rule:** all of T1–T8 pass -> M1 is the Phase 2 pilot mode. Any fail -> M2 is the Phase 2 pilot mode and M1 continues as R&D targeted at Phase 4 (or a Phase 3 upgrade if it passes later). M1 never blocks the critical path.

### 3.4 The fallback: M2, Issuer Domains (need-to-know two-tier ledger)

**Idea.** Split the ledger into a **Global Settlement Ledger** (all validators) and per-issuer **Account Domains** (held by the issuer's node; customer-level state never enters the global ledger). This is also closer to the blueprint's own trust model (bank-hosted wallets, bank core as source of truth).

**What the Global Ledger holds.**

- Registry, governance, halt state, block-lists.
- `SettlementPosition[i]` in plain amounts (issuer-level).
- `SupplyLedger[i]` and in-flight registries, with plain amounts.
- `DomainCheckpoint[i]`: a per-block (or every k blocks) issuer-signed record `{root_prev, root_new, sum_balances_i, delta_supply_i}` committing the Merkle root of issuer i's private account database and the aggregate of its balances.
- `InstructionRecord`: opaque instruction ID, issuer pair (A, B), amount x, template ID, screening-receipt hash, and an encrypted payload blob (customer-level details encrypted to B's key and the supervisory key).

**What it does not hold:** customer accounts, per-customer balances, customer identities, narratives.

**Protocol for a cross-issuer payment.**

1. Issuer A's domain reserves the payer's funds (encumbrance within A's domain) and runs H2 screening.
2. A and B exchange over a bilateral encrypted channel: A's `Prepare` (payload, receipt) and B's `Accept` (payee account valid, unfrozen, B reserves nothing yet but commits to credit). The co-signed envelope carries both issuer signatures.
3. A submits the co-signed instruction. Consensus checks: both signatures, dedup, receipt freshness, SP_A >= x, network limits. It executes `SP_A -= x; SP_B += x` and records the instruction as final. **No validator learns customer identities.**
4. On finality, A's domain converts the reservation to a debit; B's domain credits the payee. Both are deterministic from the finalised record, and both domains' next `DomainCheckpoint` must reflect them. If B's domain fails to credit, B is in breach of the rulebook, and its `sum_balances` mismatch against `SupplyLedger` triggers Quarantine of B (P2 machinery), with the payee's claim intact because the settlement position already moved to B.
5. **Par under M2.** P1, P3, P4, P5, P6, P7 are unchanged at the global level. P2 is enforced on aggregates: S_i (from checkpoints) equals M_i - B_i, and L_i - S_i = H_i + R_i. Customer-level conservation *inside* a domain is the issuer's own obligation, evidenced by the domain kernel (same verified Rust kernel, run by the issuer over its private state), by checkpoint roots, and by supervisory sampling with issuer-signed openings. This is a weaker guarantee than global validation of customer balances; the difference is stated plainly in the rulebook.
6. **DvP under M2.** A co-signed instruction with signatures from each participating domain (buyer's bank, seller's bank, CSD/securities domain). The global ledger enforces atomic commit of the cash settlement positions and the securities issuer's position change; domains apply their own legs deterministically.

**What each party sees (leakage table, M2).**

| Party | Sees |
|---|---|
| Payer, payee and their own issuers | Everything about their own instructions |
| Counterparty issuer | Customer-level payload for instructions it is party to |
| Non-party validators | Issuer pair, amount, template, receipt hash; **not** customers or narrative |
| Operator | Same as non-party validators |
| BoC/OSFI mandated | Above plus issuer-signed openings on request within SLA |

**Honest leakage.** Non-party banks can see that A paid B x. Mitigations, in order of cost: (1) instruction IDs are unlinkable to customers; (2) *settlement batching option:* an issuer pair may agree in the rulebook to submit small instructions as one aggregated `Convert` per 250 ms window (amounts visible only in aggregate), at the cost of latency floor equal to the window; (3) for issuer-position hiding specifically, Pedersen-commit **only** the SP values (a 7x7 pair matrix, tiny proving load) as an M2+ increment, since issuer-level proofs are far cheaper than customer-level ones. If founders will not accept even this visibility, the decision tree goes to Plan C (Canton), section 1.3.

**Throughput.** No proofs. Global path per instruction: 2 signatures, a dedup lookup, two SP updates, one record: ~1.5 KB with the encrypted blob. Same CPU as M0 (section 6). Per-domain: an issuer's domain node must sustain its share; target >= 3,000 instr/s per domain (verify in S4).

**Effort.** Global-ledger extensions (checkpoint transaction, co-signed envelope, encrypted-payload plumbing): about 4 engineers x 4 months. Domain node (kernel reuse plus private store, checkpointing, disclosure service): about 6 engineers x 5 months. Started at reduced staffing (3 engineers) in Phase 1 so that switching modes at G1.2 costs weeks, not quarters.

**M2 benchmark (S4) pass/fail.** Sustained 5,000 instr/s global with 3,000/s in the busiest domain, median finality <= 1.0 s, p99 <= 3 s; checkpoint lag <= 2 blocks; zero global-invariant violations across 10 million randomised instructions with injected domain faults; disclosure service answers 100% of mandated queries <= 60 s; a deliberately corrupted domain (fake balance) is caught by the aggregate check within 2 checkpoints in 100% of trials.

---

## 4. Repository, build, environments, CI, verification

### 4.1 Languages

| Language | Used for | Why |
|---|---|---|
| **Rust** | Ledger kernel, validator node, crypto and proof libraries, load generators | Memory safety, determinism control, verification tooling (Verus, Kani), performance |
| **Go** | CometBFT and only the thin ABCI shim if in-process; ops tooling | Consensus engine is Go; keep our Go surface minimal |
| **Java 21 / Kotlin** | API gateway, core adapters, compliance service, TDS | Bank integration teams' native ecosystem; MQ/JMS |
| **TypeScript** | Web SDK, operator console, sandbox | |
| **Swift/Kotlin** | Mobile SDK (Phase 4) | |
| **TLA+ (Apalache/TLC)**, **Verus**, **Kani**, **Lean 4** | Specification and verification | Section 4.6 |
| **Python** | Analysis, notebooks, simulation only; never in a production path | |

Polyglot cost is real and acknowledged: it is the price of not forcing 7 banks' integration teams onto Rust.

### 4.2 Monorepo layout

```
depositx/
  spec/              English invariant charter; TLA+ models; Lean 4 reference model
  kernel/            Rust workspace: par-kernel (verified), templates, amounts, state, crypto-abstraction
  node/              Rust validator + observer, ConsensusHost, cometbft shim
  crypto/            suites, HSM/remote-signer client, commitments and range-proof libs (M1)
  gateway/           Java/Kotlin API gateway
  adapters/          core-adapter SPI, MQ adapter, REST adapter, ISO 8583 hold adapter, core emulator
  compliance/        screening service, receipt issuer, block-list, Travel Rule exchange
  tds/               Tokenised Deposit Subledger
  iso20022/          canonical model, translators, XSD/Schematron, golden files
  sdk/               ts/, jvm/, swift/
  supervisory/       read-node, query service, disclosure service, transparency log
  ops/               deployment, runbooks-as-code, chaos scenarios, ceremony scripts
  conformance/       participant certification suite
  perf/              load generators, WAN emulation profiles, soak harness
  vendor/            vendored, audited third-party sources; SBOM inputs
```

Ownership by pod via CODEOWNERS; `kernel/par-kernel` and `spec/` require two approvals from the Ledger and Assurance pods and are signed-commit only.

### 4.3 Build and release

- **Bazel** (bzlmod) as the top-level build for hermetic multi-language builds, with `rules_rust` consuming `Cargo.lock`; pinned toolchains; sandboxed builds in containers pinned by digest. **Rejected:** per-language ad hoc builds (cannot deliver reproducibility across Rust/JVM/TS); Nix-only (steeper for bank teams, verify; Nix is retained for developer environments).
- **Reproducible builds:** `SOURCE_DATE_EPOCH`, path remapping, vendored dependencies from a Canadian-hosted mirror, no network at build time. The validator binary must rebuild bit-for-bit on **two independent builders** (operator and one designated bank) and the hashes are compared before release; the release hash is what governance admits on-ledger (2.1 rule 4).
- **SBOM and provenance:** CycloneDX 1.6 and SPDX 2.3 SBOMs per artefact; SLSA Level 3 provenance (in-toto attestations); artefacts signed with keys held in the operator's HSM through a **private** Sigstore/TUF-style trust root hosted in Canada (public Sigstore infrastructure is not used, for residency and availability).
- **Dependency policy:** allow-list only; `cargo-vet` and `cargo-deny` gates; every cryptographic crate is pinned, reviewed and vendored; no network fetch of dependencies in CI. Two-party review for any dependency added to `kernel/` or `crypto/`.
- **Release train:** monthly minor for non-consensus components; kernel releases only through the governed activation process; CAB with issuer representatives; kernel hotfix path with a 4-hour emergency runbook rehearsed quarterly.

### 4.4 Environments

| Env | Purpose | Shape | Data |
|---|---|---|---|
| **dev** | Engineer inner loop | Local 4-validator devnet in containers; core emulator; mocks | Synthetic |
| **test** | Shared integration and nightly | 7 nodes, three simulated sites (`tc netem` WAN profiles), emulators | Synthetic |
| **perf** | Capacity, soak, chaos | Production-like hardware, **n=10, three physical or cloud sites in Canada with WAN emulation**; load generators capable of 25k/s | Synthetic at scale |
| **certification (prod-like)** | Bank onboarding and regulator demos | Same topology and versions as prod, separate PKI, no real value | Synthetic |
| **prod** | Live | Operator plus bank validators, HSM-backed, dedicated WAN | Real; no prod data ever flows down |

### 4.5 CI gates

**On every pull request.** Hermetic build; unit tests; lints deny-warnings; `cargo-deny`/`cargo-vet`; secrets scan; static analysis (Semgrep-class, on-prem); property tests (10k cases) on the kernel; **Kani** harnesses on the kernel (overflow, panic-freedom, bounded properties); **Verus** proofs on `par-kernel` (must all check); TLA+ model checks (Apalache bounded) on any touched protocol spec; ISO 20022 golden-message XSD and Schematron validation; API contract diff (OpenAPI, `buf breaking`); **determinism gate:** replay a 1M-transaction corpus on x86_64 and aarch64 builds and require byte-identical state roots.

**On merge.** 10-node devnet integration suite; short chaos run (kill proposer, partition one site); ISO 20022 round-trip suite.

**Nightly.** 6-hour soak at 50% of target; Jepsen-style history checking against the TLA+ spec's invariants; mutation testing on the kernel (target >= 90% mutants killed); continuous fuzzing (structure-aware on the envelope and ISO parsers, differential fuzzing between Rust kernel and the Lean reference model); **performance regression gate:** median or p99 finality or throughput worse than baseline by > 5% blocks merge.

**Release.** Two-party reproducible build match; SBOM and provenance signed; proofs re-run from clean and proof hashes published; external audit report gating any kernel tag destined for prod; 14 days on the certification environment; conformance suite pass by pilot banks; CAB sign-off.

### 4.6 Formal verification: tools and properties

| Layer | Tool | Properties |
|---|---|---|
| Protocol | **TLA+** (TLC, Apalache) | Mint/redeem/reconcile protocol under crash and message-loss faults between core, adapter and ledger (no over-issuance; every in-flight item eventually closes or escalates); settlement atomicity across signatures; halt monotonicity (P7); DR fencing (no two chains after failover); LSM cycle atomicity |
| Kernel code | **Verus** (SMT-based verification for Rust; verify maturity for our scale) on `par-kernel` (target ~3–5 kLoC of pure functions: `apply_mint`, `apply_redeem`, `apply_convert`, `apply_lock/release/refund`, `par_check`) | P1 conservation across every transition; P3 par (debit = credit); P5 non-negativity; P6 authority preconditions; dedup (an `inst_id` executes at most once); no arithmetic overflow; totality and termination of the guard interpreter; halt monotonicity |
| Wider state machine | **Kani** (bounded model checking) | Panic-freedom, overflow, bounded-state properties for everything outside `par-kernel` |
| Independent reference | **Lean 4** executable model of the kernel plus machine-checked conservation theorem; **differential fuzzing** of Rust versus Lean on every commit | Catches specification-versus-implementation drift; provides an N-version safeguard on the highest-assurance component |
| Consensus | Rely on published Tendermint-family safety and accountability proofs and existing TLA+ specs (verify); we verify only our use of the engine (ABCI determinism, height gating, remote-signer high-water mark) | Not re-proving BFT |

**Explicitly not proven:** the consensus engine itself, cryptographic primitives (assumed), the HSM, the OS, the bank core, the compilers (Rust and Verus toolchain trusted, mitigated by reproducible builds and differential testing). "Proofs published" in the Phase 2 exit means: the spec, the property list above, and machine-checkable proof artefacts for the properties marked Verus, with the assumptions list. **Templates T4–T8** are verified at specification level (TLA+) and through their reuse of the four proven primitives; they are *not* fully code-verified in Phase 2 and I will say so.

**Effort and kill criterion (S2).** Six-week spike: Verus proof of P1 and P3 for `apply_transfer` and `apply_convert`. If proof-to-code effort exceeds about 15:1 or the proofs cannot be closed on the core functions, fall back to Kani plus TLA+ plus Lean differential testing plus an external code audit, and re-word the Phase 2 exit ("formally specified and model-checked" rather than "formally verified") (verify tool suitability). Staff: 5 FV engineers in Phase 1 growing to 8 in Phase 2, plus an external formal-methods firm (candidates to be RFP'd: Galois-, Runtime Verification-, Certora-class firms; verify availability).

---

## 5. Reference core-banking adapter

### 5.1 The ledger-of-record question, answered

Three different truths, each authoritative in its own domain:

1. **Legal deposit liability of the bank to the customer:** the bank's books. The token is a *representation* of that liability, as the blueprint says. The bank's books include the TDS (below), which is part of the bank's own subledger.
2. **Who owns which tokenised balance at the consensus instant:** the ledger (Invariant II). Rulebook: a transfer is complete when the finality receipt exists; the bank's TDS must conform, and a bank that cannot conform is in breach and quarantined.
3. **Aggregate tokenised liability:** the core's *tokenised deposits control GL* (5.2), reconciled against ledger supply (P2).

Consequently the customer-level tokenised balance does **not** live in the legacy core. It lives in the **Tokenised Deposit Subledger (TDS)**: a modern, bank-hosted, highly-available service inside the bank's own perimeter and books, fed exactly-once from ledger events (`camt.054` per final instruction, keyed by instruction ID and block height). The legacy core sees (a) mint reclass postings, (b) redemption postings, (c) aggregate control GL movement, and (d) TDS end-of-day feeds for regulatory reporting. CDIC's per-depositor single-customer view is produced by merging core deposits and TDS balances (verify CDIC data format and process). **Rejected:** posting every token transfer to the core (infeasible at throughput against legacy cores, and makes core availability a settlement dependency); making the ledger the sole record with no bank subledger (violates "bank core remains source of truth" and the perimeter).

### 5.2 Mint/redeem posting model at the core

- **Control GL:** a dedicated liability account "Tokenised Deposits Control". Mint = debit customer's demand deposit account, credit control GL (a reclassification within deposit liabilities; the bank's total deposit liability is unchanged, which is what "representation of an existing liability, not a new one" means in accounting terms; verify treatment with Finance and OSFI).
- **Hold-first mint** and **burn-first redeem** ordering per 2.7.
- **Idempotency:** every core call carries a bank-scoped idempotency key derived from the ledger `inst_id`; the UETR from pacs.008/pain.001 is preserved end-to-end.

### 5.3 Adapter classes and mechanics

| Class | Core reality | Adapter approach |
|---|---|---|
| **A: real-time, API-enabled cores** (e.g. Temenos Transact with online close, FIS modern/Profile deployments, cloud-native cores) (verify each vendor's 24/7 posting capability and versions) | 24/7 online posting; REST/SOAP or event APIs | REST/gRPC adapter with idempotent hold, reclass, redeem-credit; `camt.054` from core events |
| **B: mainframe cores with batch windows and MQ front-ends** (largest Canadian banks are widely believed to run heavily customised in-house or legacy stacks (verify per bank; do not assume vendor)) | IBM Z with CICS/IMS/DB2; nightly batch; IBM MQ channels; COBOL copybook transactions | MQ adapter (JMS or MQI) with **transactional outbox/inbox and idempotency keys instead of XA**; copybook-to-Protobuf mapping generated from the bank's copybooks; **stand-in posting** during batch windows (5.4) |
| **B2: 24/7 authorisation-rail path** | Many banks already expose a real-time debit/hold interface via the card and ATM authorisation switch | ISO 8583 hold pattern: `0100` authorisation (place hold), `0220` financial advice (complete), `0400/0420` reversal (release). Pragmatic where the core has no other 24/7 hold API. Risks: channel and MCC semantics, fee side-effects, scheme rules, limited reference data (verify with each bank; this is a fallback, not the preferred path) |
| **C: in-house** | Anything | Implement the adapter SPI (below) directly; certification proves conformance, not internals |

**Adapter SPI** (gRPC, JVM reference implementation): `PlaceHold(idem, acct, amt) -> holdId`; `CompleteMint(holdId) -> glPosting`; `ReleaseHold(holdId)`; `PostRedemptionCredit(idem, acct, amt, ref)`; `GetControlGLBalance(asOf)`; `ListInFlight()`; `SubscribeCoreEvents()`; `Mode() -> NORMAL | STAND_IN | DEGRADED`.

**Phase 1 delivery.** The blueprint says "one core-banking stack". I recommend: (a) a **Reference Core Emulator** that models a batch-window mainframe (MQ, copybooks, delayed posting), an ISO 8583 hold host and a Temenos-like REST core, used in CI and in the conformance suite; and (b) *one* live integration against pilot bank #1's pre-production core (kick off environment provisioning in October 2026; bank test-region lead times of 8–16 weeks are common, verify). Choosing the vendor stack for (b) is driven by bank #1's actual core, not by vendor preference.

### 5.4 Stand-in during core batch windows

If the core cannot post 24/7, the adapter's own **durable outbox and shadow control ledger** (part of the bank's subledger, HA within the bank, journalled) is the authoritative record *for the window*. Holds are recorded in the shadow ledger against a *conservatively reduced* available balance snapshot (per-customer stand-in limits, the same technique banks use for card stand-in processing) and are replayed into the core when it reopens. The reconciler treats shadow-ledger holds as evidence for in-flight classification (so a batch window does not look like a par break). Stand-in mint limits per customer and per bank are rulebook parameters and enforced by the issuer's compliance service.

### 5.5 Reconciliation and failure modes

| # | Failure | Consequence if unhandled | Handling |
|---|---|---|---|
| F1 | Core down or slow at mint | Nothing minted | Hold not placed -> reject; customer sees a clear failure; nothing on ledger |
| F2 | Hold placed, adapter crashes before registering it on-ledger | Orphan hold; customer funds frozen | Outbox replay resumes on restart; reaper releases holds unmatched after a TTL (default 5 min) |
| F3 | Ledger mint final but adapter missed the confirmation | Hold stuck open; in-flight age grows | Adapter recovers by querying the ledger by `inst_id` (idempotent); closes hold |
| F4 | Redeem burned, core credit fails or is delayed | Customer's ledger balance is gone, credit not posted | In-flight redemption registry entry; stand-in credit to TDS "pending redemptions"; SLA 15 min soft / 60 min hard escalate; core retry with the same idempotency key |
| F5 | Duplicate message from MQ or client retry | Double mint or double credit | Idempotency key = `inst_id`; core and TDS reject duplicates; UETR uniqueness at gateway |
| F6 | Core posting rejected (account closed, frozen, legal hold) at redemption | Value with no destination | Route to a bank suspense account under the same control-GL accounting; customer contacted; entry stays in in-flight registry until resolved, reported in attestation |
| F7 | **Core restored from backup with RPO > 0 (bank core DR)** | Core control GL falls *behind* the ledger: S_i > L_i -> looks like over-issuance -> Global Halt | **Highest-impact failure of this design.** Mitigations: the adapter outbox and TDS journal are held in a store *outside* the core's RPO; a **Core-Loss Recovery Mode** replays outbox entries into the restored core; the reconciler classifies a gap fully explained by outbox evidence as `CORE_LAG` (Quarantine, not Global Halt). Each bank's core DR RPO and mainframe replication mode must be surveyed in Phase 0 (verify) |
| F8 | Reconciler false positive | Unnecessary halt | Three independent reconcilers must agree for Global Halt on the P2 over-issuance path except for kernel P1/P3/P4 (which are deterministic and single-source); false-halt rate tracked; target 0 in 30-day pilot |
| F9 | Bank reports wrong L_i (bug or fraud) | False assurance | Signed attestation is non-repudiable; independent `camt.053` statement of the control GL delivered directly from the core's reporting path to the observer; discrepancy -> Quarantine |
| F10 | TDS diverges from ledger | Customers see wrong balances | TDS applies ledger events by (block height, index) only; hourly full hash reconciliation of TDS state against the ledger's account Merkle proofs (M0/M1) or domain root (M2) |

### 5.6 Onboarding tiers and certification (the blueprint's missing model)

| Tier | Who | Runs | Typical lead time (verify) |
|---|---|---|---|
| **T0** | Regulators, observers, auditors | Read-only observer node or read API | 1–2 months |
| **T1** | Smaller institutions, sponsored access | API to operator-hosted sponsored gateway; no node; sponsor bank or operator holds nothing of the client's money | 3–4 months |
| **T2** | Issuers with own integration | Own gateway, adapter, compliance service, TDS, full (non-voting) node | 9–12 months for a large bank |
| **T3** | Voting-validator issuers | T2 plus HSM-backed validator in an assigned failure domain | 12–15 months for a large bank, of which most is *bank-internal* change control, security review and core integration |

**Certification stages:** (1) *Connect*: PKI, network, HSM, health checks. (2) *Functional conformance*: the DepositX Conformance Suite (target ~400 scripted scenarios covering every template, ISO 20022 message, error code and reconciliation path, results cryptographically signed and submitted). (3) *Resilience*: scripted failure injection by the operator (kill adapter mid-mint, drop MQ, core-DR replay, gateway overload) with pass/fail on invariants. (4) *Security and third-party risk*: penetration test, evidence pack for the bank's own third-party-risk and technology-risk governance (OSFI B-10, B-13, E-21; verify current versions and effective dates), SOC reports. (5) *Operational readiness*: runbooks, on-call, one DR drill, and a rehearsal of the halt/quarantine/resume procedure.

**Wave plan.** Wave A: 2 pilot banks in Phase 1; Wave B: 2 more by mid-Phase 2 (4 issuers live in the pilot); Wave C: banks 5–7 in Phase 3. For all seven to be live in H2 2028, banks 3–7 must **start** integration by Q3 2027 and staff their T2/T3 work (5–8 engineers each) from then. Bank change-freeze calendars around year-end and parallel programmes (Real-Time Rail, verify current timing; ISO 20022 and regulatory changes) are the most likely source of slippage.

---

## 6. Capacity and performance model

### 6.1 Inputs and definitions

- **Instruction** = one settlement instruction (one `Transfer`, `Convert` or `DvP`), i.e. one transaction.
- **Sustained** = 1-hour minimum at target in the perf environment for phase gates, and a 6-hour soak for the Phase 3 certification. **Burst** = 20,000/s for 60 s absorbed without invariant violation (queueing permitted, bounded at 30 s of backlog).
- **Finality latency** per the blueprint = instruction-accepted (gateway durable ack of a complete, screened, proof-carrying instruction) to consensus-final (finality receipt). I also track customer-visible latency (section 6.4).
- Topology: n = 10 (7 issuers, 2 operator, 1 neutral), f = 3, quorum 7; at least 4 failure domains, at most 3 validators per domain.
- Planning sizes (estimate, verify in S1/S3): M0 ≈ 0.8 KB/tx; M2 ≈ 1.5 KB/tx; M1 ≈ 2.2 KB/tx.

### 6.2 Resource model at 5,000 sustained instr/s

| Resource | M0 (plain) | M1 (committed) | Basis |
|---|---|---|---|
| On-ledger data rate | 4 MB/s | 11 MB/s | 5,000 x size |
| Proposer egress if the block is sent to 9 peers | ~36 MB/s (~290 Mbps) | ~99 MB/s (~790 Mbps) | Each validator leads 1 in 10 blocks, so average egress is ~10% of these; the peaks must be sized, so 10 GbE for validators; block-part relay reduces it further |
| Average ingress per validator | 32–64 Mbps | 90–180 Mbps | Includes ~2x gossip amplification |
| Signature verification | ~1–1.5 cores | ~1–1.5 cores | 2 signatures/tx at 100–150 µs (P-256, verify) |
| Kernel execution | ~0.15 core | ~0.15 core + proofs | ~30 µs/tx sequential; a 20k/s burst is ~0.6 core |
| Range-proof verification | n/a | ~3 cores (batched ~0.6 ms/proof) or ~7.5 (unbatched) | verify in S3 |
| State commit | 1–2 cores | 1–2 cores | ~20,000 key updates/s into a Merkleised RocksDB store (verify) |
| Block-size ceiling | 16 MB / 300 ms ≈ 60k tx/s | 16 MB ≈ 22k tx/s | Confirms 20k/s burst fits M0; M1 tight, raise cap if needed |
| Disk growth if 5k/s ran 24/7 | ~0.35 TB/day | ~0.95 TB/day (>= 340 TB/year) | Hence tiered storage and archival; see below |

**Reading the table.** CPU is not the bottleneck: 8–16 cores per validator suffice; a 32-vCPU server is generous. The bottlenecks are (1) the consensus critical path, (2) fsync per block, (3) network egress at the proposer, (4) storage growth, (5) for M1, the prover fleet. **A sequential Rust state machine has no hot-account contention** (a decisive advantage over UTXO or optimistic-concurrency designs), which is why 5,000/s is unremarkable for this platform and remarkable for EVM or Canton stacks.

**Storage reality check.** 5,000/s continuous is 432 million instructions/day and ~157 billion/year. Canada's total annual payments across all rails is on the order of tens of billions (verify; Payments Canada and BoC publish figures). Sustained 5k/s is therefore a **capacity and headroom target**, not a demand forecast; realistic wholesale demand in Phase 3 is likely one to two orders of magnitude lower (verify with volume data from the banks in Phase 0). Design consequences: hot state in NVMe, blocks older than 30 days moved to WORM object storage in Canada, snapshots every 10,000 blocks, pruned validator state with archive nodes run by the operator and the supervisory read-node.

### 6.3 Consensus configuration and latency budget

**Inter-site RTT assumptions (verify by measurement in S6):** intra-metro < 1 ms; Toronto–Ottawa ~ 6 ms; Toronto–Montréal ~ 9–13 ms; Toronto–Calgary ~ 55–60 ms; Montréal–Calgary ~ 60–70 ms.

**Consensus round.** A Tendermint-family round is three message delays (propose, prevote, precommit). Commit needs the 7th-fastest of 10 validators; with the fastest seven in the eastern corridor that is about 3 x 5–8 ms = 15–25 ms of network plus signature verification (~ms), execution (~10–30 ms per 1,500-tx block) and NVMe fsync (0.2–1 ms on-prem, 1–5 ms on network-attached cloud storage). **Uncontended commit ≈ 40–80 ms.**

**Budget for M0 with 250–300 ms blocks (median):**

| Segment | Time |
|---|---|
| Gateway durable ack to proposer (authenticated forward) | 1–10 ms |
| Wait for next block (half the block interval) | ~125–150 ms |
| Consensus + execution + commit | 40–80 ms |
| Finality receipt to gateways and wallets | 5–20 ms |
| **Median accepted-to-final** | **~250–350 ms** |
| **Customer-visible** adds issuer-side screening (20–100 ms), core-independent (TDS-based) balance check, and for M1 proving (p50 150 ms, p99 400 ms) | median ~ 0.5–0.9 s |

**Failure tail.** A dead proposer adds `timeout_propose` (0.8 s) plus another round: about 1.2 s. With interleaved rotation across >= 4 failure domains, k consecutive dead proposers requires k adjacent validators in one domain, which the placement rule prevents. With 3 dead validators (f) the median is unchanged, p90 rises to about 1.3 s and p99 to about 2–3.5 s. Without interleaving, three adjacent dead proposers give 3.6–5 s, so **p99 < 5 s is achievable but marginal without leader suppression.** That is why S1 tests whether known-dead proposers can be skipped; otherwise the engine swap to a leader-reputation protocol is the answer.

**Verdict on latency: <2 s median is comfortable (5–8x headroom).** The p99 < 5 s target holds with interleaved placement and healthy timeouts, and is at risk only under multiple simultaneous validator failures.

### 6.4 Where the targets actually conflict

| # | Conflict | Detail | Recommendation |
|---|---|---|---|
| C1 | **99.999% vs 2 regions under BFT** | 99.999% allows ~5.3 min/year. Under BFT with n=10, f=3, a *region* hosting more than 3 validators takes the network below quorum when it fails. Two regions means at least one holds >= 5 validators. Region loss therefore halts settlement until a **human-authorised, fenced** disaster-recovery reconfiguration (RTO <= 15 min per blueprint), which by itself would use ~3x the annual downtime budget. | Contract SLO **99.99%** (52 min/yr) in Phase 3; treat 99.999% as the design target for AZ, node, bank-validator and single-domain failure only. Meet zero-touch survivability via **D7 placement (>= 4 failure domains, <= f validators each)**, which means *sites*, not just cloud regions: e.g. Toronto-A, Toronto-B on different power grids and carriers, Montréal, Ottawa or Calgary. |
| C2 | **RPO 0 across 2 regions** | Satisfied by construction (every committed block is fsynced by >= 7 validators; any 7 of 10 with <= 3 in each of >= 4 domains span multiple domains). The DR hazard is the *fork after failover* if fenced validators return. | Fencing: on region-loss DR, the remaining set's governance-approved `ValidatorSetReset` carries a new epoch; returning validators' remote-signer high-water marks and chain ID prefix refuse the stale epoch; TLA+ model of the fencing protocol (S6). |
| C3 | **5,000/s vs demand** | See 6.2. | Keep 5,000/s as perf-environment capacity with a 4x headroom rule against measured production peak; gate Phase 3 on the soak plus measured headroom, not on production volume. |
| C4 | **<2 s median vs proving** | Only holds if the blueprint's definition (acceptance to final) excludes proving. With M1, customer-visible latency adds proving time. | Publish both SLIs (accepted-to-final and end-to-end). M1 gate T2 keeps end-to-end < 1 s median. |
| C5 | **p99 < 5 s vs f failures** | See 6.3. | Interleaved rotation; leader suppression or engine swap. |
| C6 | **BFT scale vs more members** | Validators scale poorly past ~13–21 with all-to-all voting; more issuers than 13 would strain the design. | Cap voting set at 13 (validator-set table, section 2.1); further issuers join as T1/T2 participants. |
| C7 | **Instruction volume vs 24/7 core posting** | Legacy cores cannot do 5,000/s. | Solved by the TDS design (D5): the core sees only mint/redeem, an order of magnitude or more below transfer volume (verify with demand data). |

### 6.5 Path to the target, by phase (perf-environment evidence)

| Phase | Config | Target evidence |
|---|---|---|
| 1 | n=4, M0, single issuer | 1,000/s for 72 h; median finality < 1 s; zero par-checker violations |
| 2 | n=7, M1 or M2 | 2,500/s for 4 h; median < 1 s, p99 < 3 s; DR drill with region-loss fencing |
| 3 | n=10, M1 or M2, >= 4 failure domains | 5,000/s for 6 h, 20,000/s burst for 60 s; median < 2 s (expected ~0.5–1 s), p99 < 5 s; tail-latency with 3 killed validators |

---

## 7. Phased engineering plan

Pods (per the blueprint): **Ledger**, **Settlement**, **Compliance**, **Integration/SDK**, **Security & SRE**, **Rulebook**; I add an **Assurance (formal methods and audit)** sub-pod under Security and an **Architecture Office**. Headcounts are central programme staff (operator plus seconded and contracted), with bank-side integration staff counted separately. The blueprint's peak of 120–160 across all participants is consistent with these numbers.

### 7.1 Phase 0: Foundations (Oct–Dec 2026, ~13 weeks)

**Staffing (~26):** Ledger 8 (spike), Settlement 2, Compliance 2, Integration/SDK 4, Security & SRE 4, Assurance 2, Architecture Office 3, Rulebook-technical liaison 1.

**Epics and deliverables**

| Epic | Deliverable | Date |
|---|---|---|
| E0.1 Platform bake-off (S1) | Measured results, decision memo, Plan B/C costings | Kick-off 12 Oct; results 4 Dec |
| E0.2 Invariant Charter and TLA+ spec v1 | P1–P7 in English and TLA+; TLC checks on 4 issuers with crash faults; mint/redeem protocol model | 27 Nov |
| E0.3 Reference architecture and threat model | STRIDE and attack trees against blueprint threats (validator compromise, operator collusion up to f, key exfiltration, contract defect, screening evasion, DoS, supply chain) | 4 Dec |
| E0.4 Core-banking discovery, 7 banks | Questionnaire and workshops: core vendor/in-house, batch windows, 24/7 posting capability, MQ, ISO 8583 host, DR RPO/RTO, HSM inventory, change-freeze calendar, volume data | 20 Nov |
| E0.5 Settlement anchor and token-model design paper | A1/A2 options, Model X vs Y, LSM concept; with Legal and BoC | 4 Dec |
| E0.6 Spike programme S2, S5, S7 started; environments (dev/test) and CI skeleton | Repo, Bazel skeleton, determinism gate | 18 Dec |
| E0.7 Procurement RFPs | External formal-methods firm, audit firms (2 security, 2 cryptography), HSM vendor, WAN carriers | Issued 30 Oct |
| E0.8 Hiring and secondment plan | Named seconded engineers per bank; recruiting pipeline | 30 Oct |

**Exit tests (measurable):** (1) S1 decision taken at ARB 11 Dec against pre-agreed thresholds; (2) TLC completes with no invariant violation on the 4-issuer crash-fault model; (3) seven bank discovery packs received and F7 (core-DR RPO) surveyed for all seven; (4) leakage-budget table (3.1) ratified by Legal; (5) Phase 1 staffing >= 70% committed (offers accepted or secondment letters signed); (6) architecture and invariants ratified by all founding issuers.

**Schedule risk.** Ratification by all founding issuers by end-December depends on governance, not engineering; a 4–8 week slip is plausible. Mitigation: platform-independent Phase 1 work (spec, adapter, gateway, ISO mapper, SDK) starts at risk on 11 Jan 2027 regardless.

### 7.2 Phase 1: Sandbox testnet (Jan–Jun 2027)

**Staffing (~62 central + ~10 bank-side for 2 pilot banks):** Ledger 14, Settlement 8, Compliance 6, Integration/SDK 12, Security & SRE 10, Assurance 5, Architecture/QA/PMO 7.

**Epics**

| Epic | Deliverable | Date |
|---|---|---|
| E1.1 Kernel v0.1 | Mint/Redeem/Transfer/Convert, par checker P1–P7, halt states, 4-node devnet | 26 Feb |
| E1.2 Settlement | T1–T3 (Transfer, Convert, DvP), SP model, anchor-gateway mock | 31 Mar |
| E1.3 Compliance MVP | H1–H4 hooks, receipt issuer and verification, block-list | 30 Apr |
| E1.4 Adapter and ISO 20022 | Adapter SPI, core emulator, live integration vs pilot bank #1 pre-prod, pain.001, pacs.008/.002, camt.054/.053 | 30 Apr |
| E1.5 Confidentiality | S3 (M1 benchmark) and S4 (M2 prototype), G1.2 decision | Results 31 Mar; decision 14 May |
| E1.6 Verification | S2 Verus spike (6 weeks); TLA+ models for mint/redeem and settlement; Lean reference model started | Verdict 26 Feb |
| E1.7 Gateway, SDK (TS, JVM), TDS v0 | Sandbox for pilot banks | 31 May |
| E1.8 Environments and SRE | test and perf environments; chaos harness; remote signer and HSM integration | 30 Apr |
| E1.9 Closed pilot | 2 banks + BoC observer node on testnet with synthetic data | Live 11 Jun |
| E1.10 PFMI gap assessment and remediation plan | With the Rulebook pod | 30 Jun |

**Exit tests.**

1. *Par:* >= **100 million** randomised and adversarial simulated instructions with the par checker enabled, **zero** violations, plus a **72-hour soak at 1,000/s**. (The blueprint's 10,000 transfers finish in about two seconds at target rate and prove nothing; I retain them as a smoke test only.)
2. *Halt:* 100 of 100 injected par breaks (over-issuance, corrupted supply, forged attestation, anchor mismatch) halt or quarantine in the same block; 0 false halts in the soak.
3. *Determinism:* 10M-transaction corpus produces identical state roots on x86_64 and aarch64 builds.
4. *Adapter:* 10,000 mint/redeem cycles against the core emulator and 1,000 against the pilot bank's pre-production core with fault injection; the reconciler detects 100% of injected breaks with 0 false halts.
5. *Confidentiality:* G1.2 executed against the S3/S4 pass/fail tables; mode selected with the numbers attached.
6. *ISO 20022:* golden-file suite passes for all mapped messages; round-trip lossless for the mandatory field set.
7. *Closed pilot:* 2 banks and the BoC observer operate nodes for 14 days; the observer's independent reconciler agrees with the operator's on all attestations.
8. *PFMI gap assessment* delivered with a dated remediation plan.

**Schedule verdict.** Achievable if staffing is >= 55 by 11 Jan and pilot-bank pre-production access lands by 1 March. Single-issuer testnet with par, DvP, adapter, ISO mapping and a confidentiality decision in 6 months is aggressive but not unreasonable given the pre-work in Phase 0; the ZK benchmark timing is tight and is why M2 is designed already.

### 7.3 Phase 2: Regulated pilot, wholesale (Jul 2027–Jun 2028)

**Staffing (~98 central + ~40 bank-side):** Ledger 18, Settlement 12, Compliance 10, Integration/SDK 20, Security & SRE 18, Assurance 8, Architecture/QA/PMO 12.

**Sub-phasing (mine, not the blueprint's).**

- **2A (Jul–Nov 2027):** multi-issuer (4 issuers) on the certification environment; T4–T7; selected confidentiality mode hardened; kernel v1.0-rc code freeze **31 Aug 2027**; security audit #1 and cryptography review (10 weeks, Sep–Nov); SOC 2 Type I readiness; bug bounty preparation; banks 3–7 begin T2/T3 work (Q3).
- **2B (Dec 2027–Jun 2028):** capped live issuance starts only after all critical and high audit findings are closed and supervisors have no objection, so realistically mid-Dec 2027 or Jan 2028 (year-end bank change freezes may push it to late January; verify each bank's calendar). Travel Rule production; proofs published (Q1); DR drill (Q1); cap raised in steps under supervisory non-objection; bug bounty live from Dec.

**Epics.** Multi-issuer network and validator onboarding; live mint/redeem against real cores; Travel Rule exchange in production; template library governance operating; formal verification programme (P1–P7 Verus proofs, TLA+ models for T4–T7, Lean differential harness); SOC 2 Type I; external audit and remediation; bug bounty (public platform choice, verify Canadian-resident options); observer and supervisory read-node in production form; DR and chaos drills; performance to 2,500/s; conformance suite v1 and certification programme live; PFMI remediation.

**Exit tests.**

1. Audit: no open critical or high findings; two independent audit reports (kernel and cryptography or protocol) published in summary.
2. **Proofs:** all Verus obligations and TLA+ properties for P1, P3, P5, P6, P7 and dedup machine-checked in CI, with proof artefacts and the assumptions list published. (Scoped as in 4.6; if S2 failed, "specified and model-checked" language applies.)
3. Value cap lifted by supervisory non-objection (external; not under engineering control).
4. **DR drill:** region-loss scenario in the certification environment, RTO <= 15 min, RPO = 0, with the fencing protocol demonstrated (no second chain), plus zero-touch survival of an AZ loss and of a single-issuer validator loss with no settlement interruption > 5 s.
5. Performance: 2,500/s for 4 h, median finality < 1 s, p99 < 3 s, on n=7 with WAN emulation.
6. 30-day live-pilot record: zero par breaks, zero client-money loss events, zero false halts.
7. SOC 2 Type I report issued for the operator.
8. Bug bounty live for >= 60 days with a published triage SLA.
9. Certification: at least 4 issuers certified at T3 or T2.

### 7.4 Phase 3: Production, wholesale (Jul–Dec 2028)

**Staffing (~105 central + ~50 bank-side; operator run team ramping to 40–60):** Ledger 18, Settlement 14, Compliance 10, Integration/SDK 18, Security & SRE 26, Assurance 6, Architecture/QA/PMO 13.

**Epics and dates.** Wave C onboarding (banks 5–7) complete by 30 Sep; n=10 validator set live by 30 Sep; perf-environment certification of 5,000/s (Aug); LSM/NetCycle go-live (Oct) after replay validation (S8); tokenised-bond cash-leg integration (Nov), first as conditional DvP via CSD attestation; production 24/7 operating model (follow-the-sun not required, but an on-call structure with a 24/7 operator NOC); SOC 2 Type II observation period begins no later than the Phase 2 exit (Type I done); full PFMI observance assessment begins; quarterly chaos and DR drills; PQ readiness study started.

**Exit tests.**

1. Perf-environment **Table 2 certification**: 5,000/s sustained 6 h, burst 20,000/s for 60 s, median < 2 s, p99 < 5 s with 3 validators killed mid-run; zero invariant violations.
2. All founding issuers live and certified at T3; >= 95% of eligible wholesale interbank flow *settle-able* on DepositX (capability, not adoption).
3. Supervisory query < 60 s on >= 1B-record production-scale data.
4. Availability measured against the re-baselined SLO (99.99%) over the first 90 days; the 99.999% design target validated for single-fault scenarios in drills.
5. LSM: demonstrated liquidity saving on replayed anonymised Lynx data (target >= 30%, verify), zero atomicity violations in 10M queued instructions.
6. Quarterly DR drill passed at RTO <= 15 min / RPO 0.
7. Independent PFMI self-assessment complete and submitted for observance rating (the rating itself is external).

### 7.5 Phase 4: Scale and retail (2029+), sketch only

Retail wallets with passkey-signed CAOs; consumer programmable payments; PvP corridors (design section 2.4 caveat); Real-Time Rail interoperability; PQ migration (ML-DSA hybrid on all validators; the `suite_id` mechanism makes this a governed rollout); throughput re-baselining to retail volumes (likely the first phase where 5k/s sustained is a real demand number). I would revisit M1 in this phase if it was deferred.

### 7.6 Reconciliation against the blueprint's dates: what is compressed, what is impossible

| Blueprint item | Verdict | Detail |
|---|---|---|
| Phase 0 exit by Dec 2026 | **Technically feasible, governance-risky** | Engineering deliverables fit 13 weeks only if the bake-off starts 12 Oct. Operator incorporation and regulator confirmations are outside my control; a 4–8 week slip in ratification is plausible. |
| Phase 1 by Jun 2027 | **Feasible with compression** | Needs >= 55 engineers by January (secondments, contractors); pilot-bank pre-production access by March; "10,000 transfers" replaced by the stronger exit test above. |
| Phase 2 (12 months) | **Feasible, no float** | Critical path: kernel freeze (Aug) -> audit (Sep–Nov) -> live issuance (Dec–Jan) -> non-objection -> cap lift. "Formal verification of par and settlement contracts" is achievable for the four primitives and P1–P7; full code-level proofs for all templates are not. |
| Phase 3 "all founding issuers live, H2 2028" | **Feasible only if banks 3–7 start in Q3 2027** | Large-bank T3 lead time is 12–15 months (verify); waiting for Phase 2 exit to start is too late. |
| Phase 3 exit "99.999% sustained over two quarters" | **Impossible in-phase** (blueprint Known issue confirmed) | Go-live is inside H2 2028; two quarters of measurement cannot finish before 2029. Also arithmetically incompatible with region loss (C1). |
| Phase 3 "SOC 2 Type II" | **Not deliverable in H2 2028 realistically** | Type II needs an observation period (typically 3–12 months; verify auditor requirements); with Type I in Q2 2028, a 6-month window ending Q4 2028 produces the report in Q1 2029. |
| Phase 3 "independent PFMI observance rating" | **Not deliverable in-phase** | Needs operating history. |
| Phase 3 "Table 2 targets met under load" | Feasible in the perf environment | Production-load evidence follows volume. |

**Recommendation:** keep Phase 3 go-live dates; add **Phase 3b (Q1–Q2 2029)** as the home for: two-quarter availability evidence (at the re-baselined SLO), SOC 2 Type II report, independent PFMI rating, and production-load throughput evidence. This is a schedule *honesty* change, not a slip in delivery.

---

## 8. Top 10 technical risks, mitigations and retiring spikes

| # | Risk | Severity | Mitigation | Spike / proof that retires it |
|---|---|---|---|---|
| **R1** | **Par-kernel defect or specification gap** (a bug or a missing invariant causes a par break or an unhalted over-issuance) | Critical | Small kernel; P1–P7 in TLA+, Verus and Lean; graded halt at consensus level; N-version differential fuzzing; external audit; mutation testing; Lean reference | **S2:** Verus proofs of P1/P3 for `apply_transfer` and `apply_convert` in 6 weeks (proof:code <= ~15:1). **S2b:** 100 million adversarial simulated instructions with zero violations before Phase 1 exit. Fallback if Verus fails: Kani + TLA+ + Lean + audit |
| **R2** | **Bespoke-platform execution, key-person dependence and bank model-risk acceptance** | High | Small TCB; open-source under the consortium's neutral foundation with escrow; a second implementation of the kernel (Lean); hire-and-secondment plan; Plan B (Besu) and Plan C (Canton) priced | **S1:** platform bake-off with thresholds (section 1.3) and a hiring-market probe. Retired by the 11 Dec decision |
| **R3** | **Confidentiality layer fails performance or cryptographic assurance (ZK), or leaks more than the leakage budget allows** | High | M1 not on critical path; M2 fully designed; two independent cryptography reviews; leakage budget ratified first | **S3:** M1 benchmark T1–T8. **S4:** M2 prototype and thresholds (3.4). Gate G1.2 on 14 May 2027 |
| **R4** | **Legacy core cannot support 24/7 hold/posting, or bank core DR (RPO > 0) makes the control GL fall behind the ledger and halts the network (F7)** | High | TDS design; stand-in posting; ISO 8583 hold path; outbox outside core RPO; `CORE_LAG` classification and Core-Loss Recovery Mode; Phase 0 survey of all seven cores | **S5:** Reference Core Emulator with chaos scenarios (kill core mid-mint, restore from backup with RPO > 0, batch-window replay); target 100% detection, 0 false global halts across 1,000 fault runs; then repeat against pilot bank #1 pre-production |
| **R5** | **Consensus non-determinism or state divergence; unsafe upgrades** | High | Deterministic-execution rules; no floats, wall-clock or map iteration; cross-architecture replay in CI; height-gated activation; N/N-1 compatibility; reproducible builds | **S7:** 10M-tx corpus on x86_64 and aarch64, byte-identical roots, on every commit; one rehearsed live upgrade in the perf environment with zero divergence |
| **R6** | **Region and site failure, DR fork, and availability arithmetic (99.999% vs BFT quorum); DoS on consensus or gateway** | High | D7 placement rule; interleaved rotation; fenced `ValidatorSetReset`; SLO re-baselined; sentry architecture; gateway rate limiting and priority classes; admission control bounding backlog | **S6:** three-site perf run with `tc netem`, kill a whole domain and 3 validators; measure p99, RTO, no-fork; TLA+ model of the fencing protocol; load test at 25k/s with gateway overload |
| **R7** | **Settlement anchor and prefunding: BoC/Lynx participation unconfirmed; weekend liquidity; liquidity fragmentation** | High | `SettlementAsset` abstraction supports A1 or A2; LSM; buffer policies; rulebook liquidity facility | **S8:** liquidity simulation on replayed anonymised Lynx data (verify data access), including weekend stress; outcome sizes the required prefunding and the LSM saving |
| **R8** | **Supply-chain compromise of a build or dependency** | High | Reproducible two-party builds; SLSA L3; vendored, vetted dependencies; private signing root; two-person review for kernel and crypto | **S10:** independent rebuild by a second party, hashes match, on every release candidate from Phase 1; red-team exercise attempting to inject a malicious dependency in the perf pipeline |
| **R9** | **Key management: HSM residency and throughput, ceremony error, double-signing, governance-key loss** | High | HSM per bank in Canada; remote signer with high-water mark; ledger-native m-of-n governance over HSM keys; rehearsed break-glass; quarterly attested ceremonies | **S9:** HSM and remote-signer throughput and failover at 8+ signs/s per validator with forced failover; full ceremony dry-run including a lost-key recovery; double-sign injection test proves refusal |
| **R10** | **Talent and schedule: hiring at scale, seven large-bank integrations in parallel, year-end change freezes** | High | Secondment commitments from each bank in Phase 0; tiered onboarding; Integration/SDK embedded engineers; conformance suite reducing bespoke testing; wave plan starting banks 3–7 in Q3 2027 | **Leading indicators, not a spike:** by 11 Jan 2027 >= 55 engineers on payroll or secondment; by 30 Jun 2027 the conformance suite executed end-to-end by 2 banks; by 30 Sep 2027 banks 3–4 in certification stage 2. Failure of any indicator triggers a scope cut (drop templates T5–T7 to Phase 3) rather than a date slip |

Additional risks tracked but not top 10: sanctions evasion through confidentiality (residual, covered by signed receipts and supervisory sampling, 2.8); cryptographic obsolescence (crypto-agility via `suite_id`, PQ in Phase 4); template oracle manipulation (registered oracles, quorum, caps).

---

## 9. Spike programme summary

| ID | Spike | Duration | Decision it drives | Kill/pass |
|---|---|---|---|---|
| S1 | Platform bake-off (custom vs Canton vs Besu) | 10 wks, 12 Oct–18 Dec 2026 | D1/D2 | Section 1.3 |
| S2 | Verus proof of P1/P3 on `apply_transfer`/`apply_convert` | 6 wks | Verification approach and Phase 2 exit wording | Proof:code <= 15:1 |
| S3 | M1 (committed amounts) benchmark | Jan–Mar 2027 | G1.2 | Table 3.3 |
| S4 | M2 (issuer domains) prototype and benchmark | Jan–Apr 2027 | G1.2 | Section 3.4 |
| S5 | Core emulator and reconciliation chaos | Nov 2026–Apr 2027 | Adapter design; R4 | 100% detection, 0 false halts |
| S6 | Three-site WAN, leader failure, DR fencing | Nov 2026–Mar 2027 | Consensus configuration; C1/C2/C5 | p99 < 3 s with 1 dead; no fork |
| S7 | Cross-architecture determinism | Continuous from Oct 2026 | R5 | Byte-identical roots |
| S8 | Anchor liquidity and LSM simulation on replayed Lynx data | Jan–Apr 2027 (data access permitting) | Settlement-position design; R7 | >= 30% saving target; weekend stress sizing |
| S9 | HSM, remote signer, ceremony dry-run | Nov 2026–Feb 2027 | Key architecture | Refuses double sign; failover < 2 s |
| S10 | Two-party reproducible-build | From first release candidate | Release process | Hash match |

---

## 10. Verify list (consolidated) and open questions

**Facts and tooling I could not confirm from here (verify before relying on any of them):**

1. Current CometBFT version, `next_block_delay` naming, stewardship and funding; Malachite production status; its use in Circle Arc.
2. Canton/Daml licence split (open vs enterprise features), BFT sequencer maturity, single-synchronizer throughput, source-escrow options.
3. Besu QBFT block-period floor, sequential EVM throughput in practice, current state of privacy features (Tessera deprecation).
4. Fabric 3.x SmartBFT ordering maturity; Corda 4/5 licensing.
5. Aptos/Move licence and permissioned-fork feasibility.
6. Verus, Kani and Lean suitability and effort at our scale; availability of external formal-methods firms.
7. Bulletproofs+-class library maintenance and audit history; range-proof and verification timings; history of ZK-library vulnerabilities in production systems.
8. HSM support for the chosen signature suites and for remote-signer double-sign protection in Canadian deployments; Ed25519 support in FIPS-validated modules.
9. Inter-site latency figures for Toronto, Montréal, Ottawa, Calgary.
10. Canadian volumes: total annual payment volume, Lynx volumes and hours, RTR timing; wholesale demand forecast.
11. Lynx and Payments Canada ISO 20022 usage guidelines and versions; ISO 20022 reason-code list; CDS ISO 20022 readiness and interface.
12. OSFI B-10, B-13, E-21 current status and effective dates; CDIC single-customer-view data format; FINTRAC obligations for domestic deposit-token transfers; PCSA designation as the legal basis for finality (Legal's question, flagged).
13. Each bank's core vendor or in-house stack, 24/7 posting capability, mainframe replication mode and RPO, MQ estate, ISO 8583 host capabilities, and year-end change freeze dates.
14. SOC 2 Type II observation-period requirements for a new operator; availability of Canadian cryptography-audit capacity in the required window.
15. Availability and licensing of a Canadian-resident public bug-bounty platform.

**Open questions for the board:** the neutral validator seat (who); whether the BoC will ever want a voting seat; the leakage budget; Model X vs Model Y; A1 vs A2 anchor; who owns the reference adapter's long-term maintenance (operator or a bank consortium); whether the founders accept a 99.99% contractual SLO and a Phase 3b.

---

## 11. Immediate actions (next 30 days)

1. Approve S1 funding and the 12 Oct kick-off; name the spike lead and the bank secondees.
2. Issue the seven-bank core-banking discovery questionnaire (E0.4) and the RFPs (E0.7).
3. Commission Legal on the leakage budget, the anchor (A1/A2), token Model X vs Y, the queued-instruction wording and the graded-halt wording.
4. Start the Invariant Charter and TLA+ specification; freeze P1–P7 wording by 27 Nov.
5. Request pre-production core access from pilot bank #1 (long lead time).
6. Open recruiting for Rust/BFT, formal-methods and HSM/SRE roles; agree secondment commitments in writing from each founding bank.
