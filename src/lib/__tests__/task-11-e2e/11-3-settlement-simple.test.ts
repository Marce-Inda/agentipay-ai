/**
 * Task 11.3: Live Settlement Execution (Simple)
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { getRepository } from '@/lib/db/repository';
import { createMilestonePayoutExecutor } from '@/lib/paypal/executor';
import type { AgenticPayRepository } from '@/lib/db/repository';
import { createHash } from 'node:crypto';

describe('Task 11.3: Simple Settlement', () => {
  let repository: AgenticPayRepository;
  let testUserId: string;
  let testProjectId: string;

  beforeAll(async () => {
    repository = getRepository();
    const user = await repository.createUser({
      email: `settle-${Date.now()}@test.com`,
      passwordHash: createHash('sha256').update('pass').digest('hex'),
    });
    testUserId = user.id;
    testProjectId = `proj-${Date.now()}`;

    const project = {
      id: testProjectId,
      name: 'Settlement Test',
      vendorName: 'Vendor',
      vendorEmail: 'v@test.com',
      clientEmail: 'c@test.com',
      budgetCapUSD: 5000,
      spentUSD: 0,
      status: 'ACTIVE' as const,
      perspective: 'OUTGOING' as const,
      milestones: [
        {
          id: 'm1',
          phaseNumber: 1,
          title: 'Test',
          description: 'Test',
          amountUSD: 250,
          status: 'AUDITED_PENDING_APPROVAL' as const,
          auditScore: 92,
          acceptanceCriteria: 'Test',
        },
      ],
    };

    await repository.upsertProject(testUserId, project);
    await repository.upsertEnvelope(testUserId, {
      maxPerTransactionUSD: 1000,
      dailyCeilingUSD: 5000,
      spentTodayUSD: 0,
      activeEscrowUSD: 0,
      killSwitchActive: false,
    });
  });

  it('executes settlement', async () => {
    const result = await repository.settleWithTransaction(
      testUserId,
      testProjectId,
      'm1',
      createMilestonePayoutExecutor(),
      false
    );
    expect(result.ok).toBe(true);
  });
});
