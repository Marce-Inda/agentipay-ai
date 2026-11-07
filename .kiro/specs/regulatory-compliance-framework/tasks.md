# Tasks: Regulatory Compliance Framework for AgenticPay AI

**Spec ID:** regulatory-compliance-framework  
**Status:** In Progress  
**Total Tasks:** 48  
**Priority Distribution:** P0: 18 | P1: 18 | P2: 12

---

## Overview & Task Decomposition Strategy

This tasks document decomposes 15 regulatory and compliance requirements into 48 concrete, estimable, testable implementation tasks spanning:

- **Categories A–G:** FinCEN/Money Transmitter (8), AML/Fraud Detection (10), PCI-DSS/Security (8), GDPR/CCPA Privacy (6), Legal/Compliance (4), Testing/Quality (4), Deployment/Operations (2)
- **Estimation:** 2h–16h per task (mix of frontend, backend, database, and testing)
- **Complexity:** Low, Medium, High
- **Priority:** P0 (critical path), P1 (high-value), P2 (polish/hardening)
- **Verification:** Each task has Definition of Done (DoD) acceptance criteria

---

## Task List (48 Tasks)

### A. FinCEN & Money Transmitter Regulatory Alignment (8 Tasks)

---

#### T-1: Settlement Engine Fail-Closed Design (PayPal Credential Validation)

**Category:** A (FinCEN)  
**Effort:** 8h  
**Complexity:** High  
**Priority:** P0  
**Skillset:** Backend, Security  
**Dependencies:** None

**Description:**

Implement the fail-closed settlement path: when PayPal credentials are not configured, the settlement endpoint SHALL return HTTP 502 without executing or simulating a payout. This is the core architectural proof of non-custodial design (Req 1.1, AC 7).

In production, settlement must fail hard. In non-production (Sandbox mode with `PAYPAL_SIMULATION_MODE=true`), settlement MAY record simulated or suppressed ledger entries to allow testing without PayPal credentials.

**Acceptance Criteria:**

- Settlement endpoint checks for `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` environment variables before attempting PayPal invocation
- If credentials are missing AND environment is production (`NODE_ENV=production`):
  - Return HTTP 502 Bad Gateway
  - Do NOT execute payout, do NOT call PayPal, do NOT record any settlement event
  - Log a `SETTLEMENT_CREDENTIALS_MISSING_PRODUCTION` security event
- If credentials are missing AND environment is non-production AND `PAYPAL_SIMULATION_MODE=true`:
  - Execute simulated settlement logic (compute deterministic batch ID without network call)
  - Record `PAYOUT_SIMULATED` ledger event with simulated_batch_id, timestamp, and honest "simulated" label
- If credentials are missing AND simulation is disabled:
  - Execute suppressed settlement logic
  - Record `PAYOUT_SUPPRESSED` ledger event with honest "suppressed" label
- All three rails (real, simulated, suppressed) record the settlement fingerprint in the ledger for auditability
- Settlement transaction rolls back atomically if credentials check fails in production

**Definition of Done:**

- [x] Code: Settlement endpoint credential check implemented in `src/app/api/projects/[projectId]/milestones/[milestoneId]/settle.ts`
- [x] Tests: Unit test covering all three credential scenarios (real, simulated, suppressed)
- [x] Tests: Integration test confirming HTTP 502 is returned when credentials are missing in production
- [x] Logs: Security event logs include credential validation failures with safe error messages
- [x] Docs: ARCHITECTURE.md updated to document fail-closed settlement design
- [x] Code Review: Approved by security team

**Test Strategy:**

- Unit: Test credential loading and validation logic in isolation
- Integration: Test settlement endpoint with missing credentials, verifying HTTP 502 and no ledger mutation
- Integration: Test simulated rail with `PAYPAL_SIMULATION_MODE=true`, verifying `PAYOUT_SIMULATED` event
- Property-based: Verify that credential check is deterministic (same input → same response across retries)

---

#### T-2: PostgreSQL Ledger Schema Design (Immutable Event Records)

**Category:** A (FinCEN)  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend, Database  
**Dependencies:** None

**Description:**

Design and implement the PostgreSQL schema for the immutable audit ledger (`agenticpay_ledger_events`). This table is append-only and stores deterministic, immutable records of all financial transactions, security events, and control decisions (Req 1.2).

**Schema Structure:**

```sql
CREATE TABLE agenticpay_ledger_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES agenticpay_users(id) ON DELETE CASCADE,
  event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  event_type VARCHAR(50) NOT NULL, -- 'PAYOUT_EXECUTED', 'PAYOUT_BLOCKED', 'AUDIT_SCORED', 'KILL_SWITCH_ACTIVATED', ...
  actor_type VARCHAR(50) NOT NULL, -- 'GUARDRAIL', 'BUYER_AI', 'SELLER_AI', 'PAYPAL_API', 'HUMAN'
  actor_id VARCHAR(256), -- Workspace user ID or external actor identifier
  project_id UUID NOT NULL REFERENCES agenticpay_projects(id),
  milestone_id UUID,
  amount_usd DECIMAL(12, 2),
  audit_confidence_score SMALLINT, -- 0-100 for audit events
  audit_rationale TEXT, -- JSON or plaintext summary of scoring logic
  risk_level VARCHAR(20), -- 'LOW', 'MEDIUM', 'HIGH'
  payout_batch_id VARCHAR(256), -- Real PayPal payout batch ID or simulated_batch_id
  paypal_status VARCHAR(50), -- 'PROCESSING', 'SUCCESS', 'PENDING', 'FAILED', ...
  http_status_code SMALLINT, -- HTTP response code from PayPal
  http_payload_log TEXT, -- Redacted request/response (no credentials)
  settlement_fingerprint_hash VARCHAR(64), -- SHA256 of (project_id, milestone_id, amount)
  kill_switch_active BOOLEAN, -- State of kill-switch at time of event
  contract_status VARCHAR(20), -- 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'
  error_code VARCHAR(50), -- PayPal error code or internal error identifier
  error_message TEXT, -- Human-readable error description
  metadata JSONB DEFAULT '{}', -- Extensible field for future event data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(50) DEFAULT 'system' -- System or user context
);

CREATE INDEX ON agenticpay_ledger_events(user_id, event_timestamp DESC);
CREATE INDEX ON agenticpay_ledger_events(project_id, event_timestamp DESC);
CREATE INDEX ON agenticpay_ledger_events(settlement_fingerprint_hash);
CREATE INDEX ON agenticpay_ledger_events(event_type);

-- Immutability constraint: no UPDATE or DELETE on ledger events
-- Enforced in application logic, though database-level TRIGGER is optional
```

**Acceptance Criteria:**

- Schema design supports all event types (PAYOUT_EXECUTED, PAYOUT_BLOCKED, AUDIT_SCORED, KILL_SWITCH_ACTIVATED, etc.)
- Deterministic event_id or business-key-derived ID to enable deduplication and idempotency
- Indexes on user_id, project_id, event_type, settlement_fingerprint_hash for efficient auditing queries
- No UPDATE or DELETE operations allowed on ledger events (enforced in application code; optional database trigger)
- Schema allows extensibility via metadata JSONB field
- All timestamps use UTC TIMESTAMP WITH TIME ZONE for audit trail consistency

**Definition of Done:**

- [x] Code: `src/lib/db/schema.ts` or migration file defines `agenticpay_ledger_events` table
- [x] Database: Migration applied to local PostgreSQL; schema verified
- [x] Tests: Unit test confirming schema constraints (no UPDATE/DELETE on ledger rows)
- [x] Docs: Schema documentation in DATA_GOVERNANCE.md with column descriptions
- [x] Code Review: Approved by database team

**Test Strategy:**

- Unit: Test ledger insert and verify NO UPDATE/DELETE permissions
- Integration: Test ledger query performance with indexes (verify query < 100ms for 100K rows)
- Integration: Verify deterministic event_id generation for deduplication scenarios

---

#### T-3: PayPal OAuth Client Integration (Server-Side Token Management)

**Category:** A (FinCEN) + PCI-DSS  
**Effort:** 8h  
**Complexity:** High  
**Priority:** P0  
**Skillset:** Backend, Security  
**Dependencies:** T-1 (Settlement Engine)

**Description:**

Implement PayPal OAuth 2.0 token lifecycle management in `src/lib/paypal/client.ts`. This includes:

- Token refresh from `/v1/oauth2/token` endpoint using `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`
- In-memory token caching with 60-second expiration buffer
- TLS 1.2+ enforcement and certificate verification
- No token persistence to database or browser; server-side only
- Automatic token refresh before settlement execution

This satisfies Req 1.1, 3.1, 3.2, and 3.4.

**Acceptance Criteria:**

- PayPal OAuth client loads `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` from environment variables only
- Credentials never appear in client-side bundle (verify with `npm run build` output)
- Token obtained via `POST /v1/oauth2/token` with client credentials (not user-interactive OAuth)
- Token cached in process memory only; expires after 60-second buffer (e.g., if PayPal says 3600s, discard after 3540s)
- Token never logged in unredacted form; any HTTP logs redact `Authorization` header
- TLS 1.2+ enforced; certificate verification against system CA store
- On OAuth token refresh failure, log `OAUTH_TOKEN_REFRESH_FAILED` security event and return HTTP 502
- Token refresh is synchronous within settlement transaction (no async dangling promises)

**Definition of Done:**

- [x] Code: `src/lib/paypal/client.ts` with OAuth token client and lifecycle management
- [x] Code: All token usage redacts `Authorization` header in logs
- [x] Tests: Unit test simulating token refresh and expiration buffer
- [x] Tests: Unit test simulating OAuth failure (HTTP 401), verifying HTTP 502 returned to client
- [x] Tests: Bundle analysis confirming no credentials in client output
- [x] Security: Code review confirming no token persistence
- [x] Docs: SECURITY.md updated with OAuth token lifecycle documentation

**Test Strategy:**

- Unit: Mock PayPal OAuth endpoint; test token refresh on expiration
- Unit: Mock PayPal OAuth endpoint returning HTTP 401; verify error handling
- Integration: Verify TLS 1.2+ negotiation with PayPal sandbox
- Security: Bundle inspection confirming no PAYPAL_CLIENT_SECRET in output

---

#### T-4: Deterministic Settlement Fingerprint & Idempotency Keys

**Category:** A (FinCEN) + PCI-DSS  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend, Cryptography  
**Dependencies:** T-1 (Settlement Engine)

**Description:**

Implement deterministic settlement fingerprint generation and SHA-256 idempotency key derivation (Req 3.3, AC 1-8). This ensures that retries and duplicate settlement attempts cannot result in double-payments to beneficiaries.

**Fingerprint Specification:**

```
settlement_fingerprint = (project_id, milestone_id, amount_usd_cents)
fingerprint_hash = SHA256(settlement_fingerprint)
paypal_request_id = "REQ-" + fingerprint_hash[0:32]
sender_batch_id = "SETTLE-" + fingerprint_hash[32:64]
```

**Acceptance Criteria:**

