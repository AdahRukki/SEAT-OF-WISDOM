/**
 * Run: npx tsx scripts/test-printable-score-sheets.ts
 * Pure, read-only PDF generation smoke tests; no database or browser required.
 */
import assert from "node:assert/strict";
import { createPrintableScoreSheet, type ScoreSheetInput } from "../client/src/lib/printable-score-sheet";

const students = Array.from({ length: 83 }, (_, i) => ({
  name: `Student ${String(i + 1).padStart(3, "0")}`,
  studentId: `SOWA/26/${String(i + 1).padStart(4, "0")}`,
}));
const base: Omit<ScoreSheetInput, "level" | "subjects"> = {
  school: "Bonsaac",
  className: "Basic 4",
  session: "2026/2027",
  term: "First Term",
  students,
};
async function check(input: ScoreSheetInput, expectedPages: number, required: string[]) {
  const blob = createPrintableScoreSheet(input);
  assert.equal(blob.type, "application/pdf");
  const text = await blob.text();
  assert.ok(text.startsWith("%PDF-1.4"), "valid PDF header");
  assert.equal((text.match(/\/Type \/Page\b/g) || []).length, expectedPages, "expected page count");
  for (const token of required) assert.ok(text.includes(token), `missing text: ${token}`);
  assert.ok(text.includes("SOWA ID"), "student IDs have a dedicated column");
  assert.ok(text.includes("Student 083"), "all 83 students must appear");
  assert.ok(text.includes("SOWA/26/0083"), "last student ID included");
}
await check({
  ...base,
  level: "primary",
  subjects: ["Mathematics", "English Studies", "Basic Science", "History"],
}, 6, ["Mathematics", "English Studies", "Basic Science", "History", "1st CA", "2nd CA", "Exam"]);
await check({
  ...base,
  className: "JSS 2",
  level: "secondary",
  subjects: ["Mathematics", "English"],
}, 6, ["First Term", "Second Term", "Third Term", "Mathematics", "English"]);
assert.throws(() => createPrintableScoreSheet({ ...base, level: "primary", subjects: [], students }), /No subjects/);
assert.throws(() => createPrintableScoreSheet({ ...base, level: "primary", subjects: ["Math"], students: [] }), /No students/);
console.log("Printable score sheet PDF smoke tests passed");
