import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Item = { id: string; name: string; schoolId?: string };
type Props = { currentClass: Item; classes: Item[]; subjects: Item[]; onSaved: () => void };

export function BulkSubjectAssignments({ currentClass, classes, subjects, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [targets, setTargets] = useState<string[]>([currentClass.id]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [search, setSearch] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [snapshots, setSnapshots] = useState<Record<string, string[]>>({});
  const relevantClasses = classes.filter(c => c.schoolId === currentClass.schoolId);
  const keys = [...new Set([...targets, copyFrom].filter(Boolean))];
  const { data: loaded = {}, isFetching, refetch } = useQuery<Record<string, string[]>>({
    queryKey: ["bulk-class-subjects", ...keys.sort()],
    queryFn: async () => {
      const entries = await Promise.all(keys.map(async id => {
        const rows = await apiRequest(`/api/admin/classes/${id}/subjects`) as Item[];
        return [id, rows.map(s => s.id)] as const;
      }));
      return Object.fromEntries(entries);
    },
    enabled: keys.length > 0,
    staleTime: 0
  });
  useEffect(() => { setTargets([currentClass.id]); setChosen([]); setCopyFrom(""); setMessage(""); }, [currentClass.id]);
  useEffect(() => { setSnapshots(loaded); }, [loaded]);
  const preview = useMemo(() => targets.map(classId => {
    const before = snapshots[classId] || [];
    const after = mode === "add" ? [...new Set([...before, ...chosen])] : chosen;
    return { classId, add: after.filter(id => !before.includes(id)), remove: before.filter(id => !after.includes(id)) };
  }), [targets, snapshots, chosen, mode]);
  const totalAdd = preview.reduce((n, p) => n + p.add.length, 0);
  const totalRemove = preview.reduce((n, p) => n + p.remove.length, 0);
  const toggle = (items: string[], id: string, set: (next: string[]) => void) =>
    set(items.includes(id) ? items.filter(x => x !== id) : [...items, id]);
  async function copy() {
    if (!copyFrom || !snapshots[copyFrom]) return;
    setChosen([...snapshots[copyFrom]]);
    setMode("replace");
    setMessage("Copied selection. Review the changes before saving.");
  }
  async function save() {
    if (isFetching || targets.some(id => !snapshots[id])) return;
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
    <div className="flex gap-2 items-end">
      <label className="flex-1">Copy from class
        <select className="block w-full border rounded p-2 mt-1 bg-background" value={copyFrom} onChange={e => setCopyFrom(e.target.value)}>
          <option value="">Choose a class</option>
          {relevantClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <Button type="button" variant="outline" disabled={!copyFrom || !snapshots[copyFrom]} onClick={copy}>Copy</Button>
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
    {message && <p role="status">{message}</p>}
    <Button type="button" className="w-full" onClick={save}
      disabled={saving || isFetching || !targets.length || targets.some(id => !snapshots[id]) || (totalAdd === 0 && totalRemove === 0)}>
      {saving ? "Saving..." : "Save subject assignments"}
    </Button>
  </div>;
}
