'use client';

import React, { useState } from 'react';
import { Header } from '../components/Header';
import { CommandCenter } from '../components/CommandCenter';
import { AgentChat } from '../components/AgentChat';
import { BudgetEnvelope, TransactionLog } from '../lib/types';
import { ShieldCheck, Cpu, Code2, Globe } from 'lucide-react';

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
      action: 'AgenticPay AI System Initialized & Vault Budget Envelope Enforced ($100 max)',
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
        {/* Banner Announcement */}
        <div className="bg-gradient-to-r from-blue-950/80 via-indigo-950/70 to-slate-900 border border-blue-800/40 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Autonomous Agentic Commerce Engine
                <span className="bg-emerald-950 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-700/50">
                  100% Real Sandbox REST Execution
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Pre-authorized budget envelopes via PayPal Vault with zero-hallucination TypeScript guardrails and multimodal vision auditability.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Cpu className="w-4 h-4 text-purple-400" />
            <span>Gemini Flash</span>
            <span className="text-slate-600">•</span>
            <Code2 className="w-4 h-4 text-cyan-400" />
            <span>AG Grid 60FPS</span>
            <span className="text-slate-600">•</span>
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>PayPal Sandbox API</span>
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

          {/* Right Column: AG Grid Real-Time Audit Command Center */}
          <div className="lg:col-span-7 h-[540px]">
            <CommandCenter logs={logs} />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 px-6 text-center text-xs text-slate-500">
        AgenticPay AI © 2026 • Built for PayPal AI Hackathon • 100% Open Source MIT License
      </footer>
    </div>
  );
}
