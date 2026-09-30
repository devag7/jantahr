import { EntitlementsService } from '../billing/entitlements.service';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { ApplicantStage, InterviewStatus, JobStatus, Gender } from '@prisma/client';
import { Transform, Type, TransformFnParams } from 'class-transformer';
import { Equals, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { StorageService, UploadRequest } from '../../common/storage/storage.service';
import { AuthUser } from '../../common/types';
import { toDateOnly } from '../../common/utils/dates';
import { num } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeesService } from '../core-hr/employees/employees.service';
import { NotificationsService } from '../notifications/notifications.service';

const emptyToUndef = ({ value }: TransformFnParams) => (value === '' ? undefined : value);

export class JobDto {
  @IsString() @MinLength(3) title: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() designationId?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() employmentType?: string;
  @IsOptional() @IsString() experience?: string;
  @IsString() @MinLength(10) description: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) vacancies?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) salaryMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) salaryMax?: number;
  @IsOptional() @Transform(emptyToUndef) @IsDateString() closesOn?: string;
  @IsOptional() @IsIn(['DRAFT', 'OPEN', 'ON_HOLD', 'CLOSED']) status?: 'DRAFT' | 'OPEN' | 'ON_HOLD' | 'CLOSED';
}
export class UpdateJobDto extends PartialType(JobDto) {}

export class ApplyDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() coverNote?: string;
  @IsOptional() @Type(() => Number) @IsNumber() currentCtc?: number;
  @IsOptional() @Type(() => Number) @IsNumber() expectedCtc?: number;
  @IsOptional() @Type(() => Number) @IsInt() noticeDays?: number;
  @IsOptional() @IsString() source?: string;
  /** DPDP s.6: the applicant must accept the privacy notice before we collect their data. Multipart sends it as the string "true". */
  @Transform(({ value }) => value === true || value === 'true') @Equals(true, { message: 'You must accept the privacy notice to apply' }) acceptedPrivacy: boolean;
}

export class StageDto {
  @IsEnum(ApplicantStage) stage: ApplicantStage;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5) rating?: number;
}

export class InterviewDto {
  @IsString() applicantId: string;
  @IsString() @MinLength(2) round: string;
  @IsDateString() scheduledAt: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(10) durationMins?: number;
  @IsOptional() @IsString() mode?: string;
  @IsOptional() @IsString() interviewerId?: string;
}
export class InterviewFeedbackDto {
  @IsEnum(InterviewStatus) status: InterviewStatus;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(5) rating?: number;
  @IsOptional() @IsString() feedback?: string;
}

export class OfferDto {
  @IsString() applicantId: string;
  @IsString() designation: string;
  @Type(() => Number) @IsNumber() @Min(1) ctc: number;
  @IsDateString() joiningDate: string;
}

export class HireDto {
  @IsString() offerId: string;
  @IsEnum(Gender) gender: Gender;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() designationId?: string;
}

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

@Injectable()
export class RecruitmentService {
  constructor(private prisma: PrismaService, private storage: StorageService, private notifications: NotificationsService, private employees: EmployeesService, private entitlements: EntitlementsService) {}

  /** Public careers pages exist only while the company's plan includes recruitment. */
  private async assertCareersOpen(companyId: string) {
    if (!(await this.entitlements.has(companyId, 'recruitment'))) throw new NotFoundException('Careers page not found');
  }

  // ---- openings ----
  jobs(companyId: string, status?: string) {
    return this.prisma.jobOpening.findMany({
      where: { companyId, ...(status ? { status: status as JobStatus } : {}) }, orderBy: { createdAt: 'desc' },
      include: { _count: { select: { applicants: true } } },
    });
  }

  async createJob(companyId: string, dto: JobDto) {
    const slug = `${slugify(dto.title)}-${Math.random().toString(36).slice(2, 7)}`;
    return this.prisma.jobOpening.create({
      data: { ...dto, companyId, slug, status: dto.status || 'DRAFT', closesOn: dto.closesOn ? toDateOnly(dto.closesOn) : null, publishedAt: dto.status === 'OPEN' ? new Date() : null },
    });
  }

  async updateJob(companyId: string, id: string, dto: UpdateJobDto) {
    const j = await this.prisma.jobOpening.findFirst({ where: { id, companyId } });
    if (!j) throw new NotFoundException('Job not found');
    const { closesOn, ...rest } = dto;
    return this.prisma.jobOpening.update({
      where: { id },
      data: { ...rest, ...(closesOn ? { closesOn: toDateOnly(closesOn) } : {}), ...(dto.status === 'OPEN' && !j.publishedAt ? { publishedAt: new Date() } : {}) },
    });
  }

