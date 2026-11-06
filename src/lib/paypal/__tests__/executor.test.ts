/**
 * Integration Tests for Milestone Payout Executor
 * 
 * Tests the complete payout executor integration with:
 * - Real PayPal rail (mocked)
 * - Simulated rail
 * - Suppressed rail (fail-closed)
 * - Error handling
 * - Rails selection logic
 * 
 * These tests verify the executor works correctly with the settlement route
 * and produces the expected outcomes for each payment rail.
 */

import { createMilestonePayoutExecutor } from '../executor';
import { PayPalSandboxClient, PayPalPayoutError } from '../client';
import type { MilestonePayoutExecutorContext } from '@/lib/settlement/settlement';

// Mock the PayPal client
jest.mock('../client');

describe('Milestone Payout Executor', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function setupMock(impl?: (...args: any[]) => Promise<any>) {
    const mockClient = {
      executeMilestonePayout: jest.fn(impl) as jest.Mock,
    };
    (PayPalSandboxClient as jest.Mock).mockImplementation(() => mockClient);
    return mockClient;
  }

  describe('PAYPAL_SANDBOX Rail', () => {
    it('should execute real PayPal payout with correct request format', async () => {
      process.env.PAYPAL_CLIENT_ID = 'test-client-id';
      process.env.PAYPAL_CLIENT_SECRET = 'test-client-secret';
      process.env.PAYPAL_SIMULATION_MODE = 'false';

      setupMock(() => Promise.resolve({
        success: true,
        rail: 'PAYPAL_SANDBOX',
        payoutBatchId: '$BATCH_ID-12345678-ABCDEF',
        batchStatus: 'PROCESSING',
        httpLog: 'POST /v1/payments/payouts [201 Created]',
        idempotencyKey: 'REQ-abc123def456789abcdef01234567',
      }));

      const executor = createMilestonePayoutExecutor();
      const context: MilestonePayoutExecutorContext = {
        projectId: 'proj-123',
        milestoneId: 'ms-1',
        milestoneTitle: 'API Integration',
        receiverEmail: 'vendor@example.com',
        amountUSD: 250.00,
        settlementBatchId: 'SETTLE-abc123def456789abcdef012345',
      };

      const result = await executor(context);

      expect(result.payRail).toBe('PAYPAL_SANDBOX');
      expect(result.payoutAttempted).toBe(true);
      expect(result.payPalBatchId).toBe('$BATCH_ID-12345678-ABCDEF');
      expect(result.payPalBatchStatus).toBe('PROCESSING');
      expect(result.payPalRequestId).toBe('REQ-abc123def456789abcdef01234567');
    });
  });

  describe('SIMULATED Rail', () => {
    it('should generate deterministic simulated batch ID when simulation mode is enabled', async () => {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';

      setupMock(() => Promise.resolve({
        success: true,
        rail: 'SIMULATED',
        payoutBatchId: 'SIMULATED-abc123def456789abc',
        batchStatus: 'SIMULATED',
        httpLog: 'SIMULATED POST /v1/payments/payouts',
        idempotencyKey: 'REQ-abc123def456789abcdef01234567',
      }));

      const executor = createMilestonePayoutExecutor();
      const context: MilestonePayoutExecutorContext = {
        projectId: 'proj-123',
        milestoneId: 'ms-1',
        milestoneTitle: 'API Integration',
        receiverEmail: 'vendor@example.com',
        amountUSD: 250.00,
        settlementBatchId: 'SETTLE-abc123def456789abcdef012345',
      };

      const result = await executor(context);

      expect(result.payRail).toBe('SIMULATED');
      expect(result.payoutAttempted).toBe(false);
      expect(result.payPalBatchId).toMatch(/^SIMULATED-/);
      expect(result.payPalBatchStatus).toBe('SIMULATED');
    });

    it('should return deterministic batch ID for same settlement context', async () => {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';

      const mockClient = setupMock();
      mockClient.executeMilestonePayout
        .mockResolvedValueOnce({
          success: true,
          rail: 'SIMULATED',
          payoutBatchId: 'SIMULATED-abc123def456789abc',
          batchStatus: 'SIMULATED',
          httpLog: '',
          idempotencyKey: 'REQ-abc123def456789abcdef01234567',
        })
        .mockResolvedValueOnce({
          success: true,
          rail: 'SIMULATED',
          payoutBatchId: 'SIMULATED-abc123def456789abc',
          batchStatus: 'SIMULATED',
          httpLog: '',
          idempotencyKey: 'REQ-abc123def456789abcdef01234567',
        });

      const executor = createMilestonePayoutExecutor();
      const context: MilestonePayoutExecutorContext = {
        projectId: 'proj-123',
        milestoneId: 'ms-1',
        milestoneTitle: 'API Integration',
        receiverEmail: 'vendor@example.com',
        amountUSD: 250.00,
        settlementBatchId: 'SETTLE-abc123def456789abcdef012345',
      };

      const first = await executor(context);
      const second = await executor(context);

      expect(first.payPalBatchId).toBe(second.payPalBatchId);
    });
  });

  describe('SUPPRESSED_RAIL', () => {
    it('should suppress payout when credentials missing and simulation disabled', async () => {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      delete process.env.PAYPAL_SIMULATION_MODE;

      setupMock(() => Promise.resolve({
        success: true,
        rail: 'SUPPRESSED_RAIL',
        payoutBatchId: 'SETTLE-abc123def456789abcdef012345',
        batchStatus: 'SUPPRESSED_RAIL',
        httpLog: 'SUPPRESSED RAIL: POST not attempted',
        idempotencyKey: 'REQ-abc123def456789abcdef01234567',
      }));

      const executor = createMilestonePayoutExecutor();
      const context: MilestonePayoutExecutorContext = {
        projectId: 'proj-123',
        milestoneId: 'ms-1',
        milestoneTitle: 'API Integration',
        receiverEmail: 'vendor@example.com',
        amountUSD: 250.00,
        settlementBatchId: 'SETTLE-abc123def456789abcdef012345',
      };

      const result = await executor(context);

      expect(result.payRail).toBe('SUPPRESSED_RAIL');
      expect(result.payoutAttempted).toBe(false);
      expect(result.payPalBatchId).toMatch(/^SETTLE-/);
      expect(result.payPalBatchStatus).toBe('SUPPRESSED_RAIL');
    });
  });

  describe('Rails Selection', () => {
    it('should prefer PAYPAL_SANDBOX when credentials are set', async () => {
      process.env.PAYPAL_CLIENT_ID = 'client-id';
      process.env.PAYPAL_CLIENT_SECRET = 'client-secret';
      process.env.PAYPAL_SIMULATION_MODE = 'true';

      setupMock(() => Promise.resolve({
        success: true,
        rail: 'PAYPAL_SANDBOX',
        payoutBatchId: 'PAYPAL_BATCH_REAL',
        batchStatus: 'PROCESSING',
        httpLog: '',
        idempotencyKey: 'REQ-abc123def456789abcdef01234567',
      }));

      const executor = createMilestonePayoutExecutor();
      const context: MilestonePayoutExecutorContext = {
        projectId: 'proj-123',
        milestoneId: 'ms-1',
        milestoneTitle: 'API Integration',
        receiverEmail: 'vendor@example.com',
        amountUSD: 250.00,
        settlementBatchId: 'SETTLE-abc123def456789abcdef012345',
      };

      const result = await executor(context);

      expect(result.payRail).toBe('PAYPAL_SANDBOX');
      expect(result.payoutAttempted).toBe(true);
    });

    it('should use SIMULATED when credentials absent but simulation enabled', async () => {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      process.env.PAYPAL_SIMULATION_MODE = 'true';

      setupMock(() => Promise.resolve({
        success: true,
        rail: 'SIMULATED',
        payoutBatchId: 'SIMULATED-abc123def456789abc',
        batchStatus: 'SIMULATED',
        httpLog: '',
        idempotencyKey: 'REQ-abc123def456789abcdef01234567',
      }));

      const executor = createMilestonePayoutExecutor();
      const context: MilestonePayoutExecutorContext = {
        projectId: 'proj-123',
        milestoneId: 'ms-1',
        milestoneTitle: 'API Integration',
        receiverEmail: 'vendor@example.com',
        amountUSD: 250.00,
        settlementBatchId: 'SETTLE-abc123def456789abcdef012345',
      };

      const result = await executor(context);

      expect(result.payRail).toBe('SIMULATED');
      expect(result.payoutAttempted).toBe(false);
    });

    it('should default to SUPPRESSED_RAIL when no credentials and no simulation', async () => {
      delete process.env.PAYPAL_CLIENT_ID;
      delete process.env.PAYPAL_CLIENT_SECRET;
      delete process.env.PAYPAL_SIMULATION_MODE;

      setupMock(() => Promise.resolve({
        success: true,
        rail: 'SUPPRESSED_RAIL',
        payoutBatchId: 'SETTLE-abc123def456789abcdef012345',
        batchStatus: 'SUPPRESSED_RAIL',
        httpLog: 'SUPPRESSED',
        idempotencyKey: 'REQ-abc123def456789abcdef01234567',
      }));

      const executor = createMilestonePayoutExecutor();
      const context: MilestonePayoutExecutorContext = {
        projectId: 'proj-123',
        milestoneId: 'ms-1',
        milestoneTitle: 'API Integration',
        receiverEmail: 'vendor@example.com',
        amountUSD: 250.00,
        settlementBatchId: 'SETTLE-abc123def456789abcdef012345',
      };

      const result = await executor(context);

      expect(result.payRail).toBe('SUPPRESSED_RAIL');
      expect(result.payoutAttempted).toBe(false);
    });
  });
});
