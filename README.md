# AgenticPay AI

> Enterprise escrow operations workspace for autonomous service contracts, with deterministic financial guardrails and server-authoritative milestone settlement records.

AgenticPay AI is a dual-perspective escrow workspace for organizations that both commission work and deliver work. It combines an AI negotiation assistant, deterministic settlement controls, milestone deliverable audits, and an inspectable transaction ledger.

> [!IMPORTANT]
> **Implementation status (2026-10-21).** The portfolio, milestone management, guardrail rules, deterministic audit endpoint, AG Grid ledger, authentication, tenant isolation, PostgreSQL-backed sessions, durable ledger, server-authoritative projects/envelopes, and atomic milestone settlement are implemented. Settlement records are durable internal ledger entries; no external PayPal payout request is sent. The PayPal Sandbox client remains available for a future server-side payout adapter.

---

## Overview

Service contracts often involve two operational roles:

- **Outbound escrow (Accounts Payable):** the organization hires a vendor, defines milestones, audits deliverables, and authorizes releases.
- **Inbound escrow (Accounts Receivable):** the organization delivers work to a client, tracks the contract's declared value, and records milestone settlements in the durable ledger.

AgenticPay AI keeps both roles in one portfolio. It supports subcontract metadata, where an incoming contract can reference a linked outgoing contract. No funds are transferred between them. Financial actions are evaluated by a non-AI TypeScript guardrail layer and the server-side settlement engine before a settlement record is written. The current settlement path does not make a PayPal request.

### Core capabilities

- **Dual-perspective portfolio:** parallel outbound and inbound swimlanes with search, status filters, and focus modes.
- **Contract and milestone management:** contract envelope ceilings, vendor/client details, milestone acceptance criteria, deliverable proofs, and settlement state.
- **Server-authoritative settlement:** PostgreSQL-backed projects and budget envelopes, atomic milestone settlement with row locking, server-checked audit confidence, per-transaction/daily/project ceilings, kill-switch enforcement, contract freeze, and a $1,000 USD autonomous settlement cap.
- **Milestone audit endpoint:** payload size limits, prompt-injection sanitization, isolated deliverable framing, heuristic confidence scoring, and human-approval escalation above the autonomous cap. GitHub and pull-request URLs are automatically treated as high-confidence evidence.
- **PayPal Sandbox client (reserved):** OAuth and `/v1/payments/payouts` logic exists in `src/lib/paypal/client.ts`, with a simulated mode. It is not imported by the runtime UI; durable settlement records currently stop at the internal ledger. A server-side payout route is required before live Sandbox settlement can be verified.
- **AI negotiation assistant:** streamed responses through OpenAI/OpenRouter or Gemini, with a configurable fallback model.
- **AG Grid audit ledger:** transaction status, actor, risk level, audit confidence, settlement amount, and inspectable local or server-returned payloads.
- **Authentication and tenant isolation:** scrypt password hashing, opaque server-side sessions stored in PostgreSQL, HttpOnly cookies, invite-gated production registration, login throttling, and same-origin CSRF checks.
- **Durable audit ledger:** authenticated, tenant-scoped `GET`/`POST /api/ledger/events` persisted in PostgreSQL with per-user deduplication. Client-submitted `PAYOUT_EXECUTED` events are rejected.
- **Cost and abuse controls:** process-local, per-user rate limits on LLM, audit, settlement, ledger, project, and envelope endpoints. Exceeded quotas return HTTP `429` with `RATE_LIMITED`, retry metadata, and no external dependency on Redis.
- **Server-authoritative contract APIs:** authenticated project, envelope, audit-persistence, and settlement endpoints, with tenant isolation and same-origin enforcement.
- **Tenant-scoped local cache:** profile, contracts, envelope, and cached ledger entries are namespaced by authenticated user ID and reconciled against server state on sign-in.

### Current implementation boundaries

These boundaries are intentional and should be considered when evaluating or extending the platform:

