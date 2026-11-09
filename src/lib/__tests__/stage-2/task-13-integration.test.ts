import { describe, it, expect } from '@jest/globals';
import { GitHubEvidenceExtractor } from '@/lib/github/evidence-extractor';
import { ScoreCalculator } from '@/lib/auditor/score-calculator';
import { GuardrailEngine } from '@/lib/auditor/guardrail-engine';
import { PartialReleaseCalculator } from '@/lib/auditor/partial-release-calculator';
import { HeuristicAuditor } from '@/lib/auditor/heuristic-auditor';
import { EvidenceSanitizer } from '@/lib/security/sanitizer';
import { AuditCache } from '@/lib/auditor/audit-cache';

/**
 * Task 13: Integration Tests
 * End-to-end audit flow: PR URL → evidence → audit → score → guardrail → settlement
 */
describe('Stage 2 Task 13: End-to-End Integration Tests', () => {
  describe('complete audit flow', () => {
    it('should execute full audit flow: parsing → scoring → guardrails', () => {
      // Step 1: Parse GitHub PR URL
      const extractor = new GitHubEvidenceExtractor();
      const prUrl = 'https://github.com/owner/repo/pull/123';

      const parsed = extractor.parseGitHubUrl(prUrl);
      expect(parsed.owner).toBe('owner');
      expect(parsed.repo).toBe('repo');
      expect(parsed.prNumber).toBe(123);

      // Step 2: Simulate evidence extraction
      const evidence = {
        title: 'Implement feature X',
        description: 'Adds feature X as per milestone requirements',
        files: [
          { name: 'main.ts', path: 'src/main.ts', status: 'modified' as const },
          { name: 'test.ts', path: 'src/test.ts', status: 'added' as const },
        ],
        diff: '+// Added feature X\n+export function featureX() {}',
        ciStatus: 'success' as const,
        merged: true,
        url: prUrl,
      };

      // Step 3: Sanitize evidence
      const sanitized = EvidenceSanitizer.sanitizeEvidence(evidence.diff);
      expect(sanitized).not.toContain('<script>');

      // Step 4: Generate verdicts (simulated heuristic)
      const auditor = new HeuristicAuditor();
      const auditReport = auditor.generateAuditReport(
        [
          { name: 'Code quality', weight: 2 },
          { name: 'Test coverage', weight: 1 },
          { name: 'Documentation', weight: 1 },
        ],
        evidence.files.length,
        evidence.diff.length,
        evidence.ciStatus,
        evidence.merged
      );

      expect(auditReport.criteria).toHaveLength(3);
      expect(auditReport.recommendedAction).toBe('MANUAL_REVIEW'); // Heuristic mode

      // Step 5: Calculate deterministic score
      const criteria = [
        { name: 'Code quality', verdict: 'MET' as const, weight: 2 },
        { name: 'Test coverage', verdict: 'PARTIAL' as const, weight: 1 },
        { name: 'Documentation', verdict: 'NOT_MET' as const, weight: 1 },
      ];

      const scoreResult = ScoreCalculator.calculateScore(criteria, 'success', true);
      expect(scoreResult.score).toBeGreaterThanOrEqual(0);
      expect(scoreResult.score).toBeLessThanOrEqual(100);
      expect(scoreResult.metCount).toBe(1);
      expect(scoreResult.partialCount).toBe(1);
      expect(scoreResult.notMetCount).toBe(1);

      // Step 6: Enforce guardrails
      const guardrailDecision = GuardrailEngine.evaluateGuardrail(scoreResult.score, 5000);
      expect(guardrailDecision.score_compared).toBe(true);
      expect(['APPROVED_AUTOMATIC', 'BLOCKED_LOW_SCORE', 'BLOCKED_REQUIRES_APPROVAL']).toContain(
        guardrailDecision.guardrailStatus
      );

      // Step 7: Calculate partial release if needed
      if (guardrailDecision.guardrailStatus === 'BLOCKED_REQUIRES_APPROVAL') {
        const partialRelease = PartialReleaseCalculator.calculatePartialRelease(criteria, 5000);
        expect(partialRelease.partialReleasePct).toBeGreaterThanOrEqual(0);
        expect(partialRelease.partialReleasePct).toBeLessThanOrEqual(100);
        expect(partialRelease.proportionalAmountUsd).toBeLessThanOrEqual(5000);
      }
    });

    it('should handle audit cache consistently', async () => {
      const cache = new AuditCache();
      const prUrl = 'https://github.com/owner/repo/pull/456';

      // First audit
      const report1 = {
        id: 'audit-1',
        userId: 'user-1',
        projectId: 'proj-1',
        milestoneId: 'mile-1',
        prUrl,
        auditMode: 'LLM' as const,
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
        recommendedAction: 'SETTLE' as const,
        guardrailStatus: 'APPROVED_AUTOMATIC' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await cache.set(prUrl, report1);

      // Cached retrieval should match
      const cached = await cache.get(prUrl);
      expect(cached?.score).toBe(report1.score);
      expect(cached?.guardrailStatus).toBe(report1.guardrailStatus);

      cache.destroy();
    });

    it('should handle security sanitization throughout flow', () => {
      const sensitiveEvidence = `
        Email: admin@example.com
        API Key: api_key = "sk_live_1234567890abcdefghij"
        GitHub token: ghp_1234567890123456789012345678901234
        <script>alert('xss')</script>
      `;

      // Strip sensitive data
      const stripped = EvidenceSanitizer.stripSensitiveData(sensitiveEvidence);
      expect(stripped).not.toContain('admin@example.com');
      expect(stripped).not.toContain('sk_live');
      expect(stripped).not.toContain('ghp_');

      // HTML escape
      const sanitized = EvidenceSanitizer.sanitizeEvidence(sensitiveEvidence);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('&lt;script&gt;');

      // Verify idempotency
      const sanitizedAgain = EvidenceSanitizer.sanitizeEvidence(sanitized);
      expect(sanitized).toBe(sanitizedAgain);
    });

    it('should handle score determinism across multiple runs', () => {
      const criteria = [
        { name: 'C1', verdict: 'MET' as const, weight: 2 },
        { name: 'C2', verdict: 'PARTIAL' as const, weight: 1 },
        { name: 'C3', verdict: 'NOT_MET' as const, weight: 1 },
      ];

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(ScoreCalculator.calculateScore(criteria, 'failure', false));
      }

      // All results should be identical
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBe(results[0].score);
        expect(results[i].breakdown).toBe(results[0].breakdown);
      }
    });

    it('should handle guardrail consistency', () => {
      const decisions = [];
      for (let i = 0; i < 5; i++) {
        decisions.push(GuardrailEngine.evaluateGuardrail(72, 5000));
      }

      // All decisions should be identical
      for (let i = 1; i < decisions.length; i++) {
        expect(decisions[i].guardrailStatus).toBe(decisions[0].guardrailStatus);
        expect(decisions[i].reason).toBe(decisions[0].reason);
      }
    });

    it('should handle fallback from LLM to heuristic', async () => {
      // When LLM unavailable, heuristic should take over
      const heuristic = new HeuristicAuditor();
      const report = heuristic.generateAuditReport(
        [{ name: 'Tests', weight: 1 }],
        5,
        3000,
        'success',
        true
      );

      // Should have heuristic markers
      expect(report.recommendedAction).toBe('MANUAL_REVIEW');
      expect(report.risks).toContain('Heuristic evaluation - LLM unavailable');

      // Verdicts should still be deterministic
      const report2 = heuristic.generateAuditReport(
        [{ name: 'Tests', weight: 1 }],
        5,
        3000,
        'success',
        true
      );

      expect(report.criteria[0].verdict).toBe(report2.criteria[0].verdict);
    });

    it('should handle partial release calculations', () => {
      const criteria = [
        { name: 'Feature', verdict: 'MET' as const, weight: 2 },
        { name: 'Tests', verdict: 'PARTIAL' as const, weight: 1 },
        { name: 'Docs', verdict: 'NOT_MET' as const, weight: 1 },
      ];

      const release = PartialReleaseCalculator.calculatePartialRelease(criteria, 10000);

      expect(release.partialReleasePct).toBeCloseTo(75, 0); // (2 + 1) / (2 + 1 + 1) = 75%
      expect(release.proportionalAmountUsd).toBeCloseTo(7500, 0);
      expect(release.remainingAmountUsd).toBeCloseTo(2500, 0);
      expect(release.unmetCriteria).toEqual(['Docs']);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle invalid PR URLs gracefully', () => {
      const extractor = new GitHubEvidenceExtractor();

      expect(() => {
        extractor.parseGitHubUrl('not-a-url');
      }).toThrow('Invalid GitHub PR URL format');

      expect(extractor.validatePRUrl('not-a-url')).toBe(false);
    });

    it('should reject invalid scores in guardrails', () => {
      expect(() => {
        GuardrailEngine.evaluateGuardrail(-1, 5000);
      }).toThrow('Invalid score');

      expect(() => {
        GuardrailEngine.evaluateGuardrail(101, 5000);
      }).toThrow('Invalid score');
    });

    it('should handle zero-weight scenarios by defaulting to 1', () => {
      const criteria = [
        { name: 'C1', verdict: 'MET' as const, weight: 0 },
        { name: 'C2', verdict: 'NOT_MET' as const, weight: 1 },
      ];

      // Zero weight defaults to 1, so:
      // (1*100 + 1*0) / (1 + 1) = 50
      const result = ScoreCalculator.calculateScore(criteria, 'success', true);
      expect(result.score).toBe(50);
    });

    it('should truncate extremely large evidence', () => {
      const largeEvidence = 'a'.repeat(2 * 1024 * 1024); // 2MB

      const sanitized = EvidenceSanitizer.sanitizeEvidence(largeEvidence);
      expect(sanitized.length).toBeLessThanOrEqual(1024 * 1024 + 100);
      expect(sanitized).toContain('[evidence truncated...]');
    });
  });
});