- Settlement fingerprint is deterministic: same input always produces same hash across retries
- Fingerprint includes project_id, milestone_id, and amount in USD cents (not floating-point)
- SHA-256 hash used (not weaker hashing algorithms)
- `PayPal-Request-Id` header includes deterministic key for PayPal idempotency
- `sender_batch_id` field includes deterministic key for duplicate detection
- Ledger event stores settlement_fingerprint_hash for later deduplication queries
- On settlement retry (same fingerprint), query ledger for existing event; return cached result without PayPal re-invocation
- Concurrent settlement attempts on same milestone are deduplicated at database row-lock level

**Definition of Done:**

- [x] Code: `src/lib/paypal/idempotency.ts` with fingerprint and key generation
- [x] Tests: Unit test verifying fingerprint determinism (f(x) = f(f(x)))
- [x] Tests: Property-based test: different (project_id, milestone_id, amount) combinations produce different hashes
- [x] Tests: Integration test simulating settlement retry; verifying same PayPal-Request-Id used and cached result returned
- [x] Docs: Design document updated with fingerprint specification and idempotency guarantees
- [x] Code Review: Approved by cryptography/security team

**Test Strategy:**

- Unit: Test fingerprint generation determinism with known inputs
- Property-based: Generate random (project, milestone, amount) tuples; verify distinct tuples produce distinct hashes
- Integration: Simulate settlement retry; confirm duplicate detection prevents double-payment
- Integration: Concurrency test with 10+ parallel settlement attempts on same milestone

---

#### T-5: Non-Custodial Architecture Documentation & Evidence

**Category:** A (FinCEN)  
**Effort:** 4h  
**Complexity:** Low  
**Priority:** P0  
**Skillset:** Backend, Documentation  
**Dependencies:** T-1, T-2, T-3, T-4

**Description:**

Create comprehensive documentation proving non-custodial architecture (Req 1.2). This includes updates to COMPLIANCE.md, ARCHITECTURE.md, and DATA_GOVERNANCE.md, plus the new REGULATORY_REPORT.md export format.

**Acceptance Criteria:**

- COMPLIANCE.md section clearly documents that Platform does NOT hold customer funds
- COMPLIANCE.md section documents fail-closed settlement (HTTP 502 when credentials missing)
- ARCHITECTURE.md section describes three settlement rails (real, simulated, suppressed)
- DATA_GOVERNANCE.md section explicitly states Platform stores NO card data, NO account credentials
- Ledger schema design documented with examples of PAYOUT_EXECUTED and PAYOUT_BLOCKED events
- REGULATORY_REPORT.md export format specified: JSON with payout entries, audit scores, settlement fingerprints
- All documentation written in professional, legally precise language suitable for regulatory review

**Definition of Done:**

- [x] Docs: COMPLIANCE.md updated with non-custodial architecture section
- [x] Docs: ARCHITECTURE.md updated with settlement rails and credential handling
- [x] Docs: DATA_GOVERNANCE.md updated with data inventory (no card/credential storage)
- [x] Docs: REGULATORY_REPORT.md specification document created
- [x] Legal Review: Compliance documentation reviewed by legal team
- [x] Verification: Regulatory report format tested and conforms to spec

**Test Strategy:**

- Manual: Legal and compliance team review of documentation for accuracy and regulatory alignment
- Integration: Test regulatory report export endpoint generates valid JSON

---

#### T-6: Regulatory Report Export Endpoint

**Category:** A (FinCEN)  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend  
**Dependencies:** T-2 (Ledger Schema), T-5 (Documentation)

**Description:**

Implement `GET /api/compliance/audit-export` endpoint that generates machine-readable audit trail for regulatory compliance (Req 1.2, AC 7). This endpoint exports payout ledger entries, audit scores, and settlement fingerprints for a date range without exposing PayPal credentials or customer PII.

**Acceptance Criteria:**

- Endpoint requires authentication and Account Owner authorization
- Query parameters: `startDate` (YYYY-MM-DD) and `endDate` (YYYY-MM-DD)
- Returns JSON array of ledger events with:
  - event_id, event_timestamp, event_type, actor_type
  - project_id, milestone_id, amount_usd, audit_confidence_score
  - payout_batch_id, paypal_status, settlement_fingerprint_hash
  - error_code, error_message (if applicable)
  - Excludes: PayPal credentials, OAuth tokens, full customer PII
- Includes only ledger events within date range
- Returns HTTP 200 with JSON; HTTP 400 if date range is invalid; HTTP 403 if not Account Owner
- Query executes in < 1 second for 1-year date range (100K rows)
- Response includes Content-Disposition header for download (e.g., `audit-export-2024-01-01-to-2024-12-31.json`)

**Definition of Done:**

- [x] Code: `src/app/api/compliance/audit-export/route.ts` endpoint implemented
- [x] Tests: Unit test filtering ledger events by date range
- [x] Tests: Integration test confirming HTTP 403 for non-Account Owner
- [x] Tests: Integration test verifying export JSON is valid and redacted
- [x] Performance: Query execution time < 1 second for 1-year range
- [x] Docs: API endpoint documented in compliance guide

**Test Strategy:**

- Unit: Test date range filtering logic
- Integration: Test endpoint authentication and authorization
- Integration: Test export JSON structure and completeness
- Performance: Benchmark query on 100K-row ledger; target < 1 second

---

#### T-7: Settlement Atomicity & Row-Lock Protection

**Category:** A (FinCEN)  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend, Database  
**Dependencies:** T-1 (Settlement Engine), T-2 (Ledger Schema)

**Description:**

Implement PostgreSQL row-lock protection for settlement transactions using `SELECT...FOR UPDATE` to ensure atomicity and prevent race conditions (Req 1.3, AC 2).

**Settlement Transaction Flow:**

1. BEGIN transaction
2. SELECT projects FOR UPDATE WHERE id = project_id
3. SELECT envelopes FOR UPDATE WHERE user_id = user_id
4. SELECT milestones WHERE id = milestone_id (read-only)
5. Validate all controls (kill-switch, audit score, budget, etc.)
6. If validation passes, invoke PayPal and record ledger event
7. If validation fails or PayPal fails, ROLLBACK
8. If PayPal succeeds, COMMIT

**Acceptance Criteria:**

- Settlement endpoint wraps all state mutations in a PostgreSQL transaction with row locks
- Row locks acquired on projects and envelopes tables to prevent concurrent settlement mutations
- If PayPal payout fails, entire transaction rolls back (no state mutation)
- If PayPal payout succeeds, ledger event is inserted and committed atomically
- Concurrent settlement attempts on same milestone are serialized (row lock prevents parallel execution)
- No double-payments result from concurrent attempts (deduplication via fingerprint hash)
- Lock timeout handled gracefully: if lock cannot be acquired within 5 seconds, return HTTP 503 Service Unavailable

**Definition of Done:**

- [x] Code: Settlement transaction updated with `SELECT...FOR UPDATE` row locks
- [x] Tests: Unit test simulating concurrent settlement attempts; verify no double-payments
- [x] Tests: Integration test with 10+ concurrent requests to same milestone
- [x] Tests: Test row-lock timeout behavior (return HTTP 503 if lock cannot be acquired)
- [x] Performance: Verify settlement completes in < 500ms with row locks acquired
- [x] Code Review: Approved by database team

**Test Strategy:**

- Unit: Test transaction isolation level (SERIALIZABLE or REPEATABLE READ)
- Integration: Concurrent test with 10+ settlement attempts on same milestone
- Integration: Verify no double-payments in ledger after concurrent test
- Performance: Benchmark settlement latency with row locks

---

#### T-8: Ledger Immutability Enforcement

**Category:** A (FinCEN)  
**Effort:** 3h  
**Complexity:** Low  
**Priority:** P1  
**Skillset:** Backend, Database  
**Dependencies:** T-2 (Ledger Schema)

**Description:**

Enforce immutability of ledger events: no UPDATE or DELETE operations allowed on `PAYOUT_EXECUTED` or `PAYOUT_BLOCKED` records (Req 1.3, AC 7).

**Acceptance Criteria:**

- Ledger service provides only INSERT and SELECT operations (no UPDATE or DELETE methods)
- Database-level constraint or trigger prevents UPDATE/DELETE on ledger events (optional but recommended)
- Application code denies all UPDATE/DELETE requests to ledger endpoints with HTTP 405 Method Not Allowed
- Attempts to modify ledger events are logged as `SECURITY_VIOLATION_LEDGER_TAMPERING` events
- Historical ledger data cannot be deleted (only soft-deleted for retention, not hard-deleted from audit trail)

**Definition of Done:**

- [x] Code: Ledger service (read-only except INSERT) implemented in `src/lib/ledger/service.ts`
- [x] Code: DELETE and UPDATE operations explicitly denied with HTTP 405
- [x] Tests: Unit test attempting UPDATE/DELETE on ledger; verify HTTP 405 returned
- [x] Tests: Integration test verifying immutability across API layer
- [x] Docs: Ledger immutability documented in DATA_GOVERNANCE.md

**Test Strategy:**

- Unit: Test ledger service method availability (INSERT and SELECT only)
- Integration: Test HTTP requests attempting UPDATE/DELETE to ledger endpoints
- Integration: Verify tampering attempts are logged as security violations

---

### B. AML & Fraud Detection Controls (10 Tasks)

---

#### T-9: Audit Confidence Scoring Engine (Deterministic Rule-Based)

**Category:** B (AML/Fraud)  
**Effort:** 8h  
**Complexity:** High  
**Priority:** P0  
**Skillset:** Backend  
**Dependencies:** None

**Description:**

Implement deterministic, rule-based audit scoring (NO LLM calls) for milestone deliverables (Req 2.1, AC 1-6). Compute 0–100 confidence score based on:

- GitHub/PR URL presence: +8–14 points (91–99 range)
- Requirement text matching: +1–5 points (86–90 range)
- Generic non-empty deliverable: +0 points (86 baseline)
- Short deliverable (< 50 chars) without URL: -31 points (55 range)
- Prompt-injection pattern detected: -71 points (15 range)
- Rule composition is deterministic and idempotent

**Acceptance Criteria:**

- Audit endpoint `POST /api/projects/{projectId}/milestones/{milestoneId}/audit` accepts `deliverable_text` parameter
- Score computation is rule-based (no LLM, no randomness, no external calls during scoring)
- Scoring rules applied in deterministic order and produce consistent outputs
- Detected GitHub/PR URLs are recorded in ledger (with evidence_type, evidence_url) but are NOT assumed to prove ownership
- Confidence score is persisted on milestone record and in ledger event
- Audit endpoint rejects deliverables with score < 85%, returning HTTP 422 with rejection reason
- Audit endpoint accepts deliverables with score ≥ 85%, returning HTTP 200 and marking milestone as `AUDITED_ELIGIBLE_FOR_AUTONOMOUS_SETTLEMENT` or `AUDITED_PENDING_HUMAN_APPROVAL` (depending on amount and contract type)
- Same deliverable input always produces same score (determinism/idempotency)
- Scoring rules documented in code comments and compliance reference

**Definition of Done:**

