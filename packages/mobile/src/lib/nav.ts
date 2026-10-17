import { router } from 'expo-router';

/** Leave a form: back to where it was opened from, or to `fallback` when it was opened directly (a link). */
export const closeForm = (fallback: string) => (router.canGoBack() ? router.back() : router.replace(fallback as never));
