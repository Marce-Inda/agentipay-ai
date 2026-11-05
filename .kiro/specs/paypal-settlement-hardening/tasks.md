# Tasks: PayPal Settlement Hardening & Agentic Commerce Guardrails

**Feature Name:** `paypal-settlement-hardening`  
**Total Estimated Effort:** 72 hours (Phase 1: Core Settlement + Verification)  
**Priority:** CRITICAL (Hackathon Differentiator)  
**Status:** Ready for Execution

---

## Task Dependency Graph

```
┌─ Task 1: Schema & Database Setup ──────────────────┐
│                                                      │
└──> Task 2: Settlement Route Handler ────────────────┤
             ├── Task 3: Fingerprint & Idempotency ───┤
             ├── Task 4: Row Lock Implementation ──────┤
             └── Task 5: Guardrail Revalidation ──────┤
                                                       │
                    All above complete ────────────────┤
                                                       │
                    ├──> Task 6: PayPal Executor ──────┤
                    │                                   │
                    ├──> Task 7: Ledger Deduplication ─┤
                    │                                   │
                    └──> Task 8: Error Handling ───────┤
                                                       │
              All above complete ────────────────────────┤
                                                       │
     ┌────────────────────────────────────────────────┘
     │
     ├──> Task 9: Unit Tests (All Components) ─────┐
     ├──> Task 10: Integration Tests ──────────────┤
     ├──> Task 11: E2E Live Sandbox Test ─────────┤
     │                                              │
     └──> Task 12: Documentation & Demo Script ────┘
```

---

## Phase 1: Core Settlement Implementation (72 hours)

### Task 1: PostgreSQL Schema & Database Setup (3 hours)

**Objective:** Add ledger fingerprint deduplication, settlement metadata, and payout tracking.

**Sub-tasks:**

1.1. **Add Ledger Event Columns**
   - Add `fingerprint_id` (VARCHAR(64) UNIQUE) to `agenticpay_ledger_events`
   - Add `settlement_id` (VARCHAR(64)) for settlement tracking
   - Add `payout_batch_id` (VARCHAR(128)) for real PayPal batch ID
   - Add `batch_status` (VARCHAR(32)) for PayPal status ("PROCESSING", "SUCCESS", "FAILED", "SIMULATED")
   - Add `paypal_request_id` (VARCHAR(64)) for idempotency
   - Add `sender_batch_id` (VARCHAR(64)) for PayPal sender batch
   - Add `payout_executor_rail` (VARCHAR(32)) to track which rail (PAYPAL_SANDBOX, SIMULATED, SUPPRESSED)
   - Add `created_at` timestamp
   - Add index: `UNIQUE idx_ledger_fingerprint (user_id, fingerprint_id)` for deduplication

1.2. **Add Milestone Columns**
   - Add `payout_batch_id` (VARCHAR(128)) to `agenticpay_milestones`
   - Add `batch_status` (VARCHAR(32)) to `agenticpay_milestones`
   - Add constraint: only update these columns during settlement

1.3. **Create Migration Script**
   - Generate Postgres migration file in `src/lib/db/migrations/`
   - Include rollback script
   - Test migration on development database

1.4. **Update Repository Interface**
   - Add method: `getMilestoneForUpdate(userId: string, projectId: string, milestoneId: string): Milestone`
     - Executes: `SELECT * FROM milestones WHERE ... FOR UPDATE`
     - Returns milestone under row lock (used in settlement transaction)
   - Add method: `recordSettlementEvent(...): LedgerEvent`
     - Inserts ledger event with deduplication by fingerprint
     - Handles UNIQUE_VIOLATION by returning cached event
   - Add method: `findLedgerEventByFingerprint(userId: string, fingerprint: string): LedgerEvent | null`

**Acceptance Criteria:**
- ✅ Migration file created and tested locally
- ✅ Repository interface updated with settlement methods
- ✅ Unique index on `(user_id, fingerprint_id)` verified
- ✅ No breaking changes to existing ledger queries

**Time:** 3 hours

---

### Task 2: Settlement Route Handler Skeleton (4 hours)

**Objective:** Create the route handler with boilerplate, authentication, rate-limiting, and error structure.

