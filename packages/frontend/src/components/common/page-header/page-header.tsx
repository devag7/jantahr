import * as React from 'react';

/** Page title in display-md (34px / 600 / -0.374px), iOS Large Title grammar. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-display-sm font-semibold sm:text-title">{title}</h1>
        {description && <p className="mt-1.5 max-w-[65ch] text-body text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
