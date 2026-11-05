# Kiro Tasks: PayPal Settlement Hardening

## Task 1: PostgreSQL Schema & Database Setup

**ID:** task-settlement-schema  
**Status:** not_started  
**Dependencies:** None  
**Type:** Implementation  
**Effort:** 3 hours  

### Description
Create PostgreSQL migration to add settlement metadata columns, unique fingerprint index, and implement repository methods for atomic settlement operations.

### Sub-tasks
1. Create migration file: `src/lib/db/migrations/001_add_settlement_ledger.sql`
2. Add columns to `agenticpay_ledger_events`: fingerprint_id, settlement_id, payout_batch_id, batch_status, paypal_request_id, sender_batch_id, payout_executor_rail
3. Create unique index: `idx_ledger_fingerprint(user_id, fingerprint_id)`
4. Execute migration in development database
5. Implement `getMilestoneForUpdate()` method in repository
6. Implement `recordSettlementEvent()` method in repository
7. Implement `findLedgerEventByFingerprint()` method in repository

### Acceptance Criteria
- Migration file created and tested
- Repository methods compile without TypeScript errors
- Unique index verified in development database
- No breaking changes to existing ledger queries

---

## Task 2: Settlement Route Handler Skeleton

**ID:** task-settlement-route  
**Status:** not_started  
**Dependencies:** task-settlement-schema  
**Type:** Implementation  
**Effort:** 4 hours  

### Description
Create the POST route handler for settlement with authentication, CSRF check, rate-limiting, and input validation.

### Sub-tasks
1. Create directory: `src/app/api/projects/[projectId]/milestones/[milestoneId]/settle/`
2. Create `route.ts` with `POST` handler
3. Import authentication and security utilities
4. Implement session verification (return 401 if missing)
5. Implement CSRF check via `assertTrustedOrigin` (return 403 if untrusted)
6. Implement rate-limiting check (return 429 if exceeded)
7. Implement input validation (return 400 if malformed)
8. Implement error response structure matching API contract

### Acceptance Criteria
- Route compiles (npx tsc --noEmit passes)
- Authentication enforced (401 returned without session)
- Rate-limiting active (429 on exceed)
- Error responses match design.md contract

---

## Task 3: Deterministic Fingerprint & Idempotency Keys

**ID:** task-fingerprint  
**Status:** not_started  
**Dependencies:** task-settlement-route  
**Type:** Implementation  
**Effort:** 4 hours  

### Description
Implement deterministic fingerprint generation and PayPal idempotency key derivation to prevent double-payments on retry.

### Sub-tasks
1. Extend `src/lib/settlement/settlement.ts` with `buildMilestoneSettlementFingerprint()` function
2. Create `buildPayPalRequestId()` function (REQ-{first32chars})
3. Create `buildSenderBatchId()` function (SETTLE-{first28chars})
4. Integrate deduplication check in settlement route
5. Create unit tests for fingerprint determinism
6. Create unit tests for idempotency key format

### Acceptance Criteria
- Fingerprint function deterministic (same inputs → same output)
- Idempotency keys in correct format
- Deduplication check integrated in settlement route
- Unit tests pass

---

## Task 4: PostgreSQL Row Locks & Atomic Transaction

**ID:** task-rowlocks  
**Status:** not_started  
**Dependencies:** task-settlement-schema,task-settlement-route,task-fingerprint  
**Type:** Implementation  
**Effort:** 5 hours  

### Description
Implement PostgreSQL row-level locking and atomic transaction wrapper to prevent concurrent settlement.

### Sub-tasks
1. Implement `getMilestoneForUpdate()` with FOR UPDATE lock
2. Create transaction wrapper in settlement route
3. Implement BEGIN/COMMIT/ROLLBACK logic
4. Ensure row lock held during validation
5. Test row lock prevents concurrent settlement
6. Implement rollback verification tests

### Acceptance Criteria
- Row locks prevent concurrent settlement of same milestone
- Atomic transactions ensure all-or-nothing
- Rollback on failure leaves milestone unchanged
- No partial state mutations

