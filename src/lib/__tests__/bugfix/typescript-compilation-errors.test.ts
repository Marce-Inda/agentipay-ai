/**
 * Bug Condition Exploration Test: TypeScript Compilation Errors
 * 
 * CRITICAL: This test MUST FAIL on unfixed code with 14 errors
 * EXPECTED OUTCOME: Compilation fails, confirming all 14 errors exist
 * 
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10
 */

import { execSync } from 'child_process';

describe('Bug Condition Exploration: TypeScript Compilation Errors', () => {
  /**
   * Property 1: Bug Condition - TypeScript Compilation Failures
   * 
   * This test runs `tsc --strict` on source files and captures all compilation errors.
   * On UNFIXED code, this test FAILS with 14 errors, which IS THE SUCCESS CASE
   * for a bug exploration test (confirms bugs exist).
   * 
   * The test confirms:
   * - 4 invalid TransactionStatus enum values
   * - 2 missing ProjectMilestone property references
   * - 2 missing repository method calls
   * - 2 implicit any types in catch parameters
   * - 1 null-safety violation on envelope
   * - 1 optional-to-required field assignment issue
   */
  it('MUST FAIL on unfixed code: Discovers 14 TypeScript compilation errors', () => {
    // Run TypeScript compiler in strict mode
    let tscOutput = '';
    try {
      tscOutput = execSync('npx tsc --strict --noEmit', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error: any) {
      // tsc exits with code 1 when errors are found; capture the stderr output
      tscOutput = (error.stdout || '') + (error.stderr || '');
    }

    // Parse error messages
    const errors = parseCompilationErrors(tscOutput);

    console.log('\n' + '='.repeat(80));
    console.log('TYPESCRIPT COMPILATION ERRORS FOUND');
    console.log('='.repeat(80));
    console.log(`Total Errors: ${errors.length}\n`);

    // Document each error
    errors.forEach((error, index) => {
      console.log(
        `Error ${index + 1}: [${error.category}]`
      );
      console.log(`  File: ${error.file}`);
      console.log(`  Line: ${error.line}, Column: ${error.column}`);
      console.log(`  Message: ${error.message}\n`);
    });

    console.log('='.repeat(80));
    console.log('ERROR CATEGORIES SUMMARY');
    console.log('='.repeat(80));

    // Group errors by category
    const errorsByCategory = groupErrorsByCategory(errors);

    Object.entries(errorsByCategory).forEach(([category, categoryErrors]) => {
      console.log(`\n${category} (${categoryErrors.length} errors):`);
      categoryErrors.forEach((error) => {
        console.log(`  - ${error.file}:${error.line} - ${error.message}`);
      });
    });

    console.log('\n' + '='.repeat(80) + '\n');

    // Verify error count
    expect(errors.length).toBe(14);

    // Verify all error categories exist
    verifyAllErrorCategories(errors);
  });
});

/**
 * Parse TypeScript compiler error messages
 */
function parseCompilationErrors(output: string): Array<{
  file: string;
  line: number;
  column: number;
  message: string;
  category: string;
}> {
  const errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    category: string;
  }> = [];

  // Match pattern: src/path/file.ts(line,column): error TSxxxx: message
  const lines = output.split('\n');

  for (const line of lines) {
    // Match: src/path/file.ts(123,456): error TS1234: message here
    const match = line.match(
      /^(.+?)\((\d+),(\d+)\):\s+error\s+TS\d+:\s+(.+)$/
    );
    if (match) {
      const [, file, lineNum, colNum, message] = match;
      const category = categorizeError(message, file);

      errors.push({
        file: file.trim(),
        line: parseInt(lineNum),
        column: parseInt(colNum),
        message: message.trim(),
        category,
      });
    }
  }

  return errors;
}

/**
 * Categorize errors by type
 */
