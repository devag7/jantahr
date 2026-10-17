import * as React from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { Text, type IconName } from './kit';
import { personHue, radius, space, useTheme } from './theme';
import { initials } from '@/lib/format';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const easeOut = Easing.bezier(0.25, 1, 0.5, 1);

/** A person as initials on a calm tint that stays the same for the same name. */
export function Avatar({ name, size = 40, style }: { name: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const { bg, fg } = personHue(name);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, style]} accessibilityElementsHidden importantForAccessibility="no">
      <Text bold style={{ color: fg, fontSize: size * 0.38, lineHeight: size * 0.46 }}>{initials(name)}</Text>
    </View>
  );
}

/** Overlapping avatars with a "+n" when there are more. */
export function AvatarStack({ names, size = 28, max = 4, ring }: { names: string[]; size?: number; max?: number; ring: string }) {
  const shown = names.slice(0, max);
  return (
    <View style={{ flexDirection: 'row' }}>
      {shown.map((n, i) => <Avatar key={`${n}-${i}`} name={n} size={size} style={{ marginLeft: i ? -size * 0.3 : 0, borderWidth: 2, borderColor: ring }} />)}
      {names.length > max && (
        <View style={{ width: size, height: size, borderRadius: size / 2, marginLeft: -size * 0.3, backgroundColor: ring, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="caption" bold>+{names.length - max}</Text>
        </View>
      )}
    </View>
  );
}

/** A ring that fills to `progress` (0..1) with an ease-out when the value changes; children sit in the middle. */
export function ProgressRing({ size, stroke, progress, color, track, children }: {
  size: number; stroke: number; progress: number; color: string; track: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  React.useEffect(() => { p.value = withTiming(Math.max(0, Math.min(1, progress)), { duration: 700, easing: easeOut }); }, [progress, p]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} animatedProps={animatedProps} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

/** Small bars for a trend (last months' pay): the latest bar in the accent, earlier ones quieter. */
export function MiniBars({ values, color, muted, height = 48, labels }: { values: number[]; color: string; muted: string; height?: number; labels?: string[] }) {
  const max = Math.max(...values, 1);
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height }}>
        {values.map((v, i) => <Bar key={i} h={Math.max(4, (v / max) * height)} color={i === values.length - 1 ? color : muted} delay={i * 40} />)}
      </View>
      {labels && <View style={{ flexDirection: 'row', gap: 6 }}>{labels.map((l, i) => <Text key={i} variant="caption" tone="tertiary" style={{ flex: 1, textAlign: 'center', fontSize: 11 }}>{l}</Text>)}</View>}
    </View>
  );
}
function Bar({ h, color, delay }: { h: number; color: string; delay: number }) {
  const s = useSharedValue(0);
  React.useEffect(() => { s.value = withDelay(delay, withTiming(1, { duration: 450, easing: easeOut })); }, [s, delay]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
  return <Animated.View style={[{ flex: 1, height: h, borderRadius: 6, backgroundColor: color, transformOrigin: 'bottom' }, style]} />;
}

/** An icon in a soft tint of its colour. */
export function IconTile({ icon, color, size = 44 }: { icon: IconName; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color + '1F', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

/** One of the shortcuts under the Home hero: a tinted icon and a short label. */
export function QuickAction({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      android_ripple={Platform.OS === 'android' ? { color: colors.cardPressed, borderless: false, foreground: true } : undefined}
      style={({ pressed }) => [styles.quick, { opacity: Platform.OS !== 'android' && pressed ? 0.7 : 1 }]}>
      <IconTile icon={icon} color={color} size={52} />
      <Text variant="caption" style={{ textAlign: 'center' }} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

/** A short check-mark pop for a finished action (check-in, leave applied): springs in, then settles. */
export function SuccessPop({ visible, color }: { visible: boolean; color: string }) {
  const s = useSharedValue(0);
  React.useEffect(() => { s.value = visible ? withSpring(1, { damping: 14, stiffness: 220 }) : withTiming(0, { duration: 150 }); }, [visible, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: s.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.pop, { backgroundColor: color }, style]}>
      <Ionicons name="checkmark" size={30} color="#FFFFFF" />
    </Animated.View>
  );
}

/** A coloured dot and a word, for legends. */
export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i.color }} />
          <Text variant="caption" tone="secondary">{i.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  quick: { flex: 1, alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderRadius: radius.md, overflow: 'hidden' },
  pop: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', position: 'absolute' },
});
