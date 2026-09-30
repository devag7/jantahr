import Link from 'next/link';
import { CalendarPlus, Clock, FilePenLine, HelpCircle, Receipt, Wallet, type LucideIcon } from 'lucide-react';

const LINKS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: 'Apply leave', href: '/me/leave', icon: CalendarPlus },
  { label: 'Attendance', href: '/me/attendance', icon: Clock },
  { label: 'Payslips', href: '/me/payslips', icon: Wallet },
  { label: 'IT declaration', href: '/me/tax', icon: FilePenLine },
  { label: 'Claim expense', href: '/me/expenses', icon: Receipt },
  { label: 'Raise a ticket', href: '/me/helpdesk', icon: HelpCircle },
];

/** "Quick access" strip found on greytHR / Zoho People home pages. */
export function QuickLinks() {
  return (
    <nav aria-label="Quick access" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="flex flex-col items-center gap-1.5 rounded-md border bg-card px-2 py-3 text-center text-caption font-semibold transition-colors hover:border-primary/50 hover:text-primary">
          <l.icon className="h-5 w-5 text-primary" aria-hidden />{l.label}
        </Link>
      ))}
    </nav>
  );
}
