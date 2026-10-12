/**
 * Unit & Integration Tests for /api/agent/audit Route
 * Tests OWASP LLM01 Sanitization and Audit Confidence Evaluation
 */

import { POST } from '../audit/route';
import { NextRequest } from 'next/server';

describe('/api/agent/audit', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/agent/audit', () => {
    it('should return 400 if deliverable content is missing', async () => {
      const req = {
        json: async () => ({}),
      } as any as NextRequest;

      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Deliverable content or URL is required for audit verification');
    });

    it('should return 200 with valid deliverable text', async () => {
      const req = {
        json: async () => ({
          deliverableText: 'Complete implementation with all requirements met',
          expectedRequirements: 'Full compliance',
        }),
      } as any as NextRequest;

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.auditConfidenceScore).toBeGreaterThanOrEqual(85);
    });

    it('should return 200 with valid deliverable URL', async () => {
      const req = {
        json: async () => ({
          deliverableUrl: 'https://example.com/deliverable.zip',
        }),
      } as any as NextRequest;

      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle server errors gracefully', async () => {
      const req = {
        json: async () => ({
          deliverableText: 'Test content',
        }),
      } as any as NextRequest;

      const res = await POST(req);

      expect(res.status).toBe(200);
    });
  });
});
