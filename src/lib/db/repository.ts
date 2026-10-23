import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import type { BudgetEnvelope, ProjectContract, TransactionLog } from '@/lib/types';
import {
  buildMilestoneSettlement,
  applyMilestonePayoutExecution,
  type MilestonePayoutExecutor,
  type MilestonePayoutExecution,
  type SettlementResult,
  type SettlementSuccess,
} from '@/lib/settlement/settlement';
import { PayPalPayoutError } from '@/lib/paypal/client';

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: string;
}

export interface SessionRecord {
  tokenHash: string;
  userId: string;
  expiresAt: string;
}

export interface LedgerEventRecord {
  id: string;
  userId: string;
  projectId: string;
  event: TransactionLog;
  createdAt: string;
}

export interface AppendEventResult {
  inserted: boolean;
  event: TransactionLog;
}

export interface AgenticPayRepository {
  createUser(input: {
    email: string;
    passwordHash: string;
    displayName?: string | null;
  }): Promise<AuthUser>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  createSession(input: SessionRecord): Promise<void>;
  findSession(tokenHash: string): Promise<SessionRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;
  appendLedgerEvent(
    userId: string,
    event: TransactionLog
  ): Promise<AppendEventResult>;
  listLedgerEvents(userId: string, limit: number): Promise<LedgerEventRecord[]>;
  listProjects(userId: string): Promise<ProjectContract[]>;
  getProject(userId: string, projectId: string): Promise<ProjectContract | null>;
  upsertProject(userId: string, project: ProjectContract): Promise<ProjectContract>;
  recordMilestoneAudit(
    userId: string,
    projectId: string,
    milestoneId: string,
    audit: {
      auditScore: number;
      auditRationale: string;
      deliverableProof: string;
      submittedAt: string;
      requiresHumanApproval: boolean;
    }
  ): Promise<ProjectContract | null>;
  bootstrapProjects(
    userId: string,
    projects: ProjectContract[],
    envelope?: BudgetEnvelope
  ): Promise<{ projects: ProjectContract[]; envelope: BudgetEnvelope | null }>;
  getEnvelope(userId: string): Promise<BudgetEnvelope | null>;
  upsertEnvelope(userId: string, envelope: BudgetEnvelope): Promise<BudgetEnvelope>;
  settleMilestone(
    userId: string,
    projectId: string,
    milestoneId: string,
    payoutExecutor?: MilestonePayoutExecutor
  ): Promise<SettlementResult>;
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('An account with this email already exists.');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

interface MemoryState {
  usersByEmail: Map<string, AuthUser>;
  usersById: Map<string, AuthUser>;
  sessions: Map<string, SessionRecord>;
  ledger: Map<string, LedgerEventRecord>;
  projects: Map<string, Map<string, ProjectContract>>;
  envelopes: Map<string, BudgetEnvelope>;
}

const globalForRepository = globalThis as unknown as {
  __agenticPayMemoryRepository?: MemoryState;
};

function getMemoryState(): MemoryState {
  if (!globalForRepository.__agenticPayMemoryRepository) {
    globalForRepository.__agenticPayMemoryRepository = {
      usersByEmail: new Map(),
      usersById: new Map(),
      sessions: new Map(),
      ledger: new Map(),
      projects: new Map(),
      envelopes: new Map(),
    };
  }
  return globalForRepository.__agenticPayMemoryRepository;
}

function memoryProjects(userId: string): Map<string, ProjectContract> {
  const state = getMemoryState();
  let projects = state.projects.get(userId);
  if (!projects) {
    projects = new Map();
    state.projects.set(userId, projects);
  }
  return projects;
}

function ledgerKey(userId: string, eventId: string): string {
  return `${userId}:${eventId}`;
}

/**
 * Runs the real PayPal payouts executor for an already-authorized settlement.
 * A PayPal failure aborts the settlement atomically: no funds are deducted
 * from the envelope and nothing is committed to the durable ledger — the
 * caller receives one structured, non-retryable failure instead.
 */
async function runMilestonePayout(
  success: SettlementSuccess,
  milestoneId: string,
  executor: MilestonePayoutExecutor
): Promise<SettlementResult> {
  const milestone = (success.project.milestones || []).find((item) => item.id === milestoneId);
  let payout: MilestonePayoutExecution;
  try {
    payout = await executor({
      projectId: success.project.id,
      milestoneId,
      milestoneTitle: milestone?.title || 'Milestone',
      receiverEmail: success.event.recipientEmail,
      amountUSD: success.event.amountUSD,
      settlementBatchId: success.event.payPalTransactionId || '',
    });
  } catch (error) {
    if (error instanceof PayPalPayoutError) {
      return {
        ok: false,
        status: 502,
        error: `PayPal payout failed: ${error.message}`,
      };
    }
    throw error;
  }
  return applyMilestonePayoutExecution(success, milestoneId, payout);
}

function createMemoryRepository(): AgenticPayRepository {
  return {
    async createUser({ email, passwordHash, displayName }) {
      const state = getMemoryState();
      const normalizedEmail = email.trim().toLowerCase();
      if (state.usersByEmail.has(normalizedEmail)) {
        throw new EmailAlreadyRegisteredError();
      }
      const user: AuthUser = {
        id: randomUUID(),
        email: normalizedEmail,
        passwordHash,
        displayName: displayName?.trim() || null,
        createdAt: new Date().toISOString(),
      };
      state.usersByEmail.set(user.email, user);
      state.usersById.set(user.id, user);
      return user;
    },

    async findUserByEmail(email) {
      return getMemoryState().usersByEmail.get(email.trim().toLowerCase()) ?? null;
    },

    async findUserById(id) {
      return getMemoryState().usersById.get(id) ?? null;
    },

    async createSession(session) {
      getMemoryState().sessions.set(session.tokenHash, session);
    },

    async findSession(tokenHash) {
      return getMemoryState().sessions.get(tokenHash) ?? null;
    },

    async deleteSession(tokenHash) {
      getMemoryState().sessions.delete(tokenHash);
    },

    async deleteExpiredSessions(now) {
      const state = getMemoryState();
      for (const [tokenHash, session] of state.sessions) {
        if (new Date(session.expiresAt).getTime() <= now.getTime()) {
          state.sessions.delete(tokenHash);
        }
      }
    },

    async appendLedgerEvent(userId, event) {
      const state = getMemoryState();
      const key = ledgerKey(userId, event.id);
      const existing = state.ledger.get(key);
      if (existing) {
        return { inserted: false, event: existing.event };
      }
      state.ledger.set(key, {
        id: event.id,
        userId,
        projectId: event.projectId,
        event,
        createdAt: new Date().toISOString(),
      });
      return { inserted: true, event };
    },

    async listLedgerEvents(userId, limit) {
      return Array.from(getMemoryState().ledger.values())
        .filter((record) => record.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },

    async listProjects(userId) {
      return Array.from(memoryProjects(userId).values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    },

    async getProject(userId, projectId) {
      return memoryProjects(userId).get(projectId) ?? null;
    },

    async upsertProject(userId, project) {
      memoryProjects(userId).set(project.id, project);
      return project;
    },

    async recordMilestoneAudit(userId, projectId, milestoneId, audit) {
      const projects = memoryProjects(userId);
      const project = projects.get(projectId);
      if (!project || project.status !== 'ACTIVE') return null;
      const milestone = (project.milestones || []).find(
        (item) => item.id === milestoneId
      );
      if (!milestone || milestone.status === 'COMPLETED' || milestone.status === 'LOCKED') {
        return null;
      }
      const updated: ProjectContract = {
        ...project,
        milestones: (project.milestones || []).map((item) =>
          item.id === milestoneId
            ? {
                ...item,
                status: 'AUDITED_PENDING_APPROVAL',
                auditScore: audit.auditScore,
                auditRationale: audit.auditRationale,
                deliverableProof: audit.deliverableProof,
                submittedAt: audit.submittedAt,
                requiresHumanApproval: audit.requiresHumanApproval,
                payPalBatchId: undefined,
              }
            : item
        ),
      };
      projects.set(projectId, updated);
      return updated;
    },

    async bootstrapProjects(userId, projects, envelope) {
      const existing = Array.from(memoryProjects(userId).values());
      if (existing.length > 0) {
        return {
          projects: existing,
          envelope: getMemoryState().envelopes.get(userId) ?? null,
        };
      }
      for (const project of projects) {
        memoryProjects(userId).set(project.id, project);
      }
      if (envelope) {
        getMemoryState().envelopes.set(userId, envelope);
      }
      return {
        projects,
        envelope: getMemoryState().envelopes.get(userId) ?? null,
      };
    },

    async getEnvelope(userId) {
      return getMemoryState().envelopes.get(userId) ?? null;
    },

    async upsertEnvelope(userId, envelope) {
      getMemoryState().envelopes.set(userId, envelope);
      return envelope;
    },

    async settleMilestone(userId, projectId, milestoneId, payoutExecutor) {
      const projects = memoryProjects(userId);
      const project = projects.get(projectId);
      if (!project) {
        return { ok: false, status: 404, error: 'Project not found.' };
      }
      const envelope = getMemoryState().envelopes.get(userId);
      if (!envelope) {
        return { ok: false, status: 409, error: 'Budget envelope is not configured.' };
      }
      let result = buildMilestoneSettlement(project, envelope, milestoneId);
      if (!result.ok) return result;
      if (payoutExecutor) {
        result = await runMilestonePayout(result, milestoneId, payoutExecutor);
        if (!result.ok) return result;
      }
      projects.set(projectId, result.project);
      getMemoryState().envelopes.set(userId, result.envelope);
      await this.appendLedgerEvent(userId, result.event);
      return result;
    },
  };
}

const memoryRepository = createMemoryRepository();

const globalForPostgres = globalThis as unknown as {
  __agenticPayPostgresPool?: Pool;
  __agenticPayPostgresSchemaReady?: Promise<void>;
};

function getPostgresPool(): Pool {
  if (!globalForPostgres.__agenticPayPostgresPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required to use the durable repository.');
    }
    const sslEnabled =
      process.env.DATABASE_SSL === 'true' ||
      /sslmode=require/i.test(connectionString);
    globalForPostgres.__agenticPayPostgresPool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
    });
  }
  return globalForPostgres.__agenticPayPostgresPool;
}

