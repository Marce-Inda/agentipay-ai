# Responsible AI and Ethics

AgenticPay AI delegates settlement preparation to software while retaining deterministic financial controls and explicit human authority above a defined threshold. This document describes the ethical design intent and the limits of the current implementation.

---

## 1. Design principles

| Principle | Implementation |
| :--- | :--- |
| Human authority | Amounts above $1,000 USD require explicit human authorization. |
| Non-AI financial control | Budget, kill-switch, freeze, audit threshold, and payout eligibility are enforced in TypeScript. |
| Transparency | The ledger records actor, action, amount, audit confidence, risk level, status, and settlement logs. |
| Contestability | A rejected or held milestone can be reviewed and, where appropriate, re-audited or manually authorized. |
| Bounded automation | The AI assistant cannot execute payouts or override guardrails. |
| Data minimization | The application collects only fields needed for contract and settlement workflows. |

---

## 2. Human oversight

### Autonomous settlement

A milestone is eligible for an autonomous local settlement record only when:

- The audit confidence is at least 85%.
- The amount is $1,000 USD or less.
- The kill-switch is inactive.
- The contract is not frozen.
- The amount is within the project's remaining budget.

This records a `PAYOUT_EXECUTED` event in browser storage. It does not transfer funds.

### Human authorization

Amounts above $1,000 USD that pass the audit are placed in `AUDITED_PENDING_APPROVAL`. A human must authorize the local settlement record in the workspace. The AI does not have a path to bypass this state.

### Emergency intervention

- The master kill-switch blocks milestone release in the client.
- An outbound contract can be frozen to block releases.
- The user can clear local state to remove browser-persisted records from that device.

---

## 3. Transparency and explainability

The current implementation provides:

- Audit confidence and a rationale string.
- Risk level and settlement mode.
- An actor-tagged transaction ledger.
- Payload inspection for auditing; workspace settlement payloads are synthetic, not PayPal responses.
- Deterministic guardrail outcomes that can be traced to specific rules.

Known limitations:

- The AI chat is negotiation-only. Audit confidence and settlement outcomes come from deterministic server and workspace flows.
- The audit endpoint auto-passes GitHub and pull-request URLs, so an empty deliverable can receive a passing score.

The implementation does **not** provide a model chain-of-thought, a formal explanation report, or an independent audit certificate. The AI response is an advisory conversation, not evidence of financial correctness.

---

## 4. Fairness and non-discrimination

The application does not make lending, employment, housing, or credit eligibility decisions. It evaluates deliverable evidence against contract requirements.

Known limitations:

- The audit is keyword-and-artifact based and may favor deliverables that use expected terminology.
- The model may reflect biases present in its training data during negotiation.
- There is no bias testing, fairness metric, or disparate-impact analysis.
- There is no appeal workflow beyond human review.

Production use should include representative test cases, human review for subjective work, and monitoring for systematically different outcomes across vendor groups.

---

## 5. Accuracy and robustness

- The audit threshold is 85%.
- The autonomous settlement cap is $1,000 USD.
- Deliverable input is limited to 12,000 characters.
- Prompt-injection patterns are replaced before evaluation.
- PayPal client code generates a `PayPal-Request-Id`, but keys are per-call and do not prevent duplicate payouts.
- The ledger helper increments once per applied log; it does not deduplicate repeated log IDs.
- The audit scorer can pass a GitHub URL without substantive content.
- The AI chat does not generate audit confidence or settlement outcomes.

The audit is not a guarantee that work is correct, complete, or legally acceptable. Complex deliverables should be reviewed by a human.

---

## 6. Accountability

Accountability is distributed across:

- **User:** defines contract terms, milestones, recipients, and budgets.
- **Platform operator:** configures environment variables, PayPal access, and deployment.
- **Application:** enforces deterministic rules and records outcomes in browser storage.
- **PayPal:** would execute the actual payout once a server-side integration exists. The current build does not send a payout request.
- **AI provider:** processes prompts under its own terms and retention policies.

The current build does not provide immutable audit storage, legal attribution, or regulator-ready reporting. Production deployments need an accountable operating entity and documented escalation procedures.

---

## 7. Regulatory alignment

The design intent is informed by:

- **OECD AI Principles:** human-centered values, transparency, robustness, and accountability.
- **UNESCO Recommendation on the Ethics of AI:** human oversight and explicability.
- **NIST AI RMF:** govern, map, measure, and manage.
- **EU AI Act:** transparency and human oversight for consequential automated decisions.

This is not a compliance certification. Legal classification depends on the deployed use case, jurisdiction, and operating model.

---

## 8. Environmental considerations

Model selection affects cost and energy use. The provider adapter supports lightweight models and a fallback configuration, but the repository does not measure energy consumption, carbon intensity, or per-request emissions. Production operators should monitor model usage and avoid unnecessary long-context calls.

---

## 9. Responsible deployment checklist

- [ ] Define human review ownership for high-value and disputed milestones.
- [ ] Document acceptance criteria that can be evaluated objectively.
- [ ] Test audit behavior across representative deliverable types.
- [ ] Monitor rejection rates and approval patterns for bias.
- [ ] Add PII redaction before external model calls.
- [ ] Persist immutable audit events.
- [ ] Provide a dispute and appeal workflow.
- [ ] Publish clear terms, privacy notices, and limitation disclosures.
- [ ] Complete legal review before handling real funds.
