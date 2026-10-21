import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { getActiveAIModel } from '@/lib/ai/provider';
import { BudgetEnvelope } from '@/lib/types';
import { GuardrailEnforcer } from '@/lib/guardrails/enforcer';
import { logSecurityEvent } from '@/lib/security/events';
import { assertTrustedOrigin, getSession } from '@/lib/auth/session';
import {
  RATE_LIMITS,
  checkRateLimit,
  rateLimitResponse,
} from '@/lib/security/rate-limit';

const MAX_REQUEST_BYTES = 65536;
const MAX_PROMPT_LENGTH = 8000;
const MAX_PROJECT_NAME_LENGTH = 120;
const MAX_VENDOR_EMAIL_LENGTH = 254;
const MAX_ADVISORY_BUDGET_USD = 1000000;
const MAX_ADVISORY_DAILY_USD = 5000000;
const MAX_OUTPUT_TOKENS = 1024;
const STREAM_TIMEOUT_MS = 45000;

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

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
      `agent:stream:${session.user.id}`,
      RATE_LIMITS.agentStream.limit,
      RATE_LIMITS.agentStream.windowMs
    );
    if (!rate.allowed) {
      logSecurityEvent('RATE_LIMITED', {
        route: '/api/agent/stream',
        reason: 'LLM request rate limit exceeded',
        status: 429,
      });
      return rateLimitResponse(
        rate,
        'Too many AI negotiation requests. Please wait before trying again.'
      );
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('application/json')) {
      logSecurityEvent('INVALID_REQUEST', {
        route: '/api/agent/stream',
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
    const prompt = payload.prompt;
    const rawMaxBudgetUSD = payload.maxBudgetUSD;
    const rawTargetAmount = payload.targetAmount;
    const rawProjectName = payload.projectName;
    const rawVendorEmail = payload.vendorEmail;
    const rawEnvelope = payload.envelope;

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Missing prompt in request body' }, { status: 400 });
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: 'Prompt exceeds the maximum allowed length.' },
        { status: 413 }
      );
    }

    // Step 1: OWASP LLM01 Prompt Injection Defense
    const sanitizedPrompt = GuardrailEnforcer.sanitizePromptInput(prompt);

    // Step 2: Deterministic Budget Ceiling Check
    const requestedBudget = finiteOr(rawMaxBudgetUSD, 100);
    const effectiveBudget = clamp(requestedBudget, 1, MAX_ADVISORY_BUDGET_USD);
    const amountToValidate =
      typeof rawTargetAmount === 'number' && Number.isFinite(rawTargetAmount) && rawTargetAmount > 0
        ? rawTargetAmount
        : effectiveBudget;

    const envelopeSource =
      rawEnvelope && typeof rawEnvelope === 'object' ? (rawEnvelope as Record<string, unknown>) : {};

    const serverEnvelope: BudgetEnvelope = {
      maxPerTransactionUSD: effectiveBudget,
      dailyCeilingUSD: clamp(
        finiteOr(envelopeSource.dailyCeilingUSD, effectiveBudget),
        1,
        MAX_ADVISORY_DAILY_USD
      ),
      spentTodayUSD: clamp(finiteOr(envelopeSource.spentTodayUSD, 0), 0, MAX_ADVISORY_DAILY_USD),
      activeEscrowUSD: clamp(finiteOr(envelopeSource.activeEscrowUSD, 0), 0, MAX_ADVISORY_DAILY_USD),
      killSwitchActive: envelopeSource.killSwitchActive === true,
    };

    const budgetCheck = GuardrailEnforcer.validateTransactionBudget(amountToValidate, serverEnvelope);

    if (!budgetCheck.allowed) {
      logSecurityEvent(serverEnvelope.killSwitchActive ? 'KILL_SWITCH_ACTIVE' : 'BUDGET_REJECTED', {
        route: '/api/agent/stream',
        reason: budgetCheck.reason,
        riskLevel: budgetCheck.riskLevel,
        status: 422,
      });
      return NextResponse.json(
        {
          allowed: false,
          error: budgetCheck.reason,
          riskLevel: budgetCheck.riskLevel,
        },
        { status: 422 }
      );
    }

    const safeProjectName =
      GuardrailEnforcer.sanitizePromptInput(
        typeof rawProjectName === 'string'
          ? rawProjectName.slice(0, MAX_PROJECT_NAME_LENGTH)
          : 'General Contract'
      ) || 'General Contract';

    const vendorEmailCandidate =
      typeof rawVendorEmail === 'string'
        ? rawVendorEmail.trim().slice(0, MAX_VENDOR_EMAIL_LENGTH)
        : '';
    const safeVendorEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(vendorEmailCandidate)
      ? vendorEmailCandidate
      : 'N/A';
    const maskedVendorEmail = GuardrailEnforcer.maskEmail(safeVendorEmail);

    if (
      sanitizedPrompt.includes('[BLOCKED_INJECTION_ATTEMPT]') ||
      safeProjectName.includes('[BLOCKED_INJECTION_ATTEMPT]')
    ) {
      logSecurityEvent('PROMPT_INJECTION_BLOCKED', {
        route: '/api/agent/stream',
        reason: 'Prompt injection pattern neutralized before model invocation',
        status: 200,
      });
    }

    // System instruction defining the AgenticPay AI Buyer Persona
    const systemPrompt = `You are AgenticPay AI, an autonomous contract negotiation assistant.
Your active project contract is "${safeProjectName}" with vendor (${maskedVendorEmail}).
Your responsibility:
1. Negotiate product/service prices fairly with sellers.
2. Draft negotiation terms only. Settlement is handled separately through milestone audit and explicit client authorization.
3. Obey hard budget ceilings ($${effectiveBudget.toFixed(2)} USD max for this project).
Keep responses concise, professional, and clear.`;

    // Attempt Primary Model (GPT-4o-mini), with automatic Fallback to Llama 3.3 70B on error
    try {
      const primaryModel = getActiveAIModel(false);
      const result = streamText({
        model: primaryModel,
        system: systemPrompt,
        prompt: sanitizedPrompt,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
      });
      return result.toTextStreamResponse();
    } catch (primaryError) {
      console.warn('[AI Engine] Primary Model Error, triggering Llama 3.3 70B Fallback:', primaryError);
      const fallbackModel = getActiveAIModel(true);
      const fallbackResult = streamText({
        model: fallbackModel,
        system: systemPrompt,
        prompt: sanitizedPrompt,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        abortSignal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
      });
      return fallbackResult.toTextStreamResponse();
    }
  } catch (error) {
    console.error('[AgenticPay AI Stream Error]:', error);
    return NextResponse.json(
      { error: 'Failed to stream agent response' },
      { status: 500 }
    );
  }
}
