# AgenticPay AI - Architecture Specification 📐

This document outlines the system architecture, component breakdown, data flow, security model, and PayPal API integration pattern for **AgenticPay AI**.

---

## 🏛️ System Overview Diagram

```
                     ┌───────────────────────────────────────────────┐
                     │          Web UI / Client Dashboard            │
                     │  - Next.js 14 (App Router)                    │
                     │  - AG Grid Data Engine (Real-Time Logs/Risk) │
                     │  - PayPal JS SDK Buttons / Checkout Modal     │
                     └───────────────────────┬───────────────────────┘
                                             │ REST API / Server Actions
                     ┌───────────────────────▼───────────────────────┐
                     │           Next.js Server API Backend          │
                     │  - Agent Execution Engine (Tool Calling)      │
                     │  - Multimodal Vision Auditor                  │
                     │  - Deterministic Security Guardrail Enforcer  │
                     │  - PayPal OAuth & Payment Gateway Adapter     │
                     └──────────┬─────────────────────────┬──────────┘
                                │                         │
      ┌─────────────────────────▼────────┐       ┌────────▼────────────────────────┐
      │   PayPal Developer Sandbox       │       │       Multimodal LLM            │
      │  - Orders API (Checkout / Pre-Auth)│       │  - Gemini / OpenAI API          │
      │  - Payouts API (Escrow Release)  │       │  - Vision & Reasoning Engine    │
      │  - Vault API (Tokenization)      │       └─────────────────────────────────┘
      └──────────────────────────────────┘
```

---

## 🧩 Core Architectural Components

### 1. Agent Execution Engine (`/lib/agent`)
* **Role:** Manages the lifecycle of AI agents (Buyer Agent & Seller Agent).
* **Key Modules:**
  * `a2aProtocol.ts`: Handles Agent-to-Agent message exchange and bargaining rules.
  * `toolRegistry.ts`: Exposes executable actions to the LLM (e.g., `check_budget`, `verify_proof`, `create_paypal_order`).

### 2. Deterministic Guardrail Enforcer (`/lib/guardrails`)
* **Role:** Non-AI validation layer that intercepts all AI intents before calling external financial APIs.
* **Checks:** Enforces hard budget caps, velocity controls, and vendor sanity checks.

### 3. PayPal Gateway Adapter (`/lib/paypal`)
* **Role:** Secure server-side wrapper for PayPal Developer REST APIs.
* **Key Functions:**
  * `getAccessToken()`: OAuth 2.0 authentication with PayPal Sandbox.
  * `createOrder(amount, currency)`: Generates PayPal checkout session.
  * `executePayout(receiverEmail, amount)`: Releases escrow funds upon AI audit clearance.

### 4. AG Grid Financial Command Center (`/components/grid`)
* **Role:** Provides high-throughput, real-time visualization of agent activity and risk metrics.

---

## 🔒 Security Architecture & Compliance

For detailed cybersecurity compliance standards (OWASP Top 10 for LLMs, NIST CSF 2.0, PCI-DSS, ISO 42001), please refer to our dedicated [SECURITY.md](SECURITY.md) policy document.

### Security Highlights:
1. **Server-Side API Proxying:** All PayPal OAuth client secrets and AI API keys are isolated on the server.
2. **Zero PCI-DSS Scope:** Card data capture is 100% offloaded to PayPal's secure SDK iframe.
3. **Emergency Kill-Switch:** Instant token revocation and mission freeze capabilities.
