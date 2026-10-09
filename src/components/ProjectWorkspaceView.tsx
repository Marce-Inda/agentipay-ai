'use client';

import React from 'react';
import { ArrowLeft, Building2, User, Lock, DollarSign, CheckCircle2, PauseCircle, PlayCircle, ShieldCheck, Layers } from 'lucide-react';
import { BudgetEnvelope, ProjectContract, TransactionLog, UserProfile } from '../lib/types';
import { AgentChat } from './AgentChat';
import { CommandCenter } from './CommandCenter';

interface ProjectWorkspaceViewProps {
  project: ProjectContract;
  envelope: BudgetEnvelope;
  projects: ProjectContract[];
  logs: TransactionLog[];
  currentProfile?: UserProfile;
  onBackToPortfolio: () => void;
  onSelectProject: (projectId: string) => void;
  onToggleProjectFreeze: (projectId: string) => void;
  onUpdateEnvelope: (newEnvelope: BudgetEnvelope) => void;
  onAddLog: (log: TransactionLog) => void;
}

interface DeliverableAuditFormProps {
  project: ProjectContract;
  onAddLog: (log: TransactionLog) => void;
}

const DeliverableAuditForm: React.FC<DeliverableAuditFormProps> = ({ project, onAddLog }) => {
  const [deliverableText, setDeliverableText] = React.useState('');
  const [isAuditing, setIsAuditing] = React.useState(false);
  const [auditResult, setAuditResult] = React.useState<{
    success: boolean;
    auditConfidenceScore: number;
    reason: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } | null>(null);

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverableText.trim() || isAuditing) return;

    setIsAuditing(true);
    setAuditResult(null);

    try {
      const res = await fetch('/api/agent/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deliverableText,
          expectedRequirements: `Milestone completion for ${project.name}`,
        }),
      });

      const data = await res.json();
      setAuditResult(data);

      onAddLog({
        id: `log-audit-${Date.now()}`,
        timestamp: new Date().toISOString(),
        projectId: project.id,
        projectName: project.name,
        agentRole: 'BUYER_AI',
        action: `Multimodal Deliverable Audit Evaluated (Score: ${data.auditConfidenceScore || 0}%) - ${data.reason || ''}`,
        amountUSD: 0,
        recipientEmail: project.vendorEmail,
        auditConfidenceScore: data.auditConfidenceScore || 0,
        status: data.success ? 'AUDITING_DELIVERABLE' : 'GUARDRAIL_CHECKING',
        riskLevel: data.riskLevel || 'LOW',
      });
    } catch (err: any) {
      console.error('[Audit Form Error]:', err);
    } finally {
      setIsAuditing(false);
    }
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleRunAudit} className="flex flex-col md:flex-row gap-3">
        <input
          type="text"
          value={deliverableText}
          onChange={(e) => setDeliverableText(e.target.value)}
          placeholder="Paste Pull Request URL, code diff snippet, or deliverable proof text..."
          className="flex-1 bg-[#0F1115] border border-[#252830] focus:border-amber-500/50 rounded-lg px-3.5 py-2 text-xs text-white placeholder-slate-500 outline-none"
        />
        <button
          type="submit"
          disabled={isAuditing || !deliverableText.trim()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
        >
          {isAuditing ? 'Auditing Deliverable...' : 'Run Audit Inspection'}
        </button>
      </form>

      {auditResult && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            auditResult.success
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">Score: {auditResult.auditConfidenceScore}%</span>
            <span>—</span>
            <span>{auditResult.reason}</span>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/40 border border-current">
            Risk: {auditResult.riskLevel}
          </span>
        </div>
      )}
    </div>
  );
};

