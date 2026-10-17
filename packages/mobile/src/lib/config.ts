import Constants from 'expo-constants';

interface Extra { siteUrl: string; apiUrl: string; supabaseUrl: string; supabaseKey: string; googleWebClientId: string }
const extra = (Constants.expoConfig?.extra ?? {}) as Partial<Extra>;

/** Where the app's data comes from (app.config.ts: production unless EXPO_PUBLIC_* says otherwise). */
export const SITE_URL = (extra.siteUrl ?? 'https://jantahr.devshipit.com').replace(/\/+$/, '');
export const API_URL = (extra.apiUrl ?? `${SITE_URL}/api`).replace(/\/+$/, '');
export const SUPABASE_URL = extra.supabaseUrl ?? '';
export const SUPABASE_KEY = extra.supabaseKey ?? '';
export const GOOGLE_WEB_CLIENT_ID = extra.googleWebClientId ?? '';
export const SUPPORT_EMAIL = 'jantahr@devshipit.com';

/**
 * A page of the website, opened from the app. `source=android-app` makes the site hide plan purchases for the
 * session, as Google Play's payments policy requires of anything reached from a Play app.
 */
export const webUrl = (path: string) => `${SITE_URL}${path}${path.includes('?') ? '&' : '?'}source=android-app`;
