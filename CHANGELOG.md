# Changelog - AgenticPay AI 📜

All notable changes to this project will be documented in this file.

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