**File:** `src/app/api/projects/[projectId]/milestones/[milestoneId]/settle/route.ts`

**Sub-tasks:**

2.1. **Route Structure**
   - Create directory: `src/app/api/projects/[projectId]/milestones/[milestoneId]/settle/`
   - Create `route.ts` with `POST` handler
   - Import: `NextRequest`, `NextResponse`, `getSession`, `assertTrustedOrigin`, `checkRateLimit`

2.2. **Authentication & CSRF**
   - Verify `session` from `getSession(req)`
   - Return `401` if no session
   - Verify `assertTrustedOrigin(req)` (same-origin check)
   - Return `403` if untrusted

2.3. **Rate Limiting**
   - Call `checkRateLimit("settle:" + session.user.id, 15, 60000)`
   - Return `429` if exceeded
   - Include `Retry-After` header

2.4. **Input Validation**
   - Parse JSON body: `{ requiresHumanApproval?: boolean }`
   - Validate `projectId` and `milestoneId` are strings (from URL params)
   - Return `400` if malformed

2.5. **Error Response Structure**
   - Success: `HTTP 200 OK` with settlement details
   - Guardrail reject: `HTTP 422 Unprocessable Entity`
   - PayPal failure: `HTTP 502 Bad Gateway`
   - Auth fail: `HTTP 401` or `403`
   - Rate limit: `HTTP 429`
   - Internal error: `HTTP 500`

2.6. **Logging Infrastructure**
   - Import `logSecurityEvent`
   - Log all guardrail rejections, PayPal errors, and PAYOUT_BLOCKED events

**Acceptance Criteria:**
- ✅ Route handler compiles (TypeScript strict mode)
- ✅ Authentication enforced
- ✅ Rate limiting active
- ✅ Error responses match contract

**Time:** 4 hours

---

### Task 3: Deterministic Fingerprint & Idempotency Keys (4 hours)

**Objective:** Implement fingerprint generation and idempotency key derivation for double-payment prevention.

**Files:**
- `src/lib/settlement/settlement.ts` (extend existing)

**Sub-tasks:**

3.1. **Fingerprint Generation**
   - Create function: `buildMilestoneSettlementFingerprint(projectId, milestoneId, amountUSD): string`
   - Hash input: `SHA256(projectId | milestoneId | amountUSD.toFixed(2))`
   - Output: 64-char hex string
   - Test: same inputs → same fingerprint (determinism verified)

3.2. **Idempotency Keys**
   - Create function: `buildPayPalRequestId(fingerprint): string`
     - Output: `REQ-{fingerprint.slice(0, 32)}`
   - Create function: `buildSenderBatchId(fingerprint): string`
     - Output: `SETTLE-{fingerprint.slice(0, 28)}`
   - Test: verify format and uniqueness

3.3. **Deduplication Check**
   - In settlement route: query `findLedgerEventByFingerprint(userId, fingerprint)`
   - If found: return cached result (same `payout_batch_id`, no double-pay)
   - If not found: proceed to PayPal invocation

3.4. **Unit Tests**
   - Test fingerprint determinism: `SHA256("proj1|m1|100.00")` always gives same output
   - Test idempotency keys: `REQ-...` and `SETTLE-...` formats correct
   - Test deduplication: retry same settlement, verify cached result returned

**Acceptance Criteria:**
- ✅ Fingerprint function deterministic (same inputs → same output)
- ✅ Idempotency keys in correct format
- ✅ Deduplication logic prevents double-pay
- ✅ Unit tests pass

**Time:** 4 hours

---

### Task 4: PostgreSQL Row Locks & Atomic Transaction (5 hours)

**Objective:** Implement row-level locking and atomic transactions to prevent concurrent settlement.

**Files:**
- `src/lib/db/repository.ts` (extend)
- `src/app/api/projects/.../settle/route.ts` (integrate)

**Sub-tasks:**

4.1. **Row Lock Implementation**
   - Implement `getMilestoneForUpdate(userId, projectId, milestoneId)`
   - SQL: `SELECT * FROM milestones WHERE project_id = $1 AND id = $2 FOR UPDATE`
   - Test: lock is held until transaction commit/rollback

