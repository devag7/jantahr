import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { C, FONT, easeInOut, tween } from './theme';

/** Layout helper: the same scenes serve 1920x1080 and 1080x1920. `u` scales sizes to the frame. */
export const useFormat = () => {
  const { width, height } = useVideoConfig();
  const landscape = width >= height;
  return { W: width, H: height, landscape, u: landscape ? width / 1920 : width / 1080 };
};

export const Fill: React.FC<{ color: string; opacity?: number }> = ({ color, opacity = 1 }) => (
  <AbsoluteFill style={{ backgroundColor: color, opacity }} />
);

/** Quiet concentric rings, like the sign-in screen and the Play feature graphic. */
export const Rings: React.FC<{ cx: number; cy: number; base: number; gap: number; count?: number; color?: string; opacity?: number; drift?: number }> = ({
  cx, cy, base, gap, count = 5, color = '#FFFFFF', opacity = 0.14, drift = 0.35,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = base + i * gap + ((frame * drift) % gap);
        const o = opacity * (1 - (r - base) / (count * gap));
        return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={2} opacity={Math.max(0, o)} />;
      })}
    </svg>
  );
};

/** A phone with an ink bezel. Children are laid out in the screen's own 1080x2400 pixel space. */
export const Phone: React.FC<{ x: number; y: number; h: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ x, y, h, children, style }) => {
  const s = h / 2400;
  const bez = 34;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 1080 * s, height: 2400 * s, ...style }}>
      <div style={{ position: 'absolute', left: -bez * s, top: -bez * s, width: (1080 + 2 * bez) * s, height: (2400 + 2 * bez) * s, borderRadius: 150 * s, background: '#0E1631', boxShadow: `0 ${60 * s}px ${160 * s}px rgba(18,26,51,0.28), 0 ${8 * s}px ${24 * s}px rgba(18,26,51,0.18)` }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: 118 * s, overflow: 'hidden', background: C.bg }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 2400, scale: String(s), transformOrigin: '0 0' }}>{children}</div>
      </div>
    </div>
  );
};

/** A laptop (browser window + deck). Children are laid out in the screenshot's 2880x1800 pixel space. */
export const Laptop: React.FC<{ x: number; y: number; w: number; children: React.ReactNode; url?: string; style?: React.CSSProperties }> = ({ x, y, w, children, url = 'jantahr.devshipit.com', style }) => {
  const s = w / 2880;
  const bar = 110;
  const h = 1800 * s;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: h + bar * s, ...style }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 34 * s, background: '#FFFFFF', overflow: 'hidden', boxShadow: `0 ${70 * s}px ${200 * s}px rgba(18,26,51,0.26), 0 0 0 ${3 * s}px rgba(18,26,51,0.08)` }}>
        <div style={{ height: bar * s, background: '#EEF1F7', display: 'flex', alignItems: 'center', gap: 22 * s, paddingLeft: 44 * s, borderBottom: `${2 * s}px solid ${C.border}` }}>
          {['#E3E7F2', '#E3E7F2', '#E3E7F2'].map((c, i) => <div key={i} style={{ width: 26 * s, height: 26 * s, borderRadius: 99, background: c }} />)}
          <div style={{ marginLeft: 60 * s, height: 62 * s, width: 900 * s, borderRadius: 99, background: '#FFFFFF', display: 'flex', alignItems: 'center', paddingLeft: 34 * s, fontFamily: FONT, fontSize: 30 * s, color: C.secondary }}>{url}</div>
        </div>
        <div style={{ position: 'relative', width: w, height: h, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, width: 2880, height: 1800, scale: String(s), transformOrigin: '0 0' }}>{children}</div>
        </div>
      </div>
    </div>
  );
};

export const Shot: React.FC<{ src: string; opacity?: number; y?: number; w?: number; style?: React.CSSProperties }> = ({ src, opacity = 1, y = 0, w, style }) => (
  <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: y, width: w, opacity, ...style }} />
);

