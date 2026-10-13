import type { MetadataRoute } from 'next';
import { isCloudWeb } from '@/lib/edition';
import { absoluteUrl } from '@/lib/site';

/** /robots.txt: everything but the API may be crawled; the cloud edition also points at its sitemap. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: '/api/' }, ...(isCloudWeb ? { sitemap: absoluteUrl('/sitemap.xml') } : {}) };
}
