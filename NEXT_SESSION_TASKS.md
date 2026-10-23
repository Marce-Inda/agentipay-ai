# Current Status and Next Session Tasks

## Status

- **Version:** 0.6.1
- **Automated tests:** 12 suites, 126 passing checks
- **Build:** production build configured with webpack
- **Deployment:** Docker and Render blueprint included; live verified Sandbox payout pending
- **Settlement rail:** server-side PayPal Payouts executor wired into `/settle` with a deterministic `PayPal-Request-Id`; real Sandbox rail with credentials, honest simulated/suppressed rails (fail-closed) without them; production without credentials rejects settlement
- **Persistence:** browser `localStorage` cache + PostgreSQL durable ledger (production requires `DATABASE_URL`)
- **AI:** streamed OpenAI/OpenRouter or Gemini assistant with fallback model

Implemented:

- Dual outbound/inbound escrow portfolio.
- Contract and milestone management.
- Deterministic guardrails for budget, freeze, kill-switch, audit confidence, and human approval.
- Heuristic deliverable audit with a known GitHub URL bypass.
- Authentication, tenant isolation, PostgreSQL-backed sessions, and durable server-side ledger.
- Server settlement path with atomic rollback, duplicate-rejection, and kill-switch enforcement.
- PayPal Sandbox payout executor: real rail (OAuth + `/v1/payments/payouts` with deterministic `PayPal-Request-Id`), simulation rail, and suppressed fail-closed rail.
- AG Grid ledger with payload inspection.
- Tenant-scoped browser persistence with server reconciliation.
- Subcontracting metadata and parent mandate display.

Not implemented:

- Role-based authorization, email verification, and password recovery.
- PayPal webhooks, refunds, disputes, and payout reconciliation.
- Live verified Sandbox payout against developer.paypal.com.
- Production PayPal onboarding.
- KYC/KYB and sanctions screening.
- Subscription billing or usage metering.
- Multimodal vision audit.
- Automated browser or end-to-end tests.

---

## Priority 1: Repository and release hygiene

- [ ] Review the working tree and separate documentation changes from code changes.
- [ ] Commit the Phase 1–4 implementation changes with focused commit messages.
- [ ] Confirm no `.env` file, secret, or local planning document is tracked.
- [ ] Confirm the default branch builds from a clean checkout.
- [ ] Tag the release only after the working tree is clean.

Validation:

```bash
git status
npx tsc --noEmit
npm test -- --runInBand
npm run build
```

---

## Priority 2: Production hardening

### Identity and access

- [ ] Add authentication.
- [ ] Add role-based authorization for account and contract operations.
- [ ] Add tenant isolation.
- [ ] Add session expiration and secure cookie handling.

### Persistence and audit

- [ ] Move profile, contracts, milestones, envelope, and logs to server-side storage.
- [ ] Add an append-only audit event model.
- [ ] Add integrity verification for ledger events.
- [ ] Add export for finance and compliance review.
- [ ] Define retention and deletion policies.

### API protections

- [ ] Add rate limiting to `/api/agent/audit` and `/api/agent/stream`.
- [ ] Add request size limits at the platform boundary.
- [ ] Add CSRF protection for state-changing routes.
- [ ] Add structured error responses without internal detail leakage.
- [ ] Add PII redaction before AI provider calls.

### PayPal

- [ ] Add a server-side payout route that reads `PAYPAL_CLIENT_SECRET`.
- [ ] Replace per-call request identifiers with stable, deduplicated idempotency keys.
- [ ] Verify Sandbox payout behavior with real Sandbox credentials.
- [ ] Add webhook signature verification.
- [ ] Add payout reconciliation and failure recovery.
- [ ] Define refund and dispute procedures.
- [ ] Confirm production onboarding requirements before enabling production mode.

---

## Priority 3: Verification and deployment

- [ ] Run the manual plan in [E2E_DUAL_ROLE_GRID_TEST_PLAN.md](E2E_DUAL_ROLE_GRID_TEST_PLAN.md).
- [ ] Add automated component tests for portfolio, workspace, and agent chat.
- [ ] Add an end-to-end browser suite.
- [x] CI runs type validation, tests, and build on `main` (`.github/workflows/ci.yml`).
- [ ] Deploy to Render with Sandbox credentials.
- [ ] Verify the health check at `/`.
- [ ] Verify a live Sandbox payout end to end: settle a milestone with credentials, confirm the `payout_batch_id` in the PayPal Sandbox dashboard, and confirm the ledger records it.
- [ ] Add PayPal webhook signature verification and payout reconciliation.
- [ ] Confirm logs do not expose secrets.

---

## Priority 4: Product and commercial readiness

- [ ] Validate pricing and packaging with pilot customers.
- [ ] Define the approval workflow for enterprise accounts.
- [ ] Add multi-seat governance if required by pilot feedback.
- [ ] Add configurable approval thresholds for enterprise deployments.
- [ ] Add reporting for settled volume, rejection rate, and approval rate.
- [ ] Prepare legal review for the operating model and jurisdiction.
- [ ] Prepare privacy notices and terms of service.

---

## Priority 5: Documentation maintenance

- [ ] Keep route contracts synchronized with implementation.
- [ ] Update the test count and inventory when suites change.
- [ ] Record environment variable changes in `README.md`.
- [ ] Update `CHANGELOG.md` for every release.
- [ ] Re-run the E2E plan after material workflow changes.

---

## Quick reference

```bash
npm run dev
npx tsc --noEmit
npm test -- --runInBand
npm run build
git status
```
