'use client';
import { useQuery } from '@tanstack/react-query';
import { metaService } from '@/services/meta/meta.service';

/** Edition + optional Supabase config, served by the API so one web build works for both editions. */
export const useRuntime = () => useQuery({ queryKey: ['meta', 'runtime'], queryFn: metaService.runtime, staleTime: Infinity, retry: 1 });
