import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AccessService } from '../../common/access/access.service';
import { isCloud } from '../../common/edition/edition';
import { AuthSession, AuthUser } from '../../common/types';
import { todayIST } from '../../common/utils/dates';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { CompanySetupService } from '../core-hr/company-setup.service';
import { AccountDirectory } from '../identity/account-directory.service';
import { IdentityService } from '../identity/identity.service';
import { ProvisionCompanyDto } from './dto/auth.dto';

/** Methods that prove control of the mailbox; after one of these a user may set a password without the old one. */
const EMAIL_PROOF = ['recovery', 'otp', 'magiclink', 'invite'];
const EMAIL_PROOF_WINDOW_MS = 15 * 60_000;

/**
 * Supabase Auth signs people in (password, email link, Google, TOTP). This service covers what stays in JantaHR:
 * creating a company for a new Supabase user, the profile, passwords that HR issued, and the two-factor mirror.
 */
@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private setup: CompanySetupService,
    private identity: IdentityService,
    private accounts: AccountDirectory,
    private access: AccessService,
  ) {}

  /** A signed-in Supabase user with no JantaHR account creates a company and becomes its Super admin. */
  async provisionCompany(session: AuthSession, dto: ProvisionCompanyDto) {
    const email = session.email;
    if (!email) throw new BadRequestException('Your sign-in has no email address');
    if (await this.prisma.user.findFirst({ where: { OR: [{ authId: session.authId }, { email }] } })) {
      throw new ConflictException('A JantaHR account already exists for this email. Sign in instead, or ask your HR team.');
    }
    await this.prisma.$transaction(
      async (tx) => {
        const company = await tx.company.create({
          data: {
            name: dto.companyName, legalName: dto.companyName, state: dto.state, country: 'India', email,
            financialYearStart: new Date(Date.UTC(todayIST().getUTCFullYear(), 3, 1)),
          },
        });
        const user = await tx.user.create({ data: { authId: session.authId, email, role: Role.SUPER_ADMIN, companyId: company.id } });
        if (isCloud()) await tx.subscription.create({ data: BillingService.trialFor(company.id) });
        await this.setup.bootstrapCompany(tx, company.id);
        await tx.employee.create({
          data: {
            userId: user.id, companyId: company.id, employeeCode: 'EMP001', firstName: dto.firstName, lastName: dto.lastName || '',
            email, gender: dto.gender || 'OTHER', maritalStatus: dto.maritalStatus || 'SINGLE', dateOfJoining: todayIST(), status: 'ACTIVE',
            professionalTaxState: dto.state,
          },
        });
      },
      { timeout: 30000 },
    );
    this.accounts.forget(session.authId);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { authId: session.authId } });
    return this.getProfile(user.id);
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        company: { select: { id: true, name: true, legalName: true, state: true, logo: true } },
        employee: { include: { department: { select: { id: true, name: true } }, designation: { select: { id: true, name: true } } } },
      },
    });
    // Approvals follow the reporting line, so the apps show the Team area to anyone with reportees, whatever their role.
    const hasReportees = await this.access.hasApprovalDuties({ userId: user.id, email: user.email, role: user.role, companyId: user.companyId, employeeId: user.employee?.id ?? null });
    return {
      id: user.id, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled, mustChangePassword: user.mustChangePassword, lastLogin: user.lastLogin, hasReportees,
      company: user.company,
      employee: user.employee && {
        id: user.employee.id, employeeCode: user.employee.employeeCode, firstName: user.employee.firstName, lastName: user.employee.lastName,
        fullName: [user.employee.firstName, user.employee.lastName].filter(Boolean).join(' '), profileImage: user.employee.profileImage,
        department: user.employee.department, designation: user.employee.designation, dateOfJoining: user.employee.dateOfJoining,
      },
    };
  }

  /** Change a password (for example the temporary one HR issued) by proving the current one. Other devices are signed out. */
  async changePassword(user: AuthUser, session: AuthSession, currentPassword: string, newPassword: string) {
    if (currentPassword === newPassword) throw new BadRequestException('New password must differ from the current password');
    if (!(await this.identity.checkPassword(user.email, currentPassword))) throw new BadRequestException('Current password is incorrect');
    await this.identity.setPassword(session.authId, newPassword);
    await this.identity.revokeSessions(session.authId, session.sessionId ?? undefined);
    await this.prisma.user.update({ where: { id: user.userId }, data: { mustChangePassword: false } });
    this.accounts.forget(session.authId);
    return { ok: true, message: 'Password changed. Other devices have been signed out.' };
  }

  /** Set a new password right after an email link (forgot password, magic link, invite). */
  async setPassword(user: AuthUser, session: AuthSession, newPassword: string) {
    const recent = Date.now() - session.issuedAt < EMAIL_PROOF_WINDOW_MS;
    if (!recent || !session.methods.some((m) => EMAIL_PROOF.includes(m))) {
      throw new ForbiddenException('Open the link from your email again, then choose a new password.');
    }
    await this.identity.setPassword(session.authId, newPassword);
    await this.identity.revokeSessions(session.authId, session.sessionId ?? undefined);
    await this.prisma.user.update({ where: { id: user.userId }, data: { mustChangePassword: false } });
    this.accounts.forget(session.authId);
    return { ok: true };
  }

  /** Called after enrolling or removing a TOTP factor in Supabase: from now on the guard requires AAL2 (or not). */
  async syncMfa(user: AuthUser, session: AuthSession) {
    const mfaEnabled = await this.identity.hasVerifiedFactor(session.authId);
    await this.prisma.user.update({ where: { id: user.userId }, data: { mfaEnabled } });
    this.accounts.forget(session.authId);
    return { mfaEnabled };
  }
}
