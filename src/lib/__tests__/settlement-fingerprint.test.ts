import {
  buildMilestoneSettlementFingerprint,
  buildPayPalRequestId,
  buildSenderBatchId,
} from '@/lib/settlement/settlement';

describe('Settlement Fingerprinting', () => {
  describe('buildMilestoneSettlementFingerprint', () => {
    test('should produce deterministic output (same inputs → same fingerprint)', () => {
      const projectId = 'proj-123';
      const milestoneId = 'm1';
      const amount = 250.00;

      const fp1 = buildMilestoneSettlementFingerprint(projectId, milestoneId, amount);
      const fp2 = buildMilestoneSettlementFingerprint(projectId, milestoneId, amount);

      expect(fp1).toBe(fp2);
      expect(fp1.length).toBe(64); // SHA256 = 64 hex chars
      expect(/^[A-F0-9]{64}$/.test(fp1)).toBe(true);
    });

    test('should produce different fingerprints for different inputs', () => {
      const fp1 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 250.00);
      const fp2 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 251.00);
      const fp3 = buildMilestoneSettlementFingerprint('proj-456', 'm1', 250.00);

      expect(fp1).not.toBe(fp2);
      expect(fp1).not.toBe(fp3);
      expect(fp2).not.toBe(fp3);
    });

    test('should handle decimal precision correctly', () => {
      // 250.00 vs 250.000 should produce same fingerprint (fixed to 2 decimals)
      const fp1 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 250.00);
      const fp2 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 250.000);

      expect(fp1).toBe(fp2);
    });

    test('should differentiate between different decimal values', () => {
      const fp1 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 100.5);
      const fp2 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 100.50);
      const fp3 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 100.51);

      // 100.5 and 100.50 are the same when fixed to 2 decimals
      expect(fp1).toBe(fp2);
      // 100.50 and 100.51 are different
      expect(fp1).not.toBe(fp3);
    });

    test('should handle zero amount', () => {
      const fp1 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 0);
      const fp2 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 0);

      expect(fp1).toBe(fp2);
      expect(fp1.length).toBe(64);
    });

    test('should handle large amounts', () => {
      const fp1 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 999999.99);
      const fp2 = buildMilestoneSettlementFingerprint('proj-123', 'm1', 999999.99);

      expect(fp1).toBe(fp2);
      expect(fp1.length).toBe(64);
    });
  });

  describe('buildPayPalRequestId', () => {
    test('should produce valid PayPal-Request-Id format', () => {
      const fingerprint = buildMilestoneSettlementFingerprint('proj-123', 'm1', 250.00);
      const requestId = buildPayPalRequestId(fingerprint);

      expect(requestId).toMatch(/^REQ-[A-F0-9]{32}$/);
      expect(requestId.length).toBe(36); // REQ- (4 chars) + 32 chars
    });

    test('should derive from first 32 chars of fingerprint', () => {
      // Create a 64-char fingerprint
      const fingerprint = 'ABCDEF0123456789ABCDEF0123456789FEDCBA9876543210FEDCBA9876543210';
      if (fingerprint.length !== 64) {
        throw new Error(`Test setup error: fingerprint is ${fingerprint.length} chars, expected 64`);
      }
      const requestId = buildPayPalRequestId(fingerprint);

      // REQ- (4 chars) + first 32 of fingerprint = 36 chars total
      expect(requestId).toBe('REQ-ABCDEF0123456789ABCDEF0123456789'.slice(0, 36));
      expect(requestId.length).toBe(36);
    });

    test('should throw if fingerprint is invalid length', () => {
      expect(() => buildPayPalRequestId('short')).toThrow('Invalid fingerprint length');
      expect(() => buildPayPalRequestId('a'.repeat(63))).toThrow('Invalid fingerprint length');
      expect(() => buildPayPalRequestId('a'.repeat(65))).toThrow('Invalid fingerprint length');
    });

    test('should produce same PayPal-Request-Id for same fingerprint', () => {
      const fingerprint = buildMilestoneSettlementFingerprint('proj-123', 'm1', 250.00);
      const requestId1 = buildPayPalRequestId(fingerprint);
      const requestId2 = buildPayPalRequestId(fingerprint);

      expect(requestId1).toBe(requestId2);
    });
  });

  describe('buildSenderBatchId', () => {
    test('should produce valid sender_batch_id format', () => {
      const fingerprint = buildMilestoneSettlementFingerprint('proj-123', 'm1', 250.00);
      const batchId = buildSenderBatchId(fingerprint);

      expect(batchId).toMatch(/^SETTLE-[A-F0-9]{28}$/);
      expect(batchId.length).toBe(35); // SETTLE- (7 chars) + 28 chars = 35
    });

    test('should derive from first 28 chars of fingerprint', () => {
      // Create a 64-char fingerprint
      const fingerprint = 'ABCDEF0123456789ABCDEF0123456789FEDCBA9876543210FEDCBA9876543210';
      if (fingerprint.length !== 64) {
        throw new Error(`Test setup error: fingerprint is ${fingerprint.length} chars, expected 64`);
      }
      const batchId = buildSenderBatchId(fingerprint);

      // SETTLE- (7 chars) + first 28 of fingerprint = 35 chars
      // First 28 chars of fingerprint are: ABCDEF0123456789ABCDEF012345
      expect(batchId).toBe('SETTLE-ABCDEF0123456789ABCDEF012345');
      expect(batchId.length).toBe(35); // SETTLE- (7 chars) + 28 chars = 35
    });

    test('should throw if fingerprint is invalid length', () => {
      expect(() => buildSenderBatchId('short')).toThrow('Invalid fingerprint length');
      expect(() => buildSenderBatchId('a'.repeat(63))).toThrow('Invalid fingerprint length');
      expect(() => buildSenderBatchId('a'.repeat(65))).toThrow('Invalid fingerprint length');
    });

    test('should produce same sender_batch_id for same fingerprint', () => {
      const fingerprint = buildMilestoneSettlementFingerprint('proj-123', 'm1', 250.00);
      const batchId1 = buildSenderBatchId(fingerprint);
      const batchId2 = buildSenderBatchId(fingerprint);

      expect(batchId1).toBe(batchId2);
    });
  });

  describe('Idempotency Integration', () => {
    test('retry with same fingerprint should use same PayPal-Request-Id and sender_batch_id', () => {
      const projectId = 'proj-123';
      const milestoneId = 'm1';
      const amount = 250.00;

      // First attempt
      const fp1 = buildMilestoneSettlementFingerprint(projectId, milestoneId, amount);
      const req1 = buildPayPalRequestId(fp1);
      const batch1 = buildSenderBatchId(fp1);

      // Retry (same settlement)
      const fp2 = buildMilestoneSettlementFingerprint(projectId, milestoneId, amount);
      const req2 = buildPayPalRequestId(fp2);
      const batch2 = buildSenderBatchId(fp2);

      // Should be identical
      expect(fp1).toBe(fp2);
      expect(req1).toBe(req2);
      expect(batch1).toBe(batch2);
    });

    test('different settlements should produce different idempotency keys', () => {
      const projectId = 'proj-123';
      const milestoneId1 = 'm1';
      const milestoneId2 = 'm2';
      const amount = 250.00;

      // Settlement 1
      const fp1 = buildMilestoneSettlementFingerprint(projectId, milestoneId1, amount);
      const req1 = buildPayPalRequestId(fp1);
      const batch1 = buildSenderBatchId(fp1);

      // Settlement 2
      const fp2 = buildMilestoneSettlementFingerprint(projectId, milestoneId2, amount);
      const req2 = buildPayPalRequestId(fp2);
      const batch2 = buildSenderBatchId(fp2);

      // Should be different
      expect(fp1).not.toBe(fp2);
      expect(req1).not.toBe(req2);
      expect(batch1).not.toBe(batch2);
    });
  });
});
