import { z } from 'zod';

export const ANALYTICS_TERMS = ['First Term', 'Second Term', 'Third Term'] as const;
const session = z.string().regex(/^\d{4}\/\d{4}$/).refine(value => Number(value.slice(5)) === Number(value.slice(0, 4)) + 1, 'Use consecutive academic years');
const date = z.string().date();
export const analyticsFiltersSchema = z.object({
  schoolId: z.string().uuid().optional(),
  schoolIds: z.preprocess(value => typeof value === 'string' ? value.split(',') : value, z.array(z.string().uuid()).min(1).max(20)).optional(),
  classId: z.string().trim().min(1).max(50).optional(),
  session: session.optional(),
  term: z.enum(ANALYTICS_TERMS).optional(),
  dateFrom: date.optional(),
  dateTo: date.optional(),
  passThreshold: z.coerce.number().min(0).max(100).default(40),
}).strict().superRefine((value, ctx) => {
  if (value.schoolId && value.schoolIds) ctx.addIssue({ code: 'custom', message: 'Choose schoolId or schoolIds', path: ['schoolIds'] });
  if (value.term && !value.session) ctx.addIssue({ code: 'custom', message: 'A term requires an academic session', path: ['session'] });
  if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) ctx.addIssue({ code: 'custom', message: 'dateTo must follow dateFrom', path: ['dateTo'] });
  if (value.schoolIds && new Set(value.schoolIds).size !== value.schoolIds.length) ctx.addIssue({ code: 'custom', message: 'Duplicate school IDs', path: ['schoolIds'] });
});
export type AnalyticsFilters = z.infer<typeof analyticsFiltersSchema>;
export type AcademicPeriod = { session: string; term: string };
export type DataCoverage = 'available' | 'partial' | 'unavailable';
export type MetricChange = { original: number | null; comparison: number | null; difference: number | null; percentageChange: number | null };

export const analyticsComparisonSchema = z.object({
  mode: z.enum(['term', 'session']),
  originalSession: session,
  originalTerm: z.enum(ANALYTICS_TERMS).optional(),
  comparisonSession: session,
  comparisonTerm: z.enum(ANALYTICS_TERMS).optional(),
  schoolId: z.string().uuid().optional(),
  schoolIds: z.preprocess(value => typeof value === 'string' ? value.split(',') : value, z.array(z.string().uuid()).min(1).max(20)).optional(),
  classId: z.string().trim().min(1).max(50).optional(),
  passThreshold: z.coerce.number().min(0).max(100).default(40),
}).strict().superRefine((value, ctx) => {
  if (value.mode === 'term' && (!value.originalTerm || !value.comparisonTerm)) ctx.addIssue({ code: 'custom', message: 'Term comparison requires both terms' });
  if (value.mode === 'session' && (!!value.originalTerm !== !!value.comparisonTerm)) ctx.addIssue({ code: 'custom', message: 'Supply both corresponding terms or neither' });
  if (value.schoolId && value.schoolIds) ctx.addIssue({ code: 'custom', message: 'Choose schoolId or schoolIds' });
  if (value.schoolIds && new Set(value.schoolIds).size !== value.schoolIds.length) ctx.addIssue({ code: 'custom', message: 'Duplicate school IDs' });
});
export type AnalyticsComparisonFilters = z.infer<typeof analyticsComparisonSchema>;

export function previousPeriod(period: AcademicPeriod): AcademicPeriod {
  const index = ANALYTICS_TERMS.indexOf(period.term as typeof ANALYTICS_TERMS[number]);
  return index > 0 ? { session: period.session, term: ANALYTICS_TERMS[index - 1] }
    : { session: `${Number(period.session.slice(0, 4)) - 1}/${Number(period.session.slice(5)) - 1}`, term: 'Third Term' };
}

export function metricChange(original: number | null, comparison: number | null): MetricChange {
  if (original === null || comparison === null) return { original, comparison, difference: null, percentageChange: null };
  const difference = comparison - original;
  return { original, comparison, difference, percentageChange: original === 0 ? null : Math.round(difference / original * 10000) / 100 };
}
