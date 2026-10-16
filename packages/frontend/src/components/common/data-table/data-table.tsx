'use client';
import * as React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/states';
import { Pagination } from '@/components/common/pagination';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  hideOnMobile?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T) => void;
  page?: { page: number; totalPages: number; total: number; onChange: (p: number) => void };
  dense?: boolean;
  bare?: boolean;
  /** Below 768px each row becomes a card (first column as its title, the others as label and value, a column with
   * an empty header as a full-width action row), so lists people act on from a phone keep their buttons on screen. */
  stackOnMobile?: boolean;
}

export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, emptyTitle = 'Nothing here yet', emptyDescription, emptyAction, onRowClick, page, dense, bare, stackOnMobile }: Props<T>) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading && !rows) return <LoadingBlock rows={5} />;
  if (!rows?.length) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  const align = (a?: string) => (a === 'right' ? 'text-right tabular whitespace-nowrap' : a === 'center' ? 'text-center' : 'text-left');
  // Desktop (1024+): the header row stays under the app's two bars while the page scrolls. Smaller screens: the
  // table scrolls sideways inside its card with the first column pinned, so a row never loses its name.
  // Separate borders: a sticky header cell carries its own bottom border, which a collapsed border would leave behind.
  const pin = (i: number) => i === 0 && 'max-lg:sticky max-lg:left-0 max-lg:z-[1] max-lg:min-w-[9.5rem] max-lg:bg-card';
  // text columns keep a readable width and the table scrolls, rather than wrapping a phrase one word per line
  const room = (c: Column<T>, i: number) => i > 0 && (!c.align || c.align === 'left') && 'max-lg:min-w-[8rem]';
  const table = (
    <Table className="border-separate border-spacing-0" containerClassName="lg:overflow-visible">
      <TableHeader className="[&_tr]:border-0">
        <TableRow className="hover:bg-transparent">
          {columns.map((c, i) => (
            <TableHead key={c.key} scope="col" className={cn(dense ? 'h-9' : 'h-10', 'whitespace-nowrap border-b border-border bg-card text-fine font-semibold lg:sticky lg:top-[96px] lg:z-10', align(c.align), pin(i), room(c, i), i === 0 && 'max-lg:z-[2]', c.hideOnMobile && 'hidden md:table-cell', c.className)}>{c.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="[&_tr:last-child_td]:border-0">
        {rows.map((row) => (
          <TableRow key={rowKey(row)} className={cn('border-0', onRowClick && 'cursor-pointer')} onClick={onRowClick ? () => onRowClick(row) : undefined}>
            {columns.map((c, i) => <TableCell key={c.key} className={cn(dense ? 'px-4 py-1.5' : 'px-4 py-2.5', 'border-b border-divider', align(c.align), pin(i), room(c, i), c.hideOnMobile && 'hidden md:table-cell', c.className)}>{c.cell(row)}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  const [title, ...rest] = columns;
  const stacked = stackOnMobile && (
    <ul className="divide-y divide-divider md:hidden">
      {rows.map((row) => (
        <li key={rowKey(row)} className={cn('space-y-3 px-4 py-4', onRowClick && 'cursor-pointer')} onClick={onRowClick ? () => onRowClick(row) : undefined}>
          <div className="text-caption">{title.cell(row)}</div>
          <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-4 gap-y-1.5 text-caption">
            {rest.filter((c) => c.header !== '').map((c) => (
              <React.Fragment key={c.key}><dt className="text-muted-foreground">{c.header}</dt><dd className={cn('min-w-0', c.align === 'right' && 'tabular')}>{c.cell(row)}</dd></React.Fragment>
            ))}
          </dl>
          {/* actions get the full width and 44px buttons, in reach of the thumb */}
          {rest.filter((c) => c.header === '').map((c) => <div key={c.key} className="[&>div]:w-full [&_button]:h-11 [&_button]:flex-1">{c.cell(row)}</div>)}
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cn(loading && 'opacity-60 transition-opacity')}>
      {/* clip, not hidden: a hidden overflow would make the card a scroll container and unstick the header */}
      {stacked ? (
        bare ? <>{stacked}<div className="max-md:hidden">{table}</div></> : <Card className="overflow-clip">{stacked}<div className="max-md:hidden">{table}</div></Card>
      ) : bare ? table : <Card className="overflow-clip">{table}</Card>}
      {page && page.totalPages > 1 && <Pagination {...page} />}
    </div>
  );
}
