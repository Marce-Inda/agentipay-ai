# Plan de Implementación: PayPal Settlement Hardening

**Estado:** ✅ SPEC COMPLETADO Y APROBADO  
**Fecha de Inicio:** 5 de Noviembre de 2026  
**Metodología:** Spec-Driven (Zero Code Changes sin seguir plan)  
**Duración Estimada:** 72–96 horas (tasks 1–12)

---

## 📍 Punto de Entrada

Todos los detalles de implementación están en:

```
.kiro/specs/paypal-settlement-hardening/
├── requirements.md  ← Lee primero: Qué debe cumplir
├── design.md        ← Lee segundo: Cómo está arquitecturado
├── tasks.md         ← Lee tercero: Pasos concretos (Task 1–12)
└── .config.kiro     ← Metadata del spec
```

---

## 🎯 Checklist Pre-Implementación

**Antes de escribir cualquier código, verifica:**

- ✅ Especificación completa leída (requirements.md + design.md)
- ✅ Tasks.md revisado (entiendes Task 1–12 y sus dependencias)
- ✅ Ambiente local preparado:
  ```bash
  # Verificar Node.js 20
  node --version  # Should be v20.x
  
  # Verificar PostgreSQL disponible
  psql --version
  
  # Dependencias instaladas
  npm install
  
  # Tests corren
  npm test -- --runInBand
  ```
- ✅ PayPal Sandbox credenciales en `.env.local`
  ```
  PAYPAL_CLIENT_ID=<your-sandbox-client-id>
  PAYPAL_CLIENT_SECRET=<your-sandbox-client-secret>
  PAYPAL_MODE=sandbox
  ```

---

## 📋 Tasks en Orden de Ejecución

### **PHASE 1: Foundation (Tasks 1–5, ~22 horas)**

Estas tasks establecen la base: schema, route handler boilerplate, y validaciones.

#### **Task 1: PostgreSQL Schema & Database Setup (3 horas)**
**Archivo a leer:** `tasks.md` → "Task 1: PostgreSQL Schema..."

**Pasos concretos:**
1. Crear archivo migration: `src/lib/db/migrations/001_add_settlement_ledger.sql`
2. Agregar columnas a `agenticpay_ledger_events`: fingerprint_id, settlement_id, payout_batch_id, batch_status, paypal_request_id, sender_batch_id, payout_executor_rail
3. Crear unique index: `idx_ledger_fingerprint(user_id, fingerprint_id)`
4. Ejecutar migration en desarrollo
5. Actualizar `src/lib/db/repository.ts`:
   - Método: `getMilestoneForUpdate(userId, projectId, milestoneId)`
   - Método: `recordSettlementEvent(userId, fingerprintId, ...)`
   - Método: `findLedgerEventByFingerprint(userId, fingerprint)`

**Aceptancia:**
- Migration file created and tested
- Repository methods compile without errors
- Unique index verified in dev database

**Estimación:** 3 horas

---

#### **Task 2: Settlement Route Handler Skeleton (4 horas)**
**Archivo a leer:** `tasks.md` → "Task 2: Settlement Route Handler..."

**Pasos concretos:**
1. Crear directorio: `src/app/api/projects/[projectId]/milestones/[milestoneId]/settle/`
2. Crear `route.ts` con `POST` handler
3. Implementar boilerplate:
   - Import: `getSession`, `assertTrustedOrigin`, `checkRateLimit`, `logSecurityEvent`
   - Parse URL params: `projectId`, `milestoneId`
   - Parse JSON body: `{ requiresHumanApproval? }`
   - Auth check: `401` if no session
   - CSRF check: `403` if untrusted origin
   - Rate limit: `429` if exceeded
   - Input validation: `400` if malformed
4. Implementar error response structure (see design.md)

**Aceptancia:**
- Route compiles (npx tsc --noEmit)
- Auth enforced (returns 401 without session)
- Rate limiting active
- Error responses match contract

**Estimación:** 4 horas

---

#### **Task 3: Deterministic Fingerprint & Idempotency Keys (4 horas)**
**Archivo a leer:** `tasks.md` → "Task 3: Deterministic Fingerprint..."

