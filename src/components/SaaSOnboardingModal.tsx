'use client';

import React, { useState } from 'react';
import { Building2, User, ShieldCheck, Check, Sparkles, X, ArrowRight } from 'lucide-react';
import { UserProfile, UserRole } from '../lib/types';

interface SaaSOnboardingModalProps {
  isOpen: boolean;
  currentProfile: UserProfile;
  onClose: () => void;
  onSelectProfile: (profile: UserProfile) => void;
}

export const SaaSOnboardingModal: React.FC<SaaSOnboardingModalProps> = ({
  isOpen,
  currentProfile,
  onClose,
  onSelectProfile,
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentProfile.role);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedRole === 'BUSINESS') {
      onSelectProfile({
        id: 'usr-biz-1',
        name: 'Acme Global Engineering',
        role: 'BUSINESS',
        companyOrTitle: 'Enterprise Buyer & Escrow Manager',
        email: 'billing@acmeglobal.com',
        payPalAccountEmail: 'sb-buyer-acme@business.example.com',
      });
    } else {
      onSelectProfile({
        id: 'usr-free-1',
        name: 'Dev Agency LLC',
        role: 'FREELANCER',
        companyOrTitle: 'Full-Stack Software Contractor',
        email: 'dev@agency.com',
        payPalAccountEmail: 'dev@agency.com',
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#16181D] border border-amber-500/30 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#252830]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                AgenticPay AI SaaS — Workspace Onboarding
              </h2>
              <p className="text-xs text-slate-400">
                Select your account profile role to enter the Escrow Workspace.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#252830] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Cards Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Business / Employer Card */}
          <div
            onClick={() => setSelectedRole('BUSINESS')}
            className={`cursor-pointer rounded-xl p-5 border transition-all flex flex-col justify-between space-y-4 ${
              selectedRole === 'BUSINESS'
                ? 'bg-amber-500/10 border-amber-400 ring-2 ring-amber-500/30 text-white'
                : 'bg-[#0F1115] border-[#252830] hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Building2 className="w-5 h-5" />
              </div>
              {selectedRole === 'BUSINESS' && (
                <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-white mb-1">
                🏢 Empresa / Business (Contratante)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Preautoriza fondos en PayPal Vault, define límites de presupuesto, congela contratos y audita el libro contable de AG Grid.
              </p>
            </div>

            <div className="pt-2 border-t border-amber-500/10 text-[11px] font-mono text-amber-400/90">
              Demo: Acme Global Corp
            </div>
          </div>

          {/* Freelancer / Contractor Card */}
          <div
            onClick={() => setSelectedRole('FREELANCER')}
            className={`cursor-pointer rounded-xl p-5 border transition-all flex flex-col justify-between space-y-4 ${
              selectedRole === 'FREELANCER'
                ? 'bg-cyan-500/10 border-cyan-400 ring-2 ring-cyan-500/30 text-white'
                : 'bg-[#0F1115] border-[#252830] hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <User className="w-5 h-5" />
              </div>
              {selectedRole === 'FREELANCER' && (
                <div className="w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center text-slate-950 font-bold">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-white mb-1">
                💼 Persona / Freelancer (Contratado)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Verifica la garantía de dinero retenido en PayPal Escrow, envía entregables de hitos (Proof of Execution) y cobra sin comisiones ocultas.
              </p>
            </div>

            <div className="pt-2 border-t border-cyan-500/10 text-[11px] font-mono text-cyan-400/90">
              Demo: Dev Agency LLC
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="flex items-center justify-between pt-4 border-t border-[#252830]">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>PayPal Vault Escrow Protection Active</span>
          </div>

          <button
            onClick={handleConfirm}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <span>Enter Workspace as {selectedRole === 'BUSINESS' ? 'Employer' : 'Contractor'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
