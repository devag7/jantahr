/** App-wide constants: routes, storage keys, page sizes. Feature-owned lists live beside their feature. */
export const ROUTES = {
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  CHANGE_PASSWORD: '/change-password',
} as const;

export const DEFAULT_PAGE_SIZE = 20;
export const NOTIFICATION_POLL_MS = 30_000;

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
