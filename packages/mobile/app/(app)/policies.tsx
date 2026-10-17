import * as React from 'react';
import { View } from 'react-native';
import { useAcknowledge, usePolicies } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Badge, Button, Card, EmptyState, ErrorState, Loading, Page, Text } from '@/ui/kit';
import { space } from '@/ui/theme';

/** Company policies to read; the ones you have not acknowledged come first with the button to do it. */
export default function Policies() {
  const q = usePolicies();
  const ack = useAcknowledge();
  const [open, setOpen] = React.useState<string | null>(null);
  const list = (q.data ?? []).filter((p) => p.isActive).sort((a, b) => Number(a.acknowledged) - Number(b.acknowledged));
  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : list.length === 0 ? (
        <EmptyState icon="reader-outline" title="No policies yet" />
      ) : list.map((p) => (
        <Card key={p.id} style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Text bold style={{ flex: 1 }} onPress={() => setOpen(open === p.id ? null : p.id)}>{p.title}</Text>
            <Badge label={p.acknowledged ? 'Read' : 'To read'} tone={p.acknowledged ? 'success' : 'warning'} />
          </View>
          <Text variant="caption" tone="tertiary">{p.category} · version {p.version} · updated {formatDate(p.updatedAt)}</Text>
          <Text tone="secondary" numberOfLines={open === p.id ? undefined : 4} onPress={() => setOpen(open === p.id ? null : p.id)}>{p.content}</Text>
          {open !== p.id && <Text variant="caption" tone="accent" onPress={() => setOpen(p.id)}>Read all</Text>}
          {!p.acknowledged && open === p.id && <Button title="I have read this" compact loading={ack.isPending && ack.variables === p.id} onPress={() => ack.mutate(p.id)} />}
        </Card>
      ))}
    </Page>
  );
}
