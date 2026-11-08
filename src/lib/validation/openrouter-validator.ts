/**
 * OpenRouter API Balance Validator for Stage 0 Verification
 * Checks API key balance and determines readiness for AI inference
 */

export interface OpenRouterBalanceResult {
  success: boolean;
  balance: number | null;
  status: 'OK' | 'LOW' | 'MISSING' | 'ERROR';
  message: string;
  timestamp: Date;
}

/**
 * Validates OpenRouter API key by:
 * 1. Checking if OPENROUTER_API_KEY environment variable is set
 * 2. Making live API call to check account balance
 * 3. Determining status based on balance thresholds
 */
export async function validateOpenRouterBalance(): Promise<OpenRouterBalanceResult> {
  const apiKey = process.env.OPENROUTER_API_KEY || '';

  const result: OpenRouterBalanceResult = {
    success: false,
    balance: null,
    status: 'MISSING',
    message: 'OpenRouter API key not configured',
    timestamp: new Date(),
  };

  // Check if key is missing
  if (!apiKey || apiKey === 'placeholder' || apiKey.length === 0) {
    result.status = 'MISSING';
    result.message = 'OPENROUTER_API_KEY not set or empty. AI features will not be available.';
    result.success = true; // Not a failure, just incomplete
    return result;
  }

  try {
    // Call OpenRouter API to check account/key status
    // OpenRouter uses /api/auth/key endpoint to retrieve key metadata including balance
    const response = await fetch('https://openrouter.ai/api/v1/auth/key', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        result.status = 'ERROR';
        result.message = 'OpenRouter API key is invalid or unauthorized (HTTP 401/403)';
        result.success = false;
        return result;
      }

      const errorText = await response.text();
      result.status = 'ERROR';
      result.message = `OpenRouter API error: HTTP ${response.status} - ${errorText}`;
      result.success = false;
      return result;
    }

    // Parse response to extract balance information
    const data = await response.json() as {
      data?: {
        credit_balance?: number;
        usage?: {
          credits_used?: number;
        };
      };
    };

    // OpenRouter may return credit_balance in different formats depending on endpoint
    // Try to extract balance from various possible locations
    let balance = data.data?.credit_balance ?? null;

    // If we got a balance, determine status
    if (balance !== null && typeof balance === 'number') {
      result.balance = balance;
      result.success = true;

      // Determine status based on balance threshold
      // Threshold: >$5 is OK, $1-$5 is LOW, <$1 is ERROR
      if (balance > 5) {
        result.status = 'OK';
        result.message = `OpenRouter balance OK: $${balance.toFixed(2)} available (sufficient for Stage 1+ workload)`;
      } else if (balance > 1) {
        result.status = 'LOW';
        result.message = `OpenRouter balance LOW: $${balance.toFixed(2)} available. Recommend recharging before Stage 1.`;
      } else {
        result.status = 'ERROR';
        result.message = `OpenRouter balance DEPLETED: $${balance.toFixed(2)} remaining. Cannot proceed with AI features.`;
        result.success = false;
      }
    } else {
      // Balance endpoint doesn't return balance in expected format
      result.status = 'ERROR';
      result.message = 'OpenRouter API returned valid response but balance data is unavailable or in unexpected format';
      result.success = false;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    result.status = 'ERROR';
    result.message = `OpenRouter API network error: ${reason}. Cannot verify balance.`;
    result.success = false;
  }

  return result;
}
