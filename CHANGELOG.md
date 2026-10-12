# Changelog - AgenticPay AI 📜

All notable changes to this project will be documented in this file.

---

## [0.5.0] - 2026-10-12 (Post-Premortem Resilience & Dual-Key Financial Governance)

### Added
- **Cryptographic Idempotency in PayPal REST API:** Injected deterministically derived `PayPal-Request-Id` headers into all `/v1/payments/payouts` calls and logs, mathematically preventing duplicate milestone payouts caused by network retries or concurrent events.
- **Tiered Human-in-the-Loop Financial Governance:** Established strict `$1,000 USD` ceiling for autonomous unattended AI escrow release (`AUTONOMOUS_SETTLEMENT_CAP_USD`).
- **Dual-Key Authorization Workflow (`AUDITED_PENDING_APPROVAL`):** Milestones exceeding `$1,000 USD` with $\ge 85\%$ audit scores are verified by AI but held in escrow until an enterprise manager signs off with one click in the dashboard.
- **Deliverable Context Isolation:** Bound deliverable inputs inside opaque `<deliverable_data>` XML containers to insulate downstream evaluation from prompt smuggling.
- **Economic DoS & Token Depletion Defenses:** Implemented `validatePayloadSize` (12,000 characters limit) and expanded OWASP LLM01 detection against HTML comment injection, role hijacking, and developer mode prompts.
- **Comprehensive Unit & Integration Test Coverage:** Expanded test suite from 42 to 52 passing tests (100% pass rate).

---

## [0.4.2] - 2026-10-12 (Enterprise UX: Actionable Onboarding & Asymmetry Balancing)

### Added
- **Actionable Onboarding Empty States:** Replaced inert empty messages with institutional onboarding hubs (*Accounts Payable Procurement Hub* on Outbound / *Accounts Receivable Intake Hub* on Inbound).
- **Interactive Client Escrow Intake Link:** Integrated one-click link generator (`agenticpay.ai/escrow/...`) with clipboard feedback for inviting prospective enterprise clients to pre-fund escrow envelopes.
- **Enterprise Capacity & Intake Card:** Dynamic visual expansion card in shorter columns balancing visual height and eliminating dead space.
- **Instant Search Filter Reset:** Contextual filter reset button (`Reset Filters`) when searches yield zero results.

---

## [0.4.1] - 2026-10-12 (Enterprise UX: Two-Column Master Swimlanes)

### Added
- **Integrated Two-Column Master Swimlanes:** Seamlessly embedded the Executive Summary cards with their respective contract feeds in two parallel 50/50 columns (Left: Outbound Accounts Payable / Right: Inbound Accounts Receivable).
- **Global Utilities Toolbar:** Search and status filtering work simultaneously across both swimlanes with zero redundant tab controls.
- **Swimlane Focus Toggle:** Added interactive toggle (`Dual Split View | Managed Only | Assigned Only`) allowing users to inspect both streams side-by-side or maximize either stream.

### Changed
- Eliminated redundant secondary tab controls beneath the executive summaries.
- Updated `DESIGN_SYSTEM.md`, `ARCHITECTURE.md`, and `README.md` to reflect the Master Swimlane layout.

---

## [0.4.0] - 2026-10-12 (Enterprise UX: Dual Executive Split)

### Added
- **Dual Executive Command Panels (Split-Screen 50/50):** Twin executive cards side-by-side in `ProjectPortfolioView` showcasing parallel balances for *Managed Contracts (Outbound Escrow / Accounts Payable)* and *Assigned Contracts (Inbound Receivables / Accounts Receivable)*.
- **Focused Workspace Architecture:** Single-click operational role switching maintaining 100% full-width grid density, removing clutter and preventing asymmetric scrolling.
- **Contextual Workspace Indicators:** Dynamic header alerts and visual badges reflecting active financial perspective and zero-trust audit safeguards.

### Changed
- Standardized institutional enterprise fintech nomenclature across all portfolio views.
- Updated `DESIGN_SYSTEM.md`, `ARCHITECTURE.md`, and `README.md` to reflect the Dual Executive Split pattern.

---

## [0.1.0] - 2026-10-07 (Phase 1: Planning & Setup)

### Added
- Defined master architecture and project vision for **AgenticPay AI**.
- Initialized core documentation repository structure (`README.md`, `LICENSE`, `ARCHITECTURE.md`, `.env.example`, `CONTRIBUTING.md`).
- Designed multi-tier implementation strategy for PayPal AI Hackathon 2026.
