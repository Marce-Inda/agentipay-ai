# Regulatory Compliance Framework for AgenticPay AI

## Introduction

AgenticPay AI operates as a **non-custodial escrow orchestration platform** that leverages artificial intelligence for dispute resolution, fraud detection, and settlement governance in marketplace transactions. The platform is designed to mitigate regulatory risk through deterministic, server-authoritative financial controls, transparent auditability, and delegation of settlement execution to licensed payment institutions (PayPal Sandbox API via OAuth 2.0 + Payouts).

This document specifies the regulatory and compliance requirements that govern:

1. **FinCEN & Money Transmitter Regulations:** Evidence of non-custodial architecture and separation from licensed financial services.
2. **Anti-Money Laundering (AML) & Know Your Customer (KYC) Controls:** AI-driven fraud detection and human authorization barriers.
3. **Payment Card Industry Data Security Standard (PCI-DSS):** Non-custodial data handling and secure credential delegation.
4. **Data Privacy & Governance:** GDPR, CCPA, and enterprise data stewardship.
5. **Professional Legal Representation & Disclaimers:** Clear documentation of scope and limitations.

The platform is architected to serve as a **reference implementation** of secure, compliant escrow settlement orchestration. All settlement execution occurs server-side with OAuth-authenticated delegation to PayPal, cryptographic idempotency verification, and deterministic ledger recording.

---

## Glossary

- **AgenticPay AI (Platform):** The application implementing escrow orchestration, audit scoring, and settlement governance. It does not accept, hold, or transmit customer funds.

- **Non-Custodial Design:** The platform does not maintain internal customer balances, customer funds, or virtual accounts. Settlement execution is exclusively delegated to PayPal via server-side OAuth integration.

- **Escrow Orchestration Layer:** A middleware service that governs milestone acceptance, fraud detection, human authorization, and deterministic settlement events without taking custody of funds.

- **Money Transmitter (defined by FinCEN):** Any person who provides money transmission services as a substantial part of the person's regular business. Money transmitters accept and transmit funds on behalf of customers.

- **PayPal Sandbox Payouts API:** The PayPal REST API endpoint `/v1/payments/payouts` executed within a non-production environment. Settlement is dispatched via OAuth 2.0 with deterministic request IDs and atomic transaction rollback on failure.

- **Settlement Fingerprint:** A deterministic tuple of `(project_id, milestone_id, amount_usd)` that derives the `PayPal-Request-Id` and `sender_batch_id` for idempotency and duplicate-prevention.

- **Audit Confidence Score:** A heuristic numerical score (0–100) computed deterministically by the Platform to quantify the reliability of a deliverable submission. A minimum score of 85% is required for settlement eligibility.

- **Autonomous Settlement Threshold:** A transaction amount ceiling of USD 1,000 above which human authorization is mandatory regardless of audit confidence.

- **Human Authorization:** Explicit, documented workspace user approval required for settlement of transactions exceeding the autonomous threshold or for Incoming contracts regardless of amount.

- **Kill-Switch:** A server-side boolean flag that, when activated, blocks all new audit submissions and settlement attempts for a given project or globally across all projects for an account.

- **Contract Freeze:** A non-ACTIVE contract status (PAUSED, COMPLETED, CANCELLED) that blocks audit acceptance and settlement for that contract.

- **Ledger Event:** An immutable, server-persisted transaction record with deterministic event ID, actor classification, action type, amount, audit score, risk level, status, and associated PayPal batch metadata.

- **Prompt-Injection Sanitization:** The process of detecting and replacing known instruction-override patterns and role-hijack attempts with a `[BLOCKED_INJECTION_ATTEMPT]` placeholder before sending user input to external AI models.

- **SHA-256 Idempotency Key:** A cryptographic hash derived deterministically from the settlement fingerprint to prevent duplicate PayPal payout requests and ensure exactly-once semantics.

- **PAYOUT_EXECUTED (Event Status):** A terminal ledger event status indicating that a settlement milestone was successfully released and a PayPal payout request was executed (real, simulated, or suppressed rail).

- **Server-Authoritative State:** All financial and contract state (projects, budgets, envelopes, milestones, audit records) is persisted server-side in PostgreSQL with row-lock atomicity. Client browser state is a tenant-scoped read-only cache.

- **FinCEN Guidance (31 CFR Part 1010 et seq.):** Regulatory framework governing money services businesses, including transmission, storage, and settlement of funds on behalf of others.

- **PCI Data Security Standard (DSS):** Industry standard for securing payment card data, including cardholder data environment segregation and secure transmission protocols.

- **GDPR (EU Regulation 2016/679):** European privacy framework governing lawful processing, storage, and deletion of personal data of EU data subjects.

- **CCPA (California Consumer Privacy Act):** California privacy law governing the collection, use, and sale of personal information for California residents.

- **Tenant Isolation:** Cryptographic and application-level segregation of all customer data, ledger events, contracts, and audit records by authenticated user session.

---

## Requirements

### 1. FinCEN & Money Transmitter Regulatory Alignment

---

#### Requirement 1.1: Non-Custodial Architecture Certification

**User Story:** As a compliance officer, I want AgenticPay AI to be architected such that it does not meet the FinCEN definition of a money transmitter, so that the platform operator is not subject to licensing requirements in jurisdictions where money transmission requires federal or state registration.

**Acceptance Criteria:**

1. THE Platform SHALL NOT accept, hold, or maintain customer-controlled funds in any internal balance, virtual account, or pooled escrow account.

2. WHEN a milestone is submitted for release, THE Platform's settlement path SHALL verify that PayPal credentials are configured server-side; IF credentials are absent, THE Platform SHALL fail closed by returning HTTP 502 without executing a payout.

3. WHEN PayPal credentials are configured, THE Server Settlement Engine SHALL dispatch the payout request to the PayPal Sandbox Payouts API (`POST /v1/payments/payouts`) with OAuth 2.0 authentication inside the PostgreSQL settlement transaction.

4. WHEN a payout is successfully dispatched, THE Platform SHALL atomically record the PayPal `payout_batch_id` and `batch_status` in the server ledger; if the payout fails, THE Platform SHALL roll back the entire settlement transaction without mutating project, envelope, or ledger state.

5. THE Platform's settlement architecture SHALL ensure that customers never transmit or delegate custody of funds through the Platform; instead, THE Platform records the customer's intent, enforces milestone acceptance rules, and triggers PayPal disbursement only when settlement conditions are met.

6. WHERE a customer has not configured PayPal credentials, THE Platform SHALL provide an honest ledger record indicating that settlement was suppressed or simulated, not claiming that funds were transmitted externally.

7. WHERE the Platform operates in production, THE Platform SHALL reject all settlement requests that lack configured PayPal credentials, returning HTTP 502 without recording a simulated or suppressed ledger entry.

**Non-Functional Criteria:**

- The architecture SHALL achieve exactly-once payment semantics (no double-payments) through deterministic, cryptographic idempotency keys derived from the settlement fingerprint.
- ALL custody and transmission functions SHALL be delegated exclusively to PayPal via OAuth, not performed by the Platform's own balance-keeping infrastructure.

**Verification:**

- Code review of `src/lib/paypal/executor.ts` and settlement path to confirm no customer fund custody or transmission occurs.
- Test execution demonstrating that settlement without PayPal credentials fails closed.
- Test execution demonstrating that settlement with credentials invokes PayPal with the correct OAuth scope and request structure.
- Architectural documentation review confirming non-custodial design intent.

---

#### Requirement 1.2: Documentation and Evidence of Non-Custodial Design

**User Story:** As a regulator or auditor, I want AgenticPay AI to provide clear, verifiable evidence of its non-custodial architecture, so that I can assess the platform's regulatory classification and confirm it does not operate as a money transmitter without licensure.

**Acceptance Criteria:**

