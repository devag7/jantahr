'use client';
import * as React from 'react';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/components/common/page-header';
import { QueryBoundary } from '@/components/common/states';
import { SearchInput } from '@/components/common/search-input';
import { UserAvatar } from '@/components/common/user-avatar';
import { useDirectory } from '@/hooks/employees/use-employees';
import { useDepartments } from '@/hooks/org/use-org';

export default function DirectoryPage() {
  const [search, setSearch] = React.useState('');
  const [initial, setInitial] = React.useState<string | undefined>();
  const [dept, setDept] = React.useState('');
  // header search links here with ?q=
  React.useEffect(() => { const q = new URLSearchParams(window.location.search).get('q'); if (q) { setSearch(q); setInitial(q); } }, []);
  const depts = useDepartments();
  const q = useDirectory(search || undefined, dept || undefined);
  return (
    <>
      <PageHeader title="Company directory" description="Find colleagues, their teams and contact details." actions={<><SearchInput key={initial} defaultValue={initial} onSearch={setSearch} placeholder="Search name, ID or email" className="w-64" /><NativeSelect aria-label="Department" className="w-44" value={dept} onChange={(e) => setDept(e.target.value)}><option value="">All departments</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</NativeSelect></>} />
      <QueryBoundary query={q} empty={{ when: (d) => d.length === 0, title: 'No colleagues found', description: 'Try a different search.' }}>
        {(rows) => (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((p) => (
              <Card key={p.id} className="p-4">
                <div className="flex items-start gap-3">
                  <UserAvatar name={p.fullName} className="h-11 w-11" />
                  <div className="min-w-0"><p className="truncate font-semibold">{p.fullName}</p><p className="truncate text-caption text-muted-foreground">{p.designation ?? '-'}</p><p className="truncate text-fine text-muted-foreground">{p.department ?? '-'} · {p.employeeCode}</p></div>
                </div>
                <ul className="mt-3 space-y-1 text-fine text-muted-foreground">
                  <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /><a href={`mailto:${p.email}`} className="truncate hover:text-foreground hover:underline">{p.email}</a></li>
                  {p.phone && <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{p.phone}</li>}
                  {p.workLocation && <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" />{p.workLocation}</li>}
                  {p.manager && <li>Reports to {p.manager}</li>}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </QueryBoundary>
    </>
  );
}
