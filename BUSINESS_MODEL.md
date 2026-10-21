# Business Model and Commercial Strategy

This document describes the commercial model for AgenticPay AI. It distinguishes the current product capability from planned commercial packaging.

---

## 1. Market thesis

Autonomous software agents can negotiate and prepare work, but organizations still require financial control before funds move. AgenticPay AI addresses that gap with:

- A dual-perspective workspace for buying and selling services.
- Deterministic budget and settlement guardrails.
- Milestone deliverable audits.
- A ledger that records local financial actions and audit outcomes.
- PayPal as the intended settlement rail. The current build contains client-side payout code but does not execute live payouts.

The target segments are:

- Agencies and technology consultancies that manage subcontractors.
- Businesses procuring software, design, and content from external vendors.
- Professional freelancers and solo operators who need milestone-based payment protection.
- Platforms that want to embed escrow-style controls into agent-driven procurement.

TAM figures commonly cited for freelance services and autonomous B2B purchasing are directional. They are not a forecast of AgenticPay AI revenue.

---

## 2. Account model

Account type is independent of contract perspective.

| Account type | Positioning |
| :--- | :--- |
| Personal | Solo operators and freelancers who hire and deliver in parallel. Simplified identity and direct settlement once a server-side payout route exists. |
| Business | Agencies and enterprises that need formal identity, tax details, departmental budgets, and subcontracting workflows. |

Every account can operate both outbound and inbound contracts. A business can accept a client mandate and subcontract part of the work, linking the incoming and outgoing contracts in one portfolio.

---

## 3. Current product scope

Implemented today:

- Dual outbound/inbound portfolio.
- Contract and milestone management.
- Deterministic budget, freeze, kill-switch, and approval controls.
- Heuristic deliverable audit.
- PayPal Sandbox client code; workspace settlement is recorded locally and is not executed through PayPal.
- Streamed AI negotiation assistant.
- AG Grid ledger with payload inspection.
- Browser-local persistence.

Not implemented today:

- Subscription billing or usage metering.
- Multi-user seats, roles, or approvals.
- Automated MSA/SOW generation.
- Tax invoicing or VAT/EIN validation.
- Webhook processing.
- Production PayPal onboarding.
- A server-side PayPal payout route or verified live Sandbox payout.
- KYC/KYB or sanctions screening.
- Multimodal vision audit.
- Server-side persistence or immutable audit storage.
- A functional escrow intake page; the portfolio only generates the link.

Commercial packaging below is therefore a strategy, not a description of shipped billing.

---

## 4. Packaging strategy

| Tier | Target customer | Proposed capability |
| :--- | :--- | :--- |
| Starter | Individual operator | Core dual-perspective workspace, standard guardrails, limited monthly escrow volume. |
| Pro | Small agency or established freelancer | Higher escrow volume, priority support, advanced ledger export, configurable approval thresholds. |
| Enterprise | Agency, consultancy, or platform | Multi-seat governance, departmental budgets, SSO, audit export, custom integration, and compliance support. |

Pricing should be validated with pilot customers. The figures below are placeholders for commercial modeling, not current charges:

- Starter: free or low monthly fee.
- Pro: approximately $29 per month.
- Enterprise: approximately $199 per month plus a platform fee on settled volume.

Any take-rate must be reviewed against PayPal fees, jurisdiction-specific rules, and the operating entity's licensing position.

---

## 5. Revenue streams

1. **SaaS subscription:** recurring fee for workspace, governance, and reporting features.
2. **Settlement platform fee:** a percentage of settled milestone volume above a defined threshold.
3. **Enterprise integration:** API or white-label licensing for platforms that want embedded milestone controls.
4. **Professional services:** onboarding, workflow design, and compliance configuration for enterprise customers.

The current build does not meter usage or collect subscription payments.

---

## 6. Unit economics

| Cost driver | Consideration |
| :--- | :--- |
| AI inference | Depends on model, context length, and negotiation volume. The assistant should not be invoked for deterministic settlement decisions. |
| PayPal fees | Governed by PayPal's commercial terms and the merchant's account agreement. |
| Infrastructure | Next.js hosting, container runtime, and observability. |
| Support | Human review of disputes, high-value approvals, and enterprise onboarding. |
| Compliance | KYC/AML, legal review, audit, and licensing where applicable. |

Gross margin should be measured from actual pilot data. A target margin is not a substitute for unit-level cost tracking.

---

## 7. Go-to-market

### Initial wedge

Target agencies that already use freelancers and suffer from manual milestone administration. The value proposition is faster settlement with explicit budget control and an inspectable audit trail.

### Expansion path

1. Land with outbound escrow and subcontractor management.
2. Expand into inbound receivables for the same agency.
3. Add enterprise governance, reporting, and integrations.
4. Offer embedded controls to platforms serving agent-driven procurement.

### Proof points required

- Reduction in time from deliverable submission to settlement.
- Reduction in payment disputes or duplicate payouts. The current build has no evidence for this; it lacks stable idempotency and ledger deduplication.
- Guardrail block rate and human-approval rate.
- Customer retention and settled volume.
- Integration reliability with PayPal Sandbox and, eventually, production. Live integration is not yet operational.

---

## 8. Competitive position

The defensible elements are:

- Deterministic financial controls separated from generative AI.
- Dual-perspective contract architecture with linked subcontracting.
- Audit trail spanning AI advice, guardrail decisions, and local settlement records. Actual PayPal execution is not yet wired.
- Enterprise-grade operational terminology and workflow design.

The current build is not yet defensible on scale, compliance, or multi-tenant security. Those must be built before enterprise sales.

---

## 9. Risks

| Risk | Mitigation |
| :--- | :--- |
| Regulatory classification as money transmission or escrow | Keep the architecture non-custodial; obtain legal review before real-fund operation. |
| PayPal product or policy changes | Abstract the settlement adapter and maintain a clear integration boundary. |
| AI overreach or hallucination | Keep settlement deterministic; use AI only for advisory interaction. |
| Fraudulent deliverables | Combine audit scoring with human review, evidence requirements, and dispute procedures. |
| Enterprise security requirements | Add authentication, tenant isolation, server persistence, and immutable audit logs. |
| Pricing pressure | Validate willingness to pay with pilots before committing to a take-rate. |
