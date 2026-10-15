import { AppProviders } from '@/components/providers/app-providers';

/** Public careers pages read jobs through the API client, so they mount the app's providers. */
export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}
