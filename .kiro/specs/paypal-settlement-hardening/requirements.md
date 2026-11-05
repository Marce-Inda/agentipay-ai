# Requirements: PayPal Settlement Hardening & Agentic Commerce Guardrails

**Feature Name:** `paypal-settlement-hardening`  
**Objective:** Implement server-authoritative, fail-closed PayPal Payouts settlement with deterministic idempotency, atomic transactions, and enterprise-grade guardrails.  
**Status:** Approved for Implementation  
**Date:** November 5, 2026

---

## Problem Statement

AgenticPay AI separates AI advisory from financial authority through deterministic TypeScript guardrails. However, the current settlement flow is **client-side and local**:
- No real PayPal Payouts API call
- No server-side row locks or atomic transactions
- No deterministic idempotency keys
- No protection against double-payments or race conditions
- Demo shows "local settlement," not "real PayPal integration"

**Impact on Hackathon Judging:**
- Pitch "PayPal Integration" is incomplete
- Cannot demonstrate "Real PayPal Payouts API call"
- Judges will see "proof-of-concept, not production-ready"
- No differentiation from local-only settlement competitors

---

## Glossary

| Term | Definition |
|------|-----------|
| **Server-Authoritative Settlement** | All settlement decisions (validation, guardrail checks, PayPal invocation) happen server-side; browser cannot forge or bypass controls |
| **Deterministic Fingerprint** | SHA256 hash of (projectId + milestoneId + amount); used to derive idempotency keys |
| **Fail-Closed Rail** | When PayPal credentials are absent, payout is rejected (production) or recorded honestly as simulated/suppressed (non-production); never double-pays |
| **Row Lock** | PostgreSQL `FOR UPDATE` lock on milestone row; prevents concurrent settlement of same milestone |
| **Atomic Transaction** | All-or-nothing: if PayPal fails, all state changes (milestone status, spend, envelope) are rolled back |
| **Autonomous Settlement Cap** | Milestones <= $1,000 USD with passing audit (>= 85% confidence) can settle without human approval |
| **Human-in-the-Loop** | Milestones > $1,000 USD or INCOMING contracts require explicit client authorization before settlement |

---

## Requirements

### Requirement 1: Server-Authoritative Settlement Endpoint

**User Story:** As a financial operator, I want the server to enforce all settlement controls atomically so that no client-side modification can bypass guardrails or create double-payments.

#### Acceptance Criteria

1. **Endpoint Creation:**
   - New route: `POST /api/projects/[projectId]/milestones/[milestoneId]/settle`
   - Path parameters: `projectId` (string), `milestoneId` (string)
   - Request body: `{ "amount": number }`
   - Authentication: Required (session token via HttpOnly cookie)
   - CSRF: Same-origin check enforced

2. **Pre-Settlement Validation (Server-Side):**
   - Load project and envelope from database under PostgreSQL row locks
   - Verify milestone exists and belongs to project
   - Revalidate milestone status is `AUDITED_PENDING_APPROVAL` (not `COMPLETED`, `LOCKED`, or `PENDING`)
   - Revalidate contract status is `ACTIVE` (not `PAUSED`, `COMPLETED`, `CANCELLED`)
   - Revalidate server-side kill-switch is NOT active (fail if active)
   - Revalidate server-recorded audit score >= 85%
   - Verify amount matches milestone.amountUSD (within $0.01)
   - Verify amount > 0

3. **Guardrail Enforcement (Server-Side):**
   - Verify per-transaction ceiling: `amount <= envelope.maxPerTransactionUSD`
   - Verify daily ceiling: `envelope.spentTodayUSD + amount <= envelope.dailyCeilingUSD`
   - Verify project budget: `amount <= (project.budgetCapUSD - project.spentUSD)`
   - Verify human approval requirement: if `amount > 1000 USD` or `project.perspective === INCOMING`, require `requiresHumanApproval: true` in request body

4. **Idempotency (Deterministic Keys):**
   - Compute fingerprint: `SHA256(projectId + milestoneId + amount_as_string)`
   - Derive `PayPal-Request-Id`: `REQ-{fingerprint.slice(0, 32)}`
   - Derive `sender_batch_id`: `SETTLE-{fingerprint.slice(0, 28)}`
   - Query existing ledger events for same fingerprint: if found, return `200 OK` with cached result (idempotent retry)

