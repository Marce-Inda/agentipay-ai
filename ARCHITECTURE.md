# Architecture Specification

This document describes the implemented architecture of AgenticPay AI: the client application, route handlers, financial guardrails, state model, PayPal integration code, and known boundaries.

> [!IMPORTANT]
> **Current limitation:** settlement is not operational end to end. Workspace releases write local `PAYOUT_EXECUTED` logs with generated batch identifiers and do not call PayPal. The PayPal client is not imported by the runtime UI.

---

## 1. System context

```text
+-----------------------------------------------------------------------+
| Browser                                                               |
|  Next.js 16 App Router client                                         |
|  - Portfolio and workspace views                                      |
|  - AI negotiation assistant                                           |
|  - AG Grid transaction ledger                                         |
|  - localStorage persistence (profile, projects, envelope, logs)       |
|  - Workspace local settlement records                                 |
|  - AgentChat negotiation assistant (no payout client)                 |
+-----------------------------------+-----------------------------------+
                                    |
                   POST /api/agent/stream   POST /api/agent/audit
                                    |
+-----------------------------------v-----------------------------------+
| Next.js route handlers                                                |
|  - GuardrailEnforcer: budget, audit, sanitization, payload limits     |
|  - AI provider adapter: OpenAI/OpenRouter or Gemini                   |
|  - Deterministic heuristic deliverable audit                          |
|  - No payout route                                                    |
+-----------------------------------+-----------------------------------+
                                    |
                                    | No server-to-PayPal payout call
                                    v
                 PayPal Sandbox REST API (client code only; not live)
                 https://api-m.sandbox.paypal.com
```

The application is a modular monolith. There is no database, message broker, or background worker in the current implementation. Financial state is held in the browser and reconstructed on load.

---

## 2. Client structure

| Area | Responsibility |
| :--- | :--- |
| `src/app/page.tsx` | Owns profile, projects, budget envelope, and transaction logs. Hydrates from `localStorage`, creates contracts, applies ledger updates, and routes between portfolio and workspace views. |
| `src/components/Header.tsx` | Portfolio/workspace navigation, directional escrow metrics, escrow health, and the master kill-switch. |
| `src/components/ProjectPortfolioView.tsx` | Two-column outbound/inbound swimlanes, executive summaries, contract cards, and subcontract badges. |
| `src/components/ProjectWorkspaceView.tsx` | Project header, milestone list, audit modal, client-authorized settlement, project ledger, and freeze controls. |
| `src/components/AgentChat.tsx` | Streamed negotiation assistant with pre-settlement guard checks. It does not audit deliverables or record settlements. |
| `src/components/CommandCenter.tsx` | AG Grid transaction ledger with risk, status, confidence, and settlement payload inspection. |
| `src/components/CreateProjectModal.tsx` | Contract creation, milestone setup, legal type, settlement email, and optional parent-contract linkage. |
| `src/components/AccountSettingsModal.tsx` | Legal identity, tax ID, settlement email, billing jurisdiction, and account tier. |

### View model

- **Portfolio view:** cross-contract overview. Outbound and inbound contracts are rendered side by side. Search and status filters apply to both streams. A focus toggle can isolate either stream.
- **Workspace view:** a single contract with milestone operations, audit submission, and a project-scoped ledger.

### Roles

Account type is separate from contract perspective:

- **Account type:** `BUSINESS` or `PERSONAL`.
- **Contract perspective:** `OUTGOING` (client/escrow funder) or `INCOMING` (contractor/escrow beneficiary).
- **Workspace labels:** `Client (Escrow Funder)` for outbound contracts and `Contractor (Escrow Beneficiary)` for inbound contracts.
- **Subcontracting:** an incoming contract can reference a parent project and fund a linked outgoing contract. The UI displays `SUBCONTRACTED` and the parent mandate name.

Freeze controls are only available for outbound contracts. An incoming contractor cannot freeze the client's escrow.

---

## 3. Data model

Core types are defined in `src/lib/types/index.ts`.

### `ProjectContract`

