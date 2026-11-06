export type SecurityEventType =
  | 'PROMPT_INJECTION_BLOCKED'
  | 'KILL_SWITCH_ACTIVE'
  | 'BUDGET_REJECTED'
  | 'APPROVAL_REQUIRED'
  | 'AUDIT_FAILED'
  | 'INVALID_REQUEST'
  | 'PAYOUT_BLOCKED'
  | 'RATE_LIMITED'
  | 'CSRF_REJECTED'
  | 'INPUT_VALIDATION_FAILED'
  | 'CONCURRENCY_VIOLATION'
  | 'TRANSACTION_ERROR';

export interface SecurityEventDetails {
  route: string;
  reason: string;
  riskLevel?: string;
  status?: number;
  paypalErrorCode?: string;
}

export function logSecurityEvent(event: SecurityEventType, details: SecurityEventDetails): void {
  console.warn(
    JSON.stringify({
      channel: 'security',
      event,
      timestamp: new Date().toISOString(),
      ...details,
    })
  );
}
