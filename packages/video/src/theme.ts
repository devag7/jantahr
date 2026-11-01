import { loadFont } from '@remotion/fonts';
import { Easing, interpolate, staticFile } from 'remotion';

/** Brand tokens, matching packages/mobile/src/ui/theme.ts and docs/DESIGN.md. */
export const C = {
  cobalt: '#2350E8',
  deep: '#1B3FC2',
  deeper: '#1A3BB8',
  ice: '#A9E7FF',
  ink: '#121A33',
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  secondary: '#5A6380',
  tertiary: '#8A92AB',
  border: '#E3E7F2',
  success: '#12805C',
  danger: '#C8283A',
  warning: '#B45309',
  night: '#0B1022',
} as const;

export const FONT = 'Inter';
export const fontsReady = Promise.all([
  loadFont({ family: FONT, url: staticFile('fonts/Inter_400Regular.ttf'), weight: '400' }),
  loadFont({ family: FONT, url: staticFile('fonts/Inter_600SemiBold.ttf'), weight: '600' }),
]);

export const FPS = 30;
export const sec = (s: number) => Math.round(s * FPS);

/** Ease-out only, no overshoot (docs/DESIGN.md: "ease-out, no bounce"). */
export const easeOut = Easing.bezier(0.22, 1, 0.36, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);

/** Clamped, eased interpolation between two frames. */
export const tween = (frame: number, from: number, to: number, a = 0, b = 1, easing = easeOut) =>
  interpolate(frame, [from, to], [a, b], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

/** 0 → 1 → 0 envelope: fade in over `fade` frames from `start`, out over `fade` frames before `end`. */
export const envelope = (frame: number, start: number, end: number, fade = 12) =>
  Math.min(tween(frame, start, start + fade), 1 - tween(frame, end - fade, end, 0, 1, easeInOut));

export const inr = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
