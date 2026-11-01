import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT, easeInOut, tween } from '../theme';
import { Headline, Icon, Mark, Rings, Sub, useFormat } from '../ui';

type IconName = Parameters<typeof Icon>[0]['name'];

/** The modules, in the order the voiceover names them, then the rest of the platform. All are shipped (README, plans.ts). */
const MODULES: { label: string; icon: IconName; at: number }[] = [
  { label: 'People', icon: 'users', at: 150 },
  { label: 'Payroll', icon: 'rupee', at: 162 },
  { label: 'Leave & attendance', icon: 'calendar', at: 178 },
  { label: 'Hiring', icon: 'users', at: 200 },
  { label: 'Performance', icon: 'check', at: 214 },
  { label: 'Exits & F&F', icon: 'file', at: 232 },
  { label: 'Statutory filing', icon: 'shield', at: 246 },
  { label: 'Insights', icon: 'globe', at: 256 },
  { label: 'Expenses', icon: 'card', at: 266 },
  { label: 'DPDP privacy', icon: 'lock', at: 276 },
];

/** Cobalt fills from the centre, the J-HR mark draws itself, the name lands, then the platform orbits the mark. */
export const Logo: React.FC = () => {
  const frame = useCurrentFrame();
  const { W, H, landscape, u } = useFormat();
  const k = landscape ? u : 1;
  const grow = tween(frame, 0, 30);
  const maxR = Math.hypot(W, H) / 2;
  const draw = tween(frame, 16, 76, 0, 1, easeInOut);
  // act 1: the mark rises to make room for the name; act 2 (from 140): the name leaves and the mark sits at the centre of the orbit
  const lift = tween(frame, 70, 100, 0, 1, easeInOut) * (1 - tween(frame, 136, 170, 0, 1, easeInOut));
  const shrink = tween(frame, 136, 170, 0, 1, easeInOut);
  const nameOut = 1 - tween(frame, 128, 146, 0, 1, easeInOut);
  const out = 1 - tween(frame, 338, 360, 0, 1, easeInOut);
  const markW = (landscape ? 400 : 440) * k * (1 - 0.42 * lift) * (1 - 0.5 * shrink);
  const cy = H * (landscape ? 0.46 : 0.42);
  const markY = cy - lift * H * (landscape ? 0.16 : 0.1);

  const rx = landscape ? 640 * u : 330;
  const ry = landscape ? 330 * u : 660;
  const spin = frame * 0.06;

  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <div style={{ position: 'absolute', left: W / 2 - maxR, top: H / 2 - maxR, width: 2 * maxR, height: 2 * maxR, borderRadius: 9999, background: `radial-gradient(circle, ${C.cobalt} 0%, ${C.cobalt} 55%, ${C.deep} 100%)`, scale: String(grow) }} />
      <div style={{ opacity: tween(frame, 10, 40) }}>
        <Rings cx={W / 2} cy={markY} base={260 * k} gap={150 * k} count={6} opacity={0.16} />
      </div>
      {/* the orbit path */}
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: 0.28 * tween(frame, 140, 175) * out }}>
        <ellipse cx={W / 2} cy={cy} rx={rx} ry={ry} fill="none" stroke={C.ice} strokeWidth={2} strokeDasharray="4 10" />
      </svg>
      <div style={{ position: 'absolute', left: W / 2 - markW / 2, top: markY - (markW * 580) / 760 / 2, opacity: out }}>
        <Mark size={markW} progress={draw} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: H * (landscape ? 0.5 : 0.47), display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: nameOut }}>
        <Headline text="JantaHR" at={84} size={150 * k} color="#FFFFFF" align="center" stagger={0} />
        <div style={{ height: 26 * k }} />
        <Headline text="Your workday in one place." at={100} size={58 * k} weight={400} color={C.ice} align="center" stagger={3} />
      </div>
      {MODULES.map((m, i) => {
        // landscape: evenly round the ellipse; vertical: five down each side, none at the narrow top and bottom
        const deg = landscape ? -90 + i * (360 / MODULES.length) : i < 5 ? -54 + i * 27 : 126 + (i - 5) * 27;
        const a = ((deg + spin * (landscape ? 1 : 0.3)) * Math.PI) / 180;
        const x = W / 2 + rx * Math.cos(a);
        const y = cy + ry * Math.sin(a);
        const p = tween(frame, m.at, m.at + 16);
        return (
          <div key={m.label} style={{ position: 'absolute', left: x, top: y, translate: '-50% -50%', scale: String(0.9 + 0.1 * p), opacity: p * out, display: 'flex', alignItems: 'center', gap: 12 * k, padding: landscape ? `${12 * k}px ${22 * k}px` : '10px 16px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.24)', color: '#fff', fontFamily: FONT, fontWeight: 600, fontSize: (landscape ? 30 : 26) * k, whiteSpace: 'nowrap' }}>
            <Icon name={m.icon} size={(landscape ? 32 : 34) * k} color={C.ice} draw={tween(frame, m.at + 2, m.at + 20)} />
            {m.label}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, top: cy + (landscape ? 120 : 130) * k, display: 'flex', justifyContent: 'center', opacity: out }}>
        <Sub text="Open-source HR and payroll for India" at={262} size={(landscape ? 34 : 38) * k} color={C.ice} />
      </div>
    </AbsoluteFill>
  );
};
