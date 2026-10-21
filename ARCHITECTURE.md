# Architecture Specification

This document describes the implemented architecture of AgenticPay AI: the client application, route handlers, financial guardrails, state model, PayPal integration code, and known boundaries.

> [!IMPORTANT]
> **Current boundary:** settlement is server-authoritative within AgenticPay, but it is non-custodial. A successful release atomically records a `PAYOUT_EXECUTED` ledger event and updates project/envelope spend; it does not call PayPal. The PayPal client is reserved for a future external payout adapter. Browser state is a cache reconciled from the server.

---

## 1. System context

```text
+-----------------------------------------------------------------------+
| Browser                                                               |
|  Next.js 16 App Router client                                         |
|  - Portfolio and workspace views                                      |
|  - AI negotiation assistant                                           |
|  - AG Grid transaction ledger                                         |
|  - Tenant-scoped localStorage cache (profile, projects, envelope, logs)|
|  - Server reconciliation after authentication                         |
|  - AgentChat negotiation assistant (no settlement client)             |
+-----------------------------------+-----------------------------------+
                                    |
      /api/auth/*  /api/projects/*  /api/envelope  /api/ledger/events
      /api/agent/stream  /api/agent/audit
                                    |
+-----------------------------------v-----------------------------------+
| Next.js route handlers                                                |
|  - Opaque session cookies + CSRF origin validation                    |
|  - GuardrailEnforcer: budget, audit, sanitization, payload limits     |
|  - AI provider adapter: OpenAI/OpenRouter or Gemini                   |
|  - Deterministic heuristic deliverable audit + server persistence     |
|  - Server-authoritative projects, envelopes, atomic settlement        |
|  - Tenant-scoped durable ledger                                       |
|  - No external payout route                                           |
+--------------------+----------------------------+---------------------+
                     |                            |
                     | PostgreSQL                 | No server-to-PayPal payout
                     v                            v
 users / sessions / projects /         PayPal Sandbox REST API
 envelopes / ledger events             (reserved client code; not live)
```

The application is a modular monolith. PostgreSQL stores users, opaque session hashes, tenant-scoped projects, budget envelopes, and ledger events. Browser storage is a tenant-scoped cache that is reconciled from the server after sign-in. Settlement is executed in a PostgreSQL transaction with row locks and a deduplicated ledger insert. There is no message broker or background worker.

---

## 2. Client structure

| Area | Responsibility |
| :--- | :--- |
| `src/app/page.tsx` | Verifies the session, owns profile, projects, budget envelope, and transaction logs. Hydrates from tenant-scoped `localStorage`, reconciles projects/envelope from the server, syncs durable ledger events, creates server contracts, persists freeze/kill-switch updates, executes settlement, and routes between portfolio and workspace views. |
| `src/components/AuthScreen.tsx` | Sign-in and invite-gated account creation. |
| `src/components/Header.tsx` | Portfolio/workspace navigation, session identity, sign-out, directional escrow metrics, escrow health, and the master kill-switch. |
| `src/components/ProjectPortfolioView.tsx` | Two-column outbound/inbound swimlanes, executive summaries, contract cards, and subcontract badges. |
| `src/components/ProjectWorkspaceView.tsx` | Project header, milestone list, audit modal, server-backed settlement/authorization, project ledger, and freeze controls. |
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
- Milestones: `milestones[]` with amount, lifecycle status, acceptance criteria, audit score/rationale, proof, approval requirement, and settlement reference.

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

PostgreSQL is authoritative for:

- `agenticpay_users` and `agenticpay_sessions`
- `agenticpay_projects` keyed by `(user_id, id)` with JSONB contract data
- `agenticpay_envelopes` keyed by `user_id`
- `agenticpay_ledger_events` with per-user event-ID deduplication

`src/app/page.tsx` stores a browser cache under versioned keys:

- `agenticpay_profile_v2`
- `agenticpay_projects_v2`
- `agenticpay_envelope_v2`
- `agenticpay_logs_v2`

