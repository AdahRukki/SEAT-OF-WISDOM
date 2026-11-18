import { connectSubjectDb } from "./subject-db-client";
type ReportSubject = {id:string;name:string};
export async function loadReportPeriodSubjects(classId:string,session:string,term:string):Promise<ReportSubject[]|null> {
 const client=await connectSubjectDb();
 try {
  const available=await client.query("SELECT to_regclass('class_subject_period_snapshots') IS NOT NULL AS present");
  if(!available.rows[0].present)return null;
  const result=await client.query("SELECT subjects FROM class_subject_period_snapshots WHERE class_id=$1 AND session=$2 AND term=$3",[classId,session,term]);
  if(!result.rows.length)return null;
  const rows:unknown=result.rows[0].subjects;
  if(!Array.isArray(rows)||rows.some(s=>!s||typeof s.id!=="string"||typeof s.name!=="string"||!s.id||!s.name)||new Set(rows.map(s=>s.id)).size!==rows.length)throw new Error("Invalid historical subject snapshot");
  return rows.map(s=>({id:s.id,name:s.name}));
 }finally{client.release();}
}

import type { Assessment, Subject } from "@shared/schema";

type ReportScore = Assessment & { subject: Subject };
type PeriodReport = { subjects: (Subject & { customName: string | null })[]; scores: ReportScore[] };

export async function loadPreservedSubjectReport(classId: string, session: string, term: string): Promise<PeriodReport | null> {
  const client = await connectSubjectDb();
  try {
    const result = await client.query(
      "SELECT subjects,scores FROM subject_report_snapshots WHERE class_id=$1 AND session=$2 AND term=$3",
      [classId, session, term],
    );
    const row = result.rows[0];
    if (!row) return null;
    const subject = (s: any) => ({
      id: s.id, name: s.name, code: s.code, description: s.description,
      createdAt: s.created_at ? new Date(s.created_at) : null,
      updatedAt: s.updated_at ? new Date(s.updated_at) : null,
    });
    return {
      subjects: row.subjects.map((s: any) => ({...subject(s), customName: s.custom_name})),
      scores: row.scores.map((a: any) => ({
        id: a.id, studentId: a.student_id, classId: a.class_id, subjectId: a.subject_id,
        session: a.session, term: a.term, firstCA: a.first_ca, secondCA: a.second_ca,
        exam: a.exam, total: a.total, grade: a.grade, remark: a.remark,
        createdAt: a.created_at ? new Date(a.created_at) : null,
        updatedAt: a.updated_at ? new Date(a.updated_at) : null,
        subject: subject(a.subject),
      })),
    };
  } finally {
    client.release();
  }
}
