'use client';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RatingInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} className="rounded-sm p-0.5">
          <Star className={cn('h-6 w-6', n <= value ? 'fill-warning text-warning' : 'text-muted-foreground')} />
        </button>
      ))}
    </div>
  );
}

export function RatingDisplay({ value }: { value: number | null }) {
  if (value === null || value === undefined) return <span className="text-muted-foreground">-</span>;
  return <span className="inline-flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-warning text-warning" />{value}</span>;
}
