import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { buildAnalyticsExport, buildComparisonExport, analyticsExportFilename, type AnalyticsExportDocument } from '../../shared/analytics-export';
import { buildAnalyticsWorkbook, buildAnalyticsPdf } from '../../client/src/lib/analytics-export-files';
import { reportFixture, comparisonFixture, metadata, schools } from './analytics-browser-fixtures';

const timestamp = '2026-10-11T12:00:00.000Z';
const report = () => reportFixture(new URLSearchParams());
const table = (doc: AnalyticsExportDocument, title: string) => doc.tables.find(t => t.title === title)!;
const font = fs.readFileSync(new URL('../../client/src/assets/fonts/DejaVuSans.ttf', import.meta.url)).toString('base64');

test('all five management reports preserve displayed API values, full registers and recorded school identities', () => {
  const r = report();
  for (const kind of ['overview', 'population', 'admissions', 'withdrawals', 'finance'] as const) {
    const doc = buildAnalyticsExport(r, kind, metadata, timestamp);
    assert.equal(doc.brand, 'Seat of Wisdom Academy');
    assert.equal(doc.exportedAt, timestamp);
    assert.equal(new Map(doc.metadata).get('Report generated (UTC)'), r.meta.generatedAt);
    assert.ok(doc.metadata.find(([name]) => name === 'School IDs')?.[1].includes(schools[3].id));
    assert.ok(doc.notes.some(note => note.includes('N/A')));
    assert.ok(doc.tables.length > 0);
    assert.ok(doc.tables.every(t => t.rows.every(row => row.length === t.columns.length)));
  }
  const overview = buildAnalyticsExport(r, 'overview', metadata, timestamp);
  assert.equal(table(overview, 'Executive summary').rows.find(row => row[0] === 'Confirmed revenue')?.[1], r.finance.combined.confirmedRevenue);
  assert.equal(table(overview, 'Executive summary').rows.find(row => row[0] === 'Attendance')?.[1], r.attendance.percentage);
  const population = buildAnalyticsExport(r, 'population', metadata, timestamp);
  assert.equal(table(population, 'Combined population').rows[0][1], r.population.combined.activeEnrolled);
  assert.equal(table(population, 'School populations').rows.length, 4);
  const admissions = buildAnalyticsExport(r, 'admissions', metadata, timestamp);
  assert.equal(table(admissions, 'Original new admission register').rows.length, 28);
  assert.equal(table(admissions, 'All registration events').rows.length, r.admissions.register.length);
  assert.ok(table(admissions, 'Original new admission register').rows.some(row => row[0] === 'Student Ada Grace 28'));
  const withdrawals = buildAnalyticsExport(r, 'withdrawals', metadata, timestamp);
  assert.equal(table(withdrawals, 'Withdrawal register').rows[0][8], 'No longer withdrawn');
  assert.equal(table(withdrawals, 'Readmission register').rows[0][3], 'Primary 1');
  const finance = buildAnalyticsExport(r, 'finance', metadata, timestamp);
  assert.equal(table(finance, 'Financial performance').rows[0][1], r.finance.combined.confirmedRevenue);
  assert.equal(table(finance, 'Financial performance').rows[0][5], r.finance.combined.outstandingTuition);
});

test('workbook roundtrip keeps zero distinct from N/A, typed numeric percentages and formula-like names as literal text', () => {
  const r = report();
  r.admissions.register[0].studentName = '=HYPERLINK("https://example.invalid","Name")';
  const doc = buildAnalyticsExport(r, 'admissions', metadata, timestamp);
  const workbook = buildAnalyticsWorkbook(doc);
  const reloaded = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
  const register = reloaded.Sheets['Original new admission regi'];
  assert.equal(register.A5.v, r.admissions.register[0].studentName);
  assert.equal(register.A5.t, 's'); assert.equal(register.A5.f, undefined);
  const overview = buildAnalyticsWorkbook(buildAnalyticsExport(r, 'overview', metadata, timestamp));
  const summary = overview.Sheets['Executive summary'];
  const outstandingRow = table(buildAnalyticsExport(r, 'overview'), 'Executive summary').rows.findIndex(row => row[0] === 'Outstanding tuition') + 5;
  assert.equal(summary[`B${outstandingRow}`].v, 'N/A');
  const zero = buildAnalyticsWorkbook({ ...doc, tables: [{ title: 'Numbers', columns: [{ label: 'Attendance', unit: 'percent' }, { label: 'Unknown' }, { label: 'Revenue', unit: 'money' }], rows: [[0, null, 100000]] }] });
  assert.equal(zero.Sheets.Numbers.A5.v, 0); assert.equal(zero.Sheets.Numbers.A5.t, 'n');
  assert.equal(zero.Sheets.Numbers.A5.z, '0.00"%"');
  assert.equal(zero.Sheets.Numbers.B5.v, 'N/A');
  assert.equal(zero.Sheets.Numbers.C5.v, 100000);
  assert.equal(analyticsExportFilename(doc, 'xlsx'), 'Seat-of-Wisdom_admissions_20261011120000.xlsx');
});

