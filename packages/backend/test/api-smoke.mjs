// End-to-end API smoke test. Requires: seeded DB + API running (API=http://localhost:3002 node test/api-smoke.mjs)
// and the Supabase Auth the API uses (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY; defaults to test/support/gotrue-stub.mjs).
// Creates throw-away records (a test employee, a second tenant); re-seed for a clean slate.
import { enrollTotp, refresh, signIn, signUp, verifyTotp } from './support/supabase-auth.mjs';
const BASE = process.env.API || 'http://localhost:3010';
let failures = 0, passes = 0;

async function call(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => null) : await res.text();
  return { status: res.status, data, ct };
}
const ok = (name, cond, extra) => { if (cond) passes++; else { failures++; console.log(`  ✗ ${name}`, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : ''); } };
// Supabase session plus the JantaHR profile, like the web app holds after sign-in
const login = async (email, pw) => { const s = await signIn(email, pw); return s.accessToken ? { ...s, user: (await call('GET', '/auth/me', s.accessToken)).data } : s; };

const admin = (await login('admin@jantahr.com', 'Admin@123'));
ok('admin login returns tokens', !!admin.accessToken && !!admin.refreshToken, admin);
const A = admin.accessToken;
const hr = (await login('hr@jantahr.com', 'Demo@1234')).accessToken;
const pay = (await login('payroll@jantahr.com', 'Demo@1234')).accessToken;
const mgr = (await login('manager@jantahr.com', 'Demo@1234')).accessToken;
const emp = (await login('employee@jantahr.com', 'Demo@1234')).accessToken;
const aud = (await login('auditor@jantahr.com', 'Demo@1234')).accessToken;
ok('all role logins work', [hr, pay, mgr, emp, aud].every(Boolean));

// ---- auth (Supabase Auth signs in; the API verifies its tokens) ----
ok('bad password refused by Supabase', (await signIn('admin@jantahr.com', 'nope1234')).status === 400);
ok('no token -> 401', (await call('GET', '/employees')).status === 401);
const forged = await call('GET', '/employees', `${A.split('.').slice(0, 2).join('.')}.forged-signature`);
ok('forged token -> 401', forged.status === 401 && forged.data?.code === 'SESSION_INVALID', forged.data);
ok('auth/me', (await call('GET', '/auth/me', emp)).data?.employee?.employeeCode === 'EMP005');
const ref = await refresh(admin.refreshToken);
ok('refreshed Supabase session works', ref.status === 200 && (await call('GET', '/auth/me', ref.accessToken)).data?.role === 'SUPER_ADMIN', ref);
ok('old endpoints are gone', (await call('POST', '/auth/login', null, { email: 'admin@jantahr.com', password: 'Admin@123' })).status === 404);
const stray = await signUp(`stray.${Date.now()}@example.com`, 'Stray12345');
const strayCall = await call('GET', '/auth/me', stray.accessToken);
ok('Supabase user without a JantaHR account -> NO_ACCOUNT', strayCall.status === 401 && strayCall.data?.code === 'NO_ACCOUNT', strayCall.data);
ok('set-password needs an email link, not a password session', (await call('POST', '/auth/set-password', emp, { newPassword: 'Another123' })).status === 403);

// ---- RBAC ----
ok('employee cannot list employees', (await call('GET', '/employees', emp)).status === 403);
ok('employee cannot create employee', (await call('POST', '/employees', emp, {})).status === 403);
ok('employee cannot see payroll runs', (await call('GET', '/payroll/runs', emp)).status === 403);
ok('manager cannot see payroll runs', (await call('GET', '/payroll/runs', mgr)).status === 403);
ok('auditor cannot create', (await call('POST', '/departments', aud, { name: 'X' })).status === 403);
ok('auditor can read payroll runs', (await call('GET', '/payroll/runs', aud)).status === 200);

// ---- core HR ----
const list = await call('GET', '/employees?limit=50', A);
ok('admin employee list 15', list.data?.total === 15, list.data?.total);
const e5 = list.data.items.find((e) => e.employeeCode === 'EMP005');
ok('admin sees full PAN', e5?.panNumber === 'EESPS5005E', e5?.panNumber);
const mgrList = await call('GET', '/employees?limit=50', mgr);
ok('manager sees team only (self + reportees)', mgrList.data?.total === 5, mgrList.data?.total);
const mgrView = mgrList.data.items.find((e) => e.employeeCode === 'EMP005');
ok('manager sees masked PAN', /^\*+005E$/.test(mgrView?.panNumber || ''), mgrView?.panNumber);
ok('manager does not see CTC', mgrView && mgrView.ctc === undefined);
const audList = await call('GET', '/employees?limit=50', aud);
const audE5 = audList.data.items.find((e) => e.employeeCode === 'EMP005');
ok('auditor PAN masked, contact hidden', /^\*+005E$/.test(audE5?.panNumber || '') && audE5.phone === undefined && audE5.ctc === undefined, audE5);
const dir = await call('GET', '/employees/directory', emp);
ok('directory for employee', dir.data?.length >= 14, dir.data?.length);
const org = await call('GET', '/employees/org-chart', emp);
ok('org chart root is CEO', org.data?.[0]?.name?.startsWith('Aarav') && org.data[0].children.length >= 3, org.data?.[0]);
ok('employee cannot open other employee', (await call('GET', `/employees/${list.data.items[0].id}`, emp)).status === 403);
ok('employee me', (await call('GET', '/employees/me', emp)).data?.bankAccountNumber?.length > 8);

