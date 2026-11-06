# Demo Readiness Checklist

**Feature:** PayPal Settlement Hardening & Agentic Commerce Guardrails  
**Objective:** Verify all components are configured and ready for the 3-minute demo  
**Date:** November 5, 2026  
**Status:** Ready for Verification

---

## Pre-Demo Infrastructure Checks

### ✅ PayPal Sandbox Configuration

- **Credentials loaded:**
  ```bash
  echo $PAYPAL_CLIENT_ID      # Should print non-empty value
  echo $PAYPAL_CLIENT_SECRET  # Should print non-empty (or be unset in shell)
  ```
- **Mode set to Sandbox (default):**
  ```bash
  echo $PAYPAL_MODE           # Should be "sandbox" or unset (default: sandbox)
  ```
- **Simulation mode (optional):**
  ```bash
  echo $PAYPAL_SIMULATION_MODE # Optional; if unset, real Payouts API is used
  ```
- **Verify credentials are valid:** Run a quick test OAuth call (internal script)
  ```bash
  npm test -- --testPathPattern="11-1-sandbox-config"
  ```

### ✅ Database & Schema Migration

- **PostgreSQL running locally (development) or accessible (production):**
  ```bash
  psql -d agenticpay_dev -c "SELECT COUNT(*) FROM agenticpay_projects;"
  # Should return a number (e.g., 1-5 test projects)
  ```
- **Ledger schema updated with settlement columns:**
  ```bash
  psql -d agenticpay_dev -c "\d agenticpay_ledger_events" | grep -E "fingerprint|payout_batch"
  # Should show: fingerprint_id, payout_batch_id, batch_status, paypal_request_id, etc.
  ```
- **Milestones schema updated:**
  ```bash
  psql -d agenticpay_dev -c "\d agenticpay_milestones" | grep -E "payout_batch|batch_status"
  # Should show: payout_batch_id, batch_status columns
  ```
- **Unique index on fingerprint:**
  ```bash
  psql -d agenticpay_dev -c "\di" | grep fingerprint
  # Should show: idx_ledger_fingerprint (user_id, fingerprint_id)
  ```

### ✅ Settlement Route Compiled

- **Route handler exists and compiles:**
  ```bash
  npx tsc --noEmit
  # Should complete without errors
  ```
- **Route file present:**
  ```bash
  ls -la src/app/api/projects/\[projectId\]/milestones/\[milestoneId\]/settle/route.ts
  # Should exist
  ```

### ✅ Development Server Starts

- **Start the dev server:**
  ```bash
  npm run dev
  # Should start on http://localhost:3000 without errors
  ```
- **Server logs show no critical errors:**
  - Look for lines like: "✓ Ready in X seconds"
  - No "ECONNREFUSED" for database
  - No missing `.env` variables marked as required

### ✅ Tests Passing

- **Core settlement tests pass:**
  ```bash
  npm test -- --testPathPattern="11-3-settlement-simple"
  # All tests should pass (no failures, no timeouts)
  ```
- **PayPal sandbox config test passes:**
  ```bash
  npm test -- --testPathPattern="11-1-sandbox-config"
  # Should verify credentials are loadable
  ```
- **All tests suite passes:**
  ```bash
  npm test
  # Should show: X tests passed, 0 failed
  ```

---

## Test Data Preparation

### ✅ Create Test Contract

**Pre-created test contract for demo:**

- **Name:** "AgenticPay Vendor Services"
- **Vendor:** "Demo Vendor Inc." (`vendor@demo.agenticpay.local`)
- **Budget Cap:** $5,000 USD
- **Status:** ACTIVE
- **Perspective:** OUTGOING (you are the client/funder)
- **Milestones:**
  - **Milestone 1:** "Phase 1: Integration"
    - Amount: $250 USD
    - Acceptance Criteria: "GitHub PR merged to `main` with passing CI/CD tests"
    - Status: PENDING (before audit)
  - (Optional) **Milestone 2:** "Phase 2: Testing"
    - Amount: $500 USD
    - Acceptance Criteria: "Full test suite passes with >80% coverage"
    - Status: PENDING

**How to create (if not already exists):**

1. Sign in to http://localhost:3000
2. Click "Create Contract"
3. Fill in details above
4. Click "Save Contract"
5. Verify the contract appears in the OUTGOING swimlane

### ✅ Pre-Audit Test Milestone

**Ensure Milestone 1 has been audited and is ready for settlement:**

- **Audit Submission:**
  - Deliverable Type: GitHub PR URL
  - Deliverable: `https://github.com/Marce-Inda/agentipay-ai/pull/123` (or real PR)
  - Expected Audit Score: >= 91%

