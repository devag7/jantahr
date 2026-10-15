'use client';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth/auth-store';

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Never retry client errors (403/404/400): only transient failures
        retry: (count, error) => count < 2 && !(axios.isAxiosError(error) && error.response && error.response.status < 500),
      },
    },
  });
}

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  React.useEffect(() => { void bootstrap(); }, [bootstrap]);
  return <>{children}</>;
}

/**
 * What the signed-in app, the sign-in pages and the careers pages need: the API cache, the Supabase session and
 * toasts. Mounted by those layouts only, so the public marketing pages do not download the session and API code.
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeClient);
  return (
    <QueryClientProvider client={client}>
      <AuthBootstrap>{children}</AuthBootstrap>
      <Toaster richColors closeButton position="top-right" />
    </QueryClientProvider>
  );
}