async function ensurePostgresSchema(): Promise<void> {
  if (!globalForPostgres.__agenticPayPostgresSchemaReady) {
    const pool = getPostgresPool();
    globalForPostgres.__agenticPayPostgresSchemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS agenticpay_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          display_name TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS agenticpay_sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES agenticpay_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS agenticpay_sessions_user_idx
          ON agenticpay_sessions (user_id);

        CREATE TABLE IF NOT EXISTS agenticpay_ledger_events (
          id TEXT NOT NULL,
          user_id TEXT NOT NULL REFERENCES agenticpay_users(id) ON DELETE CASCADE,
          project_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, id)
        );

        CREATE INDEX IF NOT EXISTS agenticpay_ledger_user_created_idx
          ON agenticpay_ledger_events (user_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS agenticpay_projects (
          user_id TEXT NOT NULL REFERENCES agenticpay_users(id) ON DELETE CASCADE,
          id TEXT NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (user_id, id)
        );

        CREATE INDEX IF NOT EXISTS agenticpay_projects_user_updated_idx
          ON agenticpay_projects (user_id, updated_at DESC);

        CREATE TABLE IF NOT EXISTS agenticpay_envelopes (
          user_id TEXT PRIMARY KEY REFERENCES agenticpay_users(id) ON DELETE CASCADE,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    })().catch((error) => {
      globalForPostgres.__agenticPayPostgresSchemaReady = undefined;
      throw error;
    });
  }
  return globalForPostgres.__agenticPayPostgresSchemaReady;
}