const newEmp = await call('POST', '/employees', hr, { firstName: 'Test', lastName: 'Joiner', email: 'test.joiner@jantahr.com', gender: 'MALE', dateOfJoining: '2026-09-01', panNumber: 'ZZZZZ9999Z', ctc: 1500000, state: 'Maharashtra' });
ok('create employee', newEmp.status === 201 && !!newEmp.data.temporaryPassword, newEmp);
ok('duplicate email rejected', (await call('POST', '/employees', hr, { firstName: 'T', lastName: 'J', email: 'test.joiner@jantahr.com', gender: 'MALE', dateOfJoining: '2026-09-01' })).status === 400);
ok('invalid PAN rejected', (await call('POST', '/employees', hr, { firstName: 'T', lastName: 'J', email: 'x1@jantahr.com', gender: 'MALE', dateOfJoining: '2026-09-01', panNumber: 'bad' })).status === 400);
ok('HR cannot create super admin', (await call('POST', '/employees', hr, { firstName: 'T', lastName: 'J', email: 'x2@jantahr.com', gender: 'MALE', dateOfJoining: '2026-09-01', role: 'SUPER_ADMIN' })).status === 403);
ok('new employee gets leave allocated + onboarding', (await call('GET', `/leave/balance?employeeId=${newEmp.data.id}`, hr)).data?.length >= 3 && (await call('GET', `/lifecycle/onboarding/employee/${newEmp.data.id}`, hr)).data?.tasks?.length >= 5);
const newLogin = await signIn('test.joiner@jantahr.com', newEmp.data.temporaryPassword);
ok('new employee can sign in with the temporary password, must change it', newLogin.status === 200 && (await call('GET', '/auth/me', newLogin.accessToken)).data?.mustChangePassword === true, newLogin);
ok('change password needs the current one', (await call('POST', '/auth/change-password', newLogin.accessToken, { currentPassword: 'Wrong12345', newPassword: 'Newpass123' })).status === 400);
const chg = await call('POST', '/auth/change-password', newLogin.accessToken, { currentPassword: newEmp.data.temporaryPassword, newPassword: 'Newpass123' });
ok('change password', chg.status === 200 && (await call('GET', '/auth/me', newLogin.accessToken)).data?.mustChangePassword === false, chg);
ok('temporary password no longer works, new one does', (await signIn('test.joiner@jantahr.com', newEmp.data.temporaryPassword)).status === 400 && (await signIn('test.joiner@jantahr.com', 'Newpass123')).status === 200);
const joinerSession = await signIn('test.joiner@jantahr.com', 'Newpass123');
await new Promise((r) => setTimeout(r, 1100)); // token iat has 1 s resolution
const reset = await call('POST', `/employees/${newEmp.data.id}/reset-password`, hr);
ok('HR reset issues a new temporary password', reset.status === 201 && !!reset.data?.temporaryPassword, reset.data);
ok('HR reset signs the employee out everywhere', (await call('GET', '/auth/me', joinerSession.accessToken)).status === 401);
ok('HR-issued password signs in', (await signIn('test.joiner@jantahr.com', reset.data.temporaryPassword)).status === 200);
const susp = await call('POST', `/employees/${newEmp.data.id}/status`, hr, { status: 'SUSPENDED' });
ok('suspended employee is refused by Supabase and the API', susp.status === 201 && (await signIn('test.joiner@jantahr.com', reset.data.temporaryPassword)).status === 400, susp.data);
ok('reactivated employee signs in again', (await call('POST', `/employees/${newEmp.data.id}/status`, hr, { status: 'ACTIVE' })).status === 201 && (await signIn('test.joiner@jantahr.com', reset.data.temporaryPassword)).status === 200);
const importCsv = await call('POST', '/employees/import', hr, { csv: 'firstName,lastName,email,gender,dateOfJoining,department,designation,ctc\nCsv,One,csv.one@jantahr.com,FEMALE,2026-09-15,Sales,Account Executive,600000\nBad,Row,not-an-email,MALE,2026-09-15,,,' });
ok('CSV import 1 ok 1 failed', importCsv.data?.createdCount === 1 && importCsv.data?.failedCount === 1, importCsv.data);

const depts = await call('GET', '/departments', hr);
ok('departments', depts.data?.length >= 5);
const newDept = await call('POST', '/departments', hr, { name: 'Legal' });
ok('create dept', newDept.status === 201);
ok('dept cycle rejected', (await call('PATCH', `/departments/${newDept.data.id}`, hr, { parentDepartmentId: newDept.data.id })).status === 400);
ok('company get', (await call('GET', '/company', emp)).data?.name === 'Sahyadri Softworks');
ok('holiday calendar', (await call('GET', '/holidays/calendar?year=2026', emp)).data?.length >= 5);
ok('announcements', (await call('GET', '/announcements', emp)).data?.length >= 2);
const pols = await call('GET', '/policies', emp);
ok('policies', pols.data?.length === 4);
ok('ack policy', (await call('POST', `/policies/${pols.data[0].id}/acknowledge`, emp)).status === 201);

// ---- leave ----
const bal = await call('GET', '/leave/balance', emp);
const cl = bal.data?.find((b) => b.leaveType === 'Casual Leave');
const plb = bal.data?.find((b) => b.leaveType === 'Privilege Leave');
ok('leave balances exist (CL, PL accrued)', !!cl && !!plb && plb.available > 5, bal.data);
const types = await call('GET', '/leave/types', emp);
const clType = types.data.find((t) => t.name === 'Casual Leave');
const lop = types.data.find((t) => t.name === 'Leave Without Pay');
const prev = await call('POST', '/leave/preview', emp, { leaveTypeId: clType.id, fromDate: '2026-11-02', toDate: '2026-11-04' });
ok('leave preview', prev.data?.totalDays === 3, prev.data);
// Diwali Sunday 2026-11-08: sandwich CL Fri 6 -> Mon 9
const sand = await call('POST', '/leave/preview', emp, { leaveTypeId: clType.id, fromDate: '2026-11-06', toDate: '2026-11-09' });
ok('sandwich rule: Fri..Mon CL = 4 days', sand.data?.totalDays === 4, sand.data);
const apply = await call('POST', '/leave/applications', emp, { leaveTypeId: clType.id, fromDate: '2026-12-14', toDate: '2026-12-15', reason: 'smoke' });
ok('apply leave', apply.status === 201, apply.data);
ok('overlapping leave rejected', (await call('POST', '/leave/applications', emp, { leaveTypeId: clType.id, fromDate: '2026-12-15', toDate: '2026-12-16' })).status === 400);
ok('insufficient balance rejected', (await call('POST', '/leave/applications', emp, { leaveTypeId: clType.id, fromDate: '2027-02-01', toDate: '2027-03-30' })).status === 400);
ok('employee cannot approve own', (await call('POST', `/leave/applications/${apply.data.id}/approve`, emp, {})).status === 403);
const other = (await call('GET', '/leave/applications?scope=team&status=OPEN', mgr)).data;
ok('manager sees team leave', other.items?.some((l) => l.id === apply.data.id), other.total);
const appr = await call('POST', `/leave/applications/${apply.data.id}/approve`, mgr, { comment: 'ok' });
ok('manager approves', appr.data?.status === 'APPROVED', appr.data);
const bal2 = await call('GET', '/leave/balance', emp);
ok('balance reduced by 2', bal2.data.find((b) => b.leaveType === 'Casual Leave').used === cl.used + 2, bal2.data.find((b) => b.leaveType === 'Casual Leave'));
const cancel = await call('POST', `/leave/applications/${apply.data.id}/cancel`, emp);
ok('cancel approved future leave restores balance', cancel.data?.status === 'CANCELLED' && (await call('GET', '/leave/balance', emp)).data.find((b) => b.leaveType === 'Casual Leave').used === cl.used);
ok('leave calendar', (await call('GET', '/leave/calendar?year=2026&month=10', mgr)).status === 200);
ok('maternity not for male', (await call('POST', '/leave/applications', emp, { leaveTypeId: types.data.find((t) => t.name === 'Maternity Leave').id, fromDate: '2027-01-04', toDate: '2027-01-06' })).status === 400);
ok('leave encashment request', (await call('POST', '/leave/encashments', emp, { leaveTypeId: types.data.find((t) => t.name === 'Privilege Leave').id, days: 2 })).status === 201);

