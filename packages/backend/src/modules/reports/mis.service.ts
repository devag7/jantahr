import { BadRequestException, Injectable } from '@nestjs/common';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuthUser, PAYROLL_ROLES } from '../../common/types';
import { toCsv } from '../../common/utils/csv';
import { addDays, fiscalYearLabel, fiscalYearRange, fiscalYearStartYear, isoDate, monthRange, todayIST, toDateOnly } from '../../common/utils/dates';
import { num, round2 } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';

type Row = Record<string, unknown>;
export interface ReportOutput { title: string; columns: string[]; rows: Row[]; summary?: Record<string, unknown> }
type Params = Record<string, string | undefined>;

const yearsFrom = (d: Date, to: Date) => (to.getTime() - d.getTime()) / (365.25 * 86400000);
const bucket = (n: number, edges: number[], labels: string[]) => labels[edges.findIndex((e) => n < e) === -1 ? labels.length - 1 : edges.findIndex((e) => n < e)];

export const MIS_CATALOG: { key: string; title: string; description: string; params: string[] }[] = [
  { key: 'employee-master', title: 'Employee master', description: 'Complete employee list with employment details', params: ['status', 'departmentId'] },
  { key: 'headcount', title: 'Headcount', description: 'Active headcount grouped by department / designation / location / type', params: ['by'] },
  { key: 'attrition', title: 'Attrition (monthly)', description: 'Exits and attrition % by month for a financial year', params: ['fy'] },
  { key: 'joiners-leavers', title: 'Joiners & leavers', description: 'Joiners and exits in a date range', params: ['from', 'to'] },
  { key: 'attendance-summary', title: 'Attendance summary', description: 'Monthly attendance per employee', params: ['year', 'month'] },
  { key: 'late-marks', title: 'Late marks & overtime', description: 'Late entries and overtime hours in a month', params: ['year', 'month'] },
  { key: 'leave-balance', title: 'Leave balance', description: 'Current leave balances for all employees', params: [] },
  { key: 'leave-utilisation', title: 'Leave utilisation', description: 'Approved leave days by type in a date range', params: ['from', 'to'] },
  { key: 'payroll-cost', title: 'Payroll cost by department', description: 'Gross, net and employer cost by department for a month', params: ['year', 'month'] },
  { key: 'ctc-analysis', title: 'CTC analysis', description: 'CTC distribution bands by department', params: [] },
  { key: 'gender-diversity', title: 'Gender diversity', description: 'Gender split by department', params: [] },
  { key: 'age-distribution', title: 'Age distribution', description: 'Active employees by age band', params: [] },
  { key: 'tenure-distribution', title: 'Tenure distribution', description: 'Active employees by years of service', params: [] },
  { key: 'expense-summary', title: 'Expense summary', description: 'Approved/reimbursed expenses by category', params: ['from', 'to'] },
  { key: 'document-expiry', title: 'Document expiry', description: 'Employee documents expiring in 60 days', params: [] },
  { key: 'celebrations', title: 'Birthdays & work anniversaries', description: 'Upcoming birthdays/anniversaries for a month', params: ['month'] },
  { key: 'recruitment-funnel', title: 'Recruitment funnel', description: 'Applicants by stage per opening', params: [] },
  { key: 'helpdesk-summary', title: 'Helpdesk summary', description: 'Tickets by category and status', params: [] },
];

@Injectable()
export class MisService {
  constructor(private prisma: PrismaService, private crypto: CryptoService) {}

  async run(user: AuthUser, key: string, p: Params): Promise<ReportOutput> {
    // reports are the r_* methods below; the key maps to one of them
    const fn = (this as unknown as Record<string, ((user: AuthUser, p: Params) => Promise<ReportOutput>) | undefined>)[`r_${key.replace(/-/g, '_')}`];
    if (!fn) throw new BadRequestException(`Unknown report "${key}"`);
    return fn.call(this, user, p);
  }

  private emps(companyId: string, where: object = {}) {
    return this.prisma.employee.findMany({
      where: { companyId, ...where }, include: { department: { select: { name: true } }, designation: { select: { name: true } }, reportingManager: { select: { firstName: true, lastName: true } } }, orderBy: { employeeCode: 'asc' },
    });
  }

