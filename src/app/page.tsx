'use client';

import React, { useState } from 'react';
import { Header } from '../components/Header';
import { CommandCenter } from '../components/CommandCenter';
import { AgentChat } from '../components/AgentChat';
import { BudgetEnvelope, TransactionLog } from '../lib/types';
import { ShieldCheck, Shield, Lock, CreditCard } from 'lucide-react';

export default function Home() {
  const [envelope, setEnvelope] = useState<BudgetEnvelope>({
    maxPerTransactionUSD: 100,
    dailyCeilingUSD: 500,
    spentTodayUSD: 0,
    activeEscrowUSD: 0,
    killSwitchActive: false,
  });

  const [logs, setLogs] = useState<TransactionLog[]>([
    {
      id: 'log-init',
      timestamp: '2026-10-07T12:00:00.000Z',
      agentRole: 'GUARDRAIL',
      action: 'AgenticPay AI System Active — Pre-authorized budget envelope set ($100.00 max / $500.00 daily)',
      amountUSD: 0,
      recipientEmail: 'system@agenticpay.ai',
      auditConfidenceScore: 100,
      status: 'IDLE',
      riskLevel: 'LOW',
    },
  ]);

  const handleAddLog = (newLog: TransactionLog) => {
    setLogs((prev) => [newLog, ...prev]);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Header */}
      <Header
        envelope={envelope}
        onToggleKillSwitch={() =>
          setEnvelope((prev) => ({ ...prev, killSwitchActive: !prev.killSwitchActive }))
        }
      />

      {/* Main Content Dashboard */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Product Statement Banner */}
        <div className="bg-gradient-to-r from-blue-950/80 via-indigo-950/70 to-slate-900 border border-blue-800/40 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Autonomous Escrow & Milestone Settlement
                <span className="bg-emerald-950 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-700/50">
                  Protected Escrow Active
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Delegate purchasing and milestone payments to your AI agent with deterministic budget caps, prompt injection defenses, and transparent audit trails.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
            <div className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Vault Envelopes</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Trust Guardrails</span>
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
          {/* Left Column: A2A Negotiation Engine */}
          <div className="lg:col-span-5 h-[540px]">
            <AgentChat
              envelope={envelope}
              onUpdateEnvelope={setEnvelope}
              onAddLog={handleAddLog}
            />
          </div>

          {/* Right Column: Audit Ledger Command Center */}
          <div className="lg:col-span-7 h-[540px]">
            <CommandCenter logs={logs} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 px-6 text-center text-xs text-slate-500">
        AgenticPay AI © 2026 • Autonomous Agentic Commerce Platform
      </footer>
    </div>
  );
}
