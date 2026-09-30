import { Injectable } from '@nestjs/common';
import { AccessService } from '../../common/access/access.service';
import { AuthUser } from '../../common/types';
import { addDays, fiscalYearRange, fiscalYearStartYear, isoDate, monthRange, todayIST } from '../../common/utils/dates';
import { num, round2 } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { CheckinService } from '../attendance/checkin.service';
import { LeaveBalanceService } from '../leave/leave-balance.service';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Next occurrence (date + days away) of a month/day, counting today as 0. */
function nextOccurrence(date: Date, today: Date): { next: Date; inDays: number } {
  let next = new Date(Date.UTC(today.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (next < today) next = new Date(Date.UTC(today.getUTCFullYear() + 1, date.getUTCMonth(), date.getUTCDate()));
  return { next, inDays: Math.round((next.getTime() - today.getTime()) / 86400000) };
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private attendance: AttendanceService,
    private checkin: CheckinService,
    private balances: LeaveBalanceService,
  ) {}

  private async celebrations(companyId: string, withinDays: number, employeeIds?: string[] | null) {
    const today = todayIST();
    const emps = await this.prisma.employee.findMany({
      where: { companyId, status: 'ACTIVE', ...(employeeIds ? { id: { in: employeeIds } } : {}) },
      select: { id: true, firstName: true, lastName: true, dateOfBirth: true, dateOfJoining: true, department: { select: { name: true } } },
    });
    const birthdays = emps
      .filter((e) => e.dateOfBirth)
      .map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`.trim(), department: e.department?.name, in: nextOccurrence(e.dateOfBirth!, today).inDays }))
      .filter((e) => e.in <= withinDays)
      .sort((a, b) => a.in - b.in);
    const anniversaries = emps
      .map((e) => {
        const o = nextOccurrence(e.dateOfJoining, today);
        return { id: e.id, name: `${e.firstName} ${e.lastName}`.trim(), department: e.department?.name, in: o.inDays, years: o.next.getUTCFullYear() - e.dateOfJoining.getUTCFullYear() };
      })
      .filter((e) => e.years > 0 && e.in <= withinDays)
      .sort((a, b) => a.in - b.in);
    return { birthdays: birthdays.slice(0, 10), anniversaries: anniversaries.slice(0, 10) };
  }

  async admin(user: AuthUser) {
    const companyId = user.companyId;
    const today = todayIST();
    const fy = fiscalYearRange(fiscalYearStartYear(today));
    const { start: monthStart } = monthRange(today.getUTCFullYear(), today.getUTCMonth() + 1);

    const [active, joinersMonth, exitsFY, opening, byDept, byGender, byType, statusRows, runs, jobs, applicants, pendingLeave, pendingAtt, pendingExp, pendingDecl, openTickets, overdueOnb, pendingSep] = await Promise.all([
      this.prisma.employee.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.employee.count({ where: { companyId, dateOfJoining: { gte: monthStart, lte: today } } }),
      this.prisma.employee.count({ where: { companyId, status: 'LEFT', lastWorkingDate: { gte: fy.start, lte: fy.end } } }),
      this.prisma.employee.count({ where: { companyId, dateOfJoining: { lt: fy.start }, OR: [{ lastWorkingDate: null }, { lastWorkingDate: { gte: fy.start } }] } }),
      this.prisma.employee.groupBy({ by: ['departmentId'], where: { companyId, status: 'ACTIVE' }, _count: true }),
      this.prisma.employee.groupBy({ by: ['gender'], where: { companyId, status: 'ACTIVE' }, _count: true }),
      this.prisma.employee.groupBy({ by: ['employmentType'], where: { companyId, status: 'ACTIVE' }, _count: true }),
      this.prisma.attendance.groupBy({ by: ['status'], where: { companyId, attendanceDate: today }, _count: true }),
      this.prisma.payrollEntry.findMany({ where: { companyId, status: { in: ['GENERATED', 'APPROVED', 'PAID'] } }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 6 }),
      this.prisma.jobOpening.count({ where: { companyId, status: 'OPEN' } }),
      this.prisma.jobApplicant.count({ where: { companyId, stage: { in: ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER'] } } }),
      this.prisma.leaveApplication.count({ where: { companyId, status: 'OPEN' } }),
      this.prisma.attendanceRequest.count({ where: { companyId, status: 'PENDING' } }),
      this.prisma.expenseClaim.count({ where: { companyId, status: 'SUBMITTED' } }),
      this.prisma.employeeTaxDeclaration.count({ where: { companyId, status: 'PENDING', isSubmitted: true } }),
      this.prisma.helpdeskTicket.count({ where: { companyId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.employeeOnboardingTask.count({ where: { onboarding: { companyId }, status: { in: ['PENDING', 'IN_PROGRESS'] }, dueDate: { lt: today } } }),
      this.prisma.employeeSeparation.count({ where: { companyId, status: 'PENDING' } }),
    ]);

    const depts = await this.prisma.department.findMany({ where: { companyId }, select: { id: true, name: true } });
    const deptName = new Map(depts.map((d) => [d.id, d.name]));
    const stat = (s: string) => statusRows.find((r) => r.status === s)?._count ?? 0;
    const marked = statusRows.reduce((s, r) => s + r._count, 0);
    const avgHeadcount = (opening + active) / 2 || 1;

    return {
      headcount: { active, joinersThisMonth: joinersMonth, exitsThisFY: exitsFY, attritionRatePercent: round2((exitsFY / avgHeadcount) * 100) },
      byDepartment: byDept.map((d) => ({ name: d.departmentId ? deptName.get(d.departmentId) || 'Unknown' : 'Unassigned', count: d._count })).sort((a, b) => b.count - a.count),
      byGender: byGender.map((g) => ({ name: g.gender, count: g._count })),
      byEmploymentType: byType.map((t) => ({ name: t.employmentType || 'Unspecified', count: t._count })),
      attendanceToday: { present: stat('PRESENT') + stat('WORK_FROM_HOME'), halfDay: stat('HALF_DAY'), absent: stat('ABSENT'), onLeave: stat('ON_LEAVE'), notMarked: Math.max(0, active - marked) },
      pending: { leave: pendingLeave, attendanceRequests: pendingAtt, expenses: pendingExp, taxDeclarations: pendingDecl, helpdesk: openTickets, overdueOnboarding: overdueOnb, separations: pendingSep },
      payrollTrend: runs.reverse().map((r) => ({ label: `${MONTHS[r.month - 1]} ${String(r.year).slice(2)}`, gross: num(r.totalGross), net: num(r.totalNet), employerCost: num(r.totalEmployerContribution), headcount: r.employeeCount, status: r.status })),
      recruitment: { openPositions: jobs, activeApplicants: applicants },
      celebrations: await this.celebrations(companyId, 30),
    };
  }

  async manager(user: AuthUser) {
    const empId = this.access.requireEmployee(user);
    const team = await this.access.getReporteeIds(empId, user.companyId);
    const today = todayIST();
    const [members, att, pendingLeave, pendingAtt, pendingExp, onLeaveToday] = await Promise.all([
      this.prisma.employee.findMany({ where: { id: { in: team }, status: 'ACTIVE' }, select: { id: true, firstName: true, lastName: true, employeeCode: true, designation: { select: { name: true } } } }),
      this.prisma.attendance.findMany({ where: { employeeId: { in: team }, attendanceDate: today } }),
      this.prisma.leaveApplication.count({ where: { employeeId: { in: team }, status: 'OPEN' } }),
      this.prisma.attendanceRequest.count({ where: { employeeId: { in: team }, status: 'PENDING' } }),
      this.prisma.expenseClaim.count({ where: { employeeId: { in: team }, status: 'SUBMITTED' } }),
      this.prisma.leaveApplication.findMany({ where: { employeeId: { in: team }, status: 'APPROVED', fromDate: { lte: addDays(today, 7) }, toDate: { gte: today } }, include: { employee: { select: { firstName: true, lastName: true } }, leaveType: { select: { name: true } } }, take: 20 }),
    ]);
    const present = new Set(att.filter((a) => ['PRESENT', 'WORK_FROM_HOME', 'HALF_DAY'].includes(a.status)).map((a) => a.employeeId));
    return {
      teamSize: members.length, presentToday: present.size, onLeaveToday: att.filter((a) => a.status === 'ON_LEAVE').length,
      pending: { leave: pendingLeave, attendanceRequests: pendingAtt, expenses: pendingExp },
      team: members.map((m) => ({ id: m.id, name: `${m.firstName} ${m.lastName}`.trim(), code: m.employeeCode, designation: m.designation?.name, presentToday: present.has(m.id) })),
      upcomingLeaves: onLeaveToday.map((l) => ({ employee: `${l.employee.firstName} ${l.employee.lastName}`.trim(), type: l.leaveType.name, from: isoDate(l.fromDate), to: isoDate(l.toDate) })),
      celebrations: await this.celebrations(user.companyId, 14, team),
    };
  }

  async ess(user: AuthUser) {
    const empId = this.access.requireEmployee(user);
    const today = todayIST();
    const [emp, balances, punch, log, slips, announcements, holidays, policiesPending, myOpenLeaves, myTasks, pendingApprovals] = await Promise.all([
      this.prisma.employee.findUniqueOrThrow({ where: { id: empId }, include: { department: { select: { name: true } }, designation: { select: { name: true } }, reportingManager: { select: { firstName: true, lastName: true } } } }),
      this.balances.getBalances(empId, new Date()),
      this.checkin.status(user),
      this.attendance.monthLog(user, empId, today.getUTCFullYear(), today.getUTCMonth() + 1),
      this.prisma.salarySlip.findMany({ where: { employeeId: empId, status: { in: ['APPROVED', 'PAID'] } }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 3 }),
      this.prisma.announcement.findMany({ where: { companyId: user.companyId, publishAt: { lte: new Date() }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: [{ pinned: 'desc' }, { publishAt: 'desc' }], take: 5 }),
      this.prisma.holiday.findMany({ where: { holidayList: { companyId: user.companyId }, date: { gte: today }, isOptional: false }, orderBy: { date: 'asc' }, take: 20 }),
      this.prisma.policy.findMany({ where: { companyId: user.companyId, isActive: true }, include: { acknowledgements: { where: { employeeId: empId } } } }),
      this.prisma.leaveApplication.findMany({ where: { employeeId: empId, status: 'OPEN' }, include: { leaveType: { select: { name: true } } } }),
      this.prisma.employeeOnboardingTask.findMany({ where: { onboarding: { employeeId: empId }, status: { in: ['PENDING', 'IN_PROGRESS'] }, assignedTo: 'Employee' }, take: 10 }),
      this.pendingApprovalCount(user),
    ]);
    const seenHol = new Set<string>();
    const upcomingHolidays = holidays.filter((h) => (seenHol.has(isoDate(h.date)) ? false : (seenHol.add(isoDate(h.date)), true))).slice(0, 4).map((h) => ({ date: isoDate(h.date), name: h.name }));
    return {
      profile: { name: `${emp.firstName} ${emp.lastName}`.trim(), code: emp.employeeCode, designation: emp.designation?.name, department: emp.department?.name, manager: emp.reportingManager ? `${emp.reportingManager.firstName} ${emp.reportingManager.lastName}` : null, dateOfJoining: emp.dateOfJoining },
      today: punch, attendanceSummary: log.summary, leaveBalances: balances, openLeaveRequests: myOpenLeaves.map((l) => ({ id: l.id, type: l.leaveType.name, from: isoDate(l.fromDate), to: isoDate(l.toDate), days: num(l.totalLeaveDays) })),
      latestPayslips: slips.map((s) => ({ id: s.id, month: s.month, year: s.year, net: num(s.netPay), status: s.status })),
      announcements, upcomingHolidays, pendingPolicies: policiesPending.filter((p) => !p.acknowledgements.some((a) => a.policyVersion === p.version)).map((p) => ({ id: p.id, title: p.title })),
      onboardingTasks: myTasks.map((t) => ({ id: t.id, title: t.title, dueDate: t.dueDate })), pendingApprovals, celebrations: await this.celebrations(user.companyId, 7),
    };
  }

  /** Null when the user approves for no one (not an admin, nobody reports to them). */
  private async pendingApprovalCount(user: AuthUser) {
    if (!this.access.isAdmin(user) && !(await this.access.hasApprovalDuties(user))) return null;
    const emp = await this.access.approvalFilter(user);
    const [leave, att, exp] = await Promise.all([
      this.prisma.leaveApplication.count({ where: { companyId: user.companyId, status: 'OPEN', ...emp } }),
      this.prisma.attendanceRequest.count({ where: { companyId: user.companyId, status: 'PENDING', ...emp } }),
      this.prisma.expenseClaim.count({ where: { companyId: user.companyId, status: 'SUBMITTED', ...emp } }),
    ]);
    return { leave, attendance: att, expenses: exp, total: leave + att + exp };
  }
}
