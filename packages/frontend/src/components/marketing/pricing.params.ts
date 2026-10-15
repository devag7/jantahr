/**
 * The pricing calculator's state in the address (?billing=yearly&employees=50), so a reload or a shared link shows
 * the same numbers. No imports: the page and the tests both load it.
 */
export const EMPLOYEES_MIN = 1;
export const EMPLOYEES_MAX = 100000;
export const DEFAULTS = { cycle: 'ANNUAL' as 'MONTHLY' | 'ANNUAL', employees: 50 };

/** A whole number of employees from 1 to 1,00,000, or null with the reason it is not one. */
export function parseEmployees(raw: string): { value: number; error: null } | { value: null; error: string } {
  const text = raw.trim();
  if (!text) return { value: null, error: 'Enter the number of employees.' };
  if (!/^\d+$/.test(text)) return { value: null, error: 'Use whole numbers only.' };
  const n = Number(text);
  if (n < EMPLOYEES_MIN || n > EMPLOYEES_MAX) return { value: null, error: `Enter a number from ${EMPLOYEES_MIN} to ${EMPLOYEES_MAX.toLocaleString('en-IN')}.` };
  return { value: n, error: null };
}

/** The state a URL asks for; anything missing or invalid falls back to the defaults. */
export function readParams(params: { get(name: string): string | null }) {
  const billing = params.get('billing');
  const employees = parseEmployees(params.get('employees') ?? '');
  return {
    cycle: billing === 'monthly' ? 'MONTHLY' as const : billing === 'yearly' ? 'ANNUAL' as const : DEFAULTS.cycle,
    employees: employees.value ?? DEFAULTS.employees,
  };
}

export const toQuery = (cycle: 'MONTHLY' | 'ANNUAL', employees: number) => `?billing=${cycle === 'MONTHLY' ? 'monthly' : 'yearly'}&employees=${employees}`;
