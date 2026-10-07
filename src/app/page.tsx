'use client';

import React, { useState } from 'react';
import { Header } from '../components/Header';
import { CommandCenter } from '../components/CommandCenter';
import { AgentChat } from '../components/AgentChat';
import { BudgetEnvelope, ProjectContract, TransactionLog } from '../lib/types';
import { ShieldCheck, Shield, Lock, CreditCard, FolderGit2 } from 'lucide-react';

export default function Home() {
  const [projects, setProjects] = useState<ProjectContract[]>([
    {
      id: 'proj-1',
      name: 'Web Platform Engineering',
      vendorName: 'Dev Agency LLC',
      vendorEmail: 'dev@agency.com',
      budgetCapUSD: 250,
      spentUSD: 75,
      status: 'ACTIVE',
    },
    {
      id: 'proj-2',
      name: 'UI/UX Brand Redesign',
      vendorName: 'Studio Design Co',
      vendorEmail: 'design@studio.com',
      budgetCapUSD: 150,
      spentUSD: 0,
      status: 'ACTIVE',
    },
    {
      id: 'proj-3',
      name: 'Digital Marketing Campaign',
      vendorName: 'Ad Agency Global',
      vendorEmail: 'ad@agency.com',
      budgetCapUSD: 100,
      spentUSD: 0,
      status: 'ACTIVE',
    },
  ]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-1');

  const [envelope, setEnvelope] = useState<BudgetEnvelope>({
    maxPerTransactionUSD: 250,
    dailyCeilingUSD: 1000,
    spentTodayUSD: 75,
    activeEscrowUSD: 0,
    killSwitchActive: false,
  });

  const [logs, setLogs] = useState<TransactionLog[]>([
    {
      id: 'log-init-1',
      projectId: 'proj-1',
      projectName: 'Web Platform Engineering',
      timestamp: '2026-10-07T12:00:00.000Z',
      agentRole: 'GUARDRAIL',
      action: 'Project Contract Enforced: Web Platform Engineering ($250.00 Vault Cap)',
      amountUSD: 75,
      recipientEmail: 'dev@agency.com',
      auditConfidenceScore: 98,
      status: 'PAYOUT_EXECUTED',
      riskLevel: 'LOW',
      payPalTransactionId: 'AGENTICPAY_PROJ1_BATCH',
      httpPayloadLog: 'POST https://api-m.sandbox.paypal.com/v1/payments/payouts [201 Created]',
    },
    {
      id: 'log-init-2',
      projectId: 'proj-2',
      projectName: 'UI/UX Brand Redesign',
      timestamp: '2026-10-07T12:05:00.000Z',
      agentRole: 'GUARDRAIL',
      action: 'Project Contract Active: UI/UX Brand Redesign ($150.00 Vault Cap)',
      amountUSD: 0,
      recipientEmail: 'design@studio.com',
      auditConfidenceScore: 100,
      status: 'IDLE',
      riskLevel: 'LOW',
    },
  ]);

  const handleAddLog = (newLog: TransactionLog) => {
    setLogs((prev) => [newLog, ...prev]);

    // Update project spent amount
    setProjects((prev) =>
      prev.map((p) =>
        p.id === newLog.projectId
          ? { ...p, spentUSD: p.spentUSD + (newLog.status === 'PAYOUT_EXECUTED' ? newLog.amountUSD : 0) }
          : p
      )
    );
  };

  const handleToggleProjectFreeze = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, status: p.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' }
          : p
      )
    );
  };

  // Filter logs based on selected project
  const filteredLogs = selectedProjectId === 'ALL'
    ? logs
    : logs.filter((log) => log.projectId === selectedProjectId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Header */}
      <Header
        envelope={envelope}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onToggleKillSwitch={() =>
          setEnvelope((prev) => ({ ...prev, killSwitchActive: !prev.killSwitchActive }))
        }
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Multi-Project Product Banner */}
        <div className="bg-gradient-to-r from-blue-950/80 via-indigo-950/70 to-slate-900 border border-blue-800/40 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Multi-Project Escrow & Settlement Engine
                <span className="bg-emerald-950 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-700/50">
                  {projects.length} Active Contracts
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Manage multiple contractor initiatives simultaneously. Each project enforces an isolated Vault budget envelope and granular contract controls.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
            <div className="flex items-center gap-1">
              <FolderGit2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Isolated Contracts</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Dual-Tier Safety</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-purple-400" />
              <span>PayPal Escrow</span>
            </div>
          </div>
        </div>

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Multi-Project Negotiation Engine */}
          <div className="lg:col-span-5 h-[540px]">
            <AgentChat
              envelope={envelope}
              projects={projects}
              selectedProjectId={selectedProjectId}
              onSelectProject={setSelectedProjectId}
              onToggleProjectFreeze={handleToggleProjectFreeze}
              onUpdateEnvelope={setEnvelope}
              onAddLog={handleAddLog}
            />
          </div>

          {/* Right Column: Multi-Contract Audit Ledger */}
          <div className="lg:col-span-7 h-[540px]">
            <CommandCenter
              logs={filteredLogs}
              onToggleProjectFreeze={handleToggleProjectFreeze}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 px-6 text-center text-xs text-slate-500">
        AgenticPay AI © 2026 • Enterprise Multi-Project Escrow Platform
      </footer>
    </div>
  );
}
