# SPEC Inicial: Auditoría y Mejoras para PayPal AI Hackathon

**Proyecto:** AgenticPay AI  
**Rol del Auditor:** Senior Technical Auditor, Software Architect, Hackathon Judge (PayPal + AI Agents)  
**Metodología:** Spec-Driven (sin modificaciones de código hasta aprobación)  
**Objetivo:** Maximizar posibilidades de ganar el PayPal AI Hackathon  
**Fecha:** 5 de Noviembre de 2026  

---

## DIAGNÓSTICO EJECUTIVO

Tu proyecto está **bien estructurado en conceptos pero presenta brechas críticas en la ejecución** que los jueces del hackathon evaluarán inmediatamente:

### Estado Actual (Síntesis)
- ✅ **Conceptos sólidos:** Control determinístico sobre IA, guardarraíles TypeScript, portafolio dual (outbound/inbound), modelo de datos coherente.
- ✅ **Arquitectura limpia:** Separación clara entre lógica de negocio, rutas de API, y cliente.
- ✅ **UX potente:** AG Grid ledger, estado visual rico, flujos de milestone bien definidos.
- ⚠️ **BRECHA CRÍTICA #1:** El flujo de settlement es **local, no server-authoritative**. Sin una ruta `/settle` real que ejecute PayPal Payouts, el pitch "Integración PayPal" es incompleto.
- ⚠️ **BRECHA CRÍTICA #2:** Sin autenticación y rate-limiting activados, el despliegue en Render es vulnerable a abuso.
- ⚠️ **BRECHA CRÍTICA #3:** Sin verificación **live** de un Sandbox Payout, no puedes demostrar la integración realmente funciona.
- ⚠️ **BRECHA CRÍTICA #4:** El script de demo no existe; sin un video o demo en vivo pulido, los jueces no entienden el impacto.

---

## ESTRUCTURA: 4 PILARES DEL HACKATHON

### PILAR 1: INNOVACIÓN Y VALOR EN INTEGRACIÓN PayPal + AI
**Pregunta del Juez:** "¿Qué problema real resuelve AgenticPay + PayPal? ¿Qué lo diferencia?"

#### Diagnóstico
- **Fortaleza:** El concepto de "IA asesora, guardarraíles determinísticos, PayPal ejecutor" es genuinamente innovador.
- **Debilidad #1:** La ruta `/settle` actual **NO ejecuta PayPal**. Hace settlement local. Esto invalida el pitch "PayPal Sandbox Integration".
- **Debilidad #2:** Sin idempotencia determinística (`PayPal-Request-Id` derivado), no puedes proteger contra double-pays.
- **Debilidad #3:** Sin un video de demostración mostrando un payout real en Sandbox, los jueces verán "demo local, no real".

#### Plan de Mejora
1. **Implementar server-side PayPal Payouts route** (`POST /api/projects/[id]/milestones/[mid]/settle`):
   - Autenticar el usuario.
   - Cargar el proyecto y envelope server-side bajo row locks de PostgreSQL.
   - Revalidar guardarraíles (kill-switch, budget, audit score >= 85%).
   - Generar deterministic fingerprint: `SHA256(projectId + milestoneId + amount)`.
   - Derivar `PayPal-Request-Id` = `REQ-{fingerprint}` y `sender_batch_id` = `SETTLE-{fingerprint}`.
   - Ejecutar PayPal Payouts API (real con credenciales; simulated/suppressed sin ellas).
   - Grabar payout atomically: si PayPal falla → rollback completo, HTTP 502, evento `PAYOUT_BLOCKED`.
   - Si éxito → marcar milestone `COMPLETED`, incrementar project.spentUSD, insertar evento `PAYOUT_EXECUTED` con `payout_batch_id` real.

2. **Prueba Live Sandbox:**
   - Ejecutar E2E completo: crear contrato, submitir deliverable, audit passing, settlement real.
   - Verificar `payout_batch_id` en PayPal Sandbox Dashboard.
   - Grabar en ledger el `batch_status` real (e.g., `PROCESSING`).

3. **Storytelling:**
   - En pitch: "AgenticPay AI separa la autoridad de pago de la IA: la IA asesora, pero TypeScript guardarraíles + PayPal REST Payouts API ejecutan realmente."
   - Demo vivo: mostrar settlement real que ejecuta PayPal Payouts y aparece en el Sandbox Dashboard.

**Impacto esperado:** Diferencia clara del competidor. "Real PayPal integration" vs. "demo local".

---

### PILAR 2: EXPERIENCIA DE USUARIO Y AG Grid (Enterprise Ledger)
**Pregunta del Juez:** "¿Cómo ve un operador de finanzas la confiabilidad de cada payout?"

