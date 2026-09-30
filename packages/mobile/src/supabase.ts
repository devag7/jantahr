import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';

// SecureStore (Keychain / Keystore) warns above ~2 KB per value and a Supabase session is larger, so the session is
// stored in chunks under `<key>.0`, `<key>.1`… with the count in `<key>.n`.
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

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: sign-in uses Supabase Auth.');

/** Supabase Auth is JantaHR's only identity provider; the API accepts this session's access token. */
export const supabase = createClient(url, key, {
  auth: { storage: secureStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// Refresh only while the app is in the foreground (Supabase's React Native guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
