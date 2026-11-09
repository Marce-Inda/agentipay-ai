import { z } from 'zod';
import type { GitHubEvidence, AuditCriterionResult } from '@/lib/types';

// Zod schema for LLM audit report validation
const AuditCriterionSchema = z.object({
  criterion: z.string(),
  verdict: z.enum(['MET', 'PARTIAL', 'NOT_MET']),
  evidence: z.string(),
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
});

const LLMAuditReportSchema = z.object({
  criteria: z.array(AuditCriterionSchema),
  summary: z.string(),
  risks: z.array(z.string()),
  recommendedAction: z.enum(['SETTLE', 'PARTIAL_SETTLE', 'BLOCK', 'MANUAL_REVIEW']),
});

export type LLMAuditReport = z.infer<typeof LLMAuditReportSchema>;

/**
 * LLMAuditReportGenerator: Generate structured audit reports using OpenRouter LLM
 * - Sends prompt with criteria and GitHub evidence to gpt-4o-mini via OpenRouter
 * - Enforces structured JSON output using Zod schema
 * - Validates response and auto-flags low-confidence verdicts
 * - Falls back to null if LLM unavailable or response invalid
 */
export class LLMAuditReportGenerator {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
  }

  /**
   * Check if LLM is available (API key configured)
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0;
  }

  /**
   * Generate audit report using LLM
   * Returns null if LLM unavailable or validation fails
   */
  async generateAuditReport(
    milestoneDescription: string,
    criteria: Array<{ name: string; weight: number }>,
    evidence: GitHubEvidence
  ): Promise<LLMAuditReport | null> {
    if (!this.isAvailable()) {
      console.log('LLM unavailable: OPENROUTER_API_KEY not configured');
      return null;
    }

    try {
      // Construct prompt
      const prompt = this.constructPrompt(milestoneDescription, criteria, evidence);

      // Call OPENROUTER API
      const response = await this.callOpenRouter(prompt);

      if (!response) {
        return null;
      }

      // Parse and validate with Zod
      let parsed: any;
      try {
        parsed = typeof response === 'string' ? JSON.parse(response) : response;
      } catch (e) {
        console.error('Failed to parse LLM response as JSON:', e);
        return null;
      }

      const validated = LLMAuditReportSchema.parse(parsed);

      // Auto-flag low confidence verdicts
      const flaggedReport = this.flagLowConfidence(validated);

      return flaggedReport;
    } catch (error) {
      console.error('LLM audit generation failed:', error instanceof Error ? error.message : String(error));
      return null;
    }
  }

  /**
   * Call OpenRouter API
   */
  private async callOpenRouter(prompt: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
            'HTTP-Referer': process.env.HOSTNAME || 'http://localhost:3000',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0, // Deterministic
            messages: [
              {
                role: 'user',
                content: prompt,
              },
            ],
            response_format: {
              type: 'json_schema',
              schema: this.getJsonSchema(),
            },
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          console.error(`OPENROUTER API error: ${response.status} ${response.statusText}`);
          return null;
        }

        const data = (await response.json()) as any;
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          console.error('No content in OPENROUTER response');
          return null;
        }

        return content;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('OpenRouter API call failed:', error);
      return null;
    }
  }

  /**
   * Get JSON schema for response_format
   */
  private getJsonSchema(): any {
    return {
      type: 'object',
      properties: {
        criteria: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              criterion: { type: 'string' },
              verdict: { enum: ['MET', 'PARTIAL', 'NOT_MET'] },
              evidence: { type: 'string' },
              confidence: { type: 'number', minimum: 0, maximum: 100 },
              reasoning: { type: 'string' },
            },
            required: ['criterion', 'verdict', 'evidence', 'confidence', 'reasoning'],
          },
        },
        summary: { type: 'string' },
        risks: { type: 'array', items: { type: 'string' } },
        recommendedAction: { enum: ['SETTLE', 'PARTIAL_SETTLE', 'BLOCK', 'MANUAL_REVIEW'] },
      },
      required: ['criteria', 'summary', 'risks', 'recommendedAction'],
    };
  }

  /**
   * Flag verdicts with confidence < 60% as risk
   */
  private flagLowConfidence(report: LLMAuditReport): LLMAuditReport {
    const hasLowConfidence = report.criteria.some((c) => c.confidence < 60);

    if (hasLowConfidence && !report.risks.some((r) => r.includes('confidence'))) {
      report.risks.push('Low confidence verdict (one or more verdicts below 60% confidence)');
    }

    return report;
  }

  /**
   * Construct prompt for LLM
   */
  private constructPrompt(
    milestoneDescription: string,
    criteria: Array<{ name: string; weight: number }>,
    evidence: GitHubEvidence
  ): string {
    const criteriaList = criteria.map((c, i) => `${i + 1}. ${c.name} (weight: ${c.weight})`).join('\n');

    // Limit diff to first 2000 chars to avoid token overflow
    const diffSnippet =
      evidence.diff.substring(0, 2000) + (evidence.diff.length > 2000 ? '\n[diff truncated...]' : '');

    const filesChanged = evidence.files.map((f) => `${f.path} (${f.status})`).join(', ');

    return `You are an expert code reviewer evaluating deliverables against project milestones.

**MILESTONE OBJECTIVE:**
${milestoneDescription}

**ACCEPTANCE CRITERIA:**
${criteriaList}

**GITHUB EVIDENCE:**
- PR Title: ${evidence.title}
- PR Description: ${evidence.description || '[No description provided]'}
- Files Changed: ${filesChanged || '[No files changed]'}
- CI Status: ${evidence.ciStatus}
- Merged: ${evidence.merged ? 'Yes' : 'No'}

**DIFF EXCERPT:**
\`\`\`
${diffSnippet}
\`\`\`

**TASK:**
For each acceptance criterion, evaluate whether the GitHub evidence demonstrates that the criterion is MET, PARTIAL, or NOT_MET.

- **MET**: Criterion is fully satisfied by the evidence
- **PARTIAL**: Criterion is partially satisfied; some aspects are missing or incomplete
- **NOT_MET**: Criterion is not satisfied or has no clear evidence

For each criterion, provide:
1. The criterion name
2. Your verdict (MET, PARTIAL, or NOT_MET)
3. Specific evidence from the PR (cite exact files, line changes, descriptions)
4. Confidence score (0-100) in your verdict
5. Brief reasoning explaining your assessment

Also provide:
- A brief overall summary of the deliverable
- List of identified risks (e.g., "CI failed", "Low confidence", "Security concern")
- Recommended action (SETTLE, PARTIAL_SETTLE, BLOCK, MANUAL_REVIEW)

Return ONLY valid JSON. Do not include markdown formatting or code blocks in the JSON values.`;
  }
}