#### Diagnóstico
- **Fortaleza:** AG Grid ledger está implementado, dark theme customizado, columnas ricas (actor, riesgo, confidence, estado).
- **Debilidad #1:** Faltan **badges visuales de "Payment Rail"** (PAYPAL SANDBOX / SIMULATED / SUPPRESSED). El usuario no sabe si el settlement fue real o local.
- **Debilidad #2:** El **inspector de payload** muestra payload local; sin ejecutar PayPal, no hay `payout_batch_id` real que inspeccionar.
- **Debilidad #3:** La **columna de riesgo** ("Audit Confidence") no transmite visualmente que los guardarraíles determinísticos bloquearon payments arriesgados.
- **Debilidad #4:** Sin **Vault Escrow Envelope visualizer**, los jueces no ven dinero custodiado en escrow (aunque es non-custodial, el UI debería *sugerir* que hay control).

#### Plan de Mejora
1. **Agregar badge "Payment Rail" en AG Grid:**
   - Columna visible: `Payment Rail: PAYPAL_SANDBOX | SIMULATED | SUPPRESSED | BLOCKED`.
   - Color: PAYPAL_SANDBOX = verde (real), SIMULATED = amarillo (demo), SUPPRESSED = gris (sin creds), BLOCKED = rojo (failed).
   - Tooltip: "PAYPAL_SANDBOX: Real PayPal Payouts API was executed with credentials."

2. **Enriquecer el inspector de payload:**
   - Mostrar `PayPal-Request-Id` (deterministic idempotency key).
   - Mostrar `sender_batch_id` derivado.
   - Si es real: mostrar `payout_batch_id` y `batch_status` desde PayPal.
   - Si es fallido: mostrar error code PayPal y razón de rechazo.

3. **Mejorar visualización de guardarraíles:**
   - En portfolio: mostrar envelope como tarjeta visual (progress bar de `spentUSD / budgetCapUSD`).
   - En workspace: mostrar "Autonomous Release Ceiling: $1,000" con símbolo de candado si se requiere aprobación humana.
   - En ledger: agregar columna `Guardrail Reason` (e.g., "HUMAN_APPROVAL_REQUIRED: $2,500 > $1,000 ceiling").

4. **Vault Escrow Envelope Card:**
   - Nuevo componente visual: tarjeta que muestre `maxPerTransactionUSD`, `dailyCeilingUSD`, `spentTodayUSD`, kill-switch status.
   - Indicador de "salud" del escrow: rojo si kill-switch activo, amarillo si daily ceiling cercano, verde si OK.

**Impacto esperado:** Los jueces ven inmediatamente que cada transacción está bajo control determinístico y que PayPal es la autoridad real.

---

### PILAR 3: ROBUSTEZ TÉCNICA Y SEGURIDAD (Render & PostgreSQL)
**Pregunta del Juez:** "¿Qué pasa si dos usuarios hacen settlement concurrentemente? ¿Dónde están las garantías de idempotencia?"

#### Diagnóstico
- **Fortaleza:** Architecture doc describe row locks de PostgreSQL, pero **no está implementado** en código.
- **Debilidad #1:** Sin autenticación real, cualquiera puede llamar `/api/agent/audit` y `/api/agent/stream`. Rate-limiting está descrito pero **no activado**.
- **Debilidad #2:** Sin server-authoritative settle, no hay row locks. Sin row locks, dos requests concurrentes pueden hacer double-settlement.
- **Debilidad #3:** Sin deterministic fingerprint (`PayPal-Request-Id`), retries de PayPal pueden causar double-pays.
- **Debilidad #4:** Ledger deduplication is **broken**: si applicamos el mismo payout log dos veces, incrementa `spentUSD` dos veces (no es idempotente).
- **Debilidad #5:** Sin password recovery, email verification, o RBAC, la seguridad de autenticación es incompleta.
- **Debilidad #6:** Sin durable rate limiting (Redis o compartido), Render free-tier spin-downs resetean los límites.

#### Plan de Mejora

**Fase A: Autenticación y Rate-Limiting (Pre-requisito para Settlement)**
1. Activar autenticación en `/api/agent/audit`, `/api/agent/stream`, `/api/projects/*`, `/api/envelope`.
   - Ya existe código de sesión en `src/lib/auth/session.ts`; solo asegurar que se valide en todas las rutas.
2. Implementar persistent rate-limiting:
   - Pasar de in-memory a PostgreSQL counters (tabla `agenticpay_rate_limits`).
   - Opción alternativa: usar `process-local` con disclaimer claro en docs.
