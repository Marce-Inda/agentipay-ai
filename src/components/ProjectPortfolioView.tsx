'use client';

import React, { useState } from 'react';
import { FolderPlus, ShieldCheck, Zap, Lock, DollarSign, ArrowRight, PauseCircle, PlayCircle, CheckCircle2, User, Building2, Search } from 'lucide-react';
import { BudgetEnvelope, ProjectContract } from '../lib/types';

interface ProjectPortfolioViewProps {
  envelope: BudgetEnvelope;
  projects: ProjectContract[];
  onSelectProject: (projectId: string) => void;
  onOpenCreateModal: () => void;
  onToggleProjectFreeze: (projectId: string) => void;
}

export const ProjectPortfolioView: React.FC<ProjectPortfolioViewProps> = ({
  envelope,
  projects,
  onSelectProject,
  onOpenCreateModal,
  onToggleProjectFreeze,
}) => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'PAUSED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = projects.filter((p) => {
    const matchesFilter =
      filterStatus === 'ALL' ||
      (filterStatus === 'ACTIVE' && p.status === 'ACTIVE') ||
      (filterStatus === 'PAUSED' && p.status === 'PAUSED');

    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.vendorEmail.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const totalVaultCap = projects.reduce((acc, p) => acc + p.budgetCapUSD, 0);
  const totalSpent = projects.reduce((acc, p) => acc + p.spentUSD, 0);
  const activeCount = projects.filter((p) => p.status === 'ACTIVE').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* KPI Global Portfolio Metrics Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1: Total Active Projects */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">Active Contracts</span>
            <span className="text-2xl font-bold text-white font-mono">{activeCount}</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">of {projects.length} Total Initiatives</span>
          </div>
          <div className="p-3 bg-blue-950/80 border border-blue-800/40 rounded-xl text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2: Total Escrow Cap */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">Total Vault Escrow Cap</span>
            <span className="text-2xl font-bold text-cyan-400 font-mono">${totalVaultCap.toFixed(2)}</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Pre-authorized Envelopes</span>
          </div>
          <div className="p-3 bg-cyan-950/80 border border-cyan-800/40 rounded-xl text-cyan-400">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3: Total Funds Settled */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">PayPal Funds Released</span>
            <span className="text-2xl font-bold text-emerald-400 font-mono">${totalSpent.toFixed(2)}</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Audited Milestone Payouts</span>
          </div>
          <div className="p-3 bg-emerald-950/80 border border-emerald-800/40 rounded-xl text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4: Protection Shield Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 block mb-1">Escrow Guard Status</span>
            <span className="text-sm font-bold text-emerald-400 flex items-center gap-1 mt-1">
              <CheckCircle2 className="w-4 h-4" /> 100% Protected
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Zero-Trust Guardrails</span>
          </div>
          <div className="p-3 bg-slate-800 border border-slate-700 rounded-xl text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar & Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search projects or vendors..."
            className="bg-transparent text-white placeholder-slate-500 focus:outline-none w-full"
          />
        </div>

        {/* Status Filter Tabs & Create Button */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-lg text-xs">
            <button
              onClick={() => setFilterStatus('ALL')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'ALL' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({projects.length})
            </button>
            <button
              onClick={() => setFilterStatus('ACTIVE')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'ACTIVE' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Active ({projects.filter((p) => p.status === 'ACTIVE').length})
            </button>
            <button
              onClick={() => setFilterStatus('PAUSED')}
              className={`px-3 py-1 rounded-md font-semibold transition-all ${
                filterStatus === 'PAUSED' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Paused ({projects.filter((p) => p.status === 'PAUSED').length})
            </button>
          </div>

          <button
            onClick={onOpenCreateModal}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all shadow-md active:scale-95 whitespace-nowrap"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Create New Escrow Project</span>
          </button>
        </div>
      </div>

      {/* Project Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((project) => {
          const percentSpent = Math.min(100, Math.round((project.spentUSD / project.budgetCapUSD) * 100));

          return (
            <div
              key={project.id}
              className="bg-slate-900 border border-slate-800 hover:border-blue-500/50 rounded-xl p-5 shadow-xl transition-all hover:shadow-2xl flex flex-col justify-between space-y-4 group"
            >
              {/* Card Top: Title & Status */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-base text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                    {project.name}
                  </h3>
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

                {/* Vendor Details */}
                <div className="space-y-1 text-xs text-slate-400 mb-4">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-500" />
                    <span>{project.vendorName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-300 font-mono">{project.vendorEmail}</span>
                  </div>
                </div>

                {/* Budget Progress Bar */}
                <div className="space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-400">Vault Budget Spent:</span>
                    <span className="text-emerald-400">
                      ${project.spentUSD.toFixed(2)} / ${project.budgetCapUSD.toFixed(2)} USD
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${percentSpent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer: Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2">
                <button
                  onClick={() => onToggleProjectFreeze(project.id)}
                  className={`text-xs px-2.5 py-1.5 rounded border font-semibold flex items-center gap-1 transition-all ${
                    project.status === 'PAUSED'
                      ? 'bg-amber-950 text-amber-300 border-amber-500/40 hover:bg-amber-900'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-400 border-slate-700'
                  }`}
                  title="Freeze/Resume contract"
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
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <span>Manage Project</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
