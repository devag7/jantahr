'use client';
import * as React from 'react';
import { PlusSquare, Share } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/common/modal';
import { installPrompt, isAndroid, isIos } from '@/components/pwa/pwa';

const ANDROID_PACKAGE = process.env.NEXT_PUBLIC_ANDROID_PACKAGE_NAME;
// the Play listing link only once the app is public (ANDROID_PLAY_LIVE=true); closed-test apps are "not found" to others
const PLAY_URL = ANDROID_PACKAGE && process.env.NEXT_PUBLIC_ANDROID_PLAY_LIVE === 'true' ? `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}` : null;

/** How to install JantaHR on this device: the Play Store app on Android, Add to Home Screen on iPhone, the browser's install elsewhere. */
export function InstallAppDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const ios = isIos();
  const android = isAndroid();
  const prompt = installPrompt();
  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    onOpenChange(false);
  };
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Install JantaHR" size="sm"
      description={ios ? 'Add JantaHR to your Home Screen to open it like an app, full screen.' : 'Open JantaHR like an app, from your home screen or app list.'}
      footer={<Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>}>
      {ios ? (
        <ol className="space-y-3 text-caption">
          <li className="flex gap-3"><span className="font-semibold">1.</span><span>Open <strong>jantahr.devshipit.com</strong> in Safari.</span></li>
          <li className="flex gap-3"><span className="font-semibold">2.</span><span>Tap <Share className="inline h-4 w-4 align-text-bottom text-primary" aria-label="Share" /> <strong>Share</strong> in the toolbar.</span></li>
          <li className="flex gap-3"><span className="font-semibold">3.</span><span>Scroll down and tap <PlusSquare className="inline h-4 w-4 align-text-bottom" aria-hidden /> <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</span></li>
        </ol>
      ) : (
        <div className="space-y-4 text-caption">
          {android && PLAY_URL && (
            <Button asChild className="w-full"><a href={PLAY_URL} target="_blank" rel="noopener">Get it on Google Play</a></Button>
          )}
          {prompt ? (
            <Button variant={android && PLAY_URL ? 'outline' : 'default'} className="w-full" onClick={install}>Install from the browser</Button>
          ) : !(android && PLAY_URL) && (
            <p className="text-muted-foreground">In Chrome or Edge, open the browser menu and choose <strong>Install JantaHR</strong> (or <strong>Add to Home screen</strong> on a phone).</p>
          )}
        </div>
      )}
    </Modal>
  );
}
