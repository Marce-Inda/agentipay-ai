# AgenticPay AI - Architecture Specification 📐

This document outlines the system architecture, component breakdown, data flow, multi-project hierarchy, security model, and PayPal API integration pattern for **AgenticPay AI**.

---

## System Overview & Component Diagram

```
                     +-----------------------------------------------+
                     |          Web UI / Client Dashboard            |
                     |  - Next.js App Router (Modular Monolith)       |
                     |  - Multi-Project Context Selector & Portfolio |
                     |  - AG Grid Multi-Contract Audit Ledger         |
                     |  - Organization & Account Settings Modal      |
                     +-----------------------+-----------------------+
                                             | REST API / Server Actions
                     +-----------------------v-----------------------+
                     |           Next.js Server API Backend          |
                     |  - Multi-Project Context Isolation Manager    |
                     |  - Agent Execution & Bargaining Engine        |
                     |  - Multimodal Vision & Deliverable Auditor    |
                     |  - Dual-Tier Guardrail & Safety Enforcer     |
                     |  - PayPal OAuth & Payout Gateway Adapter      |
                     +----------+-------------------------+----------+
                                |                         |
      +-------------------------v--------+       +--------v------------------------+
      |   PayPal Developer Sandbox       |       |       Multimodal LLM            |
      |  - Orders API (Checkout / Pre-Auth)|       |  - OpenAI / OpenRouter / Gemini |
      |  - Payouts API (Escrow Release)  |       |  - Vision & Reasoning Engine    |
      |  - Vault API (Tokenization)      |       +---------------------------------+
      +----------------------------------+
```

---

## Multi-Project & Multi-Contract Architecture

To support real-world enterprise operations where an organization can both hire contractors and deliver client projects (including cascading subcontracting chains):

```
+-----------------------------------------------------------------------------+
| MASTER EMERGENCY KILL-SWITCH (Global Safety Halt)                           |
| Revokes PayPal OAuth credentials at account level in critical emergencies   |
+--------------------------------------+--------------------------------------+
                                       |
       +-------------------------------+-------------------------------+
       v                                                               v
+-----------------------------------------------+     +-----------------------------------------------+
| CONTRACTS I MANAGE (Outgoing Escrow - Hiring) |     | CONTRACTS I DELIVER (Incoming Escrow - Vendor)|
| Vault Pre-Authorized by User's Account        |     | Vault Locked by Client's Account              |
| Deliverables audited before payout release    |     | Milestones verified & funds claimed           |
+-----------------------+-----------------------+     +-----------------------+-----------------------+
| Contract: Web Dev     | Contract: Copywriting |     | Contract: FinTech App | Contract: Subcontract |
| Vendor: dev@agency    | Vendor: copy@pro.io   |     | Client: Apex Holding  | Client: Acme Global   |
| Vault Cap: $250.00    | Vault Cap: $100.00    |     | Escrow: $1,200.00     | Escrow: $150.00       |
+-----------------------+-----------------------+     +-----------------------+-----------------------+
```

### Key Multi-Project & Entity Features:
1. **Account Entity Model (Personal vs. Business):**
   * **Personal Accounts:** Individual profile, standard terms of service, direct PayPal account settlement, streamlined single-operator escrow.
   * **Business Accounts:** Corporate legal entity, Tax ID/VAT registration, formal **MSA (Master Services Agreement)** and **SOW (Statement of Work)** binding contracts, multi-user approval governance, and pooled departmental Vault envelopes.
2. **Dual-Perspective Relationship Model:**
   * **Outgoing (`CONTRACTING`):** The account acts as Buyer/Principal. Funds are tokenized and deposited into escrow; AI audits deliverables submitted by third parties.
   * **Incoming (`CONTRACTOR`):** The account acts as Vendor/Freelancer. Escrow funds are guaranteed upfront ($0 payment default risk); deliverables are submitted to trigger PayPal payout execution.
