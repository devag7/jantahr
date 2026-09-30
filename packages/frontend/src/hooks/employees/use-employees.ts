'use client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { employeesService } from '@/services/employees/employees.service';
import type { EmployeeFilters, EmployeeInput, EmployeeStatus } from '@/types/employees';

export const employeeKeys = { all: ['employees'] as const, list: (f: EmployeeFilters) => ['employees', 'list', f] as const, one: (id: string) => ['employees', 'one', id] as const };

export const useEmployees = (f: EmployeeFilters) => useQuery({ queryKey: employeeKeys.list(f), queryFn: () => employeesService.list(f), placeholderData: keepPreviousData });
export const useEmployee = (id: string) => useQuery({ queryKey: employeeKeys.one(id), queryFn: () => employeesService.one(id), enabled: !!id });
export const useMyProfile = () => useQuery({ queryKey: ['employees', 'me'], queryFn: employeesService.me });
export const useDirectory = (search?: string, departmentId?: string) => useQuery({ queryKey: ['employees', 'directory', search, departmentId], queryFn: () => employeesService.directory(search, departmentId), placeholderData: keepPreviousData });
export const useOrgChart = () => useQuery({ queryKey: ['employees', 'org-chart'], queryFn: employeesService.orgChart });
export const useEmployeeDocuments = (id: string) => useQuery({ queryKey: ['employees', 'docs', id], queryFn: () => employeesService.documents(id), enabled: !!id });

export const useCreateEmployee = () => useApiMutation((d: EmployeeInput) => employeesService.create(d), { invalidate: [employeeKeys.all, ['lifecycle'], ['reports']] });
export const useUpdateEmployee = (id: string) => useApiMutation((d: Partial<EmployeeInput>) => employeesService.update(id, d), { invalidate: [employeeKeys.all], success: 'Employee updated' });
export const useUpdateMyProfile = () => useApiMutation((d: Parameters<typeof employeesService.updateMe>[0]) => employeesService.updateMe(d), { invalidate: [['employees', 'me']], success: 'Profile updated' });
export const useSetEmployeeStatus = (id: string) => useApiMutation((s: EmployeeStatus) => employeesService.setStatus(id, s), { invalidate: [employeeKeys.all], success: 'Status updated' });
export const useResetEmployeePassword = (id: string) => useApiMutation(() => employeesService.resetPassword(id));
export const useImportEmployees = () => useApiMutation((csv: string) => employeesService.importCsv(csv), { invalidate: [employeeKeys.all, ['org']] });
export const useAddDocument = (id: string) => useApiMutation((f: FormData) => employeesService.addDocument(id, f), { invalidate: [['employees', 'docs', id]], success: 'Document uploaded' });
export const useRemoveDocument = (id: string) => useApiMutation((docId: string) => employeesService.removeDocument(docId), { invalidate: [['employees', 'docs', id]], success: 'Document removed' });
export const useVerifyDocument = (id: string) => useApiMutation((docId: string) => employeesService.verifyDocument(docId), { invalidate: [['employees', 'docs', id]], success: 'Document verified' });