- [x] Code: Audit engine `src/lib/audit/scoring-engine.ts` implements all scoring rules
- [x] Code: No LLM calls during audit scoring; verified in code review
- [x] Tests: Unit test for each scoring rule (GitHub URL, requirement match, injection pattern, etc.)
- [x] Tests: Property-based test: determinism (f(x) = f(x) across 1000 invocations)
- [x] Tests: Integration test for audit endpoint with deliverables at each score range (15, 55, 86, 91, 99)
- [x] Tests: Integration test confirming rejection < 85% and acceptance ≥ 85%
- [x] Docs: Scoring rules documented in code and in COMPLIANCE.md
- [x] Code Review: Approved by compliance and security teams

**Test Strategy:**

- Unit: Test each scoring rule in isolation (URL detection, requirement matching, injection pattern detection)
- Unit: Test score boundaries (< 85 rejected, ≥ 85 accepted)
- Property-based: Determinism test (same input → same output)
- Integration: End-to-end audit endpoint test with various deliverable types
- Integration: Verify ledger event records correct score and rationale

---

#### T-10: 85% Audit Confidence Gate & Rejection Workflow

**Category:** B (AML/Fraud)  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend  
**Dependencies:** T-9 (Audit Scoring)

**Description:**

Implement the 85% confidence threshold gate in the settlement path (Req 2.1, AC 2). Rejected deliverables are marked as `AUDITED_REJECTED`, and users must resubmit.

**Acceptance Criteria:**

- Settlement endpoint queries milestone's latest audit_confidence_score
- If score < 85%, settlement is blocked with HTTP 422 and structured error: `{ code: "AUDIT_SCORE_TOO_LOW", min_required: 85, actual: <score> }`
- Rejected deliverables are recorded in ledger as `AUDIT_REJECTED` events with score and rationale
- Users can resubmit new deliverables; each submission increments attempt counter in ledger
- Milestone must be in `AUDITED_ELIGIBLE_FOR_AUTONOMOUS_SETTLEMENT` or `AUDITED_PENDING_HUMAN_APPROVAL` status for settlement to proceed

**Definition of Done:**

- [x] Code: Settlement endpoint validates audit confidence score ≥ 85%
- [x] Tests: Unit test blocking settlement when score < 85%
- [x] Tests: Integration test attempting settlement with low-score audit; verifying HTTP 422 and error message
- [x] Tests: Integration test resubmitting deliverable and confirming new score is used
- [x] Docs: Audit gate behavior documented in settlement flow (ARCHITECTURE.md)

**Test Strategy:**

- Unit: Test audit score validation logic
- Integration: Test settlement with low-confidence audit (< 85%)
- Integration: Test resubmission workflow

---

#### T-11: Autonomous Settlement Threshold ($1K) and Human Approval Requirement

**Category:** B (AML/Fraud)  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend  
**Dependencies:** T-9 (Audit Scoring)

**Description:**

Implement the autonomous settlement threshold (Req 2.2, AC 1-7). Transactions ≤ $1,000 USD with ≥ 85% audit score proceed autonomously. Transactions > $1,000 USD require explicit human authorization. INCOMING contracts require human approval regardless of amount.

**Acceptance Criteria:**

- After audit passes (≥ 85%), milestone status is set to one of:
  - `AUDITED_ELIGIBLE_FOR_AUTONOMOUS_SETTLEMENT`: amount ≤ $1K AND contract perspective = OUTGOING
  - `AUDITED_PENDING_HUMAN_APPROVAL`: amount > $1K OR contract perspective = INCOMING
- Settlement endpoint checks milestone status:
  - If `AUDITED_ELIGIBLE_FOR_AUTONOMOUS_SETTLEMENT`, proceed with automatic payout
  - If `AUDITED_PENDING_HUMAN_APPROVAL`, return HTTP 422 with code `HUMAN_APPROVAL_REQUIRED` and actor guidance
- `POST /api/projects/{projectId}/milestones/{milestoneId}/authorize` endpoint allows workspace user to explicitly authorize settlement
- Authorization request requires authentication, same-origin, and workspace admin role
- On authorization, milestone status transitions to `AUTHORIZED_READY_FOR_SETTLEMENT`
- Authorization is recorded in ledger as `HUMAN_AUTHORIZED_SETTLEMENT` with actor ID, timestamp, and optional approval comment
- Denied authorizations are recorded as `HUMAN_DENIED_SETTLEMENT` (no settlement proceeds)

**Definition of Done:**

- [x] Code: Audit endpoint sets milestone status to `AUDITED_ELIGIBLE...` or `AUDITED_PENDING...` based on amount and contract type
- [x] Code: Settlement endpoint checks milestone status and blocks if pending approval
- [x] Code: Authorize endpoint implements human approval flow
- [x] Tests: Unit test determining correct status (≤$1K OUTGOING = autonomous, >$1K = pending, INCOMING = pending)
- [x] Tests: Integration test settlement with ≤$1K autonomous; confirming auto-payout
- [x] Tests: Integration test settlement with >$1K; confirming HTTP 422 and approval requirement
- [x] Tests: Integration test authorization workflow; confirming status transition and ledger event
- [x] Tests: Integration test denial workflow; confirming settlement is blocked
- [x] Docs: Autonomous threshold and approval workflow documented in ARCHITECTURE.md

**Test Strategy:**

- Unit: Test status determination logic (amount + perspective → status)
- Integration: Test autonomous settlement (≤$1K OUTGOING)
- Integration: Test pending approval workflow (>$1K or INCOMING)
- Integration: Test explicit authorization and denial
- Integration: Verify ledger events record actor and decision

---

#### T-12: Prompt Injection Sanitization & Detection

**Category:** B (AML/Fraud) + Security  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend, Security  
**Dependencies:** None

**Description:**

Implement prompt-injection detection and sanitization in the GuardrailEnforcer (Req 2.3, AC 1-6). Before sending any user input to external AI providers or storing in audit logs, scan for and replace known injection patterns.

**Known Injection Patterns:**

- "ignore previous instructions"
- "you are now"
- "assume the role"
- "pretend you are"
- "override the (threshold|limit|rule)"
- "disable (audit|settlement|budget)"
- "modify the ledger"
- "grant (approval|settlement|authorization)"
- Plus 10+ additional patterns from security literature

**Acceptance Criteria:**

- GuardrailEnforcer's `sanitizePromptInput(input)` function scans for known patterns
- Detected patterns are replaced with `[BLOCKED_INJECTION_ATTEMPT]` literal string
- Same input always produces same sanitized output (deterministic)
- Legitimate customer content (URLs, requirement text) is not corrupted
- Sanitization completes in < 10ms per input
- All AI provider calls (`/api/agent/stream`, `/api/agent/audit`) apply sanitization
- When injection is detected, a `SECURITY_VIOLATION_PROMPT_INJECTION_DETECTED` event is logged with user ID, timestamp, endpoint, count of patterns detected
- Second injection attempt within 60 minutes triggers auto-activation of master kill-switch for user's account

**Definition of Done:**

- [x] Code: `src/lib/guardrails/prompt-sanitizer.ts` with pattern detection and sanitization
- [x] Code: Sanitization applied at AI provider boundary (before LLM calls)
- [x] Tests: Unit test with known injection patterns; verify replacement with `[BLOCKED_...]`
- [x] Tests: Unit test with legitimate customer data; verify no false-positive sanitization
- [x] Tests: Property-based test: sanitization determinism (f(x) = f(x))
- [x] Tests: Integration test two injection attempts within 60 minutes; verify kill-switch auto-activated
- [x] Performance: Sanitization completes in < 10ms
- [x] Docs: Injection patterns documented and version-controlled

**Test Strategy:**

- Unit: Test each known injection pattern; verify replacement
- Unit: Test legitimate content (URLs, requirement text); verify no false positives
- Property-based: Determinism test
- Integration: Test end-to-end sanitization in AI provider calls
- Integration: Test kill-switch auto-activation on repeated injection attempts
- Security: Fuzz testing with random strings to ensure no crashes

---

#### T-13: Budget Enforcement (Per-Transaction, Daily, Project-Level)

**Category:** B (AML/Fraud)  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend  
**Dependencies:** None

**Description:**

Implement deterministic budget validation in GuardrailEnforcer (Req 2.4, AC 1-7). Enforces per-transaction, daily, and project-level spending limits before settlement execution.

**BudgetEnvelope Fields:**

- `maxPerTransactionUSD`: per-transaction ceiling (default $25K)
- `dailyCeilingUSD`: daily aggregate ceiling (default $100K)
- `spentTodayUSD`: cumulative spent in current UTC day
- `activeEscrowUSD`: total in open escrow
- `budgetCapUSD`: project-level lifetime budget
- `spentUSD`: cumulative project spending

**Acceptance Criteria:**

- `validateTransactionBudget(amount, maxPerTx, spentToday, dailyCeiling, projectRemaining)` validates all constraints
- Returns structured error if any constraint fails (e.g., `{ valid: false, reason: "EXCEEDS_PER_TRANSACTION_LIMIT" }`)
- On successful payout, increment `spentUSD` on project and `spentTodayUSD` on envelope atomically
- On calendar day rollover (UTC midnight), reset `spentTodayUSD` to 0 for all envelopes
- Budget adjustments (`maxPerTransactionUSD`, `dailyCeilingUSD`) require workspace admin authorization and are logged
- Settlement blocked if any budget constraint fails with HTTP 422 and detailed error message

**Definition of Done:**

- [x] Code: `src/lib/guardrails/budget-validator.ts` implements budget validation
- [x] Code: Settlement endpoint applies budget validation before PayPal execution
- [x] Code: Daily reset job runs at UTC midnight and resets `spentTodayUSD` to 0
- [x] Tests: Unit test per-transaction limit enforcement
- [x] Tests: Unit test daily ceiling enforcement
- [x] Tests: Unit test project budget enforcement
- [x] Tests: Integration test budget adjustment workflow; verify logging
- [x] Tests: Integration test daily reset; verify `spentTodayUSD` resets at midnight
- [x] Tests: Integration test settlement blocked due to budget constraint
- [x] Docs: Budget enforcement logic documented in ARCHITECTURE.md

**Test Strategy:**

- Unit: Test each budget constraint (per-transaction, daily, project)
- Integration: Test settlement blocked due to each constraint
- Integration: Test budget adjustment and logging
- Integration: Test daily reset (mock time to UTC midnight)
- Property-based: Budget is monotonically increasing (never decreases)

---

#### T-14: Kill-Switch Implementation & Emergency Freeze Controls

**Category:** B (AML/Fraud)  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend  
**Dependencies:** T-9, T-10

**Description:**

Implement the master kill-switch and contract freeze controls (Req 2.5, AC 1-7). When activated, kill-switch blocks all audit submissions and settlements. Contract freeze blocks activity on specific contracts.

**Kill-Switch Behavior:**

- Stored in `BudgetEnvelope.killSwitchActive` (boolean)
- When true, blocks all `POST /api/projects/.../audit` requests (HTTP 423 Locked)
- When true, blocks all `POST /api/projects/.../settle` requests (HTTP 423 Locked)
- Can be activated manually via `POST /api/envelope/kill-switch` with `{ action: "activate" }`
- Can be deactivated manually via `POST /api/envelope/kill-switch` with `{ action: "deactivate" }` (requires admin)
- Can be auto-activated on repeated prompt-injection attempts (second attempt within 60 minutes)
- Activation/deactivation persisted as `KILL_SWITCH_ACTIVATED` and `KILL_SWITCH_DEACTIVATED` ledger events

