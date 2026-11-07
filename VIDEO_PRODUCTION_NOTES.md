# Video Production Notes: Technical Callouts & Visual Requirements

**For:** Demo video team  
**Duration:** < 3 minutes  
**Format:** MP4, H.264, 1080p @ 30fps, < 100 MB  
**Upload To:** Devpost  

---

## 📹 Visual Requirements

### Payment Rail Indicator (CRITICAL - Show in EVERY settlement response)

The Payment Rail badge must be:
- **Visually prominent** — Use color coding:
  - 🟢 GREEN: PAYPAL_SANDBOX (real PayPal)
  - 🟡 YELLOW/AMBER: SIMULATED (fail-closed demo)
  - ⚪ GRAY: SUPPRESSED_RAIL (local ledger only)
- **Always visible** in:
  1. Settlement response JSON (as `"payRail": "..."`)
  2. Ledger row (as a badge/chip)
  3. Payload inspector (clear label)

### Batch ID Visibility

Show THREE instances of batch ID:
1. **Settlement Response JSON** — `"payoutBatchId": "$BATCH_ID-..." or "SIM_PAYOUT_..." or "SETTLE-..."`
2. **Ledger Row** — Database record showing matching batch ID
3. **PayPal Dashboard** (if real credentials) — Batch ID searchable in PayPal Sandbox

### Account Type Selection

Show account signup with:
- "Account Name" field with dual examples:
  - "Acme Treasury" (Enterprise)
  - "alex@consulting.io" (Independent)
- Placeholder text confirming both account types supported

### Guardrails Display

Show budget envelope with visible thresholds:
- Per-transaction ceiling
- Daily ceiling
- Autonomous settlement cap ($1,000)
- Kill-switch toggle
- All must be legible in video

---

## 🎬 Shot List (Storyboard)

### SHOT 1: Account Type Selection (0:15–0:25)
**Visual:** AuthScreen signup form  
**Requirements:**
- Account Name field visible
- Example placeholder text showing dual personas
- Email field with both company + individual examples
- Clear button clicks

**Narration:** "AgenticPay supports two user personas: Enterprise Accounts for organizations, and Independent Operators for freelancers and contractors."

---

### SHOT 2: Portfolio with Dual Swimlanes (0:25–0:35)
**Visual:** Dashboard showing OUTGOING + INCOMING escrow containers  
**Requirements:**
- Both swimlanes clearly labeled
- Contract card visible in one swimlane
- Milestone information legible
- No blur or pixelation

**Narration:** "Here's the portfolio dashboard. You see two swimlanes: OUTGOING escrow (you're paying a contractor) and INCOMING escrow (you're getting paid by a client)."

---

### SHOT 3: Budget Guardrails & Audit Gate (0:35–1:15)
**Visual:** Budget envelope + milestone audit result  
**Requirements:**
- Envelope thresholds displayed (per-transaction, daily)
- $1,000 autonomous cap clearly visible
- Audit score display (92% in this case)
- Confidence indicator (green checkmark)
- Settlement mode: AUTONOMOUS (for amounts ≤ $1,000)

**Narration:** "Guardrails are TypeScript rules, not AI decisions. Here's a milestone with an 92% confidence score—above our 85% gate. The settlement mode is AUTONOMOUS because the amount is under $1,000. Above $1,000 requires human approval."

---

### SHOT 4: Settlement Button Click & Payment Rail Transparency (1:20–1:40)
**Visual:** Settlement response with Payment Rail indicator  
**Requirements:**
- Click "Release Milestone" button (show click animation)
- Loading state visible (2-3 seconds)
- Response JSON shows:
  - `"status": "PAYOUT_EXECUTED"`
  - `"payoutBatchId": "$BATCH_ID-..." (or SIM_PAYOUT_... or SETTLE-...)`
  - `"payRail": "PAYPAL_SANDBOX"` (or SIMULATED or SUPPRESSED_RAIL) — **Highlighted in color**
- Milestone status changes to COMPLETED ✅

**Narration (Branch A - Real Credentials):**
> "When I click Release Milestone, the server executes the PayPal Payouts API. Notice the response:
> - Real batch ID: `$BATCH_ID-...`
> - Payment Rail: **PAYPAL_SANDBOX** (shown in green)
> - This is a genuine integration with PayPal Sandbox. We can verify this in the PayPal Dashboard."

**Narration (Branch B - Simulation Mode):**
> "When I click Release Milestone, the system generates a SIMULATED batch ID. Notice:
> - Batch ID: `SIM_PAYOUT_...`
> - Payment Rail: **SIMULATED** (shown in yellow)
> - HTTP log shows '[SIMULATED POST...]'
> - This demonstrates our fail-closed design: no fake payouts, no hidden behavior."

**Narration (Branch C - Suppressed Mode):**
> "When I click Release Milestone, the system records a SUPPRESSED entry. Notice:
> - Batch ID: `SETTLE-...`
> - Payment Rail: **SUPPRESSED_RAIL** (shown in gray)
> - HTTP log shows '[SUPPRESSED RAIL: POST /v1/payments/payouts not attempted]'
> - Complete transparency about what didn't happen."

