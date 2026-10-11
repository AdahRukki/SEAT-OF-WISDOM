import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import type { AnalyticsExportDocument, ExportCell, ExportColumn } from '../../../shared/analytics-export';

export function buildAnalyticsWorkbook(doc: AnalyticsExportDocument) {
  const book = XLSX.utils.book_new();
  book.Props = { Title: doc.title, Author: doc.brand, Company: doc.brand, Subject: 'General School management analytics', CreatedDate: new Date(doc.exportedAt) };
  const add = (name: string, columns: ExportColumn[], rows: ExportCell[][]) => {
    const sheet = XLSX.utils.aoa_to_sheet([[doc.brand], [doc.title], [name], columns.map(c => c.label), ...rows.map(row => row.map(value => value === null ? 'N/A' : value))]);
    sheet['!cols'] = columns.map((c, i) => ({ wch: Math.min(50, Math.max(18, c.label.length + 2, ...rows.slice(0, 100).map(row => String(row[i] ?? '').length + 2))) }));
    if (rows.length) sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ r: 3, c: 0 }, { r: rows.length + 3, c: columns.length - 1 }) };
    rows.forEach((row, r) => row.forEach((value, c) => {
      const cell = sheet[XLSX.utils.encode_cell({ r: r + 4, c })];
      if (cell?.t === 'n') cell.z = columns[c].unit === 'money' ? '"NGN "#,##0.00' : columns[c].unit === 'percent' ? '0.00"%"' : columns[c].unit === 'points' ? '0.00" pp"' : '#,##0.##';
      // Spreadsheet text stays a literal string, including formula-like names.
      if (typeof value === 'string' && cell) { cell.t = 's'; delete cell.f; }
    }));
    const base = name.replace(/[\\/?*\[\]:]/g, '-').slice(0, 27) || 'Report';
    let safeName = base, suffix = 1;
    while (book.SheetNames.includes(safeName)) safeName = `${base}-${suffix++}`;
    XLSX.utils.book_append_sheet(book, sheet, safeName);
  };
  add('Filters and coverage', [{ label: 'Filter / note' }, { label: 'Value' }], [...doc.metadata.map(([label, value]) => [label, value] as ExportCell[]), ...doc.notes.map((note, i) => [`Coverage note ${i + 1}`, note])]);
  for (const table of doc.tables) add(table.title, table.columns, table.rows);
  return book;
}

function pdfCell(value: ExportCell, column: ExportColumn): string {
  if (value === null) return 'N/A';
  if (typeof value !== 'number') return value;
  const number = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 2, ...(column.unit === 'money' ? { minimumFractionDigits: 2 } : {}) }).format(value);
  return column.unit === 'money' ? `NGN ${number}` : column.unit === 'percent' ? `${number}%` : column.unit === 'points' ? `${number} pp` : number;
}

