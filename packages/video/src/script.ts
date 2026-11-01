/**
 * The voiceover, one line per beat, with the second it starts in the full cut.
 * Captions (SRT and burned-in) are generated from this, and every scene times its beats from these `at` values
 * (see `beat()` below), so script, audio, pictures and subtitles cannot drift apart.
 * Every claim is checked against the code: see packages/video/README.md, "Claims and sources".
 */
export type Line = { id: string; at: number; text: string };

export const VO: Line[] = [
  { id: 'hook', at: 0.6, text: 'Every month, growing Indian companies run payroll in spreadsheets, approve leave over chat, and chase PF, ESI and TDS deadlines from memory.' },
  { id: 'logo', at: 11.0, text: 'JantaHR brings it all into one place. People, payroll, leave and attendance, hiring, performance and exits. Open source, and built for India.' },
  { id: 'checkin', at: 22.6, text: 'Employees check in with one tap. Geo-fenced, with an optional selfie.' },
  { id: 'calendar', at: 27.6, text: 'Their whole month, at a glance.' },
  { id: 'leave', at: 30.4, text: 'Before they apply for leave, JantaHR shows exactly how many days will be left.' },
  { id: 'payslip', at: 36.6, text: 'On payday, the payslip is on their phone, with take-home and every deduction laid out.' },
  { id: 'notify', at: 42.5, text: 'And they hear back the moment a request is answered.' },
  { id: 'approvals', at: 47.6, text: 'Managers approve leave, attendance fixes and expenses in a single tap.' },
  { id: 'team', at: 53.0, text: 'And see who is in today, without a phone call.' },
  { id: 'payroll', at: 58.6, text: 'On the web, HR runs payroll with PF, ESI, professional tax, LWF and TDS worked out, under the new Income-tax Act and the labour codes.' },
  { id: 'statutory', at: 69.8, text: 'The PF ECR, ESI and PT files, bank advice and the quarterly TDS extract come ready with payroll, and every due date sits on one calendar.' },
  { id: 'privacy', at: 80.0, text: 'DPDP privacy tools come built in, on every plan.' },
  { id: 'platform', at: 85.6, text: 'Beyond payroll, hire from your own careers page, run appraisals, settle full and final, and spot attrition risk early.' },
  { id: 'reports', at: 94.8, text: 'Eighteen MIS reports and a custom report builder put every number a click away.' },
  { id: 'proof', at: 102.6, text: 'Over two hundred automated tests check the maths on every change.' },
  { id: 'opensource', at: 107.9, text: 'And it is open source. Use our cloud, hosted in India, or run every feature on your own server, free, with one command.' },
  { id: 'cta', at: 119.8, text: 'One app. One payroll. One calendar. JantaHR. Start your fourteen-day free trial at jantahr dot devshipit dot com.' },
];

/** Scene boundaries in seconds (30 fps). */
export const SCENES = {
  hook: [0, 10],
  logo: [10, 22],
  employee: [22, 47],
  manager: [47, 58],
  web: [58, 85],
  platform: [85, 102],
  proof: [102, 119],
  cta: [119, 131],
} as const;
export type SceneKey = keyof typeof SCENES;
export const TOTAL_SECONDS = SCENES.cta[1];

const lineAt = (id: string) => {
  const l = VO.find((x) => x.id === id);
  if (!l) throw new Error(`no line ${id}`);
  return l.at;
};
/** The frame, inside `scene`, where the line `id` starts, minus a short lead so the picture arrives just before the words. */
export const beat = (scene: SceneKey, id: string, lead = 0.4, fps = 30) => Math.max(0, Math.round((lineAt(id) - SCENES[scene][0] - lead) * fps));
/** A scene's length in frames. */
export const sceneFrames = (scene: SceneKey, fps = 30) => Math.round((SCENES[scene][1] - SCENES[scene][0]) * fps);

/** Options that change what the video claims. Both default to what is true today (2 Nov 2026). */
export type Claims = {
  /** The Play listing is public (play.google.com/store/apps/details?id=com.devshipit.jantahr returns 200). */
  playLive: boolean;
  /** BILLING_SELLER_GSTIN is set in production, so invoices carry GST (the live API reports gstRate 0 today). */
  gstInvoices: boolean;
  /** Burn the captions into the picture (on for the vertical cut, where most people watch muted). */
  captions: boolean;
};
export const defaultClaims: Claims = { playLive: false, gstInvoices: false, captions: false };
