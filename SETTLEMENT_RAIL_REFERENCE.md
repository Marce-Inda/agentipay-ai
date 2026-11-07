# Settlement Rail Reference: Three-Rail Fail-Closed Design

**Quick Reference for Demo Narration & Development**

---

## The Three Rails

### 1️⃣ PAYPAL_SANDBOX Rail (Real)

**Trigger:** `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` configured in environment

**What Happens:**
```
1. OAuth: POST /v1/oauth2/token (Basic auth with credentials)
   → Get access_token
2. Payout: POST /v1/payments/payouts (Bearer token)
   → PayPal returns real payout_batch_id, batch_status
3. Ledger: Record real batch ID + HTTP response
```

**Batch ID Format:** `$BATCH_ID-1234567-ABC` (returned by PayPal)  
**Database Field:** `payout_executor_rail = 'PAYPAL_SANDBOX'`  
**Demo Narration:**
> "The server has PayPal Sandbox credentials configured. When we click 'Release Milestone', 
> the system executes the real PayPal Payouts API. The actual batch ID is recorded in the ledger 
> and you can verify it in the PayPal Sandbox Dashboard."

**Judge Verification:**
- Check PayPal Sandbox Dashboard for batch ID
- Match batch ID in database ledger
- Confirm transaction exists with correct amount

---

### 2️⃣ SIMULATED Rail (Deterministic Demo)

**Trigger:** No credentials + `PAYPAL_SIMULATION_MODE=true` + non-production environment

**What Happens:**
```
1. Check: No credentials? Skip OAuth call
2. Simulate: Generate deterministic batch ID (SIM_PAYOUT_<hash>)
3. Ledger: Record simulated batch ID + mock HTTP log
4. Network: Zero network egress (no PayPal call made)
```

**Batch ID Format:** `SIM_PAYOUT_a1b2c3d4e5f6` (locally generated)  
**Database Field:** `payout_executor_rail = 'SIMULATED'`  
**HTTP Response:** Honest mock showing what a real response would look like  
**Demo Narration:**
> "For this demo, we don't have credentials configured, but we can still show how 
> the system would settle. The SIMULATED rail generates a deterministic batch ID locally 
> and records it with an honest 'SIMULATED' flag. This is for testing and demos—no funds move."

**Judge Verification:**
- Batch ID starts with `SIM_PAYOUT_`
- HTTP log explicitly states "SIMULATED POST /v1/payments/payouts"
- Database shows `payout_executor_rail = 'SIMULATED'`
- **No verification in PayPal Dashboard** (settlement never reached PayPal)

---

### 3️⃣ SUPPRESSED_RAIL (Local Ledger Only)

**Trigger:** No credentials + `PAYPAL_SIMULATION_MODE=false` or not set + non-production environment

**What Happens:**
```
1. Check: No credentials? Skip OAuth call
2. Check: Simulation disabled? Return SUPPRESSED_RAIL
3. Ledger: Record suppressed entry + honest HTTP log stating rail was suppressed
4. Network: Zero network egress (no PayPal call made)
5. Message: "Rails suppressed: sandbox credentials are not configured; settlement recorded locally only"
```

**Batch ID Format:** `SETTLE-<fingerprint_prefix>` (deterministic, matches fingerprint-derived ID)  
**Database Field:** `payout_executor_rail = 'SUPPRESSED_RAIL'`  
**HTTP Response:** Honest log showing "SUPPRESSED RAIL: POST /v1/payments/payouts not attempted"  
**Demo Narration:**
> "Without credentials and with simulation disabled, the system records the settlement 
> but explicitly states 'SUPPRESSED_RAIL'—meaning the payout was not executed. The ledger 
> entry is completely honest about what happened. No fake transfers, no hidden behavior."

**Judge Verification:**
- Batch ID format: `SETTLE-<hash>`
- HTTP log explicitly states "SUPPRESSED RAIL"
- Database shows `payout_executor_rail = 'SUPPRESSED_RAIL'`
- **No verification in PayPal Dashboard** (settlement never reached PayPal)

---

### ⛔ PRODUCTION Behavior (Special Case)

**Trigger:** Environment = 'production' + no credentials

