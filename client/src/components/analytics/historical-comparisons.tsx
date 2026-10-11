import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { analyticsQuery, COMPARISON_METRICS, formatMetric as f } from '@/lib/analytics-display';
import { ANALYTICS_TERMS, type AnalyticsComparisonFilters, type AnalyticsFilters } from '@shared/general-school-analytics';
import type { AnalyticsComparison, AnalyticsPeriods } from '@shared/general-school-analytics-contracts';
import { Coverage, Note, ReportChart, ReportPanel, ReportTable } from './report-elements';
import { ExportControls } from './export-controls';
import { buildComparisonExport } from '@shared/analytics-export';

export function HistoricalComparisons({ metadata, scope, userId }: { metadata: AnalyticsPeriods; scope: AnalyticsFilters; userId: string }) {
  const sessions = Array.from(new Set(metadata.periods.map(p => p.session))).sort().reverse();
  const [mode, setMode] = useState<'term' | 'session'>('term');
  const [originalSession, setOriginalSession] = useState(sessions[1] || sessions[0] || '');
  const [comparisonSession, setComparisonSession] = useState(sessions[0] || '');
  const [originalTerm, setOriginalTerm] = useState<typeof ANALYTICS_TERMS[number]>('First Term');
  const [comparisonTerm, setComparisonTerm] = useState<typeof ANALYTICS_TERMS[number]>('First Term');
  const [corresponding, setCorresponding] = useState(false);
  const [metric, setMetric] = useState('activePopulation');
  const [submitted, setSubmitted] = useState<AnalyticsComparisonFilters | null>(null);
  const request = submitted ? analyticsQuery(submitted) : '';
  const query = useQuery<AnalyticsComparison>({ queryKey: ['/api/admin/analytics/comparison', userId, request], queryFn: () => apiRequest(`/api/admin/analytics/comparison?${request}`), enabled: !!submitted, staleTime: 0, gcTime: 0 });
  const apply = (event: FormEvent) => {
    event.preventDefault();
    const input: AnalyticsComparisonFilters = { mode, originalSession, comparisonSession, schoolId: scope.schoolId, schoolIds: scope.schoolIds, classId: scope.classId, passThreshold: scope.passThreshold };
    if (mode === 'term' || corresponding) { input.originalTerm = originalTerm; input.comparisonTerm = comparisonTerm; }
    if (analyticsQuery(input) === request) void query.refetch();
    else setSubmitted(input);
  };
  const controlsChanged = !!submitted && (submitted.mode !== mode || submitted.originalSession !== originalSession || submitted.comparisonSession !== comparisonSession || submitted.originalTerm !== (mode === 'term' || corresponding ? originalTerm : undefined) || submitted.comparisonTerm !== (mode === 'term' || corresponding ? comparisonTerm : undefined));
  const selectedMetric = COMPARISON_METRICS[metric];
  const result = query.data;
  const originalLabel = submitted ? `${submitted.originalSession}${submitted.originalTerm ? ` · ${submitted.originalTerm}` : ' · Whole session'}` : '';
  const comparedLabel = submitted ? `${submitted.comparisonSession}${submitted.comparisonTerm ? ` · ${submitted.comparisonTerm}` : ' · Whole session'}` : '';
  return <ReportPanel title="Historical Comparisons" description="Compare two terms across any recorded sessions, or compare whole sessions and corresponding terms.">
    <form onSubmit={apply} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ComparisonSelect label="Comparison mode" value={mode} onChange={value => setMode(value as typeof mode)} options={[['term', 'Term comparison'], ['session', 'Session comparison']]} />
      <ComparisonSelect label="Original session" value={originalSession} onChange={setOriginalSession} options={sessions.map(s => [s, s])} />
      <ComparisonSelect label="Comparison session" value={comparisonSession} onChange={setComparisonSession} options={sessions.map(s => [s, s])} />
      {(mode === 'term' || corresponding) && <><ComparisonSelect label="Original term" value={originalTerm} onChange={value => setOriginalTerm(value as typeof originalTerm)} options={ANALYTICS_TERMS.map(s => [s, s])} /><ComparisonSelect label="Comparison term" value={comparisonTerm} onChange={value => setComparisonTerm(value as typeof comparisonTerm)} options={ANALYTICS_TERMS.map(s => [s, s])} /></>}
      <ComparisonSelect label="Comparison metric" value={metric} onChange={setMetric} options={Object.entries(COMPARISON_METRICS).map(([id, definition]) => [id, definition.label])} />
    </div>{mode === 'session' && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={corresponding} onChange={event => setCorresponding(event.target.checked)} />Compare corresponding terms within sessions</label>}
      <Button type="submit" disabled={!sessions.length || query.isFetching}>{query.isFetching ? 'Comparing…' : 'Compare periods'}</Button>
    </form>
    <p className="text-sm text-muted-foreground">Uses the applied school and class filters and pass threshold. Date ranges do not apply to historical comparisons.</p>
    {!sessions.length && <Note>No recorded academic periods are available to compare.</Note>}
    {controlsChanged && <p role="status" className="text-sm text-amber-800 dark:text-amber-200">Comparison settings changed. Select Compare periods to update the results.</p>}
    {query.isError && <div role="alert" className="space-y-3"><p>Historical comparison could not be loaded. Please try again.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry comparison</Button></div>}
    {query.isFetching && <p role="status">Loading historical comparison…</p>}
    {result && !query.isError && !query.isFetching && <div className="space-y-5" aria-label="Comparison results"><p className="font-medium">{originalLabel} → {comparedLabel}</p>
      <ExportControls disabled={controlsChanged} makeDocument={() => buildComparisonExport(result, metadata)} />
      <Note>N/A means the baseline or comparison evidence is unavailable. Percentage change needs a non-zero original value. Academic scores remain provisional; event comparisons require verified history. Changes in rate metrics use percentage points for the absolute difference.</Note>
      <ReportTable caption="Combined historical comparison" columns={['Metric', 'Original value', 'Comparison value', 'Absolute difference', 'Percentage change']} rows={Object.entries(COMPARISON_METRICS).map(([id, definition]) => { const change = result.metrics[id]; return [definition.label, f(change?.original, definition.unit), f(change?.comparison, definition.unit), change?.difference == null ? 'N/A' : `${f(change.difference, definition.unit === 'percent' ? 'number' : definition.unit)}${definition.unit === 'percent' ? ' pp' : ''}`, f(change?.percentageChange, 'percent')]; })} />
      <ReportChart title={`${selectedMetric.label} comparison by school`} unit={selectedMetric.unit} compared rows={result.bySchool.map(s => ({ name: s.schoolName, value: s.metrics[metric]?.original ?? null, comparison: s.metrics[metric]?.comparison ?? null }))} />
      <ReportTable caption={`${selectedMetric.label} changes by school`} columns={['School', 'Original', 'Comparison', 'Absolute difference', 'Percentage change']} rows={result.bySchool.map(s => { const change = s.metrics[metric]; return [s.schoolName, f(change?.original, selectedMetric.unit), f(change?.comparison, selectedMetric.unit), change?.difference == null ? 'N/A' : `${f(change.difference, selectedMetric.unit === 'percent' ? 'number' : selectedMetric.unit)}${selectedMetric.unit === 'percent' ? ' pp' : ''}`, f(change?.percentageChange, 'percent')]; })} />
      <details className="rounded-lg border p-4"><summary className="cursor-pointer font-medium">Comparison data coverage</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{(['original', 'comparison'] as const).map(period => <div key={period}><h3 className="mb-2 font-medium">{period === 'original' ? originalLabel : comparedLabel}</h3><div className="space-y-2">{Object.entries(result.coverage[period]).map(([name, coverage]) => <div key={name} className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="capitalize">{name}</span><Coverage value={coverage} /></div>)}</div></div>)}</div></details>
    </div>}
  </ReportPanel>;
}
function ComparisonSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="block text-sm font-medium">{label}<select aria-label={label} required value={value} onChange={event => onChange(event.target.value)} className="mt-1 block w-full min-w-0 rounded-md border bg-background px-3 py-2">{!options.length && <option value="">No recorded sessions</option>}{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}
