import axios from 'axios';
import { create } from 'zustand';
import { setAuthProblemHandler, type AuthProblem } from '@/lib/api/client';
import { createClient, supabaseConfigured } from '@/lib/supabase/client';
import { authService } from '@/services/auth/auth.service';
import type { SessionUser } from '@/types/auth';

/**
 * - anonymous: no Supabase session
 * - mfa: signed in with Supabase, but this account has two-factor and the session is not AAL2 yet
 * - no-account: signed in with Supabase, but no JantaHR user is linked (and no pending workspace to create)
 * - authenticated: signed in and linked; `user` is the JantaHR profile
 */
type Status = 'loading' | 'anonymous' | 'mfa' | 'no-account' | 'authenticated';

interface AuthState {
  user: SessionUser | null;
  status: Status;
  /** Why the last attempt did not end in `authenticated` (shown on the sign-in page). */
  notice: string | null;
  /** Work out the state from the current Supabase session (app start, after sign-in, after a code). */
  bootstrap: () => Promise<Status>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const problemCode = (e: unknown) => (axios.isAxiosError(e) ? (e.response?.data as { code?: AuthProblem } | undefined)?.code : undefined);
const problemMessage = (e: unknown) => (axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined) ?? null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'loading',
  notice: null,
  bootstrap: async () => {
    const done = (status: Status, user: SessionUser | null = null, notice: string | null = null) => { set({ status, user, notice }); return status; };
    if (!supabaseConfigured || !(await authService.hasSession())) return done('anonymous');
    try {
      return done('authenticated', await authService.me());
    } catch (e) {
      const code = problemCode(e);
      if (code === 'MFA_REQUIRED') return done('mfa');
      if (code === 'NO_ACCOUNT') {
        // an owner who confirmed their email finishes creating the workspace they started
        const pending = await authService.pendingCompany();
        if (pending) {
          try { return done('authenticated', await authService.provision(pending)); } catch (pe) { return done('no-account', null, problemMessage(pe)); }
        }
        return done('no-account', null, problemMessage(e));
      }
      if (code === 'ACCOUNT_DISABLED' || code === 'SSO_NOT_IN_PLAN') {
        await authService.signOut();
        return done('anonymous', null, problemMessage(e));
      }
      if (code === 'SESSION_INVALID') {
        await authService.signOut();
        return done('anonymous');
      }
      throw e;
    }
  },
  refreshUser: async () => {
    try { set({ user: await authService.me() }); } catch { /* keep current */ }
  },
  logout: async () => {
    await authService.signOut().catch(() => undefined);
    set({ user: null, status: 'anonymous', notice: null });
  },
}));

// API responses that need the sign-in flow: re-derive the state (an MFA prompt, a disabled account, sign-out).
setAuthProblemHandler((code) => {
  if (useAuthStore.getState().status !== 'authenticated') return;
  if (code === 'SESSION_INVALID') void useAuthStore.getState().logout();
  else void useAuthStore.getState().bootstrap();
});

if (typeof window !== 'undefined' && supabaseConfigured) {
  createClient().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') useAuthStore.setState({ user: null, status: 'anonymous' });
  });
}
