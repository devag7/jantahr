import React from 'react';
import { useCurrentFrame } from 'remotion';
import { C, easeInOut, tween } from './theme';
import { Headline, Phone, Rings, Shot, Sub, useFormat } from './ui';

/** Where the phone, the text and the floating cards sit, in landscape and vertical. */
export const usePhoneStage = () => {
  const f = useFormat();
  const { landscape, u } = f;
  const h = landscape ? 930 * u : 1040;
  const s = h / 2400;
  const w = 1080 * s;
  const x = landscape ? 860 * u : (1080 - w) / 2;
  const y = landscape ? 75 * u : 610;
  /** screen pixel → frame pixel */
  const at = (sx: number, sy: number) => ({ x: x + sx * s, y: y + sy * s });
  return {
    ...f, h, s, w, x, y, at,
    text: landscape ? { x: 130 * u, y: 330 * u, w: 660 * u, hs: 84 * u, ss: 36 * u } : { x: 80, y: 190, w: 920, hs: 82, ss: 40 },
    /** a free column for floating cards */
    side: landscape ? { x: 1360 * u, w: 500 * u } : { x: 70, w: 940 },
    chip: landscape ? 30 * u : 34,
  };
};

export type Screen = { src: string; from: number; to: number; fade?: number; overlay?: React.ReactNode };

/** Cross-fades a list of screens inside the phone. */
export const Screens: React.FC<{ screens: Screen[] }> = ({ screens }) => {
  const frame = useCurrentFrame();
  return (
    <>
      {screens.map((sc, i) => {
        const fade = sc.fade ?? 14;
        const o = i === 0 ? 1 : tween(frame, sc.from, sc.from + fade, 0, 1, easeInOut);
        if (frame < sc.from || frame >= (screens[i + 1] ? screens[i + 1].from + (screens[i + 1].fade ?? 14) : Infinity)) return null;
        return (
          <div key={i} style={{ position: 'absolute', inset: 0, width: 1080, height: 2400, opacity: o }}>
            <Shot src={sc.src} w={1080} />
            {sc.overlay}
          </div>
        );
      })}
    </>
  );
};

/** One beat of copy: headline, then a supporting line; both leave before the next beat. */
export const Beat: React.FC<{ title: string; sub?: string; at: number; out: number; color?: string; subColor?: string }> = ({ title, sub, at, out, color = C.ink, subColor = C.secondary }) => {
  const st = usePhoneStage();
  const frame = useCurrentFrame();
  if (frame < at - 2 || frame > out + 14) return null;
  return (
    <div style={{ position: 'absolute', left: st.text.x, top: st.text.y, width: st.text.w }}>
      <Headline text={title} at={at} size={st.text.hs} out={out} color={color} />
      {sub && <Sub text={sub} at={at + 14} out={out} size={st.text.ss} color={subColor} style={{ marginTop: 22 * (st.landscape ? st.u : 1) }} />}
    </div>
  );
};

/** Light page with faint cobalt rings behind the phone. */
export const StageBackground: React.FC<{ fromCobalt?: boolean }> = ({ fromCobalt }) => {
  const st = usePhoneStage();
  const frame = useCurrentFrame();
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, background: C.bg }} />
      <Rings cx={st.x + st.w / 2} cy={st.y + st.h * 0.42} base={st.h * 0.42} gap={st.h * 0.16} count={5} color={C.cobalt} opacity={0.09} drift={0.25} />
      {fromCobalt && <div style={{ position: 'absolute', inset: 0, background: C.cobalt, opacity: 1 - tween(frame, 0, 26, 0, 1, easeInOut) }} />}
    </>
  );
};

export const PhoneOnStage: React.FC<{ children: React.ReactNode; enter?: boolean }> = ({ children, enter }) => {
  const st = usePhoneStage();
  const frame = useCurrentFrame();
  const dy = enter ? tween(frame, 4, 40, st.H * 0.7, 0) : 0;
  return (
    <Phone x={st.x} y={st.y} h={st.h} style={{ translate: `0px ${dy}px` }}>
      {children}
    </Phone>
  );
};
