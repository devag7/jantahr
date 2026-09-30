import { Role } from '@prisma/client';
import { AccessService } from './access.service';
import { AuthUser } from '../types';

// e1 (CEO) <- e2 (payroll admin) <- e3 (employee) <- e4 (employee); e2 <- e5 (auditor) <- e6 (employee)
const EMPLOYEES = [
  { id: 'e1', reportingManagerId: null },
  { id: 'e2', reportingManagerId: 'e1' },
  { id: 'e3', reportingManagerId: 'e2' },
  { id: 'e4', reportingManagerId: 'e3' },
  { id: 'e5', reportingManagerId: 'e2' },
  { id: 'e6', reportingManagerId: 'e5' },
];
const prisma = {
  employee: {
    findMany: async () => EMPLOYEES,
    count: async ({ where }: { where: { reportingManagerId: string } }) => EMPLOYEES.filter((e) => e.reportingManagerId === where.reportingManagerId).length,
  },
};
const access = new AccessService(prisma as never);
const as = (role: Role, employeeId: string | null): AuthUser => ({ userId: `u-${employeeId}`, email: 'x@y.in', role, companyId: 'c1', employeeId });

describe('AccessService approval rules (reporting line, not the MANAGER role)', () => {
  it('lets any non-auditor approve for their direct and upline reportees', async () => {
    const payroll = as(Role.PAYROLL_ADMIN, 'e2');
    expect(await access.canApproveFor(payroll, 'e3')).toBe(true);
    expect(await access.canApproveFor(payroll, 'e4')).toBe(true);
    expect(await access.canApproveFor(as(Role.EMPLOYEE, 'e3'), 'e4')).toBe(true);
  });
  it('refuses auditors, self-approval and people outside the reporting line', async () => {
    expect(await access.canApproveFor(as(Role.AUDITOR, 'e5'), 'e6')).toBe(false);
    expect(await access.canApproveFor(as(Role.EMPLOYEE, 'e3'), 'e3')).toBe(false);
    expect(await access.canApproveFor(as(Role.MANAGER, 'e3'), 'e2')).toBe(false);
    expect(await access.canApproveFor(as(Role.EMPLOYEE, 'e4'), 'e3')).toBe(false);
    expect(await access.canApproveFor(as(Role.MANAGER, null), 'e3')).toBe(false);
  });
  it('lets admins approve for anyone', async () => {
    expect(await access.canApproveFor(as(Role.HR_ADMIN, 'e4'), 'e1')).toBe(true);
  });
  it('flags approval duties by reporting line', async () => {
    expect(await access.hasApprovalDuties(as(Role.PAYROLL_ADMIN, 'e2'))).toBe(true);
    expect(await access.hasApprovalDuties(as(Role.EMPLOYEE, 'e4'))).toBe(false);
    expect(await access.hasApprovalDuties(as(Role.AUDITOR, 'e5'))).toBe(false);
  });
  it('scopes "waiting on me" lists to what the user may decide', async () => {
    expect((await access.approvalFilter(as(Role.PAYROLL_ADMIN, 'e2'))).employeeId).toEqual({ in: expect.arrayContaining(['e3', 'e4', 'e5', 'e6']) });
    expect(await access.approvalFilter(as(Role.AUDITOR, 'e5'))).toEqual({ employeeId: { in: [] } });
    expect(await access.approvalFilter(as(Role.SUPER_ADMIN, 'e1'))).toEqual({ employeeId: { not: 'e1' } });
  });
  it('gives line managers of any role their team as data scope', async () => {
    expect(await access.scopeEmployeeIds(as(Role.EMPLOYEE, 'e3'))).toEqual(['e3', 'e4']);
    expect(await access.scopeEmployeeIds(as(Role.EMPLOYEE, 'e4'))).toEqual(['e4']);
  });
});
