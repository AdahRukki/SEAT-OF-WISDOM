// Type-only contracts: browser bundles never load the reporting service or database.
import type { GeneralSchoolAnalytics, GeneralSchoolReport } from '../server/general-school-analytics';
export type AnalyticsReport = GeneralSchoolReport;
export type AnalyticsPeriods = Awaited<ReturnType<GeneralSchoolAnalytics['availablePeriods']>>;
export type AnalyticsComparison = Awaited<ReturnType<GeneralSchoolAnalytics['compare']>>;
