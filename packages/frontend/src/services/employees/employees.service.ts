import { del, downloadFile, get, patch, post, upload } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { Ok, Paginated } from '@/types/common';
import type { DirectoryEntry, Employee, EmployeeDocument, EmployeeFilters, EmployeeInput, EmployeeStatus, ImportResult, OrgNode } from '@/types/employees';

export const employeesService = {
  list: (f: EmployeeFilters) => get<Paginated<Employee>>(E.employees.list, f),
  directory: (search?: string, departmentId?: string) => get<DirectoryEntry[]>(E.employees.directory, { search, departmentId }),
  orgChart: () => get<OrgNode[]>(E.employees.orgChart),
  me: () => get<Employee>(E.employees.me),
  updateMe: (data: Partial<Employee>) => patch<Employee>(E.employees.me, data),
  one: (id: string) => get<Employee>(E.employees.one(id)),
  create: (data: EmployeeInput) => post<Employee>(E.employees.list, data),
  update: (id: string, data: Partial<EmployeeInput>) => patch<Employee>(E.employees.one(id), data),
  setStatus: (id: string, status: EmployeeStatus) => post<Employee>(E.employees.status(id), { status }),
  resetPassword: (id: string) => post<{ temporaryPassword: string }>(E.employees.resetPassword(id)),
  importCsv: (csv: string) => post<ImportResult>(E.employees.import, { csv }),
  documents: (id: string) => get<EmployeeDocument[]>(E.employees.documents(id)),
  addDocument: (id: string, form: FormData) => upload<EmployeeDocument>(E.employees.documents(id), form),
  removeDocument: (docId: string) => del<Ok>(E.employees.doc(docId)),
  verifyDocument: (docId: string) => post<EmployeeDocument>(E.employees.docVerify(docId)),
  downloadDocument: (docId: string, name: string) => downloadFile(E.employees.docDownload(docId), undefined, name),
};