1. THE Platform's operators SHALL maintain and publish this requirements document (REQUIREMENTS.md), the COMPLIANCE.md architecture reference, the ARCHITECTURE.md technical specification, and SECURITY.md documentation as evidence of non-custodial design.

2. THE Platform's settlement transaction logs and PostgreSQL audit trail SHALL include deterministic event records with timestamps, actor classifications (GUARDRAIL, BUYER_AI, SELLER_AI, PAYPAL_API), action types, amounts, and audit confidence scores.

3. WHEN settlement is executed, THE Server SHALL persist one immutable `PAYOUT_EXECUTED` ledger event per successful payout, including the PayPal batch ID, batch status, request timestamp, and a redacted HTTP payload log (credentials excluded).

4. WHERE a payout is rejected by PayPal or fails due to network error, THE Server SHALL record a `PAYOUT_BLOCKED` security event with the HTTP response status, error code, and failure reason (credentials never logged).

5. THE Platform's data inventory (see DATA_GOVERNANCE.md) SHALL explicitly document that the Platform does not store card numbers, account credentials, or customer financial secrets; all such data is delegated to PayPal.

6. THE Platform's UI and settlement routes SHALL include professional disclaimers stating that the Platform is not a licensed escrow agent, money transmitter, or financial institution, and that production operation requires jurisdiction-specific legal review.

7. THE Platform SHALL provide a `REGULATORY_REPORT.md` export or API endpoint that auditors can invoke to retrieve all payout ledger entries, audit scores, and settlement fingerprints for a given date range without exposing PayPal credentials or customer PII.

**Non-Functional Criteria:**

- All evidence documents SHALL be written in professional, legally precise language appropriate for regulatory review.
- The ledger format SHALL be machine-readable (JSON) to facilitate automated auditing and compliance reporting.

**Verification:**

- Review of COMPLIANCE.md, ARCHITECTURE.md, SECURITY.md, and DATA_GOVERNANCE.md documentation.
- Inspection of PostgreSQL ledger schema and sample `PAYOUT_EXECUTED` and `PAYOUT_BLOCKED` records.
- Export and verification of regulatory report for correctness and completeness.
- Manual test of settlement with and without PayPal credentials to confirm correct fail-closed behavior.

---

#### Requirement 1.3: Escrow Orchestration Governance and Control Documentation

**User Story:** As a platform architect, I want AgenticPay AI's governance controls to be clearly documented and auditable, so that courts, regulators, and platform participants can verify that settlement decisions are deterministic and not subject to the Platform's discretionary control over customer funds.

**Acceptance Criteria:**

1. THE Platform's settlement governance rules (Tiered Authorization, see section 4 of COMPLIANCE.md) SHALL be implemented as deterministic, server-side checks that cannot be bypassed or modified by client-side state changes.

2. WHEN a milestone is submitted for release, THE Server Settlement Engine SHALL atomically load the project, envelope, and milestone record under PostgreSQL row locks; revalidate the audit score, budget ceilings, kill-switch state, and contract status; and execute the PayPal payout only if all checks pass.

3. WHERE any check fails (audit score < 85%, amount > autonomous threshold without human approval, budget breach, kill-switch active, contract frozen), THE Server SHALL return HTTP 422 or HTTP 423 with a structured error response and SHALL NOT execute any payout.

4. THE Platform's control hierarchy (documented in ARCHITECTURE.md section 5) SHALL enforce controls in the following order:
   - Master kill-switch state.
   - Contract freeze status.
   - Audit gate (85% confidence threshold).
   - Budget guard (per-transaction, daily, remaining-project-budget).
   - Human approval requirement (above autonomous threshold or INCOMING contracts).

5. THE Platform SHALL record the authorization actor (e.g., `BUYER_AI` for autonomous settlement, `HUMAN` for explicit approval) in every ledger event so that auditors can determine whether settlement was autonomous or human-authorized.

6. THE Platform's ledger events SHALL include a deterministic event ID and timestamp, enabling auditors to trace the sequence of events and detect tampering or reordering.

7. WHERE the Platform receives a request to modify or replay a settled ledger entry, THE Server SHALL reject the request with HTTP 409 Conflict and record a security violation.

**Non-Functional Criteria:**

- All control checks SHALL execute in less than 100 milliseconds per transaction.
- The control hierarchy SHALL be tested for consistency and completeness under concurrent settlement attempts, budget adjustments, and kill-switch state changes.

**Verification:**

- Code review of `src/lib/guardrails/enforcer.ts` and settlement engine to confirm deterministic control enforcement.
- Automated test suite covering all control conditions (pass/fail combinations for kill-switch, budget, audit score, contract status).
- Concurrency testing with multiple settlement attempts to verify atomicity and no double-payments.
- Manual inspection of ledger records to confirm control hierarchy is enforced and logged correctly.

---

### 2. AML (Anti-Money Laundering) & Fraud Detection Controls

---

#### Requirement 2.1: AI-Driven Fraud Detection and Audit Confidence Scoring

**User Story:** As a compliance officer, I want AgenticPay AI to apply deterministic, AI-enhanced fraud detection to all deliverable submissions before authorizing settlement, so that the platform can mitigate the risk of money laundering through fraudulent milestone acceptance.

**Acceptance Criteria:**

1. WHEN a deliverable is submitted to the Platform's audit endpoint, THE Audit Engine SHALL compute a deterministic confidence score (0–100) based on:
   - Presence of prompt-injection patterns: score reduced to 15 if detected.
   - Artifact verification: GitHub/PR URL, GitHub Actions badge, or similar verifiable artifact: score boosted to 91–99.
   - Requirement-text matching: deliverable text that matches the milestone acceptance criteria: score 86–90.
   - Insufficient evidence: very short deliverable without a URL or requirement match: score 55.
   - Other non-empty deliverables: score 86.

2. THE Audit Engine SHALL reject any deliverable submission if the computed confidence score is less than 85%, returning HTTP 422 and recording an `AUDITED_REJECTED` ledger event with the score and rationale.

3. WHERE a confidence score is at or above 85%, THE Audit Engine SHALL persist the score, rationale, and sanitized deliverable evidence server-side on the milestone record for later settlement authorization.

4. THE Audit Engine SHALL NOT call an external LLM model (OpenAI, Gemini, etc.) for the deterministic audit endpoint; instead, THE Audit Engine SHALL apply heuristic rule-based scoring to ensure determinism and prevent model-based fraud bypass.

5. THE Audit Engine's scoring rules SHALL be documented explicitly in code comments and in a compliance reference document so that auditors and regulators can verify the rules and assess the fraud-detection effectiveness.

6. WHEN the Platform receives a deliverable with a GitHub/PR URL, THE Platform SHALL record that evidence type in the ledger but SHALL NOT assume artifact ownership without additional verification (e.g., repository collaborator checks), so that the 91–99 score boost is treated as prima facie evidence, not proof.

**Non-Functional Criteria:**

- Audit scoring SHALL complete in less than 50 milliseconds per deliverable.
- The scoring algorithm SHALL be idempotent: the same input SHALL always produce the same output score.
- The Platform SHALL not modify the scoring rules in response to specific user submissions (no adaptive fraud evasion).

**Verification:**

- Test suite covering all scoring pathways (injection patterns, GitHub URLs, requirement matches, short text, generic text) with expected score ranges.
- Manual inspection of audit endpoint code to confirm no LLM calls.
- Replay audit scoring on historical ledger entries to verify determinism and idempotency.
- Review of GitHub/PR URL handling to confirm no implicit ownership assumption.

---

#### Requirement 2.2: Autonomous Settlement Threshold and Human Authorization Requirement

**User Story:** As a regulatory compliance team, I want AgenticPay AI to enforce a mandatory human authorization workflow for high-value transactions, so that the platform can mitigate fraud and money-laundering risk for amounts above a threshold where automated controls are insufficient.

**Acceptance Criteria:**

