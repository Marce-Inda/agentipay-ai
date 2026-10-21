# Changelog

All notable changes to this project are documented in this file.

---

## [0.6.1] - 2026-10-20

### Changed

- Corrected documentation to distinguish implemented behavior from planned capabilities.
- Documented that workspace releases record local `PAYOUT_EXECUTED` events and do not call PayPal.
- Documented that the PayPal client runs in the browser without access to `PAYPAL_CLIENT_SECRET`.
- Documented the audit route's GitHub URL auto-pass, the AI chat's hardcoded 98% confidence, per-call idempotency keys, and the absence of ledger deduplication.
- Documented the missing `/escrow/intake/{slug}` route and unauthenticated API endpoints.
- Marked strategy and historical planning documents as non-current where their claims exceed the implementation.

---

## [0.6.0] - 2026-10-20

### Added

- Centralized ledger helper `applyTransactionLogToProjects`. Only `PAYOUT_EXECUTED` events increment `spentUSD`; duplicate log IDs are not deduplicated.
- Ledger test suite covering payout increment behavior and non-payout events.
- Intake link generation using the current application origin and a sanitized contract slug: `/escrow/intake/{slug}`. The target page is not implemented.
- Clipboard states `IDLE`, `COPIED`, and `FAILED` with an explicit manual-copy fallback.
- Exclusive subcontract status badge (`SUBCONTRACTED` vs `DIRECT HIRE`) and parent mandate name in portfolio and workspace views.
- Remaining-project-budget checks before local milestone settlement and before agent-chat guard checks.
- Directional header metrics for outbound escrow cap, inbound escrow cap, settled, and claimed amounts.
- Business-only enterprise capacity card behavior.

### Changed

- Separated account type from contract perspective. Removed in-app session switching and legacy organization presets.
- Freeze controls are available only for outbound contracts.
- Workspace role labels standardized to `Client (Escrow Funder)` and `Contractor (Escrow Beneficiary)`.
- Portfolio capacity labels standardized to `Escrow Guarantee` and `Vault Ceiling`.
- Compliance and escrow health are derived from account and envelope state rather than hardcoded session metadata.
- Documentation updated. Several settlement and audit claims were still overstated in this release and were corrected in 0.6.1.

### Fixed

- Audit route returns HTTP `423` when the kill-switch is active, with a rejected settlement contract.
- Local storage hydration guards against invalid or partial JSON.
- Ledger updates are centralized for workspace and chat flows.
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

- `PayPal-Request-Id` headers generated per payout call using time and random values. These are not deterministic and do not prevent duplicate payouts.
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
