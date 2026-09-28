# DepositX Network — Blueprint v0.9 (source of truth for the board)

Prepared by KPMG Financial Services Advisory for the Canadian Tokenized Deposit Working Group.
Version 0.9 · 2 September 2026 · Illustrative — draft for discussion.
Tagline: A settlement network for tokenized commercial-bank deposits — Canada.

Premise: Commercial-bank money should move with the speed, programmability and finality of the internet — without leaving the regulated perimeter, and without ever breaking par. DepositX is a proposed shared, permissioned network on which Canada's deposit-taking institutions issue **deposit tokens**: on-ledger claims against a specific OSFI-regulated bank, redeemable 1:1, CDIC-insurable wherever the underlying deposit is. NOT a stablecoin, NOT a CBDC, NOT a new unit of account.

## 01 Vision
Problem: treasurers wait for cut-offs; suppliers can't be paid on goods scan; tokenized bond cash legs settle T+1 or via unsupervised bridges; stablecoins offer speed outside the deposit franchise. Answer: make bank money itself move like data — settling continuously, carrying conditions, reconciling itself — while remaining a supervised deposit at every moment.

Deposit token = bearer-recorded claim on a named deposit-taking institution, CAD, always redeemed at par. Representation of an existing liability, not a new one. Each issuer's token supply reconciles continuously to its backing deposit liabilities.
- Not a stablecoin: no reserve pool, no separate issuer credit, no backing ratio.
- Not a CBDC: central-bank money is the settlement anchor between issuers, not the customer instrument.
- Not an MMF / e-money wrapper: no maturity transformation, no float held by intermediary, no new custodian.
- Insurance-transparent: CDIC eligibility unchanged; token records which institution owes.

Three invariants (every design decision subordinate; a feature that weakens one is cut):
- I. Par, always. 1 token-dollar = $1 of issuer deposits on redemption and in every interbank transfer. Par break = system-halting event.
- II. Finality is one thing. Technical and legal settlement in the same instant.
- III. Inside the perimeter. Issuance, custody, redemption stay with regulated institutions. Operator never holds client money, never becomes a bank.

By party: Corporate treasurer (24/7 sweeps, supplier payments, sub-2s finality, conditional payments). Retail (later phases; instant any-bank transfers, same deposit protection). Issuing bank (deposit stays on balance sheet; co-governs a programmable rail vs ceding fast payments to non-bank issuers). Regulator (supervisory read-node answers "where is this money, who owes it" <1 min; controls enforced at point of transfer).

Non-goals: public permissionless chain or non-regulated validators; single mutualised consortium coin; arbitrary user-deployed smart contracts (reviewed template library only); displacing Lynx or the Real-Time Rail (interoperate/run alongside).

North-star metrics: zero par breaks and zero client-money loss events cumulative; finality <2s median, <5s p99; by end of Phase 3 ≥95% of eligible wholesale interbank flow settle-able on DepositX 24/7/365; any supervisory position query <60s from read-node.

## 02 Architecture
Principles: one network, many issuers (shared ledger, per-issuer token contracts, one liquidity space, no bridges). Regulated operator (consortium-owned entity, published rulebook, direct supervisory oversight). Boring cryptography (BFT consensus, HSM keys, audited contracts; novelty confined to optional confidentiality layer). Privacy by default, disclosure by design. Standards first (ISO 20022 end to end; PFMI baseline; one reference core-banking adapter).

Layers (L2 and L3 = where invariants live, highest assurance):
- L0 Governance & legal: consortium rulebook, operator entity, membership/admission, legal basis for finality, regulatory reporting.
- L1 Network & consensus: permissioned validators = each issuer + operator + Bank of Canada observer node. BFT with deterministic instant finality; no probabilistic reversal.
- L2 Ledger & assets: per-issuer deposit-token contracts over unified balance model; par-enforcement module; continuous supply-to-liabilities reconciliation.
- L3 Settlement services: atomic DvP and PvP; conditional/programmable payments from reviewed template library; liquidity-saving netting; 24/7 issuance and redemption.
- L4 Compliance engine: identity/KYC attestations; sanctions/watchlist screening at mint/transfer/redeem; Travel Rule messaging; limit and velocity controls; FINTRAC reporting hooks.
- L5 Access & integration: institutional API gateway; ISO 20022 adapter into core banking; wallet SDK; bank-hosted custody. No direct network access for end customers.
Cross-cutting: Key management (HSM-resident issuer keys; m-of-n MPC for operator actions; quarterly attested ceremonies). Privacy (ZK confidential balances; need-to-know disclosure; supervisory read-node). Observability & assurance (signed audit log, reproducible builds, SBOM, continuous PFMI self-assessment). Resilience (active-active across 3 Canadian AZs and 2 regions; RPO zero).