**What Happens:**
```
1. Check: Production environment?
2. Check: No credentials?
3. Throw: PayPalPayoutError("PayPal production credentials are required to execute payouts.")
4. Result: HTTP 502 (Bad Gateway)
5. Ledger: Settlement REJECTED (not recorded as PAYOUT_EXECUTED)
```

**Never allowed:** Production environment with missing credentials returns hard error  
**Safety:** Prevents accidental suppressed payouts in production  
**Demo Narration:** (Not shown in demo, but explain if asked)
> "In production, if credentials are missing, the entire settlement fails with HTTP 502. 
> We never allow production payouts to be suppressed—either you have credentials and execute, 
> or the settlement is rejected."

---

## Decision Tree for Demo

```
START Recording Settlement

↓ Do you have PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET configured?

├─ YES (Real Credentials Available)
│  └─ Say: "Real PayPal Payouts API will execute"
│     ├─ Click Release Milestone
│     ├─ Show: Real batch ID + PAYPAL_SANDBOX indicator
│     └─ Optional: Verify in PayPal Sandbox Dashboard

└─ NO (No Credentials)
   ├─ Is PAYPAL_SIMULATION_MODE set to 'true'?
   │
   ├─ YES (Simulation Enabled)
   │  └─ Say: "Simulation mode demonstrates the settlement flow"
   │     ├─ Click Release Milestone
   │     ├─ Show: SIM_PAYOUT_* batch ID + SIMULATED indicator
   │     └─ Highlight: "Fail-closed design—no funds move"
   │
   └─ NO (Simulation Disabled / Suppressed Mode)
      └─ Say: "Fail-closed mode shows honest suppressed entry"
         ├─ Click Release Milestone
         ├─ Show: SETTLE-* batch ID + SUPPRESSED_RAIL indicator
         └─ Highlight: "System is transparent about what didn't happen"

END
```

---

## Code Reference

### Where Rails Are Determined

**File:** `src/lib/paypal/client.ts` (Lines 147–187)

```typescript
async executeMilestonePayout(payout: { ... }): Promise<MilestonePayoutOutcome> {
  // ...
  if (!this.hasCredentials()) {
    // ← No credentials
    
    if (!this.simulationMode) {
      // ← Simulation disabled
      
      if (this.environment === 'production') {
        // ← Production + no credentials = ERROR
        throw new PayPalPayoutError('PayPal production credentials are required...');
      }
      
      // ← Non-production + no credentials + simulation disabled = SUPPRESSED
      return {
        success: true,
        rail: 'SUPPRESSED_RAIL',
        payoutBatchId: senderBatchId,
        ...
      };
    }
    
    // ← Non-production + no credentials + simulation enabled = SIMULATED
    return {
      success: true,
      rail: 'SIMULATED',
      payoutBatchId: simulatedBatchId,
      ...
    };
  }
  
  // ← Credentials available = REAL
  const token = await this.getAccessToken();
  // ... execute real PayPal call ...
  return {
    success: true,
    rail: 'PAYPAL_SANDBOX',
    payoutBatchId: realBatchId,
    ...
  };
}
```

### Where Rails Are Recorded

**File:** `src/lib/db/repository.ts`

```typescript
async recordSettlementEvent(
  userId: string,
  fingerprintId: string,
  eventData: SettlementEventData
): Promise<LedgerEvent> {
  // eventData.payoutExecutorRail = 'PAYPAL_SANDBOX' | 'SIMULATED' | 'SUPPRESSED_RAIL'
  // Insert into agenticpay_ledger_events (payout_executor_rail, ...)
}
```

### Where Rails Are Displayed

**Expected UI Components:**
- Settlement response JSON: `payRail` field
- Ledger row: Payment Rail badge (colored indicator)
- Payload inspector: HTTP log showing which rail was used

---

## Demo Narration Scripts (Copy-Paste Ready)

### Script A: Real Credentials Available
```
"The server is configured with PayPal Sandbox credentials. 
When I click 'Release Milestone', the system will:
1. Authenticate via OAuth
2. Execute the real Payouts API
3. Record the actual payout_batch_id in the ledger
4. We can verify it in the PayPal Dashboard

Let's do it..."

[Click Release Milestone]

"Notice the response shows:
- Real batch ID: $BATCH_ID-...
- Payment Rail: PAYPAL_SANDBOX
- This is a live integration with PayPal Sandbox."
```

