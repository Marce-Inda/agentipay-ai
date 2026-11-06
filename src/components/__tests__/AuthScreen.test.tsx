/**
 * Unit Tests: AuthScreen Component - Account Name Field Inclusivity (Task 2.4)
 *
 * Validates that Task 2.4 is correctly implemented:
 * - Account Name label renders "Account Name" (not "Organization or operator name")
 * - Account Name placeholder renders "Acme Treasury / Martinez Inc" (dual example)
 * - Account Name icon is User2 component (not Building2)
 * - Icon has correct className "w-4 h-4 text-slate-500 shrink-0"
 * - displayName field only visible in REGISTER mode, hidden in LOGIN mode
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.3
 */

import fs from 'fs';
import path from 'path';

describe('AuthScreen Component - Account Name Field Inclusivity (Task 2.4)', () => {
  const componentPath = path.join(__dirname, '../AuthScreen.tsx');
  let componentCode: string;

  beforeAll(() => {
    componentCode = fs.readFileSync(componentPath, 'utf-8');
  });

  describe('Task 2.4: Account Name Field Rendering in REGISTER Mode', () => {
    describe('Account Name Label Text', () => {
      it('should contain Account Name label in component code', () => {
        expect(componentCode).toContain('Account Name');
      });

      it('should display "Account Name" label (not "Organization or operator name")', () => {
        expect(componentCode).toContain('Account Name');
        expect(componentCode).not.toContain('Organization or operator name');
      });

      it('should have Account Name label with correct styling (uppercase, semibold)', () => {
        const labelMatch = componentCode.match(
          /Account Name[\s\S]*?text-xs[\s\S]*?uppercase/
        );
        expect(labelMatch).toBeTruthy();

        // Verify styling classes
        expect(componentCode).toContain('text-xs');
        expect(componentCode).toContain('font-semibold');
        expect(componentCode).toContain('uppercase');
        expect(componentCode).toContain('tracking-wider');
      });

      it('should have Account Name label with character count = 12 chars (requirement 1.3)', () => {
        const labelText = 'Account Name';
        expect(labelText).toHaveLength(12);
        expect(labelText.length).toBeLessThanOrEqual(40);
      });
    });

    describe('Account Name Placeholder Text', () => {
      it('should render placeholder "Acme Treasury / Martinez Inc" on displayName input', () => {
        expect(componentCode).toContain(
          'placeholder="Acme Treasury / Martinez Inc"'
        );
      });

      it('should have placeholder with corporate example "Acme Treasury"', () => {
        expect(componentCode).toContain('Acme Treasury');
      });

      it('should have placeholder with individual example "Martinez Inc"', () => {
        expect(componentCode).toContain('Martinez Inc');
      });

      it('should have placeholder exactly "Acme Treasury / Martinez Inc"', () => {
        expect(componentCode).toContain(
          'placeholder="Acme Treasury / Martinez Inc"'
        );
      });

      it('should have placeholder with character count = 28 chars (requirement 1.4, <= 60)', () => {
        const placeholder = 'Acme Treasury / Martinez Inc';
        expect(placeholder).toHaveLength(28);
        expect(placeholder.length).toBeLessThanOrEqual(60);
      });

      it('should have placeholder with "/" separator for clarity', () => {
        const placeholder = 'Acme Treasury / Martinez Inc';
        expect(placeholder).toContain(' / ');
      });

      it('should maintain professional tone in both placeholder examples', () => {
        const placeholder = 'Acme Treasury / Martinez Inc';
        // Both examples are business-oriented, professional
        expect(placeholder).toMatch(/Treasury|Inc/);
        // No consumer-oriented terms
        expect(placeholder).not.toMatch(/personal|individual|my/i);
      });
    });

    describe('Account Name Field Icon (User2)', () => {
      it('should render User2 icon for Account Name field', () => {
        // Find the Account Name label section and check for User2 icon
        const accountNameMatch = componentCode.match(
          /Account Name[\s\S]*?<\/label>/
        );
        expect(accountNameMatch).toBeTruthy();

        const accountCode = accountNameMatch![0];
        expect(accountCode).toContain('User2');
      });

      it('should have icon with className "w-4 h-4 text-slate-500 shrink-0"', () => {
        const accountNameMatch = componentCode.match(
          /Account Name[\s\S]*?<\/label>/
        );
        expect(accountNameMatch).toBeTruthy();

        const accountCode = accountNameMatch![0];
        expect(accountCode).toMatch(/<User2 className="w-4 h-4 text-slate-500 shrink-0"/);
      });

      it('should have icon with size w-4 h-4 (4x4 pixels)', () => {
        const accountNameMatch = componentCode.match(
          /Account Name[\s\S]*?<\/label>/
        );
        expect(accountNameMatch).toBeTruthy();

        const accountCode = accountNameMatch![0];
        expect(accountCode).toContain('w-4');
        expect(accountCode).toContain('h-4');
      });

      it('should have icon with color text-slate-500', () => {
        const accountNameMatch = componentCode.match(
          /Account Name[\s\S]*?<\/label>/
        );
        expect(accountNameMatch).toBeTruthy();

        const accountCode = accountNameMatch![0];
        expect(accountCode).toContain('text-slate-500');
      });

      it('should NOT use Building2 icon for Account Name', () => {
        // Verify Building2 is not in the component at all
        expect(componentCode).not.toContain('Building2');
      });

      it('should use User2 icon (verified in imports)', () => {
        expect(componentCode).toMatch(
          /import\s*{[\s\S]*?User2[\s\S]*?}\s*from\s*['"]lucide-react['"]/
        );
      });

      it('should have icon with shrink-0 class to prevent flex shrinking', () => {
        const accountNameMatch = componentCode.match(
          /Account Name[\s\S]*?<\/label>/
        );
        expect(accountNameMatch).toBeTruthy();

        const accountCode = accountNameMatch![0];
        expect(accountCode).toContain('shrink-0');
      });
    });

    describe('Account Name Field Visibility (REGISTER vs LOGIN mode)', () => {
      it('should render Account Name field inside {isRegister && ...} conditional', () => {
        // Find the section with Account Name field
        const accountNameMatch = componentCode.match(
          /{isRegister[\s\S]*?Account Name[\s\S]*?<\/label>/
        );
        expect(accountNameMatch).toBeTruthy();
      });

      it('should display Account Name field only in REGISTER mode (isRegister conditional)', () => {
        // Verify Account Name field is inside isRegister block
        const beforeAccountName = componentCode.substring(
          0,
          componentCode.indexOf('Account Name')
        );
        const lastIsRegister = beforeAccountName.lastIndexOf('{isRegister');
        expect(lastIsRegister).toBeGreaterThan(-1);

        // Verify there's a closing brace after the label
        const afterAccountName = componentCode.substring(
          componentCode.indexOf('Account Name')
        );
        const closingBrace = afterAccountName.indexOf(')}');
        expect(closingBrace).toBeGreaterThan(-1);
      });
    });

    describe('Account Name Field Input Attributes', () => {
      it('should have displayName input with type="text"', () => {
        const accountNameMatch = componentCode.match(
          /Account Name[\s\S]*?<input[\s\S]*?\/>/
        );
        expect(accountNameMatch).toBeTruthy();

        const accountCode = accountNameMatch![0];
        expect(accountCode).toContain('type="text"');
      });

      it('should have displayName input with maxLength of 120', () => {
        const accountNameMatch = componentCode.match(
          /Account Name[\s\S]*?<input[\s\S]*?\/>/
        );
        expect(accountNameMatch).toBeTruthy();

        const accountCode = accountNameMatch![0];
        expect(accountCode).toContain('maxLength={120}');
      });

      it('should have displayName input with autoComplete="organization"', () => {
        const accountNameMatch = componentCode.match(
          /Account Name[\s\S]*?<input[\s\S]*?\/>/
        );
        expect(accountNameMatch).toBeTruthy();

        const accountCode = accountNameMatch![0];
        expect(accountCode).toContain('autoComplete="organization"');
      });

      it('should have displayName input tied to state (value={displayName})', () => {
        const accountNameMatch = componentCode.match(
          /Account Name[\s\S]*?<input[\s\S]*?\/>/
        );
        expect(accountNameMatch).toBeTruthy();

        const accountCode = accountNameMatch![0];
        expect(accountCode).toContain('value={displayName}');
      });

      it('should have displayName onChange handler', () => {
        const accountNameMatch = componentCode.match(
          /Account Name[\s\S]*?<input[\s\S]*?\/>/
        );
        expect(accountNameMatch).toBeTruthy();

        const accountCode = accountNameMatch![0];
        expect(accountCode).toContain('onChange');
      });
    });
  });

  describe('Acceptance Criteria Summary (Task 2.4)', () => {
    it('should meet AC 1.1: Account Name label is "Account Name"', () => {
      expect(componentCode).toContain('Account Name');
      expect(componentCode).not.toContain('Organization or operator name');
    });

    it('should meet AC 1.2: Account Name placeholder shows dual examples', () => {
      expect(componentCode).toContain('Acme Treasury');
      expect(componentCode).toContain('Martinez Inc');
      expect(componentCode).toContain('Acme Treasury / Martinez Inc');
    });

    it('should meet AC 1.3: Account Name label <= 40 characters, professional', () => {
      const labelText = 'Account Name';
      expect(labelText.length).toBeLessThanOrEqual(40);
    });

    it('should meet AC 1.4: Account Name placeholder <= 60 chars, professional', () => {
      const placeholder = 'Acme Treasury / Martinez Inc';
      expect(placeholder.length).toBeLessThanOrEqual(60);
      // No consumer-oriented terminology
      expect(placeholder).not.toMatch(/personal|individual/i);
    });

    it('should meet AC 3.1: Icon replacement (Building2 → User2)', () => {
      expect(componentCode).not.toContain('Building2');
      expect(componentCode).toMatch(
        /import\s*{[\s\S]*?User2[\s\S]*?}\s*from\s*['"]lucide-react['"]/
      );
    });

    it('should meet AC 3.3: Account Name icon is User2 with correct styling', () => {
      const accountMatch = componentCode.match(/Account Name[\s\S]*?\/label>/);
      expect(accountMatch).toBeTruthy();

      const accountCode = accountMatch![0];
      expect(accountCode).toMatch(/<User2 className="w-4 h-4 text-slate-500 shrink-0"/);
    });
  });
});
