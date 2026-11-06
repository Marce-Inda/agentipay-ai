import { PoolClient } from 'pg';

/**
 * PostgreSQL transaction context passed to callback functions.
 * Manages explicit BEGIN/COMMIT/ROLLBACK with row-level locking support.
 */
export interface TransactionContext {
  /**
   * The active PostgreSQL client. All queries within the callback
   * execute on this client with transaction isolation.
   */
  client: PoolClient;

  /**
   * Commit the current transaction.
   * After commit, the transaction is complete and locks are released.
   */
  commit(): Promise<void>;

  /**
   * Rollback the current transaction.
   * Reverts all changes and releases locks.
   */
  rollback(): Promise<void>;
}

/**
 * Execute a callback function within a PostgreSQL transaction.
 * Automatically manages BEGIN/COMMIT/ROLLBACK and connection lifecycle.
 *
 * @param pool - PostgreSQL connection pool
 * @param callback - Async function that receives the transaction context
 * @returns The result of the callback function
 * @throws Propagates errors from the callback or transaction
 *
 * @example
 * ```typescript
 * const result = await withTransaction(pool, async (tx) => {
 *   const milestone = await tx.client.query(
 *     'SELECT * FROM milestones WHERE id = $1 FOR UPDATE',
 *     [milestoneId]
 *   );
 *   // Perform validations and updates
 *   await tx.client.query('UPDATE ...');
 *   await tx.commit();
 *   return milestone.rows[0];
 * });
 * ```
 */
export async function withTransaction<T>(
  pool: {
    connect(): Promise<PoolClient>;
  },
  callback: (context: TransactionContext) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  let committed = false;
  let rolledBack = false;

  try {
    // Begin transaction
    await client.query('BEGIN');

    // Create transaction context
    const context: TransactionContext = {
      client,
      async commit() {
        if (committed || rolledBack) {
          throw new Error('Transaction already finalized');
        }
        await client.query('COMMIT');
        committed = true;
      },
      async rollback() {
        if (committed || rolledBack) {
          throw new Error('Transaction already finalized');
        }
        await client.query('ROLLBACK');
        rolledBack = true;
      },
    };

    // Execute callback
    const result = await callback(context);

    // If callback didn't explicitly commit/rollback, commit by default
    if (!committed && !rolledBack) {
      await client.query('COMMIT');
      committed = true;
    }

    return result;
  } catch (error) {
    // Ensure rollback on error
    if (!committed && !rolledBack) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Ignore rollback errors
      }
      rolledBack = true;
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * PostgreSQL row-level lock strategy for concurrent access prevention.
 * Acquires an exclusive lock on a row, holding it until transaction commit/rollback.
 *
 * The lock prevents other transactions from:
 * - Acquiring their own locks on the same row (blocks)
 * - Updating or deleting the row (blocks)
 * - Reading the row with FOR UPDATE (blocks)
 *
 * This is the standard PostgreSQL pattern for implementing settlement atomicity:
 * two concurrent settlement requests for the same milestone will serialize—
 * the first acquires the lock and completes; the second waits or times out.
 */
export async function acquireMilestoneRowLock(
  client: PoolClient,
  userId: string,
  projectId: string,
  milestoneId: string
): Promise<{
  id: string;
  projectId: string;
  title: string;
  amountUSD: number;
  status: string;
  auditScore?: number;
  payoutBatchId?: string;
  batchStatus?: string;
} | null> {
  const result = await client.query(
    `SELECT 
       id, project_id, title, amount_usd, status, 
       audit_score, payout_batch_id, batch_status
     FROM agenticpay_milestones
     WHERE user_id = $1 AND project_id = $2 AND id = $3
     FOR UPDATE`,
    [userId, projectId, milestoneId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    amountUSD: row.amount_usd,
    status: row.status,
    auditScore: row.audit_score,
    payoutBatchId: row.payout_batch_id,
    batchStatus: row.batch_status,
  };
}

/**
 * PostgreSQL row-level lock for projects and envelopes.
 * Same lock semantics as milestone locks—prevents concurrent modifications.
 */
export async function acquireProjectRowLock(
  client: PoolClient,
  userId: string,
  projectId: string
): Promise<any | null> {
  const result = await client.query(
    `SELECT data FROM agenticpay_projects
     WHERE user_id = $1 AND id = $2
     FOR UPDATE`,
    [userId, projectId]
  );

  return result.rows[0]?.data ?? null;
}

/**
 * PostgreSQL row-level lock for budget envelopes.
 * Same lock semantics as other locks—prevents concurrent modifications.
 */
export async function acquireEnvelopeRowLock(
  client: PoolClient,
  userId: string
): Promise<any | null> {
  const result = await client.query(
    `SELECT data FROM agenticpay_envelopes
     WHERE user_id = $1
     FOR UPDATE`,
    [userId]
  );

  return result.rows[0]?.data ?? null;
}
