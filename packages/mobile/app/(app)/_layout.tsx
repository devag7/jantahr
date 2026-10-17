import { Stack } from 'expo-router';
import { type, useTheme } from '@/ui/theme';

/** Signed-in screens: the tabs, then details and forms pushed over them (forms slide up as sheets). */
export default function AppLayout() {
  const { colors } = useTheme();
  const sheet = { presentation: 'modal' as const, animation: 'slide_from_bottom' as const };
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.primary,
        headerTitleStyle: { ...type.body, fontWeight: '600', color: colors.text },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="apply-leave" options={{ title: 'Apply for leave', ...sheet }} />
      <Stack.Screen name="attendance-request" options={{ title: 'Attendance request', ...sheet }} />
      <Stack.Screen name="comp-off" options={{ title: 'Comp-off', ...sheet }} />
      <Stack.Screen name="expenses/new" options={{ title: 'New expense claim', ...sheet }} />
      <Stack.Screen name="expenses/index" options={{ title: 'Expenses' }} />
      <Stack.Screen name="payslip/[id]" options={{ title: 'Payslip' }} />
      <Stack.Screen name="approvals" options={{ title: 'Approvals' }} />
      <Stack.Screen name="team" options={{ title: 'My team' }} />
      <Stack.Screen name="holidays" options={{ title: 'Holidays' }} />
      <Stack.Screen name="documents" options={{ title: 'My documents' }} />
      <Stack.Screen name="profile" options={{ title: 'Profile' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="policies" options={{ title: 'Policies' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
