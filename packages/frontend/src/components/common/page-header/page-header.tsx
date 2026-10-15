'use client';
import * as React from 'react';
import Link from 'next/link';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

/** A secondary page action: a link (`href`, `external` opens a new tab) or a command (`onSelect`). */
export interface MoreAction { label: string; icon?: LucideIcon; href?: string; external?: boolean; onSelect?: () => void }

/**
 * Page title in display-md (34px / 600 / -0.374px), iOS Large Title grammar, a one-line description in muted text,
 * the primary action on the right and any secondary actions in a "More" menu beside it. Every page uses this; none
 * builds its own header.
 */
export function PageHeader({ title, description, actions, more }: { title: string; description?: string; actions?: React.ReactNode; more?: MoreAction[] }) {
  const menu = more?.filter(Boolean) ?? [];
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-display-sm font-semibold sm:text-title">{title}</h1>
        {description && <p className="mt-1.5 max-w-[65ch] text-body text-muted-foreground">{description}</p>}
      </div>
      {(actions || menu.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {menu.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11 rounded-full" aria-label="More actions"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {menu.map((m) => {
                  const body = <>{m.icon && <m.icon className="mr-2 h-4 w-4" aria-hidden />}{m.label}</>;
                  if (m.href) {
                    return (
                      <DropdownMenuItem key={m.label} asChild>
                        {m.external ? <a href={m.href} target="_blank" rel="noreferrer">{body}</a> : <Link href={m.href}>{body}</Link>}
                      </DropdownMenuItem>
                    );
                  }
                  return <DropdownMenuItem key={m.label} onSelect={m.onSelect}>{body}</DropdownMenuItem>;
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </div>
  );
}
