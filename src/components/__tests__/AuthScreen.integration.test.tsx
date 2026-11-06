/**
 * Integration Tests: AuthScreen Component - Login/Register Flows with Unchanged Payload (Task 4.4)
 *
 * Validates that Task 4.4 is correctly implemented:
 * - Registration flow with new label/placeholder sends unchanged payload structure
 * - Login flow with new label/placeholder sends unchanged payload structure
 * - Backend response structure processed identically as before
 * - displayName value "Acme Treasury / Martinez Inc" (contains "/") sent and stored unchanged
 * - email value with various domains (e.g., @consulting.io) sent and stored unchanged
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthScreen, AuthenticatedUser } from '../AuthScreen';

// Mock fetch API
global.fetch = jest.fn();

describe('AuthScreen Integration Tests - Unchanged API Contract (Task 4.4)', () => {
  const mockOnAuthenticated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  const getSubmitButton = (isRegister: boolean) => {
    const buttons = screen.getAllByRole('button');
    return buttons.find(btn => {
      if (isRegister) {
        return btn.textContent?.includes('Create secure account');
      } else {
        return btn.textContent?.includes('Sign in') && btn.getAttribute('type') === 'submit';
      }
    });
  };

  describe('Test 1: Registration Flow with New Label/Placeholder Sends Unchanged Payload Structure', () => {
    it('should send registration request with unchanged payload structure: { email, password, displayName, inviteCode? }', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-123',
        email: 'john@company.com',
        displayName: 'Acme Treasury',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      // Fill in the form
      const displayNameInput = screen.getByPlaceholderText('Acme Treasury / Martinez Inc');
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getAllByPlaceholderText(/password|At least 12 characters/i)[0];
      const inviteCodeInput = screen.getByPlaceholderText('Required on managed deployments');

      await userEvent.type(displayNameInput, 'Acme Treasury');
      await userEvent.type(emailInput, 'john@company.com');
      await userEvent.type(passwordInput, 'SecurePassword123!');
      await userEvent.type(inviteCodeInput, 'INVITE-CODE-123');

      const submitBtn = getSubmitButton(true);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/register',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              email: 'john@company.com',
              password: 'SecurePassword123!',
              displayName: 'Acme Treasury',
              inviteCode: 'INVITE-CODE-123',
            }),
          })
        );
      });
    });

    it('should send registration request with optional inviteCode omitted when empty', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-456',
        email: 'alice@consulting.io',
        displayName: 'Martinez Inc',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      // Fill in the form WITHOUT inviteCode
      const displayNameInput = screen.getByPlaceholderText('Acme Treasury / Martinez Inc');
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getAllByPlaceholderText(/password|At least 12 characters/i)[0];

      await userEvent.type(displayNameInput, 'Martinez Inc');
      await userEvent.type(emailInput, 'alice@consulting.io');
      await userEvent.type(passwordInput, 'AnotherSecurePass456!');

      const submitBtn = getSubmitButton(true);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(callBody).toEqual({
          email: 'alice@consulting.io',
          password: 'AnotherSecurePass456!',
          displayName: 'Martinez Inc',
          inviteCode: undefined,
        });
      });
    });
  });

  describe('Test 2: Login Flow with New Label/Placeholder Sends Unchanged Payload Structure', () => {
    it('should send login request with unchanged payload structure: { email, password }', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-789',
        email: 'owner@company.com',
        displayName: null,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // LOGIN mode is default
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getByPlaceholderText('Your password');

      await userEvent.type(emailInput, 'owner@company.com');
      await userEvent.type(passwordInput, 'LoginPassword789!');

      const submitBtn = getSubmitButton(false);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/auth/login',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
              email: 'owner@company.com',
              password: 'LoginPassword789!',
            }),
          })
        );
      });

      // Verify NO displayName or inviteCode in login payload
      const callBody = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body
      );
      expect(callBody).not.toHaveProperty('displayName');
      expect(callBody).not.toHaveProperty('inviteCode');
      expect(Object.keys(callBody)).toEqual(['email', 'password']);
    });

    it('should send login request for independent professional with @consulting.io domain', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-independent',
        email: 'alex@consulting.io',
        displayName: null,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // LOGIN mode is default
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getByPlaceholderText('Your password');

      await userEvent.type(emailInput, 'alex@consulting.io');
      await userEvent.type(passwordInput, 'ConsultingPass123!');

      const submitBtn = getSubmitButton(false);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(callBody).toEqual({
          email: 'alex@consulting.io',
          password: 'ConsultingPass123!',
        });
      });
    });
  });

  describe('Test 3: Backend Response Structure Processed Identically as Before', () => {
    it('should process response with user object structure { id, email, displayName }', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-response-test',
        email: 'test@company.com',
        displayName: 'Test Treasury',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getByPlaceholderText('Your password');

      await userEvent.type(emailInput, 'test@company.com');
      await userEvent.type(passwordInput, 'TestPass123!');

      const submitBtn = getSubmitButton(false);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockOnAuthenticated).toHaveBeenCalledWith(mockUser);
        expect(mockOnAuthenticated).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'user-response-test',
            email: 'test@company.com',
            displayName: 'Test Treasury',
          })
        );
      });
    });

    it('should update user state after successful response', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-state-update',
        email: 'state@example.com',
        displayName: 'State Update User',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getByPlaceholderText('Your password');

      await userEvent.type(emailInput, 'state@example.com');
      await userEvent.type(passwordInput, 'StatePass123!');

      const submitBtn = getSubmitButton(false);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockOnAuthenticated).toHaveBeenCalledTimes(1);
        expect(mockOnAuthenticated.mock.calls[0][0]).toEqual(mockUser);
      });
    });

    it('should handle response with null displayName', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-null-display',
        email: 'nodisplay@company.com',
        displayName: null,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getByPlaceholderText('Your password');

      await userEvent.type(emailInput, 'nodisplay@company.com');
      await userEvent.type(passwordInput, 'NullDisplayPass123!');

      const submitBtn = getSubmitButton(false);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockOnAuthenticated).toHaveBeenCalledWith(
          expect.objectContaining({
            displayName: null,
          })
        );
      });
    });
  });

  describe('Test 4: displayName Value "Acme Treasury / Martinez Inc" Sent and Stored Unchanged', () => {
    it('should send displayName with "/" character unchanged in registration payload', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-slash-display',
        email: 'slash@company.com',
        displayName: 'Acme Treasury / Martinez Inc',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = screen.getByPlaceholderText('Acme Treasury / Martinez Inc');
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getAllByPlaceholderText(/password|At least 12 characters/i)[0];

      // Explicitly type the example value with "/"
      await userEvent.type(displayNameInput, 'Acme Treasury / Martinez Inc');
      await userEvent.type(emailInput, 'slash@company.com');
      await userEvent.type(passwordInput, 'SlashPass123!');

      const submitBtn = getSubmitButton(true);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(callBody.displayName).toBe('Acme Treasury / Martinez Inc');
        expect(callBody.displayName).toContain('/');
      });
    });

    it('should receive and store displayName "Acme Treasury / Martinez Inc" in response unchanged', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-stored-slash',
        email: 'stored@company.com',
        displayName: 'Acme Treasury / Martinez Inc',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = screen.getByPlaceholderText('Acme Treasury / Martinez Inc');
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getAllByPlaceholderText(/password|At least 12 characters/i)[0];

      await userEvent.type(displayNameInput, 'Acme Treasury / Martinez Inc');
      await userEvent.type(emailInput, 'stored@company.com');
      await userEvent.type(passwordInput, 'StoredPass123!');

      const submitBtn = getSubmitButton(true);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockOnAuthenticated).toHaveBeenCalledWith(
          expect.objectContaining({
            displayName: 'Acme Treasury / Martinez Inc',
          })
        );
      });
    });

    it('should preserve displayName exactly as entered (no trimming or transformation)', async () => {
      const testDisplayName = 'Acme Treasury / Martinez Inc';
      const mockUser: AuthenticatedUser = {
        id: 'user-exact-preserve',
        email: 'exact@company.com',
        displayName: testDisplayName,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      // Switch to REGISTER mode
      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = screen.getByPlaceholderText('Acme Treasury / Martinez Inc');
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getAllByPlaceholderText(/password|At least 12 characters/i)[0];

      await userEvent.type(displayNameInput, testDisplayName);
      await userEvent.type(emailInput, 'exact@company.com');
      await userEvent.type(passwordInput, 'ExactPass123!');

      const submitBtn = getSubmitButton(true);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(callBody.displayName).toBe(testDisplayName);
        expect(callBody.displayName.length).toBe(testDisplayName.length);
      });
    });
  });

  describe('Test 5: Email Value with Various Domains Sent and Stored Unchanged', () => {
    it('should send email with @consulting.io domain unchanged in login payload', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-consulting-domain',
        email: 'alex@consulting.io',
        displayName: null,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getByPlaceholderText('Your password');

      await userEvent.type(emailInput, 'alex@consulting.io');
      await userEvent.type(passwordInput, 'ConsultingDomainPass123!');

      const submitBtn = getSubmitButton(false);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(callBody.email).toBe('alex@consulting.io');
        expect(callBody.email).toContain('@consulting.io');
      });
    });

    it('should send email with various professional domains unchanged', async () => {
      const testCases = [
        'owner@company.com',
        'user@consulting.io',
        'info@enterprise.co.uk',
        'admin@treasury.org',
        'ops@fintech.dev',
      ];

      for (const testEmail of testCases) {
        jest.clearAllMocks();

        const mockUser: AuthenticatedUser = {
          id: `user-${testEmail}`,
          email: testEmail,
          displayName: null,
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => ({ user: mockUser }),
        });

        const { unmount } = render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

        const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
        const passwordInput = screen.getByPlaceholderText('Your password');

        await userEvent.type(emailInput, testEmail);
        await userEvent.type(passwordInput, 'TestPass123!');

        const submitBtn = getSubmitButton(false);
        if (submitBtn) fireEvent.click(submitBtn);

        await waitFor(() => {
          const callBody = JSON.parse(
            (global.fetch as jest.Mock).mock.calls[0][1].body
          );
          expect(callBody.email).toBe(testEmail);
        });

        unmount();
      }
    });

    it('should receive and store email with @consulting.io domain unchanged', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-stored-consulting',
        email: 'alex@consulting.io',
        displayName: null,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getByPlaceholderText('Your password');

      await userEvent.type(emailInput, 'alex@consulting.io');
      await userEvent.type(passwordInput, 'StoredConsultingPass123!');

      const submitBtn = getSubmitButton(false);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockOnAuthenticated).toHaveBeenCalledWith(
          expect.objectContaining({
            email: 'alex@consulting.io',
          })
        );
      });
    });

    it('should preserve email exactly as entered (no normalization)', async () => {
      const testEmail = 'TestUser@Company.COM';
      const mockUser: AuthenticatedUser = {
        id: 'user-email-preserve',
        email: testEmail,
        displayName: null,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getByPlaceholderText('Your password');

      await userEvent.type(emailInput, testEmail);
      await userEvent.type(passwordInput, 'PreservePass123!');

      const submitBtn = getSubmitButton(false);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(callBody.email).toBe(testEmail);
      });
    });
  });

  describe('Acceptance Criteria Summary (Task 4.4)', () => {
    it('should meet AC 4.1: Registration payload structure { email, password, displayName, inviteCode? }', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-ac-4.1',
        email: 'ac41@company.com',
        displayName: 'AC 4.1 Test',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const createAccountBtn = screen.getByText('Create account');
      fireEvent.click(createAccountBtn);

      const displayNameInput = screen.getByPlaceholderText('Acme Treasury / Martinez Inc');
      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getAllByPlaceholderText(/password|At least 12 characters/i)[0];

      await userEvent.type(displayNameInput, 'AC 4.1 Test');
      await userEvent.type(emailInput, 'ac41@company.com');
      await userEvent.type(passwordInput, 'AC41Pass123!');

      const submitBtn = getSubmitButton(true);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(Object.keys(callBody)).toContain('email');
        expect(Object.keys(callBody)).toContain('password');
        expect(Object.keys(callBody)).toContain('displayName');
      });
    });

    it('should meet AC 4.2: Login payload structure { email, password }', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-ac-4.2',
        email: 'ac42@company.com',
        displayName: null,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getByPlaceholderText('Your password');

      await userEvent.type(emailInput, 'ac42@company.com');
      await userEvent.type(passwordInput, 'AC42Pass123!');

      const submitBtn = getSubmitButton(false);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        const callBody = JSON.parse(
          (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(Object.keys(callBody).sort()).toEqual(['email', 'password']);
      });
    });

    it('should meet AC 4.3: Response structure { user: { id, email, displayName } } processed identically', async () => {
      const mockUser: AuthenticatedUser = {
        id: 'user-ac-4.3',
        email: 'ac43@company.com',
        displayName: 'AC 4.3 Test',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user: mockUser }),
      });

      render(<AuthScreen onAuthenticated={mockOnAuthenticated} />);

      const emailInput = screen.getByPlaceholderText('owner@company.com / alex@consulting.io');
      const passwordInput = screen.getByPlaceholderText('Your password');

      await userEvent.type(emailInput, 'ac43@company.com');
      await userEvent.type(passwordInput, 'AC43Pass123!');

      const submitBtn = getSubmitButton(false);
      if (submitBtn) fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockOnAuthenticated).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'user-ac-4.3',
            email: 'ac43@company.com',
            displayName: 'AC 4.3 Test',
          })
        );
      });
    });
  });
});
