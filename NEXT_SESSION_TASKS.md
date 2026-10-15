# 📋 Hoja de Ruta y Tareas para la Próxima Sesión — AgenticPay AI 🚀

> **Estado del Proyecto:** `v0.5.0` (Dual-Key Financial Governance & Post-Premortem Resilience)  
> **Validación:** 52/52 tests unitarios e integrados pasando (100% éxito)  
> **Objetivo:** Ejecutar la fase final de despliegue, demostración audiovisual y entrega para el *PayPal AI Hackathon 2026*.

---

## 🎯 Resumen Ejecutivo del Sombrero Azul

Hemos completado y blindado la arquitectura técnica, los guardrails deterministas no-IA, el motor de auditoría multimodal, la integración de PayPal Sandbox con idempotencia, y la interfaz *Two-Column Master Swimlanes* con AG Grid.

Para la próxima sesión, el foco pasa de **construcción de código** a **despliegue en vivo, producción audiovisual y formalización de entrega**.

---

## 📌 Lista de Tareas Priorizadas (Actionable Checklist)

### 🟢 Prioridad 1: Despliegue y Verificación en Vivo en Render (COMPLETADO)
- [x] **Configurar Render Web Service:**
  - Conectar el repositorio de GitHub (`main`).
  - Definir comando de build: `npm install && npm run build`.
  - Definir comando de inicio: `npm start`.
- [x] **Inyectar Variables de Entorno en el Dashboard de Render:**
  - `PAYPAL_CLIENT_ID`
  - `PAYPAL_CLIENT_SECRET`
  - `PAYPAL_ENVIRONMENT=sandbox`
  - `OPENROUTER_API_KEY` (o provider de IA activo)
  - `NEXT_PUBLIC_APP_URL`
- [x] **Smoke Test en Producción:**
  - Verificar que la URL pública cargue en < 2 segundos con HTTPS.
  - Comprobar que AG Grid renderice transacciones a 60 FPS sin errores en consola.
  - Probar la simulación/ejecución con PayPal Sandbox desde el enlace público.

---

### 🟡 Prioridad 2: Producción del Video de Demostración (3:00 min)
*Siguiendo la estrategia de [PITCH_STRATEGY.md](file:///home/marce-i/Documentos/proyectos/paypal-ai-hackathon/PITCH_STRATEGY.md) y [PRE_MORTEM_ANALYSIS.md](file:///home/marce-i/Documentos/proyectos/paypal-ai-hackathon/PRE_MORTEM_ANALYSIS.md)*

- [ ] **Minuto 0:00 - 0:30 (El Gancho Inmediato / Hook de Acción):**
  - **Regla estricta:** Cero diapositivas teóricas en los primeros 30 segundos.
  - Mostrar en vivo el agente evaluando un entregable y liberando el payout en PayPal Sandbox con ID real y actualización en AG Grid.
- [ ] **Minuto 0:30 - 1:30 (El Problema y la Arquitectura Dual-Key):**
  - Demostrar el panel *Two-Column Master Swimlanes* (Cuentas por Pagar vs. Cuentas por Cobrar).
  - Mostrar el guardrail de $1,000 USD y cómo un hito mayor entra en estado `AUDITED_PENDING_APPROVAL` requiriendo firma gerencial (Human-in-the-Loop).
- [ ] **Minuto 1:30 - 2:15 (Auditoría Multimodal e Inspección de Red):**
  - Subir un entregable (PR/Commit) y ver el análisis de visión/código en vivo.
  - Abrir el modal de inspección HTTP en AG Grid para probar que las llamadas REST a PayPal son 100% reales.
- [ ] **Minuto 2:15 - 3:00 (Cierre y Premios de Patrocinadores):**
  - Recapitular valor comercial (FinCEN TSP Non-Custodial, OWASP LLM01, modelo B2B).
  - Resaltar la integración con **PayPal Developer Platform**, **AG Grid** y **Render**.

---

### 🟢 Prioridad 3: Formulario de Entrega y Materiales de Devpost
- [ ] **Redactar Descripción de Devpost:**
  - Sintetizar el [README.md](file:///home/marce-i/Documentos/proyectos/paypal-ai-hackathon/README.md) y [ARCHITECTURE.md](file:///home/marce-i/Documentos/proyectos/paypal-ai-hackathon/ARCHITECTURE.md).
  - Listar explícitamente los premios a los que se postula: *Grand Prize*, *Best Use of Agentic Commerce (PayPal)*, *AG Grid Sponsor Prize*, *Render Sponsor Prize*.
- [ ] **Capturas de Pantalla en Alta Resolución:**
  - Captura 1: Dashboard General con Dual Executive Swimlanes.
  - Captura 2: AG Grid Transaction Ledger con risk heatmaps e inspectores de payload.
  - Captura 3: Auditoría Multimodal de entregable con aprobación automática.
  - Captura 4: Flujo Dual-Key con botón de autorización gerencial.
- [ ] **Verificación de Enlaces Públicos:**
  - URL del Repositorio de GitHub (público con `LICENSE` MIT).
  - URL de Producción en Render.
  - URL del Video en YouTube / Vimeo (sin restricciones de privacidad).

---

### ⚪ Prioridad 4: Mantenimiento y Congelamiento de Código
- [ ] Ejecutar suite completa de tests de regresión:
  ```bash
  npm test
  ```
- [ ] Validar build de producción limpia sin errores de TypeScript:
  ```bash
  npm run build
  ```
- [ ] Congelar código (`git tag v1.0.0-hackathon-final`) para evitar modificaciones accidentales antes de la evaluación.

---

## 🛠️ Comandos Rápidos de Referencia

```bash
# 1. Correr tests automatizados (52 tests)
npm test

# 2. Correr build local para verificar antes de subir
npm run build

# 3. Levantar servidor de desarrollo
npm run dev

# 4. Estado de git
git status
```
