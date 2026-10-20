# Verification Matrix

This document defines the verification gates for AgenticPay AI. It complements [TESTING.md](TESTING.md), which covers commands and automated test inventory.

A phase is considered verified only when its automated checks and the relevant manual checks pass.

---

## 1. Phase status

| Phase | Scope | Status | Evidence |
| :--- | :--- | :--- | :--- |
| 1 | Domain types, guardrails, ledger helper | Complete | TypeScript validation and ledger tests passing |
| 2 | Portfolio, workspace, AG Grid, account settings | Complete | Manual UI verification and production build |
| 3 | Deterministic guardrails and PayPal Sandbox client | Complete | Guardrail and PayPal test suites passing |
| 4 | Streamed AI assistant | Complete | `/api/agent/stream` tests passing |
| 5 | Deliverable audit and settlement workflow | Complete | `/api/agent/audit` tests and ledger tests passing |
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
- Five Jest suites and 58 checks pass.
- Next.js production build completes.

There is no CI workflow. These commands are run locally until a pipeline is added.

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
| Ledger idempotency | `ledger.test.ts` | Only `PAYOUT_EXECUTED` increments `spentUSD`, once per log. |

---

## 4. PayPal verification

| Check | Method | Pass criteria |
| :--- | :--- | :--- |
| Simulated mode | `paypal.client.test.ts` | Missing or placeholder credentials return a `SIM_PAYOUT_*` result. |
| OAuth request | `paypal.client.test.ts` | Valid credentials produce an authorization request to `/v1/oauth2/token`. |
| Payout request | `paypal.client.test.ts` | Request targets `/v1/payments/payouts` with a `PayPal-Request-Id` header. |
| Payload log | `paypal.client.test.ts` | Response includes a formatted HTTP log. |
| Error handling | `paypal.client.test.ts` | Non-success responses throw with useful context. |
| Live Sandbox | Manual | A Sandbox payout returns a batch ID and appears in the ledger. |

Live Sandbox verification requires credentials and should not run in the default unit test suite.

---

## 5. API verification

### `/api/agent/stream`

| Check | Pass criteria |
| :--- | :--- |
| Missing prompt | HTTP 400. |
| Budget rejection | HTTP 422 with `allowed: false`. |
| Valid prompt | Streamed response from the configured provider. |
| Provider failure | Fallback model attempt. |

### `/api/agent/audit`

| Check | Pass criteria |
| :--- | :--- |
| Missing deliverable | HTTP 400. |
| Active kill-switch | HTTP 423 with `settlementMode: "REJECTED"`, `riskLevel: "CRITICAL"`, `requiresHumanApproval: true`. |
| Short text without URL | Confidence 55. |
| Requirement or repository evidence | Confidence at least 86. |
| Blocked injection pattern | Confidence 15. |
| Amount above $1,000 USD | `HUMAN_APPROVAL_REQUIRED`. |
| Amount at or below $1,000 USD | `AUTONOMOUS` when confidence is at least 85%. |

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
| Budget guard | Over-budget release is blocked before PayPal is called. |
| Intake link | Uses the current origin and `/escrow/intake/{slug}`. |
| Copy feedback | Shows copied or manual-copy fallback state. |
| Subcontract badge | Shows exactly one of `SUBCONTRACTED` or `DIRECT HIRE`. |
| Parent mandate | Parent contract name is displayed when linked. |
| Capacity card | Renders only for business accounts. |
| Ledger | Rows update after audit and payout; payload inspector opens. |
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
| Sandbox payout | Deployed service can execute a Sandbox payout. |

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
3. CI pipeline with type, test, and build gates.
4. Sandbox integration test isolated from the default suite.
5. Accessibility checks.
6. Load testing for the audit and stream routes.
