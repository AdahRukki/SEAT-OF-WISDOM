import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiRequest } from '@/lib/queryClient';
import { analyticsQuery } from '@/lib/analytics-display';
import { ANALYTICS_TERMS, analyticsFiltersSchema, type AnalyticsFilters } from '@shared/general-school-analytics';
import type { AnalyticsReport, AnalyticsPeriods } from '@shared/general-school-analytics-contracts';
import { REPORT_SECTIONS, ReportSections, type ReportSection } from './report-sections';
import { HistoricalComparisons } from './historical-comparisons';
import { ExportControls } from './export-controls';
import { buildAnalyticsExport, EXPORT_REPORTS, type ExportReport } from '@shared/analytics-export';

const current: AnalyticsFilters = { passThreshold: 40 };
export default function GeneralSchoolAnalytics({ userId }: { userId: string }) {
  const [draft, setDraft] = useState<AnalyticsFilters>(current);
  const [filters, setFilters] = useState<AnalyticsFilters>(current);
  const [filterError, setFilterError] = useState('');
  const [section, setSection] = useState<ReportSection>('overview');
  const [exportKind, setExportKind] = useState<Exclude<ExportReport, 'comparison'>>('overview');
  const request = analyticsQuery(filters);
  const metadata = useQuery<AnalyticsPeriods>({ queryKey: ['/api/admin/analytics/periods', userId], queryFn: () => apiRequest('/api/admin/analytics/periods'), staleTime: 0, gcTime: 0 });
  const report = useQuery<AnalyticsReport>({ queryKey: ['/api/admin/analytics/overview', userId, request], queryFn: () => apiRequest(`/api/admin/analytics/overview?${request}`), staleTime: 0, gcTime: 0 });
  const sessions = Array.from(new Set(metadata.data?.periods.map(p => p.session))).sort().reverse();
  const branches = metadata.data?.schools || [];
  const classes = metadata.data?.classes.filter(c => !draft.schoolIds || draft.schoolIds.includes(c.schoolId)) || [];
  const filtersChanged = analyticsQuery(draft) !== request;
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const parsed = analyticsFiltersSchema.safeParse(draft);
    if (!parsed.success) { setFilterError(parsed.error.issues.map(issue => issue.message).join('. ')); return; }
    setFilterError('');
    if (analyticsQuery(parsed.data) === request) void report.refetch();
    else setFilters(parsed.data);
  };
  const setSchool = (id: string, checked: boolean) => {
    const selected = new Set(draft.schoolIds || branches.map(s => s.id));
    if (checked) selected.add(id); else selected.delete(id);
    setDraft({ ...draft, classId: undefined, schoolIds: selected.size === branches.length ? undefined : Array.from(selected) });
  };
  const refresh = () => { void report.refetch(); void metadata.refetch(); };
  return <section className="min-w-0 space-y-5" aria-label="General School analytics">
    <Card><CardContent className="space-y-4 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Reporting filters</h2><Button variant="outline" size="sm" onClick={refresh} disabled={report.isFetching || metadata.isFetching}><RefreshCw className="mr-2 h-4 w-4" />Refresh reports</Button></div>
      {metadata.isPending && <p role="status" className="text-sm">Loading reporting periods…</p>}
      {metadata.isError && <div role="alert" className="flex flex-wrap items-center gap-3 text-sm"><p>Reporting periods could not be loaded.</p><Button variant="outline" size="sm" onClick={() => void metadata.refetch()}>Retry periods</Button></div>}
      <form onSubmit={apply} className="space-y-4"><fieldset><legend className="mb-2 text-sm font-medium">Schools to include</legend><div className="flex flex-wrap gap-3"><Button type="button" variant={!draft.schoolIds ? 'default' : 'outline'} size="sm" onClick={() => setDraft({ ...draft, schoolIds: undefined, classId: undefined })}>All Schools</Button>{branches.map(s => <label key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><input type="checkbox" checked={!draft.schoolIds || draft.schoolIds.includes(s.id)} onChange={event => setSchool(s.id, event.target.checked)} />{s.name}</label>)}</div></fieldset>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm font-medium">Academic session<select aria-label="Academic session" value={draft.session || ''} onChange={event => setDraft({ ...draft, session: event.target.value || undefined, term: undefined })} className="mt-1 block w-full rounded-md border bg-background px-3 py-2"><option value="">Each school’s current period</option>{sessions.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label className="block text-sm font-medium">Academic term<select aria-label="Academic term" disabled={!draft.session} value={draft.term || ''} onChange={event => setDraft({ ...draft, term: (event.target.value || undefined) as AnalyticsFilters['term'] })} className="mt-1 block w-full rounded-md border bg-background px-3 py-2 disabled:opacity-50"><option value="">{draft.session ? 'Whole session' : 'Current school term'}</option>{ANALYTICS_TERMS.map(t => <option key={t} value={t}>{t}</option>)}</select></label>
          <label className="block text-sm font-medium">Class<select aria-label="Class" value={draft.classId || ''} onChange={event => setDraft({ ...draft, classId: event.target.value || undefined })} className="mt-1 block w-full rounded-md border bg-background px-3 py-2"><option value="">All classes</option>{classes.map(c => <option key={c.id} value={c.id}>{branches.find(s => s.id === c.schoolId)?.name} · {c.name}</option>)}</select></label>
          <label className="block text-sm font-medium">Date from (UTC)<input aria-label="Date from (UTC)" type="date" value={draft.dateFrom || ''} onChange={event => setDraft({ ...draft, dateFrom: event.target.value || undefined })} className="mt-1 block w-full min-w-0 rounded-md border bg-background px-3 py-2" /></label>
          <label className="block text-sm font-medium">Date to (UTC)<input aria-label="Date to (UTC)" type="date" value={draft.dateTo || ''} onChange={event => setDraft({ ...draft, dateTo: event.target.value || undefined })} className="mt-1 block w-full min-w-0 rounded-md border bg-background px-3 py-2" /></label>
          <label className="block text-sm font-medium">Pass threshold / 100<input aria-label="Pass threshold / 100" required type="number" min="0" max="100" step="0.1" value={draft.passThreshold} onChange={event => setDraft({ ...draft, passThreshold: event.target.valueAsNumber })} className="mt-1 block w-full rounded-md border bg-background px-3 py-2" /></label>
        </div><p className="text-xs leading-relaxed text-muted-foreground">Dates filter admissions, withdrawals and payment receipts only. Population, tuition balances, assessments and attendance use the selected academic period. A class filter uses that school’s recorded class membership.</p>
        {filterError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{filterError}</p>}
        <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={report.isFetching || draft.schoolIds?.length === 0}>Apply filters</Button><Button type="button" variant="outline" onClick={() => { setDraft(current); setFilters(current); setFilterError(''); }}>Reset filters</Button>{draft.schoolIds?.length === 0 ? <p role="status" className="text-sm">Select at least one school.</p> : filtersChanged && <p role="status" className="text-sm text-amber-800 dark:text-amber-200">Filters changed. Apply filters to update the figures.</p>}</div>
      </form>
    </CardContent></Card>
    <nav aria-label="Analytics sections" className="flex flex-wrap gap-2">{REPORT_SECTIONS.map(([id, label]) => <Button key={id} variant={section === id ? 'default' : 'outline'} size="sm" aria-pressed={section === id} onClick={() => { setSection(id); if (id !== 'comparisons') setExportKind(id in EXPORT_REPORTS ? id as Exclude<ExportReport, 'comparison'> : 'overview'); }}>{label}</Button>)}</nav>
    {report.isError && <Card><CardContent className="space-y-3 p-6"><p role="alert">Management reports could not be loaded. Historical records may need to be prepared before reports become available.</p><Button variant="outline" onClick={() => void report.refetch()}>Retry reports</Button></CardContent></Card>}
    {report.isFetching && <p role="status" className="rounded-lg border bg-white p-6 dark:bg-slate-900">Loading management reports…</p>}
    {report.data && !report.isError && !report.isFetching && <>
      <div className="space-y-1 text-sm text-muted-foreground" aria-label="Applied report scope"><p>{report.data.meta.selectedSchools.map(s => s.name).join(' · ') || 'No schools in scope'} · {filters.session ? `${filters.session} · ${filters.term || 'Whole session'}` : 'Each school’s current academic period'}{filters.classId ? ` · ${metadata.data?.classes.find(c => c.id === filters.classId)?.name || 'Selected class'}` : ' · All classes'}</p><p>Report generated {new Date(report.data.meta.generatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC{filters.dateFrom || filters.dateTo ? ` · Event/receipt dates: ${filters.dateFrom || 'Any'} to ${filters.dateTo || 'Any'}` : ''}</p></div>
      {section !== 'comparisons' && <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border bg-white p-4 dark:bg-slate-900"><div className="min-w-0 space-y-2"><label className="block text-sm font-medium">Management report<select aria-label="Management report" value={exportKind} onChange={event => setExportKind(event.target.value as typeof exportKind)} className="mt-1 block w-full max-w-full rounded-md border bg-background px-3 py-2">{Object.entries(EXPORT_REPORTS).filter(([id]) => id !== 'comparison').map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><p className="text-xs text-muted-foreground">Uses the displayed report and applied filters. Registers include all returned records.</p></div><ExportControls disabled={filtersChanged} makeDocument={() => buildAnalyticsExport(report.data!, exportKind, metadata.data)} /></div>}
      {section === 'comparisons' ? metadata.data ? <HistoricalComparisons key={request} metadata={metadata.data} scope={filters} userId={userId} /> : <p className="text-sm text-muted-foreground">Load reporting periods to compare historical results.</p> : <ReportSections key={`${section}:${request}`} section={section} report={report.data} />}
    </>}
  </section>;
}
