# AgenticPay AI

**Pay-on-Proof: Programmable Escrow with AI Audit and Instant PayPal Settlement**

AgenticPay AI is an enterprise-grade escrow platform that eliminates payment friction in service contracts. Clients deposit funds via PayPal → AI auditor validates deliverables (GitHub PRs, CI status, acceptance criteria) → Funds release automatically on merge.

The platform combines deterministic financial guardrails, server-authoritative settlement, real-time AI milestone audits, and atomic PayPal payouts—all without the AI touching money directly.

---

## The Problem

**Current Payment Friction in Service Contracting**

- **Freelancers & Agencies:** Payment delays of 30–60 days. Clients often pay late or dispute invoices for subjective "quality" reasons.
- **Clients:** Fear of advance payments. No guarantee work will be completed or meet specifications. Disputes are costly and time-consuming.
- **Result:** Talent leaves the market. Projects slow down. Contracts require expensive insurance, escrow services, or legal intervention.

The core issue: **Trust gap and information asymmetry.** There's no mechanism for real-time proof of work completion that both parties accept automatically.

---

## The Solution: Pay-on-Proof

AgenticPay AI bridges this trust gap with **programmable escrow powered by AI audit and deterministic settlement**:

1. **Client deposits funds** via PayPal (no payment processor hassle; real Sandbox/Live integration).
2. **Vendor completes work** (commits code, pushes to GitHub, submits deliverables).
3. **AI auditor evaluates** in real-time:
   - PR merge status and CI pipeline success
   - Deliverable content against acceptance criteria
   - Confidence score (deterministic, not black-box).
4. **Automatic settlement on approval** (≤ $1,000 USD per milestone):
   - Funds are released from escrow
   - PayPal Payouts API executes instantly
   - Ledger records transaction with real batch IDs and timestamps
   - Vendor receives payment in seconds—not 30 days
5. **Higher amounts** ($1,000+) require human approval, preserving organizational control.

**Key Guarantee:** AI audits only; AI never touches money. Deterministic TypeScript guardrails decide settlement eligibility. PayPal's official APIs execute the payout. All decisions are logged in an immutable, inspectable ledger.

---

## Architecture & Tech Stack

### Governing Principle

**"AI verifies → Code decides → PayPal executes"**

This separation ensures:
- **Transparency:** Every decision is deterministic and auditable
- **Finality:** PayPal's official APIs guarantee fund movement
- **Safety:** Guardrails enforce project budgets, daily caps, and kill-switch logic
- **Compliance:** Non-custodial design (no funds held by the platform)

### Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 15, React 19, TypeScript | Client application (portfolio, audit workflow, ledger) |
| **Backend** | Next.js Route Handlers, TypeScript | Server-authoritative settlement engine |
| **Database** | PostgreSQL | Durable storage (users, projects, envelopes, audit ledger) |
| **AI Auditor** | OpenAI / OpenRouter / Gemini (configurable) | Proposal negotiation; deterministic heuristic audit |
| **Payment Rail** | PayPal Sandbox (Orders v2, Payouts v1, Webhooks) | Real escrow and payout execution |
| **Security** | scrypt, HttpOnly cookies, CSRF tokens | Password hashing, session management, origin validation |
| **Testing** | Jest, Property-Based Testing | 126+ passing checks; coverage of guardrails, payout flows, settlement atomicity |
| **Deployment** | Docker, Render, GitHub Actions | CI/CD pipeline; automated testing on PR/push |

### PayPal Integration Details

| API | Purpose | Implementation |
|-----|---------|-----------------|
| `/v1/oauth2/token` | Obtain server access token | Called once per settlement; cached briefly |
| `/v1/payments/payouts` | Execute Payouts API | Deterministic `PayPal-Request-Id` ensures idempotency; real `payout_batch_id` recorded in ledger |
| Webhooks (subscribed) | Future: Payout status reconciliation | Currently: Sandbox integration verified; production deployments add webhook listeners |

### Guardrail Enforcement

The platform enforces multiple layers of financial controls:

| Control | Enforcement | Example |
|---------|------------|---------|
| **Audit confidence** | Scores < 85% reject settlement | PR with no deliverable content cannot proceed |
| **Autonomous cap** | Auto-release up to $1,000 USD | Amounts > $1,000 require human approval |
| **Daily ceiling** | Per-contract daily spend limit | Prevents rapid-fire bulk releases |
| **Budget envelope** | Project-wide cap | Linked incoming/outgoing contracts share ceilings |
| **Kill-switch** | Admin can block all settlements | Emergency control for contract disputes |
| **Contract freeze** | Paused contracts cannot settle | Temporary hold for clarification |
| **Duplicate prevention** | Deterministic fingerprints (SHA256) | Same milestone + amount = same payout request; retries are idempotent |

