'use client';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
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

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [client] = React.useState(makeClient);
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <AuthBootstrap>{children}</AuthBootstrap>
        <Toaster richColors closeButton position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