- **Audit Result:**
  - Confidence: 91% (or higher)
  - Risk Level: LOW
  - Settlement Mode: AUTONOMOUS
  - Rationale: "GitHub PR detected. High-confidence evidence of work completion."
  - Milestone Status (server-side): AUDITED_PENDING_APPROVAL

- **How to verify audit was recorded:**
  ```bash
  psql -d agenticpay_dev -c "SELECT id, audit_score, status FROM agenticpay_milestones WHERE title='Phase 1: Integration';"
  # Should show: id=m1, audit_score=91, status=AUDITED_PENDING_APPROVAL
  ```

### ✅ Budget Envelope Ready

- **Envelope values (server-side):**
  ```bash
  psql -d agenticpay_dev -c "SELECT max_per_transaction_usd, daily_ceiling_usd, spent_today_usd, kill_switch_active FROM agenticpay_envelopes LIMIT 1;"
  # Should show:
  # max_per_transaction_usd | 1500
  # daily_ceiling_usd       | 10000
  # spent_today_usd         | 0 (or small amount from previous test)
  # kill_switch_active      | false
  ```
- **Kill-switch is OFF:**
  - Verify in the workspace header or call:
  ```bash
  curl http://localhost:3000/api/envelope -H "Cookie: ..." | jq .killSwitchActive
  # Should return: false
  ```

---

## Settlement Execution Verification

### ✅ Settlement Route Executes

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Submit the settlement request** (from the workspace UI):
   - Click "Release Milestone" on Phase 1 ($250 USD)
   - Or via curl:
   ```bash
   curl -X POST http://localhost:3000/api/projects/[projectId]/milestones/m1/settle \
     -H "Content-Type: application/json" \
     -H "Cookie: session=..." \
     -d '{"requiresHumanApproval": false}'
   ```

3. **Expected response (HTTP 200 OK):**
   ```json
   {
     "success": true,
     "settlementId": "SETTLE-abc123def456...",
     "milestoneId": "m1",
     "amountUSD": 250.00,
     "payoutBatchId": "$BATCH_ID-12345678-ABCDEF",
     "batchStatus": "PROCESSING",
     "paypalRequestId": "REQ-abc123def456789abcdef01",
     "senderBatchId": "SETTLE-abc123def456789abcdef",
     "fingerprint": "abc123def456789...",
     "timestamp": "2026-11-05T14:30:00Z",
     "remainingBudgetUSD": 4750.00
   }
   ```

4. **Verify response contains real PayPal batch ID:**
   - `payoutBatchId` should start with `$BATCH_ID-` (real Sandbox format)
   - `batchStatus` should be `PROCESSING` or `SUCCESS`

### ✅ Ledger Event Recorded

1. **Query ledger for settlement event:**
   ```bash
   psql -d agenticpay_dev -c "SELECT settlement_id, payout_batch_id, batch_status, payout_executor_rail FROM agenticpay_ledger_events ORDER BY created_at DESC LIMIT 1;"
   # Should show:
   # settlement_id         | SETTLE-abc123def456...
   # payout_batch_id       | $BATCH_ID-12345678-ABCDEF
   # batch_status          | PROCESSING
   # payout_executor_rail  | PAYPAL_SANDBOX
   ```

2. **Verify fingerprint deduplication:**
   ```bash
   psql -d agenticpay_dev -c "SELECT COUNT(*) FROM agenticpay_ledger_events WHERE fingerprint_id='<fingerprint_from_response>';"
   # Should return: 1 (only one entry, not duplicated)
   ```

### ✅ Milestone Status Updated

1. **Verify milestone marked COMPLETED:**
   ```bash
   psql -d agenticpay_dev -c "SELECT id, status, payout_batch_id FROM agenticpay_milestones WHERE id='m1';"
   # Should show:
   # id   | m1
   # status | COMPLETED
   # payout_batch_id | $BATCH_ID-12345678-ABCDEF
   ```

2. **Verify project.spentUSD incremented:**
   ```bash
   psql -d agenticpay_dev -c "SELECT spent_usd FROM agenticpay_projects WHERE id='<projectId>';"
   # Should show: spent_usd >= 250.00
   ```

### ✅ Idempotency Verified (Retry Same Settlement)

1. **Retry the settlement with same milestone/amount:**
   ```bash
   curl -X POST http://localhost:3000/api/projects/[projectId]/milestones/m1/settle \
     -H "Content-Type: application/json" \
     -H "Cookie: session=..." \
     -d '{"requiresHumanApproval": false}'
   ```

2. **Expected response (should match first settlement):**
   - Same `settlementId`
   - Same `payoutBatchId` (not a new one)
   - HTTP 200 OK (idempotent)

