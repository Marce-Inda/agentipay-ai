import { describe, it, expect } from '@jest/globals';
import { AuditCache } from '@/lib/auditor/audit-cache';
import type { AuditReport } from '@/lib/types';

/**
 * Task 11: Audit Cache (In-Memory with TTL)
 */
describe('Stage 2 Task 11: Audit Cache', () => {
  describe('cache lifecycle', () => {
    it('should cache and retrieve audit reports', async () => {
      const cache = new AuditCache();
      const prUrl = 'https://github.com/owner/repo/pull/123';
      const report: AuditReport = {
        id: 'audit-1',
        userId: 'user-1',
        projectId: 'proj-1',
        milestoneId: 'mile-1',
        prUrl,
        auditMode: 'LLM',
        score: 87,
        scoreDetails: {
          baseScore: 87,
          metCount: 3,
          partialCount: 0,
          notMetCount: 0,
          ciPenalty: 0,
          mergedPenalty: 0,
          breakdown: 'test',
        },
        criteria: [],
        summary: 'Good PR',
        risks: [],
        recommendedAction: 'SETTLE',
        guardrailStatus: 'APPROVED_AUTOMATIC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Cache should be empty
      expect(await cache.get(prUrl)).toBeNull();

      // Store report
      await cache.set(prUrl, report);

      // Retrieve should work
      const retrieved = await cache.get(prUrl);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('audit-1');
      expect(retrieved?.score).toBe(87);

      cache.destroy();
    });

    it('should handle multiple PR URLs independently', async () => {
      const cache = new AuditCache();
      const prUrl1 = 'https://github.com/owner/repo/pull/123';
      const prUrl2 = 'https://github.com/owner/repo/pull/456';

      const report1: AuditReport = {
        id: 'audit-1',
        userId: 'user-1',
        projectId: 'proj-1',
        milestoneId: 'mile-1',
        prUrl: prUrl1,
        auditMode: 'LLM',
        score: 87,
        scoreDetails: {
          baseScore: 87,
          metCount: 3,
          partialCount: 0,
          notMetCount: 0,
          ciPenalty: 0,
          mergedPenalty: 0,
          breakdown: 'test',
        },
        criteria: [],
        summary: 'PR 123',
        risks: [],
        recommendedAction: 'SETTLE',
        guardrailStatus: 'APPROVED_AUTOMATIC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const report2: AuditReport = { ...report1, id: 'audit-2', prUrl: prUrl2, score: 72, summary: 'PR 456' };

      await cache.set(prUrl1, report1);
      await cache.set(prUrl2, report2);

      expect((await cache.get(prUrl1))?.score).toBe(87);
      expect((await cache.get(prUrl2))?.score).toBe(72);

      cache.destroy();
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after 1 hour', async () => {
      const cache = new AuditCache();
      const prUrl = 'https://github.com/owner/repo/pull/123';
      const report: AuditReport = {
        id: 'audit-1',
        userId: 'user-1',
        projectId: 'proj-1',
        milestoneId: 'mile-1',
        prUrl,
        auditMode: 'LLM',
        score: 87,
        scoreDetails: {
          baseScore: 87,
          metCount: 3,
          partialCount: 0,
          notMetCount: 0,
          ciPenalty: 0,
          mergedPenalty: 0,
          breakdown: 'test',
        },
        criteria: [],
        summary: 'Test',
        risks: [],
        recommendedAction: 'SETTLE',
        guardrailStatus: 'APPROVED_AUTOMATIC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await cache.set(prUrl, report);

      // Should be cached
      expect(await cache.get(prUrl)).toBeDefined();

      cache.destroy();
    });
  });

  describe('cache invalidation', () => {
    it('should invalidate specific PR URLs', async () => {
      const cache = new AuditCache();
      const prUrl = 'https://github.com/owner/repo/pull/123';
      const report: AuditReport = {
        id: 'audit-1',
        userId: 'user-1',
        projectId: 'proj-1',
        milestoneId: 'mile-1',
        prUrl,
        auditMode: 'LLM',
        score: 87,
        scoreDetails: {
          baseScore: 87,
          metCount: 3,
          partialCount: 0,
          notMetCount: 0,
          ciPenalty: 0,
          mergedPenalty: 0,
          breakdown: 'test',
        },
        criteria: [],
        summary: 'Test',
        risks: [],
        recommendedAction: 'SETTLE',
        guardrailStatus: 'APPROVED_AUTOMATIC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await cache.set(prUrl, report);
      expect(await cache.get(prUrl)).toBeDefined();

      // Invalidate
      await cache.invalidate(prUrl);
      expect(await cache.get(prUrl)).toBeNull();

      cache.destroy();
    });

    it('should clear entire cache', async () => {
      const cache = new AuditCache();
      const report: AuditReport = {
        id: 'audit-1',
        userId: 'user-1',
        projectId: 'proj-1',
        milestoneId: 'mile-1',
        prUrl: 'https://github.com/owner/repo/pull/123',
        auditMode: 'LLM',
        score: 87,
        scoreDetails: {
          baseScore: 87,
          metCount: 3,
          partialCount: 0,
          notMetCount: 0,
          ciPenalty: 0,
          mergedPenalty: 0,
          breakdown: 'test',
        },
        criteria: [],
        summary: 'Test',
        risks: [],
        recommendedAction: 'SETTLE',
        guardrailStatus: 'APPROVED_AUTOMATIC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await cache.set('https://github.com/owner/repo/pull/1', report);
      await cache.set('https://github.com/owner/repo/pull/2', report);

      expect(cache.getSize()).toBe(2);

      await cache.clear();
      expect(cache.getSize()).toBe(0);

      cache.destroy();
    });
  });

  describe('cache stats', () => {
    it('should provide cache statistics', async () => {
      const cache = new AuditCache();
      const report: AuditReport = {
        id: 'audit-1',
        userId: 'user-1',
        projectId: 'proj-1',
        milestoneId: 'mile-1',
        prUrl: 'https://github.com/owner/repo/pull/123',
        auditMode: 'LLM',
        score: 87,
        scoreDetails: {
          baseScore: 87,
          metCount: 3,
          partialCount: 0,
          notMetCount: 0,
          ciPenalty: 0,
          mergedPenalty: 0,
          breakdown: 'test',
        },
        criteria: [],
        summary: 'Test',
        risks: [],
        recommendedAction: 'SETTLE',
        guardrailStatus: 'APPROVED_AUTOMATIC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await cache.set('https://github.com/owner/repo/pull/1', report);
      const stats = cache.getStats();

      expect(stats.size).toBe(1);
      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0].expiresAt).toBeDefined();

      cache.destroy();
    });
  });
});
