/** Pure DPDP rules: consent ledger resolution, erasure/retention planning, request SLA. No I/O — unit tested. */

/** Bump when the privacy notice text materially changes; employees are asked to re-acknowledge. */
export const NOTICE_VERSION = 1;

export const CONSENT_PURPOSES = {
  PRIVACY_NOTICE: {
    label: 'Privacy notice',
    description: 'You have read how your employer processes your personal data for employment, payroll and statutory compliance.',
    required: true,
  },
  SELFIE_AT_CHECKIN: {
    label: 'Selfie at check-in',
    description: 'Capture a photo when you mark attendance from the web or mobile app. If you withdraw, check-ins are saved without a photo.',
    required: false,
  },
  LOCATION_AT_CHECKIN: {
    label: 'Location at check-in',
    description: 'Record your GPS coordinates when you mark attendance. If your company uses geo-fenced offices, location is required to check in.',
    required: false,
  },
  AI_ASSISTANT_LLM: {
    label: 'AI assistant (third-party model)',
    description: 'Send your policy questions to an external AI model to draft answers. If you withdraw, the assistant answers using keyword search only.',
    required: false,
  },
} as const;

export type ConsentPurpose = keyof typeof CONSENT_PURPOSES;
export const isConsentPurpose = (p: string): p is ConsentPurpose => Object.prototype.hasOwnProperty.call(CONSENT_PURPOSES, p);

export type ConsentState = 'GRANTED' | 'WITHDRAWN' | 'NOT_ASKED' | 'OUTDATED';
export interface ConsentRow { purpose: string; granted: boolean; noticeVersion: number; createdAt: Date }
export interface ConsentStatus { state: ConsentState; noticeVersion: number | null; at: Date | null }

/** Latest ledger row per purpose wins; a grant recorded against an older notice version reads as OUTDATED. */
export function resolveConsents(rows: ConsentRow[], noticeVersion = NOTICE_VERSION): Record<ConsentPurpose, ConsentStatus> {
  const latest = new Map<string, ConsentRow>();
  for (const r of rows) {
    const cur = latest.get(r.purpose);
    if (!cur || r.createdAt.getTime() >= cur.createdAt.getTime()) latest.set(r.purpose, r);
  }
  const out = {} as Record<ConsentPurpose, ConsentStatus>;
  for (const purpose of Object.keys(CONSENT_PURPOSES) as ConsentPurpose[]) {
    const r = latest.get(purpose);
    if (!r) out[purpose] = { state: 'NOT_ASKED', noticeVersion: null, at: null };
    else if (!r.granted) out[purpose] = { state: 'WITHDRAWN', noticeVersion: r.noticeVersion, at: r.createdAt };
    else out[purpose] = { state: r.noticeVersion < noticeVersion ? 'OUTDATED' : 'GRANTED', noticeVersion: r.noticeVersion, at: r.createdAt };
  }
  return out;
}

export interface ErasurePlan {
  allowed: boolean;
  level?: 'PARTIAL' | 'FULL';
  reason: string;
  /** Statutory identifiers must be kept until this date (last working day + retention period). */
  retainUntil?: Date;
}

export const DEFAULT_RETENTION_YEARS = 8;

/**
 * Decides how far an erasure request can go (DPDP s.8(7) lets a fiduciary keep data the law requires it to keep).
 *  - active / suspended / inactive staff: refused — employment data is a "legitimate use" (s.7) while employed
 *  - left, inside the retention window: PARTIAL — remove everything not needed for payroll/tax/PF records
 *  - left, past the retention window: FULL — anonymise, keeping only non-identifying payroll figures
 */
export function planErasure(o: { status: string; lastWorkingDate: Date | null; now: Date; retentionYears: number }): ErasurePlan {
  if (o.status !== 'LEFT') return { allowed: false, reason: 'Only employees who have left can be erased. Data of current staff is processed for employment under DPDP s.7.' };
  if (!o.lastWorkingDate) return { allowed: true, level: 'PARTIAL', reason: 'Last working date is not recorded, so statutory records are kept until it is set.' };
  const retainUntil = new Date(o.lastWorkingDate);
  retainUntil.setUTCFullYear(retainUntil.getUTCFullYear() + o.retentionYears);
  if (o.now.getTime() < retainUntil.getTime()) {
    return { allowed: true, level: 'PARTIAL', retainUntil, reason: `Payroll, PF and tax records must be kept until ${retainUntil.toISOString().slice(0, 10)}; other personal data can be erased now.` };
  }
  return { allowed: true, level: 'FULL', retainUntil, reason: 'The statutory retention period has ended; the record can be fully anonymised.' };
}

/** DPDP Rules 2025 r.14: requests to exercise rights and grievances must be answered within 90 days. */
export const REQUEST_SLA_DAYS = 90;
/** DPDP Rules 2025 r.7(2): detailed breach report to the Data Protection Board within 72 hours of becoming aware. */
export const BREACH_BOARD_REPORT_HOURS = 72;

export function breachBoardDeadline(detectedAt: Date): Date {
  return new Date(detectedAt.getTime() + BREACH_BOARD_REPORT_HOURS * 3_600_000);
}

export function requestDueDate(from: Date, days = REQUEST_SLA_DAYS): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

/** Document types that carry statutory identity/bank proof and are kept during a PARTIAL erasure. */
export const KYC_DOCUMENT_TYPE = /^(pan|bank|passbook|cheque|uan|pf|esi)/i;