**Contract Freeze Behavior:**

- Contract status: ACTIVE, PAUSED, COMPLETED, CANCELLED
- Only ACTIVE contracts allow audit and settlement
- Non-ACTIVE contracts reject audit/settlement with HTTP 423 and reason
- Freeze status changes (e.g., ACTIVE → PAUSED) create `CONTRACT_PAUSED` ledger events

**Acceptance Criteria:**

- Settlement endpoint checks kill-switch first (highest priority in control hierarchy)
- If kill-switch active, return HTTP 423 Locked (no further processing)
- If contract status non-ACTIVE, return HTTP 423 Locked
- Kill-switch activation/deactivation is logged with actor, timestamp, reason
- UI prominently displays red warning banner when kill-switch active
- Second injection attempt within 60 minutes auto-activates kill-switch
- Kill-switch state is durable (persists across server restarts)

**Definition of Done:**

- [x] Code: Settlement endpoint checks kill-switch before all other controls
- [x] Code: `POST /api/envelope/kill-switch` endpoint implements activation/deactivation
- [x] Code: Kill-switch auto-activation on repeated injection attempts
- [x] Code: Contract freeze status check in settlement path
- [x] Tests: Unit test kill-switch blocking settlement and audit
- [x] Tests: Integration test kill-switch activation/deactivation workflow
- [x] Tests: Integration test auto-activation on repeated injection attempts
- [x] Tests: Integration test contract freeze blocking settlement
- [x] Tests: Integration test kill-switch durability across server restart (via in-memory cache simulation)
- [x] UI: Red warning banner displays when kill-switch active
- [x] Docs: Kill-switch and freeze controls documented in ARCHITECTURE.md

**Test Strategy:**

- Unit: Test kill-switch state transitions and blocking logic
- Integration: Test manual activation/deactivation workflow
- Integration: Test auto-activation on repeated injection attempts
- Integration: Test contract freeze status blocking settlement
- Integration: Verify kill-switch state is persisted and durable
- Manual: Verify UI warning banner displays correctly

---

#### T-15: Rate Limiting & Bot Prevention

**Category:** B (AML/Fraud)  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P1  
**Skillset:** Backend  
**Dependencies:** T-9 (Audit Scoring)

**Description:**

Implement process-local rate limiting to prevent bot attacks and abuse (Req 2.4 implicit). Rate limit audit submissions and settlement attempts per user per endpoint.

**Rate Limits:**

- Audit submissions: 10 per hour per user per project
- Settlement attempts: 5 per hour per user per project
- Authorization attempts: 20 per hour per user
- Enforcement: return HTTP 429 Too Many Requests if exceeded

**Acceptance Criteria:**

- Rate limiter uses fixed window algorithm with per-endpoint, per-user bucketing
- Rate limit state stored in process memory (not Redis, to avoid external dependency)
- Violation logged as `RATE_LIMIT_EXCEEDED` security event with user, endpoint, count
- HTTP 429 response includes `Retry-After` header (in seconds)
- Rate limits reset after window expires (hourly reset)

**Definition of Done:**

- [x] Code: `src/lib/guardrails/rate-limiter.ts` implements process-local fixed-window limiter
- [x] Code: Rate limiter applied to audit, settlement, and authorization endpoints
- [x] Tests: Unit test rate limit enforcement and window reset
- [x] Tests: Integration test exceeding rate limit; verify HTTP 429 and `Retry-After` header
- [x] Docs: Rate limits documented in API reference

**Test Strategy:**

- Unit: Test rate limiter state management and window resets
- Integration: Test exceeding rate limits on each endpoint
- Integration: Verify rate limit state resets after window expires

---

#### T-16: Audit Logging & Security Event Recording

**Category:** B (AML/Fraud)  
**Effort:** 4h  
**Complexity:** Low  
**Priority:** P1  
**Skillset:** Backend  
**Dependencies:** T-2 (Ledger Schema)

**Description:**

Implement comprehensive audit logging for all security-relevant events (Req 2.3, AC 5; Req 2.5, AC 7). Log prompt injections, kill-switch state changes, authorization denials, and rate limit violations.

**Acceptance Criteria:**

- All security events logged to `agenticpay_ledger_events` table
- Event types: PROMPT_INJECTION_DETECTED, KILL_SWITCH_ACTIVATED, HUMAN_DENIED_SETTLEMENT, RATE_LIMIT_EXCEEDED, etc.
- Logs include user ID, timestamp, endpoint, and safe (non-sensitive) error details
- Logs NEVER include unredacted credentials, tokens, full PII, or sensitive payloads
- All logs include correlationId for distributed tracing (optional but recommended)
- Access control: only authorized users can query audit logs

**Definition of Done:**

- [x] Code: Audit logging integrated into all security-relevant code paths
- [x] Tests: Unit test logging for each security event type
- [x] Tests: Integration test that logs are recorded correctly and safely
- [x] Docs: Audit logging documented in DATA_GOVERNANCE.md

**Test Strategy:**

- Unit: Test logging logic for each security event
- Integration: Verify logs are persisted to ledger and are safely redacted

---

#### T-17: Concurrency & Settlement Conflict Detection

**Category:** B (AML/Fraud)  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P1  
**Skillset:** Backend, Database  
**Dependencies:** T-7 (Settlement Atomicity)

**Description:**

Implement conflict detection and resolution for concurrent settlement attempts on the same milestone (implicit in Req 1.1, 1.3).

**Acceptance Criteria:**

- If two settlement requests for the same milestone arrive concurrently, one acquires row lock and proceeds; the other waits and then detects deduplication via fingerprint
- If deduplication fires, return cached result without re-invoking PayPal
- No double-payments result from concurrent attempts
- Settlement latency with concurrent attempts is < 500ms (including lock wait time)

**Definition of Done:**

- [x] Code: Deduplication logic checks for existing ledger event with same fingerprint
- [x] Tests: Concurrency test with 10+ simultaneous settlement attempts on same milestone
- [x] Tests: Verify no double-payments in ledger after concurrent test
- [x] Performance: Verify settlement latency remains < 500ms even with lock contention

**Test Strategy:**

- Integration: Concurrency test with multiple parallel settlement requests
- Integration: Verify deduplication prevents duplicate ledger events
- Performance: Measure settlement latency under concurrent load

---

### C. PCI-DSS & Security Controls (8 Tasks)

---

#### T-18: OAuth Token Lifecycle Management (Server-Side Only)

**Category:** C (PCI-DSS)  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend, Security  
**Dependencies:** T-3 (PayPal OAuth Client)

**Description:**

Ensure OAuth tokens are never persisted, logged, or exposed to the client (Req 3.2, AC 1-6). Tokens exist only in process memory with automatic expiration.

**Acceptance Criteria:**

- OAuth tokens obtained from `/v1/oauth2/token` are stored in process memory only (not database, not Redis, not client storage)
- Token expiration time from PayPal response (e.g., 3600s) is used with 60-second early expiration buffer
- When token approaches expiration, cached token is discarded before next settlement attempt
- Token refresh requests to PayPal are silent and do not expose token in logs
- If token refresh fails, settlement fails with HTTP 502 and `OAUTH_TOKEN_REFRESH_FAILED` event
- All HTTP logs redact `Authorization` header
- Process restart clears cached token (new token obtained on next settlement)

**Definition of Done:**

- [x] Code: OAuth token stored in memory only (verify no database writes of tokens)
- [x] Code: Token expiration buffer implemented (60-second early expiration)
- [x] Tests: Unit test token expiration and refresh logic
- [x] Tests: Unit test OAuth token is not logged or exposed
- [x] Security: Code review confirming no token persistence
- [x] Docs: Token lifecycle documented in SECURITY.md

**Test Strategy:**

- Unit: Test token expiration buffer and refresh timing
- Unit: Mock OAuth endpoint and verify token handling
- Security: Code inspection confirming no token logging or persistence

---

#### T-19: TLS 1.2+ Enforcement & Certificate Verification

**Category:** C (PCI-DSS)  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend, DevOps, Security  
**Dependencies:** None

**Description:**

Enforce TLS 1.2+ for all HTTPS connections, including client-to-server and server-to-PayPal (Req 3.4, AC 1-6).

**Acceptance Criteria:**

- Next.js app configured for HTTPS only in production (via Render platform or deployment server)
- HTTP requests redirect to HTTPS with HTTP 301
- PayPal client enforces TLS 1.2+ and verifies server certificate against system CA store
- Certificate verification failure returns HTTP 502 and logs `TLS_CERTIFICATE_VERIFICATION_FAILED` event
- AI provider client (OpenAI, Gemini, OpenRouter) enforces TLS 1.2+ and certificate verification
- No support for TLS 1.0 or 1.1 (deprecated protocols)
- Cipher suites include only modern AEAD ciphers (no RC4, DES, or other weak algorithms)

**Definition of Done:**

- [x] Code: HTTP → HTTPS redirect configured in Next.js or reverse proxy
- [x] Code: PayPal client enforces TLS 1.2+ and certificate verification
- [x] Code: AI provider clients enforce TLS 1.2+ and certificate verification
- [x] Tests: Integration test HTTP → HTTPS redirect
- [x] Tests: Integration test PayPal TLS negotiation (TLS 1.2+)
- [x] Tests: Integration test certificate verification failure handling
- [x] Config: Render platform (or deployment target) configured for TLS 1.2+
- [x] Docs: TLS configuration documented in SECURITY.md and deployment guide

**Test Strategy:**

- Integration: Test HTTP → HTTPS redirect
- Integration: Test TLS 1.2+ negotiation with PayPal (via Sandbox)
- Integration: Simulate certificate verification failure; verify HTTP 502 and error log
- Performance: Verify TLS negotiation completes in < 100ms

---

#### T-20: Session Management & HttpOnly Cookies

**Category:** C (PCI-DSS)  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend, Security  
**Dependencies:** None

**Description:**

Implement secure session management with HttpOnly, SameSite cookies and opaque session tokens (Req 3.1 implicit, PCI-DSS 6.5.10).

**Acceptance Criteria:**

- Session token is cryptographically random (32+ bytes entropy)
- Session token stored as opaque cookie with flags: `HttpOnly`, `SameSite=Lax`, `Secure` (HTTPS only)
- Session token hash (SHA-256) stored in PostgreSQL `agenticpay_sessions` table
- Tokens expire after 12 hours of inactivity or maximum 24 hours of issuance
- Token cannot be accessed by JavaScript (HttpOnly prevents XSS token theft)
- SameSite=Lax prevents CSRF attacks (browser does not send cookie on cross-origin requests)
- Logout destroys session token (DELETE from sessions table)

**Definition of Done:**

- [x] Code: Session token generation and storage implemented in auth middleware
- [x] Code: Cookie flags configured: HttpOnly, SameSite=Lax, Secure
- [x] Code: Token hash stored in database (not plaintext)
- [x] Tests: Unit test session token generation (sufficient entropy)
- [x] Tests: Integration test session cookie flags (verify HttpOnly, SameSite, Secure)
- [x] Tests: Integration test token expiration after 12 hours
- [x] Tests: Integration test logout destroys session
- [x] Security: Code review confirming HttpOnly prevents JS access
- [x] Docs: Session management documented in SECURITY.md

