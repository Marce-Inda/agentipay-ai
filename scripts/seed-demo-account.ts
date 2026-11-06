#!/usr/bin/env node

/**
 * Seed Demo Account for Hackathon Judges
 * 
 * This script creates a pre-configured demo account for hackathon judges.
 * Run this ONCE against your production database before sharing access with judges.
 * 
 * Usage:
 *   DATABASE_URL=postgresql://... npx ts-node scripts/seed-demo-account.ts
 * 
 * Post-Hackathon Cleanup:
 *   1. Set REGISTRATION_INVITE_CODE back to a strong random value
 *   2. Delete this demo user via: DELETE FROM agenticpay_users WHERE email = 'judge@agenticpay.demo';
 *   3. Or run: scripts/cleanup-demo-account.ts
 */

import { Pool } from 'pg';
import { createHash, randomUUID } from 'crypto';
import { scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const DEMO_EMAIL = 'judge@agenticpay.demo';
const DEMO_PASSWORD = 'JudgeDemo2026!@#Demo';
const DEMO_ORGANIZATION = 'Hackathon Judge Panel';

async function hashPassword(password: string): Promise<string> {
  const salt = randomUUID().slice(0, 16);
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}$${derivedKey.toString('hex')}`;
}

async function seedDemoAccount() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    console.log('🔐 Seeding demo account for hackathon judges...\n');

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM agenticpay_users WHERE email = $1',
      [DEMO_EMAIL]
    );

    if (existingUser.rows.length > 0) {
      console.warn(`⚠️  Demo account already exists with email: ${DEMO_EMAIL}`);
      console.log(
        'ℹ️  If you want to recreate it, delete it first:\n',
        `   DELETE FROM agenticpay_users WHERE email = '${DEMO_EMAIL}';\n`
      );
      process.exit(0);
    }

    // Hash the password
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    // Create the demo user
    const result = await pool.query(
      `INSERT INTO agenticpay_users (id, email, password_hash, display_name, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, email, display_name, created_at`,
      [randomUUID(), DEMO_EMAIL, passwordHash, DEMO_ORGANIZATION]
    );

    const user = result.rows[0];

    console.log('✅ Demo account created successfully!\n');
    console.log('📋 Judge Login Credentials:');
    console.log(`   Email:    ${DEMO_EMAIL}`);
    console.log(`   Password: ${DEMO_PASSWORD}`);
    console.log(`   Org Name: ${DEMO_ORGANIZATION}\n`);

    console.log('⏰ Post-Hackathon Cleanup Reminders:');
    console.log('   1. Change REGISTRATION_INVITE_CODE back to a strong random value');
    console.log(`   2. Delete demo user: DELETE FROM agenticpay_users WHERE email = '${DEMO_EMAIL}';`);
    console.log('   3. Or run: npm run seed:cleanup\n');

    console.log(`📍 Account ID: ${user.id}`);
    console.log(`📅 Created at: ${user.created_at}`);
  } catch (error) {
    console.error('❌ Error seeding demo account:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDemoAccount();
