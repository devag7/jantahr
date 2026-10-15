import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandMark } from '@/components/auth/brand-mark';
import { isCloudWeb } from '@/lib/edition';

export const metadata: Metadata = { title: 'Page not found', robots: { index: false } };

/** Every unknown address: say so plainly and offer the ways back. The self-hosted build has no public site. */
export default function NotFound() {
  const links = isCloudWeb
    ? [{ href: '/', label: 'JantaHR home' }, { href: '/pricing', label: 'See pricing' }, { href: '/login', label: 'Sign in' }]
    : [{ href: '/dashboard', label: 'Your dashboard' }, { href: '/login', label: 'Sign in' }];
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-16 text-center">
      <Link href={isCloudWeb ? '/' : '/dashboard'} className="inline-flex"><BrandMark /><span className="sr-only">JantaHR home</span></Link>
      <p className="mt-10 text-caption-strong text-muted-foreground">404</p>
      <h1 className="mt-2 text-display-sm font-semibold sm:text-title">This page does not exist.</h1>
      <p className="mt-3 max-w-[46ch] text-body text-secondary-foreground">The address may be mistyped, or the page may have moved. These will get you back on track:</p>
      <ul className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        {links.map((l, i) => (
          <li key={l.href}>
            <Link href={l.href} className={`inline-flex h-11 items-center whitespace-nowrap rounded-full px-[22px] text-body transition-transform active:scale-[0.95] ${i === 0 ? 'bg-primary text-primary-foreground' : 'border border-primary text-primary'}`}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
