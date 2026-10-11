import type { AnalyticsFilters, AnalyticsComparisonFilters } from '@shared/general-school-analytics';

export type MetricUnit = 'number' | 'money' | 'percent';
export function formatMetric(value: number | null | undefined, unit: MetricUnit = 'number'): string {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  if (unit === 'money') return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(value);
  return new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2 }).format(value) + (unit === 'percent' ? '%' : '');
}
export function analyticsQuery(filters: Partial<AnalyticsFilters | AnalyticsComparisonFilters>): string {
  const params = new URLSearchParams();
  Object.entries(filters).sort(([one], [two]) => one.localeCompare(two)).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && (!Array.isArray(value) || value.length)) params.set(key, Array.isArray(value) ? [...value].sort().join(',') : String(value));
  });
  return params.toString();
}
export const COMPARISON_METRICS: Record<string, { label: string; unit: MetricUnit }> = {
  activePopulation: { label: 'Active student population', unit: 'number' },
  recordedNewAdmissions: { label: 'New admissions', unit: 'number' },
  recordedWithdrawals: { label: 'Official withdrawals', unit: 'number' },
  confirmedRevenue: { label: 'Confirmed revenue', unit: 'money' },
  expectedTuition: { label: 'Expected tuition', unit: 'money' },
  outstandingTuition: { label: 'Outstanding tuition', unit: 'money' },
  collectionRate: { label: 'Tuition collection rate', unit: 'percent' },
  averageScore: { label: 'Average assessment score', unit: 'number' },
  passRate: { label: 'Pass rate', unit: 'percent' },
  attendancePercentage: { label: 'Attendance', unit: 'percent' },
};
