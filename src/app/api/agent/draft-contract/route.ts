import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getRepository } from '@/lib/db/repository';
import { randomUUID } from 'node:crypto';

/**
 * Contract Drafting Response Schema
 */
interface DraftedMilestone {
  name: string;
  description: string;
  estimatedUSD: number;
  acceptanceCriteria: string[];
}

interface ContractDraftResponse {
  milestones: DraftedMilestone[];
  totalEstimatedUSD: number;
  contractSummary: string;
}

/**
 * Validates the drafted contract response from AI
 */
function validateDraftResponse(response: unknown): {
  valid: boolean;
  data?: ContractDraftResponse;
  error?: string;
} {
  if (typeof response !== 'object' || response === null) {
    return { valid: false, error: 'Response is not a valid object' };
  }

  const obj = response as Record<string, unknown>;

  // Check milestones array
  if (!Array.isArray(obj.milestones)) {
    return { valid: false, error: 'Response must contain a milestones array' };
  }

  if (obj.milestones.length < 1 || obj.milestones.length > 10) {
    return {
      valid: false,
      error: 'Milestones array must contain 1-10 items',
    };
  }

  // Validate each milestone
  for (let i = 0; i < obj.milestones.length; i++) {
    const ms = obj.milestones[i];

    if (typeof ms !== 'object' || ms === null) {
      return {
        valid: false,
        error: `Milestone ${i + 1} is not a valid object`,
      };
    }

    const milestone = ms as Record<string, unknown>;

    // Check required fields
    if (typeof milestone.name !== 'string' || !milestone.name.trim()) {
      return {
        valid: false,
        error: `Milestone ${i + 1}: name is required and must be a non-empty string`,
      };
    }

    if (typeof milestone.description !== 'string' || !milestone.description.trim()) {
      return {
        valid: false,
        error: `Milestone ${i + 1}: description is required and must be a non-empty string`,
      };
    }

    if (typeof milestone.estimatedUSD !== 'number' || milestone.estimatedUSD <= 0) {
      return {
        valid: false,
        error: `Milestone ${i + 1}: estimatedUSD must be a positive number`,
      };
    }

    if (!Array.isArray(milestone.acceptanceCriteria)) {
      return {
        valid: false,
        error: `Milestone ${i + 1}: acceptanceCriteria must be an array`,
      };
    }

    if (milestone.acceptanceCriteria.length === 0) {
      return {
        valid: false,
        error: `Milestone ${i + 1}: acceptanceCriteria must contain at least one item`,
      };
    }

    // Check acceptance criteria are strings
    for (let j = 0; j < milestone.acceptanceCriteria.length; j++) {
      if (typeof milestone.acceptanceCriteria[j] !== 'string') {
        return {
          valid: false,
          error: `Milestone ${i + 1}: acceptanceCriteria[${j}] must be a string`,
        };
      }
    }
  }

  // Check totalEstimatedUSD
  if (typeof obj.totalEstimatedUSD !== 'number' || obj.totalEstimatedUSD <= 0) {
    return {
      valid: false,
      error: 'totalEstimatedUSD must be a positive number',
    };
  }

  // Check contractSummary
  if (typeof obj.contractSummary !== 'string' || !obj.contractSummary.trim()) {
    return {
      valid: false,
      error: 'contractSummary is required and must be a non-empty string',
    };
  }

  return {
    valid: true,
    data: obj as unknown as ContractDraftResponse,
  };
}

/**
 * Calls the AI model to draft a contract from natural language brief
 */
