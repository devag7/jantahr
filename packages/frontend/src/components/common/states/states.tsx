import * as React from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/client';

export function EmptyState({ title, description, action, icon: Icon = Inbox }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg bg-card px-6 py-14 text-center">
      <Icon className="mb-4 h-8 w-8 text-muted-foreground" />
      <p className="text-body font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-caption text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg bg-card px-6 py-12 text-center">
      <AlertCircle className="h-7 w-7 text-destructive" />
      <p className="max-w-md text-caption text-foreground">{errorMessage(error)}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

/** Skeleton shaped like a list card: title bar and rows (no generic spinner for page loads). */
export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card p-6" aria-busy="true" aria-live="polite">
      <Skeleton className="mb-5 h-5 w-40" />
      <div className="space-y-4">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-4" style={{ width: `${92 - ((i * 13) % 30)}%` }} />)}</div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={`h-4 w-4 animate-spin ${className ?? ''}`} aria-label="Loading" />;
}

/** Standard query-state switch: loading → error → empty → content. */
export function QueryBoundary<T>({ query, children, empty, rows }: {
  query: { data: T | undefined; isLoading: boolean; error: unknown; refetch: () => unknown };
  children: (data: T) => React.ReactNode;
  empty?: { when: (d: T) => boolean; title: string; description?: string; action?: React.ReactNode };
  rows?: number;
}) {
  if (query.isLoading) return <LoadingBlock rows={rows} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === undefined) return null;
  if (empty?.when(query.data)) return <EmptyState title={empty.title} description={empty.description} action={empty.action} />;
  return <>{children(query.data)}</>;
}
