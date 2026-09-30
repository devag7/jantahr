import { inProcessJobs } from '../../common/utils/jobs-mode';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AttendanceStatus, Prisma, ApprovalStatus } from '@prisma/client';
import { AccessService } from '../../common/access/access.service';
import { AuthUser } from '../../common/types';
import { parseCsv } from '../../common/utils/csv';
import { addDays, eachDay, isoDate, istDateOf, istInstant, monthRange, todayIST, toDateOnly } from '../../common/utils/dates';
import { runExclusive } from '../../common/utils/cron-lock';
import { num, round2 } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarService } from '../calendar/calendar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { deriveAttendance } from './attendance-derive';
import { DailyQueryDto, ManualMarkDto, RegularizationDto } from './attendance.dto';
import { ShiftService } from './shift.service';
import { errorMessage } from '../../common/utils/errors';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private shifts: ShiftService,
    private calendar: CalendarService,
    private notifications: NotificationsService,
  ) {}

  // ===========================================================================
  // Processing raw punches into daily attendance
  // ===========================================================================

  async processDay(employeeId: string, date: Date, source = 'AUTO') {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!emp) return null;
    const dayStart = istInstant(date, '00:00');
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const punches = await this.prisma.employeeCheckin.findMany({ where: { employeeId, time: { gte: dayStart, lt: dayEnd } }, orderBy: { time: 'asc' } });
    if (!punches.length) return null;

    const existing = await this.prisma.attendance.findUnique({ where: { employeeId_attendanceDate: { employeeId, attendanceDate: date } } });
    // Approved leave / HR-entered records win over raw punches
    if (existing && (existing.source === 'MANUAL' || existing.leaveApplicationId)) {
      await this.prisma.employeeCheckin.updateMany({ where: { id: { in: punches.map((p) => p.id) } }, data: { processed: true } });
      return existing;
    }

    const shift = await this.shifts.shiftFor(emp.companyId, employeeId, date);
    const nw = await this.calendar.nonWorkingDays(emp.companyId, emp.state || emp.professionalTaxState, date, date);
    const d = deriveAttendance(punches.map((p) => p.time), shift && { ...shift, workingHours: num(shift.workingHours), halfDayThresholdHours: num(shift.halfDayThresholdHours) }, {
      isToday: isoDate(date) === isoDate(todayIST()), nonWorking: nw.isNonWorking(date),
    });
    if (!d) return null;
    const last = punches[punches.length - 1];
    const data = {
      status: d.status as AttendanceStatus, shiftTypeId: shift?.id ?? null, inTime: d.inTime, outTime: d.outTime, workingHours: d.workingHours, lateEntry: d.lateEntry, earlyExit: d.earlyExit,
      overtime: d.overtime || null, remarks: d.remarks, source: last.source === 'WEB' || last.source === 'MOBILE' || last.source === 'BIOMETRIC' ? last.source : source,
      inLatitude: punches[0].latitude, inLongitude: punches[0].longitude, selfieUrl: punches[0].selfieUrl,
    };
    const rec = await this.prisma.attendance.upsert({
      where: { employeeId_attendanceDate: { employeeId, attendanceDate: date } },
      create: { ...data, employeeId, companyId: emp.companyId, attendanceDate: date }, update: data,
    });
    await this.prisma.employeeCheckin.updateMany({ where: { id: { in: punches.map((p) => p.id) } }, data: { processed: true } });
    return rec;
  }

  async processRange(companyId: string, from: Date, to: Date, employeeIds?: string[]) {
    const dayStart = istInstant(from, '00:00');
    const dayEnd = new Date(istInstant(to, '00:00').getTime() + 86400000);
    const rows = await this.prisma.employeeCheckin.findMany({
      where: { companyId, time: { gte: dayStart, lt: dayEnd }, ...(employeeIds ? { employeeId: { in: employeeIds } } : {}) }, select: { employeeId: true, time: true },
    });
    const keys = new Set(rows.map((r) => `${r.employeeId}|${isoDate(istDateOf(r.time))}`));
    let processed = 0;
    for (const k of keys) {
      const [eid, d] = k.split('|');
      if (await this.processDay(eid, toDateOnly(d))) processed++;
    }
    return { days: keys.size, processed };
  }

  /** Nightly: finalise yesterday (closes days that were provisional PRESENT with no check-out). */
  @Cron('10 0 * * *', { timeZone: 'Asia/Kolkata' })
  async nightlyFinaliseTick() {
    if (inProcessJobs()) await this.nightlyFinalise();
  }

  async nightlyFinalise() {
    try {
      const yesterday = addDays(todayIST(), -1);
      const ran = await runExclusive(this.prisma, 'attendance-nightly-finalise', async () => {
        const companies = await this.prisma.company.findMany({ select: { id: true } });
        for (const c of companies) await this.processRange(c.id, yesterday, yesterday);
      });
      if (ran) this.logger.log(`Attendance finalised for ${isoDate(yesterday)}`);
    } catch (e) {
      this.logger.error(`nightly attendance failed: ${errorMessage(e)}`);
    }
  }

  /** HR tool: mark working days with no record as ABSENT over a range (skips future dates, holidays, leave). */
  async markAbsent(companyId: string, from: Date, to: Date) {
    const end = to > todayIST() ? addDays(todayIST(), -1) : to;
    if (end < from) return { marked: 0 };
    const emps = await this.prisma.employee.findMany({ where: { companyId, status: 'ACTIVE', dateOfJoining: { lte: end } } });
    const existing = await this.prisma.attendance.findMany({ where: { companyId, attendanceDate: { gte: from, lte: end } }, select: { employeeId: true, attendanceDate: true } });
    const have = new Set(existing.map((e) => `${e.employeeId}|${isoDate(e.attendanceDate)}`));
    const nwCache = await this.calendar.nonWorkingDays(companyId, null, from, end);
    const rows: Prisma.AttendanceCreateManyInput[] = [];
    for (const e of emps) {
      for (const d of eachDay(from < e.dateOfJoining ? e.dateOfJoining : from, e.lastWorkingDate && e.lastWorkingDate < end ? e.lastWorkingDate : end)) {
        if (nwCache.isNonWorking(d) || have.has(`${e.id}|${isoDate(d)}`)) continue;
        rows.push({ employeeId: e.id, companyId, attendanceDate: d, status: 'ABSENT', source: 'AUTO', remarks: 'Auto-marked absent (no punch/leave)' });
      }
    }
    if (rows.length) await this.prisma.attendance.createMany({ data: rows, skipDuplicates: true });
    return { marked: rows.length };
  }

  // ===========================================================================
  // Queries
  // ===========================================================================

  async monthLog(user: AuthUser, employeeId: string, year: number, month: number) {
    await this.access.assertEmployeeAccess(user, employeeId);
    const { start, end } = monthRange(year, month);
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const [records, nw] = await Promise.all([
      this.prisma.attendance.findMany({ where: { employeeId, attendanceDate: { gte: start, lte: end } }, include: { shiftType: { select: { name: true } } }, orderBy: { attendanceDate: 'asc' } }),
      this.calendar.nonWorkingDays(emp.companyId, emp.state || emp.professionalTaxState, start, end),
    ]);
    const byDate = new Map(records.map((r) => [isoDate(r.attendanceDate), r]));
    const today = todayIST();
    const days = eachDay(start, end).map((d) => {
      const key = isoDate(d);
      const r = byDate.get(key);
      const kind = nw.isHoliday(d) ? 'HOLIDAY' : nw.isWeeklyOff(d) ? 'WEEKLY_OFF' : 'WORKING';
      return {
        date: key, weekday: d.getUTCDay(), kind, holidayName: nw.holidays.get(key) ?? null,
        status: r?.status ?? (kind !== 'WORKING' ? kind : d > today ? 'FUTURE' : 'NOT_MARKED'), inTime: r?.inTime ?? null, outTime: r?.outTime ?? null, workingHours: r?.workingHours ? num(r.workingHours) : null,
        lateEntry: r?.lateEntry ?? false, earlyExit: r?.earlyExit ?? false, overtime: r?.overtime ? num(r.overtime) : 0, shift: r?.shiftType?.name ?? null, remarks: r?.remarks ?? null, source: r?.source ?? null,
      };
    });
    const summary = {
      present: records.filter((r) => r.status === 'PRESENT').length, wfh: records.filter((r) => r.status === 'WORK_FROM_HOME').length,
      halfDay: records.filter((r) => r.status === 'HALF_DAY').length, absent: records.filter((r) => r.status === 'ABSENT').length,
      onLeave: records.filter((r) => r.status === 'ON_LEAVE').length, lateMarks: records.filter((r) => r.lateEntry).length,
      workingHours: round2(records.reduce((s, r) => s + num(r.workingHours), 0)), overtimeHours: round2(records.reduce((s, r) => s + num(r.overtime), 0)),
      holidays: days.filter((d) => d.kind === 'HOLIDAY').length, weeklyOffs: days.filter((d) => d.kind === 'WEEKLY_OFF').length,
      notMarked: days.filter((d) => d.status === 'NOT_MARKED').length,
    };
    return { employeeId, year, month, days, summary };
  }

  /** Team / company view for a date. */
  async daily(user: AuthUser, q: DailyQueryDto) {
    const date = q.date ? toDateOnly(q.date) : todayIST();
    const scope = await this.access.scopeEmployeeIds(user);
    const emps = await this.prisma.employee.findMany({
      where: {
        companyId: user.companyId, status: 'ACTIVE', dateOfJoining: { lte: date }, ...(scope ? { id: { in: scope } } : {}), ...(q.departmentId ? { departmentId: q.departmentId } : {}),
        ...(q.search ? { OR: [{ firstName: { contains: q.search, mode: 'insensitive' } }, { lastName: { contains: q.search, mode: 'insensitive' } }, { employeeCode: { contains: q.search, mode: 'insensitive' } }] } : {}),
      },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } }, orderBy: { employeeCode: 'asc' },
    });
    const recs = await this.prisma.attendance.findMany({ where: { companyId: user.companyId, attendanceDate: date, employeeId: { in: emps.map((e) => e.id) } } });
    const byEmp = new Map(recs.map((r) => [r.employeeId, r]));
    const nw = await this.calendar.nonWorkingDays(user.companyId, null, date, date);
    const items = emps.map((e) => {
      const r = byEmp.get(e.id);
      return {
        employeeId: e.id, employeeCode: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), department: e.department?.name ?? null,
        status: r?.status ?? (nw.isNonWorking(date) ? (nw.isHoliday(date) ? 'HOLIDAY' : 'WEEKLY_OFF') : 'NOT_MARKED'), inTime: r?.inTime ?? null, outTime: r?.outTime ?? null,
        workingHours: r?.workingHours ? num(r.workingHours) : null, lateEntry: r?.lateEntry ?? false, source: r?.source ?? null,
      };
    });
    const count = (s: string) => items.filter((i) => i.status === s).length;
    return {
      date: isoDate(date), items,
      totals: { total: items.length, present: count('PRESENT') + count('WORK_FROM_HOME'), absent: count('ABSENT'), halfDay: count('HALF_DAY'), onLeave: count('ON_LEAVE'), notMarked: count('NOT_MARKED'), late: items.filter((i) => i.lateEntry).length },
    };
  }

  async monthlySummary(user: AuthUser, year: number, month: number, departmentId?: string) {
    const { start, end } = monthRange(year, month);
    const scope = await this.access.scopeEmployeeIds(user);
    const emps = await this.prisma.employee.findMany({
      where: { companyId: user.companyId, status: { in: ['ACTIVE', 'LEFT'] }, dateOfJoining: { lte: end }, ...(scope ? { id: { in: scope } } : {}), ...(departmentId ? { departmentId } : {}) },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } }, orderBy: { employeeCode: 'asc' },
    });
    const recs = await this.prisma.attendance.findMany({ where: { companyId: user.companyId, attendanceDate: { gte: start, lte: end }, employeeId: { in: emps.map((e) => e.id) } } });
    const by = new Map<string, typeof recs>();
    for (const r of recs) by.set(r.employeeId, [...(by.get(r.employeeId) || []), r]);
    return emps.map((e) => {
      const rs = by.get(e.id) || [];
      const c = (s: string) => rs.filter((r) => r.status === s).length;
      return {
        employeeId: e.id, employeeCode: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), department: e.department?.name ?? null,
        present: c('PRESENT'), wfh: c('WORK_FROM_HOME'), halfDay: c('HALF_DAY'), absent: c('ABSENT'), onLeave: c('ON_LEAVE'), lateMarks: rs.filter((r) => r.lateEntry).length,
        hours: round2(rs.reduce((s, r) => s + num(r.workingHours), 0)), overtime: round2(rs.reduce((s, r) => s + num(r.overtime), 0)),
      };
    });
  }

  // ===========================================================================
  // HR edits
  // ===========================================================================

  private async assertPayrollOpen(employeeId: string, from: Date, to: Date) {
    const slip = await this.prisma.salarySlip.findFirst({ where: { employeeId, status: { in: ['APPROVED', 'PAID'] }, startDate: { lte: to }, endDate: { gte: from } }, select: { month: true, year: true } });
    if (slip) throw new BadRequestException(`Payroll for ${String(slip.month).padStart(2, '0')}/${slip.year} is already approved: attendance for that period is locked`);
  }

  async manualMark(user: AuthUser, dto: ManualMarkDto) {
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId: user.companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    const date = toDateOnly(dto.date);
    if (date > todayIST()) throw new BadRequestException('Cannot mark attendance for a future date');
    await this.assertPayrollOpen(emp.id, date, date);
    const inTime = dto.inTime ? istInstant(date, dto.inTime) : null;
    const outTime = dto.outTime ? istInstant(date, dto.outTime) : null;
    if (inTime && outTime && outTime <= inTime) throw new BadRequestException('Out time must be after in time');
    const hours = inTime && outTime ? round2((outTime.getTime() - inTime.getTime()) / 3600000) : null;
    const data = { status: dto.status as AttendanceStatus, inTime, outTime, workingHours: hours, remarks: dto.remarks ?? 'Marked by HR', source: 'MANUAL' };
    return this.prisma.attendance.upsert({
      where: { employeeId_attendanceDate: { employeeId: emp.id, attendanceDate: date } },
      create: { ...data, employeeId: emp.id, companyId: user.companyId, attendanceDate: date }, update: data,
    });
  }

  /** CSV columns: employeeCode,date,status[,inTime,outTime] */
  async importCsv(user: AuthUser, csv: string) {
    const rows = parseCsv(csv);
    if (!rows.length) throw new BadRequestException('CSV has no data rows');
    if (rows.length > 5000) throw new BadRequestException('Import at most 5000 rows at a time');
    const emps = new Map((await this.prisma.employee.findMany({ where: { companyId: user.companyId }, select: { id: true, employeeCode: true } })).map((e) => [e.employeeCode.toUpperCase(), e.id]));
    const valid = new Set(['PRESENT', 'ABSENT', 'HALF_DAY', 'ON_LEAVE', 'WORK_FROM_HOME', 'HOLIDAY']);
    let ok = 0;
    const errors: { row: number; error: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        const id = emps.get((r.employeeCode || '').toUpperCase());
        if (!id) throw new Error(`Unknown employee code "${r.employeeCode}"`);
        const status = (r.status || '').toUpperCase().replace(/[\s-]/g, '_');
        if (!valid.has(status)) throw new Error(`Invalid status "${r.status}"`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date || '')) throw new Error('date must be YYYY-MM-DD');
        await this.manualMark(user, { employeeId: id, date: r.date, status, inTime: r.inTime || undefined, outTime: r.outTime || undefined, remarks: 'Imported' });
        ok++;
      } catch (e) {
        errors.push({ row: i + 2, error: errorMessage(e) });
      }
    }
    return { total: rows.length, imported: ok, failed: errors.length, errors: errors.slice(0, 100) };
  }

  // ===========================================================================
  // Regularization / on-duty / WFH requests
  // ===========================================================================

  async requestRegularization(user: AuthUser, dto: RegularizationDto) {
    const empId = this.access.requireEmployee(user);
    const from = toDateOnly(dto.fromDate);
    const to = dto.toDate ? toDateOnly(dto.toDate) : from;
    if (to < from) throw new BadRequestException('Invalid date range');
    if (dto.requestType === 'REGULARIZE' && to > todayIST()) throw new BadRequestException('Regularization applies to past dates only');
    const dup = await this.prisma.attendanceRequest.findFirst({ where: { employeeId: empId, status: 'PENDING', fromDate: { lte: to }, toDate: { gte: from } } });
    if (dup) throw new BadRequestException('You already have a pending request for these dates');
    await this.assertPayrollOpen(empId, from, to);
    const req = await this.prisma.attendanceRequest.create({
      data: { employeeId: empId, companyId: user.companyId, fromDate: from, toDate: to, reason: dto.reason, requestType: dto.requestType, halfDay: !!dto.halfDay, halfDayDate: dto.halfDay ? from : null },
    });
    const me = await this.prisma.employee.findUniqueOrThrow({ where: { id: empId } });
    await this.notifications.notifyApproverOf(empId, user.companyId, { title: 'Attendance request', message: `${me.firstName} ${me.lastName} requested ${dto.requestType.toLowerCase().replace('_', ' ')} for ${isoDate(from)}`, type: 'APPROVAL', link: '/admin/attendance' });
    return req;
  }

  /** `forApproval` narrows the list to requests the user may decide (their reporting line; everyone but themselves for admins). */
  async listRequests(user: AuthUser, status?: string, forApproval = false) {
    const scope = forApproval ? null : await this.access.scopeEmployeeIds(user);
    const who = forApproval ? await this.access.approvalFilter(user) : scope ? { employeeId: { in: scope } } : {};
    return this.prisma.attendanceRequest.findMany({
      where: { companyId: user.companyId, ...who, ...(status ? { status: status as ApprovalStatus } : {}) },
      include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } }, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  async decideRequest(user: AuthUser, id: string, approve: boolean, comment?: string) {
    const r = await this.prisma.attendanceRequest.findFirst({ where: { id, companyId: user.companyId } });
    if (!r) throw new NotFoundException('Request not found');
    await this.access.assertCanApproveFor(user, r.employeeId);
    if (r.status !== 'PENDING') throw new BadRequestException('Already processed');
    if (!approve) {
      const upd = await this.prisma.attendanceRequest.update({ where: { id }, data: { status: 'REJECTED', approverId: user.employeeId, approverComment: comment } });
      await this.notifications.notifyEmployee(r.employeeId, { title: 'Attendance request rejected', message: comment || 'Your attendance request was rejected', type: 'ATTENDANCE', link: '/ess/dashboard' });
      return upd;
    }
    await this.assertPayrollOpen(r.employeeId, r.fromDate, r.toDate);
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: r.employeeId } });
    const nw = await this.calendar.nonWorkingDays(r.companyId, emp.state || emp.professionalTaxState, r.fromDate, r.toDate);
    const status: AttendanceStatus = r.requestType === 'WFH' ? 'WORK_FROM_HOME' : 'PRESENT';
    await this.prisma.$transaction(async (tx) => {
      for (const d of eachDay(r.fromDate, r.toDate)) {
        if (nw.isNonWorking(d) || d > todayIST() && r.requestType === 'REGULARIZE') continue;
        const existing = await tx.attendance.findUnique({ where: { employeeId_attendanceDate: { employeeId: r.employeeId, attendanceDate: d } } });
        if (existing?.leaveApplicationId) continue; // approved leave stays
        const half = r.halfDay && r.halfDayDate && isoDate(r.halfDayDate) === isoDate(d);
        const data = { status: half ? ('HALF_DAY' as const) : status, remarks: `Approved ${r.requestType.toLowerCase().replace('_', ' ')}: ${r.reason}`.slice(0, 250), source: 'MANUAL' };
        await tx.attendance.upsert({
          where: { employeeId_attendanceDate: { employeeId: r.employeeId, attendanceDate: d } },
          create: { ...data, employeeId: r.employeeId, companyId: r.companyId, attendanceDate: d }, update: data,
        });
      }
      await tx.attendanceRequest.update({ where: { id }, data: { status: 'APPROVED', approverId: user.employeeId, approverComment: comment } });
    });
    await this.notifications.notifyEmployee(r.employeeId, { title: 'Attendance request approved', message: `Your ${r.requestType.toLowerCase().replace('_', ' ')} request for ${isoDate(r.fromDate)} was approved`, type: 'ATTENDANCE', link: '/ess/dashboard' });
    return this.prisma.attendanceRequest.findUniqueOrThrow({ where: { id } });
  }
}
