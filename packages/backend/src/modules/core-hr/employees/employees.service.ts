import { EntitlementsService } from '../../billing/entitlements.service';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Employee, EmployeeStatus, Prisma, Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as crypto from 'crypto';
import { AccessService } from '../../../common/access/access.service';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { pageResult, paginate } from '../../../common/dto/pagination.dto';
import { StorageService, uploadScope } from '../../../common/storage/storage.service';
import { ADMIN_ROLES, AuthUser, PAYROLL_ROLES } from '../../../common/types';
import { parseCsv } from '../../../common/utils/csv';
import { toDateOnly } from '../../../common/utils/dates';
import { PrismaService } from '../../../prisma/prisma.service';
import { LeaveAllocationService } from '../../leave/leave-allocation.service';
import { OnboardingService } from '../../lifecycle/onboarding.service';
import { MailService } from '../../notifications/mail.service';
import { AccountDirectory } from '../../identity/account-directory.service';
import { IdentityService } from '../../identity/identity.service';
import { CreateEmployeeDto, EmployeeFilterDto, UpdateEmployeeDto, UpdateSelfDto, UploadDocumentDto } from './employee.dto';
import { errorMessage } from '../../../common/utils/errors';

const INCLUDE = {
  department: { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
  reportingManager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
  user: { select: { role: true, email: true, isActive: true, lastLogin: true, mfaEnabled: true } },
} satisfies Prisma.EmployeeInclude;

const PII_FIELDS = ['panNumber', 'aadhaarNumber', 'bankAccountNumber'] as const;
/** A person in the org chart with their direct reports. */
export interface OrgNode { id: string; employeeCode: string; name: string; designation?: string; department?: string; profileImage: string | null; children: OrgNode[] }

/** What `view` needs: any employee row, with or without relations. */
type EmployeeLike = { id: string; firstName: string; middleName?: string | null; lastName: string } & Partial<Record<(typeof PII_FIELDS)[number], string | null>>;
const CONTACT_FIELDS = ['phone', 'personalEmail', 'currentAddress', 'permanentAddress', 'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'];

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    private prisma: PrismaService,
    private access: AccessService,
    private crypto: CryptoService,
    private storage: StorageService,
    private mail: MailService,
    private leave: LeaveAllocationService,
    private onboarding: OnboardingService,
    private entitlements: EntitlementsService,
    private identity: IdentityService,
    private accounts: AccountDirectory,
  ) {}

  // ---- serialization --------------------------------------------------------

  view<T extends EmployeeLike>(e: T, viewer: AuthUser): T & { fullName: string } {
    const privileged = PAYROLL_ROLES.includes(viewer.role) || viewer.employeeId === e.id;
    const out: T & { fullName: string } = { ...e, fullName: [e.firstName, e.middleName, e.lastName].filter(Boolean).join(' ') };
    const fields = out as Record<string, unknown>;
    for (const f of PII_FIELDS) {
      const plain = this.crypto.decrypt(e[f]);
      // UIDAI: an Aadhaar number is only ever displayed masked (last 4 digits), even to HR or the holder.
      // Payroll never needs it in full; the holder gets it unmasked only in their DPDP data export.
      fields[f] = privileged && f !== 'aadhaarNumber' ? plain : this.crypto.mask(plain);
    }
    if (!privileged) delete fields.ctc;
    if (viewer.role === Role.AUDITOR) for (const f of CONTACT_FIELDS) delete fields[f];
    return out;
  }

  private encryptPii<T extends object>(data: T): T {
    const out: Record<string, unknown> = Object.fromEntries(Object.entries(data));
    for (const f of PII_FIELDS) if (f in out) out[f] = this.crypto.encrypt(out[f] as string | null | undefined);
    return out as T;
  }

  // ---- queries --------------------------------------------------------------

  async list(user: AuthUser, f: EmployeeFilterDto) {
    const { skip, take, page, limit } = paginate(f);
    const scope = await this.access.scopeEmployeeIds(user);
    const where: Prisma.EmployeeWhereInput = {
      companyId: user.companyId,
      ...(scope ? { id: { in: scope } } : {}),
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(f.designationId ? { designationId: f.designationId } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.employmentType ? { employmentType: f.employmentType } : {}),
      ...(f.managerId ? { reportingManagerId: f.managerId } : {}),
      ...(f.search
        ? {
            OR: [
              { firstName: { contains: f.search, mode: 'insensitive' } },
              { lastName: { contains: f.search, mode: 'insensitive' } },
              { employeeCode: { contains: f.search, mode: 'insensitive' } },
              { email: { contains: f.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.employee.findMany({ where, include: INCLUDE, orderBy: { employeeCode: 'asc' }, skip, take }),
      this.prisma.employee.count({ where }),
    ]);
    return pageResult(rows.map((r) => this.view(r, user)), total, page, limit);
  }

  async directory(user: AuthUser, search?: string, departmentId?: string) {
    const rows = await this.prisma.employee.findMany({
      where: {
        companyId: user.companyId, status: 'ACTIVE',
        ...(departmentId ? { departmentId } : {}),
        ...(search ? { OR: [{ firstName: { contains: search, mode: 'insensitive' } }, { lastName: { contains: search, mode: 'insensitive' } }, { employeeCode: { contains: search, mode: 'insensitive' } }] } : {}),
      },
      include: { department: { select: { name: true } }, designation: { select: { name: true } }, reportingManager: { select: { firstName: true, lastName: true } } },
      orderBy: { firstName: 'asc' },
      take: 500,
    });
    return rows.map((e) => ({
      id: e.id, employeeCode: e.employeeCode, fullName: [e.firstName, e.lastName].filter(Boolean).join(' '), email: e.email,
      phone: user.role === Role.AUDITOR ? undefined : e.phone, department: e.department?.name, designation: e.designation?.name,
      manager: e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}` : null, workLocation: e.workLocation, profileImage: e.profileImage,
      dateOfJoining: e.dateOfJoining,
    }));
  }

  async orgChart(user: AuthUser) {
    const rows = await this.prisma.employee.findMany({
      where: { companyId: user.companyId, status: { in: ['ACTIVE', 'SUSPENDED'] } },
      include: { department: { select: { name: true } }, designation: { select: { name: true } } },
    });
    const nodes = new Map<string, OrgNode>(
      rows.map((e) => [e.id, { id: e.id, employeeCode: e.employeeCode, name: [e.firstName, e.lastName].filter(Boolean).join(' '), designation: e.designation?.name, department: e.department?.name, profileImage: e.profileImage, children: [] as OrgNode[] }]),
    );
    const roots: OrgNode[] = [];
    for (const e of rows) {
      const node = nodes.get(e.id);
      const parent = e.reportingManagerId && e.reportingManagerId !== e.id ? nodes.get(e.reportingManagerId) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return roots;
  }

  async getOne(user: AuthUser, id: string) {
    await this.access.assertEmployeeAccess(user, id);
    const e = await this.prisma.employee.findFirst({
      where: { id, companyId: user.companyId },
      include: { ...INCLUDE, reportees: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
    });
    if (!e) throw new NotFoundException('Employee not found');
    return this.view(e, user);
  }

  async getMe(user: AuthUser) {
    return this.getOne(user, this.access.requireEmployee(user));
  }

  // ---- create / update ------------------------------------------------------

  private assertCanAssignRole(actor: AuthUser, role?: Role) {
    if (!role) return;
    if ((role === Role.SUPER_ADMIN || role === Role.HR_ADMIN) && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only a Super Admin can assign the Super Admin or HR Admin role');
    }
  }

  private async nextCode(companyId: string): Promise<string> {
    const codes = await this.prisma.employee.findMany({ where: { companyId }, select: { employeeCode: true } });
    const max = codes.reduce((m, c) => Math.max(m, parseInt(c.employeeCode.replace(/\D/g, '') || '0', 10)), 0);
    return `EMP${String(max + 1).padStart(3, '0')}`;
  }

  private async validateRefs(companyId: string, dto: Partial<CreateEmployeeDto>, selfId?: string) {
    const checks: Promise<unknown>[] = [];
    if (dto.departmentId) checks.push(this.prisma.department.findFirstOrThrow({ where: { id: dto.departmentId, companyId } }).catch(() => { throw new BadRequestException('Department not found'); }));
    if (dto.designationId) checks.push(this.prisma.designation.findFirstOrThrow({ where: { id: dto.designationId, companyId } }).catch(() => { throw new BadRequestException('Designation not found'); }));
    for (const key of ['reportingManagerId', 'leaveApproverId'] as const) {
      const v = dto[key];
      if (v) {
        if (v === selfId) throw new BadRequestException('An employee cannot report to themselves');
        checks.push(this.prisma.employee.findFirstOrThrow({ where: { id: v, companyId } }).catch(() => { throw new BadRequestException(`${key} not found`); }));
      }
    }
    await Promise.all(checks);
    if (dto.reportingManagerId && selfId) {
      // prevent cycles
      let cur: string | null = dto.reportingManagerId;
      const seen = new Set<string>();
      while (cur && !seen.has(cur)) {
        if (cur === selfId) throw new BadRequestException('Reporting hierarchy cannot contain a cycle');
        seen.add(cur);
        cur = (await this.prisma.employee.findUnique({ where: { id: cur }, select: { reportingManagerId: true } }))?.reportingManagerId ?? null;
      }
    }
  }

  /** DTO date strings (YYYY-MM-DD) as date-only values, the rest unchanged. */
  private dateFields<T extends object>(dto: T): Record<string, unknown> {
    const out: Record<string, unknown> = Object.fromEntries(Object.entries(dto));
    for (const f of ['dateOfBirth', 'dateOfJoining', 'dateOfConfirmation', 'probationEndDate']) if (out[f]) out[f] = toDateOnly(out[f] as string);
    return out;
  }

  async create(actor: AuthUser, dto: CreateEmployeeDto) {
    this.assertCanAssignRole(actor, dto.role);
    await this.entitlements.assertSeats(actor.companyId);
    await this.validateRefs(actor.companyId, dto);
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new BadRequestException('A user with this email already exists');
    const code = dto.employeeCode || (await this.nextCode(actor.companyId));
    if (await this.prisma.employee.findFirst({ where: { companyId: actor.companyId, employeeCode: code } })) throw new BadRequestException(`Employee code ${code} already exists`);

    const tempPassword = dto.password || `Jh${crypto.randomBytes(5).toString('base64url')}9`;
    const { role, password: _pw, ...empData } = dto;
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: actor.companyId }, select: { state: true } });

    // The sign-in account lives in Supabase Auth; undo it if the JantaHR records cannot be written.
    const authId = await this.identity.createUser(email, tempPassword);
    const employee = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { authId, email, role: role || Role.EMPLOYEE, companyId: actor.companyId, mustChangePassword: true },
      });
      return tx.employee.create({
        data: this.encryptPii({
          ...this.dateFields(empData), email, employeeCode: code, userId: user.id, companyId: actor.companyId,
          maritalStatus: dto.maritalStatus || 'SINGLE', status: dto.status || 'ACTIVE',
          professionalTaxState: dto.professionalTaxState || dto.state || company.state || undefined,
        }) as Prisma.EmployeeUncheckedCreateInput,
        include: INCLUDE,
      });
    }).catch(async (e) => {
      await this.identity.deleteUser(authId).catch(() => undefined);
      throw e;
    });

    // Post-create hooks must never fail employee creation
    await this.leave.onEmployeeJoined(employee.id).catch((e) => this.logger.warn(`leave allocation failed: ${e.message}`));
    await this.onboarding.startFor(employee.id, actor.companyId).catch((e) => this.logger.warn(`onboarding start failed: ${e.message}`));
    await this.mail.send(email, 'Welcome to JantaHR', `<p>Hi ${dto.firstName},</p><p>Your account has been created.</p><p>Login: ${email}<br/>Temporary password: <b>${tempPassword}</b></p><p>You will be asked to change it on first login.</p>`);

    return { ...this.view(employee, actor), temporaryPassword: tempPassword };
  }

  async update(actor: AuthUser, id: string, dto: UpdateEmployeeDto) {
    const existing = await this.prisma.employee.findFirst({ where: { id, companyId: actor.companyId } });
    if (!existing) throw new NotFoundException('Employee not found');
    this.assertCanAssignRole(actor, dto.role);
    await this.validateRefs(actor.companyId, dto, id);
    const { role, password, email, ...rest } = dto;

    if (email && email.toLowerCase() !== existing.email.toLowerCase()) {
      if (await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } })) throw new BadRequestException('A user with this email already exists');
    }
    if (rest.employeeCode && rest.employeeCode !== existing.employeeCode) {
      if (await this.prisma.employee.findFirst({ where: { companyId: actor.companyId, employeeCode: rest.employeeCode, id: { not: id } } })) throw new BadRequestException('Employee code already exists');
    }

    const account = await this.prisma.user.findUniqueOrThrow({ where: { id: existing.userId } });
    if (account.authId && email && email.toLowerCase() !== existing.email.toLowerCase()) await this.identity.setEmail(account.authId, email.toLowerCase());
    if (account.authId && password) {
      await this.identity.setPassword(account.authId, password);
      await this.identity.revokeSessions(account.authId);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      if (role || email || password) {
        await tx.user.update({
          where: { id: existing.userId },
          data: { ...(role ? { role } : {}), ...(email ? { email: email.toLowerCase() } : {}), ...(password ? { mustChangePassword: true, sessionsRevokedAt: new Date() } : {}) },
        });
      }
      return tx.employee.update({
        where: { id },
        data: this.encryptPii({ ...this.dateFields(rest), ...(email ? { email: email.toLowerCase() } : {}) }) as Prisma.EmployeeUncheckedUpdateInput,
        include: INCLUDE,
      });
    });
    this.accounts.forget(account.authId);
    return this.view(updated, actor);
  }

  async updateSelf(user: AuthUser, dto: UpdateSelfDto) {
    const id = this.access.requireEmployee(user);
    const updated = await this.prisma.employee.update({ where: { id }, data: dto, include: INCLUDE });
    return this.view(updated, user);
  }

  async setStatus(actor: AuthUser, id: string, status: EmployeeStatus) {
    const emp = await this.prisma.employee.findFirst({ where: { id, companyId: actor.companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    if (emp.userId === actor.userId) throw new BadRequestException('You cannot change your own status');
    const active = status === 'ACTIVE';
    const account = await this.prisma.user.findUniqueOrThrow({ where: { id: emp.userId } });
    if (account.authId) {
      await this.identity.setBanned(account.authId, !active);
      if (!active) await this.identity.revokeSessions(account.authId);
    }
    const [updated] = await this.prisma.$transaction([
      this.prisma.employee.update({ where: { id }, data: { status }, include: INCLUDE }),
      this.prisma.user.update({ where: { id: emp.userId }, data: { isActive: active, ...(active ? {} : { sessionsRevokedAt: new Date() }) } }),
    ]);
    this.accounts.forget(account.authId);
    return this.view(updated, actor);
  }

  async resetPassword(actor: AuthUser, id: string) {
    const emp = await this.prisma.employee.findFirst({ where: { id, companyId: actor.companyId } });
    if (!emp) throw new NotFoundException('Employee not found');
    const account = await this.prisma.user.findUniqueOrThrow({ where: { id: emp.userId } });
    const tempPassword = `Jh${crypto.randomBytes(5).toString('base64url')}9`;
    if (account.authId) await this.identity.setPassword(account.authId, tempPassword);
    else account.authId = await this.identity.createUser(emp.email, tempPassword);
    await this.identity.revokeSessions(account.authId);
    await this.prisma.user.update({ where: { id: emp.userId }, data: { authId: account.authId, mustChangePassword: true, sessionsRevokedAt: new Date() } });
    this.accounts.forget(account.authId);
    await this.mail.send(emp.email, 'Your JantaHR password was reset', `<p>Temporary password: <b>${tempPassword}</b></p>`);
    return { temporaryPassword: tempPassword };
  }

  // ---- bulk import ----------------------------------------------------------

  async importCsv(actor: AuthUser, csv: string) {
    const rows = parseCsv(csv);
    if (!rows.length) throw new BadRequestException('CSV has no data rows');
    if (rows.length > 1000) throw new BadRequestException('Import at most 1000 rows at a time');
    const depts = new Map((await this.prisma.department.findMany({ where: { companyId: actor.companyId } })).map((d) => [d.name.toLowerCase(), d.id]));
    const desigs = new Map((await this.prisma.designation.findMany({ where: { companyId: actor.companyId } })).map((d) => [d.name.toLowerCase(), d.id]));
    const created: { row: number; employeeCode: string; email: string; temporaryPassword: string }[] = [];
    const failed: { row: number; email?: string; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        let departmentId: string | undefined;
        if (r.department) {
          departmentId = depts.get(r.department.toLowerCase());
          if (!departmentId) {
            const d = await this.prisma.department.create({ data: { name: r.department, companyId: actor.companyId } });
            depts.set(r.department.toLowerCase(), d.id);
            departmentId = d.id;
          }
        }
        let designationId: string | undefined;
        if (r.designation) {
          designationId = desigs.get(r.designation.toLowerCase());
          if (!designationId) {
            const d = await this.prisma.designation.create({ data: { name: r.designation, companyId: actor.companyId } });
            desigs.set(r.designation.toLowerCase(), d.id);
            designationId = d.id;
          }
        }
        const dto = plainToInstance(CreateEmployeeDto, {
          employeeCode: r.employeeCode || undefined, firstName: r.firstName, lastName: r.lastName || '', email: r.email, phone: r.phone || undefined,
          gender: (r.gender || 'OTHER').toUpperCase(), dateOfJoining: r.dateOfJoining, dateOfBirth: r.dateOfBirth || undefined, departmentId, designationId,
          ctc: r.ctc ? Number(r.ctc) : undefined, panNumber: r.panNumber || undefined, aadhaarNumber: r.aadhaarNumber || undefined,
          uanNumber: r.uanNumber || undefined, bankName: r.bankName || undefined, bankAccountNumber: r.bankAccountNumber || undefined, ifscCode: r.ifscCode || undefined,
          employmentType: r.employmentType || 'Full-time', state: r.state || undefined,
        });
        // rows never pass through the HTTP ValidationPipe, so validate explicitly
        const problems = await validate(dto, { whitelist: true });
        if (problems.length) throw new Error(problems.flatMap((p) => Object.values(p.constraints || {})).join('; '));
        const res = await this.create(actor, dto);
        created.push({ row: i + 2, employeeCode: res.employeeCode, email: res.email, temporaryPassword: res.temporaryPassword });
      } catch (e) {
        failed.push({ row: i + 2, email: r.email, error: errorMessage(e) });
      }
    }
    return { total: rows.length, createdCount: created.length, failedCount: failed.length, created, failed };
  }

  // ---- documents ------------------------------------------------------------

  async listDocuments(user: AuthUser, employeeId: string) {
    await this.access.assertEmployeeAccess(user, employeeId);
    if (!PAYROLL_ROLES.includes(user.role) && user.employeeId !== employeeId) throw new ForbiddenException('Documents are private to the employee and HR');
    return this.prisma.employeeDocument.findMany({ where: { employeeId }, orderBy: { createdAt: 'desc' } });
  }

  async addDocument(user: AuthUser, employeeId: string, dto: UploadDocumentDto, file?: Express.Multer.File, ticket?: string) {
    await this.access.assertEmployeeAccess(user, employeeId);
    if (!ADMIN_ROLES.includes(user.role) && user.employeeId !== employeeId) throw new ForbiddenException();
    const saved = await this.storage.accept(`employees/${employeeId}`, uploadScope(user), file, ticket);
    return this.prisma.employeeDocument.create({
      data: { employeeId, documentType: dto.documentType, documentName: dto.documentName || saved.name, fileUrl: saved.key, expiryDate: dto.expiryDate ? toDateOnly(dto.expiryDate) : null },
    });
  }

  private async docForUser(user: AuthUser, docId: string) {
    const doc = await this.prisma.employeeDocument.findUnique({ where: { id: docId }, include: { employee: { select: { companyId: true, id: true } } } });
    if (!doc || doc.employee.companyId !== user.companyId) throw new NotFoundException('Document not found');
    if (!PAYROLL_ROLES.includes(user.role) && user.employeeId !== doc.employeeId) throw new ForbiddenException();
    return doc;
  }

  async downloadDocument(user: AuthUser, docId: string) {
    const doc = await this.docForUser(user, docId);
    return { key: doc.fileUrl, name: doc.documentName };
  }

  async verifyDocument(user: AuthUser, docId: string) {
    const doc = await this.docForUser(user, docId);
    return this.prisma.employeeDocument.update({ where: { id: doc.id }, data: { verifiedBy: user.userId, verifiedAt: new Date() } });
  }

  async deleteDocument(user: AuthUser, docId: string) {
    const doc = await this.docForUser(user, docId);
    if (doc.verifiedAt && !ADMIN_ROLES.includes(user.role)) throw new ForbiddenException('Verified documents can only be removed by HR');
    await this.storage.remove(doc.fileUrl);
    await this.prisma.employeeDocument.delete({ where: { id: doc.id } });
    return { ok: true };
  }
}

