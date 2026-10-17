import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Switch, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePunch, usePunchStatus } from './queries';
import { currentPosition, takeSelfie } from './device';
import { formatTime } from '@/lib/format';
import { Text } from '@/ui/kit';
import { ProgressRing, SuccessPop } from '@/ui/visual';
import { radius, space, useTheme } from '@/ui/theme';

/** A working day for the ring: 9 hours fills it (the ring shows progress, the text the exact time). */
const DAY_SECONDS = 9 * 3600;
const hhmm = (s: number) => `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;

/**
 * Check in / out: a ring of today's worked time, the live timer, the phone's location (geo-fenced offices) and an
 * optional selfie. `hero` draws it on the cobalt Home header; otherwise on a card.
 */
export function PunchCard({ hero }: { hero?: boolean }) {
  const { colors } = useTheme();
  const narrow = useWindowDimensions().width < 380;
  const status = usePunchStatus();
  const punch = usePunch();
  const [selfie, setSelfie] = React.useState(false);
  const [step, setStep] = React.useState<'locating' | 'camera' | null>(null);
  const [done, setDone] = React.useState(false);
  const s = status.data;
  const elapsed = useElapsed(s?.elapsedSeconds ?? 0, !!s?.checkedIn);

  const onPunch = async () => {
    let photo: string | null = null;
    if (selfie) {
      setStep('camera');
      photo = await takeSelfie().catch(() => null);
      setStep(null);
      if (!photo) return;
    }
    setStep('locating');
    const pos = await currentPosition();
    setStep(null);
    punch.mutate({ ...(pos ?? {}), source: 'MOBILE', ...(photo ? { selfie: photo } : {}) }, {
      onSuccess: () => { setDone(true); setTimeout(() => setDone(false), 1400); },
    });
  };

  const fg = hero ? colors.onBrand : colors.text;
  const muted = hero ? colors.onBrandMuted : colors.textSecondary;
  const ringColor = hero ? colors.ice : colors.primary;
  const track = hero ? 'rgba(255,255,255,0.16)' : colors.divider;
  const lastOut = s && !s.checkedIn && s.lastPunch?.type === 'OUT' ? s.lastPunch.time : null;
  const headline = s?.checkedIn ? `In since ${formatTime(s.firstIn)}` : lastOut ? `Out at ${formatTime(lastOut)}` : 'Not checked in yet';
  const busy = punch.isPending || !!step;
  const label = step === 'locating' ? 'Locating…' : step === 'camera' ? 'Opening camera…' : s?.checkedIn ? 'Check out' : 'Check in';

  return (
    <View style={[styles.wrap, narrow && { gap: space.lg }, !hero && { backgroundColor: colors.card, borderRadius: radius.lg, padding: space.lg }]}>
      <ProgressRing size={narrow ? 104 : 128} stroke={narrow ? 8 : 10} progress={elapsed / DAY_SECONDS} color={ringColor} track={track}>
        <Text variant={narrow ? 'heading' : 'title'} num style={{ color: fg }} accessibilityLabel={`${Math.floor(elapsed / 3600)} hours ${Math.floor((elapsed % 3600) / 60)} minutes worked today`}>{hhmm(elapsed)}</Text>
        <Text variant="caption" style={{ color: muted }}>hours today</Text>
        <SuccessPop visible={done} color={colors.success} />
      </ProgressRing>
      <View style={{ flex: 1, gap: space.md }}>
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={[styles.dot, { backgroundColor: s?.checkedIn ? (hero ? colors.ice : colors.success) : muted }]} />
            <Text bold style={{ color: fg, flexShrink: 1 }} numberOfLines={2}>{status.isLoading ? 'Checking…' : headline}</Text>
          </View>
          {s?.attendance?.lateEntry && <Text variant="caption" style={{ color: hero ? colors.ice : colors.warning }}>Marked late today</Text>}
        </View>
        <Pressable
          onPress={() => void onPunch()} disabled={busy || status.isLoading} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy }}
          android_ripple={Platform.OS === 'android' ? { color: hero ? colors.primarySoft : 'rgba(255,255,255,0.25)', foreground: true } : undefined}
          style={({ pressed }) => [styles.cta, { backgroundColor: hero ? colors.onBrand : colors.primary, opacity: busy ? 0.75 : Platform.OS !== 'android' && pressed ? 0.85 : 1 }]}
        >
          {busy ? <ActivityIndicator color={hero ? colors.brand : colors.primaryText} /> : <Ionicons name={s?.checkedIn ? 'log-out-outline' : 'finger-print'} size={20} color={hero ? colors.brand : colors.primaryText} />}
          <Text bold style={{ color: hero ? colors.brand : colors.primaryText }}>{label}</Text>
        </Pressable>
        <View style={styles.selfie}>
          <Ionicons name="camera-outline" size={16} color={muted} />
          <Text variant="caption" style={{ color: muted, flex: 1 }} numberOfLines={1}>{narrow ? 'Selfie' : 'Add a selfie'}</Text>
          <Switch value={selfie} onValueChange={setSelfie} accessibilityLabel="Add a selfie" trackColor={{ true: hero ? colors.ice : colors.primary, false: hero ? 'rgba(255,255,255,0.25)' : colors.border }} thumbColor="#FFFFFF" style={{ transform: [{ scale: 0.85 }] }} />
        </View>
      </View>
    </View>
  );
}

/** Seconds worked so far, ticking each second while checked in (only the panel re-renders). */
function useElapsed(base: number, running: boolean) {
  const [extra, setExtra] = React.useState(0);
  React.useEffect(() => {
    setExtra(0);
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => setExtra(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [base, running]);
  return base + extra;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cta: { minHeight: 48, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, overflow: 'hidden' },
  selfie: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: -space.xs },
});
