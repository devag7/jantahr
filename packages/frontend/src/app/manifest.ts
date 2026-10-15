import type { MetadataRoute } from 'next';

/**
 * Web app manifest: makes JantaHR installable (Android, desktop, and iPhone through Add to Home Screen).
 * When the Android app is published, ANDROID_PACKAGE_NAME links it so browsers know the two are the same app.
 */
export default function manifest(): MetadataRoute.Manifest {
  const androidPackage = process.env.ANDROID_PACKAGE_NAME;
  // form_factor and label give Android Chrome its richer install sheet (not yet in Next's manifest type)
  const shots = [
    { src: '/marketing/mobile.webp', sizes: '780x1560', type: 'image/webp', form_factor: 'narrow', label: 'Your day: attendance, leave balance and payslips' },
    { src: '/marketing/overview-1600.webp', sizes: '1600x1000', type: 'image/webp', form_factor: 'wide', label: 'Company overview' },
  ];
  const screenshots = shots as MetadataRoute.Manifest['screenshots'];
  const icon192 = [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }];
  return {
    id: '/dashboard',
    name: 'JantaHR',
    short_name: 'JantaHR',
    description: 'HR and payroll for Indian companies: attendance, leave, payslips, PF, ESI and TDS.',
    lang: 'en-IN',
    dir: 'ltr',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f2f4f7',
    theme_color: '#000000',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Check in', short_name: 'Check in', url: '/me/attendance', icons: icon192 },
      { name: 'Apply for leave', short_name: 'Leave', url: '/me/leave', icons: icon192 },
      { name: 'Payslips', short_name: 'Payslips', url: '/me/payslips', icons: icon192 },
    ],
    screenshots,
    ...(androidPackage ? {
      related_applications: [{ platform: 'play', id: androidPackage, url: `https://play.google.com/store/apps/details?id=${androidPackage}` }],
      prefer_related_applications: false,
    } : {}),
  };
}
