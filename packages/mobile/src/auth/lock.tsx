import * as React from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '@/ui/kit';
import { space, useTheme } from '@/ui/theme';

const KEY = 'jantahr.app-lock';
/** Unlock is asked again after the app spent this long in the background. */
const GRACE_MS = 60_000;

interface Lock { enabled: boolean; available: boolean; setEnabled: (on: boolean) => Promise<boolean> }
const LockContext = React.createContext<Lock>({ enabled: false, available: false, setEnabled: async () => false });
export const useAppLock = () => React.useContext(LockContext);

/**
 * Optional app lock with the phone's fingerprint, face or screen lock (payslips and personal details live here).
 * Off by default; switched on in Settings, which first checks that the phone can do it.
 */
export function AppLockProvider({ children, active }: { children: React.ReactNode; active: boolean }) {
  const { colors } = useTheme();
  const [enabled, setEnabledState] = React.useState(false);
  const [available, setAvailable] = React.useState(false);
  const [locked, setLocked] = React.useState(false);
  const backgroundedAt = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (Platform.OS === 'web') return;
    void (async () => {
      const on = (await SecureStore.getItemAsync(KEY)) === '1';
      setEnabledState(on);
      setAvailable((await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync()));
      if (on) setLocked(true);
    })();
  }, []);

  React.useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundedAt.current = Date.now();
      if (s === 'active' && enabled && backgroundedAt.current && Date.now() - backgroundedAt.current > GRACE_MS) setLocked(true);
    });
    return () => sub.remove();
  }, [enabled]);

  const unlock = React.useCallback(async () => {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock JantaHR', fallbackLabel: 'Use screen lock' });
    if (r.success) setLocked(false);
  }, []);
  React.useEffect(() => { if (locked && active) void unlock(); }, [locked, active, unlock]);

  const setEnabled = React.useCallback(async (on: boolean) => {
    if (on) {
      const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Turn on app lock' });
      if (!r.success) return false;
    }
    await SecureStore.setItemAsync(KEY, on ? '1' : '0');
    setEnabledState(on);
    return true;
  }, []);

  return (
    <LockContext.Provider value={{ enabled, available, setEnabled }}>
      {children}
      {locked && active && (
        <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: colors.background }]} accessibilityViewIsModal>
          <Ionicons name="lock-closed" size={40} color={colors.primary} />
          <Text variant="heading">JantaHR is locked</Text>
          <Button title="Unlock" icon="finger-print" onPress={() => void unlock()} />
        </View>
      )}
    </LockContext.Provider>
  );
}

const styles = StyleSheet.create({ lock: { alignItems: 'center', justifyContent: 'center', gap: space.lg, zIndex: 10 } });