3. **Milestone Deliverable Audit & Settlement Pipeline:**
   * **Acceptance Criteria Specification:** Principal defines phase requirements (e.g. test coverage, OpenAPI specifications, build artifacts).
   * **Contractor Deliverable Submission:** Contractor submits PR links, commit hashes, or technical execution proofs with maximum payload boundary protection (12,000 characters).
   * **Context-Isolated AI Audit Verification:** Sanitizes input against OWASP LLM01 injection attacks (XML/HTML comment prompt escapes, role hijacking), isolates untrusted text in `<deliverable_data>` containers, evaluates compliance against acceptance criteria, and calculates confidence score (0-100%).
   * **Tiered Financial Governance & Dual-Key Settlement:**
     - **Micro & Standard Milestones ($\le \$1,000\text{ USD}$):** If score $\ge 85\%$, automatically releases escrow via PayPal Payouts API (`/v1/payments/payouts`) with deterministic `PayPal-Request-Id` cryptographic idempotency headers.
     - **High-Value Enterprise Milestones ($> \$1,000\text{ USD}$):** AI audit produces full technical compliance verification (`AUDITED_PENDING_APPROVAL`), but funds remain locked in escrow until an authorized enterprise executive confirms release with one-click dual-key authorization in the dashboard.
4. **Cascading Subcontracting Engine:** An incoming project can spawn child outgoing contracts (e.g., delegating a component), preserving end-to-end milestone traceability.
5. **Dual-Tier Control Hierarchy:**
   * **Project-Level Escrow Freeze:** Pauses or cancels escrow releases for a specific project/contract without affecting other active projects.
   * **Master Emergency Kill-Switch:** Account-level circuit breaker that immediately revokes tokens across all active projects.
6. **Two-Column Master Swimlanes Architecture:**
   * **Parallel Account Workspaces:** The portfolio dashboard renders two synchronized columns:
     - **Left Swimlane (Outbound Escrow / Accounts Payable):** Contains the Outbound Executive Summary Card and all active agreements where the entity hires and audits vendors.
     - **Right Swimlane (Inbound Escrow / Accounts Receivable):** Contains the Inbound Executive Summary Card, guaranteed client deposit reserves, and contracts where the entity delivers milestones.
   * **Zero Redundant Navigation:** Replaces redundant secondary tab bars with a clean global search and utility toolbar, offering optional focus toggles (`Dual Split View | Managed Only | Assigned Only`).
   * **Asymmetric Swimlane Resilience & Empty State Hubs:** Avoids unpopulated dead spaces by transforming empty or shorter columns into Actionable Enterprise Onboarding Hubs (e.g. Inbound Escrow Intake Links, Outbound Procurement Mandates), maintaining visual equilibrium across varying portfolio volumes.

---

## Core Architectural Components

### 1. Multi-Project Context Manager (`/lib/projects`)
* **Role:** Isolates project states, vendor contracts, milestones, and active escrow balances.

### 2. Deterministic Guardrail Enforcer (`/lib/guardrails`)
* **Role:** Non-AI validation layer intercepting AI intents before calling PayPal APIs.
* **Enforces:** Per-project budget caps, OWASP LLM01 prompt injection sanitization, confidence score thresholds (>=85%), tiered autonomous settlement ceiling ($1,000 USD), payload length limits (12,000 chars), and dual-tier kill-switch status.

### 3. AI Deliverable Auditor (`/api/agent/audit`)
* **Role:** Semantic code and document evaluator comparing submitted deliverables against client criteria with automated or dual-key PayPal payout dispatching.

### 4. PayPal Gateway Adapter (`/lib/paypal`)
* **Role:** Server-side client wrapper for PayPal REST APIs (`api-m.sandbox.paypal.com`).
* **Functions:** OAuth2 token management, Vault tokenization, and Payouts execution (`/v1/payments/payouts`) with mandatory `PayPal-Request-Id` idempotency headers.

### 5. AG Grid Multi-Contract Audit Ledger (`/components/CommandCenter.tsx`)
* **Role:** High-throughput 60 FPS transaction ledger supporting multi-project filtering and real-time risk heatmaps.

---

## Security Architecture & Compliance

For detailed security policies (OWASP LLM Top 10, NIST CSF 2.0, PCI-DSS offloading), see [SECURITY.md](SECURITY.md).
