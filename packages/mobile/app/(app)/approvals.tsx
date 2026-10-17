import * as React from 'react';
import { View } from 'react-native';
import { useAuth } from '@/auth/auth';
import {
  type Decision, useDecideAttendance, useDecideClaim, useDecideCompOff, useDecideGoal, useDecideLeave, useDecideSeparation, useDecideTravel, useHasFeature,
  usePendingAttendance, usePendingClaims, usePendingCompOff, usePendingGoals, usePendingLeave, usePendingSeparations, usePendingTravel,
} from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDate, formatINR, plural } from '@/lib/format';
import { Badge, Button, Card, EmptyState, ErrorState, Field, Page, Segmented, SkeletonCard, Text } from '@/ui/kit';
import { Sheet } from '@/ui/overlays';
import { Avatar } from '@/ui/visual';
import { radius, space, useTheme } from '@/ui/theme';

type Kind = 'leave' | 'attendance' | 'expenses' | 'travel' | 'comp' | 'goals' | 'resignations';
interface Item { id: string; who: { firstName: string; lastName: string; employeeCode: string }; title: string; detail: string; note?: string | null; tag?: string }
const range = (a: string, b: string) => `${formatDate(a)}${b && b.slice(0, 10) !== a.slice(0, 10) ? ` to ${formatDate(b)}` : ''}`;
const REQ = { REGULARIZE: 'Attendance correction', ON_DUTY: 'On duty', WFH: 'Work from home' } as const;

