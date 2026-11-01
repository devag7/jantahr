import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C, easeInOut, tween } from '../theme';
import { Chip, Headline, Laptop, Rings, ScaledCard, Sub, useFormat } from '../ui';
import { beat, sceneFrames } from '../script';

export const PLAT = { platform: 0, reports: beat('platform', 'reports'), end: sceneFrames('platform') };

/** The rest of the platform, as real web screens dealt onto a stack, each named as the voiceover names it. */
const SCREENS: { src: string; label: string; icon: Parameters<typeof Chip>[0]['icon']; at: number }[] = [
  { src: 'web/hr-recruitment.webp', label: 'Hiring pipeline, one-click hire', icon: 'users', at: 40 },
  { src: 'web/hr-performance.webp', label: 'Appraisal cycles', icon: 'check', at: 96 },
  { src: 'web/lifecycle-exits.webp', label: 'Exits and full & final', icon: 'file', at: 140 },
  { src: 'web/insights-attrition.webp', label: 'Attrition risk, explained', icon: 'globe', at: 196 },
  { src: 'web/reports-custom.webp', label: '18 MIS reports and a custom builder', icon: 'file', at: PLAT.reports + 6 },
];

export const Platform: React.FC = () => {
  const frame = useCurrentFrame();
  const { landscape, u } = useFormat();
  const k = landscape ? u : 1;
  const lw = landscape ? 1180 * u : 940;
  const baseX = landscape ? 640 * u : 70;
  const baseY = landscape ? 340 * u : 720;
  
  // which card is on top: the last one dealt
  const topIndex = SCREENS.reduce((acc, s, i) => (frame >= s.at ? i : acc), -1);

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', inset: 0, background: C.bg }} />
      <Rings cx={baseX + lw / 2} cy={baseY + lw * 0.32} base={lw * 0.4} gap={lw * 0.14} count={5} color={C.cobalt} opacity={0.08} drift={0.25} />

      {/* the careers page: public, branded per company, the start of hiring */}
      <ScaledCard src="cards/careers.webp" nw={780} nh={395} w={landscape ? 560 * u : 700} x={landscape ? 110 * u : 190} y={landscape ? 560 * u : 1500} radius={18}
        style={{ opacity: tween(frame, 8, 22) * (1 - tween(frame, 120, 136, 0, 1, easeInOut)), translate: `0px ${tween(frame, 8, 30, 50, 0)}px`, rotate: '-2deg' }} />
      <Chip icon="globe" text="Your own careers page" at={20} out={120} size={landscape ? 28 * u : 32} style={landscape ? { left: 140 * u, top: 480 * u } : { left: 190, top: 1420 }} />

      {SCREENS.map((s, i) => {
        if (frame < s.at - 2) return null;
        const inP = tween(frame, s.at, s.at + 22);
        const depth = Math.max(0, topIndex - i);
        const push = tween(frame, s.at + 40, s.at + 140, 1, 1.03, easeInOut);
        return (
          <div key={s.src} style={{ position: 'absolute', left: 0, top: 0, opacity: inP * (depth > 2 ? 0 : 1 - 0.18 * depth), translate: `${(1 - inP) * 260 * k - depth * 70 * k}px ${-depth * 28 * k + (1 - inP) * 30 * k}px`, scale: String((0.97 + 0.03 * inP) * (1 - 0.06 * depth) * push), transformOrigin: `${baseX + lw / 2}px ${baseY}px` }}>
            <Laptop x={baseX} y={baseY} w={lw}>
              <Img src={staticFile(s.src)} style={{ width: 2880 }} />
            </Laptop>
          </div>
        );
      })}

      {SCREENS.map((s, i) => (
        <Chip key={s.label} icon={s.icon} text={s.label} at={s.at + 10} out={(SCREENS[i + 1]?.at ?? PLAT.end + 40) - 6} size={landscape ? 30 * u : 34}
          style={landscape ? { left: baseX + lw - 40 * u, top: baseY + lw * 0.62 * 0.9, translate: '-100% 0' } : { left: 80, top: baseY + lw * 0.66 + 40 }} />
      ))}

      <div style={{ position: 'absolute', left: landscape ? 110 * u : 80, top: landscape ? 90 * u : 190, width: landscape ? 1600 * u : 920 }}>
        {frame < PLAT.reports + 10 && (
          <>
            <Headline text="Beyond payroll." at={8} size={(landscape ? 76 : 82) * k} out={PLAT.reports - 18} />
            <Sub text="Hiring, appraisals, exits and insights, in the same app." at={22} size={(landscape ? 34 : 40) * k} out={PLAT.reports - 18} style={{ marginTop: 12 * k }} />
          </>
        )}
        {frame >= PLAT.reports - 4 && (
          <>
            <Headline text="Every number, a click away." at={PLAT.reports} size={(landscape ? 76 : 82) * k} out={PLAT.end + 40} />
            <Sub text="18 MIS reports and a custom report builder, export to CSV." at={PLAT.reports + 14} size={(landscape ? 34 : 40) * k} out={PLAT.end + 40} style={{ marginTop: 12 * k }} />
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
