'use client';

import React, { useState } from 'react';
import {
  DollarSign,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Loader,
  CreditCard,
  ArrowRight,
  X,
  Info,
} from 'lucide-react';
import { ProjectContract, BudgetEnvelope } from '../lib/types';

interface EscrowFundingPanelProps {
  project: ProjectContract;
  envelope: BudgetEnvelope;
  onInitiateEscrow: () => Promise<void>;
  onInitiateRefund: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * EscrowFundingPanel: Enterprise Vault Escrow Management
 * 
 * Displays escrow funding status, deposit/release progress, and refund controls.
 * Follows production SaaS patterns with professional fintech terminology.
 * 
 * Features:
 * - Real-time funding status visualization
 * - Milestone-based release tracking
 * - Refundable balance calculation
 * - PayPal integration with official UI
 * - Enterprise security badges
 */
export const EscrowFundingPanel: React.FC<EscrowFundingPanelProps> = ({
  project,
  envelope,
  onInitiateEscrow,
  onInitiateRefund,
  isLoading = false,
}) => {
  const [showDepositFlow, setShowDepositFlow] = useState(false);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate funding metrics
  const totalContractUSD = (project.milestones || []).reduce((sum, m) => sum + (m.budgetUSD || 0), 0);
  const fundedUSD = project.fundedUSD || 0;
  const releasedUSD = project.releasedUSD || 0;
  const refundableUSD = fundedUSD - releasedUSD;
  const fundingPercentage = totalContractUSD > 0 ? Math.round((fundedUSD / totalContractUSD) * 100) : 0;
  const releasePercentage = fundedUSD > 0 ? Math.round((releasedUSD / fundedUSD) * 100) : 0;

  // Funding status determination
  const fundingStatus = project.fundingStatus || 'UNFUNDED';
  const isFunded = fundingStatus === 'FUNDED' || fundingStatus === 'PARTIALLY_FUNDED';
  const canRefund = refundableUSD > 0 && fundingStatus !== 'FULLY_REFUNDED';

  // Status styling
  const getStatusColor = () => {
    switch (fundingStatus) {
      case 'FUNDED':
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/60';
      case 'PARTIALLY_FUNDED':
        return 'text-amber-300 border-amber-500/40 bg-amber-950/60';
      case 'UNFUNDED':
        return 'text-slate-400 border-slate-600/40 bg-slate-950/40';
      case 'FULLY_REFUNDED':
        return 'text-cyan-400 border-cyan-500/40 bg-cyan-950/60';
      default:
        return 'text-slate-400 border-slate-600/40 bg-slate-950/40';
    }
  };

  const getStatusLabel = () => {
    switch (fundingStatus) {
      case 'FUNDED':
        return 'Vault Envelope: FULLY FUNDED';
      case 'PARTIALLY_FUNDED':
        return 'Vault Envelope: PARTIALLY FUNDED';
      case 'UNFUNDED':
        return 'Vault Envelope: AWAITING DEPOSIT';
      case 'FULLY_REFUNDED':
        return 'Vault Envelope: REFUNDED';
      case 'PARTIALLY_REFUNDED':
        return 'Vault Envelope: PARTIALLY REFUNDED';
      default:
        return 'Vault Envelope: UNKNOWN';
    }
  };

  // Milestone release breakdown
  const releasedMilestones = (project.milestones || []).filter(
    (m) => m.status === 'COMPLETED' || m.status === 'APPROVED'
  );

  // Handle deposit initiation
  const handleInitiateDeposit = async () => {
    try {
      setError(null);
      setIsProcessing(true);
      await onInitiateEscrow();
      setShowDepositFlow(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deposit initiation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle refund initiation
  const handleInitiateRefund = async () => {
    try {
      setError(null);
      setIsProcessing(true);
      await onInitiateRefund();
      setShowRefundConfirm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refund initiation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className={`border rounded-2xl p-4 transition ${getStatusColor()}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <Lock className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-wide">{getStatusLabel()}</h3>
              <p className="text-[11px] opacity-75">Escrow Vault Management</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold">${fundedUSD.toFixed(2)}</div>
            <div className="text-[11px] opacity-75">of ${totalContractUSD.toFixed(2)}</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="h-2 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500 ease-out"
              style={{ width: `${fundingPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] opacity-75">
            <span>Deposited</span>
            <span className="font-mono">{fundingPercentage}%</span>
          </div>
        </div>
      </div>

      {/* Released Milestones Tracker */}
      {releasedMilestones.length > 0 && (
        <div className="border border-slate-700 bg-[#0f1115] rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-slate-200">Released Milestones</h4>
            <span className="text-[10px] text-slate-500 ml-auto">{releasedMilestones.length} completed</span>
          </div>

          <div className="space-y-2">
            {releasedMilestones.map((milestone, idx) => (
              <div
                key={milestone.id || idx}
                className="flex items-center justify-between p-2.5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">
                      {milestone.title || `Milestone ${idx + 1}`}
                    </p>
                    <p className="text-[10px] text-slate-500">Released • {milestone.status}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs font-mono font-bold text-emerald-400">
                    ${milestone.budgetUSD?.toFixed(2) || '0.00'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Release Progress */}
          <div className="pt-2 border-t border-slate-700 space-y-1.5">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>Release Progress</span>
              <span className="font-mono">{releasePercentage}%</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${releasePercentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Escrow Ledger Summary */}
      <div className="grid grid-cols-3 gap-3">
        {/* Funded Box */}
        <div className="border border-slate-700 bg-[#0f1115] rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-slate-400 font-semibold">TOTAL FUNDED</p>
          <p className="text-lg font-bold text-amber-400 font-mono">${fundedUSD.toFixed(2)}</p>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-all"
              style={{ width: `${fundingPercentage}%` }}
            />
          </div>
        </div>

        {/* Released Box */}
        <div className="border border-slate-700 bg-[#0f1115] rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-slate-400 font-semibold">RELEASED</p>
          <p className="text-lg font-bold text-emerald-400 font-mono">${releasedUSD.toFixed(2)}</p>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${releasePercentage}%` }}
            />
          </div>
        </div>

        {/* Refundable Box */}
        <div className="border border-slate-700 bg-[#0f1115] rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-slate-400 font-semibold">REFUNDABLE</p>
          <p className="text-lg font-bold text-cyan-400 font-mono">${refundableUSD.toFixed(2)}</p>
          <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all"
              style={{ width: refundableUSD > 0 ? 100 : 0 }}
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="border border-red-500/40 bg-red-950/60 rounded-lg p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-300">{error}</p>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2.5 pt-2">
        {!isFunded && fundedUSD < totalContractUSD && (
          <button
            onClick={() => setShowDepositFlow(true)}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CreditCard className="w-3.5 h-3.5" />
                <span>Initiate Escrow Deposit</span>
              </>
            )}
          </button>
        )}

        {canRefund && (
          <button
            onClick={() => setShowRefundConfirm(true)}
            disabled={isProcessing}
            className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-100 font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Initiate Refund</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* PayPal Integration Info */}
      {fundingStatus === 'UNFUNDED' && (
        <div className="border border-blue-500/30 bg-blue-950/40 rounded-lg p-3 flex gap-2.5">
          <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0 text-[11px] text-slate-300">
            <p className="font-semibold text-blue-300 mb-1">PayPal Sandbox Integration</p>
            <p>Click "Initiate Escrow Deposit" to fund this contract. You'll be redirected to PayPal to authorize payment.</p>
          </div>
        </div>
      )}

      {/* Deposit Flow Modal */}
      {showDepositFlow && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16181D] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#252830]">
              <div className="flex items-center gap-2.5">
                <DollarSign className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Initiate Escrow Deposit</h3>
              </div>
              <button
                onClick={() => setShowDepositFlow(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                You're about to deposit <span className="font-bold text-amber-400">${totalContractUSD.toFixed(2)}</span> into escrow for this contract.
              </p>
              <p className="text-xs text-slate-400">
                The funds will be held in the Vault Escrow Envelope and released automatically upon milestone completion and AI audit approval.
              </p>

              <div className="border border-slate-700 bg-[#0f1115] rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Contract Total</span>
                  <span className="font-mono font-bold text-slate-200">${totalContractUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Service Fee (included)</span>
                  <span className="font-mono font-bold text-slate-400">$0.00</span>
                </div>
                <div className="border-t border-slate-700 pt-2 flex justify-between text-xs font-bold">
                  <span className="text-slate-200">Total to Authorize</span>
                  <span className="font-mono text-amber-400">${totalContractUSD.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowDepositFlow(false)}
                className="flex-1 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateDeposit}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition active:scale-95 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Continue to PayPal</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refund Confirmation Modal */}
      {showRefundConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16181D] border border-cyan-500/30 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#252830]">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Confirm Refund</h3>
              </div>
              <button
                onClick={() => setShowRefundConfirm(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                You're about to initiate a refund of <span className="font-bold text-cyan-400">${refundableUSD.toFixed(2)}</span> to the payer account.
              </p>
              <p className="text-xs text-slate-400">
                This will return all unreleased funds to the original payment source. This action cannot be undone.
              </p>

              <div className="border border-slate-700 bg-[#0f1115] rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Refundable Balance</span>
                  <span className="font-mono font-bold text-cyan-400">${refundableUSD.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Released (non-refundable)</span>
                  <span className="font-mono font-bold text-emerald-400">${releasedUSD.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setShowRefundConfirm(false)}
                className="flex-1 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInitiateRefund}
                disabled={isProcessing}
                className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition active:scale-95 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Confirm Refund</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
