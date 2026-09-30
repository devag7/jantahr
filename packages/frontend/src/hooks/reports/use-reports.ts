'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { reportsService } from '@/services/reports/reports.service';
import type { CustomReportInput } from '@/types/reports';

export const useAdminDashboard = (enabled = true) => useQuery({ queryKey: ['reports', 'admin'], queryFn: reportsService.adminDashboard, enabled });
export const useManagerDashboard = (enabled = true) => useQuery({ queryKey: ['reports', 'manager'], queryFn: reportsService.managerDashboard, enabled });
export const useEssDashboard = () => useQuery({ queryKey: ['reports', 'ess'], queryFn: reportsService.essDashboard });
export const useMisCatalog = () => useQuery({ queryKey: ['reports', 'mis-catalog'], queryFn: reportsService.misCatalog, staleTime: Infinity });
export const useMisReport = (key: string | null, params: Record<string, string | undefined>) => useQuery({ queryKey: ['reports', 'mis', key, params], queryFn: () => reportsService.runMis(key!, params), enabled: !!key });
export const useCustomCatalog = () => useQuery({ queryKey: ['reports', 'custom-catalog'], queryFn: reportsService.customCatalog, staleTime: Infinity });
export const useRunCustomReport = () => useApiMutation((d: CustomReportInput) => reportsService.runCustom(d));
