import * as React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import { useAuth } from '@/auth';
import { PunchCard } from '@/punch';
import { Body, Card, Heading, Muted, SectionLabel, Title, type, useTheme } from '@/theme';
import type { EssDashboard } from '@/types';

export default function Home() {
  const t = useTheme();
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['ess'], queryFn: () => api<EssDashboard>('/reports/dashboard/ess'), enabled: !!user?.employee });
  if (!user?.employee) return <View style={{ flex: 1, padding: 24, backgroundColor: t.bg }}><Body>No employee profile is linked to this account.</Body></View>;
  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={{ padding: 16, gap: 16 }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} />}>
      <View><Heading>Hi, {user.employee.firstName}</Heading><Muted>{user.employee.designation?.name} · {user.company.name}</Muted></View>
      {q.error && <Text style={{ color: t.danger }}>{(q.error as Error).message}</Text>}
      {q.data && (
        <>
          <PunchCard status={q.data.today} />
          <Card>
            <SectionLabel>This month</SectionLabel>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              {[['Present', q.data.attendanceSummary.present + q.data.attendanceSummary.wfh], ['Absent', q.data.attendanceSummary.absent], ['Late', q.data.attendanceSummary.lateMarks]].map(([l, v]) => (
                <View key={String(l)} style={{ alignItems: 'center', flex: 1 }}><Text style={[type.figure, { color: t.text }]}>{v}</Text><Muted>{l}</Muted></View>
              ))}
            </View>
          </Card>
          <Card>
            <SectionLabel>Leave balance</SectionLabel>
            {q.data.leaveBalances.filter((b) => !b.isLWP).map((b) => (
              <View key={b.leaveTypeId} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}><Body>{b.leaveType}</Body><Body style={{ fontWeight: '600', fontVariant: ['tabular-nums'] }}>{b.available} days</Body></View>
            ))}
          </Card>
          {q.data.announcements.slice(0, 3).map((a) => <Card key={a.id}><Title small>{a.title}</Title><Muted style={{ marginTop: 4 }}>{a.body}</Muted></Card>)}
        </>
      )}
    </ScrollView>
  );
}
