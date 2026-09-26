# Concord Network — Execution Pack

Board-reviewed roadmap and technical implementation for the Concord tokenized-deposit settlement network (Canada), built from the KPMG Blueprint v0.9 (2 Sep 2026).

**Status: proposed, not ratified.** Six AI-simulated board seats reviewed the blueprint; `00` records where they agreed, where they disagreed, and how the disagreement was resolved. Legal, regulatory, accounting and financial content is a workplan for real counsel and real bank executives to validate, not advice. Unverified facts are marked **[V]**.

## Read in this order

| # | File | What it is |
|---|---|---|
| 00 | [00-board-resolutions.md](00-board-resolutions.md) | The verdict, reconciled disagreements (C1–C11), 11 decisions with dates, open items |
| 01 | [01-execution-roadmap.md](01-execution-roadmap.md) | Phases, dates (plan vs commit), critical path, 30/60/90 days, workstreams, money and people, programme governance |
| 02 | [02-technical-implementation.md](02-technical-implementation.md) | Platform decision, par invariants P1–P7, settlement, confidentiality modes, security and resilience, engineering plan, spikes S1–S10 |
| 03 | [03-bank-onboarding-playbook.md](03-bank-onboarding-playbook.md) | Participant tiers, 8-stage funnel, due-diligence pack, integration, certification, waves, onboarding office |
| 04 | [04-gates-risks-amendments.md](04-gates-risks-amendments.md) | Gate criteria, kill/pivot triggers, risk register, north stars, claims discipline, 25 blueprint amendments |

## Proof of concept (running)

[poc/](poc/README.md) is a working model of the ledger kernel: atomic cross-bank settlement, DvP, netting, the P1–P7 invariants and the graded halt, with a live dashboard.

```
cd ~/Concord/poc && npm test && npm start     # http://127.0.0.1:8787
```

## Source material

- `source/blueprint-v0.9.md` — the blueprint as given to the board (condensed, with a known-issues list)
- `board/` — the six full seat memos (about 89,000 words): CTO, CISO/SRE, Legal & Regulatory, Bank Onboarding, CFO/COO, Strategy & Risk. The master documents cite section numbers here for detail.

## The five things to know

1. **22 Sep 2026: the six largest banks announced their own CAD tokenized-deposit exploration.** Decide by 9 Oct whether Concord is that initiative's neutral operator, its second-tier complement, or something else.
2. **The settlement asset is the biggest hole.** Without a written Bank of Canada / Payments Canada arrangement there is no interbank finality or par.
3. **Legal finality and par are goals to be earned, not claims to be made.** Do not use "settles in under two seconds with legal finality" externally yet.
4. **Production moves from H2 2028 to 30 Nov 2029 (plan), Nov 2030 (commit).** Regulators and bank onboarding are the critical path, not the technology.
5. **Economics are a strategic option, not an ROI case:** $473M ecosystem to acceptance (range $317–821M); large-bank NPV about −$78M on base assumptions.
