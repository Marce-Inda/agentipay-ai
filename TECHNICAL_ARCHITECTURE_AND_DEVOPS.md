# Technical Architecture & DevOps Specification ⚙️🚀
> **Pragmatic AI Engineering & DevOps Architecture (Zero Over-Engineering)**

---

## 🏛️ 1. Software Architecture: Clean Modular Monolith

To avoid the trap of over-engineering (microservices, complex message brokers, or heavy Docker orchestration), **AgenticPay AI** is structured as a **Clean Modular Monolith** using Next.js 14 / 16 (App Router).

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    NEXT.JS MODULAR MONOLITH                            │
 ├───────────────────────────────────┬────────────────────────────────────┤
 │  Client Components (Frontend)     │  Server Actions & API Routes       │
 │  - Multi-Project Context Switcher │  - /api/agent/stream (SSE)         │
 │  - AG Grid Multi-Contract Ledger  │  - /api/agent/audit (Multimodal)   │
 │  - Agentic Commerce Assistant UI  │  - /api/paypal/orders (REST)       │
 │  - Dual-Tier Security Controls    │  - /lib/guardrails (TypeScript)    │
 └───────────────────────────────────┴────────────────────────────────────┘
```

### Why Next.js App Router?
* **End-to-End Type Safety:** Shared TypeScript interfaces across UI components, LLM tool definitions, multi-project context, and PayPal API payloads.
* **Server-Side Credential Isolation:** All secret keys (`PAYPAL_CLIENT_SECRET`, `OPENROUTER_API_KEY`) stay strictly on the server.

---

## 🤖 2. AI Engineering: Vercel AI SDK & Multi-Model Fallback Chain

* **AI Framework:** **Vercel AI SDK (`ai` & `@ai-sdk/openai`)**
  * *Why Vercel AI SDK instead of LangChain/Haystack?* Zero boilerplate, native streaming support (`streamText`), type-safe Zod schema validation, and lightweight performance.
* **Multi-Model Provider Adapter (`/lib/ai/provider.ts`):**
  * **Primary Model:** `openai/gpt-4o-mini` (ultra-fast inference, ~180ms TTFT, lowest token cost).
  * **Automated Fallback Model:** `meta-llama/llama-3.3-70b-instruct` (switches automatically if primary endpoint experiences latency or rate limits).

---

## 🚀 3. DevOps & CI/CD: Render Automated Deployment

To satisfy the **Best Use of Render** sponsor prize ($1,000 credits) while maintaining zero operational overhead:

```
[ GitHub Repo (main branch) ] ──► (Git Push) ──► [ Render Web Service Auto-Build ] ──► [ Live Production URL ]
```

* **Zero Docker Overhead:** Render natively detects Next.js applications and handles SSR compilation (`npm run build`).
* **Environment Secrets:** Injected via Render Dashboard (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `OPENROUTER_API_KEY`).
* **Build Time:** ~90 seconds from commit to live production URL.

---

## 📊 4. Pragmatic State & Real-Time Streaming

* **Server-Sent Events (SSE):** Used for real-time streaming of AI thought logs to AG Grid (`/api/agent/stream`) without configuring heavy WebSocket servers (socket.io/Redis).
* **AG Grid Async State:** Updates UI cells using `api.applyTransactionAsync()` for smooth 60 FPS rendering.
