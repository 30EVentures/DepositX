# Board Seat Memo: CISO and Head of Site Reliability

**DepositX Network, founding board**
**Seat:** Chief Information Security Officer and Head of SRE
**Date:** 25 September 2026
**Source:** Blueprint v0.9 (2 September 2026), including its "Known issues" list
**Status:** Recommendation for board ratification. Nothing here has been approved by anyone yet.

**Reading conventions**
- "(verify)" means I am working from memory or engineering judgement and the item must be checked before anyone relies on it.
- "(verify with counsel)" marks a regulatory, legal or contractual citation or interpretation that a lawyer must confirm.
- Numbers labelled "estimate" are my planning figures, not measurements. Phase 1 benchmarks should replace them.
- Blueprint threat classes are labelled B1 to B7 in the order the blueprint lists them:
  - B1: single issuer validator compromise
  - B2: malicious operator insider, or collusion of up to f validators
  - B3: key exfiltration
  - B4: defect in par or settlement contract
  - B5: sanctions or Travel Rule evasion via the confidentiality layer
  - B6: availability attack on consensus or API gateway
  - B7: supply-chain compromise of a build
- Threat classes I am adding are labelled X1 to X9 (see section 2.2).

---

## 0. Executive position and decisions requested

### 0.1 Verdicts on the blueprint

1. **The security architecture in the blueprint is directionally right but under-specified where the risk is concentrated.**
   - The concentration points are issuer-side endpoints, the confidentiality layer, governance keys, and the supervisory read path.
   - The blueprint spends most of its security text on validators and HSMs. Recent large payment-system compromises (SWIFT-connected endpoint attacks, 2016 onward) hit the member endpoint, not the core network.
   - DepositX therefore needs a mandatory **DepositX Customer Security Programme (CSP)** for members, modelled on the SWIFT CSP. It should be a condition of membership.

2. **The 99.999% availability target is an engineering design target. It is not a credible contractual commitment on day one.**
   - 99.999% allows about 5.26 minutes of downtime per year.
   - The blueprint's own RTO of 15 minutes is roughly three times that annual budget.
   - Section 4 shows what the design can honestly promise. I recommend a ladder: 99.9% in the pilot, a 99.99% contractual SLA at go-live, and 99.999% as the measured design objective, proven only after go-live.

3. **The Phase 3 exit "99.999% sustained over two quarters" cannot be met inside H2 2028.**
   - Even if the last founding issuer went live on 1 October 2028, the two-quarter window would close on 31 March 2029.
   - Realistically the window closes between April and June 2029.
   - I recommend splitting the exit into a Phase 3 gate (end 2028) and a Phase 4 entry gate (mid 2029). See section 6.

4. **The failure doctrine should be fail-stop.**
   - Above f failures the network halts. It does not degrade into any mode that accepts value-moving instructions without a full quorum.
   - Reads and supervisory queries continue in a halted state.
   - Banks need pre-rehearsed fallback playbooks, because DepositX has no bridge to another rail by design.

5. **"MPC for operator actions" should be layered, not adopted wholesale.**
   - Governance and value-adjacent actions should use **on-ledger multi-signature across independent organisations**.
   - Threshold-signature MPC belongs only where a single logical key must exist.
   - Reasons: MPC is hard to audit, has a record of implementation vulnerabilities, and is generally not FIPS 140-3 validated (verify per vendor).
   - HSMs must be validated to FIPS 140-3 Level 3. The old FIPS 140-2 certificates went to the CMVP historical list around 21 September 2026 (verify), so procurement must target 140-3.

6. **The 60-second supervisory query claim holds only for on-ledger facts.**
   - Identity and beneficial-owner resolution lives off-ledger at issuing banks.
   - We must redefine the claim into query classes with separate SLOs. Section 5.2 does this.

7. **Some blueprint items need reframing:**
   - **Quarterly key generation ceremonies.** Each ceremony is itself an attack surface. Keep quarterly ceremony *cadence*, but limit routine key regeneration to operational keys. Root keys should live for years.
   - **Confidentiality-layer cryptography.** It faces "harvest now, decrypt later" risk today, so PQ-hybrid encryption cannot wait for Phase 4.
   - **The Phase 1 exit "10,000 simulated transfers, zero par breaks."** This is statistically weak. Zero failures in 10,000 trials only bounds the failure rate at about 0.03% with 95% confidence (rule of three). Use formal verification, property-based testing and differential fuzzing to carry the invariant, not sample counts.

### 0.2 Decisions requested from the board (by 31 October 2026)

| # | Decision | Why now |
|---|---|---|
| D1 | Ratify the validator ladder and fail-stop doctrine (section 2.3) | Fixes governance and consensus design early |
| D2 | Adopt the SLO ladder and re-date the Phase 3 exit (sections 4.1 and 6) | Bank contract terms will cite it |
| D3 | Make the DepositX CSP a membership condition | Largest single risk reduction per dollar |
| D4 | Adopt independence rules for dev, audit and formal verification (section 3.3) | Cheap now, impossible to retrofit |
| D5 | Adopt hosting principles: two independent infrastructure providers, Canadian-controlled key custody, no single hyperscaler control plane (section 4.2) | Drives procurement and bank third-party-risk acceptance |
| D6 | Authorise HSM procurement and vendor shortlist in Q4 2026 | Lead times (verify: often 8 to 16 weeks) sit on the critical path |
| D7 | Fund a CISO-designate and SRE lead hire by 31 December 2026 | Board seats cannot run a security programme |
| D8 | Instruct counsel to answer the open legal questions in section 3.5 | Several security designs depend on the answers |

---

## 1. Security architecture

### 1.1 Trust zones and segmentation

**Principles**
- Default deny between all zones.
- The operator holds no administrative credential inside any member's domain.
- No zone trusts the network location of a peer. Every connection is mutually authenticated (mTLS with HSM-bound keys, or message-level signatures).
- Consensus peers are allow-listed. There is no internet-reachable validator surface.

**Zones**

| Zone | Contents | Owner | Notes |
|---|---|---|---|
| Z0 Offline root | Ceremony room, offline root HSMs, sealed share custody | Governance body (multi-party) | Never connected. Two vault sites in different provinces |
| Z1 Key services | Online HSM clusters, PKI issuing CAs, KMS | Operator (own keys); each member (own keys) | No shared admin domain across owners |
| Z2 Consensus | Validators, sentry nodes, p2p mesh | Each validator owner | Permissioned mesh, mTLS, IP and identity allow-list |
| Z3 Ledger and state | Execution engine, state storage, snapshots | Operator; each member for own replica | Sync replication across AZs |
| Z4 Settlement and compliance | L3 and L4 services: screening, limits, netting, templates | Operator | Contract templates are the reviewed library only |
| Z5 Access DMZ | Institutional API gateway, ISO 20022 endpoints | Operator | Ingress only from member private circuits. No customer or internet access |
| Z6 Supervisory | Read-nodes, mandate-scoped query API | Operator hosts; supervisor accesses via dedicated circuits | One-way data flow out of Z3. Holds decryption capability, so treated as Tier 0 |
| Z7 Observability and audit | Signed audit log, WORM storage, SIEM, metrics | Operator, with member witnesses | Write-only from other zones. No delete path |
| Z8 Admin plane | PAM, bastions, out-of-band management, admin workstations | Operator SecOps | Separate identity provider. No internet from privileged sessions |
| Z9 Supply chain | Source control, CI, build farm, artifact signing | Operator, with independent build verifiers | Isolated. No production credentials in the build zone |
| M-zones | Member core adapter, wallet, custody HSM, member validator | Each member | Shared-responsibility boundary defined by the CSP |

**Reference topology (schematic)**

```
                 Z0 OFFLINE ROOT / CEREMONY (governance body)
                                  |
   MEMBER BANK DOMAIN (x N)       |            DEPOSITX OPERATOR DOMAIN
 +---------------------------+    |     +---------------------------------------+
 | M1 core banking + adapter |    |     | Z5 Access DMZ (API gateway)           |
 | M2 wallet + custody HSM   |=== dual diverse private ==> |                     |
 | M3 validator + HSM        |    |     | Z4 Settlement / compliance services   |
 +---------------------------+    |     | Z3 Ledger / state                     |
        ^                         |     | Z2 Operator validator + sentries      |
        |                         |     | Z1 Key services (HSM)                 |
        +==== Z2 consensus mesh (mTLS, allow-list) ====+                        |
                                        | Z7 Audit / observability (WORM)       |
   SUPERVISOR DOMAIN                    | Z8 Admin plane (PAM, OOB)             |
   Z6 read-node access <--- one-way --- | Z9 Build / supply chain               |
                                        +---------------------------------------+
```

**Allowed flows (everything else denied)**
- M1 to Z5: instruction submission. Signed, rate-limited, authenticated by an HSM-bound member certificate.
- Z5 to Z4 to Z3: internal path. No lateral connections between Z4 services except through declared interfaces.
- M3 to Z2 peers: consensus only.
- Z3 to Z6: one-way replication of finalised blocks and derived views.
- All zones to Z7: append only.
- Z8 to any zone: only through PAM with just-in-time elevation, recorded sessions and a change ticket. Never to member domains.
- Z9 to Z2 and Z3: only signed artifacts, pulled by the recipient. The build zone never pushes to production, and the operator never pushes code to a member's validator. Members pull signed releases and choose the timing inside governance windows.

**Network specifics**
- Members connect over dedicated private circuits, at least two diverse physical paths per member, from different carriers where possible. Route diversity is a CSP requirement, because a single shared carrier is a common-mode failure.
- Sentry pattern: validators are reachable only through sentry nodes. This limits DDoS and topology disclosure.
- Time: authenticated time (NTS or PTP with multiple sources) with drift alarms. BFT timeouts and audit ordering depend on it. Use leap-second smearing consistently.
- Egress: production zones have no direct internet egress. Package mirrors and update caches sit in Z9.

### 1.2 Validator hardening baseline

1. **Immutable, minimal images.**
   - Read-only root, verified boot, no interactive shell or SSH on production nodes.
   - Break-glass access is described in section 1.7.
2. **Signed and reproducible builds only.**
   - Nodes run only binaries with provenance attestations.
   - At least two independent parties rebuild each release bit-for-bit. A release is not deployable until both attest.
   - Target SLSA Build Level 3 or higher (verify current spec wording).
3. **Double-sign guard.**
   - Active-active clones of a validator using the same key are forbidden.
   - The signing HSM enforces a monotonic high-water mark (height, round and step), so a failover or cloned instance cannot equivocate.
   - Hot standby runs in a different AZ. The standby takes over only after the HSM fences the old signer.
4. **Client diversity.**
   - Phase 3 minimum: a second, independently developed implementation of the state-transition verifier (a "shadow verifier"), run continuously against the production chain.
   - Phase 4 goal: two independent full clients.
   - Reason: all validators running one codebase is the largest common-mode risk (X1).
5. **Hardened runtime.**
   - CIS Level 2 benchmark or equivalent (verify against chosen OS).
   - Runtime detection (eBPF-based or equivalent), no privileged containers, resource limits, seccomp profiles.
6. **Attested state.**
   - Validators publish periodic state-root hashes.
   - Peers and independent watchers compare state hashes each block or every N blocks. A mismatch pages immediately.
7. **Protocol fuzzing.**
   - Continuous fuzzing of the p2p and message-parsing surface.
   - Adversarial validator simulations (equivocation, delayed votes, invalid proofs) are part of the CI pipeline and the chaos programme.
8. **Leader hygiene.**
   - The leader schedule excludes validators that are unresponsive or lagging. Otherwise degradation near f failures breaks the finality target (section 2.3).
9. **Patch policy.**
   - Critical vulnerabilities on the network path: mitigate within 72 hours, patch within 7 days.
   - Actively exploited: mitigate within 24 hours.
   - Rolling patches follow the maintenance budget in section 4.6.

### 1.3 HSM strategy

**Baseline**
- All production key material lives in HSMs validated to **FIPS 140-3 Level 3**.
- Prefer modules that also carry Common Criteria certification (verify per vendor).
- Level 4 is not required. Its cost and operational limits are not justified by our threat model.
- Shortlist candidates from the CMVP validated modules list (for example Thales, Entrust, Utimaco, Marvell). **Verify current 140-3 validation status and certificate numbers** before selection.
- Software-only key stores are permitted only in non-production environments.
- Data residency: HSMs, their backups and wrapped key material stay in Canada.

