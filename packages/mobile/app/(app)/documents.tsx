import * as React from 'react';
import { useAuth } from '@/auth/auth';
import { useMyDocuments } from '@/features/queries';
import { errorMessage } from '@/lib/api';
import { openFile } from '@/lib/files';
import { formatDate } from '@/lib/format';
import { Badge, Card, EmptyState, ErrorState, Loading, Page, Row } from '@/ui/kit';
import { useToast } from '@/ui/overlays';

/** Offer letter, ID proofs and the rest HR keeps on file; tap one to open or share it. */
export default function Documents() {
  const { user } = useAuth();
  const q = useMyDocuments(user?.employee?.id);
  const toast = useToast();
  const [opening, setOpening] = React.useState<string | null>(null);
  const open = async (id: string, name: string) => {
    setOpening(id);
    try { await openFile(`/employees/documents/${id}/download`, name); } catch (e) { toast(errorMessage(e), 'error'); } finally { setOpening(null); }
  };
  return (
    <Page onRefresh={() => void q.refetch()} refreshing={q.isRefetching}>
      {q.isLoading ? <Loading /> : q.isError ? <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} /> : (q.data?.length ?? 0) === 0 ? (
        <EmptyState icon="document-attach-outline" title="No documents yet" message="Documents your HR team adds to your file show here." />
      ) : (
        <Card padded={false}>
          {q.data!.map((d, i) => (
            <Row key={d.id} icon="document-outline" title={d.documentName} subtitle={`${d.documentType}${d.expiryDate ? ` · expires ${formatDate(d.expiryDate)}` : ''}${opening === d.id ? ' · opening…' : ''}`}
              right={d.verifiedAt ? <Badge label="Verified" tone="success" /> : undefined} onPress={() => void open(d.id, d.documentName)} last={i === q.data!.length - 1} />
          ))}
        </Card>
      )}
    </Page>
  );
}
