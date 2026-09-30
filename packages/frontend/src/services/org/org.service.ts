import { del, get, patch, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { CalendarHoliday, CompanyProfile, Department, Designation, HolidayList } from '@/types/org';
import type { Ok } from '@/types/common';

export const orgService = {
  departments: () => get<Department[]>(E.org.departments),
  createDepartment: (d: { name: string; parentDepartmentId?: string }) => post<Department>(E.org.departments, d),
  updateDepartment: (id: string, d: Partial<{ name: string; parentDepartmentId: string; headId: string }>) => patch<Department>(E.org.department(id), d),
  deleteDepartment: (id: string) => del<Ok>(E.org.department(id)),
  designations: () => get<Designation[]>(E.org.designations),
  createDesignation: (d: { name: string; description?: string }) => post<Designation>(E.org.designations, d),
  deleteDesignation: (id: string) => del<Ok>(E.org.designation(id)),
  company: () => get<CompanyProfile>(E.company.get),
  updateCompany: (d: Partial<CompanyProfile>) => patch<CompanyProfile>(E.company.get, d),
  states: () => get<string[]>(E.company.states),
  holidayCalendar: (year: number) => get<CalendarHoliday[]>(E.holidays.calendar, { year }),
  holidayLists: (year?: number) => get<HolidayList[]>(E.holidays.lists, { year }),
  createHolidayList: (d: Omit<HolidayList, 'id' | 'isDefault'> & { isDefault?: boolean }) => post<HolidayList>(E.holidays.lists, d),
  updateHolidayList: (id: string, d: Partial<HolidayList>) => patch<HolidayList>(E.holidays.list(id), d),
  deleteHolidayList: (id: string) => del<Ok>(E.holidays.list(id)),
};
