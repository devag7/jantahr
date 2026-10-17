import * as React from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text as RNText, TextInput, View,
  type PressableProps, type ScrollViewProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, strong, tabular, type, useTheme } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Android's own touch feedback (a ripple), clipped to the control; other platforms dim on press instead. */
function useRipple(color?: string, borderless = false) {
  const { colors } = useTheme();
  return Platform.OS === 'android' ? { android_ripple: { color: color ?? colors.cardPressed, borderless, foreground: true } } : {};
}
const pressedStyle = (pressed: boolean) => (Platform.OS === 'android' ? null : { opacity: pressed ? 0.7 : 1 });

// ---------- text ----------
type Variant = keyof typeof type;
export function Text({ variant = 'body', tone = 'primary', bold, num, style, ...p }: TextProps & {
  variant?: Variant; tone?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'danger' | 'success' | 'warning' | 'inverse'; bold?: boolean; num?: boolean;
}) {
  const { colors } = useTheme();
  const color = { primary: colors.text, secondary: colors.textSecondary, tertiary: colors.textTertiary, accent: colors.primary, danger: colors.danger, success: colors.success, warning: colors.warning, inverse: colors.primaryText }[tone];
  return <RNText maxFontSizeMultiplier={1.6} {...p} style={[type[variant], { color }, bold && strong, num && tabular, style]} />;
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
  const ripple = useRipple(kind === 'primary' ? 'rgba(255,255,255,0.24)' : undefined);
  return (
    <View style={[s.buttonClip, compact && s.buttonCompact, { opacity: off ? 0.5 : 1 }, style]}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} accessibilityState={{ disabled: !!off, busy: !!loading }}
        disabled={off} onPress={onPress} {...ripple}
        style={({ pressed }) => [s.button, compact && s.buttonCompact, { backgroundColor: bg }, pressedStyle(pressed)]}
      >
        {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
        <Text bold style={{ color: fg }} numberOfLines={1}>{title}</Text>
      </Pressable>
    </View>
  );
}

