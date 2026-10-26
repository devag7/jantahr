import * as React from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { screenFor } from '@/lib/nav';

/**
 * Push notifications on Android: the server sends every in-app notification to the phones registered here (FCM).
 * The app asks for permission only when the person chooses to turn them on, never at launch.
 */
const supported = Platform.OS === 'android';
const TOKEN_KEY = 'jantahr.push.token';
const OFF_KEY = 'jantahr.push.off';
const PROMPT_KEY = 'jantahr.push.prompted';

export type PushState = 'unsupported' | 'on' | 'off' | 'ask' | 'blocked';

if (supported) {
  // shown as a banner even while the app is open: it is news the person would want either way
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

const read = (key: string) => SecureStore.getItemAsync(key).catch(() => null);
const write = (key: string, value: string | null) => (value === null ? SecureStore.deleteItemAsync(key) : SecureStore.setItemAsync(key, value)).catch(() => undefined);

/** Android 13+ shows the permission prompt only once a channel exists, so it is created first. */
const channel = () => Notifications.setNotificationChannelAsync('updates', {
  name: 'Updates', description: 'Approvals, decisions on your requests and payslips',
  importance: Notifications.AndroidImportance.HIGH, lightColor: '#2350E8',
});

export async function pushState(): Promise<PushState> {
  if (!supported) return 'unsupported';
  const p = await Notifications.getPermissionsAsync();
  if (p.granted) return (await read(OFF_KEY)) ? 'off' : 'on';
  return p.canAskAgain ? 'ask' : 'blocked';
}

/** Sends this phone's FCM token to the API. False when the build has no Firebase config or the call fails. */
async function register(): Promise<boolean> {
  try {
    await channel();
    const { data } = await Notifications.getDevicePushTokenAsync();
    await api.post('/notifications/devices', { token: String(data), platform: 'android' });
    await write(TOKEN_KEY, String(data));
    return true;
  } catch {
    return false;
  }
}

/** Asks for permission if needed and registers the phone; `registered` is false when the server could not be told. */
export async function turnOnPush(): Promise<{ state: PushState; registered: boolean }> {
  if (!supported) return { state: 'unsupported', registered: false };
  await write(OFF_KEY, null);
  await channel();
  const p = await Notifications.requestPermissionsAsync();
  if (!p.granted) return { state: p.canAskAgain ? 'ask' : 'blocked', registered: false };
  return { state: 'on', registered: await register() };
}

/** Stops pushes to this phone (the permission itself can only be withdrawn in Android settings). */
export async function turnOffPush() {
  await write(OFF_KEY, '1');
  await forgetDevice();
}

/** On sign-out: the server stops sending this account's notifications to this phone. */
export async function forgetDevice() {
  if (!supported) return;
  const token = await read(TOKEN_KEY);
  if (!token) return;
  await api.post('/notifications/devices/remove', { token }).catch(() => undefined);
  await write(TOKEN_KEY, null);
}

/** Whether the Home prompt to turn notifications on was already answered (or dismissed). */
export const pushPrompted = async () => !!(await read(PROMPT_KEY));
export const markPushPrompted = () => write(PROMPT_KEY, '1');

/**
 * For the signed-in app: keeps the phone registered (tokens rotate), opens the right screen when a notification is
 * tapped (also when the tap started the app) and refreshes the lists when one arrives while the app is open.
 */
export function usePushNotifications() {
  const qc = useQueryClient();
  React.useEffect(() => {
    if (!supported) return;
    void pushState().then((s) => { if (s === 'on') void register(); });
    const open = (r: Notifications.NotificationResponse | null) => {
      if (!r) return;
      const link = r.notification.request.content.data?.link;
      const id = r.notification.request.content.data?.id;
      if (typeof id === 'string' && id) void api.patch(`/notifications/${id}/read`).catch(() => undefined);
      router.push((screenFor(typeof link === 'string' ? link : null) ?? '/notifications') as never);
      void Notifications.clearLastNotificationResponseAsync();
    };
    void Notifications.getLastNotificationResponseAsync().then(open);
    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    const arrived = Notifications.addNotificationReceivedListener(() => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['ess'] });
    });
    const rotated = Notifications.addPushTokenListener(() => void register());
    return () => { tapped.remove(); arrived.remove(); rotated.remove(); };
  }, [qc]);
}
