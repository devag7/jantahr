'use client';
import { useRouter } from 'next/navigation';
import { KeyRound, LogOut, Moon, Sun, UserRound } from 'lucide-react';
import { useTheme } from 'next-themes';
import { UserAvatar } from '@/components/common/user-avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/auth/use-auth';
import { useAuthStore } from '@/stores/auth/auth-store';

export function UserMenu() {
  const router = useRouter();
  const { user } = useAuth();
  const logout = useAuthStore((s) => s.logout);
  const { resolvedTheme, setTheme } = useTheme();
  if (!user) return null;
  const name = user.employee?.fullName ?? user.email;
  return (
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
        <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onSelect={async () => { await logout(); router.replace('/login'); }}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
