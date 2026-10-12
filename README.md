# AgenticPay AI 🤖💳
> **Autonomous Agentic Commerce & Intelligent Milestone Payout Engine**
> Built for the *PayPal AI Hackathon: Build What's Next with PayPal and AI*.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Security Policy](https://img.shields.io/badge/Security-Zero--Trust_Guardrails-green.svg)](SECURITY.md)
[![PayPal Developer Sandbox](https://img.shields.io/badge/PayPal-Sandbox--API-003087?logo=paypal)](https://developer.paypal.com)
[![AG Grid Powered](https://img.shields.io/badge/AG_Grid-Data_Engine-202A36)](https://www.ag-grid.com/)
[![Render Deployed](https://img.shields.io/badge/Render-Hosted-46E3B7?logo=render)](https://render.com)

---

## 🌟 Overview

**AgenticPay AI** bridges the gap between **autonomous AI decision-making** and **secure financial transactions**.

While traditional chatbots only suggest links or force users to manually click payment buttons on every purchase, **AgenticPay AI** is equipped with a pre-authorized budget envelope (via PayPal Vault) to:
1. **Negotiate & Purchase Autonomously:** Engage in Agent-to-Agent (A2A) negotiations for products and services without human UI friction during execution.
2. **Audit & Escrow:** Multimodally inspect deliverables (code PRs, design assets, invoices) using vision AI before releasing funds.
3. **Settle via Real PayPal Sandbox APIs:** Execute automated payouts via **PayPal REST APIs (`api-m.sandbox.paypal.com`)** with an inspectable HTTP network payload log in AG Grid (no fake static mockups!).
4. **Guard & Control:** Enforce deterministic non-AI TypeScript budget ceilings, OWASP LLM security defenses, and an instant emergency Kill-Switch.

---

## 🎯 Key Features & Enterprise Capabilities

* **📂 Enterprise Two-Column Master Swimlanes:** Parallel 50/50 dual workspace layout seamlessly integrating Executive Summaries with their respective contract feeds: **"Managed Contracts (Outbound Escrow / Accounts Payable)"** on the left and **"Assigned Contracts (Inbound Receivables / Accounts Receivable)"** on the right. Includes a clean global search utility, dual/single focus toggle, cascading subcontracting support, and automatic `localStorage` persistence.
* **👥 Organization & Account Settings:** Choose between **Individual Professional Account** (freelancers/creators with swift terms) and **Enterprise Business Account** (corporate entities with Tax ID/VAT, automated binding Master MSA & SOW contracts, multi-user approval governance, and pooled Vault caps). Includes multi-tenant workspace session switching.
* **🔍 Milestone Deliverable Audit & Automated Settlement:** Principal defines strict **Acceptance Criteria** per milestone; Contractor views specifications and submits proofs (GitHub PRs, commit diffs, architectural docs). An **AI Audit Agent** validates compliance with OWASP LLM01 injection defense and automatically releases the PayPal Escrow payout when confidence >=85%.
* **🤖 Resilient Multi-Model AI Engine (OpenRouter):** Powered by Vercel AI SDK over OpenRouter featuring automatic fallback from primary (`openai/gpt-4o-mini`) to secondary (`meta-llama/llama-3.3-70b-instruct`) models.
* **🛡️ Dual-Tier Security & Guardrails:** Non-AI deterministic TypeScript layer enforcing strict per-project Vault caps, granular project-level contract freezing, prompt injection defenses, and master emergency kill-switch overrides.
* **⚡ 100% Real Sandbox API Execution:** Authenticated execution against PayPal Sandbox REST APIs with live HTTP network request inspection in AG Grid (plus graceful fallback simulation if credentials are empty).
* **👁️ Multimodal Proof-of-Execution Audit:** Vision & code verification of pull requests, commits, and digital deliverables before releasing escrow funds.
* **📊 AG Grid Multi-Contract Audit Ledger:** Real-time 60 FPS transaction ledger featuring project context tagging, risk level heatmaps, and payload inspection modals.

---

## 📚 Enterprise Technical Documentation
 
| Document | Focus & Scope |
| :--- | :--- |
| 📐 [ARCHITECTURE.md](ARCHITECTURE.md) | System Component Breakdown, Sequence Flows & Dual-Perspective Model |
| 🏛️ [COMPLIANCE.md](COMPLIANCE.md) | Regulatory Compliance, Non-Custodial TSP Architecture & Chargeback Mitigation |
| 🛡️ [SECURITY.md](SECURITY.md) | Financial Guardrails, OWASP LLM01 Defenses & Kill-Switch Circuit Breaker |
| 🎨 [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Two-Column Master Swimlanes, Design Tokens & Component Specs |
| 🧪 [TESTING.md](TESTING.md) | Unit & Integration Test Architecture (52 Automated Passing Checks) |
| 📜 [CHANGELOG.md](CHANGELOG.md) | Institutional Version History & Engineering Milestones |
| 📊 [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) | Data Lineage, Privacy Standards & Audit Trail Persistence |
| 🤝 [ETHICS_AND_RESPONSIBLE_AI.md](ETHICS_AND_RESPONSIBLE_AI.md) | Responsible AI Governance & Transparency Matrix |
| 💼 [BUSINESS_MODEL.md](BUSINESS_MODEL.md) | Commercial Model, Institutional Account Tiers & Revenue Drivers |

---

## ⚡ Quick Start & Local Setup

### Prerequisites
* **Node.js:** v18.0 or higher
* **npm** or **pnpm**
* **PayPal Developer Account:** Free Sandbox credentials from [developer.paypal.com](https://developer.paypal.com)

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/paypal-ai-hackathon.git
cd paypal-ai-hackathon
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env.local` and insert your sandbox credentials:
```bash
cp .env.example .env.local
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏆 Hackathon Sponsor Integrations

* **PayPal Developer Platform:** Core transaction settlement, pre-authorization (Vault), and payout engine.
* **AG Grid:** Real-time data grid rendering AI agent thought logs and transaction risk matrices.
* **Render:** Production deployment platform for full-stack SSR and API endpoints.

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