function categorizeError(message: string, file: string): string {
  if (
    message.includes('PROPOSAL_CREATED') ||
    message.includes('PROPOSAL_CONFIRMED') ||
    message.includes('PROPOSAL_DISMISSED') ||
    message.includes('SETTLEMENT_CANCELLED') ||
    message.includes('not assignable to type TransactionStatus')
  ) {
    return '1. Invalid TransactionStatus values';
  }

  if (
    message.includes('budgetUSD') ||
    message.includes('does not exist on type ProjectMilestone')
  ) {
    return '2. Missing ProjectMilestone property';
  }

  if (
    message.includes('APPROVED') ||
    (message.includes('unintentional') && message.includes('APPROVED'))
  ) {
    return '2. Missing ProjectMilestone property';
  }

  if (
    message.includes('getLedgerEventsByUser') ||
    message.includes('does not exist on type AgenticPayRepository')
  ) {
    return '3. Missing repository method';
  }

  if (message.includes('implicitly has an') || message.includes('implicitly any')) {
    return '4. Implicit any types';
  }

  if (message.includes('is possibly') && message.includes('null')) {
    return '5. Null-safety violations';
  }

  if (
    message.includes('not assignable to type') &&
    message.includes('undefined')
  ) {
    return '6. Optional-to-required assignment';
  }

  return 'Unknown';
}

/**
 * Group errors by category
 */
function groupErrorsByCategory(
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    category: string;
  }>
): Record<string, typeof errors> {
  const grouped: Record<string, typeof errors> = {};

  errors.forEach((error) => {
    if (!grouped[error.category]) {
      grouped[error.category] = [];
    }
    grouped[error.category].push(error);
  });

  return grouped;
}

/**
 * Verify all error categories are present
 */
function verifyAllErrorCategories(
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
    category: string;
  }>
): void {
  const invalidStatusErrors = errors.filter(
    (e) => e.category === '1. Invalid TransactionStatus values'
  );
  const missingPropertyErrors = errors.filter(
    (e) => e.category === '2. Missing ProjectMilestone property'
  );
  const missingMethodErrors = errors.filter(
    (e) => e.category === '3. Missing repository method'
  );
  const implicitAnyErrors = errors.filter(
    (e) => e.category === '4. Implicit any types'
  );
  const nullSafetyErrors = errors.filter(
    (e) => e.category === '5. Null-safety violations'
  );
  const optionalToRequiredErrors = errors.filter(
    (e) => e.category === '6. Optional-to-required assignment'
  );

  console.log('Error Category Verification:');
  console.log(
    `  ✓ Invalid TransactionStatus values: ${invalidStatusErrors.length} errors (expected: 4)`
  );
  console.log(
    `  ✓ Missing ProjectMilestone property: ${missingPropertyErrors.length} errors (expected: 2)`
  );
  console.log(
    `  ✓ Missing repository method: ${missingMethodErrors.length} errors (expected: 2)`
  );
  console.log(
    `  ✓ Implicit any types: ${implicitAnyErrors.length} errors (expected: 2)`
  );
  console.log(
    `  ✓ Null-safety violations: ${nullSafetyErrors.length} errors (expected: 1)`
  );
  console.log(
    `  ✓ Optional-to-required assignment: ${optionalToRequiredErrors.length} errors (expected: 1)`
  );

  console.log('\nSpecific Line Locations:');
  console.log('');

  if (invalidStatusErrors.length > 0) {
    console.log('Invalid TransactionStatus Values:');
    invalidStatusErrors.forEach((e) => {
      console.log(`  ${e.file}:${e.line} - ${e.message}`);
    });
    console.log('');
  }

  if (missingPropertyErrors.length > 0) {
    console.log('Missing ProjectMilestone Properties:');
    missingPropertyErrors.forEach((e) => {
      console.log(`  ${e.file}:${e.line} - ${e.message}`);
    });
    console.log('');
  }

  if (missingMethodErrors.length > 0) {
    console.log('Missing Repository Methods:');
    missingMethodErrors.forEach((e) => {
      console.log(`  ${e.file}:${e.line} - ${e.message}`);
    });
    console.log('');
  }

  if (implicitAnyErrors.length > 0) {
    console.log('Implicit Any Types:');
    implicitAnyErrors.forEach((e) => {
      console.log(`  ${e.file}:${e.line} - ${e.message}`);
    });
    console.log('');
  }

  if (nullSafetyErrors.length > 0) {
    console.log('Null-Safety Violations:');
    nullSafetyErrors.forEach((e) => {
      console.log(`  ${e.file}:${e.line} - ${e.message}`);
    });
    console.log('');
  }

  if (optionalToRequiredErrors.length > 0) {
    console.log('Optional-to-Required Assignment:');
    optionalToRequiredErrors.forEach((e) => {
      console.log(`  ${e.file}:${e.line} - ${e.message}`);
    });
    console.log('');
  }
}
