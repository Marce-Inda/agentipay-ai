# Resumen Ejecutivo: PayPal Settlement Hardening Spec

**Estado:** ✅ APROBADO PARA IMPLEMENTACIÓN  
**Fecha de Aprobación:** 5 de Noviembre de 2026  
**Ejecución:** Lista para comenzar  

---

## TL;DR

Vas a implementar una ruta POST `/api/projects/[id]/milestones/[mid]/settle` que ejecuta **PayPal Payouts real** de forma segura, idempotente y con rollback atómico. La autenticación y rate-limiting ya existen; solo cópialos. El spec tiene 12 tareas secuenciadas, estimadas en ~77 horas (posibles ejecuciones en paralelo).

---

## Spec Aprobado: 4 Documentos

| Documento | Ruta | Propósito |
|-----------|------|----------|
| **requirements.md** | `.kiro/specs/paypal-settlement-hardening/` | Qué construir (5 requisitos + aceptancia) |
| **design.md** | `.kiro/specs/paypal-settlement-hardening/` | Cómo construirlo (algoritmos, schema, flows) |
| **tasks.md** | `.kiro/specs/paypal-settlement-hardening/` | Pasos concretos (12 tareas, 77h) |
| **.config.kiro** | `.kiro/specs/paypal-settlement-hardening/` | Metadata del spec |

---

## Decisiones Aprobadas

✅ **Settlement Real:** Ruta `/settle` ejecuta PayPal Payouts API real (Sandbox)  
✅ **Autenticación:** Usa patrón existente (`getSession` + `assertTrustedOrigin`)  
✅ **Rate-Limiting:** In-memory existente, 15 req/min por usuario  
✅ **Idempotencia:** SHA256 fingerprint → deterministic PayPal-Request-Id  
✅ **PayPal Sandbox:** Credenciales ya configuradas, listas para testing  
✅ **Demo:** Video < 3 min en inglés, pre-grabado, con real PayPal batch  

---

## Cambios a Alto Nivel

### 1. PostgreSQL Schema
```sql
ALTER TABLE agenticpay_ledger_events ADD COLUMN (
  fingerprint_id VARCHAR(64) UNIQUE,
  settlement_id, payout_batch_id, batch_status,
  paypal_request_id, sender_batch_id, payout_executor_rail
);

CREATE UNIQUE INDEX idx_ledger_fingerprint 
  ON agenticpay_ledger_events(user_id, fingerprint_id);
```

### 2. Nuevo Endpoint
```
POST /api/projects/[projectId]/milestones/[milestoneId]/settle
Content-Type: application/json
Authorization: (HttpOnly cookie)

{
  "requiresHumanApproval": false  // for amounts > $1,000
}

→ 200 OK { payout_batch_id, batch_status, ... }
→ 502 Bad Gateway { error, paypalErrorCode, ... }
```

### 3. Componentes Principales
- **Route Handler:** Validación, guardarraíles, invocación PayPal
- **Fingerprinting:** `SHA256(projectId|milestoneId|amount)` → deterministic keys
- **PayPal Executor:** 3 rails (PAYPAL_SANDBOX, SIMULATED, SUPPRESSED_RAIL)
- **Ledger Deduplication:** Unique constraint on fingerprint prevents double-pay

---

## Tareas Iniciales (Comienza Aquí)

### 🔵 Task 1: Schema & DB Setup (3h)
- [ ] Crear migration PostgreSQL con nuevas columnas
- [ ] Crear índice unique en fingerprint_id
- [ ] Implementar repository methods: `getMilestoneForUpdate()`, `recordSettlementEvent()`

### 🔵 Task 2: Route Handler (4h)
- [ ] Crear file: `src/app/api/projects/[projectId]/milestones/[milestoneId]/settle/route.ts`
- [ ] Implementar POST handler con auth + CSRF + rate-limit
- [ ] Implementar error response structure

### 🔵 Task 3: Fingerprint & Idempotency (4h)
- [ ] Función: `buildMilestoneSettlementFingerprint(projectId, milestoneId, amount)`
- [ ] Función: `buildPayPalRequestId(fingerprint)`
- [ ] Función: `buildSenderBatchId(fingerprint)`
- [ ] Unit tests para determinismo

---

## Flujo Conceptual (1 minuto)

```
Browser → Settlement Route
         ↓
         Auth + Rate-Limit Check
         ↓
         BEGIN TRANSACTION + ROW LOCK
         ↓
         Load Milestone → Compute Fingerprint
         ↓
         Revalidate Guardarrails (kill-switch, audit score, budget)
         ↓
         Check Deduplication (exist fingerprint → return cached)
         ↓
         Invoke PayPal Payouts (or fail-closed)
         ↓
         If PayPal Success:
           - Mark Milestone COMPLETED
           - Increment project.spentUSD
           - Insert Ledger Event
           - COMMIT
           - Return 200 OK
         ↓
         If PayPal Failure:
           - ROLLBACK (no state changes)
           - Log PAYOUT_BLOCKED
           - Return 502 Bad Gateway
```

---

## Testing Strategy (Brief)

| Test Type | Coverage |
|-----------|----------|
| Unit Tests | Fingerprinting, guardarrails, ledger dedup |
| Integration Tests | Route handler + mocked PayPal |
| E2E Live Sandbox | Real PayPal Payout + Dashboard verification |

---

## Success Criteria (Hackathon Impact)

✅ Real PayPal Sandbox Payout executes  
✅ Deterministic fingerprint prevents double-pays  
✅ Row locks ensure no race conditions  
✅ Atomic transactions: success = complete, failure = rollback  
✅ Demo video < 3 min shows real PayPal batch ID in Sandbox Dashboard  
✅ Ledger records real `payout_batch_id` with "PAYPAL_SANDBOX" badge  

---

## Quick Reference

**Spec Docs Location:**
```
.kiro/specs/paypal-settlement-hardening/
├── requirements.md       (What)
├── design.md            (How)
├── tasks.md             (Steps)
└── .config.kiro         (Metadata)
```

**Evaluation & Context:**
```
.kiro/
├── AUDIT_DIAGNOSTICO_INICIAL.md       (4 Pilares + Diagnosis)
├── EVALUACION_AUTH_RATELIMIT.md       (Auth/Rate-Limit Status: ✅ Ready)
└── SPEC_RESUMEN_EJECUTIVO.md          (This file)
```

---

## Next Steps

1. ✅ **Specs Approved** → You approved all three docs (requirements, design, tasks)
2. 🔄 **Ready for Implementation** → Start with Task 1 (Schema & DB Setup)
3. 📹 **Demo Capture** → Task 12 happens last (E2E verification first)
4. 🎬 **Video Production** → After E2E, record < 3 min demo with real batch

---

## Approval Signature

**User Approval:** ✅ "procede"  
**Feature Name:** paypal-settlement-hardening  
**Status:** READY FOR IMPLEMENTATION  
**Estimated Duration:** 72–96 hours (parallel execution possible)  

---

**Date Approved:** November 5, 2026  
**Auditor:** Senior Technical Architect  
**Execution Authorized:** ✅ YES

