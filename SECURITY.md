# Security Policy and Financial Guardrails

AgenticPay AI combines AI-assisted negotiation with escrow settlement. The security model therefore separates **advisory AI** from **deterministic financial authority**.

---

## 1. Trust boundaries

| Boundary | Control |
| :--- | :--- |
| Browser to API | Route handlers validate request shape, require an authenticated session, enforce same-origin requests, and apply heuristic guardrails. Login and registration are rate-limited per process. |
| API to AI provider | Prompts are sanitized and sent server-side; provider keys never reach the browser. |
| Browser to PayPal | No browser-to-PayPal request path exists. The PayPal client is not imported by the runtime UI. |
| AI to settlement | The model cannot authorize or execute payouts. Settlement is revalidated and executed server-side against stored project, envelope, and audit state. |
| Client state | Browser storage is a tenant-scoped cache. Projects, envelopes, audits, and settlement are server-authoritative; client-submitted spend and completion state are ignored or sanitized. |
| Session state | Opaque 32-byte tokens are stored in an HttpOnly, SameSite=Lax cookie. PostgreSQL stores only SHA-256 token hashes; sessions expire after 12 hours. |
| Settlement execution | An authenticated, same-origin route atomically checks server state, records one deduplicated `PAYOUT_EXECUTED` event, and updates spend. No external PayPal request is sent. |

---

## 2. Financial controls

### Deterministic enforcement

`src/lib/guardrails/enforcer.ts` enforces:

- Positive transaction amounts.
- Per-transaction ceiling.
- Daily ceiling.
- Kill-switch state.
- Audit confidence threshold of 85%.
- Autonomous settlement cap of $1,000 USD.
- Deliverable payload limit of 12,000 characters.

The server settlement engine additionally enforces the project's remaining budget against stored state:

```text
amount <= project.budgetCapUSD - project.spentUSD
```

The client may pre-check for UX, but client-supplied spend, envelope, audit, and completion values are not trusted.

### Settlement modes

| Mode | Condition |
| :--- | :--- |
| `AUTONOMOUS` | Audit score >= 85% and amount <= $1,000 USD. |
| `HUMAN_APPROVAL_REQUIRED` | Audit score >= 85% and amount > $1,000 USD. |
| `REJECTED` | Score < 85%, invalid amount, budget breach, frozen contract, or active kill-switch. |

### Ledger integrity

Only the server settlement path can create `PAYOUT_EXECUTED`; the ledger validation schema and ledger API reject client-submitted payout events. Settlement runs under PostgreSQL row locks and inserts a deterministic event ID, so retries and concurrent releases cannot double-pay or double-count.

The settlement record is durable but does not call PayPal. The AI chat is a negotiation assistant; it does not display an audit score, submit deliverables, or record settlements.

### Emergency controls

- **Master kill-switch:** server envelope state blocks audit acceptance and settlement; a request-declared kill-switch also fails closed.
- **Contract freeze:** non-`ACTIVE` contract state blocks audit acceptance and settlement.
- **Human authorization:** required above the autonomous settlement cap and for `INCOMING` contracts.

These controls are backed by tenant-scoped server state. Authentication and same-origin validation are enforced at every financial route.

---

## 3. Blue Hat Hardening & Architecture Decisions

The implementation favors deterministic, server-side controls over trust in browser state. The following mitigations are active:

### Server-authoritative ledger and budget enforcement

- Projects, budget envelopes, audit results, and settlement are stored server-side per tenant.
- `POST /api/projects/bootstrap` sanitizes imported state: spend is reset, milestones become `PENDING`, and client-supplied audit evidence, approval state, and completion markers are discarded.
- The ledger API and validation layer reject client-submitted `PAYOUT_EXECUTED` events. Only the settlement route can create them.
- Settlement reloads project and envelope state under PostgreSQL row locks, revalidates the server audit score, status, and budget ceilings, then writes one deterministic, deduplicated ledger event.
- The browser is treated as a cache that reconciles from the server after authentication.

### Token depletion DoS protection

- Deliverable text is bounded to 12,000 characters before audit scoring or persistence.
- Artifact URLs are limited to 2,048 characters, and expected requirements are truncated before downstream use.
- Prompt streams are limited to 8,000 characters and 65,536 request bytes.
- AI output is capped at 1,024 tokens with a 45-second abort timeout.
- No deliverable content is sent to an LLM by the deterministic audit route.

These limits reduce prompt-injection payloads, oversized uploads, and attempts to exhaust model context or server memory.

### Endpoint rate limiting for cost protection

Rate limits are process-local fixed windows keyed by authenticated user ID. Exceeding a limit returns HTTP `429` with a descriptive JSON body and standard retry headers:

```json
{
  "error": "Too many AI negotiation requests. Please wait before trying again.",
  "code": "RATE_LIMITED",
  "retryAfterSeconds": 42,
  "limit": 20
}
```

