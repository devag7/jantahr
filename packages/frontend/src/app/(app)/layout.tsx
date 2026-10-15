import { AppProviders } from '@/components/providers/app-providers';
import { AppShell } from './app-shell';

/** The signed-in app: session and API providers around the shell (nav bars, plan gate, help, tour). */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppProviders><AppShell>{children}</AppShell></AppProviders>;
}