- Identity: `id`, `name`, `vendorName`, `vendorEmail`, optional `clientName` and `clientEmail`.
- Financials: `budgetCapUSD`, `spentUSD`.
- State: `status` (`ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`).
- Perspective: `OUTGOING` or `INCOMING`.
- Legal metadata: `contractType`, `contractReferenceId`.
- Subcontracting: `isSubcontracted`, `parentProjectId`.
- Milestones: `milestones[]` with amount, status, acceptance criteria, audit score, proof, and PayPal batch ID.

### `TransactionLog`

- Project identity and timestamp.
- Actor: `BUYER_AI`, `SELLER_AI`, `GUARDRAIL`, or `PAYPAL_API`.
- Action, amount, recipient, audit confidence, risk level, and status.
- Optional HTTP payload log and PayPal transaction ID.

### `BudgetEnvelope`

- `maxPerTransactionUSD`
- `dailyCeilingUSD`
- `spentTodayUSD`
- `activeEscrowUSD`
- `killSwitchActive`

### Persistence

`src/app/page.tsx` stores state in browser `localStorage` under versioned keys:

- `agenticpay_profile_v2`
- `agenticpay_projects_v2`
- `agenticpay_envelope_v2`
- `agenticpay_logs_v2`

Hydration is guarded so invalid JSON falls back to the initial state. Writes begin only after hydration completes.

---

## 4. Settlement flow

### 4.1 Contract creation

1. The user opens the create-contract modal from the portfolio.
2. The modal submits contract details and an initial scope.
3. `page.tsx` creates the contract with `spentUSD: 0` and status `ACTIVE`.
4. A `GUARDRAIL` log entry records the new contract.
5. The new contract becomes the selected workspace.

### 4.2 Deliverable audit

`POST /api/agent/audit` implements the following sequence:

1. Reject with `423 Locked` if `envelope.killSwitchActive` is true.
2. Require `deliverableText` or `deliverableUrl`; otherwise return `400`.
3. Bound the deliverable with `GuardrailEnforcer.validatePayloadSize` (12,000 characters).
4. Sanitize prompt-injection patterns with `GuardrailEnforcer.sanitizePromptInput`.
5. Wrap the sanitized text in a `<deliverable_data>` block.
6. Compute a deterministic confidence score:
   - Blocked injection pattern: 15.
   - Very short deliverable without a URL: 55.
   - Requirement-token match or a GitHub/PR URL: 91–99.
   - Other non-empty deliverables: 86.
7. Evaluate the result with `GuardrailEnforcer.evaluateAuditConfidence(score, amount)`.
8. Return the score, rationale, risk level, sanitized text, settlement mode, a per-request idempotency key, and an optional simulated batch ID.

The endpoint does not call an LLM and does not move funds. The GitHub/PR rule means a URL alone can pass the 85% gate without substantive deliverable text. The AI chat does not call this endpoint or display an audit score.

### 4.3 Milestone release

1. The workspace submits a deliverable to the audit endpoint.
2. A passing audit of `$1,000 USD` or less can be recorded as an autonomous settlement.
3. A passing audit above `$1,000 USD` returns `HUMAN_APPROVAL_REQUIRED` and sets the milestone to `AUDITED_PENDING_APPROVAL`.
4. Before recording a settlement, the workspace checks the project's remaining budget: `budgetCapUSD - spentUSD`.
5. The workspace does **not** call PayPal. It marks the milestone complete and emits a `PAYOUT_EXECUTED` log with a generated `SETTLE-*` identifier and a local settlement payload. The audit response's `simulatedBatchId`, when present, is not a PayPal payment either.
6. `applyTransactionLogToProjects` increments `spentUSD` for each `PAYOUT_EXECUTED` log passed to it. It does not deduplicate log IDs, so repeated log application double-counts settled amounts.

The PayPal client is not imported by the runtime UI. The workspace records settlements locally and does not initiate a PayPal request.

### 4.4 AI negotiation stream

`POST /api/agent/stream`:

