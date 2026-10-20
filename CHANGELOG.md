# Changelog

All notable changes to this project are documented in this file.

---

## [0.6.0] - 2026-10-20

### Added

- Centralized ledger helper `applyTransactionLogToProjects`. Only `PAYOUT_EXECUTED` events increment `spentUSD`, preventing duplicate settled amounts across workspace and chat flows.
- Ledger test suite covering payout idempotency and non-payout events.
- Intake link generation using the current application origin and a sanitized contract slug: `/escrow/intake/{slug}`.
- Clipboard states `IDLE`, `COPIED`, and `FAILED` with an explicit manual-copy fallback.
- Exclusive subcontract status badge (`SUBCONTRACTED` vs `DIRECT HIRE`) and parent mandate name in portfolio and workspace views.
- Remaining-project-budget checks before milestone release and before agent-chat payout attempts.
- Directional header metrics for outbound escrow cap, inbound escrow cap, settled, and claimed amounts.
- Business-only enterprise capacity card behavior.

### Changed

- Separated account type from contract perspective. Removed in-app session switching and legacy organization presets.
- Freeze controls are available only for outbound contracts.
- Workspace role labels standardized to `Client (Escrow Funder)` and `Contractor (Escrow Beneficiary)`.
- Portfolio capacity labels standardized to `Escrow Guarantee` and `Vault Ceiling`.
- Compliance and escrow health are derived from account and envelope state rather than hardcoded session metadata.
- Documentation reconciled with the implemented API, guardrails, tests, and deployment configuration.

### Fixed

- Audit route returns HTTP `423` when the kill-switch is active, with a rejected settlement contract.
- Local storage hydration guards against invalid or partial JSON.
- Portfolio and workspace settled amounts remain consistent after repeated ledger updates.
- Contract freeze blocks release for outbound contracts.
- Inbound contracts no longer expose the client-side freeze action.

### Validation

- Five Jest suites and 58 checks passing.
- TypeScript validation passing.
- Production build passing.

---

## [0.5.1] - 2026-10-15

### Fixed

- Renamed PostCSS and Tailwind configuration files to `.cjs` for Next.js 16 webpack compatibility.
- Added Turbopack alias configuration for local development while preserving the webpack production build.

---

## [0.5.0] - 2026-10-12

### Added

- Deterministic `PayPal-Request-Id` idempotency headers for payout requests.
- `$1,000 USD` autonomous settlement ceiling.
- Human authorization workflow for milestones above the ceiling with audit scores of at least 85%.
- Deliverable context isolation inside `<deliverable_data>` blocks.
- Deliverable payload limit of 12,000 characters.
- Expanded pattern-based prompt-injection detection.
- Expanded unit and integration test coverage.

---

## [0.4.2] - 2026-10-12

### Added

- Actionable onboarding states for outbound and inbound empty portfolios.
- Client escrow intake link with clipboard feedback.
- Enterprise capacity card for shorter portfolio columns.
- Contextual filter reset when search returns no results.

---

## [0.4.1] - 2026-10-12

### Added

- Two-column master swimlanes for outbound and inbound contracts.
- Global search and status filters across both streams.
- Focus toggle for dual, outbound-only, and inbound-only views.

---

## [0.4.0] - 2026-10-12

### Added

- Dual executive summary panels.
- Focused workspace architecture.
- Contextual financial perspective indicators.

### Changed

- Standardized enterprise fintech terminology across portfolio views.

---

## [0.1.0] - 2026-10-07

### Added

- Initial architecture and project documentation.
- Next.js application scaffold.
- MIT license.
- Repository setup for PayPal AI Hackathon 2026.
