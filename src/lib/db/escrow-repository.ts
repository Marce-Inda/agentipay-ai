/**
 * Escrow Funding Repository - Abstract interface and adapters
 * Supports in-memory (test) and PostgreSQL (production) implementations
 * Enforces tenant isolation on all operations
 */

export interface EscrowFundingData {
  projectId: string;
  userId: string;
  orderId: string;
  amountUsd: number;
  payerEmail: string;
}

export interface EscrowFunding {
  id: string;
  projectId: string;
  userId: string;
  orderId: string;
  captureId: string | null;
  orderStatus: 'CREATED' | 'APPROVED' | 'CAPTURED' | 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED' | 'VOIDED' | 'FAILED';
  amountUsd: number;
  fundedUsd: number;
  releasedUsd: number;
  refundedUsd: number;
  payerEmail: string;
  createdAt: Date;
  updatedAt: Date;
  metadataJson?: Record<string, unknown>;
}

export interface EscrowFundingRepository {
  createEscrowOrder(data: EscrowFundingData): Promise<EscrowFunding>;
  getByOrderId(orderId: string, userId: string): Promise<EscrowFunding | null>;
  getByProjectId(projectId: string, userId: string): Promise<EscrowFunding | null>;
  getByCapureId(captureId: string, userId: string): Promise<EscrowFunding | null>;
  captureOrder(orderId: string, captureId: string, fundedUsd: number, userId: string): Promise<EscrowFunding>;
  recordRefund(escrowId: string, refundAmount: number, userId: string): Promise<EscrowFunding>;
  incrementReleased(escrowId: string, releaseAmount: number, userId: string): Promise<EscrowFunding>;
  updateOrderStatus(orderId: string, status: string, userId: string): Promise<EscrowFunding>;
}

/**
 * In-memory escrow funding repository for testing
 * Enforces tenant isolation through user_id validation
 * Auto-generates UUIDs and timestamps
 */
export class InMemoryEscrowFundingRepository implements EscrowFundingRepository {
  private records = new Map<string, EscrowFunding>();
  private orderIdIndex = new Map<string, string>(); // order_id -> id
  private captureIdIndex = new Map<string, string>(); // capture_id -> id

  async createEscrowOrder(data: EscrowFundingData): Promise<EscrowFunding> {
    // Enforce tenant isolation
    if (!data.userId) throw new Error('userId is required');

    // Check for duplicate order_id
    if (this.orderIdIndex.has(data.orderId)) {
      throw new Error(`Duplicate order_id: ${data.orderId}`);
    }

    const escrow: EscrowFunding = {
      id: this.generateUUID(),
      projectId: data.projectId,
      userId: data.userId,
      orderId: data.orderId,
      captureId: null,
      orderStatus: 'CREATED',
      amountUsd: data.amountUsd,
      fundedUsd: 0,
      releasedUsd: 0,
      refundedUsd: 0,
      payerEmail: data.payerEmail,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.records.set(escrow.id, escrow);
    this.orderIdIndex.set(data.orderId, escrow.id);

    return escrow;
  }

  async getByOrderId(orderId: string, userId: string): Promise<EscrowFunding | null> {
    const id = this.orderIdIndex.get(orderId);
    if (!id) return null;

    const escrow = this.records.get(id);
    if (!escrow || escrow.userId !== userId) return null; // Tenant isolation

    return this.deepCopy(escrow);
  }

  async getByProjectId(projectId: string, userId: string): Promise<EscrowFunding | null> {
    for (const escrow of this.records.values()) {
      if (escrow.projectId === projectId && escrow.userId === userId) {
        return this.deepCopy(escrow);
      }
    }
    return null;
  }

  async getByCapureId(captureId: string, userId: string): Promise<EscrowFunding | null> {
    const id = this.captureIdIndex.get(captureId);
    if (!id) return null;

    const escrow = this.records.get(id);
    if (!escrow || escrow.userId !== userId) return null;

    return this.deepCopy(escrow);
  }

  async captureOrder(orderId: string, captureId: string, fundedUsd: number, userId: string): Promise<EscrowFunding> {
    const escrow = await this.getByOrderId(orderId, userId);
    if (!escrow) throw new Error(`Escrow order not found: ${orderId}`);

    if (escrow.captureId) throw new Error(`Order already captured: ${orderId}`);

    if (this.captureIdIndex.has(captureId)) {
      throw new Error(`Duplicate capture_id: ${captureId}`);
    }

    escrow.captureId = captureId;
    escrow.orderStatus = 'CAPTURED';
    escrow.fundedUsd = fundedUsd;
    escrow.updatedAt = new Date();

    this.captureIdIndex.set(captureId, escrow.id);
    this.records.set(escrow.id, escrow);

    return this.deepCopy(escrow);
  }

  async recordRefund(escrowId: string, refundAmount: number, userId: string): Promise<EscrowFunding> {
    const escrow = this.records.get(escrowId);
    if (!escrow || escrow.userId !== userId) throw new Error(`Escrow not found: ${escrowId}`);

    const newRefundedTotal = escrow.refundedUsd + refundAmount;
    if (newRefundedTotal > escrow.fundedUsd) {
      throw new Error(`Refund exceeds funded amount`);
    }

    escrow.refundedUsd = newRefundedTotal;
    if (newRefundedTotal === escrow.fundedUsd) {
      escrow.orderStatus = 'FULLY_REFUNDED';
    } else {
      escrow.orderStatus = 'PARTIALLY_REFUNDED';
    }
    escrow.updatedAt = new Date();

    this.records.set(escrow.id, escrow);
    return this.deepCopy(escrow);
  }

  async incrementReleased(escrowId: string, releaseAmount: number, userId: string): Promise<EscrowFunding> {
    const escrow = this.records.get(escrowId);
    if (!escrow || escrow.userId !== userId) throw new Error(`Escrow not found: ${escrowId}`);

    escrow.releasedUsd += releaseAmount;
    escrow.updatedAt = new Date();

    this.records.set(escrow.id, escrow);
    return this.deepCopy(escrow);
  }

  async updateOrderStatus(orderId: string, status: string, userId: string): Promise<EscrowFunding> {
    const escrow = await this.getByOrderId(orderId, userId);
    if (!escrow) throw new Error(`Escrow order not found: ${orderId}`);

    escrow.orderStatus = status as EscrowFunding['orderStatus'];
    escrow.updatedAt = new Date();

    this.records.set(escrow.id, escrow);
    return this.deepCopy(escrow);
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private deepCopy(escrow: EscrowFunding): EscrowFunding {
    return {
      ...escrow,
      createdAt: new Date(escrow.createdAt),
      updatedAt: new Date(escrow.updatedAt),
      metadataJson: escrow.metadataJson ? JSON.parse(JSON.stringify(escrow.metadataJson)) : undefined,
    };
  }
}

// Factory function for dependency injection
export function getEscrowRepository(env: 'test' | 'production'): EscrowFundingRepository {
  if (env === 'test') {
    return new InMemoryEscrowFundingRepository();
  }
  // Production implementation will use PostgreSQL adapter (implemented in Task 2 extension)
  throw new Error('PostgreSQL adapter not yet implemented');
}
