'use client';

import React from 'react';
import { ArrowLeft, Building2, User, Lock, DollarSign, CheckCircle2, PauseCircle, PlayCircle, ShieldCheck } from 'lucide-react';
import { BudgetEnvelope, ProjectContract, TransactionLog } from '../lib/types';
import { AgentChat } from './AgentChat';
import { CommandCenter } from './CommandCenter';

interface ProjectWorkspaceViewProps {
  project: ProjectContract;
  envelope: BudgetEnvelope;
  projects: ProjectContract[];
  logs: TransactionLog[];
  onBackToPortfolio: () => void;
  onSelectProject: (projectId: string) => void;
  onToggleProjectFreeze: (projectId: string) => void;
  onUpdateEnvelope: (newEnvelope: BudgetEnvelope) => void;
  onAddLog: (log: TransactionLog) => void;
}

export const ProjectWorkspaceView: React.FC<ProjectWorkspaceViewProps> = ({
  project,
  envelope,
  projects,
  logs,
  onBackToPortfolio,
  onSelectProject,
  onToggleProjectFreeze,
  onUpdateEnvelope,
  onAddLog,
}) => {
  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Project Navigation & Control Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToPortfolio}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 font-semibold text-xs px-3 py-2 rounded-lg border border-cyan-500/30 transition-all active:scale-95"
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
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700/50'
                    : 'bg-amber-950 text-amber-300 border-amber-700/50'
                }`}
              >
                {project.status === 'ACTIVE' ? '⚡ ACTIVE' : '⏸️ PAUSED'}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              <span className="flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
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
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3.5 py-2 rounded-lg">
            <div className="flex items-center text-slate-300">
              <Lock className="w-3.5 h-3.5 text-cyan-400 mr-1" />
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
                ? 'bg-amber-950 text-amber-300 border-amber-500/40 hover:bg-amber-900'
                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
            }`}
          >
            {project.status === 'PAUSED' ? (
              <>
                <PlayCircle className="w-4 h-4 text-amber-400" />
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
