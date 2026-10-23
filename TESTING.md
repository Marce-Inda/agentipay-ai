# Testing Guide

This document describes the current automated test inventory, how to run it, and what is not yet covered.

---

## 1. Current status

- **Test runner:** Jest 29 with ts-jest.
- **Environment:** Node.
- **Suites:** 12.
- **Checks:** 126 passing.
- **Scope:** server-side guardrails, PayPal payout rails (real, simulated, suppressed) and deterministic idempotency, audit route and server audit persistence, stream route, ledger helper, password hashing, repository tenant isolation, project bootstrap sanitization, atomic milestone settlement with payout-executor rollback, privacy-safe profile storage, process-local rate limiting, ledger validation, and authenticated ledger/project APIs including the live Sandbox payout flow of `/settle`.

Run the full suite:

```bash
npm test -- --runInBand
```

Validate TypeScript and the production build:

```bash
npx tsc --noEmit
npm run build
```

The repository does not include a `lint` or `typecheck` script.

---

## 2. Test inventory

| Suite | File | Focus |
| :--- | :--- | :--- |
| Guardrail enforcer | `src/lib/guardrails/__tests__/guardrails.enforcer.test.ts` | Budget ceilings, kill-switch, amount validation, payload truncation, prompt sanitization, audit thresholds, settlement modes. |
| PayPal client | `src/lib/paypal/__tests__/paypal.client.test.ts` | Deterministic real/simulated/suppressed rails, OAuth and payout payload shape, `PayPal-Request-Id`/`sender_batch_id` idempotency, batch-status parsing, fail-closed behavior without context, production credential enforcement, and HTTP error paths. |
| Audit route | `src/app/api/agent/__tests__/audit.test.ts` | Input validation, client/server kill-switch `423`, audit scoring, approval escalation, server milestone audit persistence, payload metadata. |
| Stream route | `src/app/api/agent/__tests__/stream.test.ts` | Missing prompt, budget rejection, provider call behavior, response handling. |
| Ledger helper | `src/lib/__tests__/ledger.test.ts` | `PAYOUT_EXECUTED` increments settled funds once per applied log; other statuses do not mutate projects. Duplicate log IDs are not tested. |
| Password hashing | `src/lib/auth/__tests__/password.test.ts` | scrypt hash format, verification, malformed hashes, and timing-resistant dummy verification. |
| Privacy storage | `src/lib/privacy/__tests__/storage.test.ts` | Sensitive profile fields separated from long-lived storage, session-only restoration, malformed values ignored. |
| Rate limiting | `src/lib/security/__tests__/rate-limit.test.ts` | Fixed-window quotas, reset behavior, key isolation, and descriptive `429` responses. |
| Repository | `src/lib/db/__tests__/repository.test.ts` | User/session lifecycle, ledger/project tenant isolation, bootstrap, atomic settlement, duplicate/kill-switch/budget rejection, payout-executor integration, rollback on PayPal rejection with deterministic retry context. |
| Ledger validation | `src/lib/validation/__tests__/ledger.test.ts` | Strict event schema limits, malformed payload rejection, and client-forged payout rejection. |
| Ledger API | `src/app/api/ledger/__tests__/events.test.ts` | Unauthenticated rejection, tenant-scoped read/write, deduplication, cross-site rejection, invalid amounts, and forged payout rejection. |
| Project API | `src/app/api/projects/__tests__/projects.test.ts` | Auth/origin enforcement, bootstrap sanitization, safe project creation, tenant isolation, settlement, duplicate-release rejection, and the PayPal Sandbox payout flow of `/settle` (real batch id recording and structured 502 rollback) against a mocked PayPal endpoint. |

---

## 3. Commands

### Run all tests

```bash
npm test
```

### Watch mode

```bash
npm run test:watch
```

### Coverage

```bash
npm run test:coverage
```

Coverage is collected from `src/**/*.{ts,tsx}`, excluding declarations, `node_modules`, and test directories. Treat the generated report as a development signal rather than a release gate.

### Run a specific suite

```bash
npm test -- guardrails.enforcer
npm test -- paypal.client
npm test -- audit.test
npm test -- stream.test
npm test -- ledger.test
npm test -- password.test
npm test -- repository.test
npm test -- events.test
npm test -- projects.test
npm test -- rate-limit.test
```

---

## 4. What is covered

