import {
  AlignmentType, Document, Footer, Header, Packer, PageNumber, Paragraph,
  Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
} from "docx";
import { formatStudentName } from "@shared/student-name";
import type { LedgerResponse } from "@/components/payment-ledger";

type Entry = LedgerResponse["entries"][number];
const currency = new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const widths = [680, 4420, 1920, 1530, 1655];
const names = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

export async function buildTuitionBalanceReport(
  entries: Entry[],
  scope: { school: string; term: string; session: string },
  classOrder: ReadonlyMap<string, number>,
): Promise<Blob | null> {
  const groups = new Map<string, Array<Entry & { reportBalance: number }>>();
  let count = 0;
  let outstandingKobo = 0;

  for (const entry of entries) {
    if (!entry.tuitionKnown || !(entry.totalPaid > 0)) continue;
    // The ledger's tuitionAssigned is already net of any applicable discount.
    const balanceKobo = Math.round((entry.tuitionAssigned - entry.totalPaid) * 100);
    if (!(balanceKobo > 0)) continue;
    const group = groups.get(entry.classId) ?? [];
    group.push({ ...entry, reportBalance: balanceKobo / 100 });
    groups.set(entry.classId, group);
    count++;
    outstandingKobo += balanceKobo;
  }
  if (!count) return null;

  const children: Array<Paragraph | Table> = [
    new Paragraph({ children: [new TextRun({ text: "Outstanding Tuition Balances", size: 44, bold: true })], spacing: { after: 140 }, keepNext: true }),
    new Paragraph({ text: `${scope.term} ${scope.session}`, keepNext: true }),
    new Paragraph({ children: [new TextRun({ text: `${count} ${count === 1 ? "student" : "students"}  •  ${currency.format(outstandingKobo / 100)} outstanding`, bold: true })], keepNext: true }),
  ];

  const sortedGroups = Array.from(groups).sort(([a, studentsA], [b, studentsB]) =>
    (classOrder.get(a) ?? Infinity) - (classOrder.get(b) ?? Infinity)
    || names.compare(studentsA[0].className || "", studentsB[0].className || ""));
  for (const [, students] of sortedGroups) {
    students.sort((a, b) => names.compare(formatStudentName(a), formatStudentName(b))
      || names.compare(a.studentId || "", b.studentId || ""));
    children.push(new Paragraph({
      children: [new TextRun({ text: students[0].className || "Unassigned class", size: 26, bold: true })],
      spacing: { before: 200, after: 80 },
      keepNext: true,
    }));
    const rows = [
      ["No.", "Student name", "SOWA ID", "Total paid", "Balance"],
      ...students.map((student, index) => [
        String(index + 1), formatStudentName(student), student.studentId || "",
        currency.format(student.totalPaid), currency.format(student.reportBalance),
      ]),
    ];
    children.push(new Table({
      layout: TableLayoutType.FIXED,
      width: { size: 10205, type: WidthType.DXA },
      columnWidths: widths,
      margins: { top: 45, bottom: 45, left: 90, right: 90 },
      rows: rows.map((row, index) => new TableRow({
        tableHeader: index === 0,
        cantSplit: true,
        children: row.map((text, column) => new TableCell({
          width: { size: widths[column], type: WidthType.DXA },
          children: [new Paragraph({
            alignment: column === 0 ? AlignmentType.CENTER : column >= 3 ? AlignmentType.RIGHT : AlignmentType.LEFT,
            keepNext: index === 0,
            children: [new TextRun({ text, bold: index === 0 })],
          })],
        })),
      })),
    }));
  }

  const document = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 22, color: "000000" } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 930, right: 850, bottom: 930, left: 850, header: 425, footer: 425 } } },
      headers: { default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `SEAT OF WISDOM ACADEMY  |  ${scope.school.toUpperCase()}`, size: 20, bold: true })],
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ children: ["Page ", PageNumber.CURRENT], size: 20 })],
      })] }) },
      children,
    }],
  });
  return Packer.toBlob(document);
}
