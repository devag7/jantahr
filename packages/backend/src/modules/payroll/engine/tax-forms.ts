/**
 * Salary-TDS forms by year. The Income-tax Act, 2025 and Income-tax Rules, 2026 apply from 1-Apr-2026 ("tax year" 2026-27):
 * s.392 replaces s.192, Form 130 replaces Form 16, Form 143 replaces 24Q, Form 124 replaces 12BB, Form 122 records the regime choice.
 */
export interface SalaryTdsLaw { act: string; section: string; yearLabel: string; certificate: string; quarterlyReturn: string; declaration: string }

export function salaryTdsLaw(fyStartYear: number): SalaryTdsLaw {
  return fyStartYear >= 2026
    ? { act: 'Income-tax Act, 2025', section: 's.392', yearLabel: 'Tax year', certificate: 'Form 130', quarterlyReturn: 'Form 143', declaration: 'Form 124' }
    : { act: 'Income-tax Act, 1961', section: 's.192', yearLabel: 'Financial year', certificate: 'Form 16', quarterlyReturn: 'Form 24Q', declaration: 'Form 12BB' };
}

/** Cities where HRA exemption is 50% of salary (40% elsewhere). Bengaluru, Hyderabad, Pune and Ahmedabad were added by the Income-tax Rules, 2026. */
export const HRA_METROS_BEFORE_2026 = ['Delhi', 'Mumbai', 'Kolkata', 'Chennai'];
export const HRA_METROS_FROM_2026 = [...HRA_METROS_BEFORE_2026, 'Bengaluru', 'Hyderabad', 'Pune', 'Ahmedabad'];
export const hraMetros = (fyStartYear: number) => (fyStartYear >= 2026 ? HRA_METROS_FROM_2026 : HRA_METROS_BEFORE_2026);
