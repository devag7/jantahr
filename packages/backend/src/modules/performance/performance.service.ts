import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessService } from '../../common/access/access.service';
import { ADMIN_ROLES, AuthUser } from '../../common/types';
import { todayIST, toDateOnly } from '../../common/utils/dates';
import { num, round2 } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SalarySetupService } from '../payroll/setup/salary-setup.service';
import { PayProfileService } from '../payroll/runs/pay-profile.service';
import { ApplyRevisionDto, CycleDto, GoalDto, HrFinalizeDto, ManagerReviewDto, SelfReviewDto, UpdateCycleDto, UpdateGoalDto } from './performance.dto';

import { Prisma } from '@prisma/client';
const APPRAISAL_INCLUDE = {
  employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, reportingManagerId: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
  appraisalCycle: { select: { id: true, name: true, startDate: true, endDate: true } },
};

@Injectable()
export class PerformanceService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private notifications: NotificationsService,
    private setup: SalarySetupService,
    private profile: PayProfileService,
  ) {}

  // ---- cycles ----
  cycles(companyId: string) {
    return this.prisma.appraisalCycle.findMany({ where: { companyId }, orderBy: { startDate: 'desc' }, include: { _count: { select: { appraisals: true } } } });
  }
  createCycle(companyId: string, dto: CycleDto) {
    if (toDateOnly(dto.endDate) < toDateOnly(dto.startDate)) throw new BadRequestException('End date is before start date');
    return this.prisma.appraisalCycle.create({ data: { name: dto.name, companyId, startDate: toDateOnly(dto.startDate), endDate: toDateOnly(dto.endDate), isActive: dto.isActive ?? true } });
  }
  async updateCycle(companyId: string, id: string, dto: UpdateCycleDto) {
    if (!(await this.prisma.appraisalCycle.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Cycle not found');
    const { startDate, endDate, ...rest } = dto;
    return this.prisma.appraisalCycle.update({ where: { id }, data: { ...rest, ...(startDate ? { startDate: toDateOnly(startDate) } : {}), ...(endDate ? { endDate: toDateOnly(endDate) } : {}) } });
  }

  /** Creates a self-review appraisal for every active employee (optionally one department). */
  async launch(user: AuthUser, cycleId: string, departmentId?: string) {
    const cycle = await this.prisma.appraisalCycle.findFirst({ where: { id: cycleId, companyId: user.companyId } });
    if (!cycle) throw new NotFoundException('Cycle not found');
    const emps = await this.prisma.employee.findMany({ where: { companyId: user.companyId, status: 'ACTIVE', dateOfJoining: { lt: cycle.endDate }, ...(departmentId ? { departmentId } : {}) }, select: { id: true, reportingManagerId: true, userId: true } });
    const existing = new Set((await this.prisma.appraisal.findMany({ where: { appraisalCycleId: cycleId }, select: { employeeId: true } })).map((a) => a.employeeId));
    const fresh = emps.filter((e) => !existing.has(e.id));
    if (fresh.length) {
      await this.prisma.appraisal.createMany({ data: fresh.map((e) => ({ employeeId: e.id, companyId: user.companyId, appraisalCycleId: cycleId, reviewerId: e.reportingManagerId, status: 'SELF_REVIEW' as const })) });
      await this.prisma.notification.createMany({ data: fresh.map((e) => ({ userId: e.userId, title: 'Appraisal started', message: `${cycle.name}: please complete your self-review`, type: 'PERFORMANCE', link: '/admin/performance' })) });
    }
    return { launched: fresh.length, alreadyExisting: emps.length - fresh.length };
  }

  // ---- goals ----
  async goals(user: AuthUser, employeeId?: string) {
    const target = employeeId || this.access.requireEmployee(user);
    await this.access.assertEmployeeAccess(user, target);
    return this.prisma.goal.findMany({ where: { employeeId: target, companyId: user.companyId }, orderBy: { startDate: 'desc' } });
  }

  async createGoal(user: AuthUser, dto: GoalDto) {
    const target = dto.employeeId && dto.employeeId !== user.employeeId ? dto.employeeId : this.access.requireEmployee(user);
    await this.access.assertEmployeeAccess(user, target);
    if (target !== user.employeeId && !(await this.access.canApproveFor(user, target))) throw new ForbiddenException('Only the manager or HR can set goals for others');
    const open = await this.prisma.goal.aggregate({ where: { employeeId: target, endDate: { gte: toDateOnly(dto.startDate) }, startDate: { lte: toDateOnly(dto.endDate) }, status: { not: 'REJECTED' } }, _sum: { weightage: true } });
    if (num(open._sum.weightage) + dto.weightage > 100) throw new BadRequestException(`Total goal weightage for the period would be ${num(open._sum.weightage) + dto.weightage}% (max 100%)`);
    const isManager = target !== user.employeeId;
    return this.prisma.goal.create({
      data: { employeeId: target, companyId: user.companyId, title: dto.title, description: dto.description, weightage: dto.weightage, targetValue: dto.targetValue, startDate: toDateOnly(dto.startDate), endDate: toDateOnly(dto.endDate), status: isManager ? 'APPROVED' : 'PENDING' },
    });
  }

  async updateGoal(user: AuthUser, id: string, dto: UpdateGoalDto) {
    const g = await this.prisma.goal.findFirst({ where: { id, companyId: user.companyId } });
    if (!g) throw new NotFoundException('Goal not found');
    await this.access.assertEmployeeAccess(user, g.employeeId);
    const isSelf = g.employeeId === user.employeeId;
    const canManage = await this.access.canApproveFor(user, g.employeeId);
    const data: Prisma.GoalUncheckedUpdateInput = {};
    if (isSelf) Object.assign(data, { achievedValue: dto.achievedValue, selfRating: dto.selfRating, selfComment: dto.selfComment });
    if (canManage) Object.assign(data, { title: dto.title, description: dto.description, weightage: dto.weightage, targetValue: dto.targetValue, managerRating: dto.managerRating, managerComment: dto.managerComment, achievedValue: dto.achievedValue });
    if (!isSelf && !canManage) throw new ForbiddenException();
    (Object.keys(data) as (keyof typeof data)[]).forEach((k) => data[k] === undefined && delete data[k]);
    return this.prisma.goal.update({ where: { id }, data });
  }

  async decideGoal(user: AuthUser, id: string, approve: boolean) {
    const g = await this.prisma.goal.findFirst({ where: { id, companyId: user.companyId } });
    if (!g) throw new NotFoundException('Goal not found');
    await this.access.assertCanApproveFor(user, g.employeeId);
    return this.prisma.goal.update({ where: { id }, data: { status: approve ? 'APPROVED' : 'REJECTED' } });
  }

  // ---- appraisals ----
  async appraisalsForCycle(user: AuthUser, cycleId: string) {
    const scope = await this.access.scopeEmployeeIds(user);
    return this.prisma.appraisal.findMany({ where: { companyId: user.companyId, appraisalCycleId: cycleId, ...(scope ? { employeeId: { in: scope } } : {}) }, include: APPRAISAL_INCLUDE, orderBy: { employee: { employeeCode: 'asc' } } });
  }

  async myAppraisals(user: AuthUser) {
    const id = this.access.requireEmployee(user);
    return this.prisma.appraisal.findMany({ where: { employeeId: id }, include: APPRAISAL_INCLUDE, orderBy: { createdAt: 'desc' } });
  }

  async pendingReviews(user: AuthUser) {
    return this.prisma.appraisal.findMany({
      where: { companyId: user.companyId, status: { in: ADMIN_ROLES.includes(user.role) ? ['MANAGER_REVIEW', 'HR_REVIEW'] : ['MANAGER_REVIEW'] }, ...(await this.access.approvalFilter(user)) },
      include: APPRAISAL_INCLUDE, take: 200,
    });
  }

  private async getAppraisal(user: AuthUser, id: string) {
    const a = await this.prisma.appraisal.findFirst({ where: { id, companyId: user.companyId }, include: APPRAISAL_INCLUDE });
    if (!a) throw new NotFoundException('Appraisal not found');
    return a;
  }

  async getOne(user: AuthUser, id: string) {
    const a = await this.getAppraisal(user, id);
    await this.access.assertEmployeeAccess(user, a.employeeId);
    const goals = await this.prisma.goal.findMany({ where: { employeeId: a.employeeId, endDate: { gte: a.appraisalCycle.startDate }, startDate: { lte: a.appraisalCycle.endDate } } });
    const weighted = goals.filter((g) => g.managerRating).reduce((s, g) => s + num(g.weightage) * num(g.managerRating), 0);
    const w = goals.filter((g) => g.managerRating).reduce((s, g) => s + num(g.weightage), 0);
    return { ...a, goals, goalScore: w ? round2(weighted / w) : null };
  }

  async selfReview(user: AuthUser, id: string, dto: SelfReviewDto) {
    const a = await this.getAppraisal(user, id);
    if (a.employeeId !== user.employeeId) throw new ForbiddenException('You can only review yourself');
    if (a.status !== 'SELF_REVIEW') throw new BadRequestException('Self review is not open');
    const updated = await this.prisma.appraisal.update({ where: { id }, data: { selfRating: dto.selfRating, selfComment: dto.selfComment, status: 'MANAGER_REVIEW' } });
    await this.notifications.notifyEmployee(a.reviewerId, { title: 'Appraisal ready for review', message: `${a.employee.firstName} ${a.employee.lastName} submitted a self-review`, type: 'APPROVAL', link: '/admin/performance' });
    return updated;
  }

  async managerReview(user: AuthUser, id: string, dto: ManagerReviewDto) {
    const a = await this.getAppraisal(user, id);
    await this.access.assertCanApproveFor(user, a.employeeId);
    if (a.status !== 'MANAGER_REVIEW') throw new BadRequestException('Manager review is not open');
    const updated = await this.prisma.appraisal.update({ where: { id }, data: { managerRating: dto.managerRating, managerComment: dto.managerComment, promotionRecommended: !!dto.promotionRecommended, status: 'HR_REVIEW' } });
    await this.notifications.notifyRoles(user.companyId, ['HR_ADMIN'], { title: 'Appraisal awaiting HR review', message: `${a.employee.firstName} ${a.employee.lastName}`, type: 'APPROVAL', link: '/admin/performance' });
    return updated;
  }

  async finalize(user: AuthUser, id: string, dto: HrFinalizeDto) {
    const a = await this.getAppraisal(user, id);
    if (a.status !== 'HR_REVIEW') throw new BadRequestException('Appraisal is not with HR');
    const updated = await this.prisma.appraisal.update({
      where: { id }, data: { finalRating: dto.finalRating, hrComment: dto.hrComment, promotionRecommended: dto.promotionRecommended ?? a.promotionRecommended, salaryRevisionPercent: dto.salaryRevisionPercent, status: 'COMPLETED', completedAt: new Date() },
    });
    await this.notifications.notifyEmployee(a.employeeId, { title: 'Appraisal completed', message: `Your ${a.appraisalCycle.name} appraisal is complete`, type: 'PERFORMANCE', link: '/ess/dashboard' });
    return updated;
  }

  /** Links appraisal outcome to compensation: new structure assignment with CTC × (1 + revision%). */
  async applyRevision(user: AuthUser, id: string, dto: ApplyRevisionDto) {
    const a = await this.getAppraisal(user, id);
    if (a.status !== 'COMPLETED') throw new BadRequestException('Finalise the appraisal first');
    const pct = num(a.salaryRevisionPercent);
    if (pct <= 0) throw new BadRequestException('No salary revision was recorded for this appraisal');
    const current = await this.profile.assignmentAt(a.employeeId, todayIST());
    if (!current) throw new BadRequestException('Employee has no salary structure to revise');
    const newBase = Math.round(num(current.base) * (1 + pct / 100));
    const assignment = await this.setup.assign(user, { employeeId: a.employeeId, salaryStructureId: current.salaryStructureId, fromDate: dto.effectiveFrom, base: newBase, variable: num(current.variable), taxRegime: current.taxRegime });
    await this.notifications.notifyEmployee(a.employeeId, { title: 'Salary revised', message: `Your compensation has been revised effective ${dto.effectiveFrom}`, type: 'PAYROLL', link: '/ess/dashboard' });
    return { previousCtc: num(current.base), newCtc: newBase, assignment };
  }

  /** Rating distribution and completion for a cycle. */
  async cycleSummary(companyId: string, cycleId: string) {
    const rows = await this.prisma.appraisal.findMany({ where: { companyId, appraisalCycleId: cycleId } });
    const byStatus: Record<string, number> = {};
    rows.forEach((r) => (byStatus[r.status] = (byStatus[r.status] || 0) + 1));
    const rated = rows.filter((r) => r.finalRating !== null);
    const dist: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    rated.forEach((r) => (dist[String(Math.round(num(r.finalRating)))] += 1));
    return { total: rows.length, byStatus, ratingDistribution: dist, averageRating: rated.length ? round2(rated.reduce((s, r) => s + num(r.finalRating), 0) / rated.length) : null, promotions: rows.filter((r) => r.promotionRecommended).length };
  }
}
