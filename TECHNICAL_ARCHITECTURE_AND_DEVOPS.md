# Technical Architecture and DevOps

This document describes the implementation stack, API contracts, AI provider behavior, build process, and deployment topology for AgenticPay AI.

---

## 1. Stack

| Layer | Technology |
| :--- | :--- |
| Framework | Next.js `16.4.0`, App Router |
| UI | React `19.3.0`, Tailwind CSS `3.4`, Lucide icons |
| Language | TypeScript 5, strict mode |
| Data grid | AG Grid Community `36.2` |
| AI SDK | Vercel AI SDK `6`, `@ai-sdk/openai`, `@ai-sdk/google` |
| Validation | Zod `4.6` |
| Tests | Jest `29.7`, ts-jest |
| Runtime | Node.js 20 |
| Deployment | Docker, Render web service |

The application is a modular monolith. Route handlers contain server-side orchestration; client components own interactive state.

---

## 2. Route contracts

### `POST /api/agent/stream`

Purpose: streamed AI negotiation assistant.

Request body:

```json
{
  "prompt": "string",
  "maxBudgetUSD": 100,
  "targetAmount": 75,
  "projectName": "Contract name",
  "vendorEmail": "vendor@example.com",
  "envelope": {
    "maxPerTransactionUSD": 100,
    "dailyCeilingUSD": 1000,
    "spentTodayUSD": 0,
    "activeEscrowUSD": 0,
    "killSwitchActive": false
  }
}
```

Behavior:

- Returns `400` when `prompt` is missing.
- Sanitizes the prompt with `GuardrailEnforcer.sanitizePromptInput`.
- Validates the target amount against the envelope supplied in the request body.
- Returns `422` with `allowed: false` when the budget check fails.
- Streams plain text from the primary model.
- Attempts the fallback model if the primary call throws before streaming starts. Failures after the response has started are not recovered.

The route does not execute payouts. It also has no authentication, no rate limiting, and trusts `envelope`, `maxBudgetUSD`, and `killSwitchActive` from the caller. There is no demonstrated output-token cap.

### `POST /api/agent/audit`

Purpose: deterministic milestone deliverable audit.

Request body:

```json
{
  "deliverableText": "string",
  "deliverableUrl": "https://github.com/org/repo/pull/42",
  "expectedRequirements": "string",
  "milestoneTitle": "Phase 1",
  "milestoneAmountUSD": 250,
  "envelope": {
    "killSwitchActive": false
  }
}
```

Responses:

| Status | Condition | Key fields |
| :--- | :--- | :--- |
| `200` | Audit evaluated | `success`, `auditConfidenceScore`, `reason`, `riskLevel`, `settlementMode`, `requiresHumanApproval`, `idempotencyKey`, optional `simulatedBatchId` |
| `400` | No deliverable text or URL | `error` |
| `423` | Kill-switch active | `settlementMode: "REJECTED"`, `riskLevel: "CRITICAL"`, `requiresHumanApproval: true` |
| `500` | Unexpected failure | `error` |

The audit is deterministic. It does not call an LLM, inspect images, or move funds. A GitHub or pull-request URL receives a score of 91 or higher even when `deliverableText` is empty. Other non-empty deliverables receive 86. The route is unauthenticated and reads the kill-switch from the request body.

The `idempotencyKey` is generated per request. `simulatedBatchId` is not a PayPal batch ID. The route does not create a payout.

---

## 3. AI provider behavior

`src/lib/ai/provider.ts` selects a provider in this order:

1. **OpenAI or OpenRouter** when `OPENAI_API_KEY` or `OPENROUTER_API_KEY` is present.
   - OpenRouter base URL is used when `OPENROUTER_API_KEY` is set.
   - Primary model: `AI_MODEL_NAME`, default `openai/gpt-4o-mini`.
   - Fallback model: `AI_FALLBACK_MODEL_NAME`, default `meta-llama/llama-3.3-70b-instruct`.
2. **Gemini** when `GEMINI_API_KEY` is present and no OpenAI-compatible key exists.
   - Model: `gemini-1.5-flash`.
3. **Default OpenAI client** when no key is configured. This will fail at request time without valid credentials.

