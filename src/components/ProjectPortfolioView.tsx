'use client';

import React, { useState } from 'react';
import { 
  FolderPlus, 
  ShieldCheck, 
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
  Briefcase,
  Layers,
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
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [columnFocus, setColumnFocus] = useState<'DUAL' | 'OUTGOING' | 'INCOMING'>('DUAL');

  const isBusiness = currentProfile?.role === 'BUSINESS' || currentProfile?.accountType === 'BUSINESS';

  // Separate Outgoing (Managed / Hiring) and Incoming (Assigned / Contractor)
  const outgoingProjectsRaw = projects.filter((p) => p.perspective !== 'INCOMING');
  const incomingProjectsRaw = projects.filter((p) => p.perspective === 'INCOMING');

  // Filter helper for both columns
  const filterList = (list: ProjectContract[]) => {
    return list.filter((p) => {
      const matchesFilter =
        filterStatus === 'ALL' ||
        (filterStatus === 'ACTIVE' && p.status === 'ACTIVE') ||
        (filterStatus === 'PAUSED' && p.status === 'PAUSED');

      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(searchLower) ||
        p.vendorName.toLowerCase().includes(searchLower) ||
        p.vendorEmail.toLowerCase().includes(searchLower) ||
        (p.clientName && p.clientName.toLowerCase().includes(searchLower));

      return matchesFilter && matchesSearch;
    });
  };

  const filteredOutgoing = filterList(outgoingProjectsRaw);
  const filteredIncoming = filterList(incomingProjectsRaw);

  // Financial aggregates
  const outgoingCap = outgoingProjectsRaw.reduce((acc, p) => acc + p.budgetCapUSD, 0);
  const outgoingSpent = outgoingProjectsRaw.reduce((acc, p) => acc + p.spentUSD, 0);
  const outgoingActive = outgoingProjectsRaw.filter((p) => p.status === 'ACTIVE').length;

  const incomingCap = incomingProjectsRaw.reduce((acc, p) => acc + p.budgetCapUSD, 0);
  const incomingClaimed = incomingProjectsRaw.reduce((acc, p) => acc + p.spentUSD, 0);
  const incomingActive = incomingProjectsRaw.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 1. Active Account Legal Entity & Compliance Banner */}
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

      {/* 2. Global Utilities & Search Filter Toolbar (Without Redundant Perspective Tabs) */}
      <div className="bg-[#16181d] border border-slate-800 rounded-xl p-3.5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input across both columns */}
        <div className="flex items-center gap-2 bg-[#0f1115] border border-slate-800 rounded-lg px-3 py-2 text-xs w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search contracts, clients, or vendors..."
            className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full"
          />
        </div>

        {/* Layout Focus Selector & Status Filters */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Status Filter */}
          <div className="flex items-center bg-[#0f1115] border border-slate-800 p-1 rounded-lg text-xs">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'ALL'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setFilterStatus('ACTIVE')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'ACTIVE'
                  ? 'bg-slate-800 text-emerald-300 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('PAUSED')}
              className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'PAUSED'
                  ? 'bg-slate-800 text-amber-300 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Paused
            </button>
          </div>

          {/* View Mode Toggle: Dual Column vs Focus */}
          <div className="hidden sm:flex items-center bg-[#0f1115] border border-slate-800 p-1 rounded-lg text-xs">
            <button
              onClick={() => setColumnFocus('DUAL')}
              title="View both columns side-by-side"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-bold transition-all ${
                columnFocus === 'DUAL'
                  ? 'bg-slate-800 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Dual Split View</span>
            </button>
            <button
              onClick={() => setColumnFocus('OUTGOING')}
              title="Focus on Managed Contracts"
              className={`px-2 py-1 rounded-md font-semibold transition-all ${
                columnFocus === 'OUTGOING'
                  ? 'bg-amber-950/80 text-amber-300 shadow border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              💼 Managed Only
            </button>
            <button
              onClick={() => setColumnFocus('INCOMING')}
              title="Focus on Assigned Contracts"
              className={`px-2 py-1 rounded-md font-semibold transition-all ${
                columnFocus === 'INCOMING'
                  ? 'bg-cyan-950/80 text-cyan-300 shadow border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              🛠️ Assigned Only
            </button>
          </div>

          {/* Action Button: Create New Contract */}
          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-all shadow-md active:scale-95 whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4 text-slate-950" />
            <span>+ New Contract</span>
          </button>
        </div>
      </div>

      {/* 3. INTEGRATED TWO-COLUMN MASTER SWIMLANES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ============================================================== */}
        {/* COLUMN A: MANAGED CONTRACTS (OUTBOUND ESCROW / ACCOUNTS PAYABLE) */}
        {/* ============================================================== */}
        {(columnFocus === 'DUAL' || columnFocus === 'OUTGOING') && (
          <div
            className={`space-y-4 ${
              columnFocus === 'OUTGOING' ? 'lg:col-span-2 max-w-5xl mx-auto w-full' : ''
            }`}
          >
            {/* Column Header: Executive Summary Card (Outbound) */}
            <div className="rounded-2xl p-5 border border-amber-500/40 bg-gradient-to-br from-[#1c1813] via-[#16181d] to-[#141218] shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl border bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-inner">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono bg-amber-950/80 border border-amber-700/50 text-amber-300">
                        Outbound Escrow • Accounts Payable
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-0.5 flex items-center gap-1.5">
                      <span>💼 Managed Contracts (Hiring)</span>
                    </h3>
                  </div>
                </div>

                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-black/40 border border-amber-900/40 text-amber-300 font-bold shrink-0">
                  {filteredOutgoing.length} {filteredOutgoing.length === 1 ? 'Contract' : 'Contracts'}
                </span>
              </div>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Agreements you sponsor and administer. Funds are pre-authorized in PayPal Vault envelopes and released only upon zero-trust AI audit milestone verification.
              </p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2.5 bg-[#0F1115]/80 p-3 rounded-xl border border-slate-800/80 mb-3">
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
                  <span className="text-[10px] text-slate-500 block">of {outgoingProjectsRaw.length} total</span>
                </div>
              </div>

              {/* Column Status Badge */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                <span className="text-xs text-amber-400 font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Zero-Trust LLM Guardrails Active</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Status: 100% Protected
                </span>
              </div>
            </div>

            {/* List of Outbound Contracts */}
            <div className="space-y-4">
              {filteredOutgoing.length === 0 ? (
                <div className="p-8 text-center bg-[#16181d]/60 border border-dashed border-slate-800 rounded-2xl text-slate-400">
                  <Briefcase className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-medium">No managed contracts match your current filter.</p>
                </div>
              ) : (
                filteredOutgoing.map((project) => {
                  const percentSpent = Math.min(
                    100,
                    Math.round((project.spentUSD / project.budgetCapUSD) * 100)
                  );

                  return (
                    <div
                      key={project.id}
                      className="border border-amber-900/30 hover:border-amber-500/60 rounded-2xl p-5 shadow-xl transition-all hover:shadow-2xl bg-gradient-to-br from-[#16181d] via-[#1a1d24] to-[#251d14] flex flex-col justify-between space-y-3.5 group"
                    >
                      {/* Top Badges & Title */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-amber-950/80 text-amber-300 border border-amber-500/40">
                              💼 DIRECT HIRE
                            </span>

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

                        <h4 className="font-bold text-base text-white group-hover:text-amber-400 transition-colors line-clamp-1 mb-2">
                          {project.name}
                        </h4>

                        {/* Legal Contract & Vendor Information */}
                        <div className="space-y-1.5 text-xs text-slate-400 mb-3 bg-[#0F1115]/70 p-2.5 rounded-xl border border-slate-800">
                          {project.contractType === 'MSA_SOW' && (
                            <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-mono mb-1">
                              <FileCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>Binding Legal Contract: {project.contractReferenceId || 'MSA & SOW'}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Contractor: <strong className="text-white">{project.vendorName}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-slate-300 font-mono text-[11px]">{project.vendorEmail}</span>
                          </div>
                        </div>

                        {/* Vault Budget Consumed Progress */}
                        <div className="space-y-1.5 bg-[#0f1115] p-3 rounded-lg border border-slate-800">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-400">Vault Budget Consumed:</span>
                            <span className="text-emerald-400 font-mono">
                              ${project.spentUSD.toFixed(2)} / ${project.budgetCapUSD.toFixed(2)} USD
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-600 via-amber-500 to-emerald-400"
                              style={{ width: `${percentSpent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80 gap-2">
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
                          className="font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95 bg-gradient-to-r from-amber-700 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-slate-950"
                        >
                          <span>Manage Escrow Vault</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* COLUMN B: ASSIGNED CONTRACTS (INBOUND ESCROW / ACCOUNTS RECEIVABLE) */}
        {/* ============================================================== */}
        {(columnFocus === 'DUAL' || columnFocus === 'INCOMING') && (
          <div
            className={`space-y-4 ${
              columnFocus === 'INCOMING' ? 'lg:col-span-2 max-w-5xl mx-auto w-full' : ''
            }`}
          >
            {/* Column Header: Executive Summary Card (Inbound) */}
            <div className="rounded-2xl p-5 border border-cyan-500/40 bg-gradient-to-br from-[#121b24] via-[#16181d] to-[#12232e] shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl border bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-inner">
                    <ArrowDownLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono bg-cyan-950/80 border border-cyan-700/50 text-cyan-300">
                        Inbound Escrow • Accounts Receivable
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mt-0.5 flex items-center gap-1.5">
                      <span>🛠️ Assigned Contracts (Contractor)</span>
                    </h3>
                  </div>
                </div>

                <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-black/40 border border-cyan-900/40 text-cyan-300 font-bold shrink-0">
                  {filteredIncoming.length} {filteredIncoming.length === 1 ? 'Contract' : 'Contracts'}
                </span>
              </div>

              <p className="text-xs text-slate-300 mb-4 leading-relaxed">
                Contracts where you deliver professional milestones. Client escrow is pre-funded and held in PayPal Vault envelopes, guaranteeing $0 non-payment risk upon verified delivery.
              </p>

              {/* Metrics Grid */}
              <div className="grid grid-cols-3 gap-2.5 bg-[#0F1115]/80 p-3 rounded-xl border border-slate-800/80 mb-3">
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
                  <span className="text-[10px] text-slate-500 block">of {incomingProjectsRaw.length} total</span>
                </div>
              </div>

              {/* Column Status Badge */}
              <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800/80">
                <span className="text-xs text-cyan-300 font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>100% Guaranteed Payout ($0 Risk)</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Funds Locked in PayPal Vault
                </span>
              </div>
            </div>

            {/* List of Inbound Contracts */}
            <div className="space-y-4">
              {filteredIncoming.length === 0 ? (
                <div className="p-8 text-center bg-[#16181d]/60 border border-dashed border-slate-800 rounded-2xl text-slate-400">
                  <Briefcase className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs font-medium">No assigned contracts match your current filter.</p>
                </div>
              ) : (
                filteredIncoming.map((project) => {
                  const percentSpent = Math.min(
                    100,
                    Math.round((project.spentUSD / project.budgetCapUSD) * 100)
                  );

                  return (
                    <div
                      key={project.id}
                      className="border border-cyan-500/30 hover:border-cyan-400/60 rounded-2xl p-5 shadow-xl transition-all hover:shadow-2xl bg-gradient-to-br from-[#121b24] via-[#16181d] to-[#12222d] flex flex-col justify-between space-y-3.5 group"
                    >
                      {/* Top Badges & Title */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                              🛠️ ASSIGNED CONTRACT
                            </span>

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

                        <h4 className="font-bold text-base text-white group-hover:text-cyan-300 transition-colors line-clamp-1 mb-2">
                          {project.name}
                        </h4>

                        {/* Legal Contract & Client Information */}
                        <div className="space-y-1.5 text-xs text-slate-400 mb-3 bg-[#0F1115]/70 p-2.5 rounded-xl border border-slate-800">
                          {project.contractType === 'MSA_SOW' && (
                            <div className="flex items-center gap-1.5 text-cyan-400 text-[11px] font-mono mb-1">
                              <FileCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>Binding Legal Contract: {project.contractReferenceId || 'MSA & SOW'}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span>Client (Payer): <strong className="text-white">{project.clientName || 'Corporate Buyer'}</strong></span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-slate-300 font-mono text-[11px]">{project.clientEmail || 'treasury@client.example'}</span>
                          </div>
                        </div>

                        {/* Claimed Funds vs Escrow Cap Progress */}
                        <div className="space-y-1.5 bg-[#0f1115] p-3 rounded-lg border border-slate-800">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-slate-400">Claimed Funds / Escrow Cap:</span>
                            <span className="text-emerald-400 font-mono">
                              ${project.spentUSD.toFixed(2)} / ${project.budgetCapUSD.toFixed(2)} USD
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-cyan-600 via-cyan-400 to-emerald-400"
                              style={{ width: `${percentSpent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-slate-800/80 gap-2">
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
                          className="font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-slate-950"
                        >
                          <span>Deliver & Claim Payout</span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Enterprise Capacity / Expansion Card to balance visual height */}
              <div className="p-4 rounded-2xl border border-dashed border-cyan-800/40 bg-gradient-to-br from-[#121b24]/40 to-transparent flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-200 block">Accepting Client Mandates</span>
                    <span className="text-[11px] text-slate-400">PayPal Vault escrow pre-funding ready for inbound SOW agreements.</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold shrink-0">
                  AUTO-SECURED
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