// ---- approvals follow the reporting line, not the MANAGER role ----
// Rohan (payroll@, PAYROLL_ADMIN) is the reporting manager of EMP012 (Pooja) and EMP015 (the auditor).
const pooja = (await login('pooja.desai@jantahr.com', 'Demo@1234')).accessToken;
const me = async (t) => (await call('GET', '/auth/me', t)).data?.hasReportees;
ok('auth/me hasReportees follows the reporting line', (await me(pay)) === true && (await me(mgr)) === true && (await me(emp)) === false && (await me(aud)) === false);
const pLeave = await call('POST', '/leave/applications', pooja, { leaveTypeId: clType.id, fromDate: '2026-12-21', toDate: '2026-12-21', reason: 'smoke: reporting line' });
ok('EMP012 applies leave', pLeave.status === 201, pLeave.data);
const payQueue = await call('GET', '/leave/applications/pending', pay);
ok('payroll admin sees only their reportees in the leave queue', payQueue.data?.some((l) => l.id === pLeave.data.id) && payQueue.data.every((l) => ['EMP012', 'EMP015'].includes(l.employee.employeeCode)), payQueue.data?.map?.((l) => l.employee.employeeCode));
ok('manager queue excludes another line', !(await call('GET', '/leave/applications/pending', mgr)).data?.some((l) => l.id === pLeave.data.id));
ok('auditor has no approvals queue', (await call('GET', '/leave/applications/pending', aud)).status === 403);
ok('auditor cannot approve a reportee leave', (await call('POST', `/leave/applications/${pLeave.data.id}/approve`, aud, {})).status === 403);
ok('manager of another line cannot approve EMP012', (await call('POST', `/leave/applications/${pLeave.data.id}/approve`, mgr, {})).status === 403);
ok('EMP012 cannot approve own leave', (await call('POST', `/leave/applications/${pLeave.data.id}/approve`, pooja, {})).status === 403);
const pAppr = await call('POST', `/leave/applications/${pLeave.data.id}/approve`, pay, { comment: 'ok' });
ok('payroll@ approves leave for EMP012 (reporting manager)', pAppr.data?.status === 'APPROVED', pAppr.data);
const pReq = await call('POST', '/attendance/requests', pooja, { fromDate: '2026-09-16', requestType: 'WFH', reason: 'smoke: reporting line' });
ok('EMP012 raises attendance request', pReq.status === 201, pReq.data);
const payAtt = await call('GET', '/attendance/requests?status=PENDING&scope=approvals', pay);
ok('approvals-scoped attendance queue: reportees only', payAtt.data?.some((r) => r.id === pReq.data.id) && payAtt.data.every((r) => ['EMP012', 'EMP015'].includes(r.employee.employeeCode)), payAtt.data?.length);
ok('auditor cannot approve attendance request', (await call('POST', `/attendance/requests/${pReq.data.id}/approve`, aud, {})).status === 403);
ok('payroll@ approves EMP012 attendance request', (await call('POST', `/attendance/requests/${pReq.data.id}/approve`, pay, {})).data?.status === 'APPROVED');
const payTeam = await call('GET', '/reports/dashboard/manager', pay);
ok('team dashboard for a non-MANAGER line manager', payTeam.data?.teamSize === 2, payTeam.data?.teamSize);
ok('ESS shows approval counts to a non-MANAGER line manager', (await call('GET', '/reports/dashboard/ess', pay)).data?.pendingApprovals !== null);
ok('ESS shows no approval counts to an individual contributor', (await call('GET', '/reports/dashboard/ess', emp)).data?.pendingApprovals === null);

// ---- attendance ----
const st0 = await call('GET', '/attendance/status', emp);
ok('attendance status', st0.status === 200 && st0.data.checkedIn === false, st0.data);
const pIn = await call('POST', '/attendance/punch', emp, {});
ok('punch in', pIn.data?.checkedIn === true, pIn.data);
ok('duplicate punch blocked', (await call('POST', '/attendance/punch', emp, {})).status === 400);
const myLog = await call('GET', '/attendance/me', emp);
ok('month log has today present', myLog.data?.days?.some((d) => d.status === 'PRESENT' && d.inTime), myLog.data?.summary);
ok('daily view (manager)', (await call('GET', '/attendance/daily', mgr)).data?.items?.length === 5);
ok('summary (hr)', (await call('GET', '/attendance/summary', hr)).data?.length >= 15);
const reg = await call('POST', '/attendance/requests', emp, { fromDate: '2026-09-15', requestType: 'WFH', reason: 'Internet repair visit' });
ok('WFH request', reg.status === 201, reg.data);
ok('manager approves request', (await call('POST', `/attendance/requests/${reg.data.id}/approve`, mgr, {})).data?.status === 'APPROVED');
ok('geo-fence create + block', await (async () => {
  await call('POST', '/attendance/locations', hr, { name: 'HQ', latitude: 19.0596, longitude: 72.8656, radiusMeters: 200 });
  const r = await call('POST', '/attendance/punch', mgr, { latitude: 12.97, longitude: 77.59 }); // Bengaluru
  const locs = await call('GET', '/attendance/locations', hr);
  await call('DELETE', `/attendance/locations/${locs.data[0].id}`, hr);
  return r.status === 400 && /HQ/.test(JSON.stringify(r.data));
})());
const dev = await call('POST', '/attendance/devices', hr, { name: 'Lobby ZK', serialNo: 'ZK123456' });
ok('register biometric device', !!dev.data?.apiKey, dev.data);
const push = await fetch(BASE + '/attendance/biometric/push', { method: 'POST', headers: { 'content-type': 'application/json', 'x-device-serial': 'ZK123456', 'x-device-key': dev.data.apiKey }, body: JSON.stringify({ punches: [{ employeeCode: 'EMP008', time: new Date(Date.now() - 3600000).toISOString(), type: 'IN' }, { employeeCode: 'NOPE', time: new Date().toISOString() }] }) });
const pushData = await push.json();
ok('biometric push', push.status === 200 && pushData.stored === 1 && pushData.unknownEmployees.includes('NOPE'), pushData);
ok('biometric bad key rejected', (await fetch(BASE + '/attendance/biometric/push', { method: 'POST', headers: { 'content-type': 'application/json', 'x-device-serial': 'ZK123456', 'x-device-key': 'x' }, body: JSON.stringify({ punches: [{ employeeCode: 'EMP008', time: new Date().toISOString() }] }) })).status === 401);
const shifts = await call('GET', '/attendance/shifts', hr);
ok('shifts', shifts.data?.length >= 1);
const csvImp = await call('POST', '/attendance/import', hr, { csv: 'employeeCode,date,status,inTime,outTime\nEMP013,2026-09-18,PRESENT,09:30,18:30\nEMP999,2026-09-18,PRESENT,,' });
ok('attendance import 1 ok 1 fail', csvImp.data?.imported === 1 && csvImp.data?.failed === 1, csvImp.data);

