'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { orgService } from '@/services/org/org.service';
import type { CompanyProfile, HolidayList } from '@/types/org';

export const useDepartments = () => useQuery({ queryKey: ['org', 'departments'], queryFn: orgService.departments, staleTime: 60_000 });
export const useDesignations = () => useQuery({ queryKey: ['org', 'designations'], queryFn: orgService.designations, staleTime: 60_000 });
export const useCompany = () => useQuery({ queryKey: ['org', 'company'], queryFn: orgService.company, staleTime: 60_000 });
export const useStates = () => useQuery({ queryKey: ['org', 'states'], queryFn: orgService.states, staleTime: Infinity });
export const useHolidayCalendar = (year: number) => useQuery({ queryKey: ['org', 'holiday-calendar', year], queryFn: () => orgService.holidayCalendar(year) });
export const useHolidayLists = (year?: number) => useQuery({ queryKey: ['org', 'holiday-lists', year], queryFn: () => orgService.holidayLists(year) });

const inv = [['org']] as const;
export const useCreateDepartment = () => useApiMutation(orgService.createDepartment, { invalidate: [...inv], success: 'Department created' });
export const useDeleteDepartment = () => useApiMutation(orgService.deleteDepartment, { invalidate: [...inv], success: 'Department deleted' });
export const useCreateDesignation = () => useApiMutation(orgService.createDesignation, { invalidate: [...inv], success: 'Designation created' });
export const useDeleteDesignation = () => useApiMutation(orgService.deleteDesignation, { invalidate: [...inv], success: 'Designation deleted' });
export const useUpdateCompany = () => useApiMutation((d: Partial<CompanyProfile>) => orgService.updateCompany(d), { invalidate: [...inv], success: 'Company settings saved' });
export const useCreateHolidayList = () => useApiMutation((d: Parameters<typeof orgService.createHolidayList>[0]) => orgService.createHolidayList(d), { invalidate: [...inv], success: 'Holiday list created' });
export const useUpdateHolidayList = () => useApiMutation((v: { id: string; data: Partial<HolidayList> }) => orgService.updateHolidayList(v.id, v.data), { invalidate: [...inv], success: 'Holiday list saved' });
export const useDeleteHolidayList = () => useApiMutation(orgService.deleteHolidayList, { invalidate: [...inv], success: 'Holiday list deleted' });