Settlement flow: Payer (bank-hosted wallet) → Issuer A node (validator + core banking) → [1 Screen: sanctions/limits/Travel Rule → 2 Atomic swap: debit A, credit B at par, all-or-nothing → 3 Finality: legal + technical same instant] inside BFT consensus (issuers + operator + BoC observer) → Issuer B node → Payee. Nothing debited until all three checkpoints pass. Failure = reject whole; no partial/pending state.

Load-bearing decisions (decision / rationale / rejected alternative):
- Network: one permissioned network, multi-issuer shared ledger / single liquidity pool, one compliance surface, no bridge risk / per-bank chains + bridges.
- Consensus: BFT deterministic instant finality; validators = issuers + operator + BoC observer / finality mappable to legal finality / public PoS.
- Asset model: token = named liability of one issuer; fungible at par via settlement, never pooled / preserves balance sheets and CDIC attribution / single consortium coin.
- Custody: bank-hosted wallets; funds never leave issuing bank; operator holds none / no new systemic custodian / operator omnibus wallet.
- Privacy: confidential balances/amounts (ZK); counterparty & compliance data need-to-know; supervisory read-node / confidentiality with supervisability / fully transparent or fully private.
- Standards: ISO 20022 end to end; PFMI baseline / regulator familiarity / bespoke schema.
- Programmability: reviewed template library (DvP, escrow, payment-on-event) / auditable paths, bounded attack surface / open Turing-complete contracts.

Non-functional targets (production, Phase 3): sustained ≥5,000 instr/s (burst ≥20,000/s); finality <2s median, <5s p99 (instruction-accepted to consensus-final); availability 99.999% (≤~5 min/yr, 24/7/365, no maintenance windows); RTO <15 min / RPO 0 (sync replication ≥3 Canadian AZs, 2 regions); data residency Canada (ledger, keys, backups); crypto-agility (pluggable signatures, PQ migration Phase 4); key ceremony m-of-n MPC quarterly, HSM-backed, independently attested, break-glass rehearsed.

Threats: single issuer validator compromise; malicious operator insider or collusion of up to f validators; key exfiltration; defect in par/settlement contract; sanctions/Travel Rule evasion via confidentiality layer; availability attack on consensus/API gateway; supply-chain compromise of a build.
Controls: HSM keys, MPC for operator/governance actions, no single-party authority; formal verification of par and settlement contracts, reproducible builds, published SBOM; screening at mint/transfer/redeem; rate/velocity limits + anomaly detection; supervisory read-node with standing access, signed tamper-evident audit log; independent security audit each phase, public bug bounty from Phase 2, quarterly chaos & DR drills.
Data: on-ledger = confidential balances, transfer validity proofs, issuer supply commitments, contract state. Off-ledger (held by issuing bank, referenced by attestation) = identity data, KYC evidence, full transaction narrative. Supervisory read-node scoped to mandate; queries logged. All in Canada incl. DR copies.

## 03 Brand (summary)
"The clearing house, re-issued" — a standard, not a product. Logomark: two equal bars (par sign) in rounded enclosure; bars are the only accent-coloured element. Palette: Vault Ink #101823, Slate #41505F, Paper #EEF0F2, Minted Brass #A8792C (accent only), Evergreen #2F7D5D, Ochre #8A6410, Oxide #A23A2E, Hairline #D6DBE1. Type: Newsreader (display), Libre Franklin (body), IBM Plex Mono (data). Voice: plain, precise, cited. Say "settles in under two seconds with legal finality", "designed against OSFI and PFMI expectations", "the network/the standard/the rulebook". Don't say "lightning-fast", "new digital currency/stablecoin", "fully compliant/regulator-approved", "platform/product/app", "revolutionary/disruptive/trustless".

