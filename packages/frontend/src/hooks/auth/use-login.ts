'use client';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { authService } from '@/services/auth/auth.service';
import { useAuthStore } from '@/stores/auth/auth-store';
import type { SignupInput } from '@/types/auth';

/** Password sign-in with Supabase, then resolve the JantaHR account (which may ask for a TOTP code). */
export function useLogin() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  return useApiMutation(async (i: { email: string; password: string }) => { await authService.signIn(i.email, i.password); return bootstrap(); }, { silentError: true });
}

export function useVerifyTotp() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  return useApiMutation(async (code: string) => { await authService.verifyTotp(code); return bootstrap(); }, { silentError: true });
}

/** Supabase account first; the workspace is created now, or after the owner confirms their email. */
export function useSignup() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  return useApiMutation(async (i: SignupInput) => {
    const { needsConfirmation } = await authService.signUp(i);
    return needsConfirmation ? ('confirm-email' as const) : bootstrap();
  }, { silentError: true });
}

export const useForgotPassword = () => useApiMutation((email: string) => authService.sendPasswordReset(email), { silentError: true });
export const useMagicLink = () => useApiMutation((email: string) => authService.sendMagicLink(email), { silentError: true });
export const useSetPassword = () => {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  return useApiMutation(async (password: string) => { await authService.setPassword(password); return bootstrap(); }, { silentError: true });
};
export const useChangePassword = () => useApiMutation((v: { current: string; next: string }) => authService.changePassword(v.current, v.next), { silentError: true });
