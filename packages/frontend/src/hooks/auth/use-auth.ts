'use client';
import { useAuthStore } from '@/stores/auth/auth-store';
import { can } from '@/lib/permissions';
import type { Role } from '@/types/auth';

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  return { user, status, role: user?.role, isAuthenticated: status === 'authenticated', hasRole: (roles: Role[]) => can(user?.role, roles) };
}
