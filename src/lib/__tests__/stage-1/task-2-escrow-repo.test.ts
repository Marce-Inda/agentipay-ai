import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryEscrowFundingRepository } from '@/lib/db/escrow-repository';

describe('Stage 1 Task 2: Escrow Repository Interface and In-Memory Adapter', () => {
  let repo: InMemoryEscrowFundingRepository;

  beforeEach(() => {
    repo = new InMemoryEscrowFundingRepository();
  });

  describe('Order Creation', () => {
    it('should create an escrow order with initial state', async () => {
      const escrow = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      expect(escrow.orderId).toBe('ORDER-123');
      expect(escrow.amountUsd).toBe(5000);
      expect(escrow.fundedUsd).toBe(0);
      expect(escrow.releasedUsd).toBe(0);
      expect(escrow.refundedUsd).toBe(0);
      expect(escrow.orderStatus).toBe('CREATED');
    });
  });

  describe('Tenant Isolation', () => {
    it('should enforce tenant isolation on reads', async () => {
      await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      // Different user should not be able to read
      const result = await repo.getByOrderId('ORDER-123', 'user-2');
      expect(result).toBeNull();

      // Same user should read
      const sameUser = await repo.getByOrderId('ORDER-123', 'user-1');
      expect(sameUser).toBeDefined();
    });

    it('should isolate project-based reads', async () => {
      await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-001',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      // Different user cannot access
      const result = await repo.getByProjectId('proj-1', 'user-2');
      expect(result).toBeNull();

      // Same user can access
      const found = await repo.getByProjectId('proj-1', 'user-1');
      expect(found?.projectId).toBe('proj-1');
    });
  });

  describe('Duplicate Prevention', () => {
    it('should prevent duplicate order IDs', async () => {
      await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      await expect(
        repo.createEscrowOrder({
          projectId: 'proj-2',
          userId: 'user-2',
          orderId: 'ORDER-123', // Duplicate
          amountUsd: 3000,
          payerEmail: 'other@example.com'
        })
      ).rejects.toThrow('Duplicate order_id');
    });

    it('should prevent duplicate capture IDs', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');

      // Create another order
      const created2 = await repo.createEscrowOrder({
        projectId: 'proj-2',
        userId: 'user-2',
        orderId: 'ORDER-789',
        amountUsd: 3000,
        payerEmail: 'other@example.com'
      });

      // Attempt duplicate capture ID should fail
      await expect(
        repo.captureOrder('ORDER-789', 'CAPTURE-456', 3000, 'user-2')
      ).rejects.toThrow('Duplicate capture_id');
    });
  });

  describe('Order Capture', () => {
    it('should capture order and update funded balance', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const captured = await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');

      expect(captured.captureId).toBe('CAPTURE-456');
      expect(captured.fundedUsd).toBe(5000);
      expect(captured.orderStatus).toBe('CAPTURED');
    });

    it('should prevent double capture', async () => {
      await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');

      await expect(
        repo.captureOrder('ORDER-123', 'CAPTURE-789', 5000, 'user-1')
      ).rejects.toThrow('already captured');
    });

    it('should enforce tenant isolation on capture', async () => {
      await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      // Different user cannot capture
      await expect(
        repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-2')
      ).rejects.toThrow('Escrow order not found');
    });
  });

  describe('Refund Recording', () => {
    it('should record partial refund', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const captured = await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');
      const refunded = await repo.recordRefund(captured.id, 2000, 'user-1');

      expect(refunded.refundedUsd).toBe(2000);
      expect(refunded.orderStatus).toBe('PARTIALLY_REFUNDED');
    });

    it('should record full refund', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const captured = await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');
      const refunded = await repo.recordRefund(captured.id, 5000, 'user-1');

      expect(refunded.refundedUsd).toBe(5000);
      expect(refunded.orderStatus).toBe('FULLY_REFUNDED');
    });

    it('should prevent refund exceeding funded amount', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const captured = await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');

      await expect(
        repo.recordRefund(captured.id, 6000, 'user-1')
      ).rejects.toThrow('Refund exceeds funded amount');
    });

    it('should enforce tenant isolation on refund', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const captured = await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');

      // Different user cannot refund
      await expect(
        repo.recordRefund(captured.id, 2000, 'user-2')
      ).rejects.toThrow('Escrow not found');
    });
  });

  describe('Release Amount Tracking', () => {
    it('should calculate refundable balance correctly', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const captured = await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');
      const released = await repo.incrementReleased(captured.id, 2000, 'user-1');

      // refundable = funded - released = 5000 - 2000 = 3000
      const refundable = released.fundedUsd - released.releasedUsd;
      expect(refundable).toBe(3000);
    });

    it('should increment released amount', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const captured = await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');

      const released1 = await repo.incrementReleased(captured.id, 1000, 'user-1');
      expect(released1.releasedUsd).toBe(1000);

      const released2 = await repo.incrementReleased(captured.id, 1500, 'user-1');
      expect(released2.releasedUsd).toBe(2500);
    });

    it('should enforce tenant isolation on release', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const captured = await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');

      // Different user cannot increment release
      await expect(
        repo.incrementReleased(captured.id, 1000, 'user-2')
      ).rejects.toThrow('Escrow not found');
    });
  });

  describe('Order Status Updates', () => {
    it('should update order status', async () => {
      await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const updated = await repo.updateOrderStatus('ORDER-123', 'APPROVED', 'user-1');
      expect(updated.orderStatus).toBe('APPROVED');
    });

    it('should enforce tenant isolation on status update', async () => {
      await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      // Different user cannot update
      await expect(
        repo.updateOrderStatus('ORDER-123', 'APPROVED', 'user-2')
      ).rejects.toThrow('Escrow order not found');
    });
  });

  describe('Capture ID Lookup', () => {
    it('should retrieve order by capture_id', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const captured = await repo.captureOrder('ORDER-123', 'CAPTURE-456', 5000, 'user-1');

      const found = await repo.getByCapureId('CAPTURE-456', 'user-1');
      expect(found?.captureId).toBe('CAPTURE-456');

      // Different user cannot read
      const notFound = await repo.getByCapureId('CAPTURE-456', 'user-2');
      expect(notFound).toBeNull();
    });

    it('should return null for non-existent capture_id', async () => {
      const result = await repo.getByCapureId('NONEXISTENT-999', 'user-1');
      expect(result).toBeNull();
    });
  });

  describe('Immutability and Copies', () => {
    it('should return deep copies to prevent mutation', async () => {
      const created = await repo.createEscrowOrder({
        projectId: 'proj-1',
        userId: 'user-1',
        orderId: 'ORDER-123',
        amountUsd: 5000,
        payerEmail: 'payer@example.com'
      });

      const retrieved1 = await repo.getByOrderId('ORDER-123', 'user-1');
      const retrieved2 = await repo.getByOrderId('ORDER-123', 'user-1');

      // Should be equal but not the same reference
      expect(retrieved1).toEqual(retrieved2);
      expect(retrieved1).not.toBe(retrieved2);

      // Mutating one should not affect the other
      if (retrieved1) retrieved1.fundedUsd = 9999;
      const retrieved3 = await repo.getByOrderId('ORDER-123', 'user-1');
      expect(retrieved3?.fundedUsd).toBe(0);
    });
  });
});
