import Svg, { G, Path } from 'react-native-svg';

/**
 * The JantaHR mark (assets/brand/mark.svg): a heavy J with a compact HR at its cap line, drawn as strokes. White and
 * ice on cobalt by default; `mono` paints both in one colour for light surfaces.
 */
export function BrandMark({ size = 48, mono }: { size?: number; mono?: string }) {
  const j = mono ?? '#FFFFFF';
  const hr = mono ?? '#A9E7FF';
  return (
    <Svg width={size} height={(size * 580) / 760} viewBox="150 230 760 580" accessibilityLabel="JantaHR">
      <G fill="none" strokeLinecap="butt" strokeLinejoin="miter">
        <Path d="M478 252 V598 A124 124 0 0 1 230 598 V586" stroke={j} strokeWidth={124} />
        <Path d="M586 252 V452 M720 252 V452 M586 352 H720" stroke={hr} strokeWidth={46} />
        <Path d="M770 452 V275 H836 A52 52 0 0 1 836 379 H770 M818 379 L880 452" stroke={hr} strokeWidth={46} />
      </G>
    </Svg>
  );
}
