'use client';
import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** Debounced search box: `onSearch` fires 300 ms after the user stops typing. */
export function SearchInput({ onSearch, placeholder = 'Search…', className, defaultValue }: { onSearch: (q: string) => void; placeholder?: string; className?: string; defaultValue?: string }) {
  const [value, setValue] = React.useState(defaultValue ?? '');
  const cb = React.useRef(onSearch);
  cb.current = onSearch;
  React.useEffect(() => {
    const t = setTimeout(() => cb.current(value.trim()), 300);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="pl-9" aria-label={placeholder} />
    </div>
  );
}
