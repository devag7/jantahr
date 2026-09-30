import { BadRequestException, Injectable } from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuthUser, PAYROLL_ROLES } from '../../common/types';
import { toCsv } from '../../common/utils/csv';
import { isoDate } from '../../common/utils/dates';
import { num } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';

export class FilterDto {
  @IsString() field: string;
  @IsIn(['eq', 'ne', 'contains', 'gte', 'lte', 'in']) op: 'eq' | 'ne' | 'contains' | 'gte' | 'lte' | 'in';
  @IsString() value: string;
}
export class CustomReportDto {
  @IsIn(['employees', 'leave', 'attendance', 'payroll']) entity: 'employees' | 'leave' | 'attendance' | 'payroll';
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @IsString({ each: true }) columns: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => FilterDto) filters?: FilterDto[];
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortDir?: 'asc' | 'desc';
  @IsOptional() @IsIn(['json', 'csv']) format?: 'json' | 'csv';
}

type Ctx = { sensitive: boolean; crypto: CryptoService };
/** One reportable entity: how to load its rows and how to read each column from a row. */
interface EntityCfg<T> { label: string; sensitive?: string[]; fields: Record<string, { label: string; get: (r: T, ctx: Ctx) => unknown }>; load: (p: PrismaService, companyId: string) => Promise<T[]> }
/** Infers T from `load`, so every getter is checked against the rows it reads. */
const entity = <T,>(cfg: EntityCfg<T>) => cfg as unknown as EntityCfg<unknown>;

const d = (v?: Date | null) => (v ? isoDate(v) : '');
const name = (e: { firstName: string; lastName: string }) => `${e.firstName} ${e.lastName}`.trim();

const ENTITIES: Record<string, EntityCfg<unknown>> = {
  employees: entity({
    label: 'Employees', sensitive: ['ctc', 'pan', 'bank_account'],
    load: (p, companyId) => p.employee.findMany({ where: { companyId }, include: { department: true, designation: true, reportingManager: true }, take: 5000 }),
    fields: {
      employee_code: { label: 'Employee code', get: (r) => r.employeeCode }, name: { label: 'Name', get: (r) => name(r) }, email: { label: 'Email', get: (r) => r.email }, phone: { label: 'Phone', get: (r) => r.phone },
      department: { label: 'Department', get: (r) => r.department?.name }, designation: { label: 'Designation', get: (r) => r.designation?.name }, manager: { label: 'Manager', get: (r) => (r.reportingManager ? name(r.reportingManager) : '') },
      gender: { label: 'Gender', get: (r) => r.gender }, status: { label: 'Status', get: (r) => r.status }, employment_type: { label: 'Employment type', get: (r) => r.employmentType }, location: { label: 'Location', get: (r) => r.workLocation ?? r.city },
      state: { label: 'State', get: (r) => r.state }, date_of_joining: { label: 'Date of joining', get: (r) => d(r.dateOfJoining) }, date_of_birth: { label: 'Date of birth', get: (r) => d(r.dateOfBirth) },
      last_working_date: { label: 'Last working date', get: (r) => d(r.lastWorkingDate) }, uan: { label: 'UAN', get: (r) => r.uanNumber },
      ctc: { label: 'CTC', get: (r, c) => (c.sensitive ? num(r.ctc) : undefined) },
      pan: { label: 'PAN (masked)', get: (r, c) => (c.sensitive ? c.crypto.mask(c.crypto.decrypt(r.panNumber)) : undefined) },
      bank_account: { label: 'Bank a/c (masked)', get: (r, c) => (c.sensitive ? c.crypto.mask(c.crypto.decrypt(r.bankAccountNumber)) : undefined) },
    },
  }),
  leave: entity({
    label: 'Leave applications',
    load: (p, companyId) => p.leaveApplication.findMany({ where: { companyId }, include: { employee: { include: { department: true } }, leaveType: true }, orderBy: { createdAt: 'desc' }, take: 5000 }),
    fields: {
      employee_code: { label: 'Employee code', get: (r) => r.employee.employeeCode }, name: { label: 'Name', get: (r) => name(r.employee) }, department: { label: 'Department', get: (r) => r.employee.department?.name },
      leave_type: { label: 'Leave type', get: (r) => r.leaveType.name }, from_date: { label: 'From', get: (r) => d(r.fromDate) }, to_date: { label: 'To', get: (r) => d(r.toDate) }, days: { label: 'Days', get: (r) => num(r.totalLeaveDays) },
      status: { label: 'Status', get: (r) => r.status }, reason: { label: 'Reason', get: (r) => r.reason }, applied_on: { label: 'Applied on', get: (r) => d(r.postingDate) },
    },
  }),
  attendance: entity({
    label: 'Attendance',
    load: (p, companyId) => p.attendance.findMany({ where: { companyId }, include: { employee: { include: { department: true } } }, orderBy: { attendanceDate: 'desc' }, take: 5000 }),
    fields: {
      employee_code: { label: 'Employee code', get: (r) => r.employee.employeeCode }, name: { label: 'Name', get: (r) => name(r.employee) }, department: { label: 'Department', get: (r) => r.employee.department?.name },
      date: { label: 'Date', get: (r) => d(r.attendanceDate) }, status: { label: 'Status', get: (r) => r.status }, in_time: { label: 'In', get: (r) => (r.inTime ? r.inTime.toISOString() : '') },
      out_time: { label: 'Out', get: (r) => (r.outTime ? r.outTime.toISOString() : '') }, hours: { label: 'Hours', get: (r) => num(r.workingHours) }, late: { label: 'Late', get: (r) => (r.lateEntry ? 'Yes' : 'No') },
      overtime: { label: 'Overtime', get: (r) => num(r.overtime) }, source: { label: 'Source', get: (r) => r.source },
    },
  }),
  payroll: entity({
    label: 'Salary slips', sensitive: ['gross', 'net', 'deductions', 'pf', 'esi', 'pt', 'tds'],
    load: (p, companyId) => p.salarySlip.findMany({ where: { companyId, status: { in: ['GENERATED', 'APPROVED', 'PAID'] } }, include: { employee: { include: { department: true } } }, orderBy: [{ year: 'desc' }, { month: 'desc' }], take: 5000 }),
    fields: {
      employee_code: { label: 'Employee code', get: (r) => r.employee.employeeCode }, name: { label: 'Name', get: (r) => name(r.employee) }, department: { label: 'Department', get: (r) => r.employee.department?.name },
      month: { label: 'Month', get: (r) => `${r.year}-${String(r.month).padStart(2, '0')}` }, paid_days: { label: 'Paid days', get: (r) => num(r.paymentDays) }, status: { label: 'Status', get: (r) => r.status },
      gross: { label: 'Gross', get: (r) => num(r.grossPay) }, net: { label: 'Net pay', get: (r) => num(r.netPay) }, deductions: { label: 'Deductions', get: (r) => num(r.totalDeductions) },
      pf: { label: 'PF (employee)', get: (r) => num(r.pfEmployee) }, esi: { label: 'ESI (employee)', get: (r) => num(r.esiEmployee) }, pt: { label: 'Professional tax', get: (r) => num(r.professionalTax) }, tds: { label: 'TDS', get: (r) => num(r.tds) },
    },
  }),
};

