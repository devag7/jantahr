export type JobStatus = 'DRAFT' | 'OPEN' | 'ON_HOLD' | 'CLOSED';
export type ApplicantStage = 'APPLIED' | 'SCREENING' | 'INTERVIEW' | 'OFFER' | 'HIRED' | 'REJECTED';
export interface Job { id: string; title: string; slug: string; location: string | null; employmentType: string; experience: string | null; description: string; vacancies: number; status: JobStatus; publishedAt: string | null; _count: { applicants: number } }
export interface JobInput { title: string; location?: string; employmentType?: string; experience?: string; description: string; vacancies?: number; status?: JobStatus; departmentId?: string }
export interface Interview { id: string; round: string; scheduledAt: string; durationMins: number; mode: string; status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'; rating: number | null; feedback: string | null }
export interface Offer { id: string; designation: string; ctc: number; joiningDate: string; status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' }
export interface Applicant { id: string; name: string; email: string; phone: string | null; stage: ApplicantStage; rating: number | null; currentCtc: number | null; expectedCtc: number | null; noticeDays: number | null; resumeUrl: string | null; createdAt: string; jobOpening: { title: string }; interviews: Interview[]; offers: Offer[] }
export interface PublicJob { id: string; title: string; slug: string; location: string | null; employmentType: string; experience: string | null; description: string; vacancies: number; publishedAt: string | null }
export interface PublicCompanyJobs { company: { name: string; website: string | null }; jobs: PublicJob[] }
export type Funnel = Record<ApplicantStage, number>;
