import * as React from 'react';
import { ActivityIndicator, Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View, ViewStyle, useColorScheme } from 'react-native';

/**
 * Same tokens as the web app (docs/design-system.md): Parchment canvas, white cards, Ink text, Action Blue as the only
 * accent. Dark mode follows iOS system colours. Text uses the system font, which is SF Pro on iOS.
 */
const light = {
  bg: '#f5f5f7', card: '#ffffff', text: '#1d1d1f', muted: '#6e6e73', border: '#e0e0e0', input: '#86868b',
  primary: '#0066cc', link: '#0066cc', onPrimary: '#ffffff', ink: '#1d1d1f', onInk: '#ffffff',
  danger: '#d70015', success: '#008009', warning: '#b64400', fill: '#f5f5f7',
};
const dark: typeof light = {
  bg: '#000000', card: '#1c1c1e', text: '#f5f5f7', muted: '#a1a1a6', border: '#38383a', input: '#6e6e73',
  primary: '#0071e3', link: '#2997ff', onPrimary: '#ffffff', ink: '#f5f5f7', onInk: '#1d1d1f',
  danger: '#ff453a', success: '#30d158', warning: '#ff9f0a', fill: '#2c2c2e',
};
export type Palette = typeof light;
export const useTheme = (): Palette => (useColorScheme() === 'dark' ? dark : light);

/** Type scale (points): large title 34, title 21, body 17, caption 14, fine 12. Weights 400 / 600 / 700 only. */
export const type: Record<'largeTitle' | 'title' | 'figure' | 'bodyStrong' | 'body' | 'caption' | 'fine', TextStyle> = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title: { fontSize: 21, lineHeight: 25, fontWeight: '600' },
  figure: { fontSize: 28, lineHeight: 34, fontWeight: '600', fontVariant: ['tabular-nums'] },
  bodyStrong: { fontSize: 17, lineHeight: 21, fontWeight: '600', letterSpacing: -0.374 },
  body: { fontSize: 17, lineHeight: 25, letterSpacing: -0.374 },
  caption: { fontSize: 14, lineHeight: 19 },
  fine: { fontSize: 12, lineHeight: 16 },
};

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 16 }, style]}>{children}</View>;
}

export function Heading({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[type.largeTitle, { color: t.text, marginBottom: 4 }]}>{children}</Text>;
}

/** Section heading; `small` is the 17pt body-strong step for card titles. */
export function Title({ children, style, small }: { children: React.ReactNode; style?: StyleProp<TextStyle>; small?: boolean }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[small ? type.bodyStrong : type.title, { color: t.text }, style]}>{children}</Text>;
}

/** Grouped-list section label, as in iOS Settings. */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  const t = useTheme();
  return <Text style={[type.fine, { color: t.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[type.caption, { color: t.muted }, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[type.body, { color: t.text }, style]}>{children}</Text>;
}

/** Pill buttons that press to 95%, like the web app. `outline` is the secondary action. */
export function Button({ title, onPress, loading, variant = 'primary', disabled }: { title: string; onPress: () => void; loading?: boolean; variant?: 'primary' | 'danger' | 'outline'; disabled?: boolean }) {
  const t = useTheme();
  const bg = variant === 'primary' ? t.primary : variant === 'danger' ? t.danger : 'transparent';
  const fg = variant === 'outline' ? t.link : t.onPrimary;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!(loading || disabled), busy: !!loading }} onPress={onPress} disabled={loading || disabled}
      style={({ pressed }) => ({ backgroundColor: bg, borderColor: t.link, borderWidth: variant === 'outline' ? 1 : 0, opacity: disabled ? 0.4 : 1, transform: [{ scale: pressed ? 0.95 : 1 }], borderRadius: 999, paddingHorizontal: 22, minHeight: 50, alignItems: 'center', justifyContent: 'center' })}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[type.body, { color: fg, fontWeight: '600' }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const t = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={[type.caption, { color: t.text, fontWeight: '600', marginBottom: 6 }]}>{label}</Text>
      <TextInput placeholderTextColor={t.muted} accessibilityLabel={label} {...rest}
        style={[type.body, { color: t.text, backgroundColor: t.card, borderColor: t.input, borderWidth: 1, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 12, minHeight: 50 }, style]} />
    </View>
  );
}

/** Status as coloured text on a neutral pill, never a filled colour block. */
export function StatusPill({ label, color }: { label: string; color: string }) {
  const t = useTheme();
  return <View style={{ backgroundColor: t.fill, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={[type.fine, { color, fontWeight: '600' }]}>{label}</Text></View>;
}

export const inr = (n: number) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)}`;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-06..." → "06 Oct" (no timezone shift: the API sends date-only values). */
export const shortDate = (iso: string) => `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
export const humanize = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
