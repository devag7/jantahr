import * as React from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePunch, usePunchStatus } from './queries';
import { currentPosition, takeSelfie } from './device';
import { formatDuration, formatTime } from '@/lib/format';
import { Badge, Button, Card, StatusBadge, Text } from '@/ui/kit';
import { space, useTheme } from '@/ui/theme';

/** Check in / out: the live work timer, the phone's location (for geo-fenced offices) and an optional selfie. */
export function PunchCard() {
  const { colors } = useTheme();
  const status = usePunchStatus();
  const punch = usePunch();
  const [tick, setTick] = React.useState(0);
  const [selfie, setSelfie] = React.useState(false);
  const [step, setStep] = React.useState<'locating' | 'camera' | null>(null);
  const s = status.data;

  React.useEffect(() => {
    setTick(0);
    if (!s?.checkedIn) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [s?.checkedIn, s?.elapsedSeconds]);

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
    punch.mutate({ ...(pos ?? {}), source: 'MOBILE', ...(photo ? { selfie: photo } : {}) });
  };

  const elapsed = (s?.elapsedSeconds ?? 0) + (s?.checkedIn ? tick : 0);
  const lastOut = s && !s.checkedIn && s.lastPunch?.type === 'OUT' ? s.lastPunch.time : null;
  const busy = punch.isPending || !!step;
  const label = step === 'locating' ? 'Finding your location' : step === 'camera' ? 'Opening the camera' : s?.checkedIn ? 'Check out' : 'Check in';
  return (
    <Card style={{ gap: space.lg }}>
      <View style={styles.head}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <View style={[styles.dot, { backgroundColor: s?.checkedIn ? colors.success : colors.textTertiary }]} />
          <Text bold>{s?.checkedIn ? 'Checked in' : lastOut ? 'Checked out' : 'Not checked in'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.xs }}>
          {s?.attendance?.lateEntry && <Badge label="Late" tone="warning" />}
          {s?.attendance && <StatusBadge status={s.attendance.status} />}
        </View>
      </View>
      <View style={styles.stats}>
        <Stat label="First in" value={s?.firstIn ? formatTime(s.firstIn) : '-'} />
        <Stat label="Last out" value={lastOut ? formatTime(lastOut) : '-'} />
        <Stat label="Hours" value={status.isLoading ? '-' : formatDuration(elapsed).slice(0, 5)} live={s?.checkedIn} />
      </View>
      <Button title={label} icon={s?.checkedIn ? 'log-out-outline' : 'log-in-outline'} kind={s?.checkedIn ? 'secondary' : 'primary'} loading={busy} disabled={status.isLoading} onPress={() => void onPunch()} />
      <View style={styles.selfie}>
        <Ionicons name="camera-outline" size={18} color={colors.textSecondary} />
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>Add a selfie to this {s?.checkedIn ? 'check-out' : 'check-in'}</Text>
        <Switch value={selfie} onValueChange={setSelfie} accessibilityLabel="Add a selfie" trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
      </View>
    </Card>
  );
}

function Stat({ label, value, live }: { label: string; value: string; live?: boolean }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text variant="caption" tone="secondary">{label}</Text>
      <Text variant="heading" num accessibilityLiveRegion={live ? 'none' : undefined}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', gap: space.md },
  selfie: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -space.xs },
});
