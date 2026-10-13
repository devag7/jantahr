/**
 * Structured data for the home page (schema.org JSON-LD): who runs the service, the site, and the product with its
 * prices. Every value comes from the caller; a field the deployment has not configured is left out, never invented.
 * No imports: the tests load it too.
 */

export interface JsonLdInput {
  siteUrl: string;
  description: string;
  repoUrl: string;
  image: string;
  operator: { name: string; address: string; email: string; phone: string; gstin: string };
  plans: { name: string; summary: string; pricePaise: { MONTHLY: number; ANNUAL: number } | null }[];
}

export function buildJsonLd({ siteUrl, description, repoUrl, image, operator, plans }: JsonLdInput) {
  const url = (path: string) => new URL(path, siteUrl).toString();
  const orgId = url('/#organization');
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: 'JantaHR',
        ...(operator.name && operator.name !== 'JantaHR' ? { legalName: operator.name } : {}),
        url: url('/'),
        logo: url('/icon.svg'),
        description,
        email: operator.email,
        ...(operator.phone ? { telephone: operator.phone } : {}),
        ...(operator.gstin ? { taxID: operator.gstin } : {}),
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          email: operator.email,
          ...(operator.phone ? { telephone: operator.phone } : {}),
          url: url('/contact'),
          areaServed: 'IN',
          availableLanguage: ['en'],
        },
        ...(operator.address ? { address: { '@type': 'PostalAddress', streetAddress: operator.address, addressCountry: 'IN' } } : {}),
        sameAs: [repoUrl],
      },
      { '@type': 'WebSite', '@id': url('/#website'), name: 'JantaHR', url: url('/'), description, inLanguage: 'en-IN', publisher: { '@id': orgId } },
      {
        '@type': 'SoftwareApplication',
        '@id': url('/#software'),
        name: 'JantaHR',
        description,
        url: url('/'),
        image: url(image),
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'HR and payroll software',
        operatingSystem: 'Web, Android, iOS',
        license: 'https://www.gnu.org/licenses/agpl-3.0.html',
        sameAs: [repoUrl],
        publisher: { '@id': orgId },
        offers: plans.filter((p) => p.pricePaise).map((p) => ({
          '@type': 'Offer',
          name: p.name,
          description: p.summary,
          price: (p.pricePaise!.MONTHLY / 100).toFixed(2),
          priceCurrency: 'INR',
          url: url('/pricing'),
          ...(p.pricePaise!.MONTHLY > 0 ? { eligibleQuantity: { '@type': 'QuantitativeValue', unitText: 'employee per month' } } : {}),
        })),
      },
    ],
  };
}

/** Serialised for a <script type="application/ld+json"> tag: "<" is escaped so no value can close the tag. */
export const jsonLdScript = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
