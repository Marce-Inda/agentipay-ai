'use client';

import React, { useState } from 'react';
import { FolderPlus, DollarSign, Mail, User, FileText, X, FileCheck } from 'lucide-react';
import { ContractLegalType, ProjectContract } from '../lib/types';

interface CreateProjectModalProps {
  isOpen: boolean;
  existingProjects?: ProjectContract[];
  isBusinessAccount?: boolean;
  onClose: () => void;
  onCreateProject: (
    newProject: Omit<ProjectContract, 'id' | 'spentUSD' | 'status'> & { initialScope?: string }
  ) => Promise<ProjectContract | null>;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  existingProjects = [],
  isBusinessAccount = true,
  onClose,
  onCreateProject,
}) => {
  const [name, setName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [budgetCapUSD, setBudgetCapUSD] = useState<number>(200);
  const [initialScope, setInitialScope] = useState('');
  const [isSubcontract, setIsSubcontract] = useState(false);
  const [parentProjectId, setParentProjectId] = useState<string>(existingProjects[0]?.id || '');
  const [contractType, setContractType] = useState<ContractLegalType>(
    isBusinessAccount ? 'MSA_SOW' : 'STANDARD_AGREEMENT'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !vendorEmail.trim() || budgetCapUSD <= 0 || isSubmitting) return;
    setSubmitError('');
    setIsSubmitting(true);

    const randomRef = Math.floor(1000 + Math.random() * 9000);
    const contractReferenceId = contractType === 'MSA_SOW' 
      ? `MSA-2026-${randomRef}E` 
      : `STD-AGR-${randomRef}`;

    const created = await onCreateProject({
      name: name.trim(),
      vendorName: vendorName.trim() || 'Contractor',
      vendorEmail: vendorEmail.trim(),
      budgetCapUSD: Number(budgetCapUSD),
      initialScope: initialScope.trim(),
      perspective: 'OUTGOING',
      contractType,
      contractReferenceId,
      isSubcontracted: isSubcontract,
      parentProjectId: isSubcontract ? parentProjectId : undefined,
    });

    setIsSubmitting(false);
    if (!created) {
      setSubmitError('The contract could not be created. Verify the vendor details and retry.');
      return;
    }

    // Reset form
    setName('');
    setVendorName('');
    setVendorEmail('');
    setBudgetCapUSD(200);
    setInitialScope('');
    setIsSubcontract(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-[#16181D] border border-amber-500/30 rounded-xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#252830] pb-3">
          <div className="flex items-center gap-2 text-amber-400">
            <FolderPlus className="w-5 h-5" />
            <h3 className="font-bold text-lg text-white">
              New Escrow Contract
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-[#252830] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Initiative Mode: Direct Hire vs Subcontract */}
          <div className="bg-[#0F1115] border border-slate-800 rounded-lg p-3 space-y-2">
            <span className="text-xs font-semibold text-slate-300 block">Initiative Structure:</span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setIsSubcontract(false)}
                className={`py-2 px-3 rounded-lg border text-left font-semibold transition-all ${
                  !isSubcontract
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                    : 'bg-[#16181D] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                💼 Direct Hire Contract
                <span className="text-[10px] block opacity-70 font-normal">Standalone contract</span>
              </button>

              <button
                type="button"
                onClick={() => setIsSubcontract(true)}
                className={`py-2 px-3 rounded-lg border text-left font-semibold transition-all ${
                  isSubcontract
                    ? 'bg-cyan-500/10 border-cyan-500 text-cyan-300'
                    : 'bg-[#16181D] border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🔀 Subcontracted Module
                <span className="text-[10px] block opacity-70 font-normal">Delegate deliverable of existing contract</span>
              </button>
            </div>

            {isSubcontract && existingProjects.length > 0 && (
              <div className="pt-2">
                <label className="text-[11px] text-cyan-300 block mb-1">
                  Link to Parent Contract:
                </label>
                <select
                  value={parentProjectId}
                  onChange={(e) => setParentProjectId(e.target.value)}
                  className="w-full bg-[#16181D] border border-cyan-500/30 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {existingProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (${p.budgetCapUSD.toFixed(2)} USD)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Project Name */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
              Project / Contract Title *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Technical API Documentation & Developer Guides"
              className="w-full bg-[#0F1115] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {/* Vendor Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <User className="w-3 h-3 text-amber-500/70" />
                Contractor / Vendor Name *
              </label>
              <input
                type="text"
                required
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Content Pro Studio"
                className="w-full bg-[#0F1115] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Mail className="w-3 h-3 text-amber-500/70" />
                Contractor Settlement Email *
              </label>
              <input
                type="email"
                required
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                placeholder="vendor@example.com"
                className="w-full bg-[#0F1115] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Envelope Ceiling & Legal Contract Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                Contract Envelope Ceiling *
              </label>
              <div className="flex items-center gap-2 bg-[#0F1115] border border-slate-800 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  required
                  min="1"
                  value={budgetCapUSD}
                  onChange={(e) => setBudgetCapUSD(Number(e.target.value))}
                  placeholder="200"
                  className="w-full bg-transparent text-xs text-emerald-400 font-bold focus:outline-none"
                />
                <span className="text-xs text-slate-500">USD</span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">
                The envelope ceiling is enforced server-side. No funds are transferred when the contract is created.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <FileCheck className="w-3 h-3 text-amber-400" />
                Legal Framework
              </label>
              <select
                value={contractType}
                onChange={(e) => setContractType(e.target.value as ContractLegalType)}
                className="w-full bg-[#0F1115] border border-slate-800 rounded-lg px-3 py-2 text-xs text-amber-300 font-semibold focus:outline-none"
              >
                <option value="MSA_SOW">📜 Binding Master MSA & SOW (Enterprise)</option>
                <option value="STANDARD_AGREEMENT">📝 Standard Milestone Terms</option>
              </select>
            </div>
          </div>

          {/* Initial Scope / Requirements */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3 text-amber-400" />
              Deliverable Specification (SOW Scope)
            </label>
            <textarea
              value={initialScope}
              rows={2}
              onChange={(e) => setInitialScope(e.target.value)}
              placeholder="e.g. Complete OpenAPI documentation markdown guide, GitHub pull request, and test verification..."
              className="w-full bg-[#0F1115] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          {submitError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
              {submitError}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252830]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-[#252830] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 border border-amber-400/30 transition-all shadow-md active:scale-95 disabled:cursor-wait disabled:opacity-60"
            >
              {isSubmitting ? 'Creating secure contract...' : 'Create Escrow Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