  async r_employee_master(user: AuthUser, p: Params): Promise<ReportOutput> {
    const canSeePay = PAYROLL_ROLES.includes(user.role);
    const list = await this.emps(user.companyId, { ...(p.status ? { status: p.status } : {}), ...(p.departmentId ? { departmentId: p.departmentId } : {}) });
    const rows = list.map((e) => ({
      employee_code: e.employeeCode, name: [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' '), email: e.email, phone: e.phone ?? '', department: e.department?.name ?? '', designation: e.designation?.name ?? '',
      manager: e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}` : '', gender: e.gender, date_of_birth: e.dateOfBirth ? isoDate(e.dateOfBirth) : '', date_of_joining: isoDate(e.dateOfJoining),
      status: e.status, employment_type: e.employmentType ?? '', location: e.workLocation ?? e.city ?? '', pan: this.crypto.mask(this.crypto.decrypt(e.panNumber)) ?? '', uan: e.uanNumber ?? '', ...(canSeePay ? { ctc: num(e.ctc) } : {}),
    }));
    return { title: 'Employee master', columns: Object.keys(rows[0] || { employee_code: 1 }), rows, summary: { total: rows.length } };
  }

  async r_headcount(user: AuthUser, p: Params): Promise<ReportOutput> {
    const by = ['department', 'designation', 'location', 'type'].includes(p.by || '') ? p.by! : 'department';
    const list = await this.emps(user.companyId, { status: 'ACTIVE' });
    const key = (e: (typeof list)[number]) => (by === 'department' ? e.department?.name : by === 'designation' ? e.designation?.name : by === 'location' ? e.workLocation ?? e.city : e.employmentType) || 'Unassigned';
    const m = new Map<string, number>();
    list.forEach((e) => m.set(key(e), (m.get(key(e)) || 0) + 1));
    const rows = [...m.entries()].map(([k, v]) => ({ [by]: k, headcount: v, percent: round2((v / list.length) * 100) })).sort((a, b) => (b.headcount as number) - (a.headcount as number));
    return { title: `Headcount by ${by}`, columns: [by, 'headcount', 'percent'], rows, summary: { total: list.length } };
  }

  async r_attrition(user: AuthUser, p: Params): Promise<ReportOutput> {
    const fyStart = p.fy ? Number(p.fy) : fiscalYearStartYear(todayIST());
    const fy = fiscalYearRange(fyStart);
    const all = await this.prisma.employee.findMany({ where: { companyId: user.companyId }, select: { dateOfJoining: true, lastWorkingDate: true, status: true } });
    const rows: Row[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(fyStart, 3 + i, 1));
      const { start, end } = monthRange(d.getUTCFullYear(), d.getUTCMonth() + 1);
      const opening = all.filter((e) => e.dateOfJoining < start && (!e.lastWorkingDate || e.lastWorkingDate >= start)).length;
      const closing = all.filter((e) => e.dateOfJoining <= end && (!e.lastWorkingDate || e.lastWorkingDate > end)).length;
      const exits = all.filter((e) => e.status === 'LEFT' && e.lastWorkingDate && e.lastWorkingDate >= start && e.lastWorkingDate <= end).length;
      const joiners = all.filter((e) => e.dateOfJoining >= start && e.dateOfJoining <= end).length;
      const avg = (opening + closing) / 2;
      rows.push({ month: isoDate(start).slice(0, 7), opening, joiners, exits, closing, attrition_percent: avg ? round2((exits / avg) * 100) : 0 });
    }
    const totalExits = rows.reduce((s, r) => s + (r.exits as number), 0);
    return { title: `Attrition FY ${fiscalYearLabel(fyStart)}`, columns: ['month', 'opening', 'joiners', 'exits', 'closing', 'attrition_percent'], rows, summary: { totalExits, fy: fy.start } };
  }

  async r_joiners_leavers(user: AuthUser, p: Params): Promise<ReportOutput> {
    const to = p.to ? toDateOnly(p.to) : todayIST();
    const from = p.from ? toDateOnly(p.from) : addDays(to, -90);
    const list = await this.emps(user.companyId, { OR: [{ dateOfJoining: { gte: from, lte: to } }, { lastWorkingDate: { gte: from, lte: to } }] });
    const rows = list.map((e) => ({
      employee_code: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), department: e.department?.name ?? '', event: e.dateOfJoining >= from && e.dateOfJoining <= to ? 'JOINED' : 'LEFT',
      date: isoDate(e.dateOfJoining >= from && e.dateOfJoining <= to ? e.dateOfJoining : e.lastWorkingDate!),
    }));
    return { title: 'Joiners & leavers', columns: ['employee_code', 'name', 'department', 'event', 'date'], rows, summary: { joiners: rows.filter((r) => r.event === 'JOINED').length, leavers: rows.filter((r) => r.event === 'LEFT').length } };
  }

  async r_attendance_summary(user: AuthUser, p: Params): Promise<ReportOutput> {
    const t = todayIST();
    const { start, end } = monthRange(p.year ? Number(p.year) : t.getUTCFullYear(), p.month ? Number(p.month) : t.getUTCMonth() + 1);
    const emps = await this.emps(user.companyId, { status: { in: ['ACTIVE', 'LEFT'] }, dateOfJoining: { lte: end } });
    const recs = await this.prisma.attendance.findMany({ where: { companyId: user.companyId, attendanceDate: { gte: start, lte: end } } });
    const rows = emps.map((e) => {
      const r = recs.filter((x) => x.employeeId === e.id);
      const c = (s: string) => r.filter((x) => x.status === s).length;
      return { employee_code: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), department: e.department?.name ?? '', present: c('PRESENT'), wfh: c('WORK_FROM_HOME'), half_day: c('HALF_DAY'), absent: c('ABSENT'), on_leave: c('ON_LEAVE'), late_marks: r.filter((x) => x.lateEntry).length, hours: round2(r.reduce((s, x) => s + num(x.workingHours), 0)) };
    });
    return { title: `Attendance ${isoDate(start).slice(0, 7)}`, columns: ['employee_code', 'name', 'department', 'present', 'wfh', 'half_day', 'absent', 'on_leave', 'late_marks', 'hours'], rows };
  }

  async r_late_marks(user: AuthUser, p: Params): Promise<ReportOutput> {
    const t = todayIST();
    const { start, end } = monthRange(p.year ? Number(p.year) : t.getUTCFullYear(), p.month ? Number(p.month) : t.getUTCMonth() + 1);
    const recs = await this.prisma.attendance.findMany({ where: { companyId: user.companyId, attendanceDate: { gte: start, lte: end }, OR: [{ lateEntry: true }, { overtime: { gt: 0 } }] }, include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } } });
    const m = new Map<string, { code: string; name: string; late: number; ot: number }>();
    for (const r of recs) {
      const cur = m.get(r.employeeId) || { code: r.employee.employeeCode, name: `${r.employee.firstName} ${r.employee.lastName}`.trim(), late: 0, ot: 0 };
      if (r.lateEntry) cur.late++;
      cur.ot += num(r.overtime);
      m.set(r.employeeId, cur);
    }
    const rows = [...m.values()].map((v) => ({ employee_code: v.code, name: v.name, late_marks: v.late, overtime_hours: round2(v.ot) })).sort((a, b) => b.late_marks - a.late_marks);
    return { title: 'Late marks & overtime', columns: ['employee_code', 'name', 'late_marks', 'overtime_hours'], rows };
  }

  async r_leave_balance(user: AuthUser): Promise<ReportOutput> {
    const now = todayIST();
    const allocs = await this.prisma.leaveAllocation.findMany({ where: { companyId: user.companyId, fromDate: { lte: now }, toDate: { gte: now } }, include: { employee: { select: { employeeCode: true, firstName: true, lastName: true, status: true } }, leaveType: { select: { name: true } } } });
    const rows = allocs.filter((a) => a.employee.status === 'ACTIVE').map((a) => ({ employee_code: a.employee.employeeCode, name: `${a.employee.firstName} ${a.employee.lastName}`.trim(), leave_type: a.leaveType.name, allocated: num(a.totalLeavesAllocated), used: num(a.usedLeaves), balance: round2(num(a.totalLeavesAllocated) - num(a.usedLeaves)) }));
    return { title: 'Leave balance', columns: ['employee_code', 'name', 'leave_type', 'allocated', 'used', 'balance'], rows };
  }

  async r_leave_utilisation(user: AuthUser, p: Params): Promise<ReportOutput> {
    const to = p.to ? toDateOnly(p.to) : todayIST();
    const from = p.from ? toDateOnly(p.from) : new Date(Date.UTC(to.getUTCFullYear(), 0, 1));
    const apps = await this.prisma.leaveApplication.findMany({ where: { companyId: user.companyId, status: 'APPROVED', fromDate: { lte: to }, toDate: { gte: from } }, include: { leaveType: { select: { name: true } } } });
    const m = new Map<string, { days: number; count: number }>();
    apps.forEach((a) => { const c = m.get(a.leaveType.name) || { days: 0, count: 0 }; c.days += num(a.totalLeaveDays); c.count++; m.set(a.leaveType.name, c); });
    const rows = [...m.entries()].map(([k, v]) => ({ leave_type: k, applications: v.count, days: round2(v.days) }));
    return { title: 'Leave utilisation', columns: ['leave_type', 'applications', 'days'], rows };
  }

  async r_payroll_cost(user: AuthUser, p: Params): Promise<ReportOutput> {
    const t = todayIST();
    const year = p.year ? Number(p.year) : t.getUTCFullYear();
    const month = p.month ? Number(p.month) : t.getUTCMonth() + 1;
    const slips = await this.prisma.salarySlip.findMany({ where: { companyId: user.companyId, year, month, status: { in: ['GENERATED', 'APPROVED', 'PAID'] } }, include: { employee: { select: { department: { select: { name: true } } } } } });
    const m = new Map<string, { n: number; gross: number; net: number; ded: number; er: number }>();
    for (const s of slips) {
      const k = s.employee.department?.name || 'Unassigned';
      const c = m.get(k) || { n: 0, gross: 0, net: 0, ded: 0, er: 0 };
      c.n++; c.gross += num(s.grossPay); c.net += num(s.netPay); c.ded += num(s.totalDeductions);
      c.er += num(s.pfEmployerEpf) + num(s.pfEmployerEps) + num(s.pfEdli) + num(s.pfAdmin) + num(s.esiEmployer) + num(s.lwfEmployer);
      m.set(k, c);
    }
    const rows = [...m.entries()].map(([k, v]) => ({ department: k, employees: v.n, gross: Math.round(v.gross), deductions: Math.round(v.ded), net_pay: Math.round(v.net), employer_contribution: Math.round(v.er), total_cost: Math.round(v.gross + v.er) }));
    return { title: `Payroll cost ${String(month).padStart(2, '0')}/${year}`, columns: ['department', 'employees', 'gross', 'deductions', 'net_pay', 'employer_contribution', 'total_cost'], rows, summary: { totalCost: rows.reduce((s, r) => s + r.total_cost, 0) } };
  }

  async r_ctc_analysis(user: AuthUser): Promise<ReportOutput> {
    const list = await this.emps(user.companyId, { status: 'ACTIVE', ctc: { not: null } });
    const edges = [300000, 600000, 1000000, 1500000, 2500000, 4000000];
    const labels = ['< 3L', '3-6L', '6-10L', '10-15L', '15-25L', '25-40L', '40L+'];
    const m = new Map<string, Row>();
    list.forEach((e) => {
      const b = bucket(num(e.ctc), edges, labels);
      const r = m.get(b) || { band: b, employees: 0, total_ctc: 0 };
      (r.employees as number)++; (r.total_ctc as number) += num(e.ctc);
      m.set(b, r);
    });
    const rows = labels.filter((l) => m.has(l)).map((l) => ({ ...m.get(l)!, avg_ctc: Math.round((m.get(l)!.total_ctc as number) / (m.get(l)!.employees as number)) }));
    const total = list.reduce((s, e) => s + num(e.ctc), 0);
    return { title: 'CTC analysis', columns: ['band', 'employees', 'total_ctc', 'avg_ctc'], rows, summary: { totalAnnualCtc: Math.round(total), averageCtc: list.length ? Math.round(total / list.length) : 0 } };
  }

  async r_gender_diversity(user: AuthUser): Promise<ReportOutput> {
    const list = await this.emps(user.companyId, { status: 'ACTIVE' });
    const m = new Map<string, Row>();
    list.forEach((e) => {
      const k = e.department?.name || 'Unassigned';
      const r = m.get(k) || { department: k, male: 0, female: 0, other: 0, total: 0 };
      (r[e.gender.toLowerCase()] as number)++; (r.total as number)++;
      m.set(k, r);
    });
    const rows = [...m.values()].map((r) => ({ ...r, female_percent: round2(((r.female as number) / (r.total as number)) * 100) }));
    return { title: 'Gender diversity', columns: ['department', 'male', 'female', 'other', 'total', 'female_percent'], rows };
  }

  async r_age_distribution(user: AuthUser): Promise<ReportOutput> {
    const list = await this.emps(user.companyId, { status: 'ACTIVE', dateOfBirth: { not: null } });
    const labels = ['< 25', '25-30', '30-35', '35-40', '40-50', '50+'];
    const c = new Map<string, number>();
    const now = todayIST();
    list.forEach((e) => { const b = bucket(yearsFrom(e.dateOfBirth!, now), [25, 30, 35, 40, 50], labels); c.set(b, (c.get(b) || 0) + 1); });
    return { title: 'Age distribution', columns: ['age_band', 'employees'], rows: labels.map((l) => ({ age_band: l, employees: c.get(l) || 0 })) };
  }

  async r_tenure_distribution(user: AuthUser): Promise<ReportOutput> {
    const list = await this.emps(user.companyId, { status: 'ACTIVE' });
    const labels = ['< 1 yr', '1-2 yrs', '2-5 yrs', '5-10 yrs', '10+ yrs'];
    const c = new Map<string, number>();
    const now = todayIST();
    list.forEach((e) => { const b = bucket(yearsFrom(e.dateOfJoining, now), [1, 2, 5, 10], labels); c.set(b, (c.get(b) || 0) + 1); });
    return { title: 'Tenure distribution', columns: ['tenure', 'employees'], rows: labels.map((l) => ({ tenure: l, employees: c.get(l) || 0 })) };
  }

  async r_expense_summary(user: AuthUser, p: Params): Promise<ReportOutput> {
    const to = p.to ? toDateOnly(p.to) : todayIST();
    const from = p.from ? toDateOnly(p.from) : new Date(Date.UTC(to.getUTCFullYear(), 0, 1));
    const items = await this.prisma.expenseClaimItem.findMany({ where: { claim: { companyId: user.companyId, status: { in: ['APPROVED', 'REIMBURSED'] } }, expenseDate: { gte: from, lte: to } } });
    const m = new Map<string, { n: number; claimed: number; approved: number }>();
    items.forEach((i) => { const c = m.get(i.category) || { n: 0, claimed: 0, approved: 0 }; c.n++; c.claimed += num(i.amount); c.approved += num(i.approvedAmount ?? i.amount); m.set(i.category, c); });
    const rows = [...m.entries()].map(([k, v]) => ({ category: k, items: v.n, claimed: round2(v.claimed), approved: round2(v.approved) })).sort((a, b) => b.approved - a.approved);
    return { title: 'Expense summary', columns: ['category', 'items', 'claimed', 'approved'], rows };
  }

  async r_document_expiry(user: AuthUser): Promise<ReportOutput> {
    const now = todayIST();
    const docs = await this.prisma.employeeDocument.findMany({ where: { employee: { companyId: user.companyId }, expiryDate: { not: null, lte: addDays(now, 60) } }, include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } }, orderBy: { expiryDate: 'asc' } });
    const rows = docs.map((d) => ({ employee_code: d.employee.employeeCode, name: `${d.employee.firstName} ${d.employee.lastName}`.trim(), document: d.documentName, type: d.documentType, expiry_date: isoDate(d.expiryDate!), status: d.expiryDate! < now ? 'EXPIRED' : 'EXPIRING' }));
    return { title: 'Document expiry', columns: ['employee_code', 'name', 'document', 'type', 'expiry_date', 'status'], rows };
  }

  async r_celebrations(user: AuthUser, p: Params): Promise<ReportOutput> {
    const month = p.month ? Number(p.month) : todayIST().getUTCMonth() + 1;
    const list = await this.emps(user.companyId, { status: 'ACTIVE' });
    const rows: Row[] = [];
    list.forEach((e) => {
      if (e.dateOfBirth && e.dateOfBirth.getUTCMonth() + 1 === month) rows.push({ employee_code: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), event: 'Birthday', day: e.dateOfBirth.getUTCDate() });
      if (e.dateOfJoining.getUTCMonth() + 1 === month && e.dateOfJoining.getUTCFullYear() < todayIST().getUTCFullYear()) rows.push({ employee_code: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), event: `Work anniversary (${todayIST().getUTCFullYear() - e.dateOfJoining.getUTCFullYear()} yrs)`, day: e.dateOfJoining.getUTCDate() });
    });
    rows.sort((a, b) => (a.day as number) - (b.day as number));
    return { title: 'Birthdays & anniversaries', columns: ['employee_code', 'name', 'event', 'day'], rows };
  }

  async r_recruitment_funnel(user: AuthUser): Promise<ReportOutput> {
    const jobs = await this.prisma.jobOpening.findMany({ where: { companyId: user.companyId }, include: { applicants: { select: { stage: true } } } });
    const rows = jobs.map((j) => { const c = (s: string) => j.applicants.filter((a) => a.stage === s).length; return { job: j.title, status: j.status, applied: j.applicants.length, screening: c('SCREENING'), interview: c('INTERVIEW'), offer: c('OFFER'), hired: c('HIRED'), rejected: c('REJECTED') }; });
    return { title: 'Recruitment funnel', columns: ['job', 'status', 'applied', 'screening', 'interview', 'offer', 'hired', 'rejected'], rows };
  }

  async r_helpdesk_summary(user: AuthUser): Promise<ReportOutput> {
    const rows = (await this.prisma.helpdeskTicket.groupBy({ by: ['category', 'status'], where: { companyId: user.companyId }, _count: true })).map((r) => ({ category: r.category, status: r.status, tickets: r._count }));
    return { title: 'Helpdesk summary', columns: ['category', 'status', 'tickets'], rows };
  }

  toCsv(r: ReportOutput) {
    return toCsv(r.rows, r.columns);
  }
}
