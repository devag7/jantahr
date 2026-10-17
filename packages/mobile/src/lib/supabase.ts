import 'react-native-url-polyfill/auto';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

// SecureStore (Android Keystore / iOS Keychain) warns above ~2 KB per value and a Supabase session is larger, so the
// session is stored in chunks under `<key>.0`, `<key>.1`… with the count in `<key>.n`.
const CHUNK = 1800;
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');
const secureStorage = {
  async getItem(key: string) {
    const k = safeKey(key);
    const n = Number((await SecureStore.getItemAsync(`${k}.n`)) ?? 0);
    if (!n) return null;
    const parts = await Promise.all(Array.from({ length: n }, (_, i) => SecureStore.getItemAsync(`${k}.${i}`)));
    return parts.some((p) => p === null) ? null : parts.join('');
  },
  async setItem(key: string, value: string) {
    await secureStorage.removeItem(key);
    const k = safeKey(key);
    const parts: string[] = [];
    for (let i = 0; i < value.length || i === 0; i += CHUNK) parts.push(value.slice(i, i + CHUNK));
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(`${k}.${i}`, parts[i]);
    await SecureStore.setItemAsync(`${k}.n`, String(parts.length));
  },
  async removeItem(key: string) {
    const k = safeKey(key);
    const n = Number((await SecureStore.getItemAsync(`${k}.n`)) ?? 0);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
    await SecureStore.deleteItemAsync(`${k}.n`);
  },
};

/** Supabase Auth is JantaHR's identity provider; the API accepts this session's access token. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  // the browser preview (expo start --web) keeps the session in localStorage; phones use the secure store
  auth: { storage: Platform.OS === 'web' ? undefined : secureStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// Refresh tokens only while the app is in the foreground (Supabase's React Native guidance).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export async function accessToken() {
  return (await supabase.auth.getSession()).data.session?.access_token ?? null;
}
