# Architecture Specification

This document describes the implemented architecture of AgenticPay AI: the client application, route handlers, financial guardrails, state model, PayPal integration, and known boundaries.

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
+-----------------------------------+-----------------------------------+
                                    |
                   POST /api/agent/stream   POST /api/agent/audit
                                    |
+-----------------------------------v-----------------------------------+
| Next.js route handlers                                                |
|  - GuardrailEnforcer: budget, audit, sanitization, payload limits     |
|  - AI provider adapter: OpenAI/OpenRouter or Gemini                   |
|  - Deterministic deliverable audit                                    |
|  - PaypalSandboxClient: OAuth + /v1/payments/payouts                  |
+-----------------------------------+-----------------------------------+
                                    |
                                    v
                     PayPal Sandbox REST API
                     https://api-m.sandbox.paypal.com
```

The application is a modular monolith. There is no database, message broker, or background worker in the current implementation. Financial state is held in the browser and reconstructed on load.

---

## 2. Client structure

| Area | Responsibility |
| :--- | :--- |
| `src/app/page.tsx` | Owns profile, projects, budget envelope, and transaction logs. Hydrates from `localStorage`, creates contracts, applies ledger updates, and routes between portfolio and workspace views. |
| `src/components/Header.tsx` | Portfolio/workspace navigation, directional escrow metrics, escrow health, and the master kill-switch. |
| `src/components/ProjectPortfolioView.tsx` | Two-column outbound/inbound swimlanes, executive summaries, contract cards, subcontract badges, intake link, and business capacity card. |
| `src/components/ProjectWorkspaceView.tsx` | Project header, milestone list, audit modal, payout authorization, project ledger, and freeze controls. |
| `src/components/AgentChat.tsx` | Streamed negotiation assistant, preset actions, target amount, and pre-payout guard checks. |
| `src/components/CommandCenter.tsx` | AG Grid transaction ledger with risk, status, confidence, and PayPal payload inspection. |
| `src/components/CreateProjectModal.tsx` | Contract creation, milestone setup, legal type, perspective, and parent-contract linkage. |
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
8. Return the score, rationale, risk level, sanitized text, settlement mode, idempotency key, and optional simulated batch ID.

The endpoint does not call an LLM. The AI assistant is a separate streaming endpoint and has no settlement authority.

### 4.3 Milestone release

1. The workspace submits a deliverable to the audit endpoint.
2. A passing audit of `$1,000 USD` or less can be settled autonomously.
3. A passing audit above `$1,000 USD` returns `HUMAN_APPROVAL_REQUIRED` and sets the milestone to `AUDITED_PENDING_APPROVAL`.
4. Before payout, the workspace checks the project's remaining budget: `budgetCapUSD - spentUSD`.
5. The PayPal client executes a Sandbox payout if credentials are present; otherwise it returns a clearly marked simulated result.
6. A `PAYOUT_EXECUTED` log is emitted with the PayPal batch ID and HTTP payload.
7. `applyTransactionLogToProjects` increments `spentUSD` exactly once for that log.

### 4.4 AI negotiation stream

`POST /api/agent/stream`:

1. Requires a prompt.
2. Sanitizes the prompt.
3. Validates the proposed amount against the budget envelope.
4. Returns `422` if the budget check fails.
5. Streams a response from the primary model.
6. Falls back to the configured secondary model if the primary call fails.

The assistant is advisory. It does not execute payouts.

---

## 5. Guardrail model

`src/lib/guardrails/enforcer.ts` provides deterministic controls:

| Method | Purpose |
| :--- | :--- |
| `validateTransactionBudget` | Kill-switch, positive amount, per-transaction ceiling, daily ceiling, and risk classification. |
| `sanitizePromptInput` | Replaces known instruction-override and role-hijack patterns with `[BLOCKED_INJECTION_ATTEMPT]`. |
| `validatePayloadSize` | Truncates deliverable text above 12,000 characters. |
| `evaluateAuditConfidence` | Applies the 85% threshold and the $1,000 autonomous settlement cap. |

The workspace and agent chat also enforce a **remaining project budget** check before releasing funds. This is separate from the envelope's per-transaction and daily ceilings.

### Control hierarchy

1. **Master kill-switch:** account-wide block on audit settlement and payout attempts.
2. **Contract freeze:** project-level pause for outbound contracts.
3. **Budget guard:** per-transaction, daily, and remaining-project-budget checks.
4. **Audit threshold:** confidence below 85% is rejected.
5. **Human approval:** amounts above $1,000 USD require explicit authorization.
6. **Ledger invariant:** only `PAYOUT_EXECUTED` increments settled funds.

---

## 6. PayPal integration

`src/lib/paypal/client.ts`:

- Resolves the base URL from `PAYPAL_ENVIRONMENT` or `PAYPAL_ENV` (`sandbox` default).
- Uses `PAYPAL_CLIENT_ID` / `NEXT_PUBLIC_PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
- Requests an OAuth token from `/v1/oauth2/token`.
- Executes `POST /v1/payments/payouts` with a `PayPal-Request-Id` idempotency header.
- Returns the batch ID and a formatted HTTP log for the ledger.
- Falls back to a simulated result when the client ID is absent or set to `placeholder`. A live payout requires both a client ID and a client secret.

**Not implemented:** Orders API, Vault tokenization, webhooks, refunds, disputes, and production onboarding.

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
- No server-side persistence; browser state can be modified by the user.
- No tenant isolation or audit trail durability.
- Audit scoring is heuristic and keyword-based, not semantic.
- PayPal Vault and production disbursement are out of scope.
- Automated UI and end-to-end tests are not yet configured.
- The AI fallback is a simple try/catch around streaming; it does not retry partially streamed responses.

These limitations are documented so that production hardening work is explicit rather than implied.
