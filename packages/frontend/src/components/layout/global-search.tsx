'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { UserAvatar } from '@/components/common/user-avatar';
import { useAuth } from '@/hooks/auth/use-auth';
import { useDirectory } from '@/hooks/employees/use-employees';
import { isBackOffice } from '@/lib/permissions';
import { cn } from '@/lib/utils';

/** Employee search opened from the global nav (⌘K). Reference `search-input`: pill, 44px, 17px text. */
export function GlobalSearch({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const { role } = useAuth();
  const [value, setValue] = React.useState('');
  const [term, setTerm] = React.useState('');
  const [active, setActive] = React.useState(0);
  React.useEffect(() => { const t = setTimeout(() => setTerm(value.trim()), 200); return () => clearTimeout(t); }, [value]);
  const q = useDirectory(term.length >= 2 ? term : undefined);
  const results = term.length >= 2 ? (q.data ?? []).slice(0, 8) : [];

  const go = (i: number) => {
    const r = results[i];
    if (!r) return;
    onDone?.();
    router.push(isBackOffice(role) ? `/hr/employees/${r.id}` : `/directory?q=${encodeURIComponent(r.fullName)}`);
  };

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" aria-hidden />
        <input
          value={value} autoFocus={autoFocus} role="combobox" aria-expanded={results.length > 0} aria-controls="global-search-results" aria-label="Search employees"
          placeholder="Search employees by name or ID"
          onChange={(e) => { setValue(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter') { e.preventDefault(); if (results.length) go(active); else if (value.trim()) { onDone?.(); router.push(`/directory?q=${encodeURIComponent(value.trim())}`); } }
          }}
          className="h-11 w-full rounded-full border border-white/20 bg-white/10 pl-11 pr-5 text-body text-white placeholder:text-white/50 focus:border-primary focus:outline-none"
        />
      </div>
      {term.length >= 2 && (
        <ul id="global-search-results" role="listbox" className="mt-4">
          {results.length === 0 && <li className="px-5 py-2 text-caption text-white/60">{q.isFetching ? 'Searching' : 'No employees found'}</li>}
          {results.map((r, i) => (
            <li key={r.id} role="option" aria-selected={i === active}>
              <button type="button" onMouseEnter={() => setActive(i)} onClick={() => go(i)}
                className={cn('flex w-full items-center gap-3 rounded-md px-5 py-2 text-left text-white', i === active && 'bg-white/10')}>
                <UserAvatar name={r.fullName} className="h-8 w-8" />
                <span className="min-w-0"><span className="block truncate text-caption font-semibold">{r.fullName} <span className="font-normal text-white/60">{r.employeeCode}</span></span><span className="block truncate text-fine text-white/60">{[r.designation, r.department].filter(Boolean).join(', ')}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
