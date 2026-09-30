/** Financial years (Apr-Mar) to offer in pickers, newest first. */
export function fiscalYearOptions(count = 4): { value: number; label: string }[] {
  const now = new Date();
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => ({ value: start - i, label: `FY ${start - i}-${String(start - i + 1).slice(2)}` }));
}
