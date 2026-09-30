import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * From the Supabase `supabase-client-nextjs` library block, for Server Components / Route Handlers.
 * With Fluid compute, don't keep this client in a global: create one per request.
 * Not used yet: every authenticated screen is a Client Component that reads the session from the browser client,
 * which refreshes it, so the block's session-refresh middleware is not installed. Add it with the first Server
 * Component that needs the signed-in user.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component; safe to ignore
        }
      },
    },
  });
}
