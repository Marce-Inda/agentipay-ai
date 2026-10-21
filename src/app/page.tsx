'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { ProjectPortfolioView } from '../components/ProjectPortfolioView';
import { ProjectWorkspaceView } from '../components/ProjectWorkspaceView';
import { AccountSettingsModal } from '../components/AccountSettingsModal';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { BudgetEnvelope, ProjectContract, TransactionLog, UserProfile } from '../lib/types';
import { applyTransactionLogToProjects } from '../lib/ledger';

const INITIAL_PROFILE: UserProfile = {
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
};

const INITIAL_PROJECTS: ProjectContract[] = [
  // 1. Proyectos que Contrato (OUTGOING)
  {
    id: 'proj-1',
    name: 'Web Platform Engineering',
    vendorName: 'Dev Agency LLC',
    vendorEmail: 'dev@agency.com',
    budgetCapUSD: 250,
    spentUSD: 75,
    status: 'ACTIVE',
    perspective: 'OUTGOING',
    contractType: 'MSA_SOW',
    contractReferenceId: 'MSA-2026-089A',
    milestones: [
      {
        id: 'ms-1-1',
        phaseNumber: 1,
        title: 'Phase 1: Backend API & Database Setup',
        description: 'OAuth2 authentication, PostgreSQL schema & REST endpoints',
        amountUSD: 75,
        status: 'COMPLETED',
        acceptanceCriteria: 'OAuth2 authentication flow, PostgreSQL relational schema, Dockerfile, and integration test suite with >80% coverage.',
        auditScore: 98,
        auditRationale: 'VERIFIED: Automated inspection confirmed OAuth2 token handling, PostgreSQL migrations, and 94% test suite coverage.',
        deliverableProof: 'https://github.com/agency/web-platform/pull/1',
        payPalBatchId: 'SETTLE-PROJ1-001',
      },
      {
        id: 'ms-1-2',
        phaseNumber: 2,
        title: 'Phase 2: Frontend Dashboard UI & Components',
        description: 'Next.js App Router, Tailwind design system & AG Grid integration',
        amountUSD: 100,
        status: 'PENDING',
        acceptanceCriteria: 'Next.js App Router dashboard, responsive Tailwind CSS tokens, real-time AG Grid audit ledger, and zero TypeScript compilation errors.',
      },
      {
        id: 'ms-1-3',
        phaseNumber: 3,
        title: 'Phase 3: Settlement Integration & E2E Testing',
        description: 'Real-time SSE streaming, escrow envelope controls & E2E test suite',
        amountUSD: 75,
        status: 'LOCKED',
        acceptanceCriteria: 'Settlement API integration, idempotent transaction handling, and passing automated test suite.',
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
    perspective: 'OUTGOING',
    contractType: 'MSA_SOW',
    contractReferenceId: 'MSA-2026-104C',
    milestones: [
      {
        id: 'ms-2-1',
        phaseNumber: 1,
        title: 'Phase 1: Wireframes & High-Fidelity Figma Prototypes',
        description: 'Nordic Luxury Fintech design tokens, dark mode palette & typography',
        amountUSD: 60,
        status: 'PENDING',
        acceptanceCriteria: 'Figma interactive prototypes for desktop & mobile, dark mode HSL palette tokens, and typography design guide.',
      },
      {
        id: 'ms-2-2',
        phaseNumber: 2,
        title: 'Phase 2: Component Library & Design Tokens',
        description: 'Reusable Tailwind CSS components, icon set & animations',
        amountUSD: 90,
        status: 'LOCKED',
        acceptanceCriteria: 'Production-ready Tailwind CSS component library, micro-animations, and accessibility compliance WCAG 2.1 AA.',
      },
    ],
  },
  // 2. Proyectos que Realizo como Contratista (INCOMING - Fondos de cliente garantizados)
  {
    id: 'proj-4',
    name: 'FinTech Settlement Core Microservice',
    clientName: 'Apex Financial Holdings Inc.',
    clientEmail: 'treasury@apexholding.example',
    vendorName: 'Acme Global Engineering Corp.',
    vendorEmail: 'billing@acmeglobal.com',
    budgetCapUSD: 1200,
    spentUSD: 400,
    status: 'ACTIVE',
    perspective: 'INCOMING',
    contractType: 'MSA_SOW',
    contractReferenceId: 'MSA-2026-APEX-01',
    milestones: [
      {
        id: 'ms-4-1',
        phaseNumber: 1,
        title: 'Phase 1: Architecture Blueprint & API Spec',
        description: 'OpenAPI specification and OAuth security envelope',
        amountUSD: 400,
        status: 'COMPLETED',
        acceptanceCriteria: 'OpenAPI 3.0 specification, OAuth2 security envelope, and architectural data flow blueprint.',
        auditScore: 99,
        auditRationale: 'VERIFIED: Architecture blueprint verified against financial security standards and OpenAPI 3.0 specs.',
        deliverableProof: 'https://github.com/apex/settlement/pull/12',
        payPalBatchId: 'SETTLE-APEX-001',
      },
      {
        id: 'ms-4-2',
        phaseNumber: 2,
        title: 'Phase 2: Payment Gateway & Microservice Worker',
        description: 'Settlement API integration and automated settlement worker',
        amountUSD: 500,
        status: 'PENDING',
        acceptanceCriteria: 'Settlement API integration, automated webhook handler with idempotent processing, and unit test coverage >= 85%.',
      },
      {
        id: 'ms-4-3',
        phaseNumber: 3,
        title: 'Phase 3: Production Hardening & Security Audit',
        description: 'OWASP LLM and PCI-DSS compliance verification',
        amountUSD: 300,
        status: 'LOCKED',
        acceptanceCriteria: 'OWASP Top 10 for LLM compliance report, prompt injection sanitization tests, and PCI-DSS readiness checklist.',
      },
    ],
  },
  // 3. Subcontratación en Cascada (OUTGOING subcontratado para alimentar proj-4)
  {
    id: 'proj-5',
    name: 'Subcontract: Technical Documentation & Blog',
    vendorName: 'Content Pro Studio',
    vendorEmail: 'editor@contentpro.example',
    budgetCapUSD: 150,
    spentUSD: 0,
    status: 'ACTIVE',
    perspective: 'OUTGOING',
    isSubcontracted: true,
    parentProjectId: 'proj-4',
    contractType: 'STANDARD_AGREEMENT',
    contractReferenceId: 'SUB-2026-DOCS-01',
    milestones: [
      {
        id: 'ms-5-1',
        phaseNumber: 1,
        title: 'Phase 1: OpenAPI Developer Markdown Documentation',
        description: 'Comprehensive integration guide and OpenAPI 3.0 endpoint documentation',
        amountUSD: 75,
        status: 'PENDING',
        acceptanceCriteria: 'Complete Markdown docs, endpoint curl examples, and authentication flow diagrams.',
      },
      {
        id: 'ms-5-2',
        phaseNumber: 2,
        title: 'Phase 2: 3 Technical Launch Deep-Dive Articles',
        description: 'Technical architecture deep-dive and fintech escrow use cases',
        amountUSD: 75,
        status: 'LOCKED',
        acceptanceCriteria: '3 technical articles in Markdown format detailing dual-role escrow and settlement.',
      },
    ],
  },
];

const INITIAL_ENVELOPE: BudgetEnvelope = {
  maxPerTransactionUSD: 250,
  dailyCeilingUSD: 1000,
  spentTodayUSD: 75,
  activeEscrowUSD: 0,
  killSwitchActive: false,
};

const INITIAL_LOGS: TransactionLog[] = [
  {
    id: 'log-init-1',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-07T12:00:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Milestone Settled in Local Ledger: Web Platform Engineering ($250.00 Envelope Cap)',
    amountUSD: 75,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 98,
    status: 'PAYOUT_EXECUTED',
    riskLevel: 'LOW',
    payPalTransactionId: 'SETTLE-PROJ1-001',
    httpPayloadLog: 'LOCAL SETTLEMENT RECORD: Milestone 1 approved; no external payout API called.',
  },
  {
    id: 'log-init-2',
    projectId: 'proj-2',
    projectName: 'UI/UX Brand Redesign',
    timestamp: '2026-10-07T12:05:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Project Contract Active: UI/UX Brand Redesign ($150.00 Envelope Cap)',
    amountUSD: 0,
    recipientEmail: 'design@studio.com',
    auditConfidenceScore: 100,
    status: 'IDLE',
    riskLevel: 'LOW',
  },
];

export default function Home() {
  const [activeView, setActiveView] = useState<'PORTFOLIO' | 'PROJECT_WORKSPACE'>('PORTFOLIO');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-1');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [currentProfile, setCurrentProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [projects, setProjects] = useState<ProjectContract[]>(INITIAL_PROJECTS);
  const [envelope, setEnvelope] = useState<BudgetEnvelope>(INITIAL_ENVELOPE);
  const [logs, setLogs] = useState<TransactionLog[]>(INITIAL_LOGS);

  // Hydrate state from localStorage on initial client mount with v2 schema migration
  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem('agenticpay_profile_v2');
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile) as UserProfile;
        const accountType = parsed.accountType ?? (parsed.role === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL');
        setCurrentProfile({
          ...parsed,
          accountType,
          role: accountType === 'BUSINESS' ? 'BUSINESS' : parsed.role === 'FREELANCER' ? 'FREELANCER' : 'PERSONAL',
        });
      } else {
        setCurrentProfile(INITIAL_PROFILE);
      }

      const savedProjects = localStorage.getItem('agenticpay_projects_v2');
      if (savedProjects) {
        const parsed: unknown = JSON.parse(savedProjects);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProjects(parsed as ProjectContract[]);
        } else {
          setProjects(INITIAL_PROJECTS);
        }
      } else {
        setProjects(INITIAL_PROJECTS);
      }

      const savedEnvelope = localStorage.getItem('agenticpay_envelope_v2');
      if (savedEnvelope) setEnvelope(JSON.parse(savedEnvelope));

      const savedLogs = localStorage.getItem('agenticpay_logs_v2');
      if (savedLogs) setLogs(JSON.parse(savedLogs));
    } catch (err) {
      console.warn('[LocalStorage] Hydration failed, using default state:', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  // Save state updates to localStorage v2
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem('agenticpay_profile_v2', JSON.stringify(currentProfile));
      localStorage.setItem('agenticpay_projects_v2', JSON.stringify(projects));
      localStorage.setItem('agenticpay_envelope_v2', JSON.stringify(envelope));
      localStorage.setItem('agenticpay_logs_v2', JSON.stringify(logs));
    } catch (err) {
      console.warn('[LocalStorage] Save failed:', err);
    }
  }, [currentProfile, projects, envelope, logs, isHydrated]);

  const handleAddLog = (newLog: TransactionLog) => {
    setLogs((prev) => [newLog, ...prev]);
    setProjects((prev) => applyTransactionLogToProjects(prev, newLog));
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
      perspective: data.perspective || 'OUTGOING',
      contractType: data.contractType,
      contractReferenceId: data.contractReferenceId,
      isSubcontracted: data.isSubcontracted,
      parentProjectId: data.parentProjectId,
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
      action: `New Escrow Contract Created: "${newProject.name}" (Vendor: ${newProject.vendorEmail} | Envelope Cap: $${newProject.budgetCapUSD.toFixed(2)}${newProject.contractType ? ` | ${newProject.contractType}` : ''})`,
      amountUSD: 0,
      recipientEmail: newProject.vendorEmail,
      auditConfidenceScore: 100,
      status: 'IDLE',
      riskLevel: 'LOW',
    });
  };

  const handleToggleProjectFreeze = (projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projectId) return p;
        if (p.perspective === 'INCOMING') return p;
        return { ...p, status: p.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED' };
      })
    );
  };

  const handleUpdateProject = (updatedProject: ProjectContract) => {
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
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
        activeView={activeView}
        onNavigatePortfolio={() => setActiveView('PORTFOLIO')}
        onSelectProject={handleSelectProject}
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
            onBackToPortfolio={() => setActiveView('PORTFOLIO')}
            onToggleProjectFreeze={handleToggleProjectFreeze}
            onAddLog={handleAddLog}
            onUpdateProject={handleUpdateProject}
          />
        )}
      </main>

      {/* Create New Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        existingProjects={projects}
        isBusinessAccount={currentProfile.role === 'BUSINESS' || currentProfile.accountType === 'BUSINESS'}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateProject={handleCreateProject}
      />

      {/* Organization & Account Settings Modal */}
      <AccountSettingsModal
        isOpen={isOnboardingOpen}
        currentProfile={currentProfile}
        onClose={() => setIsOnboardingOpen(false)}
        onUpdateProfile={(profile) => {
          setCurrentProfile(profile);
          try {
            localStorage.setItem('agenticpay_profile_v2', JSON.stringify(profile));
          } catch (e) {
            console.error('Failed to sync updated profile to localStorage', e);
          }
        }}
      />

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 px-6 text-center text-xs text-slate-500">
        AgenticPay AI © 2026 • Enterprise Autonomous Multi-Project Escrow Platform
      </footer>
    </div>
  );
}
