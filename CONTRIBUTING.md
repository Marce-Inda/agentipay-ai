# Contributing to AgenticPay AI

Thank you for contributing. This project uses a deterministic financial guardrail layer, so changes that affect settlement behavior require explicit tests and review.

---

## 1. Prerequisites

- Node.js 20 (`.nvmrc`)
- npm
- Git
- Optional: PayPal Developer Sandbox credentials
- Optional: OpenAI, OpenRouter, or Gemini API key

---

## 2. Local setup

```bash
git clone https://github.com/Marce-Inda/agentipay-ai.git
cd agentipay-ai
npm install
cp .env.example .env.local
```

Set the variables you need in `.env.local`. Never commit `.env.local`, `.env.production`, or any credential file.

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If the browser has no PayPal client ID, the chat's PayPal client returns a simulated result. If a client ID is present, the browser still cannot read `PAYPAL_CLIENT_SECRET`, so OAuth fails. Workspace releases do not call PayPal. A live payout requires a new server-side route. The AI assistant requires a valid provider key.

---

## 3. Validation before submitting

Run all three checks:

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
```

There is no `lint` or `format` script. Match the existing TypeScript style, keep components typed, and avoid introducing new dependencies without justification.

---

## 4. Engineering conventions

### Financial logic

- Financial decisions must remain deterministic TypeScript. Do not move budget, threshold, freeze, kill-switch, or payout eligibility decisions into an LLM prompt.
- Keep `AUTONOMOUS_SETTLEMENT_CAP_USD` and `MAX_DELIVERABLE_PAYLOAD_LENGTH` centralized in `src/lib/guardrails/enforcer.ts`.
- Route all settled-amount updates through `applyTransactionLogToProjects`. Only `PAYOUT_EXECUTED` may increment `spentUSD`, and the helper currently does not deduplicate repeated log IDs.
- Check both the envelope limits and the project's remaining budget before recording a settlement.
- Do not add a client-side PayPal call and describe it as live. The secret must remain server-side; add a server route before claiming payout execution.
- Do not log secrets, OAuth tokens, or full credential payloads.

### Client state

- Preserve the hydration guard in `src/app/page.tsx`; do not write to `localStorage` before hydration completes.
- Keep versioned storage keys unless you add a migration path.
- Do not reintroduce account session switching. Account type and contract perspective are separate concepts.

### AI integration

- The AI assistant is advisory. It must not execute payouts.
- Sanitize untrusted input before sending it to a provider.
- Keep provider credentials server-side.
- Preserve the primary/fallback provider behavior unless a replacement is fully tested.

### UI terminology

Use production fintech language:

- Outbound Escrow / Accounts Payable
- Inbound Escrow / Accounts Receivable
- Client (Escrow Funder)
- Contractor (Escrow Beneficiary)
- Escrow Cap, Settled, Claimed
- Audit Confidence, Risk Level, Settlement Mode

Avoid placeholder, demo, or temporary language in user-facing components.

---

## 5. Commit conventions

Use Conventional Commits:

```text
feat: add milestone budget guard
fix: preserve zero balance during ledger hydration
docs: reconcile architecture with implemented routes
test: cover kill-switch rejection in audit route
refactor: centralize settlement threshold checks
```

Keep commits scoped. Do not mix documentation and behavioral changes unless they are inseparable.

---

## 6. Pull request checklist

- [ ] TypeScript validation passes.
- [ ] Jest suite passes.
- [ ] Production build passes.
- [ ] Financial behavior has tests.
- [ ] No secrets or environment files are included.
- [ ] Documentation is updated when routes, thresholds, environment variables, or workflows change.
- [ ] User-facing terminology follows the conventions above.

---

## 7. Security

Report vulnerabilities privately rather than opening a public issue. See [SECURITY.md](SECURITY.md).

Use PayPal Sandbox credentials only. Do not test with production credentials or real funds.
