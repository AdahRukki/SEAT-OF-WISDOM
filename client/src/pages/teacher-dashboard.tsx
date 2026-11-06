import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ClassInfo = { id: string; name: string };
type StudentInfo = { id: string; firstName?: string; lastName?: string; studentId?: string; user?: { firstName?: string; lastName?: string } };
type SubjectInfo = { id: string; name: string; customName?: string | null };
type Assessment = { studentId: string; firstCA?: number; secondCA?: number; exam?: number };

async function teacherRequest<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.json();
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [assignedClass, setAssignedClass] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [subjects, setSubjects] = useState<SubjectInfo[]>([]);
  const [error, setError] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [term, setTerm] = useState("First Term");
  const [session, setSession] = useState("");
  const [scores, setScores] = useState<Record<string, { firstCA: string; secondCA: string; exam: string }>>({});
  const [busy, setBusy] = useState(false);
  const [loadedContext, setLoadedContext] = useState("");
  const token = localStorage.getItem("auth_token") || "";

  useEffect(() => {
    if (!token || user?.role !== "teacher") return;
    Promise.all([
      teacherRequest<ClassInfo>("/api/teacher/class", token),
      teacherRequest<StudentInfo[]>("/api/teacher/students", token),
      teacherRequest<SubjectInfo[]>("/api/teacher/subjects", token),
    ]).then(([classInfo, classStudents, classSubjects]) => {
      setAssignedClass(classInfo);
      setStudents(classStudents);
      setSubjects(classSubjects);
    }).catch((err) => setError(err.message));
  }, [token, user?.role]);

  async function loadScores() {
    if (!subjectId || !term || !session) return setError("Enter subject ID, term and session.");
    setError("");
    setLoadedContext("");
    try {
      const query = new URLSearchParams({ subjectId, term, session });
      const assessments = await teacherRequest<Assessment[]>(`/api/teacher/assessments?${query}`, token);
      const values: typeof scores = {};
      for (const score of assessments) {
        values[score.studentId] = {
          firstCA: String(score.firstCA ?? ""),
          secondCA: String(score.secondCA ?? ""),
          exam: String(score.exam ?? ""),
        };
      }
      setScores(values);
      setLoadedContext([subjectId, term, session].join("|"));
    } catch (err: any) { setError(err.message); }
  }

  async function saveScore(studentId: string) {
    if (!assignedClass || !subjectId || !session) return setError("Select a class, subject and session first.");
    if (loadedContext !== [subjectId, term, session].join("|")) return setError("Load scores for the selected subject, term and session before saving.");
    const value = scores[studentId] || { firstCA: "", secondCA: "", exam: "" };
    setBusy(true);
    setError("");
    try {
      await teacherRequest("/api/teacher/assessments", token, {
        method: "POST",
        body: JSON.stringify({
          classId: assignedClass.id, studentId, subjectId, term, session,
          firstCA: Number(value.firstCA || 0), secondCA: Number(value.secondCA || 0), exam: Number(value.exam || 0),
        }),
      });
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }

  if (!token) return <p className="p-6">Please sign in again.</p>;
  return <main className="max-w-5xl mx-auto p-6 space-y-6">
    <header><h1 className="text-2xl font-bold">Teacher Dashboard</h1><p>Assigned class: {assignedClass?.name || "Loading..."}</p></header>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Scores</h2>
      <div className="flex flex-wrap gap-3">
        <select aria-label="Subject" className="border rounded p-2" value={subjectId} onChange={e => { setSubjectId(e.target.value); setScores({}); }}>
          <option value="">Select subject</option>
          {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.customName || subject.name}</option>)}
        </select>
        <select aria-label="Term" className="border rounded p-2" value={term} onChange={e => { setTerm(e.target.value); setScores({}); }}>
          {["First Term", "Second Term", "Third Term"].map(t => <option key={t}>{t}</option>)}
        </select>
        <Input aria-label="Session" placeholder="Session (e.g. 2026/2027)" value={session} onChange={e => { setSession(e.target.value); setScores({}); }} />
        <Button onClick={loadScores}>Load scores</Button>
      </div>
    </section>
    <section className="overflow-x-auto">
      <h2 className="text-lg font-semibold mb-3">Students ({students.length})</h2>
      <table className="w-full text-sm border-collapse"><thead><tr className="border-b"><th className="text-left p-2">Student</th><th>1st CA</th><th>2nd CA</th><th>Exam</th><th>Action</th></tr></thead>
        <tbody>{students.map(student => <tr className="border-b" key={student.id}>
          <td className="p-2">{[student.user?.firstName || student.firstName, student.user?.lastName || student.lastName].filter(Boolean).join(" ") || student.studentId || student.id}</td>
          {(["firstCA", "secondCA", "exam"] as const).map(field => <td className="p-1" key={field}>
            <Input type="number" min={0} aria-label={field + " for " + student.id} value={scores[student.id]?.[field] || ""} onChange={e => setScores(prev => ({ ...prev, [student.id]: { firstCA: prev[student.id]?.firstCA || "", secondCA: prev[student.id]?.secondCA || "", exam: prev[student.id]?.exam || "", [field]: e.target.value } }))} />
          </td>)}
          <td className="p-2"><Button disabled={busy || !assignedClass || loadedContext !== [subjectId, term, session].join("|")} onClick={() => saveScore(student.id)}>Save</Button></td>
        </tr>)}</tbody>
      </table>
    </section>
  </main>;
}