---

## Task 5: Guardrail Revalidation (Server-Side)

**ID:** task-guardrails  
**Status:** not_started  
**Dependencies:** task-rowlocks  
**Type:** Implementation  
**Effort:** 5 hours  

### Description
Revalidate all financial guardrails server-side inside the settlement transaction.

### Sub-tasks
1. Implement kill-switch check (return 423 if active)
2. Implement contract status check (ACTIVE required)
3. Implement milestone status check (AUDITED_PENDING_APPROVAL required)
4. Implement audit score check (>= 85 required)
5. Implement amount validation
6. Implement per-transaction ceiling check
7. Implement daily ceiling check
8. Implement project budget check
9. Implement human approval check for high-value/incoming settlements
10. Add security event logging for all rejections

### Acceptance Criteria
- All guardrails revalidated server-side
- No settlement without audit score >= 85%
- Budget ceilings enforced
- Human approval required for high-value/incoming
- All rejections logged as security events

---

## Task 6: PayPal Executor Integration

**ID:** task-paypal-executor  
**Status:** not_started  
**Dependencies:** task-guardrails  
**Type:** Implementation  
**Effort:** 8 hours  

### Description
Integrate server-side PayPal Payouts executor with fail-closed rails (PAYPAL_SANDBOX, SIMULATED, SUPPRESSED_RAIL).

### Sub-tasks
1. Implement `getPayPalOAuthToken()` function
2. Implement `executePayPalPayout()` function
3. Implement `selectPayoutRail()` function
4. Implement PAYPAL_SANDBOX rail (real API call)
5. Implement SIMULATED rail (deterministic simulation)
6. Implement SUPPRESSED_RAIL (fail-closed, no credentials)
7. Implement error handling for PayPal failures
8. Integrate executor in settlement route
9. Create integration tests with mocked PayPal (success case)
10. Create integration tests with mocked PayPal (error case)

### Acceptance Criteria
- Real PayPal Payouts API call compiles
- Fail-closed rails function correctly
- All error cases handled
- Integration tests pass

---

## Task 7: Ledger Deduplication & Event Recording

**ID:** task-ledger-dedup  
**Status:** not_started  
**Dependencies:** task-paypal-executor  
**Type:** Implementation  
**Effort:** 5 hours  

### Description
Record settlement events with deduplication by fingerprint to prevent double-incrementing spend on retry.

### Sub-tasks
1. Implement `recordSettlementEvent()` in repository
2. Handle UNIQUE_VIOLATION for fingerprint duplicate
3. Return cached event on duplicate key error
4. Integrate event recording in settlement route (on success)
5. Create unit tests for first settlement insert
6. Create unit tests for duplicate insert returning cached result
7. Verify no double-spend on retry

### Acceptance Criteria
- Ledger events deduplicated by fingerprint
- Retry returns cached result with original payout_batch_id
- No double-spend from retries
- Unit tests pass

---

## Task 8: Error Handling & Recovery

**ID:** task-error-handling  
**Status:** not_started  
**Dependencies:** task-ledger-dedup  
**Type:** Implementation  
**Effort:** 6 hours  

### Description
Implement comprehensive error handling with rollback, logging, and structured error responses.

### Sub-tasks
1. Implement PayPal error handling (catch PayPalPayoutError)
2. Log PAYOUT_BLOCKED security event
3. ROLLBACK transaction on PayPal failure
4. Return HTTP 502 with structured error
5. Implement guardrail rejection logging
6. Implement concurrency error handling
7. Implement network timeout handling
8. Create integration tests for PayPal failure + rollback
9. Create integration tests for guardrail rejection
10. Verify transaction rollback on all errors

### Acceptance Criteria
- All errors logged and caught
- Transactions rolled back on failure
- Structured error responses
- No partial state mutations
- Integration tests pass

---

## Task 9: Unit Tests (All Components)

**ID:** task-unit-tests  
**Status:** not_started  
**Dependencies:** task-error-handling  
**Type:** Testing  
**Effort:** 8 hours  

