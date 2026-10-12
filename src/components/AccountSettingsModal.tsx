'use client';

import React, { useState } from 'react';
import {
  Building2,
  User,
  ShieldCheck,
  Check,
  X,
  FileCheck,
  Landmark,
  Settings,
  Mail,
  MapPin,
  Save,
  ArrowRightLeft,
} from 'lucide-react';
import { UserProfile, UserRole, AccountType } from '../lib/types';

interface AccountSettingsModalProps {
  isOpen: boolean;
  currentProfile: UserProfile;
  onClose: () => void;
  onUpdateProfile: (profile: UserProfile) => void;
}

// Pre-configured enterprise accounts for multi-session workspace switching in video / testing
const KNOWN_ORGANIZATIONS: UserProfile[] = [
  {
    id: 'usr-biz-1',
    name: 'Acme Global Engineering Corp.',
    role: 'BUSINESS',
    accountType: 'BUSINESS',
    companyOrTitle: 'Enterprise Treasury & Multi-Contract Escrow',
    email: 'billing@acmeglobal.com',
    payPalAccountEmail: 'sb-buyer-acme@business.example.com',
    taxId: 'US-EIN-94-2849102',
    legalCompanyName: 'Acme Global Engineering Inc.',
    billingAddress: '500 Financial Center Blvd, Wilmington, DE',
    complianceStatus: 'VERIFIED',
  },
  {
    id: 'usr-apex-1',
    name: 'Apex Financial Holdings Inc.',
    role: 'BUSINESS',
    accountType: 'BUSINESS',
    companyOrTitle: 'Corporate Client & Prime Escrow Funder',
    email: 'treasury@apexholding.example',
    payPalAccountEmail: 'treasury-apex@business.example.com',
    taxId: 'US-EIN-12-8941029',
    legalCompanyName: 'Apex Financial Holdings Inc.',
    billingAddress: '1 Wall Street Plaza, New York, NY',
    complianceStatus: 'VERIFIED',
  },
  {
    id: 'usr-dev-1',
    name: 'Dev Agency LLC',
    role: 'BUSINESS',
    accountType: 'BUSINESS',
    companyOrTitle: 'Software Engineering & Microservice Contractor',
    email: 'dev@agency.com',
    payPalAccountEmail: 'dev-payouts@agency.com',
    taxId: 'US-EIN-55-9018234',
    legalCompanyName: 'Dev Agency LLC',
    billingAddress: '742 Evergreen Terrace, Seattle, WA',
    complianceStatus: 'VERIFIED',
  },
  {
    id: 'usr-pers-1',
    name: 'Alex Rivera (Creative Studio)',
    role: 'PERSONAL',
    accountType: 'PERSONAL',
    companyOrTitle: 'Independent Software Contractor & Creator',
    email: 'alex.rivera@devstudio.io',
    payPalAccountEmail: 'sb-dev-alex@personal.example.com',
    taxId: 'TAX-IND-739104',
    legalCompanyName: 'Alex Rivera Consulting',
    billingAddress: 'Austin, TX',
    complianceStatus: 'VERIFIED',
  },
];

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  currentProfile,
  onClose,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'ORGANIZATION' | 'SESSION'>('ORGANIZATION');

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

  const handleSwitchSession = (org: UserProfile) => {
    onUpdateProfile(org);
    setName(org.name);
    setLegalName(org.legalCompanyName || org.name);
    setEmail(org.email);
    setPayPalAccountEmail(org.payPalAccountEmail || '');
    setTaxId(org.taxId || '');
    setBillingAddress(org.billingAddress || '');
    setAccountType(org.accountType || 'BUSINESS');
    onClose();
  };

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
                Manage legal identity, tax compliance, settlement accounts, and multi-tenant workspaces.
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

        {/* Tab switcher */}
        <div className="flex items-center gap-2 border-b border-[#252830] pb-2 text-xs">
          <button
            onClick={() => setActiveTab('ORGANIZATION')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'ORGANIZATION'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Legal Entity & Taxes</span>
          </button>

          <button
            onClick={() => setActiveTab('SESSION')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              activeTab === 'SESSION'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Switch Active Workspace Session</span>
          </button>
        </div>

        {/* Tab 1: Organization Settings Form */}
        {activeTab === 'ORGANIZATION' ? (
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
                  PayPal Sandbox Settlement Email
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
                    Binding Master MSA & SOW contracts, structured tax invoices, high-cap escrow vaults.
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
                    Direct personal PayPal settlement, guaranteed escrow contracts without legal overhead.
                  </p>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#252830]">
              <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-mono">
                <ShieldCheck className="w-3.5 h-3.5" /> KYB Compliance: Level 3 Verified
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
        ) : (
          /* Tab 2: Switch Active Workspace Session (for video filming & independent multi-account testing) */
          <div className="space-y-4">
            <div className="bg-[#0F1115] border border-[#252830] rounded-xl p-3 text-xs text-slate-300 leading-relaxed">
              <p className="font-semibold text-white mb-1">Multi-Tenant Organization Workspaces</p>
              In production, users authenticate with their unique email. You can switch your active authenticated account below to inspect the platform from any party&apos;s perspective (Client vs Contractor):
            </div>

            <div className="space-y-2.5">
              {KNOWN_ORGANIZATIONS.map((org) => {
                const isSelected = org.email === currentProfile.email;
                return (
                  <div
                    key={org.id}
                    onClick={() => handleSwitchSession(org)}
                    className={`cursor-pointer p-3.5 rounded-xl border flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30'
                        : 'bg-[#0F1115] border-[#252830] hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center ${
                          org.role === 'BUSINESS'
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                            : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                        }`}
                      >
                        {org.role === 'BUSINESS' ? (
                          <Building2 className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{org.name}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-black/40 border border-slate-700 text-slate-400 rounded">
                            {org.accountType}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {org.email} • {org.taxId}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Active Session
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400 hover:text-white px-2.5 py-1 rounded bg-[#252830] border border-slate-700">
                          Switch to this Account
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#252830]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
