# End-to-End Verification Plan

This plan verifies the implemented dual-perspective portfolio, milestone audit, guardrails, server-authoritative settlement, and AG Grid ledger. It replaces the earlier role-switching test plan; account type and contract perspective are independent, and there is no in-app role switch.

> [!IMPORTANT]
> Settlement dispatches through the server-side PayPal Payouts executor. With `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET` configured, a release calls the PayPal Sandbox Payouts API and records the real `payout_batch_id`. Without credentials, the rail fails closed: the release records an honest simulated or suppressed ledger entry, without claiming a Sandbox payment. Verify both modes before relying on either.

---

## 1. Scope

Covered:

- Contract creation for the outbound perspective and rendering of both perspectives.
- Portfolio and workspace navigation.
- Deliverable audit and confidence result.
- Autonomous settlement recording at or below $1,000 USD.
- Human authorization above $1,000 USD.
- Contract freeze, kill-switch, and remaining-budget blocks.
- Subcontract badge and parent mandate display.
- Ledger updates and payload inspection.
- Browser persistence after refresh.

Not covered:

- Authentication, multi-user access, or tenant isolation.
- Live verified PayPal Sandbox disbursement; the `/settle` payout flow is covered against a mocked PayPal endpoint.
- Automated browser testing.
- Load, concurrency, or accessibility certification.

---

## 2. Environment

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

For an isolated test pass, clear these browser keys before starting:

- `agenticpay_profile_v2`
- `agenticpay_projects_v2`
- `agenticpay_envelope_v2`
- `agenticpay_logs_v2`

The payout executor is server-side only. With credentials, `/settle` calls `https://api-m.sandbox.paypal.com/v1/payments/payouts` and stores the returned batch ID. Without credentials, payouts fail closed. To verify a live Sandbox payout end to end, configure credentials and confirm the batch in the PayPal developer dashboard.

### Low-resource option

```bash
NODE_OPTIONS="--max-old-space-size=1024" npm run dev
```

---

## 3. Test sequence

### Test 1: Create an outbound contract

1. Open the portfolio.
2. Select **New Escrow Contract**.
3. Enter:
   - Contract name: `E2E Integration Program`
   - Vendor: `Dev Agency LLC`
   - Email: `dev@agency.com`
   - Envelope ceiling: `$250.00`
   - Milestone: `Integration Delivery`, amount `$100.00`
4. Save.

Expected:

- The workspace opens for the new contract.
- The portfolio card shows `Outbound Escrow • Accounts Payable`.
- The header shows the outbound envelope ceiling.
- A `GUARDRAIL` ledger event records the contract creation.
- `Settled` is `$0.00`.

### Test 2: Verify workspace labels

1. Return to the portfolio and reopen the contract.
2. Inspect the workspace header and summary.

Expected:

- Role label reads `Client (Escrow Funder)`.
- Summary labels include `Contract Value:` and `Envelope Ceiling:`.
- Amount labels include `Settled:` and `Remaining:`.
- The freeze control is available because this is an outbound contract.

### Test 3: Audit a deliverable

1. Open the milestone.
2. Enter a deliverable URL, for example:
   `https://github.com/agency/e2e-integration/pull/42`
3. Optionally enter acceptance criteria or deliverable text.
4. Run the audit.

Expected:

- `/api/agent/audit` returns a confidence score of at least 85%.
- The URL alone receives 91 or higher, which is a known bypass of substantive content review.
- The result shows `AUTONOMOUS` for a `$100.00` milestone.
- The rationale is displayed.
- A ledger event records the audit with actor `BUYER_AI`.

### Test 4: Release an autonomous settlement

1. Authorize the milestone release.
2. Observe the result.

Expected:

- The ledger records `PAYOUT_EXECUTED`.
- The milestone becomes `COMPLETED`.
- `Settled` increases by `$100.00` for that applied log.
- The payload contains a deterministic `SETTLE-`/`PAYOUT-` reference and the settlement HTTP log. With credentials configured, it also carries the real sandbox `payout_batch_id`; without credentials it honestly reports the simulated or suppressed rail.
- Refreshing the page preserves the updated amount.
- Without credentials no PayPal request is made; with credentials the modeled request uses a deterministic `PayPal-Request-Id` so a retry cannot double-pay.

