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

* **📂 Enterprise Multi-Project Escrow Portfolio:** Multi-tenant dashboard allowing companies to manage multiple contractor initiatives simultaneously, with search filtering, custom project onboarding, and automatic `localStorage` state persistence.
* **👥 Dual-Account Profile Role Switcher:** Instant workspace adaptation between **Business / Employer Mode** (managing Vault caps & contract freezes) and **Persona / Freelancer Mode** (inspecting Escrow guarantees & submitting deliverable proofs).
* **🤖 Resilient Multi-Model AI Engine (OpenRouter):** Powered by Vercel AI SDK over OpenRouter featuring automatic fallback from primary (`openai/gpt-4o-mini`) to secondary (`meta-llama/llama-3.3-70b-instruct`) models.
* **🛡️ Dual-Tier Security & Guardrails:** Non-AI deterministic TypeScript layer enforcing strict per-project Vault caps, granular project-level contract freezing, prompt injection defenses, and master emergency kill-switch overrides.
* **⚡ 100% Real Sandbox API Execution:** Authenticated execution against PayPal Sandbox REST APIs with live HTTP network request inspection in AG Grid (plus graceful fallback simulation if credentials are empty).
* **👁️ Multimodal Proof-of-Execution Audit:** Vision-powered AI verification of code commits, digital assets, or receipt authenticity before releasing escrow funds.
* **📊 AG Grid Multi-Contract Audit Ledger:** Real-time 60 FPS transaction ledger featuring project context tagging, risk level heatmaps, and payload inspection modals.

---

## 📚 Complete Project Documentation

| Document | Focus & Scope |
| :--- | :--- |
| 🎨 [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Nordic Luxury & Warm Fintech Design System & Tokens |
| 📄 [plan_de_implementacion.md](plan_de_implementacion.md) | Full 11-Dimensional Master Plan & Execution Strategy |
| 🌟 [INTEGRATED_BLUE_HAT_SYNTHESIS.md](INTEGRATED_BLUE_HAT_SYNTHESIS.md) | Integrated Architectural Synthesis |
| 📐 [ARCHITECTURE.md](ARCHITECTURE.md) | System Component Breakdown & Data Flow |
| 🛡️ [SECURITY.md](SECURITY.md) | Financial Guardrails, OWASP Defenses & Risk Policy |
| 📊 [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) | Data Governance, GDPR PII Scrubbing & Lineage |
| 🤝 [ETHICS_AND_RESPONSIBLE_AI.md](ETHICS_AND_RESPONSIBLE_AI.md) | Responsible AI (UNESCO, EU AI Act, OECD) |
| 💼 [BUSINESS_MODEL.md](BUSINESS_MODEL.md) | Commercial Strategy, TAM & PayPal TPV Alignment |
| 🔮 [PRE_MORTEM_ANALYSIS.md](PRE_MORTEM_ANALYSIS.md) | Pre-Mortem Risk Analysis & Preventative Measures |
| ⚙️ [TECHNICAL_ARCHITECTURE_AND_DEVOPS.md](TECHNICAL_ARCHITECTURE_AND_DEVOPS.md) | Pragmatic AI Engineering & Render CI/CD Pipeline |

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
