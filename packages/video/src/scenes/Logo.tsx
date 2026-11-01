import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT, easeInOut, tween } from '../theme';
import { Headline, Mark, Rings, Sub, useFormat } from '../ui';

/** 10–20 s. Cobalt fills from the centre, the J-HR mark draws itself, then the name and the line. */
export const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H, landscape, u } = useFormat();
  const grow = tween(frame, 0, 30);
  const maxR = Math.hypot(W, H) / 2;
  const draw = tween(frame, 16, 76, 0, 1, easeInOut);
  const lift = tween(frame, 70, 100, 0, 1, easeInOut);
  const out = 1 - tween(frame, 282, 300, 0, 1, easeInOut);
  const markW = (landscape ? 400 : 440) * u * (1 - 0.42 * lift);
  const markY = H * (landscape ? 0.42 : 0.4) - lift * H * (landscape ? 0.14 : 0.1);

  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <div style={{ position: 'absolute', left: W / 2 - maxR, top: H / 2 - maxR, width: 2 * maxR, height: 2 * maxR, borderRadius: 9999, background: `radial-gradient(circle, ${C.cobalt} 0%, ${C.cobalt} 55%, ${C.deep} 100%)`, scale: String(grow) }} />
      <div style={{ opacity: tween(frame, 10, 40) * out }}>
        <Rings cx={W / 2} cy={markY} base={260 * u} gap={150 * u} count={6} opacity={0.16} />
      </div>
      <div style={{ position: 'absolute', left: W / 2 - markW / 2, top: markY - (markW * 580) / 760 / 2, opacity: out }}>
        <Mark size={markW} progress={draw} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: H * (landscape ? 0.5 : 0.47), display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: out }}>
        <Headline text="JantaHR" at={92} size={(landscape ? 150 : 150) * u} color="#FFFFFF" align="center" stagger={0} />
        <div style={{ height: 26 * u }} />
        <Headline text="Your workday in one place." at={118} size={(landscape ? 58 : 60) * u} weight={400} color={C.ice} align="center" stagger={3} />
        <div style={{ height: 22 * u }} />
        <Sub text="HR and payroll for Indian companies" at={150} size={(landscape ? 32 : 38) * u} color="rgba(255,255,255,0.72)" style={{ fontFamily: FONT }} />
      </div>
    </AbsoluteFill>
  );
};