// ---- payroll ----
const runs = await call('GET', '/payroll/runs', pay);
ok('5 processed payroll runs', runs.data?.length === 5 && runs.data.every((r) => r.status === 'PAID'), runs.data?.map((r) => r.status));
const runDetail = await call('GET', `/payroll/runs/${runs.data[0].id}`, pay);
ok('run detail has slips', runDetail.data?.slips?.length >= 13, runDetail.data?.slips?.length);
const s5 = runDetail.data.slips.find((s) => s.employee.employeeCode === 'EMP005');
ok('EMP005 slip: earnings/deductions reconcile', s5 && Math.abs(s5.grossPay - s5.totalDeductions - s5.netPay) < 1 && s5.earnings.length >= 3, s5);
ok('PF capped 1800, PT 200 (MH)', s5?.pfEmployee === 1800 && s5?.professionalTax === 200, { pf: s5?.pfEmployee, pt: s5?.professionalTax });
const s13 = runDetail.data.slips.find((s) => s.employee.employeeCode === 'EMP013');
ok('EMP013 (₹2.4L CTC) ESI applies, no TDS', s13?.esiEmployee > 0 && s13?.tds === 0, s13);
const s6 = runDetail.data.slips.find((s) => s.employee.employeeCode === 'EMP006');
ok('Karnataka employee PT 200 (or Feb 300)', [200, 300].includes(s6?.professionalTax), s6?.professionalTax);
const s12 = runDetail.data.slips.find((s) => s.employee.employeeCode === 'EMP012');
ok('loan EMI deducted', s12?.loanDeduction === 10000, s12?.loanDeduction);
const s1 = runDetail.data.slips.find((s) => s.employee.employeeCode === 'EMP001');
ok('CEO pays TDS', s1?.tds > 0, s1?.tds);
const mySlips = await call('GET', '/payroll/payslips/me', emp);
ok('employee sees own payslips', mySlips.data?.length === 5, mySlips.data?.length);
const pdf = await fetch(`${BASE}/payroll/payslips/${mySlips.data[0].id}/pdf`, { headers: { authorization: `Bearer ${emp}` } });
const pdfBuf = Buffer.from(await pdf.arrayBuffer());
ok('payslip PDF', pdf.status === 200 && pdfBuf.slice(0, 4).toString() === '%PDF' && pdfBuf.length > 2000, pdf.status);
ok('other employee slip forbidden', (await call('GET', `/payroll/payslips/${s1.id}`, emp)).status === 403);
const prevw = await call('GET', '/payroll/preview?employeeId=' + s5.employeeId + '&month=9&year=2026', pay);
ok('payroll preview current month', prevw.status === 200 && prevw.data.grossPay > 0, prevw.data);
const comps = await call('GET', '/payroll/components', pay);
ok('components incl statutory', comps.data?.some((c) => c.abbr === 'PF' && c.isStatutory));
const structs = await call('GET', '/payroll/structures', pay);
const prevS = await call('POST', '/payroll/structures/preview', pay, { salaryStructureId: structs.data[0].id, ctc: 1200000 });
ok('structure preview: 12L CTC -> basic 50000 (labour-code 50%), HRA 20000', prevS.data?.monthly?.find((m) => m.abbr === 'BASIC')?.monthly === 50000 && prevS.data.monthly.find((m) => m.abbr === 'HRA')?.monthly === 20000 && prevS.data.grossMonthly > 90000, prevS.data);
const badStruct = await call('POST', '/payroll/structures', pay, { name: 'Bad', components: [{ componentId: comps.data.find((c) => c.abbr === 'BASIC').id, formula: 'MONTHLY_CTC * ' }] });
ok('bad formula rejected', badStruct.status === 400, badStruct.data);
const badStruct2 = await call('POST', '/payroll/structures', pay, { name: 'Bad2', components: [{ componentId: comps.data.find((c) => c.abbr === 'BASIC').id, formula: 'NOPE * 2' }] });
ok('unknown variable rejected', badStruct2.status === 400 && /Unknown variable/.test(JSON.stringify(badStruct2.data)));
const q24 = await call('GET', '/payroll/reports/ecr?month=8&year=2026&format=json', pay);
ok('ECR json', q24.data?.rows?.length >= 12 && q24.data.text.includes('#~#'), q24.data?.rows?.length);
const ecrTxt = await fetch(`${BASE}/payroll/reports/ecr?month=8&year=2026`, { headers: { authorization: `Bearer ${pay}` } });
ok('ECR txt download', (await ecrTxt.text()).split('\n').length >= 12);
ok('ESI report', (await call('GET', '/payroll/reports/esi?month=8&year=2026&format=json', pay)).data?.rows?.length >= 1);
ok('PT report', (await call('GET', '/payroll/reports/pt?month=8&year=2026&format=json', pay)).data?.total > 0);
const bank = await call('GET', '/payroll/reports/bank-advice?month=8&year=2026&format=json', pay);
ok('bank advice has accounts', bank.data?.rows?.length >= 12 && bank.data.rows[0].account_number.length >= 8 && bank.data.missingBankDetails.length <= 1, bank.data?.missingBankDetails);
ok('salary register', (await call('GET', '/payroll/reports/register?month=8&year=2026&format=json', pay)).data?.rows?.length >= 12);
ok('24Q extract', (await call('GET', '/payroll/reports/24q?fy=2026&quarter=1&format=json', pay)).data?.totalTds > 0);
ok('bonus report', (await call('GET', '/payroll/reports/bonus?fy=2026&rate=8.33&format=json', pay)).status === 200);
const f16 = await fetch(`${BASE}/payroll/tax/form16?fy=2026`, { headers: { authorization: `Bearer ${emp}` } });
ok('Form 16 summary PDF', f16.status === 200 && Buffer.from(await f16.arrayBuffer()).slice(0, 4).toString() === '%PDF', f16.status);
ok('default components include exempt allowances (Rules 2026)', ['CEA', 'HOSTEL', 'MEAL'].every((a) => comps.data?.find((c) => c.abbr === a)?.exemptionCode), comps.data?.map((c) => [c.abbr, c.exemptionCode]));
ok('invalid exemption code rejected', (await call('POST', '/payroll/components', pay, { name: 'Odd', abbr: 'ODD', type: 'EARNING', exemptionCode: 'FUEL' })).status === 400);
const mealC = await call('POST', '/payroll/components', pay, { name: 'Food Card', abbr: 'FOODCARD', type: 'EARNING', exemptionCode: 'MEAL' });
ok('component with meal exemption', mealC.status === 201 && mealC.data.exemptionCode === 'MEAL', mealC.data);
const cmp = await call('GET', '/payroll/tax/compare', emp);
ok('regime comparison', cmp.data?.old?.totalTax > 0 && cmp.data?.new?.totalTax > 0 && ['OLD', 'NEW'].includes(cmp.data.recommended), cmp.data);
ok('declaration me', (await call('GET', '/payroll/tax/declaration/me', emp)).data?.declaration?.status === 'APPROVED');
ok('approved declaration locked', (await call('PUT', '/payroll/tax/declaration/me', emp, { taxRegime: 'NEW' })).status === 400);
const cats = await call('GET', '/payroll/tax/categories', emp);
ok('tax categories', cats.data?.length >= 6);
const loanList = await call('GET', '/payroll/loans', pay);
ok('loans', loanList.data?.length === 1 && loanList.data[0].paidInstallments === 5 && Number(loanList.data[0].outstanding) === 10000, loanList.data?.[0]);
// new run for Sept -> generate; approve; then locked
const sepRun = await call('POST', '/payroll/runs', pay, { month: 9, year: 2026 });
ok('create Sept run', sepRun.status === 201 && sepRun.data.generated >= 13, { s: sepRun.status, g: sepRun.data?.generated, sk: sepRun.data?.skipped });
const sepId = sepRun.data?.run?.id;
const sepSkipped = (sepRun.data?.skipped || []).map((x) => `${x.employeeCode}:${x.reason}`);
console.log('  (Sept skipped:', sepSkipped.join(' | ') || 'none', ')');
ok('duplicate run just regenerates', (await call('POST', '/payroll/runs', pay, { month: 9, year: 2026 })).data?.run?.id === sepId);
ok('cannot mark paid before approve', (await call('POST', `/payroll/runs/${sepId}/paid`, pay)).status === 400);
ok('approve Sept', (await call('POST', `/payroll/runs/${sepId}/approve`, pay)).data?.status === 'APPROVED');
ok('leave apply blocked after payroll approval', (await call('POST', '/leave/applications', emp, { leaveTypeId: clType.id, fromDate: '2026-09-28', toDate: '2026-09-28' })).status === 400);
ok('reopen Sept', (await call('POST', `/payroll/runs/${sepId}/reopen`, pay)).data?.status === 'GENERATED');
ok('delete Sept run', (await call('DELETE', `/payroll/runs/${sepId}`, pay)).data?.ok === true);