- The application uses **PayPal Sandbox** configuration only. Orders, Vault tokenization, webhooks, refunds, disputes, and production disbursement are not implemented.
- The milestone audit is a deterministic heuristic evaluator in `/api/agent/audit`; it is not a multimodal LLM vision service. A GitHub URL with no substantive deliverable text can pass the 85% gate.
- The AI stream is an assistant for negotiation and explanations. It cannot call the audit endpoint or execute a payout. It does not perform deliverable audits or write settlement records.
- Authentication, sessions, ledger events, projects, and budget envelopes use PostgreSQL. Production refuses to serve without `DATABASE_URL`; development and tests use an in-memory repository.
- Projects created through the API always start `ACTIVE`, with zero spend and pending milestones. Bootstrap sanitizes imported browser state and never trusts client audit scores, completion state, or spend totals.
- `/api/agent/audit` persists audit outcomes against the server milestone when project and milestone IDs are supplied. Settlement requires a server-recorded audit score of at least 85%.
- Settlement is atomic and idempotent for the same milestone. Duplicate or concurrent releases are rejected, and only the server settlement path can create `PAYOUT_EXECUTED` ledger events.
- Browser storage remains a cache. Server state is the authority after reconciliation; a modified client cannot forge balances, spend, audit state, or payouts.
- The platform does not custody funds and does not call PayPal from the settlement path. PayPal would remain a future external settlement rail.
- The AI stream remains advisory. It cannot invoke settlement or write ledger events.

---

## How a settlement works

1. **Create a contract** from the portfolio and select the outbound or inbound perspective.
2. **Define the envelope ceiling and milestones**, including acceptance criteria and milestone amounts.
3. **Submit a deliverable** from the project workspace. The audit endpoint validates payload size and sanitizes untrusted text.
4. **Receive an audit result** containing a confidence score, risk level, rationale, and settlement mode.
5. **Record the server audit outcome.** When project and milestone IDs are supplied, a passing audit updates the server milestone to `AUDITED_PENDING_APPROVAL` with its score, rationale, proof, and approval requirement.
6. **Release the milestone.** The server revalidates contract status, kill-switch, milestone audit state, amount, and budget ceilings. A successful release atomically marks the milestone complete, increments project and envelope spend, and writes a deduplicated `PAYOUT_EXECUTED` record with a deterministic server event ID. No PayPal request is made.
7. **Refresh the ledger.** The workspace reconciles the returned project, envelope, and settlement event into its cache.

### Guardrail thresholds

| Control | Behavior |
| :--- | :--- |
| Audit confidence | Scores below 85% are rejected and the escrow remains locked. |
| Autonomous settlement | Releases up to $1,000 USD are eligible for autonomous settlement after a passing audit. |
| Human authorization | Amounts above $1,000 USD return `HUMAN_APPROVAL_REQUIRED` and require an explicit workspace action. |
| Payload limit | Deliverable text is capped at 12,000 characters. |
| Kill-switch | Server envelope state blocks audits and settlement. |
| Contract freeze | A paused contract blocks audits and settlement. |
| Budget ceiling | Settlement cannot exceed the project's remaining budget, the per-transaction ceiling, or the daily ceiling. |
| Duplicate release | A completed milestone cannot be settled again; the server event ID is deterministic per milestone. |

---

## Architecture at a glance

```text
Browser (Next.js App Router client)
  Auth screen / Portfolio / Workspace / Agent Chat / AG Grid ledger
  Tenant-scoped localStorage cache: profile, projects, envelope, cached logs
  Server reconciliation on sign-in
  AgentChat: negotiation only; no settlement client
        |
        | /api/auth/*  /api/projects/*  /api/envelope  /api/ledger/events
        | /api/agent/stream  /api/agent/audit
        v
Next.js route handlers
  Opaque session cookies + CSRF origin validation
  GuardrailEnforcer + deterministic audit
  Server-authoritative projects and budget envelopes
  Atomic milestone settlement + deduplicated ledger event
  No external payout route
        |
        +--> PostgreSQL: users, sessions, projects, envelopes, ledger events
        |
        | No server-to-PayPal payout call in the current implementation
        v
PayPal Sandbox REST API (reserved client code; not called at runtime)
```

Key implementation files:

