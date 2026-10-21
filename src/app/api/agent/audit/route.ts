import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import {
  GuardrailEnforcer,
  MAX_ARTIFACT_URL_LENGTH,
  MAX_AUDIT_TRANSACTION_USD,
  MAX_EXPECTED_REQUIREMENTS_LENGTH,
  MIN_AUDIT_CONFIDENCE,
} from '@/lib/guardrails/enforcer';
import { logSecurityEvent } from '@/lib/security/events';
import { assertTrustedOrigin, getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit';

const MAX_REQUEST_BYTES = 65536;

export async function POST(req: NextRequest) {
  try {
    if (!assertTrustedOrigin(req)) {
      return NextResponse.json({ error: 'Untrusted request origin.' }, { status: 403 });
    }

    const session = await getSession(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const rate = checkRateLimit(
      `agent:audit:${session.user.id}`,
      RATE_LIMITS.agentAudit.limit,
      RATE_LIMITS.agentAudit.windowMs
    );
    if (!rate.allowed) {
      logSecurityEvent('RATE_LIMITED', {
        route: '/api/agent/audit',
        reason: 'Audit request rate limit exceeded',
        status: 429,
      });
      return rateLimitResponse(
        rate,
        'Too many audit requests. Please wait before trying again.'
      );
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      logSecurityEvent('INVALID_REQUEST', {
        route: '/api/agent/audit',
        reason: 'Unsupported content type',
        status: 415,
      });
      return NextResponse.json(
        { error: 'Unsupported media type. Use application/json.' },
        { status: 415 }
      );
    }

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        { error: 'Request payload exceeds the maximum allowed size.' },
        { status: 413 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Malformed JSON request body.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Malformed JSON request body.' },
        { status: 400 }
      );
    }

    const payload = body as Record<string, unknown>;
    const {
      deliverableText = '',
      deliverableUrl = '',
      expectedRequirements = 'Complete milestone deliverable according to specifications.',
      milestoneTitle = '',
      milestoneAmountUSD,
      envelope,
      projectId,
      milestoneId,
    } = payload;

    if (
      typeof deliverableText !== 'string' ||
      typeof deliverableUrl !== 'string' ||
      typeof expectedRequirements !== 'string' ||
      typeof milestoneTitle !== 'string' ||
      (projectId !== undefined && typeof projectId !== 'string') ||
      (milestoneId !== undefined && typeof milestoneId !== 'string')
    ) {
      return NextResponse.json(
        { error: 'Invalid field types in audit request.' },
        { status: 400 }
      );
    }

    if (envelope && typeof envelope === 'object' && (envelope as Record<string, unknown>).killSwitchActive === true) {
      logSecurityEvent('KILL_SWITCH_ACTIVE', {
        route: '/api/agent/audit',
        reason: 'Settlement attempt while kill-switch is active',
        riskLevel: 'CRITICAL',
        status: 423,
      });
      return NextResponse.json(
        {
          success: false,
          error: 'Emergency kill-switch is active. Escrow releases are halted.',
          reason: 'CRITICAL: Emergency Kill-Switch is ACTIVE. All transactions halted.',
          auditConfidenceScore: 0,
          riskLevel: 'CRITICAL',
          requiresHumanApproval: true,
          settlementMode: 'REJECTED',
        },
        { status: 423 }
      );
    }

    if (!deliverableText.trim() && !deliverableUrl.trim()) {
      return NextResponse.json(
        { error: 'Deliverable content or URL is required for audit verification' },
        { status: 400 }
      );
    }

    if (deliverableUrl.length > MAX_ARTIFACT_URL_LENGTH) {
      return NextResponse.json(
        { error: 'Deliverable URL exceeds the maximum allowed length.' },
        { status: 400 }
      );
    }

    if (
      typeof milestoneAmountUSD !== 'number' ||
      !Number.isFinite(milestoneAmountUSD) ||
      milestoneAmountUSD <= 0
    ) {
      return NextResponse.json(
        { error: 'milestoneAmountUSD must be a finite number greater than zero.' },
        { status: 400 }
      );
    }

    if ((projectId === undefined) !== (milestoneId === undefined)) {
      return NextResponse.json(
        { error: 'projectId and milestoneId must be provided together.' },
        { status: 400 }
      );
    }

    const repository = getRepository();
    const serverProject =
      typeof projectId === 'string'
        ? await repository.getProject(session.user.id, projectId)
        : null;
    const serverMilestone = serverProject
      ? (serverProject.milestones || []).find((item) => item.id === milestoneId)
      : undefined;

    if (typeof projectId === 'string' && !serverProject) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
    }
    if (typeof projectId === 'string' && !serverMilestone) {
      return NextResponse.json({ error: 'Milestone not found.' }, { status: 404 });
    }
    if (
      serverMilestone &&
      Math.abs(serverMilestone.amountUSD - (milestoneAmountUSD as number)) > 0.005
    ) {
      return NextResponse.json(
        { error: 'Milestone amount does not match the server-side contract.' },
        { status: 422 }
      );
    }

    if (serverProject) {
      const serverEnvelope = await repository.getEnvelope(session.user.id);
      if (serverEnvelope?.killSwitchActive) {
        logSecurityEvent('KILL_SWITCH_ACTIVE', {
          route: '/api/agent/audit',
          reason: 'Settlement attempt while the server-side kill-switch is active',
          riskLevel: 'CRITICAL',
          status: 423,
        });
        return NextResponse.json(
          {
            success: false,
            error: 'Emergency kill-switch is active. Escrow releases are halted.',
            reason: 'CRITICAL: Emergency Kill-Switch is ACTIVE. All transactions halted.',
            auditConfidenceScore: 0,
            riskLevel: 'CRITICAL',
            requiresHumanApproval: true,
            settlementMode: 'REJECTED',
          },
          { status: 423 }
        );
      }
      if (serverProject.status !== 'ACTIVE') {
        return NextResponse.json(
          { error: 'This contract is not active. Resume the contract before auditing.' },
          { status: 423 }
        );
      }
      if (serverMilestone?.status === 'COMPLETED') {
        return NextResponse.json(
          { error: 'Milestone has already been settled.' },
          { status: 409 }
        );
      }
      if (serverMilestone?.status === 'LOCKED') {
        return NextResponse.json(
          { error: 'Milestone is locked and cannot be audited yet.' },
          { status: 409 }
        );
      }
    }

    if (milestoneAmountUSD > MAX_AUDIT_TRANSACTION_USD) {
      logSecurityEvent('BUDGET_REJECTED', {
        route: '/api/agent/audit',
        reason: 'Milestone amount exceeds the maximum auditable transaction limit',
        riskLevel: 'HIGH',
        status: 422,
      });
      return NextResponse.json(
        { error: 'Milestone amount exceeds the maximum auditable transaction limit.' },
        { status: 422 }
      );
    }

    const boundedRequirements = expectedRequirements.slice(0, MAX_EXPECTED_REQUIREMENTS_LENGTH);

    // Step 1: Payload size validation to prevent Token Depletion DoS
    const sizeCheck = GuardrailEnforcer.validatePayloadSize(deliverableText);
    const boundedText = sizeCheck.truncatedText;

    // Step 2: OWASP LLM01 Sanitization against malicious injection in deliverables
    const sanitizedText = GuardrailEnforcer.sanitizePromptInput(boundedText);
    const boundedUrl = deliverableUrl.trim();

    // Step 3: Evaluate deliverable quality, completeness, and alignment with acceptance criteria
    const trustedArtifact = GuardrailEnforcer.isTrustedArtifactUrl(boundedUrl);
    const requirementTokens = GuardrailEnforcer.tokenizeForMatch(boundedRequirements).slice(0, 200);
    const evidenceTokens = GuardrailEnforcer.tokenizeForMatch(`${sanitizedText} ${boundedUrl}`);

    let matches = 0;
    for (const token of requirementTokens) {
      if (evidenceTokens.some((evidence) => evidence.includes(token) || token.includes(evidence))) {
        matches++;
      }
    }

    const matchRatio = requirementTokens.length > 0 ? matches / requirementTokens.length : 0;
    const textLength = sanitizedText.length;
    const blockedInjection = sanitizedText.includes('[BLOCKED_INJECTION_ATTEMPT]');

    let score = 55;
    let rationale = '';

    if (blockedInjection) {
      score = 15;
      rationale = 'REJECTED: Malicious prompt injection attempt detected within deliverable payload.';
      logSecurityEvent('PROMPT_INJECTION_BLOCKED', {
        route: '/api/agent/audit',
        reason: 'Injection pattern detected in deliverable payload',
        riskLevel: 'HIGH',
        status: 200,
      });
    } else {
      if (textLength >= 15) score += 10;
      if (textLength >= 40) score += 8;
      if (textLength >= 120) score += 4;
      score += Math.round(matchRatio * 15);
      if (trustedArtifact) score += 5;
      score = Math.min(99, Math.max(0, score));

      if (score >= MIN_AUDIT_CONFIDENCE) {
        rationale = `VERIFIED: Deliverable aligns with acceptance criteria (${Math.round(matchRatio * 100)}% requirement alignment${trustedArtifact ? ' and trusted artifact link' : ''}). OWASP LLM01 security checks passed.`;
      } else {
        rationale = `REJECTED: Deliverable evidence is insufficient (${score}% confidence, minimum ${MIN_AUDIT_CONFIDENCE}%). Provide a verifiable artifact link and a summary aligned with the acceptance criteria.`;
      }
    }

    // Step 5: Evaluate with Tiered Human-in-the-Loop financial thresholds
    const evaluation = GuardrailEnforcer.evaluateAuditConfidence(score, milestoneAmountUSD);

    const fingerprint = createHash('sha256')
      .update(
        [
          milestoneTitle,
          milestoneAmountUSD.toFixed(2),
          boundedUrl,
          sanitizedText,
          boundedRequirements,
        ].join('\n')
      )
      .digest('hex')
      .toUpperCase();

    // Deterministic key so retries of the same submission cannot create duplicate settlements
    const idempotencyKey = `AUDIT_${fingerprint.slice(0, 32)}`;

    const serverRequiresHumanApproval =
      evaluation.requiresHumanApproval ||
      (serverProject ? serverProject.perspective === 'INCOMING' : false);

    if (serverProject && serverMilestone && evaluation.allowed) {
      const auditProof = boundedUrl || sanitizedText.slice(0, 4_000);
      const recorded = await repository.recordMilestoneAudit(
        session.user.id,
        serverProject.id,
        serverMilestone.id,
        {
          auditScore: score,
          auditRationale: rationale,
          deliverableProof: auditProof,
          submittedAt: new Date().toISOString(),
          requiresHumanApproval: serverRequiresHumanApproval,
        }
      );
      if (!recorded) {
        return NextResponse.json(
          {
            error:
              'The contract or milestone changed during the audit. Refresh and retry.',
          },
          { status: 409 }
        );
      }
    }

    // Autonomous payout batch only generated if allowed AND autonomous settlement is permitted (amount <= $1,000)
    const canAutonomousRelease =
      evaluation.allowed && !serverRequiresHumanApproval;
    const simulatedBatchId = canAutonomousRelease
      ? `PAYPAL-BATCH-${fingerprint.slice(0, 20)}`
      : undefined;

    return NextResponse.json({
      success: evaluation.allowed,
      auditConfidenceScore: score,
      reason: evaluation.allowed && evaluation.requiresHumanApproval ? evaluation.reason : rationale,
      riskLevel: evaluation.riskLevel,
      sanitizedText,
      requiresHumanApproval: serverRequiresHumanApproval,
      settlementMode: evaluation.settlementMode || 'REJECTED',
      simulatedBatchId,
      idempotencyKey,
      milestoneTitle,
      milestoneAmountUSD,
      payloadTruncated: !sizeCheck.valid,
      requirementsTruncated: expectedRequirements.length > MAX_EXPECTED_REQUIREMENTS_LENGTH,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[AgenticPay AI Audit Error]:', error);
    return NextResponse.json(
      { error: 'Audit verification failed' },
      { status: 500 }
    );
  }
}
