import type { MetadataRoute } from 'next';
import { isCloudWeb } from '@/lib/edition';
import { PUBLIC_PAGES, absoluteUrl } from '@/lib/site';

/** /sitemap.xml: the public pages of the cloud edition, dated with this build. The self-hosted app lists nothing. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!isCloudWeb) return [];
  const lastModified = new Date();
  return PUBLIC_PAGES.map((p) => ({ url: absoluteUrl(p.path), lastModified, changeFrequency: p.group === 'legal' ? 'yearly' : 'monthly', priority: p.path === '/' ? 1 : p.group === 'legal' ? 0.3 : 0.7 }));
}
