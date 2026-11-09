/**
 * @jest-environment node
 */
import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as sessionModule from '@/lib/auth/session';
import * as repositoryModule from '@/lib/db/repository';

/**
 * Mock setup
 */
const mockSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
  },
};

const mockRepository = {
  appendLedgerEvent: jest.fn().mockResolvedValue({ inserted: true }),
};

jest.mock('@/lib/auth/session');
jest.mock('@/lib/db/repository');

const mockGetSession = sessionModule.getSession as jest.MockedFunction<typeof sessionModule.getSession>;
const mockGetRepository = repositoryModule.getRepository as jest.MockedFunction<typeof repositoryModule.getRepository>;

/**
 * Helper to create a mock request
 */
function createMockRequest(body: Record<string, unknown>, headers: Record<string, string> = {}): NextRequest {
  const request = new NextRequest('http://localhost:3000/api/agent/draft-contract', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
  return request;
}

/**
 * Test Suite
 */
describe('POST /api/agent/draft-contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRepository.mockReturnValue(mockRepository as any);
    mockGetSession.mockResolvedValue(mockSession as any);
  });

  // ========================================================================
  // Authentication Tests
  // ========================================================================

  describe('Authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetSession.mockResolvedValueOnce(null);

      const request = createMockRequest({ brief: 'Test brief' });
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toContain('Authentication required');
    });
  });

  // ========================================================================
  // Request Validation Tests
  // ========================================================================

  describe('Request Validation', () => {
    it('should return 400 for malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/agent/draft-contract', {
        method: 'POST',
        body: '{invalid json}',
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Malformed JSON');
    });

    it('should return 400 if brief is missing', async () => {
      const request = createMockRequest({});

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('non-empty string');
    });

    it('should return 400 if brief is not a string', async () => {
      const request = createMockRequest({ brief: 123 });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('non-empty string');
    });

    it('should return 400 if brief is empty string', async () => {
      const request = createMockRequest({ brief: '' });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('non-empty string');
    });

    it('should return 400 if brief is too short (< 20 chars)', async () => {
      const request = createMockRequest({ brief: 'short brief' });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('at least 20 characters');
    });

    it('should return 400 if brief exceeds 2000 characters', async () => {
      const longBrief = 'a'.repeat(2001);
      const request = createMockRequest({ brief: longBrief });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('not exceed 2000 characters');
    });
  });

  // ========================================================================
  // AI Model Error Handling
  // ========================================================================

  describe('AI Model Integration', () => {
    beforeEach(() => {
      // Mock the fetch globally for AI model calls
      global.fetch = jest.fn();
    });

    it('should return 504 if AI model times out', async () => {
      (global.fetch as jest.Mock).mockImplementationOnce(
        () => new Promise((_, reject) => {
          setTimeout(() => reject(new Error('AbortError')), 50);
        })
      );

      const request = createMockRequest({ brief: 'Build a login system with OAuth support for 100 users' });
      const response = await POST(request);

      expect(response.status).toBe(504);
      const data = await response.json();
      expect(data.error).toContain('longer than expected');
      expect(mockRepository.appendLedgerEvent).toHaveBeenCalledWith(
        mockSession.user.id,
        expect.objectContaining({
          action: 'CONTRACT_DRAFT_TIMEOUT',
        })
      );
    });

    it('should return 422 if AI response is not valid JSON', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not valid json {{{' } }],
        }),
      });

      const request = createMockRequest({ brief: 'Build a login system with OAuth support for 100 users' });
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('malformed');
      expect(mockRepository.appendLedgerEvent).toHaveBeenCalledWith(
        mockSession.user.id,
        expect.objectContaining({
          action: 'CONTRACT_DRAFT_PARSE_ERROR',
        })
      );
    });

    it('should return 422 if response structure is invalid (missing milestones)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  totalEstimatedUSD: 100,
                  contractSummary: 'Test',
                  // missing milestones
                }),
              },
            },
          ],
        }),
      });

      const request = createMockRequest({ brief: 'Build a login system with OAuth support for 100 users' });
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('milestones array');
    });

    it('should return 422 if milestones array is empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  milestones: [],
                  totalEstimatedUSD: 0,
                  contractSummary: 'Test',
                }),
              },
            },
          ],
        }),
      });

      const request = createMockRequest({ brief: 'Build a login system with OAuth support for 100 users' });
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('1-10 items');
    });

    it('should return 422 if milestones array exceeds 10 items', async () => {
      const milestones = Array.from({ length: 11 }, (_, i) => ({
        name: `Milestone ${i + 1}`,
        description: `Task ${i + 1}`,
        estimatedUSD: 100,
        acceptanceCriteria: ['Done'],
      }));

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  milestones,
                  totalEstimatedUSD: 1100,
                  contractSummary: 'Test',
                }),
              },
            },
          ],
        }),
      });

      const request = createMockRequest({ brief: 'Build a system with comprehensive features and requirements' });
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('1-10 items');
    });

    it('should return 422 if milestone has no name', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  milestones: [
                    {
                      // missing name
                      description: 'Test',
                      estimatedUSD: 100,
                      acceptanceCriteria: ['Done'],
                    },
                  ],
                  totalEstimatedUSD: 100,
                  contractSummary: 'Test',
                }),
              },
            },
          ],
        }),
      });

      const request = createMockRequest({ brief: 'Build a login system with OAuth support for 100 users' });
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('name');
    });

    it('should return 422 if milestone estimatedUSD is not positive', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  milestones: [
                    {
                      name: 'Test Milestone',
                      description: 'Test description',
                      estimatedUSD: -100, // negative!
                      acceptanceCriteria: ['Done'],
                    },
                  ],
                  totalEstimatedUSD: -100,
                  contractSummary: 'Test',
                }),
              },
            },
          ],
        }),
      });

      const request = createMockRequest({ brief: 'Build a login system with OAuth support for 100 users' });
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('positive');
    });

    it('should return 422 if acceptanceCriteria is not an array', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  milestones: [
                    {
                      name: 'Test Milestone',
                      description: 'Test description',
                      estimatedUSD: 100,
                      acceptanceCriteria: 'not an array', // string instead of array
                    },
                  ],
                  totalEstimatedUSD: 100,
                  contractSummary: 'Test',
                }),
              },
            },
          ],
        }),
      });

      const request = createMockRequest({ brief: 'Build a login system with OAuth support for 100 users' });
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('acceptanceCriteria');
    });

    it('should return 422 if acceptanceCriteria is empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  milestones: [
                    {
                      name: 'Test Milestone',
                      description: 'Test description',
                      estimatedUSD: 100,
                      acceptanceCriteria: [], // empty array
                    },
                  ],
                  totalEstimatedUSD: 100,
                  contractSummary: 'Test',
                }),
              },
            },
          ],
        }),
      });

      const request = createMockRequest({ brief: 'Build a login system with OAuth support for 100 users' });
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('at least one');
    });

    it('should return 422 if totalEstimatedUSD is not positive', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  milestones: [
                    {
                      name: 'Test Milestone',
                      description: 'Test description',
                      estimatedUSD: 100,
                      acceptanceCriteria: ['Done'],
                    },
                  ],
                  totalEstimatedUSD: 0, // zero!
                  contractSummary: 'Test',
                }),
              },
            },
          ],
        }),
      });

      const request = createMockRequest({ brief: 'Build a login system with OAuth support for 100 users' });
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('totalEstimatedUSD');
    });

    it('should return 422 if contractSummary is empty', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  milestones: [
                    {
                      name: 'Test Milestone',
                      description: 'Test description',
                      estimatedUSD: 100,
                      acceptanceCriteria: ['Done'],
                    },
                  ],
                  totalEstimatedUSD: 100,
                  contractSummary: '', // empty!
                }),
              },
            },
          ],
        }),
      });

      const request = createMockRequest({ brief: 'Build a login system with OAuth support for 100 users' });
      const response = await POST(request);

      expect(response.status).toBe(422);
      const data = await response.json();
      expect(data.error).toContain('contractSummary');
    });
  });

  // ========================================================================
  // Success Cases
  // ========================================================================

  describe('Successful Contract Drafting', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('should return 200 with valid drafted contract (single milestone)', async () => {
      const draftedContract = {
        milestones: [
          {
            name: 'API Development',
            description: 'Build RESTful API with authentication',
            estimatedUSD: 1500,
            acceptanceCriteria: [
              'All endpoints return correct status codes',
              'Authentication token validation works',
              'API documentation is complete',
            ],
          },
        ],
        totalEstimatedUSD: 1500,
        contractSummary:
          'A comprehensive API development engagement including endpoint creation, security implementation, and complete documentation.',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(draftedContract) } }],
        }),
      });

      const request = createMockRequest({
        brief: 'Build a RESTful API with user authentication and comprehensive documentation for our platform.',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.milestones).toHaveLength(1);
      expect(data.milestones[0].name).toBe('API Development');
      expect(data.totalEstimatedUSD).toBe(1500);
      expect(data.contractSummary).toBeTruthy();

      // Verify audit event was logged
      expect(mockRepository.appendLedgerEvent).toHaveBeenCalledWith(
        mockSession.user.id,
        expect.objectContaining({
          action: 'CONTRACT_DRAFTED',
          amountUSD: 1500,
          status: 'PROPOSED',
          riskLevel: 'LOW',
        })
      );
    });

    it('should return 200 with valid drafted contract (multiple milestones)', async () => {
      const draftedContract = {
        milestones: [
          {
            name: 'Design Phase',
            description: 'Create UI/UX mockups and design system',
            estimatedUSD: 1000,
            acceptanceCriteria: [
              'Figma designs approved by stakeholders',
              'Design system documented',
            ],
          },
          {
            name: 'Frontend Development',
            description: 'Build React components',
            estimatedUSD: 2000,
            acceptanceCriteria: [
              'All components tested',
              'Responsive design verified',
            ],
          },
          {
            name: 'Backend Integration',
            description: 'Connect frontend to API',
            estimatedUSD: 1500,
            acceptanceCriteria: [
              'API integration complete',
              'Error handling implemented',
            ],
          },
        ],
        totalEstimatedUSD: 4500,
        contractSummary:
          'Full-stack web application development including design, frontend implementation, and backend integration.',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(draftedContract) } }],
        }),
      });

      const request = createMockRequest({
        brief: 'Build a web application with design, frontend, and backend integration. Needs to be responsive and production-ready.',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.milestones).toHaveLength(3);
      expect(data.totalEstimatedUSD).toBe(4500);

      // Verify the audit event contains milestone count
      expect(mockRepository.appendLedgerEvent).toHaveBeenCalledWith(
        mockSession.user.id,
        expect.objectContaining({
          action: 'CONTRACT_DRAFTED',
          amountUSD: 4500,
        })
      );
    });

    it('should handle brief with extra whitespace', async () => {
      const draftedContract = {
        milestones: [
          {
            name: 'Implementation',
            description: 'Complete the work',
            estimatedUSD: 500,
            acceptanceCriteria: ['Tasks done'],
          },
        ],
        totalEstimatedUSD: 500,
        contractSummary: 'Simple implementation contract.',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(draftedContract) } }],
        }),
      });

      const request = createMockRequest({
        brief: '  \n  Build a simple feature with testing requirements and documentation.  \n  ',
      });
      const response = await POST(request);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.milestones).toBeDefined();
    });
  });

  // ========================================================================
  // Audit Logging Tests
  // ========================================================================

  describe('Audit Logging', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('should log successful contract draft with correct details', async () => {
      const draftedContract = {
        milestones: [
          {
            name: 'Task',
            description: 'Do something',
            estimatedUSD: 250,
            acceptanceCriteria: ['Done'],
          },
        ],
        totalEstimatedUSD: 250,
        contractSummary: 'Test contract.',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(draftedContract) } }],
        }),
      });

      const request = createMockRequest({
        brief: 'Create a simple contract for testing and validation purposes.',
      });
      await POST(request);

      expect(mockRepository.appendLedgerEvent).toHaveBeenCalledWith(
        mockSession.user.id,
        expect.objectContaining({
          agentRole: 'BUYER_AI',
          action: 'CONTRACT_DRAFTED',
          amountUSD: 250,
          recipientEmail: mockSession.user.email,
          auditConfidenceScore: 95,
          status: 'PROPOSED',
          riskLevel: 'LOW',
        })
      );
    });
  });
});
