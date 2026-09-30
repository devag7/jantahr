/** Every backend endpoint, once, grouped by domain. Dynamic segments are functions. */
export const ENDPOINTS = {
  auth: {
    me: '/auth/me', provision: '/auth/provision', changePassword: '/auth/change-password', setPassword: '/auth/set-password', mfaSync: '/auth/mfa/sync',
  },
  notifications: { list: '/notifications', readAll: '/notifications/read-all', read: (id: string) => `/notifications/${id}/read` },
  company: { get: '/company', states: '/masters/states' },
  org: {
    departments: '/departments', department: (id: string) => `/departments/${id}`, designations: '/designations', designation: (id: string) => `/designations/${id}`,
  },
  employees: {
    list: '/employees', directory: '/employees/directory', orgChart: '/employees/org-chart', me: '/employees/me', import: '/employees/import',
    one: (id: string) => `/employees/${id}`, status: (id: string) => `/employees/${id}/status`, resetPassword: (id: string) => `/employees/${id}/reset-password`,
    documents: (id: string) => `/employees/${id}/documents`, doc: (docId: string) => `/employees/documents/${docId}`, docDownload: (docId: string) => `/employees/documents/${docId}/download`,
    docVerify: (docId: string) => `/employees/documents/${docId}/verify`,
  },
  holidays: { calendar: '/holidays/calendar', lists: '/holidays/lists', list: (id: string) => `/holidays/lists/${id}` },
  engagement: {
    announcements: '/announcements', announcement: (id: string) => `/announcements/${id}`, policies: '/policies', policy: (id: string) => `/policies/${id}`,
    ack: (id: string) => `/policies/${id}/acknowledge`, acks: (id: string) => `/policies/${id}/acknowledgements`,
  },
  leave: {
    types: '/leave/types', type: (id: string) => `/leave/types/${id}`, policies: '/leave/policies', policy: (id: string) => `/leave/policies/${id}`, assign: (id: string) => `/leave/policies/${id}/assign`,
    allocations: '/leave/allocations', accrual: '/leave/accrual/run', balance: '/leave/balance', preview: '/leave/preview', applications: '/leave/applications', pending: '/leave/applications/pending',
    approve: (id: string) => `/leave/applications/${id}/approve`, reject: (id: string) => `/leave/applications/${id}/reject`, cancel: (id: string) => `/leave/applications/${id}/cancel`,
    calendar: '/leave/calendar', encashments: '/leave/encashments', encashment: (id: string, a: 'approve' | 'reject') => `/leave/encashments/${id}/${a}`,
    compOff: '/leave/comp-off', compOffDecision: (id: string, a: 'approve' | 'reject') => `/leave/comp-off/${id}/${a}`,
  },
  attendance: {
    punch: '/attendance/punch', status: '/attendance/status', me: '/attendance/me', daily: '/attendance/daily', summary: '/attendance/summary', mark: '/attendance/mark', import: '/attendance/import',
    process: '/attendance/process', markAbsent: '/attendance/mark-absent', requests: '/attendance/requests', requestDecision: (id: string, a: 'approve' | 'reject') => `/attendance/requests/${id}/${a}`,
    shifts: '/attendance/shifts', shift: (id: string) => `/attendance/shifts/${id}`, assignments: '/attendance/shift-assignments', assignment: (id: string) => `/attendance/shift-assignments/${id}`,
    roster: '/attendance/roster', locations: '/attendance/locations', location: (id: string) => `/attendance/locations/${id}`, devices: '/attendance/devices', deviceActive: (id: string) => `/attendance/devices/${id}/active`,
  },
  payroll: {
    components: '/payroll/components', component: (id: string) => `/payroll/components/${id}`, structures: '/payroll/structures', structure: (id: string) => `/payroll/structures/${id}`,
    structurePreview: '/payroll/structures/preview', assignments: '/payroll/assignments', assignmentsBulk: '/payroll/assignments/bulk', additional: '/payroll/additional', additionalOne: (id: string) => `/payroll/additional/${id}`,
    loans: '/payroll/loans', loanClose: (id: string) => `/payroll/loans/${id}/close`, runs: '/payroll/runs', run: (id: string) => `/payroll/runs/${id}`,
    runAction: (id: string, a: 'generate' | 'approve' | 'paid' | 'reopen') => `/payroll/runs/${id}/${a}`, preview: '/payroll/preview',
    mySlips: '/payroll/payslips/me', employeeSlips: (id: string) => `/payroll/payslips/employee/${id}`, slip: (id: string) => `/payroll/payslips/${id}`, slipPdf: (id: string) => `/payroll/payslips/${id}/pdf`,
    taxCategories: '/payroll/tax/categories', myDeclaration: '/payroll/tax/declaration/me', taxCompare: '/payroll/tax/compare', declarations: '/payroll/tax/declarations',
    declarationDecision: (id: string, a: 'approve' | 'reject') => `/payroll/tax/declarations/${id}/${a}`, form16: '/payroll/tax/form16',
    report: (name: 'ecr' | 'esi' | 'pt' | 'bank-advice' | 'register' | '24q' | 'bonus') => `/payroll/reports/${name}`,
  },
  lifecycle: {
    templates: '/lifecycle/onboarding-templates', onboarding: '/lifecycle/onboarding', onboardingFor: (id: string) => `/lifecycle/onboarding/employee/${id}`, task: (id: string) => `/lifecycle/onboarding/tasks/${id}`,
    resign: '/lifecycle/resign', separations: '/lifecycle/separations', separation: (id: string) => `/lifecycle/separations/${id}`,
    separationAction: (id: string, a: 'approve' | 'reject' | 'exit-interview' | 'fnf' | 'fnf/approve' | 'complete') => `/lifecycle/separations/${id}/${a}`, clearance: (id: string) => `/lifecycle/clearances/${id}`,
    letter: (id: string) => `/lifecycle/separations/${id}/letter`,
  },
  performance: {
    cycles: '/performance/cycles', cycle: (id: string) => `/performance/cycles/${id}`, launch: (id: string) => `/performance/cycles/${id}/launch`, summary: (id: string) => `/performance/cycles/${id}/summary`,
    goals: '/performance/goals', goal: (id: string) => `/performance/goals/${id}`, goalDecision: (id: string, a: 'approve' | 'reject') => `/performance/goals/${id}/${a}`,
    mine: '/performance/appraisals/mine', pending: '/performance/appraisals/pending', byCycle: (id: string) => `/performance/appraisals/cycle/${id}`, appraisal: (id: string) => `/performance/appraisals/${id}`,
    appraisalAction: (id: string, a: 'self-review' | 'manager-review' | 'finalize' | 'apply-revision') => `/performance/appraisals/${id}/${a}`,
  },
  expenses: {
    categories: '/expenses/categories', claims: '/expenses/claims', claim: (id: string) => `/expenses/claims/${id}`, claimAction: (id: string, a: 'submit' | 'approve' | 'reject') => `/expenses/claims/${id}/${a}`,
    receipts: '/expenses/receipts', receiptDownload: '/expenses/receipts/download', travel: '/expenses/travel', travelDecision: (id: string, a: 'approve' | 'reject') => `/expenses/travel/${id}/${a}`,
  },
  helpdesk: { categories: '/helpdesk/categories', tickets: '/helpdesk/tickets', ticket: (id: string) => `/helpdesk/tickets/${id}`, comments: (id: string) => `/helpdesk/tickets/${id}/comments` },
  billing: {
    plans: '/billing/plans', entitlements: '/billing/entitlements', overview: '/billing', checkout: '/billing/checkout', confirm: '/billing/checkout/confirm',
    seats: '/billing/seats', cancel: '/billing/cancel', invoicePdf: (id: string) => `/billing/invoices/${id}/pdf`,
  },
  uploads: { sign: '/uploads/sign' },
  meta: { runtime: '/meta/runtime', realtime: '/notifications/realtime' },
  compliance: { calendar: '/compliance/calendar', overtime: '/compliance/overtime', filing: (key: string) => `/compliance/filings/${encodeURIComponent(key)}` },
  privacy: {
    consents: '/privacy/consents', consent: (purpose: string) => `/privacy/consents/${purpose}`, myData: '/privacy/my-data', requests: '/privacy/requests', myRequests: '/privacy/requests/mine', request: (id: string) => `/privacy/requests/${id}`,
    exportFor: (employeeId: string) => `/privacy/export/${employeeId}`, overview: '/privacy/overview', retention: '/privacy/retention', erase: (employeeId: string) => `/privacy/erase/${employeeId}`, anonymiseApplicants: '/privacy/applicants/anonymise',
    breaches: '/privacy/breaches', breach: (id: string) => `/privacy/breaches/${id}`, notifyBreach: (id: string) => `/privacy/breaches/${id}/notify-employees`,
  },
  recruitment: {
    jobs: '/recruitment/jobs', job: (id: string) => `/recruitment/jobs/${id}`, applicants: '/recruitment/applicants', stage: (id: string) => `/recruitment/applicants/${id}/stage`, funnel: '/recruitment/funnel',
    interviews: '/recruitment/interviews', interview: (id: string) => `/recruitment/interviews/${id}`, offers: '/recruitment/offers', offerRespond: (id: string, a: 'accept' | 'decline') => `/recruitment/offers/${id}/${a}`, hire: '/recruitment/hire',
    publicCompany: (companyId: string) => `/public/careers/company/${companyId}`, publicJob: (slug: string) => `/public/careers/jobs/${slug}`, publicApply: (slug: string) => `/public/careers/jobs/${slug}/apply`, publicResumeUpload: (slug: string) => `/public/careers/jobs/${slug}/resume-upload`,
  },
  reports: {
    adminDashboard: '/reports/dashboard/admin', managerDashboard: '/reports/dashboard/manager', essDashboard: '/reports/dashboard/ess',
    mis: '/reports/mis', misRun: (key: string) => `/reports/mis/${key}`, customCatalog: '/reports/custom/catalog', custom: '/reports/custom',
  },
  ai: { chat: '/ai/chat', anomalies: '/ai/anomalies', attrition: '/ai/attrition-risk' },
} as const;