/** A real UI card cut from a capture, floating out of its screen. */
export const Card: React.FC<{ src: string; w: number; radius?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ src, w, radius = 22, style, children }) => (
  <div style={{ position: 'absolute', width: w, borderRadius: radius, overflow: 'hidden', background: '#fff', boxShadow: '0 30px 80px rgba(18,26,51,0.22), 0 4px 14px rgba(18,26,51,0.10)', ...style }}>
    <Img src={staticFile(src)} style={{ width: '100%', display: 'block' }} />
    {children}
  </div>
);

/** A real UI card at display width `w`; children are laid out in the card image's own pixels (natural width `nw`). */
export const ScaledCard: React.FC<{ src: string; nw: number; nh: number; w: number; x: number; y: number; radius?: number; style?: React.CSSProperties; children?: React.ReactNode }> = ({ src, nw, nh, w, x, y, radius = 48, style, children }) => {
  const s = w / nw;
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: w, height: nh * s, ...style }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius * s, overflow: 'hidden', background: '#fff', boxShadow: `0 ${30}px ${80}px rgba(18,26,51,0.20), 0 4px 14px rgba(18,26,51,0.10)` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: nw, height: nh, scale: String(s), transformOrigin: '0 0' }}>
          <Img src={staticFile(src)} style={{ position: 'absolute', left: 0, top: 0, width: nw }} />
          {children}
        </div>
      </div>
    </div>
  );
};

/** Card entrance: rises 40px, scales from 0.96, fades in. Ease-out, no overshoot. */
export const rise = (frame: number, at: number, dur = 18, dist = 40): React.CSSProperties => ({
  opacity: tween(frame, at, at + dur * 0.7),
  translate: `0px ${tween(frame, at, at + dur, dist, 0)}px`,
  scale: String(tween(frame, at, at + dur, 0.96, 1)),
});

/** Tap feedback in screen space: a filled dot and an expanding ring. */
export const Tap: React.FC<{ x: number; y: number; at: number; size?: number; color?: string }> = ({ x, y, at, size = 120, color = C.cobalt }) => {
  const frame = useCurrentFrame();
  if (frame < at - 6 || frame > at + 30) return null;
  const press = tween(frame, at - 6, at, 0, 1) * (1 - tween(frame, at + 6, at + 18));
  const ring = tween(frame, at, at + 26);
  return (
    <>
      <div style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: 999, background: color, opacity: 0.22 * press, scale: String(0.7 + 0.3 * press) }} />
      <div style={{ position: 'absolute', left: x - size, top: y - size, width: size * 2, height: size * 2, borderRadius: 999, border: `6px solid ${color}`, opacity: 0.5 * (1 - ring), scale: String(0.4 + 0.8 * ring) }} />
    </>
  );
};

/** Kinetic headline: words rise into place one after another. */
export const Headline: React.FC<{ text: string; at: number; size: number; color?: string; weight?: number; stagger?: number; align?: 'left' | 'center'; style?: React.CSSProperties; out?: number }> = ({
  text, at, size, color = C.ink, weight = 600, stagger = 3, align = 'left', style, out,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(' ');
  const fadeOut = out === undefined ? 1 : 1 - tween(frame, out, out + 12, 0, 1, easeInOut);
  return (
    <div style={{ fontFamily: FONT, fontWeight: weight, fontSize: size, lineHeight: 1.08, letterSpacing: -0.025 * size, color, textAlign: align, opacity: fadeOut, ...style }}>
      {words.map((w, i) => {
        const t = at + i * stagger;
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: 0.12 * size, marginBottom: -0.12 * size }}>
            <span style={{ display: 'inline-block', translate: `0px ${tween(frame, t, t + 16, 0.9 * size, 0)}px`, opacity: tween(frame, t, t + 10) }}>{w}&nbsp;</span>
          </span>
        );
      })}
    </div>
  );
};

export const Sub: React.FC<{ text: string; at: number; size: number; color?: string; style?: React.CSSProperties; out?: number }> = ({ text, at, size, color = C.secondary, style, out }) => {
  const frame = useCurrentFrame();
  const fadeOut = out === undefined ? 1 : 1 - tween(frame, out, out + 12, 0, 1, easeInOut);
  return (
    <div style={{ fontFamily: FONT, fontWeight: 400, fontSize: size, lineHeight: 1.35, color, opacity: tween(frame, at, at + 14) * fadeOut, translate: `0px ${tween(frame, at, at + 18, 18, 0)}px`, ...style }}>{text}</div>
  );
};

