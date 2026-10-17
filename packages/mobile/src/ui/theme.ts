import { useColorScheme } from 'react-native';

/**
 * JantaHR's look on the phone (docs/DESIGN.md): cobalt as the brand, committed only on the Home hero, sign-in and
 * splash; everywhere else restrained neutrals tinted toward the brand hue, ink text with three steps of emphasis.
 */
const light = {
  background: '#F4F6FB',
  card: '#FFFFFF',
  raised: '#F8F9FD',
  cardPressed: '#EEF1F8',
  text: '#121A33',
  textSecondary: '#5A6380',
  textTertiary: '#8A92AB',
  border: '#E3E7F2',
  divider: '#EEF1F7',
  primary: '#2350E8',
  primaryDeep: '#1B3FC2',
  primaryText: '#FFFFFF',
  primarySoft: '#E9EEFE',
  brand: '#2350E8',
  brandDeep: '#1A3BB8',
  onBrand: '#FFFFFF',
  onBrandMuted: 'rgba(255,255,255,0.72)',
  ice: '#A9E7FF',
  success: '#12805C',
  successSoft: '#E3F4EC',
  warning: '#B45309',
  warningSoft: '#FDF0E1',
  danger: '#C8283A',
  dangerSoft: '#FCE8EA',
  leave: '#7048E8',
  leaveSoft: '#F0EBFE',
  holiday: '#0B6E80',
  holidaySoft: '#E3F6F9',
  nav: '#121A33',
  navText: '#FFFFFF',
  shadow: 'rgba(18, 26, 51, 0.08)',
  overlay: 'rgba(11, 16, 34, 0.45)',
};
type Colors = typeof light;
const dark: Colors = {
  background: '#0B1022',
  card: '#141B33',
  raised: '#1B2342',
  cardPressed: '#212A4D',
  text: '#EEF1FA',
  textSecondary: '#A3ABC4',
  textTertiary: '#7C84A0',
  border: '#28304F',
  divider: '#1E2643',
  primary: '#7C97FF',
  primaryDeep: '#5F7CF5',
  primaryText: '#0B1022',
  primarySoft: '#1E2A5C',
  brand: '#1F46D6',
  brandDeep: '#16339F',
  onBrand: '#FFFFFF',
  onBrandMuted: 'rgba(255,255,255,0.72)',
  ice: '#A9E7FF',
  success: '#3DD598',
  successSoft: '#123B2E',
  warning: '#F5A524',
  warningSoft: '#3A2A10',
  danger: '#FF6B7A',
  dangerSoft: '#3D1820',
  leave: '#A78BFA',
  leaveSoft: '#2A2150',
  holiday: '#4DD4E8',
  holidaySoft: '#10333B',
  nav: '#000000',
  navText: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.35)',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** Leave kinds keep one hue each, so a balance is recognised by colour as well as by name. */
export function leaveHue(name: string, dark_ = false): string {
  const n = name.toLowerCase();
  const pick = (l: string, d: string) => (dark_ ? d : l);
  if (/casual/.test(n)) return pick('#2350E8', '#7C97FF');
  if (/sick|medical/.test(n)) return pick('#D6336C', '#FF7AA2');
  if (/privilege|earned|annual/.test(n)) return pick('#12805C', '#3DD598');
  if (/comp|compensat/.test(n)) return pick('#7048E8', '#A78BFA');
  if (/maternity|paternity|parent/.test(n)) return pick('#0C8599', '#4DD4E8');
  return pick('#B45309', '#F5A524');
}

/** A calm tint per person for initials avatars (stable for the same name). */
export function personHue(name: string): { bg: string; fg: string } {
  const hues = [['#E9EEFE', '#1B3FC2'], ['#E3F4EC', '#0E6B4D'], ['#FDF0E1', '#9A4A07'], ['#F3E8FF', '#6B3BC9'], ['#FCE8EF', '#B0275A'], ['#E3F6F9', '#0B6E80']];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = hues[h % hues.length];
  return { bg, fg };
}

/** 8-point spacing. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

/** Inter, two weights; on Android each weight is its own family (embedded by the expo-font plugin). */
export const font = { regular: 'Inter_400Regular', semibold: 'Inter_600SemiBold' } as const;
/** Four sizes; tabular figures for money, hours and days. */
export const type = {
  display: { fontSize: 40, lineHeight: 46, fontFamily: font.semibold, letterSpacing: -1 },
  title: { fontSize: 28, lineHeight: 34, fontFamily: font.semibold, letterSpacing: -0.6 },
  heading: { fontSize: 20, lineHeight: 26, fontFamily: font.semibold, letterSpacing: -0.3 },
  body: { fontSize: 16, lineHeight: 22, fontFamily: font.regular, letterSpacing: -0.1 },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: font.regular },
};
export const strong = { fontFamily: font.semibold };
export const tabular = { fontVariant: ['tabular-nums' as const] };

export type Theme = { colors: Colors; dark: boolean };
export function useTheme(): Theme {
  const dark_ = useColorScheme() === 'dark';
  return { colors: dark_ ? dark : light, dark: dark_ };
}
export const palette = { light, dark };
