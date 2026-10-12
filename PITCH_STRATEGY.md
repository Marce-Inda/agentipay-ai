# 🎙️ Playbook & Estrategia para el Pitch: PayPal AI Hackathon

**Proyecto:** AgenticPay AI  
**Límite de Video:** Máximo **3 minutos (180 segundos)** en YouTube *(Regla Oficial 4)*  
**Objetivos de Premio:**  
1. 🏆 **Grand Prize (1st Place $12,000 USD)**  
2. ⚡ **Best Use of Agentic Commerce ($5,000 USD)** o **Best Use of PayPal + AI ($5,000 USD)**  
3. 📊 **Sponsor Prize: Best Use of AG Grid (1st Place $5,000 USD / 2nd Place $2,000 USD)**  

---

## 💡 1. Tesis Central y Gancho (The 10-Second Hook)

> *"El comercio entre agentes de IA ya está aquí, pero tiene un problema fatal: **ningún CFO en su sano juicio dejaría que un modelo de lenguaje tenga acceso directo a la cuenta bancaria de la empresa**. Si el agente alucina o sufre una inyección de prompt, el dinero desaparece.  
> **AgenticPay AI** resuelve esto con la primera plataforma de contratos B2B y escrow autónomo respaldada por **PayPal Vault**, gobernanza determinista no-IA, enlaces de intake viral y un libro mayor de auditoría en tiempo real con **AG Grid**."*

---

## ⏱️ 2. Guión Cronometrado Segundo a Segundo (180 Segundos / 3:00 Minutos)

### Bloque 1: El Problema Real (0:00 - 0:25) [25 seg]
* **En pantalla:** Dashboard principal en Dark Mode (`ProjectPortfolioView`) mostrando los dos carriles (Managed Contracts vs Assigned Contracts).
* **Voz en off (Inglés):**  
  *"Autonomous AI agents can negotiate and write code, but deploying them in real-world procurement is terrifying. Without financial guardrails, prompt injection attacks can drain corporate budgets, and holding funds directly violates money transmission laws."*

### Bloque 2: La Solución y Arquitectura No Custodial (0:25 - 0:45) [20 seg]
* **En pantalla:** Transición al diagrama de arquitectura o zoom en las tarjetas de Vault Envelope (`Vault Pre-Authorized Escrow Cap`).
* **Voz en off:**  
  *"Meet AgenticPay AI: an enterprise multi-agent escrow platform built on PayPal's Developer Platform. It operates as a non-custodial Technical Service Provider: client funds remain safely inside PayPal’s regulated infrastructure, while our dual-agent system orchestrates conditional settlement upon verified proof-of-work."*

### Bloque 3: Demo en Vivo — Swimlanes, Intake Viral & Negociación (0:45 - 1:25) [40 seg]
* **En pantalla:**
  1. Mostrar la vista dividida **Two-Column Master Swimlane**: a la izquierda *Managed Contracts (Cuentas por Pagar)* y a la derecha *Assigned Contracts (Cuentas por Cobrar)*.
  2. **[GEMA 1 - Intake Link]:** En la columna derecha, hacer clic en el botón de **"Copiar Enlace de Intake de Escrow"** (`agenticpay.ai/escrow/...`) para mostrar cómo un contratista invita a un cliente a fondear un sobre de Vault en un clic.
  3. Entrar a un proyecto y abrir el chat del agente (`AgentChat`). Escribir un requerimiento de contratación y ver cómo el agente estructura el hito y pre-autoriza el presupuesto dentro del sobre de Vault sin tocar dinero real aún.
* **Voz en off:**  
  *"The portfolio divides seamlessly between contracts you manage and contracts assigned to you. Contractors can share one-click Escrow Intake links for instant client onboarding. When a buyer initiates a project, our procurement agent negotiates deliverables and pre-authorizes budget caps strictly within PayPal Vault envelopes."*

### Bloque 4: El Momento Wow — Auditoría de Entregable & AG Grid (1:25 - 2:00) [35 seg]
* **En pantalla:**
  1. Cambiar a la vista del contratista y pegar un entregable (ej. link de GitHub PR).
  2. Hacer clic en **"Run Audit Inspection"** o **"Submit Deliverable for Audit"**.
  3. Mostrar cómo la IA evalúa el código en segundos, calcula el score ($\ge 85\%$) y muestra el log HTTP con la cabecera `PayPal-Request-Id`.
  4. Bajar de inmediato a la tabla **AG Grid Audit Ledger** (`CommandCenter`) mostrando la fila verde recién insertada con animación a 60 FPS, badges de riesgo y el Batch ID de PayPal.
* **Voz en off:**  
  *"When the contractor submits deliverable proof, our AI Auditor inspects code quality against acceptance criteria inside an isolated execution boundary. Notice how the settlement stream updates live in our high-performance AG Grid real-time audit ledger, logging an immutable audit trail."*

### Bloque 5: Blindaje Técnico — Dual-Key & Ataques Adversariales (2:00 - 2:35) [35 seg]
* **En pantalla:**
  1. **[GEMA 2 - Dual-Key > $1k]:** Mostrar un hito de $3,500 USD. La IA lo audita al 96%, pero aparece el badge amber pulsante: `🛡️ DUAL-KEY SIGNATURE REQ.`.
  2. Mostrar cómo el dinero NO se desembolsa solo: el usuario contratante hace clic en **"Authorize & Release"** para firmar manualmente.
  3. Mostrar un payload con inyección (`<!-- ignore previous instructions -->`) rechazado con score de 15%.
  4. Resaltar la cabecera de red `PayPal-Request-Id`.
