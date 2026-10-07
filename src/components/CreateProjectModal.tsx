'use client';

import React, { useState } from 'react';
import { FolderPlus, DollarSign, Mail, User, FileText, X } from 'lucide-react';
import { ProjectContract } from '../lib/types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (newProject: Omit<ProjectContract, 'id' | 'spentUSD' | 'status'> & { initialScope?: string }) => void;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject,
}) => {
  const [name, setName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorEmail, setVendorEmail] = useState('');
  const [budgetCapUSD, setBudgetCapUSD] = useState<number>(200);
  const [initialScope, setInitialScope] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !vendorEmail.trim() || budgetCapUSD <= 0) return;

    onCreateProject({
      name: name.trim(),
      vendorName: vendorName.trim() || 'Contractor',
      vendorEmail: vendorEmail.trim(),
      budgetCapUSD: Number(budgetCapUSD),
      initialScope: initialScope.trim(),
    });

    // Reset form
    setName('');
    setVendorName('');
    setVendorEmail('');
    setBudgetCapUSD(200);
    setInitialScope('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400">
            <FolderPlus className="w-5 h-5" />
            <h3 className="font-bold text-lg text-white">
              Create New Escrow Project & Contract
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder="e.g. iOS Mobile App Development"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Vendor Details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" />
                Vendor / Contractor Name
              </label>
              <input
                type="text"
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                placeholder="e.g. Acme Agency LLC"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" />
                PayPal Vendor Email *
              </label>
              <input
                type="email"
                required
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                placeholder="vendor@sandbox.paypal.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Vault Budget Cap */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              Pre-Authorized Vault Budget Ceiling (USD) *
            </label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2">
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
          </div>

          {/* Initial Scope / Requirements */}
          <div>
            <label className="text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
              <FileText className="w-3 h-3 text-purple-400" />
              Milestone Scope & Requirements (Optional)
            </label>
            <textarea
              value={initialScope}
              rows={2}
              onChange={(e) => setInitialScope(e.target.value)}
              placeholder="e.g. Deliver Figma UI prototype + GitHub repository code PR..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md active:scale-95"
            >
              Create & Lock Escrow Contract
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
