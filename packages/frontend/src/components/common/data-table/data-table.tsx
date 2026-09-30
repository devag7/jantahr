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
}

export function DataTable<T>({ columns, rows, rowKey, loading, error, onRetry, emptyTitle = 'Nothing here yet', emptyDescription, emptyAction, onRowClick, page, dense, bare }: Props<T>) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading && !rows) return <LoadingBlock rows={5} />;
  if (!rows?.length) return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;

  const align = (a?: string) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');
  const table = (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((c) => (
            <TableHead key={c.key} className={cn(dense ? 'h-9' : 'h-10', 'whitespace-nowrap text-fine font-semibold', align(c.align), c.hideOnMobile && 'hidden md:table-cell', c.className)}>{c.header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={rowKey(row)} className={cn(onRowClick && 'cursor-pointer')} onClick={onRowClick ? () => onRowClick(row) : undefined}>
            {columns.map((c) => <TableCell key={c.key} className={cn(dense ? 'px-4 py-1.5' : 'px-4 py-2.5', align(c.align), c.hideOnMobile && 'hidden md:table-cell', c.className)}>{c.cell(row)}</TableCell>)}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
  return (
    <div className={cn(loading && 'opacity-60 transition-opacity')}>
      {bare ? table : <Card className="overflow-hidden">{table}</Card>}
      {page && page.totalPages > 1 && <Pagination {...page} />}
    </div>
  );
}
