/**
 * The voiceover, one line per beat, with the second it should start in the 120-second cut.
 * Captions (SRT and burned-in) are generated from this, so script, audio and subtitles never drift apart.
 * Every claim here is checked against the code: see packages/video/README.md, "Claims and sources".
 */
export type Line = { id: string; at: number; text: string };

export const VO: Line[] = [
  { id: 'hook', at: 0.6, text: 'Every month, growing Indian companies run payroll in spreadsheets, approve leave over chat, and chase PF, ESI and TDS deadlines from memory.' },
  { id: 'logo', at: 11.2, text: 'JantaHR brings it all into one place. HR and payroll, built for India.' },
  { id: 'checkin', at: 20.6, text: 'Employees check in with one tap. Geo-fenced, with an optional selfie.' },
  { id: 'calendar', at: 27.4, text: 'Their whole month is there at a glance.' },
  { id: 'leave', at: 33.2, text: 'Leave balances are always clear, and before they apply, JantaHR shows exactly how many days will be left.' },
  { id: 'payslip', at: 41.4, text: 'On payday, the payslip is on their phone, with take-home and every deduction laid out.' },
  { id: 'notify', at: 47.2, text: 'And they hear back the moment a request is answered.' },
  { id: 'approvals', at: 50.8, text: 'Managers approve leave, attendance fixes and expenses on the go, in a single tap.' },
  { id: 'team', at: 62.4, text: 'And they can see who is in today, without a single phone call.' },
  { id: 'payroll', at: 75.6, text: 'On the web, HR runs payroll with PF, ESI, professional tax, LWF and TDS worked out, then approves and pays.' },
  { id: 'statutory', at: 84.5, text: 'The PF ECR, ESI and PT files, bank advice and the quarterly TDS extract come ready with payroll, and every due date sits on one calendar.' },
  { id: 'privacy', at: 94.3, text: 'DPDP privacy tools are built in, on every plan.' },
  { id: 'trust', at: 100.4, text: 'There is an Android app for the whole team, Google sign-in, Razorpay billing, data hosted in India, and PAN, Aadhaar and bank details encrypted field by field.' },
  { id: 'cta', at: 111.9, text: 'JantaHR. Your workday in one place. Start your fourteen-day free trial at jantahr dot devshipit dot com.' },
];

/** Scene boundaries in seconds for the 120 s cut (30 fps). */
export const SCENES = {
  hook: [0, 10],
  logo: [10, 20],
  employee: [20, 50],
  manager: [50, 75],
  web: [75, 100],
  trust: [100, 112],
  cta: [112, 120],
} as const;

/** Options that change what the video claims. Both default to what is true today (1 Nov 2026). */
export type Claims = {
  /** The Play listing is public (play.google.com/store/apps/details?id=com.devshipit.jantahr returns 200). */
  playLive: boolean;
  /** BILLING_SELLER_GSTIN is set in production, so invoices carry GST (the live API reports gstRate 0 today). */
  gstInvoices: boolean;
  /** Burn the captions into the picture (on for the vertical cut, where most people watch muted). */
  captions: boolean;
};
export const defaultClaims: Claims = { playLive: false, gstInvoices: false, captions: false };