**Signature algorithm constraint**
- Choose signature schemes that HSMs support natively inside the validated boundary.
- ECDSA P-256 or P-384 is the safe choice. Ed25519 was added to FIPS 186-5 (verify HSM support).
- **BLS aggregate signatures are a design tension.** They are attractive for BFT vote aggregation but are generally not FIPS-approved or HSM-native (verify).
- Phase 0 decision: use approved primitives, with multi-signature certificates rather than BLS aggregation, unless a validated implementation exists. The Phase 1 benchmark must prove that throughput and latency targets still hold. Crypto-agility (blueprint) makes later change possible.

**Key classes, owners and stores**

| Class | Purpose | Owner | Store | Control model |
|---|---|---|---|---|
| K1 Governance root | Rulebook root, validator-set authority, contract-upgrade authority, PKI roots | Governance body (m-of-n across banks and operator) | Offline HSMs, Z0 | m-of-n custodians, ceremony only, shares in bank vaults at separate sites |
| K2 Member validator consensus key | Vote signing | Each member for its own validator | Member HSM cluster | Single member custody, double-sign guard |
| K3 Operator validator and service keys | Operator vote, service CAs, audit-log signing, gateway CA | Operator | Operator HSM clusters in two regions | HSM quorum authentication, split across operator admin domains |
| K4 Issuer mint and burn key | Authorise issuance and redemption | Each issuing bank | Bank HSM | Bank m-of-n dual control |
| K4b Issuer liability attestation key | Attest that supply matches deposit liabilities | Each issuing bank, separate admin domain from K4 | Separate HSM in the core-banking domain | Independent of K4. Mint requires both |
| K5 Wallet and custody keys | End-holder value control | Issuing bank | Bank HSM | Governed by the CSP. Outside operator control (Invariant III) |
| K6 Release-signing keys | Sign software releases | Independent signers (operator, at least two verifiers, at least one bank) | Offline HSMs plus online signers | 2-of-3 or higher across organisations, reproducible-build attestation required |
| K7 Disclosure (viewing) keys | Decrypt confidential fields for supervisory mandates | Threshold-held by issuer and supervisor | Threshold HSM shares | Per-mandate, per-epoch, logged (see section 5.2) |
| K8 Encryption keys (KEKs) | Data at rest, backups | Operator | HSM-wrapped | Envelope encryption, Canadian only |
| K9 Workload and transport identity | mTLS certificates | Operator PKI (intermediates online) | HSM-backed CA | Short-lived (24 hours to 7 days), automated |
| K10 ZK setup material | Trusted-setup parameters, if the chosen scheme needs any | Ceremony participants | Not stored, destroyed | Prefer transparent-setup schemes. If a trusted setup is unavoidable, run a public multi-party ceremony (verify chosen scheme) |

**Why K4 and K4b are separate**
- A single stolen mint key must not be enough to inflate a bank's token supply.
- The mint contract requires a signature from K4 and a fresh liability attestation signed by K4b, which lives in a different administrative domain.
- The contract also enforces per-issuer mint velocity caps and a time-lock on large mints.
- The legal position on erroneous or fraudulent mints (whose liability, and whether governance can void) needs counsel (verify with counsel).

**Ownership rules**
- No key class is co-held by a single organisation with authority over the same action.
- The operator holds no member's key, and the operator's own keys cannot move value. The contracts contain no administrative transfer, seizure or clawback function. Court-ordered actions are executed by the issuing bank on its own tokens through its own key.

### 1.4 Governance and operator actions: MPC design

**Position:** use two mechanisms, each where it fits best.

1. **On-ledger multi-signature (primary).**
   - Each signer holds an independent key in its own HSM in its own administrative domain.
   - The governance contract verifies signatures and thresholds.
   - This is explicit, auditable by anyone with ledger access, and simple to explain to bank auditors.
   - Use it for validator-set changes, contract upgrades, emergency actions, key-registry changes and parameter changes.
2. **Threshold signing or HSM-native quorum (secondary).**
   - Use only where a single logical key must exist off-ledger (operator CA, audit-log signing key, release-signing online signer).
   - Prefer HSM-native m-of-n authentication (keys never leave the device) over software MPC.
   - Where software threshold signing is used, require a scheme with published security proofs and a third-party implementation review.
   - Historical implementation flaws in threshold ECDSA protocols make this a review-gated choice (verify current state of the art).

**Quorum policy by action class**

| Class | Examples | Threshold (n is the authorised signer set) | Additional controls |
|---|---|---|---|
| A Routine operation | Scaling, non-security config, node restarts | 2 operator staff (four-eyes) | Automated policy check, audit log |
| B Containment | Issuer-scoped freeze, pause a contract, eject a validator on evidence | 2 of a cross-organisation "security council" (operator SRE lead, operator security lead, any issuer risk officer) | Freeze is reversible. Rate-limited, so it cannot be spammed. Post-hoc review within 24 hours |
| C Network halt | Protective halt | Automatic from invariant monitors, or **f+1** validator signatures | f+1 means Byzantine validators alone cannot halt the network |
| D Resume after protective halt | Restart | At least 2f+1 validators, plus attested root cause, reconciliation report and supervisor notification | Harder to resume than to halt |
| E Contract or protocol upgrade | New template, par module change | Supermajority of voting members plus operator, independent audit and proof re-check, time-lock (section 4.6) | Members can veto during the time-lock |
| F Root actions | Root rotation, rulebook root change | m-of-n governance custodians in ceremony | Independent attestation |

**Design rules**
- No action that moves value can be authorised by the operator alone.
- Signer sets are lists of named roles, not individuals. Membership changes are Class E actions.
- Every action carries a signed authorisation record that lands in the audit log and is anchored on-ledger.

### 1.5 Key ceremony runbook outline

**Cadence (recommendation).** Hold attested ceremonies quarterly, as the blueprint says. What happens in each differs:
- **Every quarter:** custodian liveness and share verification, rehearsal of recovery, rotation of operational keys (K3, K9, audit signing), and a review of the quorum lists.
- **Annually:** validator key rotation windows (section 1.6) and K7 epoch policy review.
- **Multi-year (target five years, verify against crypto policy):** K1 roots, changed only by a full root ceremony.

**Roles**
- Ceremony Administrator (operator).
- Internal Witness (a member security officer).
- Independent Auditor (attesting third party).
- Crypto Officers (m-of-n custodians, drawn from different banks).
- Security Officer (physical).
- Scribe and video operator.

**Phases**

1. **Pre-ceremony (T minus 30 to T minus 1 days)**
   - Publish the script, its hash and the run-of-show to all custodians and the auditor.
   - Verify HSM provenance: tamper-evident packaging, serial numbers and firmware hash checked against the vendor manifest.
   - Confirm room readiness: air-gapped, shielded, no personal devices.
   - Complete at least one full dry run on non-production hardware.
   - Confirm custodian attendance with alternates. Set the quorum so that n is well above m (for example 3-of-7 for operational shares, 5-of-9 for root, verify with governance design) and the loss of any single bank's custodians is tolerable.
2. **Ceremony**
   - Enter the room with dual control. Photograph and seal.
   - Verify HSM firmware and the tamper state.
   - Initialise the HSM and use the entropy source. Log entropy checks.
   - Generate keys inside the HSM. Split shares to cards or devices. Verify every share by test recovery.
   - Produce wrapped backups.
   - Derive and export public keys. Cross-verify their hashes with two independent tools.
   - Every step is read aloud, checked off, timestamped and video-recorded. Deviations require Ceremony Administrator, Independent Auditor and Internal Witness to agree and record them.
3. **Post-ceremony (same day to T plus 5 days)**
   - Custodians take sealed shares to separate bank vaults. Log chain of custody.
   - Independent Auditor signs the ceremony report.
   - Publish public keys and the report hash to the rulebook registry and anchor them on-ledger.
   - Destroy temporary media by documented method.
   - Debrief: a deviation log, plus a remediation ticket for every deviation.
4. **Recovery (rehearsed quarterly)**
   - Prove that a quorum of custodians can restore a key from shares within a set time (target: inside 24 hours for operational keys).
   - Test the lost-custodian procedure: replace a custodian without exposing the key.

### 1.6 Rotation, revocation and compromise

**Lifetimes and rotation**

| Key | Lifetime target | Routine rotation | Compromise response target |
|---|---|---|---|
| K1 root | Multi-year | Planned root ceremony | Emergency ceremony inside 72 hours. Governance freeze until complete |
| K2 validator | 12 months | On-ledger rotation at an epoch boundary, with overlap. Also on custodian change | Eject from validator set inside 15 minutes (Class B fast path). Re-key inside 24 hours |
| K3 operator | 90 days to 12 months by sub-type | Quarterly ceremony | Revoke and re-key inside 4 hours. Audit-log key change chains to the previous key |
| K4, K4b issuer | 12 months | Bank ceremony with independent witness | Issuer-scoped freeze inside minutes. Re-key with governance attestation. Reconcile supply against liabilities before unfreezing |
| K6 release-signing | 12 months | Ceremony | Publish revocation on-ledger. Validators reject the revoked key. Rebuild and re-sign |
| K7 disclosure | Per epoch (for example 90 days) | Epoch re-key | Rotate epoch. Assess which past epochs are exposed and notify affected issuers |
| K8 KEK | 12 months | Envelope re-wrap | Rotate and re-wrap inside 24 hours |
| K9 workload | 24 hours to 7 days | Automatic | Revoke via CRL and OCSP or short-lived expiry |

**Standard compromise procedure (all classes)**
1. Detect and triage. Any employee, member or monitor can raise it.
2. Declare a severity per section 4.9. Any suspected K1, K2, K4 or K7 compromise is at least SEV-1. Confirmed governance or multi-validator compromise is SEV-0.
3. Contain: freeze the affected scope (issuer, validator, release channel) using a Class B action.
4. Revoke: register the revocation on-ledger through governance fast path. Distribute to gateways and peers.
5. Re-key: run the class-specific procedure. Never reuse a compromised HSM without forensic clearance.
6. Restore trust: re-attest, reconcile, and independently verify before unfreezing.
7. Learn: preserve evidence, write the report, and update controls.

**Byzantine accounting.** A compromised validator key counts against f until the validator is ejected or re-keyed. The incident lead must state the current "f budget remaining" in every update.

### 1.7 Break-glass

**Scope.** Break-glass restores access and initiates governance. It cannot alter ledger state or move value.

**Types**
- **Infrastructure:** emergency operator access when PAM or the IdP is down.
- **Key recovery:** recovery of operational keys through the quorum of custodians.
- **Resume or restart:** the cold-start and resume procedures (Class D).

**Controls**
- Credentials sealed in dual-custody safes, or stored in a vaulted secrets service that requires two-person release.
- Use requires two-person authorisation plus an independent approver (security council member) on a recorded bridge.
- Time-boxed: maximum 4 hours, with automatic expiry.
- Full session recording and command capture.
- Immediate rotation of any credential used.
- Post-use review inside 24 hours, reported to the board risk committee if used in production.
- Rehearsed quarterly, as the blueprint requires. Rehearsal results include time to obtain access and any failures.
- Break-glass use itself is a SEV-2 event by default, so it is visible to members and regulators.

### 1.8 Insider-threat controls

1. **No standing production access.** Just-in-time privilege through PAM, approved per session, time-limited, recorded.
2. **Separation of duties.** The same person cannot write code, approve it, release it and deploy it. Production changes need two people. Key custodians are never also the sole administrators of the systems those keys protect.
3. **Cross-organisation checks.** Operator staff cannot act alone on anything value-adjacent (section 1.4). This is the main answer to B2.
4. **Log integrity independent of the operator.** Member witnesses co-sign audit log checkpoints (section 5.1), so a malicious operator cannot rewrite history.
5. **Personnel security.** Background screening proportionate to role, with re-screening. Follow OSFI's expectations on integrity and security as flowed down by banks (verify with counsel, including privacy-law limits on screening). Production access limited to personnel working from Canada (verify with counsel).
6. **Behavioural monitoring.** UEBA on privileged sessions, alerts on unusual data access from Z6 and Z7, and canary records in sensitive stores.
7. **Rotation and leave.** Mandatory leave for privileged roles, role rotation where practical, and a documented leaver process that revokes access within one hour.
8. **Protected reporting.** A confidential whistleblowing channel that reaches the board risk committee and internal audit, not just management.
9. **Collusion bound.** The operator holds at most one consensus vote. Operator collusion with f validators is the largest stated threat, so f is set to tolerate the operator plus two banks (section 2.3).