**Pasos concretos:**
1. Extender `src/lib/settlement/settlement.ts`:
   - Función: `buildMilestoneSettlementFingerprint(projectId, milestoneId, amountUSD): string`
     - Input hash: `SHA256(projectId|milestoneId|amountUSD.toFixed(2))`
     - Output: 64-char hex string
   - Función: `buildPayPalRequestId(fingerprint): string`
     - Output: `REQ-${fingerprint.slice(0, 32)}`
   - Función: `buildSenderBatchId(fingerprint): string`
     - Output: `SETTLE-${fingerprint.slice(0, 28)}`

2. En settlement route handler (Task 2), integrar:
   ```typescript
   const fingerprint = buildMilestoneSettlementFingerprint(projectId, milestoneId, amount);
   const paypalRequestId = buildPayPalRequestId(fingerprint);
   const senderBatchId = buildSenderBatchId(fingerprint);
   
   // Check deduplication
   const existing = await repository.findLedgerEventByFingerprint(session.user.id, fingerprint);
   if (existing) return 200 OK (cached result);
   ```

3. Crear unit tests: `src/__tests__/settlement-fingerprint.test.ts`
   - Test determinism: same inputs → same output
   - Test idempotency keys format

**Aceptancia:**
- Fingerprint function deterministic (verified by unit test)
- Idempotency keys in correct format
- Deduplication check integrated

**Estimación:** 4 horas

---

#### **Task 4: PostgreSQL Row Locks & Atomic Transaction (5 horas)**
**Archivo a leer:** `tasks.md` → "Task 4: PostgreSQL Row Locks..."

**Pasos concretos:**
1. Implementar en `src/lib/db/repository.ts`:
   ```typescript
   async getMilestoneForUpdate(userId: string, projectId: string, milestoneId: string) {
     // SQL: SELECT * FROM milestones WHERE project_id = $1 AND id = $2 FOR UPDATE
     const result = await this.db.query(
       'SELECT * FROM milestones WHERE project_id = $1 AND id = $2 FOR UPDATE',
       [projectId, milestoneId]
     );
     return result.rows[0] || null;
   }
   ```

2. Crear transaction wrapper en settlement route:
   ```typescript
   const client = await db.connect();
   try {
     await client.query('BEGIN');
     
     const milestone = await getMilestoneForUpdate(...);  // Row lock held
     const project = await getProject(...);
     const envelope = await getEnvelope(...);
     
     // Validate guards, execute PayPal...
     
     if (payoutSuccess) {
       await updateMilestone(...);
       await updateProject(...);
       await insertLedgerEvent(...);
       await client.query('COMMIT');
     } else {
       await client.query('ROLLBACK');
     }
   } catch (error) {
     await client.query('ROLLBACK');
     throw error;
   } finally {
     client.release();
   }
   ```

3. Create unit tests: concurrent settlement requests
   - Verify second request waits or fails gracefully

**Aceptancia:**
- Row lock prevents concurrent settlement
- Atomic transactions: all-or-nothing
- Rollback on PayPal failure leaves milestone unchanged

**Estimación:** 5 horas

---

#### **Task 5: Guardrail Revalidation (Server-Side) (5 horas)**
**Archivo a leer:** `tasks.md` → "Task 5: Guardrail Revalidation..."

**Pasos concretos:**
1. Inside settlement transaction (after row lock), revalidate:
   ```typescript
   // Kill-switch
   if (envelope.killSwitchActive) return 423 Locked(...);
   
   // Contract status
   if (project.status !== 'ACTIVE') return 423 Locked(...);
   
   // Milestone status
   if (milestone.status !== 'AUDITED_PENDING_APPROVAL') return 409 Conflict(...);
   
   // Audit score
   if (milestone.auditScore < 85) return 422 Unprocessable(...);
   
   // Amount validation
   if (amount <= 0 || amount !== milestone.amountUSD) return 422(...);
   
   // Budget checks
   if (amount > envelope.maxPerTransactionUSD) return 422(...);
   if (envelope.spentTodayUSD + amount > envelope.dailyCeilingUSD) return 422(...);
   if (amount > (project.budgetCapUSD - project.spentUSD)) return 402(...);
   
   // Human approval
   if ((amount > 1000 || project.perspective === 'INCOMING') && !requiresHumanApproval) {
     return 422(...);
   }
   ```