/** Everything waiting for this person's decision, one kind at a time. Reject asks for a reason the requester sees. */
export default function Approvals() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const has = { expenses: useHasFeature('expenses'), performance: useHasFeature('performance'), lifecycle: useHasFeature('lifecycle') };
  // decided items leave the list at once; one comes back only if the API refuses the decision
  const [decidedIds, setDecidedIds] = React.useState<Set<string>>(new Set());
  const q = {
    leave: usePendingLeave(true), attendance: usePendingAttendance(true), expenses: usePendingClaims(has.expenses), travel: usePendingTravel(has.expenses),
    comp: usePendingCompOff(true), goals: usePendingGoals(has.performance), resignations: usePendingSeparations(has.lifecycle, user?.employee?.id),
  };
  const act = {
    leave: useDecideLeave(), attendance: useDecideAttendance(), expenses: useDecideClaim(), travel: useDecideTravel(), comp: useDecideCompOff(), goals: useDecideGoal(), resignations: useDecideSeparation(),
  };

  const all: Record<Kind, Item[]> = {
    leave: (q.leave.data ?? []).map((l) => ({ id: l.id, who: l.employee, title: `${l.leaveType.name} · ${plural(l.totalLeaveDays, 'day')}`, detail: range(l.fromDate, l.toDate), note: l.reason, tag: l.leaveType.isLWP ? 'Unpaid' : undefined })),
    attendance: (q.attendance.data ?? []).map((r) => ({ id: r.id, who: r.employee, title: `${REQ[r.requestType]}${r.halfDay ? ' · half day' : ''}`, detail: range(r.fromDate, r.toDate), note: r.reason })),
    expenses: (q.expenses.data ?? []).map((c) => ({ id: c.id, who: c.employee, title: `${c.title} · ${formatINR(c.totalClaimed)}`, detail: `${plural(c.items.length, 'item')}${c.submittedAt ? ` · submitted ${formatDate(c.submittedAt)}` : ''}`, note: c.items.map((i) => `${i.category}: ${formatINR(i.amount)}`).join('\n') })),
    travel: (q.travel.data ?? []).map((t) => ({ id: t.id, who: t.employee, title: `${t.fromLocation} to ${t.toLocation}`, detail: `${range(t.departureDate, t.returnDate)}${t.estimatedCost ? ` · about ${formatINR(t.estimatedCost)}` : ''}`, note: t.purpose })),
    comp: (q.comp.data ?? []).map((c) => ({ id: c.id, who: c.employee, title: `Comp-off${c.halfDay ? ' · half day' : ''}`, detail: `Worked ${range(c.workFromDate, c.workEndDate)}`, note: c.reason })),
    goals: (q.goals.data ?? []).map((g) => ({ id: g.id, who: g.employee, title: g.title, detail: `Weight ${g.weightage}%${g.targetValue ? ` · target ${g.targetValue}` : ''} · ${range(g.startDate, g.endDate)}`, note: g.description })),
    resignations: (q.resignations.data ?? []).map((s) => ({ id: s.id, who: s.employee, title: s.separationType === 'RESIGNATION' ? 'Resignation' : s.separationType.charAt(0) + s.separationType.slice(1).toLowerCase(), detail: `Resigned ${formatDate(s.resignationDate)} · last day ${formatDate(s.lastWorkingDate)} · notice ${s.noticePeriodDays} days` })),
  };
  const items = Object.fromEntries(Object.entries(all).map(([k, list]) => [k, list.filter((i) => !decidedIds.has(i.id))])) as Record<Kind, Item[]>;
  const tabs: { value: Kind; label: string; on: boolean }[] = [
    { value: 'leave', label: 'Leave', on: true }, { value: 'attendance', label: 'Attendance', on: true }, { value: 'expenses', label: 'Expenses', on: has.expenses },
    { value: 'travel', label: 'Travel', on: has.expenses }, { value: 'comp', label: 'Comp-off', on: true }, { value: 'goals', label: 'Goals', on: has.performance },
    { value: 'resignations', label: 'Resignations', on: has.lifecycle },
  ];
  const visible = tabs.filter((t) => t.on);
  const firstWithItems = visible.find((t) => items[t.value].length)?.value ?? 'leave';
  const [kind, setKind] = React.useState<Kind | null>(null);
  const current = kind ?? firstWithItems;
  const query = q[current];
  const [rejecting, setRejecting] = React.useState<Item | null>(null);
  const [comment, setComment] = React.useState('');

  const decide = (item: Item, decision: Decision, note?: string) => {
    setDecidedIds((s) => new Set(s).add(item.id));
    setRejecting(null);
    setComment('');
    act[current].mutate({ id: item.id, decision, comment: note }, { onError: () => setDecidedIds((s) => { const n = new Set(s); n.delete(item.id); return n; }) });
  };
  const refreshAll = () => Object.values(q).forEach((x) => void x.refetch());

  return (
    <Page onRefresh={refreshAll} refreshing={Object.values(q).some((x) => x.isRefetching)}>
      <Segmented value={current} onChange={setKind} options={visible.map((t) => ({ value: t.value, label: t.label, count: items[t.value].length }))} />
      {query.isLoading ? <SkeletonCard rows={2} /> : query.isError ? <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} /> : items[current].length === 0 ? (
        <EmptyState icon="checkmark-done-circle-outline" title="All caught up" message="Nothing is waiting for you here. New requests show up as they come in." />
      ) : (
        items[current].map((item) => (
          <Card key={item.id} style={{ gap: space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Avatar name={`${item.who.firstName} ${item.who.lastName}`} size={44} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text bold numberOfLines={1}>{item.who.firstName} {item.who.lastName}</Text>
                <Text variant="caption" tone="tertiary">{item.who.employeeCode}</Text>
              </View>
              {item.tag && <Badge label={item.tag} tone="warning" />}
            </View>
            <View style={{ gap: 2 }}>
              <Text variant="heading">{item.title}</Text>
              <Text tone="secondary">{item.detail}</Text>
            </View>
            {!!item.note && (
              <View style={{ backgroundColor: colors.raised, borderRadius: radius.md, padding: space.md }}>
                <Text variant="caption" tone="secondary">{item.note}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button title="Reject" kind="danger" compact style={{ flex: 1 }} onPress={() => setRejecting(item)} />
              <Button title="Approve" compact style={{ flex: 1 }} onPress={() => decide(item, 'approve')} />
            </View>
          </Card>
        ))
      )}
      <Sheet open={!!rejecting} onClose={() => setRejecting(null)} title="Reject this request?">
        <Text tone="secondary">{rejecting ? `${rejecting.who.firstName}'s ${rejecting.title.toLowerCase()}` : ''}</Text>
        <Field label="Reason (shown to them)" value={comment} onChangeText={setComment} multiline maxLength={300} placeholder="Team is short that week; please pick other dates" autoFocus />
        <Button title="Reject" kind="danger" onPress={() => rejecting && decide(rejecting, 'reject', comment.trim() || undefined)} />
      </Sheet>
    </Page>
  );
}
