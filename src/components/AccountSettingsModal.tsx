'use client';

import React, { useState } from 'react';
import { ShieldCheck, Check, X, Landmark, Settings, Mail, MapPin, Save } from 'lucide-react';
import { UserProfile, AccountType } from '../lib/types';

interface AccountSettingsModalProps {
  isOpen: boolean;
  currentProfile: UserProfile;
  onClose: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  currentProfile,
  onClose,
  onUpdateProfile,
}) => {
  // Form states initialized with current profile
  const [legalName, setLegalName] = useState(currentProfile.legalCompanyName || currentProfile.name);
  const [name, setName] = useState(currentProfile.name);
  const [email, setEmail] = useState(currentProfile.email);
  const [payPalAccountEmail, setPayPalAccountEmail] = useState(currentProfile.payPalAccountEmail || '');
  const [taxId, setTaxId] = useState(currentProfile.taxId || '');
  const [billingAddress, setBillingAddress] = useState(currentProfile.billingAddress || '');
  const [accountType, setAccountType] = useState<AccountType>(
    currentProfile.accountType || (currentProfile.role === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL')
  );
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: UserProfile = {
      ...currentProfile,
      name,
      legalCompanyName: legalName,
      email,
      payPalAccountEmail,
      taxId,
      billingAddress,
      accountType,
      role: accountType,
    };
    onUpdateProfile(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  const isComplianceVerified = currentProfile.complianceStatus === 'VERIFIED';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#16181D] border border-amber-500/30 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#252830]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Organization & Account Settings
              </h2>
              <p className="text-xs text-slate-400">
                Manage legal identity, tax compliance, and settlement account details.
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

        <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Trading Name / Display Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#252830] focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Registered Legal Company Name
                </label>
                <input
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#252830] focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <Landmark className="w-3 h-3 text-amber-400" />
                  Corporate Tax ID (EIN / VAT / RFC)
                </label>
                <input
                  type="text"
                  required
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="US-EIN-XX-XXXXXXX"
                  className="w-full bg-[#0F1115] border border-[#252830] focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <Mail className="w-3 h-3 text-amber-400" />
                  Primary Organization Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#252830] focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Settlement Email
                </label>
                <input
                  type="email"
                  required
                  value={payPalAccountEmail}
                  onChange={(e) => setPayPalAccountEmail(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#252830] focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  Billing Jurisdiction & Address
                </label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  className="w-full bg-[#0F1115] border border-[#252830] focus:border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>
            </div>

            {/* Account Tier selector */}
            <div className="pt-2 border-t border-[#252830] space-y-2">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Account Compliance Tier
              </label>
              <p className="text-[11px] text-slate-500">
                Account type controls compliance and invoicing. Contract perspective is selected per contract.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAccountType('BUSINESS')}
                  className={`p-3 rounded-xl border text-left transition ${
                    accountType === 'BUSINESS'
                      ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                      : 'bg-[#0F1115] border-[#252830] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                    <span>🏢 Enterprise Business</span>
                    {accountType === 'BUSINESS' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Binding Master MSA & SOW contracts, structured tax invoices, and higher escrow envelope ceilings.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAccountType('PERSONAL')}
                  className={`p-3 rounded-xl border text-left transition ${
                    accountType === 'PERSONAL'
                      ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30'
                      : 'bg-[#0F1115] border-[#252830] text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white mb-1">
                    <span>👤 Individual Professional</span>
                    {accountType === 'PERSONAL' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Direct personal settlement records and milestone-based escrow contracts without legal overhead.
                  </p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#252830]">
              <span
                className={`text-[11px] flex items-center gap-1 font-mono ${
                  isComplianceVerified ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                KYB Compliance: {isComplianceVerified ? 'Verified' : 'Pending Review'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-lg transition active:scale-95 flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savedSuccess ? 'Settings Saved!' : 'Save & Update Organization'}</span>
                </button>
              </div>
            </div>
        </form>
      </div>
    </div>
  );
};
