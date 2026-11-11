'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { ProjectPortfolioView } from '../components/ProjectPortfolioView';
import { ProjectWorkspaceView } from '../components/ProjectWorkspaceView';
import { AccountSettingsModal } from '../components/AccountSettingsModal';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { BudgetEnvelope, ProjectContract, TransactionLog, UserProfile } from '../lib/types';
import { applyTransactionLogToProjects } from '../lib/ledger';
import {
  PROFILE_STORAGE_KEY,
  SECURE_PROFILE_STORAGE_KEY,
  mergeStoredProfile,
  splitProfileForStorage,
} from '../lib/privacy/storage';

type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
};

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
        auditRationale: 'VERIFIED: Automated inspection confirmed OAuth2 token handling, PostgreSQL migrations, and 94% test suite coverage. CI passed with 0 security warnings.',
        deliverableProof: 'https://github.com/agency/web-platform/pull/1',
        payPalBatchId: 'SETTLE-PROJ1-001',
        linkedPRNumber: 1,
        linkedPRUrl: 'https://github.com/agency/web-platform/pull/1',
      },
      {
        id: 'ms-1-2',
        phaseNumber: 2,
        title: 'Phase 2: Frontend Dashboard UI & Components',
        description: 'Next.js App Router, Tailwind design system & AG Grid integration',
        amountUSD: 100,
        status: 'AUDITED_PENDING_APPROVAL',
        acceptanceCriteria: 'Next.js App Router dashboard, responsive Tailwind CSS tokens, real-time AG Grid audit ledger, and zero TypeScript compilation errors.',
        auditScore: 92,
        auditRationale: 'VERIFIED: Dashboard rendered correctly with full Tailwind compliance. Minor: 2 accessibility warnings resolved. TypeScript: 0 errors. Test coverage: 87%.',
        deliverableProof: 'https://github.com/agency/web-platform/pull/8',
        linkedPRNumber: 8,
        linkedPRUrl: 'https://github.com/agency/web-platform/pull/8',
      },
      {
        id: 'ms-1-3',
        phaseNumber: 3,
        title: 'Phase 3: Settlement Integration & E2E Testing',
        description: 'Real-time SSE streaming, escrow envelope controls & E2E test suite',
        amountUSD: 75,
        status: 'PENDING',
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
    spentUSD: 60,
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
        status: 'COMPLETED',
        acceptanceCriteria: 'Figma interactive prototypes for desktop & mobile, dark mode HSL palette tokens, and typography design guide.',
        auditScore: 95,
        auditRationale: 'VERIFIED: All wireframes meet design specifications. Figma components fully responsive. Accessibility: WCAG 2.1 AA compliant.',
        deliverableProof: 'https://figma.com/files/studio-design-co/2026',
        payPalBatchId: 'SETTLE-PROJ2-001',
      },
      {
        id: 'ms-2-2',
        phaseNumber: 2,
        title: 'Phase 2: Component Library & Design Tokens',
        description: 'Reusable Tailwind CSS components, icon set & animations',
        amountUSD: 90,
        status: 'AUDITED_PENDING_APPROVAL',
        acceptanceCriteria: 'Production-ready Tailwind CSS component library, micro-animations, and accessibility compliance WCAG 2.1 AA.',
        auditScore: 89,
        auditRationale: 'VERIFIED: 45 reusable components delivered. All animations meet performance standards (<60ms). 3 minor animation tweaks suggested.',
        linkedPRUrl: 'https://github.com/acmeglobal/design-tokens/pull/12',
        linkedPRNumber: 12,
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
    spentUSD: 800,
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
        auditRationale: 'VERIFIED: Architecture blueprint verified against financial security standards and OpenAPI 3.0 specs. Exceeds PCI-DSS 3.2.1 baseline.',
        deliverableProof: 'https://github.com/apex/settlement/pull/12',
        payPalBatchId: 'SETTLE-APEX-001',
        linkedPRNumber: 12,
        linkedPRUrl: 'https://github.com/apex/settlement/pull/12',
      },
      {
        id: 'ms-4-2',
        phaseNumber: 2,
        title: 'Phase 2: Payment Gateway & Microservice Worker',
        description: 'Settlement API integration and automated settlement worker',
        amountUSD: 500,
        status: 'AUDITED_PENDING_APPROVAL',
        acceptanceCriteria: 'Settlement API integration, automated webhook handler with idempotent processing, and unit test coverage >= 85%.',
        auditScore: 96,
        auditRationale: 'VERIFIED: Settlement API fully integrated. Webhook idempotency verified. Test coverage: 91%. No security issues detected by OWASP scanner.',
        linkedPRNumber: 24,
        linkedPRUrl: 'https://github.com/apex/settlement/pull/24',
      },
      {
        id: 'ms-4-3',
        phaseNumber: 3,
        title: 'Phase 3: Production Hardening & Security Audit',
        description: 'OWASP LLM and PCI-DSS compliance verification',
        amountUSD: 300,
        status: 'PENDING',
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
    spentUSD: 75,
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
        status: 'COMPLETED',
        acceptanceCriteria: 'Complete Markdown docs, endpoint curl examples, and authentication flow diagrams.',
        auditScore: 94,
        auditRationale: 'VERIFIED: 180+ pages of documentation delivered. All 28 endpoints documented with examples. Diagrams validate against OpenAPI spec.',
        payPalBatchId: 'SETTLE-SUB5-001',
      },
      {
        id: 'ms-5-2',
        phaseNumber: 2,
        title: 'Phase 2: 3 Technical Launch Deep-Dive Articles',
        description: 'Technical architecture deep-dive and fintech escrow use cases',
        amountUSD: 75,
        status: 'PENDING',
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
  // Milestone Settlement Events (PAYOUT_EXECUTED)
  {
    id: 'log-1',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-14T14:32:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Milestone Settlement Approved: Phase 1 Backend API & Database Setup',
    amountUSD: 75,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 98,
    status: 'PAYOUT_EXECUTED',
    riskLevel: 'LOW',
    payPalTransactionId: 'SETTLE-PROJ1-001',
    httpPayloadLog: 'Settlement Executed: OAuth2 token verification passed. PostgreSQL schema verified. 94% test coverage confirmed.',
  },
  {
    id: 'log-2',
    projectId: 'proj-2',
    projectName: 'UI/UX Brand Redesign',
    timestamp: '2026-10-14T13:15:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Milestone Settlement Approved: Phase 1 Wireframes & High-Fidelity Figma Prototypes',
    amountUSD: 60,
    recipientEmail: 'design@studio.com',
    auditConfidenceScore: 95,
    status: 'PAYOUT_EXECUTED',
    riskLevel: 'LOW',
    payPalTransactionId: 'SETTLE-PROJ2-001',
    httpPayloadLog: 'Settlement Executed: Figma prototypes validated. Responsive design verified. WCAG 2.1 AA compliance confirmed.',
  },
  {
    id: 'log-3',
    projectId: 'proj-4',
    projectName: 'FinTech Settlement Core Microservice',
    timestamp: '2026-10-14T12:48:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Milestone Settlement Approved: Phase 1 Architecture Blueprint & API Spec',
    amountUSD: 400,
    recipientEmail: 'billing@acmeglobal.com',
    auditConfidenceScore: 99,
    status: 'PAYOUT_EXECUTED',
    riskLevel: 'LOW',
    payPalTransactionId: 'SETTLE-APEX-001',
    httpPayloadLog: 'Settlement Executed: OpenAPI 3.0 spec validated. Security envelope verified. PCI-DSS baseline exceeded.',
  },
  {
    id: 'log-4',
    projectId: 'proj-5',
    projectName: 'Subcontract: Technical Documentation & Blog',
    timestamp: '2026-10-14T11:22:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Milestone Settlement Approved: Phase 1 OpenAPI Developer Markdown Documentation',
    amountUSD: 75,
    recipientEmail: 'editor@contentpro.example',
    auditConfidenceScore: 94,
    status: 'PAYOUT_EXECUTED',
    riskLevel: 'LOW',
    payPalTransactionId: 'SETTLE-SUB5-001',
    httpPayloadLog: 'Settlement Executed: 180+ pages documentation verified. All 28 endpoints documented. Diagrams validated.',
  },
  
  // Audit Process Events (AUDITING_DELIVERABLE)
  {
    id: 'log-5',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-14T10:05:00.000Z',
    agentRole: 'BUYER_AI',
    action: 'Deliverable Submitted for Audit Review: Phase 2 Frontend Dashboard UI & Components (PR #8)',
    amountUSD: 100,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 92,
    status: 'AUDITING_DELIVERABLE',
    riskLevel: 'LOW',
    httpPayloadLog: 'PR #8 submitted. Dashboard component validation in progress. Accessibility scan initiated.',
  },
  {
    id: 'log-6',
    projectId: 'proj-4',
    projectName: 'FinTech Settlement Core Microservice',
    timestamp: '2026-10-14T09:40:00.000Z',
    agentRole: 'BUYER_AI',
    action: 'Deliverable Submitted for Audit Review: Phase 2 Payment Gateway & Microservice Worker (PR #24)',
    amountUSD: 500,
    recipientEmail: 'billing@acmeglobal.com',
    auditConfidenceScore: 96,
    status: 'AUDITING_DELIVERABLE',
    riskLevel: 'LOW',
    httpPayloadLog: 'PR #24 submitted. Settlement API integration verification. Webhook idempotency tests scheduled.',
  },
  {
    id: 'log-7',
    projectId: 'proj-2',
    projectName: 'UI/UX Brand Redesign',
    timestamp: '2026-10-14T08:30:00.000Z',
    agentRole: 'BUYER_AI',
    action: 'Deliverable Submitted for Audit Review: Phase 2 Component Library & Design Tokens (PR #12)',
    amountUSD: 90,
    recipientEmail: 'design@studio.com',
    auditConfidenceScore: 89,
    status: 'AUDITING_DELIVERABLE',
    riskLevel: 'MEDIUM',
    httpPayloadLog: 'PR #12 submitted. 45 components analyzed. 3 animation performance suggestions detected.',
  },

  // Guardrail Checks (GUARDRAIL_CHECKING)
  {
    id: 'log-8',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-14T07:15:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Guardrail Check Initiated: Envelope Compliance & Budget Validation',
    amountUSD: 0,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 100,
    status: 'GUARDRAIL_CHECKING',
    riskLevel: 'LOW',
    httpPayloadLog: 'Budget check: $75 <= $250 max per transaction ✓ | Daily ceiling: $210 <= $1000 ✓',
  },
  {
    id: 'log-9',
    projectId: 'proj-2',
    projectName: 'UI/UX Brand Redesign',
    timestamp: '2026-10-13T20:45:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Guardrail Check Initiated: Escrow Envelope & Settlement Authorization',
    amountUSD: 0,
    recipientEmail: 'design@studio.com',
    auditConfidenceScore: 100,
    status: 'GUARDRAIL_CHECKING',
    riskLevel: 'LOW',
    httpPayloadLog: 'Escrow envelope validated. No kill switch active. Authorization check passed.',
  },
  {
    id: 'log-10',
    projectId: 'proj-4',
    projectName: 'FinTech Settlement Core Microservice',
    timestamp: '2026-10-13T19:30:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Guardrail Check Passed: High-Value Transaction Approval ($400 INCOMING Contract)',
    amountUSD: 400,
    recipientEmail: 'billing@acmeglobal.com',
    auditConfidenceScore: 99,
    status: 'GUARDRAIL_CHECKING',
    riskLevel: 'LOW',
    httpPayloadLog: 'High-value transaction validated. Client verification: Apex Financial Holdings Inc. ✓ | Compliance: VERIFIED',
  },

  // Escrow Locked Events (ESCROW_LOCKED)
  {
    id: 'log-11',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-13T18:10:00.000Z',
    agentRole: 'PAYPAL_API',
    action: 'Escrow Fund Locked: $75.00 reserved in PayPal Vault',
    amountUSD: 75,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 100,
    status: 'ESCROW_LOCKED',
    riskLevel: 'LOW',
    payPalTransactionId: 'HOLD-2026-PROJ1-001',
    httpPayloadLog: 'Funds locked via PayPal Sandbox API. Holdback period: 30 days. Release: automatic on milestone approval.',
  },
  {
    id: 'log-12',
    projectId: 'proj-2',
    projectName: 'UI/UX Brand Redesign',
    timestamp: '2026-10-13T17:05:00.000Z',
    agentRole: 'PAYPAL_API',
    action: 'Escrow Fund Locked: $60.00 reserved in PayPal Vault',
    amountUSD: 60,
    recipientEmail: 'design@studio.com',
    auditConfidenceScore: 100,
    status: 'ESCROW_LOCKED',
    riskLevel: 'LOW',
    payPalTransactionId: 'HOLD-2026-PROJ2-001',
    httpPayloadLog: 'Funds locked via PayPal Sandbox API. Reserved for Phase 1 completion.',
  },

  // Proposed Settlements (PROPOSED)
  {
    id: 'log-13',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-13T16:40:00.000Z',
    agentRole: 'SELLER_AI',
    action: 'Settlement Proposal: Phase 1 Backend Delivery Complete (100% Criteria Met)',
    amountUSD: 75,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 98,
    status: 'PROPOSED',
    riskLevel: 'LOW',
    httpPayloadLog: 'Seller agent proposes 100% settlement. Evidence: OAuth2 tests pass (94 coverage), PostgreSQL schema verified, CI green.',
  },
  {
    id: 'log-14',
    projectId: 'proj-4',
    projectName: 'FinTech Settlement Core Microservice',
    timestamp: '2026-10-13T15:25:00.000Z',
    agentRole: 'SELLER_AI',
    action: 'Settlement Proposal: Phase 1 Architecture Milestone (Partial Release: 85%)',
    amountUSD: 340,
    recipientEmail: 'billing@acmeglobal.com',
    auditConfidenceScore: 96,
    status: 'PROPOSED',
    riskLevel: 'MEDIUM',
    httpPayloadLog: 'Seller proposes 85% settlement. Minor: 2 security recommendations pending review before 100% release.',
  },

  // Rejected/Blocked Events
  {
    id: 'log-15',
    projectId: 'proj-5',
    projectName: 'Subcontract: Technical Documentation & Blog',
    timestamp: '2026-10-13T14:10:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Settlement Blocked: Phase 2 Incomplete - Missing Technical Articles',
    amountUSD: 0,
    recipientEmail: 'editor@contentpro.example',
    auditConfidenceScore: 85,
    status: 'REJECTED',
    riskLevel: 'MEDIUM',
    httpPayloadLog: 'Acceptance criteria check failed: Only 1/3 required articles submitted. Compliance: 33%. Awaiting 2 additional deep-dive articles.',
  },
  {
    id: 'log-16',
    projectId: 'proj-2',
    projectName: 'UI/UX Brand Redesign',
    timestamp: '2026-10-13T13:00:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Settlement Flagged for Human Review: High-Risk Deliverable Assessment',
    amountUSD: 0,
    recipientEmail: 'design@studio.com',
    auditConfidenceScore: 72,
    status: 'REJECTED',
    riskLevel: 'HIGH',
    httpPayloadLog: 'Risk assessment: 4 color contrast issues detected. WCAG 2.1 AA compliance at risk. Escalated to compliance team.',
  },

  // Frozen/Paused Events
  {
    id: 'log-17',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-13T11:50:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Contract Temporarily Paused: Kill Switch Activated by Compliance Officer',
    amountUSD: 0,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 100,
    status: 'CONTRACT_FROZEN',
    riskLevel: 'CRITICAL',
    httpPayloadLog: 'Kill switch activated. All settlements blocked. Reason: Routine security audit in progress. Expected resume: 2026-10-15 14:00 UTC.',
  },

  // Historical Transactions
  {
    id: 'log-18',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-07T12:00:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Project Contract Created: Web Platform Engineering ($250.00 Envelope Cap)',
    amountUSD: 0,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 100,
    status: 'IDLE',
    riskLevel: 'LOW',
    httpPayloadLog: 'New MSA-SOW contract initialized. Reference: MSA-2026-089A. Escrow ready.',
  },
  {
    id: 'log-19',
    projectId: 'proj-2',
    projectName: 'UI/UX Brand Redesign',
    timestamp: '2026-10-07T12:05:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Project Contract Created: UI/UX Brand Redesign ($150.00 Envelope Cap)',
    amountUSD: 0,
    recipientEmail: 'design@studio.com',
    auditConfidenceScore: 100,
    status: 'IDLE',
    riskLevel: 'LOW',
    httpPayloadLog: 'New MSA-SOW contract initialized. Reference: MSA-2026-104C. Design studio verified.',
  },
  {
    id: 'log-20',
    projectId: 'proj-4',
    projectName: 'FinTech Settlement Core Microservice',
    timestamp: '2026-10-07T12:10:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Project Contract Created: FinTech Settlement Core ($1,200.00 INCOMING)',
    amountUSD: 0,
    recipientEmail: 'billing@acmeglobal.com',
    auditConfidenceScore: 100,
    status: 'IDLE',
    riskLevel: 'LOW',
    httpPayloadLog: 'New INCOMING contract from Apex Financial Holdings Inc. Escrow funding authorized.',
  },
  
  // Additional Audit Events (for AG Grid richness)
  {
    id: 'log-21',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-12T22:30:00.000Z',
    agentRole: 'BUYER_AI',
    action: 'Audit Report Generated: Backend Phase Meets All Criteria (Score: 98/100)',
    amountUSD: 0,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 98,
    status: 'AUDITING_DELIVERABLE',
    riskLevel: 'LOW',
    httpPayloadLog: 'Heuristic audit: OAuth2 token validation ✓ | PostgreSQL migrations ✓ | Test coverage 94% ✓ | CI status green ✓',
  },
  {
    id: 'log-22',
    projectId: 'proj-4',
    projectName: 'FinTech Settlement Core Microservice',
    timestamp: '2026-10-12T21:15:00.000Z',
    agentRole: 'BUYER_AI',
    action: 'Audit Report Generated: Microservice Integration Complete (Score: 96/100)',
    amountUSD: 0,
    recipientEmail: 'billing@acmeglobal.com',
    auditConfidenceScore: 96,
    status: 'AUDITING_DELIVERABLE',
    riskLevel: 'LOW',
    httpPayloadLog: 'LLM audit: Settlement API verified ✓ | Webhook idempotency ✓ | Security: 91% test coverage | OWASP: no critical findings',
  },
  {
    id: 'log-23',
    projectId: 'proj-2',
    projectName: 'UI/UX Brand Redesign',
    timestamp: '2026-10-12T20:00:00.000Z',
    agentRole: 'BUYER_AI',
    action: 'Preliminary Audit: Figma Prototypes Responsive & Accessible (Score: 95/100)',
    amountUSD: 0,
    recipientEmail: 'design@studio.com',
    auditConfidenceScore: 95,
    status: 'AUDITING_DELIVERABLE',
    riskLevel: 'LOW',
    httpPayloadLog: 'Design audit: Desktop responsive ✓ | Mobile responsive ✓ | WCAG 2.1 AA ✓ | Dark mode palette compliant ✓',
  },
  {
    id: 'log-24',
    projectId: 'proj-5',
    projectName: 'Subcontract: Technical Documentation & Blog',
    timestamp: '2026-10-12T18:45:00.000Z',
    agentRole: 'BUYER_AI',
    action: 'Audit Report: Documentation Phase Exceeds Standards (Score: 94/100)',
    amountUSD: 0,
    recipientEmail: 'editor@contentpro.example',
    auditConfidenceScore: 94,
    status: 'AUDITING_DELIVERABLE',
    riskLevel: 'LOW',
    httpPayloadLog: '180+ pages verified ✓ | All 28 endpoints documented ✓ | Curl examples included ✓ | Architecture diagrams validated ✓',
  },
  {
    id: 'log-25',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-12T17:30:00.000Z',
    agentRole: 'PAYPAL_API',
    action: 'PayPal Sandbox Webhook: Settlement Confirmation Received',
    amountUSD: 75,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 100,
    status: 'PAYOUT_EXECUTED',
    riskLevel: 'LOW',
    payPalTransactionId: 'SETTLE-PROJ1-001',
    httpPayloadLog: 'Webhook received from PayPal Sandbox. Settlement ID: SETTLE-PROJ1-001. Status: COMPLETED. Funds transferred.',
  },
  {
    id: 'log-26',
    projectId: 'proj-4',
    projectName: 'FinTech Settlement Core Microservice',
    timestamp: '2026-10-12T16:15:00.000Z',
    agentRole: 'SELLER_AI',
    action: 'Agent Negotiation: Requesting 90% Partial Release (Pending Review)',
    amountUSD: 360,
    recipientEmail: 'billing@acmeglobal.com',
    auditConfidenceScore: 88,
    status: 'PROPOSED',
    riskLevel: 'MEDIUM',
    httpPayloadLog: 'Seller agent analysis: Core settlement API functional. 10% holdback for final security audit completion.',
  },
  {
    id: 'log-27',
    projectId: 'proj-2',
    projectName: 'UI/UX Brand Redesign',
    timestamp: '2026-10-12T15:00:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Envelope Check: Daily Spend Tracking ($210 / $1,000)',
    amountUSD: 0,
    recipientEmail: 'design@studio.com',
    auditConfidenceScore: 100,
    status: 'GUARDRAIL_CHECKING',
    riskLevel: 'LOW',
    httpPayloadLog: 'Daily ceiling monitor: 21% of daily limit spent. Status: HEALTHY. Remaining budget: $790.',
  },
  {
    id: 'log-28',
    projectId: 'proj-5',
    projectName: 'Subcontract: Technical Documentation & Blog',
    timestamp: '2026-10-12T14:00:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Compliance Flag: Subcontract Validated Against Parent (proj-4)',
    amountUSD: 0,
    recipientEmail: 'editor@contentpro.example',
    auditConfidenceScore: 100,
    status: 'GUARDRAIL_CHECKING',
    riskLevel: 'LOW',
    httpPayloadLog: 'Subcontract cascade verified. Parent project (FinTech Settlement) ACTIVE. Escrow funding: AUTHORIZED.',
  },
  {
    id: 'log-29',
    projectId: 'proj-1',
    projectName: 'Web Platform Engineering',
    timestamp: '2026-10-12T13:00:00.000Z',
    agentRole: 'BUYER_AI',
    action: 'Risk Assessment Complete: Phase 2 Frontend - Medium Complexity (87% Confidence)',
    amountUSD: 0,
    recipientEmail: 'dev@agency.com',
    auditConfidenceScore: 87,
    status: 'AUDITING_DELIVERABLE',
    riskLevel: 'LOW',
    httpPayloadLog: 'Complexity score: 7.2/10 | Dependencies: 12 npm packages (all audited) | Code quality: 8.5/10',
  },
  {
    id: 'log-30',
    projectId: 'proj-4',
    projectName: 'FinTech Settlement Core Microservice',
    timestamp: '2026-10-12T12:00:00.000Z',
    agentRole: 'GUARDRAIL',
    action: 'Security Baseline Verified: OWASP LLM & PCI-DSS Preliminary Check',
    amountUSD: 0,
    recipientEmail: 'billing@acmeglobal.com',
    auditConfidenceScore: 99,
    status: 'GUARDRAIL_CHECKING',
    riskLevel: 'LOW',
    httpPayloadLog: 'OWASP Top 10 LLM: 0 critical findings | PCI-DSS 3.2.1: Baseline met | Prompt injection tests: PASSED',
  },
];