---

### SHOT 5: Ledger Entry & Payment Rail Badge (1:40–2:00)
**Visual:** Database query result or ledger UI row  
**Requirements:**
- Batch ID matches settlement response
- `payout_executor_rail` column visible showing correct rail
- Created_at timestamp
- Milestone amount ($250) visible
- Project ID visible and matches settlement

**SQL Query Result (if showing database):**
```sql
SELECT id, status, payout_batch_id, payout_executor_rail, amount_usd, created_at
FROM agenticpay_ledger_events
WHERE project_id = '...';

-- Result:
srv-settle-0efdd3197e87...  | PAYOUT_EXECUTED | $BATCH_ID-... (or SIM_PAYOUT_...) | PAYPAL_SANDBOX (shown in green) | 250 | 2026-11-06 02:37:22
```

**Narration:** "Every settlement creates an immutable ledger entry. You can see:
- The real (or simulated/suppressed) batch ID
- The Payment Rail indicator (showing which method was used)
- The exact timestamp and amount

This is our audit trail—completely transparent."

---

### SHOT 6: PayPal Dashboard Verification (Optional but Recommended) (2:00–2:15)
**Visual:** PayPal Sandbox Dashboard tab showing transaction search results  
**Requirements (ONLY if using PAYPAL_SANDBOX rail):**
- Logged into PayPal Sandbox
- Activity → Transactions
- Search for the batch ID
- Batch visible with:
  - Correct amount ($250)
  - Status: PROCESSING or SUCCESS
  - Batch ID matches our ledger

**Narration:** "Let me verify this in the PayPal Sandbox Dashboard. I search for the batch ID... and there it is:
- Amount: $250 ✓
- Status: PROCESSING
- Batch ID matches our ledger entry

This is irrefutable proof of real PayPal integration."

---

### SHOT 7: Close & Competitive Edge (2:15–3:00)
**Visual:** High-level screenshot or slide showing competitive advantages  
**Requirements:**
- Clear, readable text
- 5 bullet points or visual highlights
- Duration: ~45 seconds of narration

**Visuals to show:**
1. Dual-persona support (Enterprise + Independent Operator logos/icons)
2. Payment rail transparency (3 rails shown: Real, Simulated, Suppressed)
3. Deterministic rules (TypeScript code snippet or guard icon)
4. Atomic transactions (lock icon or database symbol)
5. Idempotent retries (checkmark or fingerprint visualization)

**Narration:** "Here's why AgenticPay stands out:

1. **Dual Personas** — We support both Enterprise Accounts and Independent Operators in one platform.

2. **Transparent Payment Rails** — You always know which method was used. Real PayPal, simulated, or suppressed—it's never hidden.

3. **Deterministic Guardrails** — All rules are transparent TypeScript. No surprise AI decisions.

4. **Atomic Transactions** — PostgreSQL row locks guarantee that if PayPal rejects, the entire settlement rolls back.

5. **Idempotent Retries** — Deterministic fingerprints mean you can't double-pay, even if the network fails and you retry.

Questions?"

---

## 🎙️ Audio Production

### Recording Quality
- **Microphone:** Use condenser mic (e.g., Blue Yeti) if possible
- **Environment:** Quiet room, no background noise, no echo
- **Level:** Voice should be clear, no clipping, consistent volume
- **Pace:** Natural, conversational (not too fast, not monotone)

### Narration Tips
1. **Pause before switching branches** — If using [IF CREDENTIALS] vs [IF NO CREDENTIALS], pause 2-3 sec before deciding which branch
2. **Emphasize the Payment Rail** — When saying "PAYPAL_SANDBOX" or "SIMULATED", let it sink in (short pause after)
3. **Use the script exactly** — Don't ad-lib; stick to provided narration to maintain transparency
4. **No hedging language** — Don't say "probably" or "might" — be confident

---

## ✂️ Editing Checklist

After recording, before export:

### Visual Edits
- [ ] Batch ID clearly readable in all three occurrences
- [ ] Payment Rail badge visible in every relevant screen (use color highlighting if needed)
- [ ] No jarring cuts; smooth transitions between shots
- [ ] Legibility: test that small text (batch IDs, column headers) is readable on a smartphone screen
- [ ] Color coding: Payment Rail badges use consistent colors (green/yellow/gray)

### Audio Edits
- [ ] Normalize audio level to -3dB
- [ ] Remove background noise (gentle noise gate)
- [ ] Trim long pauses > 2 seconds
- [ ] Add subtle fade-in/fade-out (500ms each)
- [ ] Sync narration timing with visuals (no lag or premature narration)

### Timing & Pacing
- [ ] Segment 1 (Intro): 0:00–0:15 (15 sec ± 2 sec)
- [ ] Segment 2 (Account Types): 0:15–0:45 (30 sec ± 2 sec)
- [ ] Segment 3 (Guardrails): 0:45–1:20 (35 sec ± 2 sec)
- [ ] Segment 4 (Settlement): 1:20–2:00 (40 sec ± 2 sec)
- [ ] Segment 5 (Verification): 2:00–2:20 (20 sec ± 2 sec)
- [ ] Segment 6 (Close): 2:20–3:00 (40 sec ± 2 sec)
- [ ] **Total: < 3:00**

