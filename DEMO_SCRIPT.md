# AgenticPay AI - Hackathon Demo Script (English)

**Duration:** < 3 minutes  
**Target Audience:** Hackathon judges, investors, developers  
**Date:** November 2026

---

## 📺 Video Demo Structure

### **SEGMENT 1: Problem Statement (0:00–0:20, 20 sec)**

**Narrator speaks to camera:**

> "When organizations work with contractors on long-term engagements, they face a critical problem: **how do you protect both parties when you release partial payments tied to milestone completion?**
>
> The challenge is three-fold:
>
> **1. Escrow Verification:** How can the buyer prove the contractor actually delivered what they committed to?
>
> **2. Double-Payment Risk:** How do you prevent the contractor from requesting payment twice for the same milestone?
>
> **3. Compliance:** How do you execute real payments while maintaining an immutable audit trail?
>
> Traditional solutions use email approvals and spreadsheets. We wanted to build something better."

**Visual:** Show problem statement overlay on screen. Fade in AgenticPay logo.

---

### **SEGMENT 2: Account Type Selection & Solution Overview (0:15–0:45, 30 sec)**

**Narrator:**

> "First, let's show account setup. AgenticPay AI supports two user personas:
>
> **Enterprise Accounts:** Organizations managing vendor payables and receivables
> **Independent Operators:** Freelancers, consultants, and contractors
>
> You select your account type at signup—this shapes your portfolio views, milestone structures, and payout routing.
>
> **AgenticPay AI** is a server-authoritative escrow platform designed for both.
>
> Here's what makes it different:
>
> **First:** We separate AI advisory from financial authority. An AI assistant helps negotiate contract terms, but **all payment decisions are made by deterministic TypeScript guardrails**—transparent, auditable, and non-AI.
>
> **Second:** Every settlement goes through a server-side audit confidence check. Milestones below 85% confidence remain locked.
>
> **Third:** We execute **real PayPal Payouts API calls**—not simulated transfers. Every settlement creates a real, deterministic batch ID that's immutable.
>
> And finally: We use PostgreSQL row-level locks and atomic transactions to guarantee that **if PayPal rejects the payout, the entire settlement rolls back**—no partial mutations, no orphaned state."

**Visual:** 
- Show **AuthScreen registration** with Account Name field
- Show examples: "Acme Treasury" (Enterprise) and "alex@consulting.io" (Independent)
- Fade to portfolio dashboard with OUTGOING and INCOMING swimlanes, labeled for both account types
- Highlight guardrail thresholds table

---

### **SEGMENT 3: Live Demo - Audit Flow (0:45–1:15, 30 sec)**

**Narrator:**

> "Let me show you how it works in practice. Here's a contract where a vendor committed to deliver a software component for $250.
>
> The contractor submits their deliverable—a pull request with code and documentation. Our audit endpoint analyzes it, checks for GitHub URLs (high-confidence evidence), measures code quality signals, and returns a confidence score."

**Live Demo:**
1. Show **Project Workspace** with contract details (vendor name, milestone amount, deadline)
2. Show **Milestone card** with acceptance criteria
3. Click **"Submit Deliverable"** button
4. Paste PR link into audit form
5. **Show Audit Result:**
   - Confidence Score: **92%** ✅ (>= 85% threshold)
   - Risk Level: LOW
   - Settlement Mode: **AUTONOMOUS** (no human approval needed for $250)
   - Rationale: "GitHub PR linked with substantive code changes"

**Visual:** Highlight the 92% score and green checkmark. Show guardrail thresholds sidebar confirming audit >= 85%.

---

### **SEGMENT 4: Live Demo - Real PayPal Settlement (1:20–2:00, 40 sec)**

**Narrator:**

