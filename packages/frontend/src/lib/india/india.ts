/** Static India reference data used by forms when the API list has not loaded. */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];
export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Fixed-term', 'Contract', 'Intern', 'Consultant'];

/** Salary-TDS forms: Income-tax Act 2025 / Rules 2026 renumbered them from tax year 2026-27. */
export const taxForms = (fyStartYear: number) =>
  fyStartYear >= 2026
    ? { yearLabel: 'Tax year', certificate: 'Form 130', quarterlyReturn: 'Form 143', declaration: 'Form 124' }
    : { yearLabel: 'Financial year', certificate: 'Form 16', quarterlyReturn: 'Form 24Q', declaration: 'Form 12BB' };

/** 50% HRA cities; Bengaluru, Hyderabad, Pune and Ahmedabad added from tax year 2026-27. */
export const hraMetros = (fyStartYear: number) => (fyStartYear >= 2026 ? 'Delhi, Mumbai, Kolkata, Chennai, Bengaluru, Hyderabad, Pune or Ahmedabad' : 'Delhi, Mumbai, Kolkata or Chennai');
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
