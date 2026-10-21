# Security Policy and Financial Guardrails

AgenticPay AI combines AI-assisted negotiation with escrow settlement. The security model therefore separates **advisory AI** from **deterministic financial authority**.

---

## 1. Trust boundaries

| Boundary | Control |
| :--- | :--- |
| Browser to API | Route handlers validate request shape and apply heuristic guardrails. They do not authenticate callers or rate-limit requests. |
| API to AI provider | Prompts are sanitized and sent server-side; provider keys never reach the browser. |
| Browser to PayPal | No browser-to-PayPal request path exists. The PayPal client is not imported by the runtime UI. |
| AI to settlement | The model cannot authorize or execute payouts. Settlement requires deterministic checks and a workspace action, but those checks are not server-authoritative. |
| Client state | Portfolio state is stored in `localStorage` and is not trusted as an authoritative ledger. |
| Settlement execution | The workspace records local `PAYOUT_EXECUTED` events with generated batch IDs; no PayPal request is sent. |

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

The workspace and agent chat additionally enforce the project's remaining budget:

```text
amount <= project.budgetCapUSD - project.spentUSD
```

### Settlement modes

| Mode | Condition |
| :--- | :--- |
| `AUTONOMOUS` | Audit score >= 85% and amount <= $1,000 USD. |
| `HUMAN_APPROVAL_REQUIRED` | Audit score >= 85% and amount > $1,000 USD. |
| `REJECTED` | Score < 85%, invalid amount, budget breach, frozen contract, or active kill-switch. |

### Ledger integrity

`applyTransactionLogToProjects` is the only helper that increments `spentUSD`. It accepts only `PAYOUT_EXECUTED` logs with a positive finite amount. It processes each log passed to it and does not deduplicate repeated log IDs, so applying the same log twice double-counts the settled amount.

The workspace emits a local `PAYOUT_EXECUTED` log without calling PayPal. The AI chat is a negotiation assistant; it does not display an audit score, submit deliverables, or record settlements.

### Emergency controls

- **Master kill-switch:** blocks milestone release in the client. The audit route also honors a `killSwitchActive` value supplied in the request body.
- **Contract freeze:** blocks releases for a specific outbound contract.
- **Human authorization:** required above the autonomous settlement cap.

These controls are not backed by server-side account state or authentication.

---

## 3. Prompt-injection defense

The audit and stream routes apply `sanitizePromptInput`, which replaces known patterns such as instruction overrides, role hijacking, budget overrides, and unauthorized payout commands with `[BLOCKED_INJECTION_ATTEMPT]`.

Audit deliverables are additionally:

1. Truncated to the payload limit.
2. Sanitized.
3. Wrapped in a `<deliverable_data>` block.

This is a pattern-based defense, not a complete prompt-injection solution. It should be complemented by model-level safeguards and adversarial testing in production.

---

## 4. Credential handling

- `PAYPAL_CLIENT_SECRET`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, and `GEMINI_API_KEY` are read server-side by route handlers where applicable.
- The browser receives `NEXT_PUBLIC_APP_URL`. The PayPal client is not imported by the runtime UI. `PAYPAL_CLIENT_SECRET` remains server-only.
- `.env`, `.env.local`, and `.env.production` are excluded from version control.
- No browser OAuth or payout request is made. Workspace releases write local settlement records only.

Do not log authorization headers, access tokens, or full credential payloads.

---

## 5. PayPal scope

The current implementation:

- Contains PayPal Sandbox OAuth and `/v1/payments/payouts` code in `src/lib/paypal/client.ts`.
- Does not import or invoke that client from the runtime UI; only unit tests exercise it.
- Generates a `PayPal-Request-Id` header per call using the current timestamp and random values. It is not deterministic and does not prevent duplicate payouts.
- Records workspace releases locally without calling PayPal.
- Does not implement a server payout route, Orders, Vault tokenization, webhooks, refunds, or dispute handling.

The application does not store card numbers and is not designed to handle raw PAN data.

---

## 6. Known security limitations

The current implementation is suitable for controlled evaluation, not multi-tenant production use, without the following:

1. Authentication and role-based authorization.
2. Server-side persistence and immutable audit logs.
3. Tenant isolation and request rate limiting.
4. CSRF and abuse protection at the API boundary.
5. PII detection and redaction before AI provider calls.
6. Secret rotation and environment separation.
7. PayPal webhook signature verification and reconciliation.
8. A server-authoritative payout route that uses the PayPal secret.
9. Deduplication of ledger events and deterministic idempotency keys.
10. An audit scorer that does not auto-pass GitHub URLs.
11. Independent security review and penetration testing.

Browser `localStorage` can be modified by the user. It must not be treated as a source of truth for financial reconciliation.

---

## 7. Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Contact the maintainers directly with:

- A description of the issue.
- Reproduction steps.
- Affected route or component.
- Potential financial or data impact.
- Suggested mitigation, if available.

Please allow time for triage before public disclosure.
