# Design: PayPal Settlement Hardening & Agentic Commerce Guardrails

**Feature Name:** `paypal-settlement-hardening`  
**Status:** Ready for Task Breakdown  
**Date:** November 5, 2026

---

## System Architecture Overview

```text
┌─────────────────────────────────────────────────────┐
│ Browser (Next.js Client)                            │
│  - ProjectWorkspaceView                             │
│  - Call: POST /api/projects/[id]/milestones/[mid]/settle │
│  - Display: settlement result, ledger update        │
└────────────────┬────────────────────────────────────┘
                 │ Authenticated HTTPS + CSRF Check
                 │
┌────────────────v────────────────────────────────────┐
│ Next.js Route Handler: /api/projects/.../settle     │
│ ┌──────────────────────────────────────────────────┐│
│ │ 1. Verify session + same-origin                  ││
│ │ 2. Rate-limit check (15/min)                     ││
│ │ 3. BEGIN transaction                             ││
│ │ 4. LOCK milestone FOR UPDATE (row lock)          ││
│ │ 5. Load project, envelope, milestone server-side ││
│ │ 6. Compute fingerprint = SHA256(...)             ││
│ │ 7. Derive PayPal-Request-Id + sender_batch_id    ││
│ │ 8. Revalidate guardrails (kill-switch, budget)   ││
│ │ 9. Invoke MilestonePayoutExecutor                ││
│ │    - Call PayPal Payouts (or fail-closed)        ││
│ │ 10. On success: mark COMPLETED, increment spend  ││
│ │ 11. Insert PAYOUT_EXECUTED event (dedup by FK)   ││
│ │ 12. COMMIT transaction                           ││
│ │ 13. Return 200 OK with payout_batch_id           ││
│ └──────────────────────────────────────────────────┘│
└────────────────┬────────────────────────────────────┘
                 │
         ┌───────┴─────────┐
         │                 │
    ┌────v────┐    ┌──────v──────┐
    │PostgreSQL    │PayPal Sandbox│
    │Row Locks     │Payouts API   │
    │Transactions  │              │
    │Ledger Events │              │
    └─────────┘    └──────────────┘
```

---

## Component Design

### 1. Settlement Route Handler (`src/app/api/projects/[projectId]/milestones/[milestoneId]/settle/route.ts`)

#### Input Contract
```typescript
// Request
POST /api/projects/abc123/milestones/m1/settle
Content-Type: application/json
Authorization: (via HttpOnly cookie)

{
  "requiresHumanApproval": false  // optional; required if amount > $1,000
}
```

#### Output Contract - Success (HTTP 200)
```typescript
{
  "success": true,
  "settlementId": "SETTLE-abc123def456...",
  "milestoneId": "m1",
  "projectId": "abc123",
  "amountUSD": 250.00,
  "payoutBatchId": "$BATCH_ID-12345678-ABCDEF",  // Real PayPal ID
  "batchStatus": "PROCESSING",                    // Real PayPal status
  "paypalRequestId": "REQ-abc123def456789abcdef01",
  "senderBatchId": "SETTLE-abc123def456789abcdef",
  "fingerprint": "abc123def456789abcdef01234567890123456789abcdefg",
  "timestamp": "2026-11-05T14:30:00Z",
  "ledgerEventId": "evt-xyz789",
  "remainingBudgetUSD": 4750.00
}
```

#### Output Contract - Failure (HTTP 4xx/5xx)

**Budget/Guardrail Failure (HTTP 422):**
```typescript
{
  "error": "Settlement rejected by guardrails",
  "reason": "Audit confidence score below 85% threshold",
  "riskLevel": "HIGH",
  "status": 422
}
```

**PayPal Payout Failure (HTTP 502):**
```typescript
{
  "error": "PayPal payout executor failed",
  "reason": "PayPal API error: INSUFFICIENT_FUNDS",
  "paypalErrorCode": "INSUFFICIENT_FUNDS",
  "paypalErrorMessage": "Sender wallet balance is insufficient for this payout request",
  "settlementId": "SETTLE-abc123def456...",  // Attempted settlement ID (transaction rolled back)
  "status": 502
}
```

#### Algorithm

