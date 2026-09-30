import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { LeaveBalance } from '@/types/leave';

export function LeaveBalanceCards({ balances }: { balances: LeaveBalance[] }) {
  const visible = balances.filter((b) => !b.isLWP);
  if (!visible.length) return <p className="text-caption text-muted-foreground">No leave allocated yet.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {visible.map((b) => {
        const pct = b.allocated ? (b.used / b.allocated) * 100 : 0;
        return (
          <Card key={b.leaveTypeId} className="px-4 py-3">
            <p className="text-caption font-semibold">{b.leaveType}</p>
            <p className="mt-1 text-tagline font-semibold leading-tight tabular-nums">{b.available}<span className="ml-1 text-fine font-normal text-muted-foreground">available</span></p>
            <Progress value={pct} className="mt-2 h-1" tone={pct > 85 ? 'warning' : 'primary'} />
            <p className="mt-1.5 text-fine text-muted-foreground">{b.used} used of {b.allocated}{b.pending ? ` · ${b.pending} pending` : ''}{b.carryForwarded ? ` · ${b.carryForwarded} carried` : ''}</p>
          </Card>
        );
      })}
    </div>
  );
}

/** Compact table for dashboards. */
export function LeaveBalanceTable({ balances }: { balances: LeaveBalance[] }) {
  const visible = balances.filter((b) => !b.isLWP);
  if (!visible.length) return <p className="px-4 py-3 text-caption text-muted-foreground">No leave allocated yet.</p>;
  return (
    <div className="overflow-x-auto"><table className="w-full min-w-[420px] text-caption">
      <thead className="bg-table-head text-fine text-muted-foreground"><tr><th className="px-4 py-2 text-left font-semibold">Leave type</th><th className="px-4 py-2 text-right font-semibold">Granted</th><th className="px-4 py-2 text-right font-semibold">Used</th><th className="px-4 py-2 text-right font-semibold">Pending</th><th className="px-4 py-2 text-right font-semibold">Available</th></tr></thead>
      <tbody className="divide-y">
        {visible.map((b) => (
          <tr key={b.leaveTypeId}><td className="px-4 py-2">{b.leaveType}</td><td className="px-4 py-2 text-right tabular-nums">{b.allocated}</td><td className="px-4 py-2 text-right tabular-nums">{b.used}</td><td className="px-4 py-2 text-right tabular-nums">{b.pending || '-'}</td><td className="px-4 py-2 text-right font-semibold tabular-nums">{b.available}</td></tr>
        ))}
      </tbody>
    </table></div>
  );
}