5. **PayPal Payouts Invocation:**
   - Call PayPal `/v1/oauth2/token` (OAuth2) with server-held credentials
   - Call PayPal `POST /v1/payments/payouts` with `sender_batch_id` and deterministic `PayPal-Request-Id` header
   - If credentials absent: fail-closed (reject in production; simulate/suppress in non-production)

6. **Atomic Completion:**
   - **On PayPal Success:**
     - Atomically within transaction: mark milestone `COMPLETED`
     - Increment project.spentUSD by amount
     - Increment envelope.spentTodayUSD by amount
     - Insert `PAYOUT_EXECUTED` event with `payout_batch_id` and `batch_status` from PayPal
     - COMMIT transaction
     - Return `200 OK` with settlement details
   - **On PayPal Failure:**
     - Log `PAYOUT_BLOCKED` security event with error code and reason
     - ROLLBACK transaction (milestone, spend, envelope unchanged)
     - Return `HTTP 502` with structured error (not `500`)

---

### Requirement 2: Idempotent Ledger Deduplication

**User Story:** As an operator, I want retries of the same settlement to return the cached result instead of double-paying or incrementing totals.

#### Acceptance Criteria

1. **Unique Constraint:**
   - Ledger events table has unique constraint on `(user_id, fingerprint_id)` 
   - Retry of same milestone settlement uses same fingerprint; INSERT rejected with `DUPLICATE_KEY` error
   - Catch duplicate key error and return `200 OK` with original settlement result

2. **Cached Result Retrieval:**
   - On duplicate key: query ledger events for event with same fingerprint
   - Return cached event including real PayPal `payout_batch_id` and `batch_status`
   - Do not increment project.spentUSD or envelope.spentTodayUSD again

3. **Ledger Event Structure:**
   - Include: `fingerprint_id`, `settlement_id`, `payout_batch_id`, `batch_status`, `paypal_request_id`, `sender_batch_id`, `timestamp`, `amount_usd`

---

### Requirement 3: Fail-Closed PayPal Rails

**User Story:** As a compliance officer, I want settlement to fail safely when credentials are missing or PayPal rejects the payout, with full atomicity and honest ledger records.

#### Acceptance Criteria

1. **Three-Rail Contract:**
   - **PAYPAL_SANDBOX Rail:** When `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are set, execute real PayPal Sandbox Payouts API
   - **SIMULATED Rail:** When credentials absent AND `PAYPAL_SIMULATION_MODE=true` (non-production only), return deterministic simulated `payout_batch_id` without network I/O; record honest ledger entry indicating simulation
   - **SUPPRESSED Rail:** When credentials absent AND no simulation flag (non-production), record honest ledger entry indicating suppressed payout; return `HTTP 502` in production

2. **PayPal Failure Handling:**
   - Catch PayPalPayoutError (e.g., `INSUFFICIENT_FUNDS`, `RECEIVER_CANNOT_BE_BLANK`)
   - Log error code and reason
   - ROLLBACK transaction atomically
   - Return `HTTP 502` with structure: `{ error: "Payout failed", code: "PAYPAL_ERROR", details: { error_code: "...", message: "..." } }`

3. **Ledger Event Recording:**
   - For success: `status: "PAYOUT_EXECUTED"`, `batch_status` from PayPal, `payout_batch_id` from PayPal
   - For simulated: `status: "PAYOUT_EXECUTED"`, `batch_status: "SIMULATED"`, `payout_batch_id: "SIMULATED-..."`
   - For suppressed: `status: "PAYOUT_BLOCKED"`, `reason: "SUPPRESSED_RAIL_NO_CREDENTIALS"`, no `payout_batch_id`

---

### Requirement 4: Authentication & Rate-Limiting Activation

**User Story:** As a security officer, I want all financial routes to require authentication and rate-limiting so that unauthorized users cannot abuse settlement endpoints.

#### Acceptance Criteria

1. **Current State Assessment:**
   - ✅ `POST /api/agent/audit` has authentication and rate-limiting
   - ✅ `POST /api/agent/stream` has authentication and rate-limiting
   - ⚠️ New settlement route must inherit authentication (session required) and rate-limiting

2. **Authentication Requirements:**
   - All endpoints require valid session token (HttpOnly cookie)
   - Session must not be expired
   - User ID from session must match resource owner (project.userId === session.user.id)

3. **Rate-Limiting Requirements:**
   - **Process-Local Implementation (Current):**
     - In-memory fixed-window bucket per user: `milestone:settle:{userId}`
     - Limit: 15 requests per 60 seconds
     - Header: `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
     - Return `HTTP 429` on exceed
   - **Future PostgreSQL Persistence Option:**
     - For production, move counters to table `agenticpay_rate_limits`
     - Allows cross-instance sharing on Render