// ---- lifecycle / performance / expenses / helpdesk / recruitment ----
ok('onboarding list (new joiners only open)', (await call('GET', '/lifecycle/onboarding', hr)).data?.length >= 2);
const seps = await call('GET', '/lifecycle/separations', hr);
ok('pending resignation from seed', seps.data?.length === 1 && seps.data[0].status === 'PENDING', seps.data);
const sepApprove = await call('POST', `/lifecycle/separations/${seps.data[0].id}/approve`, hr, {});
ok('approve resignation creates clearances', sepApprove.data?.clearances?.length === 5, sepApprove.data);
const fnf = await call('POST', `/lifecycle/separations/${seps.data[0].id}/fnf`, pay, {});
ok('F&F computes', fnf.status === 201 && typeof fnf.data.netPayable === 'number', fnf.data);
ok('F&F approve blocked by pending clearance', (await call('POST', `/lifecycle/separations/${seps.data[0].id}/fnf/approve`, pay)).status === 400);
const cycles = await call('GET', '/performance/cycles', hr);
ok('perf cycles', cycles.data?.length === 2);
const prevCycle = cycles.data.find((c) => c.name.startsWith('Annual'));
ok('cycle summary', (await call('GET', `/performance/cycles/${prevCycle.id}/summary`, hr)).data?.averageRating > 0);
const apps = await call('GET', `/performance/appraisals/cycle/${prevCycle.id}`, hr);
const done = apps.data.find((a) => a.status === 'COMPLETED' && Number(a.salaryRevisionPercent) > 0 && a.employee.employeeCode === 'EMP005');
ok('completed appraisal w/ revision', !!done, apps.data?.map((a) => a.status));
ok('goals visible', (await call('GET', '/performance/goals', emp)).data?.length >= 1);
const exps = await call('GET', '/expenses/claims?scope=team', mgr);
ok('team expense claims', exps.data?.length >= 1);
ok('helpdesk tickets', (await call('GET', '/helpdesk/tickets?scope=all', hr)).data?.length === 1);
const jobs = await call('GET', '/recruitment/jobs', hr);
ok('jobs', jobs.data?.length === 2);
const cid = admin.user.company.id;
const pub = await call('GET', `/public/careers/company/${cid}`, null);
ok('public careers page (no auth)', pub.data?.jobs?.length === 2, pub.data);
ok('apply without privacy acceptance rejected', (await call('POST', `/public/careers/jobs/${pub.data.jobs[0].slug}/apply`, null, { name: 'No Consent', email: 'noconsent@example.com' })).status === 400);
const pj = await call('POST', `/public/careers/jobs/${pub.data.jobs[0].slug}/apply`, null, { name: 'Public Applicant', email: 'public@example.com', acceptedPrivacy: true });
ok('public apply', pj.status === 201, pj.data);
ok('duplicate application rejected', (await call('POST', `/public/careers/jobs/${pub.data.jobs[0].slug}/apply`, null, { name: 'Public Applicant', email: 'public@example.com', acceptedPrivacy: true })).status === 400);
ok('funnel', (await call('GET', '/recruitment/funnel', hr)).data?.APPLIED >= 1);

