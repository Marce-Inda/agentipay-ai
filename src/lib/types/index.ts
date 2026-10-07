export type TransactionStatus = 
  | 'IDLE'
  | 'PROPOSED'
  | 'GUARDRAIL_CHECKING'
  | 'AUDITING_DELIVERABLE'
  | 'ESCROW_LOCKED'
  | 'PAYOUT_EXECUTED'
  | 'REJECTED'
  | 'KILL_SWITCH_REVOKED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TransactionLog {
  id: string;
  timestamp: string;
  agentRole: 'BUYER_AI' | 'SELLER_AI' | 'GUARDRAIL' | 'PAYPAL_API';
  action: string;
  amountUSD: number;
  recipientEmail: string;
  deliverableHash?: string;
  auditConfidenceScore: number; // 0-100%
  status: TransactionStatus;
  riskLevel: RiskLevel;
  httpPayloadLog?: string;
  payPalTransactionId?: string;
}

export interface BudgetEnvelope {
  maxPerTransactionUSD: number;
  dailyCeilingUSD: number;
  spentTodayUSD: number;
  activeEscrowUSD: number;
  killSwitchActive: boolean;
}

export interface A2ANegotiationMessage {
  id: string;
  sender: 'BUYER_AGENT' | 'SELLER_AGENT' | 'SYSTEM';
  text: string;
  timestamp: string;
  proposedPrice?: number;
  deliverableUrl?: string;
}
