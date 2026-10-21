'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string | null;
}

interface AuthScreenProps {
  onAuthenticated: (user: AuthenticatedUser) => void;
}

type Mode = 'LOGIN' | 'REGISTER';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<Mode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isRegister = mode === 'REGISTER';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(
        isRegister ? '/api/auth/register' : '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify(
            isRegister
              ? { email, password, displayName, inviteCode: inviteCode || undefined }
              : { email, password }
          ),
        }
      );

      const data = (await response.json().catch(() => null)) as
        | { user?: AuthenticatedUser; error?: string }
        | null;

      if (!response.ok || !data?.user) {
        setError(
          data?.error ||
            (response.status === 429
              ? 'Too many attempts. Please wait and try again.'
              : 'Unable to complete authentication.')
        );
        return;
      }

      setPassword('');
      onAuthenticated(data.user);
    } catch {
      setError('Unable to reach the authentication service. Check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-amber-500 selection:text-slate-950">
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-amber-600/10 blur-3xl" />
      <div className="absolute -bottom-48 -right-32 h-[28rem] w-[28rem] rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-gradient-to-tr from-amber-700 via-amber-600 to-yellow-500 p-3 rounded-2xl shadow-xl shadow-amber-900/40">
            <ShieldCheck className="w-8 h-8 text-slate-950" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">AgenticPay AI</h1>
          <p className="mt-1 text-sm text-slate-400">
            Enterprise escrow operations &amp; autonomous settlement control
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#16181d]/90 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="grid grid-cols-2 border-b border-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setError(null);
              }}
              className={`py-3 text-sm font-semibold transition-colors ${
                !isRegister
                  ? 'text-amber-300 border-b-2 border-amber-500 bg-amber-500/5'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setError(null);
              }}
              className={`py-3 text-sm font-semibold transition-colors ${
                isRegister
                  ? 'text-amber-300 border-b-2 border-amber-500 bg-amber-500/5'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {isRegister && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Organization or operator name
                </span>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0f1115] px-3 py-2.5 focus-within:border-amber-500/60">
                  <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    maxLength={120}
                    autoComplete="organization"
                    placeholder="Acme Treasury Operations"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Enterprise email
              </span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0f1115] px-3 py-2.5 focus-within:border-amber-500/60">
                <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  placeholder="owner@company.com"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Password
              </span>
              <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0f1115] px-3 py-2.5 focus-within:border-amber-500/60">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  minLength={isRegister ? 12 : 1}
                  maxLength={128}
                  placeholder={isRegister ? 'At least 12 characters' : 'Your password'}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
                />
              </div>
            </label>

            {isRegister && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Invitation code
                </span>
                <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-slate-700 bg-[#0f1115] px-3 py-2.5 focus-within:border-amber-500/60">
                  <KeyRound className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="password"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value)}
                    autoComplete="off"
                    maxLength={256}
                    placeholder="Required on managed deployments"
                    className="w-full bg-transparent text-sm outline-none placeholder:text-slate-600"
                  />
                </div>
              </label>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2.5 text-sm text-red-300">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-yellow-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-900/30 transition hover:from-amber-500 hover:to-yellow-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating…</span>
                </>
              ) : (
                <>
                  <span>{isRegister ? 'Create secure account' : 'Sign in'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-slate-500">
              Sessions are signed, HttpOnly, and expire after 12 hours. All
              settlement activity is recorded in the tenant-scoped audit ledger.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};