### Script B: Simulation Mode (No Credentials, Demo)
```
"For this demo, we're running in simulation mode 
without PayPal credentials. The system will:
1. Skip the OAuth call
2. Generate a deterministic SIMULATED batch ID
3. Record it with an honest 'SIMULATED' flag
4. No network calls, no funds move

This demonstrates our fail-closed design. Let's see it..."

[Click Release Milestone]

"Notice:
- Batch ID starts with SIM_PAYOUT_
- Payment Rail: SIMULATED
- HTTP log shows '[SIMULATED POST /v1/payments/payouts]'
- Completely honest about what happened."
```

### Script C: Suppressed Mode (No Credentials, No Simulation)
```
"Without credentials and without simulation enabled, 
the system is in fail-closed suppressed mode. It will:
1. Record the settlement locally
2. Mark it as SUPPRESSED_RAIL
3. Show completely honest logs

Let's see what happens..."

[Click Release Milestone]

"Notice:
- Batch ID: SETTLE-<hash>
- Payment Rail: SUPPRESSED_RAIL
- HTTP log: '[SUPPRESSED RAIL: POST /v1/payments/payouts not attempted]'
- The system transparently states nothing happened at PayPal."
```

---

## Judge Q&A Preparation

**Q: How do I know you're not faking the PayPal call?**  
A: If we show PAYPAL_SANDBOX rail with a real batch ID, you can search for it in your PayPal Sandbox Dashboard. That's the ultimate proof. If we show SIMULATED or SUPPRESSED, the HTTP log explicitly states what didn't happen—we're not hiding it.

**Q: What if the demo fails during recording?**  
A: We have three options:
1. Record with SIMULATED mode (equally credible—shows defensive design)
2. Record with SUPPRESSED mode (also credible—honest ledger entry)
3. Pre-record with real credentials, splice it in with clear overlay

We will never fake a PayPal response.

**Q: Is this production-ready?**  
A: The architecture is production-ready. The demo uses Sandbox (non-production). For real production, you'd need:
- Real PayPal merchant account
- Production credentials
- State money transmitter licenses (depending on jurisdiction)
- FinCEN/AML compliance audit

**Q: How does idempotency work?**  
A: The deterministic fingerprint (SHA-256 of projectId + milestoneId + amount) generates the PayPal-Request-Id and sender_batch_id. If you retry the same settlement:
- Same fingerprint → same PayPal-Request-Id
- PayPal deduplicates by request ID
- Same batch ID returned
- No double-payment

---

## Environment Variables Reference

```bash
# Use REAL PayPal Sandbox API
export PAYPAL_CLIENT_ID="your_sandbox_client_id"
export PAYPAL_CLIENT_SECRET="your_sandbox_client_secret"
export PAYPAL_MODE="sandbox"
# Result: PAYPAL_SANDBOX rail

# Use SIMULATED mode (for demo without credentials)
export PAYPAL_SIMULATION_MODE="true"
export PAYPAL_MODE="sandbox"
# Result: SIMULATED rail

# Use SUPPRESSED mode (default when no credentials)
# Don't set PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_SIMULATION_MODE
export PAYPAL_MODE="sandbox"
# Result: SUPPRESSED_RAIL

# Production (will ERROR without credentials)
export PAYPAL_MODE="production"
# No credentials → PayPalPayoutError, HTTP 502
```

---

## Quick Checklist Before Recording

- [ ] Verify which rail your environment uses: `echo "Rail: $PAYPAL_CLIENT_ID:$PAYPAL_SIMULATION_MODE"`
- [ ] Test one settlement (don't record) to confirm batch ID format
- [ ] Know your narration for that specific rail
- [ ] Have backup plan ready (fail-closed equally credible)
- [ ] Record Payment Rail indicator prominently
- [ ] If PAYPAL_SANDBOX: Have PayPal Dashboard tab ready
- [ ] If SIMULATED/SUPPRESSED: Emphasize fail-closed design

---

**Last Updated:** November 6, 2026  
**For:** Demo team, judges, code reviewers

