# End-to-End Verification Plan

This plan verifies the implemented dual-perspective portfolio, milestone audit, guardrails, local settlement recording, and AG Grid ledger. It replaces the earlier role-switching test plan; account type and contract perspective are independent, and there is no in-app role switch.

> [!IMPORTANT]
> The workspace does not execute PayPal payouts. A release marks the milestone complete and writes a local `PAYOUT_EXECUTED` event with a generated `PAYPAL-BATCH-*` identifier. Use this plan to verify that behavior, not to claim a Sandbox payment.

---

## 1. Scope

Covered:

- Contract creation for outbound and inbound perspectives.
- Portfolio and workspace navigation.
- Deliverable audit and confidence result.
- Autonomous settlement recording at or below $1,000 USD.
- Human authorization above $1,000 USD.
- Contract freeze, kill-switch, and remaining-budget blocks.
- Subcontract badge and parent mandate display.
- Intake link generation and clipboard states.
- Ledger updates and payload inspection.
- Browser persistence after refresh.

Not covered:

- Authentication, multi-user access, or tenant isolation.
- Live PayPal Sandbox disbursement; no server payout route exists.
- The unimplemented `/escrow/intake/{slug}` page.
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

If the browser has no PayPal client ID, the chat's PayPal client returns a simulated result. If a client ID is configured, the browser still lacks `PAYPAL_CLIENT_SECRET`, so OAuth fails. Workspace releases do not call PayPal. A live Sandbox payout cannot be verified until a server-side route is implemented.

### Low-resource option

```bash
NODE_OPTIONS="--max-old-space-size=1024" npm run dev
```

---

## 3. Test sequence

### Test 1: Create an outbound contract

1. Open the portfolio.
2. Select **New Contract**.
3. Choose the outbound perspective.
4. Enter:
   - Contract name: `E2E Integration Program`
   - Vendor: `Dev Agency LLC`
   - Email: `dev@agency.com`
   - Escrow cap: `$250.00`
   - Milestone: `Integration Delivery`, amount `$100.00`
5. Save.

Expected:

- The workspace opens for the new contract.
- The portfolio card shows `Outbound Escrow • Accounts Payable`.
- The header shows the outbound escrow cap.
- A `GUARDRAIL` ledger event records the contract creation.
- `Settled` is `$0.00`.

### Test 2: Verify workspace labels

1. Return to the portfolio and reopen the contract.
2. Inspect the workspace header and summary.

Expected:

- Role label reads `Client (Escrow Funder)`.
- Summary labels include `Escrow Guarantee:` and `Vault Ceiling:`.
- Amount labels include `Claimed:` and `Settled:`.
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
- The payload contains a generated `PAYPAL-BATCH-*` identifier and a synthetic HTTP log.
- Refreshing the page preserves the updated amount.
- No PayPal request is made, regardless of configured credentials.

### Test 5: Human authorization above the cap

1. Create or edit a contract with an escrow cap of `$2,000.00`.
2. Add a milestone of `$1,500.00`.
3. Submit a deliverable that passes the audit.

Expected:

- The result returns `HUMAN_APPROVAL_REQUIRED`.
- The milestone enters `AUDITED_PENDING_APPROVAL`.
- No settlement record exists until the human authorization action is used.
- After authorization, the ledger records a synthetic `PAYOUT_EXECUTED` and `Settled` increases by `$1,500.00`.

### Test 6: Contract freeze

1. Open the outbound contract.
2. Freeze the contract.
3. Attempt a milestone release.

Expected:

- The contract status becomes `PAUSED`.
- The release is blocked before a local settlement record is written.
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

1. Create an outbound contract with an escrow cap of `$200.00`.
2. Add a milestone of `$300.00`.
3. Attempt to release it.

Expected:

- The request is blocked before a local settlement record is written.
- The message references the remaining project budget.
- A `REJECTED` guardrail event is recorded.
- No settled amount changes.

### Test 9: Inbound contract and subcontracting

1. Create an inbound contract with a parent contract reference.
2. Save and inspect the portfolio card and workspace.

Expected:

- The card shows `Inbound Escrow • Accounts Receivable`.
- The subcontract badge is either `SUBCONTRACTED` or `DIRECT HIRE`, never both.
- The parent mandate name is displayed when a parent is linked.
- The workspace uses `Contractor (Escrow Beneficiary)`.
- The freeze control is hidden.

### Test 10: Intake link

1. From the portfolio, copy the client escrow intake link.
2. Verify the copied URL and clipboard feedback.
3. Open the URL in a new tab.

Expected:

- The URL follows `/escrow/intake/{slug}`.
- The origin matches the current application origin.
- The button shows a copied state.
- If clipboard access is denied, the UI shows `Clipboard Unavailable — Copy Link Manually`.
- The target page returns 404 because the intake route is not implemented.

### Test 11: AG Grid ledger

1. Open the ledger.
2. Search and filter transactions.
3. Inspect a payout payload.
4. Attempt a freeze action where permitted.

Expected:

- Rows render with timestamp, project, actor, action, amount, confidence, risk, and status.
- Filtering and sorting work.
- The payload inspector displays a local synthetic log or a server-returned audit log. It is not necessarily an HTTP response from PayPal.
- Freeze actions are available only for eligible outbound contracts.

### Test 12: Business capacity card

1. Open account settings.
2. Switch the account type to `BUSINESS`.
3. Return to the portfolio.
4. Switch back to `PERSONAL`.

Expected:

- The enterprise capacity card appears only for business accounts.
- The intake action remains available.
- No custody or guaranteed-settlement claim is shown.

---

## 4. Regression checks

```bash
npx tsc --noEmit
npm test -- --runInBand
npm run build
```

Expected:

- TypeScript validation passes.
- Five Jest suites and 58 checks pass.
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
- [ ] Intake link is generated and reports copy state; target route returns 404.
- [ ] Ledger updates for each applied settlement log; duplicate-log behavior remains a known gap.
- [ ] No PayPal request is made by the workspace release flow.
- [ ] Browser refresh preserves state.
- [ ] TypeScript, tests, and build pass.