The fallback is attempted only when the primary streaming call throws. The current implementation does not retry after a partial stream.

---

## 4. Client state and persistence

`src/app/page.tsx` owns:

- `currentProfile`
- `projects`
- `envelope`
- `logs`

On mount, it reads versioned `localStorage` keys. On change, it writes them back after hydration. The ledger update is centralized in `applyTransactionLogToProjects`:

- Only `PAYOUT_EXECUTED` logs with a positive, finite amount update `spentUSD`.
- Each applied payout log increments the matching project. Repeated application of the same log ID is not deduplicated and double-counts the amount.

The workspace release path emits a local `PAYOUT_EXECUTED` log without calling PayPal. The agent chat is negotiation-only; it does not call the audit endpoint or record settlements.

---

## 5. Build and scripts

| Command | Behavior |
| :--- | :--- |
| `npm run dev` | Next.js development server |
| `npm run build` | Production build with webpack |
| `npm run build:dev` | Production build with Turbopack |
| `npm start` | Start the production server |
| `npm test` | Jest |
| `npm run test:watch` | Jest watch mode |
| `npm run test:coverage` | Jest coverage |
| `npx tsc --noEmit` | TypeScript validation |

There is no lint or format script. TypeScript strict mode and existing component conventions are the source of truth.

---

## 6. DevOps

### Docker

```bash
docker build -t agenticpay-ai .
docker run --env-file .env.local -p 3000:3000 agenticpay-ai
```

`Dockerfile`:

- `node:20-alpine`
- `npm ci`
- `npm run build`
- `next start` on port 3000
- `HOSTNAME=0.0.0.0`

### Render

`render.yaml` defines:

- Docker environment
- `Dockerfile` at the repository root
- Port `3000`
- Health check path `/`
- `NODE_ENV=production`

Configure PayPal and AI credentials in the Render dashboard. Do not commit secrets.

### Environment variables

| Variable | Used by | Notes |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | PayPal adapter configuration | Public client identifier; not used by the runtime UI. |
| `PAYPAL_CLIENT_ID` | PayPal adapter configuration | Server-side fallback identifier. |
| `PAYPAL_CLIENT_SECRET` | PayPal adapter tests/future route | Server-only secret. No runtime route currently consumes it. |
| `PAYPAL_ENVIRONMENT` | PayPal adapter | `sandbox` default; the production URL branch is not validated in this repository. |
| `OPENAI_API_KEY` | AI provider | OpenAI-compatible key. |
| `OPENROUTER_API_KEY` | AI provider | Enables the OpenRouter base URL. |
| `GEMINI_API_KEY` | AI provider | Gemini fallback when no OpenAI-compatible key exists. |
| `AI_MODEL_NAME` | AI provider | Primary model override. |
| `AI_FALLBACK_MODEL_NAME` | AI provider | Fallback model override. |
| `NEXT_PUBLIC_APP_URL` | Client/deployment | Public origin used by deployment tooling. |

### Operational checks

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
```

The repository does not include automated CI workflows. Add a pipeline before relying on merge gates.

---

## 7. Observability and failure handling

- Route handlers log unexpected failures to the server console.
- The PayPal client is not imported by the runtime UI; only unit tests exercise it.
- Workspace releases generate `SETTLE-*` references and local settlement payloads. They are not PayPal responses.
- The audit endpoint can return a `simulatedBatchId`, which is not a PayPal payment.
- Client-side `localStorage` failures fall back to in-memory defaults and log a warning.
- There is no centralized tracing, metrics, or error reporting service.

---

## 8. Production hardening backlog

The following items are required before multi-tenant production use:

1. Authentication, authorization, and tenant isolation.
2. Server-side persistence for contracts, milestones, and ledger events.
3. Immutable audit logging and export.
4. A server-side payout route that uses the PayPal secret and a stable idempotency key.
5. Ledger deduplication and reconciliation.
6. PayPal webhooks and reconciliation.
7. KYC/AML and sanctions screening where required.
8. Rate limiting and abuse controls at the API boundary.
9. Audit scoring that does not auto-pass URL-only deliverables.
10. Automated UI and end-to-end tests.
11. CI/CD with type, test, and build gates.
12. Secret rotation and environment separation.
13. Error monitoring and alerting.
