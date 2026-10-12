'use client';

import React, { useState } from 'react';
import { 
  FolderPlus, 
  ShieldCheck, 
  Zap, 
  Lock, 
  DollarSign, 
  ArrowRight, 
  PauseCircle, 
  PlayCircle, 
  CheckCircle2, 
  User, 
  Building2, 
  Search, 
  FileCheck, 
  GitFork, 
  ArrowDownLeft, 
  ArrowUpRight,
} from 'lucide-react';
import { BudgetEnvelope, ProjectContract, UserProfile } from '../lib/types';

interface ProjectPortfolioViewProps {
  envelope: BudgetEnvelope;
  projects: ProjectContract[];
  currentProfile?: UserProfile;
  onSelectProject: (projectId: string) => void;
  onOpenCreateModal: () => void;
  onToggleProjectFreeze: (projectId: string) => void;
}

export const ProjectPortfolioView: React.FC<ProjectPortfolioViewProps> = ({
  envelope,
  projects,
  currentProfile,
  onSelectProject,
  onOpenCreateModal,
  onToggleProjectFreeze,
}) => {
  const [perspectiveTab, setPerspectiveTab] = useState<'ALL' | 'OUTGOING' | 'INCOMING'>('OUTGOING');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const isBusiness = currentProfile?.role === 'BUSINESS' || currentProfile?.accountType === 'BUSINESS';

  const outgoingProjects = projects.filter((p) => p.perspective !== 'INCOMING');
  const incomingProjects = projects.filter((p) => p.perspective === 'INCOMING');

  const filteredProjects = projects.filter((p) => {
    // 1. Perspective tab filter
    if (perspectiveTab === 'OUTGOING' && p.perspective === 'INCOMING') return false;
    if (perspectiveTab === 'INCOMING' && p.perspective !== 'INCOMING') return false;

    // 2. Status filter
    const matchesFilter =
      filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && p.status === 'ACTIVE') ||
      (filterStatus === 'PAUSED' && p.status === 'PAUSED');

    // 3. Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(searchLower) ||
      p.vendorName.toLowerCase().includes(searchLower) ||
      p.vendorEmail.toLowerCase().includes(searchLower) ||
      (p.clientName && p.clientName.toLowerCase().includes(searchLower));

    return matchesFilter && matchesSearch;
  });

  const totalVaultCap = filteredProjects.reduce((acc, p) => acc + p.budgetCapUSD, 0);
  const totalSpent = filteredProjects.reduce((acc, p) => acc + p.spentUSD, 0);
  const activeCount = filteredProjects.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Active Account Legal Entity & Compliance Banner */}
      <div
        className={`p-5 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl ${
          isBusiness
            ? 'bg-gradient-to-r from-amber-950/70 via-[#16181d] to-amber-950/40 border-amber-500/40 text-amber-200'
            : 'bg-gradient-to-r from-cyan-950/70 via-[#16181d] to-cyan-950/40 border-cyan-500/40 text-cyan-200'
        }`}
      >
        <div className="flex items-center gap-3.5">
          <div
            className={`p-3 rounded-xl border font-bold text-lg shadow-inner ${
              isBusiness
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
            }`}
          >
            {isBusiness ? <Building2 className="w-6 h-6" /> : <User className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded font-mono bg-black/50 border border-current">
                {isBusiness ? '🏢 Enterprise Business Account' : '👤 Individual Professional Account'}
              </span>
              <span className="text-sm font-bold text-white">
                {currentProfile?.legalCompanyName || currentProfile?.name}
              </span>
              {currentProfile?.taxId && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 border border-slate-700 text-slate-300">
                  Tax ID: {currentProfile.taxId}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              {isBusiness
                ? 'Corporate governance active: Issues binding MSA & SOW contracts, manages tax compliance, and administers parallel inbound/outbound escrow envelopes.'
                : 'Agile independent mode: Delivers client contracts with guaranteed escrow lock, and securely subcontracts specialized contributors.'}
            </p>
          </div>
        </div>

        <div className="text-right text-xs font-mono shrink-0 bg-black/30 p-2.5 rounded-xl border border-current/20">
          <span className="text-slate-400 block text-[11px]">PayPal Settlement Account:</span>
          <span className="font-bold text-white text-xs">{currentProfile?.payPalAccountEmail || 'sandbox@paypal.com'}</span>
          <span className="text-[10px] text-emerald-400 flex items-center justify-end gap-1 mt-0.5 font-sans">
            <CheckCircle2 className="w-3 h-3" /> Compliance Status: {currentProfile?.complianceStatus || 'VERIFIED'}
          </span>
        </div>
      </div>

      {/* DUAL PERSPECTIVE SELECTOR (Contracts I Manage vs Contracts I Deliver) */}
      <div className="bg-[#16181d] border border-amber-900/40 rounded-2xl p-2 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Tab 1: Contracts I Manage (Hiring / Outbound) */}
          <button
            onClick={() => setPerspectiveTab('OUTGOING')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              perspectiveTab === 'OUTGOING'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-900/40 ring-1 ring-amber-400/50'
                : 'text-slate-400 hover:text-white hover:bg-[#252830]'
            }`}
          >
            <ArrowUpRight className="w-4 h-4 text-amber-300" />
            <span>💼 Contracts I Manage (Hiring)</span>
            <span className="bg-black/40 text-amber-300 px-2 py-0.5 rounded-full text-[10px] font-mono border border-amber-500/30">
              {outgoingProjects.length}
            </span>
          </button>

          {/* Tab 2: Contracts I Deliver (Contractor / Inbound) */}
          <button
            onClick={() => setPerspectiveTab('INCOMING')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              perspectiveTab === 'INCOMING'
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow-lg shadow-cyan-900/40 ring-1 ring-cyan-400/50'
                : 'text-slate-400 hover:text-white hover:bg-[#252830]'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4 text-cyan-300" />
            <span>🛠️ Contracts I Deliver (Contractor)</span>
            <span className="bg-black/40 text-cyan-300 px-2 py-0.5 rounded-full text-[10px] font-mono border border-cyan-500/30">
              {incomingProjects.length}
            </span>
          </button>

          {/* Tab 3: All Contracts */}
          <button
            onClick={() => setPerspectiveTab('ALL')}
            className={`px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              perspectiveTab === 'ALL'
                ? 'bg-slate-800 text-white shadow'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            🌐 All ({projects.length})
          </button>
        </div>

        {/* Action Button: Create / Subcontract */}
        <button
          onClick={onOpenCreateModal}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95 whitespace-nowrap"
        >
          <FolderPlus className="w-4 h-4 text-slate-950" />
          <span>+ New Contract / Subcontract</span>
        </button>
      </div>

      {/* KPI Global Portfolio Metrics Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Total Active Projects in View */}
        <div className="bg-gradient-to-br from-[#16181d] to-[#1c1f27] border border-amber-900/30 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">
              {perspectiveTab === 'INCOMING' ? 'Assigned Contracts Active' : 'Active Initiatives'}
            </span>
            <span className="text-2xl font-bold text-white font-mono">{activeCount}</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">of {filteredProjects.length} shown contracts</span>
          </div>
          <div className="p-3 bg-amber-950/60 border border-amber-800/40 rounded-xl text-amber-500">
            <Zap className="w-5 h-5 fill-amber-500/20" />
          </div>
        </div>

        {/* Metric 2: Total Escrow Cap */}
        <div className="bg-gradient-to-br from-[#16181d] to-[#1c1f27] border border-amber-900/30 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">
              {perspectiveTab === 'INCOMING' ? 'Client Guaranteed Escrow' : 'Pre-Authorized Vault Cap'}
            </span>
            <span className="text-2xl font-bold text-amber-400 font-mono">${totalVaultCap.toFixed(2)} USD</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">
              {perspectiveTab === 'INCOMING' ? 'Protected in PayPal Vault' : 'Secured Escrow Envelopes'}
            </span>
          </div>
          <div className="p-3 bg-amber-950/60 border border-amber-800/40 rounded-xl text-amber-500">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Total Funds Settled */}
        <div className="bg-gradient-to-br from-[#16181d] to-[#1c1f27] border border-amber-900/30 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">
              {perspectiveTab === 'INCOMING' ? 'Milestone Payouts Claimed' : 'Released Escrow Settlements'}
            </span>
            <span className="text-2xl font-bold text-emerald-400 font-mono">${totalSpent.toFixed(2)} USD</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Settled via PayPal REST API</span>
          </div>
          <div className="p-3 bg-emerald-950/60 border border-emerald-800/40 rounded-xl text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: Protection Shield Status */}
        <div className="bg-gradient-to-br from-[#16181d] to-[#1c1f27] border border-amber-900/30 rounded-xl p-4 shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">AI Audit & Safety Guard</span>
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-4 h-4" /> 100% Protected
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Zero-Trust Guardrails</span>
          </div>
          <div className="p-3 bg-[#0f1115] border border-slate-800 rounded-xl text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar & Filter Bar */}
      <div className="bg-[#16181d] border border-amber-900/30 rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="flex items-center gap-2 bg-[#0f1115] border border-slate-800 rounded-lg px-3 py-2 text-xs w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by project, client, or vendor..."
            className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center bg-[#0f1115] border border-slate-800 p-1 rounded-lg text-xs">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              filterStatus === 'ALL'
                ? 'bg-gradient-to-r from-amber-700 to-amber-600 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({filteredProjects.length})
          </button>
          <button
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              filterStatus === 'ACTIVE'
                ? 'bg-gradient-to-r from-amber-700 to-amber-600 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active ({filteredProjects.filter((p) => p.status === 'ACTIVE').length})
          </button>
          <button
            onClick={() => setFilterStatus('PAUSED')}
            className={`px-3 py-1 rounded-md font-semibold transition-all ${
              filterStatus === 'PAUSED'
                ? 'bg-gradient-to-r from-amber-700 to-amber-600 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Paused ({filteredProjects.filter((p) => p.status === 'PAUSED').length})
          </button>
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => {
          const percentSpent = Math.min(100, Math.round((project.spentUSD / project.budgetCapUSD) * 100));
          const isIncoming = project.perspective === 'INCOMING';

          return (
            <div
              key={project.id}
              className={`border rounded-2xl p-5 shadow-xl transition-all hover:shadow-2xl flex flex-col justify-between space-y-4 group ${
                isIncoming
                  ? 'bg-gradient-to-br from-[#121b24] via-[#16181d] to-[#12222d] border-cyan-500/30 hover:border-cyan-400/60'
                  : 'bg-gradient-to-br from-[#16181d] via-[#1a1d24] to-[#251d14] border-amber-900/30 hover:border-amber-500/50'
              }`}
            >
              {/* Card Top: Badges & Title */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Perspective Pill */}
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono border ${
                        isIncoming
                          ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                          : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {isIncoming ? '🛠️ ASSIGNED CONTRACT' : '💼 DIRECT HIRE'}
                    </span>

                    {/* Subcontracted Pill */}
                    {project.isSubcontracted && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-purple-950/80 text-purple-300 border border-purple-500/40 flex items-center gap-1">
                        <GitFork className="w-2.5 h-2.5" /> SUBCONTRACTED
                      </span>
                    )}
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${
                      project.status === 'ACTIVE'
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/50'
                        : 'bg-amber-950/80 text-amber-300 border-amber-700/50'
                    }`}
                  >
                    {project.status === 'ACTIVE' ? '⚡ ACTIVE' : '⏸️ PAUSED'}
                  </span>
                </div>

                <h3 className="font-bold text-base text-white group-hover:text-amber-400 transition-colors line-clamp-1 mb-2">
                  {project.name}
                </h3>

                {/* Legal Contract & Parties Information */}
                <div className="space-y-1.5 text-xs text-slate-400 mb-3 bg-[#0F1115]/70 p-2.5 rounded-xl border border-slate-800">
                  {project.contractType === 'MSA_SOW' && (
                    <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-mono mb-1">
                      <FileCheck className="w-3.5 h-3.5 shrink-0" />
                      <span>Binding Legal Contract: {project.contractReferenceId || 'MSA & SOW'}</span>
                    </div>
                  )}

                  {isIncoming ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span>Client (Payer): <strong className="text-white">{project.clientName || 'Corporate Buyer'}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-slate-300 font-mono text-[11px]">{project.clientEmail || 'treasury@client.example'}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Contractor: <strong className="text-white">{project.vendorName}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-slate-300 font-mono text-[11px]">{project.vendorEmail}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Budget Progress Bar */}
                <div className="space-y-1.5 bg-[#0f1115] p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">
                      {isIncoming ? 'Claimed Funds / Escrow Cap:' : 'Vault Budget Consumed:'}
                    </span>
                    <span className="text-emerald-400 font-mono">
                      ${project.spentUSD.toFixed(2)} / ${project.budgetCapUSD.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isIncoming
                          ? 'bg-gradient-to-r from-cyan-600 via-cyan-400 to-emerald-400'
                          : 'bg-gradient-to-r from-amber-600 via-amber-500 to-emerald-400'
                      }`}
                      style={{ width: `${percentSpent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer: Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 gap-2">
                <button
                  onClick={() => onToggleProjectFreeze(project.id)}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold flex items-center gap-1 transition-all ${
                    project.status === 'PAUSED'
                      ? 'bg-amber-950 text-amber-300 border-amber-500/40 hover:bg-amber-900'
                      : 'bg-[#0f1115] hover:bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                  title="Freeze or resume contract releases"
                >
                  {project.status === 'PAUSED' ? (
                    <>
                      <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <PauseCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>Pause</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => onSelectProject(project.id)}
                  className={`font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95 ${
                    isIncoming
                      ? 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950'
                      : 'bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-slate-950'
                  }`}
                >
                  <span>{isIncoming ? 'Deliver & Claim Payout' : 'Manage Escrow Vault'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
