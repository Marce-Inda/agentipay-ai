import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { getActiveAIModel } from '@/lib/ai/provider';
import { GuardrailEnforcer } from '@/lib/guardrails/enforcer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, maxBudgetUSD = 100, targetAmount, projectName = 'General Contract', vendorEmail, envelope } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt in request body' }, { status: 400 });
    }

    // Step 1: OWASP LLM01 Prompt Injection Defense
    const sanitizedPrompt = GuardrailEnforcer.sanitizePromptInput(prompt);

    // Step 2: Deterministic Budget Ceiling Check
    const amountToValidate = typeof targetAmount === 'number' ? targetAmount : maxBudgetUSD;
    const currentEnvelope = envelope || {
      maxPerTransactionUSD: maxBudgetUSD,
      dailyCeilingUSD: 1000,
      spentTodayUSD: 0,
      activeEscrowUSD: 0,
      killSwitchActive: false,
    };

    const budgetCheck = GuardrailEnforcer.validateTransactionBudget(amountToValidate, {
      ...currentEnvelope,
      maxPerTransactionUSD: maxBudgetUSD,
    });

    if (!budgetCheck.allowed) {
      return NextResponse.json(
        {
          allowed: false,
          error: budgetCheck.reason,
          riskLevel: budgetCheck.riskLevel,
        },
        { status: 422 }
      );
    }

    // System instruction defining the AgenticPay AI Buyer Persona
    const systemPrompt = `You are AgenticPay AI, an autonomous financial buyer agent built for the PayPal AI Hackathon 2026.
Your active project contract is "${projectName}" with vendor (${vendorEmail || 'N/A'}).
Your responsibility:
1. Negotiate product/service prices fairly with sellers.
2. Ensure milestone deliverables meet requirements before escrow funds are released via PayPal Sandbox.
3. Obey hard budget ceilings ($${maxBudgetUSD.toFixed(2)} USD max for this project).
Keep responses concise, professional, and clear.`;

    // Attempt Primary Model (GPT-4o-mini), with automatic Fallback to Llama 3.3 70B on error
    try {
      const primaryModel = getActiveAIModel(false);
      const result = streamText({
        model: primaryModel,
        system: systemPrompt,
        prompt: sanitizedPrompt,
      });
      return result.toTextStreamResponse();
    } catch (primaryError) {
      console.warn('[AI Engine] Primary Model Error, triggering Llama 3.3 70B Fallback:', primaryError);
      const fallbackModel = getActiveAIModel(true);
      const fallbackResult = streamText({
        model: fallbackModel,
        system: systemPrompt,
        prompt: sanitizedPrompt,
      });
      return fallbackResult.toTextStreamResponse();
    }
  } catch (error: any) {
    console.error('[AgenticPay AI Stream Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to stream agent response' },
      { status: 500 }
    );
  }
}