type IconName = 'pin' | 'camera' | 'check' | 'bell' | 'phone' | 'lock' | 'rupee' | 'file' | 'calendar' | 'shield' | 'globe' | 'card' | 'india' | 'users';
const ICONS: Record<IconName, string> = {
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z M12 12.2a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z',
  camera: 'M4 8.5h3l1.6-2.5h6.8L17 8.5h3v10H4z M12 16.2a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z M10 20.5h4',
  phone: 'M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3z M11 18h2',
  lock: 'M6 10.5h12v10H6z M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5',
  rupee: 'M7 5h10 M7 9h10 M7 5h3a4 4 0 0 1 0 8H7l7 7',
  file: 'M7 3h7l4 4v14H7z M14 3v4h4 M9.5 12h6 M9.5 16h6',
  calendar: 'M4.5 6h15v14h-15z M4.5 10h15 M8.5 3.5v4 M15.5 3.5v4',
  shield: 'M12 3l7.5 3v5.5c0 4.6-3.2 8.2-7.5 9.5-4.3-1.3-7.5-4.9-7.5-9.5V6z M9 12l2.2 2.2L15.5 10',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M3 12h18 M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z',
  card: 'M3.5 6h17v12h-17z M3.5 10h17 M7 14.5h4',
  india: 'M12 3v18 M4 8h16 M4 16h16',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5 M16 4.3a3.5 3.5 0 0 1 0 6.4 M18 14.8c2 .7 3.2 2.4 3.5 5.2',
};

export const Icon: React.FC<{ name: IconName; size: number; color: string; draw?: number }> = ({ name, size, color, draw = 1 }) => {
  const d = ICONS[name];
  const ev = draw < 1 ? evolvePath(draw, d) : null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} style={ev ? { strokeDasharray: ev.strokeDasharray, strokeDashoffset: ev.strokeDashoffset } : undefined} />
    </svg>
  );
};

/** Pill chip with an icon. */
export const Chip: React.FC<{ icon?: IconName; text: string; at: number; size: number; dark?: boolean; style?: React.CSSProperties; out?: number }> = ({ icon, text, at, size, dark, style, out }) => {
  const frame = useCurrentFrame();
  const fadeOut = out === undefined ? 1 : 1 - tween(frame, out, out + 10, 0, 1, easeInOut);
  return (
    <div style={{ position: 'absolute', display: 'flex', alignItems: 'center', gap: 0.5 * size, padding: `${0.55 * size}px ${0.95 * size}px`, borderRadius: 999, background: dark ? 'rgba(255,255,255,0.12)' : '#FFFFFF', color: dark ? '#FFFFFF' : C.ink, fontFamily: FONT, fontWeight: 600, fontSize: size, boxShadow: dark ? 'none' : '0 18px 50px rgba(18,26,51,0.16), 0 2px 8px rgba(18,26,51,0.08)', border: dark ? '1.5px solid rgba(255,255,255,0.22)' : 'none', whiteSpace: 'nowrap', ...rise(frame, at, 16, 24), opacity: tween(frame, at, at + 12) * fadeOut, ...style }}>
      {icon && (
        <div style={{ width: 1.6 * size, height: 1.6 * size, borderRadius: 999, background: dark ? 'rgba(169,231,255,0.18)' : '#E8EEFD', display: 'grid', placeItems: 'center' }}>
          <Icon name={icon} size={1.05 * size} color={dark ? C.ice : C.cobalt} draw={tween(frame, at + 4, at + 24)} />
        </div>
      )}
      {text}
    </div>
  );
};

