# Demo Assets Guide

**Location:** `docs/assets/demo/`  
**Purpose:** Screenshots and media for the 3-minute demo video and hackathon presentation  
**Date:** November 5, 2026

---

## Asset Inventory

### 1. Portfolio View Screenshot (`portfolio-view.png`)

**Purpose:** Show the dual-swimlane portfolio layout at the start of the demo

**What to capture:**
- Full browser window at 1920x1080
- Both OUTGOING (left) and INCOMING (right) swimlanes visible
- At least 2 contract cards visible in each swimlane
- "AgenticPay Vendor Services" contract prominent in left swimlane
- Status badges visible (e.g., ACTIVE)
- No sensitive data (personal emails ok to show, no passwords)

**How to capture:**
1. Navigate to http://localhost:3000 (signed in)
2. Make sure you're on the portfolio view
3. Zoom browser to 100%
4. Take a full-page screenshot (Chrome DevTools → Capture screenshot)
5. Save as: `docs/assets/demo/portfolio-view.png`

**Dimensions:** 1920x1080 (or 1280x720 minimum)  
**File format:** PNG

---

### 2. Audit Result Screenshot (`audit-result.png`)

**Purpose:** Show the audit confidence score and settlement mode

**What to capture:**
- Audit modal or result card showing:
  - Audit Confidence: **91%**
  - Risk Level: **LOW**
  - Settlement Mode: **AUTONOMOUS** (badge)
  - Rationale: "GitHub PR detected. High-confidence evidence of work completion."
  - Milestone amount ($250 USD) and approval requirement (none, under $1,000)

**How to capture:**
1. In the workspace, click a milestone to open its details
2. Click "Submit for Audit" or show a cached audit result
3. Screenshot the audit result card
4. Save as: `docs/assets/demo/audit-result.png`

**Dimensions:** 1920x1080 (or cropped to show just the audit card)  
**File format:** PNG

---

### 3. Settlement Modal (`settlement-modal.png`)

**Purpose:** Show the settlement success response with real batch ID

**What to capture:**
- Settlement success modal showing:
  - **Settlement ID:** SETTLE-abc123def456...
  - **Amount:** $250.00 USD
  - **Payout Batch ID:** $BATCH_ID-12345678-ABCDEF (real PayPal Sandbox ID)
  - **Batch Status:** PROCESSING or SUCCESS
  - **Remaining Budget:** $4,750.00 USD
  - "Settlement recorded. Funds dispatched to PayPal." message

**How to capture:**
1. Execute a settlement (click "Release Milestone")
2. Wait for the success modal to appear
3. Take a screenshot
4. Save as: `docs/assets/demo/settlement-modal.png`

**Dimensions:** 1920x1080 (or cropped to show just the modal)  
**File format:** PNG

---

### 4. Ledger Entry Screenshot (`ledger-entry.png`)

**Purpose:** Show the real payout_batch_id in the AG Grid ledger

**What to capture:**
- AG Grid showing the recent PAYOUT_EXECUTED event
- Columns visible: Status | Actor | Confidence | Amount | Rail | Timestamp
- Most recent row showing:
  - Status: **PAYOUT_EXECUTED** (green badge)
  - Actor: **GUARDRAIL**
  - Confidence: **91%**
  - Amount: **$250.00 USD**
  - Rail: **PAYPAL_SANDBOX** (blue badge)
  - Timestamp: **2026-11-05 14:30:00Z** (or current time)
- Real `payout_batch_id` visible (either in grid or expanded details)

**How to capture:**
1. In the project workspace, scroll to the ledger section
2. Find the row with status PAYOUT_EXECUTED (should be the most recent)
3. Take a screenshot of the entire grid or expanded entry
4. Save as: `docs/assets/demo/ledger-entry.png`

**Dimensions:** 1920x1080 (or 1280x720)  
**File format:** PNG  
**Note:** If the batch ID is not visible in the grid, click the row to expand details and screenshot the expanded view

---

### 5. PayPal Dashboard Batch (`paypal-batch-dashboard.png`)