### Description
Create comprehensive unit tests for all settlement components.

### Sub-tasks
1. Test fingerprint determinism
2. Test idempotency keys format
3. Test each guardrail revalidation
4. Test row lock acquisition
5. Test PayPal rails (mocked)
6. Test ledger deduplication
7. Run full test suite: `npm test -- --testPathPattern=settlement.test`
8. Verify coverage > 80%

### Acceptance Criteria
- All tests pass
- Coverage > 80%
- No flaky tests

---

## Task 10: Integration Tests

**ID:** task-integration-tests  
**Status:** not_started  
**Dependencies:** task-unit-tests  
**Type:** Testing  
**Effort:** 7 hours  

### Description
Create integration tests with real database and mocked PayPal.

### Sub-tasks
1. Test successful settlement (contract → audit → settle → ledger)
2. Test PayPal failure + rollback
3. Test idempotent retry
4. Test concurrent requests
5. Test guardrail rejection
6. Run integration tests: `npm test -- --testPathPattern=integration/settlement`
7. Verify all scenarios pass

### Acceptance Criteria
- All integration tests pass
- Real database used
- PayPal client mocked
- Coverage verified

---

## Task 11: E2E Live Sandbox Test & Verification

**ID:** task-e2e-sandbox  
**Status:** not_started  
**Dependencies:** task-integration-tests  
**Type:** Testing  
**Effort:** 10 hours  

### Description
Verify real PayPal Sandbox Payout execution and ledger recording.

### Sub-tasks
1. Configure PayPal Sandbox credentials in .env.local
2. Verify OAuth call to PayPal works
3. Create test user account
4. Create test contract with budget cap $5,000
5. Create test milestone ($250 USD)
6. Pre-populate with passing audit (score >= 85%)
7. Execute settlement call via settlement route
8. Capture response with payout_batch_id
9. Verify HTTP 200 OK
10. Login to PayPal Sandbox Dashboard
11. Find batch by payout_batch_id
12. Verify batch status and amount
13. Query database for ledger event
14. Verify fingerprint_id, payout_batch_id, batch_status recorded
15. Test failure scenario (insufficient budget)
16. Document with screenshots

### Acceptance Criteria
- Real PayPal Sandbox Payout executed
- payout_batch_id visible in Sandbox Dashboard
- Ledger records real batch ID
- Screenshots documented
- Failure scenario verified

---

## Task 12: Documentation & Demo Script

**ID:** task-demo-video  
**Status:** not_started  
**Dependencies:** task-e2e-sandbox  
**Type:** Documentation  
**Effort:** 12 hours  

### Description
Create demo script, record video, and update documentation.

### Sub-tasks
1. Write 3-minute English script (Problem → Portfolio → Guardrails → Settlement → Ledger → Close)
2. Pre-create test contract and milestone
3. Pre-execute audit (score >= 85%)
4. Prepare PayPal Dashboard screenshot
5. Record live browser session
6. Show portfolio, guardrails, audit result
7. Show settlement call and real payout_batch_id in ledger
8. Show PayPal Dashboard batch confirmation
9. Edit video: cut retakes, sync audio, add timestamps
10. Export: MP4, max 3 minutes, < 100 MB
11. Update README.md with real PayPal settlement mention
12. Update ARCHITECTURE.md with /settle endpoint description
13. Create DEMO_SCRIPT.md with full English script
14. Commit demo video to repo (or link if too large)

### Acceptance Criteria
- demo.mp4 created (< 3 min, < 100 MB)
- DEMO_SCRIPT.md with full English script
- Screenshots of PayPal Dashboard and ledger
- Documentation updated
- Video uploaded/linked

---

## Meta

**Total Tasks:** 12  
**Total Effort:** 77 hours  
**Phase 1 (Foundation):** Tasks 1-5 (22 hours)  
**Phase 2 (PayPal):** Tasks 6-8 (19 hours)  
**Phase 3 (Testing):** Tasks 9-12 (37 hours)  
**Parallel Possible:** After Task 8, tasks 9-12 can run in parallel

