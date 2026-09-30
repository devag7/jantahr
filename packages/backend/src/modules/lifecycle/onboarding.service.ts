import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role, OnboardingTaskStatus } from '@prisma/client';
import { AccessService } from '../../common/access/access.service';
import { ADMIN_ROLES, AuthUser } from '../../common/types';
import { addDays, todayIST } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OnboardingTemplateDto, UpdateOnboardingTemplateDto } from './lifecycle.dto';

/** What a checklist task needs, whether it comes from a company template or the defaults below. */
type TaskSeed = { title: string; description?: string | null; assignedRole?: string | null; dueInDays?: number | null };

const DEFAULT_TASKS: TaskSeed[] = [
  { title: 'Collect signed offer letter & joining documents', assignedRole: 'HR', dueInDays: 0, description: 'Offer acceptance, ID proof, address proof, education & previous employment documents' },
  { title: 'Create email & system access', assignedRole: 'IT', dueInDays: 0 },
  { title: 'Issue ID card & welcome kit', assignedRole: 'Admin', dueInDays: 1 },
  { title: 'Verify bank & statutory details (PAN, UAN, Aadhaar)', assignedRole: 'HR', dueInDays: 3 },
  { title: 'Acknowledge company policies', assignedRole: 'Employee', dueInDays: 5 },
  { title: 'Orientation & team introduction', assignedRole: 'Manager', dueInDays: 7 },
  { title: 'Set probation goals', assignedRole: 'Manager', dueInDays: 30 },
];

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService, private access: AccessService, private notifications: NotificationsService) {}

  // ---- templates ----
  templates(companyId: string) {
    return this.prisma.onboardingTemplate.findMany({ where: { companyId }, include: { tasks: { orderBy: { sortOrder: 'asc' } } }, orderBy: { name: 'asc' } });
  }

  createTemplate(companyId: string, dto: OnboardingTemplateDto) {
    return this.prisma.onboardingTemplate.create({
      data: { name: dto.name, companyId, isActive: dto.isActive ?? true, tasks: { create: dto.tasks.map((t, i) => ({ ...t, sortOrder: i })) } }, include: { tasks: true },
    });
  }

  async updateTemplate(companyId: string, id: string, dto: UpdateOnboardingTemplateDto) {
    if (!(await this.prisma.onboardingTemplate.findFirst({ where: { id, companyId } }))) throw new NotFoundException('Template not found');
    return this.prisma.$transaction(async (tx) => {
      if (dto.tasks) await tx.onboardingTemplateTask.deleteMany({ where: { templateId: id } });
      return tx.onboardingTemplate.update({
        where: { id },
        data: { ...(dto.name ? { name: dto.name } : {}), ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}), ...(dto.tasks ? { tasks: { create: dto.tasks.map((t, i) => ({ ...t, sortOrder: i })) } } : {}) },
        include: { tasks: true },
      });
    });
  }

  // ---- instances ----
  async startFor(employeeId: string, companyId: string) {
    if (await this.prisma.employeeOnboarding.findUnique({ where: { employeeId } })) return null;
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
    const template = await this.prisma.onboardingTemplate.findFirst({ where: { companyId, isActive: true }, include: { tasks: { orderBy: { sortOrder: 'asc' } } }, orderBy: { createdAt: 'asc' } });
    const tasks: TaskSeed[] = template?.tasks.length ? template.tasks : DEFAULT_TASKS;
    const start = emp.dateOfJoining > todayIST() ? emp.dateOfJoining : todayIST();
    return this.prisma.employeeOnboarding.create({
      data: {
        employeeId, companyId, templateId: template?.id, startDate: start,
        tasks: { create: tasks.map((t, i) => ({ title: t.title, description: t.description, assignedTo: t.assignedRole, dueDate: addDays(start, t.dueInDays ?? 0), sortOrder: i })) },
      },
    });
  }

  async list(companyId: string, includeCompleted = false) {
    const rows = await this.prisma.employeeOnboarding.findMany({
      where: { companyId, ...(includeCompleted ? {} : { completedAt: null }) },
      include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, dateOfJoining: true, department: { select: { name: true } } } }, tasks: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { startDate: 'desc' }, take: 200,
    });
    return rows.map((r) => this.withProgress(r));
  }

  private withProgress<T extends { tasks: { status: string }[] }>(r: T) {
    const done = r.tasks.filter((t) => t.status === 'COMPLETED' || t.status === 'SKIPPED').length;
    return { ...r, progress: { done, total: r.tasks.length, percent: r.tasks.length ? Math.round((done / r.tasks.length) * 100) : 0 } };
  }

  async getForEmployee(user: AuthUser, employeeId: string) {
    await this.access.assertEmployeeAccess(user, employeeId);
    const r = await this.prisma.employeeOnboarding.findUnique({
      where: { employeeId }, include: { employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true } }, tasks: { orderBy: { sortOrder: 'asc' } } },
    });
    return r ? this.withProgress(r) : null;
  }

  async updateTask(user: AuthUser, taskId: string, status: string, remarks?: string) {
    const task = await this.prisma.employeeOnboardingTask.findUnique({ where: { id: taskId }, include: { onboarding: true } });
    if (!task || task.onboarding.companyId !== user.companyId) throw new NotFoundException('Task not found');
    const isOwnerEmployee = task.onboarding.employeeId === user.employeeId && task.assignedTo === 'Employee';
    if (!ADMIN_ROLES.includes(user.role) && !isOwnerEmployee && !(user.role === Role.MANAGER && task.assignedTo === 'Manager')) throw new ForbiddenException('You cannot update this task');
    await this.prisma.employeeOnboardingTask.update({ where: { id: taskId }, data: { status: status as OnboardingTaskStatus, remarks, completedAt: status === 'COMPLETED' ? new Date() : null } });
    const remaining = await this.prisma.employeeOnboardingTask.count({ where: { onboardingId: task.onboardingId, status: { in: ['PENDING', 'IN_PROGRESS'] } } });
    await this.prisma.employeeOnboarding.update({ where: { id: task.onboardingId }, data: { completedAt: remaining === 0 ? new Date() : null } });
    return this.getForEmployee(user, task.onboarding.employeeId);
  }

  async remind(companyId: string) {
    const overdue = await this.prisma.employeeOnboardingTask.findMany({ where: { onboarding: { companyId }, status: { in: ['PENDING', 'IN_PROGRESS'] }, dueDate: { lt: todayIST() } }, include: { onboarding: { include: { employee: true } } } });
    if (overdue.length) await this.notifications.notifyRoles(companyId, ['HR_ADMIN'], { title: 'Overdue onboarding tasks', message: `${overdue.length} onboarding task(s) are overdue`, type: 'REMINDER', link: '/admin/lifecycle' });
    return { overdue: overdue.length };
  }
}
