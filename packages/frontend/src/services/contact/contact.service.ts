import { ENDPOINTS as E } from '@/lib/api/endpoints';
import { API_BASE_URL } from '@/lib/constants';
import type { ContactMessage } from '@/types/contact';

/**
 * The public contact form. Plain fetch rather than the signed-in API client, so the marketing pages do not load
 * the Supabase session code. Throws an Error carrying the API's message.
 */
export const contactService = {
  send: async (body: ContactMessage): Promise<{ ok: true }> => {
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${E.contact.send}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new Error('Cannot reach the server. Check your connection and try again.');
    }
    const data = await res.json().catch(() => null) as { message?: string | string[] } | null;
    if (res.status === 429) throw new Error('Too many messages from this connection. Please try again in an hour, or write to us by email.');
    if (!res.ok) throw new Error(Array.isArray(data?.message) ? data.message.join('. ') : data?.message || 'Your message could not be sent. Please try again.');
    return { ok: true };
  },
};
