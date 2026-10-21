# AgenticPay AI

> Enterprise escrow operations workspace for autonomous service contracts, with deterministic financial guardrails and a PayPal Sandbox payout adapter that is not yet wired to live settlement.

AgenticPay AI is a dual-perspective escrow workspace for organizations that both commission work and deliver work. It combines an AI negotiation assistant, deterministic settlement controls, milestone deliverable audits, and an inspectable transaction ledger.

> [!IMPORTANT]
> **Implementation status (audit date: 2026-10-20).** The portfolio, milestone management, guardrail rules, deterministic audit endpoint, and AG Grid ledger are implemented. Settlement is not operational end to end: workspace releases record local `PAYOUT_EXECUTED` events with generated `SETTLE-*` identifiers and do not call PayPal. The PayPal Sandbox client exists but is not imported by the runtime UI. There is no authentication, rate limiting, server-side persistence, or server-authoritative payment route.

---

## Overview

Service contracts often involve two operational roles:

- **Outbound escrow (Accounts Payable):** the organization hires a vendor, defines milestones, audits deliverables, and authorizes releases.
- **Inbound escrow (Accounts Receivable):** the organization delivers work to a client, tracks the contract's declared value, and records milestone settlements locally.

AgenticPay AI keeps both roles in one portfolio. It supports subcontract metadata, where an incoming contract can reference a linked outgoing contract. No funds are transferred between them. Financial actions are evaluated by a non-AI TypeScript guardrail layer before a settlement record is written. The current workspace release path does not make a PayPal request.

### Core capabilities

- **Dual-perspective portfolio:** parallel outbound and inbound swimlanes with search, status filters, and focus modes.
- **Contract and milestone management:** contract envelope ceilings, vendor/client details, milestone acceptance criteria, deliverable proofs, and settlement state.
- **Deterministic settlement guardrails:** per-transaction and daily ceilings, remaining-project-budget checks, kill-switch enforcement, contract freeze, and a $1,000 USD autonomous settlement cap.
- **Milestone audit endpoint:** payload size limits, prompt-injection sanitization, isolated deliverable framing, heuristic confidence scoring, and human-approval escalation above the autonomous cap. GitHub and pull-request URLs are automatically treated as high-confidence evidence.
- **PayPal Sandbox client (not operational end to end):** OAuth and `/v1/payments/payouts` logic exists in `src/lib/paypal/client.ts`, with a simulated mode. The client is not imported by the current UI, and workspace releases do not call it. A server-side payout route is required before live Sandbox settlement can be verified.
- **AI negotiation assistant:** streamed responses through OpenAI/OpenRouter or Gemini, with a configurable fallback model.
- **AG Grid audit ledger:** transaction status, actor, risk level, audit confidence, settlement amount, and inspectable local or server-returned payloads.
- **Local persistence:** profile, contracts, envelope, and ledger are persisted in browser `localStorage` under versioned keys.

### Current implementation boundaries

These boundaries are intentional and should be considered when evaluating or extending the platform:

- The application uses **PayPal Sandbox** configuration only. Orders, Vault tokenization, webhooks, refunds, disputes, and production disbursement are not implemented.
- The milestone audit is a deterministic heuristic evaluator in `/api/agent/audit`; it is not a multimodal LLM vision service. A GitHub URL with no substantive deliverable text can pass the 85% gate.
- The AI stream is an assistant for negotiation and explanations. It cannot call the audit endpoint or execute a payout. It does not perform deliverable audits or write settlement records.
- Portfolio state is client-side and stored in `localStorage`. There is no authentication, database, or multi-user server persistence in the current implementation.
- `/api/agent/stream` and `/api/agent/audit` are unauthenticated, have no rate limiting, and trust budget and kill-switch fields supplied in the request body.
- The platform does not custody funds. PayPal would remain the settlement rail once a server-side payout route is implemented.
- Idempotency keys are generated per request. They do not provide retry safety or duplicate-payment prevention.

---

## How a settlement works