/** A rounded outline that draws itself around a region (in the parent's coordinate space). */
export const Outline: React.FC<{ x: number; y: number; w: number; h: number; at: number; until?: number; r?: number; stroke?: number; color?: string }> = ({ x, y, w, h, at, until, r = 24, stroke = 6, color = C.cobalt }) => {
  const frame = useCurrentFrame();
  const p = tween(frame, at, at + 22);
  const o = until === undefined ? 1 : 1 - tween(frame, until, until + 10);
  if (p <= 0 || o <= 0) return null;
  const per = 2 * (w + h);
  return (
    <svg style={{ position: 'absolute', left: x - stroke, top: y - stroke, overflow: 'visible' }} width={w + 2 * stroke} height={h + 2 * stroke}>
      <rect x={stroke} y={stroke} width={w} height={h} rx={r} fill={color} fillOpacity={0.06 * p * o} stroke={color} strokeWidth={stroke} strokeDasharray={per} strokeDashoffset={per * (1 - p)} opacity={o} />
    </svg>
  );
};

/** Reveals a circular region of an image clockwise from 12 o'clock: a ring "filling". Coordinates in the image's pixels. */
export const RingReveal: React.FC<{ src: string; imgW: number; cx: number; cy: number; r: number; at: number; dur?: number; bg?: string }> = ({ src, imgW, cx, cy, r, at, dur = 30, bg = '#FFFFFF' }) => {
  const frame = useCurrentFrame();
  const p = tween(frame, at, at + dur, 0, 1, easeInOut);
  if (p >= 1) return null;
  const deg = p * 360;
  return (
    <div style={{ position: 'absolute', left: cx - r, top: cy - r, width: 2 * r, height: 2 * r, borderRadius: 999, overflow: 'hidden', background: bg }}>
      <Img src={staticFile(src)} style={{ position: 'absolute', left: -(cx - r), top: -(cy - r), width: imgW, maskImage: `conic-gradient(#000 ${deg}deg, transparent ${deg}deg)`, WebkitMaskImage: `conic-gradient(#000 ${deg}deg, transparent ${deg}deg)` }} />
    </div>
  );
};

/** The JantaHR mark (docs/DESIGN.md: vector strokes, never typeset), drawn on with `progress` 0..1. */
export const Mark: React.FC<{ size: number; progress?: number; style?: React.CSSProperties }> = ({ size, progress = 1, style }) => {
  const J = 'M478 252 V598 A124 124 0 0 1 230 598 V586';
  const H = 'M586 252 V452 M720 252 V452 M586 352 H720';
  const R = 'M770 452 V275 H836 A52 52 0 0 1 836 379 H770 M818 379 L880 452';
  const pj = Math.min(1, progress / 0.6);
  const ph = Math.max(0, Math.min(1, (progress - 0.35) / 0.4));
  const pr = Math.max(0, Math.min(1, (progress - 0.55) / 0.45));
  const dash = (p: number, d: string) => {
    if (p >= 1) return {};
    const e = evolvePath(p, d);
    return { strokeDasharray: e.strokeDasharray, strokeDashoffset: e.strokeDashoffset };
  };
  return (
    <svg width={size} height={(size * 580) / 760} viewBox="150 230 760 580" style={style}>
      <g fill="none" strokeLinecap="butt" strokeLinejoin="miter">
        <path d={J} stroke="#FFFFFF" strokeWidth={124} style={dash(pj, J)} />
        <g stroke={C.ice} strokeWidth={46}>
          <path d={H} style={dash(ph, H)} />
          <path d={R} style={dash(pr, R)} />
        </g>
      </g>
    </svg>
  );
};

/** App icon tile: the mark on a cobalt-to-deep gradient, as in assets/brand/icon.svg. */
export const AppIcon: React.FC<{ size: number; progress?: number; style?: React.CSSProperties }> = ({ size, progress = 1, style }) => (
  <div style={{ width: size, height: size, borderRadius: size * 0.225, background: `linear-gradient(180deg, ${C.cobalt}, ${C.deep})`, display: 'grid', placeItems: 'center', boxShadow: `0 ${size * 0.08}px ${size * 0.25}px rgba(10,20,70,0.35), inset 0 0 0 ${size * 0.006}px rgba(255,255,255,0.18)`, ...style }}>
    <Mark size={size * 0.72} progress={progress} style={{ marginLeft: size * 0.03 }} />
  </div>
);

export const fadeOutStyle = (frame: number, start: number, dur = 12): React.CSSProperties => ({ opacity: 1 - tween(frame, start, start + dur, 0, 1, easeInOut) });
