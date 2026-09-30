import { EntitlementsService } from '../billing/entitlements.service';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AccessService } from '../../common/access/access.service';
import { ConsentService } from '../../common/consent/consent.service';
import { AuthUser } from '../../common/types';
import { addDays, isoDate, istDateOf, istMinutesOfDay, todayIST } from '../../common/utils/dates';
import { num, round2 } from '../../common/utils/money';
import { PrismaService } from '../../prisma/prisma.service';
import { AttendanceService } from '../attendance/attendance.service';
import { LeaveBalanceService } from '../leave/leave-balance.service';
import { TaxDeclarationService } from '../payroll/tax/tax-declaration.service';
import { errorMessage } from '../../common/utils/errors';

export class ChatDto {
  @IsString() @MinLength(1) @MaxLength(500) message: string;
}

export interface ChatReply { reply: string; intent: string; links?: { label: string; href: string }[]; suggestions?: string[] }

const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'what', 'how', 'do', 'i', 'my', 'me', 'to', 'of', 'for', 'in', 'on', 'and', 'or', 'can', 'get', 'about', 'tell', 'please', 'does', 'our', 'we', 'it']);
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t));
const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * HR assistant. Deterministic intents answer from the employee's own data (never other employees').
 * Free-form policy questions are answered from company policy text — by an LLM if ANTHROPIC_API_KEY is set,
 * otherwise by keyword retrieval. Only policy text (no personal data) is ever sent to the LLM.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private access: AccessService,
    private balances: LeaveBalanceService,
    private attendance: AttendanceService,
    private tax: TaxDeclarationService,
    private consent: ConsentService,
    private entitlements: EntitlementsService,
  ) {}

  async chat(user: AuthUser, message: string): Promise<ChatReply> {
    const m = message.toLowerCase();
    const empId = user.employeeId;
    const has = (...re: RegExp[]) => re.some((r) => r.test(m));

    if (has(/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/)) {
      return { intent: 'greeting', reply: 'Namaste! I can help with your leave balance, payslips, attendance, holidays, tax regime and company policies. What would you like to know?', suggestions: ['What is my leave balance?', 'Show my latest payslip', 'Upcoming holidays', 'Which tax regime is better for me?'] };
    }
    if (empId && has(/leave.*(balance|left|remaining|available)|(balance|remaining).*leave|how many (leaves|days off)/)) {
      const b = await this.balances.getBalances(empId, new Date());
      if (!b.length) return { intent: 'leave_balance', reply: 'No leave has been allocated to you yet. Please contact HR.' };
      return { intent: 'leave_balance', reply: 'Here is your leave balance:\n' + b.filter((x) => !x.isLWP).map((x) => `• ${x.leaveType}: ${x.available} available (${x.used} used${x.pending ? `, ${x.pending} pending approval` : ''})`).join('\n'), links: [{ label: 'Apply for leave', href: '/ess/dashboard' }] };
    }
    if (has(/holiday/)) {
      const hol = await this.prisma.holiday.findMany({ where: { holidayList: { companyId: user.companyId }, date: { gte: todayIST() }, isOptional: false }, orderBy: { date: 'asc' }, take: 5 });
      if (!hol.length) return { intent: 'holidays', reply: 'No upcoming holidays are configured yet.' };
      return { intent: 'holidays', reply: 'Upcoming holidays:\n' + hol.map((h) => `• ${isoDate(h.date)}: ${h.name}`).join('\n') };
    }
    if (empId && has(/(payslip|pay slip|salary slip|net pay|take.?home|last salary)/)) {
      const s = await this.prisma.salarySlip.findFirst({ where: { employeeId: empId, status: { in: ['APPROVED', 'PAID'] } }, orderBy: [{ year: 'desc' }, { month: 'desc' }] });
      if (!s) return { intent: 'payslip', reply: 'No payslip has been published for you yet.' };
      return { intent: 'payslip', reply: `Your latest payslip is for ${MONTHS[s.month - 1]} ${s.year}: gross ${inr(num(s.grossPay))}, deductions ${inr(num(s.totalDeductions))}, net pay ${inr(num(s.netPay))}${s.tds ? ` (TDS ${inr(num(s.tds))})` : ''}.`, links: [{ label: 'Download payslip PDF', href: `/api-proxy/payroll/payslips/${s.id}/pdf` }] };
    }
    if (empId && has(/(attendance|present|absent|late (mark|entry)|check.?in|working hours)/)) {
      const t = todayIST();
      const log = await this.attendance.monthLog(user, empId, t.getUTCFullYear(), t.getUTCMonth() + 1);
      const s = log.summary;
      return { intent: 'attendance', reply: `This month: ${s.present + s.wfh} present, ${s.halfDay} half-day, ${s.absent} absent, ${s.onLeave} on leave, ${s.lateMarks} late mark(s). Total ${s.workingHours} working hours.${s.notMarked ? ` ${s.notMarked} working day(s) are not marked yet.` : ''}` };
    }
    if (empId && has(/(tax|regime|tds|80c|section 80)/)) {
      try {
        const r = await this.tax.compareRegimes(user);
        return { intent: 'tax', reply: `Based on your current CTC and declared investments for FY ${r.fyStartYear}-${String(r.fyStartYear + 1).slice(2)}: the ${r.recommended === 'NEW' ? 'New' : 'Old'} regime saves you about ${inr(r.saving)}. Estimated tax: Old: ${inr(r.old.totalTax)}, New: ${inr(r.new.totalTax)}.`, links: [{ label: 'Update investment declaration', href: '/ess/dashboard' }] };
      } catch (e) {
        return { intent: 'tax', reply: (e instanceof HttpException ? errorMessage(e) : '') || 'I could not estimate your tax yet: your salary structure may not be assigned.' };
      }
    }
    if (empId && has(/(my manager|reporting (manager|to)|who.*(boss|manager))/)) {
      const e = await this.prisma.employee.findUnique({ where: { id: empId }, include: { reportingManager: true } });
      return { intent: 'manager', reply: e?.reportingManager ? `Your reporting manager is ${e.reportingManager.firstName} ${e.reportingManager.lastName}.` : 'No reporting manager is set on your profile.' };
    }
    if (has(/(notice period|resign|quit)/)) {
      const e = empId ? await this.prisma.employee.findUnique({ where: { id: empId } }) : null;
      return { intent: 'resignation', reply: `To resign, submit a resignation from the Exit section. Your notice period is ${e?.noticeperiodDays ?? 30} days. Your manager and HR will review it and start exit clearance.` };
    }
    if (has(/(apply|take|request).*(leave|day off)/)) {
      return { intent: 'apply_leave', reply: 'You can apply for leave from your dashboard: choose the leave type, dates (half-day supported) and a reason. Your manager gets notified for approval.', links: [{ label: 'Open dashboard', href: '/ess/dashboard' }] };
    }
    return this.policyAnswer(user, message);
  }

  private async policyAnswer(user: AuthUser, message: string): Promise<ChatReply> {
    const policies = await this.prisma.policy.findMany({ where: { companyId: user.companyId, isActive: true }, select: { title: true, content: true } });
    if (!policies.length) return { intent: 'unknown', reply: "I don't have company policies to search yet. You can raise a helpdesk ticket and HR will help you.", links: [{ label: 'Raise a ticket', href: '/ess/dashboard' }] };

    const q = tokens(message);
    const scored = policies
      .map((p) => {
        const words = tokens(p.title + ' ' + p.content);
        const set = new Set(words);
        const score = q.reduce((s, t) => s + (set.has(t) ? 1 : 0) + (p.title.toLowerCase().includes(t) ? 2 : 0), 0);
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);

    const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (apiKey && (await this.entitlements.has(user.companyId, 'aiAssistant')) && (await this.consent.isAllowed(user.userId, 'AI_ASSISTANT_LLM'))) {
      const context = (scored.length ? scored : policies.map((p) => ({ p, score: 0 }))).slice(0, 4).map((x) => `## ${x.p.title}\n${x.p.content.slice(0, 3000)}`).join('\n\n');
      const llm = await this.askLlm(apiKey, message, context);
      if (llm) return { intent: 'policy_llm', reply: llm };
    }
    if (!scored.length) return { intent: 'unknown', reply: "I couldn't find that in the company policies. Try rephrasing, or raise a helpdesk ticket for HR.", links: [{ label: 'Raise a ticket', href: '/ess/dashboard' }] };
    const best = scored[0].p;
    const sentences = best.content.split(/(?<=[.!?\n])\s+/);
    const relevant = sentences.filter((s) => q.some((t) => s.toLowerCase().includes(t))).slice(0, 3);
    return { intent: 'policy', reply: `From the "${best.title}" policy:\n${(relevant.length ? relevant : sentences.slice(0, 3)).join(' ')}`, links: [{ label: 'View all policies', href: '/ess/dashboard' }] };
  }

  private async askLlm(apiKey: string, question: string, context: string): Promise<string | null> {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: this.config.get('AI_MODEL') || 'claude-haiku-4-5-20251001', max_tokens: 400,
          system: 'You are the HR assistant of an Indian company. Answer ONLY from the company policy text supplied. If the answer is not in it, say you do not know and suggest contacting HR. Be concise. Never invent numbers or rules.',
          messages: [{ role: 'user', content: `Company policies:\n${context}\n\nEmployee question: ${question}` }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) { this.logger.warn(`LLM call failed: ${res.status}`); return null; }
      const data = (await res.json()) as { content?: { type?: string; text?: string }[] };
      return data?.content?.[0]?.text?.trim() || null;
    } catch (e) {
      this.logger.warn(`LLM call error: ${errorMessage(e)}`);
      return null;
    }
  }

  // ===========================================================================
  // Attendance anomaly detection (rule-based, explainable)
  // ===========================================================================
  async attendanceAnomalies(user: AuthUser, days = 30) {
    const since = addDays(todayIST(), -days);
    const scope = await this.access.scopeEmployeeIds(user);
    const punches = await this.prisma.employeeCheckin.findMany({
      where: { companyId: user.companyId, time: { gte: since }, ...(scope ? { employeeId: { in: scope } } : {}) },
      include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } }, orderBy: { time: 'asc' },
    });
    const name = (p: (typeof punches)[number]) => `${p.employee.firstName} ${p.employee.lastName}`.trim();
    const findings: { type: string; severity: 'high' | 'medium' | 'low'; employee: string; employeeCode: string; detail: string }[] = [];

    // 1. Same IP/device used by different employees within 3 minutes (possible buddy punching)
    const byNet = new Map<string, typeof punches>();
    for (const p of punches) {
      const key = p.deviceId || p.ipAddress;
      if (!key || p.source === 'BIOMETRIC') continue;
      byNet.set(key, [...(byNet.get(key) || []), p]);
    }
    const flaggedPairs = new Set<string>();
    for (const [key, list] of byNet) {
      for (let i = 1; i < list.length; i++) {
        const a = list[i - 1], b = list[i];
        if (a.employeeId !== b.employeeId && b.time.getTime() - a.time.getTime() < 180000 && !flaggedPairs.has(`${a.employeeId}|${b.employeeId}`)) {
          flaggedPairs.add(`${a.employeeId}|${b.employeeId}`);
          findings.push({ type: 'SHARED_DEVICE', severity: 'medium', employee: name(b), employeeCode: b.employee.employeeCode, detail: `Punched from the same ${key.includes('.') ? 'IP' : 'device'} (${key}) within 3 min of ${name(a)}` });
        }
      }
    }
    // 2. Identical-to-the-minute punch-in times on many days (scripted/automated punching)
    const perEmp = new Map<string, typeof punches>();
    punches.filter((p) => p.logType === 'IN').forEach((p) => perEmp.set(p.employeeId, [...(perEmp.get(p.employeeId) || []), p]));
    for (const list of perEmp.values()) {
      if (list.length < 8) continue;
      const mins = new Map<number, number>();
      list.forEach((p) => mins.set(istMinutesOfDay(p.time), (mins.get(istMinutesOfDay(p.time)) || 0) + 1));
      const [minute, count] = [...mins.entries()].sort((a, b) => b[1] - a[1])[0];
      if (count >= 6 && count / list.length > 0.6) findings.push({ type: 'IDENTICAL_PUNCH_TIME', severity: 'medium', employee: name(list[0]), employeeCode: list[0].employee.employeeCode, detail: `${count} of ${list.length} check-ins at exactly ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}` });
    }
    // 3. Odd-hour punches (00:00–04:59 IST)
    for (const p of punches) {
      const m = istMinutesOfDay(p.time);
      if (m < 300) findings.push({ type: 'ODD_HOURS', severity: 'low', employee: name(p), employeeCode: p.employee.employeeCode, detail: `${p.logType} at ${isoDate(istDateOf(p.time))} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} IST` });
    }
    // 4. Chronic lateness / very short days
    const att = await this.prisma.attendance.findMany({ where: { companyId: user.companyId, attendanceDate: { gte: since }, ...(scope ? { employeeId: { in: scope } } : {}) }, include: { employee: { select: { employeeCode: true, firstName: true, lastName: true } } } });
    const lateBy = new Map<string, { n: number; total: number; e: (typeof att)[number]['employee'] }>();
    att.forEach((a) => { const c = lateBy.get(a.employeeId) || { n: 0, total: 0, e: a.employee }; c.total++; if (a.lateEntry) c.n++; lateBy.set(a.employeeId, c); });
    for (const c of lateBy.values()) {
      if (c.total >= 8 && c.n / c.total >= 0.4) findings.push({ type: 'CHRONIC_LATE', severity: 'medium', employee: `${c.e.firstName} ${c.e.lastName}`.trim(), employeeCode: c.e.employeeCode, detail: `Late on ${c.n} of ${c.total} days (${Math.round((c.n / c.total) * 100)}%)` });
    }
    const order = { high: 0, medium: 1, low: 2 };
    findings.sort((a, b) => order[a.severity] - order[b.severity]);
    return { windowDays: days, method: 'Rule-based checks (shared device, identical punch minute, odd hours, chronic lateness). Findings are prompts for review, not conclusions.', count: findings.length, findings: findings.slice(0, 200) };
  }

  // ===========================================================================
  // Attrition risk — transparent heuristic score (not a trained model)
  // ===========================================================================
  async attritionRisk(user: AuthUser) {
    const since = addDays(todayIST(), -90);
    const emps = await this.prisma.employee.findMany({ where: { companyId: user.companyId, status: 'ACTIVE' }, include: { department: { select: { name: true } }, designation: { select: { name: true } } } });
    const [att, appraisals, assignments, leaves] = await Promise.all([
      this.prisma.attendance.findMany({ where: { companyId: user.companyId, attendanceDate: { gte: since } }, select: { employeeId: true, status: true, lateEntry: true } }),
      this.prisma.appraisal.findMany({ where: { companyId: user.companyId, status: 'COMPLETED' }, orderBy: { completedAt: 'desc' } }),
      this.prisma.salaryStructureAssignment.findMany({ where: { companyId: user.companyId }, orderBy: { fromDate: 'desc' } }),
      this.prisma.leaveApplication.findMany({ where: { companyId: user.companyId, status: 'APPROVED', fromDate: { gte: since } } }),
    ]);
    const now = todayIST();
    const rows = emps.map((e) => {
      const factors: { factor: string; points: number }[] = [];
      const tenure = (now.getTime() - e.dateOfJoining.getTime()) / (365.25 * 86400000);
      if (tenure >= 1 && tenure < 3) factors.push({ factor: `Tenure ${tenure.toFixed(1)} yrs (peak-mobility window)`, points: 15 });
      const lastRevision = assignments.find((a) => a.employeeId === e.id);
      const monthsSinceRevision = lastRevision ? (now.getTime() - lastRevision.fromDate.getTime()) / (30.4 * 86400000) : null;
      if (monthsSinceRevision !== null && monthsSinceRevision > 18) factors.push({ factor: `No salary revision for ${Math.round(monthsSinceRevision)} months`, points: 25 });
      const rating = appraisals.find((a) => a.employeeId === e.id)?.finalRating;
      if (rating !== undefined && rating !== null && num(rating) >= 4) factors.push({ factor: `High performer (${num(rating)}/5)${monthsSinceRevision && monthsSinceRevision > 12 ? ' with stale pay' : ''}`, points: monthsSinceRevision && monthsSinceRevision > 12 ? 20 : 5 });
      if (rating !== undefined && rating !== null && num(rating) <= 2) factors.push({ factor: `Low rating (${num(rating)}/5)`, points: 10 });
      const a = att.filter((x) => x.employeeId === e.id);
      const absent = a.filter((x) => x.status === 'ABSENT').length;
      const late = a.filter((x) => x.lateEntry).length;
      if (a.length >= 10 && absent / a.length > 0.1) factors.push({ factor: `${absent} absences in 90 days`, points: 20 });
      if (a.length >= 10 && late / a.length > 0.3) factors.push({ factor: `Late on ${Math.round((late / a.length) * 100)}% of days`, points: 10 });
      const leaveDays = leaves.filter((l) => l.employeeId === e.id).reduce((s, l) => s + num(l.totalLeaveDays), 0);
      if (leaveDays > 15) factors.push({ factor: `${round2(leaveDays)} leave days in 90 days`, points: 10 });
      const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
      return { employeeId: e.id, employeeCode: e.employeeCode, name: `${e.firstName} ${e.lastName}`.trim(), department: e.department?.name ?? null, designation: e.designation?.name ?? null, score, risk: score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW', factors };
    });
    rows.sort((a, b) => b.score - a.score);
    return { method: 'Transparent heuristic score from tenure, pay-revision gap, performance rating, absenteeism and leave patterns. Not a trained ML model: use it to start conversations, not to make decisions.', summary: { high: rows.filter((r) => r.risk === 'HIGH').length, medium: rows.filter((r) => r.risk === 'MEDIUM').length, low: rows.filter((r) => r.risk === 'LOW').length }, employees: rows.slice(0, 100) };
  }
}
