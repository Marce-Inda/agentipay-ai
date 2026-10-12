# AgenticPay AI - Architecture Specification 📐

This document outlines the system architecture, component breakdown, data flow, multi-project hierarchy, security model, and PayPal API integration pattern for **AgenticPay AI**.

---

## 🏛️ System Overview & Multi-Project Hierarchy Diagram

```
                     ┌───────────────────────────────────────────────┐
                     │          Web UI / Client Dashboard            │
                     │  - Next.js App Router (Modular Monolith)       │
                     │  - Multi-Project Switcher & Context Selector  │
                     │  - AG Grid Multi-Contract Audit Ledger         │
                     └───────────────────────┬───────────────────────┘
                                             │ REST API / Server Actions
                     ┌───────────────────────▼───────────────────────┐
                     │           Next.js Server API Backend          │
                     │  - Multi-Project Context Isolation Manager    │
                     │  - Agent Execution & Bargaining Engine        │
                     │  - Multimodal Vision Deliverable Auditor      │
                     │  - Dual-Tier Guardrail & Safety Enforcer     │
                     │  - PayPal OAuth & Payout Gateway Adapter      │
                     └──────────┬─────────────────────────┬──────────┘
                                │                         │
      ┌─────────────────────────▼────────┐       ┌────────▼────────────────────────┐
      │   PayPal Developer Sandbox       │       │       Multimodal LLM            │
      │  - Orders API (Checkout / Pre-Auth)│       │  - OpenAI / OpenRouter / Gemini │
      │  - Payouts API (Escrow Release)  │       │  - Vision & Reasoning Engine    │
      │  - Vault API (Tokenization)      │       └─────────────────────────────────┘
      └──────────────────────────────────┘
```

---

## 🏢 Multi-Project & Multi-Contract Architecture

To support real-world enterprise operations where an account can both hire contractors and deliver client projects (including subcontracting chains):

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 MASTER EMERGENCY KILL-SWITCH (Global Safety Halt)                        │
│ » Revokes PayPal OAuth credentials at account level in critical emergencies │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
      ┌────────────────────────────────┴────────────────────────────────┐
      ▼                                                                 ▼
┌───────────────────────────────────────────────┐     ┌───────────────────────────────────────────────┐
│ 💼 PROYECTOS QUE CONTRATO (Outgoing Escrow)   │     │ 🛠️ PROYECTOS QUE REALIZO (Incoming Escrow)    │
│ » Vault Pre-Authorized by User's Account      │     │ » Vault Locked by Client's Account            │
│ » Deliverables audited before payout release  │     │ » Milestones verified & funds claimed         │
├───────────────────────┬───────────────────────┤     ├───────────────────────┬───────────────────────┤
│ Contract: Web Dev     │ Contract: Copywriting │     │ Contract: FinTech App │ Contract: Design QA   │
│ Vendor: dev@agency    │ Vendor: copy@pro.io   │     │ Client: Acme Corp     │ Client: Global Ret.   │
│ Vault Cap: $250.00    │ Vault Cap: $100.00    │     │ Escrow: $1,500.00     │ Escrow: $450.00       │
└───────────────────────┴───────────────────────┘     └───────────────────────┴───────────────────────┘
```

### Key Multi-Project & Entity Features:
1. **Account Entity Model (Personal vs. Business):**
   * **Personal Accounts:** Individual profile, standard terms of service, direct PayPal account settlement, streamlined single-operator escrow.
   * **Business Accounts:** Corporate legal entity, Tax ID/VAT registration, formal **MSA (Master Services Agreement)** and **SOW (Statement of Work)** binding contracts, multi-user approval governance, and pooled departmental Vault envelopes.
2. **Dual-Perspective Relationship Model:**
   * **Outgoing (`CONTRACTING`):** The account acts as Buyer/Principal. Funds are tokenized and deposited into escrow; AI audits deliverables submitted by third parties.
   * **Incoming (`CONTRACTOR`):** The account acts as Vendor/Freelancer. Escrow funds are guaranteed upfront ($0 payment default risk); deliverables are submitted to trigger PayPal payout execution.
3. **Cascading Subcontracting Engine:** An incoming project can spawn child outgoing contracts (e.g., delegating a component), preserving end-to-end milestone traceability.
4. **Dual-Tier Control Hierarchy:**
   * **Project-Level Escrow Freeze:** Pauses or cancels escrow releases for a specific project/contract without affecting other active projects.
   * **Master Emergency Kill-Switch:** Account-level circuit breaker that immediately revokes tokens across all active projects.

---

## 🧩 Core Architectural Components

### 1. Multi-Project Context Manager (`/lib/projects`)
* **Role:** Isolates project states, vendor contracts, milestones, and active escrow balances.

### 2. Deterministic Guardrail Enforcer (`/lib/guardrails`)
* **Role:** Non-AI validation layer intercepting AI intents before calling PayPal APIs.
* **Enforces:** Per-project budget caps, OWASP LLM01 prompt injection sanitization, confidence score thresholds (>=85%), and dual-tier kill-switch status.

### 3. PayPal Gateway Adapter (`/lib/paypal`)
* **Role:** Server-side client wrapper for PayPal REST APIs (`api-m.sandbox.paypal.com`).
* **Functions:** OAuth2 token management, Vault tokenization, and Payouts execution (`/v1/payments/payouts`).

### 4. AG Grid Multi-Contract Audit Ledger (`/components/CommandCenter.tsx`)
* **Role:** High-throughput 60 FPS transaction ledger supporting multi-project filtering and real-time risk heatmaps.

---

## 🔒 Security Architecture & Compliance

For detailed security policies (OWASP LLM Top 10, NIST CSF 2.0, PCI-DSS offloading), see [SECURITY.md](SECURITY.md).