### Export Settings
- [ ] Format: MP4
- [ ] Codec: H.264 (AVC)
- [ ] Resolution: 1920×1080 (1080p)
- [ ] Frame Rate: 30fps
- [ ] Bitrate: 4-6 Mbps (enough for clarity, reasonable file size)
- [ ] Audio: AAC, 128 kbps, stereo
- [ ] File Size: < 100 MB
- [ ] Test on mobile browser (iPhone Safari, Chrome on Android)

### Final QA
- [ ] Play back entire video start-to-finish
- [ ] Check for sync issues (audio/video lip-sync)
- [ ] Verify no dropouts or glitches
- [ ] Confirm Payment Rail badges are visible on all devices/browsers
- [ ] Get 3-5 people to watch and give feedback

---

## 🎬 Backup Shots (If Main Shot Fails)

### If Settlement Click Fails to Show Response
**Backup:** Pre-record the settlement response separately and splice it in with overlay text:
- Overlay: "Real PayPal Settlement (Pre-Recorded)" or "Fail-Closed Demo"
- Show the same batch ID in overlay as database record

### If PayPal Dashboard Tab Doesn't Load
**Backup:** Show database query result (all same info as dashboard)
- Or use a screenshot of PayPal Dashboard if live access fails
- Ensure batch ID matches in both

### If Entire Settlement Fails
**Backup Options (in order of preference):**
1. **Show fail-closed behavior** — Settlement response with SIMULATED or SUPPRESSED_RAIL. Narrate: "This demonstrates our fail-closed design."
2. **Pre-recorded segment** — Show previously successful settlement with matching narration
3. **Snapshot + narration** — Show static database record with narration explaining what happened

**CRITICAL:** Never fake a PayPal response. A failed settlement demo is more credible than a fake one.

---

## 📊 Visual Assets

### Color Coding for Payment Rail Badges
```
PAYPAL_SANDBOX:     #10B981 (Green)    ✓ Real PayPal
SIMULATED:          #F59E0B (Amber)    ◯ Demo Mode
SUPPRESSED_RAIL:    #6B7280 (Gray)     ⚪ Local Ledger Only
```

### Mockup (if creating title cards):
```
[AgenticPay AI Logo]
Real PayPal Settlement Verified
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Batch ID: $BATCH_ID-1234567-ABC
Rail: PAYPAL_SANDBOX ✓
Amount: $250.00
Status: PROCESSING
```

---

## 👀 Viewing Checklist

After export, test playback on:
- [ ] Desktop Chrome
- [ ] Desktop Firefox
- [ ] Safari (Mac)
- [ ] iPhone Safari (or AirPlay to TV)
- [ ] Android Chrome
- [ ] Tablet (iPad or Android tablet)

If video plays smoothly on all, you're good to upload.

---

## 🚨 Common Production Mistakes to Avoid

1. **Batch ID too small to read** — Increase font size or add text overlay
2. **Payment Rail not visible** — Make it a prominent badge or add color highlight
3. **Narration doesn't match screen** — Re-record if timing is off
4. **Audio cuts out** — Check for file corruption; re-export if needed
5. **Switching branches mid-recording** — Commit to one (real OR simulated OR suppressed) and record accordingly
6. **Faking a PayPal response** — NEVER. Use real API or show fail-closed honestly
7. **Editing out the payment rail** — Keep it visible throughout settlement demo
8. **Using real production credentials** — Use Sandbox only; never show prod keys

---

## 📤 Upload Instructions

1. **Export final MP4** (< 100 MB)
2. **Create Devpost video embed:**
   - Upload to YouTube (unlisted or private)
   - Grab YouTube embed link
   - Paste into Devpost submission
3. **Add caption/description:**
   ```
   AgenticPay AI - Demo Video
   
   Payment Rails: [Select which was used]
   - ✓ Real PayPal Sandbox (PAYPAL_SANDBOX)
   - ◯ Simulated (fail-closed demo mode)
   - ◯ Suppressed (local ledger only)
   
   Batch ID visible in video: [Yes/No]
   Account type selection shown: [Yes/No]
   ```

---

## 🎯 Success Criteria

After video is live, judges should be able to:

✅ See Payment Rail indicator clearly  
✅ Understand which settlement method was used (real/simulated/suppressed)  
✅ Identify batch ID in settlement response  
✅ See dual-persona support (account type selection)  
✅ Watch smooth, professional production (no stuttering, clear audio)  
✅ Verify batch ID matches database ledger (if real credentials)  
✅ Verify batch ID matches PayPal Dashboard (if real credentials)  

---

**Last Updated:** November 6, 2026  
**For:** Video production team  
**Questions:** See SETTLEMENT_RAIL_REFERENCE.md for narration details

