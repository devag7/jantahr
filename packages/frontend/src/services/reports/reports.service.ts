import { downloadFile, get, post } from '@/lib/api/client';
import { ENDPOINTS as E } from '@/lib/api/endpoints';
import type { AdminDashboard, CustomCatalogEntity, CustomReportInput, CustomReportResult, EssDashboard, ManagerDashboard, MisCatalogItem, MisReport } from '@/types/reports';

export const reportsService = {
  adminDashboard: () => get<AdminDashboard>(E.reports.adminDashboard),
  managerDashboard: () => get<ManagerDashboard>(E.reports.managerDashboard),
  essDashboard: () => get<EssDashboard>(E.reports.essDashboard),
  misCatalog: () => get<MisCatalogItem[]>(E.reports.mis),
  runMis: (key: string, params: Record<string, string | undefined>) => get<MisReport>(E.reports.misRun(key), params),
  downloadMis: (key: string, params: Record<string, string | undefined>) => downloadFile(E.reports.misRun(key), { ...params, format: 'csv' }, `${key}.csv`),
  customCatalog: () => get<CustomCatalogEntity[]>(E.reports.customCatalog),
  runCustom: (d: CustomReportInput) => post<CustomReportResult>(E.reports.custom, d),
};
