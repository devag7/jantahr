import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT, easeInOut, tween } from '../theme';
import { AppIcon, Headline, Rings, Sub, rise, useFormat } from '../ui';
import { beat, sceneFrames, type Claims } from '../script';

const ONES = ['One app.', 'One payroll.', 'One calendar.'];

/** "One app. One payroll. One calendar." then the offer; the picture settles on deep cobalt at the very end. */
export const Cta: React.FC<{ claims: Claims }> = ({ claims }) => {
  const frame = useCurrentFrame();
  const { W, H, landscape, u } = useFormat();
  const k = landscape ? u : 1;
  const start = beat('cta', 'cta', 0.15);
  const end = sceneFrames('cta');
  const lineAt = (i: number) => start + i * 30;
  const onesOut = 1 - tween(frame, start + 100, start + 118, 0, 1, easeInOut);
  const offerAt = start + 108;
  const iconSize = (landscape ? 170 : 200) * k;
  const top = H * (landscape ? 0.16 : 0.24);
  const settle = tween(frame, end - 18, end, 0, 1, easeInOut);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 100% at 50% 30%, ${C.cobalt} 0%, ${C.deep} 80%)` }}>
      <Rings cx={W / 2} cy={top + iconSize / 2} base={170 * k} gap={130 * k} count={8} opacity={0.15} />

      {/* kinetic: each line lands, the earlier ones step back */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: H / 2 - 1.6 * 110 * k, opacity: onesOut, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 * k }}>
        {ONES.map((t, i) => {
          const later = ONES.filter((_, j) => j > i && frame >= lineAt(j)).length;
          return (
            <div key={t} style={{ opacity: frame >= lineAt(i) - 1 ? 1 - 0.32 * later : 0 }}>
              <Headline text={t} at={lineAt(i)} size={(landscape ? 120 : 112) * k} color={later ? C.ice : '#fff'} align="center" stagger={4} />
            </div>
          );
        })}
      </div>

      {frame >= offerAt - 2 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top, display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: FONT }}>
          <div style={rise(frame, offerAt, 20, 30)}><AppIcon size={iconSize} /></div>
          <div style={{ height: 50 * k }} />
          <Headline text="Start your 14-day free trial" at={offerAt + 14} size={(landscape ? 96 : 84) * k} color="#fff" align="center" style={{ padding: '0 60px' }} />
          <div style={{ height: 40 * k }} />
          <div style={{ ...rise(frame, offerAt + 34, 20, 24), padding: `${22 * k}px ${48 * k}px`, borderRadius: 999, background: '#fff', color: C.cobalt, fontWeight: 600, fontSize: 52 * k, letterSpacing: -0.5 }}>jantahr.devshipit.com</div>
          <div style={{ height: 34 * k }} />
          <Sub text={claims.playLive ? 'Free for up to 20 employees. Or self-host free. Get the app on Google Play.' : 'Free for up to 20 employees. Or self-host it free.'} at={offerAt + 52} size={34 * k} color="rgba(255,255,255,0.82)" />
        </div>
      )}
      <AbsoluteFill style={{ background: C.deep, opacity: settle * 0.85 }} />
    </AbsoluteFill>
  );
};
