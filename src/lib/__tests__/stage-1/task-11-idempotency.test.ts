import { describe, it, expect } from '@jest/globals';
import {
  generateOrderIdempotencyKey,
  generateCaptureIdempotencyKey,
  generateRefundIdempotencyKey,
  formatPayPalRequestId
} from '@/lib/escrow/idempotency';

describe('Stage 1 Task 11: Deterministic Idempotency Keys', () => {
  describe('Order Idempotency Key Generation', () => {
    it('should generate identical keys for identical inputs', () => {
      const key1 = generateOrderIdempotencyKey('proj-1', 'contract-name', 5000.00);
      const key2 = generateOrderIdempotencyKey('proj-1', 'contract-name', 5000.00);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different project IDs', () => {
      const key1 = generateOrderIdempotencyKey('proj-1', 'contract-name', 5000.00);
      const key2 = generateOrderIdempotencyKey('proj-2', 'contract-name', 5000.00);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different contract names', () => {
      const key1 = generateOrderIdempotencyKey('proj-1', 'contract-1', 5000.00);
      const key2 = generateOrderIdempotencyKey('proj-1', 'contract-2', 5000.00);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different amounts', () => {
      const key1 = generateOrderIdempotencyKey('proj-1', 'contract-name', 5000.00);
      const key2 = generateOrderIdempotencyKey('proj-1', 'contract-name', 6000.00);

      expect(key1).not.toBe(key2);
    });

    it('should return uppercase hex string', () => {
      const key = generateOrderIdempotencyKey('proj-1', 'contract-name', 5000.00);

      expect(key).toMatch(/^[A-F0-9]+$/);
      expect(key.length).toBe(64); // SHA256 produces 64 hex characters
    });

    it('should handle amounts with decimal precision', () => {
      const key1 = generateOrderIdempotencyKey('proj-1', 'contract', 5000.10);
      const key2 = generateOrderIdempotencyKey('proj-1', 'contract', 5000.10);
      const key3 = generateOrderIdempotencyKey('proj-1', 'contract', 5000.11);

      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
    });
  });

  describe('Capture Idempotency Key Generation', () => {
    it('should generate identical keys for identical inputs', () => {
      const key1 = generateCaptureIdempotencyKey('proj-1', 'ORDER-123', 5000.00);
      const key2 = generateCaptureIdempotencyKey('proj-1', 'ORDER-123', 5000.00);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different order IDs', () => {
      const key1 = generateCaptureIdempotencyKey('proj-1', 'ORDER-123', 5000.00);
      const key2 = generateCaptureIdempotencyKey('proj-1', 'ORDER-456', 5000.00);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys from order keys', () => {
      const orderKey = generateOrderIdempotencyKey('proj-1', 'contract', 5000.00);
      const captureKey = generateCaptureIdempotencyKey('proj-1', 'ORDER-123', 5000.00);

      expect(orderKey).not.toBe(captureKey);
    });

    it('should return uppercase hex string', () => {
      const key = generateCaptureIdempotencyKey('proj-1', 'ORDER-123', 5000.00);

      expect(key).toMatch(/^[A-F0-9]+$/);
      expect(key.length).toBe(64);
    });
  });

  describe('Refund Idempotency Key Generation', () => {
    it('should generate identical keys for identical inputs', () => {
      const key1 = generateRefundIdempotencyKey('proj-1', 'CAPTURE-456', 2000.00);
      const key2 = generateRefundIdempotencyKey('proj-1', 'CAPTURE-456', 2000.00);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different capture IDs', () => {
      const key1 = generateRefundIdempotencyKey('proj-1', 'CAPTURE-456', 2000.00);
      const key2 = generateRefundIdempotencyKey('proj-1', 'CAPTURE-789', 2000.00);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different refund amounts', () => {
      const key1 = generateRefundIdempotencyKey('proj-1', 'CAPTURE-456', 2000.00);
      const key2 = generateRefundIdempotencyKey('proj-1', 'CAPTURE-456', 3000.00);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys from order/capture keys', () => {
      const orderKey = generateOrderIdempotencyKey('proj-1', 'contract', 5000.00);
      const captureKey = generateCaptureIdempotencyKey('proj-1', 'ORDER-123', 5000.00);
      const refundKey = generateRefundIdempotencyKey('proj-1', 'CAPTURE-456', 2000.00);

      expect(refundKey).not.toBe(orderKey);
      expect(refundKey).not.toBe(captureKey);
    });

    it('should return uppercase hex string', () => {
      const key = generateRefundIdempotencyKey('proj-1', 'CAPTURE-456', 2000.00);

      expect(key).toMatch(/^[A-F0-9]+$/);
      expect(key.length).toBe(64);
    });
  });

  describe('PayPal Request ID Formatting', () => {
    it('should format key to PayPal-Request-Id (max 36 chars)', () => {
      const key = generateOrderIdempotencyKey('proj-1', 'contract', 5000.00);
      const requestId = formatPayPalRequestId(key);

      expect(requestId.length).toBeLessThanOrEqual(36);
      expect(requestId).toMatch(/^[A-F0-9]+$/);
    });

    it('should preserve full key if shorter than 36 chars', () => {
      const shortKey = 'ABCDEF123456';
      const requestId = formatPayPalRequestId(shortKey);

      expect(requestId).toBe(shortKey);
    });

    it('should truncate to exactly 36 chars for SHA256 hash', () => {
      const key = generateOrderIdempotencyKey('proj-1', 'contract', 5000.00);
      const requestId = formatPayPalRequestId(key);

      // SHA256 is 64 chars, so should be truncated to 36
      expect(requestId.length).toBe(36);
    });
  });

  describe('Cross-Operation Isolation', () => {
    it('should ensure order, capture, and refund keys are distinct', () => {
      const projectId = 'proj-same';
      const orderKey = generateOrderIdempotencyKey(projectId, 'contract', 5000.00);
      const captureKey = generateCaptureIdempotencyKey(projectId, 'ORDER-123', 5000.00);
      const refundKey = generateRefundIdempotencyKey(projectId, 'CAPTURE-456', 2000.00);

      const keys = [orderKey, captureKey, refundKey];
      const uniqueKeys = new Set(keys);

      expect(uniqueKeys.size).toBe(3); // All three should be unique
    });
  });

  describe('Determinism Across Multiple Calls', () => {
    it('should produce identical results across multiple runs', () => {
      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(generateOrderIdempotencyKey('proj-1', 'contract', 5000.00));
      }

      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBe(1); // All calls should produce same key
    });

    it('should work with edge case amounts', () => {
      const key1 = generateOrderIdempotencyKey('proj-1', 'contract', 0.01);
      const key2 = generateOrderIdempotencyKey('proj-1', 'contract', 999999.99);
      const key3 = generateOrderIdempotencyKey('proj-1', 'contract', 0.01);

      expect(key1).toBe(key3);
      expect(key1).not.toBe(key2);
    });
  });
});
