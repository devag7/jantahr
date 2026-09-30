'use client';
import { DataTable } from '@/components/common/data-table';
import { usePrivacyOverview } from '@/hooks/privacy/use-privacy';

const LABEL: Record<string, string> = { PRIVACY_NOTICE: 'Privacy notice acknowledged', SELFIE_AT_CHECKIN: 'Selfie at check-in', LOCATION_AT_CHECKIN: 'Location at check-in', AI_ASSISTANT_LLM: 'AI assistant (third-party model)' };

export function ConsentOverview() {
  const q = usePrivacyOverview();
  const rows = q.data ? Object.entries(q.data.consents).map(([purpose, c]) => ({ purpose, ...c })) : undefined;
  return (
    <div className="space-y-2">
      <p className="text-caption text-muted-foreground">Optional uses are on unless an employee has switched them off, and are only enforced from the moment of withdrawal. The notice needs each employee’s acknowledgement.</p>
      <DataTable rows={rows} loading={q.isLoading} error={q.error} rowKey={(r) => r.purpose} emptyTitle="No data"
        columns={[
          { key: 'p', header: 'Purpose', cell: (r) => <span className="font-semibold">{LABEL[r.purpose] ?? r.purpose}</span> },
          { key: 'g', header: 'Granted', cell: (r) => r.GRANTED, align: 'right' },
          { key: 'w', header: 'Withdrawn', cell: (r) => r.WITHDRAWN, align: 'right' },
          { key: 'o', header: 'Outdated', cell: (r) => r.OUTDATED, align: 'right', hideOnMobile: true },
          { key: 'n', header: 'Not yet asked', cell: (r) => r.NOT_ASKED, align: 'right' },
        ]} />
    </div>
  );
}
