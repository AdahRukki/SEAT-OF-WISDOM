import { useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { formatMetric, type MetricUnit } from '@/lib/analytics-display';
import type { DataCoverage } from '@shared/general-school-analytics';

export function Coverage({ value }: { value: DataCoverage }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${value === 'available' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>
    {value === 'available' ? 'Available records' : value === 'partial' ? 'Partial records' : 'Unavailable'}
  </span>;
}
export function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">{children}</p>;
}
export function ReportPanel({ title, coverage, children, description }: { title: string; coverage?: DataCoverage; children: ReactNode; description?: string }) {
  return <Card className="min-w-0"><CardHeader className="gap-2"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">{title}</h2>{coverage && <Coverage value={coverage} />}</div>{description && <p className="text-sm text-muted-foreground">{description}</p>}</CardHeader><CardContent className="min-w-0 space-y-5">{children}</CardContent></Card>;
}
export function Metric({ label, value, unit, detail }: { label: string; value: number | null; unit?: MetricUnit; detail?: string }) {
  return <div className="min-w-0 rounded-xl border bg-white p-4 dark:bg-slate-900"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 break-words text-2xl font-bold tracking-tight tabular-nums">{formatMetric(value, unit)}</p>{detail && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p>}</div>;
}
export function Metrics({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>;
}
export function ReportTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: ReactNode[][] }) {
  return <div className="max-w-full overflow-x-auto rounded-lg border" tabIndex={0} role="region" aria-label={caption}>
    <table className="w-full text-left text-sm"><caption className="sr-only">{caption}</caption><thead className="bg-slate-50 dark:bg-slate-900"><tr>{columns.map(column => <th key={column} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{column}</th>)}</tr></thead>
      <tbody>{rows.length ? rows.map((cells, i) => <tr key={i} className="border-t">{cells.map((cell, j) => <td key={j} className="px-4 py-3 align-top tabular-nums">{cell}</td>)}</tr>) : <tr><td colSpan={columns.length} className="p-6 text-muted-foreground">No records match these filters.</td></tr>}</tbody>
    </table>
  </div>;
}
export type RegisterRow = { key: string; search: string; cells: ReactNode[] };
export function Register({ title, columns, rows }: { title: string; columns: string[]; rows: RegisterRow[] }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const matched = rows.filter(row => row.search.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const totalPages = Math.max(1, Math.ceil(matched.length / 20));
  const currentPage = Math.min(page, totalPages - 1);
  return <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">{title}</h3><Input aria-label={`Search ${title}`} placeholder="Search name, student number or school" value={search} onChange={event => { setSearch(event.target.value); setPage(0); }} className="w-full sm:w-80" /></div>
    <ReportTable caption={title} columns={columns} rows={matched.slice(currentPage * 20, currentPage * 20 + 20).map(row => row.cells)} />
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p role="status">{matched.length} matching records · Page {currentPage + 1} of {totalPages}</p><div className="flex gap-2"><Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={currentPage + 1 >= totalPages} onClick={() => setPage(currentPage + 1)}>Next page</Button></div></div>
  </div>;
}
type ChartRow = { name: string; value: number | null; comparison?: number | null };
export function ReportChart({ title, rows, unit = 'number', trend = false, compared = false }: { title: string; rows: ChartRow[]; unit?: MetricUnit; trend?: boolean; compared?: boolean }) {
  const usable = rows.filter(row => row.value !== null || compared && row.comparison != null);
  const config = { value: { label: compared ? 'Original' : title, color: '#2563eb' }, comparison: { label: 'Comparison', color: '#10b981' } };
  return <section className="min-w-0 space-y-3" aria-label={title}><h3 className="font-semibold">{title}</h3>
    {usable.length ? <ChartContainer config={config} className="h-64 w-full" aria-label={`${title}; exact values in the table below`}>
      {trend ? <LineChart accessibilityLayer data={rows} margin={{ left: 8, right: 20, bottom: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="name" tickMargin={8} minTickGap={30} /><YAxis width={70} tickFormatter={value => unit === 'money' ? new Intl.NumberFormat('en', { notation: 'compact' }).format(value) : String(value)} /><ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <span>{String(name)}: {typeof value === 'number' ? formatMetric(value, unit) : String(value)}</span>} />} /><Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} connectNulls={false} isAnimationActive={false} /></LineChart>
        : <BarChart accessibilityLayer data={rows} margin={{ left: 8, right: 20, bottom: 8 }}><CartesianGrid vertical={false} /><XAxis dataKey="name" tickMargin={8} minTickGap={20} /><YAxis width={70} tickFormatter={value => unit === 'money' ? new Intl.NumberFormat('en', { notation: 'compact' }).format(value) : String(value)} /><ChartTooltip content={<ChartTooltipContent formatter={(value, name) => <span>{String(name)}: {typeof value === 'number' ? formatMetric(value, unit) : String(value)}</span>} />} /><Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} isAnimationActive={false} />{compared && <Bar dataKey="comparison" fill="var(--color-comparison)" radius={[4, 4, 0, 0]} isAnimationActive={false} />}</BarChart>}
    </ChartContainer> : <p className="py-6 text-sm text-muted-foreground">No verified values are available for this chart.</p>}
    {compared && <p className="text-xs text-muted-foreground">Blue: original period · Green: comparison period</p>}
    <details><summary className="cursor-pointer text-sm text-blue-700 dark:text-blue-300">View chart values</summary><div className="mt-3"><ReportTable caption={`${title} values`} columns={compared ? ['School / period', 'Original', 'Comparison'] : ['School / period', 'Value']} rows={rows.map(row => compared ? [row.name, formatMetric(row.value, unit), formatMetric(row.comparison, unit)] : [row.name, formatMetric(row.value, unit)])} /></div></details>
    {rows.some(row => row.value === null || compared && row.comparison == null) && <p className="text-xs text-muted-foreground">Unavailable values are omitted from the chart and shown as N/A in the table.</p>}
  </section>;
}
