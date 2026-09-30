'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/common/modal';
import { PageHeader } from '@/components/common/page-header';
import { EmployeeForm } from '@/components/employees/employee-form';
import { useCreateEmployee } from '@/hooks/employees/use-employees';
import type { Employee } from '@/types/employees';

export default function NewEmployeePage() {
  const router = useRouter();
  const create = useCreateEmployee();
  const [done, setDone] = React.useState<Employee | null>(null);
  return (
    <>
      <PageHeader title="Add employee" description="Creates the record, a login, leave allocation and onboarding checklist." />
      <EmployeeForm mode="create" submitting={create.isPending} onCancel={() => router.push('/hr/employees')} onSubmit={(d) => create.mutate(d, { onSuccess: setDone })} />
      <Modal open={!!done} onOpenChange={(o) => !o && router.push('/hr/employees')} size="sm" title="Employee created" description={done ? `${done.fullName} (${done.employeeCode})` : ''}
        footer={done && <><Button variant="outline" onClick={() => router.push('/hr/employees')}>Back to list</Button><Button asChild><Link href={`/hr/employees/${done.id}`}>Open profile</Link></Button></>}>
        {done?.temporaryPassword && (
          <div className="space-y-3 text-caption"><p className="flex items-center gap-2 text-success"><CheckCircle2 className="h-4 w-4" />Login created. Share this temporary password securely: they must change it at first sign-in.</p>
            <div className="flex items-center justify-between rounded-md bg-muted p-3"><div><p className="text-fine text-muted-foreground">{done.email}</p><p className="font-mono text-body font-semibold">{done.temporaryPassword}</p></div><Button variant="outline" size="icon" aria-label="Copy password" onClick={() => { navigator.clipboard.writeText(done.temporaryPassword ?? ''); toast.success('Copied'); }}><Copy className="h-4 w-4" /></Button></div>
            <p className="text-fine text-muted-foreground">Next: assign a salary structure under Payroll → Salary setup so they appear in payroll.</p></div>
        )}
      </Modal>
    </>
  );
}
