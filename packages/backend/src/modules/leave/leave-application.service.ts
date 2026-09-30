import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, LeaveStatus } from '@prisma/client';
import { AccessService } from '../../common/access/access.service';
import { pageResult, paginate } from '../../common/dto/pagination.dto';
import { ADMIN_ROLES, AuthUser } from '../../common/types';
import { addDays, diffDays, eachDay, isoDate, monthRange, todayIST, toDateOnly } from '../../common/utils/dates';
import { num, round2 } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { CalendarService } from '../calendar/calendar.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayProfileService } from '../payroll/runs/pay-profile.service';
import { computeLeaveDays } from './leave-days';
import { ApplyLeaveDto, CompOffDto, EncashmentDto, LeaveListDto } from './leave.dto';
import { LeaveBalanceService } from './leave-balance.service';
import { LeaveAllocationService } from './leave-allocation.service';
import { errorMessage } from '../../common/utils/errors';

const APP_INCLUDE = {
  leaveType: { select: { id: true, name: true, isLWP: true } },
  employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, reportingManagerId: true, department: { select: { name: true } } } },
} satisfies Prisma.LeaveApplicationInclude;

const MAX_BACKDATE_DAYS = 60;

@Injectable()
export class LeaveApplicationService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private calendar: CalendarService,
    private balances: LeaveBalanceService,
    private allocations: LeaveAllocationService,
    private notifications: NotificationsService,
    private payProfile: PayProfileService,
  ) {}

  // ---- calculation / validation --------------------------------------------

  private async employeeFor(user: AuthUser, employeeId?: string) {
    const targetId = employeeId && employeeId !== user.employeeId ? employeeId : this.access.requireEmployee(user);
    if (targetId !== user.employeeId) {
      if (!ADMIN_ROLES.includes(user.role)) throw new ForbiddenException('Only HR can apply leave on behalf of another employee');
    }
    const emp = await this.prisma.employee.findFirst({ where: { id: targetId, companyId: user.companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    return emp;
  }

  async preview(user: AuthUser, dto: ApplyLeaveDto) {
    const emp = await this.employeeFor(user, dto.employeeId);
    const lt = await this.prisma.leaveType.findFirst({ where: { id: dto.leaveTypeId, companyId: user.companyId } });
    if (!lt) throw new BadRequestException('Leave type not found');
    const from = toDateOnly(dto.fromDate);
    const to = toDateOnly(dto.toDate);
    if (to < from) throw new BadRequestException('To date cannot be before From date');
    const nw = await this.calendar.nonWorkingDays(user.companyId, emp.state || emp.professionalTaxState, from, to);
    const calc = computeLeaveDays({
      from, to, halfDay: dto.halfDay, halfDayDate: dto.halfDayDate ? toDateOnly(dto.halfDayDate) : dto.halfDay ? from : null,
      includeHolidays: lt.includeHolidays, sandwichRule: lt.sandwichRule, isNonWorking: nw.isNonWorking,
    });
    const available = await this.balances.getAvailable(emp.id, lt.id, from);
    return { ...calc, available, leaveType: lt.name };
  }

  private async assertPayrollNotProcessed(employeeId: string, from: Date, to: Date) {
    const slip = await this.prisma.salarySlip.findFirst({
      where: { employeeId, status: { in: ['APPROVED', 'PAID'] }, startDate: { lte: to }, endDate: { gte: from } }, select: { month: true, year: true },
    });
    if (slip) throw new BadRequestException(`Payroll for ${String(slip.month).padStart(2, '0')}/${slip.year} is already processed; ask HR to handle this change`);
  }

  // ---- apply ----------------------------------------------------------------

  async apply(user: AuthUser, dto: ApplyLeaveDto) {
    const emp = await this.employeeFor(user, dto.employeeId);
    if (emp.status !== 'ACTIVE') throw new BadRequestException('Only active employees can apply for leave');
    const lt = await this.prisma.leaveType.findFirst({ where: { id: dto.leaveTypeId, companyId: user.companyId } });
    if (!lt) throw new BadRequestException('Leave type not found');
    if (lt.applicableGender && lt.applicableGender !== emp.gender) throw new BadRequestException(`${lt.name} is not applicable to you`);

    const from = toDateOnly(dto.fromDate);
    const to = toDateOnly(dto.toDate);
    if (to < from) throw new BadRequestException('To date cannot be before From date');
    if (diffDays(to, from) > 366) throw new BadRequestException('Leave period cannot exceed one year');
    if (diffDays(todayIST(), from) > MAX_BACKDATE_DAYS && !ADMIN_ROLES.includes(user.role)) throw new BadRequestException(`Leave cannot be applied more than ${MAX_BACKDATE_DAYS} days in the past`);
    if (lt.applicableAfterDays && diffDays(from, emp.dateOfJoining) < lt.applicableAfterDays) {
      throw new BadRequestException(`${lt.name} can be availed only after ${lt.applicableAfterDays} days of service`);
    }
    if (dto.halfDay) {
      const hd = dto.halfDayDate ? toDateOnly(dto.halfDayDate) : from;
      if (hd < from || hd > to) throw new BadRequestException('Half-day date must fall within the leave period');
    }

    const overlap = await this.prisma.leaveApplication.findFirst({
      where: { employeeId: emp.id, status: { in: ['OPEN', 'APPROVED'] }, fromDate: { lte: to }, toDate: { gte: from } },
    });
    if (overlap) throw new BadRequestException(`You already have a leave application from ${isoDate(overlap.fromDate)} to ${isoDate(overlap.toDate)}`);
    await this.assertPayrollNotProcessed(emp.id, from, to);

    const preview = await this.preview(user, dto);
    if (preview.totalDays <= 0) throw new BadRequestException('The selected dates are all holidays / weekly offs: no leave needed');
    if (lt.maxContinuousDays && preview.totalDays > lt.maxContinuousDays) throw new BadRequestException(`${lt.name} cannot exceed ${lt.maxContinuousDays} continuous days`);
    if (!lt.isLWP && !lt.allowNegativeBalance && preview.totalDays > preview.available) {
      throw new BadRequestException(`Insufficient ${lt.name} balance: ${preview.available} available, ${preview.totalDays} requested`);
    }

    const app = await this.prisma.leaveApplication.create({
      data: {
        employeeId: emp.id, leaveTypeId: lt.id, companyId: user.companyId, fromDate: from, toDate: to, totalLeaveDays: preview.totalDays,
        halfDay: !!dto.halfDay, halfDayDate: dto.halfDay ? (dto.halfDayDate ? toDateOnly(dto.halfDayDate) : from) : null, reason: dto.reason,
        leaveApproverId: emp.leaveApproverId || emp.reportingManagerId,
      },
      include: APP_INCLUDE,
    });
    await this.notifications.notifyApproverOf(emp.id, user.companyId, {
      title: 'Leave approval pending', message: `${emp.firstName} ${emp.lastName} applied for ${preview.totalDays} day(s) ${lt.name} (${isoDate(from)} → ${isoDate(to)})`, type: 'APPROVAL', link: '/admin/leave',
    });
    return app;
  }

  // ---- decisions ------------------------------------------------------------

  private async getForDecision(user: AuthUser, id: string) {
    const app = await this.prisma.leaveApplication.findFirst({ where: { id, companyId: user.companyId }, include: { ...APP_INCLUDE, leaveType: true } });
    if (!app) throw new NotFoundException('Leave application not found');
    return app;
  }

  async approve(user: AuthUser, id: string, comment?: string) {
    const app = await this.getForDecision(user, id);
    await this.access.assertCanApproveFor(user, app.employeeId);
    if (app.status !== 'OPEN') throw new BadRequestException(`Application is already ${app.status.toLowerCase()}`);
    await this.assertPayrollNotProcessed(app.employeeId, app.fromDate, app.toDate);
    const lt = app.leaveType;
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: app.employeeId } });
    const nw = await this.calendar.nonWorkingDays(app.companyId, emp.state || emp.professionalTaxState, app.fromDate, app.toDate);
    const calc = computeLeaveDays({
      from: app.fromDate, to: app.toDate, halfDay: app.halfDay, halfDayDate: app.halfDayDate, includeHolidays: lt.includeHolidays, sandwichRule: lt.sandwichRule, isNonWorking: nw.isNonWorking,
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        if (!lt.isLWP) await this.balances.consume(tx, app.employeeId, lt.id, num(app.totalLeaveDays), app.fromDate, lt.allowNegativeBalance);
        for (const iso of calc.countedDates) {
          const date = toDateOnly(iso);
          const isHalf = app.halfDay && app.halfDayDate && isoDate(app.halfDayDate) === iso;
          await tx.attendance.upsert({
            where: { employeeId_attendanceDate: { employeeId: app.employeeId, attendanceDate: date } },
            create: { employeeId: app.employeeId, companyId: app.companyId, attendanceDate: date, status: isHalf ? 'HALF_DAY' : 'ON_LEAVE', leaveTypeId: lt.id, leaveApplicationId: app.id, source: 'LEAVE' },
            update: { status: isHalf ? 'HALF_DAY' : 'ON_LEAVE', leaveTypeId: lt.id, leaveApplicationId: app.id },
          });
        }
        await tx.leaveApplication.update({ where: { id }, data: { status: 'APPROVED', approverComment: comment, leaveApproverId: user.employeeId ?? app.leaveApproverId } });
      });
    } catch (e) {
      if (errorMessage(e) === 'Insufficient leave balance') throw new BadRequestException('Employee no longer has sufficient balance for this leave');
      throw e;
    }
    await this.notifications.notifyEmployee(app.employeeId, { title: 'Leave approved', message: `Your ${lt.name} (${isoDate(app.fromDate)} → ${isoDate(app.toDate)}) was approved`, type: 'LEAVE', link: '/ess/dashboard' });
    return this.getForDecision(user, id);
  }

  async reject(user: AuthUser, id: string, comment?: string) {
    const app = await this.getForDecision(user, id);
    await this.access.assertCanApproveFor(user, app.employeeId);
    if (app.status !== 'OPEN') throw new BadRequestException(`Application is already ${app.status.toLowerCase()}`);
    const updated = await this.prisma.leaveApplication.update({ where: { id }, data: { status: 'REJECTED', approverComment: comment }, include: APP_INCLUDE });
    await this.notifications.notifyEmployee(app.employeeId, { title: 'Leave rejected', message: `Your ${app.leaveType.name} request was rejected${comment ? `: ${comment}` : ''}`, type: 'LEAVE', link: '/ess/dashboard' });
    return updated;
  }

  async cancel(user: AuthUser, id: string) {
    const app = await this.getForDecision(user, id);
    const isOwner = app.employeeId === user.employeeId;
    const isAdmin = ADMIN_ROLES.includes(user.role);
    if (!isOwner && !isAdmin) throw new ForbiddenException('You can cancel only your own leave');
    if (app.status === 'CANCELLED' || app.status === 'REJECTED') throw new BadRequestException(`Application is already ${app.status.toLowerCase()}`);
    if (app.status === 'APPROVED') {
      if (!isAdmin && app.fromDate <= todayIST()) throw new BadRequestException('Approved leave that has started can only be cancelled by HR');
      await this.assertPayrollNotProcessed(app.employeeId, app.fromDate, app.toDate);
    }
    const lt = app.leaveType;
    await this.prisma.$transaction(async (tx) => {
      if (app.status === 'APPROVED') {
        if (!lt.isLWP) await this.balances.refund(tx, app.employeeId, lt.id, num(app.totalLeaveDays), app.fromDate);
        await tx.attendance.deleteMany({ where: { leaveApplicationId: app.id } });
      }
      await tx.leaveApplication.update({ where: { id }, data: { status: 'CANCELLED' } });
    });
    return this.getForDecision(user, id);
  }

  // ---- queries --------------------------------------------------------------

  async list(user: AuthUser, f: LeaveListDto) {
    const { skip, take, page, limit } = paginate(f);
    const scopeKind = f.scope || (ADMIN_ROLES.includes(user.role) ? 'all' : 'mine');
    let employeeFilter: Prisma.LeaveApplicationWhereInput = {};
    if (scopeKind === 'mine') employeeFilter = { employeeId: this.access.requireEmployee(user) };
    else if (scopeKind === 'team') {
      if (!user.employeeId) return pageResult([], 0, page, limit);
      const ids = await this.access.getReporteeIds(user.employeeId, user.companyId);
      employeeFilter = { employeeId: { in: ids } };
    } else {
      const scope = await this.access.scopeEmployeeIds(user);
      if (scope) employeeFilter = { employeeId: { in: scope } };
      else if (user.role === Role.EMPLOYEE) employeeFilter = { employeeId: this.access.requireEmployee(user) };
    }
    const where: Prisma.LeaveApplicationWhereInput = {
      companyId: user.companyId, ...employeeFilter,
      ...(f.status ? { status: f.status as LeaveStatus } : {}),
      ...(f.employeeId && scopeKind !== 'mine' ? { employeeId: f.employeeId } : {}),
      ...(f.from ? { toDate: { gte: toDateOnly(f.from) } } : {}),
      ...(f.to ? { fromDate: { lte: toDateOnly(f.to) } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.leaveApplication.findMany({ where, include: APP_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.leaveApplication.count({ where }),
    ]);
    return pageResult(items, total, page, limit);
  }

  async pendingApprovals(user: AuthUser) {
    return this.prisma.leaveApplication.findMany({
      where: { companyId: user.companyId, status: 'OPEN', ...(await this.access.approvalFilter(user)) },
      include: APP_INCLUDE, orderBy: { createdAt: 'asc' }, take: 100,
    });
  }

  /** Month view: leaves for the user's scope plus holidays. */
  async calendarView(user: AuthUser, year: number, month: number) {
    const { start, end } = monthRange(year, month);
    const scope = await this.access.scopeEmployeeIds(user);
    const emp = user.employeeId ? await this.prisma.employee.findUnique({ where: { id: user.employeeId }, select: { state: true, professionalTaxState: true } }) : null;
    const [leaves, nw] = await Promise.all([
      this.prisma.leaveApplication.findMany({
        where: { companyId: user.companyId, status: { in: ['OPEN', 'APPROVED'] }, fromDate: { lte: end }, toDate: { gte: start }, ...(scope ? { employeeId: { in: scope } } : {}) },
        include: APP_INCLUDE,
      }),
      this.calendar.nonWorkingDays(user.companyId, emp?.state || emp?.professionalTaxState, start, end),
    ]);
    return {
      leaves: leaves.map((l) => ({ id: l.id, employeeId: l.employeeId, employee: `${l.employee.firstName} ${l.employee.lastName}`.trim(), leaveType: l.leaveType.name, from: isoDate(l.fromDate), to: isoDate(l.toDate), status: l.status, days: num(l.totalLeaveDays) })),
      holidays: [...nw.holidays.entries()].map(([date, name]) => ({ date, name })),
      weeklyOffDays: nw.weeklyOffDays,
    };
  }

  // ---- encashment -----------------------------------------------------------

  async requestEncashment(user: AuthUser, dto: EncashmentDto) {
    const empId = this.access.requireEmployee(user);
    const lt = await this.prisma.leaveType.findFirst({ where: { id: dto.leaveTypeId, companyId: user.companyId } });
    if (!lt || !lt.isEncashable) throw new BadRequestException('This leave type is not encashable');
    const year = todayIST();
    const available = await this.balances.getAvailable(empId, lt.id, year);
    if (dto.days > available) throw new BadRequestException(`Only ${available} day(s) available for encashment`);
    if (lt.maxEncashableDays && dto.days > num(lt.maxEncashableDays)) throw new BadRequestException(`At most ${num(lt.maxEncashableDays)} day(s) can be encashed`);
    const basicDa = await this.payProfile.getBasicDaMonthly(empId, year);
    if (!basicDa) throw new BadRequestException('No salary structure assigned yet: contact HR');
    const amount = round2((basicDa / 30) * dto.days);
    const bounds = this.allocations.yearBounds(year.getUTCFullYear());
    return this.prisma.leaveEncashment.create({ data: { employeeId: empId, leaveTypeId: lt.id, leavePeriodFrom: bounds.from, leavePeriodTo: bounds.to, encashableDays: dto.days, encashmentAmount: amount } });
  }

  async listEncashments(user: AuthUser) {
    const scope = await this.access.scopeEmployeeIds(user);
    return this.prisma.leaveEncashment.findMany({
      where: { employee: { companyId: user.companyId }, ...(scope ? { employeeId: { in: scope } } : {}) },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } }, leaveType: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  async decideEncashment(user: AuthUser, id: string, approve: boolean) {
    const enc = await this.prisma.leaveEncashment.findFirst({ where: { id, employee: { companyId: user.companyId } } });
    if (!enc) throw new NotFoundException('Encashment not found');
    if (enc.status !== 'PENDING') throw new BadRequestException('Already processed');
    if (!approve) return this.prisma.leaveEncashment.update({ where: { id }, data: { status: 'REJECTED' } });
    const comp = await this.prisma.salaryComponent.findFirst({ where: { companyId: user.companyId, abbr: 'LEAVEENC' } });
    if (!comp) throw new BadRequestException('Leave Encashment salary component missing');
    const payrollDate = todayIST();
    return this.prisma.$transaction(async (tx) => {
      await this.balances.consume(tx, enc.employeeId, enc.leaveTypeId, num(enc.encashableDays), todayIST(), false);
      await tx.leaveLedgerEntry.updateMany({ where: { employeeId: enc.employeeId, leaveTypeId: enc.leaveTypeId, transactionType: 'LEAVE', createdAt: { gte: addDays(new Date(), -1) }, leaves: -num(enc.encashableDays) }, data: { transactionType: 'ENCASHMENT' } });
      await tx.additionalSalary.create({
        data: { employeeId: enc.employeeId, companyId: user.companyId, salaryComponentId: comp.id, amount: enc.encashmentAmount, payrollDate, reason: 'Leave encashment', type: 'EARNING' },
      });
      return tx.leaveEncashment.update({ where: { id }, data: { status: 'APPROVED' } });
    });
  }

  // ---- compensatory off -----------------------------------------------------

  async requestCompOff(user: AuthUser, dto: CompOffDto) {
    const empId = this.access.requireEmployee(user);
    const lt = await this.prisma.leaveType.findFirst({ where: { companyId: user.companyId, isCompensatory: true } });
    if (!lt) throw new BadRequestException('Compensatory leave is not configured');
    const from = toDateOnly(dto.workFromDate);
    const to = dto.workEndDate ? toDateOnly(dto.workEndDate) : from;
    if (to < from) throw new BadRequestException('Invalid work dates');
    if (to > todayIST()) throw new BadRequestException('Comp-off can only be claimed for work already done');
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: empId } });
    const nw = await this.calendar.nonWorkingDays(user.companyId, emp.state || emp.professionalTaxState, from, to);
    if (eachDay(from, to).some((d) => !nw.isNonWorking(d))) throw new BadRequestException('Comp-off applies only to work done on holidays or weekly offs');
    const created = await this.prisma.compensatoryLeaveRequest.create({ data: { employeeId: empId, companyId: user.companyId, leaveTypeId: lt.id, workFromDate: from, workEndDate: to, halfDay: !!dto.halfDay, reason: dto.reason } });
    await this.notifications.notifyApproverOf(empId, user.companyId, { title: 'Comp-off request', message: `${emp.firstName} requested comp-off for work on ${isoDate(from)}`, type: 'APPROVAL', link: '/admin/leave' });
    return created;
  }

  async listCompOff(user: AuthUser, forApproval = false) {
    const scope = forApproval ? null : await this.access.scopeEmployeeIds(user);
    const who = forApproval ? await this.access.approvalFilter(user) : scope ? { employeeId: { in: scope } } : {};
    return this.prisma.compensatoryLeaveRequest.findMany({
      where: { companyId: user.companyId, ...who },
      include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } }, orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  async decideCompOff(user: AuthUser, id: string, approve: boolean, comment?: string) {
    const r = await this.prisma.compensatoryLeaveRequest.findFirst({ where: { id, companyId: user.companyId } });
    if (!r) throw new NotFoundException('Request not found');
    await this.access.assertCanApproveFor(user, r.employeeId);
    if (r.status !== 'PENDING') throw new BadRequestException('Already processed');
    if (!approve) return this.prisma.compensatoryLeaveRequest.update({ where: { id }, data: { status: 'REJECTED', approverComment: comment } });
    const days = (diffDays(r.workEndDate, r.workFromDate) + 1) * (r.halfDay ? 0.5 : 1);
    return this.prisma.$transaction(async (tx) => {
      await tx.leaveAllocation.create({
        data: { employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, companyId: r.companyId, fromDate: r.workFromDate, toDate: addDays(r.workEndDate, 90), newLeavesAllocated: days, totalLeavesAllocated: days },
      });
      await tx.leaveLedgerEntry.create({ data: { employeeId: r.employeeId, leaveTypeId: r.leaveTypeId, transactionType: 'COMP_OFF', leaves: days, fromDate: r.workFromDate, toDate: addDays(r.workEndDate, 90) } });
      return tx.compensatoryLeaveRequest.update({ where: { id }, data: { status: 'APPROVED', approverComment: comment } });
    });
  }
}
