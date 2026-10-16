import { get } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';

export interface RealtimeGrant { enabled: boolean; url?: string; publishableKey?: string; topic?: string; event?: string }

export const metaService = {
  realtime: () => get<RealtimeGrant>(E.meta.realtime),
};
