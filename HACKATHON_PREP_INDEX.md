# Hackathon Preparation Index: Complete Reference

**Last Updated:** November 6, 2026  
**Status:** ALL DOCUMENTS READY ✅  
**Project:** AgenticPay AI (PayPal Hackathon)

---

## 📚 Document Organization

### 🎯 START HERE (Read First)

1. **PITCH_READINESS_SUMMARY.md** ← **Start here for overview**
   - What changed in this update
   - Go/No-go assessment
   - Pre-recording checklist
   - Next steps timeline

### 🎬 For Video Production

2. **VIDEO_PRODUCTION_NOTES.md** ← **For demo team**
   - Shot-by-shot storyboard with timing
   - Visual requirements (Payment Rail badge)
   - Audio production guidelines
   - Editing checklist
   - Backup plans if something fails

3. **SETTLEMENT_RAIL_REFERENCE.md** ← **For narration clarity**
   - Three rails explained (PAYPAL_SANDBOX, SIMULATED, SUPPRESSED_RAIL)
   - Decision tree for which rail to use
   - Copy-paste narration scripts (3 branches)
   - Environment variable reference

4. **DEMO_SCRIPT.md** ← **Full demo script**
   - Complete 3-minute shot breakdown
   - Segment-by-segment narration
   - Cue cards
   - Technical notes and backup plans

### 📋 For Project Management

5. **PITCH_ALIGNMENT_CHECKLIST.md** ← **Master alignment checklist**
   - Dual-persona alignment
   - Settlement rail transparency alignment
   - Code & documentation verification
   - Demo preparation checklist
   - Devpost submission alignment
   - Timeline with owners

### 🏗️ For Architecture & Security Review

6. **SECURITY_AUDIT_REPORT.md** ← **For judges wanting technical depth**
   - 12-control audit (all passed ✅)
   - Code evidence and line numbers
   - Fail-closed design explanation
   - Code sections to highlight in demo video
   - Hackathon disclaimer template

### 📊 For Pitch & Strategy

7. **PITCH_STRATEGY.md** ← **Master pitch narrative**
   - Verified narrative (dual-persona + transparent rails)
   - Claims you can and cannot make
   - Three-minute demo outline (updated)
   - Devpost answers template
   - Sponsor angles (PayPal, AG Grid, Render, etc.)
   - Submission checklist

### 🔧 For Development & Ops

8. **SETTLEMENT_RAIL_REFERENCE.md** (also in Dev section)
   - Code locations and line numbers
   - Environment variables to set
   - How to test each rail locally

---

## 🎯 Quick Navigation by Role

### 👤 **Demo Coordinator**
1. Read: PITCH_READINESS_SUMMARY.md (overview)
2. Verify: Environment setup (which rail will be used)
3. Use: SETTLEMENT_RAIL_REFERENCE.md (narration scripts)
4. Follow: VIDEO_PRODUCTION_NOTES.md (shot list)
5. Execute: DEMO_SCRIPT.md (final script)

### 📹 **Video Editor**
1. Read: VIDEO_PRODUCTION_NOTES.md (shot list + requirements)
2. Receive: Raw video recording
3. Follow: Editing Checklist (audio, timing, exports)
4. Test: Playback on multiple devices
5. Upload: To YouTube, embed in Devpost

### 🏗️ **Architect / Security Reviewer**
1. Read: SECURITY_AUDIT_REPORT.md (full audit)
2. Verify: Code sections match findings
3. Provide: References to judges if needed
4. Support: Answer technical Q&A during demo

### 💼 **Product / Pitch Lead**
1. Read: PITCH_STRATEGY.md (narrative + claims)
2. Use: Devpost answers template
3. Follow: PITCH_ALIGNMENT_CHECKLIST.md (alignment)
4. Prepare: Judge talking points
5. Upload: Video + links to Devpost

### 👨‍💻 **Development Team**
1. Verify: SETTLEMENT_RAIL_REFERENCE.md (code locations)
2. Test: Each settlement rail locally
3. Prepare: Test data for demo
4. Support: Bug fixes during recording if needed

---

## 🚀 Execution Timeline

