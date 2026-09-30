/**
 * Global reference data. Statutory figures change by notification — these are seed defaults
 * and are stored in DB tables so HR/CA can revise them without a deploy.
 * IMPORTANT: PT/LWF slabs vary by state and change often; have a CA validate before production use.
 */

export const NEW_REGIME_SLABS_FY2025 = [
  { from: 0, to: 400000, rate: 0 },
  { from: 400000, to: 800000, rate: 0.05 },
  { from: 800000, to: 1200000, rate: 0.1 },
  { from: 1200000, to: 1600000, rate: 0.15 },
  { from: 1600000, to: 2000000, rate: 0.2 },
  { from: 2000000, to: 2400000, rate: 0.25 },
  { from: 2400000, to: 1e12, rate: 0.3 },
];

export const OLD_REGIME_SLABS = [
  { from: 0, to: 250000, rate: 0 },
  { from: 250000, to: 500000, rate: 0.05 },
  { from: 500000, to: 1000000, rate: 0.2 },
  { from: 1000000, to: 1e12, rate: 0.3 },
];

export const TAX_EXEMPTION_CATEGORIES = [
  {
    section: '80C', name: 'Section 80C', maxAmount: 150000,
    subs: [
      ['PPF', 'Public Provident Fund (PPF)'], ['ELSS', 'ELSS Mutual Funds'], ['LIC', 'Life Insurance Premium'],
      ['NSC', 'National Savings Certificate'], ['FD5', 'Tax Saver Fixed Deposit (5 yr)'], ['HLP', 'Home Loan Principal Repayment'],
      ['TUITION', "Children's Tuition Fees"], ['SSY', 'Sukanya Samriddhi Yojana'],
    ].map(([code, name]) => ({ code, name, maxAmount: 150000 })),
  },
  {
    section: '80CCD(1B)', name: 'NPS: additional contribution (80CCD(1B))', maxAmount: 50000,
    subs: [{ code: 'NPS1B', name: 'NPS Tier-1 self contribution', maxAmount: 50000 }],
  },
  {
    section: '80D', name: 'Medical Insurance (80D)', maxAmount: 100000,
    subs: [
      { code: '80D_SELF', name: 'Health insurance: self, spouse & children', maxAmount: 25000 },
      { code: '80D_PARENTS', name: 'Health insurance: parents (senior citizens)', maxAmount: 50000 },
      { code: '80D_CHECKUP', name: 'Preventive health check-up', maxAmount: 5000 },
    ],
  },
  { section: '24(b)', name: 'Home Loan Interest (Sec 24(b))', maxAmount: 200000, subs: [{ code: 'HLI', name: 'Interest on self-occupied home loan', maxAmount: 200000 }] },
  { section: '80E', name: 'Education Loan Interest (80E)', maxAmount: 10000000, subs: [{ code: 'EDUINT', name: 'Interest on education loan', maxAmount: 10000000 }] },
  { section: '80G', name: 'Donations (80G)', maxAmount: 10000000, subs: [{ code: 'DONATION', name: 'Eligible donations', maxAmount: 10000000 }] },
  { section: '80TTA', name: 'Savings Interest (80TTA)', maxAmount: 10000, subs: [{ code: 'TTA', name: 'Interest on savings account', maxAmount: 10000 }] },
];

type PtSlab = { from: number; to: number; amount: number; feb?: number; gender?: 'MALE' | 'FEMALE' };
/** States whose professional tax was repealed: last day the levy applied (Odisha: repealed from 1-Apr-2026). */
/** Half-yearly states: slabs are on half-year gross; tax is deducted in these wage months. Tamil Nadu uses Chennai Corporation rates (each local body sets its own). */
export const PT_HALF_YEARLY: Record<string, string> = { 'Tamil Nadu': '9,3', Kerala: '8,2' };
export const PT_REPEALED_ON: Record<string, string> = { Odisha: '2026-03-31' };
const INF = 1e12;

