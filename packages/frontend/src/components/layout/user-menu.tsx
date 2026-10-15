'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Compass, Download, KeyRound, ListChecks, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { useTheme } from 'next-themes';
import { UserAvatar } from '@/components/common/user-avatar';
import { InstallAppDialog } from '@/components/pwa/install-app-dialog';
import { isInstalled } from '@/components/pwa/pwa';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/auth/use-auth';
import { useSetupStatus } from '@/hooks/org/use-org';
import { ADMIN } from '@/lib/permissions';
import { useOnboardingStore } from '@/stores/onboarding/onboarding-store';
import { useAuthStore } from '@/stores/auth/auth-store';

export function UserMenu() {
  const router = useRouter();
  const { user, hasRole } = useAuth();
  const startTour = useOnboardingStore((s) => s.startTour);
  const setGuideHidden = useOnboardingStore((s) => s.setGuideHidden);
  const setup = useSetupStatus(hasRole(ADMIN));
  const logout = useAuthStore((s) => s.logout);
  const { resolvedTheme, setTheme } = useTheme();
  const [installOpen, setInstallOpen] = React.useState(false);
  // decided after mount: the server cannot know whether this is the installed app
  const [installable, setInstallable] = React.useState(false);
  React.useEffect(() => setInstallable(!isInstalled()), []);
  if (!user) return null;
  const name = user.employee?.fullName ?? user.email;
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 rounded-full" aria-label="Account menu">
          <UserAvatar name={name} className="h-7 w-7" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel><span className="block truncate">{name}</span><span className="block truncate text-fine font-normal text-muted-foreground">{user.email}</span></DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onSelect={() => router.push('/me/profile')}><UserRound className="mr-2 h-4 w-4" />My profile</DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onSelect={() => router.push('/change-password')}><KeyRound className="mr-2 h-4 w-4" />Change password</DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer" onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
          {resolvedTheme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}{resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* opened after the menu has closed, so focus is not pulled back to the trigger under the tour */}
        <DropdownMenuItem className="cursor-pointer" onSelect={() => window.setTimeout(startTour, 150)}><Compass className="mr-2 h-4 w-4" />Take the tour</DropdownMenuItem>
        {setup.data && !setup.data.complete && (
          <DropdownMenuItem className="cursor-pointer" onSelect={() => { setGuideHidden(user.company.id, false); router.push('/dashboard'); }}><ListChecks className="mr-2 h-4 w-4" />Setup guide ({setup.data.done}/{setup.data.total})</DropdownMenuItem>
        )}
        {installable && (
          <DropdownMenuItem className="cursor-pointer" onSelect={() => window.setTimeout(() => setInstallOpen(true), 150)}><Download className="mr-2 h-4 w-4" />Install the app</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onSelect={async () => { await logout(); router.replace('/login'); }}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <InstallAppDialog open={installOpen} onOpenChange={setInstallOpen} />
    </>
  );
}