### Phase 1: Preparation (Today - Tomorrow)
```
[ ] Read PITCH_READINESS_SUMMARY.md (30 min)
[ ] Review SETTLEMENT_RAIL_REFERENCE.md (20 min)
[ ] Verify environment setup (which rail will be used) (15 min)
[ ] Run test settlement (don't record) (10 min)
[ ] Create test data if needed (30 min)
```

### Phase 2: Recording (Day 2)
```
[ ] Set up three browser tabs (app + PayPal + DB)
[ ] Follow VIDEO_PRODUCTION_NOTES.md shot list (90 min)
[ ] Record all segments in order
[ ] Save raw video file
[ ] Backup video file (2 copies)
```

### Phase 3: Editing (Day 3)
```
[ ] Audio: Normalize, remove background noise
[ ] Video: Ensure Payment Rail badges visible
[ ] Timing: Hit segment time targets (±2 sec)
[ ] Color: Verify consistency (green/amber/gray)
[ ] QA: Full playback from start to finish
[ ] Export: MP4, 1080p, < 100 MB
[ ] Test: Play on 5+ different devices/browsers
```

### Phase 4: Upload & Submission (Day 4)
```
[ ] Upload to YouTube (unlisted)
[ ] Create Devpost embed
[ ] Add caption with Payment Rail info
[ ] Write Devpost description (use template)
[ ] Add links to SECURITY_AUDIT_REPORT.md
[ ] Add links to SETTLEMENT_RAIL_REFERENCE.md
[ ] Final review with team
[ ] SUBMIT
```

---

## 📖 Content Alignment Matrix

| Requirement | PITCH_STRATEGY | DEMO_SCRIPT | VIDEO_NOTES | AUDIT_REPORT | ALIGNMENT_CHECKLIST |
|---|---|---|---|---|---|
| Dual-persona support | ✅ Updated | ✅ Segment 2 | ✅ Shot 1-2 | N/A | ✅ Section 1 |
| Settlement rail transparency | ✅ Updated | ✅ Segment 4 | ✅ Shot 4-5 | ✅ Section 10 | ✅ Section 2 |
| Account type selection | ✅ Updated | ✅ Segment 2 | ✅ Shot 1 | N/A | ✅ Section 1 |
| Payment rail badge | N/A | ✅ Noted | ✅ CRITICAL | N/A | ✅ UI implementation |
| Fail-closed design | ✅ Narrative | ✅ Branches | ✅ Backup plans | ✅ Complete | ✅ Section 2 |
| Real vs simulated | ✅ Claims | ✅ Both options | ✅ Decision tree | ✅ Three rails | ✅ Branch logic |
| Competitive advantages | ✅ Section 6 | ✅ Segment 6 | ✅ Shot 7 | N/A | ✅ Section 4 |
| Regulatory alignment | ✅ Section 4 | ✅ Mentioned | N/A | ✅ Complete | ✅ Reference |

---

## 🎤 Key Messaging

### "In One Sentence"
> "AgenticPay is a server-authoritative escrow platform for Enterprise and Independent Operators, with transparent payment rails that fail closed and deterministic guardrails that prevent AI from making unauthorized financial decisions."

### "In Three Sentences"
> AgenticPay AI is a dual-persona escrow workspace supporting both Enterprise Accounts (organizations) and Independent Operators (freelancers). We separate AI advisory from financial authority through transparent, deterministic guardrails. Settlement is fail-closed: if PayPal credentials are available, we execute real Payouts API; otherwise, we record an honest failure with zero fake transfers.

### "In One Slide"
```
AgenticPay AI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dual-Persona Escrow + Transparent Settlement Rails

Key Features:
  ✓ Enterprise Accounts + Independent Operators
  ✓ Real PayPal Sandbox integration (when credentials present)
  ✓ Fail-closed design (honest ledger entries)
  ✓ Deterministic guardrails (no AI surprises)
  ✓ Atomic transactions (no double-pays)

Competitive Edge:
  1. Transparent payment rails (real/simulated/suppressed always visible)
  2. Server-authoritative settlement (deterministic rules)
  3. Dual-persona support (buy and sell in one workspace)
```

---

## 🔗 Links for Judges

**Share these in Devpost submission:**

1. **SECURITY_AUDIT_REPORT.md** — Full 12-control audit with evidence
   - Use Case: Judge asks "How do I know this is production-ready?"
   
