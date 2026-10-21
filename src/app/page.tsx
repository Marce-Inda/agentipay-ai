'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { ProjectPortfolioView } from '../components/ProjectPortfolioView';
import { ProjectWorkspaceView } from '../components/ProjectWorkspaceView';
import { AccountSettingsModal } from '../components/AccountSettingsModal';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { AuthScreen, type AuthenticatedUser } from '../components/AuthScreen';
import { BudgetEnvelope, ProjectContract, TransactionLog, UserProfile } from '../lib/types';
import { applyTransactionLogToProjects } from '../lib/ledger';
import {
  PROFILE_STORAGE_KEY,
  SECURE_PROFILE_STORAGE_KEY,
  mergeStoredProfile,
  splitProfileForStorage,
} from '../lib/privacy/storage';

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

function tenantStorageKey(baseKey: string, userId: string): string {
  return `${baseKey}:${userId}`;
}

export default function Home() {
  const [authState, setAuthState] = useState<'LOADING' | 'ANONYMOUS' | 'AUTHENTICATED'>('LOADING');
  const [sessionUser, setSessionUser] = useState<AuthenticatedUser | null>(null);
  const [activeView, setActiveView] = useState<'PORTFOLIO' | 'PROJECT_WORKSPACE'>('PORTFOLIO');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('proj-1');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const serverSyncScopeRef = useRef<string | null>(null);

  const [currentProfile, setCurrentProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [projects, setProjects] = useState<ProjectContract[]>(INITIAL_PROJECTS);
  const [envelope, setEnvelope] = useState<BudgetEnvelope>(INITIAL_ENVELOPE);
  const [logs, setLogs] = useState<TransactionLog[]>(INITIAL_LOGS);

  // Resolve the server session before exposing any tenant data.
  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      try {
        const response = await fetch('/api/auth/session', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (response.status === 401) {
          if (!cancelled) {
            setSessionUser(null);
            setAuthState('ANONYMOUS');
          }
          return;
        }
        const data = (await response.json().catch(() => null)) as
          | { user?: AuthenticatedUser }
          | null;
        if (!response.ok || !data?.user) {
          throw new Error('Invalid session response');
        }
        if (!cancelled) {
          setSessionUser(data.user);
          setAuthState('AUTHENTICATED');
        }
      } catch {
        if (!cancelled) {
          setSessionUser(null);
          setAuthState('ANONYMOUS');
        }
      }
    };

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // Hydrate tenant-scoped state only after authentication resolves.
  useEffect(() => {
    if (!sessionUser) {
      setIsHydrated(false);
      return;
    }

    const scope = sessionUser.id;
    setCurrentProfile(INITIAL_PROFILE);
    setProjects(INITIAL_PROJECTS);
    setEnvelope(INITIAL_ENVELOPE);
    setLogs(INITIAL_LOGS);

    try {
      const savedProfile = localStorage.getItem(
        tenantStorageKey(PROFILE_STORAGE_KEY, scope)
      );
      if (savedProfile) {
        const parsed = JSON.parse(savedProfile) as UserProfile;
        let sensitiveProfile: unknown = null;
        try {
          const rawSensitive = sessionStorage.getItem(
            tenantStorageKey(SECURE_PROFILE_STORAGE_KEY, scope)
          );
          sensitiveProfile = rawSensitive ? JSON.parse(rawSensitive) : null;
        } catch {
          sensitiveProfile = null;
        }
        const hydratedProfile = mergeStoredProfile(parsed, sensitiveProfile);
        const accountType =
          hydratedProfile.accountType ?? (hydratedProfile.role === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL');
        setCurrentProfile({
          ...hydratedProfile,
          accountType,
          role:
            accountType === 'BUSINESS'
              ? 'BUSINESS'
              : hydratedProfile.role === 'FREELANCER'
                ? 'FREELANCER'
                : 'PERSONAL',
        });
      }

      const savedProjects = localStorage.getItem(
        tenantStorageKey('agenticpay_projects_v2', scope)
      );
      if (savedProjects) {
        const parsed: unknown = JSON.parse(savedProjects);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProjects(parsed as ProjectContract[]);
        }
      }

      const savedEnvelope = localStorage.getItem(
        tenantStorageKey('agenticpay_envelope_v2', scope)
      );
      if (savedEnvelope) setEnvelope(JSON.parse(savedEnvelope));

      const savedLogs = localStorage.getItem(
        tenantStorageKey('agenticpay_logs_v2', scope)
      );
      if (savedLogs) setLogs(JSON.parse(savedLogs));
    } catch (err) {
      console.warn('[LocalStorage] Hydration failed, using default state:', err);
    } finally {
      setIsHydrated(true);
    }
  }, [sessionUser]);

  // Reconcile tenant state with the server-authoritative project store.
  useEffect(() => {
    if (!isHydrated || !sessionUser) return;
    if (serverSyncScopeRef.current === sessionUser.id) return;
    serverSyncScopeRef.current = sessionUser.id;
    let cancelled = false;

    const syncProjects = async () => {
      try {
        const response = await fetch('/api/projects', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (response.status === 401 || !response.ok) return;
        const data = (await response.json()) as {
          projects?: ProjectContract[];
          envelope?: BudgetEnvelope | null;
        };
        if (cancelled) return;

        if (Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
          if (data.envelope) setEnvelope(data.envelope);
          setSelectedProjectId((current) =>
            data.projects!.some((project) => project.id === current)
              ? current
              : data.projects![0].id
          );
          return;
        }

        const bootstrap = await fetch('/api/projects/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ projects, envelope }),
        });
        if (!bootstrap.ok || cancelled) return;
        const bootstrapped = (await bootstrap.json()) as {
          projects?: ProjectContract[];
          envelope?: BudgetEnvelope | null;
        };
        if (!cancelled && bootstrapped.projects) {
          setProjects(bootstrapped.projects);
          if (bootstrapped.envelope) setEnvelope(bootstrapped.envelope);
        }
      } catch (err) {
        console.warn('[Projects] Server reconciliation failed:', err);
      }
    };

    void syncProjects();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, sessionUser, projects, envelope]);

  // Persist only under the authenticated user's namespace.
  useEffect(() => {
    if (!isHydrated || !sessionUser) return;
    const scope = sessionUser.id;
    try {
      const { persistable, sensitive } = splitProfileForStorage(currentProfile);
      localStorage.setItem(
        tenantStorageKey(PROFILE_STORAGE_KEY, scope),
        JSON.stringify(persistable)
      );
      localStorage.setItem(
        tenantStorageKey('agenticpay_projects_v2', scope),
        JSON.stringify(projects)
      );
      localStorage.setItem(
        tenantStorageKey('agenticpay_envelope_v2', scope),
        JSON.stringify(envelope)
      );
      localStorage.setItem(
        tenantStorageKey('agenticpay_logs_v2', scope),
        JSON.stringify(logs)
      );
      sessionStorage.setItem(
        tenantStorageKey(SECURE_PROFILE_STORAGE_KEY, scope),
        JSON.stringify(sensitive)
      );
    } catch (err) {
      console.warn('[LocalStorage] Save failed:', err);
    }
  }, [currentProfile, projects, envelope, logs, isHydrated, sessionUser]);

  // Merge durable server ledger entries into the local view.
  useEffect(() => {
    if (!isHydrated || !sessionUser) return;
    let cancelled = false;

    const loadLedger = async () => {
      try {
        const response = await fetch('/api/ledger/events?limit=500', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) return;
        const data = (await response.json()) as { events?: TransactionLog[] };
        if (!Array.isArray(data.events) || cancelled) return;

        setLogs((previous) => {
          const existingIds = new Set(previous.map((log) => log.id));
          const remoteOnly = data.events!.filter(
            (log) => log && typeof log.id === 'string' && !existingIds.has(log.id)
          );
          return remoteOnly.length > 0 ? [...remoteOnly, ...previous] : previous;
        });
      } catch (err) {
        console.warn('[Ledger] Unable to sync durable audit events:', err);
      }
    };

    void loadLedger();
    return () => {
      cancelled = true;
    };
  }, [isHydrated, sessionUser]);

  const handleAuthenticated = (user: AuthenticatedUser) => {
    setSessionUser(user);
    setAuthState('AUTHENTICATED');
    setIsHydrated(false);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
    } catch (err) {
      console.warn('[Auth] Logout request failed:', err);
    } finally {
      setAuthState('ANONYMOUS');
      setSessionUser(null);
      setIsHydrated(false);
      serverSyncScopeRef.current = null;
    }
  };

  const handleAddLog = (newLog: TransactionLog) => {
    setLogs((prev) => [newLog, ...prev]);
    setProjects((prev) => applyTransactionLogToProjects(prev, newLog));

    // Settlement payouts are written exclusively by the server settlement route.
    if (newLog.status === 'PAYOUT_EXECUTED') return;
    if (authState !== 'AUTHENTICATED') return;
    void fetch('/api/ledger/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(newLog),
    })
      .then((response) => {
        if (!response.ok && response.status !== 401) {
          console.warn('[Ledger] Durable event write rejected:', response.status);
        }
      })
      .catch((err) => {
        console.warn('[Ledger] Durable event write failed:', err);
      });
  };

  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveView('PROJECT_WORKSPACE');
  };

  const handleCreateProject = async (
    data: Omit<ProjectContract, 'id' | 'spentUSD' | 'status'> & { initialScope?: string }
  ): Promise<ProjectContract | null> => {
    const now = new Date().toISOString();
    const milestoneAmount = Number(data.budgetCapUSD);
    const milestones: ProjectContract['milestones'] = [
      {
        id: `ms-${crypto.randomUUID()}`,
        phaseNumber: 1,
        title: 'Phase 1: Initial Delivery',
        description: data.initialScope || 'Initial contracted scope of work.',
        amountUSD: milestoneAmount,
        status: 'PENDING',
        acceptanceCriteria:
          data.initialScope ||
          'Deliverable must match the contracted scope and include verifiable proof of execution.',
      },
    ];

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name: data.name,
          vendorName: data.vendorName,
          vendorEmail: data.vendorEmail,
          clientName: data.clientName,
          clientEmail: data.clientEmail,
          budgetCapUSD: data.budgetCapUSD,
          perspective: data.perspective || 'OUTGOING',
          contractType: data.contractType,
          contractReferenceId: data.contractReferenceId,
          isSubcontracted: data.isSubcontracted,
          parentProjectId: data.parentProjectId,
          milestones,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { project?: ProjectContract; error?: string }
        | null;
      if (!response.ok || !payload?.project) {
        console.warn('[Projects] Creation rejected:', payload?.error);
        return null;
      }

      const newProject = payload.project;
      setProjects((prev) => [newProject, ...prev]);
      setSelectedProjectId(newProject.id);
      setActiveView('PROJECT_WORKSPACE');

      handleAddLog({
        id: `log-${Date.now()}`,
        projectId: newProject.id,
        projectName: newProject.name,
        timestamp: now,
        agentRole: 'GUARDRAIL',
        action: `New Escrow Contract Created: "${newProject.name}" (Vendor: ${newProject.vendorEmail} | Envelope Cap: $${newProject.budgetCapUSD.toFixed(2)}${newProject.contractType ? ` | ${newProject.contractType}` : ''})`,
        amountUSD: 0,
        recipientEmail: newProject.vendorEmail,
        auditConfidenceScore: 100,
        status: 'IDLE',
        riskLevel: 'LOW',
      });

      return newProject;
    } catch (error) {
      console.warn('[Projects] Creation failed:', error);
      return null;
    }
  };

  const handleToggleProjectFreeze = (projectId: string) => {
    const target = projects.find((project) => project.id === projectId);
    if (!target || target.perspective === 'INCOMING') return;
    const nextStatus = target.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED';

    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? { ...project, status: nextStatus } : project
      )
    );

    void fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ status: nextStatus }),
    }).catch((error) => {
      console.warn('[Projects] Contract status update failed:', error);
    });
  };

  const handleToggleKillSwitch = () => {
    const next = { ...envelope, killSwitchActive: !envelope.killSwitchActive };
    setEnvelope(next);
    void fetch('/api/envelope', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(next),
    }).catch((error) => {
      console.warn('[Envelope] Kill-switch update failed:', error);
    });
  };

  const handleSettleMilestone = async (
    projectId: string,
    milestoneId: string
  ): Promise<
    | { ok: true; event: TransactionLog }
    | { ok: false; error: string }
  > => {
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/milestones/${encodeURIComponent(milestoneId)}/settle`,
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      const data = (await response.json().catch(() => null)) as
        | {
            event?: TransactionLog;
            project?: ProjectContract;
            envelope?: BudgetEnvelope;
            error?: string;
          }
        | null;
      if (!response.ok || !data?.event || !data.project) {
        return {
          ok: false,
          error: data?.error || 'The server rejected the settlement.',
        };
      }

      setProjects((prev) =>
        prev.map((project) =>
          project.id === data.project!.id ? data.project! : project
        )
      );
      if (data.envelope) setEnvelope(data.envelope);
      setLogs((prev) =>
        prev.some((log) => log.id === data.event!.id)
          ? prev
          : [data.event!, ...prev]
      );

      return { ok: true, event: data.event };
    } catch (error) {
      console.warn('[Settlement] Request failed:', error);
      return { ok: false, error: 'The settlement service could not be reached.' };
    }
  };

  const handleUpdateProject = (updatedProject: ProjectContract) => {
    setProjects((prev) => prev.map((p) => (p.id === updatedProject.id ? updatedProject : p)));
  };

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  if (authState === 'LOADING') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-3 text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-amber-500" />
        <p className="text-xs font-mono uppercase tracking-widest">Verifying secure session</p>
      </div>
    );
  }

  if (authState === 'ANONYMOUS' || !sessionUser) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

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
        onToggleKillSwitch={handleToggleKillSwitch}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
        onLogout={() => void handleLogout()}
        sessionEmail={sessionUser.email}
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
            onSettleMilestone={handleSettleMilestone}
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
        onUpdateProfile={(profile) => setCurrentProfile(profile)}
      />

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-3 px-6 text-center text-xs text-slate-500">
        AgenticPay AI © 2026 • Enterprise Autonomous Multi-Project Escrow Platform
      </footer>
    </div>
  );
}
