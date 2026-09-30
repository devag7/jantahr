'use client';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { EssDashboard } from '@/components/dashboard/ess-dashboard';
import { PageHeader } from '@/components/common/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/auth/use-auth';
import { READ_ALL } from '@/lib/permissions';

export default function DashboardPage() {
  const { user, hasRole } = useAuth();
  const backOffice = hasRole(READ_ALL);
  const greeting = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <PageHeader title={`${greeting}, ${user?.employee?.firstName ?? 'there'}`} description={[user?.employee?.designation?.name, user?.employee?.department?.name, user?.employee?.employeeCode].filter(Boolean).join(' · ') || undefined} />
      {backOffice ? (
        <Tabs defaultValue="company">
          <TabsList><TabsTrigger value="company">Company overview</TabsTrigger>{user?.employee && <TabsTrigger value="me">My day</TabsTrigger>}</TabsList>
          <TabsContent value="company" className="mt-4"><AdminDashboard /></TabsContent>
          {user?.employee && <TabsContent value="me" className="mt-4"><EssDashboard /></TabsContent>}
        </Tabs>
      ) : <EssDashboard />}
    </>
  );
}
