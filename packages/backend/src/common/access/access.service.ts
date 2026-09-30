import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ADMIN_ROLES, AuthUser, READ_ALL_ROLES } from '../types';

/**
 * Central place for data-scope rules:
 *  - HR/Payroll/Super Admin/Auditor: whole company (auditor read-only, enforced by @Roles on writes)
 *  - Everyone else: self + all direct/indirect reportees (none for an individual contributor)
 *
 * Approval rights follow the reporting line, not the MANAGER role: admins approve for anyone,
 * any other non-auditor approves for the employees who report to them (directly or upline).
 */
@Injectable()
export class AccessService {
  constructor(private prisma: PrismaService) {}

  async getReporteeIds(managerEmployeeId: string, companyId: string): Promise<string[]> {
    if (!(await this.hasDirectReports(managerEmployeeId, companyId))) return [];
    const all = await this.prisma.employee.findMany({
      where: { companyId, status: { not: 'LEFT' } },
      select: { id: true, reportingManagerId: true },
    });
    const byManager = new Map<string, string[]>();
    for (const e of all) {
      if (!e.reportingManagerId) continue;
      const arr = byManager.get(e.reportingManagerId) || [];
      arr.push(e.id);
      byManager.set(e.reportingManagerId, arr);
    }
    const out: string[] = [];
    const stack = [managerEmployeeId];
    const seen = new Set<string>([managerEmployeeId]);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const c of byManager.get(cur) || []) {
        if (!seen.has(c)) {
          seen.add(c);
          out.push(c);
          stack.push(c);
        }
      }
    }
    return out;
  }

  hasDirectReports(managerEmployeeId: string, companyId: string): Promise<boolean> {
    return this.prisma.employee.count({ where: { companyId, reportingManagerId: managerEmployeeId, status: { not: 'LEFT' } } }).then((n) => n > 0);
  }

  /** Whether the user approves anything for someone (drives the Team/Approvals area in the apps). */
  async hasApprovalDuties(user: AuthUser): Promise<boolean> {
    if (user.role === Role.AUDITOR || !user.employeeId) return false;
    return this.hasDirectReports(user.employeeId, user.companyId);
  }

  isCompanyWide(user: AuthUser): boolean {
    return READ_ALL_ROLES.includes(user.role);
  }

  isAdmin(user: AuthUser): boolean {
    return ADMIN_ROLES.includes(user.role);
  }

  /** Returns null when company-wide access (no employee filter), otherwise the list of accessible employee ids. */
  async scopeEmployeeIds(user: AuthUser): Promise<string[] | null> {
    if (this.isCompanyWide(user)) return null;
    if (!user.employeeId) return [];
    return [user.employeeId, ...(await this.getReporteeIds(user.employeeId, user.companyId))];
  }

  async assertEmployeeAccess(user: AuthUser, employeeId: string): Promise<void> {
    const emp = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId: user.companyId }, select: { id: true } });
    if (!emp) throw new NotFoundException('Employee not found');
    const scope = await this.scopeEmployeeIds(user);
    if (scope && !scope.includes(employeeId)) throw new ForbiddenException('You cannot access this employee record');
  }

  /** Approval permission: HR/Admin always; otherwise the employee's reporting manager (direct or upline), whatever their role, except auditors. */
  async canApproveFor(user: AuthUser, employeeId: string): Promise<boolean> {
    if (this.isAdmin(user)) return true;
    if (user.role === Role.AUDITOR || !user.employeeId) return false;
    if (employeeId === user.employeeId) return false; // no self-approval
    return (await this.getReporteeIds(user.employeeId, user.companyId)).includes(employeeId);
  }

  /**
   * Prisma `where` fragment for "requests waiting on me": admins see everyone but themselves,
   * others see their reporting line, auditors and users without an employee profile see nothing.
   */
  async approvalFilter(user: AuthUser): Promise<{ employeeId?: { in: string[] } | { not: string } }> {
    if (this.isAdmin(user)) return user.employeeId ? { employeeId: { not: user.employeeId } } : {};
    if (user.role === Role.AUDITOR || !user.employeeId) return { employeeId: { in: [] } };
    return { employeeId: { in: await this.getReporteeIds(user.employeeId, user.companyId) } };
  }

  async assertCanApproveFor(user: AuthUser, employeeId: string): Promise<void> {
    if (!(await this.canApproveFor(user, employeeId))) throw new ForbiddenException('You are not an approver for this employee');
  }

  requireEmployee(user: AuthUser): string {
    if (!user.employeeId) throw new ForbiddenException('No employee profile is linked to this account');
    return user.employeeId;
  }
}
