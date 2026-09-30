import { get } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { RuntimeConfig } from '@/types/billing';

export interface RealtimeGrant { enabled: boolean; url?: string; publishableKey?: string; topic?: string; event?: string }

export const metaService = {
  runtime: () => get<RuntimeConfig>(E.meta.runtime),
  realtime: () => get<RealtimeGrant>(E.meta.realtime),
};
