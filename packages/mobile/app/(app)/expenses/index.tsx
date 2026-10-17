import * as React from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { useDeleteClaim, useMyClaims, useSubmitClaim } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDate, formatINR, plural } from '@/lib/format';
import { Button, Card, EmptyState, ErrorState, Loading, Page, StatusBadge, Text } from '@/ui/kit';
import { space } from '@/ui/theme';
import type { ExpenseClaim } from '@/types/expenses';

/** Your claims and where each one is: draft, with your manager, approved, paid. */
export default function Expenses() {
  const q = useMyClaims();
  const submit = useSubmitClaim();
  const remove = useDeleteClaim();
  const confirmDelete = (c: ExpenseClaim) => Alert.alert('Delete this draft?', c.title, [{ text: 'Keep', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(c.id) }]);
  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      <Button title="New claim" icon="add" onPress={() => router.push('/expenses/new')} />
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : (q.data?.length ?? 0) === 0 ? (
        <EmptyState icon="receipt-outline" title="No claims yet" message="Add your travel, food or other work spends with a photo of the receipt." />
      ) : q.data!.map((c) => (
        <Card key={c.id} style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text bold style={{ flex: 1 }}>{c.title}</Text>
            <StatusBadge status={c.status} />
          </View>
          <Text tone="secondary">{plural(c.items.length, 'item')} · {formatINR(c.totalClaimed)} claimed{c.status === 'APPROVED' || c.status === 'REIMBURSED' ? ` · ${formatINR(c.totalApproved)} approved` : ''}</Text>
          <Text variant="caption" tone="tertiary">{c.submittedAt ? `Submitted ${formatDate(c.submittedAt)}` : `Created ${formatDate(c.createdAt)}`}</Text>
          {!!c.approverComment && <Text variant="caption" tone="secondary" style={{ fontStyle: 'italic' }}>“{c.approverComment}”</Text>}
          {c.status === 'DRAFT' && (
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <Button title="Delete" kind="danger" compact style={{ flex: 1 }} onPress={() => confirmDelete(c)} />
              <Button title="Submit" compact style={{ flex: 1 }} loading={submit.isPending && submit.variables === c.id} onPress={() => submit.mutate(c.id)} />
            </View>
          )}
        </Card>
      ))}
    </Page>
  );
}
