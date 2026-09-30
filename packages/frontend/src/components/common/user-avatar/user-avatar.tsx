import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return <Avatar className={cn('h-8 w-8', className)}><AvatarFallback className="bg-accent text-fine font-semibold text-accent-foreground">{initials(name)}</AvatarFallback></Avatar>;
}
