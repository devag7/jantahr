'use client';
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { metaService } from '@/services/meta/meta.service';

/**
 * Subscribes to this user's Supabase Realtime Broadcast channel (name issued by the API). A ping carries no data;
 * it only tells the app to refetch notifications, so nothing personal travels over Realtime.
 * Returns true while connected (the bell then stops fast polling).
 */
export function useLiveNotifications(enabled: boolean): boolean {
  const qc = useQueryClient();
  const [live, setLive] = React.useState(false);
  React.useEffect(() => {
    if (!enabled) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    metaService.realtime().then((g) => {
      if (cancelled || !g.enabled || !g.topic) return;
      // the app's one Supabase client (it already holds the signed-in session)
      const supabase = createClient();
      const channel = supabase.channel(g.topic)
        .on('broadcast', { event: g.event ?? 'notification' }, () => { void qc.invalidateQueries({ queryKey: ['notifications'] }); })
        .subscribe((status) => setLive(status === 'SUBSCRIBED'));
      cleanup = () => { void supabase.removeChannel(channel); setLive(false); };
    }).catch(() => undefined);
    return () => { cancelled = true; cleanup?.(); };
  }, [enabled, qc]);
  return live;
}