function mapUser(row: {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  created_at: Date | string;
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function createPostgresRepository(): AgenticPayRepository {
  return {
    async createUser({ email, passwordHash, displayName }) {
      await ensurePostgresSchema();
      const normalizedEmail = email.trim().toLowerCase();
      try {
        const result = await getPostgresPool().query(
          `INSERT INTO agenticpay_users (id, email, password_hash, display_name)
           VALUES ($1, $2, $3, $4)
           RETURNING id, email, password_hash, display_name, created_at`,
          [randomUUID(), normalizedEmail, passwordHash, displayName?.trim() || null]
        );
        return mapUser(result.rows[0]);
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          (error as { code?: string }).code === '23505'
        ) {
          throw new EmailAlreadyRegisteredError();
        }
        throw error;
      }
    },

    async findUserByEmail(email) {
      await ensurePostgresSchema();
      const result = await getPostgresPool().query(
        `SELECT id, email, password_hash, display_name, created_at
         FROM agenticpay_users
         WHERE email = $1
         LIMIT 1`,
        [email.trim().toLowerCase()]
      );
      return result.rows[0] ? mapUser(result.rows[0]) : null;
    },

    async findUserById(id) {
      await ensurePostgresSchema();
      const result = await getPostgresPool().query(
        `SELECT id, email, password_hash, display_name, created_at
         FROM agenticpay_users
         WHERE id = $1
         LIMIT 1`,
        [id]
      );
      return result.rows[0] ? mapUser(result.rows[0]) : null;
    },

    async createSession(session) {
      await ensurePostgresSchema();
      await getPostgresPool().query(
        `INSERT INTO agenticpay_sessions (token_hash, user_id, expires_at)
         VALUES ($1, $2, $3)`,
        [session.tokenHash, session.userId, session.expiresAt]
      );
    },

    async findSession(tokenHash) {
      await ensurePostgresSchema();
      const result = await getPostgresPool().query(
        `SELECT token_hash, user_id, expires_at
         FROM agenticpay_sessions
         WHERE token_hash = $1
         LIMIT 1`,
        [tokenHash]
      );
      if (!result.rows[0]) return null;
      const row = result.rows[0];
      return {
        tokenHash: row.token_hash,
        userId: row.user_id,
        expiresAt: new Date(row.expires_at).toISOString(),
      };
    },

    async deleteSession(tokenHash) {
      await ensurePostgresSchema();
      await getPostgresPool().query(
        `DELETE FROM agenticpay_sessions WHERE token_hash = $1`,
        [tokenHash]
      );
    },

    async deleteExpiredSessions(now) {
      await ensurePostgresSchema();
      await getPostgresPool().query(
        `DELETE FROM agenticpay_sessions WHERE expires_at <= $1`,
        [now.toISOString()]
      );
    },

    async appendLedgerEvent(userId, event) {
      await ensurePostgresSchema();
      const result = await getPostgresPool().query(
        `INSERT INTO agenticpay_ledger_events (id, user_id, project_id, event_type, payload)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id, id) DO NOTHING
         RETURNING payload`,
        [event.id, userId, event.projectId, event.status, JSON.stringify(event)]
      );
      if (result.rowCount === 1) {
        return { inserted: true, event };
      }
      const existing = await getPostgresPool().query(
        `SELECT payload FROM agenticpay_ledger_events
         WHERE user_id = $1 AND id = $2
         LIMIT 1`,
        [userId, event.id]
      );
      return {
        inserted: false,
        event: (existing.rows[0]?.payload as TransactionLog) ?? event,
      };
    },

    async listLedgerEvents(userId, limit) {
      await ensurePostgresSchema();
      const result = await getPostgresPool().query(
        `SELECT id, user_id, project_id, payload, created_at
         FROM agenticpay_ledger_events
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [userId, limit]
      );
      return result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        projectId: row.project_id,
        event: row.payload as TransactionLog,
        createdAt: new Date(row.created_at).toISOString(),
      }));
    },

    async listProjects(userId) {
      await ensurePostgresSchema();
      const result = await getPostgresPool().query(
        `SELECT data FROM agenticpay_projects
         WHERE user_id = $1
         ORDER BY updated_at DESC`,
        [userId]
      );
      return result.rows.map((row) => row.data as ProjectContract);
    },

    async getProject(userId, projectId) {
      await ensurePostgresSchema();
      const result = await getPostgresPool().query(
        `SELECT data FROM agenticpay_projects
         WHERE user_id = $1 AND id = $2
         LIMIT 1`,
        [userId, projectId]
      );
      return result.rows[0] ? (result.rows[0].data as ProjectContract) : null;
    },

    async upsertProject(userId, project) {
      await ensurePostgresSchema();
      await getPostgresPool().query(
        `INSERT INTO agenticpay_projects (user_id, id, data)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [userId, project.id, JSON.stringify(project)]
      );
      return project;
    },

    async recordMilestoneAudit(userId, projectId, milestoneId, audit) {
      await ensurePostgresSchema();
      const client = await getPostgresPool().connect();
      try {
        await client.query('BEGIN');
        const projectResult = await client.query(
          `SELECT data FROM agenticpay_projects
           WHERE user_id = $1 AND id = $2
           FOR UPDATE`,
          [userId, projectId]
        );
        const project = projectResult.rows[0]?.data as ProjectContract | undefined;
        if (!project || project.status !== 'ACTIVE') {
          await client.query('ROLLBACK');
          return null;
        }
        const milestone = (project.milestones || []).find(
          (item) => item.id === milestoneId
        );
        if (
          !milestone ||
          milestone.status === 'COMPLETED' ||
          milestone.status === 'LOCKED'
        ) {
          await client.query('ROLLBACK');
          return null;
        }
        const updated: ProjectContract = {
          ...project,
          milestones: (project.milestones || []).map((item) =>
            item.id === milestoneId
              ? {
                  ...item,
                  status: 'AUDITED_PENDING_APPROVAL',
                  auditScore: audit.auditScore,
                  auditRationale: audit.auditRationale,
                  deliverableProof: audit.deliverableProof,
                  submittedAt: audit.submittedAt,
                  requiresHumanApproval: audit.requiresHumanApproval,
                  payPalBatchId: undefined,
                }
              : item
          ),
        };
        await client.query(
          `UPDATE agenticpay_projects
           SET data = $3, updated_at = now()
           WHERE user_id = $1 AND id = $2`,
          [userId, projectId, JSON.stringify(updated)]
        );
        await client.query('COMMIT');
        return updated;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async bootstrapProjects(userId, projects, envelope) {
      await ensurePostgresSchema();
      const client = await getPostgresPool().connect();
      try {
        await client.query('BEGIN');
        const existingResult = await client.query(
          `SELECT data FROM agenticpay_projects
           WHERE user_id = $1
           ORDER BY updated_at DESC`,
          [userId]
        );
        if (existingResult.rowCount && existingResult.rowCount > 0) {
          const envelopeResult = await client.query(
            `SELECT data FROM agenticpay_envelopes WHERE user_id = $1 LIMIT 1`,
            [userId]
          );
          await client.query('COMMIT');
          return {
            projects: existingResult.rows.map((row) => row.data as ProjectContract),
            envelope: envelopeResult.rows[0]
              ? (envelopeResult.rows[0].data as BudgetEnvelope)
              : null,
          };
        }
        for (const project of projects) {
          await client.query(
            `INSERT INTO agenticpay_projects (user_id, id, data)
             VALUES ($1, $2, $3)
             ON CONFLICT (user_id, id) DO NOTHING`,
            [userId, project.id, JSON.stringify(project)]
          );
        }
        if (envelope) {
          await client.query(
            `INSERT INTO agenticpay_envelopes (user_id, data)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, JSON.stringify(envelope)]
          );
        }
        const storedEnvelope = await client.query(
          `SELECT data FROM agenticpay_envelopes WHERE user_id = $1 LIMIT 1`,
          [userId]
        );
        await client.query('COMMIT');
        return {
          projects,
          envelope: storedEnvelope.rows[0]
            ? (storedEnvelope.rows[0].data as BudgetEnvelope)
            : null,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },

    async getEnvelope(userId) {
      await ensurePostgresSchema();
      const result = await getPostgresPool().query(
        `SELECT data FROM agenticpay_envelopes WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      return result.rows[0] ? (result.rows[0].data as BudgetEnvelope) : null;
    },

    async upsertEnvelope(userId, envelope) {
      await ensurePostgresSchema();
      await getPostgresPool().query(
        `INSERT INTO agenticpay_envelopes (user_id, data)
         VALUES ($1, $2)
         ON CONFLICT (user_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
        [userId, JSON.stringify(envelope)]
      );
      return envelope;
    },

    async settleMilestone(userId, projectId, milestoneId, payoutExecutor) {
      await ensurePostgresSchema();
      const client = await getPostgresPool().connect();
      try {
        await client.query('BEGIN');
        const projectResult = await client.query(
          `SELECT data FROM agenticpay_projects
           WHERE user_id = $1 AND id = $2
           FOR UPDATE`,
          [userId, projectId]
        );
        if (!projectResult.rows[0]) {
          await client.query('ROLLBACK');
          return { ok: false, status: 404, error: 'Project not found.' };
        }
        const envelopeResult = await client.query(
          `SELECT data FROM agenticpay_envelopes
           WHERE user_id = $1
           FOR UPDATE`,
          [userId]
        );
        if (!envelopeResult.rows[0]) {
          await client.query('ROLLBACK');
          return { ok: false, status: 409, error: 'Budget envelope is not configured.' };
        }
        const project = projectResult.rows[0].data as ProjectContract;
        const envelope = envelopeResult.rows[0].data as BudgetEnvelope;
        let result = buildMilestoneSettlement(project, envelope, milestoneId);
        if (!result.ok) {
          await client.query('ROLLBACK');
          return result;
        }
        if (payoutExecutor) {
          // Executed inside the transaction, after row locks confirm the
          // envelope has funds: a PayPal failure rolls the whole settlement
          // back atomically.
          result = await runMilestonePayout(result, milestoneId, payoutExecutor);
          if (!result.ok) {
            await client.query('ROLLBACK');
            return result;
          }
        }
        await client.query(
          `UPDATE agenticpay_projects
           SET data = $3, updated_at = now()
           WHERE user_id = $1 AND id = $2`,
          [userId, projectId, JSON.stringify(result.project)]
        );
        await client.query(
          `UPDATE agenticpay_envelopes
           SET data = $2, updated_at = now()
           WHERE user_id = $1`,
          [userId, JSON.stringify(result.envelope)]
        );
        await client.query(
          `INSERT INTO agenticpay_ledger_events (id, user_id, project_id, event_type, payload)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, id) DO NOTHING`,
          [
            result.event.id,
            userId,
            projectId,
            result.event.status,
            JSON.stringify(result.event),
          ]
        );
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

let postgresRepository: AgenticPayRepository | null = null;

export function getRepository(): AgenticPayRepository {
  if (process.env.DATABASE_URL) {
    if (!postgresRepository) {
      postgresRepository = createPostgresRepository();
    }
    return postgresRepository;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL must be configured before serving authenticated traffic.');
  }

  return memoryRepository;
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function __resetMemoryRepositoryForTests(): void {
  globalForRepository.__agenticPayMemoryRepository = {
    usersByEmail: new Map(),
    usersById: new Map(),
    sessions: new Map(),
    ledger: new Map(),
    projects: new Map(),
    envelopes: new Map(),
  };
}
