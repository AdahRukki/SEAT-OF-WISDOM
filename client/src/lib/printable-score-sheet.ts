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

 // Conservative character-width bound for Helvetica, including bold.
 const wrap = (s: string, width: number, size: number): string[] => {
   const limit = Math.max(1, Math.floor(width / size));
   const result: string[] = [];
   let rest = s.trim();
   while (rest.length > limit) {
     const space = rest.lastIndexOf(" ", limit);
     const cut = space > 0 ? space : limit;
     result.push(rest.slice(0, cut));
     rest = rest.slice(cut).trimStart();
   }
   if (rest || !result.length) result.push(rest);
   return result;
 };
 const P_LEFT = 24, P_RIGHT = PAGE_W - 24, P_TOP = 530;
 const P_SERIAL = 30, P_NAME = 236, P_ID = 110;
 const P_BASE = P_LEFT + P_SERIAL + P_NAME + P_ID;
 const P_BOTTOM = 24, P_HEAD2 = 24;
 const primaryRowHeight = (s: ScoreSheetStudent) => Math.max(24, 8 + 13 * Math.max(wrap(s.name, P_NAME - 10, 11).length, wrap(s.studentId, P_ID - 10, 11).length));
 const primaryHeaderHeight = (subjects: string[]) => Math.max(36, 10 + 13 * Math.max(...subjects.map(s => wrap(s, (P_RIGHT - P_BASE) / subjects.length - 10, 11).length)));
 function primaryPage(input: ScoreSheetInput, students: ScoreSheetStudent[], start: number, subjects: string[], index: number, total: number): string {
   const head1 = primaryHeaderHeight(subjects), split = P_TOP - head1, body = split - P_HEAD2;
   const sw = (P_RIGHT - P_BASE) / (subjects.length * 3);
   const bottom = body - students.reduce((n,s) => n + primaryRowHeight(s), 0);
   let out = "0 G 0.65 w\n";
   out += cmdText("SEAT OF WISDOM ACADEMY", P_LEFT, 565, 16, true);
   out += cmdText(`School: ${input.school}    Class: ${input.className}    Session: ${input.session}    Term: ${input.term || ""}`, P_LEFT, 545, 11);
   out += cmdText(`Page ${index} of ${total}`, P_RIGHT - 85, 565, 10);
   for (const x of [P_LEFT, P_LEFT+P_SERIAL, P_LEFT+P_SERIAL+P_NAME, P_BASE]) out += line(x,P_TOP,x,bottom);
   for(let j=1;j<=subjects.length*3;j++){
     const x=P_BASE+j*sw;
     out += line(x,j%3===0?P_TOP:split,x,bottom);
   }
   out += line(P_LEFT,P_TOP,P_RIGHT,P_TOP);
   out += line(P_BASE,split,P_RIGHT,split);
   out += line(P_LEFT,body,P_RIGHT,body);
   out += cmdText("S/N",P_LEFT+4,body+10,10,true);
   out += cmdText("Student Name",P_LEFT+P_SERIAL+5,body+10,11,true);
   out += cmdText("SOWA ID",P_LEFT+P_SERIAL+P_NAME+5,body+10,11,true);
   subjects.forEach((subject,g)=>{
     const x=P_BASE+g*3*sw;
     wrap(subject,3*sw-10,11).forEach((t,i)=>{out+=cmdText(t,x+5,P_TOP-15-i*13,11,true);});
     ["1st CA","2nd CA","Exam"].forEach((t,j)=>{out+=cmdText(t,x+j*sw+4,split-16,10,true);});
   });
   let y=body;
   students.forEach((s,i)=>{
     out+=cmdText(String(start+i+1),P_LEFT+4,y-16,11);
     wrap(s.name,P_NAME-10,11).forEach((t,j)=>{out+=cmdText(t,P_LEFT+P_SERIAL+5,y-16-j*13,11);});
     wrap(s.studentId,P_ID-10,11).forEach((t,j)=>{out+=cmdText(t,P_LEFT+P_SERIAL+P_NAME+5,y-16-j*13,11);});
     y-=primaryRowHeight(s);
     out+=line(P_LEFT,y,P_RIGHT,y);
   });
   return out;
 }
 function primaryStreams(input: ScoreSheetInput): string[] {
   const pages: {students: ScoreSheetStudent[]; start:number; subjects:string[]}[]=[];
   for(let g=0;g<input.subjects.length;g+=3){
     const subjects=input.subjects.slice(g,g+3);
     const capacity=P_TOP-primaryHeaderHeight(subjects)-P_HEAD2-P_BOTTOM;
     let rows: ScoreSheetStudent[]=[], used=0, start=0;
     input.students.forEach((s,i)=>{
       const h=primaryRowHeight(s);
       if(h>capacity) throw new Error("Student name or subject heading exceeds printable page");
       if(rows.length && used+h>capacity){pages.push({students:rows,start,subjects});rows=[];used=0;start=i;}
       rows.push(s);used+=h;
     });
     if(rows.length) pages.push({students:rows,start,subjects});
   }
   return pages.map((p,i)=>primaryPage(input,p.students,p.start,p.subjects,i+1,pages.length));
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
  if (input.level === "primary") return serializePdf(primaryStreams(input));
  const batches: ScoreSheetStudent[][] = [];
  for (let i = 0; i < input.students.length; i += MAX_ROWS) batches.push(input.students.slice(i, i + MAX_ROWS));
  const groups = input.subjects.map(s => [s]);
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