Hydration is guarded so invalid JSON falls back to the initial state. Writes begin only after hydration completes. After authentication, the client loads `/api/projects`; server projects replace the cache when present. First-time accounts may submit local definitions to `/api/projects/bootstrap`, which sanitizes spend, milestone status, audit evidence, and completion state before storage.

---

## 4. Settlement flow

### 4.1 Contract creation

1. The user opens the create-contract modal from the portfolio.
2. The modal submits contract details and an initial scope.
3. `page.tsx` calls `POST /api/projects`.
4. The server validates the contract, forces status `ACTIVE` and `spentUSD: 0`, converts milestones to `PENDING`, and returns the stored contract.
5. A `GUARDRAIL` log entry records the new contract locally.
6. The new contract becomes the selected workspace.

### 4.2 Deliverable audit

`POST /api/agent/audit` implements the following sequence:

1. Require an authenticated session and same-origin request.
2. Reject with `423 Locked` if the request declares an active kill-switch, the server envelope is kill-switched, or the contract is not `ACTIVE`.
3. If `projectId`/`milestoneId` are supplied, require both, load the tenant-scoped project, require the milestone, reject completed/locked milestones, and require the submitted amount to match the server amount.
4. Require `deliverableText` or `deliverableUrl`; otherwise return `400`.
5. Bound the deliverable with `GuardrailEnforcer.validatePayloadSize` (12,000 characters).
6. Sanitize prompt-injection patterns with `GuardrailEnforcer.sanitizePromptInput`.
7. Wrap the sanitized text in a `<deliverable_data>` block.
8. Compute a deterministic confidence score:
   - Blocked injection pattern: 15.
   - Very short deliverable without a URL: 55.
   - Requirement-token match or a GitHub/PR URL: 91–99.
   - Other non-empty deliverables: 86.
9. Evaluate the result with `GuardrailEnforcer.evaluateAuditConfidence(score, amount)`.
10. For a passing audit with server IDs, atomically record `AUDITED_PENDING_APPROVAL`, score, rationale, proof, submission time, and approval requirement on the server milestone. Project spend and status are preserved.
11. Return the score, rationale, risk level, sanitized text, settlement mode, idempotency key, and an optional simulated batch reference.

The endpoint does not call an LLM, call PayPal, or settle funds. The GitHub/PR rule means a URL alone can pass the 85% gate without substantive deliverable text. The AI chat does not call this endpoint or display an audit score.

### 4.3 Milestone release

1. The workspace submits a deliverable to the audit endpoint with the server `projectId` and `milestoneId`.
2. A passing audit persists `AUDITED_PENDING_APPROVAL` on the server milestone.
3. A passing audit of `$1,000 USD` or less is eligible for autonomous settlement. A passing audit above `$1,000 USD`, or an `INCOMING` contract, requires explicit client authorization.
4. `POST /api/projects/[projectId]/milestones/[milestoneId]/settle` loads the project and envelope under row locks.
5. The settlement engine revalidates kill-switch, `ACTIVE` contract status, milestone existence, milestone status, server audit score of at least 85%, and positive amount.
6. It enforces the per-transaction ceiling, daily ceiling, and remaining project budget.
7. It atomically marks the milestone `COMPLETED`, increments `spentUSD` and `spentTodayUSD`, and inserts one `PAYOUT_EXECUTED` ledger event with deterministic IDs derived from the milestone fingerprint.
8. Duplicate and concurrent releases are rejected. A completed milestone cannot be settled again.
9. The client reconciles the returned project, envelope, and event into its cache.

No external payout is executed. The PayPal client is not imported by the runtime UI.

### 4.4 AI negotiation stream

`POST /api/agent/stream`:

1. Requires a prompt.
2. Sanitizes the prompt.
3. Validates the proposed amount against the budget envelope.
4. Returns `422` if the budget check fails.
5. Streams a response from the primary model.
6. Attempts a fallback to the configured secondary model if the primary call throws. The `try/catch` wraps stream construction, not failures that occur after streaming begins.

The route requires an authenticated session and a same-origin request. It is not rate-limited. It trusts `envelope`, `maxBudgetUSD`, and `killSwitchActive` values supplied in the request body. The assistant is advisory: it does not call the audit endpoint and does not execute payouts.

