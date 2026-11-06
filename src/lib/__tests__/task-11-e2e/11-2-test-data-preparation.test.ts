/**
 * Task 11.2: Test Data Preparation
 * 
 * Creates all necessary test data for E2E settlement verification:
 * - Test user account
 * - Test contract with $5,000 budget cap
 * - Test milestone ($250 USD)
 * - Pre-populate with passing audit (score >= 85%)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getRepository } from '@/lib/db/repository';
import type { AgenticPayRepository } from '@/lib/db/repository';
import type { ProjectContract, BudgetEnvelope } from '@/lib/types';
import { createHash } from 'node:crypto';

describe('Task 11.2: Test Data Preparation', () => {
  let repository: AgenticPayRepository;
  let testUserId: string;
  let testProjectId: string;
  let testMilestoneId: string;

  beforeAll(async () => {
    repository = getRepository();
    
    console.log('\n=== Task 11.2: Test Data Preparation ===');
    console.log('Creating test data for E2E settlement verification...\n');
  });

  afterAll(async () => {
    // Close repository connection if needed
    // Note: In a real E2E test, you might want to keep the data for manual verification
  });

  it('should create test user account', async () => {
    const testEmail = `e2e-test-${Date.now()}@agenticpay.test`;
    
    try {
      const user = await repository.createUser({
        email: testEmail,
        passwordHash: createHash('sha256').update('test-password-123').digest('hex'),
        displayName: 'E2E Test User',
      });

      testUserId = user.id;

      console.log('✅ Test User Created');
      console.log(`   User ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Display Name: ${user.displayName}`);

      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.displayName).toBe('E2E Test User');
    } catch (error) {
      // User might already exist, try to find by email
      const existingUser = await repository.findUserByEmail(`e2e-test-${Date.now()}@agenticpay.test`);
      if (existingUser) {
        testUserId = existingUser.id;
        console.log('ℹ️  Using existing test user');
      } else {
        throw error;
      }
    }
  });

  it('should create test contract with $5,000 budget cap', async () => {
    testProjectId = `proj-e2e-${Date.now()}`;
    testMilestoneId = `ms-e2e-${Date.now()}`;

    const testProject: ProjectContract = {
      id: testProjectId,
      name: 'E2E Settlement Test Project',
      vendorName: 'AgenticPay E2E Test Vendor',
      vendorEmail: 'vendor-e2e@sandbox.paypal.test',
      clientEmail: 'client-e2e@sandbox.paypal.test',
      budgetCapUSD: 5000,
      spentUSD: 0,
      status: 'ACTIVE',
      perspective: 'OUTGOING',
      milestones: [
        {
          id: testMilestoneId,
          phaseNumber: 1,
          title: 'Phase 1: Settlement Verification Milestone',
          description: 'Test milestone for E2E settlement verification ($250 USD)',
          amountUSD: 250,
          status: 'AUDITED_PENDING_APPROVAL',
          auditScore: 92,  // >= 85% requirement
          acceptanceCriteria: 'E2E test verification complete',
        },
      ],
    };

    const project = await repository.upsertProject(testUserId, testProject);

    console.log('\n✅ Test Contract Created');
    console.log(`   Project ID: ${project.id}`);
    console.log(`   Budget Cap: $${project.budgetCapUSD} USD`);
    console.log(`   Spent: $${project.spentUSD} USD`);
    console.log(`   Status: ${project.status}`);
    console.log(`   Perspective: ${project.perspective}`);

    expect(project.id).toBe(testProjectId);
    expect(project.budgetCapUSD).toBe(5000);
    expect(project.status).toBe('ACTIVE');
    expect(project.perspective).toBe('OUTGOING');
  });

  it('should create test milestone with $250 USD and passing audit', async () => {
    const project = await repository.getProject(testUserId, testProjectId);
    expect(project).toBeDefined();
    
    const milestone = project!.milestones[0];

    console.log('\n✅ Test Milestone Created');
    console.log(`   Milestone ID: ${milestone.id}`);
    console.log(`   Amount: $${milestone.amountUSD} USD`);
    console.log(`   Status: ${milestone.status}`);
    console.log(`   Audit Score: ${milestone.auditScore}%`);
    console.log(`   Title: ${milestone.title}`);

    expect(milestone.amountUSD).toBe(250);
    expect(milestone.status).toBe('AUDITED_PENDING_APPROVAL');
    expect(milestone.auditScore).toBeGreaterThanOrEqual(85);
  });

  it('should create budget envelope with appropriate guardrails', async () => {
    const envelope: BudgetEnvelope = {
      maxPerTransactionUSD: 1000,
      dailyCeilingUSD: 5000,
      spentTodayUSD: 0,
      activeEscrowUSD: 0,
      killSwitchActive: false,
    };

    const savedEnvelope = await repository.upsertEnvelope(testUserId, envelope);

    console.log('\n✅ Budget Envelope Created');
    console.log(`   Max Per Transaction: $${savedEnvelope.maxPerTransactionUSD} USD`);
    console.log(`   Daily Ceiling: $${savedEnvelope.dailyCeilingUSD} USD`);
    console.log(`   Spent Today: $${savedEnvelope.spentTodayUSD} USD`);
    console.log(`   Active Escrow: $${savedEnvelope.activeEscrowUSD} USD`);
    console.log(`   Kill Switch: ${savedEnvelope.killSwitchActive ? 'ACTIVE' : 'INACTIVE'}`);

    expect(savedEnvelope.maxPerTransactionUSD).toBe(1000);
    expect(savedEnvelope.dailyCeilingUSD).toBe(5000);
    expect(savedEnvelope.killSwitchActive).toBe(false);
  });

  it('should verify all test data is ready for settlement', async () => {
    const project = await repository.getProject(testUserId, testProjectId);
    const envelope = await repository.getEnvelope(testUserId);

    expect(project).toBeDefined();
    expect(envelope).toBeDefined();

    const milestone = project!.milestones[0];

    console.log('\n=== Settlement Readiness Verification ===');
    console.log(`✅ Project ready: ${project!.status === 'ACTIVE' ? 'YES' : 'NO'}`);
    console.log(`✅ Milestone amount ($${milestone.amountUSD}) <= budget remaining ($${project!.budgetCapUSD - project!.spentUSD}): YES`);
    console.log(`✅ Milestone audit score (${milestone.auditScore}%) >= 85%: ${milestone.auditScore! >= 85 ? 'YES' : 'NO'}`);
    console.log(`✅ Milestone status is AUDITED_PENDING_APPROVAL: ${milestone.status === 'AUDITED_PENDING_APPROVAL' ? 'YES' : 'NO'}`);
    console.log(`✅ Budget envelope configured: YES`);

    console.log('\n=== Test Data Summary ===');
    console.log(`User ID: ${testUserId}`);
    console.log(`Project ID: ${testProjectId}`);
    console.log(`Milestone ID: ${testMilestoneId}`);
    console.log(`Amount: $250 USD`);
    console.log(`Audit Score: ${milestone.auditScore}%`);
    console.log(`Budget Cap: $${project!.budgetCapUSD} USD`);
    console.log(`Max Per Transaction: $${envelope!.maxPerTransactionUSD} USD`);

    // All readiness checks
    expect(project!.status).toBe('ACTIVE');
    expect(milestone.amountUSD).toBeLessThanOrEqual(project!.budgetCapUSD - project!.spentUSD);
    expect(milestone.auditScore).toBeGreaterThanOrEqual(85);
    expect(milestone.status).toBe('AUDITED_PENDING_APPROVAL');
    expect(envelope!.killSwitchActive).toBe(false);
  });
});
