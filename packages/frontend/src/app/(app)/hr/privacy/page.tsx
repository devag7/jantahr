'use client';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/states';
import { StatCard } from '@/components/common/stat-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminBreaches } from '@/components/privacy/admin-breaches';
import { AdminRequests } from '@/components/privacy/admin-requests';
import { AdminRetention } from '@/components/privacy/admin-retention';
import { ConsentOverview } from '@/components/privacy/consent-overview';
import { useBreaches, usePrivacyRequests, useRetention } from '@/hooks/privacy/use-privacy';

export default function DataProtectionPage() {
  const requests = usePrivacyRequests();
  const breaches = useBreaches();
  const retention = useRetention();
  const open = requests.data?.filter((r) => r.status === 'OPEN' || r.status === 'IN_PROGRESS') ?? [];
  return (
    <>
      <PageHeader title="Data protection" description="DPDP Act 2023: employee requests, breach register, retention and consent." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open requests" value={open.length} tone={open.length ? 'warning' : 'default'} />
        <StatCard label="Overdue" value={open.filter((r) => r.overdue).length} tone={open.some((r) => r.overdue) ? 'destructive' : 'default'} />
        <StatCard label="Open breaches" value={breaches.data?.filter((b) => b.status !== 'CLOSED').length ?? 0} tone={breaches.data?.some((b) => b.status !== 'CLOSED') ? 'destructive' : 'default'} />
        <StatCard label="Ready to anonymise" value={retention.data?.summary.pendingFull ?? 0} tone={retention.data?.summary.pendingFull ? 'warning' : 'default'} />
      </div>
      <Tabs defaultValue="requests">
        <TabsList><TabsTrigger value="requests">Requests</TabsTrigger><TabsTrigger value="breaches">Breaches</TabsTrigger><TabsTrigger value="retention">Retention & erasure</TabsTrigger><TabsTrigger value="consent">Consent</TabsTrigger></TabsList>
        <TabsContent value="requests" className="mt-4"><AdminRequests /></TabsContent>
        <TabsContent value="breaches" className="mt-4"><AdminBreaches /></TabsContent>
        <TabsContent value="retention" className="mt-4"><AdminRetention /></TabsContent>
        <TabsContent value="consent" className="mt-4"><ConsentOverview /></TabsContent>
      </Tabs>
    </>
  );
}