> "Now with audit passed, the settlement button becomes active. Let's execute the settlement and watch what happens server-side.
>
> **IMPORTANT:** Before we continue, I want to be fully transparent about the payment rail. Here's what happens:
>
> **[IF PAYPAL SANDBOX CREDENTIALS ARE CONFIGURED]:**
> *"The server has valid PayPal Sandbox credentials configured in the environment. When we click 'Release Milestone', the system will execute a real OAuth call to PayPal's `/v1/oauth2/token` endpoint, obtain an access token, then execute the actual Payouts API at `/v1/payments/payouts`. The real `payout_batch_id` will be recorded in the ledger."*
>
> **[IF PAYPAL SANDBOX CREDENTIALS ARE NOT CONFIGURED]:**
> *"The server does not have PayPal credentials configured for this demo. When we click 'Release Milestone', the system will fail closed—the settlement will not execute. Instead, the system will record an honest, deterministic ledger entry that shows the payment rail as SIMULATED (in non-production for testing) or SUPPRESSED (no network call made). This is our fail-closed design: we never fake a payout, and we never hide the payment method from you."*
>
> Behind the scenes, whether using real credentials or fail-closed mode, the system performs the same operations:
> 1. Acquire a PostgreSQL row lock on this milestone
> 2. Revalidate all guardrails (kill-switch, budget, audit score)
> 3. Generate a deterministic fingerprint from the project ID, milestone ID, and amount
> 4. Execute the payment rail (real PayPal, simulation, or suppression—always visible)
> 5. Atomically commit all changes if successful, or rollback if it fails

**Live Demo:**
1. Click **"Release Milestone"** button
2. Wait 2-3 seconds (showing loading state)
3. **Settlement Success Response:**
   ```json
   {
     "event": {
       "id": "srv-settle-0efdd3197e87...",
       "status": "PAYOUT_EXECUTED",
       "amountUSD": 250,
       "payoutBatchId": "$BATCH_ID-1234567-ABC",
       "batchStatus": "PROCESSING",
       "paypalRequestId": "REQ-a1b2c3d4e5f6...",
       "payRail": "PAYPAL_SANDBOX" or "SIMULATED" or "SUPPRESSED_RAIL"
     }
   }
   ```
4. **Show UI update:** Milestone status changes to "COMPLETED" ✅
5. **Show project balance:** spentUSD incremented by $250
6. **Show payment rail indicator:** Green badge showing which rail was used (PAYPAL_SANDBOX / SIMULATED / LOCAL LEDGER)

**Visual:** 
- Highlight the payment rail indicator prominently
- If using real credentials, show the real `payout_batch_id`; overlay text: "Real PayPal Sandbox payout"
- If fail-closed, show the honest simulation/suppressed entry; overlay text: "Fail-closed: No payment executed; settlement recorded in ledger"
- Show checkbox marking milestone complete

---

### **SEGMENT 5: Ledger Verification (2:00–2:20, 20 sec)**

**Narrator:**

> "Every settlement creates an immutable ledger entry. The **Payment Rail indicator** shows exactly which method was used. 
>
> If we used real PayPal credentials, the real batch ID is recorded. If the credentials were not available, you see SIMULATED or SUPPRESSED—always honest, never hidden.
>
> This transparency is our commitment: judges and auditors can inspect exactly what happened at settlement time."