2. **SETTLEMENT_RAIL_REFERENCE.md** — Technical deep-dive on three rails
   - Use Case: Judge asks "What happens without PayPal credentials?"
   
3. **ARCHITECTURE.md** — System design (existing document)
   - Use Case: Judge wants broader context

4. **COMPLIANCE.md** — FinCEN/AML/PCI-DSS alignment (existing)
   - Use Case: Judge asks about regulatory compliance

---

## ✅ Final Verification Checklist

Before submitting to Devpost, verify:

### Code
- [x] Dual-persona account types supported (AuthScreen.tsx)
- [x] 3-rail settlement contract implemented (src/lib/paypal/client.ts)
- [x] Payment rail recorded in database
- [x] Settlement response includes `payRail` field
- [x] Fail-closed behavior in production (throws exception)

### Documentation
- [x] PITCH_STRATEGY.md updated with dual-persona
- [x] DEMO_SCRIPT.md has narration branches
- [x] SECURITY_AUDIT_REPORT.md complete
- [x] SETTLEMENT_RAIL_REFERENCE.md created
- [x] PITCH_ALIGNMENT_CHECKLIST.md created
- [x] VIDEO_PRODUCTION_NOTES.md created
- [x] PITCH_READINESS_SUMMARY.md created

### Demo Preparation
- [ ] Environment verified (which rail will be used)
- [ ] Test settlement run (don't record)
- [ ] Three browser tabs prepared
- [ ] Test data ready
- [ ] Recording script reviewed

### Video Production
- [ ] Raw video recorded (< 3 min)
- [ ] Audio cleaned and normalized
- [ ] Payment Rail badges visible in all relevant shots
- [ ] Batch IDs clearly readable
- [ ] Timing hits segment targets (±2 sec each)
- [ ] Exported to MP4, 1080p, < 100 MB
- [ ] Tested on multiple devices/browsers

### Devpost Submission
- [ ] Video embedded (YouTube link)
- [ ] Description uses template
- [ ] Links to SECURITY_AUDIT_REPORT.md
- [ ] Disclaimer included (Sandbox-only)
- [ ] Keywords include dual-persona + transparent rails
- [ ] All team members added

---

## 🎓 Study Notes

### If Judge Asks About Double-Payment Prevention:
> "We use a SHA-256 fingerprint of (projectId, milestoneId, amount) to generate the PayPal-Request-Id and sender_batch_id. If you retry the same settlement, you get the exact same request ID, so PayPal deduplicates it. Additionally, we have a database UNIQUE constraint on (user_id, fingerprint_id), and deterministic idempotency keys ensure retries return the same batch ID. You'd have to break all three layers simultaneously to double-pay."

### If Judge Asks About Atomicity:
> "The settlement transaction uses PostgreSQL row-level locks (SELECT...FOR UPDATE) on the milestone, project, and envelope. PayPal execution happens inside the transaction. If PayPal succeeds, we commit atomically. If PayPal fails, we rollback everything—the milestone never gets marked completed, the budget never gets decremented. Zero partial mutations."

### If Judge Asks About the Three Rails:
> "With credentials: Real PayPal API. Without credentials in non-production: Simulated mode (deterministic demo). Without credentials and simulation disabled: Suppressed mode (local ledger only, honest entry). Without credentials in production: Hard error (HTTP 502). We never fake a payout."

### If Judge Asks About Dual-Persona:
> "Enterprise Accounts manage large vendor payables and receivables. Independent Operators are freelancers and contractors. Both see the same OUTGOING (you're paying) and INCOMING (you're getting paid) swimlanes, but role-appropriate views and controls. One workspace for both perspectives."

---

## 🚀 Ready to Ship

All systems are aligned and documented.

**Next Action:** Review PITCH_READINESS_SUMMARY.md and execute the pre-recording checklist.

**Questions? Check:**
- Settlement rails: SETTLEMENT_RAIL_REFERENCE.md
- Demo flow: DEMO_SCRIPT.md
- Video tech: VIDEO_PRODUCTION_NOTES.md
- Alignment: PITCH_ALIGNMENT_CHECKLIST.md
- Security: SECURITY_AUDIT_REPORT.md

**Good luck! 🎉**

---

**Maintained by:** Architecture + Demo + Product teams  
**Last sync:** November 6, 2026 @ 02:37 UTC

