import { useColorScheme } from 'react-native';

/**
 * The website's palette (packages/frontend/src/app/globals.css) on the phone: Parchment background, white cards,
 * Action Blue as the one accent, Ink text with opacity steps for hierarchy. Dark mode follows the system.
 */
const light = {
  background: '#F5F5F7',
  card: '#FFFFFF',
  cardPressed: '#F0F0F2',
  text: '#1D1D1F',
  textSecondary: '#6E6E73',
  textTertiary: '#86868B',
  border: '#E0E0E0',
  divider: '#F0F0F0',
  primary: '#0066CC',
  primaryText: '#FFFFFF',
  primarySoft: '#E8F1FB',
  success: '#008009',
  successSoft: '#E6F4E6',
  warning: '#B64400',
  warningSoft: '#FBEDE5',
  danger: '#D70015',
  dangerSoft: '#FBE6E8',
  nav: '#000000',
  navText: '#FFFFFF',
  shadow: 'rgba(29, 29, 31, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.4)',
};
type Colors = typeof light;
const dark: Colors = {
  background: '#161617',
  card: '#272729',
  cardPressed: '#323234',
  text: '#F5F5F7',
  textSecondary: '#A1A1A6',
  textTertiary: '#86868B',
  border: '#3A3A3C',
  divider: '#2C2C2E',
  primary: '#2997FF',
  primaryText: '#1D1D1F',
  primarySoft: '#14304D',
  success: '#30D158',
  successSoft: '#11331C',
  warning: '#FF9F0A',
  warningSoft: '#3D2A0B',
  danger: '#FF453A',
  dangerSoft: '#3F1715',
  nav: '#000000',
  navText: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.4)',
  overlay: 'rgba(0, 0, 0, 0.6)',
};

/** 8-point spacing. */
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 10, md: 14, lg: 18, pill: 999 } as const;
/** Four sizes, two weights (400, 600); tabular figures for money and times. */
export const type = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '600' as const, letterSpacing: -0.4 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
};
export const strong = { fontWeight: '600' as const };
export const tabular = { fontVariant: ['tabular-nums' as const] };

export type Theme = { colors: Colors; dark: boolean };
export function useTheme(): Theme {
  const dark_ = useColorScheme() === 'dark';
  return { colors: dark_ ? dark : light, dark: dark_ };
}
export const palette = { light, dark };