2. Log all rejections: `logSecurityEvent('GUARDRAIL_REJECTED', ...)`

**Aceptancia:**
- All guardrails revalidated
- No settlement without audit score >= 85%
- Budget ceilings enforced
- Human approval required for high-value/incoming

**Estimación:** 5 horas

---

### **PHASE 2: PayPal Integration (Tasks 6–8, ~19 horas)**

Estas tasks implementan la invocación real de PayPal y manejo de errores.

#### **Task 6: PayPal Executor Integration (8 horas)**
**Archivo a leer:** `tasks.md` → "Task 6: PayPal Executor Integration..."

**Pasos concretos:**
1. Extender `src/lib/paypal/executor.ts`:
   - Función: `getPayPalOAuthToken(clientId, clientSecret): Promise<string>`
     - Call `POST /v1/oauth2/token` with Basic auth
     - Return access token
   - Función: `executePayPalPayout(token, payoutRequest)`
     - Call `POST /v1/payments/payouts`
     - Return `{ batch_id, batch_status }`
   - Función: `selectPayoutRail()`
     - If credentials: return "PAYPAL_SANDBOX"
     - Else if PAYPAL_SIMULATION_MODE: return "SIMULATED"
     - Else: return "SUPPRESSED_RAIL"

2. Integrar en settlement route:
   ```typescript
   const rail = selectPayoutRail();
   const result = await executePayoutByRail(rail, {
     sender_batch_id: senderBatchId,
     paypal_request_id: paypalRequestId,
     amount,
     recipient_email: milestone.recipientEmail
   });
   
   if (result.success) {
     // Update state
   } else {
     // Rollback
   }
   ```

3. Crear integration tests con PayPal mocked (jest.mock)
   - Test real rail success
   - Test real rail error (INSUFFICIENT_FUNDS)
   - Test simulated rail
   - Test suppressed rail

**Aceptancia:**
- Real PayPal Payouts API call compiles
- Fail-closed rails work
- Errors properly caught

**Estimación:** 8 horas

---

#### **Task 7: Ledger Deduplication & Event Recording (5 horas)**
**Archivo a leer:** `tasks.md` → "Task 7: Ledger Deduplication..."

**Pasos concretos:**
1. Implementar en `src/lib/db/repository.ts`:
   ```typescript
   async recordSettlementEvent(userId: string, fingerprint: string, eventData: any) {
     try {
       const result = await this.db.query(
         `INSERT INTO agenticpay_ledger_events 
          (user_id, fingerprint_id, status, payout_batch_id, ...)
          VALUES ($1, $2, $3, $4, ...)
          RETURNING *`,
         [userId, fingerprint, eventData.status, eventData.payout_batch_id, ...]
       );
       return result.rows[0];
     } catch (error) {
       if (error.code === '23505') {  // UNIQUE_VIOLATION
         // Fetch existing event
         const existing = await this.db.query(
           `SELECT * FROM agenticpay_ledger_events 
            WHERE user_id = $1 AND fingerprint_id = $2`,
           [userId, fingerprint]
         );
         return existing.rows[0];  // Return cached
       }
       throw error;
     }
   }
   ```

2. Integrar en settlement route (on success):
   ```typescript
   const ledgerEvent = await repository.recordSettlementEvent(
     session.user.id,
     fingerprint,
     {
       status: 'PAYOUT_EXECUTED',
       payout_batch_id: payoutResult.batchId,
       batch_status: payoutResult.status,
       paypal_request_id: paypalRequestId,
       sender_batch_id: senderBatchId,
       payout_executor_rail: rail
     }
   );
   ```

3. Unit tests:
   - First settlement creates event
   - Retry returns cached event

**Aceptancia:**
- Ledger events deduplicated by fingerprint
- Retry returns cached result
- No double-spend from retries

**Estimación:** 5 horas

---