```
FUNCTION settleM ilestone(projectId, milestoneId, requiresHumanApproval?)
  // Step 1: Auth + CSRF
  session ← getSession(request)
  IF !session THEN RETURN 401 Unauthorized
  IF !assertTrustedOrigin(request) THEN RETURN 403 Forbidden
  
  // Step 2: Rate Limit
  rate ← checkRateLimit("settle:" + session.user.id, 15, 60000)
  IF !rate.allowed THEN RETURN 429 Too Many Requests
  
  // Step 3: BEGIN TRANSACTION + ROW LOCK
  transaction ← db.beginTransaction()
  TRY
    milestone ← db.getMilestoneForUpdate(projectId, milestoneId)
      // SQL: SELECT * FROM milestones WHERE ... FOR UPDATE
    
    project ← db.getProject(session.user.id, projectId)
    envelope ← db.getEnvelope(session.user.id)
    
    amount ← milestone.amountUSD
    
    // Step 4: Revalidate Guardrails (all server-side)
    IF project.status != ACTIVE THEN
      RETURN 423 Locked ("Contract is not active")
    IF milestone.status NOT IN [AUDITED_PENDING_APPROVAL] THEN
      RETURN 409 Conflict ("Milestone is not ready for settlement")
    IF milestone.auditScore < 85 THEN
      RETURN 422 Unprocessable Entity ("Audit score below 85%")
    
    // Step 5: Guardrail Budget Checks
    IF envelope.killSwitchActive THEN
      RETURN 423 Locked ("Kill-switch is active")
    IF amount > envelope.maxPerTransactionUSD THEN
      RETURN 422 ("Exceeds per-transaction ceiling")
    IF envelope.spentTodayUSD + amount > envelope.dailyCeilingUSD THEN
      RETURN 422 ("Exceeds daily ceiling")
    IF amount > (project.budgetCapUSD - project.spentUSD) THEN
      RETURN 402 ("Exceeds remaining project budget")
    
    // Step 6: Human Approval Check
    IF (amount > 1000) OR (project.perspective == INCOMING) THEN
      IF !requiresHumanApproval THEN
        RETURN 422 ("Human approval required for this amount/perspective")
    
    // Step 7: Compute Fingerprint & Idempotency Keys
    fingerprint ← SHA256(projectId + milestoneId + amount.toFixed(2))
    paypalRequestId ← "REQ-" + fingerprint.slice(0, 32)
    senderBatchId ← "SETTLE-" + fingerprint.slice(0, 28)
    
    // Step 8: Check Existing Event (Idempotency)
    existing ← db.findLedgerEventByFingerprint(session.user.id, fingerprint)
    IF existing THEN
      RETURN 200 OK (existing settlement result)  // Cached
    
    // Step 9: Invoke PayPal Payouts
    payoutExecutor ← createMilestonePayoutExecutor(
      projectId, milestoneId, amount,
      paypalRequestId, senderBatchId
    )
    payoutResult ← payoutExecutor.execute()
      // Real: calls PayPal /v1/payments/payouts
      // Simulated: returns deterministic batch ID
      // Suppressed: returns error (or rejects in production)
    
    // Step 10: Handle Payout Result
    IF payoutResult.success THEN
      // Atomically update milestone, project, envelope
      db.updateMilestone(milestoneId, { status: COMPLETED, payoutBatchId: payoutResult.batchId })
      db.updateProject(projectId, { spentUSD: project.spentUSD + amount })
      db.updateEnvelope(session.user.id, {
        spentTodayUSD: envelope.spentTodayUSD + amount,
        activeEscrowUSD: envelope.activeEscrowUSD - amount
      })
      
      // Step 11: Record Ledger Event
      event ← db.insertLedgerEvent({
        userId: session.user.id,
        projectId,
        milestoneId,
        fingerprintId: fingerprint,
        status: PAYOUT_EXECUTED,
        payoutBatchId: payoutResult.batchId,
        batchStatus: payoutResult.status,  // From PayPal
        amount,
        paypalRequestId,
        senderBatchId,
        timestamp: NOW(),
        riskLevel: "LOW",
        auditConfidence: milestone.auditScore
      })
      // Note: unique constraint on (userId, fingerprintId) ensures deduplication
      
      // Step 12: COMMIT TRANSACTION
      transaction.commit()
      
      RETURN 200 OK ({
        success: true,
        settlementId: event.id,
        payoutBatchId: payoutResult.batchId,
        ...
      })
    ELSE
      // PayPal Payout Failed
      logSecurityEvent("PAYOUT_BLOCKED", {
        reason: payoutResult.error,
        riskLevel: "MEDIUM"
      })
      
      // Step 12: ROLLBACK TRANSACTION (no state mutations)
      transaction.rollback()
      
      RETURN 502 Bad Gateway ({
        error: "PayPal payout executor failed",
        reason: payoutResult.error,
        paypalErrorCode: payoutResult.errorCode,
        ...
      })
  CATCH error
    transaction.rollback()
    logError("Settlement transaction error", error)
    RETURN 500 Internal Server Error
END
```

