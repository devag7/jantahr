import * as React from 'react';
import {
  ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text as RNText, TextInput, View,
  type PressableProps, type ScrollViewProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { radius, space, strong, tabular, type, useTheme } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ---------- text ----------
type Variant = keyof typeof type;
export function Text({ variant = 'body', tone = 'primary', bold, num, style, ...p }: TextProps & {
  variant?: Variant; tone?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'success' | 'warning' | 'inverse'; bold?: boolean; num?: boolean;
}) {
  const { colors } = useTheme();
  const color = { primary: colors.text, secondary: colors.textSecondary, tertiary: colors.textTertiary, accent: colors.primary, danger: colors.danger, success: colors.success, warning: colors.warning, inverse: colors.primaryText }[tone];
  return <RNText {...p} style={[type[variant], { color }, bold && strong, num && tabular, style]} />;
}

// ---------- buttons ----------
type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';
export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, style, compact, accessibilityLabel }: {
  title: string; onPress?: () => void; kind?: ButtonKind; icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; compact?: boolean; accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.primarySoft, danger: colors.dangerSoft, ghost: 'transparent' }[kind];
  const fg = { primary: colors.primaryText, secondary: colors.primary, danger: colors.danger, ghost: colors.primary }[kind];
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={() => { void Haptics.selectionAsync().catch(() => undefined); onPress?.(); }}
      style={({ pressed }) => [s.button, compact && s.buttonCompact, { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <Text bold style={{ color: fg }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label, tone }: { icon: IconName; onPress: () => void; label: string; tone?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress}
      style={({ pressed }) => [s.iconButton, { backgroundColor: pressed ? colors.cardPressed : 'transparent' }]}>
      <Ionicons name={icon} size={22} color={tone ?? colors.primary} />
    </Pressable>
  );
}

// ---------- surfaces ----------
export function Card({ children, style, padded = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const { colors, dark } = useTheme();
  return <View style={[s.card, { backgroundColor: colors.card, shadowColor: colors.shadow }, dark && { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, padded && { padding: space.lg }, style]}>{children}</View>;
}

export function Section({ title, action, children, style }: { title?: string; action?: React.ReactNode; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: space.sm }, style]}>
      {(title || action) && (
        <View style={s.sectionHead}>
          {title ? <Text variant="caption" tone="secondary" bold style={s.sectionTitle}>{title.toUpperCase()}</Text> : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

/** A tappable list row: icon, title, optional detail and value, chevron when it navigates. */
export function Row({ icon, iconTone, title, subtitle, value, onPress, chevron = !!onPress, last, right, accessibilityLabel }: {
  icon?: IconName; iconTone?: string; title: string; subtitle?: string | null; value?: string | null; onPress?: () => void; chevron?: boolean; last?: boolean; right?: React.ReactNode; accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [s.row, { backgroundColor: pressed ? colors.cardPressed : 'transparent' }]}
    >
      {icon && <View style={[s.rowIcon, { backgroundColor: (iconTone ?? colors.primary) + '1A' }]}><Ionicons name={icon} size={18} color={iconTone ?? colors.primary} /></View>}
      <View style={[s.rowBody, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2}>{title}</Text>
          {!!subtitle && <Text variant="caption" tone="secondary" numberOfLines={2}>{subtitle}</Text>}
        </View>
        {!!value && <Text tone="secondary" num>{value}</Text>}
        {right}
        {chevron && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
      </View>
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

// ---------- status ----------
export type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const map = {
    neutral: [colors.divider, colors.textSecondary], accent: [colors.primarySoft, colors.primary], success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger],
  } as const;
  const [bg, fg] = map[tone];
  return <View style={[s.badge, { backgroundColor: bg }]}><Text variant="caption" bold style={{ color: fg }}>{label}</Text></View>;
}

/** Workflow states across leave, expenses, requests: one word and one colour each. */
export function statusTone(status: string): Tone {
  if (['APPROVED', 'PAID', 'REIMBURSED', 'PRESENT', 'COMPLETED', 'VERIFIED'].includes(status)) return 'success';
  if (['REJECTED', 'ABSENT', 'CANCELLED'].includes(status)) return 'danger';
  if (['OPEN', 'PENDING', 'SUBMITTED', 'HALF_DAY', 'GENERATED'].includes(status)) return 'warning';
  if (['ON_LEAVE', 'WORK_FROM_HOME', 'HOLIDAY'].includes(status)) return 'accent';
  return 'neutral';
}
const STATUS_LABEL: Record<string, string> = { OPEN: 'Pending', SUBMITTED: 'Submitted', WORK_FROM_HOME: 'WFH', NOT_MARKED: 'Not marked', ON_LEAVE: 'On leave', HALF_DAY: 'Half day', WEEKLY_OFF: 'Weekly off' };
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
export function StatusBadge({ status }: { status: string }) {
  return <Badge label={statusLabel(status)} tone={statusTone(status)} />;
}

// ---------- inputs ----------
export type InputRef = React.ComponentRef<typeof TextInput>;
export const Field = React.forwardRef<InputRef, TextInputProps & { label: string; error?: string | null; hint?: string }>(function Field({ label, error, hint, style, ...p }, ref) {
  const { colors } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ gap: space.xs }}>
      <Text variant="caption" tone="secondary" bold>{label}</Text>
      <TextInput
        ref={ref} placeholderTextColor={colors.textTertiary} {...p}
        onFocus={(e) => { setFocused(true); p.onFocus?.(e); }} onBlur={(e) => { setFocused(false); p.onBlur?.(e); }}
        accessibilityLabel={label}
        style={[s.input, type.body, { color: colors.text, backgroundColor: colors.card, borderColor: error ? colors.danger : focused ? colors.primary : colors.border }, p.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: space.md }, style as StyleProp<TextStyle>]}
      />
      {error ? <Text variant="caption" tone="danger">{error}</Text> : hint ? <Text variant="caption" tone="tertiary">{hint}</Text> : null}
    </View>
  );
});

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; count?: number }[]; onChange: (v: T) => void }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)}
            style={[s.chip, { backgroundColor: on ? colors.text : colors.card, borderColor: on ? colors.text : colors.border }]}>
            <Text variant="caption" bold style={{ color: on ? colors.background : colors.text }}>{o.label}{o.count ? `  ${o.count}` : ''}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ---------- states ----------
