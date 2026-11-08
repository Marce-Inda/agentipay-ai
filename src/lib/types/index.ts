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
  status: 'COMPLETED' | 'PENDING' | 'LOCKED' | 'AUDITED_PENDING_APPROVAL';
  acceptanceCriteria?: string;
  auditScore?: number;
  auditRationale?: string;
  deliverableProof?: string;
  submittedAt?: string;
  payPalBatchId?: string;
  requiresHumanApproval?: boolean;
}

export type ProjectPerspective = 'OUTGOING' | 'INCOMING';
export type ContractLegalType = 'MSA_SOW' | 'STANDARD_AGREEMENT';

export interface ProjectContract {
  id: string;
  name: string;
  vendorName: string;
  vendorEmail: string;
  clientName?: string;
  clientEmail?: string;
  budgetCapUSD: number;
  spentUSD: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  perspective?: ProjectPerspective; // 'OUTGOING' = Proyectos que contrato | 'INCOMING' = Proyectos que realizo
  contractType?: ContractLegalType;
  contractReferenceId?: string;
  isSubcontracted?: boolean;
  parentProjectId?: string;
  milestones?: ProjectMilestone[];
  // Escrow Funding Fields (Stage 1)
  fundingStatus?: 'UNFUNDED' | 'PARTIALLY_FUNDED' | 'FUNDED' | 'PARTIALLY_REFUNDED' | 'FULLY_REFUNDED' | 'VOIDED';
  fundedUSD?: number;
  releasedUSD?: number;
  refundableUSD?: number;
  captureId?: string;
  orderId?: string;
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

export interface GuardrailCheckResult {
  allowed: boolean;
  reason: string;
  riskLevel: RiskLevel;
  sanitizedText?: string;
  requiresHumanApproval?: boolean;
  settlementMode?: 'AUTONOMOUS' | 'HUMAN_APPROVAL_REQUIRED' | 'REJECTED';
}

export interface A2ANegotiationMessage {
  id: string;
  sender: 'BUYER_AGENT' | 'SELLER_AGENT' | 'SYSTEM';
  text: string;
  timestamp: string;
  proposedPrice?: number;
  deliverableUrl?: string;
}

export type UserRole = 'BUSINESS' | 'PERSONAL' | 'FREELANCER';
export type AccountType = 'BUSINESS' | 'PERSONAL';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  accountType?: AccountType;
  companyOrTitle: string;
  email: string;
  payPalAccountEmail: string;
  avatarUrl?: string;
  taxId?: string;
  legalCompanyName?: string;
  billingAddress?: string;
  complianceStatus?: 'VERIFIED' | 'PENDING';
}



// ============================================================================
// Stage 2: AI Auditor Types
// ============================================================================

export type AuditVerdict = 'MET' | 'PARTIAL' | 'NOT_MET';
export type GuardrailStatus = 'APPROVED_AUTOMATIC' | 'BLOCKED_LOW_SCORE' | 'BLOCKED_REQUIRES_APPROVAL';
export type RecommendedAction = 'SETTLE' | 'PARTIAL_SETTLE' | 'BLOCK' | 'MANUAL_REVIEW';
export type AuditMode = 'LLM' | 'HEURISTIC';
export type CIStatus = 'success' | 'failure' | 'pending' | 'unknown';

export interface GitHubEvidence {
  title: string;
  description: string;
  files: Array<{ name: string; path: string; status: 'added' | 'modified' | 'deleted' }>;
  diff: string;
  ciStatus: CIStatus;
  merged: boolean;
  url: string;
}

export interface AuditCriterionResult {
  criterion: string;
  verdict: AuditVerdict;
  evidence: string;
  confidence: number; // 0-100
  reasoning: string;
}

export interface ScoreDetails {
  baseScore: number;
  metCount: number;
  partialCount: number;
  notMetCount: number;
  ciPenalty: number;
  mergedPenalty: number;
  breakdown: string;
}

export interface PartialReleaseInfo {
  partialReleasePct: number;
  proportionalAmountUsd: number;
  acknowledgedCriteria: string[];
}

export interface AuditReport {
  id: string;
  projectId: string;
  milestoneId: string;
  userId: string;
  prUrl: string;
  auditMode: AuditMode;
  score: number; // 0-100
  scoreDetails: ScoreDetails;
  criteria: AuditCriterionResult[];
  summary: string;
  risks: string[];
  recommendedAction: RecommendedAction;
  guardrailStatus: GuardrailStatus;
  partialReleaseInfo?: PartialReleaseInfo;
  createdAt: Date;
  updatedAt: Date;
}
