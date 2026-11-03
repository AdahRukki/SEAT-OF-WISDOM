/**
 * Print-only assessment sheets. No database writes.
 * Student order is supplied by the Score Tab and must never be sorted here.
 * A4 landscape; up to 40 pupils per page, repeated for each subject group.
 *
 * Uses PDF's built-in Helvetica. Names containing characters outside
 * WinAnsi should use an embedded Unicode font in a future renderer upgrade.
 */
export type ScoreSheetStudent = { name: string; studentId: string };
export type ScoreSheetInput = {
  school: string;
  className: string;
  session: string;
  term?: string;
  subjects: string[];
  students: ScoreSheetStudent[];
  level: "primary" | "secondary";
};
const PAGE_W = 841.89, PAGE_H = 595.28;
const MAX_ROWS = 40;
const enc = new TextEncoder();
const pdfText = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
const cmdText = (s: string, x: number, y: number, size = 8, bold = false) =>
  `BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfText(s)}) Tj ET\n`;
const line = (x: number, y: number, x2: number, y2: number) =>
  `${x.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S\n`;
const fit = (s: string, chars: number) => s.length > chars ? s.slice(0, Math.max(0, chars - 1)) + "." : s;
function page(input: ScoreSheetInput, students: ScoreSheetStudent[], start: number, subjects: string[], index: number, total: number): string {
  const left = 20, right = PAGE_W - 20, width = right - left;
  const nameW = 178, idW = 96, serialW = 23, baseW = serialW + nameW + idW;
  const groups = input.level === "primary" ? subjects : ["First Term", "Second Term", "Third Term"];
  const cols = groups.length * 3;
  const scoreW = (width - baseW) / cols;
  const top = 540, head1 = 22, head2 = 18, rowH = 11.45;
  let out = "0 G 0.45 w\n";
  out += cmdText("SEAT OF WISDOM ACADEMY", left, 570, 13, true);
  out += cmdText(`School: ${input.school}    Class: ${input.className}    Session: ${input.session}    ${input.level === "primary" ? "Term: " + (input.term || "") : "Subject: " + (subjects[0] || "")}`, left, 552, 8);
  out += cmdText(`Page ${index} of ${total}`, right - 68, 570, 8);
  const x = [left, left + serialW, left + serialW + nameW, left + baseW];
  for (let j = 1; j <= cols; j++) x.push(left + baseW + scoreW * j);
  const bottom = top - head1 - head2 - students.length * rowH;
  for (const v of x) out += line(v, top, v, bottom);
  out += line(left, top, right, top);
  out += line(left, top - head1, right, top - head1);
  out += line(left, top - head1 - head2, right, top - head1 - head2);
  for (let r = 1; r <= students.length; r++) out += line(left, top - head1 - head2 - r * rowH, right, top - head1 - head2 - r * rowH);
  out += cmdText("S/N", left + 3, top - 27, 7, true);
  out += cmdText("Student Name", x[1] + 4, top - 27, 8, true);
  out += cmdText("SOWA ID", x[2] + 4, top - 27, 8, true);
  groups.forEach((group, g) => {
    const x0 = x[3] + 3 * g * scoreW;
    out += cmdText(fit(group, Math.max(9, Math.floor(scoreW * 3 / 5))), x0 + 3, top - 15, 7, true);
    ["1st CA", "2nd CA", "Exam"].forEach((t, j) => out += cmdText(t, x0 + j * scoreW + 2, top - head1 - 12, 6.5, true));
  });
  students.forEach((s, i) => {
    const y = top - head1 - head2 - (i + 1) * rowH + 3.2;
    out += cmdText(String(start + i + 1), left + 3, y, 7);
    out += cmdText(fit(s.name, 34), x[1] + 3, y, 7);
    out += cmdText(fit(s.studentId, 17), x[2] + 3, y, 7);
  });
  return out;
}
function serializePdf(streams: string[]): Blob {
  const objects: string[] = [];
  const add = (v: string) => { objects.push(v); return objects.length; };
  const catalog = add("");
  const pages = add("");
  const regular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const bold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  for (const stream of streams) {
    const content = add(`<< /Length ${enc.encode(stream).length} >>\nstream\n${stream}endstream`);
    pageIds.push(add(`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pages} 0 R >>`;
  objects[pages - 1] = `<< /Type /Pages /Kids [${pageIds.map(n => n + " 0 R").join(" ")}] /Count ${pageIds.length} >>`;
  const chunks = ["%PDF-1.4\n%SOWA\n"];
  const offsets = [0];
  let pos = enc.encode(chunks[0]).length;
  objects.forEach((obj, i) => {
    offsets.push(pos);
    const str = `${i + 1} 0 obj\n${obj}\nendobj\n`;
    chunks.push(str);
    pos += enc.encode(str).length;
  });
  const xref = pos;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach(n => chunks.push(`${String(n).padStart(10, "0")} 00000 n \n`));
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}
export function createPrintableScoreSheet(input: ScoreSheetInput): Blob {
  if (!input.students.length) throw new Error("No students in the selected class");
  if (!input.subjects.length) throw new Error("No subjects selected");
  const batches: ScoreSheetStudent[][] = [];
  for (let i = 0; i < input.students.length; i += MAX_ROWS) batches.push(input.students.slice(i, i + MAX_ROWS));
  const groups = input.level === "primary"
    ? Array.from({ length: Math.ceil(input.subjects.length / 3) }, (_, i) => input.subjects.slice(i * 3, i * 3 + 3))
    : input.subjects.map(s => [s]);
  const total = batches.length * groups.length;
  const streams: string[] = [];
  groups.forEach(group => batches.forEach((students, i) => {
    streams.push(page(input, students, i * MAX_ROWS, group, streams.length + 1, total));
  }));
  return serializePdf(streams);
}
export function downloadPrintableScoreSheet(input: ScoreSheetInput): void {
  const blob = createPrintableScoreSheet(input);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `score-sheet-${input.className.replace(/[^a-z0-9-]/gi, "-")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
