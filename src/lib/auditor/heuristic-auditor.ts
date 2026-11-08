import type { LLMAuditReport } from './llm-audit-generator';
import type { CIStatus } from '@/lib/types';

/**
 * HeuristicAuditor: Fallback auditor using Stage 1 heuristic rules
 * - Used when LLM is unavailable
 * - Generates verdicts based on simple static rules
 * - Always returns MANUAL_REVIEW recommendation (requires human confirmation)
 * - Marks evidence as "[heuristic evaluation]" with low confidence
 */
export class HeuristicAuditor {
  /**
   * Generate audit report using heuristic rules
   */
  generateAuditReport(
    criteria: Array<{ name: string; weight: number }>,
    fileCount: number,
    diffSize: number,
    ciStatus: CIStatus,
    merged: boolean
  ): LLMAuditReport {
    // Evaluate each criterion using heuristic rules
    const heuristicCriteria = criteria.map((c) => ({
      criterion: c.name,
      verdict: this.evaluateHeuristic(c.name, fileCount, diffSize, ciStatus, merged) as
        | 'MET'
        | 'PARTIAL'
        | 'NOT_MET',
      evidence: '[heuristic evaluation based on file count, diff size, and CI status]',
      confidence: 40, // Low confidence for heuristic evaluation
      reasoning:
        'Evaluated using heuristic rules (LLM unavailable). Actual evaluation requires human review.',
    }));

    // Count verdicts
    const metCount = heuristicCriteria.filter((c) => c.verdict === 'MET').length;
    const partialCount = heuristicCriteria.filter((c) => c.verdict === 'PARTIAL').length;
    const notMetCount = heuristicCriteria.filter((c) => c.verdict === 'NOT_MET').length;

    // Build risk list
    const risks: string[] = [];
    if (ciStatus === 'failure') risks.push('CI failed');
    if (!merged) risks.push('PR not merged');
    risks.push('Heuristic evaluation - LLM unavailable');

    return {
      criteria: heuristicCriteria,
      summary: `Heuristic evaluation: ${metCount} MET, ${partialCount} PARTIAL, ${notMetCount} NOT_MET. ` +
        `Files: ${fileCount}, Diff: ${diffSize} bytes. CI: ${ciStatus}. ` +
        `This is a fallback evaluation. Requires manual review before settlement.`,
      risks,
      recommendedAction: 'MANUAL_REVIEW', // Always require manual review for heuristic
    };
  }

  /**
   * Heuristic verdict evaluation based on activity metrics
   */
  private evaluateHeuristic(
    criterion: string,
    fileCount: number,
    diffSize: number,
    ciStatus: CIStatus,
    merged: boolean
  ): string {
    // Rule 1: If CI failed or PR not merged, assume NOT_MET
    if (ciStatus === 'failure' || !merged) {
      return 'NOT_MET';
    }

    // Rule 2: If no files changed, probably NOT_MET
    if (fileCount === 0) {
      return 'NOT_MET';
    }

    // Rule 3: If substantial changes (>5KB diff), likely MET
    if (diffSize > 5000) {
      return 'MET';
    }

    // Rule 4: If moderate changes (>1KB diff), likely PARTIAL
    if (diffSize > 1000) {
      return 'PARTIAL';
    }

    // Rule 5: If small changes, probably NOT_MET
    if (diffSize > 0) {
      return 'PARTIAL';
    }

    // Default: NOT_MET
    return 'NOT_MET';
  }
}
