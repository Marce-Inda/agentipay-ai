# 🏆 Judge Access & Demo Credentials

This document provides hackathon judges with immediate access to AgenticPay AI for live evaluation.

**Last Updated:** November 2026  
**Evaluation Period:** [Dates of hackathon]

---

## 🎯 Quick Start for Judges

### Live Demo URL
```
https://agenticpay-ai.onrender.com
```

### Demo Account Credentials
| Field | Value |
|-------|-------|
| **Email** | `judge@agenticpay.demo` |
| **Password** | `JudgeDemo2026!@#Demo` |
| **Organization** | Hackathon Judge Panel |

**⏰ Note:** These credentials are active **only during the evaluation period**. They will be deleted immediately after judges complete their assessment.

---

## 📋 What You'll See Upon Login

Once logged in, you'll see the **Enterprise Portfolio Dashboard** with:

1. **Dual Swimlanes:** 
   - **OUTGOING** (Accounts Payable): contracts you issue to vendors
   - **INCOMING** (Accounts Receivable): contracts where you deliver work

2. **Pre-populated Demo Project:** A sample milestone contract ready for testing

3. **Settlement Controls:** Real-time settlement execution with PayPal Sandbox integration

---

## 🎬 Recommended Demo Flow (< 3 minutes)

### Segment 1: View the Portfolio (0:00–0:30)
1. Sign in with the demo credentials above
2. Observe the dual swimlanes and project card layout
3. Note the professional terminology: "Vault Escrow Envelope," "Milestone Payout," "Audit Confidence"

### Segment 2: Inspect a Milestone (0:30–1:00)
1. Click on the demo project in OUTGOING to open the **Project Workspace**
2. Review the milestone details:
   - Acceptance criteria
   - Amount: $250 USD
   - Deliverable proof URL field
3. Note the guardrail thresholds displayed in the sidebar

### Segment 3: Audit a Deliverable (1:00–1:45)
1. Click **"Submit Deliverable"**
2. Paste a GitHub pull request URL (or any proof of work URL) into the audit form
3. Click **"Analyze & Audit"**
4. **Expected Result:** Audit confidence score (typically 92%+ for GitHub URLs)
5. Click **"Record Audit on Server"** to persist the score

### Segment 4: Execute Live PayPal Settlement (1:45–2:45)
1. Return to the project workspace
2. Observe the milestone now shows **"AUDITED_PENDING_APPROVAL"** status
3. Click **"Release Milestone"** button
4. **Watch in real-time:**
   - Loading state (2–3 seconds)
   - Real PayPal Sandbox payout execution
   - Success response with actual `payout_batch_id`
   - Milestone status changes to **"COMPLETED"** ✅
   - Project balance increments by $250

### Segment 5: Verify in Ledger (2:45–3:00)
1. Click the **"Audit Ledger"** tab (AG Grid transaction log)
2. Observe the latest settlement entry with:
   - Timestamp
   - Status: `PAYOUT_EXECUTED`
   - Real `payout_batch_id` from PayPal Sandbox
   - Amount: $250 USD

---

## 🔐 Security & Privacy

- **Data Isolation:** Judge demo account is tenant-scoped. No access to other users' contracts.
- **Session Security:** Opaque HttpOnly cookies, 12-hour expiry, same-origin CSRF protection.
- **Credentials Rotation:** Post-evaluation, demo credentials will be deleted and `REGISTRATION_INVITE_CODE` will be rotated.
- **PayPal Sandbox:** All payouts execute against PayPal Sandbox. No real funds are transferred.

---

## 🛠️ Technical Details

### Architecture Highlights
- **Server-Authoritative Settlement:** All payment decisions enforced server-side via deterministic TypeScript guardrails (not AI-driven).
- **Real PayPal Integration:** Settlement calls PayPal Sandbox `/v1/payments/payouts` with idempotent request IDs.
- **Atomic Transactions:** PostgreSQL row-level locks ensure settlement is all-or-nothing. PayPal rejection rolls back atomically.
- **Audit Ledger:** Durable transaction records in PostgreSQL with immutable batch IDs and timestamps.

### Technology Stack
- **Frontend:** Next.js App Router (React 18), TailwindCSS
- **Backend:** Next.js API routes, PostgreSQL 15+, row-level locking
- **AI Integration:** Optional OpenAI/Gemini negotiation assistant (advisory only)
- **Payment Rail:** PayPal Sandbox Payouts API
- **Authentication:** Scrypt password hashing, HttpOnly sessions

### Guardrail Enforcement
| Threshold | Behavior |
|-----------|----------|
| Audit Confidence < 85% | Milestone remains locked; settlement rejected |
| Settlement > $1,000 USD | `HUMAN_APPROVAL_REQUIRED` escalation |
| Kill-Switch Active | Audits and settlement blocked |
| Budget Exceeded | Settlement rejected with `INSUFFICIENT_BUDGET` |
| Concurrent Release | Duplicate prevention via deterministic fingerprints |

---

## ❓ Frequently Asked Questions

### Q: Can I create my own projects as a judge?
**A:** Yes. After logging in, click **"Create Project"** to define your own milestone contracts and test the full workflow.

### Q: What happens if the PayPal API is unavailable?
**A:** The settlement request returns HTTP 502 with a structured error, and the transaction rolls back atomically. The UI displays the error clearly. Retrying uses the same idempotency key, so no double-payments occur.

### Q: Can I see the source code?
**A:** Yes. The repository is open-source on GitHub: [github.com/Marce-Inda/agentipay-ai](https://github.com/Marce-Inda/agentipay-ai)

### Q: How long are these credentials valid?
**A:** The judge demo account is active during the hackathon evaluation period only. After that period ends, the account and credentials will be deleted. You'll receive a notification before that happens.

### Q: What's the production roadmap?
**A:** See [NEXT_SESSION_TASKS.md](NEXT_SESSION_TASKS.md) for the post-hackathon product roadmap, including webhook reconciliation, multi-tenant billing, and advanced audit workflows.

---

## 📞 Support During Evaluation

If you encounter any issues:

1. **Technical Issues:** Check the browser console (F12) for error messages
2. **Questions:** Refer to the [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for detailed walkthrough
3. **Architecture Questions:** See [ARCHITECTURE.md](ARCHITECTURE.md) for system design details

---

## 🔄 Post-Evaluation Cleanup

**After the hackathon evaluation period ends (approximately [Date]):**

1. The judge demo account (`judge@agenticpay.demo`) will be automatically deleted
2. The `REGISTRATION_INVITE_CODE` will be rotated to a new strong random value
3. `REGISTRATION_ENABLED` will remain `true` for developer access with valid invite codes
4. All demo data will be purged from the Render PostgreSQL instance

**Manual cleanup command** (for the hosting team):
```bash
DATABASE_URL=postgresql://... npx ts-node scripts/cleanup-demo-account.ts
```

This will:
- Delete all sessions for the demo user
- Remove the demo account from the database
- Print instructions for resetting the invite code

---

## ✅ Verification Checklist (For Judge)

- [ ] Can sign in with provided credentials
- [ ] Portfolio dashboard loads with sample project
- [ ] Can navigate between OUTGOING and INCOMING swimlanes
- [ ] Audit endpoint accepts GitHub PR URL and returns confidence score
- [ ] Settlement executes and returns real PayPal `payout_batch_id`
- [ ] Milestone status updates to COMPLETED
- [ ] Ledger shows immutable transaction record
- [ ] Can read source code on GitHub
- [ ] Architecture and guardrails are clearly documented

---

**Questions before we start?** Contact the development team directly. Good luck with your evaluation! 🚀
