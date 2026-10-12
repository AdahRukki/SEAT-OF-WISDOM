import type { Express, RequestHandler } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { AnalyticsError } from './analytics-repository';
import type { GeneralSchoolAnalytics, GeneralSchoolReport } from './general-school-analytics';

export function registerAnalyticsRoutes(app: Express, authenticate: RequestHandler, requireMainAdmin: RequestHandler, reporting: GeneralSchoolAnalytics) {
  const sections = ['overview', 'population', 'admissions', 'withdrawals', 'finance', 'academics', 'attendance'] as const;
  for (const section of sections) {
    app.get(`/api/admin/analytics/${section}`, authenticate, requireMainAdmin, async (req, res) => {
      try {
        const report: GeneralSchoolReport = await reporting.report(req.query);
        res.setHeader('Cache-Control', 'private, no-store');
        res.json(section === 'overview' ? report : { meta: report.meta, [section]: report[section] });
      } catch (error) { respondError(res, error); }
    });
  }
  app.get('/api/admin/analytics/comparison', authenticate, requireMainAdmin, async (req, res) => {
    try { res.setHeader('Cache-Control', 'private, no-store'); res.json(await reporting.compare(req.query)); }
    catch (error) { respondError(res, error); }
  });
  app.get('/api/admin/analytics/periods', authenticate, requireMainAdmin, async (req, res) => {
    try { res.setHeader('Cache-Control', 'private, no-store'); res.json(await reporting.availablePeriods(req.query)); }
    catch (error) { respondError(res, error); }
  });
}

function respondError(res: Parameters<RequestHandler>[1], error: unknown) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid reporting filters', code: 'INVALID_REPORT_FILTERS', issues: error.issues });
  if (error instanceof AnalyticsError) return res.status(error.status).json({ error: error.message, code: error.code || (error.status === 404 ? 'INVALID_REPORT_SCOPE' : 'REPORT_UNAVAILABLE'), ...(error.details ? { details: error.details } : {}) });
  const reference = randomUUID();
  console.error(`General School reporting failed [${reference}]:`, error);
  return res.status(500).json({ error: 'The management report could not be generated', code: 'REPORT_GENERATION_FAILED', reference });
}