4.2. **Transaction Wrapper**
   - Create function: `withSettlementTransaction(callback)`
   - Opens transaction, executes callback, commits/rolls back
   - Ensures atomicity: all-or-nothing semantics

4.3. **Settlement Transaction Flow**
   - Load milestone under lock
   - Load project and envelope
   - Revalidate all guards (kill-switch, audit score, budgets)
   - If any guard fails: rollback immediately
   - Invoke PayPal executor
   - If PayPal success: update milestone, project, envelope; insert ledger event; commit
   - If PayPal fails: rollback (milestone status unchanged)

4.4. **Concurrent Request Testing**
   - Unit test: two settlement requests for same milestone
   - Verify: first acquires lock and completes; second waits or fails gracefully
   - Verify: second request (if after first complete) sees milestone status COMPLETED and rejects

4.5. **Rollback Verification**
   - On PayPal failure: verify milestone.status still `AUDITED_PENDING_APPROVAL`
   - Verify project.spentUSD unchanged
   - Verify envelope.spentTodayUSD unchanged

**Acceptance Criteria:**
- ✅ Row locks prevent concurrent settlement of same milestone
- ✅ Atomic transactions ensure all-or-nothing updates
- ✅ Rollback on PayPal failure leaves milestone in original state
- ✅ No partial state mutations

**Time:** 5 hours

---

### Task 5: Guardrail Revalidation (Server-Side) (5 hours)

**Objective:** Revalidate all guardrails server-side inside the settlement transaction.

**Files:**
- `src/app/api/projects/.../settle/route.ts` (implement inside transaction)
- `src/lib/guardrails/enforcer.ts` (extend if needed)

**Sub-tasks:**

5.1. **Kill-Switch Check**
   - Load `envelope.killSwitchActive` from database
   - If `true`: return `423 Locked` (fail before PayPal invocation)
   - Log security event `KILL_SWITCH_ACTIVE`

5.2. **Contract Status Check**
   - Verify `project.status === ACTIVE`
   - If not: return `423 Locked`

5.3. **Milestone Status Check**
   - Verify `milestone.status === AUDITED_PENDING_APPROVAL`
   - If `COMPLETED`: return `409 Conflict` ("already settled")
   - If `PENDING` or `LOCKED`: return `409 Conflict`

5.4. **Audit Score Check**
   - Verify `milestone.auditScore >= 85`
   - If below: return `422 Unprocessable Entity`

5.5. **Amount Validation**
   - Verify `amount > 0` and `Number.isFinite(amount)`
   - Verify `amount === milestone.amountUSD` (within $0.01 tolerance)

5.6. **Budget Checks**
   - Per-transaction: `amount <= envelope.maxPerTransactionUSD`
   - Daily: `envelope.spentTodayUSD + amount <= envelope.dailyCeilingUSD`
   - Project: `amount <= (project.budgetCapUSD - project.spentUSD)`
   - Return `402 Payment Required` or `422` with appropriate reason

5.7. **Human Approval Check**
   - If `amount > 1000 USD` OR `project.perspective === INCOMING`:
     - Require `requiresHumanApproval: true` in request body
     - Return `422` if missing
   - Log approval requirement in ledger event

5.8. **Unit Tests**
   - Test each guardrail rejection
   - Test combined guardrails (e.g., kill-switch + budget exceeded)

**Acceptance Criteria:**
- ✅ All guardrails revalidated server-side
- ✅ Kill-switch enforced before PayPal call
- ✅ No settlement possible if audit score < 85%
- ✅ Budget ceilings enforced
- ✅ Human approval required for high-value/incoming settlements

**Time:** 5 hours

---

### Task 6: PayPal Executor Integration (8 hours)

**Objective:** Integrate server-side PayPal Payouts executor with fail-closed rails.

**Files:**
- `src/lib/paypal/executor.ts` (extend existing)
- `src/app/api/projects/.../settle/route.ts` (integrate)

**Sub-tasks:**

6.1. **PayPal Client OAuth2 Call**
   - Implement `getPayPalOAuthToken(clientId, clientSecret)`
   - Call `POST /v1/oauth2/token` with Basic auth
   - Cache token for ~1 hour (or return fresh on each call, simpler for MVP)
   - Return access token or throw `PayPalOAuthError`