**Purpose:** Verify the batch in PayPal Sandbox Dashboard

**What to capture:**
- PayPal Sandbox Activity or Transactions page
- Batch entry showing:
  - **Batch ID:** $BATCH_ID-12345678-ABCDEF (matches the settlement modal)
  - **Type:** Payout
  - **Amount:** $250.00 USD
  - **Status:** PROCESSING or SUCCESS
  - **Recipient Email:** vendor@demo.agenticpay.local (or test recipient)
  - **Created Date:** 2026-11-05 (or current date)

**How to capture:**
1. Log into https://sandbox.paypal.com/ with your merchant account
2. Navigate to: Sandbox → Activity → Transactions (or similar, may vary)
3. Search for the batch ID from the settlement modal
4. Click on the batch to show details
5. Take a screenshot
6. Save as: `docs/assets/demo/paypal-batch-dashboard.png`

**Dimensions:** 1920x1080 (or 1280x720)  
**File format:** PNG  
**Important:** This is the key verification that real PayPal integration is working. Ensure the batch ID is clearly visible and matches the settlement response.

---

### 6. (Optional) Kill-Switch UI (`kill-switch-ui.png`)

**Purpose:** Show the master kill-switch control (optional, for extended demo)

**What to capture:**
- Envelope section showing:
  - Master Kill-Switch toggle (currently OFF)
  - Per-transaction ceiling ($1,500 USD)
  - Daily ceiling ($10,000 USD)
  - Spent today ($0 or current amount)
  - Active escrow ($5,000 or remaining amount)

**How to capture:**
1. In the workspace, show the envelope/guardrails section
2. Screenshot the control panel
3. Save as: `docs/assets/demo/kill-switch-ui.png` (optional)

**Dimensions:** 1920x1080 (or cropped)  
**File format:** PNG

---

## Usage in Demo Video

| Section | Time | Asset(s) |
|---------|------|----------|
| Problem & Portfolio | 0:00–0:45 | portfolio-view.png |
| Guardrails | 0:45–1:15 | (live browser, no screenshot needed) |
| Audit & Settlement | 1:15–1:50 | audit-result.png, settlement-modal.png |
| Ledger | 1:50–2:10 | ledger-entry.png |
| PayPal Dashboard | 2:10–2:50 | paypal-batch-dashboard.png |

---

## Screenshot Guidelines

### Resolution & Dimensions
- **Preferred:** 1920x1080 (full HD)
- **Minimum:** 1280x720
- **Do not:** Use compressed JPEG; PNG preserves clarity
- **Zoom:** 100% (Chrome: Cmd/Ctrl+0 to reset)

### Clarity & Readability
- **Text:** Must be readable (min 12px font in screenshot)
- **Batch IDs:** Clearly visible (highlight if needed)
- **Status badges:** Colors distinguishable
- **No blurriness:** Use native screenshot tools, not photos

### Data Privacy
- **OK to show:** Test contract names, demo emails (vendor@demo.agenticpay.local)
- **DO NOT show:**
  - Real PayPal credentials
  - Real email addresses of judges/users
  - Real API keys or secrets
  - Personal information beyond what's in test data

### File Format & Compression
- **Format:** PNG (lossless)
- **Compression:** OK to use PNG compression (reduces file size without quality loss)
- **Max size per image:** < 5 MB (typically 500 KB–2 MB for web screenshots)

---

## Batch ID Tracking

**Important:** The PayPal batch ID in the settlement modal and ledger entry must match the batch ID visible in the PayPal Dashboard.

**Example flow:**
1. Execute settlement → response includes `payoutBatchId: "$BATCH_ID-12345678-ABCDEF"`
2. Screenshot settlement modal → save `settlement-modal.png` with this ID visible
3. Query ledger → find entry with same `payout_batch_id`
4. Screenshot ledger → save `ledger-entry.png` with ID visible
5. Log into PayPal Sandbox → search for batch `$BATCH_ID-12345678-ABCDEF`
6. Screenshot PayPal Dashboard → save `paypal-batch-dashboard.png` with same ID visible