export function Loading({ label = 'Loading' }: { label?: string }) {
  const { colors } = useTheme();
  return <View style={s.center} accessibilityLabel={label}><ActivityIndicator color={colors.primary} /></View>;
}
export function EmptyState({ icon = 'leaf-outline', title, message, action }: { icon?: IconName; title: string; message?: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[s.center, { gap: space.sm, paddingVertical: space.xxxl }]}>
      <View style={[s.emptyIcon, { backgroundColor: colors.primarySoft }]}><Ionicons name={icon} size={26} color={colors.primary} /></View>
      <Text bold style={{ textAlign: 'center' }}>{title}</Text>
      {!!message && <Text variant="caption" tone="secondary" style={{ textAlign: 'center', maxWidth: 280 }}>{message}</Text>}
      {action}
    </View>
  );
}
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <EmptyState icon="cloud-offline-outline" title="Could not load this" message={message} action={onRetry && <Button title="Try again" kind="secondary" compact onPress={onRetry} />} />;
}

/** Scrolling page with pull to refresh. Headers come from the router (large titles), so this is only the body. */
export function Page({ children, onRefresh, refreshing = false, style, ...p }: ScrollViewProps & { onRefresh?: () => void; refreshing?: boolean }) {
  const { colors } = useTheme();
  return (
    <ScrollView
      {...p}
      style={{ flex: 1, backgroundColor: colors.background }}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ padding: space.lg, gap: space.xl, paddingBottom: space.xxxl }, style]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Pill({ children, onPress, ...p }: PressableProps & { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Pressable {...p} onPress={onPress} style={({ pressed }) => [s.chip, { backgroundColor: pressed ? colors.cardPressed : colors.card, borderColor: colors.border }]}>{children}</Pressable>;
}

const s = StyleSheet.create({
  button: { minHeight: 48, borderRadius: radius.pill, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  buttonCompact: { minHeight: 40, paddingHorizontal: space.lg },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.lg, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 12, elevation: 1 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs },
  sectionTitle: { letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, minHeight: 56 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: space.md },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingRight: space.lg, minHeight: 56 },
  badge: { borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3, alignSelf: 'flex-start' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md },
  chip: { minHeight: 36, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
});
