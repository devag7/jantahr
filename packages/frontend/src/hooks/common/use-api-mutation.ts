'use client';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { errorMessage, planError } from '@/lib/api/client';

interface Options<TData, TVars> {
  /** Query key prefixes to refetch on success. */
  invalidate?: QueryKey[];
  success?: string | ((data: TData, vars: TVars) => string | undefined);
  onSuccess?: (data: TData, vars: TVars) => void;
  /** Suppress the default error toast (caller shows inline errors). */
  silentError?: boolean;
}

/** useMutation with the app's standard behaviour: error toast, optional success toast, cache invalidation. */
export function useApiMutation<TData, TVars = void>(fn: (vars: TVars) => Promise<TData>, opts: Options<TData, TVars> = {}) {
  const qc = useQueryClient();
  return useMutation<TData, unknown, TVars>({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      opts.invalidate?.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      const msg = typeof opts.success === 'function' ? opts.success(data, vars) : opts.success;
      if (msg) toast.success(msg);
      opts.onSuccess?.(data, vars);
    },
    onError: (e) => {
      if (opts.silentError) return;
      const plan = planError(e);
      if (plan) toast.error(plan.message, { action: { label: plan.code === 'SEAT_LIMIT' ? 'Add seats' : 'See plans', onClick: () => window.location.assign('/hr/billing') } });
      else toast.error(errorMessage(e));
    },
  });
}
