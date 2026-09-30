/**
 * Demo data seed. Drives the real application services (not raw inserts) so encryption, leave allocation,
 * onboarding, payroll and TDS all run through production code paths.
 *
 *   pnpm db:seed          (idempotent: exits if the demo company already exists)
 *
 * Logins — admin@jantahr.com / Admin@123 ; every other demo user / Demo@1234
 */
import { annualDueDates, monthlyDueDates } from '../src/modules/compliance/compliance-calendar';
import { salaryTdsLaw } from '../src/modules/payroll/engine/tax-forms';
import { NestFactory } from '@nestjs/core';
import { Prisma, ApplicantStage, Role } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { CryptoService } from '../src/common/crypto/crypto.service';
import { AuthUser } from '../src/common/types';
import { addDays, eachDay, fiscalYearRange, fiscalYearStartYear, isoDate, istInstant, todayIST, toDateOnly, utcDate } from '../src/common/utils/dates';
import { PrismaService } from '../src/prisma/prisma.service';
import { errorMessage } from '../src/common/utils/errors';
import { IdentityService } from '../src/modules/identity/identity.service';
import { CompanySetupService } from '../src/modules/core-hr/company-setup.service';
import { CalendarService } from '../src/modules/calendar/calendar.service';
import { EmployeesService } from '../src/modules/core-hr/employees/employees.service';
import { CreateEmployeeDto } from '../src/modules/core-hr/employees/employee.dto';
import { EngagementService } from '../src/modules/core-hr/announcements/engagement.service';
import { LeaveAllocationService } from '../src/modules/leave/leave-allocation.service';
import { LeaveApplicationService } from '../src/modules/leave/leave-application.service';
import { PayrollService } from '../src/modules/payroll/runs/payroll.service';
import { PayrollRunService } from '../src/modules/payroll/runs/payroll-run.service';
import { SalarySetupService } from '../src/modules/payroll/setup/salary-setup.service';
import { TaxDeclarationService } from '../src/modules/payroll/tax/tax-declaration.service';
import { PerformanceService } from '../src/modules/performance/performance.service';
import { ExpensesService } from '../src/modules/expenses/expenses.service';
import { HelpdeskService } from '../src/modules/helpdesk/helpdesk.service';
import { RecruitmentService } from '../src/modules/recruitment/recruitment.service';
import { SeparationService } from '../src/modules/lifecycle/separation.service';
import { AttendanceService } from '../src/modules/attendance/attendance.service';

const ADMIN_PASSWORD = 'Admin@123';
const DEMO_PASSWORD = 'Demo@1234';

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Seed {
  code: string; first: string; last: string; email: string; gender: 'MALE' | 'FEMALE'; dept: string; desig: string; ctc: number;
  yearsAgo: number; manager?: string; role?: Role; state?: string; city?: string; dob: string; pan: string; uan: string; regime?: 'OLD' | 'NEW'; type?: string; phone: string;
}