export const PT_SLABS: Record<string, PtSlab[]> = {
  Maharashtra: [
    { from: 0, to: 7500, amount: 0, gender: 'MALE' },
    { from: 7500.01, to: 10000, amount: 175, gender: 'MALE' },
    { from: 10000.01, to: INF, amount: 200, feb: 300, gender: 'MALE' },
    { from: 0, to: 25000, amount: 0, gender: 'FEMALE' },
    { from: 25000.01, to: INF, amount: 200, feb: 300, gender: 'FEMALE' },
  ],
  Karnataka: [
    { from: 0, to: 24999.99, amount: 0 },
    { from: 25000, to: INF, amount: 200, feb: 300 },
  ],
  'West Bengal': [
    { from: 0, to: 10000, amount: 0 },
    { from: 10000.01, to: 15000, amount: 110 },
    { from: 15000.01, to: 25000, amount: 130 },
    { from: 25000.01, to: 40000, amount: 150 },
    { from: 40000.01, to: INF, amount: 200 },
  ],
  Telangana: [
    { from: 0, to: 15000, amount: 0 },
    { from: 15000.01, to: 20000, amount: 150 },
    { from: 20000.01, to: INF, amount: 200 },
  ],
  'Andhra Pradesh': [
    { from: 0, to: 15000, amount: 0 },
    { from: 15000.01, to: 20000, amount: 150 },
    { from: 20000.01, to: INF, amount: 200 },
  ],
  Gujarat: [
    { from: 0, to: 12000, amount: 0 },
    { from: 12000.01, to: INF, amount: 200 },
  ],
  'Madhya Pradesh': [
    { from: 0, to: 18750, amount: 0 },
    { from: 18750.01, to: 25000, amount: 125 },
    { from: 25000.01, to: 33333, amount: 166, feb: 174 },
    { from: 33333.01, to: INF, amount: 208, feb: 212 },
  ],
  Odisha: [
    { from: 0, to: 13304, amount: 0 },
    { from: 13304.01, to: 25000, amount: 125 },
    { from: 25000.01, to: INF, amount: 200 },
  ],
  Assam: [
    { from: 0, to: 10000, amount: 0 },
    { from: 10000.01, to: 15000, amount: 150 },
    { from: 15000.01, to: 25000, amount: 180 },
    { from: 25000.01, to: INF, amount: 208 },
  ],
  'Tamil Nadu': [
    { from: 0, to: 21000, amount: 0 },
    { from: 21000.01, to: 30000, amount: 180 },
    { from: 30000.01, to: 45000, amount: 425 },
    { from: 45000.01, to: 60000, amount: 930 },
    { from: 60000.01, to: 75000, amount: 1025 },
    { from: 75000.01, to: INF, amount: 1250 },
  ],
  Kerala: [
    { from: 0, to: 11999.99, amount: 0 },
    { from: 12000, to: 17999.99, amount: 320 },
    { from: 18000, to: 29999.99, amount: 450 },
    { from: 30000, to: 44999.99, amount: 600 },
    { from: 45000, to: 99999.99, amount: 750 },
    { from: 100000, to: 124999.99, amount: 1000 },
    { from: 125000, to: INF, amount: 1250 },
  ],
  Jharkhand: [
    { from: 0, to: 25000, amount: 0 },
    { from: 25000.01, to: 41666, amount: 100 },
    { from: 41666.01, to: 66666, amount: 150 },
    { from: 66666.01, to: 83333, amount: 175 },
    { from: 83333.01, to: INF, amount: 208 },
  ],
};

export const LWF_RATES = [
  { state: 'Maharashtra', employeeAmount: 25, employerAmount: 75, months: '6,12' },
  { state: 'Karnataka', employeeAmount: 50, employerAmount: 100, months: '12' },
  { state: 'Gujarat', employeeAmount: 6, employerAmount: 12, months: '6,12' },
  { state: 'Telangana', employeeAmount: 2, employerAmount: 5, months: '12' },
  { state: 'West Bengal', employeeAmount: 3, employerAmount: 15, months: '6,12' },
];

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
];

/** Fixed-date gazetted holidays plus a few high-confidence movable ones. Movable festival dates MUST be reviewed each year. */
export const DEFAULT_HOLIDAYS: Record<number, { date: string; name: string; optional?: boolean }[]> = {
  2026: [
    { date: '2026-01-26', name: 'Republic Day' },
    { date: '2026-03-04', name: 'Holi' },
    { date: '2026-05-01', name: 'May Day / Maharashtra Day' },
    { date: '2026-08-15', name: 'Independence Day' },
    { date: '2026-10-02', name: 'Gandhi Jayanti' },
    { date: '2026-10-20', name: 'Dussehra' },
    { date: '2026-11-08', name: 'Diwali' },
    { date: '2026-12-25', name: 'Christmas' },
  ],
  2027: [
    { date: '2027-01-26', name: 'Republic Day' },
    { date: '2027-05-01', name: 'May Day / Maharashtra Day' },
    { date: '2027-08-15', name: 'Independence Day' },
    { date: '2027-10-02', name: 'Gandhi Jayanti' },
    { date: '2027-12-25', name: 'Christmas' },
  ],
};
