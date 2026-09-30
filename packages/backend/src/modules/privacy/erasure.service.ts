import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DEFAULT_RETENTION_YEARS, KYC_DOCUMENT_TYPE, ErasurePlan, planErasure } from '../../common/consent/consent-rules';
import { StorageService } from '../../common/storage/storage.service';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountDirectory } from '../identity/account-directory.service';
import { IdentityService } from '../identity/identity.service';
import { AnonymiseApplicantsDto, EraseDto } from './privacy.dto';

const stamp = (d = new Date()) => d.toISOString().slice(0, 10);

/** Retention, erasure and anonymisation (DPDP s.8(7) & s.12). Irreversible; the audit log records who did it. */
@Injectable()
export class ErasureService {
  private readonly retentionYears: number;
  readonly applicantRetentionMonths: number;
  constructor(private prisma: PrismaService, private storage: StorageService, config: ConfigService, private identity: IdentityService, private accounts: AccountDirectory) {
    const n = Number(config.get('DATA_RETENTION_YEARS'));
    this.retentionYears = Number.isFinite(n) && n > 0 ? n : DEFAULT_RETENTION_YEARS;
    const m = Number(config.get('APPLICANT_RETENTION_MONTHS'));
    this.applicantRetentionMonths = Number.isFinite(m) && m >= 1 ? m : 12;
  }

  private plan(e: { status: string; lastWorkingDate: Date | null }, years = this.retentionYears): ErasurePlan {
    return planErasure({ status: e.status, lastWorkingDate: e.lastWorkingDate, now: new Date(), retentionYears: years });
  }

