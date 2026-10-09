'use client';

import React, { useState } from 'react';
import { Header } from '../components/Header';
import { ProjectPortfolioView } from '../components/ProjectPortfolioView';
import { ProjectWorkspaceView } from '../components/ProjectWorkspaceView';
import { SaaSOnboardingModal } from '../components/SaaSOnboardingModal';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { BudgetEnvelope, ProjectContract, TransactionLog, UserProfile } from '../lib/types';

export default function Home() {
  const [activeView, setActiveView] = useState<'PORTFOLIO' | 'PROJECT_WORKSPACE'>('PORTFOLIO');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-1');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const [currentProfile, setCurrentProfile] = useState<UserProfile>({
    id: 'usr-biz-1',
    name: 'Acme Global Engineering',
    role: 'BUSINESS',
    companyOrTitle: 'Enterprise Buyer & Escrow Manager',
    email: 'billing@acmeglobal.com',
    payPalAccountEmail: 'sb-buyer-acme@business.example.com',
  });

  const [projects, setProjects] = useState<ProjectContract[]>([
    {
      id: 'proj-1',
      name: 'Web Platform Engineering',
      vendorName: 'Dev Agency LLC',
      vendorEmail: 'dev@agency.com',
      budgetCapUSD: 250,
      spentUSD: 75,
      status: 'ACTIVE',
      milestones: [
        {
          id: 'ms-1-1',
          phaseNumber: 1,
          title: 'Phase 1: Backend API & Database Setup',
          description: 'OAuth2 authentication, PostgreSQL schema & REST endpoints',
          amountUSD: 75,
          status: 'COMPLETED',
          auditScore: 98,
          deliverableProof: 'https://github.com/agency/web-platform/pull/1',
          payPalBatchId: 'AGENTICPAY_PROJ1_BATCH',
        },
        {
          id: 'ms-1-2',
          phaseNumber: 2,
          title: 'Phase 2: Frontend Dashboard UI & Components',
          description: 'Next.js 16 App Router, Tailwind v4 design system & AG Grid integration',
          amountUSD: 100,
          status: 'PENDING',
        },
        {
          id: 'ms-1-3',
          phaseNumber: 3,
          title: 'Phase 3: PayPal Sandbox Integration & E2E Testing',
          description: 'Real-time SSE streaming, Vault pre-authorization & E2E test suite',
          amountUSD: 75,
          status: 'LOCKED',
        },
      ],
    },
    {
      id: 'proj-2',
      name: 'UI/UX Brand Redesign',
      vendorName: 'Studio Design Co',
      vendorEmail: 'design@studio.com',
      budgetCapUSD: 150,
      spentUSD: 0,
      status: 'ACTIVE',
      milestones: [
        {
          id: 'ms-2-1',
          phaseNumber: 1,
          title: 'Phase 1: Wireframes & High-Fidelity Figma Prototypes',
          description: 'Nordic Luxury Fintech design tokens, dark mode palette & typography',
          amountUSD: 60,
          status: 'PENDING',
        },
        {
          id: 'ms-2-2',
          phaseNumber: 2,
          title: 'Phase 2: Component Library & Design Tokens',
          description: 'Reusable Tailwind CSS components, icon set & animations',
          amountUSD: 90,
          status: 'LOCKED',
        },
      ],
    },
    {
      id: 'proj-3',
      name: 'Digital Marketing Campaign',
      vendorName: 'Ad Agency Global',
      vendorEmail: 'ad@agency.com',
      budgetCapUSD: 100,
      spentUSD: 0,
      status: 'ACTIVE',
      milestones: [
        {
          id: 'ms-3-1',
          phaseNumber: 1,
          title: 'Phase 1: Campaign Strategy & Copywriting Assets',
          description: 'Target audience persona definition, ad copy & banner assets',
          amountUSD: 50,
          status: 'PENDING',
        },
        {
          id: 'ms-3-2',
          phaseNumber: 2,
          title: 'Phase 2: Ad Launch & Performance Analytics Report',
          description: 'Campaign execution across ad networks & ROI conversion audit',
          amountUSD: 50,
          status: 'LOCKED',
        },
      ],
    },
  ]);

  const [envelope, setEnvelope] = useState<BudgetEnvelope>({
    maxPerTransactionUSD: 250,
    dailyCeilingUSD: 1000,
    spentTodayUSD: 75,
    activeEscrowUSD: 0,
    killSwitchActive: false,
  });

  const [logs, setLogs] = useState<TransactionLog[]>([
    {
      id: 'log-init-1',
      projectId: 'proj-1',
      projectName: 'Web Platform Engineering',
      timestamp: '2026-10-07T12:00:00.000Z',
      agentRole: 'GUARDRAIL',
      action: 'Project Contract Enforced: Web Platform Engineering ($250.00 Vault Cap)',
      amountUSD: 75,
      recipientEmail: 'dev@agency.com',
      auditConfidenceScore: 98,
      status: 'PAYOUT_EXECUTED',
      riskLevel: 'LOW',
      payPalTransactionId: 'AGENTICPAY_PROJ1_BATCH',
      httpPayloadLog: 'POST https://api-m.sandbox.paypal.com/v1/payments/payouts [201 Created]',
    },
    {
      id: 'log-init-2',
      projectId: 'proj-2',
      projectName: 'UI/UX Brand Redesign',
      timestamp: '2026-10-07T12:05:00.000Z',
      agentRole: 'GUARDRAIL',
      action: 'Project Contract Active: UI/UX Brand Redesign ($150.00 Vault Cap)',
      amountUSD: 0,
      recipientEmail: 'design@studio.com',
      auditConfidenceScore: 100,
      status: 'IDLE',
      riskLevel: 'LOW',
    },
  ]);

  const handleAddLog = (newLog: TransactionLog) => {
    setLogs((prev) => [newLog, ...prev]);

    setProjects((prev) =>
      prev.map((p) =>
        p.id === newLog.projectId
          ? { ...p, spentUSD: p.spentUSD + (newLog.status === 'PAYOUT_EXECUTED' ? newLog.amountUSD : 0) }
          : p
      )
    );
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveView('PROJECT_WORKSPACE');
  };

  const handleCreateProject = (data: Omit<ProjectContract, 'id' | 'spentUSD' | 'status'> & { initialScope?: string }) => {
    const newId = `proj-${Date.now()}`;
    const newProject: ProjectContract = {
      id: newId,
      name: data.name,
      vendorName: data.vendorName,
      vendorEmail: data.vendorEmail,
      budgetCapUSD: data.budgetCapUSD,
      spentUSD: 0,
      status: 'ACTIVE',
    };

    setProjects((prev) => [newProject, ...prev]);
    setSelectedProjectId(newId);
    setActiveView('PROJECT_WORKSPACE');

    handleAddLog({
      id: `log-${Date.now()}`,
      projectId: newId,
      projectName: newProject.name,
      timestamp: new Date().toISOString(),
      agentRole: 'GUARDRAIL',
      action: `New Escrow Contract Created: "${newProject.name}" (Vendor: ${newProject.vendorEmail} | Vault Cap: $${newProject.budgetCapUSD.toFixed(2)})`,
      amountUSD: 0,
      recipientEmail: newProject.vendorEmail,
      auditConfidenceScore: 100,
      status: 'IDLE',
      riskLevel: 'LOW',
    });
  };

  const handleToggleProjectFreeze = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId
          ? { ...p, status: p.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' }
          : p
      )
    );
  };

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Header */}
      <Header
        envelope={envelope}
        projects={projects}
        selectedProjectId={selectedProjectId}
        currentProfile={currentProfile}
        onSelectProject={handleSelectProject}
        onOpenCreateProject={() => setIsCreateModalOpen(true)}
        onToggleKillSwitch={() =>
          setEnvelope((prev) => ({ ...prev, killSwitchActive: !prev.killSwitchActive }))
        }
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
      />

      {/* Main View Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {activeView === 'PORTFOLIO' ? (
          <ProjectPortfolioView
            envelope={envelope}
            projects={projects}
            currentProfile={currentProfile}
            onSelectProject={handleSelectProject}
            onOpenCreateModal={() => setIsCreateModalOpen(true)}
            onToggleProjectFreeze={handleToggleProjectFreeze}
          />
        ) : (
          <ProjectWorkspaceView
            project={activeProject}
            envelope={envelope}
            projects={projects}
            logs={logs}
            currentProfile={currentProfile}
            onBackToPortfolio={() => setActiveView('PORTFOLIO')}
            onSelectProject={handleSelectProject}
            onToggleProjectFreeze={handleToggleProjectFreeze}
            onUpdateEnvelope={setEnvelope}
            onAddLog={handleAddLog}
          />
        )}
      </main>

      {/* Create New Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateProject={handleCreateProject}
      />

      {/* SaaS Onboarding & Profile Modal */}
      <SaaSOnboardingModal
        isOpen={isOnboardingOpen}
        currentProfile={currentProfile}
        onClose={() => setIsOnboardingOpen(false)}
        onSelectProfile={(profile) => setCurrentProfile(profile)}
      />

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 px-6 text-center text-xs text-slate-500">
        AgenticPay AI © 2026 • Enterprise Autonomous Multi-Project Escrow Platform
      </footer>
    </div>
  );
}
