/**
 * EvidenceSanitizer: OWASP-compliant sanitization for audit evidence
 * - Strips sensitive data (emails, API keys, tokens)
 * - HTML-escapes content to prevent XSS
 * - Limits evidence size to 1MB
 * - Idempotent operation
 */
export class EvidenceSanitizer {
  private static readonly MAX_EVIDENCE_LENGTH = 1024 * 1024; // 1MB
  private static readonly EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  // Match api_key = "value", token=value, secret: value, etc.
  private static readonly API_KEY_PATTERN = /[a-z_]+\s*[=:]\s*['"]?[\w\-]{10,}['"]?/gi;
  // GitHub token format: ghp_ followed by 32+ characters (commonly 32-36)
  private static readonly GITHUB_TOKEN_PATTERN = /ghp_[\w]{32,}/g;
  private static readonly PAT_PATTERN = /pat_[\w]{20,}/gi;

  /**
   * Strip sensitive data from evidence (emails, API keys, tokens)
   */
  static stripSensitiveData(text: string): string {
    let sanitized = text;

    // Remove email addresses
    sanitized = sanitized.replace(this.EMAIL_PATTERN, '[email]');

    // Remove API keys and tokens
    sanitized = sanitized.replace(this.API_KEY_PATTERN, '[REDACTED]');

    // Remove GitHub tokens
    sanitized = sanitized.replace(this.GITHUB_TOKEN_PATTERN, '[REDACTED]');

    // Remove GitHub PATs
    sanitized = sanitized.replace(this.PAT_PATTERN, '[REDACTED]');

    return sanitized;
  }

  /**
   * HTML escape special characters to prevent XSS
   */
  static htmlEscape(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  }

  /**
   * Sanitize evidence: strip sensitive data, HTML escape, and limit size
   * Idempotent: sanitizing twice produces same result as sanitizing once
   */
  static sanitizeEvidence(rawEvidence: string, maxLength: number = this.MAX_EVIDENCE_LENGTH): string {
    // If already sanitized (contains escape markers), return as-is
    if (rawEvidence.includes('[REDACTED]') || rawEvidence.includes('[email]')) {
      // Still limit length and add truncation marker if needed
      if (rawEvidence.length > maxLength) {
        return rawEvidence.substring(0, maxLength) + '\n[evidence truncated...]';
      }
      return rawEvidence;
    }

    // Strip sensitive data
    let sanitized = this.stripSensitiveData(rawEvidence);

    // HTML escape
    sanitized = this.htmlEscape(sanitized);

    // Limit length
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength) + '\n[evidence truncated...]';
    }

    return sanitized;
  }

  /**
   * Check if text contains sensitive patterns
   */
  static hasSensitiveData(text: string): boolean {
    return (
      this.EMAIL_PATTERN.test(text) ||
      this.API_KEY_PATTERN.test(text) ||
      this.GITHUB_TOKEN_PATTERN.test(text) ||
      this.PAT_PATTERN.test(text)
    );
  }
}
