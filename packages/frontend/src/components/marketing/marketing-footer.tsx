import Link from 'next/link';
import { OPERATOR } from '@/lib/operator';

const COLS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: 'Product', links: [{ label: 'Payroll', href: '/#payroll' }, { label: 'Compliance calendar', href: '/#compliance' }, { label: 'Pricing', href: '/pricing' }, { label: 'Self-hosting', href: '/self-hosting' }] },
  { title: 'Account', links: [{ label: 'Sign in', href: '/login' }, { label: 'Start free trial', href: '/signup' }, { label: 'Reset password', href: '/forgot-password' }] },
  { title: 'Legal', links: [{ label: 'Terms of service', href: '/legal/terms' }, { label: 'Privacy notice', href: '/legal/privacy' }, { label: 'Cancellation and refunds', href: '/legal/refunds' }, { label: 'Shipping and delivery', href: '/legal/shipping' }] },
];

/** Reference `footer`: Parchment, dense link columns at 17px with 2.41 leading on desktop, 12px legal row. */
export function MarketingFooter() {
  return (
    <footer className="bg-background">
      <div className="mx-auto max-w-[1024px] px-4 py-16">
        <div className="grid grid-cols-2 gap-8 border-b pb-10 sm:grid-cols-4">
          {COLS.map((c) => (
            <div key={c.title}>
              <p className="text-caption font-semibold">{c.title}</p>
              <ul className="mt-2">{c.links.map((l) => <li key={l.href}><Link href={l.href} className="text-dense-link text-secondary-foreground hover:underline">{l.label}</Link></li>)}</ul>
            </div>
          ))}
          <div>
            <p className="text-caption font-semibold">Contact</p>
            <ul className="mt-2">
              <li><Link href="/contact" className="text-dense-link text-secondary-foreground hover:underline">Contact us</Link></li>
              <li><a href={`mailto:${OPERATOR.email}`} className="break-all text-dense-link text-secondary-foreground hover:underline">{OPERATOR.email}</a></li>
            </ul>
          </div>
        </div>
        <p className="mt-6 text-fine text-muted-foreground">Prices exclude 18% GST. Statutory rules are kept current with central and state notifications; payroll outputs should be reviewed by your chartered accountant.</p>
        <p className="mt-3 text-fine text-muted-foreground">Copyright {new Date().getFullYear()} {OPERATOR.name}{OPERATOR.address ? `, ${OPERATOR.address}` : ''}. Data hosted in India.</p>
      </div>
    </footer>
  );
}
