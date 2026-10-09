export type TransactionStatus = 
  | 'IDLE'
  | 'PROPOSED'
  | 'GUARDRAIL_CHECKING'
  | 'AUDITING_DELIVERABLE'
  | 'ESCROW_LOCKED'
  | 'PAYOUT_EXECUTED'
  | 'REJECTED'
  | 'CONTRACT_FROZEN'
  | 'KILL_SWITCH_REVOKED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ProjectMilestone {
  id: string;
  phaseNumber: number;
  title: string;
  description: string;
  amountUSD: number;
  status: 'COMPLETED' | 'PENDING' | 'LOCKED';
  auditScore?: number;
  deliverableProof?: string;
  payPalBatchId?: string;
}

export interface ProjectContract {
  id: string;
  name: string;
  vendorName: string;
  vendorEmail: string;
  budgetCapUSD: number;
  spentUSD: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  milestones?: ProjectMilestone[];
}

export interface TransactionLog {
  id: string;
  projectId: string;
  projectName: string;
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

export type UserRole = 'BUSINESS' | 'FREELANCER';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  companyOrTitle: string;
  email: string;
  payPalAccountEmail: string;
  avatarUrl?: string;
}