// Vector text and horizontal column bands support long registers without
// screenshot/canvas limits or shrinking all columns onto an unreadable page.
export function buildAnalyticsPdf(doc: AnalyticsExportDocument, fontBase64: string, logoData?: string) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.addFileToVFS('SowaReport.ttf', fontBase64);
  pdf.addFont('SowaReport.ttf', 'SowaReport', 'normal');
  pdf.setFont('SowaReport', 'normal');
  pdf.setProperties({ title: doc.title, author: doc.brand, subject: 'General School management analytics', creator: doc.brand });
  const width = pdf.internal.pageSize.getWidth(), height = pdf.internal.pageSize.getHeight();
  const margin = 12, contentWidth = width - margin * 2, bottom = height - 17;
  const lineHeight = 3.8;
  let y = 38;
  let pages = 0;
  const page = () => {
    if (pages++) pdf.addPage();
    pdf.setFillColor(23, 37, 84); pdf.rect(0, 0, width, 29, 'F');
    let x = margin;
    if (logoData) { pdf.addImage(logoData, 'PNG', margin, 6, 17, 17); x += 22; }
    pdf.setTextColor(255); pdf.setFontSize(14); pdf.text(doc.brand, x, 12);
    pdf.setFontSize(10); pdf.text(doc.title, x, 22);
    pdf.setTextColor(30, 41, 59); pdf.setFontSize(8.5); y = 38;
  };
  const paragraph = (text: string, size = 8.5) => {
    pdf.setFontSize(size);
    for (const line of pdf.splitTextToSize(text, contentWidth) as string[]) {
      if (y + lineHeight > bottom) page();
      pdf.text(line, margin, y); y += lineHeight;
    }
    y += 2;
  };
  page();
  for (const [name, value] of doc.metadata) paragraph(`${name}: ${value}`);
  y += 3; paragraph('Coverage and interpretation', 11);
  for (const note of doc.notes) paragraph(note);

  for (const table of doc.tables) {
    const identities = Math.min(table.identityColumns || 1, 3, table.columns.length);
    const base = Array.from({ length: identities }, (_, i) => i);
    const remaining = Array.from({ length: table.columns.length - identities }, (_, i) => i + identities);
    const maximumColumns = doc.kind === 'comparison' ? 7 : 6;
    const bands: number[][] = remaining.length ? Array.from({ length: Math.ceil(remaining.length / (maximumColumns - identities)) }, (_, i) => [...base, ...remaining.slice(i * (maximumColumns - identities), (i + 1) * (maximumColumns - identities))]) : [base];
    for (let band = 0; band < bands.length; band++) {
      const indices = bands[band], cellWidth = contentWidth / indices.length;
      const title = `${table.title}${bands.length > 1 ? ` (columns ${band + 1}/${bands.length})` : ''}`;
      const headers = indices.map(index => pdf.splitTextToSize(table.columns[index].label, cellWidth - 4) as string[]);
      const headerHeight = Math.max(...headers.map(lines => lines.length)) * lineHeight + 5;
      const header = (fresh = false) => {
        if (fresh || y + headerHeight + 20 > bottom) page();
        y += 5; pdf.setFontSize(10); pdf.text(title, margin, y); y += 4;
        pdf.setFontSize(8.5); pdf.setFillColor(232, 238, 249); pdf.rect(margin, y, contentWidth, headerHeight, 'F');
        headers.forEach((lines, c) => lines.forEach((line, i) => pdf.text(line, margin + c * cellWidth + 2, y + 4 + i * lineHeight)));
        y += headerHeight;
      };
      header();
      if (!table.rows.length) { paragraph('No records match these filters.'); continue; }
      for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
        const cells = indices.map(index => pdf.splitTextToSize(pdfCell(table.rows[rowIndex][index], table.columns[index]), cellWidth - 4) as string[]);
        const lines = Math.max(1, ...cells.map(cell => cell.length));
        let offset = 0;
        if (y + lines * lineHeight + 5 > bottom && lines * lineHeight + 5 < bottom - 60) header(true);
        while (offset < lines) {
          if (y + lineHeight + 5 > bottom) header(true);
          if (offset) { pdf.setFontSize(7); pdf.text(`Row ${rowIndex + 1} continued`, margin + 2, y + 3); y += 5; pdf.setFontSize(8.5); }
          const count = Math.min(lines - offset, Math.max(1, Math.floor((bottom - y - 5) / lineHeight)));
          const rowHeight = count * lineHeight + 5;
          pdf.setDrawColor(211, 218, 227); pdf.rect(margin, y, contentWidth, rowHeight);
          cells.forEach((cell, c) => cell.slice(offset, offset + count).forEach((line, i) => pdf.text(line, margin + c * cellWidth + 2, y + 4 + i * lineHeight)));
          y += rowHeight; offset += count;
          if (offset < lines) header(true);
        }
      }
      y += 5;
    }
  }
  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i); pdf.setTextColor(90); pdf.setFontSize(7);
    pdf.text(`${doc.brand} | Exported ${doc.exportedAt} UTC`, margin, height - 7);
    pdf.text(`Page ${i} of ${total}`, width - margin, height - 7, { align: 'right' });
  }
  return pdf;
}
