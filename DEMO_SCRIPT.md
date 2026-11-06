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

### **SEGMENT 2: Solution Overview (0:20–0:45, 25 sec)**

**Narrator:**

> "**AgenticPay AI** is a server-authoritative escrow platform for autonomous service contracts.
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

**Visual:** Show portfolio dashboard with OUTGOING and INCOMING swimlanes. Highlight guardrail thresholds table.

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

### **SEGMENT 4: Live Demo - Real PayPal Settlement (1:15–1:50, 35 sec)**

**Narrator:**

> "Now with audit passed, the settlement button becomes active. Let's execute the settlement and watch what happens server-side.
>
> Behind the scenes, the system is about to:
> 1. Acquire a PostgreSQL row lock on this milestone
> 2. Revalidate all guardrails (kill-switch, budget, audit score)
> 3. Generate a deterministic fingerprint from the project ID, milestone ID, and amount
> 4. Call PayPal OAuth to get an access token
> 5. Execute the real Payouts API with an idempotency key (so retries never double-pay)
> 6. Atomically commit all changes if PayPal succeeds, or rollback if it fails

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
       "paypalRequestId": "REQ-a1b2c3d4e5f6..."
     },
     "payRail": "PAYPAL_SANDBOX"
   }
   ```
4. **Show UI update:** Milestone status changes to "COMPLETED" ✅
5. **Show project balance:** spentUSD incremented by $250

**Visual:** Highlight the real `payout_batch_id` returned from PayPal. Show checkbox marking milestone complete.

---

### **SEGMENT 5: Ledger Verification (1:50–2:10, 20 sec)**

**Narrator:**

> "Every settlement creates an immutable ledger entry. Let me query the database to verify that the real PayPal batch ID is recorded."

**Live Demo:**
1. **Open database query tool or show server logs**
2. **Query or paste result:**
   ```sql
   SELECT id, project_id, status, payout_batch_id, batch_status, created_at
   FROM agenticpay_ledger_events
   WHERE project_id = 'proj-demo-...'
   LIMIT 1;
   ```
   **Result:**
   ```
   id: srv-settle-0efdd3197e87...
   project_id: proj-demo-settlement
   status: PAYOUT_EXECUTED
   payout_batch_id: $BATCH_ID-1234567-ABC
   batch_status: PROCESSING
   created_at: 2026-11-06 02:37:22 UTC
   ```
3. **Show PayPal Sandbox Dashboard** (second browser tab):
   - Login to sandbox.paypal.com
   - Navigate to Activity → Transactions
   - Search for batch ID `$BATCH_ID-1234567-ABC`
   - **Verify:** Batch visible, amount $250, status PROCESSING/SUCCESS

**Visual:** Show split-screen: database query + PayPal Dashboard both confirming real batch ID.

---

### **SEGMENT 6: Close & Competitive Edge (2:10–3:00, 50 sec)**

**Narrator:**

> "What you just saw is **production-grade enterprise escrow, not a prototype.**
>
> Here's our competitive advantage:
>
> **1. Real Financial Integration:** We're calling PayPal's actual Payouts API, not simulating transfers. This is **live money in Sandbox**—your judges can verify it in real time.
>
> **2. Deterministic Guardrails:** All payment logic is transparent TypeScript code. No hidden ML model deciding whether you get paid. No surprise rejections. You know exactly why a settlement passed or failed.
>
> **3. Atomic Transactions:** Thanks to PostgreSQL row-level locks, a PayPal rejection atomically rolls back the settlement. You never have a situation where the milestone is marked complete but the payment failed.
>
> **4. Idempotent Retries:** The deterministic fingerprint means retrying the same settlement reuses the exact same PayPal request ID. If the browser crashes, if the network flakes, the second attempt returns the exact same batch ID. Zero double-payments. This is **truly idempotent**—something that's rare in payments.
>
> **5. Dual-Perspective Workflow:** Outbound (you're paying a contractor) and Inbound (you're getting paid by a client) in one portfolio. One source of truth for all escrow operations.
>
> **Questions?**"

**Visual:** 
- Show competitive positioning slide (if available) or highlight the key differentiators on-screen
- End with AgenticPay logo + call-to-action (e.g., "Try it at agenticpay.ai" or "Ask us questions!")

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

### Editing Checklist
- [ ] Remove pauses > 2 seconds between segments
- [ ] Add timestamps/chapter markers: 0:20, 0:45, 1:15, 1:50, 2:10
- [ ] Add lower-third graphics (optional): "AgenticPay AI - Real PayPal Settlement"
- [ ] Export: MP4, H.264 codec, < 100 MB file size
- [ ] Test playback on mobile and desktop browsers

### Backup Plan
If live PayPal API call fails during demo recording:
- Pre-record the settlement call separately and splice it in (show batch ID in overlay)
- Have screenshot of ledger + PayPal Dashboard as fallback
- **Do NOT fake the PayPal response**—judges will verify the batch ID exists

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
| Problem | 0:00–0:20 | Escrow challenges |
| Solution | 0:20–0:45 | Key differentiators |
| Audit Demo | 0:45–1:15 | Live deliverable submission + 92% score |
| Settlement Demo | 1:15–1:50 | Live PayPal call + batch ID + ledger update |
| Verification | 1:50–2:10 | Database + PayPal Dashboard confirmation |
| Close | 2:10–3:00 | Competitive edge + questions |
| **TOTAL** | **< 3:00** | **Hard limit for hackathon submission** |

---

## ✅ Submission Checklist

- [ ] Video recorded in English (no Spanish)
- [ ] Video < 100 MB
- [ ] Video < 3 minutes
- [ ] Audio clear and professional
- [ ] Real PayPal Sandbox batch IDs visible in demo
- [ ] Database ledger entry matches batch ID
- [ ] All segment timings hit (within ±5 sec)
- [ ] Export format: MP4 (H.264)
- [ ] Test playback on judges' typical setup (laptop + browser)

---

**Good luck with your hackathon demo! 🚀**
