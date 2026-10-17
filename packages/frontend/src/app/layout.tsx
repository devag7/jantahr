import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SiteAnalytics } from '@/components/analytics/site-analytics';
import { AuthLinkForwarder } from '@/components/auth/auth-link-forwarder';
import { PwaBootstrap } from '@/components/pwa/pwa-bootstrap';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { isCloudWeb } from '@/lib/edition';
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site';

// SF Pro via the system stack on Apple devices; Inter (the reference's named substitute) everywhere else
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

/** One launch image per iPhone screen (CSS width, height, pixel ratio), generated into public/splash. */
const IPHONE_LAUNCH_IMAGES = ([[440, 956, 3], [402, 874, 3], [420, 912, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2]] as const)
  .map(([w, h, r]) => ({ url: `/splash/apple-${w * r}x${h * r}.png`, media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)` }));

export const metadata: Metadata = {
  title: { default: 'JantaHR', template: '%s · JantaHR' },
  description: SITE_DESCRIPTION,
  // the manifest comes from app/manifest.ts; iPhones need a PNG for the Home Screen icon
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/icons/apple-touch-icon.png' },
  // iPhone home-screen app: black status bar over the black top bar (as the Android app), and the same launch screen
  // as Android (icon on #F2F4F7) instead of a blank white one while the first page loads
  appleWebApp: { capable: true, title: 'JantaHR', statusBarStyle: 'black', startupImage: IPHONE_LAUNCH_IMAGES },
  // the public site (cloud edition) has an address of its own, so its pages carry absolute links and a share card
  ...(isCloudWeb ? {
    metadataBase: new URL(SITE_URL),
    // share images come from the opengraph-image files (app/ and app/(marketing)/pricing)
    openGraph: { type: 'website' as const, siteName: SITE_NAME, locale: 'en_IN' },
    twitter: { card: 'summary_large_image' as const },
  } : {}),
};

export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        {/* the app's providers (session, API cache, toasts) live in the (app), (auth) and careers layouts */}
        <ThemeProvider>
          <AuthLinkForwarder />
          <PwaBootstrap />
          {children}
          {isCloudWeb && <SiteAnalytics />}
        </ThemeProvider>
      </body>
    </html>
  );
}