1. WHERE a milestone is submitted for release and the audit confidence score is at or above 85% AND the settlement amount is USD 1,000 or less, THE Platform SHALL mark the milestone as `AUDITED_ELIGIBLE_FOR_AUTONOMOUS_SETTLEMENT` and automatically execute the payout on the server settlement rail.

2. WHERE a milestone is submitted for release, the audit confidence score is at or above 85%, AND the settlement amount exceeds USD 1,000, THE Platform SHALL mark the milestone as `AUDITED_PENDING_HUMAN_APPROVAL` and block payout execution until an authenticated workspace user explicitly authorizes the settlement.

3. WHERE an INCOMING contract (contractor/vendor perspective) is submitted for release, regardless of amount, THE Platform SHALL mark the milestone as `AUDITED_PENDING_HUMAN_APPROVAL` and require explicit human authorization before payout execution, even if the audit score is at or above 85% and the amount is USD 1,000 or less.

4. WHEN a workspace user authorizes settlement via `POST /api/projects/{projectId}/milestones/{milestoneId}/authorize`, THE Server SHALL:
   - Verify the request is authenticated and same-origin.
   - Verify the milestone status is `AUDITED_PENDING_HUMAN_APPROVAL`.
   - Persist the authorization actor (e.g., workspace user ID), timestamp, and optional approval comment in the ledger.
   - Record a `HUMAN_AUTHORIZED_SETTLEMENT` log entry.

5. WHERE human authorization is recorded, THE Settlement Engine SHALL proceed to execute the PayPal payout inside the same transaction, applying all other controls (budget, kill-switch, contract status).

6. WHERE human authorization is denied, THE Settlement Engine SHALL record an `AUDITED_REJECTED_BY_OPERATOR` log entry and block settlement, requiring the contractor to resubmit a new deliverable.

7. THE Platform's ledger and UI SHALL clearly label and display the settlement authorization mode (AUTONOMOUS, HUMAN_APPROVAL_REQUIRED, or REJECTED) for each milestone to provide transparency to both client and contractor.

**Non-Functional Criteria:**

- Authorization requests SHALL complete in less than 100 milliseconds.
- The Platform SHALL not allow batch authorization; each milestone authorization SHALL be explicit and singular.
- Authorization decisions SHALL be immutable after recording (no revocation, only forward-directed approval or denial).

**Verification:**

- Test suite covering autonomous settlement (≤ $1,000, ≥ 85% score), pending human approval (> $1,000 or INCOMING), and explicit authorization workflows.
- Test suite confirming that INCOMING contracts require human authorization regardless of amount.
- Manual verification that UI surfaces authorization requirements clearly to workspace users.
- Inspection of ledger entries to confirm `HUMAN_AUTHORIZED_SETTLEMENT` is recorded with actor and timestamp.

---

#### Requirement 2.3: Sanitization of Prompt Injection and Manipulation Attempts

**User Story:** As a platform security officer, I want AgenticPay AI to detect and neutralize prompt-injection and role-hijacking attacks within user input, so that attackers cannot manipulate the Platform's fraud detection, audit scores, or settlement authorization through malicious text patterns.

**Acceptance Criteria:**

1. WHEN a user submits a deliverable or prompt to any Platform endpoint, THE GuardrailEnforcer's `sanitizePromptInput` function SHALL scan for known instruction-override, role-hijack, and authorization-bypass patterns, including:
   - Phrases like "ignore previous instructions", "you are now", "assume the role", "pretend you are".
   - Commands to override settlement rules, disable audit checks, or bypass budget limits.
   - Attempts to override the 85% confidence threshold or $1,000 autonomous cap.
   - Requests to modify or delete ledger records.

2. WHERE a known injection pattern is detected, THE Platform SHALL replace the pattern with the literal string `[BLOCKED_INJECTION_ATTEMPT]` and log the sanitized input for security review.

3. THE Platform's audit and stream endpoints SHALL apply sanitization before sending any user input to external LLM providers or before wrapping input in a `<deliverable_data>` block.

4. THE Platform's sanitization logic SHALL be deterministic and documented; the same input SHALL always produce the same sanitized output.

5. WHERE sanitization detects an injection pattern, THE Platform's ledger SHALL record a `SECURITY_VIOLATION_PROMPT_INJECTION_DETECTED` event with the user ID, timestamp, endpoint, and sanitized payload (credentials and original injection patterns excluded).

6. WHEN a second prompt-injection attempt is detected from the same user within a 60-minute window, THE GuardrailEnforcer SHALL activate the master kill-switch for that user's account, blocking all further audit submissions and settlement attempts until a workspace administrator explicitly resets the kill-switch.

**Non-Functional Criteria:**

- Sanitization SHALL complete in less than 10 milliseconds per input.
- The sanitization patterns SHALL be maintained in a version-controlled configuration file so that new attack vectors can be added without code changes.
- Sanitization SHALL not remove legitimate user content; it SHALL only replace known malicious patterns.

**Verification:**

- Test suite with payloads containing known injection patterns, confirming that patterns are replaced with `[BLOCKED_INJECTION_ATTEMPT]`.
- Test suite with legitimate user content (requirement text, URLs, valid deliverables) confirming that sanitization does not corrupt valid input.
- Manual security review of sanitized ledger entries to confirm patterns are correctly identified.
- Concurrency test confirming that repeated injection attempts trigger kill-switch activation.

---

#### Requirement 2.4: Transaction Amount Limits and Budget Enforcement

**User Story:** As a compliance team, I want AgenticPay AI to enforce per-transaction, daily, and project-level budget ceilings, so that the platform can cap fraud exposure and prevent unauthorized overspending through account compromise or collusion.

**Acceptance Criteria:**

1. THE Platform's BudgetEnvelope SHALL store:
   - `maxPerTransactionUSD`: per-transaction ceiling (default: $25,000 USD).
   - `dailyCeilingUSD`: daily aggregate ceiling (default: $100,000 USD).
   - `spentTodayUSD`: cumulative amount settled in the current calendar day (UTC).
   - `activeEscrowUSD`: total amount currently in escrow across open milestones.

2. WHEN a milestone is submitted for settlement, THE GuardrailEnforcer's `validateTransactionBudget` function SHALL verify:
   - Amount is positive.
   - Amount ≤ maxPerTransactionUSD.
   - spentTodayUSD + amount ≤ dailyCeilingUSD.
   - The project's remaining budget (budgetCapUSD - spentUSD) ≥ amount.

3. WHERE any budget check fails, THE Settlement Engine SHALL return HTTP 422 with a structured error message indicating the failed constraint (e.g., "Transaction exceeds per-transaction limit") and SHALL NOT execute a payout.

4. WHEN a payout is successfully executed, THE Server Settlement Engine SHALL atomically increment `spentUSD` on the project and `spentTodayUSD` on the envelope within the same PostgreSQL transaction.

5. WHERE `spentTodayUSD` reaches or exceeds the daily ceiling, THE Platform SHALL block further settlement attempts for that day and return HTTP 422 with a message indicating the daily limit has been reached.

6. WHEN the calendar day rolls over (UTC midnight), THE Server's daily reconciliation job SHALL reset `spentTodayUSD` to 0 for all envelopes in preparation for the next day's transactions.

7. WHERE a workspace user adjusts the `maxPerTransactionUSD` or `dailyCeilingUSD` limits, THE Platform SHALL require explicit authentication and authorization (workspace admin role) and SHALL persist the change with a `ENVELOPE_LIMIT_UPDATED` audit event including the actor, old values, and new values.

**Non-Functional Criteria:**

- Budget checks SHALL complete in less than 50 milliseconds per transaction.
- The budget enforcement logic SHALL be implemented in the Server Settlement Engine, not in client-side code; client-side pre-checks are allowed for UX but are not authoritative.
- The daily reset job SHALL be idempotent: repeated invocations on the same day SHALL not cause double-resets or data corruption.

**Verification:**

