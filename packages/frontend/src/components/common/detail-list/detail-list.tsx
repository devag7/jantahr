import * as React from 'react';

export function DetailList({ items, cols = 2 }: { items: { label: string; value: React.ReactNode }[]; cols?: 1 | 2 | 3 }) {
  const grid = cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  return (
    <dl className={`grid gap-x-6 gap-y-4 ${grid}`}>
      {items.map((i) => (
        <div key={i.label}>
          <dt className="text-fine uppercase tracking-wide text-muted-foreground">{i.label}</dt>
          <dd className="mt-0.5 break-words text-caption font-semibold">{i.value ?? '-'}</dd>
        </div>
      ))}
    </dl>
  );
}
