'use client';
import * as React from 'react';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Spinner } from '@/components/common/states';
import { errorMessage } from '@/lib/api/client';

/** Runs an async download (protected file fetch) with a busy state and error toast. */
export function DownloadButton({ onDownload, children, icon = true, ...props }: { onDownload: () => Promise<void>; children: React.ReactNode; icon?: boolean } & Omit<ButtonProps, 'onClick'>) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Button {...props} disabled={busy || props.disabled} onClick={async () => {
      setBusy(true);
      try { await onDownload(); } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
    }}>
      {busy ? <Spinner className="mr-2" /> : icon ? <Download className="mr-2 h-4 w-4" /> : null}{children}
    </Button>
  );
}