1. Requires a prompt.
2. Sanitizes the prompt.
3. Validates the proposed amount against the budget envelope.
4. Returns `422` if the budget check fails.
5. Streams a response from the primary model.
6. Attempts a fallback to the configured secondary model if the primary call throws. The `try/catch` wraps stream construction, not failures that occur after streaming begins.

The route has no authentication or rate limiting. It trusts `envelope`, `maxBudgetUSD`, and `killSwitchActive` values supplied in the request body. The assistant is advisory: it does not call the audit endpoint and does not execute payouts.

---

## 5. Guardrail model

`src/lib/guardrails/enforcer.ts` provides deterministic controls:

| Method | Purpose |
| :--- | :--- |
| `validateTransactionBudget` | Kill-switch, positive amount, per-transaction ceiling, daily ceiling, and risk classification. |
| `sanitizePromptInput` | Replaces known instruction-override and role-hijack patterns with `[BLOCKED_INJECTION_ATTEMPT]`. |
| `validatePayloadSize` | Truncates deliverable text above 12,000 characters. |
| `evaluateAuditConfidence` | Applies the 85% threshold and the $1,000 autonomous settlement cap. |

The workspace and agent chat also enforce a **remaining project budget** check before recording a local settlement. This is separate from the envelope's per-transaction and daily ceilings.

### Control hierarchy

1. **Master kill-switch:** client-wide block on milestone release; the audit route also reads a flag from the request body.
2. **Contract freeze:** project-level pause for outbound contracts.
3. **Budget guard:** per-transaction, daily, and remaining-project-budget checks.
4. **Audit threshold:** confidence below 85% is rejected.
5. **Human approval:** amounts above $1,000 USD require explicit authorization.
6. **Ledger behavior:** `PAYOUT_EXECUTED` increments settled funds for each applied log; there is no deduplication.

---

## 6. PayPal integration

`src/lib/paypal/client.ts`:

- Resolves the base URL from `PAYPAL_ENVIRONMENT` or `PAYPAL_ENV` (`sandbox` default).
- Uses `PAYPAL_CLIENT_ID` / `NEXT_PUBLIC_PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
- Requests an OAuth token from `/v1/oauth2/token`.
- Executes `POST /v1/payments/payouts` with a `PayPal-Request-Id` header.
- Returns the batch ID and a formatted HTTP log for the ledger.
- Returns a simulated result when the client ID is absent or set to `placeholder`.

The current integration is not operational end to end:

- The client is not imported by the runtime UI; only its unit tests exercise it.
- The workspace release path does not call the client and writes a local settlement record.
- No server-side route invokes the client, so OAuth and payout execution are not reachable from the application.
- `PayPal-Request-Id` is generated per invocation by `Date.now()` and random values. It is not deterministic and does not protect against duplicate payouts.

**Not implemented:** a server-side payout route, Orders API, Vault tokenization, webhooks, refunds, disputes, and production onboarding.

---

## 7. Deployment topology

- **Build:** `next build --webpack`.
- **Runtime:** `next start` on Node.js 20.
- **Container:** `Dockerfile` based on `node:20-alpine`.
- **Render:** `render.yaml` defines a Docker web service on port 3000 with a health check at `/`.
- **Secrets:** injected through the hosting environment; never committed.

---

## 8. Known architectural limitations

- No authentication or authorization layer.
- No rate limiting on the AI or audit endpoints.
- No server-side persistence; browser state can be modified by the user.
- No tenant isolation or audit trail durability.
- Audit scoring is heuristic and keyword-based, not semantic. GitHub/PR URLs bypass content evaluation.
- Settlement is recorded locally; no server-side PayPal payout is executed.
- PayPal Vault and production disbursement are out of scope.
- The AI chat does not invoke the audit endpoint or record settlements.
- Ledger application does not deduplicate `PAYOUT_EXECUTED` logs; repeated application double-counts.
- Client escrow intake links are not generated by the current portfolio UI.
- Automated UI and end-to-end tests are not yet configured.
- The AI fallback is a simple try/catch around stream construction; it does not retry partially streamed responses.

These limitations are documented so that production hardening work is explicit rather than implied.
