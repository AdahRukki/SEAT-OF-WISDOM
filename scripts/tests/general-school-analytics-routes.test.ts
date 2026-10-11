import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import express from 'express';
import { registerAnalyticsRoutes } from '../../server/analytics-routes';
import { analyticsFiltersSchema, analyticsComparisonSchema } from '../../shared/general-school-analytics';
import { AnalyticsError } from '../../server/analytics-repository';

// Use the production main-admin guard without initializing the live DB, email
// poller or other unrelated services in the large routes module.
const source = fs.readFileSync(new URL('../../server/routes.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('routes.ts', source, ts.ScriptTarget.Latest, true);
const statement = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === 'requireMainAdmin'))!;
const guardCode = ts.transpileModule(statement.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const guard = new Function(guardCode + ';return requireMainAdmin;')();

async function fixture() {
  let reads = 0;
  const app = express();
  const service = {
    report: async (input: unknown) => { const filters = analyticsFiltersSchema.parse(input); reads++; if (filters.classId === 'missing') throw new AnalyticsError('Class does not belong to the selected schools', 404);
      return { meta: { filters }, population: { combined: { activeEnrolled: 4 } }, admissions: {}, withdrawals: {}, finance: {}, academics: {}, attendance: {} }; },
    compare: async (input: unknown) => { analyticsComparisonSchema.parse(input); reads++; return { metrics: {} }; },
    availablePeriods: async (input: unknown) => { analyticsFiltersSchema.parse(input); reads++; return { periods: [] }; },
  };
  registerAnalyticsRoutes(app, (req, res, next) => {
    const role = req.header('x-test-role');
    if (!role) return void res.status(401).json({ error: 'Authentication required' });
    (req as any).user = { role }; next();
  }, guard, service as any);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const port = (server.address() as { port: number }).port;
  const request = (path: string, role?: string) => fetch(`http://127.0.0.1:${port}/api/admin/analytics/${path}`, { headers: role ? { 'x-test-role': role } : {} });
  const close = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return { request, close, reads: () => reads };
}

test('all management endpoints authenticate and enforce the actual main-admin guard before reading any report', async () => {
  const f = await fixture(); try {
    for (const path of ['overview', 'population', 'admissions', 'withdrawals', 'finance', 'academics', 'attendance', 'comparison', 'periods']) {
      assert.equal((await f.request(path)).status, 401);
      for (const role of ['sub-admin', 'bursar', 'student']) assert.equal((await f.request(path, role)).status, 403);
    }
    assert.equal(f.reads(), 0);
    const response = await f.request('population', 'admin');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    const data = await response.json();
    assert.equal(data.population.combined.activeEnrolled, 4);
    assert.equal(f.reads(), 1);
  } finally { await f.close(); }
});

test('invalid and fake-school filters return 400; invalid scope returns 404 with a clear response', async () => {
  const f = await fixture(); try {
    for (const query of ['schoolId=general-school-view', 'term=First%20Term', 'dateFrom=2026-02-30', 'passThreshold=not-a-number', 'unknownFilter=x']) {
      const response = await f.request(`overview?${query}`, 'admin');
      assert.equal(response.status, 400);
      assert.equal((await response.json()).error, 'Invalid reporting filters');
    }
    assert.equal(f.reads(), 0);
    assert.equal((await f.request('overview?classId=missing', 'admin')).status, 404);
    assert.equal((await f.request('comparison?mode=term&originalSession=2025%2F2026&comparisonSession=2026%2F2027', 'admin')).status, 400);
    assert.equal((await f.request('comparison?mode=session&originalSession=2025%2F2026&comparisonSession=2026%2F2027', 'admin')).status, 200);
  } finally { await f.close(); }
});