- `src/app/page.tsx` — session gate, tenant-scoped hydration, server reconciliation, contract creation, freeze handling, and settlement.
- `src/components/AuthScreen.tsx` — sign-in and invite-gated account creation.
- `src/components/ProjectPortfolioView.tsx` — dual swimlanes and portfolio cards.
- `src/components/ProjectWorkspaceView.tsx` — milestones, audit submission, and client-authorized settlement.
- `src/components/AgentChat.tsx` — negotiation assistant and pre-settlement guard checks.
- `src/components/CommandCenter.tsx` — AG Grid transaction ledger.
- `src/lib/guardrails/enforcer.ts` — budget, audit, sanitization, and payload rules.
- `src/lib/auth/session.ts` — session lifecycle, cookie options, and origin validation.
- `src/lib/auth/password.ts` — scrypt hashing and timing-resistant verification.
- `src/lib/db/repository.ts` — PostgreSQL schema, projects/envelopes, atomic settlement, ledger, and in-memory test adapter.
- `src/lib/settlement/settlement.ts` — server settlement rules, deterministic IDs, and payout-record construction.
- `src/lib/validation/project.ts` — project, envelope, bootstrap, and update schemas.
- `src/lib/paypal/client.ts` — PayPal OAuth and payout client code; not imported by the runtime UI.
- `src/lib/ledger.ts` — legacy local settled-balance helper used by client-side tests and migration paths.
- `src/app/api/auth/*` — register, login, logout, and session endpoints.
- `src/app/api/projects/*` — project list/create, bootstrap, freeze/criteria updates, and milestone settlement.
- `src/app/api/envelope/route.ts` — server budget-envelope read/update.
- `src/app/api/ledger/events/route.ts` — authenticated, tenant-scoped durable ledger endpoint.
- `src/app/api/agent/audit/route.ts` — deterministic audit endpoint with server audit persistence.
- `src/app/api/agent/stream/route.ts` — streamed AI assistant endpoint.

For detailed component boundaries and flows, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Documentation

| Document | Scope |
| :--- | :--- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System components, data flows, roles, guardrails, and persistence |
| [TECHNICAL_ARCHITECTURE_AND_DEVOPS.md](TECHNICAL_ARCHITECTURE_AND_DEVOPS.md) | Stack, API contracts, AI provider, build, and deployment |
| [SECURITY.md](SECURITY.md) | Trust boundaries, financial controls, and security limitations |
| [COMPLIANCE.md](COMPLIANCE.md) | Non-custodial design, settlement governance, and production requirements |
| [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) | Data inventory, storage, AI transmission, and retention |
| [ETHICS_AND_RESPONSIBLE_AI.md](ETHICS_AND_RESPONSIBLE_AI.md) | Human oversight, transparency, and responsible AI boundaries |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Visual language, layout, status states, and component behavior |
| [BUSINESS_MODEL.md](BUSINESS_MODEL.md) | Account tiers, commercial model, and monetization strategy |
| [TESTING.md](TESTING.md) | Test inventory, commands, and coverage boundaries |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [E2E_DUAL_ROLE_GRID_TEST_PLAN.md](E2E_DUAL_ROLE_GRID_TEST_PLAN.md) | Manual end-to-end verification plan |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Local setup, conventions, and contribution workflow |
| [NEXT_SESSION_TASKS.md](NEXT_SESSION_TASKS.md) | Current roadmap and launch checklist |

---

## Quick start

### Prerequisites

- Node.js 20 (see `.nvmrc`)
- npm
- A PayPal Developer Sandbox account
- Optional: an OpenAI, OpenRouter, or Google Gemini API key for the AI assistant

### Install and run

