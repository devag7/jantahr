import * as React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { type, useTheme } from '@/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (on: IconName, off: IconName) => ({ color, focused, size }: { color: string; focused: boolean; size: number }) => <Ionicons name={focused ? on : off} size={size} color={color} />;

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: t.link, tabBarInactiveTintColor: t.muted,
      tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
      headerStyle: { backgroundColor: t.bg }, headerShadowVisible: false, headerTintColor: t.link,
      headerTitleStyle: { color: t.text, fontSize: type.bodyStrong.fontSize, fontWeight: '600' },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }} />
      <Tabs.Screen name="leave" options={{ title: 'Leave', tabBarIcon: icon('calendar', 'calendar-outline') }} />
      <Tabs.Screen name="payslips" options={{ title: 'Payslips', tabBarIcon: icon('document-text', 'document-text-outline') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle', 'person-circle-outline') }} />
    </Tabs>
  );
}
