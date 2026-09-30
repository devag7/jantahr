export interface Department { id: string; name: string; parentDepartmentId: string | null; headId: string | null; employeeCount: number }
export interface Designation { id: string; name: string; description: string | null; employeeCount: number }
export interface CompanyProfile {
  id: string; name: string; legalName: string; registrationNumber: string | null; pan: string | null; tan: string | null; pfNumber: string | null; esiNumber: string | null;
  ptRegistration: string | null; gstin: string | null; address: string | null; city: string | null; state: string | null; pincode: string | null; phone: string | null; email: string | null;
  website: string | null; pfEnabled: boolean; esiEnabled: boolean; ptEnabled: boolean; lwfEnabled: boolean; isMetroCity: boolean; weeklyOffDays: number[];
}
export interface HolidayItem { id?: string; name: string; date: string; isOptional: boolean }
export interface HolidayList { id: string; name: string; year: number; state: string | null; isDefault: boolean; holidays: HolidayItem[] }
export interface CalendarHoliday { date: string; name: string; isOptional: boolean }
