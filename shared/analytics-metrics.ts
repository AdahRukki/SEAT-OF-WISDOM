export type MetricUnit = 'number' | 'money' | 'percent';
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