**Live Demo:**
1. **Open database query tool or show server logs**
2. **Query or paste result:**
   ```sql
   SELECT id, project_id, status, payout_batch_id, batch_status, payout_executor_rail, created_at
   FROM agenticpay_ledger_events
   WHERE project_id = 'proj-demo-...'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
   **Result (Real Credentials):**
   ```
   id: srv-settle-0efdd3197e87...
   project_id: proj-demo-settlement
   status: PAYOUT_EXECUTED
   payout_batch_id: $BATCH_ID-1234567-ABC
   batch_status: PROCESSING
   payout_executor_rail: PAYPAL_SANDBOX
   created_at: 2026-11-06 02:37:22 UTC
   ```
   OR
   
   **Result (No Credentials / Fail-Closed):**
   ```
   id: srv-settle-0efdd3197e87...
   project_id: proj-demo-settlement
   status: PAYOUT_EXECUTED
   payout_batch_id: SIM_PAYOUT_a1b2c3d4e5f6
   batch_status: SIMULATED
   payout_executor_rail: SIMULATED
   created_at: 2026-11-06 02:37:22 UTC
   ```

3. **If using real PayPal credentials:** Show **PayPal Sandbox Dashboard** (second browser tab):
   - Login to sandbox.paypal.com
   - Navigate to Activity → Transactions
   - Search for batch ID matching the ledger entry
   - **Verify:** Batch visible, amount $250, status PROCESSING/SUCCESS
   
4. **Show Payment Rail chip** prominently in the ledger row UI

**Visual:** Show split-screen comparison: ledger entry (showing payment rail) matches the UI indicator. If real credentials, also show PayPal Dashboard verification.

---

### **SEGMENT 6: Close & Competitive Edge (2:20–3:00, 40 sec)**

**Narrator:**

> "What you just saw is **production-grade enterprise escrow, not a prototype.**
>
> Notice how we treated the payment rail with complete transparency:
> - We told you upfront whether PayPal credentials are configured
> - We showed you the real (or honestly simulated) batch ID in the response
> - We recorded it immutably in the ledger—no hiding, no black boxes
>
> This is our design philosophy: **fail-closed and transparent**. When credentials are missing, we don't fake a payout. We record it honestly and show it to you.
>
> **Here's our competitive advantage:**
>
> **1. Real Financial Integration:** If credentials are available, we're calling PayPal's actual Payouts API, not simulating transfers. If not, we fail closed—never fake. Your judges can verify real batch IDs in your PayPal Dashboard.
>
> **2. Deterministic Guardrails:** All payment logic is transparent TypeScript code. No hidden ML model deciding whether you get paid. No surprise rejections. You know exactly why a settlement passed or failed.
>
> **3. Atomic Transactions:** Thanks to PostgreSQL row-level locks, a PayPal rejection atomically rolls back the settlement. You never have a situation where the milestone is marked complete but the payment failed.
>
> **4. Idempotent Retries:** The deterministic fingerprint means retrying the same settlement reuses the exact same PayPal request ID. If the browser crashes, if the network flakes, the second attempt returns the exact same batch ID. Zero double-payments. This is **truly idempotent**.
>
> **5. Dual-Persona Support:** Whether you're an Enterprise Account managing vendor payables or an Independent Operator getting paid by clients, AgenticPay supports both perspectives in one seamless workflow.
>
> **Questions?**"

**Visual:** 
- Show competitive positioning with all five points highlighted
- End with AgenticPay logo + call-to-action
- Optional: Show payment rail comparison chart (PAYPAL_SANDBOX vs SIMULATED vs SUPPRESSED_RAIL)

---

## 🎬 Technical Notes for Recording

### Setup Checklist
- [ ] PayPal Sandbox credentials in `.env.local` (fresh OAuth tokens)
- [ ] Database populated with test contract (see Task 11.2 test data)
- [ ] Milestone pre-audited with score >= 85%
- [ ] Browser window at 1080p resolution, dark mode preferred for contrast
- [ ] PayPal Sandbox Dashboard logged in and ready (second browser tab)
- [ ] Database query tool or logs visible (third terminal or overlay)

### Recording Settings
- **Resolution:** 1080p (1920×1080)
- **Frame rate:** 30fps (smooth for demo pacing)
- **Audio:** English narration, clear microphone (no background noise)
- **Speed:** Normal playback (no time-lapse for API calls; show the actual latency)
- **Payment Rail Visibility:** Ensure the Payment Rail indicator (PAYPAL_SANDBOX / SIMULATED / SUPPRESSED_RAIL) is visible in all ledger entries and settlement responses

### Recording Preparation
**BEFORE recording, verify your setup:**
```bash
# Check if PayPal credentials are configured
echo "PAYPAL_CLIENT_ID: ${PAYPAL_CLIENT_ID:-(not configured)}"
echo "PAYPAL_CLIENT_SECRET: ${PAYPAL_CLIENT_SECRET:-(not configured)}"
```

**If credentials ARE configured:**
- You will show **real PayPal Sandbox payouts** with actual batch IDs
- Test one settlement before recording to confirm batch ID appears in ledger
- Have PayPal Sandbox Dashboard tab ready for verification

**If credentials are NOT configured:**
- You will show **fail-closed settlement** with SIMULATED or SUPPRESSED_RAIL indicator
- This is equally valid and demonstrates the fail-closed design
- Be explicit in narration: "Credentials are not configured; the system is demonstrating fail-closed behavior"

### Editing Checklist
- [ ] Remove pauses > 2 seconds between segments
- [ ] Add timestamps/chapter markers: 0:15, 0:45, 1:20, 2:00, 2:20
- [ ] Add lower-third graphics (optional): "AgenticPay AI - Real PayPal Settlement" or "AgenticPay AI - Fail-Closed Payment Rail"
- [ ] Ensure Payment Rail indicator is clearly visible in settlement response and ledger
- [ ] If showing real PayPal payouts, add overlay: "Real PayPal Sandbox payout - Batch ID verified"
- [ ] If showing fail-closed, add overlay: "Fail-Closed Design - No credentials configured"
- [ ] Export: MP4, H.264 codec, < 100 MB file size
- [ ] Test playback on mobile and desktop browsers

### Backup Plan
If live PayPal API call fails during demo recording:

**Option 1 (Recommended):** Demonstrate fail-closed behavior
- Show how the system handles missing/invalid credentials
- Record settlement with honest SIMULATED or SUPPRESSED_RAIL indicator
- Narrate: "Here's our fail-closed design in action. No fake payouts, no hidden behavior."
- This is equally credible with judges—it shows defensive design

**Option 2:** Pre-record the settlement call separately
- Execute settlement on a clean environment with real credentials
- Save the response (batch ID, HTTP log)
- Splice it into demo with clear overlay: "Real PayPal Sandbox settlement (pre-recorded)"
- Show batch ID verified in PayPal Dashboard

**CRITICAL:** Do NOT fake the PayPal response—judges will verify batch IDs exist in PayPal Sandbox

---

## 📋 Script Cue Cards (Printed Reference)

**Cue Card 1 (0:00–0:20):**
- Problem: escrow verification, double-payment risk, compliance
- Transition: "Traditional = email + spreadsheets. We built something better."

**Cue Card 2 (0:20–0:45):**
- Key Points: AI advisory ≠ financial authority, 85% audit gate, real PayPal API, atomic transactions + rollback
- Transition: "Let me show you live."

**Cue Card 3 (0:45–1:15):**
- Demo: Contract → Deliverable → Audit → Result (92% score)
- Call Out: Green checkmark, AUTONOMOUS mode

**Cue Card 4 (1:15–1:50):**
- Demo: Click Release → Real PayPal batch ID → Milestone completed
- Call Out: Real batch ID in response, project balance incremented

**Cue Card 5 (1:50–2:10):**
- Demo: Database query + PayPal Dashboard verification
- Call Out: Real batch ID matches, status PROCESSING/SUCCESS

**Cue Card 6 (2:10–3:00):**
- Competitive advantages: Real API, deterministic guardrails, atomic, idempotent, dual-perspective
- Close: "Questions?"

---

## 🎥 Expected Timing (Hard Stops)

| Segment | Time | Content |
|---------|------|---------|
| Problem | 0:00–0:15 | Escrow challenges |
| Account Types & Solution | 0:15–0:45 | Dual-persona support (Enterprise + Independent Operator) + key differentiators |
| Audit Demo | 0:45–1:20 | Live deliverable submission + 92% score |
| Settlement Demo | 1:20–2:00 | Payment rail transparency + real/fail-closed explanation + settlement execution |
| Verification | 2:00–2:20 | Database + Payment Rail indicator + PayPal Dashboard confirmation (if real credentials) |
| Close | 2:20–3:00 | Competitive edge + dual-persona support emphasis + questions |
| **TOTAL** | **< 3:00** | **Hard limit for hackathon submission** |

---

## ✅ Submission Checklist

- [ ] Video recorded in English
- [ ] Video < 100 MB
- [ ] Video < 3 minutes
- [ ] Audio clear and professional
- [ ] Account type selection explained (Enterprise vs Independent Operator)
- [ ] Payment rail transparency disclaimer included (credentials status disclosed upfront)
- [ ] Real or fail-closed PayPal settlement shown (NOT faked)
- [ ] Payment Rail indicator (PAYPAL_SANDBOX / SIMULATED / SUPPRESSED_RAIL) visible in demo
- [ ] If real credentials: PayPal Sandbox batch ID matches ledger entry
- [ ] If fail-closed: Honest SIMULATED or SUPPRESSED_RAIL entry shown with narration
- [ ] Database ledger entry visible and matches settlement response
- [ ] All segment timings hit (within ±5 sec)
- [ ] Export format: MP4 (H.264)
- [ ] Test playback on judges' typical setup (laptop + browser)
- [ ] Judges can independently verify batch IDs in PayPal Sandbox (if using real credentials)

---

**Good luck with your hackathon demo! 🚀**
