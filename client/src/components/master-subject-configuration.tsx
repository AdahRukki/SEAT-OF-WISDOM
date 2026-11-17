import { useState } from "react";
type Subject={id:string;name:string};
type ClassRow={id:string;name:string;school:string;school_id:string;subjects:Subject[]};
type Preview={changes:{classId:string;school:string;className:string;add:Subject[];conflicts:Subject[];retainExisting:{subject_id:string;name:string}[];alreadyAssigned:Subject[];ambiguousClassMatch:boolean}[];unmatchedSchools:{schoolId:string;school:string}[];warnings:string[]};
export default function MasterSubjectConfiguration({classes,subjects}:{classes:ClassRow[];subjects:Subject[]}) {
 const [reference,setReference]=useState("");
 const [selected,setSelected]=useState<string[]>([]);
 const [search,setSearch]=useState("");
 const [preview,setPreview]=useState<Preview|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const cls=classes.find(c=>c.id===reference);
 async function review(){
  if(!cls||!selected.length)return;
  setBusy(true);setError("");setPreview(null);
  try{
   const token=localStorage.getItem("auth_token");
   if(!token)throw new Error("Sign in again");
   const r=await fetch("/api/admin/subject-management/master-preview",{method:"POST",cache:"no-store",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({referenceSchoolId:cls.school_id,referenceClassId:cls.id,selectedSubjectIds:selected})});
   if(!r.ok)throw new Error("Preview failed. Check duplicate subjects and reference class.");
   setPreview(await r.json());
  }catch(e){setError(e instanceof Error?e.message:"Preview failed");}finally{setBusy(false);}
 }
 return <section className="space-y-4">
  <h3 className="text-lg font-semibold">Master class configuration</h3>
  <p className="text-sm text-muted-foreground">Choose a reference class, approve subjects and preview additions across matching classes. Existing subjects and scores are retained.</p>
  <label className="block">Reference class<select className="block w-full border rounded p-2 bg-background" disabled={busy} value={reference} onChange={e=>{const id=e.target.value;setReference(id);setSelected(Array.from(new Set(classes.find(c=>c.id===id)?.subjects.map(s=>s.id)??[])));setPreview(null);}}><option value="">Select school and class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.school} — {c.name}</option>)}</select></label>
  {cls&&<><input className="border rounded p-2 w-full bg-background" aria-label="Filter subjects" placeholder="Filter subjects" value={search} onChange={e=>setSearch(e.target.value)}/><p>{selected.length} subjects selected</p><div className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto border rounded p-3">{subjects.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())).map(s=><label key={s.id} className="flex gap-2 items-center"><input type="checkbox" disabled={busy} checked={selected.includes(s.id)} onChange={e=>{setSelected(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id));setPreview(null);}}/>{s.name}</label>)}</div><button className="border rounded px-3 py-2 disabled:opacity-50" disabled={busy||!selected.length} onClick={review}>{busy?"Checking...":"Preview school synchronisation"}</button></>}
  {error&&<p role="alert" className="text-red-600">{error}</p>}
  {preview&&<div className="space-y-3"><h4 className="font-semibold">Proposed changes — preview only</h4>{preview.changes.map(c=><div key={c.classId} className="border rounded p-3 space-y-1"><strong>{c.school} — {c.className}</strong><p>Already assigned: {c.alreadyAssigned.length}</p><p>To add: {c.add.map(s=>s.name).join(", ")||"None"}</p><p>Existing extras retained: {c.retainExisting.map(s=>s.name).join(", ")||"None"}</p>{(c.ambiguousClassMatch||c.conflicts.length>0)&&<p className="text-red-600">Review required: {c.ambiguousClassMatch?"Multiple matching classes. ":""}{c.conflicts.map(s=>s.name).join(", ")}</p>}</div>)}{preview.unmatchedSchools.map(s=><p key={s.schoolId}>No matching class: {s.school}</p>)}{preview.warnings.map(w=><p className="text-sm" key={w}>{w}</p>)}<button disabled className="border rounded px-3 py-2 opacity-50">Apply synchronisation (not enabled)</button></div>}
 </section>;
}