// ---- dashboards / reports / AI / notifications ----
const dAdmin = await call('GET', '/reports/dashboard/admin', hr);
ok('admin dashboard', dAdmin.data?.headcount?.active >= 15 && dAdmin.data.payrollTrend.length === 5, dAdmin.data?.headcount);
const dMgr = await call('GET', '/reports/dashboard/manager', mgr);
ok('manager dashboard', dMgr.data?.teamSize === 4, dMgr.data?.teamSize);
const dEss = await call('GET', '/reports/dashboard/ess', emp);
ok('ESS dashboard', dEss.data?.leaveBalances?.length >= 3 && dEss.data?.latestPayslips?.length === 3 && dEss.data?.today?.checkedIn === true, Object.keys(dEss.data || {}));
ok('employee blocked from admin dashboard', (await call('GET', '/reports/dashboard/admin', emp)).status === 403);
const cat = await call('GET', '/reports/mis', hr);
ok('MIS catalog', cat.data?.length >= 15);
for (const k of cat.data.map((c) => c.key)) {
  const r = await call('GET', `/reports/mis/${k}`, hr);
  ok(`MIS ${k}`, r.status === 200 && Array.isArray(r.data?.rows), { s: r.status, d: r.data });
}
const csvRep = await fetch(`${BASE}/reports/mis/headcount?format=csv`, { headers: { authorization: `Bearer ${hr}` } });
ok('MIS csv', (await csvRep.text()).startsWith('department,headcount'));
const cr = await call('POST', '/reports/custom', hr, { entity: 'employees', columns: ['employee_code', 'name', 'department', 'ctc'], filters: [{ field: 'department', op: 'eq', value: 'Engineering' }], sortBy: 'ctc', sortDir: 'desc' });
ok('custom report filter+sort', cr.data?.rows?.length === 5 && cr.data.rows[0].ctc >= cr.data.rows[1].ctc, cr.data);
ok('custom report blocks unknown col', (await call('POST', '/reports/custom', hr, { entity: 'employees', columns: ['passwordHash'] })).status === 400);
const crA = await call('POST', '/reports/custom', aud, { entity: 'employees', columns: ['ctc'] });
ok('auditor cannot use ctc column', crA.status === 400, crA.data);
const chat1 = await call('POST', '/ai/chat', emp, { message: 'What is my leave balance?' });
ok('chatbot leave balance', chat1.data?.intent === 'leave_balance' && /Casual Leave/.test(chat1.data.reply), chat1.data);
ok('chatbot payslip', (await call('POST', '/ai/chat', emp, { message: 'show my latest payslip' })).data?.intent === 'payslip');
ok('chatbot tax', (await call('POST', '/ai/chat', emp, { message: 'which tax regime is better for me' })).data?.intent === 'tax');
const pol = await call('POST', '/ai/chat', emp, { message: 'how many days can I work from home per week?' });
ok('chatbot policy retrieval', /2 days/.test(pol.data?.reply || ''), pol.data);
ok('anomalies', (await call('GET', '/ai/anomalies', hr)).status === 200);
const attr = await call('GET', '/ai/attrition-risk', hr);
ok('attrition risk', attr.data?.employees?.length > 0 && attr.data.employees[0].factors, attr.data?.summary);
ok('employee blocked from attrition risk', (await call('GET', '/ai/attrition-risk', emp)).status === 403);
const notes = await call('GET', '/notifications', emp);
ok('notifications exist', notes.data?.unreadCount >= 1, notes.data?.unreadCount);
ok('mark all read', (await call('POST', '/notifications/read-all', emp)).data?.ok === true && (await call('GET', '/notifications/unread-count', emp)).data.count === 0);

// ---- tenancy isolation: sign up a second company ----
const oliviaEmail = `olivia.${Date.now().toString(36)}@other.example`; // Supabase accounts outlive a re-seed
const oliviaAuth = await signUp(oliviaEmail, 'Secret123');
const su = await call('POST', '/auth/provision', oliviaAuth.accessToken, { companyName: 'Other Corp', firstName: 'Olivia', lastName: 'Other' });
ok('company signup: Supabase account + provision', su.status === 201 && su.data?.role === 'SUPER_ADMIN', su.data);
ok('provision only once', (await call('POST', '/auth/provision', oliviaAuth.accessToken, { companyName: 'Again', firstName: 'Olivia' })).status === 409);
ok('an employee\'s email cannot be signed up again in Supabase', (await signUp('hr@jantahr.com', 'Takeover123')).status !== 200);
let O = oliviaAuth.accessToken;
ok('tenant B sees only itself', (await call('GET', '/employees', O)).data?.total === 1);
ok('tenant B cannot open tenant A employee', (await call('GET', `/employees/${list.data.items[0].id}`, O)).status === 404);
ok('tenant B has own defaults', (await call('GET', '/leave/types', O)).data?.length === 8 && (await call('GET', '/payroll/structures', O)).data?.length === 1);
ok('tenant B cannot see A payroll run', (await call('GET', `/payroll/runs/${runs.data[0].id}`, O)).status === 404);
ok('tenant B cannot approve A leave', (await call('POST', `/leave/applications/${apply.data.id}/approve`, O, {})).status === 404);
const totpEnrol = await enrollTotp(O);
ok('TOTP enrolled in Supabase', totpEnrol.session.status === 200, totpEnrol.session);
ok('mfa sync turns on two-factor', (await call('POST', '/auth/mfa/sync', totpEnrol.session.accessToken)).data?.mfaEnabled === true);
const aal1 = await signIn(oliviaEmail, 'Secret123');
const needsMfa = await call('GET', '/auth/me', aal1.accessToken);
ok('password-only session refused once two-factor is on', needsMfa.status === 401 && needsMfa.data?.code === 'MFA_REQUIRED', needsMfa.data);
const aal2 = await verifyTotp(aal1.accessToken, totpEnrol.factorId, totpEnrol.secret);
ok('TOTP step-up session accepted', (await call('GET', '/auth/me', aal2.accessToken)).status === 200, aal2);
O = aal2.accessToken;

