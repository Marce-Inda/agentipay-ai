export type SecurityEventType =
  | 'PROMPT_INJECTION_BLOCKED'
  | 'KILL_SWITCH_ACTIVE'
  | 'BUDGET_REJECTED'
  | 'INVALID_REQUEST'
  | 'PAYOUT_BLOCKED'
  | 'RATE_LIMITED';

export interface SecurityEventDetails {
  route: string;
  reason: string;
  riskLevel?: string;
  status?: number;
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
