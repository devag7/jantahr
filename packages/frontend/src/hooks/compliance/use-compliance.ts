'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { complianceService } from '@/services/compliance/compliance.service';

const C = [['compliance']] as const;
export const useComplianceCalendar = () => useQuery({ queryKey: ['compliance', 'calendar'], queryFn: complianceService.calendar });
export const useOvertimeReport = () => useQuery({ queryKey: ['compliance', 'overtime'], queryFn: complianceService.overtime });
export const useMarkFiled = () => useApiMutation((v: { key: string; reference?: string }) => complianceService.markFiled(v.key, v.reference), { invalidate: [...C], success: 'Marked as filed' });
export const useUnmarkFiled = () => useApiMutation((key: string) => complianceService.unmark(key), { invalidate: [...C], success: 'Marked as pending' });
