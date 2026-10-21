'use client';

import React, { useRef, useState } from 'react';
import { Bot, User, Send, PauseCircle, PlayCircle } from 'lucide-react';
import { A2ANegotiationMessage, BudgetEnvelope, ProjectContract, TransactionLog } from '../lib/types';

interface AgentChatProps {
  envelope: BudgetEnvelope;
  projects: ProjectContract[];
  selectedProjectId: string;
  onToggleProjectFreeze: (projectId: string) => void;
  onAddLog: (log: TransactionLog) => void;
}

export const AgentChat: React.FC<AgentChatProps> = ({
  envelope,
  projects,
  selectedProjectId,
  onToggleProjectFreeze,
  onAddLog,
}) => {
  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const latestEnvelopeRef = useRef(envelope);
  const latestProjectRef = useRef(activeProject);
  latestEnvelopeRef.current = envelope;
  latestProjectRef.current = activeProject;

  const nextPendingMilestone = activeProject?.milestones?.find((m) => m.status === 'PENDING');

  const [messages, setMessages] = useState<A2ANegotiationMessage[]>([
    {
      id: 'msg-1',
      sender: 'SYSTEM',
      text: `AgenticPay AI ready for contract "${activeProject?.name || 'General'}". Contract envelope: $${(activeProject?.budgetCapUSD || 0).toFixed(2)} USD. This assistant drafts negotiation terms only; settlement is gated by milestone audit and client authorization.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [targetAmount, setTargetAmount] = useState<number>(nextPendingMilestone?.amountUSD ?? 0);
  const [isProcessing, setIsProcessing] = useState(false);

  // Custom User Natural Negotiation Request
  const handleSendCustomPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isProcessing) return;

    const userText = inputPrompt.trim();
    setInputPrompt('');
    setIsProcessing(true);

    const timestamp = new Date().toISOString();

    const userMsg: A2ANegotiationMessage = {
      id: `user-${Date.now()}`,
      sender: 'BUYER_AGENT',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      proposedPrice: targetAmount,
    };

    setMessages((prev) => [...prev, userMsg]);

    // Check Kill Switch
    if (envelope.killSwitchActive) {
      onAddLog({
        id: `log-${Date.now()}`,
        timestamp,
        projectId: activeProject.id,
        projectName: activeProject.name,
        agentRole: 'GUARDRAIL',
        action: `BLOCK: Master Kill-Switch is ENGAGED. Settlements locked.`,
        amountUSD: targetAmount,
        recipientEmail: activeProject.vendorEmail,
        auditConfidenceScore: 0,
        status: 'KILL_SWITCH_REVOKED',
        riskLevel: 'CRITICAL',
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: 'SYSTEM',
          text: `🚨 NEGOTIATION BLOCKED: Master Kill-Switch is currently ENGAGED. Deactivate the Kill-Switch to accept settlement terms.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setIsProcessing(false);
      return;
    }

    // Check if THIS SPECIFIC PROJECT is frozen
    if (activeProject.status === 'PAUSED') {
      onAddLog({
        id: `log-${Date.now()}`,
        timestamp,
        projectId: activeProject.id,
        projectName: activeProject.name,
        agentRole: 'GUARDRAIL',
        action: `BLOCK: Contract "${activeProject.name}" is FROZEN by user`,
        amountUSD: targetAmount,
        recipientEmail: activeProject.vendorEmail,
        auditConfidenceScore: 0,
        status: 'CONTRACT_FROZEN',
        riskLevel: 'HIGH',
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `sys-${Date.now()}`,
          sender: 'SYSTEM',
          text: `⏸️ NEGOTIATION BLOCKED: Settlements for project "${activeProject.name}" are currently FROZEN. Resume the contract to accept settlement terms.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setIsProcessing(false);
      return;
    }

    // Step 1: Call SSE Streaming API Route
    const agentMsgId = `buyer-${Date.now()}`;
    const initialTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    try {
      const res = await fetch('/api/agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          maxBudgetUSD: activeProject.budgetCapUSD,
          targetAmount,
          projectName: activeProject.name,
          vendorEmail: activeProject.vendorEmail,
          envelope,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Negotiation evaluation failed' }));
        const errorMessage = errorData.error || 'Guardrail budget ceiling violation or injection attempt detected.';

        onAddLog({
          id: `log-${Date.now()}-err`,
          timestamp,
          projectId: activeProject.id,
          projectName: activeProject.name,
          agentRole: 'GUARDRAIL',
          action: `GUARDRAIL REJECT: ${errorMessage}`,
          amountUSD: targetAmount,
          recipientEmail: activeProject.vendorEmail,
          auditConfidenceScore: 0,
          status: 'GUARDRAIL_CHECKING',
          riskLevel: errorData.riskLevel || 'HIGH',
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            sender: 'SYSTEM',
            text: `❌ Negotiation Blocked by Guardrail: ${errorMessage}`,
            timestamp: initialTime,
          },
        ]);
        setIsProcessing(false);
        return;
      }

      // Add streaming placeholder message
      setMessages((prev) => [
        ...prev,
        {
          id: agentMsgId,
          sender: 'BUYER_AGENT',
          text: '🤖 AgenticPay AI processing prompt...',
          timestamp: initialTime,
        },
      ]);

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          streamedContent += chunk;

          setMessages((prev) =>
            prev.map((msg) => (msg.id === agentMsgId ? { ...msg, text: streamedContent } : msg))
          );
        }
      }

      // Re-check the latest guard state immediately before accepting the negotiation terms.
      const latestEnvelope = latestEnvelopeRef.current;
      const latestProject = latestProjectRef.current;
      const isKillSwitch = latestEnvelope.killSwitchActive;
      const isFrozen = latestProject.status === 'PAUSED';

      if (isKillSwitch || isFrozen) {
        const blockReason = isKillSwitch
          ? 'CRITICAL: Emergency Kill-Switch is ACTIVE. All settlements are halted.'
          : `Settlements are frozen for contract "${latestProject.name}".`;

        onAddLog({
          id: `log-${Date.now()}-blocked`,
          timestamp: new Date().toISOString(),
          projectId: latestProject.id,
          projectName: latestProject.name,
          agentRole: 'GUARDRAIL',
          action: `BLOCK: ${blockReason}`,
          amountUSD: 0,
          recipientEmail: latestProject.vendorEmail,
          auditConfidenceScore: 0,
          status: isKillSwitch ? 'KILL_SWITCH_REVOKED' : 'CONTRACT_FROZEN',
          riskLevel: isKillSwitch ? 'CRITICAL' : 'HIGH',
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `sys-blocked-${Date.now()}`,
            sender: 'SYSTEM',
            text: `🚨 NEGOTIATION BLOCKED: ${blockReason}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsProcessing(false);
        return;
      }

      const remainingBudgetUSD = Math.max(0, latestProject.budgetCapUSD - latestProject.spentUSD);
      if (targetAmount > remainingBudgetUSD) {
        const budgetReason = `Proposed amount of $${targetAmount.toFixed(2)} exceeds the remaining envelope balance of $${remainingBudgetUSD.toFixed(2)} for "${latestProject.name}".`;

        onAddLog({
          id: `log-${Date.now()}-over-budget`,
          timestamp: new Date().toISOString(),
          projectId: latestProject.id,
          projectName: latestProject.name,
          agentRole: 'GUARDRAIL',
          action: `BLOCK: ${budgetReason}`,
          amountUSD: 0,
          recipientEmail: latestProject.vendorEmail,
          auditConfidenceScore: 0,
          status: 'REJECTED',
          riskLevel: 'HIGH',
        });

        setMessages((prev) => [
          ...prev,
          {
            id: `sys-over-budget-${Date.now()}`,
            sender: 'SYSTEM',
            text: `🚨 NEGOTIATION BLOCKED: ${budgetReason}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsProcessing(false);
        return;
      }

      // Step 2: Record the negotiation draft. Settlement is handled by the
      // milestone audit flow after proof submission and client authorization.
      onAddLog({
        id: `log-${Date.now()}-draft`,
        timestamp: new Date().toISOString(),
        projectId: activeProject.id,
        projectName: activeProject.name,
        agentRole: 'BUYER_AI',
        action: `Negotiation draft generated for "${activeProject.name}" ($${targetAmount.toFixed(2)} USD proposed)`,
        amountUSD: 0,
        recipientEmail: activeProject.vendorEmail,
        auditConfidenceScore: 0,
        status: 'IDLE',
        riskLevel: 'LOW',
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `sys-draft-${Date.now()}`,
          sender: 'SYSTEM',
          text: `Negotiation draft generated. No funds have moved. Submit milestone proof in the workspace for AI audit; contractor submissions require client authorization before a local settlement record is created.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      console.error('[AgentChat Stream Error]:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `sys-err-${Date.now()}`,
          sender: 'SYSTEM',
          text: `❌ Streaming Error: ${err.message || 'Unable to connect to AI Stream endpoint.'}`,
          timestamp: initialTime,
        },
      ]);
    }

    setIsProcessing(false);
  };

  return (
    <div className="bg-[#16181D] border border-amber-500/20 rounded-xl p-5 shadow-2xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#252830]">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Agentic Commerce Assistant
            </h2>
            <span className="text-[11px] text-amber-400 font-medium">
              Contract: {activeProject.name} (${activeProject.budgetCapUSD.toFixed(2)} Envelope)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Per-Project Freeze Button */}
          {activeProject.perspective !== 'INCOMING' && (
          <button
            onClick={() => onToggleProjectFreeze(activeProject.id)}
            className={`text-xs px-2.5 py-1 rounded border font-semibold flex items-center gap-1 transition-all ${
              activeProject.status === 'PAUSED'
                ? 'bg-amber-950 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-[#252830] hover:bg-[#2d313c] text-slate-300 border-slate-700'
            }`}
            title="Freeze/Resume settlements for this project only"
          >
            {activeProject.status === 'PAUSED' ? (
              <>
                <PlayCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Resume Contract</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Freeze Contract</span>
              </>
            )}
          </button>
          )}
        </div>
      </div>

      {/* Chat Messages Stream */}
      <div className="bg-[#0F1115] border border-amber-500/10 rounded-lg p-4 flex-1 overflow-y-auto space-y-3 min-h-[220px] max-h-[270px] text-xs font-mono mb-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`p-3 rounded-lg border ${
              msg.sender === 'SYSTEM'
                ? 'bg-[#16181D] border-slate-800 text-slate-300'
                : msg.sender === 'BUYER_AGENT'
                ? 'bg-[#1e2330] border-amber-500/30 text-amber-100'
                : 'bg-[#251d14] border-amber-600/30 text-amber-200'
            }`}
          >
            <div className="flex items-center justify-between font-bold mb-1 opacity-80">
              <span className="flex items-center gap-1">
                {msg.sender === 'BUYER_AGENT' && <User className="w-3 h-3 text-amber-400" />}
                {msg.sender === 'SELLER_AGENT' && <Bot className="w-3 h-3 text-amber-500" />}
                {msg.sender}
              </span>
              <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
            </div>
            <p className="whitespace-pre-wrap">{msg.text}</p>
          </div>
        ))}
      </div>

      {/* Real Natural User Input Form */}
      <form onSubmit={handleSendCustomPrompt} className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={`Draft negotiation terms for ${activeProject.name}...`}
            disabled={isProcessing || envelope.killSwitchActive || activeProject.status === 'PAUSED'}
            className="flex-1 bg-[#0F1115] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <div className="flex items-center gap-1 bg-[#0F1115] border border-slate-800 rounded-lg px-2.5 py-2">
            <span className="text-xs text-slate-400 font-semibold">$</span>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(Number(e.target.value))}
              placeholder="USD"
              className="w-14 bg-transparent text-xs text-emerald-400 font-bold focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isProcessing || !inputPrompt.trim() || envelope.killSwitchActive || activeProject.status === 'PAUSED'}
            className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:from-slate-800 disabled:to-slate-800 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </form>
    </div>
  );
};
