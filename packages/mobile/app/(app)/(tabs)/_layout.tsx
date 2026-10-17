import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, isApprover } from '@/auth/auth';
import { useEss, useNotifications } from '@/features/queries';
import { type, useTheme } from '@/ui/theme';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
const icon = (on: Icon, off: Icon) => ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? on : off} size={24} color={color as string} />;

/** Five tabs: the daily things first. Approvals and the rest live under More (with a count on its badge). */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const ess = useEss();
  const notes = useNotifications();
  const pending = (isApprover(user) ? ess.data?.pendingApprovals?.total ?? 0 : 0) + (notes.data?.unreadCount ?? 0);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { ...type.heading, color: colors.text },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerTitle: 'JantaHR', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarIcon: icon('time', 'time-outline') }} />
      <Tabs.Screen name="leave" options={{ title: 'Leave', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="payslips" options={{ title: 'Payslips', tabBarIcon: icon('wallet', 'wallet-outline') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('grid', 'grid-outline'), tabBarBadge: pending ? (pending > 99 ? '99+' : pending) : undefined, tabBarBadgeStyle: { backgroundColor: colors.danger } }} />
    </Tabs>
  );
}
