'use client';

import React from 'react';
import { Shield, ShieldAlert, Zap, Lock, DollarSign } from 'lucide-react';
import { BudgetEnvelope } from '../lib/types';

interface HeaderProps {
  envelope: BudgetEnvelope;
  onToggleKillSwitch: () => void;
}

export const Header: React.FC<HeaderProps> = ({ envelope, onToggleKillSwitch }) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-50 shadow-xl">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3">
        <div className="bg-gradient-to-tr from-blue-600 to-cyan-400 p-2.5 rounded-xl shadow-lg shadow-blue-500/20">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              AgenticPay AI
            </h1>
            <span className="bg-blue-900/60 border border-blue-500/30 text-blue-300 text-xs font-semibold px-2.5 py-0.5 rounded-full">
              PayPal Hackathon 2026
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Autonomous Agentic Commerce & Milestone Payout Engine
          </p>
        </div>
      </div>

      {/* Budget Envelope & Sandbox Status */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {/* Sandbox API Badge */}
        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-medium">PayPal Sandbox API:</span>
          <span className="text-emerald-400 font-bold">api-m.sandbox.paypal.com</span>
        </div>

        {/* Vault Envelope Indicators */}
        <div className="flex items-center gap-3 bg-slate-800/80 border border-slate-700 px-3.5 py-1.5 rounded-lg">
          <div className="flex items-center text-slate-300">
            <Lock className="w-3.5 h-3.5 text-cyan-400 mr-1" />
            <span>Cap: </span>
            <strong className="text-white ml-1">${envelope.maxPerTransactionUSD} USD</strong>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center text-slate-300">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400 mr-0.5" />
            <span>Spent Today: </span>
            <strong className="text-emerald-400 ml-1">${envelope.spentTodayUSD.toFixed(2)}</strong>
            <span className="text-slate-500 ml-1">/ ${envelope.dailyCeilingUSD}</span>
          </div>
        </div>

        {/* Emergency Kill-Switch Toggle */}
        <button
          onClick={onToggleKillSwitch}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all shadow-md active:scale-95 ${
            envelope.killSwitchActive
              ? 'bg-red-600 hover:bg-red-500 text-white animate-bounce shadow-red-600/50'
              : 'bg-slate-800 hover:bg-red-950/40 text-red-400 border border-red-500/30'
          }`}
        >
          {envelope.killSwitchActive ? (
            <>
              <ShieldAlert className="w-4 h-4 text-white" />
              <span>KILL-SWITCH ACTIVE (BLOCKED)</span>
            </>
          ) : (
            <>
              <Shield className="w-4 h-4" />
              <span>Emergency Kill-Switch</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
