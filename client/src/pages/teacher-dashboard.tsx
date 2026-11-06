import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScoreEntryGrid } from "@/components/score-entry-grid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Save } from "lucide-react";

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
  const [term, setTerm] = useState("");
  const [session, setSession] = useState("");
  const [scores, setScores] = useState<Record<string, { firstCA: string; secondCA: string; exam: string }>>({});
  const [busy, setBusy] = useState(false);
  const [originalScores, setOriginalScores] = useState<typeof scores>({});
  const [savedMessage, setSavedMessage] = useState("");
  const [loadedContext, setLoadedContext] = useState("");
  const token = localStorage.getItem("auth_token") || "";

  useEffect(() => {
    if (!token || !user?.schoolId) return;
    teacherRequest<{ currentTerm?: string; currentSession?: string }>(`/api/current-academic-info?schoolId=${user.schoolId}`, token)
      .then(info => {
        if (info.currentTerm) setTerm(info.currentTerm);
        if (info.currentSession) setSession(info.currentSession);
      })
      .catch(err => setError(err.message));
  }, [token, user?.schoolId]);

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
    setSavedMessage("");
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
      setOriginalScores(values);
      setLoadedContext([subjectId, term, session].join("|"));
    } catch (err: any) { setError(err.message); }
  }

  async function saveScore(studentId: string) {
    if (!assignedClass || !subjectId || !session) return setError("Select a class, subject and session first.");
    if (loadedContext !== [subjectId, term, session].join("|")) return setError("Load scores for the selected subject, term and session before saving.");
    const values = scores[studentId];
    if (!values || [values.firstCA, values.secondCA, values.exam].every(value => value === "")) return setError("Enter at least one score before saving.");
    if ([["firstCA", 20], ["secondCA", 20], ["exam", 60]].some(([field, maximum]) => { const value = values[field as keyof typeof values]; return value !== "" && (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > Number(maximum)); })) return setError("Scores must be within CA1 /20, CA2 /20, and Exam /60.");
    const value = scores[studentId] || { firstCA: "", secondCA: "", exam: "" };
    setBusy(true);
    setError("");
    setSavedMessage("");
    try {
      await teacherRequest("/api/teacher/assessments", token, {
        method: "POST",
        body: JSON.stringify({
          classId: assignedClass.id, studentId, subjectId, term, session,
          firstCA: Number(value.firstCA || 0), secondCA: Number(value.secondCA || 0), exam: Number(value.exam || 0),
        }),
      });
      setOriginalScores(prev => ({ ...prev, [studentId]: value }));
      setSavedMessage("Score saved successfully.");
    } catch (err: any) { setError(err.message); }
    finally { setBusy(false); }
  }


  const context = [subjectId, term, session].join("|");
  const dirtyStudents = students.filter(student => {
    const current = scores[student.id];
    if (!current) return false;
    const saved = originalScores[student.id];
    return (["firstCA", "secondCA", "exam"] as const).some(field => (current[field] || "") !== (saved?.[field] || ""));
  });
  async function saveAllScores() {
    if (busy || loadedContext !== context) return setError("Load scores for the selected subject and term before saving.");
    if (!dirtyStudents.length) return setSavedMessage("No changes to save.");
    for (const student of dirtyStudents) {
      const v = scores[student.id];
      if (([["firstCA",20],["secondCA",20],["exam",60]] as const).some(([field,max]) => v[field] !== "" && (!Number.isFinite(Number(v[field])) || Number(v[field]) < 0 || Number(v[field]) > max))) {
        return setError("Scores must be within CA1 /20, CA2 /20 and Exam /60.");
      }
    }
    setBusy(true);
    setError("");
    setSavedMessage("");
    let saved = 0;
    try {
      for (const student of dirtyStudents) {
        const v = scores[student.id];
        await teacherRequest("/api/teacher/assessments", token, {
          method: "POST",
          body: JSON.stringify({ classId: assignedClass?.id, studentId: student.id, subjectId, term, session,
            firstCA: Number(v.firstCA || 0), secondCA: Number(v.secondCA || 0), exam: Number(v.exam || 0) }),
        });
        setOriginalScores(prev => ({...prev, [student.id]: v}));
        saved++;
      }
      setSavedMessage(saved + " student scores saved.");
    } catch (err: any) {
      setError(saved + " saved before an error: " + err.message);
    } finally { setBusy(false); }
  }
  function changeScore(id: string, field: string, value: string) {
    setScores(prev => ({
      ...prev,
      [id]: {
        firstCA: prev[id]?.firstCA ?? "",
        secondCA: prev[id]?.secondCA ?? "",
        exam: prev[id]?.exam ?? "",
        [field]: value,
      }
    }));
  }
  function handleKeyDown(event: any, studentId: string, field: string) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const fields = ["firstCA","secondCA","exam"];
    const index = students.findIndex(s => s.id === studentId);
    const nextField = fields.indexOf(field) < 2 ? fields[fields.indexOf(field)+1] : fields[0];
    const nextStudent = fields.indexOf(field) < 2 ? studentId : students[index+1]?.id;
    if (nextStudent) (document.querySelector(`[data-student-id="${nextStudent}"][data-field="${nextField}"]`) as HTMLElement | null)?.focus();
  }
  const assessments = students.filter(student => originalScores[student.id]).map(student => ({
    studentId: student.id,
    ...Object.fromEntries((["firstCA","secondCA","exam"] as const).map(field => [field, originalScores[student.id][field] === "" ? null : Number(originalScores[student.id][field])])),
  }));
  if (!token) return <p className="p-6">Please sign in again.</p>;
  return <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
    <header><h1 className="text-2xl font-bold">Scores</h1><p className="text-sm text-muted-foreground">Assigned class: {assignedClass?.name || "Loading..."}</p></header>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    {savedMessage && <p role="status" className="text-green-700">{savedMessage}</p>}
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><BookOpen className="h-5 w-5 text-primary" />Score Entry</CardTitle>
        <CardDescription>CA1 /20 · CA2 /20 · Exam /60 · Total /100</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6 pt-0 pb-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-4">
          <label className="space-y-1 text-xs">Term
            <select aria-label="Term" className="block w-full border rounded h-9 p-2 text-sm" value={term} onChange={e => {setTerm(e.target.value);setLoadedContext("");setScores({});}}>
              {["First Term","Second Term","Third Term"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs">Session
            <Input className="h-9" value={session} readOnly aria-label="Session" />
          </label>
          <label className="space-y-1 text-xs">Class
            <Input className="h-9" value={assignedClass?.name || ""} readOnly aria-label="Assigned class" />
          </label>
          <label className="space-y-1 text-xs">Subject
            <select aria-label="Subject" className="block w-full border rounded h-9 p-2 text-sm" value={subjectId} onChange={e => {setSubjectId(e.target.value);setLoadedContext("");setScores({});}}>
              <option value="">Select subject</option>
              {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.customName || subject.name}</option>)}
            </select>
          </label>
        </div>
        <Button className="mb-4" variant="outline" onClick={loadScores} disabled={!subjectId || !term || !session || busy}>Load scores</Button>
        {loadedContext === context && subjectId ? <>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex justify-between px-3 py-2 bg-muted/40 border-b text-xs">
              <span>{students.length} students</span>
              <span>{students.filter(student => {
                const v = scores[student.id];
                return v && (v.firstCA !== "" || v.secondCA !== "" || v.exam !== "");
              }).length} / {students.length} scored</span>
            </div>
            <ScoreEntryGrid
              filteredStudents={[...students].sort((a,b) => (a.studentId || "").localeCompare(b.studentId || ""))}
              classAssessments={assessments}
              scoreInputs={scores}
              handleScoreChange={changeScore}
              handleKeyDown={handleKeyDown}
              calculateGrade={(total) => ({grade: total >= 70 ? "A" : total >= 60 ? "B" : total >= 50 ? "C" : total >= 40 ? "D" : "F"})}
            />
            <div className="flex justify-end px-3 py-3 bg-muted/40 border-t">
              <Button onClick={saveAllScores} disabled={busy || dirtyStudents.length === 0}><Save className="h-4 w-4 mr-2" />{busy ? "Saving…" : "Save All Scores"}</Button>
            </div>
          </div>
        </> : <div className="py-12 text-center border-2 border-dashed rounded-xl text-muted-foreground">Select a subject and load scores for your assigned class.</div>}
      </CardContent>
    </Card>
  </main>;
}
