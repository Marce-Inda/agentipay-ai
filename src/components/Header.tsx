'use client';

import React from 'react';
import { Shield, ShieldAlert, Zap, Lock, DollarSign, CheckCircle2, FolderGit2, FolderPlus, UserCheck, Building2, User, RotateCcw } from 'lucide-react';
import { BudgetEnvelope, ProjectContract, UserProfile } from '../lib/types';

interface HeaderProps {
  envelope: BudgetEnvelope;
  projects: ProjectContract[];
  selectedProjectId: string;
  currentProfile: UserProfile;
  onSelectProject: (projectId: string) => void;
  onOpenCreateProject: () => void;
  onToggleKillSwitch: () => void;
  onOpenOnboarding: () => void;
  onResetDemoData?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  envelope,
  projects,
  selectedProjectId,
  currentProfile,
  onSelectProject,
  onOpenCreateProject,
  onToggleKillSwitch,
  onOpenOnboarding,
  onResetDemoData,
}) => {
  const activeProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <header className="bg-[#16181d] border-b border-amber-900/30 text-white px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50 shadow-2xl">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3">
        <div className="bg-gradient-to-tr from-amber-700 via-amber-600 to-yellow-500 p-2.5 rounded-xl shadow-lg shadow-amber-900/40">
          <Zap className="w-6 h-6 text-slate-950 fill-slate-950" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent">
              AgenticPay AI
            </h1>
            <span className="bg-amber-950/80 text-amber-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-600/40">
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
            currentProfile.role === 'BUSINESS'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
              : 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20'
          }`}
          title="Click to Switch SaaS Account Profile (Business vs Freelancer)"
        >
          {currentProfile.role === 'BUSINESS' ? (
            <Building2 className="w-4 h-4 text-amber-400" />
          ) : (
            <User className="w-4 h-4 text-cyan-400" />
          )}
          <span>{currentProfile.name}</span>
          <span className="text-[10px] opacity-75 font-mono px-1.5 py-0.5 rounded bg-black/40 border border-current">
            {currentProfile.role}
          </span>
        </button>
        {/* Project Selector Dropdown */}
        <div className="flex items-center gap-1.5 bg-[#0f1115] border border-amber-900/40 px-3 py-1.5 rounded-lg shadow-inner">
          <FolderGit2 className="w-4 h-4 text-amber-500" />
          <span className="text-slate-400 font-medium">Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => onSelectProject(e.target.value)}
            className="bg-transparent text-amber-200 font-bold text-xs focus:outline-none cursor-pointer"
          >
            <option value="ALL" className="bg-[#16181d] text-white">
              📁 All Active Contracts ({projects.length})
            </option>
            {projects.map((proj) => (
              <option key={proj.id} value={proj.id} className="bg-[#16181d] text-white">
                {proj.status === 'PAUSED' ? '⏸️' : '⚡'} {proj.name} (${proj.budgetCapUSD})
              </option>
            ))}
          </select>
        </div>

        {/* Create New Project Button */}
        <button
          onClick={onOpenCreateProject}
          className="flex items-center gap-1.5 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-md active:scale-95"
        >
          <FolderPlus className="w-4 h-4 text-slate-950" />
          <span>New Project</span>
        </button>

        {/* Status Badge */}
        <div className="flex items-center gap-2 bg-[#0f1115] border border-slate-800 px-3 py-1.5 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-300 font-medium">Escrow Status:</span>
          <span className="text-emerald-400 font-bold">
            {activeProject ? activeProject.status : 'Active (Multi)'}
          </span>
        </div>

        {/* Vault Envelope Indicators */}
        <div className="flex items-center gap-3 bg-[#0f1115] border border-slate-800 px-3.5 py-1.5 rounded-lg">
          <div className="flex items-center text-slate-300">
            <Lock className="w-3.5 h-3.5 text-amber-500 mr-1" />
            <span>Cap: </span>
            <strong className="text-white ml-1">
              ${activeProject ? activeProject.budgetCapUSD : envelope.maxPerTransactionUSD} USD
            </strong>
          </div>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center text-slate-300">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400 mr-0.5" />
            <span>Spent: </span>
            <strong className="text-emerald-400 ml-1">
              ${activeProject ? activeProject.spentUSD.toFixed(2) : envelope.spentTodayUSD.toFixed(2)}
            </strong>
          </div>
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

        {/* Reset Demo Data Button */}
        {onResetDemoData && (
          <button
            onClick={onResetDemoData}
            className="flex items-center gap-1.5 bg-[#0f1115] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 px-3 py-2 rounded-lg font-semibold transition-all active:scale-95"
            title="Reset demo data back to initial state"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden lg:inline">Reset Demo</span>
          </button>
        )}
      </div>
    </header>
  );
};
