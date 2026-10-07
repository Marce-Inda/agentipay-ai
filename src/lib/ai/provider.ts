import { createOpenAI } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

/**
 * Flexible Multi-Model AI Provider with Automatic Fallback Chain for AgenticPay AI
 * Primary Model: openai/gpt-4o-mini (via OpenRouter or OpenAI API)
 * Fallback Model: meta-llama/llama-3.3-70b-instruct (via OpenRouter)
 */
export function getActiveAIModel(useFallback: boolean = false) {
  const openAiKey = process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const isOpenRouter = !!process.env.OPENROUTER_API_KEY;

  if (openAiKey) {
    const openaiProvider = createOpenAI({
      apiKey: openAiKey,
      baseURL: isOpenRouter ? 'https://openrouter.ai/api/v1' : undefined,
    });

    if (useFallback) {
      const fallbackModel = process.env.AI_FALLBACK_MODEL_NAME || 'meta-llama/llama-3.3-70b-instruct';
      console.warn(`[AI Provider] Switching to Fallback Model: ${fallbackModel}`);
      return openaiProvider(fallbackModel);
    }

    const primaryModel = process.env.AI_MODEL_NAME || 'openai/gpt-4o-mini';
    return openaiProvider(primaryModel);
  }

  if (geminiKey) {
    return google('gemini-1.5-flash');
  }

  // Fallback default
  const defaultOpenAI = createOpenAI({});
  return defaultOpenAI('gpt-4o-mini');
}