| Endpoint | Limit |
| :--- | :--- |
| `POST /api/agent/stream` (LLM) | 20 requests / minute |
| `POST /api/agent/audit` | 30 requests / minute |
| Milestone settlement | 15 requests / minute |
| Ledger writes | 120 requests / minute |
| Project creation | 30 requests / minute |
| Project bootstrap | 5 requests / 15 minutes |
| Project updates | 60 requests / minute |
| Envelope updates | 60 requests / minute |
| Login | 20 per IP and 10 per email / 15 minutes |
| Registration | 5 per IP / 15 minutes |

Responses include `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. Rate-limit rejections emit a structured `RATE_LIMITED` security event without logging credentials or prompt content.

### CI pipeline and secret exclusion

- `.github/workflows/ci.yml` runs on pushes and pull requests to `main`.
- The pipeline uses read-only repository permissions, a single concurrency group, and SHA-pinned GitHub Actions.
- It runs `npm ci`, the full Jest suite, and a production Next.js build.
- `.env` variants are ignored except `.env.example`; private keys, keystores, secret files, and coverage output are also excluded.
- CI requires no PayPal, AI provider, or database secrets for unit tests and builds.

### Free-tier architectural tradeoffs

- **In-memory vs. distributed limiting:** The limiter intentionally uses process memory instead of Redis so the submission remains self-contained and deployable on Render's free tier without a paid add-on. Counters are not shared across instances and do not survive a restart.
- **Render spin-down:** Free web services can sleep after inactivity. A cold start or redeploy resets rate-limit buckets, so a determined attacker can regain quota after a restart. Durable financial state in PostgreSQL is unaffected.
- **Fixed windows:** Limits allow a short burst at a window boundary. This is acceptable for cost protection; use a sliding-window or token-bucket limiter if stricter shaping is required.
- **Scaling path:** Before horizontal scaling or handling real funds, move counters to Redis or enforce them at the edge proxy/API gateway so limits are shared and survive instance replacement.
- **Cold starts:** AI and settlement requests may be slower after spin-down. The server remains fail-closed for authentication, kill-switch, and budget checks during startup.

---

## 4. Prompt-injection defense

The audit and stream routes apply `sanitizePromptInput`, which replaces known patterns such as instruction overrides, role hijacking, budget overrides, and unauthorized payout commands with `[BLOCKED_INJECTION_ATTEMPT]`.

Audit deliverables are additionally:

1. Truncated to the payload limit.
2. Sanitized.
3. Wrapped in a `<deliverable_data>` block.

This is a pattern-based defense, not a complete prompt-injection solution. It should be complemented by model-level safeguards and adversarial testing in production.

---

## 5. Credential handling

- `PAYPAL_CLIENT_SECRET`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, and `GEMINI_API_KEY` are read server-side by route handlers where applicable.
- The browser receives `NEXT_PUBLIC_APP_URL`. The PayPal client is not imported by the runtime UI. `PAYPAL_CLIENT_SECRET` remains server-only.
- `.env`, `.env.local`, and `.env.production` are excluded from version control.
- No browser OAuth or payout request is made. Workspace releases write durable internal settlement records only.

Do not log authorization headers, access tokens, or full credential payloads.

---

## 6. PayPal scope

The current implementation:

- Contains PayPal Sandbox OAuth and `/v1/payments/payouts` code in `src/lib/paypal/client.ts`.
- Does not import or invoke that client from the runtime UI; only unit tests exercise it.
- Generates a `PayPal-Request-Id` header per call using the current timestamp and random values. It is not deterministic and does not prevent duplicate payouts.
- Records workspace releases as internal server settlement records without calling PayPal.
- Does not implement an external payout route, Orders, Vault tokenization, webhooks, refunds, or dispute handling.

The application does not store card numbers and is not designed to handle raw PAN data.

---

## 7. Known security limitations

The current implementation has authentication, tenant-scoped sessions, and durable ledger events, but it is still not ready for real funds without the following:

1. Role-based authorization and email verification/password recovery.
2. Durable, cross-instance rate limiting for authentication and AI routes.
3. PII detection and redaction before AI provider calls.
4. Secret rotation and environment separation.
5. PayPal webhook signature verification and reconciliation.
6. A server-side external payout adapter with PayPal idempotency and recovery handling.
7. An audit scorer that does not auto-pass GitHub URLs and verifies artifact ownership.
8. Live PostgreSQL concurrency and failover testing.
9. Independent security review and penetration testing.

Browser `localStorage` is a cache and can be modified by the user. It must not be treated as a source of truth for financial reconciliation; server reconciliation is authoritative.

---

## 8. Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Contact the maintainers directly with:

- A description of the issue.
- Reproduction steps.
- Affected route or component.
- Potential financial or data impact.
- Suggested mitigation, if available.

Please allow time for triage before public disclosure.
