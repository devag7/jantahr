import { downloadFile, get, patch, post, put } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { AdminPrivacyRequest, BreachInput, ConsentList, DataBreach, ErasureResult, PrivacyOverview, PrivacyRequest, PrivacyRequestStatus, PrivacyRequestType, RetentionReport } from '@/types/privacy';

export const privacyService = {
  consents: () => get<ConsentList>(E.privacy.consents),
  setConsent: (purpose: string, granted: boolean) => put<ConsentList>(E.privacy.consent(purpose), { granted }),
  downloadMyData: () => downloadFile(E.privacy.myData, undefined, 'my-personal-data.json'),
  myRequests: () => get<PrivacyRequest[]>(E.privacy.myRequests),
  createRequest: (d: { type: PrivacyRequestType; details: string }) => post<PrivacyRequest>(E.privacy.requests, d),
  requests: (status?: string) => get<AdminPrivacyRequest[]>(E.privacy.requests, { status }),
  updateRequest: (id: string, d: { status?: PrivacyRequestStatus; resolution?: string }) => patch<PrivacyRequest>(E.privacy.request(id), d),
  exportFor: (employeeId: string) => downloadFile(E.privacy.exportFor(employeeId), undefined, 'personal-data.json'),
  overview: () => get<PrivacyOverview>(E.privacy.overview),
  retention: () => get<RetentionReport>(E.privacy.retention),
  erase: (employeeId: string, d: { confirmEmployeeCode: string; requestId?: string }) => post<ErasureResult>(E.privacy.erase(employeeId), d),
  anonymiseApplicants: (olderThanMonths: number) => post<{ anonymised: number }>(E.privacy.anonymiseApplicants, { olderThanMonths }),
  breaches: () => get<DataBreach[]>(E.privacy.breaches),
  createBreach: (d: BreachInput) => post<DataBreach>(E.privacy.breaches, d),
  updateBreach: (id: string, d: { status?: DataBreach['status']; boardNotified?: boolean; containmentActions?: string }) => patch<DataBreach>(E.privacy.breach(id), d),
  notifyBreach: (id: string) => post<DataBreach>(E.privacy.notifyBreach(id)),
};