6.2. **PayPal Payouts API Call**
   - Implement `executePayPalPayout(token, payoutRequest)`
   - Construct request body with:
     - `sender_batch_id` (derived from fingerprint)
     - `email_subject`, `email_message`
     - `items`: array with one recipient
   - Call `POST /v1/payments/payouts` with deterministic `PayPal-Request-Id` header
   - Return response: `{ batch_id, batch_status, errors }`
   - Throw `PayPalPayoutError` on HTTP 4xx/5xx

6.3. **Rails Selection**
   - Implement `selectPayoutRail()`
     - If `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` set: return `PAYPAL_SANDBOX`
     - Else if `PAYPAL_SIMULATION_MODE === true` (non-production): return `SIMULATED`
     - Else: return `SUPPRESSED_RAIL`

6.4. **PAYPAL_SANDBOX Rail**
   - Authenticate (OAuth2)
   - Execute real Payouts call
   - Return: `{ success: true, batchId, status, timestamp }`

6.5. **SIMULATED Rail (Non-Production)**
   - Generate deterministic simulated batch ID: `SIMULATED-{fingerprint.slice(0, 20)}`
   - Return: `{ success: true, batchId: "SIMULATED-...", status: "SIMULATED", timestamp }`
   - Log warning: "Simulated payout, no funds transferred"

6.6. **SUPPRESSED_RAIL (Fail-Closed)**
   - Return: `{ success: false, error: "CREDENTIALS_MISSING", rail: "SUPPRESSED" }`
   - In production: throw error and reject settlement
   - In non-production: allow simulation instead

6.7. **Error Handling**
   - Catch `PayPalOAuthError`: return `{ success: false, error: "AUTH_FAILED", ... }`
   - Catch `PayPalPayoutError` (HTTP 400-599): return `{ success: false, error: "...", errorCode: "INSUFFICIENT_FUNDS", ... }`
   - Catch network timeout (> 45 sec): return `{ success: false, error: "TIMEOUT", ... }`

6.8. **Integration Tests**
   - Mock PayPal client (use `jest.mock()`)
   - Test real rail with mocked success
   - Test real rail with mocked error (INSUFFICIENT_FUNDS)
   - Test simulated rail output
   - Test suppressed rail output

**Acceptance Criteria:**
- ✅ Real PayPal Payouts API call executes with correct request format
- ✅ Deterministic `PayPal-Request-Id` prevents double-pays
- ✅ Fail-closed rails (simulated, suppressed) work without credentials
- ✅ Errors properly caught and returned

**Time:** 8 hours

---

### Task 7: Ledger Deduplication & Event Recording (5 hours)

**Objective:** Record settlement events with deduplication by fingerprint.

**Files:**
- `src/lib/db/repository.ts` (implement `recordSettlementEvent`)
- `src/app/api/projects/.../settle/route.ts` (integrate)

**Sub-tasks:**

7.1. **Ledger Event Schema**
   - Structure: user_id, fingerprint_id, settlement_id, milestone_id, project_id, amount_usd, payout_batch_id, batch_status, paypal_request_id, sender_batch_id, payout_executor_rail, created_at, risk_level, audit_confidence, status

7.2. **Deduplication Logic**
   - Check for existing event: `SELECT * FROM ledger_events WHERE user_id = $1 AND fingerprint_id = $2`
   - If found: return cached event (do not update milestone/project/envelope again)
   - If not found: proceed to insert

7.3. **Insert on Success**
   - INSERT ledger event with:
     - `status: "PAYOUT_EXECUTED"`
     - `batch_status: <from PayPal>`
     - `payout_batch_id: <real PayPal ID or "SIMULATED-...">`
     - `payout_executor_rail: "PAYPAL_SANDBOX" | "SIMULATED" | "SUPPRESSED_RAIL"`
   - Unique constraint on `(user_id, fingerprint_id)` ensures deduplication
   - Return: `{ id: "evt-...", payout_batch_id: "...", ... }`

