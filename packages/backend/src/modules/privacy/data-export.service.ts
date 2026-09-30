import { Injectable, NotFoundException } from '@nestjs/common';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AuthUser } from '../../common/types';
import { PrismaService } from '../../prisma/prisma.service';

/** DPDP s.11 right of access: everything held about one person, machine-readable. Files are listed by name, not embedded. */
@Injectable()
export class DataExportService {
  constructor(private prisma: PrismaService, private crypto: CryptoService) {}

  async build(actor: AuthUser, employeeId: string, purpose: 'SELF_SERVICE' | 'ADMIN_ACCESS_REQUEST') {
    const e = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId: actor.companyId },
      include: {
        user: { select: { email: true, role: true, mfaEnabled: true, isActive: true, lastLogin: true, createdAt: true } },
        department: { select: { name: true } }, designation: { select: { name: true } },
        documents: true,
        leaveApplications: { orderBy: { fromDate: 'desc' } }, leaveLedgerEntries: { orderBy: { createdAt: 'desc' }, take: 2000 }, leaveEncashments: true, compOffRequests: true,
        attendances: { orderBy: { attendanceDate: 'desc' }, take: 2000 }, checkins: { orderBy: { time: 'desc' }, take: 5000 }, attendanceRequests: true,
        salarySlips: { orderBy: { createdAt: 'desc' } }, taxDeclarations: true, loans: true, additionalSalaries: true, gratuities: true,
        expenseClaims: true, travelRequests: true, helpdeskTickets: { include: { comments: true } },
        goals: true, appraisals: true, policyAcks: true, onboarding: true, separation: { include: { fnfSettlement: true } },
      },
    });
    if (!e) throw new NotFoundException('Employee not found');

    // account fields are reported separately below
    const { user, ...rest } = e;
    const profile: Record<string, unknown> & { documents: { fileUrl: string | null }[] } = { ...rest };
    const [consents, requests, notifications] = await Promise.all([
      this.prisma.consentRecord.findMany({ where: { userId: e.userId }, orderBy: { createdAt: 'asc' }, select: { purpose: true, granted: true, noticeVersion: true, createdAt: true } }),
      this.prisma.privacyRequest.findMany({ where: { employeeId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.notification.findMany({ where: { userId: e.userId }, orderBy: { createdAt: 'desc' }, take: 200, select: { title: true, message: true, type: true, isRead: true, createdAt: true } }),
      this.prisma.auditLog.create({ data: { userId: actor.userId, entityType: 'privacy', entityId: employeeId, action: `EXPORT:${purpose}`.slice(0, 50), changes: JSON.stringify({ employeeId, purpose }) } }),
    ]);

    // The data principal is entitled to their own identifiers in the clear.
    for (const f of ['panNumber', 'aadhaarNumber', 'bankAccountNumber'] as const) profile[f] = this.crypto.decrypt(rest[f]);
    // Strip storage keys that point at other people's files; keep file names.
    profile.documents = rest.documents.map(({ fileUrl, ...d }) => ({ ...d, fileUrl: null, file: fileUrl ? String(fileUrl).split('/').pop() : null }));

    return {
      _meta: {
        format: 'jantahr-personal-data-export/1', generatedAt: new Date().toISOString(), generatedFor: `${e.firstName} ${e.lastName}`.trim(), employeeCode: e.employeeCode,
        note: 'Files such as documents, receipts and selfies are listed by name only; request them from HR. Audit logs and other people’s data are not included.',
      },
      account: user, profile, consents, privacyRequests: requests, notifications,
    };
  }
}
