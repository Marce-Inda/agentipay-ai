# Design Document: Regulatory Compliance Framework for AgenticPay AI

---

## Executive Summary

AgenticPay AI is architected as a **non-custodial escrow orchestration platform** that bridges AI-assisted contract negotiation with deterministic, server-side financial governance and PayPal-delegated settlement execution. The framework translates fifteen regulatory and compliance requirements into three layered architectural components: (1) a **Trust Boundary & Control Hierarchy** enforcing kill-switch, contract freeze, audit gates, and budget guards; (2) a **Deterministic Guardrail Enforcer** implementing prompt-injection sanitization, payload limiting, and financial limits without reliance on AI models; and (3) a **Server-Authoritative Ledger & Settlement Engine** persisting immutable transaction records and executing atomic, idempotent PayPal payouts under PostgreSQL row-lock protection.

The platform achieves **FinCEN alignment** through explicit non-custody design: no internal customer balances, no fund transmission through the platform, and exclusive OAuth-authenticated delegation to PayPal. **AML/Fraud prevention** operates through heuristic audit scoring (85% threshold, $1,000 autonomous cap, human approval gate), prompt-injection detection, and real-time budget enforcement. **PCI-DSS compliance** is achieved by accepting zero payment card data, delegating all credential handling to PayPal OAuth, and refusing settlement without server-side credentials (fail-closed rails: simulation or suppression in non-production, rejection in production). **GDPR/CCPA compliance** is enabled through PII redaction before external AI calls, transparent data retention policies, role-based access controls, and automated deletion workflows. **Regulatory transparency** is ensured through comprehensive disclaimers, audit-trail logging, and machine-readable compliance exports.

This design document serves as the technical implementation roadmap for converting these fifteen requirements into production-ready controls, data models, API contracts, and testing strategies suitable for regulatory review and financial audit.

---