7.4. **Insert on Failure**
   - INSERT `PAYOUT_BLOCKED` event (if desired for audit trail)
   - Or skip insertion and rely on HTTP 502 error response

7.5. **UNIQUE_VIOLATION Handling**
   - On INSERT fail with UNIQUE_VIOLATION:
     - Catch error
     - Query existing event by fingerprint
     - Return cached event
     - Do NOT increment project.spentUSD or envelope.spentTodayUSD again

7.6. **Unit Tests**
   - Test insert on first settlement
   - Test duplicate insert returns cached result
   - Test that retrying same settlement does not double-increment spend

**Acceptance Criteria:**
- ✅ Ledger events deduplicated by fingerprint
- ✅ Retry returns cached result with original `payout_batch_id`
- ✅ No double-payment or double-spend from retries

**Time:** 5 hours

---

### Task 8: Error Handling & Recovery (6 hours)

**Objective:** Comprehensive error handling with rollback, logging, and structured responses.

**Files:**
- `src/app/api/projects/.../settle/route.ts` (integrate try/catch blocks)
- `src/lib/security/events.ts` (log events)

**Sub-tasks:**

8.1. **PayPal Failure Handling**
   - Catch `PayPalPayoutError` with error code and message
   - Log `PAYOUT_BLOCKED` security event with PayPal error details
   - ROLLBACK transaction (milestone, project, envelope unchanged)
   - Return `HTTP 502 Bad Gateway` with structured error

8.2. **Guardrail Rejection Logging**
   - Kill-switch active: log `KILL_SWITCH_ACTIVE`
   - Budget exceeded: log `BUDGET_REJECTED`
   - Audit score low: log `AUDIT_FAILED`
   - Approval required: log `APPROVAL_REQUIRED`

8.3. **Concurrency Error Handling**
   - If row lock times out (concurrent settlement): return `409 Conflict`
   - If milestone status changed during transaction: return `409 Conflict`

8.4. **Network Timeout Handling**
   - Set PayPal call timeout to 30 seconds
   - On timeout: catch error, log, ROLLBACK, return `HTTP 502`
   - Retry with same fingerprint will be idempotent

8.5. **Database Transaction Rollback**
   - On any error: ensure `transaction.rollback()` called
   - Verify milestone status not changed
   - Verify spend not incremented

8.6. **Error Response Format**
   - Success: `{ success: true, settlementId, payout BatchId, ... }`
   - PayPal error: `{ error: "...", reason: "...", paypalErrorCode: "...", status: 502 }`
   - Guardrail error: `{ error: "...", reason: "...", status: 422 }`

8.7. **Integration Tests**
   - Test PayPal failure + rollback
   - Test guardrail rejection + no state change
   - Test concurrent settlement (second request should fail or wait)
   - Test timeout + retry idempotency

**Acceptance Criteria:**
- ✅ All errors properly caught and logged
- ✅ Transaction rolled back on failure
- ✅ Structured error responses
- ✅ No partial state mutations
- ✅ Retries are idempotent

**Time:** 6 hours

---

### Task 9: Unit Tests (All Components) (8 hours)

**Objective:** Comprehensive unit test coverage for settlement logic.

**Files:**
- `src/__tests__/settlement.test.ts` (new or extend existing)

**Test Cases:**

9.1. **Fingerprint & Idempotency Tests (2 hours)**
   - Determinism: same inputs → same fingerprint
   - Idempotency keys format correct
   - Deduplication query logic

9.2. **Guardrail Revalidation Tests (2 hours)**
   - Kill-switch blocks settlement
   - Audit score < 85% blocks settlement
   - Budget ceilings enforced
   - Human approval requirement honored

9.3. **Row Lock & Transaction Tests (2 hours)**
   - Lock acquired on milestone load
   - Concurrent requests handled properly
   - Rollback on failure

9.4. **PayPal Rails Tests (1.5 hours)**
   - Real rail with mocked PayPal (success)
   - Real rail with mocked PayPal (error)
   - Simulated rail output
   - Suppressed rail behavior

9.5. **Ledger Deduplication Tests (0.5 hours)**
   - First insert succeeds
   - Duplicate insert returns cached result
   - No double-spend

