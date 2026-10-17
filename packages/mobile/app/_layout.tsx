import * as React from 'react';
import { AppState, Platform } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/auth/auth';
import { AppLockProvider } from '@/auth/lock';
import { ToastProvider } from '@/ui/overlays';
import { useTheme } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: true } },
});
// "window focus" on a phone is the app coming back to the foreground
if (Platform.OS !== 'web') AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));

function Routes() {
  const { status } = useAuth();
  const { colors, dark } = useTheme();
  React.useEffect(() => { void SystemUI.setBackgroundColorAsync(colors.background); }, [colors.background]);
  React.useEffect(() => { if (status !== 'loading') void SplashScreen.hideAsync().catch(() => undefined); }, [status]);
  if (status === 'loading') return null;
  const signedIn = status === 'authenticated';
  return (
    <AppLockProvider active={signedIn}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </AppLockProvider>
  );
}

/** Keyboard insets for edge-to-edge Android (the browser preview has no native keyboard module). */
const Keyboard = ({ children }: { children: React.ReactNode }) => (Platform.OS === 'web' ? <>{children}</> : <KeyboardProvider>{children}</KeyboardProvider>);

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Keyboard>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <AuthProvider>
                <Routes />
              </AuthProvider>
            </ToastProvider>
          </QueryClientProvider>
        </Keyboard>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// a screen that throws shows a retry instead of a blank page
export { ScreenError as ErrorBoundary } from '@/ui/error-boundary';
