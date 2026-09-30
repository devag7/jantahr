import { redirect } from 'next/navigation';
import { Landing } from '@/components/marketing/landing';
import { MarketingFooter } from '@/components/marketing/marketing-footer';
import { isCloudWeb } from '@/lib/edition';

/** Cloud edition: public landing page. Self-hosted edition: straight into the app. */
export default function Home() {
  if (!isCloudWeb) redirect('/dashboard');
  return <div className="bg-card"><Landing /><MarketingFooter /></div>;
}