---

## 5. Guardrail model

`src/lib/guardrails/enforcer.ts` provides deterministic controls:

| Method | Purpose |
| :--- | :--- |
| `validateTransactionBudget` | Kill-switch, positive amount, per-transaction ceiling, daily ceiling, and risk classification. |
| `sanitizePromptInput` | Replaces known instruction-override and role-hijack patterns with `[BLOCKED_INJECTION_ATTEMPT]`. |
| `validatePayloadSize` | Truncates deliverable text above 12,000 characters. |
| `evaluateAuditConfidence` | Applies the 85% threshold and the $1,000 autonomous settlement cap. |

The server settlement engine owns the authoritative **remaining project budget** check. The client may pre-check for UX, but settlement revalidates against stored project and envelope state.

### Control hierarchy

1. **Master kill-switch:** server envelope state blocks audits and settlement.
2. **Contract freeze:** non-`ACTIVE` contract state blocks audits and settlement.
3. **Audit gate:** settlement requires a server-recorded audit score of at least 85%.
4. **Budget guard:** per-transaction, daily, and remaining-project-budget checks execute atomically.
5. **Human approval:** amounts above $1,000 USD and `INCOMING` contracts require explicit authorization.
6. **Ledger behavior:** only the settlement path can create `PAYOUT_EXECUTED`; client ledger writes reject that status. Server event IDs deduplicate retries.

---

## 6. PayPal integration

`src/lib/paypal/client.ts`:

- Resolves the base URL from `PAYPAL_ENVIRONMENT` or `PAYPAL_ENV` (`sandbox` default).
- Uses `PAYPAL_CLIENT_ID` / `NEXT_PUBLIC_PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
- Requests an OAuth token from `/v1/oauth2/token`.
- Executes `POST /v1/payments/payouts` with a `PayPal-Request-Id` header.
- Returns the batch ID and a formatted HTTP log for the ledger.
- Returns a simulated result when the client ID is absent or set to `placeholder`.

The external payout integration is not operational end to end:

- The client is not imported by the runtime UI; only its unit tests exercise it.
- The workspace release path does not call the client; it writes a durable internal settlement record.
- No server-side route invokes the client, so OAuth and external payout execution are not reachable from the application.
- `PayPal-Request-Id` is generated per invocation by `Date.now()` and random values. It is not deterministic and does not protect against duplicate payouts.

**Not implemented:** a server-side payout route, Orders API, Vault tokenization, webhooks, refunds, disputes, and production onboarding.

---

## 7. Deployment topology

- **Build:** `next build --webpack`.
- **Runtime:** `next start` on Node.js 20.
- **Container:** `Dockerfile` based on `node:20-alpine`.
- **Render:** `render.yaml` defines a Docker web service on port 3000, a PostgreSQL database, and a health check at `/`.
- **Database:** PostgreSQL stores users, session-token hashes, projects, budget envelopes, and ledger events. Production refuses to serve authenticated traffic without `DATABASE_URL`.
- **Secrets:** injected through the hosting environment; never committed.

---

## 8. Known architectural limitations

- Authentication covers session identity, but there is no role-based authorization or email verification.
- Rate limiting is process-local for login/register; the AI, audit, and ledger routes are not rate-limited.
- Tenant isolation is enforced for sessions, ledger events, projects, envelopes, audits, and settlement.
- Audit scoring is heuristic and keyword-based, not semantic. GitHub/PR URLs bypass content evaluation.
- Settlement is durable and server-authoritative internally, but no external PayPal payout is executed.
- PayPal Vault and production disbursement are out of scope.
- The AI chat does not invoke the audit endpoint or record settlements.
- The audit route does not independently verify artifact ownership or whether a linked commit/PR exists.
- Live PostgreSQL concurrency behavior is covered by row-lock design but not by an automated integration test.
- Client escrow intake links are not generated by the current portfolio UI.
- Automated UI and end-to-end tests are not yet configured.
- The AI fallback is a simple try/catch around stream construction; it does not retry partially streamed responses.

These limitations are documented so that production hardening work is explicit rather than implied.