---

### 2. Deterministic Fingerprint & Idempotency Keys

**Purpose:** Enable retries without double-payments or duplicate ledger entries.

**Fingerprint Derivation:**
```typescript
const fingerprint = createHash('sha256')
  .update([
    projectId,           // e.g., "proj-123abc"
    milestoneId,         // e.g., "m1"
    amount.toFixed(2)    // e.g., "250.00"
  ].join('|'))
  .digest('hex')  // 64 hex chars

// PayPal-Request-Id: first 32 chars (16 bytes)
const paypalRequestId = `REQ-${fingerprint.slice(0, 32)}`
// e.g., "REQ-a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"

// sender_batch_id: first 28 chars
const senderBatchId = `SETTLE-${fingerprint.slice(0, 28)}`
// e.g., "SETTLE-a1b2c3d4e5f6a7b8c9d0e1f2a3b"
```

**Ledger Event Deduplication:**
```typescript
// In PostgreSQL schema:
CREATE UNIQUE INDEX idx_ledger_fingerprint 
  ON agenticpay_ledger_events(user_id, fingerprint_id);

// On retry with same fingerprint:
// - INSERT fails with UNIQUE_VIOLATION
// - Catch error, query existing event
// - Return cached result (same payout_batch_id)
```

---

### 3. MilestonePayoutExecutor Integration

**Factory Function:**
```typescript
function createMilestonePayoutExecutor(
  projectId: string,
  milestoneId: string,
  amountUSD: number,
  paypalRequestId: string,
  senderBatchId: string
): MilestonePayoutExecutor {
  // Select rail based on credentials + env flags
  const rail = selectPayoutRail();
  
  return {
    async execute(): Promise<PayoutResult> {
      if (rail === "PAYPAL_SANDBOX") {
        // Real PayPal call
        const client = new PayPalClient();
        return client.executePayout({
          senderBatchId,
          paypalRequestId,
          items: [
            {
              recipientType: "EMAIL",
              amount: amountUSD.toString(),
              receiver: milestone.recipientEmail,  // From server milestone data
              note: `Milestone: ${milestone.title} (${projectId})`
            }
          ]
        });
      } else if (rail === "SIMULATED") {
        // Deterministic simulation (non-production only)
        return {
          success: true,
          batchId: `SIMULATED-${senderBatchId}`,
          status: "SIMULATED",
          timestamp: new Date().toISOString()
        };
      } else {
        // SUPPRESSED_RAIL: fail-closed
        return {
          success: false,
          error: "PayPal credentials not configured",
          errorCode: "CREDENTIALS_MISSING",
          rail: "SUPPRESSED"
        };
      }
    }
  };
}
```

---

### 4. PostgreSQL Schema Additions

**New Column on `agenticpay_ledger_events`:**
```sql
ALTER TABLE agenticpay_ledger_events ADD COLUMN (
  fingerprint_id VARCHAR(64) UNIQUE,       -- SHA256 hex string (64 chars)
  settlement_id VARCHAR(64),                -- Unique settlement identifier
  payout_batch_id VARCHAR(128),             -- Real PayPal batch ID or "SIMULATED-..."
  batch_status VARCHAR(32),                 -- "PROCESSING", "PENDING", "SUCCESS", "FAILED", "SIMULATED"
  paypal_request_id VARCHAR(64),            -- "REQ-..." idempotency key
  sender_batch_id VARCHAR(64),              -- "SETTLE-..." sender batch ID
  payout_executor_rail VARCHAR(32)          -- "PAYPAL_SANDBOX", "SIMULATED", "SUPPRESSED_RAIL"
);

CREATE UNIQUE INDEX idx_ledger_fingerprint 
  ON agenticpay_ledger_events(user_id, fingerprint_id);
```