3. Agregar email verification mock en desarrollo, enforced en producción.
4. Logging: cada request rechazado por rate limit debe grabar un evento `RATE_LIMITED` con timestamp.

**Fase B: Server-Authoritative Settlement con Idempotencia**
1. Implementar `/api/projects/[projectId]/milestones/[milestoneId]/settle`:
   ```
   POST /api/projects/abc123/milestones/m1/settle
   {
     "amount": 250.00
   }
   ```
2. Flujo atómico:
   - Autenticar usuario.
   - BEGIN transaction.
   - LOCK milestones table FOR UPDATE (row lock).
   - Cargar project, envelope, milestone del servidor.
   - Generar fingerprint = SHA256(projectId + milestoneId + amount).
   - Derivar PayPal-Request-Id y sender_batch_id.
   - Revalidar guardarraíles (kill-switch, budget, audit >= 85%).
   - Ejecutar PayPal Payouts (real o simulated).
   - Si éxito: marcar COMPLETED, incrementar spend, insertar PAYOUT_EXECUTED event con fingerprint como event_id.
   - Si fallo PayPal: ROLLBACK, retornar HTTP 502 con error structure.
   - COMMIT.

3. Ledger deduplication:
   - Usar `fingerprint` como unique constraint en tabla de ledger events.
   - Retry del mismo milestone → INSERT rechazado (duplicate key), retornar última transacción.

**Fase C: Post-Payout Reconciliation (Stretch)**
1. Grabar `payout_batch_id` en milestone.
2. (Future) Webhooks de PayPal para reconciliar batch status.

**Impacto esperado:** Demo en vivo sin double-pays, sin race conditions, con verdadera autoridad de servidor.

---

### PILAR 4: ESTRATEGIA PARA VIDEO DE DEMO (Pitch < 3 min)
**Pregunta del Juez:** "¿Puedo ver esto funcionando en vivo, de inicio a fin, en < 180 segundos?"

#### Diagnóstico
- **Fortaleza:** App es visualmente clara, flujos son intuitivos.
- **Debilidad #1:** No existe guión de demo estructurado.
- **Debilidad #2:** Sin integración real de PayPal, el demo no puede mostrar un payout verdadero.
- **Debilidad #3:** Sin E2E automatizado, el demostrador debe hacer clicks manuales (error-prone, lento).
- **Debilidad #4:** Sin scenario de prueba reproducible ("demo data" pre-cargada), cada run es distinto.

#### Plan de Mejora

**Estructura de Demo < 3 minutos (en español o inglés):**

```
0:00–0:20s — PROBLEMA
"Las organizaciones usan IA para preparar y negociar pagos a vendors.
Pero ¿quién controla el dinero? Hoy: la IA tiene acceso directo.
AgenticPay AI separa autoridad: IA asesora, TypeScript controla, PayPal ejecuta."

0:20–0:45s — PORTFOLIO
"Aquí vemos el portafolio dual: lado derecho, contratos outbound (yo pago a vendors).
Lado izquierdo, contratos inbound (yo recibo de clientes).
Cada contrato puede ser un subcontrato vinculado."

0:45–1:15s — GUARDARRAÍLES
"Abrimos el envelope de presupuesto. Vemos los límites determinísticos:
- Techo por transacción: $5,000
- Techo diario: $25,000
- Kill-switch master: ACTIVO (verde = presupuesto sano)
- Autonomous Release Ceiling: ≤ $1,000 (más arriba requiere aprobación humana)
Todo esto es TypeScript determinístico, no instrucciones a la IA."

1:15–1:50s — AUDIT Y SETTLEMENT
"Submitimos un deliverable (pull request con evidencia).
El endpoint /api/agent/audit calcula score de confianza: 91% (github PR pass).
Modo de settlement: AUTONOMOUS (bajo $1,000).
CLIC: Release Milestone.
[Paypal call ejecuta]
Vemos la transacción aparecer en el ledger con badge PAYPAL_SANDBOX (verde),
payout_batch_id real desde PayPal Sandbox Dashboard,
Payload inspector muestra PayPal-Request-Id y sender_batch_id determinísticos."

1:50–2:10s — LEDGER
"AG Grid muestra: Transaction ID, Actor, Risk, Audit Confidence, Amount, Estado.
Filtramos por 'CRITICAL' para ver rechazos de guardarraíles.
Inspeccionamos payload: vemos el error desde PayPal (e.g., INSUFFICIENT_FUNDS)
y cómo el sistema rollback atomically sin mutar estado."

2:10–3:00s — CIERRE (Opcional: Subcontrato + Reconciliación)
"AgenticPay AI demuestra que los agentes IA y los pagos reales pueden coexistir
sin que la IA tenga autoridad financiera. Determinismo > Confianza en IA.
[Cierre de impacto comercial: 'Para agencias y empresas que usan vendors globales,
esto significa settlement más rápido, sin manual intervention, pero siempre bajo control.']"
```

