'use client';
import * as React from 'react';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/common/modal';

/** Captures a downscaled JPEG data-URL from the device camera. Video stream is stopped when the dialog closes. */
export function SelfieCapture({ open, onOpenChange, onCapture }: { open: boolean; onOpenChange: (o: boolean) => void; onCapture: (dataUrl: string) => void }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setError('Camera access was blocked. Allow camera permission or continue without a selfie.'));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const snap = () => {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = Math.round((v.videoHeight / v.videoWidth) * 480) || 360;
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL('image/jpeg', 0.7));
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Take a selfie" description="Your photo is stored with this attendance entry for verification." size="sm"
      footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={snap} disabled={!!error}><Camera className="mr-2 h-4 w-4" />Capture</Button></>}>
      {error ? <p role="alert" className="rounded-md border bg-muted p-3 text-caption text-destructive">{error}</p> : <video ref={videoRef} autoPlay playsInline muted className="aspect-[4/3] w-full rounded-md bg-muted object-cover" />}
    </Modal>
  );
}
