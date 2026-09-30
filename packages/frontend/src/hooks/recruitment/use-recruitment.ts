'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from '@/hooks/common/use-api-mutation';
import { recruitmentService } from '@/services/recruitment/recruitment.service';
import type { ApplicantStage, JobInput } from '@/types/recruitment';

const RC = [['recruitment'], ['employees'], ['reports']] as const;
export const useJobs = () => useQuery({ queryKey: ['recruitment', 'jobs'], queryFn: recruitmentService.jobs });
export const useApplicants = (jobId?: string) => useQuery({ queryKey: ['recruitment', 'applicants', jobId], queryFn: () => recruitmentService.applicants(jobId) });
export const useFunnel = () => useQuery({ queryKey: ['recruitment', 'funnel'], queryFn: recruitmentService.funnel });
export const usePublicCompany = (companyId: string) => useQuery({ queryKey: ['public', 'company', companyId], queryFn: () => recruitmentService.publicCompany(companyId) });
export const usePublicJob = (slug: string) => useQuery({ queryKey: ['public', 'job', slug], queryFn: () => recruitmentService.publicJob(slug) });

export const useCreateJob = () => useApiMutation((d: JobInput) => recruitmentService.createJob(d), { invalidate: [...RC], success: 'Job saved' });
export const useUpdateJob = () => useApiMutation((v: { id: string; data: Partial<JobInput> }) => recruitmentService.updateJob(v.id, v.data), { invalidate: [...RC], success: 'Job updated' });
export const useMoveStage = () => useApiMutation((v: { id: string; stage: ApplicantStage; rating?: number }) => recruitmentService.moveStage(v.id, v.stage, v.rating), { invalidate: [...RC] });
export const useScheduleInterview = () => useApiMutation(recruitmentService.schedule, { invalidate: [...RC], success: 'Interview scheduled' });
export const useCreateOffer = () => useApiMutation(recruitmentService.createOffer, { invalidate: [...RC], success: 'Offer created' });
export const useRespondOffer = () => useApiMutation((v: { id: string; action: 'accept' | 'decline' }) => recruitmentService.respondOffer(v.id, v.action), { invalidate: [...RC], success: 'Offer updated' });
export const useHire = () => useApiMutation(recruitmentService.hire, { invalidate: [...RC], success: 'Candidate converted to employee' });
export const useApplyPublic = () => useApiMutation((v: { slug: string; form: FormData }) => recruitmentService.publicApply(v.slug, v.form), { silentError: true });
