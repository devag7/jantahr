import { NativeTabs } from 'expo-router/native-tabs';
import { isApprover, useAuth } from '@/auth/auth';
import { useEss, useNotifications } from '@/features/queries';
import { font, useTheme } from '@/ui/theme';

/**
 * Android's own bottom navigation bar (Material 3: pill indicator, ripple, native switching), five destinations with
 * icon and label. Approvals and the rest live under More, whose badge counts what waits for this person.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const ess = useEss();
  const notes = useNotifications();
  const pending = (isApprover(user) ? ess.data?.pendingApprovals?.total ?? 0 : 0) + (notes.data?.unreadCount ?? 0);
  return (
    <NativeTabs
      backgroundColor={colors.card}
      indicatorColor={colors.primarySoft}
      rippleColor={colors.primarySoft}
      iconColor={{ default: colors.textSecondary, selected: colors.primary }}
      labelStyle={{ default: { color: colors.textSecondary, fontSize: 12, fontFamily: font.regular }, selected: { color: colors.text, fontSize: 12, fontFamily: font.semibold } }}
      badgeBackgroundColor={colors.danger}
      labelVisibilityMode="labeled"
      backBehavior="initialRoute"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="attendance">
        <NativeTabs.Trigger.Label>Attendance</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="schedule" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="leave">
        <NativeTabs.Trigger.Label>Leave</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="event" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="payslips">
        <NativeTabs.Trigger.Label>Payslips</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="payments" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon md="apps" />
        {pending > 0 && <NativeTabs.Trigger.Badge>{pending > 99 ? '99+' : String(pending)}</NativeTabs.Trigger.Badge>}
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
