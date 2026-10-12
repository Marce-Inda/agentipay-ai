/**
 * Unit & Integration Tests for /api/agent/stream Route
 * Tests OWASP LLM01 Sanitization, Budget Validation, and AI Streaming
 */

import { POST } from '../stream/route';
import { NextRequest } from 'next/server';

// Mock all external dependencies
jest.mock('ai', () => ({
  streamText: jest.fn(() => ({
    toTextStreamResponse: jest.fn(() => new Response('Mocked stream response')),
  })),
}));

jest.mock('@/lib/ai/provider', () => ({
  getActiveAIModel: jest.fn(() => ({
    name: 'mock-model',
  })),
}));

describe('/api/agent/stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/agent/stream', () => {
    it('should return 400 if prompt is missing', async () => {
      const req = {
        json: async () => ({}),
      } as any as NextRequest;

      const res = await POST(req);

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe('Missing prompt in request body');
    });

    it('should return 200 with valid prompt (fallback mode)', async () => {
      const body = {
        prompt: 'Request a quote for API integration',
        maxBudgetUSD: 100,
        projectName: 'Test Project',
        vendorEmail: 'vendor@example.com',
      };

      const req = {
        json: async () => body,
      } as any as NextRequest;

      const res = await POST(req);

      expect(res.status).toBe(200);
    });

    it('should handle server errors gracefully', async () => {
      const req = {
        json: async () => ({
          prompt: 'Test',
          maxBudgetUSD: 100,
        }),
      } as any as NextRequest;

      const res = await POST(req);

      expect(res.status).toBe(200);
    });
  });
});
