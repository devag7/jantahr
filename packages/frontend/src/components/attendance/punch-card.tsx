'use client';
import * as React from 'react';
import { Camera, LogIn, LogOut, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner } from '@/components/common/states';
import { StatusBadge } from '@/components/common/status-badge';
import { SelfieCapture } from '@/components/attendance/selfie-capture';
import { usePunch, usePunchStatus } from '@/hooks/attendance/use-attendance';
import { errorMessage } from '@/lib/api/client';
import { formatDuration, formatTime } from '@/lib/format';
import type { PunchInput } from '@/types/attendance';

function getPosition(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }), () => resolve(null), { timeout: 8000, maximumAge: 60_000 });
  });
}

/** Web check-in/out: live work timer, browser geolocation (for geo-fenced offices) and optional selfie. */
export function PunchCard() {
  const status = usePunchStatus();
  const punch = usePunch();
  const [tick, setTick] = React.useState(0);
  const [locating, setLocating] = React.useState(false);
  const [wantSelfie, setWantSelfie] = React.useState(false);
  const [cameraOpen, setCameraOpen] = React.useState(false);

  const s = status.data;
  React.useEffect(() => {
    if (!s?.checkedIn) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [s?.checkedIn]);
  React.useEffect(() => setTick(0), [s?.elapsedSeconds]);

  const punchWith = async (selfieData?: string) => {
    setLocating(true);
    const pos = await getPosition();
    setLocating(false);
    const input: PunchInput = { ...(pos ?? {}), source: 'WEB', ...(selfieData ? { selfie: selfieData } : {}) };
    punch.mutate(input, { onError: (e) => toast.error(errorMessage(e)) });
  };
  const onPunchClick = () => (wantSelfie ? setCameraOpen(true) : void punchWith());

  const busy = punch.isPending || locating;
  const elapsed = (s?.elapsedSeconds ?? 0) + (s?.checkedIn ? tick : 0);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const lastOut = s && !s.checkedIn && s.lastPunch?.type === 'OUT' ? s.lastPunch.time : null;
  return (
    <Card>
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div><h3 className="text-body font-semibold">Attendance</h3><p className="text-fine text-muted-foreground">{today}</p></div>
        <div className="flex items-center gap-2">{s?.attendance && <StatusBadge status={s.attendance.status} />}{s?.attendance?.lateEntry && <Badge variant="warning">Late entry</Badge>}</div>
      </div>
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <dl className="grid grid-cols-3 divide-x text-center sm:text-left">
          <div className="pr-3"><dt className="text-fine text-muted-foreground">First in</dt><dd className="mt-0.5 text-body font-semibold tabular-nums">{s?.firstIn ? formatTime(s.firstIn) : '-'}</dd></div>
          <div className="px-3"><dt className="text-fine text-muted-foreground">Last out</dt><dd className="mt-0.5 text-body font-semibold tabular-nums">{lastOut ? formatTime(lastOut) : '-'}</dd></div>
          <div className="pl-3"><dt className="text-fine text-muted-foreground">Effective hours</dt><dd className="mt-0.5 text-body font-semibold tabular-nums" aria-live="off">{status.isLoading ? '-' : formatDuration(elapsed)}</dd></div>
        </dl>
        <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
          <Button onClick={onPunchClick} disabled={busy || status.isLoading} variant={s?.checkedIn ? 'outline' : 'default'} className="min-w-36">
            {busy ? <Spinner className="mr-2" /> : s?.checkedIn ? <LogOut className="mr-2 h-4 w-4" /> : <LogIn className="mr-2 h-4 w-4" />}
            {locating ? 'Getting location…' : s?.checkedIn ? 'Web check-out' : 'Web check-in'}
          </Button>
          <label className="flex items-center gap-2 text-fine text-muted-foreground">
            <Checkbox checked={wantSelfie} onCheckedChange={setWantSelfie} />
            <Camera className="h-3.5 w-3.5" />Attach selfie
          </label>
        </div>
      </div>
      <p className="flex items-center gap-1 border-t px-6 py-3 text-fine text-muted-foreground"><MapPin className="h-3 w-3" />Location is recorded only when your office uses geo-fenced attendance.</p>
      <SelfieCapture open={cameraOpen} onOpenChange={setCameraOpen} onCapture={(d) => void punchWith(d)} />
    </Card>
  );
}
