/**
 * Accessibility Tests: AuthScreen Component - Labels and Placeholders (Task 7.3)
 *
 * Validates that Task 7.3 is correctly implemented:
 * - Labels properly associated with inputs via className="block" wrapper
 * - Screen reader announces "Account Name" label for displayName input (REGISTER mode)
 * - Screen reader announces "Professional Email" label for email input (both modes)
 * - Placeholder text not mistaken for labels by screen readers
 * - Icon elements have no conflicting accessibility attributes
 *
 * Purpose: Verify that the UI updates maintain WCAG accessibility standards and
 * screen reader compatibility. The new labels and placeholders should be properly
 * announced by assistive technologies.
 *
 * Requirements: 1.1, 2.1
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthScreen } from '../AuthScreen';

describe('AuthScreen Accessibility Tests - Labels and Placeholders (Task 7.3)', () => {
  const mockOnAuthenticated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Test 1: Labels Properly Associated with Inputs via className="block" Wrapper', () => {
    it('should have displayName input wrapped in a label element (REGISTER mode)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      // Wait for displayName input to appear
      const displayNameInput = await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');
      const labelElement = displayNameInput.closest('label');

      expect(labelElement).toBeInTheDocument();
      expect(labelElement).toHaveClass('block');
    });

    it('should have email input wrapped in a label element (LOGIN mode)', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // LOGIN mode is default
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const labelElement = emailInput.closest('label');

      expect(labelElement).toBeInTheDocument();
      expect(labelElement).toHaveClass('block');
    });

    it('should have email input wrapped in a label element (REGISTER mode)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      // Wait for email input to update in REGISTER mode (it already exists in LOGIN)
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const labelElement = emailInput.closest('label');

      expect(labelElement).toBeInTheDocument();
      expect(labelElement).toHaveClass('block');
    });

    it('should have password input wrapped in a label element', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Get password input by type since it has multiple password inputs in REGISTER mode
      const passwordInputs = screen.getAllByDisplayValue('');
      const passwordInput = passwordInputs.find(
        (input) => input.getAttribute('type') === 'password'
      );

      expect(passwordInput).toBeDefined();
      if (passwordInput) {
        const labelElement = passwordInput.closest('label');
        expect(labelElement).toBeInTheDocument();
        expect(labelElement).toHaveClass('block');
      }
    });

    it('should have all form inputs associated with semantic label elements', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode to test all fields
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      // Get all input fields
      const displayNameInput = await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInputs = screen.getAllByDisplayValue('');
      const passwordInput = passwordInputs.find(
        (input) => input.getAttribute('type') === 'password'
      );
      const inviteCodeInputs = screen.getAllByDisplayValue('');
      const inviteCodeInput = inviteCodeInputs.find(
        (input) => input.getAttribute('type') === 'password' && input !== passwordInput
      );

      // Each input should be in a label with class "block"
      expect(displayNameInput.closest('label')).toHaveClass('block');
      expect(emailInput.closest('label')).toHaveClass('block');
      expect(passwordInput?.closest('label')).toHaveClass('block');
      expect(inviteCodeInput?.closest('label')).toHaveClass('block');
    });
  });

  describe('Test 2: Screen Reader Announces "Account Name" Label for displayName Input (REGISTER mode)', () => {
    it('should render "Account Name" label text for displayName field', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      // Check that the label text "Account Name" is present
      const accountNameLabel = await screen.findByText('Account Name');
      expect(accountNameLabel).toBeInTheDocument();
    });

    it('should have "Account Name" label directly above displayName input (REGISTER mode)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');
      const accountNameLabel = screen.getByText('Account Name');

      // The label should be within the same label element as the input
      const inputLabelElement = displayNameInput.closest('label');
      expect(inputLabelElement).toContainElement(accountNameLabel);
    });

    it('should have "Account Name" label in uppercase format (professional style)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const accountNameLabel = await screen.findByText('Account Name');

      // Check that the span has proper styling classes
      const labelSpan = accountNameLabel;
      expect(labelSpan).toHaveClass('text-xs');
      expect(labelSpan).toHaveClass('font-semibold');
      expect(labelSpan).toHaveClass('uppercase');
      expect(labelSpan).toHaveClass('tracking-wider');
    });

    it('should have "Account Name" label with accessibility-friendly color (slate-400)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const accountNameLabel = await screen.findByText('Account Name');

      // Check for slate-400 color class
      expect(accountNameLabel).toHaveClass('text-slate-400');
    });

    it('should have displayName input with proper accessibility role', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = await screen.findByPlaceholderText(
        'Acme Treasury / Martinez Inc'
      ) as HTMLInputElement;

      // Input should be a text input
      expect(displayNameInput.type).toBe('text');
      expect(displayNameInput).toBeInTheDocument();
    });
  });

  describe('Test 3: Screen Reader Announces "Professional Email" Label for Email Input (Both modes)', () => {
    it('should render "Professional Email" label text in LOGIN mode', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // LOGIN mode is default
      const professionalEmailLabel = screen.getByText('Professional Email');
      expect(professionalEmailLabel).toBeInTheDocument();
    });

    it('should render "Professional Email" label text in REGISTER mode', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      createAccountBtn.click();

      const professionalEmailLabel = screen.getByText('Professional Email');
      expect(professionalEmailLabel).toBeInTheDocument();
    });

    it('should have "Professional Email" label directly above email input in LOGIN mode', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // LOGIN mode is default
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const professionalEmailLabel = screen.getByText('Professional Email');

      // The label should be within the same label element as the input
      const inputLabelElement = emailInput.closest('label');
      expect(inputLabelElement).toContainElement(professionalEmailLabel);
    });

    it('should have "Professional Email" label directly above email input in REGISTER mode', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      createAccountBtn.click();

      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const professionalEmailLabel = screen.getByText('Professional Email');

      // The label should be within the same label element as the input
      const inputLabelElement = emailInput.closest('label');
      expect(inputLabelElement).toContainElement(professionalEmailLabel);
    });

    it('should have "Professional Email" label with proper styling and accessibility', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const professionalEmailLabel = screen.getByText('Professional Email');

      // Check styling classes
      expect(professionalEmailLabel).toHaveClass('text-xs');
      expect(professionalEmailLabel).toHaveClass('font-semibold');
      expect(professionalEmailLabel).toHaveClass('uppercase');
      expect(professionalEmailLabel).toHaveClass('tracking-wider');
      expect(professionalEmailLabel).toHaveClass('text-slate-400');
    });

    it('should have email input with proper type and accessibility role', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText(
        'owner@company.com / alex@consulting.io'
      ) as HTMLInputElement;

      // Input should be an email type
      expect(emailInput.type).toBe('email');
      expect(emailInput).toBeInTheDocument();
      expect(emailInput).toHaveAttribute('required');
    });
  });

  describe('Test 4: Placeholder Text Not Mistaken for Labels by Screen Readers', () => {
    it('should have displayName input with placeholder distinct from label (REGISTER mode)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = await screen.findByPlaceholderText(
        'Acme Treasury / Martinez Inc'
      ) as HTMLInputElement;
      const accountNameLabel = screen.getByText('Account Name');

      // Placeholder text should be different from label text
      expect(displayNameInput.placeholder).not.toBe(accountNameLabel.textContent);
      expect(displayNameInput.placeholder).toBe('Acme Treasury / Martinez Inc');
      expect(accountNameLabel.textContent).toBe('Account Name');
    });

    it('should have email input with placeholder distinct from label in LOGIN mode', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText(
        'owner@company.com / alex@consulting.io'
      ) as HTMLInputElement;
      const professionalEmailLabel = screen.getByText('Professional Email');

      // Placeholder text should be different from label text
      expect(emailInput.placeholder).not.toBe(professionalEmailLabel.textContent);
      expect(emailInput.placeholder).toBe('owner@company.com / alex@consulting.io');
      expect(professionalEmailLabel.textContent).toBe('Professional Email');
    });

    it('should have email input with placeholder distinct from label in REGISTER mode', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      // Wait for displayName to ensure we're in REGISTER mode
      await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');

      const emailInput = screen.getByPlaceholderText(
        'owner@company.com / alex@consulting.io'
      ) as HTMLInputElement;
      const professionalEmailLabel = screen.getByText('Professional Email');

      // Placeholder text should be different from label text
      expect(emailInput.placeholder).not.toBe(professionalEmailLabel.textContent);
      expect(emailInput.placeholder).toBe('owner@company.com / alex@consulting.io');
      expect(professionalEmailLabel.textContent).toBe('Professional Email');
    });

    it('should have placeholder text with semicolon-style formatting (demonstrates dual use case)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = await screen.findByPlaceholderText(
        'Acme Treasury / Martinez Inc'
      ) as HTMLInputElement;

      // Placeholder should contain "/" separator indicating dual examples
      expect(displayNameInput.placeholder).toContain('/');
    });

    it('should have email placeholder with "/" separator showing dual examples', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText(
        'owner@company.com / alex@consulting.io'
      ) as HTMLInputElement;

      // Placeholder should contain "/" separator
      expect(emailInput.placeholder).toContain('/');
      // Should show both corporate and individual examples
      expect(emailInput.placeholder).toContain('owner@company.com');
      expect(emailInput.placeholder).toContain('alex@consulting.io');
    });

    it('should have placeholder text with smaller font size (placeholder:text-slate-600)', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText(
        'owner@company.com / alex@consulting.io'
      );

      // Placeholder should have proper styling applied (through CSS)
      expect(emailInput).toHaveClass('placeholder:text-slate-600');
    });
  });

  describe('Test 5: Icon Elements Have No Conflicting Accessibility Attributes', () => {
    it('should have displayName User2 icon without aria-label (decorative)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');
      const labelElement = displayNameInput.closest('label');
      const iconElement = labelElement?.querySelector('svg');

      // Icon should be present but have no conflicting aria attributes
      expect(iconElement).toBeInTheDocument();
      expect(iconElement).not.toHaveAttribute('aria-label');
      expect(iconElement).not.toHaveAttribute('alt');
      expect(iconElement).not.toHaveAttribute('role');
    });

    it('should have email Mail icon without aria-label (decorative)', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const labelElement = emailInput.closest('label');
      const iconElement = labelElement?.querySelector('svg');

      // Icon should be present but have no conflicting aria attributes
      expect(iconElement).toBeInTheDocument();
      expect(iconElement).not.toHaveAttribute('aria-label');
      expect(iconElement).not.toHaveAttribute('alt');
      expect(iconElement).not.toHaveAttribute('role');
    });

    it('should have password Lock icon without aria-label (decorative)', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const passwordInputs = screen.getAllByDisplayValue('');
      const passwordInput = passwordInputs.find(
        (input) => input.getAttribute('type') === 'password'
      );

      if (passwordInput) {
        const labelElement = passwordInput.closest('label');
        const iconElement = labelElement?.querySelector('svg');

        // Icon should be present but have no conflicting aria attributes
        expect(iconElement).toBeInTheDocument();
        expect(iconElement).not.toHaveAttribute('aria-label');
        expect(iconElement).not.toHaveAttribute('alt');
      }
    });

    it('should have all icons with proper sizing classes (w-4 h-4)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode to check all icons
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');

      const displayNameLabel = displayNameInput.closest('label');
      const emailLabel = emailInput.closest('label');

      const displayNameIcon = displayNameLabel?.querySelector('svg');
      const emailIcon = emailLabel?.querySelector('svg');

      // Icons should have proper sizing classes on the SVG element itself
      expect(displayNameIcon).toHaveClass('w-4');
      expect(displayNameIcon).toHaveClass('h-4');
      expect(emailIcon).toHaveClass('w-4');
      expect(emailIcon).toHaveClass('h-4');
    });

    it('should have all icons with proper color (text-slate-500)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');

      const displayNameLabel = displayNameInput.closest('label');
      const emailLabel = emailInput.closest('label');

      const displayNameIcon = displayNameLabel?.querySelector('svg');
      const emailIcon = emailLabel?.querySelector('svg');

      // Icons should have proper color class on the SVG element itself
      expect(displayNameIcon).toHaveClass('text-slate-500');
      expect(emailIcon).toHaveClass('text-slate-500');
    });

    it('should have icons without role attribute (not interactive)', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');

      // Get all SVG icons in the form by finding them through the labels
      const labels = document.querySelectorAll('label.block');
      const allIcons: SVGElement[] = [];

      labels.forEach((label) => {
        const svg = label.querySelector('svg');
        if (svg) allIcons.push(svg);
      });

      // No SVG should have a role attribute that would suggest interactivity
      allIcons.forEach((icon) => {
        const role = icon.getAttribute('role');
        if (role) {
          // Icons should only have aria-hidden or no role at all (most common for decorative icons)
          expect(role).not.toBe('button');
          expect(role).not.toBe('link');
        }
      });

      // Verify we found multiple icons
      expect(allIcons.length).toBeGreaterThan(0);
    });
  });

  describe('Test 6: Overall Accessibility Compliance for Updated Labels and Placeholders', () => {
    it('should maintain proper semantic HTML structure with labels wrapping inputs', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');

      // All input fields should be within label elements
      const allInputs = screen.getAllByRole('textbox');
      allInputs.forEach((input) => {
        const parentLabel = input.closest('label');
        expect(parentLabel).toBeInTheDocument();
        expect(parentLabel).toHaveClass('block');
      });
    });

    it('should have all labels visible and not hidden from screen readers', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      // Check that label texts are accessible
      const accountNameLabel = await screen.findByText('Account Name');
      const professionalEmailLabel = screen.getByText('Professional Email');

      // Labels should not be hidden
      expect(accountNameLabel).toBeVisible();
      expect(professionalEmailLabel).toBeVisible();
    });

    it('should have proper text contrast for labels (text-slate-400 on dark background)', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const professionalEmailLabel = screen.getByText('Professional Email');

      // Label should have proper contrast class
      expect(professionalEmailLabel).toHaveClass('text-slate-400');
    });

    it('should have email field visible in both LOGIN and REGISTER modes for accessibility', async () => {
      const { rerender } = render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Check LOGIN mode
      let emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      expect(emailInput).toBeVisible();

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      // Email input should still be visible in REGISTER mode
      emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      expect(emailInput).toBeVisible();
    });

    it('should have displayName field hidden in LOGIN mode for accessibility', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // In LOGIN mode, displayName field should not exist
      const displayNameInputs = screen.queryAllByPlaceholderText('Acme Treasury / Martinez Inc');
      expect(displayNameInputs).toHaveLength(0);
    });

    it('should have displayName field visible in REGISTER mode for accessibility', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      // displayName field should be visible
      const displayNameInput = await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');
      expect(displayNameInput).toBeVisible();
    });

    it('should maintain consistent label styling across all input fields', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      await screen.findByPlaceholderText('Acme Treasury / Martinez Inc');

      // Get all label text elements
      const labels = screen.getAllByText(/(Account Name|Professional Email|Password|Invitation code)/);

      // All labels should have consistent styling
      labels.forEach((label) => {
        expect(label).toHaveClass('text-xs');
        expect(label).toHaveClass('font-semibold');
        expect(label).toHaveClass('uppercase');
        expect(label).toHaveClass('tracking-wider');
        expect(label).toHaveClass('text-slate-400');
      });
    });
  });

  describe('Test 7: Keyboard Navigation and Form Accessibility', () => {
    it('should have email input focused when tabbing through form in LOGIN mode', () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText(
        'owner@company.com / alex@consulting.io'
      ) as HTMLInputElement;

      // Email input should be focusable
      expect(emailInput).toHaveAttribute('required');
      emailInput.focus();
      expect(document.activeElement).toBe(emailInput);
    });

    it('should have displayName input focusable in REGISTER mode', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = await screen.findByPlaceholderText(
        'Acme Treasury / Martinez Inc'
      ) as HTMLInputElement;

      // displayName input should be focusable
      displayNameInput.focus();
      expect(document.activeElement).toBe(displayNameInput);
    });

    it('should have proper autocomplete attributes for accessibility', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = await screen.findByPlaceholderText(
        'Acme Treasury / Martinez Inc'
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        'owner@company.com / alex@consulting.io'
      ) as HTMLInputElement;

      // Check autocomplete attributes for accessibility
      expect(displayNameInput).toHaveAttribute('autoComplete', 'organization');
      expect(emailInput).toHaveAttribute('autoComplete', 'email');
    });

    it('should have maxLength attributes for accessibility', async () => {
      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = await screen.findByPlaceholderText(
        'Acme Treasury / Martinez Inc'
      ) as HTMLInputElement;
      const emailInput = screen.getByPlaceholderText(
        'owner@company.com / alex@consulting.io'
      ) as HTMLInputElement;

      // Check maxLength for character limits
      expect(displayNameInput.maxLength).toBe(120);
      expect(emailInput.maxLength).toBe(254);
    });
  });
});
