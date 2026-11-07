import { describe, it, expect, beforeEach } from '@jest/globals';
import { InMemoryEscrowFundingRepository } from '@/lib/db/escrow-repository';

describe('Stage 1 Task 1: Escrow Funding Database Schema', () => {
  let repo: InMemoryEscrowFundingRepository;

  beforeEach(() => {
    repo = new InMemoryEscrowFundingRepository();
  });

  it('should create escrow order with all required fields', async () => {
    const escrow = await repo.createEscrowOrder({
      projectId: 'test-project-1',
      userId: 'test-user-1',
      orderId: 'PPL-ORDER-123',
      amountUsd: 5000,
      payerEmail: 'test@example.com'
    });

    expect(escrow).toBeDefined();
    expect(escrow.id).toBeDefined();
    expect(escrow.orderId).toBe('PPL-ORDER-123');
    expect(escrow.fundedUsd).toBe(0);
    expect(escrow.releasedUsd).toBe(0);
    expect(escrow.refundedUsd).toBe(0);
    expect(escrow.orderStatus).toBe('CREATED');
    expect(escrow.captureId).toBeNull();
    expect(escrow.payerEmail).toBe('test@example.com');
    expect(escrow.createdAt).toBeInstanceOf(Date);
    expect(escrow.updatedAt).toBeInstanceOf(Date);
  });

  it('should enforce unique constraint on order_id', async () => {
    await repo.createEscrowOrder({
      projectId: 'test-project-1',
      userId: 'test-user-1',
      orderId: 'PPL-ORDER-456',
      amountUsd: 1000,
      payerEmail: 'test@example.com'
    });

    // Attempt to create duplicate order_id should fail
    await expect(
      repo.createEscrowOrder({
        projectId: 'test-project-2',
        userId: 'test-user-2',
        orderId: 'PPL-ORDER-456', // Duplicate order_id
        amountUsd: 2000,
        payerEmail: 'test2@example.com'
      })
    ).rejects.toThrow('Duplicate order_id');
  });

  it('should require user_id for tenant isolation', async () => {
    await expect(
      repo.createEscrowOrder({
        projectId: 'test-project-1',
        userId: '', // Missing user_id
        orderId: 'PPL-ORDER-789',
        amountUsd: 5000,
        payerEmail: 'test@example.com'
      })
    ).rejects.toThrow('userId is required');
  });

  it('should support NULL capture_id (partial index)', async () => {
    const escrow = await repo.createEscrowOrder({
      projectId: 'test-project-1',
      userId: 'test-user-1',
      orderId: 'PPL-ORDER-ABC',
      amountUsd: 3000,
      payerEmail: 'test@example.com'
    });

    // capture_id should be null initially
    expect(escrow.captureId).toBeNull();
  });

  it('should retrieve order by order_id with tenant isolation', async () => {
    const created = await repo.createEscrowOrder({
      projectId: 'test-project-1',
      userId: 'test-user-1',
      orderId: 'PPL-ORDER-XYZ',
      amountUsd: 5000,
      payerEmail: 'test@example.com'
    });

    // Same user can read
    const retrieved = await repo.getByOrderId('PPL-ORDER-XYZ', 'test-user-1');
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);

    // Different user cannot read (tenant isolation)
    const notFound = await repo.getByOrderId('PPL-ORDER-XYZ', 'test-user-2');
    expect(notFound).toBeNull();
  });

  it('should retrieve order by project_id with tenant isolation', async () => {
    await repo.createEscrowOrder({
      projectId: 'proj-123',
      userId: 'user-1',
      orderId: 'ORDER-001',
      amountUsd: 5000,
      payerEmail: 'payer@example.com'
    });

    // Same user can read
    const found = await repo.getByProjectId('proj-123', 'user-1');
    expect(found?.projectId).toBe('proj-123');

    // Different user cannot read
    const notFound = await repo.getByProjectId('proj-123', 'user-2');
    expect(notFound).toBeNull();
  });
});
