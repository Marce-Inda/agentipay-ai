#!/usr/bin/env node

/**
 * Stage 0 Git Cleanup Script
 * Moves temporary hackathon planning files to .cleanup/ folder (local-only)
 * and commits the removal from git.
 * 
 * Idempotent: safe to run multiple times
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const CLEANUP_FOLDER = '.cleanup';
const PATTERNS = [
  'PITCH_*.md',
  'DEMO_*.md',
  'HACKATHON_PREP_*',
  'VIDEO_PRODUCTION_*',
  'TASK_11_*',
];

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

function findFilesMatchingPatterns(baseDir, patterns) {
  const files = [];
  const entries = fs.readdirSync(baseDir);

  for (const entry of entries) {
    // Skip .cleanup, .git, node_modules, etc
    if (['.cleanup', '.git', 'node_modules', '.next', '.kiro', '.vscode'].includes(entry)) {
      continue;
    }

    const fullPath = path.join(baseDir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isFile()) {
      // Check if filename matches any pattern
      for (const pattern of patterns) {
        // Convert glob pattern to regex (simple: * becomes .*)
        const regexPattern = pattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);

        if (regex.test(entry)) {
          files.push(fullPath);
          break;
        }
      }
    }
  }

  return files;
}

function ensureCleanupFolder() {
  if (!fs.existsSync(CLEANUP_FOLDER)) {
    fs.mkdirSync(CLEANUP_FOLDER, { recursive: true });
    log('success', `Created ${CLEANUP_FOLDER}/ folder`);
  }
}

function moveFiles(files) {
  const moved = [];

  for (const file of files) {
    const basename = path.basename(file);
    const dest = path.join(CLEANUP_FOLDER, basename);

    try {
      // Read file (preserve content)
      const content = fs.readFileSync(file);
      
      // Write to .cleanup/
      fs.writeFileSync(dest, content);
      
      // Delete original
      fs.unlinkSync(file);
      
      moved.push(basename);
      log('success', `Moved: ${basename} → ${CLEANUP_FOLDER}/`);
    } catch (error) {
      log('error', `Failed to move ${basename}: ${error.message}`);
    }
  }

  return moved;
}

function ensureGitignoreIncludesCleanup() {
  const gitignorePath = '.gitignore';
  let content = '';

  if (fs.existsSync(gitignorePath)) {
    content = fs.readFileSync(gitignorePath, 'utf8');
  }

  // Check if .cleanup/ is already in .gitignore
  if (!content.includes('.cleanup/') && !content.includes('.cleanup')) {
    content += (content.endsWith('\n') ? '' : '\n') + '.cleanup/\n';
    fs.writeFileSync(gitignorePath, content);
    log('success', 'Added .cleanup/ to .gitignore');
  } else {
    log('info', '.cleanup/ already in .gitignore');
  }
}

function stageGitRemovals(files) {
  const removed = [];

  for (const file of files) {
    try {
      // Stage the removal in git
      execSync(`git rm --cached "${file}" 2>/dev/null || true`, { stdio: 'pipe' });
      removed.push(file);
      log('success', `Staged removal: git rm --cached ${file}`);
    } catch (error) {
      log('warn', `Could not stage removal of ${file}: ${error.message}`);
    }
  }

  return removed;
}

function commitCleanup(movedCount) {
  try {
    // Check if there are staged changes
    const status = execSync('git status --porcelain', { encoding: 'utf8' });

    if (status.trim().length === 0) {
      log('info', 'No staged changes to commit');
      return false;
    }

    const message = 'refactor: remove temporary hackathon planning documents, preserve locally in .cleanup/';
    execSync(`git commit -m "${message}"`, { stdio: 'pipe' });
    log('success', `Committed: "${message}"`);
    
    // Get commit hash
    const hash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
    log('info', `Commit hash: ${hash.slice(0, 7)}`);
    
    return true;
  } catch (error) {
    log('warn', `Could not create git commit: ${error.message}`);
    return false;
  }
}

async function runCleanup() {
  log('info', 'Starting Stage 0 Git Cleanup...');

  try {
    // Find matching files
    log('info', `Searching for temporary files matching: ${PATTERNS.join(', ')}`);
    const filesToMove = findFilesMatchingPatterns('.', PATTERNS);

    if (filesToMove.length === 0) {
      log('info', 'No temporary files found. Cleanup already complete or no files to remove.');
      return;
    }

    log('success', `Found ${filesToMove.length} temporary file(s)`);

    // Ensure .cleanup/ exists
    ensureCleanupFolder();

    // Move files
    const moved = moveFiles(filesToMove);

    if (moved.length === 0) {
      log('error', 'No files were successfully moved');
      process.exit(1);
    }

    // Update .gitignore
    ensureGitignoreIncludesCleanup();

    // Stage git removals
    stageGitRemovals(filesToMove);

    // Commit
    const committed = commitCleanup(moved.length);

    if (!committed) {
      log('warn', 'Files moved but git commit was not created');
    }

    // Final status
    log('success', `\nCleanup complete:`);
    log('success', `  - Files moved: ${moved.length}`);
    log('success', `  - Location: ${CLEANUP_FOLDER}/`);
    log('success', `  - Git status: clean`);
  } catch (error) {
    log('error', `Cleanup failed: ${error.message}`);
    process.exit(1);
  }
}

runCleanup();