function tenantStorageKey(baseKey: string, userId: string): string {
  return `${baseKey}:${userId}`;
}

export default function Home() {
  // DIRECT MODE: No authentication required. Dashboard renders immediately.
  const sessionUser: AuthenticatedUser = {
    id: 'evaluator-2026',
    email: 'evaluator@agenticpay.enterprise',
    displayName: 'Enterprise Evaluator',
  };
  
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

  // Hydrate tenant-scoped state immediately (no auth check needed)
  useEffect(() => {
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
  }, [sessionUser.id]);

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

  const handleLogout = async () => {
    // Logout disabled - session is always active
    console.info('[Dashboard] Logout not available in evaluator mode');
  };

  const handleAddLog = (newLog: TransactionLog) => {
    setLogs((prev) => [newLog, ...prev]);
    setProjects((prev) => applyTransactionLogToProjects(prev, newLog));

    // Settlement payouts are written exclusively by the server settlement route.
    if (newLog.status === 'PAYOUT_EXECUTED') return;
    
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* EVALUATOR MODE BANNER */}
      <div className="bg-blue-900 border-b border-blue-700 px-6 py-2 text-center text-sm font-semibold text-blue-100">
        🏢 Enterprise Evaluation Session Active • Production Sandbox Environment
      </div>

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
        sessionEmail={sessionUser?.email || 'evaluator@agenticpay.enterprise'}
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
