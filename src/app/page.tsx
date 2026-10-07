'use client';

import React, { useState } from 'react';
import { Header } from '../components/Header';
import { ProjectPortfolioView } from '../components/ProjectPortfolioView';
import { ProjectWorkspaceView } from '../components/ProjectWorkspaceView';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { BudgetEnvelope, ProjectContract, TransactionLog } from '../lib/types';

export default function Home() {
  const [activeView, setActiveView] = useState<'PORTFOLIO' | 'PROJECT_WORKSPACE'>('PORTFOLIO');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-1');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [projects, setProjects] = useState<ProjectContract[]>([
    {
      id: 'proj-1',
      name: 'Web Platform Engineering',
      vendorName: 'Dev Agency LLC',
      vendorEmail: 'dev@agency.com',
      budgetCapUSD: 250,
      spentUSD: 75,
      status: 'ACTIVE',
    },
    {
      id: 'proj-2',
      name: 'UI/UX Brand Redesign',
      vendorName: 'Studio Design Co',
      vendorEmail: 'design@studio.com',
      budgetCapUSD: 150,
      spentUSD: 0,
      status: 'ACTIVE',
    },
    {
      id: 'proj-3',
      name: 'Digital Marketing Campaign',
      vendorName: 'Ad Agency Global',
      vendorEmail: 'ad@agency.com',
      budgetCapUSD: 100,
      spentUSD: 0,
      status: 'ACTIVE',
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
        onSelectProject={handleSelectProject}
        onOpenCreateProject={() => setIsCreateModalOpen(true)}
        onToggleKillSwitch={() =>
          setEnvelope((prev) => ({ ...prev, killSwitchActive: !prev.killSwitchActive }))
        }
      />

      {/* Main View Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {activeView === 'PORTFOLIO' ? (
          <ProjectPortfolioView
            envelope={envelope}
            projects={projects}
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

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 px-6 text-center text-xs text-slate-500">
        AgenticPay AI © 2026 • Enterprise Autonomous Multi-Project Escrow Platform
      </footer>
    </div>
  );
}