async function callAIModel(brief: string): Promise<string | null> {
  const apiKey = process.env.OPENROUTER_API_KEY || '';

  if (!apiKey) {
    console.error('OPENROUTER_API_KEY not configured');
    return null;
  }

  const prompt = `You are an enterprise contract drafting AI. Generate a professional contract specification from the following natural language brief.

Brief: ${brief}

Respond with ONLY a JSON object (no markdown, no code blocks) with this structure:
{
  "milestones": [
    {
      "name": "string (milestone title)",
      "description": "string (what should be delivered)",
      "estimatedUSD": number (positive amount),
      "acceptanceCriteria": ["string (acceptance criterion)", ...]
    }
  ],
  "totalEstimatedUSD": number (sum of all milestone amounts),
  "contractSummary": "string (2-3 sentence professional summary of the contract scope)"
}

IMPORTANT:
- Each milestone MUST have 1-10 acceptance criteria
- All amounts MUST be positive numbers
- totalEstimatedUSD MUST equal the sum of milestone amounts
- Return ONLY the JSON object, no other text`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.HOSTNAME || 'http://localhost:3000',
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL_NAME || 'openrouter/gpt-4o-mini',
          temperature: 0.3, // Slightly lower for consistency
          max_tokens: 2000,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        console.error(`AI Model API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = (await response.json()) as any;
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error('No content in AI model response');
        return null;
      }

      return content;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('AI Model call timed out');
      return null;
    }
    console.error('AI Model API call failed:', error);
    return null;
  }
}

/**
 * POST /api/agent/draft-contract
 *
 * Accepts a natural language brief and returns structured contract milestones.
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON request body.' }, { status: 400 });
    }

    // Validate brief input
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
    }

    const { brief } = body as Record<string, unknown>;

    if (typeof brief !== 'string' || !brief.trim()) {
      return NextResponse.json(
        { error: 'Brief must be a non-empty string.' },
        { status: 400 }
      );
    }

    if (brief.trim().length < 20) {
      return NextResponse.json(
        {
          error: 'Brief must be at least 20 characters. Provide more detail about your contract requirements.',
        },
        { status: 400 }
      );
    }

    if (brief.length > 2000) {
      return NextResponse.json(
        {
          error: 'Brief must not exceed 2000 characters.',
        },
        { status: 400 }
      );
    }

    // Call AI model to generate contract draft
    const aiResponse = await callAIModel(brief.trim());

    // Handle timeout
    if (aiResponse === null) {
      // Log timeout event
      const repository = getRepository();
      await repository.appendLedgerEvent(session.user.id, {
        id: `evt-draft-timeout-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        projectId: `draft-${randomUUID()}`,
        projectName: 'AI Contract Draft (Timeout)',
        timestamp: new Date().toISOString(),
        agentRole: 'BUYER_AI',
        action: 'CONTRACT_DRAFT_TIMEOUT',
        amountUSD: 0,
        recipientEmail: session.user.email,
        auditConfidenceScore: 0,
        status: 'PROPOSED',
        riskLevel: 'HIGH',
      });

      return NextResponse.json(
        {
          error: 'The AI model is taking longer than expected. Please try again in a moment.',
        },
        { status: 504 }
      );
    }

    // Parse AI response as JSON
    let parsedResponse: unknown;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch {
      // Log validation failure
      const repository = getRepository();
      await repository.appendLedgerEvent(session.user.id, {
        id: `evt-draft-parse-error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        projectId: `draft-${randomUUID()}`,
        projectName: 'AI Contract Draft (Parse Error)',
        timestamp: new Date().toISOString(),
        agentRole: 'BUYER_AI',
        action: 'CONTRACT_DRAFT_PARSE_ERROR',
        amountUSD: 0,
        recipientEmail: session.user.email,
        auditConfidenceScore: 0,
        status: 'PROPOSED',
        riskLevel: 'MEDIUM',
      });

      return NextResponse.json(
        {
          error: 'The AI model response was malformed. Please refine your brief and try again.',
        },
        { status: 422 }
      );
    }

    // Validate the parsed response
    const validation = validateDraftResponse(parsedResponse);
    if (!validation.valid || !validation.data) {
      // Log validation failure
      const repository = getRepository();
      await repository.appendLedgerEvent(session.user.id, {
        id: `evt-draft-validation-error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        projectId: `draft-${randomUUID()}`,
        projectName: 'AI Contract Draft (Validation Error)',
        timestamp: new Date().toISOString(),
        agentRole: 'BUYER_AI',
        action: 'CONTRACT_DRAFT_VALIDATION_ERROR',
        amountUSD: 0,
        recipientEmail: session.user.email,
        auditConfidenceScore: 0,
        status: 'PROPOSED',
        riskLevel: 'MEDIUM',
      });

      return NextResponse.json(
        {
          error: `Contract structure validation failed: ${validation.error}. Please refine your brief and try again.`,
        },
        { status: 422 }
      );
    }

    // Log successful draft
    const repository = getRepository();
    await repository.appendLedgerEvent(session.user.id, {
      id: `evt-draft-success-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      projectId: `draft-${randomUUID()}`,
      projectName: `AI Contract Draft (${validation.data!.milestones.length} milestones)`,
      timestamp: new Date().toISOString(),
      agentRole: 'BUYER_AI',
      action: 'CONTRACT_DRAFTED',
      amountUSD: validation.data!.totalEstimatedUSD,
      recipientEmail: session.user.email,
      auditConfidenceScore: 95, // High confidence for AI-generated structure
      status: 'PROPOSED',
      riskLevel: 'LOW',
      httpPayloadLog: JSON.stringify({
        milestonesCount: validation.data!.milestones.length,
        totalEstimatedUSD: validation.data!.totalEstimatedUSD,
      }),
    });

    return NextResponse.json(validation.data, { status: 200 });
  } catch (error) {
    console.error('[AgenticPay AI Contract Draft Error]:', error);
    return NextResponse.json({ error: 'Unable to draft the contract.' }, { status: 503 });
  }
}
