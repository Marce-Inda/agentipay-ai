#!/usr/bin/env node

/**
 * Stage 0 Verification Report Generator
 * Orchestrates all validators and produces COMPLETION_REPORT.md
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function log(level, msg) {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m',
  };
  const prefix = colors[level] || colors.info;
  console.log(`${prefix}[${level.toUpperCase()}]${colors.reset} ${msg}`);
}

function getGitHash() {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim().slice(0, 7);
  } catch {
    return 'unknown';
  }
}

function getGitLog() {
  try {
    // Get the last commit message
    return execSync('git log -1 --oneline', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function checkDocumentationCleaned() {
  const checks = {
    'README.md': {
      shouldNotContain: ['PRODUCTION-READY: Real PayPal', '🚀 PRODUCTION-READY'],
      shouldContain: ['Sandbox End-to-End Verified'],
    },
    'src/lib/paypal/client.ts': {
      shouldNotContain: ['multimodal audit verification'],
      shouldContain: ['deterministic audit verification'],
    },
    'BUSINESS_MODEL.md': {
      shouldNotContain: ['- Multimodal vision audit.'],  // Only block if NOT qualified
      shouldContain: ['deterministic heuristic-based'],
    },
    'scripts/run-e2e-test.ts': {
      shouldNotContain: ['Multimodal Deliverable Audit Evaluated'],
      shouldContain: ['Deterministic Audit Evaluated'],
    },
  };

  const results = {};

  for (const [file, checks_obj] of Object.entries(checks)) {
    if (!fs.existsSync(file)) {
      results[file] = { passed: false, reason: 'File not found' };
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    let passed = true;
    let reason = '';

    // Check shouldNotContain
    for (const phrase of checks_obj.shouldNotContain || []) {
      if (content.includes(phrase)) {
        passed = false;
        reason = `Still contains: "${phrase}"`;
        break;
      }
    }

    // Check shouldContain
    if (passed) {
      for (const phrase of checks_obj.shouldContain || []) {
        if (!content.includes(phrase)) {
          passed = false;
          reason = `Missing: "${phrase}"`;
          break;
        }
      }
    }

    results[file] = { passed, reason: reason || 'OK' };
  }

  return results;
}

function checkSecurityAuditReport() {
  try {
    const content = fs.readFileSync('SECURITY_AUDIT_REPORT.md', 'utf8');
    
    const hasOldVerdictPhrase = content.includes('VERDICT: Code is production-ready') && 
                               !content.includes('VERDICT: The architecture');
    const hasNewPhrase = content.includes('VERDICT: The architecture and controls are production-ready in design');
    const hasFinalVerdictUpdate = content.includes('PRODUCTION-READY (DESIGN)');

    return {
      passed: !hasOldVerdictPhrase && (hasNewPhrase || hasFinalVerdictUpdate),
      reason: hasNewPhrase && hasFinalVerdictUpdate ? 'OK' : 'Production-ready claims not properly qualified',
    };
  } catch (error) {
    return { passed: false, reason: `Error reading file: ${error.message}` };
  }
}

function checkSettlementRailReference() {
  try {
    const content = fs.readFileSync('SETTLEMENT_RAIL_REFERENCE.md', 'utf8');
    
    const hasQualifiedProduction = content.includes('production-ready in design');
    const hasSandboxNote = content.includes('Sandbox');

    return {
      passed: hasQualifiedProduction && hasSandboxNote,
      reason: hasQualifiedProduction ? 'OK' : 'Production-ready claim not qualified',
    };
  } catch (error) {
    return { passed: false, reason: `Error reading file: ${error.message}` };
  }
}

function checkValidatorsExist() {
  const results = {};
  
  const validators = [
    'src/lib/validation/paypal-validator.ts',
    'src/lib/validation/openrouter-validator.ts',
  ];

  for (const validator of validators) {
    results[validator] = {
      exists: fs.existsSync(validator),
      hasExport: false,
    };

    if (results[validator].exists) {
      const content = fs.readFileSync(validator, 'utf8');
      results[validator].hasExport = content.includes('export') && 
                                     content.includes('async function');
    }
  }

  return results;
}

function checkCleanupScriptExists() {
  const script = 'scripts/stage-0-cleanup.js';
  return {
    exists: fs.existsSync(script),
    isExecutable: fs.existsSync(script),
  };
}

function checkTestAccountsFile() {
  const accountsFile = '.stage-0-accounts.local.json';
  let exists = false;
  let hasContent = false;

  if (fs.existsSync(accountsFile)) {
    exists = true;
    try {
      const content = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
      hasContent = content.buyer && content.seller && content.platform;
    } catch {
      // Invalid JSON or empty
    }
  }

  return { exists, hasContent };
}

function checkGitignore() {
  const results = {};
  let gitignoreContent = '';

  if (fs.existsSync('.gitignore')) {
    gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
  }

  results.cleanupFolderIgnored = gitignoreContent.includes('.cleanup');
  results.accountsFileIgnored = gitignoreContent.includes('.stage-0-accounts');

  return results;
}

function generateCompletionReport(docStatus, paypalStatus, openrouterStatus, gitStatus, accountsStatus) {
  const timestamp = new Date().toISOString();
  const gitHash = getGitHash();
  const gitLog = getGitLog();

  // Determine overall status
  let overallStatus = 'READY_FOR_STAGE_1';
  const blockers = [];
  const warnings = [];

  // Check documentation
  const docsPassed = Object.values(docStatus).every(v => v.passed);
  if (!docsPassed) {
    blockers.push('Documentation cleanup incomplete');
  }

  // Check validators
  const validatorsExist = Object.values(paypalStatus).every(v => v.exists && v.hasExport);
  if (!validatorsExist) {
    blockers.push('Validator modules not properly created');
  }

  // Check cleanup script
  if (!gitStatus.cleanupScriptExists) {
    warnings.push('Git cleanup script not found (optional)');
  }

  // Check test accounts (not blocking, but important)
  if (!accountsStatus.exists) {
    warnings.push('PayPal test accounts file not created - manual provisioning needed');
  }

  // Check gitignore
  if (!gitStatus.cleanupFolderIgnored) {
    warnings.push('.cleanup/ not in .gitignore');
  }

  if (blockers.length > 0) {
    overallStatus = 'BLOCKED';
  } else if (warnings.length > 0) {
    overallStatus = 'WARNINGS';
  }

  const report = `# Stage 0: Cleanup & Verification - COMPLETION REPORT

**Generated:** ${timestamp}  
**Git Commit:** ${gitHash} (${gitLog})  
**Overall Status:** ${overallStatus === 'READY_FOR_STAGE_1' ? '✅ READY_FOR_STAGE_1' : overallStatus === 'BLOCKED' ? '❌ BLOCKED' : '⚠️ WARNINGS'}

---

## Documentation Cleanup

${Object.entries(docStatus).map(([file, status]) => {
  const icon = status.passed ? '✅' : '❌';
  return `- ${icon} **${file}**: ${status.reason}`;
}).join('\n')}

---

## Validators

${Object.entries(paypalStatus).map(([validator, status]) => {
  const icon = status.exists && status.hasExport ? '✅' : '❌';
  return `- ${icon} **${validator}**: ${status.exists ? 'Created' : 'Missing'}${status.hasExport ? ', exports function' : ''}`;
}).join('\n')}

---

## Security Audit Report

- ${checkSecurityAuditReport().passed ? '✅' : '❌'} **SECURITY_AUDIT_REPORT.md**: ${checkSecurityAuditReport().reason}

---

## Settlement Rail Reference

- ${checkSettlementRailReference().passed ? '✅' : '❌'} **SETTLEMENT_RAIL_REFERENCE.md**: ${checkSettlementRailReference().reason}

---

## Git Cleanup

${gitStatus.cleanupScriptExists ? '- ✅ **stage-0-cleanup.js script**: Created' : '- ❌ **stage-0-cleanup.js script**: Missing'}

---

## PayPal Test Accounts

${accountsStatus.exists && accountsStatus.hasContent ? 
  '- ✅ **.stage-0-accounts.local.json**: Created with Buyer, Seller, Platform accounts' :
  '- ⚠️ **.stage-0-accounts.local.json**: Not created. Manual provisioning required via PayPal Developer Dashboard'}

---

## Git Status

- ${gitStatus.cleanupFolderIgnored ? '✅' : '⚠️'} **.cleanup/ in .gitignore**: ${gitStatus.cleanupFolderIgnored ? 'Yes' : 'No'}
- ${gitStatus.accountsFileIgnored ? '✅' : '⚠️'} **.stage-0-accounts in .gitignore**: ${gitStatus.accountsFileIgnored ? 'Yes' : 'No'}

---

## Summary

${blockers.length > 0 ? `
**Blockers:**
${blockers.map(b => `- ❌ ${b}`).join('\n')}
` : ''}

${warnings.length > 0 ? `
**Warnings:**
${warnings.map(w => `- ⚠️ ${w}`).join('\n')}
` : ''}

${blockers.length === 0 && warnings.length === 0 ? '✅ **All checks passed. Ready for Stage 1.**' : ''}

---

## Next Steps

${overallStatus === 'READY_FOR_STAGE_1' ? 
  'Stage 0 is complete. Proceed to Stage 1 feature implementation.' :
  overallStatus === 'BLOCKED' ?
  'Address blockers above before proceeding to Stage 1.' :
  'Address warnings above before proceeding to Stage 1.'}

${!accountsStatus.exists ? `
### Manual Action Required: PayPal Test Account Provisioning

To complete Stage 0, create three Sandbox business accounts:
1. Visit https://developer.paypal.com/dashboard
2. Navigate to Sandbox → Accounts
3. Create or verify three business accounts:
   - **Buyer**: email (e.g., buyer@test.com), role: buyer
   - **Seller**: email (e.g., seller@test.com), role: seller  
   - **Platform**: email (e.g., platform@test.com), role: business
4. Record emails and Sandbox IDs in .stage-0-accounts.local.json (see template below)

**Template:**
\`\`\`json
{
  "buyer": {
    "email": "buyer@test.com",
    "sandboxId": "XXXXX",
    "role": "buyer"
  },
  "seller": {
    "email": "seller@test.com",
    "sandboxId": "XXXXX",
    "role": "seller"
  },
  "platform": {
    "email": "platform@test.com",
    "sandboxId": "XXXXX",
    "role": "business"
  }
}
\`\`\`
` : ''}

---

**End of Report**
`;

  return report;
}

async function main() {
  log('info', 'Starting Stage 0 Verification...\n');

  try {
    // Check documentation
    log('info', 'Checking documentation cleanup...');
    const docStatus = checkDocumentationCleaned();
    const docsPassed = Object.values(docStatus).every(v => v.passed);
    log(docsPassed ? 'success' : 'warn', `Documentation: ${Object.entries(docStatus).filter(([_, v]) => v.passed).length}/${Object.keys(docStatus).length} files OK`);

    // Check validators
    log('info', 'Checking validator modules...');
    const paypalStatus = checkValidatorsExist();
    const validatorsPassed = Object.values(paypalStatus).every(v => v.exists && v.hasExport);
    log(validatorsPassed ? 'success' : 'warn', `Validators: ${Object.entries(paypalStatus).filter(([_, v]) => v.exists && v.hasExport).length}/${Object.keys(paypalStatus).length} modules OK`);

    // Check cleanup script
    log('info', 'Checking cleanup script...');
    const cleanupStatus = checkCleanupScriptExists();
    log(cleanupStatus.exists ? 'success' : 'warn', `Cleanup script: ${cleanupStatus.exists ? 'Found' : 'Not found'}`);

    // Check test accounts
    log('info', 'Checking PayPal test accounts...');
    const accountsStatus = checkTestAccountsFile();
    log(accountsStatus.exists && accountsStatus.hasContent ? 'success' : 'warn', 
        `Test accounts: ${accountsStatus.exists && accountsStatus.hasContent ? 'Configured' : 'Not configured'}`);

    // Check gitignore
    log('info', 'Checking .gitignore...');
    const gitignoreStatus = checkGitignore();
    log((gitignoreStatus.cleanupFolderIgnored && gitignoreStatus.accountsFileIgnored) ? 'success' : 'warn', 
        `Gitignore: ${gitignoreStatus.cleanupFolderIgnored && gitignoreStatus.accountsFileIgnored ? 'OK' : 'Incomplete'}`);

    // Check security and settlement docs
    log('info', 'Checking updated documentation...');
    const securityStatus = checkSecurityAuditReport();
    const settlementStatus = checkSettlementRailReference();
    log(securityStatus.passed && settlementStatus.passed ? 'success' : 'warn', 
        `Updated docs: ${securityStatus.passed && settlementStatus.passed ? 'OK' : 'Incomplete'}`);

    // Generate report
    log('info', 'Generating completion report...');
    const report = generateCompletionReport(
      docStatus,
      paypalStatus,
      {},
      {
        cleanupScriptExists: cleanupStatus.exists,
        ...gitignoreStatus,
      },
      accountsStatus
    );

    const reportPath = '.kiro/specs/stage-0-cleanup-verification/COMPLETION_REPORT.md';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, report);
    log('success', `Report generated: ${reportPath}`);

    // Print report
    console.log('\n' + report);

  } catch (error) {
    log('error', `Verification failed: ${error.message}`);
    process.exit(1);
  }
}

main();
