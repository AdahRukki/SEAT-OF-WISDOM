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
 const [session,setSession]=useState("");
 const [saved,setSaved]=useState<{class_key:string;version_id:string;version:number;reference_class_id:string;subjects:Subject[]}[]|null>(null);
 const [sync,setSync]=useState<{revision:string;blocked:boolean;historyBlocked:boolean;sessionBlocked:boolean;changes:{classId:string;school:string;add:Subject[];conflicts:Subject[]}[];unmatched:{id:string;name:string}[];protectedPeriods:{class_id:string;session:string;term:string}[]}|null>(null);
 const [requestKey,setRequestKey]=useState("");
 const [notice,setNotice]=useState("");
 const cls=classes.find(c=>c.id===reference);
 const current=saved?.find(v=>v.class_key===cls?.name.trim().replace(/\s+/g," ").toUpperCase());
 async function api(path:string,body?:unknown){
  const token=localStorage.getItem("auth_token");
  if(!token)throw new Error("Sign in again");
  const r=await fetch("/api/admin/subject-management/"+path,{method:body===undefined?"GET":"POST",cache:"no-store",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error||"Request failed");
  return data;
 }
 async function run(fn:()=>Promise<void>){
  setBusy(true);setError("");setNotice("");
  try{await fn();}catch(e){setError(e instanceof Error?e.message:"Request failed");}finally{setBusy(false);}
 }
 async function load(){setSaved(await api("master-configurations?session="+encodeURIComponent(session)));}
 async function save(){if(!cls||!saved)return;setSync(null);await api("master-configurations",{referenceClassId:cls.id,session,subjectIds:selected,expectedVersion:current?.version??0});await load();setNotice("Configuration saved.");}
 async function previewSaved(){if(!current)return;setSync(null);const key=crypto.randomUUID();setRequestKey(key);setSync(await api("master-sync-preview",{versionId:current.version_id,requestKey:key}));}
 async function apply(){if(!current||!sync||sync.blocked)return;if(!window.confirm("Add the listed missing subjects across schools? Existing scores and assignments will be retained."))return;await api("master-sync-apply",{versionId:current.version_id,requestKey,expectedRevision:sync.revision});setSync(null);setNotice("Synchronisation completed. Refresh the subject audit.");}
 const validSession=/^\d{4}\/\d{4}$/.test(session)&&Number(session.slice(5))===Number(session.slice(0,4))+1;
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
  <label className="block">Academic session<input className="block border rounded p-2 bg-background" placeholder="2026/2027" disabled={busy} value={session} onChange={e=>{setSession(e.target.value);setSaved(null);setSync(null);setNotice("");}}/></label>
  <button className="border rounded p-2" disabled={busy||!validSession} onClick={()=>run(load)}>Load saved configurations</button>
  <label className="block">Reference class<select className="block w-full border rounded p-2 bg-background" disabled={busy} value={reference} onChange={e=>{const id=e.target.value;setReference(id);setSelected(Array.from(new Set(classes.find(c=>c.id===id)?.subjects.map(s=>s.id)??[])));setPreview(null);setSync(null);}}><option value="">Select school and class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.school} — {c.name}</option>)}</select></label>
  {cls&&<><input className="border rounded p-2 w-full bg-background" aria-label="Filter subjects" placeholder="Filter subjects" value={search} onChange={e=>setSearch(e.target.value)}/><p>{selected.length} subjects selected</p><div className="grid sm:grid-cols-2 gap-2 max-h-80 overflow-y-auto border rounded p-3">{subjects.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())).map(s=><label key={s.id} className="flex gap-2 items-center"><input type="checkbox" disabled={busy} checked={selected.includes(s.id)} onChange={e=>{setSelected(old=>e.target.checked?[...old,s.id]:old.filter(id=>id!==s.id));setPreview(null);setSync(null);}}/>{s.name}</label>)}</div><button className="border rounded px-3 py-2 disabled:opacity-50" disabled={busy||!selected.length} onClick={review}>{busy?"Checking...":"Preview school synchronisation"}</button></>}
  {cls&&saved&&<div className="space-y-2 border rounded p-3"><p>Saved version: {current?.version??"None"}</p><button className="border rounded p-2 mr-2" disabled={busy||!current} onClick={()=>{setSelected(current?.subjects.map(s=>s.id)??[]);setPreview(null);setSync(null);}}>Load saved subjects</button><button className="border rounded p-2 mr-2" disabled={busy||!selected.length} onClick={()=>run(save)}>Save configuration</button><button className="border rounded p-2" disabled={busy||!current} onClick={()=>run(previewSaved)}>Preview saved configuration</button></div>}
  {sync&&<div className="space-y-2 border rounded p-3"><h4 className="font-semibold">Saved configuration synchronisation</h4>{sync.changes.map(c=><div key={c.classId}><strong>{c.school}</strong><p>Add: {c.add.map(s=>s.name).join(", ")||"None"}</p><p>Conflicts: {c.conflicts.map(s=>s.name).join(", ")||"None"}</p></div>)}{sync.sessionBlocked&&<p>Blocked: selected session is not uniquely active.</p>}{sync.historyBlocked&&<p>Blocked: existing results require historical protection ({sync.protectedPeriods.length} periods).</p>}{sync.unmatched.map(s=><p key={s.id}>No matching class: {s.name}</p>)}<button className="border rounded p-2 disabled:opacity-50" disabled={busy||sync.blocked} onClick={()=>run(apply)}>Apply synchronisation</button></div>}
  {notice&&<p role="status">{notice}</p>}
  {error&&<p role="alert" className="text-red-600">{error}</p>}
  {preview&&<div className="space-y-3"><h4 className="font-semibold">Proposed changes — preview only</h4>{preview.changes.map(c=><div key={c.classId} className="border rounded p-3 space-y-1"><strong>{c.school} — {c.className}</strong><p>Already assigned: {c.alreadyAssigned.length}</p><p>To add: {c.add.map(s=>s.name).join(", ")||"None"}</p><p>Existing extras retained: {c.retainExisting.map(s=>s.name).join(", ")||"None"}</p>{(c.ambiguousClassMatch||c.conflicts.length>0)&&<p className="text-red-600">Review required: {c.ambiguousClassMatch?"Multiple matching classes. ":""}{c.conflicts.map(s=>s.name).join(", ")}</p>}</div>)}{preview.unmatchedSchools.map(s=><p key={s.schoolId}>No matching class: {s.school}</p>)}{preview.warnings.map(w=><p className="text-sm" key={w}>{w}</p>)}<button disabled className="border rounded px-3 py-2 opacity-50">Save configuration before applying</button></div>}
 </section>;
}
