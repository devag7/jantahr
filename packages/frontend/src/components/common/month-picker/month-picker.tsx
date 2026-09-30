'use client';
import { NativeSelect } from '@/components/ui/native-select';
import { MONTH_NAMES } from '@/lib/format';

export function MonthPicker({ month, year, onChange, yearsBack = 3 }: { month: number; year: number; onChange: (m: number, y: number) => void; yearsBack?: number }) {
  const now = new Date().getFullYear();
  const years = Array.from({ length: yearsBack + 2 }, (_, i) => now + 1 - i);
  return (
    <div className="flex gap-2">
      <NativeSelect aria-label="Month" value={month} onChange={(e) => onChange(Number(e.target.value), year)} className="w-36">
        {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
      </NativeSelect>
      <NativeSelect aria-label="Year" value={year} onChange={(e) => onChange(month, Number(e.target.value))} className="w-24">
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </NativeSelect>
    </div>
  );
}
