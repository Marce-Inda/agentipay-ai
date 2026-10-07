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

To support real-world enterprise operations where a company hires multiple contractors across different initiatives:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 MASTER EMERGENCY KILL-SWITCH (Global Safety Halt)                        │
│ » Revokes PayPal OAuth credentials at account level in critical emergencies │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
      ┌────────────────────────────────┼────────────────────────────────┐
      ▼                                ▼                                ▼
┌───────────────────────────┐    ┌───────────────────────────┐    ┌───────────────────────────┐
│ CONTRACT #1: Web Dev      │    │ CONTRACT #2: UI/UX Brand  │    │ CONTRACT #3: Marketing    │
│ - Vendor: dev@agency.com  │    │ - Vendor: design@studio.com│    │ - Vendor: ad@agency.com   │
│ - Vault Cap: $250.00 USD  │    │ - Vault Cap: $150.00 USD  │    │ - Vault Cap: $100.00 USD  │
│ [ ⏸️ Freeze Contract ]    │    │ [ ⏸️ Freeze Contract ]    │    │ [ ⏸️ Freeze Contract ]    │
└───────────────────────────┘    └───────────────────────────┘    └───────────────────────────┘
```

### Key Multi-Project Features:
1. **Isolated Budget Envelopes:** Each project operates with its own pre-authorized Vault budget cap, preventing cross-project budget spillover.
2. **Dual-Tier Control Hierarchy:**
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
