'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  User,
  Lock,
  DollarSign,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  Layers,
  FileText,
  Send,
  Edit3,
  ExternalLink,
  X,
  Sparkles,
  Check,
} from 'lucide-react';
import { BudgetEnvelope, ProjectContract, ProjectMilestone, TransactionLog } from '../lib/types';
import { AUTONOMOUS_SETTLEMENT_CAP_USD } from '../lib/guardrails/enforcer';
import { AgentChat } from './AgentChat';
import { CommandCenter } from './CommandCenter';

function getSettlementBlockReason(
  envelope: BudgetEnvelope,
  projectStatus: ProjectContract['status']
): string | null {
  if (envelope.killSwitchActive) {
    return 'CRITICAL: Emergency Kill-Switch is ACTIVE. All settlements are halted.';
  }
  if (projectStatus === 'PAUSED') {
    return 'Settlements are frozen for this contract. Resume the contract before settling milestones.';
  }
  return null;
}

type PaymentRailInfo = { label: string; tone: string; className: string };

function getPaymentRailInfo(project: ProjectContract): PaymentRailInfo {
  const settled = (project.milestones || []).filter((m) => m.status === 'COMPLETED');
  if (settled.length === 0) {
    return { label: 'PAYMENT RAIL: PENDING', tone: 'text-slate-400', className: 'border-slate-700 bg-[#0f1115]' };
  }
  const hasRealPayPal = settled.some((m) =>
    m.payPalBatchId &&
    !m.payPalBatchId.startsWith('SIM_PAYOUT_') &&
    !m.payPalBatchId.startsWith('SETTLE-') &&
    !m.payPalBatchId.startsWith('AGENTICPAY_')
  );
  const hasSimulated = settled.some((m) => m.payPalBatchId?.startsWith('SIM_PAYOUT_'));
  if (hasRealPayPal) {
    return { label: 'PAYMENT RAIL: PAYPAL SANDBOX', tone: 'text-emerald-400', className: 'border-emerald-500/40 bg-emerald-950/60' };
  }
  if (hasSimulated) {
    return { label: 'PAYMENT RAIL: SIMULATED', tone: 'text-amber-300', className: 'border-amber-500/40 bg-amber-950/60' };
  }
  return { label: 'PAYMENT RAIL: LOCAL LEDGER', tone: 'text-slate-300', className: 'border-slate-700 bg-[#0f1115]' };
}

type MilestoneSettlementResponse =
  | { ok: true; event: TransactionLog }
  | { ok: false; error: string };

interface ProjectWorkspaceViewProps {
  project: ProjectContract;
  envelope: BudgetEnvelope;
  projects: ProjectContract[];
  logs: TransactionLog[];
  onBackToPortfolio: () => void;
  onToggleProjectFreeze: (projectId: string) => void;
  onAddLog: (log: TransactionLog) => void;
  onUpdateProject?: (updatedProject: ProjectContract) => void;
  onSettleMilestone: (
    projectId: string,
    milestoneId: string
  ) => Promise<MilestoneSettlementResponse>;
}

// -------------------------------------------------------------
// Modal: Edit Milestone Acceptance Criteria (Principal / Buyer)
// -------------------------------------------------------------
interface EditCriteriaModalProps {
  milestone: ProjectMilestone;
  onClose: () => void;
  onSave: (milestoneId: string, criteria: string) => void;
}

