'use client';
import dynamic from 'next/dynamic';

/**
 * The chart library is about 100 kB of the dashboard's script. These load it after the page's numbers have rendered,
 * in a box of the chart's own height so nothing below moves, and never for someone whose page has no chart (the
 * employee's dashboard, the Android app's start page).
 */
const box = (height: number) => function ChartLoading() {
  return <div style={{ height }} className="animate-pulse rounded-md bg-muted" aria-hidden />;
};

export const DonutChart = dynamic(() => import('./charts').then((m) => m.DonutChart), { ssr: false, loading: box(220) });
export const HBarChart = dynamic(() => import('./charts').then((m) => m.HBarChart), { ssr: false, loading: box(240) });
export const GroupedBarChart = dynamic(() => import('./charts').then((m) => m.GroupedBarChart), { ssr: false, loading: box(260) });
