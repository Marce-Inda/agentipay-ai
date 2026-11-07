-- ============================================================================
-- Migration: 002_create_escrow_funding.sql
-- Purpose: Create agenticpay_escrow_funding table for real PayPal escrow management
-- Date: 2026-11-07
-- ============================================================================

-- ============================================================================
-- UP: Create escrow_funding table and extend projects table
-- ============================================================================

-- Create agenticpay_escrow_funding table
CREATE TABLE IF NOT EXISTS agenticpay_escrow_funding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  user_id UUID NOT NULL,
  order_id VARCHAR UNIQUE NOT NULL,
  capture_id VARCHAR UNIQUE,
  order_status VARCHAR NOT NULL DEFAULT 'CREATED' 
    CHECK (order_status IN ('CREATED', 'APPROVED', 'CAPTURED', 'PARTIALLY_REFUNDED', 'FULLY_REFUNDED', 'VOIDED', 'FAILED')),
  amount_usd DECIMAL(12,2) NOT NULL,
  funded_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
  released_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
  refunded_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
  payer_email VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata_json JSONB,
  
  CONSTRAINT fk_escrow_project_id 
    FOREIGN KEY (project_id) REFERENCES agenticpay_projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_escrow_user_id 
    FOREIGN KEY (user_id) REFERENCES agenticpay_users(id) ON DELETE CASCADE,
  CONSTRAINT funded_gte_released
    CHECK (funded_usd >= released_usd),
  CONSTRAINT refunded_lte_funded
    CHECK (refunded_usd <= funded_usd)
);

-- Indexes for escrow_funding table
CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_funding_project_id 
  ON agenticpay_escrow_funding(project_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_funding_order_id 
  ON agenticpay_escrow_funding(order_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_escrow_funding_capture_id 
  ON agenticpay_escrow_funding(capture_id) WHERE capture_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_escrow_funding_user_created 
  ON agenticpay_escrow_funding(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_escrow_funding_status 
  ON agenticpay_escrow_funding(order_status);

CREATE INDEX IF NOT EXISTS idx_escrow_funding_user_project
  ON agenticpay_escrow_funding(user_id, project_id);

-- Extend agenticpay_projects table with funding denormalization
ALTER TABLE agenticpay_projects 
  ADD COLUMN IF NOT EXISTS funded_usd DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refundable_usd DECIMAL(12,2) NOT NULL DEFAULT 0;

-- ============================================================================
-- DOWN (Rollback): Drop escrow_funding table and remove project extensions
-- ============================================================================
/*
-- Rollback script (execute manually or in a separate down migration)

-- Drop indexes
DROP INDEX IF EXISTS idx_escrow_funding_project_id CASCADE;
DROP INDEX IF EXISTS idx_escrow_funding_order_id CASCADE;
DROP INDEX IF EXISTS idx_escrow_funding_capture_id CASCADE;
DROP INDEX IF EXISTS idx_escrow_funding_user_created CASCADE;
DROP INDEX IF EXISTS idx_escrow_funding_status CASCADE;
DROP INDEX IF EXISTS idx_escrow_funding_user_project CASCADE;

-- Drop table
DROP TABLE IF EXISTS agenticpay_escrow_funding CASCADE;

-- Remove columns from projects
ALTER TABLE agenticpay_projects 
  DROP COLUMN IF EXISTS funded_usd CASCADE,
  DROP COLUMN IF EXISTS refundable_usd CASCADE;
*/
