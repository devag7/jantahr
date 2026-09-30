export type ComplianceCategory = 'WAGES' | 'TAX' | 'PF' | 'ESI' | 'BONUS' | 'EXIT' | 'PRIVACY' | 'PT' | 'LWF';
export type ComplianceStatus = 'DONE' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';
export interface ComplianceItem {
  key: string; title: string; category: ComplianceCategory; dueDate: string; law: string; period?: string;
  status: ComplianceStatus; doneAt: string | null; reference: string | null; auto: boolean; link?: string;
}
export interface ComplianceCalendar { items: ComplianceItem[]; summary: Record<ComplianceStatus, number> }
export interface OvertimeReport { cap: number; quarterStart: string; quarterEnd: string; employees: { employee: { id: string; firstName: string; lastName: string; employeeCode: string }; hours: number; state: 'OK' | 'NEAR' | 'OVER' }[] }
