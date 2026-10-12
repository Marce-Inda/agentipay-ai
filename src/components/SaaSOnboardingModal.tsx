'use client';

import React, { useState } from 'react';
import { Building2, User, ShieldCheck, Check, Sparkles, X, ArrowRight, FileCheck, Landmark } from 'lucide-react';
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
  const [selectedRole, setSelectedRole] = useState<UserRole>(
    currentProfile.accountType || (currentProfile.role === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL')
  );

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedRole === 'BUSINESS') {
      onSelectProfile({
        id: 'usr-biz-1',
        name: 'Acme Global Engineering Corp.',
        role: 'BUSINESS',
        accountType: 'BUSINESS',
        companyOrTitle: 'Enterprise Treasury & Escrow Accounts',
        email: 'billing@acmeglobal.com',
        payPalAccountEmail: 'sb-buyer-acme@business.example.com',
        taxId: 'US-EIN-94-2849102',
        legalCompanyName: 'Acme Global Engineering Inc.',
        billingAddress: '500 Financial Center Blvd, Wilmington, DE',
        complianceStatus: 'VERIFIED',
      });
    } else {
      onSelectProfile({
        id: 'usr-pers-1',
        name: 'Alex Rivera (Dev & Creative Studio)',
        role: 'PERSONAL',
        accountType: 'PERSONAL',
        companyOrTitle: 'Independent Software Contractor & Creator',
        email: 'alex.rivera@devstudio.io',
        payPalAccountEmail: 'sb-dev-alex@personal.example.com',
        taxId: 'TAX-IND-739104',
        legalCompanyName: 'Alex Rivera Consulting',
        billingAddress: 'Austin, TX',
        complianceStatus: 'VERIFIED',
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#16181D] border border-amber-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#252830]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                Account & Legal Entity Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Select your account profile tier. Both account tiers support hiring contractors and executing client contracts in parallel.
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
          {/* Business / Enterprise Card */}
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
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-white">
                  🏢 Enterprise Business Account
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                For corporations, agencies, and tech startups requiring structured legal compliance, tax reporting, and high-volume escrow ceilings.
              </p>

              <div className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5 text-amber-300">
                  <FileCheck className="w-3.5 h-3.5" />
                  <span>Binding Contracts: <strong>Master MSA & SOW</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-300">
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Corporate Tax ID (EIN / VAT) & Invoicing</span>
                </div>
                <div className="flex items-center gap-1.5 text-amber-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Cascading Subcontracting & Pooled Vaults</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-amber-500/10 text-[11px] font-mono text-amber-400/90">
              Entity: Acme Global Engineering Inc. (EIN-94-2849102)
            </div>
          </div>

          {/* Personal / Professional Card */}
          <div
            onClick={() => setSelectedRole('PERSONAL')}
            className={`cursor-pointer rounded-xl p-5 border transition-all flex flex-col justify-between space-y-4 ${
              selectedRole === 'PERSONAL' || selectedRole === 'FREELANCER'
                ? 'bg-cyan-500/10 border-cyan-400 ring-2 ring-cyan-500/30 text-white'
                : 'bg-[#0F1115] border-[#252830] hover:border-slate-700 text-slate-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <User className="w-5 h-5" />
              </div>
              {(selectedRole === 'PERSONAL' || selectedRole === 'FREELANCER') && (
                <div className="w-6 h-6 rounded-full bg-cyan-400 flex items-center justify-center text-slate-950 font-bold">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-white">
                  👤 Individual Professional Account
                </h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                For independent developers, designers, and consultants. Deliver client milestones with guaranteed funds or hire collaborators.
              </p>

              <div className="mt-3 space-y-1.5 text-[11px] text-slate-300">
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Client Escrow Guarantee before work delivery</span>
                </div>
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <User className="w-3.5 h-3.5" />
                  <span>Subcontract specialized tasks (e.g. docs, design)</span>
                </div>
                <div className="flex items-center gap-1.5 text-cyan-300">
                  <Landmark className="w-3.5 h-3.5" />
                  <span>Direct settlement to personal PayPal account</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-cyan-500/10 text-[11px] font-mono text-cyan-400/90">
              Entity: Alex Rivera (Independent Studio)
            </div>
          </div>
        </div>

        {/* Informative Note */}
        <div className="p-3 bg-[#0F1115] border border-slate-800 rounded-xl text-xs text-slate-400 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong>Dual Operational Mode Enabled:</strong> Inside the dashboard, seamlessly toggle between <strong className="text-white">"Contracts I Manage"</strong> (pre-authorizing funds in Vault and auditing deliverables) and <strong className="text-white">"Contracts I Deliver"</strong> (inspecting locked client escrows and collecting payouts).
          </span>
        </div>

        {/* Footer Action */}
        <div className="flex items-center justify-between pt-4 border-t border-[#252830]">
          <div className="text-xs font-mono text-slate-400">
            PayPal Vault & Escrow Architecture
          </div>

          <button
            onClick={handleConfirm}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs px-5 py-2.5 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <span>Confirm {selectedRole === 'BUSINESS' ? 'Enterprise' : 'Personal'} Account</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