**Test Execution:**
```bash
npm test -- --testPathPattern=settlement.test
npm test -- --coverage  # Verify > 80% coverage
```

**Acceptance Criteria:**
- ✅ All tests pass
- ✅ Coverage > 80%
- ✅ No flaky tests

**Time:** 8 hours

---

### Task 10: Integration Tests (7 hours)

**Objective:** Test settlement route with mocked PayPal and real database.

**Files:**
- `src/__tests__/integration/settlement.integration.test.ts` (new)

**Test Scenarios:**

10.1. **Successful Settlement (2 hours)**
   - Create contract, audit milestone, settle
   - Verify milestone marked COMPLETED
   - Verify project.spentUSD incremented
   - Verify ledger event created
   - Verify response contains real `payout_batch_id`

10.2. **PayPal Failure & Rollback (1.5 hours)**
   - Settle with mocked PayPal error
   - Verify transaction rolled back
   - Verify milestone still `AUDITED_PENDING_APPROVAL`
   - Verify project.spentUSD unchanged

10.3. **Idempotent Retry (1.5 hours)**
   - Settle milestone once
   - Retry with same fingerprint
   - Verify cached result returned
   - Verify project.spentUSD incremented only once

10.4. **Concurrent Requests (1 hour)**
   - Two settlement requests for same milestone (simulated)
   - Verify one succeeds, other fails or waits
   - Verify no double-settlement

10.5. **Guardrail Rejection (1 hour)**
   - Try to settle when kill-switch active
   - Try to settle when audit score < 85%
   - Try to settle exceeding budget
   - Verify all rejected, no state change

**Test Execution:**
```bash
npm test -- --testPathPattern=integration/settlement
```

**Acceptance Criteria:**
- ✅ All integration tests pass
- ✅ Real database used (not mocked)
- ✅ PayPal client mocked

**Time:** 7 hours

---

### Task 11: E2E Live Sandbox Test & Verification (10 hours)

**Objective:** Verify real PayPal Sandbox Payout execution and ledger recording.

**Setup:**