3. **Verify project.spentUSD not double-incremented:**
   ```bash
   psql -d agenticpay_dev -c "SELECT spent_usd FROM agenticpay_projects WHERE id='<projectId>';"
   # Should still show: 250.00 (not 500.00)
   ```

4. **Verify only one ledger entry for this fingerprint:**
   ```bash
   psql -d agenticpay_dev -c "SELECT COUNT(*) FROM agenticpay_ledger_events WHERE fingerprint_id='<fingerprint>';"
   # Should return: 1
   ```

---

## PayPal Sandbox Dashboard Verification

### ✅ Batch Visible in Sandbox Dashboard

1. **Log into PayPal Sandbox Dashboard:**
   - URL: https://sandbox.paypal.com/
   - Credentials: (your Sandbox merchant account)

2. **Navigate to Activity → Transactions (or Batch Details):**
   - Path may vary: Accounts → Activity → Transactions or Payouts → History

3. **Search or filter for batch ID:**
   - Use the `payoutBatchId` from the settlement response (e.g., `$BATCH_ID-12345678-ABCDEF`)
   - Batch should appear in the list

4. **Verify batch details:**
   - **Batch ID:** $BATCH_ID-12345678-ABCDEF
   - **Type:** Payout (or Payouts)
   - **Amount:** $250.00 USD
   - **Status:** PROCESSING or SUCCESS
   - **Recipient Email:** (demo vendor email)
   - **Created Date/Time:** Recent (within last few minutes)

5. **Take a screenshot for documentation:**
   - Save as: `docs/assets/demo/paypal-batch-screenshot.png`
   - Ensure batch ID is visible and readable
   - Include the status and amount

---

## Demo Script & Timing Verification

### ✅ DEMO_SCRIPT.md Created

- **File exists:** `DEMO_SCRIPT.md`
- **Sections present:**
  - 1. Opening: Problem Statement (0:00–0:20)
  - 2. Portfolio Overview (0:20–0:45)
  - 3. Guardrails (0:45–1:15)
  - 4. Audit & Settlement (1:15–1:50)
  - 5. Ledger (1:50–2:10)
  - 6. PayPal Dashboard (2:10–2:50)
  - 7. Closing (2:50–3:00)
- **Timing accurate:** Total duration = 3 minutes (180 seconds)
- **Narration script provided:** Verbatim narration included for reference

---

## Screenshot & Asset Preparation

### ✅ Screenshots Ready for Demo

Create the following assets in `docs/assets/demo/`:

1. **Portfolio Page** (`portfolio-view.png`)
   - Shows both OUTGOING and INCOMING swimlanes
   - "AgenticPay Vendor Services" contract visible on left
   - Size: 1920x1080 (or similar)

2. **Milestone Audit Result** (`audit-result.png`)
   - Audit confidence: 91%
   - Settlement mode: AUTONOMOUS
   - Risk level: LOW
   - Rationale visible

3. **Settlement Button & Modal** (`settlement-modal.png`)
   - "Release Milestone" button (before click)
   - Settlement success modal (after click)
   - Shows settlement ID, batch ID, remaining budget

4. **Ledger Entry** (`ledger-entry.png`)
   - AG Grid showing recent PAYOUT_EXECUTED event
   - Columns visible: Status, Actor, Confidence, Amount, Rail, Timestamp
   - Real `payout_batch_id` visible in grid or expanded detail

5. **PayPal Dashboard Batch** (`paypal-batch-dashboard.png`)
   - PayPal Sandbox Activity/Transactions page
   - Batch entry showing:
     - Batch ID: $BATCH_ID-12345678-ABCDEF
     - Amount: $250.00 USD
     - Status: PROCESSING or SUCCESS
     - Recipient email

**Create directory:**
```bash
mkdir -p docs/assets/demo
```

**Save screenshots:**
- Use browser DevTools → Capture Screenshot (full page)
- Or use ScreenFlow, OBS, or similar
- Export as PNG (not JPEG, for clarity)
- Minimum width: 1280px (preferably 1920px)

---

## Demo Day Preparation (2-3 Hours Before)

### ✅ Pre-Demo Checklist (30 minutes before recording)

1. **Restart dev server** (to clear any stale state):
   ```bash
   npm run dev
   ```

2. **Clear browser cache** (if desired, to simulate fresh load):
   ```bash
   # In DevTools: DevTools → Application → Clear site data
   # Or: chrome://settings/clearBrowserData
   ```

3. **Sign in to the account:**
   - Navigate to http://localhost:3000
   - Sign in with demo credentials

4. **Verify test contract and milestone are ready:**
   - Portfolio view shows "AgenticPay Vendor Services"
   - Milestone 1 is in AUDITED_PENDING_APPROVAL status
   - Audit score: 91%