#### **Task 8: Error Handling & Recovery (6 horas)**
**Archivo a leer:** `tasks.md` → "Task 8: Error Handling..."

**Pasos concretos:**
1. PayPal error handling:
   ```typescript
   try {
     const result = await executePayoutByRail(...);
     if (!result.success) {
       logSecurityEvent('PAYOUT_BLOCKED', {
         paypalErrorCode: result.errorCode,
         reason: result.error
       });
       await client.query('ROLLBACK');
       return NextResponse.json(
         { error: 'PayPal payout failed', reason: result.error, ... },
         { status: 502 }
       );
     }
   } catch (error) {
     logSecurityEvent('SETTLEMENT_ERROR', { error });
     await client.query('ROLLBACK');
     return NextResponse.json(
       { error: 'Settlement failed', ... },
       { status: 500 }
     );
   }
   ```

2. Guardrail rejection logging:
   ```typescript
   logSecurityEvent('KILL_SWITCH_ACTIVE', { ... });
   logSecurityEvent('BUDGET_REJECTED', { ... });
   logSecurityEvent('APPROVAL_REQUIRED', { ... });
   ```

3. Integration tests:
   - PayPal failure + rollback
   - Guardrail rejection + no state change
   - Timeout handling

**Aceptancia:**
- All errors logged
- Transaction rolled back
- Structured error responses
- No partial mutations

**Estimación:** 6 horas

---

### **PHASE 3: Testing & Verification (Tasks 9–12, ~37 horas)**

Estas tasks verifican que todo funciona correctamente.

#### **Task 9: Unit Tests (All Components) (8 horas)**
**Archivo a leer:** `tasks.md` → "Task 9: Unit Tests..."

**Pasos concretos:**
1. Crear `src/__tests__/settlement.test.ts`
2. Test categories:
   - Fingerprint determinism
   - Idempotency keys format
   - Guardrail revalidation (each guard)
   - Row lock acquisition
   - PayPal rails (mocked)
   - Ledger deduplication

**Comando:**
```bash
npm test -- --testPathPattern=settlement.test
npm test -- --coverage  # Verify > 80%
```

**Aceptancia:**
- All tests pass
- Coverage > 80%

**Estimación:** 8 horas

---

#### **Task 10: Integration Tests (7 horas)**
**Archivo a leer:** `tasks.md` → "Task 10: Integration Tests..."

**Pasos concretos:**
1. Crear `src/__tests__/integration/settlement.integration.test.ts`
2. Scenarios:
   - Successful settlement (contract → audit → settle → verify ledger)
   - PayPal failure + rollback
   - Idempotent retry
   - Concurrent requests
   - Guardrail rejection

**Comando:**
```bash
npm test -- --testPathPattern=integration/settlement
```

**Aceptancia:**
- All integration tests pass
- Real database used

**Estimación:** 7 horas

---

#### **Task 11: E2E Live Sandbox Test (10 horas)**
**Archivo a leer:** `tasks.md` → "Task 11: E2E Live Sandbox Test..."

**Pasos concretos:**
1. **Setup (1h):**
   - Verify `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` set in `.env.local`
   - Test OAuth call to PayPal

2. **Test Data (1h):**
   - Create test user
   - Create test contract ($5,000 cap)
   - Create test milestone ($250)
   - Pre-populate passing audit

3. **Execute Settlement (2h):**
   - Call settlement route
   - Capture response with `payout_batch_id`
   - Verify HTTP 200 OK

4. **Verify in PayPal Dashboard (2h):**
   - Login to Sandbox
   - Find batch by ID
   - Verify status + amount
   - Take screenshots

5. **Verify Ledger (2h):**
   - Query database for event
   - Verify `fingerprint_id`, `payout_batch_id`, `batch_status`
   - Take screenshots

6. **Test Failure Scenario (1h):**
   - Try insufficient budget
   - Verify no settlement created
   - Retry same settlement

7. **Documentation (1h):**
   - Screenshots (PayPal, ledger)
   - Test results summary

**Aceptancia:**
- Real PayPal Sandbox payout executed
- `payout_batch_id` visible in Dashboard
- Ledger records real batch ID
- Screenshots documented

