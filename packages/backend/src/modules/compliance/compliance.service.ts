import { BadRequestException, Injectable } from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { breachBoardDeadline } from '../../common/consent/consent-rules';
import { AuthUser } from '../../common/types';
import { fiscalYearStartYear, isoDate, todayIST } from '../../common/utils/dates';
import { num } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { salaryTdsLaw } from '../payroll/engine/tax-forms';
import { annualDueDates, calendarQuarter, DueItem, fnfDueDate, gratuityDueDate, monthlyDueDates, OT_QUARTER_CAP_HOURS } from './compliance-calendar';

export class MarkFiledDto {
  @IsOptional() @IsString() @MaxLength(120) reference?: string;
}

export interface CalendarItem extends DueItem {
  status: 'DONE' | 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';
  doneAt?: string | null;
  reference?: string | null;
  /** Items the app tracks itself (payroll run paid, F&F approved…) cannot be marked manually. */
  auto: boolean;
  link?: string;
}

const DAY = 86_400_000;

@Injectable()
export class ComplianceService {
  constructor(private prisma: PrismaService) {}

  async calendar(companyId: string, now = todayIST()): Promise<{ items: CalendarItem[]; summary: Record<CalendarItem['status'], number> }> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const from = new Date(now.getTime() - 45 * DAY);
    const to = new Date(now.getTime() + 60 * DAY);
    const inWindow = (d: string) => d >= isoDate(from) && d <= isoDate(to);

    // statutory monthly items for the last three wage months, annual items for this and last tax year
    const due: (DueItem & { auto: boolean; link?: string; autoDone?: Date | null })[] = [];
    for (let back = 3; back >= 0; back--) {
      const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
      const y = t.getUTCFullYear();
      const m = t.getUTCMonth() + 1;
      const fy = y - (m < 4 ? 1 : 0);
      for (const i of monthlyDueDates(y, m, { pf: company.pfEnabled, esi: company.esiEnabled, tdsForms: salaryTdsLaw(fy) })) due.push({ ...i, auto: i.category === 'WAGES', link: i.category === 'WAGES' ? '/hr/payroll' : '/hr/payroll/statutory' });
    }
    const fyNow = fiscalYearStartYear(now);
    for (const fy of [fyNow - 1, fyNow]) for (const i of annualDueDates(fy, salaryTdsLaw(fy))) due.push({ ...i, auto: false, link: '/hr/payroll/statutory' });

    // wages: done when the month's payroll run is marked paid
    const runs = await this.prisma.payrollEntry.findMany({ where: { companyId, status: 'PAID' }, select: { month: true, year: true, updatedAt: true } });
    for (const i of due) {
      if (i.category !== 'WAGES') continue;
      const [, y, m] = i.key.split('-').map(Number);
      i.autoDone = runs.find((r) => r.year === y && r.month === m)?.updatedAt ?? null;
    }

