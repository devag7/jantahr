'use client';
import * as React from 'react';
import { inAndroidApp, startPwa } from '@/components/pwa/pwa';

/** Root-layout hook-up for the service worker and the install prompt. Renders nothing. */
export function PwaBootstrap() {
  React.useEffect(() => { startPwa(); }, []);
  return null;
}

/** True inside the Google Play app; false on the server and in the first render, so hydration matches. */
export function useInAndroidApp() {
  const [app, setApp] = React.useState(false);
  React.useEffect(() => { setApp(inAndroidApp()); }, []);
  return app;
}
