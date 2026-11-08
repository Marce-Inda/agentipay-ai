import { describe, it, expect } from '@jest/globals';
import { HeuristicAuditor } from '@/lib/auditor/heuristic-auditor';

/**
 * Task 10: Heuristic Auditor Fallback
 */
describe('Stage 2 Task 10: Heuristic Auditor Fallback', () => {
  const auditor = new HeuristicAuditor();

  describe('generateAuditReport - mode and confidence', () => {
    it('should generate audit report with HEURISTIC mode markers', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Tests', weight: 1 }],
        5,
        6000, // 6KB - above 5KB threshold for MET
        'success',
        true
      );

      expect(report.criteria[0].confidence).toBe(40); // Low confidence for heuristic
      expect(report.criteria[0].evidence).toContain('[heuristic evaluation');
      expect(report.recommendedAction).toBe('MANUAL_REVIEW'); // Always require manual review
      expect(report.risks).toContain('Heuristic evaluation - LLM unavailable');
    });

    it('should mark CI failed as risk', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Tests', weight: 1 }],
        5,
        6000,
        'failure',
        true
      );

      expect(report.criteria[0].verdict).toBe('NOT_MET');
      expect(report.risks).toContain('CI failed');
    });

    it('should mark PR not merged as risk', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Tests', weight: 1 }],
        5,
        6000,
        'success',
        false
      );

      expect(report.risks).toContain('PR not merged');
    });
  });

  describe('generateAuditReport - heuristic verdicts', () => {
    it('should mark NOT_MET when no files changed', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Implementation', weight: 1 }],
        0,
        0,
        'success',
        true
      );

      expect(report.criteria[0].verdict).toBe('NOT_MET');
    });

    it('should mark MET for large diffs (>5KB)', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Implementation', weight: 1 }],
        10,
        6000,
        'success',
        true
      );

      expect(report.criteria[0].verdict).toBe('MET');
    });

    it('should mark PARTIAL for moderate diffs (1KB-5KB)', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Implementation', weight: 1 }],
        3,
        2000,
        'success',
        true
      );

      expect(report.criteria[0].verdict).toBe('PARTIAL');
    });

    it('should mark PARTIAL for small diffs (0-1KB)', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Implementation', weight: 1 }],
        1,
        500,
        'success',
        true
      );

      expect(report.criteria[0].verdict).toBe('PARTIAL');
    });

    it('should handle pending CI status as success', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Tests', weight: 1 }],
        5,
        6000, // 6KB - above 5KB threshold
        'pending',
        true
      );

      expect(report.criteria[0].verdict).toBe('MET'); // Treated like success
      expect(report.risks).not.toContain('CI failed');
    });

    it('should handle unknown CI status as success', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Tests', weight: 1 }],
        5,
        6000, // 6KB - above 5KB threshold
        'unknown',
        true
      );

      expect(report.criteria[0].verdict).toBe('MET');
    });
  });

  describe('generateAuditReport - verdict counts', () => {
    it('should count verdicts correctly in summary', () => {
      const report = auditor.generateAuditReport(
        [
          { name: 'C1', weight: 1 },
          { name: 'C2', weight: 1 },
          { name: 'C3', weight: 1 },
        ],
        5,
        6000,
        'success',
        true
      );

      // All large diffs should be MET
      expect(report.criteria).toHaveLength(3);
      expect(report.criteria.every((c) => c.verdict === 'MET')).toBe(true);
      expect(report.summary).toContain('3 MET');
    });

    it('should handle mixed verdicts', () => {
      const report = auditor.generateAuditReport(
        [
          { name: 'C1', weight: 1 }, // Will be MET
          { name: 'C2', weight: 1 }, // Will be MET
          { name: 'C3', weight: 1 }, // Will be MET
        ],
        5,
        6000,
        'failure', // CI failed
        true
      );

      // CI failed should make all NOT_MET
      expect(report.criteria.every((c) => c.verdict === 'NOT_MET')).toBe(true);
      expect(report.summary).toContain('3 NOT_MET');
    });
  });

  describe('generateAuditReport - info capture', () => {
    it('should include file count and diff size in summary', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Implementation', weight: 1 }],
        7,
        4500,
        'success',
        true
      );

      expect(report.summary).toContain('Files: 7');
      expect(report.summary).toContain('Diff: 4500');
    });

    it('should include CI status in summary', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Test', weight: 1 }],
        1,
        100,
        'failure',
        true
      );

      expect(report.summary).toContain('CI: failure');
    });

    it('should always indicate manual review required', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Implementation', weight: 1 }],
        10,
        10000,
        'success',
        true
      );

      expect(report.summary).toContain('manual review');
      expect(report.recommendedAction).toBe('MANUAL_REVIEW');
    });
  });

  describe('generateAuditReport - reasoning', () => {
    it('should provide consistent reasoning for heuristic verdicts', () => {
      const report = auditor.generateAuditReport(
        [{ name: 'Test', weight: 1 }],
        5,
        3000,
        'success',
        true
      );

      expect(report.criteria[0].reasoning).toContain('heuristic rules');
      expect(report.criteria[0].reasoning).toContain('LLM unavailable');
    });
  });
});