### 1.9 Admin plane separation

- **Separate identity provider** for operator administration. Phishing-resistant authentication (FIDO2 hardware keys) for all privileged accounts.
- **Privileged access workstations.** Dedicated, hardened devices with no email or web browsing.
- **Separate networks.** Management traffic uses an out-of-band network. Data-plane compromise does not give management-plane access.
- **Tiering.** Tier 0 (identity, PAM, HSM management, CI signing) has a smaller admin population and stricter controls than Tier 1 (application ops).
- **No cross-domain administration.** The operator cannot administer a member's systems. A member cannot administer another's. Each member administers only its own validator and adapter.
- **Read-node** administrators cannot decrypt confidential data, and decryption-capable staff cannot alter logs.

### 1.10 Member security onboarding: the DepositX CSP

**What it is.** A mandatory set of security controls for every member endpoint, with an annual attestation and independent verification for higher tiers. It follows the SWIFT CSP pattern (mandatory and advisory controls, annual attestation, and consequences for non-compliance). **Verify** the current SWIFT CSP structure before copying it.

**Tiers**

| Tier | Who | Requirements |
|---|---|---|
| A: Validating issuer | Founding issuers running a validator | Full CSP, independent assessment before go-live and every two years, HSM standards, route diversity, on-call obligations, participation in drills |
| B: Non-validating participant | Issuers or participants connecting through the gateway | Endpoint controls, HSM-held keys, attestation, annual assessment |
| C: Service provider | Vendors acting for a member (core-banking adapter vendors, custodians) | Attestation plus contractual flow-down |

**Core controls (indicative)**
- Segregate the DepositX adapter and wallet environment from the general corporate network.
- Hardware-bound credentials, with multi-factor authentication for all operators.
- HSM-held mint and custody keys under dual control, with a separate liability attestation key (K4b).
- Patch and vulnerability management with stated SLAs.
- Transaction limits and anomaly monitoring at the member end.
- 24/7 security contact, incident notification within 30 minutes for anything that might affect the network.
- Attend at least two joint drills a year.
- Continuous evidence collection for the assurance dashboard.

**Consequence model.** Non-attestation or failed verification results in a rulebook-defined escalation: notice, limits, and ultimately suspension. Suspension of a validating issuer follows governance rules, since it changes n.

---

## 2. Threat model

### 2.1 Approach

- STRIDE per layer L0 to L5, plus supply chain, as required.
- Each row maps to controls and to the blueprint threat class (B1 to B7) or to the additional classes I have added.
- Adversaries considered:
  - external criminal and nation-state actors,
  - compromised or malicious member staff,
  - malicious operator staff,
  - a malicious or coerced validator,
  - a malicious supervisory user,
  - a compromised third party (cloud, HSM vendor, MSSP, software supplier).
- The threat model is a living artefact. Version 1 is due end of Q4 2026 and is refreshed at every phase gate and after every SEV-0 or SEV-1.

### 2.2 Additional threat classes (not in the blueprint)

| ID | Threat | Why it matters |
|---|---|---|
| X1 | Common-mode software defect in consensus, ledger or contract code shared by all validators | One bug can affect every validator simultaneously, so BFT thresholds do not help |
| X2 | Soundness bug or side-channel in the ZK confidentiality layer | A soundness bug can permit undetectable inflation because balances are confidential. A privacy bug leaks confidential flows |
| X3 | Compromise of a member's endpoint (wallet, adapter, core-banking bridge) | Historically the most productive attack path against payment networks |
| X4 | Governance capture or deadlock, especially during an incident | Deadlock means no resume, no patch, no eject |
| X5 | Concentration and correlated failure in cloud, carrier or colo | Breaks the independence assumption behind f |
| X6 | Legal compulsion or foreign-law exposure over hosting (for example US CLOUD Act exposure for hyperscalers) | Data residency is not sovereignty. Bank third-party-risk teams will ask (verify with counsel) |
| X7 | Abuse or compromise of supervisory access | The read-node holds decryption capability across the network |
| X8 | Destructive attack or ransomware on a member or operator estate | Could remove f validators at once |
| X9 | Cryptographic obsolescence, including "harvest now, decrypt later" | Confidential on-ledger data is retained forever by every validator |

### 2.3 Byzantine assumptions, validator count and quorum

**Basics.** With n validators, n = 3f+1 tolerates f Byzantine validators for safety, and needs n-f (which equals 2f+1) responsive validators for liveness.

**Recommendation: ladder by phase**

| Phase | n (voting) | f | Quorum (2f+1) | Composition |
|---|---|---|---|---|
| Phase 1 testnet | 4 | 1 | 3 | 2 pilot banks, operator, one independent test validator |
| Phase 2 pilot | 7 | 2 | 5 | 3 to 4 issuers, operator, and independent neutral validators to reach 7 |
| Phase 3 production | 10 | 3 | 7 | Founding issuers (assumed 6 to 8), operator (one vote), and neutral validators to reach 10 |
| Phase 4 | 13 | 4 | 9 | Add issuers and neutral validators. Cap the voting set (see below) |