11.1. **PayPal Sandbox Configuration (1 hour)**
   - Set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` for Sandbox
   - Verify credentials valid (test OAuth2 call)
   - Create test recipient email in Sandbox

11.2. **Test Data Preparation (1 hour)**
   - Create test user account
   - Create test contract with $5,000 budget cap
   - Create test milestone ($250 USD)
   - Pre-populate test milestone with passing audit (score >= 85%)

11.3. **Live Settlement Execution (2 hours)**
   - Call settlement route with test project/milestone
   - Capture response: `payout_batch_id`, `batch_status`
   - Verify HTTP `200 OK`
   - Log response for documentation

11.4. **PayPal Dashboard Verification (2 hours)**
   - Login to PayPal Sandbox Dashboard
   - Navigate to Activity/Transactions
   - Find batch by `payout_batch_id`
   - Verify batch status (e.g., `PROCESSING` or `SUCCESS`)
   - Verify amount ($250 USD)
   - Screenshot for documentation

11.5. **Ledger Recording Verification (2 hours)**
   - Query database: `SELECT * FROM ledger_events WHERE payout_batch_id = '...'`
   - Verify record exists
   - Verify all fields populated correctly
   - Verify `fingerprint_id` uniqueness
   - Screenshot ledger entry for documentation

11.6. **Failure Scenario Verification (1 hour)**
   - Test insufficient budget scenario
   - Test guardrail rejection
   - Verify no settlement created
   - Verify ledger records rejection (if applicable)

11.7. **Documentation (1 hour)**
   - Screenshot: PayPal Dashboard batch details
   - Screenshot: ledger entry with real `payout_batch_id`
   - Screenshot: settlement route response JSON
   - Document test scenario, steps, and results

**Acceptance Criteria:**
- ✅ Real PayPal Sandbox Payout executed
- ✅ `payout_batch_id` visible in Sandbox Dashboard
- ✅ Ledger event recorded with real batch ID
- ✅ Screenshots and documentation captured

**Time:** 10 hours

---

### Task 12: Documentation, Demo Script & Video (12 hours)

**Objective:** Create demo script, record video, and document the feature.

**Sub-tasks:**

12.1. **Demo Script Writing (2 hours)**
   - Outline: Problem (0:00–0:20) → Portfolio (0:20–0:45) → Guardrails (0:45–1:15) → Settlement (1:15–1:50) → Ledger (1:50–2:10) → Cierre (2:10–3:00)
   - Write 3-minute English script
   - Include exact timing and transitions

12.2. **Demo Scenario Preparation (3 hours)**
   - Pre-create test contract with realistic data
   - Pre-create test milestone with deliverable
   - Pre-execute audit (get passing score)
   - Have screenshot of PayPal Dashboard ready (showing real batch)
   - Ensure all data is fresh (same day)

12.3. **Video Recording & Editing (5 hours)**
   - Record live browser session (Chrome with DevTools if showing technical details)
   - Show portfolio dual-swimlanes
   - Show guardrails (kill-switch, budget envelope, autonomous ceiling)
   - Show audit result (score 91%, AUTONOMOUS mode)
   - Show settlement call (click Release Milestone)
   - Show ledger update (real `payout_batch_id`, PAYPAL_SANDBOX badge)
   - Show PayPal Dashboard (batch confirmation)
   - Edit video: cut retakes, sync audio, add timestamps
   - Export: MP4, max 3 minutes, < 100 MB

12.4. **Documentation Updates (2 hours)**
   - Update README.md: mention real PayPal settlement
   - Update ARCHITECTURE.md: describe new `/settle` endpoint
   - Update TECHNICAL_ARCHITECTURE_AND_DEVOPS.md: API contract for settlement
   - Add DEMO_SCRIPT.md with full English script and timestamps

**Deliverables:**
- ✅ `DEMO_SCRIPT.md` (English, 3 min, structured)
- ✅ `demo.mp4` (video, max 3 min, shows real PayPal settlement)
- ✅ Updated documentation
- ✅ Screenshot: PayPal Dashboard batch
- ✅ Screenshot: ledger with real `payout_batch_id`

**Time:** 12 hours

---

## Task Summary

| Task | Effort | Dependencies | Status |
|------|--------|--------------|--------|
| 1. Schema & DB Setup | 3h | None | Ready |
| 2. Route Handler | 4h | Task 1 | Ready |
| 3. Fingerprint & Idempotency | 4h | Task 1 | Ready |
| 4. Row Locks & Transactions | 5h | Tasks 1, 2, 3 | Ready |
| 5. Guardrail Revalidation | 5h | Tasks 2, 4 | Ready |
| 6. PayPal Executor | 8h | Tasks 2, 4, 5 | Ready |
| 7. Ledger Deduplication | 5h | Tasks 1, 6 | Ready |
| 8. Error Handling | 6h | All above | Ready |
| 9. Unit Tests | 8h | All above | Ready |
| 10. Integration Tests | 7h | All above | Ready |
| 11. E2E Sandbox Test | 10h | All above | Ready |
| 12. Documentation & Video | 12h | All above | Ready |
| **TOTAL** | **77 hours** | | |

---

## Execution Notes

- **Parallelization:** Tasks 9, 10, 11, 12 can overlap with earlier tasks once Task 8 completes
- **Blockers:** Task 1 must complete before Tasks 2, 3, 4, 5
- **Testing:** Run tests locally after each task (npm test)
- **Commits:** One commit per task with focused message
- **Code Review:** Request review after Task 8; may adjust before tests

---

## Success Metrics

1. ✅ Settlement route executes real PayPal Sandbox Payouts
2. ✅ Deterministic idempotency keys prevent double-payments
3. ✅ Row locks + atomic transactions ensure consistency
4. ✅ Ledger events deduplicated by fingerprint
5. ✅ Demo video < 3 min showing real PayPal batch in Dashboard
6. ✅ All tests pass (unit, integration, E2E)
7. ✅ No regression in existing functionality

---

## Rollback Plan (If Needed)

- Revert schema migration: `npx postgres-migrate rollback`
- Delete route handler file: `rm src/app/api/projects/.../settle`
- Revert imports: remove `MilestonePayoutExecutor` from settle route
- Restart server, verify existing settlement flow still works (client-side only)

