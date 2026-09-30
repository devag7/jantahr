import { get, patch, post, upload } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { Applicant, ApplicantStage, Funnel, Interview, Job, JobInput, Offer, PublicCompanyJobs, PublicJob } from '@/types/recruitment';
import type { Employee } from '@/types/employees';

export const recruitmentService = {
  jobs: () => get<Job[]>(E.recruitment.jobs),
  createJob: (d: JobInput) => post<Job>(E.recruitment.jobs, d),
  updateJob: (id: string, d: Partial<JobInput>) => patch<Job>(E.recruitment.job(id), d),
  applicants: (jobId?: string) => get<Applicant[]>(E.recruitment.applicants, { jobId }),
  moveStage: (id: string, stage: ApplicantStage, rating?: number) => patch<Applicant>(E.recruitment.stage(id), { stage, rating }),
  funnel: () => get<Funnel>(E.recruitment.funnel),
  schedule: (d: { applicantId: string; round: string; scheduledAt: string; mode?: string; interviewerId?: string }) => post<Interview>(E.recruitment.interviews, d),
  feedback: (id: string, d: { status: Interview['status']; rating?: number; feedback?: string }) => patch<Interview>(E.recruitment.interview(id), d),
  createOffer: (d: { applicantId: string; designation: string; ctc: number; joiningDate: string }) => post<Offer>(E.recruitment.offers, d),
  respondOffer: (id: string, a: 'accept' | 'decline') => post<Offer>(E.recruitment.offerRespond(id, a)),
  hire: (d: { offerId: string; gender: string; departmentId?: string; designationId?: string }) => post<Employee>(E.recruitment.hire, d),
  publicCompany: (companyId: string) => get<PublicCompanyJobs>(E.recruitment.publicCompany(companyId)),
  publicJob: (slug: string) => get<PublicJob & { companyId: string }>(E.recruitment.publicJob(slug)),
  publicApply: (slug: string, form: FormData) => upload<{ ok: boolean; message: string }>(E.recruitment.publicApply(slug), form, E.recruitment.publicResumeUpload(slug)),
};