- Test suite verifying that transactions exceeding per-transaction limit are rejected.
- Test suite verifying that daily cumulative transactions are capped at the daily ceiling.
- Test suite verifying that project-level budget remaining is enforced.
- Test suite verifying that daily reset occurs correctly at UTC midnight.
- Manual verification that budget adjustments are persisted and logged correctly.

---

#### Requirement 2.5: Kill-Switch and Emergency Freeze Controls

**User Story:** As a risk manager, I want AgenticPay AI to provide immediate emergency controls to halt all settlement activity when fraudulent or suspicious activity is detected, so that the platform can minimize financial exposure during security incidents or compliance violations.

**Acceptance Criteria:**

1. THE Platform's master kill-switch is a boolean flag stored in the user's BudgetEnvelope as `killSwitchActive`. When set to true, THE Platform SHALL block:
   - All new deliverable audit submissions (return HTTP 423 Locked).
   - All settlement attempts (return HTTP 423 Locked).
   - Milestone release workflows.

2. WHEN a workspace admin invokes `POST /api/envelope/kill-switch` with `{ action: "activate" }`, THE Server SHALL:
   - Verify the request is authenticated and same-origin.
   - Set `killSwitchActive` to true on the user's BudgetEnvelope.
   - Persist a `KILL_SWITCH_ACTIVATED` security event with the actor, timestamp, and optional reason/comment.
   - Return HTTP 200 with a confirmation message.

3. WHEN a workspace admin invokes `POST /api/envelope/kill-switch` with `{ action: "deactivate" }`, THE Server SHALL:
   - Verify the request is authenticated and same-origin and requires workspace admin authorization.
   - Set `killSwitchActive` to false on the user's BudgetEnvelope.
   - Persist a `KILL_SWITCH_DEACTIVATED` security event with the actor and timestamp.
   - Return HTTP 200 with a confirmation message.

4. WHERE the master kill-switch is active, THE Platform's UI SHALL prominently display a red warning banner on the portfolio and workspace views, indicating that settlement is suspended.

5. WHEN the GuardrailEnforcer detects multiple prompt-injection attempts from the same user within a 60-minute window, THE Platform's backend SHALL automatically activate the master kill-switch for that user and record a `KILL_SWITCH_AUTO_ACTIVATED_SECURITY_VIOLATION` event.

6. WHERE a contract is marked as non-ACTIVE (PAUSED, COMPLETED, CANCELLED), THE Platform SHALL block audit submissions and settlement for that contract and treat it as a frozen contract (distinct from master kill-switch, which is global per account).

7. WHEN a workspace admin invokes `POST /api/projects/{projectId}/freeze` with `{ action: "pause" }`, THE Server SHALL set the contract status to PAUSED, persist a `CONTRACT_PAUSED` event, and block further settlement for that contract.

**Non-Functional Criteria:**

- Kill-switch activation and deactivation SHALL complete in less than 50 milliseconds.
- Kill-switch state changes SHALL be durable: a server restart SHALL preserve the kill-switch state from the PostgreSQL envelope record.
- The Platform SHALL not auto-reset the kill-switch; manual admin intervention is required to deactivate it.

**Verification:**

- Test suite verifying that audit and settlement are blocked when kill-switch is active.
- Test suite verifying that kill-switch activation is logged and durable.
- Manual verification that UI displays kill-switch banner when active.
- Test suite verifying that repeated injection attempts trigger auto-activation.
- Test suite verifying that contract freeze (non-ACTIVE status) blocks settlement independently of master kill-switch.

---

### 3. PCI-DSS Compliance and Secure Data Handling

---

#### Requirement 3.1: Non-Custodial Data Architecture and Credential Delegation

**User Story:** As a security officer, I want AgenticPay AI to ensure that sensitive financial and payment credentials are never stored, processed, or transmitted by the Platform except through delegated, encrypted channels to PayPal, so that the Platform remains outside the PCI-DSS scope and minimizes data breach risk.

**Acceptance Criteria:**

1. THE Platform SHALL NOT store, process, accept, or handle:
   - Credit card numbers (PAN), expiration dates, or CVC/CVV codes.
   - Bank account numbers, routing numbers, or ACH credentials.
   - PayPal account credentials, passwords, or API secrets other than read-only OAuth tokens (see 3.2).
   - Customer authentication factors (passwords, API keys) for third-party services.

2. WHERE a customer needs to configure PayPal settlement, THE Platform SHALL NOT provide a UI field for the customer to enter PayPal credentials directly. Instead, THE Platform SHALL support OAuth 2.0 authorization flow where the customer is redirected to PayPal's authentication system, and THE Platform receives and stores only an OAuth access token server-side.

3. THE Platform's `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` environment variables SHALL be:
   - Read by server-side route handlers only.
   - Never bundled or exposed to the client (browser) JavaScript bundle.
   - Never logged in unredacted form; any HTTP payload log that includes authorization headers SHALL redact the `Authorization` header value.
   - Rotated annually as part of secrets management procedures.

4. WHERE the Platform requires PayPal credentials for the Sandbox settlement rail, THE Platform's server-side code SHALL load credentials from environment variables at runtime, not from configuration files or database entries.

5. WHEN the server settlement engine executes a payout to PayPal, THE Platform's HTTP client SHALL:
   - Use TLS 1.2 or higher for all connections to PayPal.
   - Verify PayPal's SSL certificate.
   - Include the OAuth access token in the `Authorization: Bearer <token>` header.
   - Include a deterministic `PayPal-Request-Id` header to prevent duplicate payouts.
   - Never include or log the raw OAuth token in request/response payloads or logs.

6. THE Platform's ledger payload logs SHALL include only the HTTP status code, response headers (excluding authorization), and sanitized response body (without sensitive data like access tokens or full customer account numbers).

**Non-Functional Criteria:**

- Credential handling code SHALL be reviewed annually for compliance with PCI-DSS 3.2.1 (credential storage) and 4.1 (secure transmission).
- The Platform's build process and deployment pipeline SHALL verify that no PayPal credentials are bundled in the client-side bundle or committed to version control.
- Credential rotation SHALL be tested and automated where possible.

**Verification:**

- Code review of `src/lib/paypal/client.ts` and settlement route handlers to confirm credential handling.
- Bundle analysis (e.g., `npm run build` output) confirming that `NEXT_PUBLIC_PAYPAL_CLIENT_ID` is removed and no credentials are exported to the client.
- Test execution verifying that settlement fails correctly when PayPal credentials are missing.
- Log inspection confirming that authorization headers are redacted in HTTP payload logs.
- TLS verification test to confirm PayPal connections use TLS 1.2+.

---

#### Requirement 3.2: OAuth 2.0 Token Lifecycle Management and Expiration

**User Story:** As a security officer, I want AgenticPay AI to implement secure OAuth 2.0 token lifecycle management, so that PayPal access tokens expire automatically and are refreshed securely without exposing credentials.

**Acceptance Criteria:**

1. WHEN the Platform executes a settlement via the PayPal Payouts API, THE Server Settlement Engine SHALL invoke the PayPal OAuth endpoint (`POST /v1/oauth2/token`) with the `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` to obtain a fresh access token.

2. THE Platform's OAuth token response from PayPal SHALL include an `expires_in` field (typically 3600 seconds). THE Platform SHALL store this expiration time in memory (not persisted to database or filesystem).

3. WHEN an OAuth token approaches expiration (within 60 seconds), THE Platform's settlement routine SHALL discard the cached token and request a fresh token from PayPal before attempting to execute a payout.

4. WHERE an OAuth token request fails (e.g., PayPal returns HTTP 401 Unauthorized), THE Platform SHALL record a `OAUTH_TOKEN_REFRESH_FAILED` security event and return HTTP 502 to the client without executing a payout.

5. THE Platform SHALL NOT store OAuth access tokens persistently in the database or browser storage. All tokens exist only in server-side process memory and are discarded after use.