    // exits: final wages within 2 working days, gratuity within 30 days
    const seps = await this.prisma.employeeSeparation.findMany({
      where: { companyId, status: 'APPROVED', lastWorkingDate: { gte: new Date(from.getTime() - 30 * DAY), lte: to } },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } }, fnfSettlement: true },
    });
    for (const s of seps) {
      const name = `${s.employee.firstName} ${s.employee.lastName} (${s.employee.employeeCode})`;
      const settled = s.fnfSettlement?.status === 'APPROVED' ? s.fnfSettlement.processedAt ?? s.fnfSettlement.updatedAt : null;
      due.push({ key: `fnf-${s.id}`, title: `Full & final wages: ${name}`, category: 'EXIT', dueDate: isoDate(fnfDueDate(s.lastWorkingDate!, company.weeklyOffDays)), law: 'Code on Wages s.17(2): 2 working days after exit', auto: true, autoDone: settled, link: '/hr/lifecycle' });
      if (!s.fnfSettlement || num(s.fnfSettlement.gratuityAmount) > 0) {
        due.push({ key: `grat-${s.id}`, title: `Gratuity: ${name}`, category: 'EXIT', dueDate: isoDate(gratuityDueDate(s.lastWorkingDate!)), law: 'Code on Social Security: within 30 days', auto: true, autoDone: settled, link: '/hr/lifecycle' });
      }
    }

    // DPDP: open rights requests (90 days) and breach reports to the Board (72 hours)
    const [requests, breaches] = await Promise.all([
      this.prisma.privacyRequest.findMany({ where: { companyId, status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true, type: true, dueDate: true } }),
      this.prisma.dataBreach.findMany({ where: { companyId, status: { not: 'CLOSED' }, boardNotifiedAt: null }, select: { id: true, title: true, detectedAt: true } }),
    ]);
    for (const r of requests) due.push({ key: `dpr-${r.id}`, title: `Respond to ${r.type.toLowerCase()} request`, category: 'PRIVACY', dueDate: isoDate(r.dueDate), law: 'DPDP Rules r.14: 90 days', auto: true, autoDone: null, link: '/hr/privacy' });
    for (const b of breaches) due.push({ key: `dpb-${b.id}`, title: `Report breach to Data Protection Board: ${b.title}`, category: 'PRIVACY', dueDate: isoDate(breachBoardDeadline(b.detectedAt)), law: 'DPDP Rules r.7: 72 hours', auto: true, autoDone: null, link: '/hr/privacy' });

    const filings = await this.prisma.complianceFiling.findMany({ where: { companyId } });
    const byKey = new Map(filings.map((f) => [f.key, f]));
    const today = isoDate(now);
    const soon = isoDate(new Date(now.getTime() + 7 * DAY));
    const items: CalendarItem[] = due
      .filter((i) => inWindow(i.dueDate) || (!i.autoDone && !byKey.has(i.key) && i.dueDate < today && i.dueDate >= isoDate(new Date(now.getTime() - 120 * DAY))))
      .map(({ autoDone, ...i }) => {
        const f = byKey.get(i.key);
        const doneAt = autoDone ?? f?.filedAt ?? null;
        const status: CalendarItem['status'] = doneAt ? 'DONE' : i.dueDate < today ? 'OVERDUE' : i.dueDate <= soon ? 'DUE_SOON' : 'UPCOMING';
        return { ...i, status, doneAt: doneAt ? doneAt.toISOString() : null, reference: f?.reference ?? null };
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const summary = { DONE: 0, OVERDUE: 0, DUE_SOON: 0, UPCOMING: 0 };
    for (const i of items) summary[i.status]++;
    return { items, summary };
  }

  async markFiled(user: AuthUser, key: string, dto: MarkFiledDto) {
    const cat = key.split('-')[0];
    if (!['tds', 'pf', 'esi', 'tdsq1', 'tdsq2', 'tdsq3', 'tdsq4', 'cert', 'bonus'].includes(cat)) throw new BadRequestException('This item is tracked automatically and cannot be marked by hand');
    return this.prisma.complianceFiling.upsert({
      where: { companyId_key: { companyId: user.companyId, key } },
      create: { companyId: user.companyId, key, reference: dto.reference, filedById: user.userId },
      update: { reference: dto.reference, filedById: user.userId, filedAt: new Date() },
    });
  }

  async unmark(user: AuthUser, key: string) {
    await this.prisma.complianceFiling.deleteMany({ where: { companyId: user.companyId, key } });
    return { ok: true };
  }

  /** Employees approaching the OSH overtime cap (125 hours per quarter). */
  async overtime(companyId: string, now = todayIST()) {
    const q = calendarQuarter(now);
    const rows = await this.prisma.attendance.groupBy({ by: ['employeeId'], where: { companyId, attendanceDate: { gte: q.start, lte: q.end }, overtime: { gt: 0 } }, _sum: { overtime: true } });
    const emps = await this.prisma.employee.findMany({ where: { id: { in: rows.map((r) => r.employeeId) } }, select: { id: true, firstName: true, lastName: true, employeeCode: true } });
    const byId = new Map(emps.map((e) => [e.id, e]));
    const list = rows
      .map((r) => ({ employee: byId.get(r.employeeId)!, hours: Math.round(num(r._sum.overtime) * 10) / 10 }))
      .filter((r) => r.employee)
      .map((r) => ({ ...r, state: r.hours > OT_QUARTER_CAP_HOURS ? 'OVER' : r.hours >= OT_QUARTER_CAP_HOURS * 0.8 ? 'NEAR' : 'OK' }))
      .sort((a, b) => b.hours - a.hours);
    return { cap: OT_QUARTER_CAP_HOURS, quarterStart: isoDate(q.start), quarterEnd: isoDate(q.end), employees: list };
  }
}

