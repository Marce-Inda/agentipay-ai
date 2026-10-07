# Security Policy & Financial Guardrails 🛡️

At **AgenticPay AI**, security is a foundational architectural requirement. Because our system orchestrates autonomous AI decisions alongside financial settlements via PayPal, we adhere to a **Zero-Trust & Deterministic Security Model**.

---

## 🔒 Security Architecture Highlights

### 1. Zero-Hallucination Deterministic Enforcer
* **Design Principle:** The AI Agent is strictly prohibited from executing raw API calls to PayPal REST endpoints directly.
* **Mechanism:** All AI intents must pass through an immutable, non-AI TypeScript Guardrail Layer (`/lib/guardrails`). This layer enforces hard per-project budget ceilings, rate limits, and sanction checks before any outbound HTTP request is dispatched to PayPal.

### 2. Prompt Injection Defense (OWASP LLM01)
* **Sanitized Context Isolation:** Third-party deliverables (code PRs, invoice text, images) are parsed inside an isolated evaluation sandbox where system instructions explicitly override untrusted content.

### 3. Server-Side Credential Isolation (OWASP LLM02)
* All sensitive API credentials (`PAYPAL_CLIENT_SECRET`, `OPENROUTER_API_KEY`) remain strictly server-side.
* Client-side components interact exclusively with authenticated Next.js Server Actions and API Proxy endpoints.

### 4. Zero PCI-DSS Scope
* **AgenticPay AI** never handles, stores, or transmits credit/debit card primary account numbers (PAN). All payment captures are handled directly via **PayPal SDK tokenized flows**.

---

## 🚨 Dual-Tier Emergency Control Hierarchy

In the event of anomalous AI behavior or suspected risk, AgenticPay AI provides granular control:

1. **Project-Level Escrow Freeze:** Pauses or cancels milestone payouts for a specific contract or vendor without interrupting other active projects.
2. **Master Emergency Kill-Switch:** Pressing the global "Emergency Stop" button revokes active PayPal OAuth tokens across the entire account immediately.
3. **Audit Score Confidence Veto:** Any AI audit score below **85%** automatically freezes payout execution and flags the transaction in the AG Grid audit ledger for human review.

---

## 📩 Reporting Security Vulnerabilities

If you discover a security vulnerability within this repository, please refrain from opening a public issue. Contact the maintainers directly or submit a report via the hackathon submission form.