  // ---- public careers ----
  async publicJobs(companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId }, select: { name: true, website: true } });
    if (!company) throw new NotFoundException('Company not found');
    await this.assertCareersOpen(companyId);
    const jobs = await this.prisma.jobOpening.findMany({
      where: { companyId, status: 'OPEN', OR: [{ closesOn: null }, { closesOn: { gte: new Date() } }] }, orderBy: { publishedAt: 'desc' },
      select: { id: true, title: true, slug: true, location: true, employmentType: true, experience: true, description: true, vacancies: true, publishedAt: true },
    });
    return { company, jobs };
  }

  async publicJob(slug: string) {
    const j = await this.prisma.jobOpening.findUnique({ where: { slug }, include: { } });
    if (!j || j.status !== 'OPEN') throw new NotFoundException('This position is no longer open');
    await this.assertCareersOpen(j.companyId);
    const { id, title, location, employmentType, experience, description, vacancies, publishedAt, companyId } = j;
    return { id, title, slug, location, employmentType, experience, description, vacancies, publishedAt, companyId };
  }

  async signResumeUpload(slug: string, req: UploadRequest) {
    const j = await this.prisma.jobOpening.findUnique({ where: { slug } });
    if (!j || j.status !== 'OPEN') throw new NotFoundException('This position is no longer open');
    await this.assertCareersOpen(j.companyId);
    return this.storage.signUpload(`careers/${j.id}`, req);
  }

  async apply(slug: string, dto: ApplyDto, resume?: Express.Multer.File, ticket?: string) {
    const j = await this.prisma.jobOpening.findUnique({ where: { slug } });
    if (!j || j.status !== 'OPEN') throw new NotFoundException('This position is no longer open');
    await this.assertCareersOpen(j.companyId);
    if (await this.prisma.jobApplicant.findUnique({ where: { jobOpeningId_email: { jobOpeningId: j.id, email: dto.email.toLowerCase() } } })) throw new BadRequestException('You have already applied for this position');
    const saved = resume || ticket ? await this.storage.accept(`resumes/${j.id}`, `careers/${j.id}`, resume, ticket) : null;
    const a = await this.prisma.jobApplicant.create({
      data: { companyId: j.companyId, jobOpeningId: j.id, name: dto.name, email: dto.email.toLowerCase(), phone: dto.phone, coverNote: dto.coverNote, currentCtc: dto.currentCtc, expectedCtc: dto.expectedCtc, noticeDays: dto.noticeDays, source: dto.source || 'Career Page', resumeUrl: saved?.key, privacyAcceptedAt: new Date() },
    });
    await this.notifications.notifyRoles(j.companyId, ['HR_ADMIN'], { title: 'New job application', message: `${dto.name} applied for ${j.title}`, type: 'RECRUITMENT', link: '/admin/lifecycle' });
    return { ok: true, applicationId: a.id, message: 'Thank you. Your application has been received.' };
  }

  // ---- pipeline ----
  applicants(companyId: string, jobId?: string, stage?: string) {
    return this.prisma.jobApplicant.findMany({
      where: { companyId, ...(jobId ? { jobOpeningId: jobId } : {}), ...(stage ? { stage: stage as ApplicantStage } : {}) }, orderBy: { createdAt: 'desc' }, take: 300,
      include: { jobOpening: { select: { title: true } }, interviews: { orderBy: { scheduledAt: 'asc' } }, offers: true },
    });
  }

  async moveStage(companyId: string, id: string, dto: StageDto) {
    const a = await this.prisma.jobApplicant.findFirst({ where: { id, companyId } });
    if (!a) throw new NotFoundException('Applicant not found');
    if (a.stage === 'HIRED') throw new BadRequestException('Applicant is already hired');
    if (dto.stage === 'HIRED') throw new BadRequestException('Use the hire action after an accepted offer');
    return this.prisma.jobApplicant.update({ where: { id }, data: { stage: dto.stage, ...(dto.rating !== undefined ? { rating: dto.rating } : {}) } });
  }

  async downloadResume(companyId: string, id: string) {
    const a = await this.prisma.jobApplicant.findFirst({ where: { id, companyId } });
    if (!a?.resumeUrl) throw new NotFoundException('No resume on file');
    return { key: a.resumeUrl, name: `Resume ${a.name}` };
  }

  // ---- interviews ----
  async scheduleInterview(companyId: string, dto: InterviewDto) {
    const a = await this.prisma.jobApplicant.findFirst({ where: { id: dto.applicantId, companyId } });
    if (!a) throw new NotFoundException('Applicant not found');
    if (new Date(dto.scheduledAt) < new Date()) throw new BadRequestException('Interview time is in the past');
    const i = await this.prisma.interview.create({ data: { companyId, applicantId: a.id, round: dto.round, scheduledAt: new Date(dto.scheduledAt), durationMins: dto.durationMins ?? 45, mode: dto.mode ?? 'Video', interviewerId: dto.interviewerId } });
    if (a.stage === 'APPLIED' || a.stage === 'SCREENING') await this.prisma.jobApplicant.update({ where: { id: a.id }, data: { stage: 'INTERVIEW' } });
    await this.notifications.notifyEmployee(dto.interviewerId, { title: 'Interview scheduled', message: `${a.name}: ${dto.round} on ${new Date(dto.scheduledAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`, type: 'RECRUITMENT', link: '/admin/lifecycle' });
    return i;
  }

  async interviewFeedback(companyId: string, id: string, dto: InterviewFeedbackDto) {
    const i = await this.prisma.interview.findFirst({ where: { id, companyId } });
    if (!i) throw new NotFoundException('Interview not found');
    return this.prisma.interview.update({ where: { id }, data: dto });
  }

  // ---- offers & hiring ----
  async createOffer(companyId: string, dto: OfferDto) {
    const a = await this.prisma.jobApplicant.findFirst({ where: { id: dto.applicantId, companyId } });
    if (!a) throw new NotFoundException('Applicant not found');
    const [offer] = await this.prisma.$transaction([
      this.prisma.jobOffer.create({ data: { companyId, applicantId: a.id, designation: dto.designation, ctc: dto.ctc, joiningDate: toDateOnly(dto.joiningDate), status: 'SENT', sentAt: new Date() } }),
      this.prisma.jobApplicant.update({ where: { id: a.id }, data: { stage: 'OFFER' } }),
    ]);
    return offer;
  }

  async respondOffer(companyId: string, id: string, accept: boolean) {
    const o = await this.prisma.jobOffer.findFirst({ where: { id, companyId } });
    if (!o) throw new NotFoundException('Offer not found');
    if (o.status !== 'SENT') throw new BadRequestException('Offer is not awaiting a response');
    await this.prisma.jobOffer.update({ where: { id }, data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() } });
    if (!accept) await this.prisma.jobApplicant.update({ where: { id: o.applicantId }, data: { stage: 'REJECTED' } });
    return this.prisma.jobOffer.findUniqueOrThrow({ where: { id } });
  }

  /** Converts an accepted offer into an employee record (triggers user creation, leave policy, onboarding). */
  async hire(user: AuthUser, dto: HireDto) {
    const o = await this.prisma.jobOffer.findFirst({ where: { id: dto.offerId, companyId: user.companyId }, include: { applicant: true } });
    if (!o) throw new NotFoundException('Offer not found');
    if (o.status !== 'ACCEPTED') throw new BadRequestException('The offer has not been accepted');
    if (o.applicant.stage === 'HIRED') throw new BadRequestException('Already hired');
    const [first, ...rest] = o.applicant.name.trim().split(/\s+/);
    const emp = await this.employees.create(user, {
      firstName: first, lastName: rest.join(' ') || '.', email: o.applicant.email, phone: o.applicant.phone?.replace(/\s+/g, ''), gender: dto.gender, dateOfJoining: o.joiningDate.toISOString().slice(0, 10),
      departmentId: dto.departmentId, designationId: dto.designationId, ctc: num(o.ctc),
    });
    await this.prisma.jobApplicant.update({ where: { id: o.applicantId }, data: { stage: 'HIRED' } });
    return emp;
  }

  async funnel(companyId: string, jobId?: string) {
    const rows = await this.prisma.jobApplicant.groupBy({ by: ['stage'], where: { companyId, ...(jobId ? { jobOpeningId: jobId } : {}) }, _count: true });
    return Object.fromEntries(['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED'].map((s) => [s, rows.find((r) => r.stage === s)?._count ?? 0]));
  }
}
