import type { AnalyticsFilters, AnalyticsComparisonFilters } from '@shared/general-school-analytics';

import type { MetricUnit } from '@shared/analytics-metrics';
export type { MetricUnit } from '@shared/analytics-metrics';
export { COMPARISON_METRICS } from '@shared/analytics-metrics';
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
