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

  const outgoingCap = outgoingProjects.reduce((acc, p) => acc + p.budgetCapUSD, 0);
  const outgoingSpent = outgoingProjects.reduce((acc, p) => acc + p.spentUSD, 0);
  const outgoingActive = outgoingProjects.filter((p) => p.status === 'ACTIVE').length;

  const incomingCap = incomingProjects.reduce((acc, p) => acc + p.budgetCapUSD, 0);
  const incomingClaimed = incomingProjects.reduce((acc, p) => acc + p.spentUSD, 0);
  const incomingActive = incomingProjects.filter((p) => p.status === 'ACTIVE').length;

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

      {/* DUAL EXECUTIVE COMMAND PANELS (Side-by-Side 50/50 Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Panel A: Managed Contracts (Outbound Escrow / Accounts Payable) */}
        <div
          onClick={() => setPerspectiveTab('OUTGOING')}
          className={`relative rounded-2xl p-6 border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between group ${
            perspectiveTab === 'OUTGOING'
              ? 'bg-gradient-to-br from-[#1c1813] via-[#16181d] to-[#141218] border-amber-500 shadow-2xl shadow-amber-950/50 ring-2 ring-amber-500/40'
              : 'bg-[#16181d]/90 border-amber-900/30 hover:border-amber-600/50 hover:bg-[#1a1d24]'
          }`}
        >
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-xl border shadow-inner ${
                    perspectiveTab === 'OUTGOING'
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 group-hover:text-amber-400'
                  }`}
                >
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono bg-amber-950/60 border border-amber-700/50 text-amber-300">
                      Outbound Escrow • Accounts Payable
                    </span>
                    {perspectiveTab === 'OUTGOING' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        ACTIVE WORKSPACE
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors mt-0.5">
                    💼 Managed Contracts (Hiring)
                  </h3>
                </div>
              </div>

              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-black/40 border border-amber-900/40 text-amber-300">
                {outgoingProjects.length} {outgoingProjects.length === 1 ? 'Contract' : 'Contracts'}
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Agreements you sponsor and administer. Funds are pre-authorized in PayPal Vault envelopes and released only upon zero-trust AI audit milestone verification.
            </p>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 bg-[#0F1115]/80 p-3.5 rounded-xl border border-slate-800/80 mb-4">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Vault Cap Authorized</span>
                <span className="text-base font-bold text-amber-400 font-mono">${outgoingCap.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 block">USD Total Limit</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Settled to Vendors</span>
                <span className="text-base font-bold text-emerald-400 font-mono">${outgoingSpent.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 block">USD Released</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Active Governance</span>
                <span className="text-base font-bold text-white font-mono">{outgoingActive} Active</span>
                <span className="text-[10px] text-slate-500 block">of {outgoingProjects.length} total</span>
              </div>
            </div>
          </div>

          {/* Panel Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 mt-1">
            <span className="text-xs text-amber-400/90 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Zero-Trust LLM Guardrails Active</span>
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPerspectiveTab('OUTGOING');
                  onOpenCreateModal();
                }}
                className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition-all shadow-md active:scale-95 whitespace-nowrap"
              >
                <FolderPlus className="w-3.5 h-3.5 text-slate-950" />
                <span>+ New Contract</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPerspectiveTab('OUTGOING');
                }}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                  perspectiveTab === 'OUTGOING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <span>{perspectiveTab === 'OUTGOING' ? 'Viewing Contracts' : 'View Contracts'}</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Panel B: Assigned Contracts (Inbound Receivables / Accounts Receivable) */}
        <div
          onClick={() => setPerspectiveTab('INCOMING')}
          className={`relative rounded-2xl p-6 border transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between group ${
            perspectiveTab === 'INCOMING'
              ? 'bg-gradient-to-br from-[#121b24] via-[#16181d] to-[#12232e] border-cyan-500 shadow-2xl shadow-cyan-950/50 ring-2 ring-cyan-500/40'
              : 'bg-[#16181d]/90 border-cyan-900/30 hover:border-cyan-600/50 hover:bg-[#1a1d24]'
          }`}
        >
          {/* Subtle Accent Glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-3 rounded-xl border shadow-inner ${
                    perspectiveTab === 'INCOMING'
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 group-hover:text-cyan-400'
                  }`}
                >
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono bg-cyan-950/60 border border-cyan-700/50 text-cyan-300">
                      Inbound Escrow • Accounts Receivable
                    </span>
                    {perspectiveTab === 'INCOMING' && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        ACTIVE WORKSPACE
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors mt-0.5">
                    🛠️ Assigned Contracts (Contractor)
                  </h3>
                </div>
              </div>

              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-black/40 border border-cyan-900/40 text-cyan-300">
                {incomingProjects.length} {incomingProjects.length === 1 ? 'Contract' : 'Contracts'}
              </span>
            </div>

            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Contracts where you deliver professional milestones. Client escrow is pre-funded and held in PayPal Vault envelopes, guaranteeing $0 non-payment risk upon verified delivery.
            </p>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 bg-[#0F1115]/80 p-3.5 rounded-xl border border-slate-800/80 mb-4">
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Secured Client Vault</span>
                <span className="text-base font-bold text-cyan-400 font-mono">${incomingCap.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 block">USD Guaranteed</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Claimed Payouts</span>
                <span className="text-base font-bold text-emerald-400 font-mono">${incomingClaimed.toFixed(2)}</span>
                <span className="text-[10px] text-slate-500 block">USD Received</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block font-medium">Active Deliverables</span>
                <span className="text-base font-bold text-white font-mono">{incomingActive} Active</span>
                <span className="text-[10px] text-slate-500 block">of {incomingProjects.length} total</span>
              </div>
            </div>
          </div>

          {/* Panel Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-800/80 mt-1">
            <span className="text-xs text-cyan-300/90 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>100% Guaranteed Payout ($0 Non-Payment Risk)</span>
            </span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setPerspectiveTab('INCOMING');
              }}
              className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1 ${
                perspectiveTab === 'INCOMING'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <span>{perspectiveTab === 'INCOMING' ? 'Viewing Contracts' : 'View Contracts'}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar & Filter Bar with Workspace Focus Switcher */}
      <div className="bg-[#16181d] border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Workspace Quick Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-[#0f1115] border border-slate-800 p-1 rounded-xl text-xs w-full md:w-auto">
          <button
            onClick={() => setPerspectiveTab('OUTGOING')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              perspectiveTab === 'OUTGOING'
                ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow ring-1 ring-amber-400/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-amber-300" />
            <span>💼 Managed ({outgoingProjects.length})</span>
          </button>

          <button
            onClick={() => setPerspectiveTab('INCOMING')}
            className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all ${
              perspectiveTab === 'INCOMING'
                ? 'bg-gradient-to-r from-cyan-600 to-cyan-700 text-white shadow ring-1 ring-cyan-400/40'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-cyan-300" />
            <span>🛠️ Assigned ({incomingProjects.length})</span>
          </button>

          <button
            onClick={() => setPerspectiveTab('ALL')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
              perspectiveTab === 'ALL'
                ? 'bg-slate-800 text-white shadow border border-slate-700'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            🌐 All ({projects.length})
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <div className="flex items-center gap-2 bg-[#0f1115] border border-slate-800 rounded-lg px-3 py-1.5 text-xs w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by contract, client or vendor..."
              className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center bg-[#0f1115] border border-slate-800 p-1 rounded-lg text-xs shrink-0">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'ALL'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({filteredProjects.length})
            </button>
            <button
              onClick={() => setFilterStatus('ACTIVE')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'ACTIVE'
                  ? 'bg-slate-800 text-emerald-300 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Active ({filteredProjects.filter((p) => p.status === 'ACTIVE').length})
            </button>
            <button
              onClick={() => setFilterStatus('PAUSED')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'PAUSED'
                  ? 'bg-slate-800 text-amber-300 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Paused ({filteredProjects.filter((p) => p.status === 'PAUSED').length})
            </button>
          </div>
        </div>
      </div>

      {/* Focused Context Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            {perspectiveTab === 'OUTGOING' && (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Managed Contracts Ledger (Accounts Payable)</span>
              </>
            )}
            {perspectiveTab === 'INCOMING' && (
              <>
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Assigned Contracts Ledger (Accounts Receivable)</span>
              </>
            )}
            {perspectiveTab === 'ALL' && (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                <span>Consolidated Enterprise Contracts Portfolio</span>
              </>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {perspectiveTab === 'OUTGOING' &&
              'Review vendor progress, verify milestone deliverables against zero-trust AI audit guards, and release PayPal Vault funds.'}
            {perspectiveTab === 'INCOMING' &&
              'Submit verifiable milestone pull requests/diffs to trigger autonomous audit verification and claim pre-funded client payouts.'}
            {perspectiveTab === 'ALL' &&
              'Unified view showing all active inbound escrow and outbound vendor contracts across the organization.'}
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400 bg-[#16181d] px-2.5 py-1 rounded-lg border border-slate-800 shrink-0">
          Showing {filteredProjects.length} of {projects.length} contracts
        </span>
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