export const ProjectWorkspaceView: React.FC<ProjectWorkspaceViewProps> = ({
  project,
  envelope,
  projects,
  logs,
  currentProfile,
  onBackToPortfolio,
  onSelectProject,
  onToggleProjectFreeze,
  onUpdateEnvelope,
  onAddLog,
}) => {
  const isBusiness = currentProfile?.role !== 'FREELANCER';

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
            <div className="flex items-center gap-2">
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
                  isBusiness
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                }`}
              >
                {isBusiness ? '🏢 Employer Mode' : '💼 Freelancer Mode'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-amber-500/70" />
                {project.vendorName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <strong className="text-slate-300 font-mono">{project.vendorEmail}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-[#0F1115] border border-amber-500/20 px-3.5 py-2 rounded-lg">
            <div className="flex items-center text-slate-300">
              <Lock className="w-3.5 h-3.5 text-amber-400 mr-1" />
              <span>Vault Cap: </span>
              <strong className="text-white ml-1">${project.budgetCapUSD.toFixed(2)} USD</strong>
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center text-slate-300">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 mr-0.5" />
              <span>Spent: </span>
              <strong className="text-emerald-400 ml-1">${project.spentUSD.toFixed(2)}</strong>
            </div>
          </div>

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
                <span>Resume Contract Escrow</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4 text-amber-400" />
                <span>Freeze Contract Escrow</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Milestone Phases & Partial Payouts Timeline */}
      <div className="bg-[#16181D] border border-amber-500/20 rounded-xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-[#252830]">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Hitos del Proyecto y Pagos Parciales (Milestone Escrow Timeline)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Total Presupuesto Vault: <strong className="text-white">${project.budgetCapUSD.toFixed(2)} USD</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(project.milestones || []).map((ms) => (
            <div
              key={ms.id}
              className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                ms.status === 'COMPLETED'
                  ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                  : ms.status === 'PENDING'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-200 ring-1 ring-amber-500/30'
                  : 'bg-[#0F1115] border-[#252830] text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider font-mono">
                  {ms.title.split(':')[0] || `Phase ${ms.phaseNumber}`}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    ms.status === 'COMPLETED'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-500/50'
                      : ms.status === 'PENDING'
                      ? 'bg-amber-950 text-amber-300 border-amber-500/50'
                      : 'bg-slate-900 text-slate-500 border-slate-700'
                  }`}
                >
                  {ms.status === 'COMPLETED'
                    ? '✅ PAGADO'
                    : ms.status === 'PENDING'
                    ? '⏳ EN AUDITORÍA'
                    : '🔒 BLOQUEADO'}
                </span>
              </div>

              <div>
                <h4 className="text-xs font-bold text-white mb-1">
                  {ms.title.split(':')[1] || ms.title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {ms.description}
                </p>
              </div>

              <div className="pt-2 border-t border-current/10 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">Pago Parcial:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  ${ms.amountUSD.toFixed(2)} USD
                </span>
              </div>

              {ms.payPalBatchId && (
                <div className="text-[10px] font-mono text-emerald-400/90 truncate bg-black/40 px-2 py-1 rounded border border-emerald-500/20">
                  PayPal Batch: {ms.payPalBatchId}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Deliverable Proof-of-Execution Audit Panel */}
      <div className="bg-[#16181D] border border-amber-500/20 rounded-xl p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Proof-of-Execution Deliverable Audit (Multimodal Vision/Code Inspection)
            </h3>
          </div>
          <span className="text-xs text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-md border border-amber-500/30">
            Escrow Threshold: ≥ 95% Confidence Required
          </span>
        </div>

        <DeliverableAuditForm project={project} onAddLog={onAddLog} />
      </div>

      {/* Main Workspace Layout (Left: Negotiation Chat, Right: Audit Ledger) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Agentic Commerce Assistant */}
        <div className="lg:col-span-5 h-[540px]">
          <AgentChat
            envelope={envelope}
            projects={projects}
            selectedProjectId={project.id}
            onSelectProject={onSelectProject}
            onToggleProjectFreeze={onToggleProjectFreeze}
            onUpdateEnvelope={onUpdateEnvelope}
            onAddLog={onAddLog}
          />
        </div>

        {/* Right Column: Multi-Contract Audit Ledger */}
        <div className="lg:col-span-7 h-[540px]">
          <CommandCenter
            logs={logs.filter((l) => l.projectId === project.id)}
            onToggleProjectFreeze={onToggleProjectFreeze}
          />
        </div>
      </div>
    </div>
  );
};
