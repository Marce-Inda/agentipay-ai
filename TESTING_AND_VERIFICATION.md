# Verification Matrix

This document defines the verification gates for AgenticPay AI. It complements [TESTING.md](TESTING.md), which covers commands and automated test inventory.

A phase is considered verified only when its automated checks and the relevant manual checks pass.

---

## 1. Phase status

| Phase | Scope | Status | Evidence |
| :--- | :--- | :--- | :--- |
| 1 | Domain types, guardrails, ledger helper | Complete | TypeScript validation and ledger tests passing |
| 2 | Portfolio, workspace, AG Grid, account settings | Complete | Manual UI verification and production build |
| 3 | Deterministic guardrails and PayPal Sandbox payout rail | Partial | Guardrail and PayPal payout-rail suites pass; `/settle` executes the PayPal Payouts API with deterministic idempotency in tests against a mocked endpoint; live verified Sandbox payout is pending |
| 4 | Streamed AI assistant | Complete | `/api/agent/stream` tests passing |
| 5 | Deliverable audit and settlement workflow | Partial | `/api/agent/audit` and ledger tests pass; `/settle` executes the PayPal payout executor inside the settlement transaction; live verified Sandbox payout is pending |
| 6 | Deployment and production hardening | In progress | Docker and Render configuration present; production controls pending |

---

