import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AccessService } from '../../common/access/access.service';
import { ADMIN_ROLES, AuthUser, PAYROLL_ROLES } from '../../common/types';
import { addDays, diffDays, isoDate, todayIST, toDateOnly, yearsBetween } from '../../common/utils/dates';
import { num, round2 } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaveBalanceService } from '../leave/leave-balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { calcGratuity } from '../payroll/engine/statutory';
import { PayProfileService } from '../payroll/runs/pay-profile.service';
import { PayrollService } from '../payroll/runs/payroll.service';
import { ClearanceUpdateDto, FnfDto, InitiateSeparationDto, ResignDto, SeparationDecisionDto } from './lifecycle.dto';
import PDFDocument = require('pdfkit');
import { AccountDirectory } from '../identity/account-directory.service';
import { IdentityService } from '../identity/identity.service';

const CLEARANCE_DEPARTMENTS = ['Reporting Manager', 'IT', 'Admin', 'Finance', 'HR'];

const SEP_INCLUDE = {
  employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, dateOfJoining: true, department: { select: { name: true } }, designation: { select: { name: true } } } },
  clearances: true,
  fnfSettlement: true,
};

@Injectable()
export class SeparationService {
  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private notifications: NotificationsService,
    private profile: PayProfileService,
    private payroll: PayrollService,
    private balances: LeaveBalanceService,
    private identity: IdentityService,
    private accounts: AccountDirectory,
  ) {}

  // ---- initiation ----
  async resign(user: AuthUser, dto: ResignDto) {
    const empId = this.access.requireEmployee(user);
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: empId } });
    if (await this.prisma.employeeSeparation.findUnique({ where: { employeeId: empId } })) throw new BadRequestException('A separation is already in progress for you');
    const notice = emp.noticeperiodDays ?? 30;
    const today = todayIST();
    const lwd = dto.lastWorkingDate ? toDateOnly(dto.lastWorkingDate) : addDays(today, notice);
    if (lwd < today) throw new BadRequestException('Last working date cannot be in the past');
    const sep = await this.prisma.employeeSeparation.create({
      data: { employeeId: empId, companyId: user.companyId, separationType: 'RESIGNATION', resignationDate: today, lastWorkingDate: lwd, noticePeriodDays: notice, exitInterviewNotes: dto.reason },
      include: SEP_INCLUDE,
    });
    await this.notifications.notifyApproverOf(empId, user.companyId, { title: 'Resignation submitted', message: `${emp.firstName} ${emp.lastName} has resigned (LWD ${isoDate(lwd)})`, type: 'APPROVAL', link: '/admin/lifecycle' });
    return sep;
  }

  async initiate(user: AuthUser, dto: InitiateSeparationDto) {
    const emp = await this.prisma.employee.findFirst({ where: { id: dto.employeeId, companyId: user.companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    if (emp.status === 'LEFT') throw new BadRequestException('Employee has already left');
    if (await this.prisma.employeeSeparation.findUnique({ where: { employeeId: emp.id } })) throw new BadRequestException('A separation already exists for this employee');
    const sep = await this.prisma.employeeSeparation.create({
      data: {
        employeeId: emp.id, companyId: user.companyId, separationType: dto.separationType, resignationDate: todayIST(), lastWorkingDate: toDateOnly(dto.lastWorkingDate),
        noticePeriodDays: dto.noticePeriodDays ?? emp.noticeperiodDays ?? 30, exitInterviewNotes: dto.reason, status: 'APPROVED',
        clearances: { create: CLEARANCE_DEPARTMENTS.map((department) => ({ department })) },
      },
      include: SEP_INCLUDE,
    });
    await this.prisma.employee.update({ where: { id: emp.id }, data: { dateOfResignation: todayIST(), lastWorkingDate: sep.lastWorkingDate } });
    return sep;
  }

  async list(user: AuthUser) {
    const scope = await this.access.scopeEmployeeIds(user);
    return this.prisma.employeeSeparation.findMany({ where: { companyId: user.companyId, ...(scope ? { employeeId: { in: scope } } : {}) }, include: SEP_INCLUDE, orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async getOne(user: AuthUser, id: string) {
    const s = await this.prisma.employeeSeparation.findFirst({ where: { id, companyId: user.companyId }, include: SEP_INCLUDE });
    if (!s) throw new NotFoundException('Separation not found');
    await this.access.assertEmployeeAccess(user, s.employeeId);
    return s;
  }

  async decide(user: AuthUser, id: string, approve: boolean, dto: SeparationDecisionDto) {
    const s = await this.getOne(user, id);
    await this.access.assertCanApproveFor(user, s.employeeId);
    if (s.status !== 'PENDING') throw new BadRequestException('Already processed');
    if (!approve) {
      await this.prisma.employeeSeparation.delete({ where: { id } });
      await this.notifications.notifyEmployee(s.employeeId, { title: 'Resignation not accepted', message: dto.comment || 'Please speak to HR', type: 'LIFECYCLE', link: '/ess/dashboard' });
      return { rejected: true };
    }
    const lwd = dto.lastWorkingDate ? toDateOnly(dto.lastWorkingDate) : s.lastWorkingDate!;
    await this.prisma.$transaction([
      this.prisma.employeeSeparation.update({ where: { id }, data: { status: 'APPROVED', lastWorkingDate: lwd, clearances: { create: CLEARANCE_DEPARTMENTS.map((department) => ({ department })) } } }),
      this.prisma.employee.update({ where: { id: s.employeeId }, data: { dateOfResignation: s.resignationDate, lastWorkingDate: lwd } }),
    ]);
    await this.notifications.notifyEmployee(s.employeeId, { title: 'Resignation accepted', message: `Your last working day is ${isoDate(lwd)}`, type: 'LIFECYCLE', link: '/ess/dashboard' });
    return this.getOne(user, id);
  }

  async updateClearance(user: AuthUser, clearanceId: string, dto: ClearanceUpdateDto) {
    const c = await this.prisma.exitClearance.findUnique({ where: { id: clearanceId }, include: { separation: true } });
    if (!c || c.separation.companyId !== user.companyId) throw new NotFoundException('Clearance not found');
    return this.prisma.exitClearance.update({ where: { id: clearanceId }, data: { status: dto.status, remarks: dto.remarks, clearedBy: user.userId, clearedAt: dto.status === 'PENDING' ? null : new Date() } });
  }

  async exitInterview(user: AuthUser, id: string, notes: string) {
    const s = await this.getOne(user, id);
    return this.prisma.employeeSeparation.update({ where: { id: s.id }, data: { exitInterviewDone: true, exitInterviewNotes: [s.exitInterviewNotes, `Exit interview: ${notes}`].filter(Boolean).join('\n') } });
  }

  // ---- Full & Final ----
  async computeFnf(user: AuthUser, separationId: string, dto: FnfDto) {
    const s = await this.getOne(user, separationId);
    if (s.status !== 'APPROVED') throw new BadRequestException('Separation must be approved before F&F');
    const lwd = s.lastWorkingDate!;
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: s.employeeId } });
    const notes: string[] = [];

    // 1. last month salary — treated as paid if that month's payroll is already approved
    const paidSlip = await this.prisma.salarySlip.findFirst({ where: { employeeId: emp.id, month: lwd.getUTCMonth() + 1, year: lwd.getUTCFullYear(), status: { in: ['APPROVED', 'PAID'] } } });
    let lastSalary = 0;
    if (paidSlip) notes.push('Final month salary already processed in payroll');
    else {
      const res = await this.payroll.computeSlip(user.companyId, emp.id, lwd.getUTCFullYear(), lwd.getUTCMonth() + 1, {});
      if (res.ok) lastSalary = Math.max(0, res.slip.netPay);
      else notes.push(`Final month salary not computed: ${res.reason}`);
    }

    // 2. leave encashment of encashable balances
    const bal = await this.balances.getBalances(emp.id, lwd);
    const encashable = await this.prisma.leaveType.findMany({ where: { companyId: user.companyId, isEncashable: true } });
    const wagesBase = (await this.profile.getCodeWagesMonthly(emp.id, lwd, user.companyId)).wages;
    let encashDays = 0;
    for (const lt of encashable) {
      const b = bal.find((x) => x.leaveTypeId === lt.id);
      if (!b || b.available <= 0) continue;
      encashDays += lt.maxEncashableDays ? Math.min(b.available, num(lt.maxEncashableDays)) : b.available;
    }
    const leaveEncashment = Math.round((wagesBase / 30) * encashDays);

    // 3. gratuity
    const years = yearsBetween(emp.dateOfJoining, lwd);
    const g = calcGratuity(wagesBase, years, { fixedTerm: /fixed/i.test(emp.employmentType ?? '') });
    const gratuity = g.amount;
    if (!g.eligible) notes.push(`Gratuity not applicable (${round2(years)} years of service; needs ~5 years, or 1 year for fixed-term staff)`);

    // 4. notice period shortfall recovery
    const served = s.resignationDate ? Math.max(0, diffDays(lwd, s.resignationDate)) : s.noticePeriodDays;
    const shortfall = s.separationType === 'RESIGNATION' ? Math.max(0, s.noticePeriodDays - served) : 0;
    const gross = await this.profile.getGrossMonthly(emp.id, lwd);
    const noticeRecovery = Math.round((gross / 30) * shortfall);
    if (shortfall) notes.push(`Notice shortfall ${shortfall} day(s)`);

    // 5. outstanding loans
    const loans = await this.prisma.employeeLoan.aggregate({ where: { employeeId: emp.id, status: 'ACTIVE' }, _sum: { outstanding: true } });
    const loanRecovery = Math.round(num(loans._sum.outstanding));

    const deductions = noticeRecovery + Math.round(dto.otherDeductions ?? 0);
    const bonus = Math.round(dto.bonusAmount ?? 0);
    const net = round2(lastSalary + leaveEncashment + gratuity + bonus - deductions - loanRecovery);

    const data = { lastSalary, leaveEncashmentAmount: leaveEncashment, gratuityAmount: gratuity, bonusAmount: bonus, deductions, recoveries: loanRecovery, netPayable: net, status: 'PENDING' as const };
    const fnf = await this.prisma.fnFSettlement.upsert({ where: { separationId }, create: { separationId, ...data }, update: data });
    await this.prisma.employeeSeparation.update({ where: { id: separationId }, data: { noticePeriodServed: served, shortfallDays: shortfall } });
    return { ...fnf, breakdown: { encashDays, wagesMonthly: wagesBase, yearsOfService: round2(years), gratuityEligible: g.eligible, noticeShortfallDays: shortfall, noticeRecovery, loanRecovery }, notes };
  }

  async approveFnf(user: AuthUser, separationId: string) {
    const s = await this.getOne(user, separationId);
    if (!s.fnfSettlement) throw new BadRequestException('Compute the F&F settlement first');
    if (s.fnfSettlement.status === 'APPROVED') throw new BadRequestException('F&F already approved');
    const pending = s.clearances.filter((c) => c.status === 'PENDING').map((c) => c.department);
    if (pending.length) throw new BadRequestException(`Pending exit clearance: ${pending.join(', ')}`);
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: s.employeeId } });
    const lastDrawn = (await this.profile.getCodeWagesMonthly(emp.id, s.lastWorkingDate!, user.companyId)).wages;
    await this.prisma.$transaction(async (tx) => {
      await tx.fnFSettlement.update({ where: { separationId }, data: { status: 'APPROVED', processedAt: new Date() } });
      if (num(s.fnfSettlement!.gratuityAmount) > 0) {
        await tx.gratuity.create({
          data: { employeeId: emp.id, companyId: user.companyId, gratuityAmount: s.fnfSettlement!.gratuityAmount, yearsOfService: round2(yearsBetween(emp.dateOfJoining, s.lastWorkingDate!)), lastDrawnSalary: lastDrawn, status: 'APPROVED' },
        });
      }
      await tx.employeeLoan.updateMany({ where: { employeeId: emp.id, status: 'ACTIVE' }, data: { status: 'CLOSED', outstanding: 0 } });
    });
    return this.getOne(user, separationId);
  }

  /** Marks the employee as LEFT and deactivates access. Requires approved F&F. */
  async complete(user: AuthUser, separationId: string) {
    const s = await this.getOne(user, separationId);
    if (s.fnfSettlement?.status !== 'APPROVED') throw new BadRequestException('Approve the F&F settlement before completing separation');
    const emp = await this.prisma.employee.findUniqueOrThrow({ where: { id: s.employeeId } });
    const [, account] = await this.prisma.$transaction([
      this.prisma.employee.update({ where: { id: emp.id }, data: { status: 'LEFT', lastWorkingDate: s.lastWorkingDate } }),
      this.prisma.user.update({ where: { id: emp.userId }, data: { isActive: false, sessionsRevokedAt: new Date() } }),
    ]);
    if (account.authId) {
      await this.identity.setBanned(account.authId, true);
      await this.identity.revokeSessions(account.authId);
      this.accounts.forget(account.authId);
    }
    return this.getOne(user, separationId);
  }

  // ---- letters ----
  async letter(user: AuthUser, separationId: string, kind: 'relieving' | 'experience') {
    const s = await this.getOne(user, separationId);
    if (!PAYROLL_ROLES.includes(user.role) && !ADMIN_ROLES.includes(user.role)) throw new BadRequestException('Only HR can issue letters');
    if (s.fnfSettlement?.status !== 'APPROVED') throw new BadRequestException('Letters can be issued only after the F&F settlement is approved');
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: user.companyId } });
    const name = `${s.employee.firstName} ${s.employee.lastName}`.trim();
    const doc = new PDFDocument({ size: 'A4', margin: 64 });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c));
    const end = new Promise<Buffer>((res) => doc.on('end', () => res(Buffer.concat(chunks))));
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1e3a8a').text(company.legalName || company.name);
    doc.font('Helvetica').fontSize(9).fillColor('#64748b').text([company.address, company.city, company.state, company.pincode].filter(Boolean).join(', '));
    doc.moveDown(2).fillColor('#0f172a').fontSize(10).text(`Date: ${isoDate(todayIST())}`);
    doc.moveDown().font('Helvetica-Bold').fontSize(13).text(kind === 'relieving' ? 'RELIEVING LETTER' : 'EXPERIENCE CERTIFICATE', { align: 'center' });
    doc.moveDown(1.5).font('Helvetica').fontSize(11);
    const designation = s.employee.designation?.name || 'Employee';
    if (kind === 'relieving') {
      doc.text(`To whom it may concern,\n\nThis is to certify that ${name} (Employee ID ${s.employee.employeeCode}), working as ${designation}, has been relieved from the services of ${company.name} with effect from the close of business hours on ${isoDate(s.lastWorkingDate!)}.\n\nAll dues have been settled and there are no outstanding obligations from either side as of the date of this letter. We thank ${name} for the contributions made and wish success in future endeavours.`, { align: 'justify', lineGap: 4 });
    } else {
      doc.text(`To whom it may concern,\n\nThis is to certify that ${name} (Employee ID ${s.employee.employeeCode}) was employed with ${company.name} as ${designation}${s.employee.department ? ` in the ${s.employee.department.name} department` : ''} from ${isoDate(s.employee.dateOfJoining)} to ${isoDate(s.lastWorkingDate!)}.\n\nDuring this tenure, ${name}'s conduct was found to be satisfactory. We wish them all the best.`, { align: 'justify', lineGap: 4 });
    }
    doc.moveDown(4).font('Helvetica-Bold').text('Authorised Signatory').font('Helvetica').text(company.name);
    doc.end();
    const buffer = await end;
    await this.prisma.employeeSeparation.update({ where: { id: separationId }, data: kind === 'relieving' ? { relievingLetterIssued: true } : { experienceLetterIssued: true } });
    return { buffer, filename: `${kind === 'relieving' ? 'Relieving' : 'Experience'}_${s.employee.employeeCode}.pdf` };
  }
}
