# AgenticPay AI

> Enterprise escrow operations for autonomous service contracts, with deterministic financial guardrails and PayPal Sandbox payouts.

AgenticPay AI is a dual-perspective escrow workspace for organizations that both commission work and deliver work. It combines an AI negotiation assistant, deterministic settlement controls, milestone deliverable audits, and an inspectable transaction ledger.

---

## Overview

Service contracts often involve two operational roles:

- **Outbound escrow (Accounts Payable):** the organization hires a vendor, defines milestones, audits deliverables, and authorizes releases.
- **Inbound escrow (Accounts Receivable):** the organization delivers work to a client, tracks secured funds, and claims milestone settlements.

AgenticPay AI keeps both roles in one portfolio. It supports cascading subcontracting, where an incoming contract can fund a linked outgoing contract. Financial actions are evaluated by a non-AI TypeScript guardrail layer before any PayPal Sandbox payout is attempted.

### Core capabilities

- **Dual-perspective portfolio:** parallel outbound and inbound swimlanes with search, status filters, and focus modes.
- **Contract and milestone management:** escrow caps, vendor/client details, milestone acceptance criteria, deliverable proofs, and settlement state.
- **Deterministic settlement guardrails:** per-transaction and daily ceilings, remaining-project-budget checks, kill-switch enforcement, contract freeze, and a $1,000 USD autonomous settlement cap.
- **Milestone audit endpoint:** payload size limits, prompt-injection sanitization, isolated deliverable framing, confidence scoring, and human-approval escalation above the autonomous cap.
- **PayPal Sandbox payouts:** server-side OAuth and `/v1/payments/payouts` execution with idempotency keys. When the client ID is absent or set to `placeholder`, the client reports a simulated payout result and clearly marks the HTTP log.
- **AI negotiation assistant:** streamed responses through OpenAI/OpenRouter or Gemini, with a configurable fallback model.
- **AG Grid audit ledger:** transaction status, actor, risk level, audit confidence, settlement amount, and inspectable PayPal payloads.
- **Local persistence:** profile, contracts, envelope, and ledger are persisted in browser `localStorage` under versioned keys.

### Current implementation boundaries

These boundaries are intentional and should be considered when evaluating or extending the platform:

- The application uses **PayPal Sandbox Payouts** only. Orders, Vault tokenization, webhooks, and production disbursement are not implemented.
- The milestone audit is a deterministic heuristic evaluator in `/api/agent/audit`; it is not a multimodal LLM vision service.
- The AI stream is an assistant for negotiation and explanations. It cannot bypass the deterministic guardrails or execute a payout directly.
- Portfolio state is client-side and stored in `localStorage`. There is no authentication, database, or multi-user server persistence in the current implementation.
- The platform does not custody funds. PayPal remains the settlement rail.

---

## How a settlement works

1. **Create a contract** from the portfolio and select the outbound or inbound perspective.
2. **Define the escrow cap and milestones**, including acceptance criteria and milestone amounts.
3. **Submit a deliverable** from the project workspace. The audit endpoint validates payload size and sanitizes untrusted text.
4. **Receive an audit result** containing a confidence score, risk level, rationale, and settlement mode.
5. **Release the milestone** if the score is at least 85% and the amount is within the remaining project budget. Amounts above $1,000 USD require explicit human authorization.
6. **Record the outcome** in the transaction ledger. `PAYOUT_EXECUTED` is the only event that increments the project's settled amount through `applyTransactionLogToProjects` in `src/lib/ledger.ts`.

### Guardrail thresholds

| Control | Behavior |
| :--- | :--- |
| Audit confidence | Scores below 85% are rejected and the escrow remains locked. |
| Autonomous settlement | Releases up to $1,000 USD are eligible for autonomous settlement after a passing audit. |
| Human authorization | Amounts above $1,000 USD return `HUMAN_APPROVAL_REQUIRED` and require an explicit workspace action. |
| Payload limit | Deliverable text is capped at 12,000 characters. |
| Kill-switch | Active kill-switch blocks audit settlement and payout attempts. |
| Contract freeze | A paused outbound contract blocks milestone release. |
| Budget ceiling | A payout cannot exceed the project's remaining escrow budget. |

---

## Architecture at a glance

```text
Browser (Next.js App Router client)
  Portfolio / Workspace / Agent Chat / AG Grid ledger
  localStorage: profile, projects, envelope, logs
        |
        | POST /api/agent/stream        POST /api/agent/audit
        v
Next.js route handlers
  GuardrailEnforcer
  AI provider adapter
  Deterministic deliverable audit
        |
        | PayPal OAuth + /v1/payments/payouts
        v
PayPal Sandbox REST API
```

Key implementation files:

- `src/app/page.tsx` — application state, hydration, contract creation, freeze handling.
- `src/components/ProjectPortfolioView.tsx` — dual swimlanes, intake link, portfolio cards.
- `src/components/ProjectWorkspaceView.tsx` — milestones, audit submission, payout authorization.
- `src/components/AgentChat.tsx` — negotiation assistant and pre-payout guard checks.
- `src/components/CommandCenter.tsx` — AG Grid transaction ledger.
- `src/lib/guardrails/enforcer.ts` — budget, audit, sanitization, and payload rules.
- `src/lib/paypal/client.ts` — PayPal OAuth and payout client.
- `src/lib/ledger.ts` — single source of truth for settled project balances.
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
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | For live Sandbox calls | PayPal client ID exposed to the browser configuration. |
| `PAYPAL_CLIENT_ID` | Optional | Server-side client ID alias used when the public variable is absent. |
| `PAYPAL_CLIENT_SECRET` | For live Sandbox calls | Server-only PayPal OAuth secret. Never expose to the client. |
| `PAYPAL_ENVIRONMENT` | Optional | `sandbox` (default) or `production`. The current implementation is validated against Sandbox. |
| `OPENAI_API_KEY` | Optional | OpenAI-compatible provider key. |
| `OPENROUTER_API_KEY` | Optional | OpenRouter key; when present, the provider uses the OpenRouter base URL. |
| `GEMINI_API_KEY` | Optional | Gemini fallback provider key. |
| `AI_MODEL_NAME` | Optional | Primary model name. Default: `openai/gpt-4o-mini`. |
| `AI_FALLBACK_MODEL_NAME` | Optional | Fallback model name. Default: `meta-llama/llama-3.3-70b-instruct`. |
| `NEXT_PUBLIC_APP_URL` | Optional | Public application URL used by deployment tooling. |

If the PayPal client ID is missing or set to `placeholder`, the payout client runs in simulated mode and marks the generated payload log accordingly. A live payout requires both a client ID and a client secret. No real funds move in simulated mode.

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

- All PayPal and AI secrets are read server-side.
- Financial decisions are made by deterministic TypeScript code, not by the language model.
- Deliverable input is bounded and sanitized before evaluation.
- The kill-switch and contract freeze are checked before settlement.
- The current client-side persistence model is suitable for controlled evaluation, not for multi-tenant production use without authentication and server-side persistence.

See [SECURITY.md](SECURITY.md) for the full trust model.

---

## License

MIT. See [LICENSE](LICENSE).
