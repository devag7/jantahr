import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthLinkForwarder } from '@/components/auth/auth-link-forwarder';
import { AppProviders } from '@/components/providers/app-providers';
import { isCloudWeb } from '@/lib/edition';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

// SF Pro via the system stack on Apple devices; Inter (the reference's named substitute) everywhere else
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: { default: 'JantaHR', template: '%s · JantaHR' },
  description: SITE_DESCRIPTION,
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { capable: true, title: 'JantaHR', statusBarStyle: 'default' },
  // the public site (cloud edition) has an address of its own, so its pages carry absolute links and a share card
  ...(isCloudWeb ? {
    metadataBase: new URL(SITE_URL),
    // share images come from the opengraph-image files (app/ and app/(marketing)/pricing)
    openGraph: { type: 'website' as const, siteName: SITE_NAME, locale: 'en_IN' },
    twitter: { card: 'summary_large_image' as const },
  } : {}),
};

export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <AuthLinkForwarder />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