**Requisitos técnicos para el demo:**
1. Datos precargados o scenario reproducible.
2. PayPal Sandbox configurado con credenciales reales (no mocked).
3. Cada click pre-ensayado; sin errores ni "déjame recargar".
4. Live browser (Chrome DevTools visible) o screen-recording profesional.

**Impacto esperado:** Los jueces ven el sistema completo, funcionando, PayPal real, sin brujería.

---

## SÍNTESIS: BRECHA CRÍTICA ÚNICA

La **brecha más crítica** es que **la ruta `/settle` no ejecuta PayPal Payouts realmente**. Todo lo demás (UX, ledger, conceptos) está bien hecho. Pero sin settlement real:

- ❌ El pitch "PayPal AI Integration" falla.
- ❌ No puedes demostrar "Real PayPal Payouts API call".
- ❌ Sin row locks + deterministic fingerprint, no demuestras idempotencia.
- ❌ El video de demo será local/mocked, no convincente.

**La solución es implementar `/settle` con:**
- Server-authoritative validation.
- Real PayPal Payouts REST call.
- Deterministic `PayPal-Request-Id` para idempotencia.
- PostgreSQL row locks para concurrencia.
- Atomic rollback en fallo.

Una vez hecho esto, todos los demás pilares se alinean naturalmente.

---

## ROADMAP PROPUESTO (PRIORIZADO)

### FASE 1: Settlement Real (48–72 horas)
- [ ] Implementar `/api/projects/[id]/milestones/[mid]/settle` con PayPal Payouts real.
- [ ] Generar deterministic `PayPal-Request-Id` y `sender_batch_id`.
- [ ] PostgreSQL row locks y atomic rollback.
- [ ] Live Sandbox Payout test end-to-end.
- [ ] Grabar `payout_batch_id` real en ledger.

**Impacto:** Convierte el demo de "local" a "real PayPal".

### FASE 2: UX + Visualización (24–36 horas)
- [ ] Agregar badge "Payment Rail" en AG Grid ledger (PAYPAL_SANDBOX / SIMULATED / etc).
- [ ] Mejorar inspector de payload (mostrar `PayPal-Request-Id`, `batch_status`).
- [ ] Mejorar Vault Escrow Envelope Card (visual de presupuesto).
- [ ] Columna "Guardrail Reason" en ledger.

**Impacto:** Demo se ve profesional y transmite confianza.

### FASE 3: Autenticación + Rate-Limiting (24 horas)
- [ ] Activar autenticación en todas las rutas críticas.
- [ ] Implementar persistent rate-limiting (PostgreSQL counters).
- [ ] Logging de eventos `RATE_LIMITED`.

**Impacto:** Render deployment es seguro. Jueces ven "production-ready basics".

### FASE 4: Demo Script + Video (12 horas)
- [ ] Escribir guión estructurado (problema → portafolio → guardarraíles → settlement → ledger → cierre).
- [ ] Ensayar 3–5 veces sin errores.
- [ ] Grabar video (o preparar live demo).

**Impacto:** Pitch resonante, clara diferenciación.

---

## PREGUNTAS PARA TI (ANTES DE ESPECIFICACIÓN TÉCNICA DETALLADA)

1. **Settlement Real:** ¿Confírmas que prioritizamos implementar `/settle` con PayPal Payouts real?

2. **Autenticación:** ¿Actualmente autenticación está activa en todas las rutas? ¿O hay rutas públicas que debemos proteger?

3. **Rate-Limiting:** ¿Prefieres in-memory (simple, pero reset en spin-down) o PostgreSQL (durable, pero más lento)?

4. **Live Sandbox:** ¿Tienes credenciales de PayPal Sandbox listas para testing?

5. **Demo Timing:** ¿Tienes permiso de los jueces para video pregrabado, o necesita ser live en la presentación?

6. **Idioma de Demo:** ¿Español, inglés, o bilingüe?

---

## SIGUIENTE PASO

Una vez que **apruebes este diagnóstico** y respondas las preguntas arriba, voy a crear **Specs técnicas detalladas** (requirements.md + design.md + tasks.md) para cada fase. Luego procederemos a implementación **sin tocar código hasta que apruebes cada especificación**.

**¿Aprobado? ¿Ajustes?**

