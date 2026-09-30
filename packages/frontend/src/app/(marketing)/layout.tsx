import { notFound } from 'next/navigation';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { isCloudWeb } from '@/lib/edition';

/** Public site for the cloud edition. The self-hosted build has no marketing pages. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  if (!isCloudWeb) notFound();
  return <div className="bg-card">{children}<MarketingFooter /></div>;
}
