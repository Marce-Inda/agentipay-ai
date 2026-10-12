'use client';

import React from 'react';
import { 
  Shield, 
  ShieldAlert, 
  Zap, 
  Lock, 
  DollarSign, 
  CheckCircle2, 
  FolderGit2, 
  Building2, 
  User,
  ArrowLeft,
  LayoutGrid
} from 'lucide-react';
import { BudgetEnvelope, ProjectContract, UserProfile } from '../lib/types';

interface HeaderProps {
  envelope: BudgetEnvelope;
  projects: ProjectContract[];
  selectedProjectId: string;
  currentProfile: UserProfile;
  activeView: 'PORTFOLIO' | 'PROJECT_WORKSPACE';
  onNavigatePortfolio: () => void;
  onSelectProject: (projectId: string) => void;
  onToggleKillSwitch: () => void;
  onOpenOnboarding: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  envelope,
  projects,
  selectedProjectId,
  currentProfile,
  activeView,
  onNavigatePortfolio,
  onSelectProject,
  onToggleKillSwitch,
  onOpenOnboarding,
}) => {
  const isPortfolio = activeView === 'PORTFOLIO';
  const activeProject = projects.find((p) => p.id === selectedProjectId);

  const totalVaultCap = projects.reduce((acc, p) => acc + p.budgetCapUSD, 0);
  const totalSpent = projects.reduce((acc, p) => acc + p.spentUSD, 0);
  const isBusiness = currentProfile.role === 'BUSINESS' || currentProfile.accountType === 'BUSINESS';

  return (
    <header className="bg-[#16181d] border-b border-amber-900/30 text-white px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50 shadow-2xl">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3 cursor-pointer" onClick={onNavigatePortfolio}>
        <div className="bg-gradient-to-tr from-amber-700 via-amber-600 to-yellow-500 p-2.5 rounded-xl shadow-lg shadow-amber-900/40">
          <Zap className="w-6 h-6 text-slate-950 fill-slate-950" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent">
              AgenticPay AI
            </h1>
            <span className="bg-amber-950/80 text-amber-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-600/40 font-mono">
              Escrow Platform
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Autonomous Budget Protection & Intelligent Settlement
          </p>
        </div>
      </div>

      {/* Multi-Project Selector & Controls */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {/* User Account Role Switcher Badge */}
        <button
          onClick={onOpenOnboarding}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-bold transition-all shadow-inner active:scale-95 ${
            isBusiness
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
              : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20'
          }`}
          title="Click to Switch SaaS Account Profile (Business Enterprise vs Personal)"
        >
          {isBusiness ? (
            <Building2 className="w-4 h-4 text-amber-400" />
          ) : (
            <User className="w-4 h-4 text-cyan-400" />
          )}
          <span>{currentProfile.name}</span>
          <span className="text-[10px] opacity-75 font-mono px-1.5 py-0.5 rounded bg-black/40 border border-current">
            {isBusiness ? 'BUSINESS (Enterprise)' : 'PERSONAL'}
          </span>
          {currentProfile.taxId && (
            <span className="hidden lg:inline text-[9px] font-mono text-slate-400 border border-slate-700 px-1 py-0.5 rounded bg-black/30">
              {currentProfile.taxId}
            </span>
          )}
        </button>

        {/* Project Context Navigation / Selector */}
        {isPortfolio ? (
          /* Portfolio Mode Context Indicator */
          <div className="flex items-center gap-2 bg-[#0f1115] border border-amber-900/40 px-3 py-1.5 rounded-lg shadow-inner">
            <LayoutGrid className="w-4 h-4 text-amber-500" />
            <span className="text-slate-400 font-medium">Context:</span>
            <select
              value="PORTFOLIO"
              onChange={(e) => {
                if (e.target.value !== 'PORTFOLIO') {
                  onSelectProject(e.target.value);
                }
              }}
              className="bg-transparent text-amber-200 font-bold text-xs focus:outline-none cursor-pointer"
            >
              <option value="PORTFOLIO" className="bg-[#16181d] text-white">
                📁 Global Portfolio ({projects.length} Contracts)
              </option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id} className="bg-[#16181d] text-white">
                  ⚡ Open: {proj.name} (${proj.budgetCapUSD})
                </option>
              ))}
            </select>
          </div>
        ) : (
          /* Active Project Workspace Breadcrumb & Switcher */
          <div className="flex items-center gap-2 bg-[#0f1115] border border-cyan-500/40 px-3 py-1.5 rounded-lg shadow-inner">
            <button
              onClick={onNavigatePortfolio}
              className="flex items-center gap-1 text-slate-400 hover:text-white font-medium pr-2 border-r border-slate-800 transition-colors"
              title="Return to Global Portfolio"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
              <span>Portfolio</span>
            </button>
            <FolderGit2 className="w-4 h-4 text-cyan-400" />
            <select
              value={selectedProjectId}
              onChange={(e) => {
                if (e.target.value === 'PORTFOLIO') {
                  onNavigatePortfolio();
                } else {
                  onSelectProject(e.target.value);
                }
              }}
              className="bg-transparent text-cyan-200 font-bold text-xs focus:outline-none cursor-pointer max-w-[180px] truncate"
            >
              <option value="PORTFOLIO" className="bg-[#16181d] text-white">
                📁 All Contracts Overview
              </option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id} className="bg-[#16181d] text-white">
                  {proj.status === 'PAUSED' ? '⏸️' : '⚡'} {proj.name} (${proj.budgetCapUSD})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Dynamic Contextual Metrics (Global Portfolio vs Project Specific) */}
        {isPortfolio ? (
          /* Portfolio-Level Treasury Metrics */
          <div className="flex items-center gap-3 bg-[#0f1115] border border-slate-800 px-3.5 py-1.5 rounded-lg">
            <div className="flex items-center text-slate-300">
              <Lock className="w-3.5 h-3.5 text-amber-500 mr-1" />
              <span>Total Vault Cap: </span>
              <strong className="text-white ml-1 font-mono">${totalVaultCap.toFixed(2)} USD</strong>
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center text-slate-300">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 mr-0.5" />
              <span>Total Settled: </span>
              <strong className="text-emerald-400 ml-1 font-mono">${totalSpent.toFixed(2)}</strong>
            </div>
          </div>
        ) : (
          /* Active Project Scope Metrics */
          <div className="flex items-center gap-3 bg-[#0f1115] border border-cyan-500/30 px-3.5 py-1.5 rounded-lg">
            <div className="flex items-center text-slate-300">
              <Lock className="w-3.5 h-3.5 text-cyan-400 mr-1" />
              <span>Project Cap: </span>
              <strong className="text-white ml-1 font-mono">
                ${activeProject?.budgetCapUSD.toFixed(2)} USD
              </strong>
            </div>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center text-slate-300">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400 mr-0.5" />
              <span>Spent: </span>
              <strong className="text-emerald-400 ml-1 font-mono">
                ${activeProject?.spentUSD.toFixed(2)}
              </strong>
            </div>
          </div>
        )}

        {/* Escrow Status Badge */}
        <div className="flex items-center gap-2 bg-[#0f1115] border border-slate-800 px-3 py-1.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-medium">Status:</span>
          <span className="text-emerald-400 font-bold font-mono">
            {isPortfolio ? 'SYSTEM HEALTHY' : (activeProject?.status || 'ACTIVE')}
          </span>
        </div>

        {/* Master Emergency Kill-Switch Toggle */}
        <button
          onClick={onToggleKillSwitch}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-bold transition-all shadow-md active:scale-95 ${
            envelope.killSwitchActive
              ? 'bg-red-600 hover:bg-red-500 text-white animate-bounce shadow-red-600/50'
              : 'bg-[#0f1115] hover:bg-red-950/40 text-red-400 border border-red-900/40'
          }`}
        >
          {envelope.killSwitchActive ? (
            <>
              <ShieldAlert className="w-4 h-4 text-white" />
              <span>MASTER KILL-SWITCH ACTIVE</span>
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 text-red-400" />
              <span>Master Kill-Switch</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
