import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = { id: string; name: string; schoolId?: string | null };
type Props = {
  currentClass: Item;
  classes: Item[];
  schools: Item[];
  subjects: Item[];
  onSaved: () => void;
};

const emptyAssignments: Record<string, string[]> = {};

export function BulkSubjectAssignments({ currentClass, classes, schools, subjects, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [targets, setTargets] = useState<string[]>([currentClass.id]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [search, setSearch] = useState("");
  const [sourceSchoolId, setSourceSchoolId] = useState(currentClass.schoolId ?? "");
  const [copyFrom, setCopyFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const relevantClasses = classes.filter(c => c.schoolId === currentClass.schoolId);
  const isOtherSchool = !!sourceSchoolId && sourceSchoolId !== currentClass.schoolId;
  const otherSchoolClasses = useQuery<Item[]>({
    queryKey: ["/api/admin/classes", sourceSchoolId],
    queryFn: () => apiRequest(`/api/admin/classes?schoolId=${encodeURIComponent(sourceSchoolId)}`),
    enabled: isOtherSchool,
  });
  const sourceClasses = isOtherSchool ? otherSchoolClasses.data ?? [] : relevantClasses;
  const sourceSubjects = useQuery<Item[]>({
    queryKey: ["bulk-class-subjects", "source", copyFrom],
    queryFn: () => apiRequest(`/api/admin/classes/${encodeURIComponent(copyFrom)}/subjects`),
    enabled: !!copyFrom,
  });
  const { data: snapshots = emptyAssignments, isFetching, isError, refetch } = useQuery<Record<string, string[]>>({
    queryKey: ["bulk-class-subjects", "targets", [...targets].sort()],
    queryFn: async () => {
      const entries = await Promise.all(targets.map(async id => {
        const rows = await apiRequest(`/api/admin/classes/${encodeURIComponent(id)}/subjects`) as Item[];
        return [id, rows.map(s => s.id)] as const;
      }));
      return Object.fromEntries(entries);
    },
    enabled: targets.length > 0,
    staleTime: 0
  });
  const preview = useMemo(() => targets.map(classId => {
    const before = snapshots[classId] || [];
    const after = mode === "add" ? Array.from(new Set([...before, ...chosen])) : chosen;
    return { classId, add: after.filter(id => !before.includes(id)), remove: before.filter(id => !after.includes(id)) };
  }), [targets, snapshots, chosen, mode]);
  const totalAdd = preview.reduce((n, p) => n + p.add.length, 0);
  const totalRemove = preview.reduce((n, p) => n + p.remove.length, 0);
  const toggle = (items: string[], id: string, set: (next: string[]) => void) =>
    set(items.includes(id) ? items.filter(x => x !== id) : [...items, id]);
  function copy() {
    if (!sourceSubjects.data?.length || sourceSubjects.isFetching || sourceSubjects.isError) return;
    setChosen(Array.from(new Set(sourceSubjects.data.map(subject => subject.id))));
    setMode("add");
    setMessage("Copied selection. Review the changes before saving.");
  }
  async function save() {
    if (saving || isFetching || isError || !targets.length || targets.some(id => !snapshots[id])) return;
    setSaving(true); setMessage("");
    try {
      await apiRequest("/api/admin/classes/bulk-subjects", {
        method: "POST",
        body: { classIds: targets, subjectIds: chosen, mode,
          expected: Object.fromEntries(targets.map(id => [id, snapshots[id]])) }
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/classes"] });
      await queryClient.invalidateQueries({ queryKey: ["bulk-class-subjects"] });
      setMessage("Subject assignments saved.");
      onSaved();
    } catch (e: any) {
      setMessage(e?.message || "Save failed. Refresh and review assignments.");
      await refetch();
    } finally { setSaving(false); }
  }
  return <div className="space-y-4 text-sm">
    <div>
      <label className="font-medium">Mode</label>
      <div className="flex gap-2 mt-1">
        <Button type="button" variant={mode === "add" ? "default" : "outline"} onClick={() => setMode("add")}>Add subjects</Button>
        <Button type="button" variant={mode === "replace" ? "default" : "outline"} onClick={() => setMode("replace")}>Replace assignments</Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">{mode === "add" ? "Existing subjects will be preserved." : "Unchecked subjects will be unassigned. Recorded scores are preserved."}</p>
    </div>
    <div>
      <label className="font-medium">Apply to classes</label>
      <div className="max-h-28 overflow-y-auto border rounded p-2 mt-1 space-y-1">
        {relevantClasses.map(c => <label key={c.id} className="flex gap-2 items-center">
          <input type="checkbox" checked={targets.includes(c.id)} onChange={() => toggle(targets, c.id, setTargets)} />
          {c.name}
        </label>)}
      </div>
    </div>
    <div className="space-y-2">
      {schools.length > 0 && (
        <label className="block">Copy from school
          <select className="block w-full border rounded p-2 mt-1 bg-background" value={sourceSchoolId}
            onChange={e => { setSourceSchoolId(e.target.value); setCopyFrom(""); }}>
            {!schools.some(school => school.id === currentClass.schoolId) && (
              <option value={currentClass.schoolId ?? ""}>Current school</option>
            )}
            {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
          </select>
        </label>
      )}
      <div className="flex gap-2 items-end">
        <label className="flex-1">Copy from class
          <select className="block w-full border rounded p-2 mt-1 bg-background" value={copyFrom}
            disabled={isOtherSchool && (otherSchoolClasses.isPending || otherSchoolClasses.isError)}
            onChange={e => setCopyFrom(e.target.value)}>
            <option value="">Choose a class</option>
            {sourceClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" onClick={copy}
          disabled={saving || sourceSubjects.isFetching || sourceSubjects.isError || !sourceSubjects.data?.length}>
          Copy subjects
        </Button>
      </div>
      {isOtherSchool && otherSchoolClasses.isPending && <p role="status">Loading classes…</p>}
      {isOtherSchool && otherSchoolClasses.isError && <p role="alert">Could not load classes for this school.</p>}
      {isOtherSchool && otherSchoolClasses.isSuccess && !sourceClasses.length && <p role="status">This school has no classes.</p>}
      {copyFrom && sourceSubjects.isFetching && <p role="status">Loading subjects…</p>}
      {copyFrom && sourceSubjects.isError && <p role="alert">Could not load subjects for this class.</p>}
      {copyFrom && sourceSubjects.isSuccess && !sourceSubjects.data.length && <p role="status">This class has no subjects to copy.</p>}
    </div>
    <div>
      <label className="font-medium">Search and tick subjects</label>
      <Input className="mt-1" placeholder="Search subjects" value={search} onChange={e => setSearch(e.target.value)} />
      <div className="max-h-48 overflow-y-auto border rounded p-2 mt-2 space-y-1">
        {subjects.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map(s =>
          <label key={s.id} className="flex gap-2 items-center">
            <input type="checkbox" checked={chosen.includes(s.id)} onChange={() => toggle(chosen, s.id, setChosen)} />
            {s.name}
          </label>)}
      </div>
    </div>
    <div className="border rounded p-3">
      <p className="font-medium">Review changes: {totalAdd} subjects to add · {totalRemove} to remove</p>
      {preview.map(p => <p key={p.classId} className="text-xs mt-1">
        {classes.find(c => c.id === p.classId)?.name}: +{p.add.length} / -{p.remove.length}
      </p>)}
    </div>
    {isError && <p role="alert">Could not load the destination class assignments.</p>}
    {message && <p role="status">{message}</p>}
    <Button type="button" className="w-full" onClick={save}
      disabled={saving || isFetching || isError || !targets.length || targets.some(id => !snapshots[id]) || (totalAdd === 0 && totalRemove === 0)}>
      {saving ? "Saving..." : "Save subject assignments"}
    </Button>
  </div>;
}
