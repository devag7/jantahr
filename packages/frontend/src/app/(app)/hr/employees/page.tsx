'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/common/page-header';
import { SearchInput } from '@/components/common/search-input';
import { StatusBadge } from '@/components/common/status-badge';
import { UserAvatar } from '@/components/common/user-avatar';
import { ImportEmployeesModal } from '@/components/employees/import-modal';
import { useAuth } from '@/hooks/auth/use-auth';
import { useEmployees } from '@/hooks/employees/use-employees';
import { useDepartments } from '@/hooks/org/use-org';
import { DEFAULT_PAGE_SIZE } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { ADMIN } from '@/lib/permissions';
import type { EmployeeStatus } from '@/types/employees';

export default function EmployeesPage() {
  const router = useRouter();
  const { hasRole } = useAuth();
  const canEdit = hasRole(ADMIN);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [dept, setDept] = React.useState('');
  const [status, setStatus] = React.useState<EmployeeStatus | ''>('ACTIVE');
  const [imp, setImp] = React.useState(false);
  const depts = useDepartments();
  const q = useEmployees({ page, limit: DEFAULT_PAGE_SIZE, search: search || undefined, departmentId: dept || undefined, status: status || undefined });
  React.useEffect(() => setPage(1), [search, dept, status]);
  return (
    <>
      <PageHeader title="Employees" description="Everyone in the company: profiles, compensation and records."
        actions={canEdit && <><Button variant="outline" onClick={() => setImp(true)}><Upload className="mr-2 h-4 w-4" />Import CSV</Button><Button asChild><Link href="/hr/employees/new"><Plus className="mr-2 h-4 w-4" />Add employee</Link></Button></>} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput onSearch={setSearch} placeholder="Search name, ID or email" className="w-72" />
        <NativeSelect aria-label="Department" className="w-48" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect>
        <NativeSelect aria-label="Status" className="w-40" value={status} onChange={(e) => setStatus(e.target.value as EmployeeStatus | '')}><option value="">All statuses</option>{['ACTIVE', 'INACTIVE', 'SUSPENDED', 'LEFT'].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</NativeSelect>
      </div>
      <DataTable rows={q.data?.items} loading={q.isLoading || q.isFetching} error={q.error} onRetry={() => q.refetch()} rowKey={(e) => e.id} onRowClick={(e) => router.push(`/hr/employees/${e.id}`)} emptyTitle="No employees match" emptyDescription="Adjust the filters or add a new employee."
        page={q.data && { page: q.data.page, totalPages: q.data.totalPages, total: q.data.total, onChange: setPage }}
        columns={[
          { key: 'n', header: 'Employee', cell: (e) => <div className="flex items-center gap-3"><UserAvatar name={e.fullName} /><div className="min-w-0"><p className="truncate font-semibold">{e.fullName}</p><p className="truncate text-fine text-muted-foreground">{e.employeeCode} · {e.email}</p></div></div> },
          { key: 'd', header: 'Department', cell: (e) => e.department?.name ?? '-', hideOnMobile: true },
          { key: 'g', header: 'Designation', cell: (e) => e.designation?.name ?? '-', hideOnMobile: true },
          { key: 'm', header: 'Manager', cell: (e) => (e.reportingManager ? `${e.reportingManager.firstName} ${e.reportingManager.lastName}` : '-'), hideOnMobile: true },
          { key: 'j', header: 'Joined', cell: (e) => formatDate(e.dateOfJoining), hideOnMobile: true },
          { key: 's', header: 'Status', cell: (e) => <StatusBadge status={e.status} /> },
        ]} />
      <ImportEmployeesModal open={imp} onOpenChange={setImp} />
    </>
  );
}