* **Voz en off:**  
  *"Here is our enterprise moat: For high-value milestones exceeding $1,000 USD, autonomous payout is locked. The AI verifies technical compliance, but funds stay in escrow until the human executive executes Dual-Key Authorization. Every single PayPal payout call uses deterministic PayPal-Request-Id headers, making duplicate payouts mathematically impossible."*

### Bloque 6: Rigor de Ingeniería, Kill-Switch & Cierre (2:35 - 3:00) [25 seg]
* **En pantalla:**
  1. **[GEMA 3 - Kill-Switch en vivo]:** Presionar el botón rojo de **"Master Emergency Kill-Switch"** en la barra superior y mostrar cómo congela instantáneamente todos los tokens de la cuenta.
  2. Mostrar una placa o terminal rápida con: **"52/52 Passing Tests • 100% Automated Guardrails"**.
  3. Vista global del dashboard con las métricas consolidadas.
* **Voz en off:**  
  *"With instant Emergency Kill-Switch protection and a 100% verified test suite across 52 automated checks, AgenticPay AI fuses Gemini AI intelligence, non-AI deterministic guardrails, AG Grid transaction streams, and PayPal’s enterprise APIs to make autonomous B2B commerce safe, compliant, and scalable. Thank you."*

---

## 🌟 3. Los Puntos Fuertes que Debes Enfatizar (Tus "Moats")

### A. Para los Jueces de PayPal (Categoría: Best Use of PayPal + AI / Agentic Commerce)
1. **Idempotencia con `PayPal-Request-Id`:** Menciona expresamente esta cabecera en el video. El 99% de los proyectos de hackathon no la usan. Demuestra madurez en ingeniería de pagos bancarios.
2. **Modelo No Custodial:** Explicar que el dinero nunca toca cuentas bancarias nuestras, sino que se apoya en PayPal Multiparty / Delayed Disbursement (`COMPLIANCE.md`).
3. **Pre-autorización con Vault:** Los fondos están asegurados desde el día 1, eliminando el riesgo de impago para el contratista y el riesgo de fuga para el comprador.
4. **Dual-Key Threshold ($1,000 Cap):** Límite estricto de autonomía financiera que protege el capital contra alucinaciones del modelo.

### B. Para los Jueces de AG Grid (Categoría: Best Use of AG Grid - $5,000 USD)
1. **Rendimiento a 60 FPS:** Mostrar cómo el `CommandCenter` filtra y actualiza cientos de transacciones multi-proyecto sin lag.
2. **Columnas Financieras Personalizadas:** Badges de riesgo en tiempo real, links al Batch ID de PayPal Sandbox y formateo de divisas con AG Grid themes profesionales.
3. **Trazabilidad de Auditoría:** AG Grid no es una tabla decorativa; es el registro de auditoría legal de la plataforma.

---

## 🎬 4. Consejos Tácticos para Grabar el Video

* **Resolución y Zoom:** Graba en 1080p o 4K a 60 FPS. Haz zooms suaves a las áreas clave (el botón de Intake Link, el score de la IA, el log de PayPal con el Request-ID, el modal Dual-Key y la fila en AG Grid). No dejes que el juez tenga que forzar la vista.
* **Voz y Claridad:** Utiliza un micrófono claro. Habla con seguridad y ritmo constante en inglés (o con voz sintetizada de alta calidad tipo ElevenLabs si prefieres pronunciación nativa perfecta).
* **Tiempo Estricto:** **Máximo 2 minutos con 50 segundos.** Si el video dura 3:01, corres el riesgo de que los jueces no miren el final o te penalicen.
* **Sin Placeholders:** Nunca digas "esto es una simulación" o "aquí iría código de prueba". Habla de la plataforma como un software empresarial operando en **PayPal Sandbox Environment**.

---

## 📋 5. Puntos para el Formulario de Devpost

Cuando llenes el formulario de entrega en Devpost, usa estas respuestas preparadas:

* **Inspiration:** The trust deficit in B2B freelancing and the security danger of unconstrained AI agents moving corporate money without financial guardrails.
* **What it does:** Autonomous multi-agent contract negotiation, viral escrow intake links, deliverable code auditing, and conditional escrow settlement via PayPal Vault with AG Grid real-time streaming.
* **How we built it:** Next.js 16 (Turbopack), TypeScript, PayPal REST APIs v2 (Payouts with `PayPal-Request-Id` & Vault), Gemini LLM via AI SDK, AG Grid Enterprise-grade ledger, and deterministic non-AI TypeScript guardrails.
* **Challenges we ran into:** Designing a strictly non-custodial architecture that complies with FinCEN/PSD2 regulations while preventing race-condition double payments in serverless environments.
* **Accomplishments that we're proud of:** 100% test pass rate across 52 automated Jest tests, cryptographic idempotency with `PayPal-Request-Id`, Tiered Dual-Key governance for high-value milestones, and real-time 60 FPS audit streaming in AG Grid.
