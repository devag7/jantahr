'use client';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export const CHART_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--chart-6))'];
const axis = { stroke: 'hsl(var(--muted-foreground))', fontSize: 12 } as const;
const tooltipStyle = { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 } as const;

/**
 * Charts are drawn as SVG that screen readers cannot read, so each one is an image whose name states its numbers:
 * "Headcount by department: Engineering 6, Finance 2". Colours come from the chart tokens (one hue plus neutrals).
 */
function Described({ label, summary, children }: { label: string; summary: string; children: React.ReactNode }) {
  return <div role="img" aria-label={`${label}: ${summary}`}>{children}</div>;
}
const countsOf = (data: { name: string; count: number }[]) => data.map((d) => `${d.name} ${d.count}`).join(', ');

export function DonutChart({ data, label, height = 220 }: { data: { name: string; count: number }[]; label: string; height?: number }) {
  return (
    <Described label={label} summary={countsOf(data)}><ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2}>
          {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer></Described>
  );
}

export function HBarChart({ data, label, height = 240 }: { data: { name: string; count: number }[]; label: string; height?: number }) {
  return (
    <Described label={label} summary={countsOf(data)}><ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
        <XAxis type="number" allowDecimals={false} {...axis} />
        <YAxis type="category" dataKey="name" width={110} {...axis} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted))' }} />
        <Bar dataKey="count" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer></Described>
  );
}

export function GroupedBarChart({ data, keys, xKey, label, height = 260, formatValue }: { data: Record<string, string | number>[]; keys: { key: string; label: string }[]; xKey: string; label: string; height?: number; formatValue?: (n: number) => string }) {
  const summary = data.map((row) => `${row[xKey]} ${keys.map((k) => `${k.label} ${formatValue ? formatValue(Number(row[k.key])) : row[k.key]}`).join(', ')}`).join('; ');
  return (
    <Described label={label} summary={summary}><ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 0, right: 8 }}>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey={xKey} {...axis} />
        <YAxis {...axis} tickFormatter={formatValue} width={56} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => (formatValue ? formatValue(v) : v)} cursor={{ fill: 'hsl(var(--muted))' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => <Bar key={k.key} dataKey={k.key} name={k.label} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />)}
      </BarChart>
    </ResponsiveContainer></Described>
  );
}
