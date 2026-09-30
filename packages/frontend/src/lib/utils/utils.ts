import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge must know the custom type scale (tailwind.config.ts fontSize) and colour tokens; otherwise it reads
 * `text-body` as a colour and silently drops `text-primary-foreground`, leaving ink text on a blue button.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['hero', 'display', 'title', 'lead', 'display-sm', 'lead-airy', 'tagline', 'body-strong', 'body', 'dense-link', 'button-large', 'caption', 'caption-strong', 'button-utility', 'fine', 'nav-link', 'micro'] }],
      'bg-color': [{ bg: ['nav', 'tile-1', 'tile-2', 'tile-3', 'divider'] }],
      'text-color': [{ text: ['nav-foreground', 'on-dark-muted', 'primary-on-dark'] }],
      'border-color': [{ border: ['divider', 'primary-on-dark'] }],
      shadow: [{ shadow: ['product'] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