## 04 Roadmap (as drafted by KPMG — the board is to replace this with an executable plan)
- Phase 0 Foundations, Q4 2026: form consortium + operator entity; rulebook v0, admission criteria; joint pre-consultation with OSFI, BoC, FINTRAC; reference architecture sign-off, threat model. Exit: operator incorporated w/ neutral chair; regulators confirm consultation pathway; architecture + invariants ratified by all founding issuers.
- Phase 1 Sandbox testnet, H1 2027: single-issuer testnet; par module + atomic DvP; compliance engine MVP; ISO 20022 adapter vs one core-banking stack; benchmark confidentiality layer; closed pilot 2 banks + BoC observer. Exit: 10,000 simulated transfers zero par breaks; PFMI gap assessment + remediation plan; ZK perf meets target or fallback chosen.
- Phase 2 Regulated pilot — wholesale, H2 2027–H1 2028: multi-issuer, wholesale-only, capped value; live issuance/redemption; Travel Rule in production; formal verification of par + settlement contracts; SOC 2 Type I; first external audit; bug bounty. Exit: clean audit, proofs published; value cap lifted by supervisory non-objection; DR drill RTO<15min RPO 0.
- Phase 3 Production — wholesale, H2 2028: all founding issuers live; 24/7/365; liquidity-saving netting; tokenized-bond cash-leg integration; SOC 2 Type II; full PFMI observance assessment; Table 2 targets met under load. Exit: 99.999% availability sustained over two quarters; supervisory queries <60s; independent PFMI observance rating.
- Phase 4 Scale & retail, 2029+: retail deposit tokens; programmable consumer payments; cross-border PvP corridors with peer deposit-token networks; interoperability with Real-Time Rail; PQ migration. Exit: retail launch with unchanged deposit-insurance treatment confirmed; ≥1 live cross-border corridor; PQ signatures on all validators.
Workstreams: Platform & ledger; Settlement & programmability; Compliance & identity; Legal/governance/regulatory; Integration & assurance.
Programme risks: High — regulatory perimeter / CDIC treatment unsettled; High — governance deadlock among competing issuers; Med — liquidity fragmentation vs Lynx/RTR; Med — confidentiality-layer performance at throughput; Med — core-banking integration cost/timeline per bank; Low–Med — cryptographic obsolescence.
Team/investment (indicative): 6 delivery pods (Ledger, Settlement, Compliance, Integration/SDK, Security & SRE, Rulebook); peak build team 120–160 across all participants Phases 1–3; operator run team 40–60 steady state; programme cost to Phase 3 "9 figures" CAD shared across participants over ~3 years.

## Known issues in the source draft (the board should resolve, not ignore)
- Document title says "four-phase" roadmap but defines five phases (0–4).
- Phase 3 exit requires 99.999% availability "sustained over two quarters" but Phase 3 is only H2 2028 and production go-live is itself in that window — the exit criterion cannot be met inside the phase as dated.
- Bank of Canada as a validator/observer node is assumed, not confirmed.
- "Legal finality = technical finality" is asserted; the legal basis (e.g. designation/oversight regime, rulebook, insolvency protections) is not specified.
- ZK confidentiality + formal verification + BFT at 5,000 tps sustained is the schedule's largest technical bet; a fallback is named but not designed.
- Cost is "9 figures" CAD with no breakdown, funding model, or operator revenue model.
- No onboarding model for large banks (integration tiers, certification, legacy core-banking realities, third-party-risk requirements) — the board's central job.
- **Added by the operator, not KPMG's original draft:** L5's "No direct network access for end customers" quietly assumes the counterparty acting through a bank's wallet/API is always a human. It says nothing about a bank's own treasury software agent initiating instructions under that bank's existing keys and authority — a real, near-term case (24/7 automated sweeps are already in the use-case ladder), not a hypothetical. This doesn't require a new access class or weakening the perimeter; it requires the compliance/screening and audit-trail model to explicitly say whether an agent-initiated instruction is treated identically to a human-initiated one under the same institutional key. Flagged as an open technical/legal question in `02` §10 and the CTO/Legal/CISO seat memos, not resolved here.