## 1. System Context Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Client Layer (Next.js 16 App Router)                                 │
│ ┌─────────────────────────────────────────────────────────────────┐ │
│ │ Portfolio View: contract overview, kill-switch UI               │ │
│ │ Workspace View: milestones, audit submission, settlement auth   │ │
│ │ AgentChat: negotiation assistant (no settlement authority)      │ │
│ │ Command Center: transaction ledger, risk display               │ │
│ │                                                                  │ │
│ │ Browser State (Tenant-Scoped localStorage Cache):              │ │
│ │  - agenticpay_profile_v2                                        │ │
│ │  - agenticpay_projects_v2                                       │ │
│ │  - agenticpay_envelope_v2                                       │ │
│ │  - agenticpay_logs_v2                                           │ │
│ │                                                                  │ │
│ │ Trust Boundary: Same-Origin requests, HttpOnly session cookies  │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│ CSRF Token + Session Validation + Tenant Isolation                  │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│ API Layer (Next.js Route Handlers, src/app/api/*)                   │
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │ Authenticated Endpoints:                                        │  │
│ │  POST /api/projects           → ProjectController              │  │
│ │  POST /api/agent/audit        → AuditEngine                    │  │
│ │  POST /api/agent/stream       → AIAdapterWithFallback         │  │
│ │  POST /api/projects/.../settle→ MilestonePayoutExecutor        │  │
│ │  POST /api/projects/.../authorize → HumanAuthController       │  │
│ │  GET  /api/ledger/events      → LedgerQueryService             │  │
│ │  POST /api/envelope/kill-switch→ ControlsController           │  │
│ │                                                                  │  │
│ │ Deterministic Guardrails:                                       │  │
│ │  - GuardrailEnforcer: budget, audit, sanitization, payload     │  │
│ │  - PromptSanitizer: injection pattern detection                │  │
│ │  - PayloadValidator: 12KB deliverable cap                      │  │
│ │  - RateLimiter: process-local fixed windows per user/endpoint  │  │
│ ├────────────────────────────────────────────────────────────────┤  │
│ │ Server State (PostgreSQL):                                      │  │
│ │  - agenticpay_users: identity                                   │  │
│ │  - agenticpay_sessions: SHA-256 token hashes                    │  │
│ │  - agenticpay_projects: tenant-scoped ProjectContract[]         │  │
│ │  - agenticpay_envelopes: user BudgetEnvelope                    │  │
│ │  - agenticpay_ledger_events: immutable transaction records      │  │
│ ├────────────────────────────────────────────────────────────────┤  │
│ │ Trust Boundary: Server-Authoritative, Row Locks, Tenant Keys   │  │
│ │  - Settlement executes under SELECT...FOR UPDATE locks          │  │
│ │  - Deterministic event IDs derived from fingerprints            │  │
│ │  - Immutability enforced: ledger events are append-only         │  │
│ └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│ PayPal Settlement Layer                                               │
│ ┌────────────────────────────────────────────────────────────────┐  │
│ │ Three Fail-Closed Rails:                                       │  │
│ │                                                                  │  │
│ │ [REAL RAIL] (Credentials Configured)                           │  │
│ │  POST /v1/oauth2/token → OAuth Access Token (TLS 1.2+)         │  │
│ │  POST /v1/payments/payouts → Payout with Deterministic Keys   │  │
│ │  Returns: payout_batch_id, batch_status, HTTP logs            │  │
│ │                                                                  │  │
│ │ [SIMULATED RAIL] (No Credentials, PAYPAL_SIMULATION_MODE=true)│  │
│ │  Deterministic simulation without network I/O                  │  │
│ │  Records honest simulated_batch_id in ledger (non-production)  │  │
│ │                                                                  │  │
│ │ [SUPPRESSED RAIL] (No Credentials, Simulation Disabled)        │  │
│ │  Records honest suppressed_settlement in ledger (non-prod)     │  │
│ │                                                                  │  │
│ │ ALL RAILS: Deterministic idempotency (no double-payments)      │  │
│ │  PayPal-Request-Id: REQ-<SHA256(project+milestone+amount)>     │  │
│ │  sender_batch_id: SETTLE-<SHA256(...)>                         │  │
│ └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│ Trust Boundary: OAuth-Authenticated, TLS 1.2+, Certificate Pinning  │
└──────────────────────────────────────────────────────────────────────┘
```

**Trust Boundary Summary:**

| Boundary | Mechanism | Compliance Mapping |
|----------|-----------|-------------------|
| Browser ↔ API | HttpOnly session cookie, CSRF token, same-origin validation | FinCEN: Non-custody delegation; AML: Rate-limited AI calls |
| API ↔ PayPal | OAuth 2.0, TLS 1.2+, deterministic request IDs | PCI-DSS: Zero card custody; FinCEN: OAuth delegation proof |
| API ↔ PostgreSQL | Row locks (SELECT...FOR UPDATE), tenant keys | FinCEN: Atomic settlement; AML: Immutable audit trail |
| Client ↔ PostgreSQL | Indirection through API; client storage is read-only cache | GDPR: Server-authoritative state; Privacy: PII not cached |

---

## 2. Settlement Flow Architecture

### Settlement Swimlane Diagram

```
Client (Browser)              API Layer                  PayPal Sandbox
─────────────────             ────────────               ──────────────

                              [Settlement Transaction]
                              BEGIN PostgreSQL TX
                              SELECT projects FOR UPDATE
                              SELECT envelopes FOR UPDATE
                              SELECT milestone
                              SELECT last ledger event

Contract created              ↓
Milestone ready        POST /settle
Audit score ≥ 85%      ─────────────→
Amount: $500              ├─ Verify: kill-switch=false
Human approval              ├─ Verify: contract status=ACTIVE
(if > $1K or INCOMING)      ├─ Verify: milestone audit score ≥ 85%
                            ├─ Verify: amount ≤ maxPerTransactionUSD
                            ├─ Verify: spentToday + amount ≤ dailyCeiling
                            ├─ Verify: remaining budget ≥ amount
                            │
                            ├─ Deduplicate: check if ledger has
                            │  event with fingerprint hash
                            │  (prevents double-payment on retry)
                            │
                            ├─ [CREDENTIALS CONFIGURED?]
                            │   YES → Invoke PayPal OAuth
                            │   NO  → Fail-closed (HTTP 502)
                            │
                            ├─ PayPal OAuth Token Refresh
                            │   POST /v1/oauth2/token
                            └────────────────────────────────→ /v1/oauth2/token
                                                             ← { access_token, expires_in }
                            │
                            ├─ Construct Payout Request
                            │  sender_batch_id: SETTLE-<hash>
                            │  PayPal-Request-Id: REQ-<hash>
                            │  amount, currency, recipient_email
                            │
                            ├─ Execute Payout
                            │  POST /v1/payments/payouts
                            └────────────────────────────────→ /v1/payments/payouts
                                                             ← { payout_batch_id,
                                                                 batch_status,
                                                                 timestamp }
                            │
                            ├─ [Payout Success?]
                            │  YES → Atomically:
                            │    • Mark milestone COMPLETED
                            │    • Increment project.spentUSD
                            │    • Increment envelope.spentTodayUSD
                            │    • Insert PAYOUT_EXECUTED ledger event
                            │      with PayPal batch ID
                            │    COMMIT PostgreSQL TX
                            │
                            │  NO (HTTP 4xx/5xx from PayPal)
                            │    • Insert PAYOUT_BLOCKED event
                            │    • ROLLBACK PostgreSQL TX
                            │    • Return HTTP 502
                            │
Settlement status          ← HTTP 200 / 502
displays (real/simulated)    { project, envelope,
                              ledger_event }
                            ↓
Cache reconciled        [Cache Update]
& UI updated            agenticpay_projects_v2 ← new project state
                        agenticpay_envelope_v2 ← new budget state
                        agenticpay_logs_v2 ← new ledger events
```

### Settlement Phases

**Phase 1: Pre-Settlement Validation (< 50ms)**
- Load tenant-scoped project, envelope, milestone under row locks
- Validate kill-switch (global + request-declared)
- Validate contract status = ACTIVE
- Validate milestone status = AUDITED_PENDING_APPROVAL or AUDITED_ELIGIBLE_FOR_AUTONOMOUS_SETTLEMENT
- Validate audit confidence score ≥ 85% (server record, not client-supplied)
- Validate amount is positive and ≤ maxPerTransactionUSD
- Validate spentTodayUSD + amount ≤ dailyCeiling
- Validate remaining project budget ≥ amount

**Phase 2: Deduplication Check (< 10ms)**
- Compute settlement fingerprint: SHA256(projectId, milestoneId, amount)
- Query ledger for existing PAYOUT_EXECUTED event with same fingerprint
- If exists, return cached result (no PayPal re-invocation)

**Phase 3: PayPal OAuth & Payout Execution (200–500ms)**
- Verify PayPal credentials are configured (PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET)
  - If missing: Fail-closed (HTTP 502, no record if production; simulated/suppressed record if non-production)
- Invoke PayPal OAuth token endpoint with client credentials
  - If token refresh fails: Log OAUTH_TOKEN_REFRESH_FAILED, return HTTP 502
- Construct payout request with deterministic request IDs
- Invoke PayPal Payouts API with TLS 1.2+ and certificate verification
  - Real rail: real payout_batch_id in response
  - Simulated rail: deterministic simulated_batch_id (no network I/O)
  - Suppressed rail: deterministic suppressed_batch_id (no network I/O)

**Phase 4: Atomic Ledger & State Update (< 50ms)**
- On PayPal success:
  - Mark milestone COMPLETED
  - Increment project.spentUSD by amount
  - Increment envelope.spentTodayUSD by amount
  - Insert PAYOUT_EXECUTED ledger event with deterministic event ID, PayPal batch ID, HTTP log, timestamp
  - COMMIT PostgreSQL transaction
- On PayPal failure (HTTP 4xx/5xx):
  - Insert PAYOUT_BLOCKED security event with error details
  - ROLLBACK PostgreSQL transaction (no state mutation)
  - Return HTTP 502 with structured error

**Phase 5: Cache Reconciliation (< 100ms)**
- Return updated project, envelope, ledger event to client
- Client reconciles browser cache (agenticpay_projects_v2, agenticpay_envelope_v2, agenticpay_logs_v2)
- UI reflects settlement completion or error

---

## 3. Control Hierarchy Diagram

```
                    Master Kill-Switch (Req 2.5)
                    ┌─────────────────────────┐
                    │ killSwitchActive = true │
                    │ BLOCKS: All settlement  │
                    │ Priority: HIGHEST       │
                    └────────┬────────────────┘
                             │ REJECT (HTTP 423)
                             ↓
                    Contract Freeze (Req 1.3)
                    ┌──────────────────────────┐
                    │ status ≠ ACTIVE          │
                    │ (PAUSED/COMPLETED/...)   │
                    │ BLOCKS: Audit + settlement
                    └────────┬─────────────────┘
                             │ REJECT (HTTP 423)
                             ↓
                    Audit Gate (Req 2.1)
                    ┌──────────────────────────┐
                    │ confidence_score ≥ 85%   │
                    │ REJECTS: < 85% scores    │
                    │ Priority: HIGH           │
                    └────────┬─────────────────┘
                             │ REJECT (HTTP 422)
                             ↓
                    Budget Guards (Req 2.4)
                    ┌──────────────────────────┐
                    │ amount ≤ maxPerTransaction
                    │ spentToday + amount ≤    │
                    │   dailyCeiling           │
                    │ remaining_budget ≥ amount
                    │ Priority: HIGH           │
                    └────────┬─────────────────┘
                             │ REJECT (HTTP 422)
                             ↓
            Human Approval Gate (Req 2.2)
            ┌─────────────────────────────────────┐
            │ IF amount > $1,000 USD:             │
            │   status = AUDITED_PENDING_APPROVAL │
            │   BLOCKS: Until explicit auth       │
            │                                     │
            │ IF perspective = INCOMING:          │
            │   status = AUDITED_PENDING_APPROVAL │
            │   BLOCKS: Until explicit auth       │
            │                                     │
            │ ELSE (≤ $1K + OUTGOING):            │
            │   status = AUDITED_ELIGIBLE...      │
            │   PROCEEDS: Autonomous settlement   │
            │ Priority: MEDIUM                    │
            └────────┬────────────────────────────┘
                     │ REJECT (HTTP 422) or PROCEED
                     ↓
            ┌─────────────────────────────────────┐
            │ PayPal Payout Execution             │
            │ (Deterministic, Idempotent)         │
            │ Real/Simulated/Suppressed Rail      │
            │                                     │
            │ Result:                             │
            │  • PAYOUT_EXECUTED (success)        │
            │  • PAYOUT_BLOCKED (failure)         │
            └─────────────────────────────────────┘
```

**Control Order & Fail-Fast Strategy:**

1. **Kill-Switch (Highest Priority):** Returns HTTP 423 immediately, no further processing
2. **Contract Freeze:** Returns HTTP 423, blocks both audit and settlement
3. **Audit Gate:** Returns HTTP 422 if score < 85%, prevents settlement eligibility
4. **Budget Guards:** Returns HTTP 422 if any budget check fails, no payout execution
5. **Human Approval:** Returns HTTP 422 if high-value/incoming and not yet authorized
6. **PayPal Execution:** Only proceeds if all prior checks pass; returns HTTP 200 or 502

**Invariants Enforced by Control Hierarchy:**

- **No settlement without 85% audit confidence** (Audit Gate blocks)
- **No settlement exceeding per-transaction or daily budget** (Budget Guards block)
- **No settlement above $1K without human authorization** (Approval Gate blocks)
- **No settlement without PayPal credentials in production** (Fail-closed rail returns HTTP 502)
- **Kill-switch always takes precedence** (checked first, before any other validation)

---

## 4. Security Boundaries & Trust Model

### Data Classification & Trust Levels

| Data Category | Classification | Storage | Transit | Access Control |
|---|---|---|---|---|
| Session cookies | Restricted | HttpOnly, SameSite=Lax | TLS 1.2+ | Opaque; SHA-256 hashed in DB |
| PayPal OAuth token | Restricted | Process memory only (not persisted) | TLS 1.2+ with bearer auth | Server-side only |
| Project/Contract data | Confidential | PostgreSQL, tenant-keyed | TLS 1.2+ | Authenticated user + ownership check |
| Milestone amounts | Confidential | PostgreSQL, tenant-keyed | TLS 1.2+ | Authenticated user + RBAC |
| Audit scores/rationale | Internal | PostgreSQL, tenant-keyed | TLS 1.2+ | Authenticated user (workspace admin) |
| Ledger events | Confidential | PostgreSQL, append-only | TLS 1.2+ over HTTPS | Auditors (redacted); account owner (full) |
| User email/contact | Internal | PostgreSQL, tenant-keyed | TLS 1.2+ | Account owner; privacy controls |
| PayPal batch IDs | Confidential | PostgreSQL ledger, audit trail | TLS 1.2+ | Auditors (with credentials safeguards) |
| AI provider keys | Restricted | Environment variables (server-only) | Never in client bundle | Server-side only; never logged |
| Deliverable text | Confidential | Temporary (audit), then archived in ledger | TLS 1.2+ | Tenant-scoped; redacted for AI calls |
| Customer payment routing | Restricted | None (delegated to PayPal) | PayPal OAuth delegates | PayPal credential delegation |

### Trust Boundaries in Detail

**Boundary 1: Browser ↔ API (Same-Origin Validation)**
- **Control:** All route handlers validate `origin` header matches `NEXT_PUBLIC_APP_URL`
- **Session Token:** Opaque 32-byte cryptographic random token; stored in HttpOnly, SameSite=Lax cookie
- **CSRF Protection:** Origin validation + form-submitted requests require matching origin
- **Tenant Isolation:** All queries keyed by authenticated user ID; no cross-tenant data leakage
- **Evidence:** Session hash stored in PostgreSQL; browser stores only cookie

**Boundary 2: API ↔ PostgreSQL (Row-Lock Atomicity)**
- **Control:** Settlement transaction executes under `SELECT projects FOR UPDATE` and `SELECT envelopes FOR UPDATE` row locks
- **Determinism:** Ledger event IDs derived from settlement fingerprint (SHA256) ensure deduplication across retries
- **Immutability:** Ledger events are append-only; no UPDATE or DELETE allowed on PAYOUT_EXECUTED records
- **Tenant Isolation:** All queries filtered by `WHERE user_id = $1`; database-level tenant keys
- **Evidence:** Row-lock timestamps, deterministic event ID derivation, audit trail

**Boundary 3: API ↔ PayPal (OAuth Delegation)**
- **Control:** OAuth 2.0 access token obtained via `/v1/oauth2/token` with client credentials
- **Transmission:** TLS 1.2+ with certificate verification; no certificate pinning (optional for production)
- **Token Lifecycle:** Access tokens are in-memory only, cached with 60-second early-expiration buffer
- **Idempotency:** Deterministic `PayPal-Request-Id` and `sender_batch_id` prevent duplicate payouts
- **Failure Handling:** On OAuth failure or payout rejection, transaction rolls back atomically; HTTP 502 returned
- **Evidence:** HTTP payload logs (redacted) stored in ledger; real PayPal batch ID recorded

**Boundary 4: Client State ↔ Server State (Cache Reconciliation)**
- **Control:** Browser cache (localStorage) is read-only; only the server can mutate state
- **Hydration:** After sign-in, client loads `/api/projects` and populates cache from server
- **Conflict Resolution:** Server state is authoritative; client-supplied spend, audit evidence, completion status are ignored
- **Bootstrap Sanitization:** `POST /api/projects/bootstrap` resets spend to 0, milestones to PENDING, audit scores discarded
- **Evidence:** Cache versioning (v2); mismatch triggers re-hydration from server

### Threat Model & Mitigations

| Threat | Attack Vector | Mitigation | Evidence |
|---|---|---|---|
| **Cross-Site Request Forgery (CSRF)** | Attacker tricks user into submitting request from malicious origin | Same-origin header validation, opaque session cookies | Origin header checked in every route handler |
| **Prompt Injection** | Malicious user input overrides audit rules or settlement authorization | Pattern-based sanitization, payload limiting (12KB) | BLOCKED_INJECTION_ATTEMPT logging; sanitized input in ledger |
| **Double-Payment** | Attacker retries settlement to execute duplicate payout | Deterministic idempotency (SHA256 fingerprint) + ledger deduplication | Settlement fingerprint → PayPal-Request-Id (deterministic) |
| **Session Hijacking** | Attacker steals session cookie | HttpOnly cookie (no JS access), SameSite=Lax, TLS 1.2+ | Session token hash in DB; opaque cookie in browser |
| **SQL Injection** | Attacker injects SQL via user input | Parameterized queries (TypeScript ORMs) | Code review of all DB interactions; no raw SQL |
| **Privilege Escalation** | User modifies client-side settlement amount | Server revalidates server-stored audit score & amount; client input ignored | Settlement reloads server project/envelope; client values discarded |
| **Man-in-the-Middle (MITM)** | Attacker eavesdrops on PayPal communication | TLS 1.2+ with certificate verification | Mandatory HTTPS redirect; cert verification in PayPal client |
| **OAuth Token Theft** | Attacker steals PayPal access token | Tokens stored in process memory only; never persisted or logged | Token expiration (≤ 1 hour); no database storage |
| **Kill-Switch Bypass** | User attempts to settle with kill-switch flag modified client-side | Server reads authoritative kill-switch from PostgreSQL envelope | Kill-switch checked server-side; client-declared flag is secondary check |
| **Ledger Tampering** | Attacker modifies or deletes historical ledger event | Append-only ledger; immutability enforced in database schema | No UPDATE/DELETE on PAYOUT_EXECUTED; audit trail immutable |

---

## 5. Compliance Control Matrix

Maps 15 requirements → component responsibilities → testing strategy:

| # | Requirement | Primary Component | Secondary Components | Test Strategy | Evidence |
|---|---|---|---|---|---|
| 1.1 | Non-Custodial Architecture | MilestonePayoutExecutor | GuardrailEnforcer, PayPalClient | Integration: Settlement without credentials fails HTTP 502; simulation/suppressed logged | Settlement logs, PayPal integration tests, credential absence handling |
| 1.2 | Documentation & Evidence | ComplianceReporter | All components | Audit: Review COMPLIANCE.md, ARCHITECTURE.md, SECURITY.md; verify ledger export | Regulatory export endpoint; PAYOUT_EXECUTED/PAYOUT_BLOCKED records |
| 1.3 | Governance Control Documentation | ControlHierarchy (Guardian) | GuardrailEnforcer, MilestonePayoutExecutor | Unit: All 7 control conditions tested in isolation; integration: concurrent settlement attempts | Guard enforcement tests; control order verification |
| 2.1 | AI-Driven Fraud Detection | AuditEngine | GuardrailEnforcer | Unit: All 6 scoring pathways; property-based: score(input) is deterministic | Audit scoring tests; ledger score records; GitHub URL handling |
| 2.2 | Autonomous Settlement Threshold | HumanAuthController | GuardrailEnforcer, MilestonePayoutExecutor | Unit: $1K boundary, INCOMING contract; integration: auth → settlement | Settlement authorization tests; ledger actor labels |
| 2.3 | Prompt Injection Sanitization | PromptSanitizer (GuardrailEnforcer) | All AI-consuming routes | Unit: Known patterns replaced with [BLOCKED_...]; fuzz: invalid input doesn't crash | Security event logs; sanitized ledger payloads |
| 2.4 | Budget Enforcement | GuardrailEnforcer | MilestonePayoutExecutor | Unit: Per-transaction, daily, remaining-budget checks; property-based: budget monotonic | Budget validation tests; ledger spend tracking |
| 2.5 | Kill-Switch & Freeze | ControlsController (Guardian) | GuardrailEnforcer, MilestonePayoutExecutor | Unit: kill-switch activation blocks audit/settlement; contract freeze tested | Security events; control hierarchy tests |
| 3.1 | Non-Custodial Data & Credential Delegation | PayPalClient | MilestonePayoutExecutor | Code review: No PAN/card data; bundle analysis: no NEXT_PUBLIC_PAYPAL_SECRET | Build output inspection; credential handling code review |
| 3.2 | OAuth Token Lifecycle | PayPalClient | MilestonePayoutExecutor | Unit: Token refresh on expiration; property-based: token lifetime bounded by OAuth response | Token refresh tests; OAuth mocking |
| 3.3 | Deterministic Idempotency | MilestonePayoutExecutor | PayPalClient, SettlementEngine | Property-based: fingerprint → hash is deterministic; double-settlement returns same result | Idempotency tests; duplicate prevention tests |
| 3.4 | TLS Enforcement & Encryption | PayPalClient, HTTPS Config | All external calls | Integration: PayPal calls use TLS 1.2+; certificate validation succeeds; HTTP redirect to HTTPS | Network capture; cert verification tests |
| 4.1 | PII Redaction Before AI Calls | PIIRedactor (GuardrailEnforcer) | AI adapter routes | Unit: Known PII patterns redacted; false-positive analysis; response redaction | Redaction tests; security event logs |
| 4.2 | Data Retention & Deletion | DataRetentionService | LedgerService, UserService | Integration: Records flagged for deletion after retention period; grace period tested | Retention policy tests; deletion job logs |
| 4.3 | Data Classification & Access Controls | RBACMiddleware | All routes | Unit: Unauthorized user gets HTTP 403 no resource enumeration; role tests | Access control tests; RBAC enforcement tests |
| 4.4 | Transparency & Privacy Notices | LegalController, UI | AccountSettingsModal, SettlementConfirmation | Manual: Privacy policy reviewed by counsel; consent banner displayed; DSR endpoints tested | Privacy policy review; UI consent tests; DSR endpoint tests |
| 5.1 | Regulatory Disclaimer | LegalController, UI | AccountSettingsModal, SettlementConfirmation | Manual: Disclaimer in ToS; settlement confirmation dialog; REGULATORY_DISCLAIMER_ACCEPTED env var required | ToS review; UI confirmation dialog; deployment script verification |
| 5.2 | Compliance Reporting & Audit Export | ComplianceReporter | LedgerService | Integration: Audit export endpoint generates machine-readable JSON; digital signatures verified | Audit export tests; signature verification |

---

## 6. Deterministic Guardrail Enforcer Architecture

### Core Responsibilities

The `GuardrailEnforcer` (src/lib/guardrails/enforcer.ts) centralizes all non-AI, deterministic financial and security controls. It operates synchronously and without side effects, ensuring determinism and auditability.

### Methods & Specifications

```typescript
// Formal specification: Budget Validation
function validateTransactionBudget(
  params: {
    amount: number (USD)
    maxPerTransaction: number (USD)
    dailySpent: number (USD)
    dailyCeiling: number (USD)
    projectRemaining: number (USD)
    killSwitchActive: boolean
  }
): Result<BudgetValidation>

Preconditions:
  • amount > 0
  • maxPerTransaction > 0
  • dailyCeiling >= maxPerTransaction
  • dailySpent <= dailyCeiling
  • projectRemaining >= 0

Postconditions:
  • If killSwitchActive = true: returns { valid: false, reason: "KILL_SWITCH_ACTIVE" }
  • If amount > maxPerTransaction: returns { valid: false, reason: "EXCEEDS_PER_TRANSACTION_LIMIT" }
  • If dailySpent + amount > dailyCeiling: returns { valid: false, reason: "EXCEEDS_DAILY_CEILING" }
  • If amount > projectRemaining: returns { valid: false, reason: "EXCEEDS_PROJECT_BUDGET" }
  • Else: returns { valid: true, riskLevel: "LOW" | "MEDIUM" | "HIGH" }

Invariants:
  • Function is idempotent: f(x) = f(f(x))
  • Same input always produces same output
  • No side effects (no logging, DB writes during validation)
  • Execution time < 50ms
```

```typescript
// Formal specification: Prompt Sanitization
function sanitizePromptInput(input: string): string

Preconditions:
  • input is a non-null string
  • input.length <= 8000 characters

Postconditions:
  • All detected instruction-override patterns replaced with "[BLOCKED_INJECTION_ATTEMPT]"
  • Known patterns: "ignore previous", "you are now", "assume role", "override", "disable guardrail"
  • Returns sanitized string with same length as input (patterns replaced in-place)
  • Idempotent: sanitize(sanitize(x)) = sanitize(x)

Invariants:
  • No legitimate user content is removed (only malicious patterns)
  • Sanitization time < 10ms
  • Sanitized output is deterministic for same input
```

```typescript
// Formal specification: Audit Confidence Scoring
function evaluateAuditConfidence(
  params: {
    deliverableText: string
    deliverableUrl: string | null
    amount: number (USD)
    hasPromptInjection: boolean
  }
): AuditResult

Preconditions:
  • deliverableText is non-null and <= 12000 chars (after sanitization)
  • amount > 0
  • deliverableText or deliverableUrl is provided

Postconditions:
  • If hasPromptInjection: score = 15
  • If deliverableUrl contains "github.com" or "github": score = 91–99 (based on content match)
  • If deliverableText matches required keywords: score = 86–90
  • If deliverableText is very short (< 50 chars) without URL: score = 55
  • Else: score = 86
  • If score < 85: status = AUDITED_REJECTED
  • If score >= 85 && amount <= 1000: status = AUDITED_ELIGIBLE_FOR_AUTONOMOUS_SETTLEMENT
  • If score >= 85 && amount > 1000: status = AUDITED_PENDING_HUMAN_APPROVAL
  • If score >= 85 && perspective = INCOMING: status = AUDITED_PENDING_HUMAN_APPROVAL

Invariants:
  • Score is always in range [0, 100]
  • Same deliverable always produces same score
  • Scoring time < 50ms
  • No external API calls (deterministic local computation)
```

### Error Handling & Fail-Closed Design

| Check | Pass | Fail | Response |
|---|---|---|---|
| `validateTransactionBudget` | Proceeds to next check | HTTP 422 with reason | Structured error; no payout |
| `evaluateAuditConfidence` | Proceeds if ≥ 85% | HTTP 422 if < 85% | AUDITED_REJECTED ledger event |
| `sanitizePromptInput` | Proceeds | Logs injection attempt, but does not block (content replaced) | SECURITY_VIOLATION event; kill-switch on repeat |
| `validatePayloadSize` | Proceeds if ≤ 12KB | Truncates; logs truncation | Audit proceeds with truncated text |

---

## 7. Data Model & Ledger Design

### ProjectContract Schema

```typescript
interface ProjectContract {
  id: UUID                              // Tenant-scoped project ID
  name: string                          // Contract name (e.g., "Website Redesign Q2 2024")
  vendorName: string                    // Contractor/vendor name
  vendorEmail: string                   // Settlement recipient email
  clientName?: string                   // Optional: client/buyer name
  clientEmail?: string                  // Optional: client/buyer email
  budgetCapUSD: number                  // Total contract budget cap (e.g., 50000)
  spentUSD: number                      // Total payout amount (incremented on settlement)
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED"  // Contract state
  perspective: "OUTGOING" | "INCOMING"  // Client/contractor view
  contractType: string                  // "SERVICE" | "PRODUCT" | "MIXED"
  contractReferenceId: string           // External reference (e.g., invoice #, Stripe connect ID)
  isSubcontracted: boolean              // Whether this is a subcontract
  parentProjectId?: UUID                // Parent contract if subcontracted
  milestones: Milestone[]               // Array of milestone objects
  createdAt: ISO8601                    // Contract creation timestamp
  updatedAt: ISO8601                    // Last modification timestamp
  userID: UUID                          // Tenant key for isolation
}

// Milestone object
interface Milestone {
  id: UUID                              // Unique milestone ID
  description: string                   // Acceptance criteria / deliverable description
  amountUSD: number                     // Payout amount for this milestone (e.g., 10000)
  status: "PENDING" | "AUDITED_PENDING_APPROVAL" | "AUDITED_ELIGIBLE_FOR_AUTONOMOUS_SETTLEMENT" | "COMPLETED" | "REJECTED"
  auditConfidenceScore?: number         // 0–100; null until audit submitted
  auditRationale?: string               // Why score was assigned (e.g., "GitHub PR verified")
  auditProofUrl?: string                // URL to artifact (e.g., GitHub PR link)
  auditSubmissionTime?: ISO8601         // When deliverable was submitted
  approvalRequired: boolean             // Deprecated; use status field
  approvalActor?: string                // Actor who approved (e.g., "workspace_user_123")
  approvalTime?: ISO8601                // When human authorized settlement
  settlementReference?: {               // PayPal settlement metadata
    paypalBatchId: string               // Real or simulated batch ID
    batchStatus: string                 // "SUCCESS" | "PENDING" | "FAILED"
    paypalPayoutId?: string             // Individual payout ID within batch
    settlementTime: ISO8601             // When payout was executed
    transactionHash?: string            // Deterministic fingerprint for idempotency
  }
  completedAt?: ISO8601                 // Timestamp of completion
}
```

### BudgetEnvelope Schema

```typescript
interface BudgetEnvelope {
  id: UUID                              // Envelope ID (one per user account)
  userId: UUID                          // Tenant key
  maxPerTransactionUSD: number          // Per-transaction ceiling (default: 25000)
  dailyCeilingUSD: number               // Daily aggregate ceiling (default: 100000)
  spentTodayUSD: number                 // Amount settled in current calendar day (UTC)
  activeEscrowUSD: number               // Total in-flight (unsettled) milestone amounts
  killSwitchActive: boolean             // Master kill-switch flag
  createdAt: ISO8601
  updatedAt: ISO8601
  lastResetAt: ISO8601                  // Last time spentTodayUSD was reset (UTC midnight)
}
```

### LedgerEvent (Immutable, Append-Only)

```typescript
interface LedgerEvent {
  id: string                            // Deterministic hash: SHA256(projectId+milestoneId+amount+timestamp)
  userId: UUID                          // Tenant key
  projectId: UUID                       // Associated project
  milestoneId?: UUID                    // Associated milestone (optional for non-settlement events)
  timestamp: ISO8601                    // Event creation time (UTC)
  actor: "BUYER_AI" | "SELLER_AI" | "GUARDRAIL" | "PAYPAL_API" | "HUMAN" | "SYSTEM"
  action: "CONTRACT_CREATED" | "MILESTONE_SUBMITTED" | "AUDIT_SCORED" | "AUDITED_REJECTED" |
           "HUMAN_AUTHORIZED_SETTLEMENT" | "PAYOUT_EXECUTED" | "PAYOUT_BLOCKED" |
           "KILL_SWITCH_ACTIVATED" | "KILL_SWITCH_DEACTIVATED" | "SECURITY_VIOLATION_*" |
           "RATE_LIMITED" | "OAUTH_TOKEN_REFRESH_FAILED" | "ENVELOPE_LIMIT_UPDATED"
  
  amountUSD?: number                    // For settlement events
  auditConfidenceScore?: number         // For audit events (0–100)
  auditRationale?: string               // For audit events
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" // Risk classification
  status: "SUCCESS" | "PENDING" | "FAILED" | "BLOCKED" | "REJECTED"
  
  paypalBatchId?: string                // For PAYOUT_EXECUTED events (real or simulated)
  paypalBatchStatus?: string            // From PayPal response
  paypalHttpStatus?: number             // HTTP status code from PayPal
  paypalHttpLog?: string                // Redacted HTTP request/response (auth headers excluded)
  
  recipient?: string                    // Email or PayPal account for settlement
  reason?: string                       // For REJECTED, BLOCKED, or error events
  
  // Immutability enforcement
  createdAt: ISO8601
  // No updatedAt, deletedAt, or modification flags; events are immutable
}
```

### Deterministic Event ID Derivation

```typescript
// Event ID is derived deterministically from settlement fingerprint
// ensuring deduplication across retries and preventing double-payments

function deriveEventId(
  projectId: UUID,
  milestoneId: UUID,
  amountUSD: number,
  timestamp: ISO8601
): string {
  const fingerprint = `${projectId}:${milestoneId}:${Math.floor(amountUSD * 100)}:${timestamp}`
  const hash = SHA256(fingerprint)
  return hash.substring(0, 32)  // First 32 hex characters
}

// PayPal Request ID (same mechanism)
function derivePayPalRequestId(
  projectId: UUID,
  milestoneId: UUID,
  amountUSD: number
): string {
  const fingerprint = `${projectId}:${milestoneId}:${Math.floor(amountUSD * 100)}`
  const hash = SHA256(fingerprint)
  return `REQ-${hash.substring(0, 32)}`
}

// Sender Batch ID (same mechanism)
function deriveSenderBatchId(
  projectId: UUID,
  milestoneId: UUID,
  amountUSD: number
): string {
  const fingerprint = `${projectId}:${milestoneId}:${Math.floor(amountUSD * 100)}`
  const hash = SHA256(fingerprint)
  return `SETTLE-${hash.substring(0, 32)}`
}

// Invariant: Same fingerprint always produces same IDs (deterministic, idempotent)
// Retry of same settlement produces identical PayPal-Request-Id and sender_batch_id
// → PayPal recognizes as duplicate → returns existing payout result (no double-payment)
```

---

## 8. Regulatory Compliance Layer Architecture

### ComplianceReporter (Audit Export & Regulatory Evidence)

```typescript
interface ComplianceExportRequest {
  dateRangeStart: ISO8601
  dateRangeEnd: ISO8601
  includeRedactedPii: boolean           // false for account owner, true for auditors
  format: "json" | "csv"                // Machine-readable formats
}

interface ComplianceExportResponse {
  organizationId: UUID
  exportTimestamp: ISO8601
  totalRecords: number
  
  summary: {
    totalSettled: number (USD)
    totalRejected: number
    totalHumanAuthorized: number
    totalAutonomousSettled: number
    killSwitchActivations: number
    securityEvents: number
  }
  
  ledgerEvents: LedgerEvent[]           // Complete audit trail (sensitive fields redacted for auditors)
  
  projects: Array<{
    projectId: UUID
    name: string
    status: string
    budgetCap: number
    totalSpent: number
    completedMilestones: number
  }>
  
  auditTrail: Array<{
    timestamp: ISO8601
    actor: string
    action: string
    result: "SUCCESS" | "BLOCKED" | "REJECTED"
    reason?: string
  }>
  
  digitalSignature?: string              // Optional: HMAC-SHA256(exportData, signingKey)
}
```

### MilestonePayoutExecutor (Settlement Engine)

Orchestrates atomic settlement with PostgreSQL row locks and PayPal delegation:

```typescript
interface SettlementRequest {
  projectId: UUID
  milestoneId: UUID
  auditScore: number                    // Server-side only; client value ignored
  humanAuthorized?: boolean             // true if explicitly approved; undefined if autonomous
}

interface SettlementResult {
  success: boolean
  milestone: Milestone                  // Updated milestone with settlement metadata
  project: ProjectContract              // Updated project with spentUSD
  envelope: BudgetEnvelope              // Updated envelope with spentToday
  ledgerEvent: LedgerEvent              // PAYOUT_EXECUTED or PAYOUT_BLOCKED event
  error?: string
}

// Pseudocode: Settlement Engine Algorithm
ALGORITHM settleMilestone(request: SettlementRequest)
INPUT: Settlement request with project, milestone, audit score
OUTPUT: Settlement result or error

BEGIN
  // Phase 1: Acquire Row Locks
  BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE
  
  project ← SELECT projects FOR UPDATE WHERE id = request.projectId
  envelope ← SELECT envelopes FOR UPDATE WHERE userId = authentication.userId
  milestone ← SELECT milestone FROM project WHERE id = request.milestoneId
  
  lastEvent ← SELECT * FROM ledger_events 
              WHERE projectId = request.projectId 
              AND milestoneId = request.milestoneId
              ORDER BY timestamp DESC
              LIMIT 1
  
  // Phase 2: Validation (Control Hierarchy)
  IF envelope.killSwitchActive = true THEN
    RETURN { success: false, error: "KILL_SWITCH_ACTIVE" }
  END IF
  
  IF project.status ≠ "ACTIVE" THEN
    RETURN { success: false, error: "CONTRACT_FROZEN" }
  END IF
  
  IF milestone.auditConfidenceScore < 85 THEN
    RETURN { success: false, error: "INSUFFICIENT_AUDIT_CONFIDENCE" }
  END IF
  
  IF request.amount > envelope.maxPerTransactionUSD THEN
    RETURN { success: false, error: "EXCEEDS_PER_TRANSACTION_LIMIT" }
  END IF
  
  IF envelope.spentTodayUSD + request.amount > envelope.dailyCeilingUSD THEN
    RETURN { success: false, error: "EXCEEDS_DAILY_CEILING" }
  END IF
  
  IF request.amount > (project.budgetCapUSD - project.spentUSD) THEN
    RETURN { success: false, error: "EXCEEDS_PROJECT_BUDGET" }
  END IF
  
  // Phase 3: Deduplication
  fingerprint ← deriveFingerprint(project.id, milestone.id, request.amount)
  existingEvent ← SELECT * FROM ledger_events WHERE eventId = hash(fingerprint)
  
  IF existingEvent.action = "PAYOUT_EXECUTED" THEN
    RETURN { success: true, ledgerEvent: existingEvent }  // Cached result
  END IF
  
  // Phase 4: Human Authorization Check
  IF request.amount > 1000 OR project.perspective = "INCOMING" THEN
    IF NOT request.humanAuthorized THEN
      milestone.status ← "AUDITED_PENDING_APPROVAL"
      RETURN { success: false, error: "HUMAN_APPROVAL_REQUIRED" }
    END IF
  END IF
  
  // Phase 5: PayPal Execution
  credentials ← loadPayPalCredentials()  // From environment
  
  IF credentials = NULL THEN
    // Fail-closed: Simulation or Suppression in non-production; Rejection in production
    IF ENVIRONMENT = "PRODUCTION" THEN
      RETURN { success: false, error: "PAYPAL_CREDENTIALS_MISSING_PRODUCTION" }
    ELSE IF PAYPAL_SIMULATION_MODE = true THEN
      simBatchId ← generateSimulatedBatchId(fingerprint)
      batchStatus ← "SIMULATED_SUCCESS"
    ELSE
      simBatchId ← generateSuppressedBatchId(fingerprint)
      batchStatus ← "SUPPRESSED_SETTLEMENT"
    END IF
  ELSE
    // Real PayPal Execution
    token ← requestOAuthToken(credentials)
    IF token = NULL THEN
      INSERT INTO ledger_events VALUES (
        action: "OAUTH_TOKEN_REFRESH_FAILED",
        status: "FAILED"
      )
      ROLLBACK TRANSACTION
      RETURN { success: false, error: "OAUTH_TOKEN_REFRESH_FAILED" }
    END IF
    
    payoutRequest ← {
      sender_batch_id: deriveSenderBatchId(fingerprint),
      email_subject: "Milestone Settlement - AgenticPay AI",
      items: [{
        amount: request.amount,
        currency: "USD",
        recipient_type: "EMAIL",
        receiver: milestone.recipientEmail
      }]
    }
    
    paypalResponse ← POST /v1/payments/payouts
                     WITH Authorization: Bearer <token>
                     AND PayPal-Request-Id: derivePayPalRequestId(fingerprint)
                     AND TLS 1.2+
                     AND certificate verification
    
    IF paypalResponse.status IN [200, 201] THEN
      simBatchId ← paypalResponse.payout_batch_id
      batchStatus ← paypalResponse.batch_status
    ELSE
      INSERT INTO ledger_events VALUES (
        action: "PAYOUT_BLOCKED",
        paypalHttpStatus: paypalResponse.status,
        reason: paypalResponse.error,
        status: "FAILED"
      )
      ROLLBACK TRANSACTION
      RETURN { success: false, error: "PAYOUT_FAILED", paypalStatus: paypalResponse.status }
    END IF
  END IF
  
  // Phase 6: Atomic Ledger & State Update
  milestone.status ← "COMPLETED"
  milestone.settlementReference ← {
    paypalBatchId: simBatchId,
    batchStatus: batchStatus,
    settlementTime: NOW()
  }
  
  project.spentUSD ← project.spentUSD + request.amount
  envelope.spentTodayUSD ← envelope.spentTodayUSD + request.amount
  
  event ← INSERT INTO ledger_events VALUES (
    id: hash(fingerprint),
    action: "PAYOUT_EXECUTED",
    paypalBatchId: simBatchId,
    amountUSD: request.amount,
    actor: request.humanAuthorized ? "HUMAN" : "GUARDRAIL",
    status: "SUCCESS"
  )
  
  COMMIT TRANSACTION
  
  RETURN {
    success: true,
    milestone: milestone,
    project: project,
    envelope: envelope,
    ledgerEvent: event
  }
END ALGORITHM
```

---

## 9. Property-Based Testing Strategy

### Property-Based Testing (PBT) Approach

Property-based testing verifies invariants over infinite input spaces rather than discrete test cases. We use **fast-check** (TypeScript) for HTTP API testing and **Hypothesis** (Python) for Python-based tooling.

### Core Invariants (Formally Specified)

**Invariant 1: Double-Payment Prevention (Idempotency)**

```
∀ project, milestone, amount:
  LET req1 = { project, milestone, amount, audit_score: 85 }
  LET req2 = { project, milestone, amount, audit_score: 85 }
  LET result1 = settle(req1)
  LET result2 = settle(req2)
  
  result1.payout_batch_id == result2.payout_batch_id
  ∧ result1.status == result2.status == "SUCCESS"
  ∧ only_one_ledger_entry_persisted()
  
Property: Retrying the same settlement produces identical results and only one PayPal payout.
```

**Invariant 2: Budget Enforcement Consistency (Atomic Atomicity)**

```
∀ user, envelope, concurrent_settlements:
  LET initial_spent = envelope.spentTodayUSD
  LET daily_ceiling = envelope.dailyCeilingUSD
  LET concurrent_reqs = [
    { milestone: m1, amount: $50K },
    { milestone: m2, amount: $60K }
  ]
  
  LET results = concurrent_settle(concurrent_reqs)
  
  CASE 1: If initial_spent + $50K + $60K > daily_ceiling
    THEN results[0].status == "SUCCESS" ∧ results[1].status == "BLOCKED"
    ∨    results[0].status == "BLOCKED" ∧ results[1].status == "SUCCESS"
  CASE 2: If initial_spent + $50K + $60K <= daily_ceiling
    THEN results[0].status == "SUCCESS" ∧ results[1].status == "SUCCESS"
  
  ∧ final_spent = initial_spent + (successful_settled_amount)
  ∧ no_race_condition_double_counting()
  
Property: Concurrent settlement attempts enforce budget ceilings atomically, preventing overspend.
```

**Invariant 3: Kill-Switch Atomicity (Emergency Halt)**

```
∀ user, kill_switch_state:
  WHEN kill_switch_active = true:
    ∀ settlement_request:
      settle(request) → HTTP 423 Locked
      ∧ no_payout_executed
      ∧ ledger_records_KILL_SWITCH_ACTIVE_event
  
  WHEN kill_switch_active = false (after reset):
    ∀ settlement_request (with audit_score ≥ 85%, amount ≤ $1K, budget OK):
      settle(request) → HTTP 200 Success
      ∧ payout_executed
  
Property: Kill-switch blocks all settlement atomically and can be reset to resume operations.
```

**Invariant 4: Audit Scoring Determinism (Reproducibility)**

```
∀ deliverable_text, deliverable_url:
  LET score1 = audit_score({ text: deliverable_text, url: deliverable_url })
  LET score2 = audit_score({ text: deliverable_text, url: deliverable_url })
  
  score1 == score2
  ∧ score1 ∈ [0, 100]
  ∧ is_deterministic_and_independent_of_time()
  
Property: The same deliverable always receives the same audit score, ensuring reproducibility.
```

**Invariant 5: Ledger Immutability (Append-Only Integrity)**

```
∀ ledger_event:
  ledger_event.created_at ≤ now()
  ∧ ¬ (ledger_event.updated_at > ledger_event.created_at)
  ∧ ¬ ∃ DELETE query on PAYOUT_EXECUTED events
  ∧ ∀ re_read: ledger_event_current == ledger_event_previous
  
Property: Ledger events are immutable and append-only; historical records never change.
```

### PBT Test Cases with Generators

**Test 1: Idempotency Under Retry**

```typescript
// Fast-Check Generator: arbitrary settlement requests
const arbSettlement = fc.record({
  projectId: fc.uuid(),
  milestoneId: fc.uuid(),
  amount: fc.integer({ min: 1, max: 25000 }),  // USD
  auditScore: fc.integer({ min: 85, max: 100 }),
  humanAuthorized: fc.boolean()
})

// Property: Settling twice with same params produces same result
fc.assert(
  fc.property(arbSettlement, (settlement) => {
    const result1 = settle(settlement)
    const result2 = settle(settlement)
    
    return (
      result1.success === result2.success &&
      result1.payout_batch_id === result2.payout_batch_id &&
      countLedgerEventsForMilestone(settlement.milestoneId) === 1
    )
  }),
  { numRuns: 1000 }
)
```

**Test 2: Budget Guard Under Concurrency**

```typescript
const arbConcurrentSettlements = fc.tuple(
  arbSettlement,
  arbSettlement,
  arbSettlement
)

// Property: Total settled amount never exceeds daily ceiling
fc.assert(
  fc.property(arbConcurrentSettlements, async (settlements) => {
    const dailyCeiling = 100000
    const initialSpent = 0
    const concurrentResults = await Promise.all(
      settlements.map(s => settle(s))
    )
    
    const totalSettled = concurrentResults
      .filter(r => r.success)
      .reduce((sum, r) => sum + r.amount, 0)
    
    return initialSpent + totalSettled <= dailyCeiling
  }),
  { numRuns: 500 }
)
```

**Test 3: Audit Score Determinism**

```typescript
const arbDeliverable = fc.record({
  text: fc.string({ maxLength: 12000 }),
  url: fc.option(fc.webUrl())
})

// Property: Same deliverable always gets same score
fc.assert(
  fc.property(arbDeliverable, (deliverable) => {
    const score1 = auditEngine.score(deliverable)
    const score2 = auditEngine.score(deliverable)
    
    return (
      score1 === score2 &&
      score1 >= 0 &&
      score1 <= 100
    )
  }),
  { numRuns: 1000 }
)
```

**Test 4: Ledger Immutability**

```typescript
// Property: Ledger events are never modified after creation
fc.assert(
  fc.property(arbSettlement, async (settlement) => {
    const result1 = settle(settlement)
    const event1 = await getLedgerEvent(result1.eventId)
    
    // Wait and re-read
    await sleep(1000)
    const event2 = await getLedgerEvent(result1.eventId)
    
    return (
      event1.createdAt === event2.createdAt &&
      event1.action === event2.action &&
      event1.status === event2.status &&
      !event2.updatedAt  // No update field
    )
  }),
  { numRuns: 100 }
)
```

### Integration Testing vs. Property-Based Testing

| Aspect | Property-Based Testing | Integration Testing |
|--------|---|---|
| **When to Use** | Correctness properties (invariants, determinism, atomicity); infinite input space coverage | End-to-end workflow (registration → contract → audit → settlement); manual approval gates |
| **Failure Signal** | Counterexample: specific input that violates property | Failed HTTP request; database state corruption; PayPal integration |
| **Scalability** | Fast (1000s of random inputs per second) | Slow (few seconds per workflow) |
| **Setup Complexity** | Generators only; no database mocking needed | Full test database; seed data; PayPal sandbox |
| **Example** | "Verify that audit score is always deterministic" (1000 runs) | "User creates contract, submits deliverable, settles > $1K, receives human approval" |
| **Used For** | Guardrail logic, budget enforcement, idempotency, sanitization | Route handlers, RBAC, regulatory disclaimers, UI flows |

### Testing Strategy by Requirement

| Requirement | PBT Invariants | Integration Tests |
|---|---|---|
| 1.1 Non-Custodial | Idempotency (no double-pay); fail-closed without credentials | Settlement with/without PayPal creds; simulation mode verification |
| 2.1 Fraud Detection | Audit score determinism; score distribution | GitHub URL scoring; injection pattern detection |
| 2.2 Human Approval | Budget boundary testing ($1K threshold) | High-value settlement approval workflow |
| 2.4 Budget Enforcement | Concurrent settlement atomicity; daily ceiling | Multi-concurrent requests; daily reset job |
| 3.3 Idempotency | Deterministic fingerprint; duplicate prevention | Retry settlement; verify same batch ID |
| 4.1 PII Redaction | Pattern coverage (emails, phone, SSN) | End-to-end AI call with PII in input |

---

## 10. Deployment & Operational Readiness

### Production Requirements & Fail-Closed Design

**Requirement: Production-Only Fail-Close**

```yaml
# .env.production (deployment time)
REGULATORY_DISCLAIMER_ACCEPTED=true
PAYPAL_CLIENT_ID=<prod_client_id>      # Must be set in production
PAYPAL_CLIENT_SECRET=<prod_secret>     # Must be set in production
PAYPAL_MODE=production                 # Sandbox vs. production (production when live)
NODE_ENV=production
DATABASE_URL=<prod_postgres_url>
```

**Runtime Validation:**

```typescript
// At server startup (before accepting requests)
if (process.env.NODE_ENV === "production") {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error(
      "Production deployment requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET. " +
      "Settlement will fail closed (HTTP 502) without credentials."
    )
  }
  
  if (process.env.REGULATORY_DISCLAIMER_ACCEPTED !== "true") {
    throw new Error(
      "Production deployment requires REGULATORY_DISCLAIMER_ACCEPTED=true " +
      "to acknowledge non-custodial design and regulatory limitations."
    )
  }
}
```

### Database Schema & Migration Strategy

**Migration 001: Core Schema (AgenticPay Initial)**

```sql
-- Users Table
CREATE TABLE agenticpay_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  legal_name VARCHAR(255),
  account_type VARCHAR(50) CHECK (account_type IN ('BUSINESS', 'PERSONAL')),
  tax_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sessions Table (opaque tokens)
CREATE TABLE agenticpay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES agenticpay_users(id),
  token_hash CHAR(64) NOT NULL,  -- SHA-256 hex
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_token_hash (token_hash),
  INDEX idx_user_id_expires (user_id, expires_at)
);

-- Projects (Contracts)
CREATE TABLE agenticpay_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES agenticpay_users(id),
  name VARCHAR(255) NOT NULL,
  vendor_name VARCHAR(255) NOT NULL,
  vendor_email VARCHAR(255),
  client_name VARCHAR(255),
  client_email VARCHAR(255),
  budget_cap_usd DECIMAL(15, 2),
  spent_usd DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(50) CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),
  perspective VARCHAR(50) CHECK (perspective IN ('OUTGOING', 'INCOMING')),
  contract_type VARCHAR(50),
  is_subcontracted BOOLEAN DEFAULT FALSE,
  parent_project_id UUID REFERENCES agenticpay_projects(id),
  milestones JSONB,  -- Array of milestone objects
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, id),
  INDEX idx_user_status (user_id, status),
  INDEX idx_user_created (user_id, created_at)
);

-- Budget Envelopes
CREATE TABLE agenticpay_envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES agenticpay_users(id),
  max_per_transaction_usd DECIMAL(15, 2) DEFAULT 25000,
  daily_ceiling_usd DECIMAL(15, 2) DEFAULT 100000,
  spent_today_usd DECIMAL(15, 2) DEFAULT 0,
  active_escrow_usd DECIMAL(15, 2) DEFAULT 0,
  kill_switch_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_reset_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- Ledger Events (Immutable, Append-Only)
CREATE TABLE agenticpay_ledger_events (
  id CHAR(32) PRIMARY KEY,  -- SHA256 hex, deterministic
  user_id UUID NOT NULL REFERENCES agenticpay_users(id),
  project_id UUID,
  milestone_id UUID,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  actor VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  amount_usd DECIMAL(15, 2),
  audit_confidence_score INT CHECK (audit_confidence_score >= 0 AND audit_confidence_score <= 100),
  audit_rationale TEXT,
  risk_level VARCHAR(50),
  status VARCHAR(50),
  paypal_batch_id VARCHAR(255),
  paypal_batch_status VARCHAR(50),
  paypal_http_status INT,
  paypal_http_log TEXT,  -- Redacted
  recipient VARCHAR(255),
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  -- Immutability: No UPDATE allowed, only INSERT; no DELETE
  INDEX idx_user_project (user_id, project_id),
  INDEX idx_user_timestamp (user_id, timestamp DESC),
  INDEX idx_action (action),
  CONSTRAINT ledger_immutable NO UPDATE,  -- PostgreSQL: Trigger to prevent updates
  CONSTRAINT ledger_immutable NO DELETE  -- PostgreSQL: Trigger to prevent deletes
);

-- Trigger to enforce ledger immutability
CREATE OR REPLACE FUNCTION prevent_ledger_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Ledger events are immutable and cannot be modified or deleted';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_immutability
BEFORE UPDATE OR DELETE ON agenticpay_ledger_events
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modification();
```

### Rate Limiting Configuration

**Process-Local Fixed-Window Limiter**

```typescript
// src/lib/rate-limiting/limiter.ts
interface RateLimitBucket {
  count: number
  resetAt: number  // Unix timestamp (ms)
}

class ProcessLocalRateLimiter {
  private buckets: Map<string, RateLimitBucket> = new Map()
  
  isAllowed(userId: string, endpoint: string, limit: number, windowMs: number): boolean {
    const key = `${userId}:${endpoint}`
    const now = Date.now()
    
    let bucket = this.buckets.get(key)
    
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs }
      this.buckets.set(key, bucket)
    }
    
    if (bucket.count < limit) {
      bucket.count++
      return true
    }
    
    return false
  }
  
  getStatus(userId: string, endpoint: string, limit: number): {
    remaining: number
    resetAt: number
  } {
    const key = `${userId}:${endpoint}`
    const bucket = this.buckets.get(key)
    
    if (!bucket) {
      return { remaining: limit, resetAt: Date.now() + 60000 }
    }
    
    return {
      remaining: Math.max(0, limit - bucket.count),
      resetAt: bucket.resetAt
    }
  }
}

// Rate limits per endpoint
const RATE_LIMITS = {
  "POST /api/agent/stream": { limit: 20, windowMs: 60000 },           // 20 per minute
  "POST /api/agent/audit": { limit: 30, windowMs: 60000 },            // 30 per minute
  "POST /api/projects/.../settle": { limit: 15, windowMs: 60000 },    // 15 per minute
  "POST /api/ledger/events": { limit: 120, windowMs: 60000 },         // 120 per minute
  "POST /api/projects": { limit: 30, windowMs: 60000 },               // 30 per minute
  "POST /api/projects/bootstrap": { limit: 5, windowMs: 900000 },     // 5 per 15 minutes
  "POST /api/envelope/update": { limit: 60, windowMs: 60000 },        // 60 per minute
  "POST /api/auth/login": { limit: 20, windowMs: 900000 },            // 20 per 15 minutes (per IP + per email)
}
```

### Monitoring & Alerting

**Key Metrics:**

```yaml
Metrics:
  settlement_success_rate:          # % of settlements that complete successfully
    target: ≥ 99.5%
    alert_threshold: < 95%
  
  audit_rejection_rate:             # % of submissions rejected (audit score < 85%)
    target: < 5%
    alert_threshold: > 10%
  
  paypal_api_latency:               # P50, P95, P99 latency to PayPal
    target: < 500ms (P95)
    alert_threshold: > 2000ms (P95)
  
  kill_switch_activations:          # Number of kill-switch events per day
    target: 0 (expected for normal operations)
    alert_threshold: > 3 per day
  
  prompt_injection_attempts:        # Number of detected injection patterns
    target: < 10 per day
    alert_threshold: > 50 per day
  
  rate_limit_rejections:            # Number of rate-limit violations per endpoint
    target: < 1% of requests
    alert_threshold: > 5% of requests
```

### Backup & Disaster Recovery

**Backup Strategy:**

```yaml
Daily Automated Backups:
  frequency: Every 24 hours (UTC 02:00)
  retention: 30 days
  target: AWS S3 (or cloud provider equivalent)
  encryption: AES-256

Monthly Backups:
  frequency: First day of month
  retention: 1 year
  target: Cold storage (Glacier equivalent)

Recovery Time Objective (RTO):
  target: 4 hours (restore from last backup + verify ledger immutability)

Recovery Point Objective (RPO):
  target: 24 hours (acceptable data loss is max 1 day of settlement records)

Ledger Immutability Verification:
  - On restore: Verify no ledger events have been modified
  - Trigger: PAYOUT_EXECUTED records must be immutable
  - Alert: If any ledger modification detected, raise CRITICAL alert
```

### Scheduled Maintenance Jobs

**Daily Reconciliation (UTC 00:05)**

```typescript
// Runs after UTC midnight to reset daily budget counters
async function dailyEnvelopeReconciliation() {
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  
  // Reset spentTodayUSD to 0 for all envelopes
  await db.query(
    'UPDATE agenticpay_envelopes SET spent_today_usd = 0, last_reset_at = NOW() WHERE DATE(last_reset_at) < $1',
    [yesterday]
  )
  
  // Log reconciliation event
  await logSystemEvent({
    action: 'DAILY_ENVELOPE_RECONCILIATION',
    actor: 'SYSTEM',
    timestamp: new Date(),
    status: 'SUCCESS'
  })
}

// Runs every hour to clean up expired sessions
async function sessionCleanup() {
  const expiredCount = await db.query(
    'DELETE FROM agenticpay_sessions WHERE expires_at < NOW()'
  )
  
  await logSystemEvent({
    action: 'SESSION_CLEANUP',
    actor: 'SYSTEM',
    details: { expired_sessions_deleted: expiredCount.rowCount }
  })
}

// Runs nightly to enforce data retention policies
async function dataRetentionEnforcement() {
  const retentionPolicies = {
    ledger_events_non_tax: 90,          // 90 days: general ledger
    ledger_events_tax_hold: 2555,       // 7 years: tax records (days)
    logs_general: 30,                   // 30 days: general logs
  }
  
  for (const [category, retentionDays] of Object.entries(retentionPolicies)) {
    const cutoffDate = new Date(Date.now() - retentionDays * 86400000)
    await db.query(
      'UPDATE ledger_events SET deleted_at = NOW() WHERE created_at < $1 AND category = $2',
      [cutoffDate, category]
    )
  }
}
```

---

## 11. Regulatory Compliance Mapping

### FinCEN (31 CFR Part 1010) Compliance Matrix

| FinCEN Requirement | AgenticPay Implementation | Evidence |
|---|---|---|
| Non-Transmission of Funds | Zero internal balance; OAuth delegation to PayPal; fail-closed without credentials | Settlement engine code review; failing tests without PayPal creds |
| Non-Custody of Funds | Funds never held or controlled; PayPal executes payout directly to beneficiary | Architecture documentation; settlement fingerprints don't include internal escrow |
| Separation of Settlement | Settlement delegated exclusively to PayPal via OAuth; deterministic idempotency prevents double-pay | PayPal integration code; ledger immutability; idempotency tests |
| Documentation & Transparency | COMPLIANCE.md, ARCHITECTURE.md, SECURITY.md, REQUIREMENTS.md publicly available | Published documentation; regulatory export endpoint |

### AML/KYC Compliance Matrix

| AML Requirement | AgenticPay Implementation | Evidence |
|---|---|---|
| Fraud Detection | 85% audit confidence threshold; heuristic scoring based on deliverable content | Audit scoring logic; test cases for all scoring pathways |
| Autonomous Cap | $1,000 USD autonomous settlement cap; higher amounts require human authorization | Settlement authorization gate; test matrix for boundary conditions |
| Human Approval | Workspace admin must explicitly approve high-value settlements | Human authorization controller; ledger actor labels (HUMAN vs. GUARDRAIL) |
| Kill-Switch | Emergency halt capability; blocks all settlement and audit; imminent threat response | Kill-switch controller; control hierarchy tests |
| Audit Trail | Immutable, append-only ledger; deterministic event IDs; per-transaction record | Ledger schema; immutability trigger; event ID derivation algorithm |
| PII Handling | PII redacted before external AI calls; data retention policies; deletion workflows | PII sanitizer tests; retention policy verification |

### PCI-DSS Compliance Matrix

| PCI-DSS Requirement | AgenticPay Implementation | Evidence |
|---|---|---|
| No Cardholder Data | Zero card number storage; non-custodial architecture | Code review; data model inspection |
| Credential Delegation | OAuth 2.0 to PayPal; server-only secrets; environment variable loading | PayPal client code; bundle analysis (no NEXT_PUBLIC_*_SECRET) |
| Secure Transmission | TLS 1.2+ for all PayPal communication; certificate verification | PayPal HTTP client; TLS enforcement tests |
| Idempotency | Deterministic request IDs prevent duplicate payouts | Settlement fingerprint algorithm; deduplication tests |
| Immutable Audit Trail | Ledger events immutable; no deletion allowed | Ledger trigger; immutability tests |

### GDPR/CCPA Compliance Matrix

| Privacy Requirement | AgenticPay Implementation | Evidence |
|---|---|---|
| Data Minimization | Only collect necessary data; PII redacted before AI calls | PII sanitizer; data model review |
| Consent | Explicit opt-in for AI processing; privacy notice at registration | Consent banner; privacy policy |
| Data Subject Rights | DSR endpoint for access, deletion, portability | DataSubjectRequestController; DSR handling tests |
| Data Retention | Transparent retention policies; automated deletion after period | Retention policy document; deletion job tests |
| Breach Notification | Security event logging; breach detection via kill-switch activation | Security event logs; incident response procedures |

---

## 12. Risk Mitigations & Trade-Offs

### Known Limitations & Production Hardening Path

| Limitation | Current State | Production Requirement | Mitigation |
|---|---|---|---|
| **Email Verification** | Not implemented | Email verification required before settlement | Add email verification email + click-through token |
| **KYC/KYB Onboarding** | Stub implementation | Full KYC for business users; KYB for organizations | Integrate with Veriff or similar KYC provider |
| **Rate Limiting Durability** | Process-local (lost on restart) | Shared across instances; persisted | Move to Redis; use API Gateway rate limiting |
| **Role-Based Authorization** | Basic authentication only | Full RBAC with workspace admin/contractor roles | Implement role middleware; add role column to users table |
| **Audit Scoring Semantic Analysis** | Keyword-based heuristic | Semantic understanding of deliverables | Optional: integrate ML model; maintain heuristic fallback |
| **PayPal Webhooks** | Not implemented | Webhook reconciliation; refund handling | Add PayPal webhook receiver; store payout events |
| **Dispute Resolution** | Not implemented | Dispute workflow; human arbitration | Design dispute model; implement arbitration interface |
| **Legal Contracts** | Not implemented | Binding electronic contracts; e-signatures | Integrate DocuSign or similar; add acceptance workflow |
| **Tax Reporting** | Not implemented | 1099 forms; tax withholding | Add tax form generation; integrate with accounting systems |
| **Regulatory Export** | Stub implementation | Audit-trail export with digital signatures | Implement HMAC signing; add certificate pinning |
| **Live PayPal Payouts** | Sandbox only | Production PayPal onboarding; underwriting | Apply for production credentials; compliance review |
| **Concurrent Settlement Testing** | Unit tests only | Integration test with live PostgreSQL; concurrent load testing | Set up staging environment; add concurrency tests |

### Deployment Trade-Offs for Render Free Tier

| Trade-Off | Choice | Rationale | Production Path |
|---|---|---|---|
| **Rate Limiting Backend** | Process-local (memory) | Self-contained; no external dependency | Move to Redis for multi-instance deployments |
| **Session Storage** | PostgreSQL (durable) | Persists across restarts; fair-tier feature | Keep PostgreSQL for durability; excellent choice |
| **SSL Certificate** | Render-managed (LetsEncrypt) | Free; automatic renewal | Consider production certificates; add cert pinning |
| **Deployment Strategy** | Single container, no clustering | Render free tier limitation | Switch to paid tier for load balancing |
| **Database Backups** | Render-managed (free tier) | Limited retention (7 days) | Add S3-based backups; implement cold storage for 1-year retention |
| **Monitoring & Logging** | Application logs only | No external log aggregation | Integrate DataDog or CloudWatch for production |

---

## 13. Future Enhancements & Production Readiness Path

### Phase 2: Regulatory Hardening (Quarters 2–3)

- [ ] KYC/KYB integration with third-party provider (Veriff, IDology)
- [ ] Shared rate limiting (Redis or managed cache)
- [ ] Email verification and password recovery
- [ ] Full RBAC with workspace roles
- [ ] PII redaction in all AI calls
- [ ] Audit scorer semantic analysis (optional ML model)

### Phase 3: Settlement Robustness (Quarters 3–4)

- [ ] PayPal webhook receiver and reconciliation
- [ ] Refund and dispute workflows
- [ ] Live PayPal production credentialing and onboarding
- [ ] Integration tests with concurrent load (staging environment)
- [ ] Comprehensive end-to-end testing suite

### Phase 4: Legal & Compliance (Quarters 4+)

- [ ] Electronic contract binding and e-signatures (DocuSign)
- [ ] Tax form generation (1099, W-9)
- [ ] Regulatory export with digital signatures
- [ ] Jurisdiction-specific legal review (US, EU, UK)
- [ ] Production deployment checklist and sign-off

### Phase 5: Scale & Monitoring (Year 2+)

- [ ] Multi-instance deployment with auto-scaling
- [ ] Distributed rate limiting and session management
- [ ] Comprehensive monitoring, alerting, and SLO tracking
- [ ] Incident response runbooks
- [ ] Disaster recovery drills and documentation

---

## Conclusion

The Regulatory Compliance Framework for AgenticPay AI translates fifteen complex regulatory requirements into a cohesive, architecturally sound design that prioritizes non-custody, determinism, auditability, and fail-closed safety. By centralizing all financial controls in the server-side `GuardrailEnforcer` and `SettlementEngine`, enforcing PostgreSQL row-lock atomicity, delegating settlement execution exclusively to PayPal via OAuth, and maintaining an immutable, append-only ledger, the platform establishes a strong foundation for regulatory compliance and financial governance.

Property-based testing verifies core invariants (idempotency, budget enforcement, kill-switch atomicity, audit determinism, ledger immutability) over infinite input spaces, providing mathematical confidence in correctness. Integration testing validates end-to-end workflows, human authorization gates, and regulatory disclaimers.

For production deployment, the framework requires explicit acknowledgment of non-custodial design, mandatory PayPal credential configuration, and comprehensive regulatory review in each deployment jurisdiction. The design supports incremental hardening through phased enhancements (KYC, webhooks, RBAC, legal contracts, tax reporting) while maintaining core security posture and compliance integrity.

This document serves as both a technical implementation guide for developers and regulatory evidence for auditors, judges, and compliance officers reviewing AgenticPay AI's regulatory positioning.

---

## Appendix A: Key Documents & References

- **ARCHITECTURE.md:** Technical architecture and system context
- **COMPLIANCE.md:** Regulatory compliance posture and settlement governance
- **SECURITY.md:** Security policy, trust boundaries, and financial guardrails
- **DATA_GOVERNANCE.md:** Data classification, retention, privacy
- **REQUIREMENTS.md:** Fifteen formal regulatory and compliance requirements
- **DESIGN.md (this document):** Design Architecture for regulatory compliance framework

## Appendix B: Configuration Examples

### Environment Variables (Production)

```bash
# PayPal Credentials (Production)
PAYPAL_CLIENT_ID=ABC123XYZ
PAYPAL_CLIENT_SECRET=<prod_secret>
PAYPAL_MODE=production
PAYPAL_ENVIRONMENT=production

# Deployment Acknowledgment
REGULATORY_DISCLAIMER_ACCEPTED=true
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@prod-db.example.com/agenticpay

# AI Provider (Optional)
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...

# Monitoring
DATADOG_API_KEY=<monitoring_key>
SENTRY_DSN=<error_tracking>
```

### Docker Production Build

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Verify environment at startup
RUN if [ "$NODE_ENV" = "production" ]; then \
      if [ -z "$PAYPAL_CLIENT_ID" ] || [ -z "$PAYPAL_CLIENT_SECRET" ]; then \
        echo "ERROR: Production requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET"; \
        exit 1; \
      fi && \
      if [ "$REGULATORY_DISCLAIMER_ACCEPTED" != "true" ]; then \
        echo "ERROR: Production requires REGULATORY_DISCLAIMER_ACCEPTED=true"; \
        exit 1; \
      fi; \
    fi

EXPOSE 3000
CMD ["npm", "start"]
```

---

**Document Version:** 1.0
**Last Updated:** [Current Date]
**Status:** Ready for Regulatory Review & Implementation
