'use client';
import * as React from 'react';
import { startPwa } from '@/components/pwa/pwa';

/** Root-layout hook-up for the service worker and the install prompt. Renders nothing. */
export function PwaBootstrap() {
  React.useEffect(() => { startPwa(); }, []);
  return null;
}
