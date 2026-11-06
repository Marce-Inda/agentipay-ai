/**
 * Integration Test Helpers
 * 
 * Reusable utilities for settlement integration tests:
 * - Test data builders (projects, milestones, envelopes)
 * - Settlement verification helpers
 * - Mock setup utilities
 */

import type { BudgetEnvelope, ProjectContract } from '@/lib/types';

/**
 * Creates a test project with default values for settlement testing.
 * 
 * @param overrides - Partial project configuration to override defaults
 * @returns Complete project contract
 */
export function makeProject(overrides: Partial<ProjectContract> = {}): ProjectContract {
  return {
    id: 'proj-settle-test',
    name: 'Integration Test Project',
    vendorName: 'Vendor LLC',
    vendorEmail: 'vendor@example.com',
    clientEmail: 'client@example.com',
    budgetCapUSD: 5000,
    spentUSD: 0,
    status: 'ACTIVE',
    perspective: 'OUTGOING',
    milestones: [
      {
        id: 'ms-settle-1',
        phaseNumber: 1,
        title: 'Phase 1: Integration',
        description: 'Settlement integration test',
        amountUSD: 250,
        status: 'AUDITED_PENDING_APPROVAL',
        auditScore: 95,
        acceptanceCriteria: 'Passing tests',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a test budget envelope with default values for settlement testing.
 * 
 * @param overrides - Partial envelope configuration to override defaults
 * @returns Complete budget envelope
 */
export function makeEnvelope(overrides: Partial<BudgetEnvelope> = {}): BudgetEnvelope {
  return {
    maxPerTransactionUSD: 1000,
    dailyCeilingUSD: 5000,
    spentTodayUSD: 0,
    activeEscrowUSD: 0,
    killSwitchActive: false,
    ...overrides,
  };
}

/**
 * Enables SIMULATED PayPal mode for testing.
 * Disables real PayPal credentials and enables simulation mode.
 * 
 * @returns Function to restore environment variables
 */
export function enableSimulatedPayPal(): () => void {
  const originalClientId = process.env.PAYPAL_CLIENT_ID;
  const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const originalMode = process.env.PAYPAL_SIMULATION_MODE;

  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  process.env.PAYPAL_SIMULATION_MODE = 'true';

  return () => {
    if (originalClientId) process.env.PAYPAL_CLIENT_ID = originalClientId;
    else delete process.env.PAYPAL_CLIENT_ID;

    if (originalClientSecret) process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;
    else delete process.env.PAYPAL_CLIENT_SECRET;

    if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
    else delete process.env.PAYPAL_SIMULATION_MODE;
  };
}

/**
 * Disables all PayPal modes (suppressed rail mode).
 * Useful for testing fail-closed behavior.
 * 
 * @returns Function to restore environment variables
 */
export function disableAllPayPal(): () => void {
  const originalClientId = process.env.PAYPAL_CLIENT_ID;
  const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const originalMode = process.env.PAYPAL_SIMULATION_MODE;

  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.PAYPAL_SIMULATION_MODE;

  return () => {
    if (originalClientId) process.env.PAYPAL_CLIENT_ID = originalClientId;
    if (originalClientSecret) process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;
    if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
  };
}

/**
 * Configures real PayPal credentials for testing.
 * Enables the PAYPAL_SANDBOX rail.
 * 
 * @returns Function to restore environment variables
 */
export function enableRealPayPal(): () => void {
  const originalClientId = process.env.PAYPAL_CLIENT_ID;
  const originalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const originalMode = process.env.PAYPAL_SIMULATION_MODE;

  process.env.PAYPAL_CLIENT_ID = 'test-id';
  process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
  delete process.env.PAYPAL_SIMULATION_MODE;

  return () => {
    if (originalClientId) process.env.PAYPAL_CLIENT_ID = originalClientId;
    else delete process.env.PAYPAL_CLIENT_ID;

    if (originalClientSecret) process.env.PAYPAL_CLIENT_SECRET = originalClientSecret;
    else delete process.env.PAYPAL_CLIENT_SECRET;

    if (originalMode) process.env.PAYPAL_SIMULATION_MODE = originalMode;
  };
}

/**
 * Settlement verification helper: checks that a milestone is marked as COMPLETED.
 * 
 * @param project - The project contract to check
 * @param milestoneId - The milestone ID to verify
 * @returns true if milestone status is COMPLETED
 */
export function verifyMilestoneCompleted(project: any, milestoneId: string): boolean {
  return project?.milestones?.some(
    (m: any) => m.id === milestoneId && m.status === 'COMPLETED'
  ) ?? false;
}

/**
 * Settlement verification helper: checks that milestone is in original state.
 * 
 * @param project - The project contract to check
 * @param milestoneId - The milestone ID to verify
 * @returns true if milestone status is AUDITED_PENDING_APPROVAL
 */
export function verifyMilestonePending(project: any, milestoneId: string): boolean {
  return project?.milestones?.some(
    (m: any) => m.id === milestoneId && m.status === 'AUDITED_PENDING_APPROVAL'
  ) ?? false;
}

/**
 * Settlement verification helper: checks that project spend was updated.
 * 
 * @param projectSpent - Current project spend in USD
 * @param expectedAmount - Expected amount in USD
 * @returns true if spend matches expected amount
 */
export function verifyProjectSpentUpdated(projectSpent: number, expectedAmount: number): boolean {
  return Math.abs(projectSpent - expectedAmount) < 0.01; // Account for floating point
}

/**
 * Settlement verification helper: checks that envelope spend was updated.
 * 
 * @param envelopeSpent - Current daily envelope spend in USD
 * @param expectedAmount - Expected amount in USD
 * @returns true if spend matches expected amount
 */
export function verifyEnvelopeSpentUpdated(envelopeSpent: number, expectedAmount: number): boolean {
  return Math.abs(envelopeSpent - expectedAmount) < 0.01; // Account for floating point
}

/**
 * Mock PayPal OAuth response builder.
 * Creates a mock Response object for successful OAuth2 token endpoint.
 * 
 * @param token - Access token to return
 * @param expiresIn - Token expiry in seconds
 * @returns Mock Response object
 */
export function mockPayPalOAuthSuccess(
  token: string = 'access_token_test_123',
  expiresIn: number = 3600
): Response {
  return new Response(
    JSON.stringify({ access_token: token, token_type: 'Bearer', expires_in: expiresIn }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

/**
 * Mock PayPal OAuth failure response builder.
 * Creates a mock Response object for failed OAuth2 token endpoint.
 * 
 * @param errorCode - OAuth error code
 * @param errorDescription - Human-readable error description
 * @returns Mock Response object
 */
export function mockPayPalOAuthFailure(
  errorCode: string = 'invalid_client',
  errorDescription: string = 'Client authentication failed'
): Response {
  return new Response(
    JSON.stringify({ error: errorCode, error_description: errorDescription }),
    { status: 401, headers: { 'content-type': 'application/json' } }
  );
}

/**
 * Mock PayPal Payouts success response builder.
 * Creates a mock Response object for successful Payouts API call.
 * 
 * @param batchId - PayPal batch ID to return
 * @param batchStatus - PayPal batch status
 * @returns Mock Response object
 */
export function mockPayPalPayoutSuccess(
  batchId: string = 'PAYPAL_BATCH_TEST_001',
  batchStatus: string = 'PROCESSING'
): Response {
  return new Response(
    JSON.stringify({
      batch_header: {
        payout_batch_id: batchId,
        batch_status: batchStatus,
      },
    }),
    { status: 201, headers: { 'content-type': 'application/json' } }
  );
}

/**
 * Mock PayPal Payouts failure response builder.
 * Creates a mock Response object for failed Payouts API call.
 * 
 * @param issue - PayPal error issue code
 * @param description - Error description
 * @returns Mock Response object
 */
export function mockPayPalPayoutFailure(
  issue: string = 'INSUFFICIENT_FUNDS',
  description: string = 'Account balance is insufficient'
): Response {
  return new Response(
    JSON.stringify({
      errors: [
        {
          issue,
          description,
        },
      ],
    }),
    { status: 400, headers: { 'content-type': 'application/json' } }
  );
}

/**
 * Assertion helper: verifies that a settlement succeeded.
 * 
 * @param result - Settlement result object
 * @throws if result indicates failure
 */
export function assertSettlementSuccess(result: any): void {
  if (!result.ok) {
    throw new Error(
      `Settlement failed: ${result.status} - ${result.error}. Expected success.`
    );
  }
}

/**
 * Assertion helper: verifies that a settlement failed with expected status.
 * 
 * @param result - Settlement result object
 * @param expectedStatus - Expected HTTP status code
 * @throws if result indicates success or wrong status
 */
export function assertSettlementFailed(result: any, expectedStatus: number): void {
  if (result.ok) {
    throw new Error(`Settlement succeeded unexpectedly. Expected status ${expectedStatus}.`);
  }
  if (result.status !== expectedStatus) {
    throw new Error(
      `Settlement failed with wrong status: ${result.status}. Expected ${expectedStatus}.`
    );
  }
}

/**
 * Assertion helper: verifies that no partial state mutation occurred.
 * Checks that project and envelope state is consistent.
 * 
 * @param project - Current project state
 * @param envelope - Current envelope state
 * @param expectedSpent - Expected total spend (in both project and envelope)
 * @throws if state is inconsistent
 */
export function assertNoPartialMutation(
  project: any,
  envelope: any,
  expectedSpent: number = 0
): void {
  const projectSpent = project?.spentUSD ?? 0;
  const envelopeSpent = envelope?.spentTodayUSD ?? 0;

  if (!verifyProjectSpentUpdated(projectSpent, expectedSpent)) {
    throw new Error(`Project spend mismatch: ${projectSpent} !== ${expectedSpent}`);
  }

  if (!verifyEnvelopeSpentUpdated(envelopeSpent, expectedSpent)) {
    throw new Error(`Envelope spend mismatch: ${envelopeSpent} !== ${expectedSpent}`);
  }

  if (projectSpent !== envelopeSpent) {
    throw new Error(
      `Project and envelope spend mismatch: ${projectSpent} !== ${envelopeSpent}`
    );
  }
}