const PEOPLE: Seed[] = [
  { code: 'EMP001', first: 'Aarav', last: 'Mehta', email: 'admin@jantahr.com', gender: 'MALE', dept: 'Management', desig: 'Chief Executive Officer', ctc: 6000000, yearsAgo: 7, role: 'SUPER_ADMIN', dob: '1982-03-14', pan: 'AAMPM1001A', uan: '100200300401', phone: '9820000001', regime: 'NEW' },
  { code: 'EMP002', first: 'Priya', last: 'Nair', email: 'hr@jantahr.com', gender: 'FEMALE', dept: 'Human Resources', desig: 'HR Manager', ctc: 1800000, yearsAgo: 5.2, manager: 'EMP001', role: 'HR_ADMIN', dob: '1988-11-02', pan: 'BBNPN2002B', uan: '100200300402', phone: '9820000002' },
  { code: 'EMP003', first: 'Rohan', last: 'Kulkarni', email: 'payroll@jantahr.com', gender: 'MALE', dept: 'Finance', desig: 'Payroll Manager', ctc: 1500000, yearsAgo: 4.4, manager: 'EMP001', role: 'PAYROLL_ADMIN', dob: '1990-06-21', pan: 'CCKPK3003C', uan: '100200300403', phone: '9820000003', regime: 'OLD' },
  { code: 'EMP004', first: 'Neha', last: 'Sharma', email: 'manager@jantahr.com', gender: 'FEMALE', dept: 'Engineering', desig: 'Engineering Manager', ctc: 3200000, yearsAgo: 4.1, manager: 'EMP001', role: 'MANAGER', dob: '1987-01-30', pan: 'DDSPS4004D', uan: '100200300404', phone: '9820000004', regime: 'OLD' },
  { code: 'EMP005', first: 'Vikram', last: 'Singh', email: 'employee@jantahr.com', gender: 'MALE', dept: 'Engineering', desig: 'Senior Software Engineer', ctc: 2200000, yearsAgo: 3.3, manager: 'EMP004', role: 'EMPLOYEE', dob: '1992-08-09', pan: 'EESPS5005E', uan: '100200300405', phone: '9820000005', regime: 'OLD' },
  { code: 'EMP006', first: 'Ananya', last: 'Reddy', email: 'ananya.reddy@jantahr.com', gender: 'FEMALE', dept: 'Engineering', desig: 'Software Engineer', ctc: 1400000, yearsAgo: 2.2, manager: 'EMP004', dob: '1995-02-17', pan: 'FFRPR6006F', uan: '100200300406', phone: '9820000006', state: 'Karnataka', city: 'Bengaluru' },
  { code: 'EMP007', first: 'Karan', last: 'Patel', email: 'karan.patel@jantahr.com', gender: 'MALE', dept: 'Engineering', desig: 'Software Engineer', ctc: 1200000, yearsAgo: 1.6, manager: 'EMP004', dob: '1996-10-05', pan: 'GGPPP7007G', uan: '100200300407', phone: '9820000007' },
  { code: 'EMP008', first: 'Sneha', last: 'Gupta', email: 'sneha.gupta@jantahr.com', gender: 'FEMALE', dept: 'Engineering', desig: 'QA Engineer', ctc: 1000000, yearsAgo: 0.9, manager: 'EMP004', dob: '1997-04-23', pan: 'HHGPG8008H', uan: '100200300408', phone: '9820000008' },
  { code: 'EMP009', first: 'Arjun', last: 'Verma', email: 'arjun.verma@jantahr.com', gender: 'MALE', dept: 'Sales', desig: 'Sales Manager', ctc: 2600000, yearsAgo: 3.8, manager: 'EMP001', role: 'MANAGER', dob: '1989-12-12', pan: 'IIVPV9009I', uan: '100200300409', phone: '9820000009', regime: 'OLD' },
  { code: 'EMP010', first: 'Divya', last: 'Iyer', email: 'divya.iyer@jantahr.com', gender: 'FEMALE', dept: 'Sales', desig: 'Account Executive', ctc: 900000, yearsAgo: 2.0, manager: 'EMP009', dob: '1994-07-19', pan: 'JJIPI1010J', uan: '100200300410', phone: '9820000010', state: 'Karnataka', city: 'Bengaluru' },
  { code: 'EMP011', first: 'Manish', last: 'Joshi', email: 'manish.joshi@jantahr.com', gender: 'MALE', dept: 'Sales', desig: 'Account Executive', ctc: 850000, yearsAgo: 1.1, manager: 'EMP009', dob: '1993-09-27', pan: 'KKJPJ1111K', uan: '100200300411', phone: '9820000011' },
  { code: 'EMP012', first: 'Pooja', last: 'Desai', email: 'pooja.desai@jantahr.com', gender: 'FEMALE', dept: 'Finance', desig: 'Accountant', ctc: 700000, yearsAgo: 2.6, manager: 'EMP003', dob: '1994-05-11', pan: 'LLDPD1212L', uan: '100200300412', phone: '9820000012' },
  { code: 'EMP013', first: 'Sameer', last: 'Khan', email: 'sameer.khan@jantahr.com', gender: 'MALE', dept: 'Operations', desig: 'Operations Executive', ctc: 240000, yearsAgo: 1.3, manager: 'EMP001', dob: '1999-01-08', pan: 'MMKPK1313M', uan: '100200300413', phone: '9820000013', type: 'Full-time' },
  { code: 'EMP014', first: 'Ritu', last: 'Malhotra', email: 'ritu.malhotra@jantahr.com', gender: 'FEMALE', dept: 'Operations', desig: 'Office Administrator', ctc: 300000, yearsAgo: 0.7, manager: 'EMP001', dob: '1998-03-03', pan: 'NNMPM1414N', uan: '100200300414', phone: '9820000014' },
  { code: 'EMP015', first: 'Tanvi', last: 'Bhatt', email: 'auditor@jantahr.com', gender: 'FEMALE', dept: 'Finance', desig: 'External Auditor', ctc: 1200000, yearsAgo: 0.2, manager: 'EMP003', role: 'AUDITOR', dob: '1991-09-15', pan: 'OOBPB1515O', uan: '100200300415', phone: '9820000015' },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const prisma = app.get(PrismaService);
  const log = (m: string) => console.log(`  ${m}`);

  if (await prisma.user.findUnique({ where: { email: 'admin@jantahr.com' } })) {
    console.log('Demo data already present, nothing to do. (Run `pnpm --filter jantahr-backend exec prisma migrate reset` to start over.)');
    await app.close();
    return;
  }
  console.log('🌱 Seeding JantaHR demo data...');

  const today = todayIST();
  const fyStart = fiscalYearStartYear(today);
  // Payroll history: the last PAID_MONTHS completed months, whatever today's date (so the demo and the e2e suite
  // look the same in April as in March).
  const PAID_MONTHS = 6;
  const historyStart = utcDate(today.getUTCFullYear(), today.getUTCMonth() + 1 - PAID_MONTHS, 1);
  const fy = fiscalYearRange(fyStart);

  await app.get(CompanySetupService).ensureGlobalMasterData();

  // ---- company + bootstrap defaults ---------------------------------------
  const company = await prisma.$transaction(async (tx) => {
    const c = await tx.company.create({
      data: {
        name: 'Sahyadri Softworks', legalName: 'Sahyadri Softworks Private Limited', registrationNumber: 'U72900MH2018PTC123456', pan: 'AABCA1234C', tan: 'MUMA12345B', pfNumber: 'MHBAN1234567000', esiNumber: '31000123450000999',
        ptRegistration: 'PT/27/123456', gstin: '27AABCA1234C1Z5', address: '4th Floor, Kalpataru Tower, Bandra Kurla Complex', city: 'Mumbai', state: 'Maharashtra', pincode: '400051', country: 'India',
        phone: '+91 22 4000 1234', email: 'hello@sahyadrisoft.example', website: 'https://sahyadrisoft.example', financialYearStart: utcDate(fyStart, 4, 1), lwfEnabled: true, isMetroCity: true, weeklyOffDays: [0],
      },
    });
    await app.get(CompanySetupService).bootstrapCompany(tx, c.id);
    // cloud edition: the demo company is on a paid Professional plan (ignored by the self-hosted edition)
    const now = new Date();
    await tx.subscription.create({ data: { companyId: c.id, plan: 'PROFESSIONAL', status: 'ACTIVE', cycle: 'ANNUAL', seats: 50, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 365 * 86_400_000), lapsedPlan: 'PROFESSIONAL', provider: 'mock' } });
    return c;
  });
  log(`company: ${company.name}`);

  // admin user + employee record
  // sign-in accounts live in Supabase Auth (created, or reclaimed on a re-seed, with the demo password)
  const adminAuthId = await app.get(IdentityService).createUser('admin@jantahr.com', ADMIN_PASSWORD);
  const adminUser = await prisma.user.create({ data: { authId: adminAuthId, email: 'admin@jantahr.com', role: 'SUPER_ADMIN', companyId: company.id } });
  const adminSeed = PEOPLE[0];
  const adminEmp = await prisma.employee.create({
    data: {
      userId: adminUser.id, companyId: company.id, employeeCode: adminSeed.code, firstName: adminSeed.first, lastName: adminSeed.last, email: adminSeed.email, gender: adminSeed.gender, maritalStatus: 'MARRIED',
      dateOfJoining: addDays(today, -Math.round(adminSeed.yearsAgo * 365)), dateOfBirth: toDateOnly(adminSeed.dob), status: 'ACTIVE', employmentType: 'Full-time', professionalTaxState: 'Maharashtra', state: 'Maharashtra', city: 'Mumbai',
      ctc: adminSeed.ctc, phone: adminSeed.phone, uanNumber: adminSeed.uan, noticeperiodDays: 90,
      panNumber: app.get(CryptoService).encrypt(adminSeed.pan), aadhaarNumber: app.get(CryptoService).encrypt('912345678901'), bankName: 'HDFC Bank', bankAccountNumber: app.get(CryptoService).encrypt('50100123456789'), ifscCode: 'HDFC0000123',
    },
  });
  const admin: AuthUser = { userId: adminUser.id, email: adminUser.email, role: 'SUPER_ADMIN', companyId: company.id, employeeId: adminEmp.id };

  // ---- org structure -------------------------------------------------------
  const deptNames = [...new Set(PEOPLE.map((p) => p.dept))];
  const desigNames = [...new Set(PEOPLE.map((p) => p.desig))];
  const depts = new Map<string, string>();
  const desigs = new Map<string, string>();
  for (const n of deptNames) depts.set(n, (await prisma.department.create({ data: { name: n, companyId: company.id } })).id);
  for (const n of desigNames) desigs.set(n, (await prisma.designation.create({ data: { name: n, companyId: company.id } })).id);
  await prisma.employee.update({ where: { id: adminEmp.id }, data: { departmentId: depts.get('Management'), designationId: desigs.get(adminSeed.desig) } });
  await app.get(LeaveAllocationService).onEmployeeJoined(adminEmp.id);

  // ---- employees via the real service --------------------------------------
  const emps = app.get(EmployeesService);
  const ids = new Map<string, string>([[adminSeed.code, adminEmp.id]]);
  const users = new Map<string, AuthUser>([[adminSeed.code, admin]]);
  const fyStartDate = fy.start;

  for (const p of PEOPLE.slice(1)) {
    const doj = addDays(today, -Math.round(p.yearsAgo * 365));
    const res = await emps.create(admin, {
      employeeCode: p.code, firstName: p.first, lastName: p.last, email: p.email, gender: p.gender, maritalStatus: p.code === 'EMP004' ? 'MARRIED' : 'SINGLE',
      dateOfJoining: isoDate(doj), dateOfBirth: p.dob, phone: p.phone, departmentId: depts.get(p.dept), designationId: desigs.get(p.desig), reportingManagerId: p.manager ? ids.get(p.manager) : undefined,
      employmentType: p.type || 'Full-time', workLocation: p.city || 'Mumbai', city: p.city || 'Mumbai', state: p.state || 'Maharashtra', professionalTaxState: p.state || 'Maharashtra', panNumber: p.pan,
      aadhaarNumber: `9${String(1000000000 + Number(p.code.slice(3)) * 7919).padStart(11, '0')}`.slice(0, 12), uanNumber: p.uan, bankName: 'HDFC Bank', bankAccountNumber: `5010012${String(3456000 + Number(p.code.slice(3))).slice(0, 7)}`, ifscCode: 'HDFC0000123',
      bankBranch: 'BKC, Mumbai', ctc: p.ctc, noticeperiodDays: 60, role: p.role || 'EMPLOYEE', password: p.code === 'EMP001' ? undefined : DEMO_PASSWORD, currentAddress: `${100 + Number(p.code.slice(3))}, Sunrise Apartments, ${p.city || 'Mumbai'}`, bloodGroup: ['O+', 'A+', 'B+', 'AB+'][Number(p.code.slice(3)) % 4],
      emergencyContactName: 'Family Contact', emergencyContactPhone: '9800000000', emergencyContactRelation: 'Spouse', esicNumber: p.ctc <= 400000 ? `31${p.uan.slice(2, 10)}0009` : undefined,
    } as CreateEmployeeDto);
    ids.set(p.code, res.id);
    await prisma.user.update({ where: { id: res.userId }, data: { mustChangePassword: false } });
    users.set(p.code, { userId: res.userId, email: p.email, role: p.role || 'EMPLOYEE', companyId: company.id, employeeId: res.id });
    // older joiners have finished onboarding
    if (doj < addDays(today, -60)) {
      const ob = await prisma.employeeOnboarding.findUnique({ where: { employeeId: res.id } });
      if (ob) {
        await prisma.employeeOnboardingTask.updateMany({ where: { onboardingId: ob.id }, data: { status: 'COMPLETED', completedAt: doj } });
        await prisma.employeeOnboarding.update({ where: { id: ob.id }, data: { completedAt: doj } });
      }
    }
  }
  // dept heads
  await prisma.department.update({ where: { id: depts.get('Engineering')! }, data: { headId: ids.get('EMP004') } });
  await prisma.department.update({ where: { id: depts.get('Sales')! }, data: { headId: ids.get('EMP009') } });
  await prisma.department.update({ where: { id: depts.get('Human Resources')! }, data: { headId: ids.get('EMP002') } });
  log(`employees: ${PEOPLE.length} (with users, encrypted PII, leave allocation, onboarding)`);

  // ---- salary assignments ---------------------------------------------------
  const structure = await prisma.salaryStructure.findFirstOrThrow({ where: { companyId: company.id } });
  const setup = app.get(SalarySetupService);
  for (const p of PEOPLE) {
    const emp = await prisma.employee.findUniqueOrThrow({ where: { id: ids.get(p.code)! } });
    const from = emp.dateOfJoining > utcDate(fyStart - 1, 4, 1) ? emp.dateOfJoining : utcDate(fyStart - 1, 4, 1);
    await setup.assign(admin, { employeeId: emp.id, salaryStructureId: structure.id, fromDate: isoDate(from), base: p.ctc, taxRegime: p.regime || 'NEW' });
  }
  // a mid-year revision for one employee (exercises split-segment payroll)
  const revisedFrom = addDays(historyStart, 45);
  const revised = PEOPLE.find((p) => p.code === 'EMP005')!;
  await setup.assign(admin, { employeeId: ids.get('EMP005')!, salaryStructureId: structure.id, fromDate: isoDate(revisedFrom), base: Math.round(revised.ctc * 1.12), taxRegime: 'OLD' });
  log('salary structure assignments (+1 mid-year revision)');

  // ---- attendance history ---------------------------------------------------
  const cal = app.get(CalendarService);
  const histFrom = historyStart;
  const yesterday = addDays(today, -1);
  const shift = await prisma.shiftType.findFirstOrThrow({ where: { companyId: company.id } });
  const nw = await cal.nonWorkingDays(company.id, 'Maharashtra', histFrom, yesterday);
  const rows: Prisma.AttendanceCreateManyInput[] = [];
  const casual = await prisma.leaveType.findFirstOrThrow({ where: { companyId: company.id, name: 'Casual Leave' } });
  for (const p of PEOPLE) {
    const emp = await prisma.employee.findUniqueOrThrow({ where: { id: ids.get(p.code)! } });
    const r = rng(p.code.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    for (const d of eachDay(emp.dateOfJoining > histFrom ? emp.dateOfJoining : histFrom, yesterday)) {
      if (nw.isNonWorking(d)) continue;
      const x = r();
      const base = { employeeId: emp.id, companyId: company.id, attendanceDate: d, shiftTypeId: shift.id, source: 'AUTO' };
      // one employee has 3 unpaid absences last completed month (demonstrates LOP)
      const lopDay = p.code === 'EMP007' && d.getUTCMonth() === addDays(today, -35).getUTCMonth() && d.getUTCDate() >= 10 && d.getUTCDate() <= 12;
      if (lopDay) { rows.push({ ...base, status: 'ABSENT', remarks: 'Absent (seeded)' }); continue; }
      if (x < 0.012) { rows.push({ ...base, status: 'ON_LEAVE', leaveTypeId: casual.id, source: 'LEAVE', remarks: 'Casual leave (seeded)' }); continue; }
      if (x < 0.06) { rows.push({ ...base, status: 'WORK_FROM_HOME', remarks: 'WFH' }); continue; }
      const inMin = 9 * 60 + 15 + Math.floor(r() * 45) + (p.code === 'EMP008' && r() < 0.5 ? 25 : 0);
      const outMin = 18 * 60 + 30 + Math.floor(r() * 50);
      const hh = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
      const inTime = istInstant(d, hh(inMin));
      const outTime = istInstant(d, hh(outMin));
      const hours = Math.round(((outTime.getTime() - inTime.getTime()) / 3600000) * 100) / 100;
      rows.push({ ...base, status: x < 0.07 ? 'HALF_DAY' : 'PRESENT', inTime, outTime, workingHours: hours, lateEntry: inMin > 9 * 60 + 45, overtime: hours - 8 >= 0.5 ? Math.round((hours - 8) * 100) / 100 : null });
    }
  }
  await prisma.attendance.createMany({ data: rows, skipDuplicates: true });
  // keep leave balances consistent with the casual leave shown in attendance history (leave years are calendar
  // years, so only this year's days count against this year's allocation)
  const clDays = new Map<string, number>();
  rows
    .filter((r) => r.status === 'ON_LEAVE' && (r.attendanceDate as Date).getUTCFullYear() === today.getUTCFullYear())
    .forEach((r) => clDays.set(r.employeeId, (clDays.get(r.employeeId) || 0) + 1));
  for (const [employeeId, days] of clDays) {
    await prisma.leaveAllocation.updateMany({ where: { employeeId, leaveTypeId: casual.id, fromDate: utcDate(today.getUTCFullYear(), 1, 1) }, data: { usedLeaves: days } });
    await prisma.leaveLedgerEntry.create({ data: { employeeId, leaveTypeId: casual.id, transactionType: 'LEAVE', leaves: -days, fromDate: histFrom } });
  }
  log(`attendance: ${rows.length} daily records since ${isoDate(histFrom)}`);

  // ---- payroll: the last PAID_MONTHS completed months --------------------------
  const payroll = app.get(PayrollService);
  const payrollRuns = app.get(PayrollRunService);
  // employees' first tax declaration (old regime) — used by TDS projection and Form 16
  const tax = app.get(TaxDeclarationService);
  const cats = await tax.categories();
  const sub = (code: string) => cats.flatMap((c) => c.subCategories).find((s) => s.code === code)!;
  const declFor = async (code: string, rent: number, regime: 'OLD' | 'NEW') => {
    await tax.saveMine(users.get(code)!, {
      fyStartYear: fyStart, taxRegime: regime, monthlyRent: rent, rentedInMetro: true, submit: true,
      details: [{ subCategoryId: sub('PPF').id, declaredAmount: 100000 }, { subCategoryId: sub('LIC').id, declaredAmount: 50000 }, { subCategoryId: sub('80D_SELF').id, declaredAmount: 25000 }],
    });
    const d = await prisma.employeeTaxDeclaration.findFirstOrThrow({ where: { employeeId: ids.get(code)! } });
    await tax.decide(admin, d.id, true);
  };
  await declFor('EMP005', 25000, 'OLD');
  await declFor('EMP004', 35000, 'OLD');

  const loanTarget = ids.get('EMP012')!;
  await setup.createLoan(company.id, { employeeId: loanTarget, loanType: 'ADVANCE', principal: 60000, totalInstallments: 6, startDate: isoDate(historyStart), reason: 'Salary advance' });
  const bonusComp = await prisma.salaryComponent.findFirstOrThrow({ where: { companyId: company.id, abbr: 'BONUS' } });

  let runs = 0;
  for (let k = PAID_MONTHS; k >= 1; k--) {
    const start = utcDate(today.getUTCFullYear(), today.getUTCMonth() + 1 - k, 1);
    const year = start.getUTCFullYear();
    const month = start.getUTCMonth() + 1;
    if (k === 2) await setup.createAdditional(company.id, { employeeId: ids.get('EMP005')!, salaryComponentId: bonusComp.id, amount: 50000, payrollDate: isoDate(addDays(start, 10)), reason: 'Spot award' });
    const res = await payrollRuns.createRun(admin, month, year, {});
    await payrollRuns.approve(admin, res.run.id);
    await payrollRuns.markPaid(admin, res.run.id);
    runs++;
    // demo: statutory filings for paid months were made on time
    for (const i of monthlyDueDates(year, month, { pf: true, esi: true, tdsForms: salaryTdsLaw(fiscalYearStartYear(start)) }).filter((x) => x.category !== 'WAGES')) {
      await prisma.complianceFiling.create({ data: { companyId: company.id, key: i.key, reference: `CHL${year}${String(month).padStart(2, '0')}${i.category}`, filedById: admin.userId, filedAt: new Date(`${i.dueDate}T06:00:00Z`) } });
    }
  }
  for (const fy of [fyStart - 1, fyStart]) {
    for (const i of annualDueDates(fy, salaryTdsLaw(fy)).filter((x) => new Date(`${x.dueDate}T00:00:00Z`) < today && x.category !== 'WAGES')) {
      await prisma.complianceFiling.create({ data: { companyId: company.id, key: i.key, reference: `ACK-${i.key.toUpperCase()}`, filedById: admin.userId, filedAt: new Date(`${i.dueDate}T06:00:00Z`) } });
    }
  }
  log(`payroll: ${runs} months processed & paid (PF/ESI/PT/LWF/TDS/loan)`);

  // ---- leave workflows (live) -------------------------------------------------
  const leaves = app.get(LeaveApplicationService);
  const pl = await prisma.leaveType.findFirstOrThrow({ where: { companyId: company.id, name: 'Privilege Leave' } });
  const nextWeek = (n: number) => {
    let d = addDays(today, n);
    while (d.getUTCDay() === 0) d = addDays(d, 1);
    return isoDate(d);
  };
  try {
    const a1 = await leaves.apply(users.get('EMP005')!, { leaveTypeId: casual.id, fromDate: nextWeek(9), toDate: nextWeek(10), reason: 'Family function' });
    await leaves.approve(users.get('EMP004')!, a1.id, 'Approved. Enjoy!');
    await leaves.apply(users.get('EMP006')!, { leaveTypeId: casual.id, fromDate: nextWeek(4), toDate: nextWeek(4), halfDay: true, reason: 'Doctor appointment' });
    await leaves.apply(users.get('EMP010')!, { leaveTypeId: pl.id, fromDate: nextWeek(14), toDate: nextWeek(18), reason: 'Vacation' });
  } catch (e) { log(`(leave demo skipped: ${errorMessage(e)})`); }

  // ---- comms / policies -----------------------------------------------------
  const eng = app.get(EngagementService);
  await eng.createAnnouncement(admin, { title: 'Revised salary structure under the new labour codes', body: 'From this payroll, Basic pay is set at 50% of CTC as required by the Code on Wages. Your take-home is unchanged for most grades; PF and gratuity now accrue on the higher Basic. Contact HR for your revised salary letter.', pinned: true });
  await eng.createAnnouncement(admin, { title: 'IT declaration window open for tax year 2026-27', body: 'Submit your investment declarations (Form 124): 80C, 80D and HRA rent, by the 15th so TDS is projected correctly. Bengaluru, Hyderabad, Pune and Ahmedabad now qualify for the 50% HRA limit.' });
  await eng.createPolicy(company.id, { title: 'Leave Policy', category: 'HR', content: 'Employees receive 12 Casual Leave, 12 Sick Leave and 15 Privilege Leave per year. Privilege Leave accrues at 1.25 days per month and up to 30 days can be carried forward. Casual Leave cannot be carried forward. Leave applications need manager approval. Sandwich rule applies to Casual Leave: weekly offs and holidays between two leave days are counted as leave.' });
  await eng.createPolicy(company.id, { title: 'Work From Home Policy', category: 'HR', content: 'Employees may work from home up to 2 days per week with prior manager approval. WFH must be requested through the Attendance section. Employees are expected to be available during core hours 11:00 to 17:00.' });
  await eng.createPolicy(company.id, { title: 'Code of Conduct', category: 'Compliance', content: 'All employees must act with integrity, respect colleagues and protect confidential information. Harassment of any kind is prohibited. Concerns can be raised with HR or through the whistle-blower channel. Company assets must be used responsibly.' });
  await eng.createPolicy(company.id, { title: 'Expense Reimbursement Policy', category: 'Finance', content: 'Business expenses must be submitted within 30 days with receipts. Meals are reimbursed up to 1500 rupees per day during travel. Approved claims are reimbursed with the next salary cycle.' });

  // ---- expenses, helpdesk, travel --------------------------------------------
  const expenses = app.get(ExpensesService);
  const c1 = await expenses.create(users.get('EMP005')!, { title: 'Client visit, Pune', submit: true, items: [{ expenseDate: isoDate(addDays(today, -6)), category: 'Travel', description: 'Cab to Pune & back', amount: 4200 }, { expenseDate: isoDate(addDays(today, -6)), category: 'Meals', description: 'Client lunch', amount: 1850 }] });
  await expenses.create(users.get('EMP007')!, { title: 'Team offsite supplies', submit: true, items: [{ expenseDate: isoDate(addDays(today, -3)), category: 'Office Supplies', description: 'Stationery', amount: 2400 }] });
  await expenses.decide(users.get('EMP004')!, c1.id, true, {});
  await expenses.createTravel(users.get('EMP010')!, { purpose: 'Customer meeting, Hyderabad', fromLocation: 'Bengaluru', toLocation: 'Hyderabad', departureDate: isoDate(addDays(today, 12)), returnDate: isoDate(addDays(today, 13)), estimatedCost: 18000 });
  const help = app.get(HelpdeskService);
  const t = await help.create(users.get('EMP006')!, { subject: 'Form 16 for last year', description: 'Need my previous employer Form 16 attached to my tax records.', category: 'Payroll', priority: 'MEDIUM' });
  await help.comment(admin, t.id, { message: 'Please upload it under Documents; we will verify it.' });

  // ---- performance ----------------------------------------------------------------
  const perf = app.get(PerformanceService);
  const prevCycle = await perf.createCycle(company.id, { name: `Annual Review FY ${fyStart - 1}-${String(fyStart).slice(2)}`, startDate: isoDate(utcDate(fyStart - 1, 4, 1)), endDate: isoDate(utcDate(fyStart, 3, 31)), isActive: false });
  await perf.launch(admin, prevCycle.id);
  // fixed order (row order differs between heap and OrioleDB tables); the reporting manager reviews whatever their role, auditors never
  const apps = await prisma.appraisal.findMany({ where: { appraisalCycleId: prevCycle.id }, orderBy: { employee: { employeeCode: 'asc' } } });
  for (const a of apps.slice(0, 8)) {
    const emp = [...ids.entries()].find(([, id]) => id === a.employeeId)![0];
    const mgr = PEOPLE.find((p) => p.code === emp)!.manager;
    if (!mgr || users.get(mgr)!.role === 'AUDITOR') continue;
    const rating = 3 + ((Number(emp.slice(3)) * 7) % 3) * 0.5 + (emp === 'EMP005' ? 1 : 0);
    await perf.selfReview(users.get(emp)!, a.id, { selfRating: Math.min(5, rating), selfComment: 'Delivered key projects and improved delivery timelines.' });
    await perf.managerReview(users.get(mgr)!, a.id, { managerRating: Math.min(5, rating - 0.5 || 3), managerComment: 'Consistent contributor with strong ownership.', promotionRecommended: emp === 'EMP005' });
    await perf.finalize(admin, a.id, { finalRating: Math.min(5, rating), hrComment: 'Calibrated.', salaryRevisionPercent: emp === 'EMP005' ? 12 : 8 });
  }
  const cur = await perf.createCycle(company.id, { name: `Mid-year Review FY ${fyStart}-${String(fyStart + 1).slice(2)}`, startDate: isoDate(utcDate(fyStart, 4, 1)), endDate: isoDate(utcDate(fyStart, 9, 30)) });
  await perf.launch(admin, cur.id, depts.get('Engineering'));
  await perf.createGoal(users.get('EMP004')!, { employeeId: ids.get('EMP005')!, title: 'Ship payroll integrations', description: 'Deliver the bank-advice and ECR exports.', weightage: 40, targetValue: '100%', startDate: isoDate(utcDate(fyStart, 4, 1)), endDate: isoDate(utcDate(fyStart, 9, 30)) });
  await perf.createGoal(users.get('EMP005')!, { title: 'Reduce API p95 latency by 30%', weightage: 30, targetValue: '30%', startDate: isoDate(utcDate(fyStart, 4, 1)), endDate: isoDate(utcDate(fyStart, 9, 30)) });

  // ---- recruitment --------------------------------------------------------------------
  const rec = app.get(RecruitmentService);
  const job1 = await rec.createJob(company.id, { title: 'Senior Backend Engineer', location: 'Mumbai / Hybrid', experience: '5-8 years', employmentType: 'Full-time', vacancies: 2, description: 'Own core services in Node.js, TypeScript and PostgreSQL. Design APIs, mentor engineers and improve reliability.', departmentId: depts.get('Engineering'), salaryMin: 2500000, salaryMax: 4000000, status: 'OPEN' });
  await rec.createJob(company.id, { title: 'Sales Development Representative', location: 'Bengaluru', experience: '1-3 years', vacancies: 3, description: 'Generate and qualify leads for our HR-tech product across India.', departmentId: depts.get('Sales'), status: 'OPEN' });
  const applicants = [['Ishaan Rao', 'ishaan.rao@example.com', 'SCREENING'], ['Meera Kapoor', 'meera.kapoor@example.com', 'INTERVIEW'], ['Nikhil Jain', 'nikhil.jain@example.com', 'APPLIED']] as const;
  for (const [name, email, stage] of applicants) {
    await rec.apply(job1.slug, { name, email, phone: '9876543210', currentCtc: 2200000, expectedCtc: 3000000, noticeDays: 60, acceptedPrivacy: true });
    const a = await prisma.jobApplicant.findFirstOrThrow({ where: { email } });
    if (stage !== 'APPLIED') await rec.moveStage(company.id, a.id, { stage: stage as ApplicantStage, rating: 4 });
    if (stage === 'INTERVIEW') await rec.scheduleInterview(company.id, { applicantId: a.id, round: 'Technical Round 1', scheduledAt: addDays(new Date(), 2).toISOString(), interviewerId: ids.get('EMP004')!, mode: 'Video' });
  }

  // ---- lifecycle: one pending resignation ----------------------------------------------
  await app.get(SeparationService).resign(users.get('EMP011')!, { reason: 'Relocating to another city', lastWorkingDate: isoDate(addDays(today, 45)) });

  console.log('\n✅ Seed complete');
  console.log('   admin@jantahr.com / Admin@123   (Super Admin)');
  console.log('   hr@jantahr.com / payroll@jantahr.com / manager@jantahr.com / employee@jantahr.com / auditor@jantahr.com, password Demo@1234');
  await app.close();
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
