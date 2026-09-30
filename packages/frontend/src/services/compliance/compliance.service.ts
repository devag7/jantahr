import { del, get, put } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { ComplianceCalendar, OvertimeReport } from '@/types/compliance';

export const complianceService = {
  calendar: () => get<ComplianceCalendar>(E.compliance.calendar),
  overtime: () => get<OvertimeReport>(E.compliance.overtime),
  markFiled: (key: string, reference?: string) => put(E.compliance.filing(key), { reference }),
  unmark: (key: string) => del(E.compliance.filing(key)),
};
