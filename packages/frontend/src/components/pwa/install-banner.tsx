'use client';
import * as React from 'react';
import { Smartphone, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstallAppDialog } from '@/components/pwa/install-app-dialog';
import { installPrompt, isAndroid, isInstalled, isIos } from '@/components/pwa/pwa';

const DISMISSED = 'jantahr:install-banner:off';

/**
 * One quiet line on the dashboard telling phone users JantaHR installs like an app: iPhone users have no store
 * listing to find it in, so this is how they learn about Add to Home Screen. Shown in a phone browser only (never
 * in the installed app), until dismissed or installed.
 */
export function InstallBanner() {
  const [show, setShow] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  React.useEffect(() => {
    let off = false;
    try { off = localStorage.getItem(DISMISSED) === '1'; } catch { /* storage blocked: show it */ }
    setShow(!off && !isInstalled() && (isIos() || (isAndroid() && !!installPrompt())));
  }, []);
  if (!show) return null;
  const dismiss = () => {
    setShow(false);
    try { localStorage.setItem(DISMISSED, '1'); } catch { /* fine: it shows again next time */ }
  };
  return (
    <div role="region" aria-label="Install the app" className="mb-6 flex items-center gap-3 rounded-lg border bg-card py-3 pl-4 pr-2">
      <Smartphone className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 flex-1 text-caption">Put JantaHR on your home screen: it opens full screen, like an app.</p>
      <Button size="sm" onClick={() => setOpen(true)}>Install</Button>
      <Button size="icon" variant="ghost" aria-label="Not now" onClick={dismiss}><X className="h-4 w-4" /></Button>
      <InstallAppDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
