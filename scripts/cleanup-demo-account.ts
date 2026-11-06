#!/usr/bin/env node

/**
 * Clean Up Demo Account After Hackathon
 * 
 * This script removes the demo account and resets registration settings.
 * Run this AFTER the hackathon evaluation period ends.
 * 
 * Usage:
 *   DATABASE_URL=postgresql://... npx ts-node scripts/cleanup-demo-account.ts
 * 
 * What it does:
 *   1. Deletes the judge demo user and all associated sessions
 *   2. Prints instructions to reset REGISTRATION_INVITE_CODE in Render dashboard
 */

import { Pool } from 'pg';

const DEMO_EMAIL = 'judge@agenticpay.demo';

async function cleanupDemoAccount() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🗑️  Cleaning up demo account for hackathon...\n');

    // Find the user
    const userResult = await pool.query(
      'SELECT id FROM agenticpay_users WHERE email = $1',
      [DEMO_EMAIL]
    );

    if (userResult.rows.length === 0) {
      console.log(`ℹ️  No demo account found with email: ${DEMO_EMAIL}`);
      process.exit(0);
    }

    const userId = userResult.rows[0].id;

    // Delete associated sessions
    const sessionsDeleted = await pool.query(
      'DELETE FROM agenticpay_sessions WHERE user_id = $1',
      [userId]
    );

    console.log(`✅ Deleted ${sessionsDeleted.rowCount} session(s)`);

    // Delete the user
    const userDeleted = await pool.query(
      'DELETE FROM agenticpay_users WHERE id = $1',
      [userId]
    );

    console.log(`✅ Deleted demo user account\n`);

    console.log('🔐 Next Steps to Secure Registration:');
    console.log('   1. Go to Render Dashboard → Your Service → Environment Variables');
    console.log('   2. Set REGISTRATION_INVITE_CODE to a new strong random value');
    console.log('      Example: openssl rand -base64 32\n');
    console.log('   3. Optionally set REGISTRATION_ENABLED=false if you want to disable new signups\n');

    console.log('📝 Summary:');
    console.log(`   • Removed user: ${DEMO_EMAIL}`);
    console.log(`   • User ID was: ${userId}`);
  } catch (error) {
    console.error('❌ Error cleaning up demo account:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanupDemoAccount();