6. WHERE an OAuth token is leaked or compromised, the token's expiration time ensures the leak is time-bound to a maximum of the OAuth token lifetime (typically ≤ 1 hour).

**Non-Functional Criteria:**

- Token refresh SHALL complete in less than 500 milliseconds.
- The Platform SHALL not block settlement requests while waiting for token refresh; instead, token refresh is synchronous and sequential within the settlement transaction.
- Token caching (within the 60-second buffer) SHALL reduce redundant OAuth calls and lower API usage cost.

**Verification:**

- Code review of OAuth token handling in `src/lib/paypal/client.ts` to confirm tokens are not persisted.
- Test execution simulating token expiration and verifying that a fresh token is requested.
- Test execution simulating OAuth token request failure and verifying that HTTP 502 is returned and no payout is executed.
- Test execution verifying that OAuth calls are rate-limited and tokens are cached appropriately.

---

#### Requirement 3.3: Deterministic Idempotency and Duplicate Prevention

**User Story:** As a financial control officer, I want AgenticPay AI to implement cryptographic, deterministic idempotency for all payout requests, so that retries or network failures cannot result in duplicate payments to beneficiaries.

**Acceptance Criteria:**

1. WHEN the Server Settlement Engine prepares a payout to PayPal, THE Engine SHALL construct a settlement fingerprint consisting of:
   - Project ID
   - Milestone ID
   - Settlement amount (in USD cents)

2. THE Settlement Engine SHALL compute a SHA-256 hash of the fingerprint to generate a deterministic idempotency key.

3. THE Settlement Engine SHALL derive the PayPal `PayPal-Request-Id` header as `REQ-<hash>` (first 32 characters of the hex digest).

4. THE Settlement Engine SHALL derive the PayPal `sender_batch_id` as `SETTLE-<hash>` (first 32 characters of the hex digest).

5. WHEN the Platform executes `POST /v1/payments/payouts` to PayPal, THE Platform SHALL include both `PayPal-Request-Id` and `sender_batch_id` headers/fields derived from the same settlement fingerprint hash.

6. WHERE a settlement transaction is retried (e.g., due to a transient network error), THE Platform SHALL recompute the same fingerprint and hash, resulting in identical `PayPal-Request-Id` and `sender_batch_id` values, ensuring that PayPal recognizes the retry as a duplicate request and returns the existing payout result instead of executing a new payout.

7. WHEN PayPal returns a 200-series response with a `payout_batch_id`, THE Platform SHALL atomically store the real PayPal batch ID (distinct from the `sender_batch_id`) in the ledger event for future reconciliation.

8. WHERE a duplicate settlement attempt is detected (same project and milestone, no ledger modification since the prior attempt), THE Platform SHALL check PostgreSQL for an existing ledger event with the same fingerprint hash, return the prior result, and not invoke PayPal again.

**Non-Functional Criteria:**

- Idempotency key generation SHALL complete in less than 5 milliseconds.
- The idempotency mechanism SHALL be mathematically deterministic: the same fingerprint SHALL always produce the same hash and keys.
- The Platform's idempotency guarantees SHALL extend across server restarts and process boundaries (achieved through deterministic, stateless hashing).

**Verification:**

- Code review of settlement fingerprint construction and hash computation in settlement engine.
- Test execution verifying that the same fingerprint produces identical keys across multiple invocations.
- Test execution simulating a settlement retry, confirming that the same `PayPal-Request-Id` is used and PayPal returns the cached result.
- Test execution confirming that distinct projects or milestones produce distinct keys.
- Concurrency test confirming that concurrent settlement attempts on the same milestone are deduplicated and do not result in double-payments.

---

#### Requirement 3.4: Encrypted Transmission and TLS Enforcement

**User Story:** As a security officer, I want AgenticPay AI to enforce encrypted transmission for all sensitive data exchanges, so that eavesdropping and man-in-the-middle attacks cannot compromise customer data or credentials.

**Acceptance Criteria:**

1. THE Platform's HTTPS configuration SHALL enforce TLS 1.2 or higher for all client-to-server connections in production environments.

2. WHEN a customer accesses the Platform via HTTP (unencrypted), THE Platform's web server configuration SHALL redirect to HTTPS automatically and return HTTP 301 Moved Permanently.

3. WHEN the Platform communicates with PayPal, THE Platform's HTTP client SHALL:
   - Verify PayPal's SSL certificate against the system's certificate authority store.
   - Reject connections if certificate verification fails, returning HTTP 502 to the client without executing a payout.
   - Use TLS 1.2 or higher.
   - Support modern cipher suites (AEAD ciphers preferred).

4. WHEN the Platform communicates with external AI providers (OpenAI, Gemini, OpenRouter), THE Platform's HTTP client SHALL apply the same TLS 1.2+ and certificate verification requirements.

5. WHEN the Platform receives a request with an invalid or expired TLS certificate, THE Platform's TLS layer SHALL terminate the connection and log a `TLS_CERTIFICATE_VERIFICATION_FAILED` security event.

6. WHERE the Platform operates on a network with a corporate proxy or certificate authority, THE Platform's deployment documentation SHALL explain how to configure the proxy's root certificate in the server's certificate store so that TLS verification succeeds.

**Non-Functional Criteria:**

- TLS negotiation SHALL complete in less than 100 milliseconds per connection.
- The Platform's Dockerfile and deployment scripts SHALL configure TLS correctly by default.
- Certificate pinning is recommended for production PayPal integrations to protect against CA compromise (optional for Sandbox).

**Verification:**

- Configuration review of the web server (Next.js) and reverse proxy (Render platform) to confirm TLS 1.2+ enforcement.
- Test execution of HTTP → HTTPS redirect verification.
- Test execution with PayPal sandbox to verify TLS certificate verification succeeds.
- Test execution simulating certificate verification failure (e.g., by introducing a self-signed cert) and confirming the connection is rejected.

---

### 4. Data Privacy and Governance (GDPR / CCPA Compliance)

---

#### Requirement 4.1: PII Redaction Before External AI Provider Calls

**User Story:** As a privacy officer, I want AgenticPay AI to redact personally identifiable information (PII) before sending user input to external AI providers, so that the Platform complies with GDPR data minimization principles and protects customer privacy.

**Acceptance Criteria:**

1. THE Platform SHALL identify the following as PII categories requiring redaction:
   - Full legal names and email addresses of customers, contractors, and third parties.
   - Tax ID numbers, SSN, and national identification numbers.
   - Bank account numbers and routing numbers (though these should not appear in deliverables per Requirement 3.1).
   - Home addresses and physical locations.
   - Phone numbers.

2. WHEN a user submits a prompt or deliverable to an external AI provider endpoint (e.g., `POST /api/agent/stream`), THE Platform's GuardrailEnforcer SHALL:
   - Scan the input for PII patterns (regex for email, phone, SSN, etc.).
   - Replace detected PII with a placeholder token (e.g., `[REDACTED_EMAIL]`, `[REDACTED_PHONE]`) before sending to the AI provider.
   - Log the redaction action in a PII_REDACTED security event with the pattern type and quantity of redactions, but NOT the actual PII values.

3. WHERE no PII is detected, THE Platform SHALL proceed with the AI provider call without redaction.

4. WHEN the AI provider returns a response containing PII (which may occur if the model regenerates or echoes input), THE Platform's response handler SHALL similarly scan and redact PII from the streamed response before returning it to the client.

5. THE Platform's PII redaction rules SHALL be version-controlled and updatable without code changes, allowing the security team to add new patterns as attack vectors evolve.

6. WHEN a customer exports or downloads their ledger or contract data, THE Platform's export function SHALL NOT redact PII (since the customer is the data subject). However, any export shared with third parties (auditors, regulators) SHALL include only redacted versions of PII.

**Non-Functional Criteria:**

