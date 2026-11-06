/**
 * Tests for PostgreSQL transaction handling with row-level locking.
 * 
 * These tests verify:
 * 1. withTransaction() properly manages BEGIN/COMMIT/ROLLBACK
 * 2. Row locks (FOR UPDATE) prevent concurrent modifications
 * 3. Atomic all-or-nothing semantics on failures
 * 4. Lock release on commit/rollback
 */

import { Pool, PoolClient } from 'pg';
import { withTransaction, TransactionContext } from '../transactions';

describe('PostgreSQL Transaction Handling (Task 4)', () => {
  let pool: Pool | null = null;
  let skipTests = false;

  beforeAll(async () => {
    // Create a test pool if DATABASE_URL is set
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.warn('Skipping PostgreSQL transaction tests: DATABASE_URL not set');
      skipTests = true;
      return;
    }
    try {
      pool = new Pool({ connectionString: databaseUrl });
      // Verify connection works
      await pool.query('SELECT 1');
    } catch (error) {
      console.warn('Skipping PostgreSQL transaction tests: connection failed', error);
      skipTests = true;
      pool = null;
    }
  });

  afterAll(async () => {
    if (pool) {
      await pool.end();
    }
  });

  describe('withTransaction', () => {
    it('commits successful transactions', async () => {
      if (skipTests || !pool) {
        console.warn('Skipping: PostgreSQL not available');
        return;
      }

      const result = await withTransaction(pool, async (tx) => {
        const res = await tx.client.query('SELECT NOW() as now');
        await tx.commit();
        return (res.rows[0] as any).now;
      });

      expect(result).toBeDefined();
    });

    it('rollbacks on error', async () => {
      if (skipTests || !pool) {
        console.warn('Skipping: PostgreSQL not available');
        return;
      }

      // Create a test table
      await pool.query(`
        CREATE TEMP TABLE test_transaction (
          id SERIAL PRIMARY KEY,
          value TEXT
        )
      `);

      await expect(
        withTransaction(pool, async (tx) => {
          await tx.client.query('INSERT INTO test_transaction (value) VALUES ($1)', ['test']);
          throw new Error('Intentional error');
        })
      ).rejects.toThrow('Intentional error');

      // Verify data was rolled back
      const result = await pool.query('SELECT * FROM test_transaction');
      expect(result.rows).toHaveLength(0);
    });

    it('auto-commits if callback does not explicitly finalize', async () => {
      if (skipTests || !pool) {
        console.warn('Skipping: PostgreSQL not available');
        return;
      }

      await pool.query(`
        CREATE TEMP TABLE test_auto_commit (
          id SERIAL PRIMARY KEY,
          value TEXT
        )
      `);

      await withTransaction(pool, async (tx) => {
        await tx.client.query('INSERT INTO test_auto_commit (value) VALUES ($1)', ['auto']);
        // No explicit commit/rollback
      });

      // Verify data was committed
      const result = await pool.query('SELECT * FROM test_auto_commit');
      expect(result.rows).toHaveLength(1);
      expect((result.rows[0] as any).value).toBe('auto');
    });

    it('prevents double-finalization', async () => {
      if (skipTests || !pool) {
        console.warn('Skipping: PostgreSQL not available');
        return;
      }

      await expect(
        withTransaction(pool, async (tx) => {
          await tx.commit();
          await tx.commit(); // Should throw
        })
      ).rejects.toThrow('Transaction already finalized');
    });
  });

  describe('Row-Level Locking (FOR UPDATE)', () => {
    beforeEach(async () => {
      if (skipTests || !pool) return;
      
      await pool.query(`
        CREATE TEMP TABLE test_milestones (
          id TEXT PRIMARY KEY,
          value TEXT,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await pool.query(
        'INSERT INTO test_milestones (id, value) VALUES ($1, $2)',
        ['ms-1', 'initial']
      );
    });

    it('acquires exclusive row lock with FOR UPDATE', async () => {
      if (skipTests || !pool) {
        console.warn('Skipping: PostgreSQL not available');
        return;
      }

      const result = await withTransaction(pool, async (tx) => {
        const res = await tx.client.query(
          'SELECT * FROM test_milestones WHERE id = $1 FOR UPDATE',
          ['ms-1']
        );
        await tx.commit();
        return (res.rows[0] as any);
      });

      expect(result.id).toBe('ms-1');
      expect(result.value).toBe('initial');
    });

    it('serializes concurrent updates with row locks', async () => {
      if (skipTests || !pool) {
        console.warn('Skipping: PostgreSQL not available');
        return;
      }

      const pool1 = new Pool({ connectionString: process.env.DATABASE_URL });
      const pool2 = new Pool({ connectionString: process.env.DATABASE_URL });

      try {
        // Transaction 1: Acquire lock and hold it
        const transaction1Result = (async () => {
          return withTransaction(pool1, async (tx) => {
            // Acquire lock
            await tx.client.query(
              'SELECT * FROM test_milestones WHERE id = $1 FOR UPDATE',
              ['ms-1']
            );

            // Hold lock for 200ms
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Update while holding lock
            await tx.client.query(
              'UPDATE test_milestones SET value = $1 WHERE id = $2',
              ['updated-by-1', 'ms-1']
            );

            await tx.commit();
            return 'transaction1-complete';
          });
        })();

        // Transaction 2: Try to acquire lock (should wait for transaction 1)
        await new Promise((resolve) => setTimeout(resolve, 50)); // Let transaction 1 start first
        const startTime = Date.now();
        const transaction2Result = (async () => {
          return withTransaction(pool2, async (tx) => {
            // This should block until transaction 1 commits
            const res = await tx.client.query(
              'SELECT * FROM test_milestones WHERE id = $1 FOR UPDATE',
              ['ms-1']
            );

            // After acquiring lock, update with transaction 2's value
            // But we should see transaction 1's update first
            expect((res.rows[0] as any).value).toBe('updated-by-1');

            await tx.client.query(
              'UPDATE test_milestones SET value = $1 WHERE id = $2',
              ['updated-by-2', 'ms-1']
            );

            await tx.commit();
            return 'transaction2-complete';
          });
        })();

        const [result1, result2] = await Promise.all([transaction1Result, transaction2Result]);
        const duration = Date.now() - startTime;

        expect(result1).toBe('transaction1-complete');
        expect(result2).toBe('transaction2-complete');
        expect(duration).toBeGreaterThanOrEqual(200); // Transaction 2 had to wait

        // Final value should be from transaction 2
        const final = await pool.query('SELECT value FROM test_milestones WHERE id = $1', ['ms-1']);
        expect((final.rows[0] as any).value).toBe('updated-by-2');
      } finally {
        await pool1.end();
        await pool2.end();
      }
    });
  });

  describe('Concurrent Settlement Prevention (Task 4 Acceptance Criteria)', () => {
    beforeEach(async () => {
      if (skipTests || !pool) return;
      
      // Create test schema
      await pool.query(`
        CREATE TEMP TABLE agenticpay_milestones_test (
          user_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          id TEXT NOT NULL,
          status TEXT DEFAULT 'AUDITED_PENDING_APPROVAL',
          amount_usd DECIMAL(10, 2),
          PRIMARY KEY (user_id, project_id, id)
        )
      `);
      await pool.query(
        `INSERT INTO agenticpay_milestones_test (user_id, project_id, id, amount_usd)
         VALUES ($1, $2, $3, $4)`,
        ['user-1', 'proj-1', 'ms-1', 250.0]
      );
    });

    it('prevents concurrent settlement of same milestone via row locks', async () => {
      if (skipTests || !pool) {
        console.warn('Skipping: PostgreSQL not available');
        return;
      }

      const pool1 = new Pool({ connectionString: process.env.DATABASE_URL });
      const pool2 = new Pool({ connectionString: process.env.DATABASE_URL });

      try {
        const settlementOrder: string[] = [];
        const completionTimes: Record<string, number> = {};
        const startTime = Date.now();

        // Settlement 1
        const settlement1 = (async () => {
          return withTransaction(pool1, async (tx) => {
            settlementOrder.push('settlement1-started');
            const res = await tx.client.query(
              `SELECT * FROM agenticpay_milestones_test 
               WHERE user_id = $1 AND project_id = $2 AND id = $3
               FOR UPDATE`,
              ['user-1', 'proj-1', 'ms-1']
            );

            if ((res.rows[0] as any).status !== 'AUDITED_PENDING_APPROVAL') {
              await tx.rollback();
              return 'rejected-already-settled';
            }

            // Simulate validation delay
            await new Promise((resolve) => setTimeout(resolve, 150));

            // Mark as completed
            await tx.client.query(
              `UPDATE agenticpay_milestones_test 
               SET status = 'COMPLETED' 
               WHERE user_id = $1 AND project_id = $2 AND id = $3`,
              ['user-1', 'proj-1', 'ms-1']
            );

            await tx.commit();
            settlementOrder.push('settlement1-completed');
            completionTimes.settlement1 = Date.now() - startTime;
            return 'success';
          });
        })();

        // Settlement 2 (starts slightly after settlement 1)
        await new Promise((resolve) => setTimeout(resolve, 30));
        const settlement2 = (async () => {
          return withTransaction(pool2, async (tx) => {
            settlementOrder.push('settlement2-started');
            const res = await tx.client.query(
              `SELECT * FROM agenticpay_milestones_test 
               WHERE user_id = $1 AND project_id = $2 AND id = $3
               FOR UPDATE`,
              ['user-1', 'proj-1', 'ms-1']
            );

            if ((res.rows[0] as any).status !== 'AUDITED_PENDING_APPROVAL') {
              await tx.rollback();
              settlementOrder.push('settlement2-rejected');
              completionTimes.settlement2 = Date.now() - startTime;
              return 'rejected-already-settled';
            }

            await tx.commit();
            settlementOrder.push('settlement2-completed');
            completionTimes.settlement2 = Date.now() - startTime;
            return 'success';
          });
        })();

        const [result1, result2] = await Promise.all([settlement1, settlement2]);

        // Settlement 1 should complete first
        expect(result1).toBe('success');
        // Settlement 2 should reject because milestone is now COMPLETED
        expect(result2).toBe('rejected-already-settled');

        // Verify order: settlement 1 acquires lock, completes, releases; settlement 2 then finds it completed
        expect(settlementOrder).toContain('settlement1-started');
        expect(settlementOrder).toContain('settlement1-completed');
        expect(settlementOrder).toContain('settlement2-started');
        expect(settlementOrder).toContain('settlement2-rejected');

        // Settlement 2 should have waited for settlement 1
        const difference = completionTimes.settlement2 - completionTimes.settlement1;
        expect(difference).toBeGreaterThanOrEqual(0);
      } finally {
        await pool1.end();
        await pool2.end();
      }
    });
  });
});