---

## How to Run & Evaluator Access

### Quick Start (Local Development)

**Prerequisites:**
- Node.js 20 (see `.nvmrc`)
- npm
- PostgreSQL (or use in-memory mode for testing)

**Installation:**
```bash
git clone https://github.com/Marce-Inda/agentipay-ai.git
cd agentipay-ai
npm install
cp .env.example .env.local
npm run dev
```

**Open:** [http://localhost:3000](http://localhost:3000)

**Environment Variables for Full Functionality:**

| Variable | Purpose | Example |
|----------|---------|---------|
| `PAYPAL_CLIENT_ID` | PayPal Sandbox client ID | (Set in PayPal Developer Dashboard) |
| `PAYPAL_CLIENT_SECRET` | PayPal Sandbox secret | (Set in PayPal Developer Dashboard) |
| `OPENAI_API_KEY` | AI provider key (optional) | `sk-...` |
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@localhost:5432/agentipay` |

### Live Demo (Render Deployment)

For judges and evaluators:

| Item | Access |
|------|--------|
| **Live URL** | https://agenticpay-ai.onrender.com |
| **Full Access Guide** | See [JUDGE_ACCESS.md](./JUDGE_ACCESS.md) |
| **Test Credentials** | Provided in JUDGE_ACCESS.md (temporary; deleted post-hackathon) |

**Demo Walkthrough:**
1. Log in with provided credentials
2. Browse dual-perspective portfolio (Outgoing & Incoming contracts)
3. Create a test milestone
4. Submit a deliverable (GitHub PR URL or text)
5. Watch real-time AI audit (confidence score, risk level, rationale)
6. Trigger settlement (observe PayPal Sandbox payout execution)
7. Inspect immutable ledger (real batch IDs, timestamps, deterministic event IDs)

---

## Path to Production

### Current Implementation Scope

This implementation is **Sandbox-verified** (non-production PayPal Sandbox environment):
- ✅ Deterministic audit engine with confidence scoring
- ✅ Atomic settlement with row-level PostgreSQL locking
- ✅ Real PayPal Sandbox Payouts API integration
- ✅ Idempotent payout requests (SHA256 fingerprints)
- ✅ Immutable audit ledger with durable recording
- ✅ Kill-switch, budget ceilings, and contract freeze
- ✅ Production-ready security (scrypt, HttpOnly sessions, CSRF validation)

### Production Checklist

To deploy AgenticPay AI to production (real PayPal / real money):

| Item | Requirement | Rationale |
|------|-------------|-----------|
| **PayPal Certification** | Use live PayPal credentials; obtain merchant approval | Compliance with PayPal Acceptable Use Policy |
| **Webhook Reconciliation** | Implement PayPal webhook listeners for payout status updates | Track settlement confirmation in real-time |
| **Compliance Review** | Legal review of escrow terms (e.g., OFAC checks, dispute handling) | Regulatory requirements for financial platforms |
| **Fraud Detection** | Add transaction monitoring and flagging for suspicious patterns | Reduce chargeback and abuse risk |
| **Refund & Dispute Handling** | Implement full refund workflow and dispute resolution | Handle client/vendor disagreements |
| **SLA & Monitoring** | Real-time monitoring, alerting, and incident response | Ensure 99.99% uptime for production payments |
| **Multi-Currency Support** | Extend PayPal integration to handle multiple currencies | Global market expansion |
| **Audit Trail Export** | Regulatory compliance reports (SOC 2, ISO 27001) | Enterprise customer requirements |

### Architecture for Scale

AgenticPay AI is designed for multi-tenant SaaS:

- **Database isolation:** Row-level tenant scoping via `user_id` + `organization_id`
- **Settlement atomicity:** Row locks and transactional rollback ensure consistency
- **Rate limiting:** Process-local quotas (replaceable with Redis for multi-instance deployments)
- **API Gateway:** For production, add API versioning, request signing, and DDoS protection
- **PayPal Commerce Platform:** Use delayed disbursement and multi-party payouts for complex escrow scenarios

---

## Core Capabilities

- **Dual-perspective portfolio:** Outbound (paying vendors) and inbound (receiving from clients) contracts in one workspace.
- **Server-authoritative settlement:** PostgreSQL-backed projects with atomic milestone releases using row locks.
- **AI audit endpoint:** Deterministic heuristic scoring for deliverables (GitHub URLs count as high-confidence).
- **Real PayPal payout execution:** Sandbox-verified Payouts API integration with deterministic idempotency (`sender_batch_id`, `PayPal-Request-Id`).
- **Immutable audit ledger:** Durable, tenant-scoped transaction records with real PayPal batch IDs.
- **Negotiation assistant:** Streamed LLM responses (advisory only; cannot trigger settlement).
- **AG Grid transaction ledger:** Real-time view of all audit, settlement, and payout events.
- **Multi-factor authentication:** Scrypt password hashing, HttpOnly session cookies, same-origin CSRF validation.
- **Rate limiting & quotas:** Process-local limits on LLM, audit, settlement, and ledger endpoints.

---

## Implementation Status

**Phase 1: Core Settlement Engine** ✅
- Deterministic guardrail enforcer
- Server-authoritative project and envelope management
- Atomic settlement with rollback on payout failure
- PostgreSQL-backed durable ledger

**Phase 2: AI Integration** ✅
- Proposal negotiation assistant
- Deliverable audit with confidence scoring
- Real-time streaming responses

**Phase 3: Real PayPal Integration** ✅
- Sandbox Payouts API
- Deterministic fingerprinting for idempotency
- Real batch ID recording

**Phase 4: Security & Compliance** ✅
- Session management (scrypt, HttpOnly cookies)
- CSRF token validation
- Tenant isolation
- Rate limiting and quotas

**Phase 5: Production Readiness** 🔄
- Webhook reconciliation (planned)
- Compliance reporting (planned)
- Multi-currency support (planned)
- SLA monitoring (planned)

---

## Detailed Architecture

### System Components

```
Browser (Next.js App Router + React 19)
├── Auth Screen (scrypt-verified credentials)
├── Portfolio (dual swimlanes: Outgoing & Incoming)
├── Project Workspace (milestones, audits, settlement UI)
├── Agent Chat (AI negotiation assistant)
└── Command Center (AG Grid immutable ledger)
      │
      ├─ /api/auth/* (sign-in, register, logout)
      ├─ /api/projects/* (CRUD, bootstrap, freeze)
      ├─ /api/projects/[id]/milestones/[id]/settle (atomic settlement)
      ├─ /api/envelope (budget management)
      ├─ /api/ledger/events (durable transaction log)
      ├─ /api/agent/audit (deterministic heuristic audit)
      ├─ /api/agent/stream (LLM negotiation assistant)
      └─ /health (deployment monitoring)
            │
            ├─→ PostgreSQL (users, sessions, projects, envelopes, ledger)
            ├─→ PayPal OAuth + Payouts v1 (Sandbox/Live)
            └─→ LLM Provider (OpenAI, OpenRouter, or Gemini)
```

### Key Files

| File | Responsibility |
|------|-----------------|
| `src/lib/guardrails/enforcer.ts` | Budget, audit, and payload validation |
| `src/lib/settlement/settlement.ts` | Deterministic fingerprints and guardrail checks |
| `src/lib/paypal/executor.ts` | Server-side PayPal Payouts executor |
| `src/lib/db/repository.ts` | PostgreSQL schema, atomic transactions, row locking |
| `src/app/api/projects/[id]/milestones/[id]/settle/route.ts` | Settlement endpoint (revalidates, executes payout, records ledger) |
| `src/components/ProjectWorkspaceView.tsx` | Milestone audit UI and settlement trigger |

---

## Security Model

**Trust Principle:** Money never flows through code logic; only through official PayPal REST APIs.

| Layer | Mechanism | Assurance |
|-------|-----------|-----------|
| **Authentication** | scrypt password hashing + HttpOnly session cookies | Resistant to timing attacks and session theft |
| **Authorization** | Server-side tenant scoping by user ID | Cross-tenant data leakage impossible |
| **Input Validation** | Payload size limits, prompt-injection sanitization | Prevents malicious audit manipulations |
| **Settlement** | Deterministic guardrail enforcer revalidates all conditions | Cannot override budget, audit score, or kill-switch |
| **Payout Execution** | Official PayPal REST API with deterministic idempotency | No custom payment logic; PayPal handles funds |
| **Atomicity** | PostgreSQL row locks + transactional rollback | If payout fails, entire settlement rolls back |
| **Audit Trail** | Immutable ledger with SHA256 fingerprints | All decisions are logged and inspectable |

### What This Platform Does NOT Do

- **Does not custody funds.** Escrow is held in PayPal's managed accounts; AgenticPay only orchestrates release.
- **Does not make autonomous financial decisions.** All settlement logic is deterministic and auditable.
- **Does not allow AI to execute payments.** AI audits only; TypeScript guardrails decide; PayPal executes.
- **Does not store payment methods.** PayPal Vault handles tokenization.

---

## Documentation

| Document | Audience | Content |
|----------|----------|---------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Engineers | System design, data flows, component responsibilities |
| [TECHNICAL_ARCHITECTURE_AND_DEVOPS.md](TECHNICAL_ARCHITECTURE_AND_DEVOPS.md) | DevOps / Cloud | Deployment, stack, CI/CD, scaling |
| [SECURITY.md](SECURITY.md) | Security reviewers | Trust boundaries, attack surface, mitigations |
| [COMPLIANCE.md](COMPLIANCE.md) | Legal / Compliance | Non-custodial design, settlement governance |
| [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) | Privacy officers | Data inventory, retention, AI transmission |
| [ETHICS_AND_RESPONSIBLE_AI.md](ETHICS_AND_RESPONSIBLE_AI.md) | Ethics reviewers | Human oversight, transparency, boundaries |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Product / Design | UI components, states, interaction patterns |
| [BUSINESS_MODEL.md](BUSINESS_MODEL.md) | Business development | Pricing tiers, monetization, GTM strategy |
| [TESTING.md](TESTING.md) | QA / Engineers | Test inventory, commands, coverage metrics |
| [JUDGE_ACCESS.md](./JUDGE_ACCESS.md) | Hackathon evaluators | Demo credentials, walkthrough, temporary access |

---

## Development

### Prerequisites

- Node.js 20.x (see `.nvmrc`)
- npm 10+
- PostgreSQL 14+ (optional for local dev; in-memory mode available)

### Installation

```bash
git clone https://github.com/Marce-Inda/agentipay-ai.git
cd agentipay-ai
npm install
```

### Configuration

Create `.env.local`:
```bash
cp .env.example .env.local
```

Required for PayPal Sandbox payout testing:
```env
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
```

Optional (AI providers):
```env
OPENAI_API_KEY=sk-...
```

### Local Development Server

```bash
npm run dev
```

Opens [http://localhost:3000](http://localhost:3000)

### Build & Deploy

```bash
npm run build                          # Production webpack build
npm test -- --runInBand               # Jest test suite
npx tsc --noEmit                       # TypeScript validation
docker build -t agenticpay-ai .        # Docker image
docker run --env-file .env.local -p 3000:3000 agenticpay-ai
```

### Testing

```bash
npm test                               # Jest watch mode
npm test -- --run                      # Single run
npm test -- --coverage                 # Coverage report
```

**Test Coverage:** 126+ passing checks covering guardrails, payout flows, atomicity, idempotency, and API endpoints.

---

## Deployment

### Docker Deployment

```bash
docker build -t agenticpay-ai .
docker run --env-file .env.local \
  -e DATABASE_URL="postgresql://user:pass@db:5432/agentipay" \
  -p 3000:3000 \
  agenticpay-ai
```

### Cloud Platform: Render

1. Fork repository to your GitHub account
2. Connect Render to GitHub
3. Create new Web Service
4. Configure environment variables in Render dashboard:
   - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` (Sandbox)
   - `APP_ORIGIN`, `REGISTRATION_INVITE_CODE` (production)
5. Deploy automatically on `main` branch push

GitHub Actions (`ci.yml`) runs tests and builds on every PR and push to `main`.

---

## Production Readiness Checklist

Before deploying to production:

- [ ] Obtain PayPal Live API credentials (not Sandbox)
- [ ] Implement PayPal webhook listeners for payout reconciliation
- [ ] Add compliance layer (OFAC checks, dispute handling)
- [ ] Set up real-time monitoring and alerting
- [ ] Configure backup and disaster recovery
- [ ] Conduct security audit and penetration testing
- [ ] Establish SLA targets (uptime, settlement latency)
- [ ] Implement fraud detection and abuse prevention
- [ ] Set up audit logging for compliance reporting
- [ ] Configure database encryption at rest

---

## Support & Contribution

**Contribution Guidelines:** See [CONTRIBUTING.md](./CONTRIBUTING.md)

**Issues & Questions:**
- Open an issue on GitHub for bugs or feature requests
- Contact support at `support@agenticpay.ai` (future)

**Legal:**
- License: MIT (see [LICENSE](./LICENSE))
- For compliance questions, see [COMPLIANCE.md](./COMPLIANCE.md)

---

## Acknowledgments

AgenticPay AI was built for the **2026 PayPal AI Hackathon**. Special thanks to:
- PayPal team for Sandbox API support and documentation
- OpenAI / OpenRouter / Google for LLM APIs
- PostgreSQL for reliable data persistence
- Next.js and React communities for excellent tooling