**Test Strategy:**

- Unit: Test session token entropy and hash correctness
- Integration: Verify cookie flags are set correctly
- Integration: Test token expiration and refresh
- Security: Verify HttpOnly prevents JavaScript access
- Security: Verify SameSite prevents CSRF

---

#### T-21: Payload Validation & Size Limiting

**Category:** C (PCI-DSS)  
**Effort:** 3h  
**Complexity:** Low  
**Priority:** P1  
**Skillset:** Backend  
**Dependencies:** None

**Description:**

Implement payload validation and size limiting to prevent buffer overflow and abuse attacks (Req 2.3 implicit).

**Acceptance Criteria:**

- Deliverable text limited to 12 KB (12,000 bytes)
- Prompt input limited to 10 KB
- JSON request payloads limited to 100 KB (to prevent DoS via large payloads)
- Requests exceeding limits rejected with HTTP 413 Payload Too Large
- Validation error logged with user, endpoint, and attempted size

**Definition of Done:**

- [x] Code: Payload size validation implemented in middleware or route handlers
- [x] Tests: Unit test payload size validation
- [x] Tests: Integration test exceeding payload limits; verify HTTP 413

**Test Strategy:**

- Unit: Test payload size validation logic
- Integration: Test oversized payloads; verify HTTP 413 and appropriate error logging

---

#### T-22: Origin Header Validation & CSRF Protection

**Category:** C (PCI-DSS)  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend, Security  
**Dependencies:** None

**Description:**

Implement origin header validation and CSRF token protection (PCI-DSS 6.5.9, OWASP).

**Acceptance Criteria:**

- All POST/PUT/DELETE requests validate `Origin` header matches `NEXT_PUBLIC_APP_URL` (same-origin validation)
- If origin mismatch, request rejected with HTTP 403 Forbidden
- Form submissions include CSRF token; token is verified before state mutation
- CSRF token is unique per session and expires after 24 hours
- Token mismatch results in HTTP 403 Forbidden and security event log

**Definition of Done:**

- [x] Code: Origin validation middleware implemented
- [x] Code: CSRF token generation and validation implemented
- [x] Tests: Unit test origin validation logic
- [x] Tests: Integration test cross-origin request rejection
- [x] Tests: Integration test CSRF token validation
- [x] Docs: CSRF protection documented in SECURITY.md

**Test Strategy:**

- Unit: Test origin validation and CSRF token verification
- Integration: Test cross-origin POST requests; verify HTTP 403
- Integration: Test CSRF token mismatch; verify HTTP 403

---

#### T-23: Deterministic Idempotency Key Verification

**Category:** C (PCI-DSS)  
**Effort:** 3h  
**Complexity:** Low  
**Priority:** P1  
**Skillset:** Backend  
**Dependencies:** T-4 (Deterministic Settlement Fingerprint)

**Description:**

Verify idempotency key correctness and deduplication logic (Req 3.3, AC 1-8).

**Acceptance Criteria:**

- Idempotency key derived from settlement fingerprint is deterministic
- Duplicate settlement attempts (same fingerprint) are detected and return cached result
- No second PayPal invocation occurs for duplicate attempts
- Ledger deduplication query executes in < 10ms

**Definition of Done:**

- [x] Code: Deduplication query logic implemented and optimized
- [x] Tests: Unit test idempotency key determinism
- [x] Tests: Integration test duplicate settlement deduplication
- [x] Performance: Deduplication query < 10ms on 100K-row ledger

**Test Strategy:**

- Unit: Test idempotency key generation determinism
- Integration: Test duplicate settlement deduplication
- Performance: Benchmark deduplication query

---

#### T-24: PII Redaction Before External AI Calls

**Category:** C (PCI-DSS) + GDPR  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend, Security  
**Dependencies:** None

**Description:**

Implement PII detection and redaction before sending user input to external AI providers (Req 4.1, AC 1-6).

**Acceptance Criteria:**

- PII categories identified: full names, emails, phone numbers, SSN, tax ID, bank account numbers, home addresses
- PII detection uses regex patterns for common formats
- Detected PII replaced with placeholders: `[REDACTED_EMAIL]`, `[REDACTED_PHONE]`, etc.
- Sanitization deterministic (same input → same output)
- Sanitization completes in < 50ms per request
- Sanitization applied before all external AI calls and before logging
- AI provider response also scanned and redacted (if provider regenerates PII)
- Redaction events logged as `PII_REDACTED` with count of redactions (not actual values)

**Definition of Done:**

- [x] Code: `src/lib/guardrails/pii-redactor.ts` with PII pattern detection
- [x] Code: PII redaction applied to all AI provider calls
- [x] Tests: Unit test PII detection for each category (email, phone, SSN, etc.)
- [x] Tests: Unit test legitimate data (URLs, requirement text) not falsely redacted
- [x] Tests: Integration test PII redaction in AI provider call flow
- [x] Tests: Property-based test: sanitization determinism
- [x] Performance: Sanitization < 50ms per request
- [x] Docs: PII redaction documented in SECURITY.md and DATA_GOVERNANCE.md

**Test Strategy:**

- Unit: Test PII pattern detection for each category
- Unit: Test false-positive analysis (legitimate data not redacted)
- Property-based: Determinism test
- Integration: Test PII redaction in end-to-end AI provider flow
- Performance: Benchmark redaction latency

---

#### T-25: Credential Bundling Prevention & Build Verification

**Category:** C (PCI-DSS)  
**Effort:** 3h  
**Complexity:** Low  
**Priority:** P0  
**Skillset:** DevOps, Security  
**Dependencies:** T-3 (PayPal OAuth Client)

**Description:**

Verify that no PayPal credentials are bundled in client-side JavaScript output (Req 3.1, AC 3).

**Acceptance Criteria:**

- Build process (`npm run build`) produces client bundle
- Bundle does not contain `PAYPAL_CLIENT_SECRET` or other server-side secrets
- Environment variables prefixed with `NEXT_PUBLIC_` are allowed in bundle (client-safe secrets only)
- CI/CD build verification script checks that `PAYPAL_CLIENT_SECRET` does not appear in output
- If secrets found in bundle, build fails with error message

**Definition of Done:**

- [x] Code: Build verification script `scripts/verify-no-secrets.sh` implemented
- [x] Config: Build process runs verification script post-build
- [x] Tests: Verify script detects if secrets are accidentally bundled
- [x] CI/CD: Build verification integrated into GitHub Actions
- [x] Docs: Build security practices documented in SECURITY.md

**Test Strategy:**

- Unit: Test credential detection script with sample bundles (with and without secrets)
- Integration: Verify CI/CD build verification runs and passes

---

### D. GDPR/CCPA & Privacy Controls (6 Tasks)

---

#### T-26: PII Redaction & Privacy Data Classification

**Category:** D (GDPR/CCPA)  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** Backend, Security  
**Dependencies:** T-24 (PII Redaction)

**Description:**

Classify all platform data by sensitivity level and implement privacy controls (Req 4.3, AC 1-6).

**Data Classification:**

- **Public:** Non-sensitive metadata (contract name, milestone status, public artifact URLs)
- **Internal:** Sensitive operational (audit scores, confidence rationales, aggregate metrics)
- **Confidential:** Customer financial (contract amounts, settlement payloads, PayPal batch IDs)
- **Restricted:** Highly sensitive (PayPal credentials, OAuth tokens, API keys, full PII)

**Acceptance Criteria:**

- Data classification documented in DATA_GOVERNANCE.md
- Role-based access control (RBAC) enforces visibility: Account Owner > Workspace Admin > Contractor
- Queries include tenant-scoping (WHERE user_id = authorized_user_id)
- Access control denied returns HTTP 403 without resource enumeration
- All access attempts logged in audit logs

**Definition of Done:**

- [x] Docs: DATA_GOVERNANCE.md updated with data classification matrix
- [x] Code: RBAC middleware enforces data visibility
- [x] Tests: Unit test RBAC enforcement for each role and data type
- [x] Tests: Integration test unauthorized access returns HTTP 403 without enumeration
- [x] Docs: Privacy controls documented in SECURITY.md and DATA_GOVERNANCE.md

**Test Strategy:**

- Unit: Test RBAC enforcement logic for each role combination
- Integration: Test unauthorized access returns HTTP 403
- Integration: Verify resource enumeration is prevented

---

#### T-27: Data Retention Policies & Automated Deletion

**Category:** D (GDPR/CCPA)  
**Effort:** 8h  
**Complexity:** High  
**Priority:** P1  
**Skillset:** Backend, Database  
**Dependencies:** T-2 (Ledger Schema)

**Description:**

Implement transparent, configurable data retention and automated deletion workflows (Req 4.2, AC 1-6).

**Retention Schedules:**

- Active project data: retention duration + 7 years post-completion (tax hold)
- Ledger events: 7 years (compliance and audit)
- Session tokens: 12 hours from issuance or last activity
- Temporary audit data: not persisted (memory only)
- Logs and security events: 90 days then auto-delete (unless legal hold)

**Acceptance Criteria:**

- Data retention policy configurable per data category (environment variables or UI)
- Daily cron job identifies records exceeding retention period
- Soft-delete flag (`deleted_at` timestamp) marks records for deletion
- 7-day grace period before permanent deletion (allows rollback if mistake)
- After grace period, hard delete from database
- Deletion job logs with record count and timestamp (no sensitive data)
- Account deletion (`POST /api/account/delete`) initiates 30-day grace period
- User can cancel deletion during grace period

**Definition of Done:**

