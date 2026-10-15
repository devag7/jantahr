/**
 * Client-side checks for the contact form, matching the API's ContactDto (packages/backend/src/modules/contact), so
 * a person sees the problem next to the field before sending. No imports: the form and the tests both load it.
 */
export interface ContactFields { name: string; email: string; company: string; phone: string; topic: string; message: string }
export type ContactErrors = Partial<Record<keyof ContactFields, string>>;

export const TOPICS: { value: string; label: string }[] = [
  { value: 'sales', label: 'Sales and pricing' },
  { value: 'billing', label: 'Billing and refunds' },
  { value: 'support', label: 'Help with my account' },
  { value: 'privacy', label: 'Privacy or a grievance' },
  { value: 'other', label: 'Something else' },
];

export const MESSAGE_MAX = 4000;

export function checkContact(f: ContactFields): ContactErrors {
  const e: ContactErrors = {};
  const name = f.name.trim();
  if (name.length < 2) e.name = 'Enter your name.';
  else if (name.length > 100) e.name = 'Use 100 characters or fewer.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = 'Enter an email address like name@company.com.';
  if (f.company.trim().length > 120) e.company = 'Use 120 characters or fewer.';
  if (f.phone.trim() && !/^\+?[0-9 ()-]{6,20}$/.test(f.phone.trim())) e.phone = 'Use digits, spaces and an optional +, for example +91 98765 43210.';
  if (!TOPICS.some((t) => t.value === f.topic)) e.topic = 'Choose what your message is about.';
  const message = f.message.trim();
  if (message.length < 10) e.message = 'Tell us a little more: at least 10 characters.';
  else if (message.length > MESSAGE_MAX) e.message = `Use ${MESSAGE_MAX.toLocaleString('en-IN')} characters or fewer.`;
  return e;
}