@Injectable()
export class CustomReportService {
  constructor(private prisma: PrismaService, private crypto: CryptoService) {}

  catalog(user: AuthUser) {
    const sensitive = PAYROLL_ROLES.includes(user.role);
    return Object.entries(ENTITIES).map(([key, e]) => ({
      entity: key, label: e.label,
      fields: Object.entries(e.fields).filter(([f]) => sensitive || !(e.sensitive || []).includes(f)).map(([f, v]) => ({ key: f, label: v.label })),
    }));
  }

  async run(user: AuthUser, dto: CustomReportDto) {
    if (dto.entity === 'payroll' && !PAYROLL_ROLES.includes(user.role) && user.role !== 'AUDITOR') throw new BadRequestException('Not permitted');
    const cfg = ENTITIES[dto.entity];
    const sensitive = PAYROLL_ROLES.includes(user.role);
    const allowed = Object.keys(cfg.fields).filter((f) => sensitive || !(cfg.sensitive || []).includes(f));
    for (const c of dto.columns) if (!allowed.includes(c)) throw new BadRequestException(`Unknown or restricted column "${c}"`);
    for (const f of dto.filters || []) if (!allowed.includes(f.field)) throw new BadRequestException(`Cannot filter on "${f.field}"`);
    if (dto.sortBy && !allowed.includes(dto.sortBy)) throw new BadRequestException(`Cannot sort by "${dto.sortBy}"`);

    const raw = await cfg.load(this.prisma, user.companyId);
    const ctx = { sensitive, crypto: this.crypto };
    let rows = raw.map((r) => Object.fromEntries(allowed.map((f) => [f, cfg.fields[f].get(r, ctx)])));

    for (const f of dto.filters || []) {
      rows = rows.filter((r) => {
        const v = r[f.field];
        const s = String(v ?? '').toLowerCase();
        const q = f.value.toLowerCase();
        switch (f.op) {
          case 'eq': return s === q;
          case 'ne': return s !== q;
          case 'contains': return s.includes(q);
          case 'in': return q.split(',').map((x) => x.trim()).includes(s);
          case 'gte': return typeof v === 'number' ? v >= Number(f.value) : String(v ?? '') >= f.value;
          case 'lte': return typeof v === 'number' ? v <= Number(f.value) : String(v ?? '') <= f.value;
        }
      });
    }
    if (dto.sortBy) {
      const dir = dto.sortDir === 'desc' ? -1 : 1;
      const key = dto.sortBy;
      const cmp = (x: unknown, y: unknown) => (typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'en-IN', { numeric: true }));
      rows.sort((a, b) => dir * cmp(a[key], b[key]));
    }
    const out = rows.slice(0, 5000).map((r) => Object.fromEntries(dto.columns.map((c) => [c, r[c]])));
    return { entity: dto.entity, columns: dto.columns.map((c) => ({ key: c, label: cfg.fields[c].label })), rows: out, total: rows.length, truncated: rows.length > 5000, csv: dto.format === 'csv' ? toCsv(out, dto.columns) : undefined };
  }
}