4. **Logging:**
   - Each RATE_LIMITED rejection: log security event with user ID, route, timestamp, remaining requests

---

### Requirement 5: PayPal Integration Verification

**User Story:** As a product lead, I want to verify that real PayPal Sandbox Payouts are being executed and recorded so I can demonstrate live integration to judges.

#### Acceptance Criteria

1. **Test Scenario Setup:**
   - Create test account with PayPal Sandbox credentials
   - Create test contract with budget cap $5,000 USD
   - Create test milestone ($250 USD, acceptance criteria simple)
   - Pre-load test data (optionally)

2. **End-to-End Flow Verification:**
   - Submit deliverable via audit endpoint
   - Receive audit result with score >= 85%, settlement mode `AUTONOMOUS`
   - Call settlement route with amount matching milestone
   - Verify HTTP `200 OK` response with `payout_batch_id` from PayPal
   - Verify `payout_batch_id` is real (matches format `$BATCH_ID-XXXXXX-XXXXX`)
   - Log into PayPal Sandbox Dashboard and confirm batch appears in transaction history
   - Verify ledger event records real `batch_status` (e.g., `PROCESSING`, `SUCCESS`)

3. **Failure Scenario Verification:**
   - Call settlement with insufficient budget (amount > remaining budget)
   - Verify HTTP `402 Payment Required` or `422 Unprocessable Entity`
   - Verify transaction not created, spend not incremented
   - Call settlement twice with same milestone
   - Verify second call returns cached result with same `payout_batch_id`

4. **Documentation:**
   - Screenshot of PayPal Dashboard showing real batch
   - Screenshot of ledger entry with real `payout_batch_id`
   - Test log showing audit score, settlement mode, PayPal call response

---

## Non-Functional Requirements

### Performance

- Settlement endpoint latency: < 5 seconds (including PayPal OAuth + Payouts call)
- Row lock held for < 2 seconds (minimal critical section)
- Idempotency key lookup: < 100ms

### Security

- All settlement data (PayPal credentials, OAuth tokens, payout amounts) stays server-side
- No settlement details leaked to browser beyond `payout_batch_id` and `batch_status`
- Audit scores, kill-switch state, envelope limits always revalidated server-side
- No client-side override of guardrails possible

### Reliability

- Transactional atomicity: guarantee no partial updates
- Idempotent retries: same fingerprint always returns same result
- Fail-closed: no settlement executed without credentials (or explicit simulation flag)
- Rollback on PayPal error: zero partial state mutations

### Compliance

- All settlement events logged to durable ledger (PostgreSQL)
- Per-user event deduplication by fingerprint
- Audit trail includes: timestamp, user ID, milestone ID, amount, `payout_batch_id`, `batch_status`, risk level

---

## Success Criteria

1. ✅ Settlement route exists at `/api/projects/[projectId]/milestones/[milestoneId]/settle`
2. ✅ Real PayPal Sandbox Payout executed (verified in PayPal Dashboard)
3. ✅ Deterministic idempotency keys prevent double-payments
4. ✅ Atomic transactions: success → milestone complete + spend incremented; failure → full rollback
5. ✅ Row locks prevent concurrent settlement of same milestone
6. ✅ Ledger events deduplicated by fingerprint
7. ✅ Demo shows real PayPal `payout_batch_id` in ledger with "Payment Rail: PAYPAL_SANDBOX" badge
8. ✅ Video proof-of-concept: E2E settlement from contract creation to PayPal Sandbox confirmation

