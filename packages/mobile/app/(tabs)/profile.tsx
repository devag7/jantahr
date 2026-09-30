import * as React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAuth } from '@/auth';
import { PrivacyCard } from '@/privacy';
import { Body, Button, Card, Heading, Muted, humanize, useTheme } from '@/theme';

export default function Profile() {
  const t = useTheme();
  const { user, logout } = useAuth();
  if (!user) return null;
  const rows: [string, string | undefined][] = [['Name', user.employee?.fullName], ['Employee ID', user.employee?.employeeCode], ['Designation', user.employee?.designation?.name], ['Department', user.employee?.department?.name], ['Email', user.email], ['Role', humanize(user.role)], ['Company', user.company.name]];
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      <Heading>My profile</Heading>
      <Card style={{ paddingVertical: 4 }}>{rows.map(([l, v], i) => <View key={l} style={{ paddingVertical: 10, borderTopWidth: i ? StyleSheet.hairlineWidth : 0, borderTopColor: t.border }}><Muted>{l}</Muted><Body>{v || '-'}</Body></View>)}</Card>
      <PrivacyCard />
      <Button title="Sign out" variant="outline" onPress={logout} />
    </ScrollView>
  );
}
