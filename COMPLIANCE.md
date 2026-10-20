# Regulatory Compliance and Settlement Governance

This document describes the compliance posture of the current implementation. It is an engineering summary, not legal advice.

---

## 1. Non-custodial design intent

AgenticPay AI is designed as a **non-custodial orchestration layer**:

- The application does not accept, hold, pool, or transmit customer funds through an internal balance.
- PayPal remains the settlement rail.
- The platform records contract terms, milestones, audit results, and payout instructions.
- The current implementation uses PayPal Sandbox Payouts. It does not provide production money transmission.

```text
Client / Contractor
        |
        | contract, milestone, deliverable
        v
AgenticPay AI
  deterministic guardrails
  audit record
  payout instruction
        |
        | PayPal Sandbox REST API
        v
PayPal
```

The application does not claim to be a licensed escrow agent, money transmitter, or payment institution. Production operation would require legal and regulatory review in each jurisdiction.

---

## 2. What is implemented

| Requirement area | Current implementation |
| :--- | :--- |
| Non-AI financial limits | Per-transaction, daily, and remaining-project-budget checks in TypeScript. |
| Autonomous settlement cap | $1,000 USD; higher amounts require human authorization. |
| Audit threshold | 85% confidence; lower scores are rejected. |
| Kill-switch | Blocks audit settlement and payout attempts. |
| Contract freeze | Blocks releases for a specific outbound contract. |
| Idempotency | `PayPal-Request-Id` on payout requests. |
| Prompt-injection sanitization | Pattern replacement and isolated deliverable framing. |
| Payload limiting | 12,000-character deliverable cap. |
| Ledger consistency | Only `PAYOUT_EXECUTED` increments settled funds. |

---

## 3. What is not implemented

The following are production requirements, not current capabilities:

- KYC/KYB onboarding and identity verification.
- AML and sanctions screening.
- Licensing or regulatory registration.
- Production PayPal onboarding and underwriting.
- Chargeback protection, reserve management, and dispute adjudication.
- Binding legal contracts, electronic signatures, or arbitration workflows.
- Tax reporting, invoicing compliance, and jurisdiction-specific withholding.
- Immutable audit storage and regulatory export.
- Data residency controls.
- Consumer protection disclosures and complaint handling.

Do not represent the current build as a compliant production escrow service.

---

## 4. Settlement governance

### 4.1 Tiered authorization

| Milestone amount | Audit result | Settlement path |
| :--- | :--- | :--- |
| <= $1,000 USD | >= 85% | Eligible for autonomous release after budget checks. |
| > $1,000 USD | >= 85% | `HUMAN_APPROVAL_REQUIRED`; explicit workspace authorization is required. |
| Any amount | < 85% | Rejected; escrow remains locked. |

### 4.2 Objective acceptance criteria

Contracts should define measurable criteria such as:

- Test coverage thresholds.
- Passing CI pipelines.
- Staging endpoint responses.
- OpenAPI or schema validation.
- Performance budgets.
- Required artifacts or pull requests.

The current audit is keyword-and-artifact based. It should not be treated as a substitute for substantive human acceptance of complex or subjective work.

### 4.3 Dispute handling

There is no automated dispute workflow. Production deployments should define:

1. Who can pause a contract.
2. How disputed deliverables are escalated.
3. How refunds or reversals are handled.
4. How evidence is retained.
5. How the platform coordinates with PayPal dispute processes.

---

## 5. Data and privacy obligations

- Portfolio state is stored in browser `localStorage`.
- Prompts and deliverables are sent to the configured AI provider when the AI assistant or audit flow is used.
- The application does not currently redact PII before provider calls.
- Logs may contain vendor or client email addresses and deliverable text.

Production deployments should add data classification, retention rules, redaction, access controls, and a documented lawful basis for processing. See [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md).

---

## 6. Security references

- [SECURITY.md](SECURITY.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [TECHNICAL_ARCHITECTURE_AND_DEVOPS.md](TECHNICAL_ARCHITECTURE_AND_DEVOPS.md)

---

## 7. Production readiness checklist

Before operating with real funds:

- [ ] Obtain jurisdiction-specific legal review.
- [ ] Confirm PayPal product eligibility and onboarding requirements.
- [ ] Implement KYC/KYB and sanctions screening where required.
- [ ] Add authentication, authorization, and tenant isolation.
- [ ] Persist contracts, milestones, and ledger events server-side.
- [ ] Add immutable audit logging and export.
- [ ] Implement dispute, refund, and chargeback procedures.
- [ ] Add privacy notices and data subject request handling.
- [ ] Complete security testing and operational readiness review.