```bash
git clone https://github.com/Marce-Inda/agentipay-ai.git
cd agentipay-ai
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Optional | Public PayPal client ID available to the browser build; not used by the runtime UI. |
| `PAYPAL_CLIENT_ID` | Optional | Server-side client ID alias used when the public variable is absent. |
| `PAYPAL_CLIENT_SECRET` | For live Sandbox calls | Server-only PayPal OAuth secret. Never expose to the client. |
| `PAYPAL_ENVIRONMENT` | Optional | `sandbox` (default) or `production`. The current implementation is validated against Sandbox. |
| `OPENAI_API_KEY` | Optional | OpenAI-compatible provider key. |
| `OPENROUTER_API_KEY` | Optional | OpenRouter key; when present, the provider uses the OpenRouter base URL. |
| `GEMINI_API_KEY` | Optional | Gemini fallback provider key. |
| `AI_MODEL_NAME` | Optional | Primary model name. Default: `openai/gpt-4o-mini`. |
| `AI_FALLBACK_MODEL_NAME` | Optional | Fallback model name. Default: `meta-llama/llama-3.3-70b-instruct`. |
| `NEXT_PUBLIC_APP_URL` | Optional | Public application URL used by deployment tooling. |
| `DATABASE_URL` | Production | PostgreSQL connection string for users, sessions, projects, envelopes, and ledger events. |
| `DATABASE_SSL` | Optional | Set `true` for managed PostgreSQL providers that require TLS. |
| `DATABASE_POOL_MAX` | Optional | Maximum PostgreSQL pool size. Default: `5`. |
| `APP_ORIGIN` | Production | Canonical public origin used for same-origin request validation. |
| `REGISTRATION_ENABLED` | Optional | Set `false` to disable new account creation. Default: enabled. |
| `REGISTRATION_INVITE_CODE` | Production | Invite code required for account creation. |

The PayPal client is retained for future server-side integration but is not called by the runtime UI or settlement path. No real funds move. A server-side payout route is required before live Sandbox settlement can be verified.

### Available scripts

```bash
npm run dev            # Next.js development server
npm run build          # Production build (webpack)
npm run build:dev      # Production build with Turbopack
npm start              # Start the production server
npm test               # Jest test suite
npm run test:watch     # Jest watch mode
npm run test:coverage  # Jest coverage report
npx tsc --noEmit       # TypeScript validation
```

There are no `lint` or `format` scripts in this repository. Follow the existing TypeScript and component conventions.

---

## Testing

The current suite contains 12 Jest suites and 118 passing checks covering the guardrail enforcer, PayPal client, audit route and persistence, stream route, ledger helper, password hashing, repository isolation, project bootstrap, envelope preservation, atomic settlement, process-local rate limiting, ledger validation, and authenticated ledger/project APIs.

```bash
npm test -- --runInBand
npx tsc --noEmit
npm run build
```

See [TESTING.md](TESTING.md) for the full inventory and coverage boundaries.

---

## Deployment

The repository includes a Dockerfile and a Render blueprint. `render.yaml` builds the Dockerfile and exposes the service on port 3000 with a health check at `/`.

```bash
docker build -t agenticpay-ai .
docker run --env-file .env.local -p 3000:3000 agenticpay-ai
```

`render.yaml` provisions a PostgreSQL database and injects `DATABASE_URL`. Set `APP_ORIGIN` and `REGISTRATION_INVITE_CODE` in the Render dashboard. For other hosts, provide a managed PostgreSQL instance and the same environment variables. Do not commit secret values.

GitHub Actions runs the test suite and production build on pushes and pull requests to `main` via `.github/workflows/ci.yml`.

---

## Security

- AI provider keys and `PAYPAL_CLIENT_SECRET` are server-only. The PayPal client is not used by the runtime UI, and no external payout route currently exists.
- Financial decisions are made by deterministic TypeScript code, not by the language model. Projects, envelopes, audit state, budgets, and settlement are server-authoritative.
- Deliverable input is bounded and sanitized before evaluation. A GitHub URL can contribute high-confidence evidence, so production deployments should add independent artifact verification.
- Authentication uses scrypt password hashes, opaque HttpOnly sessions, and same-origin checks. Production registration requires an invite code.
- LLM and transactional endpoints use process-local fixed-window quotas. This keeps Render free-tier deployment self-contained; counters reset on spin-down and are not shared across instances.
- Kill-switch, contract freeze, audit status, and all budget ceilings are rechecked atomically by the server before settlement.
- Browser storage remains a tenant-scoped cache and is not encrypted at rest. Shared-device use requires explicit sign-out.
- No funds move externally. Connect a reviewed server-side payout adapter and reconciliation controls before treating settlement records as payment instructions.

See [SECURITY.md](SECURITY.md) for the full trust model.

---

## License

MIT. See [LICENSE](LICENSE).