export function IconButton({ icon, onPress, label, tone, badge }: { icon: IconName; onPress: () => void; label: string; tone?: string; badge?: number }) {
  const { colors } = useTheme();
  const ripple = useRipple(undefined, true);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} new` : label} onPress={onPress} {...ripple} style={({ pressed }) => [s.iconButton, pressedStyle(pressed)]}>
      <Ionicons name={icon} size={24} color={tone ?? colors.primary} />
      {!!badge && <View style={[s.dotBadge, { backgroundColor: colors.danger, borderColor: colors.background }]}><RNText style={s.dotBadgeText}>{badge > 99 ? '99+' : badge}</RNText></View>}
    </Pressable>
  );
}

/** A short text action next to a section title ("Apply", "All"): text-sized, with a full 48 dp touch area. */
export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Text variant="caption" tone="accent" bold>{title}</Text>
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
          {title ? <Text variant="caption" tone="secondary" bold style={s.sectionTitle} accessibilityRole="header">{title.toUpperCase()}</Text> : <View />}
          {action}
        </View>
      )}
      {children}
    </View>
  );
}

/** A tappable list row: icon, title, optional detail and value, chevron when it navigates. Read as one item. */
export function Row({ icon, iconTone, title, subtitle, value, onPress, chevron = !!onPress, last, right, accessibilityLabel }: {
  icon?: IconName; iconTone?: string; title: string; subtitle?: string | null; value?: string | null; onPress?: () => void; chevron?: boolean; last?: boolean; right?: React.ReactNode; accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const ripple = useRipple();
  return (
    <Pressable
      disabled={!onPress} onPress={onPress} accessible accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={accessibilityLabel} {...(onPress ? ripple : {})}
      style={({ pressed }) => [s.row, onPress && pressedStyle(pressed)]}
    >
      {icon && <View style={[s.rowIcon, { backgroundColor: (iconTone ?? colors.primary) + '1A' }]}><Ionicons name={icon} size={18} color={iconTone ?? colors.primary} /></View>}
      <View style={[s.rowBody, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2}>{title}</Text>
          {!!subtitle && <Text variant="caption" tone="secondary" numberOfLines={3}>{subtitle}</Text>}
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
        ref={ref} placeholderTextColor={colors.textTertiary} cursorColor={colors.primary} selectionColor={colors.primary + '55'} {...p}
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
  const ripple = useRipple();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm, paddingVertical: 4 }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <View key={o.value} style={s.chipClip}>
            <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} onPress={() => onChange(o.value)} {...ripple}
              style={[s.chip, { backgroundColor: on ? colors.text : colors.card, borderColor: on ? colors.text : colors.border }]}>
              {on && <Ionicons name="checkmark" size={16} color={colors.background} />}
              <Text variant="caption" bold style={{ color: on ? colors.background : colors.text }}>{o.label}{o.count ? `  ${o.count}` : ''}</Text>
            </Pressable>
          </View>
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

/** A grey block the shape of what is coming, pulsing gently; keeps the layout from jumping when data lands. */
export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | `${number}%`; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const pulse = React.useRef(new Animated.Value(0.5)).current;
  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height, width, borderRadius: radius.sm, backgroundColor: colors.divider, opacity: pulse }, style]} />;
}
/** Placeholder for a card of list rows. */
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <Card style={{ gap: space.lg }} >
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Skeleton height={32} width={32} />
          <View style={{ flex: 1, gap: space.sm }}><Skeleton height={14} width="60%" /><Skeleton height={12} width="35%" /></View>
        </View>
      ))}
    </Card>
  );
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

/**
 * A scrolling page with pull to refresh, which keeps the focused field above the keyboard (Android 15 draws apps edge
 * to edge, so the window no longer shrinks for it). Tab pages have no native header: give them `title` (and
 * `actions`) for a large title under the status bar.
 */
export function Page({ children, onRefresh, refreshing = false, style, title, subtitle, actions, ...p }: ScrollViewProps & {
  onRefresh?: () => void; refreshing?: boolean; title?: string; subtitle?: string; actions?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const content = [{ padding: space.lg, gap: space.xl, paddingBottom: space.xxxl, paddingTop: title ? insets.top + space.md : space.lg }, style];
  const header = title ? (
    <View style={s.pageHead}>
      <View style={{ flex: 1, gap: 2 }}>
        {!!subtitle && <Text variant="caption" tone="secondary">{subtitle}</Text>}
        <Text variant="title" accessibilityRole="header" numberOfLines={2}>{title}</Text>
      </View>
      {actions}
    </View>
  ) : null;
  const refresh = onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.card} progressViewOffset={title ? insets.top : 0} /> : undefined;
  const common = { ...p, style: { flex: 1, backgroundColor: colors.background }, keyboardShouldPersistTaps: 'handled' as const, contentContainerStyle: content, refreshControl: refresh };
  if (Platform.OS === 'web') return <ScrollView {...common}>{header}{children}</ScrollView>;
  return <KeyboardAwareScrollView {...common} bottomOffset={space.xxl}>{header}{children}</KeyboardAwareScrollView>;
}

export function Pill({ children, onPress, ...p }: PressableProps & { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Pressable {...p} onPress={onPress} style={({ pressed }) => [s.chip, { backgroundColor: pressed ? colors.cardPressed : colors.card, borderColor: colors.border }]}>{children}</Pressable>;
}

const s = StyleSheet.create({
  buttonClip: { borderRadius: radius.pill, overflow: 'hidden', minHeight: 48 },
  button: { minHeight: 48, borderRadius: radius.pill, paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, flexGrow: 1 },
  buttonCompact: { minHeight: 44, paddingHorizontal: space.lg },
  iconButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  dotBadge: { position: 'absolute', top: 6, right: 4, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  dotBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  card: { borderRadius: radius.lg, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 12, elevation: 1, overflow: 'hidden' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs, minHeight: 24 },
  sectionTitle: { letterSpacing: 0.4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, minHeight: 56 },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: space.md },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingRight: space.lg, minHeight: 56 },
  badge: { borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 3, alignSelf: 'flex-start' },
  input: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: space.md, borderWidth: 1.5 },
  chipClip: { borderRadius: radius.pill, overflow: 'hidden' },
  chip: { minHeight: 40, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.xs },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: -space.sm },
});
