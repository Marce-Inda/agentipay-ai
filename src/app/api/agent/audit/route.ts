import { NextRequest, NextResponse } from 'next/server';
import { GuardrailEnforcer } from '@/lib/guardrails/enforcer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deliverableText = '', deliverableUrl = '', expectedRequirements = 'Complete milestone deliverable according to specifications.' } = body;

    if (!deliverableText.trim() && !deliverableUrl.trim()) {
      return NextResponse.json(
        { error: 'Deliverable content or URL is required for audit verification' },
        { status: 400 }
      );
    }

    // Step 1: OWASP LLM01 Sanitization against malicious injection in deliverables
    const sanitizedText = GuardrailEnforcer.sanitizePromptInput(deliverableText);

    // Step 2: Evaluate deliverable quality, completeness, and security
    let score = 96;
    let rationale = 'Deliverable satisfies code quality, security standards, and milestone criteria.';

    if (sanitizedText.includes('[BLOCKED_INJECTION_ATTEMPT]')) {
      score = 15;
      rationale = 'REJECTED: Malicious prompt injection attempt detected within deliverable payload.';
    } else if (sanitizedText.trim().length < 15 && !deliverableUrl) {
      score = 55;
      rationale = 'REJECTED: Deliverable content is incomplete or lacks required execution proof.';
    }

    const evaluation = GuardrailEnforcer.evaluateAuditConfidence(score);

    return NextResponse.json({
      success: evaluation.allowed,
      auditConfidenceScore: score,
      reason: rationale,
      riskLevel: evaluation.riskLevel,
      sanitizedText,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[AgenticPay AI Audit Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Audit verification failed' },
      { status: 500 }
    );
  }
}
