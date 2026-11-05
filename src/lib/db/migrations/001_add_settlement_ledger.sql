-- ============================================================================
-- Migration: 001_add_settlement_ledger.sql
-- Purpose: Add settlement tracking columns to ledger and milestone tables
-- Date: 2026-11-05
-- ============================================================================

-- ============================================================================
-- UP: Add settlement columns to agenticpay_ledger_events
-- ============================================================================

-- Add fingerprint_id: SHA256 hash for deduplication and idempotency
ALTER TABLE agenticpay_ledger_events 
ADD COLUMN fingerprint_id VARCHAR(64);

-- Add settlement_id: Unique settlement identifier
ALTER TABLE agenticpay_ledger_events 
ADD COLUMN settlement_id VARCHAR(64);

-- Add payout_batch_id: Real PayPal batch ID or simulated ID
-- Example: $BATCH_ID-12345678-ABCDEF or SIMULATED-abc123def456
ALTER TABLE agenticpay_ledger_events 
ADD COLUMN payout_batch_id VARCHAR(128);

-- Add batch_status: PayPal status (PROCESSING, SUCCESS, FAILED, SIMULATED)
ALTER TABLE agenticpay_ledger_events 
ADD COLUMN batch_status VARCHAR(32);

-- Add paypal_request_id: Idempotency key
-- Format: REQ-{fingerprint.slice(0, 32)}
-- Example: REQ-abc123def456789abcdef01234567
ALTER TABLE agenticpay_ledger_events 
ADD COLUMN paypal_request_id VARCHAR(64);

-- Add sender_batch_id: PayPal sender batch identifier
-- Format: SETTLE-{fingerprint.slice(0, 28)}
-- Example: SETTLE-abc123def456789abcdef01
ALTER TABLE agenticpay_ledger_events 
ADD COLUMN sender_batch_id VARCHAR(64);

-- Add payout_executor_rail: Track which rail was used
-- Values: PAYPAL_SANDBOX, SIMULATED, SUPPRESSED_RAIL
ALTER TABLE agenticpay_ledger_events 
ADD COLUMN payout_executor_rail VARCHAR(32);

-- Add ledger_created_at: Timestamp when event was created
-- Note: Different from transaction created_at for clarity
ALTER TABLE agenticpay_ledger_events 
ADD COLUMN ledger_created_at TIMESTAMPTZ DEFAULT now();

-- Create UNIQUE index for fingerprint-based deduplication
-- This enforces that the same fingerprint (user_id, projectId, milestoneId, amount)
-- cannot be settled twice, preventing double-payments
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_fingerprint 
  ON agenticpay_ledger_events(user_id, fingerprint_id)
  WHERE fingerprint_id IS NOT NULL;

-- Create index for settlement lookups by fingerprint
CREATE INDEX IF NOT EXISTS idx_ledger_settlement_id 
  ON agenticpay_ledger_events(user_id, settlement_id)
  WHERE settlement_id IS NOT NULL;

-- Create index for payout batch tracking
CREATE INDEX IF NOT EXISTS idx_ledger_payout_batch 
  ON agenticpay_ledger_events(payout_batch_id)
  WHERE payout_batch_id IS NOT NULL;

-- ============================================================================
-- Add settlement columns to agenticpay_milestones (if table exists)
-- Note: If milestones are stored as JSONB inside projects, adjust accordingly
-- ============================================================================

-- Create milestones table if it doesn't exist (for future normalization)
CREATE TABLE IF NOT EXISTS agenticpay_milestones (
  id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES agenticpay_users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  payout_batch_id VARCHAR(128),
  batch_status VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id, id)
);

-- Create indexes for milestone queries
CREATE INDEX IF NOT EXISTS idx_milestones_user_project 
  ON agenticpay_milestones(user_id, project_id);

CREATE INDEX IF NOT EXISTS idx_milestones_payout_batch 
  ON agenticpay_milestones(payout_batch_id)
  WHERE payout_batch_id IS NOT NULL;

-- ============================================================================
-- DOWN (Rollback): Remove settlement columns and indexes
-- ============================================================================
/*
-- Rollback script (execute manually or in a separate down migration)

-- Drop indexes
DROP INDEX IF EXISTS idx_ledger_fingerprint CASCADE;
DROP INDEX IF EXISTS idx_ledger_settlement_id CASCADE;
DROP INDEX IF EXISTS idx_ledger_payout_batch CASCADE;
DROP INDEX IF EXISTS idx_milestones_user_project CASCADE;
DROP INDEX IF EXISTS idx_milestones_payout_batch CASCADE;

-- Drop milestones table
DROP TABLE IF EXISTS agenticpay_milestones CASCADE;

-- Remove columns from ledger_events
ALTER TABLE agenticpay_ledger_events 
DROP COLUMN IF EXISTS fingerprint_id CASCADE;
ALTER TABLE agenticpay_ledger_events 
DROP COLUMN IF EXISTS settlement_id CASCADE;
ALTER TABLE agenticpay_ledger_events 
DROP COLUMN IF EXISTS payout_batch_id CASCADE;
ALTER TABLE agenticpay_ledger_events 
DROP COLUMN IF EXISTS batch_status CASCADE;
ALTER TABLE agenticpay_ledger_events 
DROP COLUMN IF EXISTS paypal_request_id CASCADE;
ALTER TABLE agenticpay_ledger_events 
DROP COLUMN IF EXISTS sender_batch_id CASCADE;
ALTER TABLE agenticpay_ledger_events 
DROP COLUMN IF EXISTS payout_executor_rail CASCADE;
ALTER TABLE agenticpay_ledger_events 
DROP COLUMN IF EXISTS ledger_created_at CASCADE;
*/
