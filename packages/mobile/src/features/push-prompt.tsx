import * as React from 'react';
import { View } from 'react-native';
import { markPushPrompted, pushPrompted, pushState, turnOnPush } from './push';
import { Button, Card, Text } from '@/ui/kit';
import { useToast } from '@/ui/overlays';
import { IconTile } from '@/ui/visual';
import { space, useTheme } from '@/ui/theme';

/**
 * A one-time card on Home offering notifications, with what they are for. The system prompt appears only after
 * "Turn on"; "Not now" hides the card for good (Settings keeps the switch).
 */
export function PushPrompt({ manager }: { manager: boolean }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [show, setShow] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    void Promise.all([pushState(), pushPrompted()]).then(([s, asked]) => { if (live) setShow(s === 'ask' && !asked); });
    return () => { live = false; };
  }, []);
  if (!show) return null;

  const done = () => { setShow(false); void markPushPrompted(); };
  const turnOn = async () => {
    setBusy(true);
    const { state, registered } = await turnOnPush();
    setBusy(false);
    done();
    if (state === 'on') toast(registered ? 'Notifications are on' : 'Notifications will start once you are back online', registered ? 'success' : 'error');
  };
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        <IconTile icon="notifications-outline" color={colors.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text bold>Get notified</Text>
          <Text variant="caption" tone="secondary">
            {manager ? 'Know the moment a request needs you, and when your own leave is approved.' : 'Know when your leave is approved, a request is answered or your payslip is ready.'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Button title="Not now" kind="ghost" compact style={{ flex: 1 }} onPress={done} />
        <Button title="Turn on" compact style={{ flex: 1 }} loading={busy} onPress={() => void turnOn()} />
      </View>
    </Card>
  );
}