### Test 5: Human authorization above the cap

1. Create or edit a contract with an envelope ceiling of `$2,000.00`.
2. Add a milestone of `$1,500.00`.
3. Submit a deliverable that passes the audit.

Expected:

- The result returns `HUMAN_APPROVAL_REQUIRED`.
- The milestone enters `AUDITED_PENDING_APPROVAL`.
- No settlement record exists until the human authorization action is used.
- After authorization, the server settlement path records `PAYOUT_EXECUTED` (real batch id with credentials, or an honest simulated/suppressed entry) and `Settled` increases by `$1,500.00`.

### Test 6: Contract freeze

1. Open the outbound contract.
2. Freeze the contract.
3. Attempt a milestone release.

Expected:

- The contract status becomes `PAUSED`.
- The release is blocked before a settlement record is written.
- A `CONTRACT_FROZEN` event is recorded with high or critical risk.
- Resuming the contract restores the ability to release, subject to other guardrails.

### Test 7: Kill-switch

1. Activate the master kill-switch from the header.
2. Submit a deliverable to the audit endpoint or attempt a release.

Expected:

- The audit request returns HTTP `423` when `killSwitchActive` is sent in the request body.
- The response includes `settlementMode: "REJECTED"`, `riskLevel: "CRITICAL"`, and `requiresHumanApproval: true`.
- The workspace blocks milestone release while the kill-switch is active.
- The ledger records `KILL_SWITCH_REVOKED`.
- Deactivating the kill-switch restores normal operation.

### Test 8: Remaining-budget guard

1. Create an outbound contract with an envelope ceiling of `$200.00`.
2. Add a milestone of `$300.00`.
3. Attempt to release it.

Expected:

- The request is blocked before a settlement record is written.
- The message references the remaining project budget.
- A `REJECTED` guardrail event is recorded.
- No settled amount changes.

### Test 9: Inbound contract and subcontracting

1. Seed or hydrate an inbound contract with a parent contract reference. The creation modal currently creates outbound contracts.
2. Inspect the portfolio card and workspace.

Expected:

- The card shows `Inbound Escrow • Accounts Receivable`.
- The subcontract badge is either `SUBCONTRACTED` or `DIRECT HIRE`, never both.
- The parent mandate name is displayed when a parent is linked.
- The workspace uses `Contractor (Escrow Beneficiary)`.
- The freeze control is hidden.

### Test 10: AG Grid ledger

1. Open the ledger.
2. Search and filter transactions.
3. Inspect a settlement payload.
4. Attempt a freeze action where permitted.

Expected:

- Rows render with timestamp, project, actor, action, amount, confidence, risk, and status.
- Filtering and sorting work.
- The payload inspector displays a local synthetic log or a server-returned audit log. It is not necessarily an HTTP response from PayPal.
- Freeze actions are available only for eligible outbound contracts.

### Test 12: Account identity banner

1. Open account settings.
2. Switch the account type to `BUSINESS`.
3. Return to the portfolio.
4. Switch back to `PERSONAL`.

Expected:

- The banner identifies an Enterprise Business Account for business profiles and an Individual Professional Account otherwise.
- The settlement email and compliance status are shown without custody or guaranteed-settlement claims.

---

## 4. Regression checks

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
```

Expected:

- TypeScript validation passes.
- Twelve Jest suites and 126 checks pass.
- Production build completes.

---

## 5. Acceptance checklist

- [ ] Outbound and inbound contracts render in the correct swimlane.
- [ ] Perspective labels use funder/beneficiary terminology.
- [ ] Audit returns confidence and settlement mode.
- [ ] Autonomous settlement is recorded locally at or below $1,000 USD.
- [ ] Human authorization is required above $1,000 USD.
- [ ] Freeze blocks release.
- [ ] Kill-switch blocks audit (with request-body flag) and local settlement.
- [ ] Remaining-budget guard blocks over-cap releases.
- [ ] Subcontract badge and parent mandate are correct.
- [ ] Ledger updates for each applied settlement log; duplicate-log behavior remains a known gap.
- [ ] The workspace release flow delegates to the server settlement route, which executes the payout rail (or fails closed without credentials).
- [ ] Browser refresh preserves state.
- [ ] TypeScript, tests, and build pass.