- PII detection and redaction SHALL complete in less than 50 milliseconds per request.
- The redaction process SHALL not corrupt legitimate customer data; only PII patterns matching known formats are redacted.
- False-positive redactions (e.g., a string that looks like an email but is not PII) are acceptable for privacy safety, but the Platform SHALL log these for audit.

**Verification:**

- Test suite with payloads containing mock PII (email, phone, SSN, name) confirming redaction occurs.
- Test suite with legitimate customer data (URLs, requirement text) confirming no false-positive redactions.
- Manual verification of PII_REDACTED logs to confirm redaction events are recorded without exposing PII.
- Test suite verifying that AI provider responses containing PII are also redacted.

---

#### Requirement 4.2: Data Retention and Deletion Policies

**User Story:** As a compliance officer, I want AgenticPay AI to implement transparent, configurable data retention and automated deletion policies, so that the Platform minimizes data storage and complies with GDPR data minimization (Article 5) and CCPA deletion rights (Section 1003).

**Acceptance Criteria:**

1. THE Platform SHALL define the following data retention schedules:
   - **Active project data:** retained for the duration of the contract plus 7 years post-completion (for tax and legal hold purposes).
   - **Ledger events:** retained for 7 years for compliance and audit purposes.
   - **Session tokens:** expired and deleted after 12 hours of issuance or last activity.
   - **Temporary audit data (e.g., sanitized deliverables):** retained in memory during audit processing, not persisted unless incorporated into a ledger event.
   - **Logs and security events:** retained for 90 days then automatically deleted unless subject to a legal hold.

2. WHEN a data retention schedule reaches its end date, THE Platform's data-retention job (scheduled daily via cron or message queue) SHALL:
   - Identify records exceeding the retention period.
   - Mark records as eligible for deletion in a soft-delete flag (e.g., `deleted_at` timestamp).
   - After a 7-day grace period (to allow rollback if deletion was incorrect), permanently delete the records from PostgreSQL.
   - Log the deletion action with the record IDs (not sensitive data) and timestamp.

3. WHEN a user requests account deletion via `POST /api/account/delete`, THE Platform SHALL:
   - Verify the request is authenticated and explicitly confirmed by the user (not a single accidental request).
   - Immediately mark all the user's projects, envelopes, sessions, and non-retained ledger events as eligible for deletion.
   - Preserve ledger events that exceed the user's own retention policy but are required for external audit or regulatory compliance (e.g., 7-year retention for tax reporting).
   - Return HTTP 200 and a confirmation message.
   - Schedule the deletion to occur after a 30-day grace period, allowing the user to request cancellation.

4. WHERE a user requests data subject access (DSA) via `POST /api/account/export`, THE Platform SHALL:
   - Generate a JSON export of all the user's profile data, projects, envelopes, ledger events, and audit records.
   - Exclude data that has been soft-deleted or is outside the user's retention window.
   - Return the export as a downloadable file with a unique, time-limited access token (valid for 24 hours).

5. WHEN a data deletion job encounters an error (e.g., database lock, constraint violation), THE Platform SHALL:
   - Log the error with the record IDs and retry timestamp.
   - Retry deletion up to 3 times within the next 24 hours.
   - If all retries fail, escalate to a platform administrator for manual intervention.

6. WHERE data is deleted from production, THE Platform's backup retention policy SHALL ensure that:
   - Automated daily backups are retained for 30 days.
   - Monthly backups are retained for 1 year.
   - Deleted data cannot be recovered after the backup retention window expires.

**Non-Functional Criteria:**

- Data retention and deletion policies SHALL be documented in the Platform's privacy notice and Terms of Service.
- Deletion jobs SHALL complete without locking transactional queries; soft-delete flags should be used to avoid full-table scans.
- The grace period for account deletion (30 days) provides sufficient time for the user to change their mind and request cancellation.

**Verification:**

- Test suite verifying that records exceeding retention periods are flagged for deletion.
- Test suite verifying that account deletion request initiates a 30-day grace period.
- Manual verification of deletion job logs to confirm records are deleted after the grace period.
- DSA export test confirming that the export includes all user data and excludes deleted records.
- Backup retention policy review confirming that deleted data cannot be recovered after policy expiration.

---

#### Requirement 4.3: Data Classification and Access Controls

**User Story:** As a data governance officer, I want AgenticPay AI to classify sensitive data and enforce role-based access controls, so that only authorized personnel can access customer financial records, contracts, and audit evidence.

**Acceptance Criteria:**

1. THE Platform SHALL classify data into the following sensitivity levels:
   - **Public:** non-sensitive metadata (e.g., contract name, milestone status, public artifact URLs).
   - **Internal:** sensitive operational data (e.g., audit scores, confidence rationales, aggregate spend metrics).
   - **Confidential:** customer financial data (e.g., contract amounts, settlement payloads, PayPal batch IDs).
   - **Restricted:** highly sensitive data (e.g., PayPal credentials, OAuth tokens, API keys, full PII).

2. THE Platform's role-based access control (RBAC) model SHALL define the following roles:
   - **Account Owner:** can access all their own data, create and manage sub-accounts or team members.
   - **Workspace Admin:** can authorize human settlements above the autonomous threshold, activate kill-switches, view ledger events.
   - **Contractor (Read-Only):** can view only their own incoming contracts and settlement status, cannot modify contracts or audit settings.

3. WHEN an authenticated user requests access to project data (e.g., `GET /api/projects/{projectId}`), THE Server SHALL verify:
   - The user is authenticated.
   - The user's role has permission to access that project's sensitivity level.
   - The user's account owns or is explicitly granted access to the project.
   - Log the access attempt (including success and denial) in an ACCESS_LOG entry.

4. WHERE a user lacks permission to access a resource, THE Server SHALL return HTTP 403 Forbidden and NOT expose whether the resource exists.

5. WHEN a workspace admin exports compliance reports or auditor data, THE Platform SHALL enforce the following redaction rules:
   - Confidential data (amounts, PayPal batch IDs) are included if the requester is the account owner.
   - Restricted data (API keys, OAuth tokens) are never exported or shared with auditors; only metadata (token creation date, expiration date) is included.

6. THE Platform's access control logic SHALL be centralized in middleware or a decorator so that all routes enforce consistent RBAC.

**Non-Functional Criteria:**

- Access control checks SHALL complete in less than 20 milliseconds per request.
- Access logs SHALL not contain sensitive data (no logging of amounts, settlement payloads, or credentials).
- The RBAC model SHALL be flexible enough to support future roles (e.g., Auditor, Compliance Officer, API Consumer).

**Verification:**

- Code review of RBAC middleware to confirm consistent enforcement across all routes.
- Test suite verifying that users without permission receive HTTP 403 and no resource enumeration occurs.
- Test suite verifying that access logs are recorded for both successful and denied requests.
- Manual verification of access control behavior for different user roles and data sensitivity levels.

---

#### Requirement 4.4: Transparency and Privacy Notices

**User Story:** As a legal compliance officer, I want AgenticPay AI to provide clear, transparent privacy notices to customers, so that the Platform complies with GDPR Article 13/14 transparency requirements and CCPA disclosure obligations.

**Acceptance Criteria:**

1. THE Platform SHALL include a publicly accessible Privacy Policy (https://agenticpay-ai/privacy) that clearly describes:
   - Categories of personal data collected (name, email, contract data, audit evidence).
   - Purpose of data collection (contract execution, fraud detection, payment settlement).
   - Legal basis for processing (contract necessity, legitimate interest, consent).
   - Data retention periods (see Requirement 4.2).
   - Data subject rights (access, correction, deletion, portability).
   - Third-party recipients (PayPal, external AI providers, auditors/regulators).
   - International data transfers (if applicable; e.g., data stored in US AWS but customer is in EU).
   - Complaint procedures (contact information for the data protection authority).

2. WHEN a user registers for an account, THE Platform SHALL display an explicit consent banner requiring the user to:
   - Accept the Terms of Service.
   - Acknowledge the Privacy Policy.
   - Opt into specific data processing (e.g., "I consent to AI-assisted contract analysis").
   - Explicitly consent to external AI provider calls and the associated data sharing (e.g., "I consent to send contract data to OpenAI for analysis").

3. WHERE an external AI provider is used (OpenAI, Gemini, OpenRouter), THE Platform's Privacy Policy SHALL disclose:
   - The specific provider and model used.
   - The types of data shared with the provider (deliverables, project context, sanitized prompts).
   - The provider's data retention and processing practices (link to the provider's privacy policy).
   - The user's right to opt out and use the deterministic audit instead.

