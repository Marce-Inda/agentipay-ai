'use client';

import React, { useState } from 'react';
import { FolderPlus, DollarSign, Mail, User, FileText, X, FileCheck, Plus, Trash2, AlertCircle, Link as LinkIcon, Sparkles, Loader } from 'lucide-react';
import { ContractLegalType, ProjectContract, ProjectMilestone } from '../lib/types';
import { validateMilestonePRLinkage, validateGitHubPRUrl } from '../lib/validation/project';

interface MilestoneInput {
  id: string;
  phaseNumber: number;
  title: string;
  description: string;
  amountUSD: number;
  acceptanceCriteria?: string;
  linkedPRNumber?: number;
  linkedPRUrl?: string;
}

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
  
  // Milestone management
  const [milestones, setMilestones] = useState<MilestoneInput[]>([]);
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);
  const [prValidationErrors, setPrValidationErrors] = useState<Record<string, string>>({});

  // AI Contract Drafting State
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftBrief, setDraftBrief] = useState('');
  const [isDraftLoading, setIsDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftedContract, setDraftedContract] = useState<any>(null);
  const [showDraftPreview, setShowDraftPreview] = useState(false);

  if (!isOpen) return null;

  /**
   * Handles AI contract drafting
   */
  const handleDraftContract = async () => {
    if (!draftBrief.trim()) {
      setDraftError('Please provide a brief description of your contract.');
      return;
    }

    if (draftBrief.trim().length < 20) {
      setDraftError('Brief must be at least 20 characters. Provide more detail.');
      return;
    }

    setDraftError('');
    setIsDraftLoading(true);

    try {
      const response = await fetch('/api/agent/draft-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: draftBrief.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        setDraftError(error.error || 'Failed to draft contract. Please try again.');
        setIsDraftLoading(false);
        return;
      }

      const drafted = await response.json();
      setDraftedContract(drafted);
      setShowDraftPreview(true);
    } catch (error) {
      setDraftError('Unable to reach the server. Please check your connection and try again.');
    } finally {
      setIsDraftLoading(false);
    }
  };

  /**
   * Handles loading drafted milestones into the form
   */
  const handleLoadDraftedMilestones = () => {
    if (!draftedContract) return;

    const loadedMilestones: MilestoneInput[] = (draftedContract.milestones || []).map(
      (ms: any, idx: number) => ({
        id: `ms-${Date.now()}-${idx}`,
        phaseNumber: idx + 1,
        title: ms.name || '',
        description: ms.description || '',
        amountUSD: ms.estimatedUSD || 0,
        acceptanceCriteria: (ms.acceptanceCriteria || []).join('\n'),
      })
    );

    setMilestones(loadedMilestones);
    setBudgetCapUSD(Math.ceil((draftedContract.totalEstimatedUSD || 0) * 1.1)); // Add 10% buffer
    setInitialScope(draftedContract.contractSummary || '');
    
    // Reset draft state
    setShowDraftPreview(false);
    setShowDraftModal(false);
    setDraftBrief('');
    setDraftedContract(null);
    setDraftError('');
  };

  const addMilestone = () => {
    const newMilestone: MilestoneInput = {
      id: `ms-${Date.now()}`,
      phaseNumber: (milestones.length || 0) + 1,
      title: '',
      description: '',
      amountUSD: 0,
    };
    setMilestones([...milestones, newMilestone]);
    setExpandedMilestoneId(newMilestone.id);
  };

  const removeMilestone = (id: string) => {
    setMilestones(milestones.filter((m) => m.id !== id));
    if (expandedMilestoneId === id) setExpandedMilestoneId(null);
  };

  const updateMilestone = (id: string, updates: Partial<MilestoneInput>) => {
    setMilestones(
      milestones.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      )
    );

    // Validate PR linkage if PR fields are being updated
    if ('linkedPRNumber' in updates || 'linkedPRUrl' in updates) {
      const milestone = milestones.find((m) => m.id === id);
      if (milestone) {
        const updated = { ...milestone, ...updates };
        const validation = validateMilestonePRLinkage({
          linkedPRNumber: updated.linkedPRNumber,
          linkedPRUrl: updated.linkedPRUrl,
        });
        if (!validation.valid) {
          setPrValidationErrors({ ...prValidationErrors, [id]: validation.error || 'Invalid PR linkage' });
        } else {
          const newErrors = { ...prValidationErrors };
          delete newErrors[id];
          setPrValidationErrors(newErrors);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !vendorEmail.trim() || budgetCapUSD <= 0 || isSubmitting) return;

    // Validate all milestone PR linkages before submission
    const allPrErrors: Record<string, string> = {};
    for (const ms of milestones) {
      const validation = validateMilestonePRLinkage({
        linkedPRNumber: ms.linkedPRNumber,
        linkedPRUrl: ms.linkedPRUrl,
      });
      if (!validation.valid) {
        allPrErrors[ms.id] = validation.error || 'Invalid PR linkage';
      }
    }

    if (Object.keys(allPrErrors).length > 0) {
      setPrValidationErrors(allPrErrors);
      setSubmitError('Please fix PR linkage errors before creating the contract.');
      return;
    }

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
      milestones: milestones.map((ms) => ({
        id: ms.id,
        phaseNumber: ms.phaseNumber,
        title: ms.title,
        description: ms.description,
        amountUSD: ms.amountUSD,
        status: 'PENDING' as const,
        acceptanceCriteria: ms.acceptanceCriteria,
        linkedPRNumber: ms.linkedPRNumber,
        linkedPRUrl: ms.linkedPRUrl,
      })),
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
    setMilestones([]);
    setPrValidationErrors({});
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

          {/* Milestones Section */}
          <div className="bg-[#0F1115] border border-slate-800 rounded-lg p-3 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                🎯 Contract Milestones (Optional)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowDraftModal(true)}
                  className="flex items-center gap-1 text-xs bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded px-2 py-1 transition-colors"
                  title="Use AI to generate milestones from a natural language brief"
                >
                  <Sparkles className="w-3 h-3" />
                  Draft with AI
                </button>
                <button
                  type="button"
                  onClick={addMilestone}
                  className="flex items-center gap-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded px-2 py-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add Milestone
                </button>
              </div>
            </div>

            {milestones.length === 0 ? (
              <p className="text-[11px] text-slate-500 italic">
                No milestones added yet. Add milestones to break down the contract into phases.
              </p>
            ) : (
              <div className="space-y-2">
                {milestones.map((milestone, idx) => (
                  <div key={milestone.id} className="bg-[#16181D] border border-slate-700 rounded-lg p-2.5 space-y-2">
                    {/* Milestone Header */}
                    <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedMilestoneId(expandedMilestoneId === milestone.id ? null : milestone.id)}>
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs font-bold text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          Phase {milestone.phaseNumber}
                        </span>
                        <span className="text-xs text-white font-semibold truncate">
                          {milestone.title || '(Untitled)'}
                        </span>
                        {milestone.linkedPRNumber || milestone.linkedPRUrl ? (
                          <div title="PR linked">
                            <LinkIcon className="w-3 h-3 text-cyan-400" />
                          </div>
                        ) : null}
                      </div>
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        ${milestone.amountUSD.toFixed(2)}
                      </span>
                    </div>

                    {/* Expanded Milestone Details */}
                    {expandedMilestoneId === milestone.id && (
                      <div className="space-y-2 border-t border-slate-600 pt-2">
                        {/* Title */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                            Milestone Title
                          </label>
                          <input
                            type="text"
                            value={milestone.title}
                            onChange={(e) => updateMilestone(milestone.id, { title: e.target.value })}
                            placeholder="e.g. API Development Phase"
                            className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 text-[10px] text-white placeholder-slate-600 focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {/* Description */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                            Description
                          </label>
                          <textarea
                            rows={2}
                            value={milestone.description}
                            onChange={(e) => updateMilestone(milestone.id, { description: e.target.value })}
                            placeholder="What should be delivered..."
                            className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 text-[10px] text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                          />
                        </div>

                        {/* Amount */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                            Amount (USD)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={milestone.amountUSD}
                            onChange={(e) => updateMilestone(milestone.id, { amountUSD: Number(e.target.value) })}
                            className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 text-[10px] text-emerald-400 font-bold focus:outline-none focus:border-amber-500"
                          />
                        </div>

                        {/* Acceptance Criteria */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                            Acceptance Criteria
                          </label>
                          <textarea
                            rows={2}
                            value={milestone.acceptanceCriteria || ''}
                            onChange={(e) => updateMilestone(milestone.id, { acceptanceCriteria: e.target.value })}
                            placeholder="e.g. Passing tests, code review, documentation..."
                            className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 text-[10px] text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                          />
                        </div>

                        {/* GitHub PR Linkage Section */}
                        <div className="bg-[#0F1115] border border-cyan-500/20 rounded p-2 space-y-2">
                          <label className="text-[10px] font-semibold text-cyan-300 flex items-center gap-1">
                            <LinkIcon className="w-3 h-3" />
                            GitHub PR Linkage (Optional)
                          </label>

                          {/* PR Number */}
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                              PR Number
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={milestone.linkedPRNumber || ''}
                              onChange={(e) => updateMilestone(milestone.id, { linkedPRNumber: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="e.g. 42"
                              className="w-full bg-[#0F1115] border border-slate-700 rounded px-2 py-1 text-[10px] text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                            />
                          </div>

                          {/* PR URL */}
                          <div>
                            <label className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                              PR URL
                            </label>
                            <input
                              type="url"
                              value={milestone.linkedPRUrl || ''}
                              onChange={(e) => updateMilestone(milestone.id, { linkedPRUrl: e.target.value })}
                              placeholder="https://github.com/owner/repo/pull/42"
                              className={`w-full bg-[#0F1115] border rounded px-2 py-1 text-[10px] text-white placeholder-slate-600 focus:outline-none ${
                                prValidationErrors[milestone.id]
                                  ? 'border-rose-500/50 focus:border-rose-500'
                                  : 'border-slate-700 focus:border-cyan-500'
                              }`}
                            />
                            {prValidationErrors[milestone.id] && (
                              <p className="text-[9px] text-rose-300 mt-1 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {prValidationErrors[milestone.id]}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Remove Button */}
                        <div className="flex justify-end pt-1 border-t border-slate-600">
                          <button
                            type="button"
                            onClick={() => removeMilestone(milestone.id)}
                            className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
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

      {/* AI Contract Draft Modal */}
      {showDraftModal && !showDraftPreview && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#16181D] border border-purple-500/30 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-fadeIn">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#252830] pb-3">
              <div className="flex items-center gap-2 text-purple-400">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-lg text-white">Draft Contract with AI</h3>
              </div>
              <button
                onClick={() => {
                  setShowDraftModal(false);
                  setDraftBrief('');
                  setDraftError('');
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-[#252830] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Help Text */}
            <div className="text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">Natural Language Brief</p>
              <p>
                Describe your contract requirements in plain language. Include key deliverables, technical requirements, and any specific acceptance criteria.
              </p>
              <p className="text-slate-500 italic">
                Example: "Build a login page with OAuth support, including 3 unit tests, CI/CD integration, and API documentation. Deadline: 2 weeks."
              </p>
            </div>

            {/* Brief Input */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                Contract Brief *
              </label>
              <textarea
                value={draftBrief}
                onChange={(e) => setDraftBrief(e.target.value)}
                rows={5}
                placeholder="Describe what you need the contractor to build or deliver..."
                className="w-full bg-[#0F1115] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Minimum 20 characters • Maximum 2000 characters • Current: {draftBrief.length}
              </p>
            </div>

            {/* Error */}
            {draftError && (
              <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{draftError}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252830]">
              <button
                type="button"
                onClick={() => {
                  setShowDraftModal(false);
                  setDraftBrief('');
                  setDraftError('');
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-[#252830] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDraftContract}
                disabled={isDraftLoading}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 border border-purple-400/30 transition-all shadow-md active:scale-95 disabled:cursor-wait disabled:opacity-60 flex items-center gap-2"
              >
                {isDraftLoading ? (
                  <>
                    <Loader className="w-3 h-3 animate-spin" />
                    Drafting...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" />
                    Generate Draft
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Preview Modal */}
      {showDraftPreview && draftedContract && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-[#16181D] border border-purple-500/30 rounded-xl max-w-2xl w-full p-5 shadow-2xl space-y-4 animate-fadeIn max-h-[80vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#252830] pb-3 sticky top-0 bg-[#16181D]">
              <div className="flex items-center gap-2 text-purple-400">
                <FileCheck className="w-5 h-5" />
                <h3 className="font-bold text-lg text-white">Drafted Contract Preview</h3>
              </div>
              <button
                onClick={() => {
                  setShowDraftPreview(false);
                  setDraftedContract(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg bg-[#252830] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Contract Summary */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Contract Summary</label>
              <p className="text-xs text-slate-400 bg-[#0F1115] border border-slate-800 rounded-lg px-3 py-2">
                {draftedContract.contractSummary}
              </p>
            </div>

            {/* Total Estimated USD */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Total Estimated Budget</label>
              <div className="text-lg font-bold text-emerald-400 bg-[#0F1115] border border-emerald-500/30 rounded-lg px-3 py-2">
                ${draftedContract.totalEstimatedUSD.toFixed(2)} USD
              </div>
            </div>

            {/* Drafted Milestones */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Milestones</label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(draftedContract.milestones || []).map((ms: any, idx: number) => (
                  <div key={idx} className="bg-[#0F1115] border border-slate-700 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white">
                        {idx + 1}. {ms.name}
                      </h4>
                      <span className="text-xs font-mono text-emerald-400 font-bold">
                        ${ms.estimatedUSD.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400">{ms.description}</p>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-slate-300">Acceptance Criteria:</p>
                      <ul className="text-[10px] text-slate-400 list-disc list-inside space-y-0.5 ml-2">
                        {(ms.acceptanceCriteria || []).map((criterion: string, cidx: number) => (
                          <li key={cidx}>{criterion}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#252830] sticky bottom-0 bg-[#16181D]">
              <button
                type="button"
                onClick={() => {
                  setShowDraftPreview(false);
                  setDraftBrief('');
                  setDraftError('');
                  setShowDraftModal(true);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-[#252830] transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleLoadDraftedMilestones}
                className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 border border-purple-400/30 transition-all shadow-md active:scale-95 flex items-center gap-2"
              >
                <FileCheck className="w-3 h-3" />
                Load These Milestones
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