## 2. Automated gates

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
```

Pass criteria:

- TypeScript reports no errors.
- Twelve Jest suites and 126 checks pass.
- Next.js production build completes.

GitHub Actions runs these gates on pushes and pull requests to `main` via `.github/workflows/ci.yml`.

---

## 3. Domain and guardrail verification

| Check | Method | Pass criteria |
| :--- | :--- | :--- |
| Domain types compile | `npx tsc --noEmit` | No type errors in `src/lib/types/index.ts` or consumers. |
| Prompt injection patterns | `guardrails.enforcer.test.ts` | Override and role-hijack phrases are replaced with `[BLOCKED_INJECTION_ATTEMPT]`. |
| Per-transaction ceiling | `guardrails.enforcer.test.ts` | Amount above `maxPerTransactionUSD` is rejected. |
| Daily ceiling | `guardrails.enforcer.test.ts` | Amount plus `spentTodayUSD` above `dailyCeilingUSD` is rejected. |
| Non-positive amount | `guardrails.enforcer.test.ts` | Zero and negative amounts are rejected. |
| Kill-switch | `guardrails.enforcer.test.ts` | Active kill-switch returns a critical rejection. |
| Audit threshold | `guardrails.enforcer.test.ts` | Score below 85% is rejected; 85% is accepted. |
| Autonomous cap | `guardrails.enforcer.test.ts` | Above $1,000 USD returns human approval required. |
| Payload limit | `guardrails.enforcer.test.ts` | Deliverable text is limited to 12,000 characters. |
| Ledger increment behavior | `ledger.test.ts` | Only `PAYOUT_EXECUTED` increments `spentUSD`; one applied log increments once. Duplicate IDs are not deduplicated. |

---

## 4. PayPal verification

| Check | Method | Pass criteria |
| :--- | :--- | :--- |
| Simulated mode | `paypal.client.test.ts` | Missing or placeholder credentials return a `SIM_PAYOUT_*` result. |
| OAuth request | `paypal.client.test.ts` | Valid credentials produce an authorization request to `/v1/oauth2/token`. |
| Payout request construction | `paypal.client.test.ts` | Unit-level request targets `/v1/payments/payouts` with a `PayPal-Request-Id` header. |
| Payload log | `paypal.client.test.ts` | Response includes a formatted HTTP log. |
| Error handling | `paypal.client.test.ts` | Non-success responses throw with useful context. |
| Live Sandbox | Manual | Not verified end to end. The `/settle` payout flow is covered against a mocked PayPal endpoint; a live verified Sandbox payout is pending. |

Live Sandbox verification requires credentials and should not run in the default unit test suite.

---

## 5. API verification

### `/api/agent/stream`

| Check | Pass criteria |
| :--- | :--- |
| Missing prompt | HTTP 400. |
| Budget rejection | HTTP 422 with `allowed: false`. |
| Valid prompt | Streamed response from the configured provider. |
| Provider failure | Fallback attempted only when the primary call throws before streaming starts. |
| Unauthenticated request | Rejected with HTTP 401; an authenticated session is required. |

### `/api/agent/audit`

| Check | Pass criteria |
| :--- | :--- |
| Missing deliverable | HTTP 400. |
| Active kill-switch | HTTP 423 with `settlementMode: "REJECTED"`, `riskLevel: "CRITICAL"`, `requiresHumanApproval: true`. |
| Short text without URL | Confidence 55. |
| Requirement or repository evidence | Confidence at least 86. |
| GitHub URL with empty deliverable text | Confidence at least 91; known bypass of substantive content review. |
| Blocked injection pattern | Confidence 15. |
| Amount above $1,000 USD | `HUMAN_APPROVAL_REQUIRED`. |
| Amount at or below $1,000 USD | `AUTONOMOUS` when confidence is at least 85%. |
| Payment execution | None. `simulatedBatchId` is not a PayPal batch. |

---

## 6. UI verification

| Check | Pass criteria |
| :--- | :--- |
| Portfolio navigation | Selecting a card opens the matching workspace. |
| Perspective labels | Outbound shows `Client (Escrow Funder)`; inbound shows `Contractor (Escrow Beneficiary)`. |
| Freeze control | Visible for outbound only. |
| Kill-switch | Header enters alert state; settlement attempts are blocked. |
| Audit result | Confidence, risk, rationale, and settlement mode are displayed. |
| Human approval | Milestone above $1,000 USD enters `AUDITED_PENDING_APPROVAL` and requires an explicit action. |
| Budget guard | Over-budget release is blocked before the settlement transaction mutates state. |
| Subcontract badge | Shows exactly one of `SUBCONTRACTED` or `DIRECT HIRE`. |
| Parent mandate | Parent contract name is displayed when linked. |
| Account banner | Identifies business or individual account context and shows settlement email and compliance status. |
| Ledger | Rows update after audit and a settlement; payload inspector opens. |
| Settlement truth | The server settlement path marks milestones complete and emits `PAYOUT_EXECUTED` logs with deterministic `SETTLE-`/`PAYOUT-` references. With PayPal credentials, the ledger carries the real sandbox `payout_batch_id`; without credentials, the entry honestly states the rail was simulated or suppressed. |
| Persistence | Refresh preserves profile, contracts, envelope, and logs. |

Use [E2E_DUAL_ROLE_GRID_TEST_PLAN.md](E2E_DUAL_ROLE_GRID_TEST_PLAN.md) for the full sequence.

---

## 7. Deployment verification

| Check | Pass criteria |
| :--- | :--- |
| Docker build | Image builds from `Dockerfile`. |
| Container start | Service responds on port 3000. |
| Render blueprint | `render.yaml` resolves to a Docker web service with health check `/`. |
| Environment | Required secrets are configured in the hosting dashboard. |
| Secret exposure | No secret appears in client bundles or logs. |
| Sandbox payout | The server-side payout route is implemented and tested against a mocked PayPal endpoint; a live verified Sandbox payout is pending. |

---

## 8. Release checklist

- [ ] TypeScript validation passes.
- [ ] Jest suite passes.
- [ ] Production build passes.
- [ ] Manual E2E plan completed.
- [ ] No secrets in the working tree.
- [ ] Documentation matches routes, thresholds, and commands.
- [ ] Known limitations are disclosed.
- [ ] Deployment smoke test completed.

---

## 9. Future automation

Recommended additions:

1. Component tests for portfolio, workspace, and agent chat.
2. Playwright coverage of the settlement workflow.
3. Expand CI with a dedicated, isolated Sandbox integration test.
4. Accessibility checks.
5. Load testing for the audit and stream routes.