**Rules**
- One organisation, one vote. The operator gets one vote, even if it runs infrastructure in several zones.
- **f must cover the operator plus two banks.** The blueprint lists "malicious operator insider or collusion of up to f validators" as a threat. With f = 3, the operator's compromise consumes one fault and still leaves margin of two.
- **Neutral validators.** These are validators run by legally independent entities that are not issuers and not the operator. Candidates include a second infrastructure operator or an industry utility. Feasibility and politics are unknown (verify). If no neutral validators exist, n is set by issuer count and f is lower. In that case the board must accept a smaller fault margin explicitly.
- **Bank of Canada observer.** The blueprint assumes but has not confirmed BoC participation (its own known issue). I recommend BoC as a **non-voting observer** that receives final blocks, runs an independent watcher and countersigns periodic checkpoints. Do not build any safety or liveness assumption on it. If it declines, an independent non-bank checkpoint witness fills the same role.
- **Voting-set cap.** Consensus cost grows with n. Set a working cap of about 19 voting validators (verify against the chosen protocol's benchmarks). If issuer count exceeds the cap in Phase 4 (retail, smaller institutions), smaller issuers should participate as non-voting full nodes or gateway clients. This departs from "each issuer is a validator" and must be decided by the board before Phase 4 design begins.
- **Composition constraint.** Any commit quorum must include at least k distinct member banks, so operator plus neutrals plus observers cannot finalise alone. With n = 10 and quorum 7, this holds automatically (at least 5 non-operator, non-neutral votes if 2 neutrals exist).

**Independence caveat.** The probability that 4 of 10 independent validators (each at 99.9% availability) are down together is roughly 2e-10. That figure is misleading. The real risk comes from correlation:
- shared software (X1),
- shared carriers or cloud (X5),
- simultaneous maintenance,
- certificate expiry, and time skew,
- a shared attacker (X8).
The design must therefore focus on decorrelation, not on n alone.

**Behaviour between 0 and f failures ("degraded but final")**
- Safety and finality are preserved. Performance degrades.
- With f validators down out of 10, roughly 30% of leader slots land on a dead validator. If the leader schedule does not exclude unresponsive validators, each such slot costs a timeout, and the <2s median finality target will be missed.
- Requirement: leader reputation, or dynamic exclusion of non-responsive validators from the schedule.
- Alarm levels: Amber at 1 validator down, Red at f-1 down ("one failure from halt"). At Red, SEV-1 is declared automatically and non-essential change is frozen.

**Behaviour above f failures: halt, not degrade**

Decision: **fail-stop for anything that moves value.**

| State | Trigger | Behaviour |
|---|---|---|
| NORMAL | 0 failures | Full service |
| DEGRADED | 1 to f failures | Full function, alarms per above |
| HALTED-LIVENESS | More than f validators unreachable, no quorum | No finality. Instructions rejected immediately with an explicit error (not silently queued). Reads and supervisory queries continue against the last final state |
| PROTECTIVE-HALT | Invariant monitor or governance action (par or supply anomaly, safety concern) | As above, and resume needs Class D authorisation |
| RECOVERY | Cold start after halt | Runbook RB-14 (section 4.8). Validators re-establish state agreement by comparing state roots before voting |

Reasons for fail-stop:
- Invariants I and II (par always, finality is one thing) are incompatible with optimistic acceptance or probabilistic finality.
- No partial or pending states means nothing to unwind.

**What happens above f Byzantine (not merely offline)**
- Safety is no longer guaranteed. A fork or double-settlement is possible, and cryptography alone cannot prevent it.
- Mitigations are therefore detective and legal:
  - state-hash gossip and independent watchers (banks, BoC or substitute witness),
  - cross-witnessed checkpoints,
  - continuous reconciliation of token supply against each bank's core-banking liabilities, which is the ultimate ground truth because tokens represent existing deposits,
  - equivocation evidence stored as signed proofs,
  - a rulebook clause designating the remedy and the canonical record (verify with counsel).

**Effect of a halt on banks**
- Instructions in flight are rejected. Nothing is debited without finality, so no partial state exists.
- Tokens already held remain claims on the issuing bank. The last final state is authoritative (verify with counsel that the rulebook says so).
- Time-critical payments must move to Lynx, the Real-Time Rail (status verify) or wires. DepositX has no bridge by design.
- Redemption and issuance are paused for the halt duration. Banks should model the intraday liquidity effect.
- Each member must hold and rehearse a "DepositX-off" playbook: fallback rails, customer messaging, intraday liquidity, and reconciliation on resume.
- Any halt over 15 minutes triggers member treasury-level communication (section 4.9).

### 2.4 STRIDE tables

**L0 Governance and legal**

| STRIDE | Threat | Key controls | Class |
|---|---|---|---|
| S | Impersonation of a member or supervisor in governance votes | Votes are on-ledger signatures from HSM-held keys registered via ceremony | B2, X4 |
| T | Rulebook or parameter change without proper authority | Class E and F thresholds, time-locks, versioned and signed rulebook | B2, X4 |
| R | Disputed governance decisions | Signed authorisation records anchored on-ledger | B2 |
| I | Leak of governance deliberations or security posture | Need-to-know, encrypted collaboration space in Canada, classification scheme | X6 |
| D | Deadlock during an incident | Pre-delegated emergency powers with bounded scope (Class B, C), alternates for every named signer, quorum drills twice a year | X4 |
| E | Operator or a coalition acquires unilateral control | No unilateral value authority, f+1 halt threshold, veto window on upgrades | B2 |

**L1 Network and consensus**

| STRIDE | Threat | Key controls | Class |
|---|---|---|---|
| S | Rogue node joins the mesh | Allow-list plus mTLS with HSM-bound identity, membership only by governance | B1 |
| T | Validator equivocation or state tampering | Double-sign guard, state-root gossip, equivocation proofs | B1, B2 |
| R | Denial of votes cast | Signed votes retained in the audit log | B2 |
| I | Topology and traffic analysis | Sentry pattern, private circuits, padded and batched messages where feasible | B6 |
| D | Network flood, partition or leader targeting | Private connectivity, rate limits, leader exclusion of unresponsive nodes, partition tests, diverse carriers | B6, X5 |
| E | Compromised validator escalates to peers | Zone isolation, no shared admin domain, ejection fast path | B1 |

**L2 Ledger and assets**

| STRIDE | Threat | Key controls | Class |
|---|---|---|---|
| S | Forged mint by stolen issuer key | K4 plus K4b dual attestation, velocity caps, time-lock on large mints | B3, X3 |
| T | Balance tampering, par manipulation | Consensus-verified state transitions, formal verification of conservation and par, on-ledger supply commitments | B4 |
| R | Issuer disputes mint or burn | Signed instructions retained, anchored audit trail | B3 |
| I | Confidential balance leakage | ZK design review, need-to-know disclosure, K7 epoch keys | X2, X9 |
| D | State bloat or expensive-to-verify transactions | Per-member quotas, bounded circuit and proof sizes, capacity tests | B6 |
| E | Contract upgrade backdoor | No admin proxy with a single key, upgrades only via governance with time-lock, proof re-check on every change | B4, X4 |
| - | Undetectable inflation through a ZK soundness flaw | Independent cryptographer review, transparent setup preferred, supply reconciliation against bank core liabilities, designed fallback (section 6) | X2 |

**L3 Settlement services**

| STRIDE | Threat | Key controls | Class |
|---|---|---|---|
| S | Instruction replay or forged instruction | Nonces and sequence numbers, message signing, member HSM keys | X3 |
| T | Partial settlement, DvP or PvP leg manipulation | Atomicity enforced in contract, formally verified, no partial or pending state | B4 |
| R | Disputed instruction acceptance | Gateway signs acceptance receipts, anchored in the audit log | B4 |
| I | Counterparty leakage through netting metadata | Need-to-know views, aggregated netting outputs, access logging | X2 |
| D | Netting cycle overload, template abuse | Reviewed template library only, per-member rate limits, priority lanes | B6 |
| E | Template misuse to bypass limits | Template review process, limit enforcement at the contract layer | B4 |

**L4 Compliance engine**

| STRIDE | Threat | Key controls | Class |
|---|---|---|---|
| S | Forged KYC attestation | Attestations signed by issuing bank keys, verified on-ledger | X3 |
| T | Screening list tampering or stale lists | Signed list distribution, version pinned per transaction, list-freshness SLO | B5 |
| R | Disputed screening outcomes | Decision record with list version and reason code in audit log | B5 |
| I | Sanctions evasion through confidentiality layer | Screening at mint, transfer and redeem on attested identifiers, Travel Rule payload validation, anomaly detection, supervisory disclosure | B5 |
| D | Screening service outage blocks settlement | Fail-closed by design (no transfer without screening). HA deployment sized as part of the settlement path, since it counts toward availability | B6 |
| E | Rule bypass by privileged operator | Rule changes are Class E actions with review and time-lock | B2 |

**L5 Access and integration**

| STRIDE | Threat | Key controls | Class |
|---|---|---|---|
| S | Impersonating a member at the gateway | mTLS with HSM-bound certificates plus signed messages | X3 |
| T | Message manipulation in ISO 20022 adapter | Schema validation, signature verification, canonicalisation, strict parsing | X3 |
| R | Member denies an instruction | Non-repudiable signed messages and receipts | X3 |
| I | Data leakage in adapter logs or errors | Field-level minimisation, no confidential payloads in logs | X2 |
| D | API flood, malicious spam from an authenticated member | Private-circuit ingress only, per-member quotas, admission control, backpressure | B6 |
| E | Compromised adapter used to reach core banking | CSP segmentation, least-privilege service accounts, no operator access into bank estates | X3 |

**Supply chain**

| STRIDE | Threat | Key controls | Class |
|---|---|---|---|
| S | Typosquatted or hijacked dependency | Vendored and pinned dependencies, allow-listed registries, dependency review | B7 |
| T | Tampered build or artifact | Reproducible builds verified by two independent builders, signed provenance, multi-party release signing | B7 |
| R | Unattributed changes | Signed commits, mandatory review, immutable build logs | B7 |
| I | Secrets in the pipeline | No production secrets in Z9, short-lived credentials, secret scanning | B7 |
| D | Registry or CI outage blocks emergency patch | Local mirrors, offline-capable emergency release path | X5 |
| E | Malicious HSM firmware, prover library or compiler | Vendor provenance checks, firmware hash verification at ceremony, independent review of the ZK toolchain and proof-checker trusted base | B7, X2 |
| - | SBOM and vulnerability blindness | SBOM (CycloneDX or SPDX) per release, VEX statements, continuous scanning | B7 |

---

## 3. Assurance programme

### 3.1 What big banks will demand

Framework mapping (all regulatory citations below are from memory. **Verify each one with counsel** before it goes into a bank-facing document).

| Framework | What it asks of DepositX (as a third party and shared infrastructure) | Our response |
|---|---|---|
| **OSFI B-13** Technology and Cyber Risk Management (final 2022, effective 1 January 2024, verify) | Governance, technology operations and resilience, cyber security. Banks must show that third-party technology risk is managed | Unified control set mapped to B-13 outcomes by Q1 2027. Evidence packs per domain. Incident reporting: banks must report to OSFI within 24 hours under OSFI's incident advisory (verify), so DepositX notifies members far faster (section 4.9) |
| **OSFI B-10** Third-Party Risk Management (final 2023, effective 1 May 2024, verify) | Risk-based due diligence, contract terms (audit and access rights, subcontracting, incident notification, exit), concentration and fourth-party visibility | Due-diligence pack (section 7.2), audit-rights schedule (section 3.6), fourth-party register, exit and step-in plan. Whether membership counts as a third-party arrangement under B-10 is a question for counsel |
| **OSFI E-21** Operational Risk Management and Resilience (final 2024, phased adoption through 1 September 2026, verify) | Critical operations mapping, impact tolerances, severe but plausible scenario testing, resilience of third parties | DepositX provides scenario-test evidence, published RTO and RPO, drill reports and dependency maps so banks can place DepositX in their own critical-operations mapping |
| **OSFI Integrity and Security guideline** (2024, verify) | Personnel and insider risk, foreign interference | Insider-threat programme (section 1.8) |
| **OSFI E-23** Model risk (effective 2027, verify) | Governance of models | Applies to anomaly-detection and screening models in L4 |
| **PFMI Principle 17** Operational risk | Identify and mitigate operational risk. Critical systems recover inside two hours (stated in the PFMI, verify wording). Secondary site with a distinct risk profile | Our 15-minute RTO is stricter than the two-hour benchmark. Secondary-site distinctness raises the corridor-correlation question in section 4.2 |
| **PFMI Principle 16** Custody and investment risk | Safeguard own and participants' assets | Operator holds no client assets (Invariant III). Map bank-hosted custody and key custody to this principle in the PFMI self-assessment |
| **PFMI Principle 8** Settlement finality | Clear and certain final settlement, defined point of no return | Technical finality is deterministic. Legal finality needs the legal basis (section 3.5). Principle 8 cannot be claimed on technology alone |
| **PFMI Principles 1, 2, 3, 18, 22, 23** | Legal basis, governance, risk management framework, access criteria, communication standards, disclosure | Covered by rulebook, governance and CSP. Publish a disclosure framework document (verify with counsel and BoC) |
| **CPMI-IOSCO cyber resilience guidance for FMIs** (2016, verify) | Identify, protect, detect, respond and recover, testing, situational awareness, learning | Structure the control framework around it |
| **NIST CSF 2.0** | Common language for bank security teams | Secondary mapping |
| **Payment Clearing and Settlement Act** and BoC oversight | Designated FMI regime, BoC risk-management standards | Whether DepositX's operator will be designated is unknown (verify with counsel). Plan as if PFMI observance will be examined |
| **Critical cyber systems legislation** (federal bill status uncertain) | Possible mandatory cyber programme for designated systems | Monitor. Verify current bill status with counsel |
| **Privacy law** (PIPEDA, Quebec Law 25) | Personal information safeguards, breach reporting | Personal data is mostly off-ledger at banks. Complete a privacy impact assessment (verify with counsel) |

### 3.2 Certifications and attestations

| Item | Position | Timing |
|---|---|---|
| **SOC 2 (Type I then Type II)** | Trust services criteria: Security, Availability, Processing Integrity, Confidentiality. Privacy only if scope requires. The Canadian equivalent is CSAE 3416 (verify). Ask the auditor which report Canadian banks prefer | Type I as at 31 December 2027, report about February 2028. Type II needs an observation window (assume 6 to 9 months, verify with auditor) starting no later than 1 January 2028 to report in H2 2028. Controls must be operating during the pilot |
| **SOC 1 or CSAE 3402** | Not in the blueprint. Bank auditors may request it because settlement affects financial statements | Scope in Phase 2, report in Phase 3 (verify need with bank auditors) |
| **ISO/IEC 27001:2022** | Not in the blueprint. Many bank third-party teams require it. Start the ISMS in Phase 1 so it has operated for months before the Stage 2 audit | Certificate targeted Q2 to Q3 2028 |
| **ISO 22301** (business continuity) | Optional, strong signal for E-21 and PFMI 17 | After ISO 27001, Phase 3 to 4 |
| **FIPS 140-3** | HSMs and cryptographic modules | At procurement. Certificate numbers go in the due-diligence pack |
| **PCI DSS** | **Not applicable.** The network does not store, process or transmit payment card data. DepositX's "tokens" are not PCI tokenisation. Scope changes if Phase 4 retail flows ever carry PAN, in which case re-assess. Bank card systems stay outside DepositX's scope | State this in the pack to avoid repeated questions |
| **CSA STAR or cloud attestations** | Only for cloud services we use | Collect from providers as fourth-party evidence |

### 3.3 Testing, independence and disclosure programme

**Penetration testing**
- Annual external network and application tests by an independent firm.
- Extra tests on each major release of the gateway, ISO 20022 adapter and governance contracts.
- Phase 1 testnet gets one test. Phase 2 pilot gets two. Production gets at least annual plus after major architectural change.
- Findings SLAs: critical fixed or mitigated within 7 days, high within 30, medium within 90.
- Members receive executive summaries with remediation status. Full reports go into a controlled reading room.

**Red team and threat-led testing (TLPT)**
- Purple-team exercises quarterly from Phase 2.
- First full red team in Q1 to Q2 2028 against the pilot.
- A threat-intelligence-led test (TIBER-EU or CBEST style) before production go-live, and every two to three years afterwards. OSFI has an intelligence-led resilience testing approach that banks may expect us to align to (verify).
- Scenarios must include: compromised issuer endpoint, malicious insider, supply-chain build compromise, and a par-break response drill.

**Contract and cryptography audits**
- At least two independent audits of the par and settlement contracts and of the ZK circuits before pilot value flows. Circuit under-constraint bugs are a leading ZK bug class.
- Audit again after any material change.
- Independent review of the cryptographic design by named external cryptographers before the Phase 1 confidentiality go or no-go.

**Formal verification independence**
- The verification team is organisationally independent from contract developers. Preferably a different firm.
- A separate reviewer audits the formal specification itself. A proof is only as good as its statement.
- Verified properties: conservation of supply, par, atomicity, authorisation, no admin transfer path.
- Enumerate and publish the trusted computing base (proof assistant, compiler, VM semantics, circuit compiler). Verify at bytecode or VM level where feasible, not just source.
- Proofs are re-checked by a party other than the one who produced them and are published.
- Vendor rotation: no vendor serves developer, auditor and verifier roles. No audit vendor serves more than two consecutive cycles on the same scope.

**Bug bounty**
- The blueprint says public from Phase 2. I recommend:
  - Private invite-only programme from Phase 1 testnet.
  - Public programme in Phase 2, limited to a production-mirror environment that runs real proof verification and no real member data.
  - Invite-only production scope until Phase 3, after two independent audits are complete.
- Legal safe harbour and coordinated disclosure policy (security.txt, disclosure timelines) approved by counsel.
- Reward tiers sized to be credible: top tier (par or mint bug) around CAD 1M (estimate, verify with finance and counsel).
- Never test against member production systems.

### 3.4 Assurance calendar (summary)

| Quarter | Assurance milestone |
|---|---|
| Q4 2026 | Threat model v1, control framework mapping started, HSM decision |
| Q1 2027 | Architecture review by external firm, ISMS scoping |
| Q2 2027 | First testnet pen test, design audit of ledger, dress-rehearsal ceremony, cryptographer review |
| Q3 2027 | Pilot readiness assessment, SOC 2 readiness, first contract audit |
| Q4 2027 | Second contract audit, SOC 2 controls in operation, ceremony with production HSMs, SOC 2 Type I as-at date |
| Q1 2028 | Type I report, first red team, Type II observation opens, formal verification results |
| Q2 2028 | ISO 27001 Stage 1 and 2, DR drill, proofs published, public bug bounty on mirror |
| Q3 to Q4 2028 | TLPT before go-live, load and chaos evidence, SOC 2 Type II observation closes and report (verify timing), PFMI self-assessment |
| 2029 | Availability measurement window, ISO surveillance, independent PFMI assessment |

### 3.5 Legal and regulatory questions for counsel (verify with counsel)

1. Regulatory status of the operator: designated FMI under the Payment Clearing and Settlement Act, or another regime. What oversight applies and when.
2. Legal basis for "legal finality equals technical finality" (a blueprint known issue). Which statute, rule or designation protects settled transfers from unwinding, including on insolvency of a participant.
3. Whether membership counts as a third-party arrangement for B-10 purposes for each bank, and what audit and access rights supervisors can exercise directly over the operator.
4. Liability allocation for a fraudulent or erroneous mint caused by a compromised issuer key.
5. Whether a rulebook can define the "record of truth" during a halt and after a >f Byzantine event.
6. Data residency versus foreign-law exposure (X6) for hyperscaler-hosted components, and whether banks will accept Canadian-region hosting from a foreign-owned provider with customer-controlled keys.
7. Screening and personnel-security limits under Canadian privacy and employment law.
8. Whether OSFI's incident reporting timelines and breach-of-security-safeguards rules require the operator to notify anyone directly (verify OSFI, OPC and BoC channels).
9. Cyber-insurance availability and limits for a network of this kind.

### 3.6 Audit rights for member banks (contract schedule)

- Annual right to audit, on-site or remote, with reasonable notice. Emergency audit after a SEV-0 or SEV-1.
- **Pooled audit option.** Seven or more banks each auditing separately is unworkable. Offer a pooled audit run by an agreed independent firm whose report all members can rely on. Individual bank rights are preserved for their own regulators.
- Clean-team rules so banks do not see each other's data during audits.
- Access to SOC and ISO reports, pen-test executive summaries, control testing results and remediation tracking.
- Right to observe DR and chaos drills, and to participate in halt and resume exercises.
- Subcontractor and fourth-party disclosure with flow-down of audit rights.
- Incident notification timelines (section 4.9), breach reporting and cooperation obligations.
- Supervisor access: OSFI, BoC and other authorities can inspect the operator directly (verify with counsel).
- Exit: data return, escrow of source, build environment and key-recovery arrangements, step-in rights (section 4.8, RB-15), and wind-down planning.

---

## 4. Resilience engineering

### 4.1 Availability arithmetic and the SLO ladder

| Availability | Downtime per year | Per quarter | Per two quarters |
|---|---|---|---|
| 99.9% | 8.8 hours | 2.2 hours | 4.4 hours |
| 99.99% | 52.6 minutes | 13.1 minutes | 26.3 minutes |
| 99.999% | 5.26 minutes | 1.31 minutes | about 2.6 minutes (158 seconds) |

Consequences:
- A single RTO-length event (15 minutes) exceeds a year of budget at 99.999%. The 15-minute RTO is a disaster-recovery figure. The five-nines figure must be met by automatic failover inside seconds, not by manual recovery.
- A single failed view change, a bad configuration push or a certificate expiry can burn a quarter's entire budget.
- Two quarters of observation is a thin sample. Zero expected outages proves little about process capability.
- Protective halts count. See section 5.3 for how we account for them.

**Recommended ladder**

| Stage | Commitment | Basis |
|---|---|---|
| Phase 2 pilot | Objective 99.9%, no SLA, 24/7 monitoring | Learn the failure modes with capped value |
| Phase 3 go-live | Contractual SLA 99.99% monthly for the settlement path, internal objective 99.999% | Achievable with the design below if drills succeed. My judgement: first-attempt probability of meeting 99.999% over two quarters is well under 50% for a new network |
| Phase 4 entry gate | 99.999% measured over two consecutive quarters | Earliest mid-2029 (section 6) |

### 4.2 Topology for high availability and RPO 0

**Honest framing.** The blueprint's "active-active across 3 Canadian AZs and 2 regions; RPO zero" mixes three different things. I separate them:

1. **Network-level availability** comes from BFT across independent validators at member sites, not from the operator's cloud design.
2. **Ledger RPO 0** is a consensus property. A block is final only after at least 2f+1 validators have durably persisted and voted for it, so at least f+1 honest validators hold every final block. If no more than f validators are lost or corrupt, no final transaction is lost.
3. **Operator-only stores** (audit log, governance registry, read-node, configuration, gateway state) need their own RPO 0 design.

**Latency versus synchronous cross-region replication**

Engineering estimates (verify by measurement in Phase 1):
- Toronto area to Montreal area: about 8 to 15 ms round trip, about 500 km.
- Toronto or Montreal to Calgary: about 45 to 70 ms round trip.
- Cloud regions to consider (verify current availability and AZ counts): AWS ca-central-1 (Montreal) and ca-west-1 (Calgary), Azure Canada Central (Toronto) and Canada East (Quebec City), Google northamerica-northeast1 (Montreal) and northeast2 (Toronto).

Latency budget for accepted-to-final (estimates):

| Component | Typical | p99 |
|---|---|---|
| Gateway authentication and L4 screening | 20 to 60 ms | 200 ms |
| ZK proof verification | 10 to 100 ms (verify) | 300 ms |
| Consensus (about 3 message delays at 10 to 70 ms each) | 60 to 200 ms | 500 to 1,200 ms |
| Durable persist (fsync, 3-AZ local commit) | 2 to 10 ms | 30 ms |
| HSM signature per block | 1 to 5 ms | 20 ms |
| Synchronous Toronto-Montreal commit for operator stores | +10 to 15 ms | +30 ms |
| View change after leader failure | not applicable | 1 to 3 s (dominant p99 driver) |
| **Estimated total** | **0.3 to 0.6 s median** | **1.5 to 4.5 s p99** |

Conclusions:
- **Synchronous cross-region replication within the Toronto-Montreal corridor is compatible with the <2 s median target.** It adds tens of milliseconds, not seconds.
- **p99 below 5 s is at risk from view changes,** not from replication. Set adaptive timeouts, exclude dead leaders, and test failure injection at the leader.
- **Synchronous replication to Calgary** costs about 50 to 70 ms per round trip on every commit, roughly 100 to 200 ms per consensus decision if the quorum needs it. It is affordable for latency but raises tail risk. I recommend it only for a witness role (below), not for the main commit path.
- **Client-side proof generation is outside the "instruction-accepted to final" metric.** Track end-to-end time from client submission as a second SLI so that proving time does not hide.

**The real trade-off: two regions cannot give automatic failover without a third failure domain.**
- With two regions and a majority quorum, losing either region can leave no majority. Either you accept manual failover (which breaks 99.999%) or you risk split-brain.
- The fix is a witness: a third location that participates in quorum for operator stores but holds no full state.

**Recommended design ("metro pair plus remote witness")**

- **Region R1 (Greater Toronto)** and **Region R2 (Montreal area)** each with three AZs (or three independent fault domains).
- Operator replicated stores (audit log, governance registry, config, read-node source) use 5 replicas: 2 in R1, 2 in R2 and 1 witness in a third location (for example Calgary or a member data centre in the west). Majority is 3.
  - Loss of R1: 2 in R2 plus witness = 3, still a majority.
  - Loss of R2: same.
  - Commit path normally waits for 3 acknowledgements: the two local replicas plus the first remote, adding about 12 ms.
- Operator validator (one vote): active in R1, hot standby in another R1 AZ (failover under 30 seconds, HSM-fenced), warm standby in R2 (failover under 5 minutes). HSM clusters in both regions. No active-active use of the same signing key.
- Stateless services (gateway, compliance engine, read-node API): active-active across all AZs and both regions.
- **Ledger data:** each validator persists synchronously across its own three AZs. Consensus provides the cross-party durability.
- **Members:** the CSP requires each validating issuer to host its validator across at least two physically separate sites with the same fencing rules. Members' sites are outside our control, so CSP verification is what makes the assumption real.
- **Geographic risk.** Toronto and Montreal share weather and grid exposure (the 1998 ice storm and 2003 blackout are relevant precedents). PFMI 17 asks for a secondary site with a distinct risk profile. The witness location, the BoC observer and at least one neutral validator should sit outside the corridor. Board ask: require at least two voting validators hosted outside the Toronto-Montreal corridor.

**RPO 0 stated precisely**
- **Ledger RPO 0:** holds while at most f validators are lost or corrupt. A corridor-wide disaster is survivable for the ledger only if enough validators sit elsewhere. That is a placement requirement, not a guarantee.
- **Operator store RPO 0:** holds for the loss of any single region, using the 5-replica quorum above.
- **Simultaneous loss of both R1 and R2:** operator stores fall to the witness only (RPO greater than zero for operator-only stores unless additional async replication exists). Ledger state survives on validators outside the corridor. Read-nodes and audit archives are rebuilt from the ledger and from member witness copies of audit checkpoints.

**Hosting principle (D5)**
- The operator plane runs on two independent infrastructure providers (for example one hyperscaler plus one Canadian colocation or private cloud), so a single provider control-plane failure cannot take out the validator, gateway and key services together.
- Keys are held in Canadian HSMs the operator controls (external key store or dedicated HSMs). Hyperscaler-native managed keys are not used for K1 to K7.
- Residency is a floor. Sovereignty (X6) is a separate question for counsel.

**Capacity note.** The blueprint targets 5,000 instructions per second sustained. At about 1 to 2 KB per transaction including proofs (estimate), that is roughly 0.4 to 0.9 TB per day and 150 to 300 TB per year of ledger growth, before indexes. I also suspect actual wholesale demand is orders of magnitude below 5,000 per second (verify against Lynx and treasury volume). I recommend certifying 1,000 sustained at launch against a demand model and keeping 5,000 sustained and 20,000 burst as architectural headroom. This reduces cost and risk.

### 4.3 Capacity and headroom rules

- Sized so that sustained peak is under 40% of tested capacity.
- Load-tested at 2 times the burst target (about 40,000 per second) for at least 5 minutes with the system deliberately degraded (one validator in maintenance and one AZ lost), with p99 finality still under 5 s.
- Per-member token-bucket quotas with fair share. Priority lanes for redemptions, halt-related actions and regulatory transactions so they are never starved.
- Load shedding returns an explicit reject with a retry hint. Nothing queues silently.
- Storage growth forecast reviewed quarterly. ZK verification CPU and HSM signing rate are tracked as first-class capacity dimensions.
- Capacity review is a gate for each phase.

### 4.4 Disaster recovery runbooks

Each runbook has an owner, a target time, a drill frequency and a member communication step.

| ID | Scenario | Target | Notes |
|---|---|---|---|
| RB-01 | Loss of one operator validator | Standby takes over under 30 s | Fencing enforced by HSM |
| RB-02 | Loss of one AZ | No customer-visible impact | Automatic |
| RB-03 | Loss of one region | Service continues on quorum. Operator validator standby up inside 5 min | Region drills at least twice yearly |
| RB-04 | Loss of HSM cluster or key access | Failover to second region cluster inside 15 min. Recovery from shares within 24 h | Quorum custodian rehearsal |
| RB-05 | Network partition | Consensus halts on the minority side, continues on the majority | Verify no split-brain |
| RB-06 | State divergence or deterministic bug (state-root mismatch) | Halt, identify divergence, restore from last agreed checkpoint | Shadow verifier helps |
| RB-07 | Safety violation or suspected fork | SEV-0, protective halt, witness comparison | Rulebook remedy applies |
| RB-08 | Ransomware or destruction at a member | Eject or isolate that validator, count against f | Member restores from clean image and re-keys |
| RB-09 | Cloud provider control-plane outage | Shift to second provider | Tested |
| RB-10 | Audit-log integrity failure | Fail closed for privileged actions, verify against witness checkpoints | |
| RB-11 | Read-node compromise | Isolate, rotate K7 epoch, notify affected issuers and supervisors | |
| RB-12 | Key compromise (per class) | Section 1.6 | |
| RB-13 | Par break | Section 4.10 | |
| RB-14 | Cold start after halt exceeding f | Validators compare state roots, agree the last final height, restart in order, then resume under Class D | Highest-risk runbook. Rehearse first in staging, then annually with all validating members |
| RB-15 | Operator failure, insolvency or exit | Step-in by the consortium using escrowed source, build environment and key-recovery arrangements | Ties to B-10 exit expectations and PFMI wind-down planning (verify with counsel) |
| RB-16 | Loss of communications (corporate email, chat, bridge) | Out-of-band comms channel and PSTN bridge | Independent of DepositX and member networks |

### 4.5 Chaos and drill programme

The blueprint says quarterly chaos and DR drills. I recommend a denser cadence.

| Cadence | Activity |
|---|---|
| Continuous in staging (from Phase 1) | Automated fault injection: kill nodes, delay and drop packets, clock skew, disk stall |
| Weekly (Phase 2 onward) | Automated chaos in a production-like environment with adversarial validator simulation (equivocation, invalid proofs, delayed votes) |
| Monthly (Phase 3) | Small-blast-radius game days in production with abort criteria |
| Quarterly | Larger drills: AZ loss, HSM loss, partition, provider outage |
| Twice yearly | Region loss and full DR drill, including member participation and a halt and resume exercise |
| Annually | Unannounced exercise and cold-start rehearsal |

Rules:
- Before any production chaos with member traffic, members consent in advance.
- Abort criteria and an incident lead are named for every drill.
- Results feed the error budget and the assurance pack.
- Add deterministic simulation testing and Jepsen-style consistency checks for the consensus and ledger layers (verify tooling fit).

### 4.6 Upgrades with no maintenance window

**Consensus and client upgrades**
- Rolling, one validator at a time. **Maintenance budget:** at most 1 validator in planned maintenance at any time. That leaves f-1 for unplanned failures (2 at n = 10).
- Release order: operator canary validator, then one member at a time, then the rest.
- Protocol changes activate at a future on-ledger height, and only after at least 2f+1 validators signal readiness. No flag day.
- Supported version window: N and N-1.
- Before any release ships, replay the full production history through old and new versions and compare state roots (shadow replay).
- Automatic rollback triggers if state-root divergence, error-rate or latency guards trip.
- State migrations follow expand-and-contract, never in-place destructive changes.

**Contract upgrade governance**
- Contracts are immutable by default. Upgrades are new versioned deployments with migration, not admin-key proxy patches.
- Process: change proposal, specification update, independent audit, proof re-check for par and settlement logic, shadow run on a mirror, then a governance vote (Class E).
- **Time-lock of at least 14 days** for normal upgrades, so members and supervisors can review and veto or exit.
- Emergency path: a shorter time-lock, higher threshold (at least 2f+1 validators plus notification to supervisors), post-hoc review, and a bounded scope (fix only).
- Security council has pause powers only, never upgrade powers.
- The verified-invariants suite must pass on every candidate. An upgrade cannot lower the verified guarantee.
- Upgrades can never alter balances.

**Other rolling changes**
- HSM firmware and OS patches use the same rolling and canary approach.
- API gateway uses blue-green deployment.
- Certificates rotate automatically. Certificate expiry is a top-five outage cause, so expiry monitoring alerts at 30, 14 and 3 days.

### 4.7 Incident response and severity model

| Severity | Definition | Examples | Response |
|---|---|---|---|
| SEV-0 | Threat to invariants or network-wide loss of service | Par break or supply mismatch, safety fault or fork, confirmed governance or multi-validator key compromise, audit-log integrity failure, halted network | Incident commander within 5 min, war room with member bank and supervisor liaisons, board chair notified, updates every 15 min |
| SEV-1 | Material degradation or serious security event | p99 finality above 5 s for more than 5 min, region loss, single validator compromise suspected, actively exploited critical vulnerability, f-1 validators down | Incident commander within 10 min, updates every 30 min |
| SEV-2 | Limited impact, contained | Single validator down, break-glass use, failed drill step | Handled by on-call, summary to members |
| SEV-3 | Minor | Degraded non-critical service | Normal ticket flow |
| SEV-4 | Informational | Advisory, scan result | Tracked |

**Timings**
- Detection: page within 60 seconds of a burn-rate or invariant alert.
- Acknowledge within 5 minutes (24/7 primary on-call).
- Preliminary report within 24 hours of SEV-0 and SEV-1. Root cause report within 5 business days. Remediation tracked to closure.
- Blameless reviews, with a security carve-out for evidence handling and legal privilege.

**Security-specific handling**
- Forensic preservation and chain of custody.
- Legal counsel engaged early.
- Law-enforcement and national cyber-centre contact paths (for example the Canadian Centre for Cyber Security and the RCMP's National Cybercrime Coordination Centre, verify).
- Privacy breach assessment (OPC reporting duties, verify with counsel).

### 4.8 Communication protocol with members and regulators

**Members**
- **Notification clock (commitment):**
  - SEV-0: notify all members within 15 minutes of declaration.
  - SEV-1: notify within 30 minutes.
  - Any confirmed security compromise: notify within 30 minutes of confirmation. Members need this to meet their own 24-hour supervisory reporting (verify).
- Named 24/7 duty officer per member with backup, tested quarterly.
- Out-of-band channels (RB-16): signed status feed, dedicated secure messaging, and a PSTN conference bridge. Not dependent on DepositX or member corporate systems.
- Templates for initial notice, updates and closure. Traffic Light Protocol labels on threat information.
- Member obligations: acknowledge within 15 minutes, and report their own related incidents.
- Threat-intelligence sharing through the appropriate sector groups (for example FS-ISAC, verify).

**Regulators**
- The operator maintains a pre-agreed contact protocol with OSFI, BoC and FINTRAC as relevant (verify who must be notified by whom).
- Banks carry their own OSFI reporting duty. DepositX's notice timings are set so they can meet it.
- A halt lasting more than 15 minutes or any SEV-0 triggers proactive notice to the BoC and OSFI.
- Post-incident reports are shared with supervisors and, appropriately redacted, with members.

**Public and customer communications**
- Banks communicate with their own customers. DepositX's public statements are approved by the chair and legal counsel and follow the brand voice (plain, precise, cited).

### 4.9 Par-break and halt procedure

**Definition.** A par break is any state in which:
- 1 token-dollar cannot be redeemed for $1 of the issuer's deposits,
- a transfer does not settle at par, or
- an issuer's token supply does not reconcile to its attested deposit liabilities beyond a defined tolerance.

**Containment principle.** The blueprint says a par break is system-halting. I recommend **scoped freeze first, network halt when the cause is unknown or shared:**
- Issuer-attributable break (stolen mint key, backing mismatch at one issuer): freeze that issuer's contract. Other issuers continue.
- Shared-logic defect suspected, cause unknown, or safety concern: protective halt of the network.

**Detection**
- The par module rejects any transition violating conservation, so on-ledger inflation should be impossible if the contract and proofs hold (this is what formal verification protects).
- Off-ledger mismatch (bank liabilities versus supply) is caught by a continuous reconciliation monitor. Each issuer attests liabilities on a schedule (target: every minute during business hours and at least every 5 minutes otherwise, verify with banks' systems).
- Independent watchers (members, BoC or substitute witness) run the same checks. A single monitor is never the only detector.

**Runbook (targets)**

| Time | Action |
|---|---|
| T+0 | Detection. Automated issuer-scoped freeze if tolerance exceeded (within 60 s) |
| T+5 min | Incident commander declares SEV-0. Decision tree: scoped freeze or protective halt |
| T+5 to 15 min | If halt: any validator proposes, **f+1** signatures execute the halt. Members and supervisors notified by T+15 min |
| T+15 min to hours | Forensics, root-cause, reconciliation. Members activate DepositX-off playbooks |
| Resume | Class D: at least 2f+1 validators, root cause identified, remediation verified, reconciliation complete, supervisors informed (and non-objection sought if the rulebook requires) |
| After | Independent review, public summary where appropriate, control updates |

**Anti-abuse.** Halt authority can itself be a weapon. Controls: f+1 threshold for network halt, rate limits on freezes, mandatory post-hoc review, and drills so the process is fast and fair.

**Drills.** Twice yearly with all validating members and, where possible, supervisors observing.

---

## 5. Observability

### 5.1 Signed audit log design

**What it covers.** The ledger is already consensus-signed and tamper-evident for on-ledger state. The audit log covers everything else:
- privileged and administrative actions,
- API gateway requests and receipts,
- compliance decisions,
- key operations,
- governance authorisations,
- break-glass use,
- supervisory queries.

**Design**
- **Hash-chained Merkle log** in the style of certificate-transparency logs (RFC 6962 and 9162, verify). Entries are batched at most every second.
- Each batch root is signed by an HSM-held audit key (K3), one per region, with key changes chained.
- **External witnesses.** Each member bank runs a witness that fetches, verifies and co-signs checkpoints, then stores them. The operator cannot rewrite history without contradicting witnesses.
- **On-ledger anchoring.** Log roots are committed on the ledger at a fixed interval (for example every 10 seconds). This ties the log to consensus time.
- **WORM storage** (object lock in compliance mode) and legal-hold capability. Retention: assume 7 years, with certain record types 5 years for FINTRAC purposes (verify with counsel).
- **Entry schema:** actor identity and authentication context, action, target, before and after hashes, authorisation references (quorum signatures), reason (ticket or change ID), zone, trusted timestamp, per-source sequence number, outcome.
- **Minimisation.** No confidential payloads or personal data. Store hashes and pointers.
- **Fail-closed rule.** If a privileged action cannot be logged, it does not proceed. The value path is protected by the ledger itself.
- **Continuous verifier.** Independent process checks chain continuity and witness agreement. Any mismatch is SEV-0 or SEV-1.
- **Independent verification** by internal audit, the external auditor and member witnesses.

### 5.2 Supervisory read-node data model and the 60-second claim

**Read-node.** A non-voting node that replicates final blocks and maintains derived, queryable views. It lives in Z6, receives data one-way, and holds decryption capability only through mandate-scoped, threshold-held disclosure keys (K7).

**Data model**
1. **Ledger event store:** append-only final transactions. Confidential fields are encrypted to disclosure keys.
2. **Position views:** balances by wallet and issuer, with issuer attribution ("who owes it").
3. **Issuer views:** supply, attested liabilities, reconciliation status and history.
4. **Flow graph:** transfers between wallets and institutions, indexed for multi-hop tracing.
5. **Identity mapping:** wallet-to-entity links are **off-ledger at the issuing bank** (KYC evidence stays there). The read-node stores only attestation references.
6. **Mandate registry:** which supervisor (OSFI, BoC, FINTRAC, CDIC or others) may see which scope, under which legal authority, signed by that authority.
7. **Query log:** every query and result hash, written to the audit log.

**What the 60-second claim can honestly mean**

| Query class | Example | Proposed SLO |
|---|---|---|
| Q1 Point-in-time position | Balance or holdings of a wallet or institution | p99 under 2 s |
| Q2 Issuer obligation | Issuer supply versus attested liabilities | p99 under 5 s |
| Q3 Flow tracing | Multi-hop tracing with depth limit | p95 under 60 s |
| Q4 Entity-resolved queries | "Who is the beneficial owner behind this wallet" | Depends on the issuing bank's response. Separate SLO (for example 15 minutes) because it needs a bank-hosted endpoint |

- The blueprint's "where is this money, who owes it, under 1 minute" is achievable for Q1 to Q3, which are on-ledger facts.
- Identity resolution cannot be promised in 60 seconds unless issuing banks expose regulator-query endpoints with their own SLA. Add that to the CSP (target under 30 seconds, verify with banks) and measure it separately.
- **Freshness:** read-node lag behind finality is a monitored SLI (target under 2 s). Every answer states the block height and time it reflects.
- **Volume:** at 5,000 per second sustained, the event store grows very fast (section 4.2). Partitioning and indexing must be planned so Q3 remains under 60 s at three years of history. Test it with synthetic data at that scale in Phase 2.
- **Confidentiality and abuse controls:**
  - mandate token required for every query,
  - rate limits,
  - dual control for bulk export,
  - issuers can see that their data was touched (delayed or sealed where an investigation requires it, with a designated oversight officer, verify with counsel),
  - supervisor-side security expectations set out in a memorandum of understanding (verify with counsel).
- **Continuous testing:** synthetic supervisory queries run every minute with results in the availability report.

### 5.3 SLOs, SLIs and error budgets

**SLIs and SLOs (production)**

| SLI | Definition | SLO |
|---|---|---|
| Settlement availability | Per second, a synthetic canary transaction from at least 3 vantage points reaches final within 5 s. A second is "bad" if 2 of 3 vantage points fail. Cross-checked against real-traffic success ratio excluding client-caused errors | 99.99% at go-live, objective 99.999% |
| Finality latency | Accepted-to-final, rolling 30 days | Median under 2 s, p99 under 5 s |
| End-to-end latency | Client submission to final (includes proving) | Tracked, target set after Phase 1 benchmark |
| Correctness | Par breaks, unreconciled supply, audit-log verification gaps | Zero tolerance. Any occurrence is SEV-0 or SEV-1 |
| Durability | Replication lag, RPO test results | RPO 0 for defined stores, tested |
| Supervisory queries | Class-specific per section 5.2 | Per table |
| Read-node freshness | Lag behind finality | Under 2 s |
| Security hygiene | Patch SLAs, credential age, certificate expiry margin, ceremony success | Per policy |
| Detection and response | MTTD, MTTA, MTTR by severity | Per section 4.7 |

**Attribution rules (fixed in the rulebook before measurement)**
- Downtime caused by a member's own node or connectivity is attributed to the member and excluded from DepositX's number, but is reported.
- Cloud, carrier and vendor failures count against DepositX (fourth-party risk is ours).
- **Protective halts count in the measured availability.** The rulebook carves them out of SLA credits only where they were correctly triggered by a real invariant risk. They are always reported as a separate category so nobody can hide a halt behind a definition.

**Error budget policy (99.999% objective)**
- Annual budget about 5.26 minutes, quarterly about 1.31 minutes.
- More than 50% of a quarter's budget burned: freeze feature releases, prioritise reliability work.
- 100% burned: executive review, member notification, and reliability-only work until the trailing window recovers.
- Multi-window burn-rate alerts (for example a fast window and a slow window) page before the budget is gone.
- Planned change is charged to the budget. Rolling upgrades under the maintenance budget must produce zero measured downtime.

### 5.4 Measuring availability for the exit criterion

1. **Freeze the definition first.** SLI, exclusions, attribution rules, vantage points and the measurement window are ratified in the rulebook by the end of Phase 2. No changes during the window.
2. **Independent measurement.** Probes run from at least one independent point not operated by DepositX (for example a member or a third-party monitoring provider). Measurement records are signed and written to the audit log.
3. **Independent attestation.** An external auditor performs a quarterly agreed-upon-procedures engagement on the availability report (Canadian standard for such engagements, verify).
4. **Second-level resolution.** Downtime is counted in seconds, using the union of synthetic and real-traffic failures.
5. **Complementary evidence.** Since two quarters cannot prove process capability, the exit also requires:
   - chaos and drill success rates,
   - MTTR distribution,
   - the error-budget policy operating without exceptions,
   - a zero count of unresolved SEV-0 and SEV-1 actions.
6. **Shadow measurement from the pilot.** Run the same probes and definitions from the first pilot day (Q3 2027) so the definition is exercised before it counts.

---

## 6. Phased security and SRE plan

### 6.1 Calendar reconciliation with the blueprint

Today is 25 September 2026. Phase 0 starts in about a week.

| Blueprint item | Blueprint date | Assessment | Recommendation |
|---|---|---|---|
| Phase 0 exit (operator incorporated, architecture ratified) | Q4 2026 | Tight but possible for security deliverables if D6 and D7 are approved in October | Keep. Ratify security architecture and threat model v1 by end of Q4 |
| Phase 1 exit: 10,000 simulated transfers, zero par breaks | H1 2027 | Achievable but statistically weak (0.03% bound at 95%) | Keep as smoke test. Add differential fuzzing, property-based tests and formal-specification progress as the real evidence |
| Phase 1: ZK performance meets target or fallback chosen | H1 2027 | Fallback is named but not designed (a blueprint known issue) | Design the fallback in Phase 1 (below) |
| Phase 2: formal verification of par and settlement contracts | H2 2027 to H1 2028 | Feasible only if contract code and specification freeze by about Q4 2027. Verification takes months and must be redone if the ZK layer changes | Add a spec-freeze gate. Verification results by Q1 to Q2 2028 |
| Phase 2: SOC 2 Type I | H1 2028 | Feasible | Type I as at 31 December 2027, report about February 2028 |
| Phase 2: first external audit, bug bounty | Phase 2 | Feasible | Private bounty from Phase 1, public on mirror in Phase 2 |
| Phase 2 exit: DR drill RTO under 15 min, RPO 0 | H1 2028 | Feasible for the drill. Not equal to 99.999% | Keep. Add the SLO ladder |
| Phase 3: SOC 2 Type II | H2 2028 | Feasible only if the observation window opens by about 1 January 2028 (verify with auditor) | Start observation in Phase 2. Otherwise Type II slips to H1 2029 |
| Phase 3: TLPT (not in blueprint) | Before go-live | Needs 4 to 6 months of scoping, intelligence and execution | Run against the pilot in Q1 to Q2 2028 |
| Phase 3 exit: 99.999% sustained over two quarters | H2 2028 | **Impossible inside H2 2028.** Go-live sits inside the same half-year | Split the exit (below) |
| Phase 3 exit: independent PFMI observance rating | H2 2028 | Ratings depend on operating history and on who does the rating (verify with counsel and BoC) | Deliver self-assessment and independent review. Any formal rating comes after operating history |
| ISO 27001 (not in blueprint) | Add | Feasible if the ISMS starts in Phase 1 | Certificate Q2 to Q3 2028 |
| Document title says four-phase, defines five | n/a | Known issue | Call it a five-phase roadmap (0 to 4) |
| BoC as observer | Assumed | Unconfirmed | Non-voting, not relied on (section 2.3) |

**Why the 99.999% exit cannot fit**
- Phase 2 does not end until supervisory non-objection to lift the value cap (H1 2028).
- Go-live with all founding issuers is inside H2 2028.
- Two full quarters must follow go-live. If go-live were 1 October 2028, the window is Q4 2028 plus Q1 2029, closing 31 March 2029, with the attested report about a month later.
- A mid-quarter go-live pushes the first full quarter to the next calendar quarter, so the window closes at the end of Q2 2029.
- Even an aggressive plan therefore exits between April and July 2029.

**Recommended split**
- **Phase 3 gate (target end of Q4 2028):**
  - 99.99% over the first full production quarter or the trailing 90 days,
  - all resilience drills passed,
  - independent attestation of controls (SOC 2 Type II if the window allows),
  - supervisory queries met under load.
- **Phase 4 entry gate (target Q2 2029, latest Q3 2029):**
  - 99.999% over two consecutive full quarters per the frozen definition,
  - independent attestation of the availability report,
  - independent PFMI assessment complete.
- Phase 4 retail work should not start until the Phase 4 entry gate passes. Retail scale raises the cost of every outage.

**ZK fallback (needs design in Phase 1)**
- The blueprint names a fallback but does not design it. From a security view, I need the fallback to keep the invariants:
  - Confidential balances and amounts are replaced by a permissioned-privacy model where issuers hold their own balance data and the ledger holds commitments and supply attestations, with need-to-know disclosure.
  - Inflation resistance must not weaken. Conservation must remain enforced on-ledger.
- Design the fallback and its threat model by end of Q2 2027 so the Phase 1 go or no-go is real.

### 6.2 Phase plan

**Phase 0: Foundations (Q4 2026)**

*Deliverables*
- DepositX Security Standard v0.1 and unified control framework (mapped to B-13, B-10, E-21, PFMI 8, 16, 17, ISO 27001 Annex A and SOC 2 criteria).
- Threat model v1 (this memo's tables, validated with founding banks' security teams).
- Trust-zone reference architecture and network design.
- Crypto and HSM decision memo: algorithm suite, FIPS 140-3 status, vendor shortlist, procurement started (D6).
- Key management policy and ceremony design v0.
- Incident response and severity model v0, communication protocol draft.
- DepositX CSP v0 outline and membership security schedule for rulebook v0.
- Regulatory engagement plan for cyber and resilience topics with OSFI and BoC.
- Legal question list to counsel (section 3.5).
- Hire CISO-designate and SRE lead (D7).

*Staffing:* 5 to 7 (CISO-designate, security architect x2, GRC lead, SRE architect, PKI or HSM engineer), largely seconded or contracted.

*Exit tests*
- Threat model reviewed by security teams of at least two founding banks, with every high finding dispositioned.
- Crypto and HSM decision ratified. Purchase orders placed.
- Control framework mapped with zero unmapped B-13 outcomes.
- Table-top of a key compromise and a par break run with founding-bank representatives.
- Security and resilience decisions D1 to D8 ratified.

**Phase 1: Sandbox testnet (H1 2027)**

*Deliverables*
- Testnet on the target zone topology, n = 4, f = 1, using real HSMs.
- CI and build pipeline with reproducible builds, SBOM and signed provenance. Two independent builders.
- Dress-rehearsal key ceremony on real HSMs with an independent observer.
- First penetration test of the gateway and testnet. External architecture review.
- Cryptographer review of the confidentiality design. ZK go or no-go with a designed fallback.
- Par-invariant runtime monitor and reconciliation prototype.
- Signed audit log prototype with a member witness.
- First chaos game days. Second-implementation shadow verifier started.
- PFMI gap assessment for principles 8, 16 and 17. ISMS started.
- Private bug bounty. Vendor and fourth-party register.
- Design of CSP v1 and onboarding certification test suite.

*Staffing:* 12 to 16.

*Exit tests* (in addition to the blueprint's 10,000 transfers)
- 100% of testnet releases reproduced bit-for-bit by two independent builders.
- Dress-rehearsal ceremony completes with a signed independent report and zero unresolved deviations.
- Killing the leader validator keeps p99 finality under 5 s (measured over at least 1,000 injected events).
- Injected par-break test: monitor triggers issuer-scoped freeze in under 60 seconds.
- No open critical or high pen-test finding older than 30 days.
- Benchmark shows latency and throughput under the chosen signature scheme (section 1.3).
- Fallback design for the confidentiality layer approved.

**Phase 2: Regulated pilot (H2 2027 to H1 2028)**

*Deliverables*
- Pilot on n = 7, f = 2, with Toronto and Montreal regions plus witness, and production-grade HSMs.
- First production-grade key ceremonies (Q4 2027), then quarterly.
- SOC 2 Type I (as at 31 December 2027). Type II observation opens 1 January 2028.
- Two independent contract and circuit audits. Formal verification of par and settlement contracts by an independent team, with proofs published (spec freeze around Q4 2027).
- First red team (Q1 to Q2 2028) and the threat-intelligence-led test.
- ISO 27001 Stage 1 and 2 (Q2 2028).
- Public bug bounty on the production mirror.
- DR drills including region loss, and halt and resume drills with members and supervisors.
- CSP v1 in force. All pilot members attest.
- Shadow availability measurement from the first pilot day.
- Signed audit log with member witnesses. Supervisory read-node with query classes tested at scale.
- Due-diligence pack v1 (section 7.2). First pooled audit.

*Staffing:* 22 to 30, plus an MSSP for 24/7 monitoring (Canada-based, verify) and external assurance vendors.

*Exit tests*
- Zero open critical or high findings from audits and pen tests. Formal proofs re-checked by a second party and published.
- DR drill: RTO under 15 minutes, RPO 0, timed and witnessed by a member.
- Pilot availability (shadow SLI) at least 99.9% over the final 90 days, with every incident post-mortemed.
- Halt and resume drill completed with all validating members in under a target time set in advance (suggest 60 minutes for resume after an injected halt).
- Every founding issuer has passed the CSP assessment.
- Two consecutive key ceremonies with zero deviations.
- Frozen availability definition ratified in the rulebook.
- Supervisory Q1 to Q3 SLOs met on synthetic three-year-scale data.

**Phase 3: Production, wholesale (H2 2028, with gate at end Q4 2028)**

*Deliverables*
- Production topology n = 10, f = 3 (or as many voting members as exist, with the fault margin explicitly stated).
- 24/7 operations: on-call rotation of at least 8 qualified SREs, SOC with MSSP support, incident commander rota.
- Load and chaos evidence at 2 times burst with degraded state.
- SOC 2 Type II report (timing depends on observation window). ISO 27001 certificate. SOC 1 if required.
- TLPT complete before go-live, remediation done.
- Second independent contract audit cycle for anything changed since Phase 2.
- Shadow verifier running on production. Client diversity plan for Phase 4.
- Full PFMI self-assessment. B-10 due-diligence completed for each founding bank.
- Monthly game days. Twice-yearly region drills.
- PQ-hybrid encryption for on-ledger encrypted payloads and transport (do not wait for Phase 4, section 6.3).

*Staffing:* about 26 in the operator run team (roughly 12 to 14 SRE, 6 to 8 SecOps and SOC, 4 to 5 GRC and assurance, 3 for keys and PKI, 2 for incident response), out of the blueprint's 40 to 60 operator total. A build-pod tail of 6 to 8 remains.

*Gate tests (end 2028)*
- 99.99% availability over the first full production quarter (or trailing 90 days), independently measured.
- No SEV-0. Any SEV-1 has a completed root-cause and remediation.
- Supervisory query SLOs met in production.
- Zero par breaks and zero client-money loss.
- All Phase 2 exit controls still operating.

**Phase 4: Scale and retail (2029 onward)**

*Entry gate:* 99.999% over two consecutive full quarters (earliest about Q2 2029), independent PFMI assessment complete.

*Security and SRE deliverables*
- Second full client implementation.
- PQ migration for signatures on all validators and HSMs (NIST FIPS 203, 204 and 205 were finalised in 2024. HSM support and Canadian federal migration timelines: verify).
- Long-term validity of on-ledger signatures for legal retention (re-timestamping and re-signing plan).
- Retail-specific threat model (customer-facing risk, fraud, privacy, PCI re-scoping if cards are involved).
- Validator-set scaling decision (voting cap).
- Cross-border corridor security assessment.

*Exit tests:* PQ signatures live on all validators, retail launch security review passed, corridor controls independently assessed.

### 6.3 Post-quantum timing

- PQ signatures for validators can wait until Phase 4, because forged signatures matter at time of use.
- **Confidentiality data cannot wait.** Every validator stores confidential data forever. Encryption of on-ledger payloads and key exchange based on classical elliptic curves is exposed to "harvest now, decrypt later."
- Recommendation: from Phase 2 use hybrid key exchange (a classical curve plus ML-KEM, verify chosen parameters) for any encrypted on-ledger content and for TLS. Keep a cryptographic bill of materials from Phase 1.
- Commitment binding based on discrete-log assumptions is a separate post-quantum risk (counterfeiting after a quantum break). Ask the cryptographers to assess this in Phase 1.

### 6.4 Staffing and cost summary

| Phase | Security and SRE headcount | Notes |
|---|---|---|
| 0 | 5 to 7 | Seconded and contracted |
| 1 | 12 to 16 | First HSM operators |
| 2 | 22 to 30 | Plus MSSP and assurance vendors |
| 3 | About 26 in operator run team, plus 6 to 8 build tail | Within the operator's 40 to 60 |
| 4 | Scale with retail | To be planned |

Rough planning estimate (low confidence, plus or minus 50%): CAD 30 to 45 million through end of Phase 3 for the Security and SRE seat. This covers about 40 person-years of staff, infrastructure and HSMs, security tooling, external assurance (audits, formal verification, pen tests, red team, SOC 2, ISO), bug bounty pool and MSSP. It excludes each member's own integration and security costs. This is not from the blueprint, which gives no breakdown. Finance should replace it with a bottom-up estimate.

---

## 7. Top risks and the bank due-diligence pack

### 7.1 Top 10 security and resilience risks

| # | Risk | Likelihood / impact | Mitigation | Owner | Phase |
|---|---|---|---|---|---|
| 1 | **Common-mode software defect** in consensus, ledger or contract shared by all validators (X1, B4) | Medium / Severe | Formal verification, two independent audits, shadow verifier, second client (Phase 4), staged activation, replay testing, fuzzing, deterministic simulation | Head of Platform with CISO | 1 to 4 |
| 2 | **ZK or confidentiality-layer flaw** enabling undetectable inflation or leakage (X2, B5) | Medium / Severe | Independent cryptographer review, transparent setup preferred, supply reconciliation against bank core liabilities, designed fallback, PQ-hybrid encryption | CISO with Cryptography lead | 1 to 3 |
| 3 | **Member endpoint compromise** leading to fraudulent mint or transfers (X3, B1, B3) | High / High | DepositX CSP with annual attestation, K4 and K4b dual attestation, velocity caps and time-locks, freeze authority, anomaly detection | CISO, member CISOs | 0 to 3 |
| 4 | **Operator insider or governance capture** (B2, X4) | Low to Medium / Severe | No unilateral authority, on-ledger multi-sig, time-locks, external log witnesses, single operator vote, f covers operator plus two banks | Board, CISO | 0 to 3 |
| 5 | **Availability shortfall or correlated outage** (B6, X5) (single provider, carrier, misconfiguration, certificate expiry, DDoS) | High / High | Two-provider hosting, metro pair plus witness, diverse carriers, chaos programme, SLO ladder, change safety, certificate automation | Head of SRE | 1 to 4 |
| 6 | **Supply-chain compromise** of build, dependency, HSM firmware or prover (B7) | Medium / Severe | Reproducible builds with two verifiers, multi-party signing, pinned and vendored dependencies, SBOM and VEX, firmware verification, vendor provenance checks | CISO | 1 to 4 |
| 7 | **Governance deadlock or slow decision during an incident** (X4) | Medium / High | Pre-delegated bounded emergency powers, alternates for every signer, twice-yearly quorum drills, f+1 halt threshold, communication protocol | Board, Head of SRE | 0 to 3 |
| 8 | **Key ceremony or custody failure** (lost shares, procedural error, custodian departure) (B3) | Medium / High | m-of-n with wide n, custodian diversity across banks, quarterly recovery rehearsal, independent attestation, escrowed recovery procedure | CISO | 1 to 3 |
| 9 | **Halt handling failure** (halt not triggered, mis-triggered, weaponised, or banks unprepared) (B4, B6) | Medium / High | Scoped freeze first, f+1 halt threshold, twice-yearly drills with members and supervisors, DepositX-off playbooks, cold-start rehearsal | Head of SRE | 1 to 3 |
| 10 | **Legal and regulatory perimeter gaps** (unclear oversight, finality basis, sovereignty, third-party-risk acceptance) cause banks to refuse onboarding (X6) | High / High | Early engagement with OSFI and BoC, counsel on section 3.5 questions, Canadian-controlled key custody, due-diligence pack on time, audit-rights schedule | Board, General Counsel, CISO | 0 to 3 |

Watch list (not in the top 10 but tracked): scarce specialist talent (formal verification, ZK, HSM), schedule pressure eroding assurance, supervisory access abuse (X7), destructive attack on a member (X8), cryptographic obsolescence (X9), and burnout risk in a small 24/7 team.

### 7.2 Bank security due-diligence pack

What a large bank's third-party risk and security teams will ask for, and when we can honestly produce each. "Draft" means we can show a controlled draft under NDA, not a final artefact.

| # | Artefact | Earliest availability | Confidence |
|---|---|---|---|
| 1 | Security architecture description and trust-zone diagrams | Draft Q4 2026, v1 Q2 2027 | High |
| 2 | Threat model summary | v1 Q4 2026, refreshed each phase | High |
| 3 | Control framework and mapping to B-13, B-10, E-21, PFMI, NIST CSF, ISO 27001, SOC 2 | Draft Q1 2027, complete Q4 2027 | High |
| 4 | Policy set (information security, access, cryptography and key management, change, vulnerability, incident response, BCM, third-party risk, data classification, privacy, HR security) | v1 Q2 2027, approved once the operator entity exists | Medium (depends on operator incorporation) |
| 5 | Shared Assessments SIG questionnaire (edition verify) and CAIQ, pre-filled | Lite version Q2 2027, full Q4 2027 | Medium |
| 6 | Cryptographic architecture and key management policy | Draft Q4 2026 | High |
| 7 | HSM validation certificates (FIPS 140-3 numbers) | At procurement, Q1 2027 | Medium (verify vendor status) |
| 8 | Key ceremony scripts and reports | Dress rehearsal report Q2 2027, production ceremony Q4 2027 | High |
| 9 | SBOM, VEX statements, build provenance | Testnet builds Q2 2027, published Phase 2 | High |
| 10 | Pen-test executive summaries and attestation letters | Testnet Q2 2027, pilot Q4 2027, annual thereafter | High |
| 11 | Smart-contract and ZK circuit audit reports | First Q3 2027, second Q4 2027, public Q2 2028 | Medium |
| 12 | Formal verification specifications and published proofs | Q1 to Q2 2028 | Medium (depends on spec freeze) |
| 13 | Business continuity and DR plan | Draft Q3 2027 | High |
| 14 | DR drill, chaos and load-test results | First results Q4 2027, full evidence Q2 2028 and Q4 2028 | Medium |
| 15 | Incident response plan, communication protocol, contact tree, tabletop reports | Plan Q2 2027, first joint tabletop Q3 2027 | High |
| 16 | Halt and resume drill report | Q1 to Q2 2028 | Medium |
| 17 | Availability and SLO reports | Shadow from Q3 2027, attested from 2029 | Medium |
| 18 | Fourth-party and subcontractor register, concentration analysis | Q2 2027 | High |
| 19 | Data residency and sovereignty analysis | Draft Q1 2027 (needs counsel) | Medium |
| 20 | Privacy impact assessment | Q3 2027 (verify with counsel) | Medium |
| 21 | Personnel security and insider-threat programme description | Q2 2027 | High |
| 22 | Vulnerability disclosure policy and bug bounty terms | Private Q2 2027, public Q2 2028 | High |
| 23 | Membership security schedule and audit-rights terms | With rulebook v0 (Q4 2026), refined Q2 2027 | High |
| 24 | DepositX CSP, attestation template, certification test suite | v0 Q4 2026, v1 Q3 2027 | High |
| 25 | SOC 2 Type I report | About February 2028 | Medium (verify auditor timeline) |
| 26 | ISO 27001 certificate and Statement of Applicability | SoA draft Q4 2027, certificate Q2 to Q3 2028 | Medium |
| 27 | SOC 2 Type II report | Q4 2028 if the window opens by January 2028, otherwise H1 2029 | Low to Medium |
| 28 | Red-team and TLPT attestation summary | Q2 2028 | Medium |
| 29 | Exit, step-in and escrow arrangements | Draft Q3 2027, final Q2 2028 | Medium (needs legal work) |
| 30 | Insurance certificates (cyber, crime, errors and omissions) | Q2 2028 (verify market availability and limits) | Low |
| 31 | Regulatory correspondence summary | As agreed with OSFI and BoC | Low (depends on regulators) |
| 32 | PFMI self-assessment and disclosure framework | Gap assessment Q2 2027, full assessment Q3 to Q4 2028 | Medium |
| 33 | Legal opinions on finality and insolvency protection | Outside CISO scope. Needed early because bank third-party teams will ask | Low (depends on counsel) |
| 34 | Independent availability attestation for the 99.999% claim | Earliest Q2 to Q3 2029 | Low |

**What we cannot produce, and should say so:** SOC 2 Type II, ISO certificate, TLPT results and any availability history do not exist before mid-2028 at the earliest. Bank teams will accept a credible dated plan with interim evidence (readiness assessments, Type I, drill reports, private reading-room access to audit findings) if we are transparent about it. Overclaiming here would damage trust with the very teams we need.

---

## 8. Open items and uncertainty register

1. FIPS 140-3 validation status and Ed25519 or BLS support per HSM vendor (verify).
2. Whether 140-2 certificates moved to the historical list on or about 21 September 2026 (verify with CMVP).
3. Exact OSFI dates and expectations for B-13, B-10, E-21, the integrity and security guideline, E-23 and the incident reporting advisory (verify with counsel).
4. PFMI principle wording (two-hour recovery benchmark, secondary-site expectations) (verify against the CPMI-IOSCO text).
5. Payment Clearing and Settlement Act designation and the operator's regulatory status (verify with counsel).
6. Status of federal critical cyber systems legislation (verify with counsel).
7. CSAE 3416 versus SOC 2 acceptance, SOC 1 need, and Type II observation-window length (verify with auditor and bank auditors).
8. Latency figures between Canadian regions and cloud AZ counts (measure in Phase 0 and 1).
9. Feasibility of neutral validators and the identity of the operator of any (verify politically and legally).
10. BoC observer participation (unconfirmed in the blueprint).
11. Insurance market capacity for cyber and crime cover for this kind of network.
12. Whether wholesale demand justifies 5,000 sustained instructions per second (demand model needed).
13. Whether the chosen confidentiality scheme needs a trusted setup (undecided in the blueprint).
14. Cost estimates in section 6.4 (planning estimates only).
15. **Added by the operator:** whether the signed audit log (§5.1) and the compliance-screening model need a caller-type field so a supervisory query can distinguish a human-initiated instruction from one initiated by a member institution's own authenticated software agent acting under the same keys — trust and verification of the *caller*, not just the transaction, is a real requirement as agentic treasury automation grows, not a hypothetical.
