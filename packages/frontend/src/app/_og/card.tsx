import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Share cards (Open Graph, 1200 x 630) in the site's own grammar: Parchment canvas, near-black ink, one blue accent,
 * Inter at 400 and 600 (SIL Open Font Licence, files beside this one). Rendered once at build time by next/og.
 * The folder name starts with an underscore, so Next does not treat it as a route.
 */
export const OG_SIZE = { width: 1200, height: 630 };

export async function ogFonts() {
  const dir = path.join(process.cwd(), 'src/app/_og');
  const [regular, semibold] = await Promise.all([readFile(path.join(dir, 'inter-400.woff')), readFile(path.join(dir, 'inter-600.woff'))]);
  return [
    { name: 'Inter', data: regular, weight: 400 as const, style: 'normal' as const },
    { name: 'Inter', data: semibold, weight: 600 as const, style: 'normal' as const },
  ];
}

export function OgCard({ title, lead, children }: { title: string[]; lead: string; children?: React.ReactNode }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#f5f5f7', color: '#1d1d1f', padding: '72px 80px', fontFamily: 'Inter' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="48" height="48" viewBox="0 0 1024 1024">
          <rect width="1024" height="1024" rx="224" fill="#2350E8" />
          <path d="M478 252 V598 A124 124 0 0 1 230 598 V586" transform="translate(512 518) scale(0.72) translate(-534 -518)" fill="none" stroke="#FFFFFF" strokeWidth="124" />
          <path d="M586 252 V452 M720 252 V452 M586 352 H720 M770 452 V275 H836 A52 52 0 0 1 836 379 H770 M818 379 L880 452" transform="translate(512 518) scale(0.72) translate(-534 -518)" fill="none" stroke="#A9E7FF" strokeWidth="46" />
        </svg>
        <div style={{ fontSize: 30, fontWeight: 600 }}>JantaHR</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* one line per string, so a headline never leaves a single word on its own line */}
        <div style={{ display: 'flex', flexDirection: 'column', fontSize: 68, fontWeight: 600, lineHeight: 1.07, letterSpacing: -1 }}>{title.map((t) => <div key={t}>{t}</div>)}</div>
        <div style={{ marginTop: 24, fontSize: 30, lineHeight: 1.35, color: '#333333', maxWidth: 960 }}>{lead}</div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>{children}</div>
    </div>
  );
}

export function OgChip({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', borderRadius: 9999, padding: '12px 24px', fontSize: 24, border: strong ? 'none' : '1px solid #e0e0e0', background: strong ? '#0066cc' : '#ffffff', color: strong ? '#ffffff' : '#1d1d1f' }}>{children}</div>;
}
