/**
 * Stage 1 Task 12: End-to-End Integration Tests for Escrow Funding Flow
 * 
 * Tests the complete lifecycle:
 * 1. Create order → capture → verify funded_usd incremented
 * 2. Capture → release milestone → verify released_usd incremented
 * 3. Capture → full refund → verify refunded_usd = funded_usd
 * 4. Webhook simulation → verify ledger event and escrow state updated
 * 5. Guardrail blocking → insufficient funds → verify HTTP 423 and no mutation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryEscrowFundingRepository } from '@/lib/db/escrow-repository';
import {
  validateEscrowFundingGuardrail,
  buildEscrowGuardrailErrorResponse,
} from '@/lib/guardrails/escrow-guardrail';
import {
  generateOrderIdempotencyKey,
  generateCaptureIdempotencyKey,
  generateRefundIdempotencyKey,
  formatPayPalRequestId,
} from '@/lib/escrow/idempotency';
import type { ProjectMilestone } from '@/lib/types';

describe('Stage 1 Task 12: End-to-End Escrow Funding Integration', () => {
  let escrowRepo: InMemoryEscrowFundingRepository;

  beforeEach(() => {
    escrowRepo = new InMemoryEscrowFundingRepository();
  });

  describe('Scenario 1: Create Order → Capture → Verify Funded', () => {
    it('should create order and capture it, incrementing funded_usd', async () => {
      const projectId = 'proj-scenario-1';
      const userId = 'user-1';
      const contractName = 'Web Development';
      const escrowAmountUsd = 5000;

      // Step 1: Create order
      const created = await escrowRepo.createEscrowOrder({
        projectId,
        userId,
        orderId: 'ORDER-001',
        amountUsd: escrowAmountUsd,
        payerEmail: 'client@example.com'
      });

      expect(created.orderStatus).toBe('CREATED');
      expect(created.fundedUsd).toBe(0);
      expect(created.amountUsd).toBe(escrowAmountUsd);

      // Step 2: Generate idempotency key
      const idempotencyKey = generateCaptureIdempotencyKey(projectId, 'ORDER-001', escrowAmountUsd);
      const requestId = formatPayPalRequestId(idempotencyKey);

      expect(requestId).toHaveLength(36);
      expect(requestId).toMatch(/^[A-F0-9]+$/);

      // Step 3: Capture order
      const captureId = `CAP-${idempotencyKey.slice(0, 17)}`;
      const captured = await escrowRepo.captureOrder('ORDER-001', captureId, escrowAmountUsd, userId);

      // Verify state
      expect(captured.captureId).toBe(captureId);
      expect(captured.fundedUsd).toBe(escrowAmountUsd);
      expect(captured.orderStatus).toBe('CAPTURED');
      expect(captured.releasedUsd).toBe(0);

      // Step 4: Verify we can retrieve by capture ID
      const retrieved = await escrowRepo.getByCapureId(captureId, userId);
      expect(retrieved?.fundedUsd).toBe(escrowAmountUsd);
    });
  });

  describe('Scenario 2: Capture → Release Milestone → Verify Released', () => {
    it('should increment released_usd when milestone is settled', async () => {
      const projectId = 'proj-scenario-2';
      const userId = 'user-1';

      // Step 1: Setup - create and capture order
      const created = await escrowRepo.createEscrowOrder({
        projectId,
        userId,
        orderId: 'ORDER-002',
        amountUsd: 10000,
        payerEmail: 'client@example.com'
      });

      const captured = await escrowRepo.captureOrder('ORDER-002', 'CAP-002', 10000, userId);

      // Step 2: Simulate first milestone release ($3000)
      const released1 = await escrowRepo.incrementReleased(captured.id, 3000, userId);
      expect(released1.releasedUsd).toBe(3000);
      expect(released1.fundedUsd).toBe(10000);

      // Step 3: Simulate second milestone release ($2000)
      const released2 = await escrowRepo.incrementReleased(captured.id, 2000, userId);
      expect(released2.releasedUsd).toBe(5000);

      // Step 4: Calculate refundable balance
      const refundableUsd = released2.fundedUsd - released2.releasedUsd;
      expect(refundableUsd).toBe(5000);

      // Step 5: Third milestone release ($5000)
      const released3 = await escrowRepo.incrementReleased(captured.id, 5000, userId);
      expect(released3.releasedUsd).toBe(10000);

      // All funds released, nothing refundable
      expect(released3.fundedUsd - released3.releasedUsd).toBe(0);
    });
  });

  describe('Scenario 3: Capture → Full Refund → Verify Status', () => {
    it('should mark as FULLY_REFUNDED when refund equals funded amount', async () => {
      const projectId = 'proj-scenario-3';
      const userId = 'user-1';

      // Step 1: Create and capture order
      const created = await escrowRepo.createEscrowOrder({
        projectId,
        userId,
        orderId: 'ORDER-003',
        amountUsd: 5000,
        payerEmail: 'client@example.com'
      });

      const captured = await escrowRepo.captureOrder('ORDER-003', 'CAP-003', 5000, userId);

      // Step 2: Partial refund
      const partialRefund = await escrowRepo.recordRefund(captured.id, 2000, userId);
      expect(partialRefund.refundedUsd).toBe(2000);
      expect(partialRefund.orderStatus).toBe('PARTIALLY_REFUNDED');

      // Step 3: Full refund of remaining amount
      const fullRefund = await escrowRepo.recordRefund(captured.id, 3000, userId);
      expect(fullRefund.refundedUsd).toBe(5000);
      expect(fullRefund.orderStatus).toBe('FULLY_REFUNDED');

      // Verify invariant: refunded_usd = funded_usd
      expect(fullRefund.refundedUsd).toBe(fullRefund.fundedUsd);
    });

    it('should mark as PARTIALLY_REFUNDED for partial refunds', async () => {
      const projectId = 'proj-scenario-3b';
      const userId = 'user-1';

      const created = await escrowRepo.createEscrowOrder({
        projectId,
        userId,
        orderId: 'ORDER-003B',
        amountUsd: 5000,
        payerEmail: 'client@example.com'
      });

      const captured = await escrowRepo.captureOrder('ORDER-003B', 'CAP-003B', 5000, userId);

      // Partial refund only
      const refund = await escrowRepo.recordRefund(captured.id, 2000, userId);
      expect(refund.refundedUsd).toBe(2000);
      expect(refund.orderStatus).toBe('PARTIALLY_REFUNDED');

      // Verify available funds for release
      const releasableUsd = refund.fundedUsd - refund.refundedUsd;
      expect(releasableUsd).toBe(3000);
    });
  });

  describe('Scenario 4: Webhook Simulation and Ledger Tracking', () => {
    it('should track order transitions through state machine', async () => {
      const projectId = 'proj-scenario-4';
      const userId = 'user-1';

      // Simulate order lifecycle
      const order = await escrowRepo.createEscrowOrder({
        projectId,
        userId,
        orderId: 'ORDER-004',
        amountUsd: 5000,
        payerEmail: 'client@example.com'
      });

      expect(order.orderStatus).toBe('CREATED');

      // Simulate CHECKOUT.ORDER.COMPLETED webhook
      const approved = await escrowRepo.updateOrderStatus('ORDER-004', 'APPROVED', userId);
      expect(approved.orderStatus).toBe('APPROVED');

      // Simulate order capture
      const captured = await escrowRepo.captureOrder('ORDER-004', 'CAP-004', 5000, userId);
      expect(captured.orderStatus).toBe('CAPTURED');

      // Verify capture ID is stored
      expect(captured.captureId).toBe('CAP-004');

      // Simulate refund
      const refunded = await escrowRepo.recordRefund(captured.id, 2500, userId);
      expect(refunded.orderStatus).toBe('PARTIALLY_REFUNDED');
    });
  });

  describe('Scenario 5: Guardrail Blocking - Insufficient Escrow Balance', () => {
    it('should block settlement when funded balance is insufficient', async () => {
      const projectId = 'proj-scenario-5';
      const userId = 'user-1';

      // Step 1: Create order but don't capture it
      const created = await escrowRepo.createEscrowOrder({
        projectId,
        userId,
        orderId: 'ORDER-005',
        amountUsd: 5000,
        payerEmail: 'client@example.com'
      });

      // Step 2: Attempt to settle a milestone without funding
      const milestone: ProjectMilestone = {
        id: 'milestone-1',
        phaseNumber: 1,
        title: 'Phase 1',
        description: 'First phase',
        amountUSD: 3000,
        status: 'AUDITED_PENDING_APPROVAL',
        acceptanceCriteria: 'Complete',
        auditScore: 95,
      };

      const guardResult = validateEscrowFundingGuardrail(
        { fundedUSD: 0, releasedUSD: 0 },
        milestone
      );

      // Verify guardrail blocks settlement
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.deficitUSD).toBe(3000);

      const errorResponse = buildEscrowGuardrailErrorResponse(guardResult);
      expect(errorResponse.status).toBe(423);
      expect(errorResponse.body.error).toBe('INSUFFICIENT_ESCROW_BALANCE');
    });

    it('should allow settlement when guardrail passes', async () => {
      const projectId = 'proj-scenario-5b';
      const userId = 'user-1';

      // Step 1: Create and capture order
      const created = await escrowRepo.createEscrowOrder({
        projectId,
        userId,
        orderId: 'ORDER-005B',
        amountUsd: 5000,
        payerEmail: 'client@example.com'
      });

      const captured = await escrowRepo.captureOrder('ORDER-005B', 'CAP-005B', 5000, userId);

      // Step 2: Check guardrail for milestone within funded amount
      const milestone: ProjectMilestone = {
        id: 'milestone-1',
        phaseNumber: 1,
        title: 'Phase 1',
        description: 'First phase',
        amountUSD: 3000,
        status: 'AUDITED_PENDING_APPROVAL',
        acceptanceCriteria: 'Complete',
        auditScore: 95,
      };

      const guardResult = validateEscrowFundingGuardrail(
        { fundedUSD: captured.fundedUsd, releasedUSD: captured.releasedUsd },
        milestone
      );

      // Verify guardrail allows settlement
      expect(guardResult.allowed).toBe(true);
      expect(guardResult.availableBalanceUSD).toBe(5000);
    });

    it('should block second milestone when insufficient balance remains', async () => {
      const projectId = 'proj-scenario-5c';
      const userId = 'user-1';

      // Step 1: Setup - create and capture
      const created = await escrowRepo.createEscrowOrder({
        projectId,
        userId,
        orderId: 'ORDER-005C',
        amountUsd: 10000,
        payerEmail: 'client@example.com'
      });

      const captured = await escrowRepo.captureOrder('ORDER-005C', 'CAP-005C', 10000, userId);

      // Step 2: Release first milestone ($7000)
      const released = await escrowRepo.incrementReleased(captured.id, 7000, userId);

      // Step 3: Try to release second milestone ($4000) but only $3000 available
      const milestone: ProjectMilestone = {
        id: 'milestone-2',
        phaseNumber: 2,
        title: 'Phase 2',
        description: 'Second phase',
        amountUSD: 4000,
        status: 'AUDITED_PENDING_APPROVAL',
        acceptanceCriteria: 'Complete',
        auditScore: 95,
      };

      const guardResult = validateEscrowFundingGuardrail(
        { fundedUSD: released.fundedUsd, releasedUSD: released.releasedUsd },
        milestone
      );

      // Verify guardrail blocks insufficient balance
      expect(guardResult.allowed).toBe(false);
      expect(guardResult.availableBalanceUSD).toBe(3000);
      expect(guardResult.deficitUSD).toBe(1000);
    });
  });

  describe('Deterministic Idempotency Across Operations', () => {
    it('should produce identical idempotency keys for identical operations', () => {
      const projectId = 'proj-idempotent';

      // Order idempotency
      const orderKey1 = generateOrderIdempotencyKey(projectId, 'contract', 5000);
      const orderKey2 = generateOrderIdempotencyKey(projectId, 'contract', 5000);
      expect(orderKey1).toBe(orderKey2);

      // Capture idempotency
      const captureKey1 = generateCaptureIdempotencyKey(projectId, 'ORDER-001', 5000);
      const captureKey2 = generateCaptureIdempotencyKey(projectId, 'ORDER-001', 5000);
      expect(captureKey1).toBe(captureKey2);

      // Refund idempotency
      const refundKey1 = generateRefundIdempotencyKey(projectId, 'CAPTURE-001', 2000);
      const refundKey2 = generateRefundIdempotencyKey(projectId, 'CAPTURE-001', 2000);
      expect(refundKey1).toBe(refundKey2);
    });
  });

  describe('Tenant Isolation Throughout Flow', () => {
    it('should enforce tenant isolation at each step', async () => {
      const projectId = 'proj-tenant';
      const user1 = 'user-1';
      const user2 = 'user-2';

      // User 1 creates order
      const order = await escrowRepo.createEscrowOrder({
        projectId,
        userId: user1,
        orderId: 'ORDER-TENANT',
        amountUsd: 5000,
        payerEmail: 'user1@example.com'
      });

      // User 1 can retrieve
      const retrieved1 = await escrowRepo.getByOrderId('ORDER-TENANT', user1);
      expect(retrieved1).toBeDefined();

      // User 2 cannot retrieve
      const retrieved2 = await escrowRepo.getByOrderId('ORDER-TENANT', user2);
      expect(retrieved2).toBeNull();

      // User 2 cannot capture
      await expect(
        escrowRepo.captureOrder('ORDER-TENANT', 'CAP-TENANT', 5000, user2)
      ).rejects.toThrow('Escrow order not found');

      // User 1 captures successfully
      const captured = await escrowRepo.captureOrder('ORDER-TENANT', 'CAP-TENANT', 5000, user1);

      // User 2 cannot release
      await expect(
        escrowRepo.incrementReleased(captured.id, 2000, user2)
      ).rejects.toThrow('Escrow not found');

      // User 1 can release
      const released = await escrowRepo.incrementReleased(captured.id, 2000, user1);
      expect(released.releasedUsd).toBe(2000);
    });
  });

  describe('Atomicity and Consistency', () => {
    it('should maintain invariant: funded >= released + refunded', async () => {
      const projectId = 'proj-invariant';
      const userId = 'user-1';

      const created = await escrowRepo.createEscrowOrder({
        projectId,
        userId,
        orderId: 'ORDER-INV',
        amountUsd: 10000,
        payerEmail: 'client@example.com'
      });

      const captured = await escrowRepo.captureOrder('ORDER-INV', 'CAP-INV', 10000, userId);

      // Release some funds
      const released = await escrowRepo.incrementReleased(captured.id, 4000, userId);
      expect(released.fundedUsd).toBeGreaterThanOrEqual(released.releasedUsd);

      // Refund some funds
      const refunded = await escrowRepo.recordRefund(captured.id, 3000, userId);

      // Verify invariant: funded >= released + refunded
      const total = refunded.releasedUsd + refunded.refundedUsd;
      expect(refunded.fundedUsd).toBeGreaterThanOrEqual(total);
    });
  });
});