// ---- DPDP / privacy ----
const cons = await call('GET', '/privacy/consents', emp);
ok('consents: 4 purposes, none asked yet', cons.data?.purposes?.length === 4 && cons.data.purposes.every((p) => p.state === 'NOT_ASKED'), cons.data);
ok('privacy notice cannot be withdrawn', (await call('PUT', '/privacy/consents/PRIVACY_NOTICE', emp, { granted: false })).status === 400);
ok('unknown consent purpose rejected', (await call('PUT', '/privacy/consents/MARKETING', emp, { granted: true })).status === 400);
const ack = await call('PUT', '/privacy/consents/PRIVACY_NOTICE', emp, { granted: true });
ok('acknowledge notice', ack.data?.purposes?.find((p) => p.purpose === 'PRIVACY_NOTICE')?.state === 'GRANTED', ack.data);

// consent is enforced: withdrawn selfie/location are not stored (tenant B has no geo-fence)
await call('PUT', '/privacy/consents/SELFIE_AT_CHECKIN', O, { granted: false });
await call('PUT', '/privacy/consents/LOCATION_AT_CHECKIN', O, { granted: false });
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const pB = await call('POST', '/attendance/punch', O, { selfie: png, latitude: 12.9716, longitude: 77.5946 });
ok('punch succeeds after withdrawing consent', pB.data?.checkedIn === true, pB.data);
const exB = await call('GET', '/privacy/my-data', O);
ok('selfie + GPS were not stored', exB.data?.profile?.checkins?.length === 1 && exB.data.profile.checkins[0].selfieUrl === null && exB.data.profile.checkins[0].latitude === null, exB.data?.profile?.checkins);
ok('withdrawals recorded in ledger', exB.data?.consents?.filter((c) => c.granted === false).length === 2, exB.data?.consents);

// right of access
const mine = await call('GET', '/privacy/my-data', emp);
ok('my-data export is a download', /attachment/.test((await fetch(BASE + '/privacy/my-data', { headers: { authorization: `Bearer ${emp}` } })).headers.get('content-disposition') || ''));
ok('my-data has own identifiers in clear', mine.data?.profile?.employeeCode === 'EMP005' && mine.data.profile.panNumber === 'EESPS5005E', mine.data?.profile?.panNumber);
ok('my-data never leaks credentials', !/passwordHash|mfaSecret|tokenHash/.test(JSON.stringify(mine.data)));
const hrExport = await call('GET', `/privacy/export/${e5.id}`, hr);
ok('HR can export a person for an access request', hrExport.data?._meta?.employeeCode === 'EMP005' && hrExport.data.profile.salarySlips?.length > 0, hrExport.data?._meta);
ok('employee cannot export others', (await call('GET', `/privacy/export/${e5.id}`, emp)).status === 403);
ok('manager cannot export others', (await call('GET', `/privacy/export/${e5.id}`, mgr)).status === 403);
ok('tenant B cannot export tenant A person', (await call('GET', `/privacy/export/${e5.id}`, O)).status === 404);

// data-principal requests
const rq = await call('POST', '/privacy/requests', emp, { type: 'CORRECTION', details: 'My date of birth is recorded incorrectly, please fix it.' });
ok('create privacy request', rq.status === 201 && rq.data.status === 'OPEN' && new Date(rq.data.dueDate) > new Date(), rq.data);
ok('too-short request rejected', (await call('POST', '/privacy/requests', emp, { type: 'ACCESS', details: 'hi' })).status === 400);
ok('mine lists it', (await call('GET', '/privacy/requests/mine', emp)).data?.some((r) => r.id === rq.data.id));
ok('employee cannot list the queue', (await call('GET', '/privacy/requests', emp)).status === 403);
const queue = await call('GET', '/privacy/requests?status=OPEN', hr);
ok('HR sees queue with employee + overdue flag', queue.data?.some((r) => r.id === rq.data.id && r.employee?.employeeCode === 'EMP005' && r.overdue === false), queue.data);
ok('auditor can read the queue', (await call('GET', '/privacy/requests', aud)).status === 200);
ok('employee cannot resolve', (await call('PATCH', `/privacy/requests/${rq.data.id}`, emp, { status: 'COMPLETED', resolution: 'done' })).status === 403);
ok('closing needs a resolution note', (await call('PATCH', `/privacy/requests/${rq.data.id}`, hr, { status: 'COMPLETED' })).status === 400);
const rqDone = await call('PATCH', `/privacy/requests/${rq.data.id}`, hr, { status: 'COMPLETED', resolution: 'Corrected as per your Aadhaar proof.' });
ok('HR completes request', rqDone.data?.status === 'COMPLETED' && !!rqDone.data.resolvedAt, rqDone.data);
ok('closed request cannot be changed', (await call('PATCH', `/privacy/requests/${rq.data.id}`, hr, { status: 'OPEN' })).status === 400);
ok('employee notified of resolution', (await call('GET', '/notifications', emp)).data?.items?.some((n) => /privacy request/i.test(n.title)) ?? (await call('GET', '/notifications', emp)).data?.some?.((n) => /privacy request/i.test(n.title)));