4. WHEN a user requests deletion of their account (Requirement 4.2), THE Platform's account-deletion form SHALL warn the user that:
   - Ledger events required for tax and legal compliance will be retained for 7 years.
   - Deletion is irreversible after the 30-day grace period.
   - Third-party payment data (PayPal settlement history) may not be deletable from PayPal's systems.

5. WHEN a user is in the EU (inferred from account address or IP geolocation), THE Platform's Privacy Policy SHALL explicitly reference GDPR rights:
   - Right to access (Article 15).
   - Right to rectification (Article 16).
   - Right to erasure ("Right to be Forgotten", Article 17).
   - Right to restrict processing (Article 18).
   - Right to data portability (Article 20).
   - Right to object (Article 21).
   - Rights related to automated decision-making (Article 22).

6. WHEN a user is in California (inferred from account address or IP geolocation), THE Platform's Privacy Policy SHALL explicitly reference CCPA rights:
   - Right to know (Section 1798.100).
   - Right to delete (Section 1798.105).
   - Right to opt-out of sale/sharing (Section 1798.120).
   - Right to correction (Section 1798.100(e)).
   - Right to non-discrimination (Section 1798.125).

7. THE Platform SHALL provide an in-app link to submit data subject requests (DSA, CCPA) via `POST /api/account/dsr` with request type (access, deletion, correction, portability, objection).

**Non-Functional Criteria:**

- The Privacy Policy SHALL be written in clear, plain language (reading level: 8th grade or equivalent).
- Consent banners SHALL be presented before any data processing occurs, not buried in Terms of Service.
- The DSR endpoint SHALL acknowledge requests within 24 hours and provide a response within 30 days (GDPR) or 45 days (CCPA).

**Verification:**

- Review of Privacy Policy document for accuracy, completeness, and clarity.
- Manual verification that consent banners are displayed on account registration.
- Manual verification that Privacy Policy links to external provider policies and explains data sharing clearly.
- Test execution of DSR endpoints (access, deletion) to confirm requests are acknowledged.
- Geographical testing to confirm region-specific privacy notices are displayed (EU vs. California).

---

### 5. Professional Legal Representation and Regulatory Disclaimers

---

#### Requirement 5.1: Professional Regulatory Disclaimer and Escrow Positioning

**User Story:** As a legal officer, I want AgenticPay AI to include clear, professional disclaimers that explain the Platform's regulatory status and limitations, so that customers understand that the Platform is not a licensed escrow agent or money transmitter and cannot provide legal financial advice.

**Acceptance Criteria:**

1. THE Platform's Terms of Service SHALL include the following disclaimer, prominently displayed and acknowledged during account registration:

   > **Professional Disclaimer:** AgenticPay AI is not a licensed escrow agent, money transmitter, or financial institution. The Platform provides an orchestration service for contract milestone acceptance, fraud detection, and settlement scheduling. The Platform does not hold, custodize, or transmit customer funds; all settlement execution is delegated to PayPal via OAuth-authenticated API calls. The Platform's audit scoring is heuristic and advisory; it is not a substitute for independent legal, financial, or compliance review. Users are responsible for ensuring that their use of the Platform complies with all applicable laws and regulations in their jurisdiction. **If you are in the United States or a jurisdiction where escrow services, payment processing, or financial services are regulated, consult with a licensed attorney before using the Platform for real financial transactions.**

2. WHEN a user creates a contract on the Platform, THE Platform's create-contract form SHALL include an additional acknowledgment checkbox:

   > I acknowledge that AgenticPay AI is not a licensed escrow service, and I am using the Platform at my own risk. I have read the Terms of Service and Privacy Policy and understand the limitations of the Platform's audit scoring and fraud detection.

3. THE Platform's main UI (portfolio and workspace views) SHALL include a footer link to the "Regulatory Disclaimer" and "Terms of Service" pages, ensuring customers can always access the legal information.

4. WHERE a user invokes a payout settlement, THE Platform's settlement confirmation dialog SHALL display:
   - A summary of the settlement (project, milestone, amount, PayPal recipient).
   - A reminder that the Platform is not a licensed escrow agent.
   - An explicit confirmation checkbox: "I confirm this settlement and accept the consequences of delegating funds to PayPal. I have conducted my own independent due diligence."

5. WHEN the Platform is deployed to a production environment (not Sandbox), THE Platform's deployment script SHALL require an environment variable `REGULATORY_DISCLAIMER_ACCEPTED=true` to be explicitly set, forcing operators to acknowledge the disclaimer before running production code.

6. WHERE a customer reports a dispute or settlement failure after PayPal execution, THE Platform's support documentation SHALL clearly state:
   - The Platform did not hold or control the funds at any point.
   - Disputes or refunds must be handled directly with PayPal or the beneficiary.
   - The Platform cannot reverse or modify a PayPal payout after execution.

**Non-Functional Criteria:**

- The disclaimer language SHALL be reviewed by a licensed attorney in jurisdictions where the Platform operates.
- The disclaimer SHALL be updated whenever regulatory guidance from FinCEN, OCC, state banking authorities, or jurisdictional regulators changes the Platform's classification.
- The disclaimer SHALL be presented in a way that is impossible for users to miss or skip (not buried in "Terms of Service" fine print).

**Verification:**

- Review of Terms of Service and disclaimer language by legal counsel.
- Manual verification that disclaimer is displayed prominently during account registration and contract creation.
- Manual verification that settlement confirmation dialog includes the disclaimer reminder.
- Review of deployment script to confirm that `REGULATORY_DISCLAIMER_ACCEPTED` environment variable is required.

---

#### Requirement 5.2: Regulatory Compliance Reporting and Audit Export

**User Story:** As a compliance officer or auditor, I want AgenticPay AI to provide a comprehensive, machine-readable export of all regulatory compliance data, so that I can audit the Platform's adherence to FinCEN, AML, and PCI-DSS requirements.

**Acceptance Criteria:**

1. THE Platform SHALL provide a compliance report export endpoint accessible only to Account Owners: `GET /api/compliance/audit-export?startDate={YYYY-MM-DD}&endDate={YYYY-MM-DD}`.

2. WHEN an Account Owner invokes the compliance export, THE Server SHALL:
   - Verify the request is authenticated and the requester is the Account Owner.
   - Generate a JSON export containing:
     - All projects (contracts) created within the date range, including contract metadata (name, vendor, client, type, status).
     - All milestones and their settlement status (PENDING, AUDITED_ELIGIBLE_FOR_AUTONOMOUS_SETTLEMENT, AUDITED_PENDING_HUMAN_APPROVAL, COMPLETED, REJECTED).
     - All ledger events (GUARDRAIL, AUDITED_PENDING_APPROVAL, PAYOUT_EXECUTED, PAYOUT_BLOCKED, HUMAN_AUTHORIZED_SETTLEMENT, KILL_SWITCH_ACTIVATED, SECURITY_VIOLATION_PROMPT_INJECTION_DETECTED, etc.) with timestamps, actors, and amounts.
     - Aggregated statistics: total payouts, average audit confidence, fraud detection rate, human-authorization rate.
     - Settlement execution evidence: PayPal batch IDs, settlement fingerprints (hashes), and idempotency keys.
     - Security events: all KILL_SWITCH, SECURITY_VIOLATION, OAUTH_TOKEN_REFRESH_FAILED, TLS_CERTIFICATE_VERIFICATION_FAILED events.
     - Budget envelope configuration and daily/per-transaction limit history.