5. **Open PayPal Sandbox Dashboard in a separate tab:**
   - Pre-navigate to Activity/Transactions page
   - Have login ready (or stay logged in)

6. **Silence notifications:**
   - Close Slack, email, other notifications
   - Enable "Do Not Disturb" or similar

7. **Test microphone and screen recorder:**
   - Do a 10-second test recording
   - Verify audio levels and screen clarity

8. **Prepare camera/recording software:**
   - Chrome browser at 100% zoom
   - Terminal or dev tools ready (optional)
   - Screen recorder in standby

---

## Verification Commands (Quick Reference)

Run these in order to verify the entire stack is ready:

```bash
# 1. Check environment variables
echo "PayPal Client ID set: ${PAYPAL_CLIENT_ID:+YES}"
echo "PayPal Mode: ${PAYPAL_MODE:-sandbox}"

# 2. Check database connectivity
psql -d agenticpay_dev -c "SELECT VERSION();"

# 3. Check schema
psql -d agenticpay_dev -c "SELECT column_name FROM information_schema.columns WHERE table_name='agenticpay_ledger_events' AND column_name LIKE '%payout%';"

# 4. Run tests
npm test -- --testPathPattern="11-1-sandbox-config|11-3-settlement-simple" --maxWorkers=1

# 5. Build (quick validation)
npx tsc --noEmit

# 6. Start dev server (in a separate terminal)
npm run dev &
sleep 5

# 7. Health check
curl -s http://localhost:3000 | head -c 100
```

---

## Demo Data Snapshot (for reference)

If needed, you can restore test data using these values:

| Field | Value |
|-------|-------|
| Test Contract ID | `proj-demo-001` (or auto-generated) |
| Contract Name | AgenticPay Vendor Services |
| Budget Cap | $5,000.00 USD |
| Milestone 1 ID | `m1` |
| Milestone 1 Amount | $250.00 USD |
| Milestone 1 Audit Score | 91% |
| Milestone 1 Status | AUDITED_PENDING_APPROVAL |
| Envelope Max Per Transaction | $1,500.00 USD |
| Envelope Daily Ceiling | $10,000.00 USD |
| Kill-Switch Status | OFF (false) |
| Demo PayPal Batch ID | `$BATCH_ID-12345678-ABCDEF` (or real Sandbox batch) |

---

## Rollback (If Settlement Fails)

If the settlement needs to be re-executed or reset:

1. **Reset milestone status** (if needed):
   ```bash
   psql -d agenticpay_dev -c "UPDATE agenticpay_milestones SET status='AUDITED_PENDING_APPROVAL', payout_batch_id=NULL WHERE id='m1';"
   ```

2. **Reset project spend** (if needed):
   ```bash
   psql -d agenticpay_dev -c "UPDATE agenticpay_projects SET spent_usd=0 WHERE id='<projectId>';"
   ```

3. **Delete ledger entry** (if needed):
   ```bash
   psql -d agenticpay_dev -c "DELETE FROM agenticpay_ledger_events WHERE settlement_id='SETTLE-abc123...' LIMIT 1;"
   ```

4. **Restart dev server:**
   ```bash
   npm run dev
   ```

---

## Success Criteria

✅ All items below must be checked before demo:

- [ ] PayPal Sandbox credentials loaded and validated
- [ ] PostgreSQL schema updated (fingerprint, payout_batch_id, etc.)
- [ ] Settlement route compiles without errors
- [ ] Tests pass (all suites, especially 11-1 and 11-3)
- [ ] Dev server starts without critical errors
- [ ] Test contract created and visible in portfolio
- [ ] Test milestone audited with score >= 91%
- [ ] Settlement executed successfully (HTTP 200 OK)
- [ ] Real PayPal batch ID in response
- [ ] Ledger event recorded with batch ID
- [ ] Milestone marked COMPLETED in database
- [ ] Project spend incremented correctly
- [ ] Retry returns cached result (idempotent)
- [ ] Batch visible in PayPal Sandbox Dashboard
- [ ] Screenshots captured and saved
- [ ] DEMO_SCRIPT.md created with full 3-minute script
- [ ] Recording equipment ready (microphone, screen recorder)

---

## Support Contacts & Resources

| Resource | Purpose |
|----------|---------|
| `DEMO_SCRIPT.md` | Full narration script and timing |
| `requirements.md` | Acceptance criteria reference |
| `design.md` | Architecture and flow diagrams |
| PayPal Sandbox docs | https://developer.paypal.com/docs/payouts/ |
| `npm test -- --testPathPattern=11-3` | Settlement test reference |

If any check fails, refer to the corresponding test or documentation file before troubleshooting.

</content>
</invoke>