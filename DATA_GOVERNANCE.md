# Data Governance and Privacy

This document describes what data the current implementation processes, where it is stored, and which controls are not yet implemented. It is an engineering reference, not legal advice.

---

## 1. Data inventory

| Category | Examples | Storage | Notes |
| :--- | :--- | :--- | :--- |
| Account profile | Legal name, display name, email, PayPal settlement email, tax ID, billing address, account type | Browser `localStorage` (`agenticpay_profile_v2`) | Entered by the user. Not server-persisted. |
| Contract data | Contract name, vendor/client names and emails, contract type, reference ID, escrow cap | Browser `localStorage` (`agenticpay_projects_v2`) | Includes milestones, acceptance criteria, and audit results. |
| Financial envelope | Per-transaction cap, daily ceiling, spent today, active escrow, kill-switch state | Browser `localStorage` (`agenticpay_envelope_v2`) | Client-side state; not an authoritative ledger. |
| Transaction ledger | Actor, action, amount, audit confidence, risk, status, PayPal payload log | Browser `localStorage` (`agenticpay_logs_v2`) | Rendered in AG Grid. |
| AI prompts | Negotiation text and project context | Sent to the configured AI provider; not persisted server-side | May contain names, emails, or contract details entered by the user. |
| Deliverables | Acceptance criteria, deliverable text or URL | Sent to `/api/agent/audit`; stored in the browser ledger | Truncated at 12,000 characters. |
| PayPal credentials | Client ID, client secret | Environment variables | The public client ID reaches the browser. `PAYPAL_CLIENT_SECRET` is server-only; the browser PayPal client cannot read it. |
| PayPal payout payloads | Batch ID, recipient, amount, HTTP log | Browser `localStorage` and route response | Current workspace records use generated `PAYPAL-BATCH-*` identifiers and synthetic payloads; they are not actual PayPal responses. |

---

## 2. Data flow

```text
User input
  |
  +--> localStorage (profile, contracts, envelope, logs)
  |
  +--> POST /api/agent/audit
  |      sanitize + truncate
  |      deterministic scoring
  |      return result
  |
  +--> POST /api/agent/stream
         sanitize
         send prompt to AI provider
         stream response to browser
  |
  +--> Local settlement record
         workspace generates a PAYOUT_EXECUTED log
         no PayPal request is made
  |
  +--> Optional browser PayPal client attempt
         OAuth requires a secret the browser does not have
         no live payout completes
```

---

## 3. Privacy controls in the current build

- **Data minimization by scope:** the application collects only the fields required for contract and settlement workflows.
- **Secrets:** PayPal and AI provider keys are read from environment variables on the server. `PAYPAL_CLIENT_SECRET` is not exposed to the browser. The browser PayPal client therefore cannot complete live OAuth.
- **Prompt-injection sanitization:** untrusted input is pattern-sanitized before it is sent to a model or wrapped into an audit block.
- **Payload limiting:** deliverable text is truncated at 12,000 characters.
- **Local deletion:** clearing browser storage removes profile, contract, envelope, and ledger data from that device.
- **Simulated payout indicators:** when the browser has no PayPal client ID, the chat client returns a `SIM_PAYOUT_` result. Workspace settlement records are local and are not proof of payment.
- **No server retention:** prompts, deliverables, and settlement records are not persisted server-side by the current implementation.

---

## 4. Gaps and risks

The current implementation does **not** provide:

- PII detection or redaction before AI provider calls.
- Server-side persistence, encryption at rest, or tenant isolation.
- Immutable or tamper-evident audit logs.
- Cryptographic hashing of deliverables or ledger entries.
- Data retention schedules or automated deletion.
- Data subject access or erasure workflows.
- Consent management beyond the user's direct interaction with the application.
- Data residency controls.
- Role-based access control for account or contract data.
- Authenticated APIs or tenant-scoped access to AI and audit routes.
- A server-side settlement record that can be reconciled against PayPal.

Browser `localStorage` is user-controlled. It must not be treated as an authoritative record for financial reconciliation or regulatory reporting.

---

## 5. Recommended production controls

1. Classify data as public, internal, confidential, or restricted.
2. Move contract, milestone, and ledger data to server-side storage with encryption at rest.
3. Add tenant isolation and role-based access control.
4. Redact PII before sending prompts or deliverables to external model providers.
5. Store append-only audit events with integrity verification.
6. Define retention periods and deletion procedures.
7. Provide privacy notices and data subject request handling.
8. Log access to sensitive records without logging secrets or full payloads.
9. Review provider data processing terms and cross-border transfer requirements.
10. Add backups, disaster recovery, and tested restore procedures.

---

## 6. Alignment references

The design intent is consistent with common governance principles:

- **GDPR:** data minimization, purpose limitation, storage limitation, and erasure.
- **NIST AI RMF:** accountability, transparency, and risk monitoring.
- **ISO/IEC 38505-1:** data accountability and stewardship.

These are design goals, not certifications. The current build does not claim compliance with any framework.