- Non-AI budget enforcement before settlement.
- Kill-switch rejection at the audit route.
- Human approval escalation above the autonomous settlement cap.
- Prompt-injection pattern replacement.
- Deliverable payload size limiting.
- PayPal payout rails: real rail with credentials, deterministic simulation, suppressed fail-closed rail, production credential enforcement, and no-op behavior when settlement runs without a payout executor.
- Deterministic `PayPal-Request-Id` and `sender_batch_id` derived from the settlement fingerprint; equal context on retry and distinct context per milestone.
- One applied `PAYOUT_EXECUTED` log increments settled funds once.
- Stream route budget rejection, authentication, and provider invocation.
- Password hashing, verification, malformed hashes, and dummy verification.
- Sensitive profile fields kept out of long-lived browser storage.
- Process-local rate limits for LLM, audit, settlement, ledger, project, and envelope endpoints.
- `429` payloads with `RATE_LIMITED`, retry metadata, and standard rate-limit headers.
- User/session lifecycle and tenant-scoped ledger/project access.
- Ledger event validation, deduplication, and same-origin enforcement.
- Client-forged `PAYOUT_EXECUTED` rejection.
- Bootstrap sanitization of client spend, audit state, and completion state.
- Server audit persistence and settlement only after an audited milestone.
- Atomic settlement updates, duplicate-release rejection, and transaction/daily/project ceiling enforcement.
- Payout executor integration inside the settlement transaction and atomic rollback (project, envelope, ledger untouched) on PayPal rejection, with the structured 502 and equal retry context.
- `/settle` payout flow against a mocked PayPal endpoint: OAuth + Payouts call, real batch id persisted, duplicate release without extra API calls, and structured 502 on `INSUFFICIENT_FUNDS`.

## 5. What is not covered

- React component rendering and user interactions.
- Browser `localStorage` hydration and migration.
- End-to-end portfolio and workspace workflows.
- AG Grid rendering, filtering, and payload inspection.
- Real PayPal Sandbox network calls in CI; the payout-flow tests mock `/v1/oauth2/token` and `/v1/payments/payouts`.
- Live verified Sandbox payouts against developer.paypal.com.
- Post-payout reconciliation (webhooks, transaction status polling, refunds, disputes).
- The audit endpoint's GitHub URL auto-pass with empty deliverable text.
- The negotiation-only AI chat has no automated browser coverage.
- Role-based authorization, registration invite gates, and cross-instance rate limiting.
- Production PostgreSQL integration against a live database.
- Concurrent settlement races against a live PostgreSQL instance.
- Shared rate-limit state across multiple instances; counters are intentionally process-local.
- Render spin-down and cold-start behavior in CI.
- Multi-tab UI reconciliation during concurrent audit and settlement.
- Accessibility and responsive layout.
- Security testing beyond the deterministic guardrail patterns.
- Load, performance, and concurrency testing.

For manual end-to-end verification, see [E2E_DUAL_ROLE_GRID_TEST_PLAN.md](E2E_DUAL_ROLE_GRID_TEST_PLAN.md).

---

## 6. Writing tests

Follow the existing Jest and ts-jest conventions:

```typescript
import { GuardrailEnforcer } from '../enforcer';

describe('GuardrailEnforcer', () => {
  it('rejects amounts above the transaction ceiling', () => {
    const result = GuardrailEnforcer.validateTransactionBudget(250, {
      maxPerTransactionUSD: 100,
      dailyCeilingUSD: 1000,
      spentTodayUSD: 0,
      activeEscrowUSD: 0,
      killSwitchActive: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.settlementMode).toBe('REJECTED');
  });
});
```

Guidelines:

- Test deterministic behavior, not implementation details.
- Mock `fetch` for PayPal and AI provider calls; never use live credentials in tests.
- Include rejection and boundary cases for financial rules.
- Keep ledger assertions explicit: one applied payout log increments once; add a separate regression test before claiming duplicate-log protection.
- Do not assert on unstable identifiers such as random batch IDs or timestamps.

---

## 7. CI/CD

No CI workflow is committed. Before enabling merge gates, add a pipeline that runs:

```bash
npm ci
npx tsc --noEmit
npm test -- --runInBand
npm run build
```

Use repository secrets for PayPal and AI credentials only if a dedicated Sandbox integration test is introduced. Unit tests should not require live credentials.
