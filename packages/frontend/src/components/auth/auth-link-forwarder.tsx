'use client';
import * as React from 'react';

/**
 * Supabase sends a link's result to the Site URL when the requested return address is not on its allow-list (a new
 * domain, a preview deployment). The session then arrives in the fragment of whatever page that is. Forward it to the
 * callback page, which knows what to do with it, instead of silently dropping the sign-in.
 */
export function AuthLinkForwarder() {
  React.useEffect(() => {
    const { hash, pathname, search } = window.location;
    if (pathname === '/auth/callback') return;
    if (/[#&](access_token|error_description)=/.test(hash) || /[?&]code=[\w-]+/.test(search) && pathname === '/') {
      window.location.replace(`/auth/callback${search}${hash}`);
    }
  }, []);
  return null;
}