1. **Create a contract** from the portfolio and select the outbound or inbound perspective.
2. **Define the envelope ceiling and milestones**, including acceptance criteria and milestone amounts.
3. **Submit a deliverable** from the project workspace. The audit endpoint validates payload size and sanitizes untrusted text.
4. **Receive an audit result** containing a confidence score, risk level, rationale, and settlement mode.
5. **Release the milestone** if the score is at least 85% and the amount is within the remaining project budget. Amounts above $1,000 USD require explicit human authorization.
6. **Record the outcome** in the transaction ledger. The workspace marks the milestone complete and writes a local `PAYOUT_EXECUTED` event with a generated `SETTLE-*` identifier. No PayPal request is made. `applyTransactionLogToProjects` increments the project's settled amount for each such log and does not deduplicate repeated log IDs.

### Guardrail thresholds

| Control | Behavior |
| :--- | :--- |
| Audit confidence | Scores below 85% are rejected and the escrow remains locked. |
| Autonomous settlement | Releases up to $1,000 USD are eligible for autonomous settlement after a passing audit. |
| Human authorization | Amounts above $1,000 USD return `HUMAN_APPROVAL_REQUIRED` and require an explicit workspace action. |
| Payload limit | Deliverable text is capped at 12,000 characters. |
| Kill-switch | Client state blocks milestone release. The audit route also honors a kill-switch flag sent in its request body. |
| Contract freeze | A paused outbound contract blocks milestone release. |
| Budget ceiling | A payout cannot exceed the project's remaining escrow budget. |

---

## Architecture at a glance

```text
Browser (Next.js App Router client)
  Portfolio / Workspace / Agent Chat / AG Grid ledger
  localStorage: profile, projects, envelope, logs
  Workspace: records local PAYOUT_EXECUTED events
  AgentChat: negotiation only; no payout client
        |
        | POST /api/agent/stream        POST /api/agent/audit
        v
Next.js route handlers
  GuardrailEnforcer
  AI provider adapter
  Deterministic heuristic deliverable audit
  No payout route
        |
        | No server-to-PayPal payout call in the current implementation
        v
PayPal Sandbox REST API (client code only; not operational end to end)
```

Key implementation files:

- `src/app/page.tsx` — application state, hydration, contract creation, freeze handling.
- `src/components/ProjectPortfolioView.tsx` — dual swimlanes and portfolio cards.
- `src/components/ProjectWorkspaceView.tsx` — milestones, audit submission, and client-authorized settlement.
- `src/components/AgentChat.tsx` — negotiation assistant and pre-settlement guard checks.
- `src/components/CommandCenter.tsx` — AG Grid transaction ledger.
- `src/lib/guardrails/enforcer.ts` — budget, audit, sanitization, and payload rules.
- `src/lib/paypal/client.ts` — PayPal OAuth and payout client code; not imported by the runtime UI.
- `src/lib/ledger.ts` — settled-balance helper; increments for each `PAYOUT_EXECUTED` log without deduplication.
- `src/app/api/agent/audit/route.ts` — deterministic audit endpoint.
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

The PayPal client is retained for future server-side integration but is not called by the UI or workspace release path. No real funds move. A server-side payout route is required before live Sandbox settlement can be verified.

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

The current suite contains five Jest suites and 58 passing checks covering the guardrail enforcer, PayPal client, audit route, stream route, and ledger helper.

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

For Render, configure the required PayPal and AI environment variables in the service dashboard. Do not commit secret values.

---

## Security

- AI provider keys and `PAYPAL_CLIENT_SECRET` are server-only. The PayPal client is not used by the runtime UI, and no server payout route currently exists.
- Financial decisions are made by deterministic TypeScript code, not by the language model. Some checks execute in the browser, so server-authoritative settlement is not yet implemented.
- Deliverable input is bounded and sanitized before evaluation. The audit endpoint can be bypassed with a GitHub URL and is unauthenticated.
- The kill-switch and contract freeze are checked before a local settlement record is written.
- The current client-side persistence model is suitable for controlled evaluation, not for multi-tenant production use without authentication and server-side persistence.

See [SECURITY.md](SECURITY.md) for the full trust model.

---

## License

MIT. See [LICENSE](LICENSE).
