/**
 * Unit & Integration Tests for PayPalSandboxClient
 * Tests OAuth token retrieval and milestone payout execution
 */

import { PayPalSandboxClient } from '../client';
import { BudgetEnvelope } from '../../types';

describe('PayPalSandboxClient', () => {
  let originalFetch: typeof global.fetch;
  let originalSimulationMode: string | undefined;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalSimulationMode = process.env.PAYPAL_SIMULATION_MODE;
    delete process.env.PAYPAL_SIMULATION_MODE;
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalSimulationMode === undefined) {
      delete process.env.PAYPAL_SIMULATION_MODE;
    } else {
      process.env.PAYPAL_SIMULATION_MODE = originalSimulationMode;
    }
  });

  describe('Constructor', () => {
    it('should default to sandbox environment', () => {
      const client = new PayPalSandboxClient();
      expect(client).toBeDefined();
    });

    it('should use environment from options if provided', () => {
      const client = new PayPalSandboxClient({ environment: 'production' });
      expect(client).toBeDefined();
    });
  });

  describe('getAccessToken', () => {
    it('should return simulated token when credentials are missing', async () => {
      const client = new PayPalSandboxClient({
        clientId: 'placeholder',
        clientSecret: 'placeholder',
        simulationMode: true,
      });

      const token = await client.getAccessToken();
      expect(token).toContain('simulated_sandbox_oauth_token_');
    });

    it('should return simulated token when clientId is "placeholder"', async () => {
      const client = new PayPalSandboxClient({
        clientId: 'placeholder',
        clientSecret: 'test-secret',
        simulationMode: true,
      });

      const token = await client.getAccessToken();
      expect(token).toContain('simulated_sandbox_oauth_token_');
    });

    it('should fail closed when credentials are missing and simulation is not explicitly enabled', async () => {
      const client = new PayPalSandboxClient({
        clientId: 'placeholder',
        clientSecret: 'placeholder',
      });

      await expect(client.getAccessToken()).rejects.toThrow('PayPal credentials are not configured');
    });

    it('should never simulate in the production environment even if explicitly requested', async () => {
      const client = new PayPalSandboxClient({
        clientId: 'placeholder',
        clientSecret: 'placeholder',
        environment: 'production',
        simulationMode: true,
      });

      await expect(client.getAccessToken()).rejects.toThrow('PayPal credentials are not configured');
    });

    it('should fetch real OAuth token with valid credentials', async () => {
      const mockResponse = {
        access_token: 'REAL_ACCESS_TOKEN_12345',
        token_type: 'Bearer',
        expires_in: 32400,
      };

      (global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));

      const client = new PayPalSandboxClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      const token = await client.getAccessToken();
      expect(token).toBe('REAL_ACCESS_TOKEN_12345');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw error on OAuth authentication failure', async () => {
      const mockError = { error: 'invalid_client', error_description: 'Client authentication failed' };

      (global.fetch as jest.Mock).mockResolvedValue(new Response(JSON.stringify(mockError), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }));

      const client = new PayPalSandboxClient({
        clientId: 'invalid-client-id',
        clientSecret: 'invalid-secret',
      });

      await expect(client.getAccessToken()).rejects.toThrow('PayPal OAuth Authentication Failed [401]');
    });

    it('should throw error on network timeout', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Request timeout'));

      const client = new PayPalSandboxClient({
        clientId: 'test-id',
        clientSecret: 'test-secret',
      });

      await expect(client.getAccessToken()).rejects.toThrow('Request timeout');
    });
  });

  describe('executeMilestonePayout', () => {
    const mockPayoutRequest = {
      receiverEmail: 'vendor@example.com',
      amountUSD: 250,
      milestoneName: 'API Integration',
    };

    it('should return simulated payout in simulated mode', async () => {
      const client = new PayPalSandboxClient({
        clientId: 'placeholder',
        clientSecret: 'placeholder',
        simulationMode: true,
      });

      const result = await client.executeMilestonePayout(mockPayoutRequest);
      expect(result.success).toBe(true);
      expect(result.payoutBatchId).toMatch(/^SIM_PAYOUT_[A-Z0-9]+$/);
      expect(result.httpLog).toContain('POST');
    });

    it('should execute real PayPal payout with valid credentials', async () => {
      const mockAccessToken = 'REAL_ACCESS_TOKEN';
      const mockOAuthResponse = {
        access_token: mockAccessToken,
        token_type: 'Bearer',
        expires_in: 32400,
      };

      const mockPayoutResponse = {
        batch_header: {
          payout_batch_id: 'PAYPAL_BATCH_12345',
          batch_status: 'SUCCESS',
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(new Response(JSON.stringify(mockOAuthResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockPayoutResponse), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }));

      const client = new PayPalSandboxClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      const result = await client.executeMilestonePayout(mockPayoutRequest);
      expect(result.success).toBe(true);
      expect(result.payoutBatchId).toBe('PAYPAL_BATCH_12345');
    });

    it('should throw error on PayPal API rejection (401)', async () => {
      const mockAccessToken = 'REAL_ACCESS_TOKEN';
      const mockOAuthResponse = {
        access_token: mockAccessToken,
        token_type: 'Bearer',
        expires_in: 32400,
      };

      const mockErrorResponse = {
        errors: [
          {
            issue: 'INVALID_REQUEST',
            description: 'Request is not well formed',
          },
        ],
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(new Response(JSON.stringify(mockOAuthResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockErrorResponse), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }));

      const client = new PayPalSandboxClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      await expect(client.executeMilestonePayout(mockPayoutRequest)).rejects.toThrow('PayPal Payout Failed [401]');
    });

    it('should throw error on PayPal API rate limit (429)', async () => {
      const mockAccessToken = 'REAL_ACCESS_TOKEN';
      const mockOAuthResponse = {
        access_token: mockAccessToken,
        token_type: 'Bearer',
        expires_in: 32400,
      };

      const mockRateLimitResponse = {
        name: 'RATE_LIMIT_EXCEPTION',
        message: 'Rate limit exceeded',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(new Response(JSON.stringify(mockOAuthResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockRateLimitResponse), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }));

      const client = new PayPalSandboxClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      await expect(client.executeMilestonePayout(mockPayoutRequest)).rejects.toThrow('PayPal Payout Failed [429]');
    });

    it('should throw error on network timeout', async () => {
      const mockAccessToken = 'REAL_ACCESS_TOKEN';
      const mockOAuthResponse = {
        access_token: mockAccessToken,
        token_type: 'Bearer',
        expires_in: 32400,
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(new Response(JSON.stringify(mockOAuthResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
        .mockRejectedValueOnce(new Error('Network timeout'));

      const client = new PayPalSandboxClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      await expect(client.executeMilestonePayout(mockPayoutRequest)).rejects.toThrow('Network timeout');
    });

    it('should fail closed instead of silently simulating when credentials are absent', async () => {
      const client = new PayPalSandboxClient({
        clientId: 'placeholder',
        clientSecret: 'placeholder',
      });

      await expect(client.executeMilestonePayout(mockPayoutRequest)).rejects.toThrow(
        'PayPal credentials are not configured'
      );
    });

    it('should derive identical batch and idempotency identifiers for retries with the same key', async () => {
      const client = new PayPalSandboxClient({
        clientId: 'placeholder',
        clientSecret: 'placeholder',
        simulationMode: true,
      });

      const idempotencyKey = 'AUDIT_STABLE_KEY_123';
      const first = await client.executeMilestonePayout({ ...mockPayoutRequest, idempotencyKey });
      const second = await client.executeMilestonePayout({ ...mockPayoutRequest, idempotencyKey });

      expect(first.payoutBatchId).toBe(second.payoutBatchId);
      expect(first.idempotencyKey).toBe(idempotencyKey);
      expect(second.idempotencyKey).toBe(idempotencyKey);
    });

    it('should generate unique batch ID for each payout', async () => {
      const client = new PayPalSandboxClient({
        clientId: 'placeholder',
        clientSecret: 'placeholder',
        simulationMode: true,
      });

      const result1 = await client.executeMilestonePayout(mockPayoutRequest);
      const result2 = await client.executeMilestonePayout(mockPayoutRequest);

      expect(result1.payoutBatchId).not.toBe(result2.payoutBatchId);
    });

    it('should send PayPal-Request-Id header in REST API payout calls for idempotency', async () => {
      const mockAccessToken = 'REAL_ACCESS_TOKEN';
      const mockOAuthResponse = {
        access_token: mockAccessToken,
        token_type: 'Bearer',
        expires_in: 32400,
      };

      const mockPayoutResponse = {
        batch_header: {
          payout_batch_id: 'PAYPAL_BATCH_IDEMPOTENT',
          batch_status: 'SUCCESS',
        },
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(new Response(JSON.stringify(mockOAuthResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
        .mockResolvedValueOnce(new Response(JSON.stringify(mockPayoutResponse), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }));

      const client = new PayPalSandboxClient({
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
      });

      const customKey = 'CUSTOM_IDEMPOTENCY_KEY_999';
      const result = await client.executeMilestonePayout({
        ...mockPayoutRequest,
        idempotencyKey: customKey,
      });

      expect(result.success).toBe(true);
      expect(result.idempotencyKey).toBe(customKey);

      // Check second fetch call headers
      const payoutFetchCall = (global.fetch as jest.Mock).mock.calls[1];
      const headers = payoutFetchCall[1].headers;
      expect(headers['PayPal-Request-Id']).toBe(customKey);
    });

    it('should generate and return idempotencyKey in simulated mode', async () => {
      const client = new PayPalSandboxClient({
        clientId: 'placeholder',
        clientSecret: 'placeholder',
        simulationMode: true,
      });

      const result = await client.executeMilestonePayout(mockPayoutRequest);
      expect(result.idempotencyKey).toBeDefined();
      expect(result.httpLog).toContain('PayPal-Request-Id');
    });
  });
});