**Why this matters:** Judges will verify that the batch ID is real by searching PayPal Sandbox themselves. Screenshots must prove end-to-end traceability.

---

## Screenshot Checklist

Before saving each screenshot, verify:

### Portfolio View
- [ ] Both swimlanes visible (OUTGOING | INCOMING)
- [ ] "AgenticPay Vendor Services" contract visible
- [ ] Status badges visible (ACTIVE, etc.)
- [ ] No blurriness

### Audit Result
- [ ] Confidence score visible (91%)
- [ ] Settlement Mode badge visible (AUTONOMOUS)
- [ ] Risk Level visible (LOW)
- [ ] Rationale text readable

### Settlement Modal
- [ ] Settlement ID visible
- [ ] Amount: $250.00 USD
- [ ] **Payout Batch ID visible** (key evidence)
- [ ] Batch Status visible (PROCESSING or SUCCESS)
- [ ] "Funds dispatched" message visible

### Ledger Entry
- [ ] Status: PAYOUT_EXECUTED (green)
- [ ] Confidence: 91%
- [ ] Amount: $250.00 USD
- [ ] Rail: PAYPAL_SANDBOX (blue)
- [ ] **Batch ID visible** (match with settlement modal)
- [ ] Timestamp visible

### PayPal Dashboard
- [ ] Batch ID visible (matches settlement modal & ledger)
- [ ] Amount: $250.00 USD
- [ ] Status: PROCESSING or SUCCESS
- [ ] Recipient email visible
- [ ] Created date visible
- [ ] **This is the proof of real PayPal integration**

---

## Organizing Assets

Directory structure:
```
docs/
├── assets/
│   └── demo/
│       ├── portfolio-view.png
│       ├── audit-result.png
│       ├── settlement-modal.png
│       ├── ledger-entry.png
│       └── paypal-batch-dashboard.png
└── DEMO_ASSETS.md (this file)
```

---

## Embedding in Documentation

Once screenshots are captured, you can embed them in markdown files:

```markdown
![Portfolio View](docs/assets/demo/portfolio-view.png)

*Figure 1: AgenticPay portfolio showing dual-swimlane layout (OUTGOING | INCOMING contracts)*

![Settlement Modal](docs/assets/demo/settlement-modal.png)

*Figure 2: Settlement success response with real PayPal batch ID*

![Ledger Entry](docs/assets/demo/ledger-entry.png)

*Figure 3: Ledger entry recording the PayPal PAYOUT_EXECUTED event*

![PayPal Batch](docs/assets/demo/paypal-batch-dashboard.png)

*Figure 4: Real batch verification in PayPal Sandbox Dashboard*
```

---

## Backup & Version Control

### Before Committing

1. **Verify all 5 screenshots are present:**
   ```bash
   ls -lh docs/assets/demo/
   # Should show 5 PNG files, each 0.5 MB–2 MB
   ```

2. **Commit to Git:**
   ```bash
   git add docs/assets/demo/
   git commit -m "docs: add demo screenshots for PayPal settlement feature"
   git push origin main
   ```

3. **Backup locally:**
   ```bash
   # Keep originals in a safe location
   cp -r docs/assets/demo ~/Backup/agenticpay-demo-assets-backup/
   ```

---

## Next Steps

1. Capture all 5 screenshots following the guidelines above
2. Place them in `docs/assets/demo/`
3. Verify batch ID matches across settlement modal, ledger, and PayPal Dashboard
4. Commit to Git
5. Include embedded images in demo documentation or presentation slides
6. Use screenshots as visual references during the live demo (in case something fails, you have proof it worked)

---

## Support

If you need help with:
- **Screenshot capture:** Refer to browser DevTools documentation or QuickTime/OBS guides
- **Batch ID mismatch:** Check settlement response and ledger query to ensure same fingerprint
- **Low resolution:** Use 100% browser zoom and capture at 1920x1080
- **PayPal access:** Verify Sandbox credentials are correct (not production credentials)

</content>
</invoke>