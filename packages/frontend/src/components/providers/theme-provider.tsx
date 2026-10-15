'use client';
import { ThemeProvider as NextThemes } from 'next-themes';

/** Light and dark theme for every page, set from the visitor's saved choice before first paint. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <NextThemes attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>{children}</NextThemes>;
}
