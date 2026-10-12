import { SALES_EMAIL } from '@/lib/edition';

/**
 * Who runs this hosted edition: shown on the contact and policy pages and in the footer. Payment providers and Indian
 * consumer rules expect a legal name, a postal address and a way to reach the business, so each value comes from the
 * deployment's configuration (see next.config.mjs); nothing here is invented when a value is missing.
 */
export const OPERATOR = {
  /** Legal name of the business, as on its tax registration and its payment account. */
  name: process.env.NEXT_PUBLIC_OPERATOR_NAME || 'JantaHR',
  /** Registered or operating address, one line. */
  address: process.env.NEXT_PUBLIC_OPERATOR_ADDRESS || '',
  email: SALES_EMAIL,
  phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '',
} as const;

export const LEGAL_UPDATED = 'October 2026';