**New Row on `agenticpay_milestones`:**
```sql
ALTER TABLE agenticpay_milestones ADD COLUMN (
  payout_batch_id VARCHAR(128),             -- Real PayPal batch ID (set at settlement)
  batch_status VARCHAR(32)                  -- PayPal status (set at settlement)
);
```

---

### 5. Error Handling & Recovery

**PayPal Failure Recovery:**
- On `PayPalPayoutError`: catch exception, log details, ROLLBACK transaction
- Retry with same fingerprint: idempotency keys ensure no double-pay
- HTTP 502 returned (not 500): indicates external service failure, not server bug

**Ledger Duplication Recovery:**
- On `UNIQUE_VIOLATION` for fingerprint: query existing event
- Return cached result with original `payout_batch_id`
- No double-increment of project.spentUSD

**Network Timeout Recovery:**
- PayPal call timeout (> 45 seconds): abort, ROLLBACK, return 502
- Retry with same fingerprint: PayPal recognizes `PayPal-Request-Id`, returns same batch ID

---

## Data Flow Diagrams

### Settlement Success Path
```
Browser              Route Handler         PayPal SDK      PostgreSQL
  │                     │                    │               │
  ├─POST /settle───────>│                    │               │
  │                     ├─Verify Session     │               │
  │                     ├─BEGIN TRANSACTION  │               │
  │                     ├─LOCK Milestone     │               ├─Row Lock Held
  │                     ├─Validate Guards    │               │
  │                     ├─Compute Fingerprint│               │
  │                     ├─Check Dedup────────────────────────┤
  │                     ├─Execute Payout────>│               │
  │                     │                    ├─OAuth2        │
  │                     │                    ├─POST /payouts │
  │                     │<───Batch ID────────┤               │
  │                     ├─Mark COMPLETED     │               │
  │                     ├─Incr. Spend────────────────────────┤
  │                     ├─Insert Event───────────────────────┤
  │                     ├─COMMIT─────────────────────────────┤
  │<──200 OK + Batch ID─┤                    │               │
```

### Settlement Failure (PayPal Rejected)
```
Browser              Route Handler         PayPal SDK      PostgreSQL
  │                     │                    │               │
  ├─POST /settle───────>│                    │               │
  │                     ├─Verify Session     │               │
  │                     ├─BEGIN TRANSACTION  │               │
  │                     ├─LOCK Milestone     │               ├─Row Lock Held
  │                     ├─Validate Guards    │               │
  │                     ├─Compute Fingerprint│               │
  │                     ├─Execute Payout────>│               │
  │                     │                    ├─OAuth2        │
  │                     │                    ├─POST /payouts │
  │                     │<───ERROR: INSUF.───┤               │
  │                     ├─ROLLBACK───────────────────────────┤
  │                     │ (no state change)  │               │
  │<──502 Bad Gateway──│                    │               │
```

---

## Testing Strategy

### Unit Tests
- `checkRateLimit()` respects 15 req/min limit
- `buildMilestoneSettlementFingerprint()` produces deterministic output
- `MilestonePayoutExecutor` with mocked PayPal client

### Integration Tests
- Settlement route with mocked PayPal (success + error)
- Row lock behavior with concurrent requests (sequentially allowed, no race condition)
- Ledger deduplication: retry same settlement, verify cached result
- Project.spentUSD incremented once on success, not on retry

### E2E Tests (Live Sandbox)
- Create contract → submit deliverable → audit passing → settle → verify PayPal batch ID in Sandbox Dashboard

---

## Known Limitations & Future Work

1. **No PayPal Webhooks:** Post-payout reconciliation (refunds, chargebacks) not implemented
2. **No Vault Tokenization:** Receiver email required at settlement time (not pre-tokenized)
3. **Process-Local Rate Limiting:** Resets on instance restart; move to Redis for horizontal scaling
4. **No Email Notifications:** Settlement completion not emailed to parties
5. **No Dispute Handling:** PayPal disputes not surfaced or escalated