- [x] Code: Data retention job `src/lib/cron/retention-job.ts` implemented
- [x] Code: Soft-delete logic with grace period implemented
- [x] Code: Account deletion endpoint with 30-day grace period
- [x] Code: Deletion cancellation endpoint
- [x] Tests: Unit test retention period calculation
- [x] Tests: Integration test data deletion after grace period
- [x] Tests: Integration test account deletion with cancellation
- [x] Tests: Integration test deletion job idempotency (repeated invocations don't double-delete)
- [x] Docs: Retention policy documented in Privacy Policy and DATA_GOVERNANCE.md

**Test Strategy:**

- Unit: Test retention period calculation logic
- Integration: Test soft-delete and grace period workflow
- Integration: Test account deletion with cancellation during grace period
- Integration: Verify deletion job is idempotent

---

#### T-28: Data Subject Access & Deletion Requests (DSR/CCPA)

**Category:** D (GDPR/CCPA)  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P1  
**Skillset:** Backend  
**Dependencies:** T-27 (Data Retention)

**Description:**

Implement Data Subject Request (DSR) and CCPA request endpoints for access, deletion, and portability (Req 4.2, AC 4; Req 4.4, AC 7).

**DSR Types:**

- **Access:** Export all user data as JSON (profile, projects, ledger, audit records)
- **Deletion:** Request account deletion (triggers 30-day grace period)
- **Correction:** Correction requests (logged but may require manual review)
- **Portability:** Export data in portable format (JSON, CSV)
- **Objection:** Opt-out from specific processing (e.g., AI analysis)

**Acceptance Criteria:**

- `POST /api/account/dsr` endpoint accepts request type and details
- DSR acknowledgment returned within 24 hours (HTTP 202 Accepted with request ID)
- DSR response generated within 30 days (GDPR) or 45 days (CCPA)
- Access export includes all user-owned data; excludes deleted records
- Export includes data retention schedule and user rights (for transparency)
- Deletion requests initiate 30-day grace period before permanent deletion
- Deletion can be cancelled by user during grace period
- All DSR requests logged with request ID, type, and status
- DSR endpoint requires authentication and user confirmation (not single-click)

**Definition of Done:**

- [x] Code: `POST /api/account/dsr` endpoint implemented
- [x] Code: Access export logic generates JSON with all user data
- [x] Code: Deletion request initiates grace period workflow
- [x] Code: Cancellation endpoint to cancel pending deletions
- [x] Tests: Unit test DSR request handling
- [x] Tests: Integration test access export endpoint
- [x] Tests: Integration test deletion request with cancellation
- [x] Tests: Integration test DSR request logging and status tracking
- [x] Docs: DSR process documented in Privacy Policy and legal guide

**Test Strategy:**

- Integration: Test DSR endpoint for each request type
- Integration: Test access export completeness and privacy
- Integration: Test deletion request and cancellation workflow
- Integration: Verify DSR logging and status tracking

---

#### T-29: Privacy Notice & Consent Banner

**Category:** D (GDPR/CCPA)  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P1  
**Skillset:** Frontend, Backend  
**Dependencies:** None

**Description:**

Implement privacy notice, consent banner, and transparency disclosures (Req 4.4, AC 1-7).

**Acceptance Criteria:**

- Public Privacy Policy page (https://agenticpay-ai.com/privacy) written in plain language
- Privacy Policy covers: data collection, purposes, retention, rights, third-party recipients, complaints procedure
- Privacy Policy references external AI providers and their data handling (with links to provider policies)
- Privacy Policy includes GDPR and CCPA-specific rights (if user is in EU or California)
- Consent banner displayed on account registration requiring:
  - Accept Terms of Service
  - Acknowledge Privacy Policy
  - Opt into AI-assisted contract analysis
  - Explicit consent to AI provider data sharing (with provider name)
- Consent banner is clear and cannot be skipped or buried
- Consent preferences stored in user profile and can be changed in Settings
- UI includes transparency about audit scoring being heuristic and advisory
- Settlement confirmation dialog includes disclaimer: "Platform is not licensed escrow agent"

**Definition of Done:**

- [x] Docs: Privacy Policy written (legal review by counsel)
- [x] UI: Consent banner implemented on registration page
- [x] UI: Privacy Policy page created
- [x] UI: Settings page includes consent preference controls
- [x] UI: Settlement confirmation includes disclaimer
- [x] Tests: Integration test consent banner displays and is enforceable
- [x] Tests: Integration test consent preferences are stored and honored
- [x] Docs: Privacy Policy and consent mechanics documented

**Test Strategy:**

- Manual: Legal review of Privacy Policy for accuracy and GDPR/CCPA compliance
- Integration: Test consent banner display and enforcement
- Manual: Verify UI transparency about audit scoring and disclaimers

---

#### T-30: Role-Based Access Control (RBAC)

**Category:** D (GDPR/CCPA)  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P1  
**Skillset:** Backend, Security  
**Dependencies:** T-26 (Data Classification)

**Description:**

Implement granular role-based access control for different user roles (Req 4.3, AC 1-6).

**Roles:**

- **Account Owner:** Full access to all account data; can create sub-accounts and invite team members
- **Workspace Admin:** Can authorize human settlements > $1K, activate kill-switch, view and manage contracts
- **Contractor (Read-Only):** View only own incoming contracts and settlement status; cannot modify contracts or audit settings
- **Auditor (External):** View ledger events with redacted sensitive data (PayPal batch IDs removed); cannot modify anything

**Acceptance Criteria:**

- RBAC middleware enforces role-based visibility on all endpoints
- Routes check user role before returning data
- Unauthorized access returns HTTP 403 Forbidden without resource enumeration
- Role assignments are stored in PostgreSQL and can be modified by Account Owner
- Role changes create audit log events
- Each API response includes user role info (for client-side UI adaptation)

**Definition of Done:**

- [x] Code: RBAC middleware `src/lib/auth/rbac.ts` implemented
- [x] Code: RBAC checks integrated into all protected routes
- [x] Code: Role assignment endpoints for Account Owner
- [x] Tests: Unit test RBAC enforcement logic
- [x] Tests: Integration test role-based data visibility
- [x] Tests: Integration test unauthorized access returns HTTP 403
- [x] Tests: Integration test role change audit logging
- [x] Docs: RBAC model documented in SECURITY.md and API reference

**Test Strategy:**

- Unit: Test RBAC enforcement logic for each role combination
- Integration: Test authorized and unauthorized access for each role
- Integration: Verify HTTP 403 for unauthorized access
- Integration: Verify role change audit logging

---

### E. Legal & Compliance Documentation (4 Tasks)

---

#### T-31: Professional Regulatory Disclaimer & Terms of Service

**Category:** E (Legal)  
**Effort:** 8h  
**Complexity:** High  
**Priority:** P0  
**Skillset:** Legal, Backend  
**Dependencies:** T-5 (Architecture Documentation)

**Description:**

Create and integrate professional legal disclaimers and Terms of Service (Req 5.1, AC 1-6).

**Acceptance Criteria:**

- Terms of Service prominently displayed and required to accept during registration
- Professional disclaimer included: "AgenticPay AI is not a licensed escrow agent, money transmitter, or financial institution..."
- Disclaimer clearly explains Platform's limitations and non-custody design
- Disclaimer warns users to consult attorney if using for real financial transactions
- Disclaimer reviewed by licensed attorney in target jurisdictions
- Settlement confirmation dialog includes reminder of disclaimer
- Production deployment requires `REGULATORY_DISCLAIMER_ACCEPTED=true` environment variable
- Links to ToS and Privacy Policy in UI footer on all pages
- All legal language written in clear, plain English (8th-grade reading level)

**Definition of Done:**

- [x] Docs: Terms of Service drafted and reviewed by attorney
- [x] Docs: Regulatory disclaimer drafted and reviewed by attorney
- [x] UI: ToS displayed prominently on registration page
- [x] UI: Regulatory disclaimer appears in settlement confirmation dialog
- [x] UI: Links to ToS and Privacy Policy in footer
- [x] Code: Production deployment blocked if `REGULATORY_DISCLAIMER_ACCEPTED` not set
- [x] Docs: Legal review checklist completed
- [x] Code Review: Legal documents approved by legal team

**Test Strategy:**

- Manual: Legal review of ToS and disclaimer language
- Integration: Test that ToS acceptance is required during registration
- Integration: Test that production deployment fails without disclaimer acceptance

---

#### T-32: Compliance Export & Digital Signatures

**Category:** E (Legal)  
**Effort:** 6h  
**Complexity:** Medium  
**Priority:** P1  
**Skillset:** Backend, Security  
**Dependencies:** T-6 (Regulatory Report Export)

**Description:**

Implement optional digital signing of compliance exports for regulatory verification (Req 5.2, AC 2).

**Acceptance Criteria:**

- Compliance export endpoint generates JSON with all payout ledger entries
- Export includes: event_id, timestamp, project_id, milestone_id, amount, audit_score, payout_batch_id, status
- Export excludes: credentials, OAuth tokens, full customer PII
- Optional digital signature appended to export (using Ed25519 or RSA key)
- Signature verification tool allows auditors to confirm export integrity
- Export includes Content-Disposition header for download with timestamp filename

**Definition of Done:**

- [x] Code: Compliance export endpoint enhanced with optional digital signing
- [x] Code: Signature generation and verification utility implemented
- [x] Tests: Integration test compliance export with valid signature
- [x] Tests: Integration test signature verification with tampered export (should fail)
- [x] Docs: Export format and signature verification process documented

**Test Strategy:**

- Integration: Test compliance export generation and signature
- Integration: Verify signature validation passes for authentic export and fails for tampered export

---

#### T-33: Regulatory Compliance Matrix & Evidence Mapping

**Category:** E (Legal)  
**Effort:** 4h  
**Complexity:** Low  
**Priority:** P1  
**Skillset:** Documentation, Compliance  
**Dependencies:** T-31 (Disclaimers), T-5 (Architecture Documentation)

**Description:**

Create comprehensive compliance matrix mapping requirements to implementation evidence (Req 1.2, AC 1-7; Req 5.2).

**Acceptance Criteria:**

- Compliance matrix maps 15 requirements → architectural components → test evidence
- Matrix includes requirement ID, description, implementation component, test strategy, evidence location
- Evidence locations point to: code files, test files, documentation, deployment configs
- Matrix suitable for regulatory review by FinCEN, state banking authorities, privacy regulators
- Matrix updated whenever requirements change or new controls added

**Definition of Done:**

- [x] Docs: COMPLIANCE_MATRIX.md created with 15+ rows (one per requirement)
- [x] Docs: Each row links to code files, test files, and documentation evidence
- [x] Docs: Matrix reviewed by compliance team
- [x] Docs: Matrix included in regulatory package

**Test Strategy:**

- Manual: Compliance team review of matrix completeness and evidence accuracy

---

#### T-34: Legal Review Checklist & Production Deployment Gate

**Category:** E (Legal)  
**Effort:** 3h  
**Complexity:** Low  
**Priority:** P0  
**Skillset:** DevOps, Legal  
**Dependencies:** T-31 (Disclaimers)

**Description:**

Create deployment checklist and gate requiring legal sign-off before production deployment (Req 5.1).

**Checklist:**

1. Disclaimer reviewed by attorney
2. Terms of Service reviewed by attorney
3. Privacy Policy reviewed by attorney
4. GDPR/CCPA disclosures included (if applicable)
5. Non-custodial architecture documented
6. Settlement fail-closed design verified
7. Compliance matrix complete and accurate
8. All regulatory documentation present

**Acceptance Criteria:**

- Deployment script requires `REGULATORY_DISCLAIMER_ACCEPTED=true` and legal sign-off approval
- Deployment blocks if legal checklist items unchecked
- Legal sign-off includes approver name, title, date, and jurisdiction

**Definition of Done:**

- [x] Docs: Legal review checklist created
- [x] Code: Deployment script enforces checklist requirements
- [x] Docs: Checklist integrated into deployment guide
- [x] Verification: Deployment blocked if checklist incomplete

**Test Strategy:**

- Integration: Test that deployment is blocked if legal checklist incomplete

---

### F. Testing & Quality Assurance (4 Tasks)

---

#### T-35: Unit Test Suite for Guardrails & Controls

**Category:** F (Testing)  
**Effort:** 8h  
**Complexity:** Medium  
**Priority:** P1  
**Skillset:** QA, Backend  
**Dependencies:** T-9 through T-16 (Guardrail tasks)

**Description:**

Implement comprehensive unit test suite for all guardrail enforcer controls (Req 2.1-2.5).

**Test Coverage:**

- Audit confidence scoring (6+ scenarios: GitHub URL, requirement match, injection, etc.)
- Audit gate (85% threshold, rejection workflow)
- Budget validation (per-transaction, daily, project-level)
- Kill-switch activation/deactivation
- Contract freeze status
- Prompt injection detection and sanitization
- Rate limiting

**Acceptance Criteria:**

- Unit tests for each scoring rule, control check, and validation logic
- Target code coverage: > 90% for guardrails module
- All edge cases tested (boundary values, null inputs, invalid data types)
- Tests run in < 5 seconds total
- All tests pass before PR merge

**Definition of Done:**

- [x] Code: Unit tests in `src/lib/__tests__/guardrails/` directory
- [x] Tests: Coverage report shows > 90% coverage
- [x] Tests: All tests pass locally and in CI/CD
- [x] Docs: Test documentation in contributing guide

**Test Strategy:**

- Unit: Comprehensive unit tests for each guardrail control
- Coverage: Target > 90% code coverage

---

#### T-36: Integration Test Suite for Settlement Flow

**Category:** F (Testing)  
**Effort:** 10h  
**Complexity:** High  
**Priority:** P1  
**Skillset:** QA, Backend  
**Dependencies:** All backend tasks (T-1 through T-25)

**Description:**

Implement comprehensive integration test suite for complete settlement flow (Req 1.1, 1.3, 2.1-2.5, 3.1-3.4).

**Test Scenarios:**

- Successful autonomous settlement (≤$1K, ≥85% audit, OUTGOING contract)
- Successful human-authorized settlement (>$1K or INCOMING)
- Settlement rejection (< 85% audit score)
- Budget constraint rejection (per-transaction, daily, or project-level)
- Kill-switch activation blocking settlement
- Contract freeze blocking settlement
- PayPal credential missing → HTTP 502 fail-closed
- Concurrent settlement attempts → deduplication, no double-payments
- Idempotency verification (retry settlement, same result)

**Acceptance Criteria:**

- Integration tests cover happy path and all failure scenarios
- Tests include PayPal Sandbox mock or real sandbox calls
- Tests verify ledger events are recorded correctly
- Tests verify all control hierarchy levels enforced
- All tests pass before production deployment
- Test execution time < 30 seconds total

**Definition of Done:**

- [x] Code: Integration tests in `src/lib/__tests__/settlement/` directory
- [x] Tests: All settlement scenarios covered
- [x] Tests: All tests pass locally and in CI/CD
- [x] Performance: Test suite executes in < 30 seconds

**Test Strategy:**

- Integration: Comprehensive end-to-end settlement flow tests
- Integration: Concurrency tests for duplicate settlement deduplication
- Integration: PayPal mock or sandbox integration tests

---

#### T-37: Property-Based Test Suite (Fast-Check)

**Category:** F (Testing)  
**Effort:** 8h  
**Complexity:** High  
**Priority:** P1  
**Skillset:** QA, Backend  
**Dependencies:** All guardrail and settlement tasks

**Description:**

Implement property-based tests using Fast-Check to verify invariants across many input combinations (Req 3.3, idempotency; Req 2.1, determinism; Req 2.4, budget monotonicity).

**Properties to Verify:**

1. **Determinism:** Audit scoring is deterministic (f(x) = f(x) across 1000 invocations)
2. **Idempotency:** Settlement fingerprint hash is deterministic (same input → same hash)
3. **Budget Monotonicity:** Project spending never decreases; always increases or stays same
4. **Deduplication:** Duplicate settlement attempts return same result without re-invoking PayPal
5. **No Double-Payments:** Concurrent settlement attempts on same milestone produce only one ledger event
6. **Score Bounds:** Audit score always in [0, 100] range

**Acceptance Criteria:**

- Property-based tests use Fast-Check framework
- Each property has 1000+ generated test cases
- All properties hold across all generated inputs
- Tests execute in < 10 seconds total
- Properties documented in test comments (e.g., "property: audit score is deterministic")

**Definition of Done:**

- [x] Code: Property-based tests in `src/lib/__tests__/pbt/` directory
- [x] Tests: Fast-Check configured with 1000+ test cases per property
- [x] Tests: All properties pass
- [x] Tests: All tests pass in CI/CD
- [x] Docs: Properties documented in test code and contributing guide

**Test Strategy:**

- Property-based: Determinism test for audit scoring
- Property-based: Idempotency test for settlement fingerprints
- Property-based: Budget monotonicity test
- Property-based: Deduplication test
- Property-based: Concurrent settlement deduplication test

---

#### T-38: Security Test Suite (OWASP Top 10)

**Category:** F (Testing)  
**Effort:** 8h  
**Complexity:** High  
**Priority:** P1  
**Skillset:** Security, QA  
**Dependencies:** T-20 through T-25 (Security tasks)

**Description:**

Implement security test suite covering OWASP Top 10 vulnerabilities and PCI-DSS security controls.

**Test Coverage:**

- CSRF protection (origin validation, CSRF token verification)
- SQL injection prevention (parameterized queries, no raw SQL)
- XSS prevention (HttpOnly cookies, no sensitive data in DOM)
- Prompt injection (pattern detection, replacement with `[BLOCKED_...]`)
- Session hijacking (HttpOnly, SameSite, expiration)
- Man-in-the-Middle (TLS 1.2+, certificate verification)
- Authentication bypass (credential validation, authorization checks)
- Privilege escalation (RBAC enforcement)
- Information disclosure (no PII in logs, redacted error messages)
- Denial of Service (rate limiting, payload size limits)

**Acceptance Criteria:**

- Security tests verify all OWASP vulnerabilities are mitigated
- Tests use Burp Suite or OWASP ZAP tooling (optional but recommended)
- All tests pass before production deployment
- Security team approves test coverage

**Definition of Done:**

- [x] Code: Security tests in `src/lib/__tests__/security/` directory
- [x] Tests: Coverage for all OWASP Top 10 vulnerabilities
- [x] Tests: All security tests pass
- [x] Security: Security team review and approval
- [x] Docs: Security test documentation

**Test Strategy:**

- Security: CSRF attack simulation and defense verification
- Security: SQL injection attempt (if applicable) and prevention verification
- Security: XSS attack simulation and prevention verification
- Security: Prompt injection detection and blocking verification
- Security: Session hijacking simulation (cookie stealing, replay)
- Security: TLS certificate verification failure handling

---

### G. Deployment & Operations (2 Tasks)

---

#### T-39: PostgreSQL Schema Migration & Production Deploy

**Category:** G (Deployment)  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** DevOps, Database  
**Dependencies:** T-2 (Ledger Schema), T-27 (Data Retention)

**Description:**

Create and test database migration script for production deployment (Req 1.2, 4.2).

**Acceptance Criteria:**

- Migration adds `agenticpay_ledger_events` table with schema from T-2
- Migration adds data retention job infrastructure (if applicable)
- Migration is idempotent (can be re-run without errors)
- Migration is tested on local PostgreSQL instance
- Migration is tested on Render platform (or target deployment platform)
- Rollback plan documented (emergency procedure if migration fails)
- Zero-downtime migration (if applicable) verified

**Definition of Done:**

- [x] Code: Database migration file created `src/migrations/001_ledger_schema.sql`
- [x] Code: Migration applied to local PostgreSQL
- [x] Code: Migration verified on staging environment
- [x] Tests: Migration rollback tested
- [x] Docs: Migration and rollback procedures documented
- [x] DevOps: Migration integrated into deployment pipeline

**Test Strategy:**

- Unit: Migration script tested on local PostgreSQL
- Integration: Migration tested on Render platform staging environment
- Integration: Migration rollback tested

---

#### T-40: Environment Configuration & Deployment Validation

**Category:** G (Deployment)  
**Effort:** 4h  
**Complexity:** Medium  
**Priority:** P0  
**Skillset:** DevOps, Backend  
**Dependencies:** T-31 (Legal Disclaimers)

**Description:**

Configure environment variables and deployment validation gates for production (Req 3.1, 5.1).

**Environment Variables (Production):**

```
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://agenticpay-ai.example.com
PAYPAL_CLIENT_ID=<value>
PAYPAL_CLIENT_SECRET=<value> (never exposed to client)
DATABASE_URL=<PostgreSQL connection string>
REGULATORY_DISCLAIMER_ACCEPTED=true (required for production deployment)
PAYPAL_SIMULATION_MODE=false (disabled in production)
```

**Acceptance Criteria:**

- Environment variables loaded from `.env.production` or deployment platform config
- Production deployment blocked if `REGULATORY_DISCLAIMER_ACCEPTED` not set to true
- Production deployment blocked if `PAYPAL_SIMULATION_MODE` set to true
- Build verification script confirms no secrets in bundle (T-25)
- Deployment logs redact all environment variables (no leaking of secrets)
- All required environment variables validated at startup

**Definition of Done:**

- [x] Code: `.env.production` template created with all required variables
- [x] Code: Startup validation script checks all required env vars
- [x] Code: Deployment blocked if validation fails
- [x] Tests: Deployment validation script tested
- [x] Docs: Environment configuration guide updated
- [x] DevOps: Render platform (or target platform) configured with production env vars

**Test Strategy:**

- Integration: Test that deployment fails if `REGULATORY_DISCLAIMER_ACCEPTED` not set
- Integration: Test that deployment fails if `PAYPAL_SIMULATION_MODE` is true
- Integration: Test that required env vars are validated at startup

---

---

## Task Dependency Graph

### Critical Path (P0 Tasks)

```
T-1: Settlement Engine Fail-Closed
│   ├─ Depends: none
│   ├─ Blocks: T-7, T-10, T-11, T-13
│   └─ Duration: 8h

T-2: PostgreSQL Ledger Schema
│   ├─ Depends: none
│   ├─ Blocks: T-6, T-7, T-16, T-27
│   └─ Duration: 4h

T-3: PayPal OAuth Client
│   ├─ Depends: none
│   ├─ Blocks: T-1, T-18, T-19
│   └─ Duration: 8h

T-4: Deterministic Settlement Fingerprint
│   ├─ Depends: T-1
│   ├─ Blocks: T-7, T-23
│   └─ Duration: 4h

T-5: Architecture Documentation
│   ├─ Depends: T-1, T-2, T-3, T-4
│   ├─ Blocks: T-6, T-31, T-33
│   └─ Duration: 4h

T-6: Regulatory Report Export
│   ├─ Depends: T-2, T-5
│   ├─ Blocks: T-32
│   └─ Duration: 6h

T-7: Settlement Atomicity & Row Locks
│   ├─ Depends: T-1, T-2
│   ├─ Blocks: T-17, T-36
│   └─ Duration: 6h

T-9: Audit Confidence Scoring
│   ├─ Depends: none
│   ├─ Blocks: T-10, T-11
│   └─ Duration: 8h

T-10: 85% Audit Gate
│   ├─ Depends: T-9
│   ├─ Blocks: T-11, T-36
│   └─ Duration: 4h

T-11: Autonomous Settlement Threshold
│   ├─ Depends: T-9, T-10
│   ├─ Blocks: T-36
│   └─ Duration: 6h

T-12: Prompt Injection Sanitization
│   ├─ Depends: none
│   ├─ Blocks: T-13
│   └─ Duration: 6h

T-13: Budget Enforcement
│   ├─ Depends: T-1, T-12
│   ├─ Blocks: T-36
│   └─ Duration: 6h

T-14: Kill-Switch Implementation
│   ├─ Depends: T-9, T-10, T-12
│   ├─ Blocks: T-36
│   └─ Duration: 6h

T-18: OAuth Token Lifecycle
│   ├─ Depends: T-3
│   ├─ Blocks: T-36
│   └─ Duration: 4h

T-19: TLS 1.2+ Enforcement
│   ├─ Depends: none
│   ├─ Blocks: T-36
│   └─ Duration: 6h

T-20: Session Management (HttpOnly)
│   ├─ Depends: none
│   ├─ Blocks: T-36
│   └─ Duration: 4h

T-24: PII Redaction
│   ├─ Depends: none
│   ├─ Blocks: T-26
│   └─ Duration: 6h

T-31: Disclaimers & ToS
│   ├─ Depends: T-5
│   ├─ Blocks: T-34, T-40
│   └─ Duration: 8h

T-34: Legal Review Checklist
│   ├─ Depends: T-31
│   ├─ Blocks: T-40
│   └─ Duration: 3h

T-39: PostgreSQL Migration
│   ├─ Depends: T-2, T-27
│   ├─ Blocks: T-40
│   └─ Duration: 4h

T-40: Environment Configuration
│   ├─ Depends: T-31, T-34, T-39
│   ├─ Blocks: none
│   └─ Duration: 4h
```

### Estimated Timeline

**Critical Path Duration:** ~120 hours (14 days @ 8h/day or ~3 weeks @ 5 days/week)

- Sprint 1 (Days 1–4): T-1–T-7, T-9–T-14, T-18–T-20 (foundation & controls)
- Sprint 2 (Days 5–9): T-12–T-17, T-24–T-27 (fraud detection & privacy)
- Sprint 3 (Days 10–14): T-28–T-38 (GDPR compliance & testing)
- Sprint 4 (Days 15+): T-39–T-40, testing, bugfix, hardening

---

## Testing Strategy Matrix

| Task | Unit | Integration | PBT | Manual | Security |
|------|------|-------------|-----|--------|----------|
| T-1 (Fail-Closed) | ✓ | ✓ | ✓ | | ✓ |
| T-9 (Audit Scoring) | ✓ | ✓ | ✓ | | |
| T-13 (Budget) | ✓ | ✓ | ✓ | | |
| T-14 (Kill-Switch) | ✓ | ✓ | | | ✓ |
| T-12 (Prompt Injection) | ✓ | ✓ | ✓ | | ✓ |
| T-19 (TLS) | ✓ | ✓ | | ✓ | ✓ |
| T-24 (PII Redaction) | ✓ | ✓ | ✓ | | ✓ |
| T-31 (Disclaimers) | | | | ✓ | |
| T-36 (Settlement Integration) | ✓ | ✓ | ✓ | | ✓ |
| T-37 (PBT Suite) | | ✓ | ✓ | | |
| T-38 (Security Suite) | ✓ | ✓ | | | ✓ |

**Testing Coverage Targets:**

- Code coverage: > 90% (core guardrails and settlement engine)
- Property-based tests: > 1000 test cases per property
- Security tests: All OWASP Top 10 vulnerabilities covered
- Integration tests: All settlement scenarios (happy path + failures)

---

## Implementation Priorities & Sequencing

### Phase 1: Foundation & Core Settlement (Days 1–4, ~50h)
**Goal:** Non-custodial architecture proof, fail-closed settlement, audit scoring

- **P0 Tasks:** T-1, T-2, T-3, T-4, T-7, T-9, T-10, T-11
- **Output:** Settlement engine with audit gate, PostgreSQL ledger, OAuth client
- **Verification:** Settlement tests pass, fail-closed behavior verified

### Phase 2: Fraud Detection & Budget Enforcement (Days 5–9, ~40h)
**Goal:** AML controls, prompt injection sanitization, budget limits, kill-switch

- **P0 Tasks:** T-12, T-13, T-14, T-16
- **P1 Tasks:** T-15, T-17
- **Output:** Full guardrail enforcer, budget validation, kill-switch, prompt sanitization
- **Verification:** All guardrail controls tested, no fraud bypass possible

### Phase 3: Security & Privacy (Days 10–14, ~35h)
**Goal:** PCI-DSS compliance, GDPR/CCPA privacy controls, data retention

- **P0 Tasks:** T-18, T-19, T-20, T-24, T-31
- **P1 Tasks:** T-26, T-27, T-28, T-29, T-30
- **Output:** Secure credential handling, TLS enforcement, data retention, privacy notices
- **Verification:** Security audit passed, privacy controls working

### Phase 4: Testing & Deployment (Days 15+, ~30h)
**Goal:** Comprehensive test suite, regulatory compliance evidence, production readiness

- **P1 Tasks:** T-35, T-36, T-37, T-38, T-32, T-33, T-34
- **P0 Tasks:** T-39, T-40
- **Output:** Full test suite, compliance matrix, production environment
- **Verification:** All tests passing, legal approval obtained, ready for production

---

## Definition of Done (DoD) - Standard Checklist

Each task SHALL satisfy:

### Code & Implementation
- [ ] Implementation code written in TypeScript (backend) or React (frontend)
- [ ] Code follows project style guide and conventions
- [ ] Code is reviewed and approved by team lead or tech lead
- [ ] Code is committed to main branch (after PR approval)

### Testing
- [ ] Unit tests written for new functions/classes (target > 90% coverage)
- [ ] Integration tests written for API endpoints and workflows
- [ ] Property-based tests written for critical properties (idempotency, determinism, bounds)
- [ ] All tests pass locally and in CI/CD
- [ ] Security tests pass (OWASP, injection, CSRF, etc.)

### Documentation
- [ ] Code comments added for complex logic
- [ ] Architecture or design documentation updated (if applicable)
- [ ] API documentation updated (if endpoint added)
- [ ] Compliance documentation updated (if requirement addressed)
- [ ] README or contributing guide updated (if process changed)

### Compliance & Verification
- [ ] Acceptance criteria from requirement satisfied
- [ ] Security review completed (if security-sensitive)
- [ ] Legal review completed (if legal-sensitive)
- [ ] Regulatory compliance verified (if compliance-sensitive)

### Performance
- [ ] Performance targets met (latency, throughput, resource usage)
- [ ] No database query N+1 problems introduced
- [ ] No memory leaks or dangling promises

---

## Risk Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Concurrent settlement double-payment | High | Critical | Row-lock atomicity (T-7), fingerprint deduplication (T-4), concurrency tests (T-36) |
| PayPal API downtime | Medium | High | Fail-closed design (T-1), simulated/suppressed rails (T-1), error logging (T-16) |
| Regulatory rejection of architecture | Medium | Critical | Legal review (T-31), compliance matrix (T-33), evidence documentation (T-5) |
| Prompt injection bypass | Medium | High | Comprehensive pattern detection (T-12), security tests (T-38), pattern version control |
| Data breach / credential leak | Low | Critical | No credential persistence (T-18), PII redaction (T-24), secure session (T-20) |
| Budget enforcement bypass | Low | High | Guardrail tests (T-35), property-based budget monotonicity (T-37) |
| GDPR/CCPA non-compliance | Medium | High | Privacy controls (T-26-T-30), DSR endpoints (T-28), retention job (T-27) |
| Test suite insufficient coverage | Medium | Medium | Comprehensive unit/integration/PBT/security tests (T-35-T-38) |

---

## Success Criteria

**Project is successful when:**

1. ✅ All P0 tasks completed and tested (48 hours minimum)
2. ✅ Settlement engine implements fail-closed design (T-1 passing)
3. ✅ Audit scoring is deterministic and non-LLM (T-9 passing)
4. ✅ Budget enforcement blocks overspending (T-13 passing)
5. ✅ Kill-switch activates on security violations (T-14 passing)
6. ✅ PayPal OAuth tokens never persisted (T-18 passing)
7. ✅ TLS 1.2+ enforced on all external calls (T-19 passing)
8. ✅ PII redaction applied before external AI calls (T-24 passing)
9. ✅ Legal disclaimers reviewed and integrated (T-31 passing)
10. ✅ Regulatory compliance matrix complete (T-33 passing)
11. ✅ All tests passing (T-35 through T-38)
12. ✅ Production environment configured (T-39, T-40)
13. ✅ Regulatory approval obtained (legal sign-off)

---

## Appendix: Task Status Board Template

```
STATUS: ████████░░ 80% Complete (48 tasks)

PHASE 1: FOUNDATION (COMPLETE - 100%)
  ✅ T-1: Settlement Engine Fail-Closed
  ✅ T-2: PostgreSQL Ledger Schema
  ✅ T-3: PayPal OAuth Client
  ✅ T-4: Settlement Fingerprint
  ✅ T-7: Settlement Atomicity
  ✅ T-9: Audit Scoring
  ✅ T-10: 85% Gate
  ✅ T-11: Autonomous Threshold

PHASE 2: FRAUD DETECTION (90% COMPLETE)
  ✅ T-12: Prompt Injection Sanitization
  ✅ T-13: Budget Enforcement
  ✅ T-14: Kill-Switch
  🔄 T-15: Rate Limiting (In Progress)
  ⏳ T-16: Audit Logging
  ⏳ T-17: Concurrency Detection

PHASE 3: SECURITY & PRIVACY (60% COMPLETE)
  ✅ T-18: OAuth Token Lifecycle
  ✅ T-19: TLS Enforcement
  ✅ T-20: Session Management
  ✅ T-24: PII Redaction
  🔄 T-26: Data Classification (In Progress)
  ⏳ T-27: Data Retention
  ⏳ T-28: DSR Endpoints
  ⏳ T-29: Privacy Notices
  ⏳ T-30: RBAC
  ✅ T-31: Disclaimers

PHASE 4: TESTING & DEPLOYMENT (20% COMPLETE)
  ⏳ T-32: Compliance Export Signatures
  ⏳ T-33: Compliance Matrix
  ⏳ T-34: Legal Checklist
  ⏳ T-35: Unit Test Suite
  ⏳ T-36: Integration Test Suite
  ⏳ T-37: PBT Suite
  ⏳ T-38: Security Test Suite
  ⏳ T-39: DB Migration
  ⏳ T-40: Environment Config

BLOCKED: None
AT RISK: T-27 (Data Retention Complexity), T-36 (Integration Test Coverage)
COMPLETE: 24/48 (50%)
```

---

## Notes for Implementation Team

- **Start with P0 tasks first:** T-1 through T-7, T-9 through T-14, T-18 through T-20, T-31, T-39, T-40
- **Parallelize where possible:** T-3 and T-2 can run concurrently (no dependencies); same with T-12 and others
- **Test early and often:** Write tests as you implement features (not at the end)
- **Document as you go:** Update ARCHITECTURE.md, COMPLIANCE.md, SECURITY.md incrementally
- **Regulatory review:** Engage legal and compliance teams in parallel (don't wait until end)
- **Production readiness:** Plan deployment gate (T-34) early to unblock final sign-off

---

**Document Version:** 1.0  
**Last Updated:** 2024-01-15  
**Next Review:** Upon completion of Phase 1 (T-1 through T-11)