3. THE compliance export SHALL NOT include:
   - PayPal credentials, OAuth tokens, or API secrets.
   - Raw PII (customer names, email addresses, tax IDs) unless explicitly requested and authorized.
   - Confidential deliverable text (unless required for audit; in which case redacted PII is included).

4. WHEN the compliance export is generated, THE Server SHALL:
   - Digitally sign the export with a server-side cryptographic key so that auditors can verify the export has not been tampered with.
   - Include a SHA-256 hash of the export content in the signature.
   - Provide the public key separately for signature verification.

5. WHEN an external auditor or regulator requests compliance data, THE Account Owner SHALL:
   - Export the compliance report.
   - Obtain written authorization from the customer to share the report.
   - Redact any sensitive customer PII (names, tax IDs) unless the auditor is a licensed compliance professional with a signed Data Processing Agreement (DPA).

6. THE Platform's compliance export format SHALL be compatible with common audit and compliance management tools (JSON schema documented in `COMPLIANCE_EXPORT_SCHEMA.md`).

7. WHEN compliance data is exported, THE Server SHALL log the export event with the requester, timestamp, and date range, but SHALL NOT log the export contents themselves.

**Non-Functional Criteria:**

- Compliance export generation SHALL complete in less than 30 seconds for typical date ranges (1 month to 1 year).
- The export file size SHALL not exceed 100 MB for typical date ranges (1 year of transaction history).
- The export format SHALL be versioned; if the schema changes, a new version number is incremented to maintain backward compatibility.

**Verification:**

- Test suite verifying that only Account Owners can export compliance reports (403 Forbidden for non-owners).
- Test suite verifying that the export includes all expected fields and event types.
- Test suite verifying that credentials and raw PII are excluded from the export.
- Manual verification of digital signature on the export (using the provided public key).
- Spot-check of exported data against the database to confirm accuracy and completeness.

---

#### Requirement 5.3: Regulatory Guidance Documentation and Legal Reference

**User Story:** As a platform architect, I want AgenticPay AI to maintain comprehensive documentation of regulatory guidance, legal references, and architectural decisions, so that auditors, regulators, and platform operators can understand the basis for the Platform's compliance posture.

**Acceptance Criteria:**

1. THE Platform's documentation repository SHALL include the following files:
   - **COMPLIANCE.md:** Non-custodial design, settlement governance, tiered authorization, and audit control documentation (primary compliance reference).
   - **SECURITY.md:** Financial controls, trust boundaries, prompt-injection defense, credential handling, and known security limitations.
   - **ARCHITECTURE.md:** System context, data model, settlement flow, PayPal integration, and architectural limitations.
   - **DATA_GOVERNANCE.md:** Data inventory, privacy controls, and gaps in current implementation.
   - **REGULATORY_REFERENCE.md:** (To be created) Explicit references to FinCEN guidance (31 CFR Part 1010), OCC guidance on money transmitters, AML/KYC frameworks, PCI-DSS requirements, GDPR, and CCPA.

2. THE **REGULATORY_REFERENCE.md** document SHALL include:
   - **FinCEN Jurisdiction:** Explanation of how the Platform's non-custodial design avoids the FinCEN definition of a money transmitter.
     - Reference: 31 U.S.C. § 5318(g)(1) and 31 CFR § 1010.100(dd).
     - Citation: FinCEN guidance on "Funds Transmission" (Publication FIN-2022-001).
   - **AML Compliance:** Explanation of how the Platform's AI-driven fraud detection and human authorization workflow mitigates AML risk.
     - Reference: 31 CFR Part 1020 (AML rules for money transmitters).
     - Citation: FinCEN guidance on beneficial ownership verification and SAR reporting.
   - **PCI-DSS Scope:** Explanation of how the Platform's non-custodial architecture removes the Platform from PCI-DSS Cardholder Data Environment (CDE) scope.
     - Reference: PCI-DSS 4.0 Requirement 1.1 (CDE definition).
     - Citation: PCI-DSS guidance on "Responsible Entity" determination.
   - **GDPR Compliance:** Explanation of how the Platform implements GDPR principles (lawfulness, fairness, transparency, data minimization, etc.).
     - Reference: GDPR Article 5 (Principles relating to processing).
     - Citation: GDPR Chapter III (Rights of the Data Subject).
   - **CCPA Compliance:** Explanation of how the Platform honors California consumer rights.
     - Reference: CCPA Section 1798.100 et seq.
     - Citation: California Attorney General guidance on CCPA compliance.

3. WHEN the Platform's compliance posture changes (e.g., new features, regulatory guidance updates), THE Platform's maintainers SHALL:
   - Update REGULATORY_REFERENCE.md with relevant citations and explanations.
   - Document the regulatory basis for architectural decisions in code comments (e.g., "Deterministic audit scoring: FinCEN guidance requires predictable, auditable controls").
   - Publish a change notice on the Platform's website or release notes.

4. THE Platform's regulatory documentation SHALL NOT constitute legal advice. Each document SHALL include a disclaimer:
   > This documentation is for informational purposes only and does not constitute legal advice. Operators of AgenticPay AI are responsible for obtaining independent legal counsel to assess regulatory compliance in their specific jurisdictions.

5. WHERE the Platform's documentation conflicts with applicable law or regulations, THE Platform's deployment documentation SHALL require operators to acknowledge the conflict and obtain legal counsel before proceeding.

**Non-Functional Criteria:**

- Regulatory documentation SHALL be reviewed annually by a compliance professional to ensure accuracy and completeness.
- Legal references SHALL cite the specific statutory sections, regulations, and FinCEN/OCC guidance documents (with publication dates).
- Documentation SHALL be written at a level appropriate for regulatory reviewers (legal and compliance professionals, not necessarily developers).

**Verification:**

- Review of REGULATORY_REFERENCE.md document for accuracy of citations and completeness of coverage.
- Cross-reference of regulatory citations with official government sources (FinCEN website, U.S. Code, GDPR text, CCPA text).
- Verification that regulatory documents are updated when compliance features are added.
- Legal review of disclaimer language to ensure it is clear and not misleading.

---

## Conclusion

This Requirements Document specifies the regulatory and compliance framework for AgenticPay AI as a non-custodial, AI-enhanced escrow orchestration platform. The requirements ensure that the Platform operates transparently, enforces deterministic controls, delegates financial settlement to licensed institutions (PayPal), and protects customer privacy in accordance with FinCEN, AML/KYC, PCI-DSS, GDPR, and CCPA standards.

All requirements are designed to be verifiable through code review, automated testing, and manual audit. Implementation of these requirements is the responsibility of the platform development and compliance teams. Regulatory compliance in production environments requires jurisdiction-specific legal review and ongoing monitoring of regulatory guidance.

---

## Appendix: Regulatory Framework Index

| Regulatory Area | Governing Requirement | Key Controls |
| :--- | :--- | :--- |
| **FinCEN / Money Transmitter** | 1.1, 1.2, 1.3 | Non-custodial design, PayPal delegation, deterministic governance, audit documentation |
| **AML / KYC** | 2.1, 2.2, 2.3, 2.4, 2.5 | AI fraud detection, autonomous threshold, human authorization, prompt-injection defense, budget limits, kill-switch |
| **PCI-DSS** | 3.1, 3.2, 3.3, 3.4 | No credential storage, OAuth token lifecycle, deterministic idempotency, TLS encryption |
| **GDPR / CCPA** | 4.1, 4.2, 4.3, 4.4 | PII redaction, data retention/deletion, data classification/RBAC, privacy notices, DSR handling |
| **Legal Representation** | 5.1, 5.2, 5.3 | Professional disclaimers, compliance export, regulatory reference documentation |