const EditCriteriaModal: React.FC<EditCriteriaModalProps> = ({ milestone, onClose, onSave }) => {
  const [criteria, setCriteria] = useState(milestone.acceptanceCriteria || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#16181D] border border-amber-500/30 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#252830]">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">Define Acceptance Criteria</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="font-semibold text-white">{milestone.title}</span>
            <span className="font-mono text-emerald-400 font-bold">${milestone.amountUSD.toFixed(2)} USD</span>
          </div>
          <p className="text-xs text-slate-400">{milestone.description}</p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-300">
            Acceptance Criteria & Audit Requirements
          </label>
          <textarea
            rows={5}
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            placeholder="e.g., OpenAPI 3.0 endpoints, passing test suite with >80% coverage, Dockerfile setup, and zero prompt injection vulnerabilities."
            className="w-full bg-[#0F1115] border border-[#252830] focus:border-amber-500/50 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none resize-none leading-relaxed"
          />
          <p className="text-[11px] text-slate-500">
            The AI Audit Agent will verify the contractor&apos;s submitted proof against these exact criteria before approving settlement.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#252830]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(milestone.id, criteria)}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg transition active:scale-95 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Save Specifications</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// Modal: Submit Deliverable for AI Audit (Contractor / Vendor)
// -------------------------------------------------------------
interface SubmitProofModalProps {
  milestone: ProjectMilestone;
  project: ProjectContract;
  envelope: BudgetEnvelope;
  onClose: () => void;
  onAuditSuccess: (
    milestoneId: string,
    proofUrl: string,
    proofText: string,
    score: number,
    rationale: string,
    batchId?: string,
    requiresHumanApproval?: boolean
  ) => void;
  onAddLog: (log: TransactionLog) => void;
  onSettleMilestone: (
    projectId: string,
    milestoneId: string
  ) => Promise<MilestoneSettlementResponse>;
}

const SubmitProofModal: React.FC<SubmitProofModalProps> = ({
  milestone,
  project,
  envelope,
  onClose,
  onAuditSuccess,
  onAddLog,
  onSettleMilestone,
}) => {
  const [proofUrl, setProofUrl] = useState('');
  const [proofText, setProofText] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<{
    success: boolean;
    auditConfidenceScore: number;
    reason: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    simulatedBatchId?: string;
    requiresHumanApproval?: boolean;
    settlementMode?: string;
    idempotencyKey?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofText.trim() && !proofUrl.trim()) return;

    const blockReason = getSettlementBlockReason(envelope, project.status);
    if (blockReason) {
      const isKillSwitch = envelope.killSwitchActive;
      setAuditResult({
        success: false,
        auditConfidenceScore: 0,
        reason: blockReason,
        riskLevel: isKillSwitch ? 'CRITICAL' : 'HIGH',
      });
      onAddLog({
        id: `log-audit-blocked-${Date.now()}`,
        timestamp: new Date().toISOString(),
        projectId: project.id,
        projectName: project.name,
        agentRole: 'GUARDRAIL',
        action: `Settlement blocked: ${blockReason}`,
        amountUSD: 0,
        recipientEmail: project.vendorEmail,
        auditConfidenceScore: 0,
        status: isKillSwitch ? 'KILL_SWITCH_REVOKED' : 'CONTRACT_FROZEN',
        riskLevel: isKillSwitch ? 'CRITICAL' : 'HIGH',
      });
      return;
    }

    setIsAuditing(true);
    setAuditResult(null);

    try {
      const res = await fetch('/api/agent/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliverableText: proofText,
          deliverableUrl: proofUrl,
          expectedRequirements: milestone.acceptanceCriteria || milestone.description,
          milestoneTitle: milestone.title,
          milestoneAmountUSD: milestone.amountUSD,
          envelope,
          projectId: project.id,
          milestoneId: milestone.id,
        }),
      });

      const data = await res.json();
      data.requiresHumanApproval = Boolean(
        data.requiresHumanApproval || (data.success && project.perspective === 'INCOMING')
      );
      setAuditResult(data);

      if (data.success && data.auditConfidenceScore >= 85) {
        if (data.requiresHumanApproval) {
          onAuditSuccess(
            milestone.id,
            proofUrl,
            proofText,
            data.auditConfidenceScore,
            data.reason,
            undefined,
            true
          );

          const holdReason =
            project.perspective === 'INCOMING'
              ? 'contractor submissions require client authorization'
              : 'amount exceeds the autonomous settlement threshold';

          onAddLog({
            id: `log-audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            projectId: project.id,
            projectName: project.name,
            agentRole: 'GUARDRAIL',
            action: `Milestone Audited (${data.auditConfidenceScore}% Score) — Client Authorization Required: "${milestone.title}" (${holdReason})`,
            amountUSD: milestone.amountUSD,
            recipientEmail: project.vendorEmail,
            auditConfidenceScore: data.auditConfidenceScore,
            status: 'ESCROW_LOCKED',
            riskLevel: 'MEDIUM',
            httpPayloadLog: `AUDIT VERIFIED: Score ${data.auditConfidenceScore}%. Settlement held pending client authorization. (Idempotency Key: ${data.idempotencyKey || 'REQ_IDEMPOTENT'})`,
          });
        } else {
          onAuditSuccess(
            milestone.id,
            proofUrl,
            proofText,
            data.auditConfidenceScore,
            data.reason,
            undefined,
            true
          );

          const settlement = await onSettleMilestone(project.id, milestone.id);
          if (settlement.ok) {
            const batchId =
              settlement.event.payPalTransactionId ||
              `SETTLE-${Date.now().toString(36).toUpperCase()}`;
            setAuditResult({
              ...data,
              success: true,
              requiresHumanApproval: false,
              simulatedBatchId: batchId,
            });
          } else {
            setAuditResult({
              ...data,
              success: false,
              requiresHumanApproval: true,
              reason: settlement.error,
              riskLevel: 'HIGH',
            });
            onAddLog({
              id: `log-audit-settle-rejected-${Date.now()}`,
              timestamp: new Date().toISOString(),
              projectId: project.id,
              projectName: project.name,
              agentRole: 'GUARDRAIL',
              action: `Server settlement rejected: ${settlement.error}`,
              amountUSD: 0,
              recipientEmail: project.vendorEmail,
              auditConfidenceScore: data.auditConfidenceScore || 0,
              status: 'REJECTED',
              riskLevel: 'HIGH',
            });
          }
        }
      } else {
        onAddLog({
          id: `log-audit-rej-${Date.now()}`,
          timestamp: new Date().toISOString(),
          projectId: project.id,
          projectName: project.name,
          agentRole: 'GUARDRAIL',
          action: `Milestone Audit Rejected (${data.auditConfidenceScore || 0}% Score): ${data.reason || 'Criteria not met'}`,
          amountUSD: 0,
          recipientEmail: project.vendorEmail,
          auditConfidenceScore: data.auditConfidenceScore || 0,
          status: 'GUARDRAIL_CHECKING',
          riskLevel: data.riskLevel || 'HIGH',
        });
      }
    } catch (err: any) {
      console.error('[Audit Modal Error]:', err);
      setAuditResult({
        success: false,
        auditConfidenceScore: 0,
        reason: 'The audit service could not be reached. Please retry the submission.',
        riskLevel: 'HIGH',
      });
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#16181D] border border-cyan-500/30 rounded-2xl w-full max-w-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#252830]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Submit Milestone Deliverable</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Milestone overview */}
        <div className="bg-[#0F1115] border border-[#252830] rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white">{milestone.title}</span>
            <span className="font-mono text-emerald-400 font-bold text-sm">
              ${milestone.amountUSD.toFixed(2)} USD
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            <strong className="text-slate-300">Phase Objective:</strong> {milestone.description}
          </div>
          {milestone.acceptanceCriteria && (
            <div className="text-[11px] bg-cyan-950/30 border border-cyan-500/30 rounded-lg p-2.5 text-cyan-200">
              <strong className="text-cyan-300 block mb-0.5">Client Acceptance Criteria:</strong>
              {milestone.acceptanceCriteria}
            </div>
          )}
        </div>

        {/* Submission Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Artifact URL (GitHub PR / Commit / Deployment Link)
            </label>
            <input
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://github.com/organization/repo/pull/42"
              className="w-full bg-[#0F1115] border border-[#252830] focus:border-cyan-500/50 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-300">
              Technical Verification & Proof Details
            </label>
            <textarea
              rows={4}
              value={proofText}
              onChange={(e) => setProofText(e.target.value)}
              placeholder="Summarize the implementation: endpoints built, test suite pass rate (e.g. 92% coverage), schema migrations, and Docker configurations..."
              className="w-full bg-[#0F1115] border border-[#252830] focus:border-cyan-500/50 rounded-xl p-3 text-xs text-white placeholder-slate-500 outline-none resize-none leading-relaxed"
            />
          </div>

          <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Protected by OWASP LLM01 Prompt Injection Guardrails. Minimum 85% confidence required for audit approval; contractor submissions always require client authorization.</span>
          </div>

          {/* Audit Result Display */}
          {auditResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                auditResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>
                  {auditResult.success
                    ? auditResult.requiresHumanApproval
                      ? '✅ Audit Passed — Awaiting Client Authorization'
                      : '✅ Audit Passed — Durable Settlement Recorded'
                    : '⚠️ Audit Verification Rejected'}
                </span>
                <span className="font-mono bg-black/40 px-2 py-0.5 rounded border border-current">
                  Score: {auditResult.auditConfidenceScore}%
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">{auditResult.reason}</p>
              {auditResult.simulatedBatchId && !auditResult.requiresHumanApproval && (
                <div className="text-[10px] font-mono text-emerald-400/90 pt-1">
                  Settlement Reference: {auditResult.simulatedBatchId}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#252830]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isAuditing || (!proofText.trim() && !proofUrl.trim())}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition active:scale-95 flex items-center gap-1.5"
            >
              {isAuditing ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-slate-950" />
                  <span>Auditing Deliverable...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Run AI Audit & Submit Proof</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// ProjectWorkspaceView Main Component
// -------------------------------------------------------------
export const ProjectWorkspaceView: React.FC<ProjectWorkspaceViewProps> = ({
  project,
  envelope,
  projects,
  logs,
  onBackToPortfolio,
  onToggleProjectFreeze,
  onAddLog,
  onUpdateProject,
  onSettleMilestone,
}) => {
  const isIncoming = project.perspective === 'INCOMING';
  const railInfo = getPaymentRailInfo(project);
  const parentProject = project.parentProjectId
    ? projects.find((p) => p.id === project.parentProjectId)
    : undefined;

  // Modal states
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null);
  const [submittingMilestone, setSubmittingMilestone] = useState<ProjectMilestone | null>(null);
  const [settlementError, setSettlementError] = useState('');

  // Handle saving edited acceptance criteria (Principal side)
  const handleSaveCriteria = (milestoneId: string, criteria: string) => {
    if (!onUpdateProject) return;

    const updatedMilestones = (project.milestones || []).map((m) =>
      m.id === milestoneId ? { ...m, acceptanceCriteria: criteria } : m
    );

    const updatedProject = {
      ...project,
      milestones: updatedMilestones,
    };

    onUpdateProject(updatedProject);
    setEditingMilestone(null);

    void fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ milestoneId, acceptanceCriteria: criteria }),
    }).catch((error) => {
      console.warn('[Projects] Acceptance criteria update failed:', error);
    });

    onAddLog({
      id: `log-criteria-${Date.now()}`,
      timestamp: new Date().toISOString(),
      projectId: project.id,
      projectName: project.name,
      agentRole: 'GUARDRAIL',
      action: `Acceptance Criteria Updated for Phase #${milestoneId}: Specifications saved to Escrow Envelope.`,
      amountUSD: 0,
      recipientEmail: project.vendorEmail,
      auditConfidenceScore: 100,
      status: 'IDLE',
      riskLevel: 'LOW',
    });
  };

  // Handle successful audit submission (Contractor side)
  const handleAuditSuccess = (
    milestoneId: string,
    proofUrl: string,
    proofText: string,
    score: number,
    rationale: string,
    batchId?: string,
    requiresHumanApproval?: boolean
  ) => {
    if (!onUpdateProject) return;

    const targetMilestone = (project.milestones || []).find((m) => m.id === milestoneId);
    if (!targetMilestone) return;

    const isPendingApproval = Boolean(requiresHumanApproval) || isIncoming;

    const updatedMilestones = (project.milestones || []).map((m) =>
      m.id === milestoneId
        ? {
            ...m,
            status: isPendingApproval ? ('AUDITED_PENDING_APPROVAL' as const) : ('COMPLETED' as const),
            auditScore: score,
            auditRationale: rationale,
            deliverableProof: proofUrl || proofText,
            payPalBatchId: isPendingApproval ? undefined : batchId,
            submittedAt: new Date().toISOString(),
            requiresHumanApproval: isPendingApproval,
          }
        : m
    );

    const updatedProject = {
      ...project,
      milestones: updatedMilestones,
    };

    onUpdateProject(updatedProject);
  };

  // Client Authorization Handler (Hiring Client / Accounts Payable side)
  const handleAuthorizeMilestone = async (milestone: ProjectMilestone) => {
    if (!onUpdateProject || isIncoming) return;
    setSettlementError('');

    const blockReason = getSettlementBlockReason(envelope, project.status);
    if (blockReason) {
      const isKillSwitch = envelope.killSwitchActive;
      setSettlementError(blockReason);
      onAddLog({
        id: `log-auth-blocked-${Date.now()}`,
        timestamp: new Date().toISOString(),
        projectId: project.id,
        projectName: project.name,
        agentRole: 'GUARDRAIL',
        action: `Settlement blocked: ${blockReason}`,
        amountUSD: 0,
        recipientEmail: project.vendorEmail,
        auditConfidenceScore: 0,
        status: isKillSwitch ? 'KILL_SWITCH_REVOKED' : 'CONTRACT_FROZEN',
        riskLevel: isKillSwitch ? 'CRITICAL' : 'HIGH',
      });
      return;
    }

    const settlement = await onSettleMilestone(project.id, milestone.id);
    if (!settlement.ok) {
      setSettlementError(settlement.error);
      onAddLog({
        id: `log-auth-rejected-${Date.now()}`,
        timestamp: new Date().toISOString(),
        projectId: project.id,
        projectName: project.name,
        agentRole: 'GUARDRAIL',
        action: `Server settlement rejected: ${settlement.error}`,
        amountUSD: 0,
        recipientEmail: project.vendorEmail,
        auditConfidenceScore: milestone.auditScore ?? 0,
        status: 'REJECTED',
        riskLevel: 'HIGH',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Project Navigation & Control Header */}
      <div className="bg-[#16181D] border border-amber-500/20 rounded-xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPortfolio}
            className="flex items-center gap-1.5 bg-[#252830] hover:bg-amber-500/10 text-amber-400 font-semibold text-xs px-3 py-2 rounded-lg border border-amber-500/30 transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Portfolio</span>
          </button>

          <div className="h-6 w-px bg-slate-800 hidden md:block" />

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">
                {project.name}
              </h2>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  project.status === 'ACTIVE'
                    ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40'
                    : 'bg-amber-950/60 text-amber-400 border-amber-500/40'
                }`}
              >
                {project.status === 'ACTIVE' ? '⚡ ACTIVE' : '⏸️ PAUSED'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${
                  isIncoming
                    ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {isIncoming ? '🛠️ Role: Contractor (Escrow Beneficiary)' : '💼 Role: Client (Escrow Funder)'}
              </span>
              {project.contractType === 'MSA_SOW' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-purple-950/50 text-purple-300 border border-purple-500/30">
                  📜 Binding MSA & SOW ({project.contractReferenceId || 'Enforced'})
                </span>
              )}
              {project.isSubcontracted && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-indigo-950/50 text-indigo-300 border border-indigo-500/30">
                  🔀 Subcontracted from {parentProject?.name || 'linked master contract'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              {isIncoming ? (
                <>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                    Client (Payer): <strong className="text-white">{project.clientName || 'Corporate Buyer'}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <strong className="text-slate-300 font-mono">{project.clientEmail || 'treasury@client.example'}</strong>
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-amber-500/70" />
                    Contractor (Vendor): <strong className="text-white">{project.vendorName}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <strong className="text-slate-300 font-mono">{project.vendorEmail}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-[#0F1115] border border-amber-500/20 px-3.5 py-2 rounded-lg">
            <div className="flex items-center text-slate-300">
              <Lock className="w-3.5 h-3.5 text-amber-400 mr-1" />
              <span>{isIncoming ? 'Contract Value:' : 'Envelope Ceiling:'} </span>
              <strong className="text-white ml-1 font-mono">${project.budgetCapUSD.toFixed(2)} USD</strong>
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center text-slate-300">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 mr-0.5" />
              <span>Settled:</span>
              <strong className="text-emerald-400 ml-1 font-mono">${project.spentUSD.toFixed(2)}</strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[10px] font-mono px-2 py-1 rounded-lg border border-amber-500/30 bg-amber-950/40 text-amber-300"
              title="Milestones at or below this amount settle autonomously after a passing audit; larger amounts require human-in-the-loop authorization."
            >
              Autonomous Release Ceiling: ≤ ${AUTONOMOUS_SETTLEMENT_CAP_USD.toFixed(2)}
            </span>
            <span className={`text-[10px] font-mono px-2 py-1 rounded-lg border ${railInfo.className} ${railInfo.tone}`}>
              {railInfo.label}
            </span>
          </div>

          {!isIncoming && (
            <button
              onClick={() => onToggleProjectFreeze(project.id)}
              className={`text-xs px-3.5 py-2 rounded-lg border font-bold flex items-center gap-1.5 transition-all active:scale-95 ${
                project.status === 'PAUSED'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white border-amber-400/40'
                  : 'bg-[#252830] hover:bg-[#2d313c] text-amber-200 border-amber-500/30'
              }`}
            >
              {project.status === 'PAUSED' ? (
                <>
                  <PlayCircle className="w-4 h-4 text-amber-300" />
                  <span>Resume Settlements</span>
                </>
              ) : (
                <>
                  <PauseCircle className="w-4 h-4 text-amber-400" />
                  <span>Freeze Settlements</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {settlementError && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-xs text-rose-300 flex items-center justify-between gap-3">
          <span>{settlementError}</span>
          <button
            type="button"
            onClick={() => setSettlementError('')}
            className="text-rose-300 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Milestone Phases & Scheduled Settlement Timeline */}
      <div className="bg-[#16181D] border border-amber-500/20 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#252830]">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Milestone Escrow & Proof-of-Execution Timeline
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Total Envelope Ceiling: <strong className="text-white font-mono">${project.budgetCapUSD.toFixed(2)} USD</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(project.milestones || []).map((ms) => {
            const isCompleted = ms.status === 'COMPLETED';
            const isAuditedPending = ms.status === 'AUDITED_PENDING_APPROVAL';
            const isPending = ms.status === 'PENDING';

            return (
              <div
                key={ms.id}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                  isCompleted
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                    : isAuditedPending
                    ? 'bg-amber-500/15 border-amber-400 text-amber-200 ring-2 ring-amber-400/40 shadow-lg shadow-amber-500/10'
                    : isPending
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 ring-1 ring-amber-500/30'
                    : 'bg-[#0F1115] border-[#252830] text-slate-500 opacity-60'
                }`}
              >
                {/* Milestone Header */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
                    {ms.title.split(':')[0] || `Phase ${ms.phaseNumber}`}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      isCompleted
                        ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50'
                        : isAuditedPending
                        ? 'bg-amber-950 text-amber-300 border-amber-400 shadow-sm animate-pulse'
                        : isPending
                        ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                        : 'bg-slate-900 text-slate-500 border-slate-700'
                    }`}
                  >
                    {isCompleted
                      ? '✅ SETTLED'
                      : isAuditedPending
                      ? '🛡️ CLIENT AUTHORIZATION REQ.'
                      : isPending
                      ? '⏳ READY FOR AUDIT'
                      : '🔒 MILESTONE LOCKED'}
                  </span>
                </div>

                {/* Title & Description */}
                <div>
                  <h4 className="text-xs font-bold text-white mb-1">
                    {ms.title.split(':')[1] || ms.title}
                  </h4>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {ms.description}
                  </p>
                </div>

                {/* Acceptance Criteria Box */}
                <div className="bg-[#0F1115] border border-white/5 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <FileText className="w-3 h-3 text-amber-400" />
                      Acceptance Criteria:
                    </span>
                    {!isIncoming && (
                      <button
                        onClick={() => setEditingMilestone(ms)}
                        className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-0.5 font-semibold transition"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed italic">
                    {ms.acceptanceCriteria || 'Standard specifications: Deliverable must meet architecture and quality criteria.'}
                  </p>
                </div>

                {/* Completed Details or Action Buttons */}
                {isCompleted ? (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Confidence Score:
                      </span>
                      <strong className="font-mono text-emerald-300 font-bold">
                        {ms.auditScore != null ? `${ms.auditScore}%` : '—'}
                      </strong>
                    </div>

                    {ms.deliverableProof && (
                      <div className="text-[10px] text-slate-400 truncate flex items-center gap-1 bg-black/30 p-1.5 rounded">
                        <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="truncate">{ms.deliverableProof}</span>
                      </div>
                    )}

                    {ms.payPalBatchId && (
                      <div className="text-[10px] font-mono text-emerald-400/90 truncate bg-black/40 px-2 py-1 rounded border border-emerald-500/20">
                        Settlement Ref: {ms.payPalBatchId}
                      </div>
                    )}
                  </div>
                ) : isAuditedPending ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px] bg-amber-950/40 px-2.5 py-1 rounded border border-amber-500/30">
                      <span className="text-amber-300 font-semibold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        Audit Approved:
                      </span>
                      <strong className="font-mono text-amber-300 font-bold">
                        {ms.auditScore != null ? `${ms.auditScore}%` : '—'}
                      </strong>
                    </div>
                    {!isIncoming ? (
                      <button
                        onClick={() => handleAuthorizeMilestone(ms)}
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Authorize Settlement (${ms.amountUSD.toFixed(2)})</span>
                      </button>
                    ) : (
                      <div className="w-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-semibold py-2 px-2.5 rounded-lg text-center flex items-center justify-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Audit Approved{ms.auditScore != null ? ` (${ms.auditScore}%)` : ''}. Awaiting client authorization.</span>
                      </div>
                    )}
                  </div>
                ) : isPending ? (
                  <div className="pt-2">
                    {isIncoming ? (
                      <button
                        onClick={() => setSubmittingMilestone(ms)}
                        className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Deliverable for Audit</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setSubmittingMilestone(ms)}
                        className="w-full bg-[#252830] hover:bg-amber-500/10 text-amber-300 hover:text-amber-200 border border-amber-500/30 font-bold text-xs py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        <span>Inspect & Audit Deliverable</span>
                      </button>
                    )}
                  </div>
                ) : null}

                {/* Payout Footer */}
                <div className="pt-2 border-t border-current/10 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-400">Milestone Value:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    ${ms.amountUSD.toFixed(2)} USD
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Workspace Layout (Left: Negotiation Chat, Right: Audit Ledger) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Agentic Commerce Assistant */}
        <div className="lg:col-span-5 h-[540px]">
          <AgentChat
            key={project.id}
            envelope={envelope}
            projects={projects}
            selectedProjectId={project.id}
            onToggleProjectFreeze={onToggleProjectFreeze}
            onAddLog={onAddLog}
          />
        </div>

        {/* Right Column: Multi-Contract Audit Ledger */}
        <div className="lg:col-span-7 h-[540px]">
          <CommandCenter
            logs={logs.filter((l) => l.projectId === project.id)}
            onToggleProjectFreeze={onToggleProjectFreeze}
            canManageEscrow={!isIncoming}
          />
        </div>
      </div>

      {/* Modals */}
      {editingMilestone && (
        <EditCriteriaModal
          milestone={editingMilestone}
          onClose={() => setEditingMilestone(null)}
          onSave={handleSaveCriteria}
        />
      )}

      {submittingMilestone && (
        <SubmitProofModal
          milestone={submittingMilestone}
          project={project}
          envelope={envelope}
          onClose={() => setSubmittingMilestone(null)}
          onAuditSuccess={handleAuditSuccess}
          onAddLog={onAddLog}
          onSettleMilestone={onSettleMilestone}
        />
      )}
    </div>
  );
};