**Estimación:** 10 horas

---

#### **Task 12: Documentation & Demo Script (12 horas)**
**Archivo a leer:** `tasks.md` → "Task 12: Documentation & Demo Script..."

**Pasos concretos:**
1. **Demo Script (2h):**
   - Write 3-minute English script
   - Timing: Problem (0:00–0:20) → Portfolio (0:20–0:45) → Guardrails (0:45–1:15) → Settlement (1:15–1:50) → Ledger (1:50–2:10) → Close (2:10–3:00)

2. **Prepare Demo Data (2h):**
   - Pre-create test contract
   - Pre-create milestone with deliverable
   - Pre-execute audit (score >= 85%)
   - Screenshot PayPal Dashboard ready

3. **Record Video (5h):**
   - Record live browser (Chrome)
   - Show portfolio, guardrails, audit result
   - Show settlement call
   - Show real `payout_batch_id` in ledger
   - Show PayPal Dashboard confirmation
   - Edit video: cut, sync, add timestamps
   - Export: MP4, max 3 min, < 100 MB

4. **Update Documentation (2h):**
   - README.md: mention real PayPal settlement
   - ARCHITECTURE.md: describe `/settle` endpoint
   - TECHNICAL_ARCHITECTURE_AND_DEVOPS.md: API contract

5. **Create DEMO_SCRIPT.md (1h):**
   - Full English script with timestamps

**Deliverables:**
- `DEMO_SCRIPT.md` (English, 3 min)
- `demo.mp4` (video, < 100 MB)
- Screenshots (PayPal Dashboard, ledger)

**Estimación:** 12 horas

---

## 🔄 Execution Workflow

### **Step 1: Read Specs** (30 min)
```bash
# Read in this order:
cat .kiro/specs/paypal-settlement-hardening/requirements.md
cat .kiro/specs/paypal-settlement-hardening/design.md
cat .kiro/specs/paypal-settlement-hardening/tasks.md
```

### **Step 2: Setup Environment** (15 min)
```bash
# Verify Node.js
node --version  # v20.x required

# Install dependencies
npm install

# Verify tests run
npm test -- --runInBand

# Verify TypeScript compiles
npx tsc --noEmit
```

### **Step 3: Start Task 1** (3 hours)
Follow detailed steps in `tasks.md` → Task 1

### **Step 4: Commit After Each Task**
```bash
git add .
git commit -m "Task 1: PostgreSQL schema + repository methods"
```

### **Step 5: Run Tests Continuously**
```bash
# After each task
npm test -- --runInBand
npx tsc --noEmit
npm run build
```

### **Step 6: Track Progress**
Mark tasks complete in checklist below

---

## ✅ Task Completion Checklist

- [ ] Task 1: Schema & DB Setup (3h)
- [ ] Task 2: Route Handler Skeleton (4h)
- [ ] Task 3: Fingerprint & Idempotency (4h)
- [ ] Task 4: Row Locks & Transactions (5h)
- [ ] Task 5: Guardrail Revalidation (5h)
- [ ] Task 6: PayPal Executor (8h)
- [ ] Task 7: Ledger Deduplication (5h)
- [ ] Task 8: Error Handling (6h)
- [ ] Task 9: Unit Tests (8h)
- [ ] Task 10: Integration Tests (7h)
- [ ] Task 11: E2E Live Sandbox (10h)
- [ ] Task 12: Documentation & Video (12h)

**Total: 77 hours** (parallel execution possible after Task 8)

---

## 🎯 Success Criteria

✅ Real PayPal Sandbox Payout executed  
✅ Deterministic fingerprint prevents double-pays  
✅ Row locks ensure no race conditions  
✅ Atomic transactions: success = complete, failure = rollback  
✅ Demo video < 3 min with real `payout_batch_id` in PayPal Dashboard  
✅ All tests pass (unit, integration, E2E)  

---

## 📞 Questions During Implementation?

Refer to:
- `requirements.md` for acceptance criteria
- `design.md` for algorithm + schema details
- `tasks.md` for step-by-step guidance

Good luck! 🚀

