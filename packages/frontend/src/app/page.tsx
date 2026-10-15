import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { HOME_FAQ, Landing } from '@/components/marketing/landing';
import { faqJsonLd } from '@/components/marketing/faq.constants';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { buildJsonLd, jsonLdScript } from '@/lib/agents/json-ld';
import { isCloudWeb } from '@/lib/edition';
import { OPERATOR } from '@/lib/operator';
import { PLANS } from '@/lib/plans';
import { REPO_URL, SITE_DESCRIPTION, SITE_IMAGE, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';

export const metadata: Metadata = isCloudWeb ? {
  title: { absolute: SITE_TITLE },
  alternates: { canonical: '/' },
  openGraph: { type: 'website', url: '/', siteName: SITE_NAME, locale: 'en_IN', title: SITE_TITLE, description: SITE_DESCRIPTION, images: [{ url: SITE_IMAGE, width: 2880, height: 1800, alt: 'JantaHR company overview' }] },
} : {};

/** Cloud edition: public landing page. Self-hosted edition: straight into the app. */
export default function Home() {
  if (!isCloudWeb) redirect('/dashboard');
  const jsonLd = buildJsonLd({ siteUrl: SITE_URL, description: SITE_DESCRIPTION, repoUrl: REPO_URL, image: SITE_IMAGE, operator: OPERATOR, plans: PLANS });
  return (
    <div className="bg-card">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd(HOME_FAQ)) }} />
      <Landing /><MarketingFooter />
    </div>
  );
}
