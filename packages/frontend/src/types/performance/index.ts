export interface AppraisalCycle { id: string; name: string; startDate: string; endDate: string; isActive: boolean; _count: { appraisals: number } }
export interface Goal { id: string; title: string; description: string | null; weightage: number; targetValue: string | null; achievedValue: string | null; startDate: string; endDate: string; status: 'PENDING' | 'APPROVED' | 'REJECTED'; selfRating: number | null; managerRating: number | null; selfComment: string | null; managerComment: string | null }
export type AppraisalStatus = 'DRAFT' | 'SELF_REVIEW' | 'MANAGER_REVIEW' | 'HR_REVIEW' | 'COMPLETED' | 'CANCELLED';
export interface Appraisal {
  id: string; employeeId: string; status: AppraisalStatus; selfRating: number | null; managerRating: number | null; finalRating: number | null; selfComment: string | null; managerComment: string | null; hrComment: string | null;
  promotionRecommended: boolean; salaryRevisionPercent: number | null; appraisalCycle: { id: string; name: string; startDate: string; endDate: string };
  employee: { id: string; employeeCode: string; firstName: string; lastName: string; department: { name: string } | null; designation: { name: string } | null };
}
export interface AppraisalDetail extends Appraisal { goals: Goal[]; goalScore: number | null }
export interface CycleSummary { total: number; byStatus: Record<string, number>; ratingDistribution: Record<string, number>; averageRating: number | null; promotions: number }
export interface GoalInput { employeeId?: string; title: string; description?: string; weightage: number; targetValue?: string; startDate: string; endDate: string }
