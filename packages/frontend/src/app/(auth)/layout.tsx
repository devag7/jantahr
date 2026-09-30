import * as React from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/auth/brand-mark';

/** Sign-in family: black 44px global nav, then one centred column on Parchment (Apple ID pattern). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <nav className="bg-nav"><div className="mx-auto flex h-nav max-w-[1024px] items-center px-4"><Link href="/" aria-label="JantaHR home"><BrandMark light /></Link></div></nav>
      <main className="flex flex-1 justify-center px-4 py-12 sm:py-16">
        <div className="w-full max-w-[460px]">{children}</div>
      </main>
      <footer className="px-4 py-6 text-center text-fine text-muted-foreground">Copyright {new Date().getFullYear()} JantaHR. Data hosted in India.</footer>
    </div>
  );
}
