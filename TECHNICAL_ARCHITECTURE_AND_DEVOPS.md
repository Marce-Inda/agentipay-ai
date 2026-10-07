# Technical Architecture & DevOps Specification ⚙️🚀
> **Pragmatic AI Engineering & DevOps Architecture (Zero Over-Engineering)**

---

## 🏛️ 1. Software Architecture: Clean Modular Monolith

To avoid the trap of over-engineering (microservices, complex message brokers, or heavy Docker orchestration), **AgenticPay AI** is structured as a **Clean Modular Monolith** using Next.js 14 (App Router).

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    NEXT.JS 14 MODULAR MONOLITH                         │
 ├───────────────────────────────────┬────────────────────────────────────┤
 │  Client Components (Frontend)     │  Server Actions & API Routes       │
 │  - Interactive AG Grid Dashboard  │  - /api/agent/stream (SSE)         │
 │  - Chat UI & Agent Controls       │  - /api/paypal/orders (REST)       │
 │  - PayPal Buttons & Vault Modals  │  - /lib/guardrails (TypeScript)    │
 └───────────────────────────────────┴────────────────────────────────────┘
```

### Why Next.js 14 App Router?
* **End-to-End Type Safety:** Shared TypeScript interfaces across UI components, LLM tool definitions, and PayPal API payloads.
* **Server-Side Credential Isolation:** All secret keys (`PAYPAL_CLIENT_SECRET`, `GEMINI_API_KEY`) stay strictly on the server.

---

## 🤖 2. AI Engineering: Vercel AI SDK & Gemini Flash

* **AI Framework:** **Vercel AI SDK (`ai` & `@ai-sdk/google`)**
  * *Why Vercel AI SDK instead of LangChain/Haystack?* Zero boilerplate, native streaming support (`streamText`), type-safe Zod schema validation, and lightweight performance.
* **Model Selection:**
  * **Primary Model:** `gemini-1.5-flash` / `gemini-2.0-flash` (ultra-fast inference, native multimodal vision, 1M context window, lowest cost).
  * **Fallback Model:** `gpt-4o-mini`.

---

## 🚀 3. DevOps & CI/CD: Render Automated Deployment

To satisfy the **Best Use of Render** sponsor prize ($1,000 credits) while maintaining zero operational overhead:

```
[ GitHub Repo (main branch) ] ──► (Git Push) ──► [ Render Web Service Auto-Build ] ──► [ Live Production URL ]
```

* **Zero Docker Overhead:** Render natively detects Next.js applications and handles SSR compilation (`npm run build`).
* **Environment Secrets:** Injected via Render Dashboard (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `GEMINI_API_KEY`).
* **Build Time:** ~90 seconds from commit to live production URL.

---

## 📊 4. Pragmatic State & Real-Time Streaming

* **Server-Sent Events (SSE):** Used for real-time streaming of AI thought logs to AG Grid (`/api/agent/stream`) without configuring heavy WebSocket servers (socket.io/Redis).
* **AG Grid Async State:** Updates UI cells using `api.applyTransactionAsync()` for smooth 60 FPS rendering.