test('filtered and unverifiable reports export their actual scope, dates and N/A balances without inventing totals', () => {
  const r = reportFixture(new URLSearchParams({ schoolIds: schools[0].id, session: '2025/2026', term: 'First Term', dateFrom: '2025-09-01', dateTo: '2025-09-30', passThreshold: '50' }));
  const doc = buildAnalyticsExport(r, 'population', metadata, timestamp);
  const scope = new Map(doc.metadata);
  assert.equal(scope.get('Schools'), 'Ikpoto');
  assert.equal(scope.get('Pass threshold / 100'), '50');
  assert.equal(scope.get('Event/receipt date to, inclusive (UTC)'), '2025-09-30');
  assert.equal(table(doc, 'Combined population').rows[0][1], null);
  assert.equal(table(doc, 'School populations').rows.length, 1);
  assert.ok(doc.notes.some(note => note.includes('Population: Unavailable')));
});

test('comparison exports include both periods, every combined and branch metric, N/A baselines and percentage-point units', () => {
  const r = comparisonFixture(new URLSearchParams({ mode: 'term', originalSession: '2025/2026', originalTerm: 'First Term', comparisonSession: '2026/2027', comparisonTerm: 'First Term', schoolIds: schools.slice(0, 2).map(s => s.id).join(',') }));
  const doc = buildComparisonExport(r, metadata, timestamp);
  assert.equal(new Map(doc.metadata).get('Original period'), '2025/2026 / First Term');
  assert.equal(new Map(doc.metadata).get('Comparison period'), '2026/2027 / First Term');
  const rows = table(doc, 'Historical comparison').rows;
  assert.equal(rows.length, 30);
  assert.equal(rows.find(row => row[0] === 'Combined selected schools' && row[1] === 'Active student population')?.[2], null);
  assert.equal(rows.find(row => row[0] === 'Combined selected schools' && row[1] === 'Active student population')?.[3], r.metrics.activePopulation.comparison);
  assert.equal(rows.find(row => row[0] === 'Ikpoto' && row[1] === 'Attendance')?.[3], 0);
  assert.equal(rows.find(row => row[1] === 'Attendance')?.[6], '% / pp difference');
  assert.ok(doc.notes.some(note => note.includes('Date ranges do not apply')));
});

test('vector PDFs preserve Unicode names, long reasons, wide column bands, last records and page numbering', async () => {
  const r = report();
  r.withdrawals.register[0].studentName = 'Ọláḿma Éze-Ada';
  r.withdrawals.register[0].reason = Array.from({ length: 350 }, (_, i) => `Reason${i}`).join(' ');
  const doc = buildAnalyticsExport(r, 'withdrawals', metadata, timestamp);
  const pdf = buildAnalyticsPdf(doc, font);
  assert.ok(pdf.getNumberOfPages() > 3);
  const { PDFParse } = await import('pdf-parse');
  async function extract(buffer: ArrayBuffer) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try { return (await parser.getText()).text; } finally { await parser.destroy(); }
  }
    const text = await extract(pdf.output('arraybuffer'));
    assert.ok(text.includes('Ọláḿma Éze-Ada'));
    assert.ok(text.includes('Reason349'));
    assert.ok(text.includes('Seat of Wisdom Academy'));
    assert.ok(text.includes('Readmission register'));
    assert.ok(text.includes(`Page ${pdf.getNumberOfPages()} of ${pdf.getNumberOfPages()}`));
    assert.ok(text.includes('N/A'));
    assert.ok(text.includes('columns 1/'));
    const admissionPdf = buildAnalyticsPdf(buildAnalyticsExport(r, 'admissions', metadata, timestamp), font);
    assert.ok((await extract(admissionPdf.output('arraybuffer'))).includes('Student Ada Grace 28'));
});