// erasure (throw-away employee)
const er = await call('POST', '/employees', hr, { firstName: 'Erase', lastName: 'Me', email: 'erase.me@jantahr.com', gender: 'FEMALE', dateOfJoining: '2022-01-10', panNumber: 'ABCDE1234F', aadhaarNumber: '123412341234', phone: '9876500000', personalEmail: 'erase.me@gmail.example', currentAddress: '12 MG Road', bankName: 'HDFC', bankAccountNumber: '50100012345678', ifscCode: 'HDFC0000001', ctc: 900000, state: 'Karnataka' });
ok('erase target created', er.status === 201, er.data);
const erId = er.data.id ?? er.data.employee?.id;
const erCode = er.data.employeeCode ?? er.data.employee?.employeeCode;
ok('cannot erase an active employee', (await call('POST', `/privacy/erase/${erId}`, hr, { confirmEmployeeCode: erCode })).status === 400);
await call('POST', `/employees/${erId}/status`, hr, { status: 'LEFT' });
ok('wrong confirmation code refuses', (await call('POST', `/privacy/erase/${erId}`, hr, { confirmEmployeeCode: 'nope' })).status === 400);
ok('employee cannot erase', (await call('POST', `/privacy/erase/${erId}`, emp, { confirmEmployeeCode: erCode })).status === 403);
ok('tenant B cannot erase tenant A person', (await call('POST', `/privacy/erase/${erId}`, O, { confirmEmployeeCode: erCode })).status === 404);
const erRq = await call('POST', '/privacy/requests', emp, { type: 'ERASURE', details: 'Please erase my former colleague test record.' });
const eras = await call('POST', `/privacy/erase/${erId}`, hr, { confirmEmployeeCode: erCode, requestId: erRq.data.id });
ok('left employee is partially erased (statutory data kept)', eras.status === 201 && eras.data?.level === 'PARTIAL' && eras.data.retained.some((r) => /PAN/.test(r)), eras.data);
const erView = await call('GET', `/employees/${erId}`, hr);
ok('non-statutory PII gone, statutory kept', erView.data?.phone === null && erView.data.personalEmail === null && erView.data.currentAddress === null && erView.data.aadhaarNumber === null && erView.data.panNumber === 'ABCDE1234F' && erView.data.bankAccountNumber === '50100012345678', erView.data);
ok('erased employee cannot sign in', (await signIn('erase.me@jantahr.com', er.data.temporaryPassword)).status === 400);
const ret = await call('GET', '/privacy/retention', hr);
ok('retention report lists the erased leaver', ret.data?.employees?.some((e) => e.id === erId && !!e.erasedAt && e.plan.level === 'PARTIAL') && ret.data.retentionYears === 8, ret.data?.summary);
ok('auditor can view overview', (await call('GET', '/privacy/overview', aud)).data?.consents?.SELFIE_AT_CHECKIN?.WITHDRAWN >= 0);
ok('employee cannot view retention', (await call('GET', '/privacy/retention', emp)).status === 403);
ok('applicant anonymise validates months', (await call('POST', '/privacy/applicants/anonymise', hr, { olderThanMonths: 1 })).status === 400);
ok('applicant anonymise skips recent', (await call('POST', '/privacy/applicants/anonymise', hr, { olderThanMonths: 12 })).data?.anonymised === 0);
ok('housekeeping: super admin only', (await call('POST', '/privacy/housekeeping/run', hr)).status === 403 && typeof (await call('POST', '/privacy/housekeeping/run', A)).data?.applicants === 'number');

// breach register
const br = await call('POST', '/privacy/breaches', hr, { title: 'Misdirected payslip email', description: 'A batch of payslips was emailed to the wrong distribution list.', severity: 'HIGH', affectedCount: 12, dataCategories: 'Name, salary' });
ok('log breach', br.status === 201 && br.data.status === 'INVESTIGATING' && !!br.data.detectedAt, br.data);
ok('auditor reads breaches, cannot log', (await call('GET', '/privacy/breaches', aud)).status === 200 && (await call('POST', '/privacy/breaches', aud, { title: 'x', description: 'yyyyyyyyyyyy', severity: 'LOW' })).status === 403);
ok('employee cannot read breaches', (await call('GET', '/privacy/breaches', emp)).status === 403);
ok('cannot close before Board notified', (await call('PATCH', `/privacy/breaches/${br.data.id}`, hr, { status: 'CLOSED' })).status === 400);
ok('record Board notification', !!(await call('PATCH', `/privacy/breaches/${br.data.id}`, hr, { boardNotified: true, status: 'CONTAINED', containmentActions: 'Recalled emails.' })).data?.boardNotifiedAt);
const nb = await call('POST', `/privacy/breaches/${br.data.id}/notify-employees`, hr);
ok('notify employees flips status', nb.data?.status === 'NOTIFIED' && !!nb.data.principalsNotifiedAt, nb.data);
ok('employees received the notice', JSON.stringify((await call('GET', '/notifications', emp)).data).includes('data incident'));
ok('cannot notify twice', (await call('POST', `/privacy/breaches/${br.data.id}/notify-employees`, hr)).status === 400);
ok('close breach', (await call('PATCH', `/privacy/breaches/${br.data.id}`, hr, { status: 'CLOSED' })).data?.status === 'CLOSED');
ok('tenant B sees no breaches', (await call('GET', '/privacy/breaches', O)).data?.length === 0);

// ---- statutory compliance calendar ----
const cal = await call('GET', '/compliance/calendar', pay);
ok('compliance calendar returns dated items', Array.isArray(cal.data?.items) && cal.data.items.some((i) => i.category === 'WAGES') && cal.data.items.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.dueDate)), cal.data?.summary);
ok('paid months show as done', cal.data?.items?.some((i) => i.category === 'WAGES' && i.status === 'DONE'));
ok('seeded filings are done (nothing overdue)', cal.data?.summary?.OVERDUE === 0, cal.data?.items?.filter((i) => i.status === 'OVERDUE'));
const upcomingTds = cal.data.items.find((i) => i.key.startsWith('tds-') && i.status !== 'DONE');
ok('an upcoming TDS deposit exists', !!upcomingTds, cal.data.items.map((i) => i.key));
ok('mark TDS deposited', (await call('PUT', `/compliance/filings/${upcomingTds.key}`, pay, { reference: 'CIN12345' })).data?.reference === 'CIN12345');
ok('marked item is done', (await call('GET', '/compliance/calendar', pay)).data.items.find((i) => i.key === upcomingTds.key)?.status === 'DONE');
ok('wage items cannot be marked by hand', (await call('PUT', `/compliance/filings/wages-2026-9`, pay, {})).status === 400);
ok('unmark filing', (await call('DELETE', `/compliance/filings/${upcomingTds.key}`, pay)).data?.ok === true);
ok('employee cannot see compliance', (await call('GET', '/compliance/calendar', emp)).status === 403);
ok('auditor reads but cannot mark', (await call('GET', '/compliance/calendar', aud)).status === 200 && (await call('PUT', `/compliance/filings/${upcomingTds.key}`, aud, {})).status === 403);
const ot = await call('GET', '/compliance/overtime', hr);
ok('overtime cap report (125 h/quarter)', ot.data?.cap === 125 && Array.isArray(ot.data.employees), ot.data);
ok('tenant B calendar has no tenant A exits', !(await call('GET', '/compliance/calendar', O)).data?.items?.some((i) => i.category === 'EXIT'));

// ---- validation hardening ----
ok('mass-assignment stripped (companyId ignored)', (await call('POST', '/departments', hr, { name: 'Sneaky', companyId: 'other' })).data?.companyId === admin.user.company.id);
ok('validation error 400', (await call('POST', '/leave/applications', emp, { leaveTypeId: 1 })).status === 400);
ok('swagger docs', (await fetch(BASE + '/docs')).status === 200);

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