  /** Employees who have left, with what an erasure request could do for each today. */
  async retentionReport(companyId: string, years?: number) {
    const y = years && years > 0 ? years : this.retentionYears;
    const left = await this.prisma.employee.findMany({
      where: { companyId, status: 'LEFT' }, orderBy: { lastWorkingDate: 'asc' },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, lastWorkingDate: true, erasedAt: true, anonymizedAt: true },
    });
    const employees = left.map((e) => ({ ...e, plan: this.plan({ status: 'LEFT', lastWorkingDate: e.lastWorkingDate }, y) }));
    return {
      retentionYears: y,
      employees,
      summary: {
        left: employees.length,
        pendingFull: employees.filter((e) => !e.anonymizedAt && e.plan.level === 'FULL').length,
        pendingPartial: employees.filter((e) => !e.erasedAt && !e.anonymizedAt && e.plan.level === 'PARTIAL').length,
        anonymised: employees.filter((e) => e.anonymizedAt).length,
      },
    };
  }

  async erase(actor: AuthUser, employeeId: string, dto: EraseDto) {
    const e = await this.prisma.employee.findFirst({ where: { id: employeeId, companyId: actor.companyId }, include: { documents: true } });
    if (!e) throw new NotFoundException('Employee not found');
    if (e.userId === actor.userId) throw new BadRequestException('You cannot erase your own record');
    const authId = (await this.prisma.user.findUnique({ where: { id: e.userId }, select: { authId: true } }))?.authId ?? null;
    if (dto.confirmEmployeeCode.trim() !== e.employeeCode) throw new BadRequestException('Employee code does not match: nothing was erased');
    if (e.anonymizedAt) throw new BadRequestException('This record is already fully anonymised');
    const plan = this.plan(e);
    if (!plan.allowed) throw new BadRequestException(plan.reason);
    const full = plan.level === 'FULL';

    const removeFiles: string[] = [];
    const docsToDrop = e.documents.filter((d) => full || !KYC_DOCUMENT_TYPE.test(d.documentType));
    removeFiles.push(...docsToDrop.map((d) => d.fileUrl));
    const selfies = await this.prisma.employeeCheckin.findMany({ where: { employeeId, selfieUrl: { not: null } }, select: { selfieUrl: true } });
    removeFiles.push(...selfies.map((s) => s.selfieUrl!));
    if (e.profileImage) removeFiles.push(e.profileImage);

    const now = new Date();
    // Non-statutory personal data goes in every erasure; Aadhaar is not something an employer must keep.
    const nonStatutory = {
      personalEmail: null, phone: null, bloodGroup: null, nationality: null, religion: null, fatherName: null, motherName: null, spouseName: null, middleName: null,
      currentAddress: null, permanentAddress: null, city: null, state: null, pincode: null,
      emergencyContactName: null, emergencyContactPhone: null, emergencyContactRelation: null, profileImage: null, aadhaarNumber: null,
    };
    const fullOnly = full
      ? { firstName: 'Erased', lastName: 'Employee', email: `erased+${e.id}@erased.invalid`, dateOfBirth: null, bankName: null, bankAccountNumber: null, ifscCode: null, bankBranch: null, panNumber: null, uanNumber: null, esicNumber: null, pfAccountNumber: null, anonymizedAt: now }
      : {};

    await this.prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: employeeId }, data: { ...nonStatutory, ...fullOnly, erasedAt: now } });
      await tx.employeeDocument.deleteMany({ where: { id: { in: docsToDrop.map((d) => d.id) } } });
      await tx.employeeCheckin.updateMany({ where: { employeeId }, data: { selfieUrl: null, latitude: null, longitude: null, ipAddress: null } });
      await tx.notification.deleteMany({ where: { userId: e.userId } });
      await tx.user.update({
        where: { id: e.userId },
        data: { isActive: false, mfaEnabled: false, sessionsRevokedAt: now, ...(full ? { email: `erased+${e.userId}@erased.invalid`, authId: null } : {}) },
      });
      await tx.auditLog.create({ data: { userId: actor.userId, entityType: 'privacy', entityId: employeeId, action: `ERASE:${plan.level}`, changes: JSON.stringify({ employeeCode: e.employeeCode, level: plan.level, requestId: dto.requestId ?? null, on: stamp(now) }) } });
      if (dto.requestId) {
        await tx.privacyRequest.updateMany({
          where: { id: dto.requestId, companyId: actor.companyId, employeeId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
          data: { status: 'COMPLETED', resolvedById: actor.userId, resolvedAt: now, resolution: `${full ? 'Record fully anonymised' : 'Personal data erased'} on ${stamp(now)}. ${plan.reason}` },
        });
      }
    }, { timeout: 30_000 });
    // Sign-in: a full erasure deletes the Supabase account; a partial one keeps it, disabled.
    if (authId) {
      if (full) await this.identity.deleteUser(authId);
      else { await this.identity.setBanned(authId, true); await this.identity.revokeSessions(authId); }
      this.accounts.forget(authId);
    }
    await Promise.all(removeFiles.map((k) => this.storage.remove(k).catch(() => undefined)));

    return {
      level: plan.level, reason: plan.reason, retainUntil: plan.retainUntil ?? null,
      erased: ['Contact details, family & emergency contacts, addresses', 'Aadhaar number', 'Profile photo', 'Check-in selfies, GPS coordinates and IPs', 'Sessions and notifications', `${docsToDrop.length} document(s)`, ...(full ? ['Name, email, date of birth, PAN, bank and PF/ESI identifiers'] : [])],
      retained: full ? ['Employee code and non-identifying payroll amounts'] : ['Name, work email, date of birth', 'PAN, bank account, UAN / ESIC / PF numbers', 'KYC documents', 'Payroll, leave and attendance records'],
    };
  }

  /** Recruitment candidates who were not hired — anonymised after the chosen period so applicant PII isn't kept forever. `companyId` undefined = every tenant (nightly job). */
  async purgeApplicants(months: number, companyId?: string): Promise<number> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    const rows = await this.prisma.jobApplicant.findMany({ where: { ...(companyId ? { companyId } : {}), stage: { not: 'HIRED' }, createdAt: { lt: cutoff }, NOT: { name: 'Erased applicant' } }, select: { id: true, resumeUrl: true } });
    for (const r of rows) {
      await this.prisma.jobApplicant.update({ where: { id: r.id }, data: { name: 'Erased applicant', email: `erased+${r.id}@erased.invalid`, phone: null, resumeUrl: null, coverNote: null, currentCtc: null, expectedCtc: null } });
      await this.storage.remove(r.resumeUrl).catch(() => undefined);
    }
    return rows.length;
  }

  async anonymiseApplicants(actor: AuthUser, dto: AnonymiseApplicantsDto) {
    const count = await this.purgeApplicants(dto.olderThanMonths, actor.companyId);
    await this.prisma.auditLog.create({ data: { userId: actor.userId, entityType: 'privacy', entityId: actor.companyId, action: 'ANONYMISE:APPLICANTS', changes: JSON.stringify({ olderThanMonths: dto.olderThanMonths, count }) } });
    return { anonymised: count };
  }

  async eligibleApplicants(companyId: string, months = this.applicantRetentionMonths) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return this.prisma.jobApplicant.count({ where: { companyId, stage: { not: 'HIRED' }, createdAt: { lt: cutoff }, NOT: { name: 'Erased applicant' } } });
  }
}
