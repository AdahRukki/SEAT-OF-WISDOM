import MasterSubjectConfiguration from "./master-subject-configuration";
import { useEffect, useState } from "react";

type Subject = {id:string;name:string;assignments:number;assessments:number};
type ClassRow = {id:string;name:string;school:string;school_id:string;subject_count:number;subjects:{id:string;name:string}[]};
type Audit = {mergeWritesEnabled?:boolean;subjects:Subject[];classes:ClassRow[];duplicates:{normalized_name:string;subject_ids:string[];names:string[]}[]};
type Preview = {executionEnabled:boolean;blockers:string[];revision:string;overlaps:{revision:string;student_id:string;class_id:string;session:string;term:string;records:{id:string;subjectId:string;firstCA:number;secondCA:number;exam:number}[]}[];assignments:{class_id:string;class_name:string;school:string;assignments:{id:string;subjectId:string;customName:string|null}[]}[];counts:{subject_id:string;session:string;term:string;assessment_count:number}[];warnings:string[]};
const prefix="/api/admin/subject-management";
// Do not persist student assessment data or queue preview requests offline.
async function request<T>(path:string,body?:unknown):Promise<T> {
  const token=localStorage.getItem("auth_token");
  if (!token) throw new Error("Sign in as main administrator");
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try {
  const response=await fetch(prefix+path,{method:body?"POST":"GET",cache:"no-store",signal:controller.signal,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  if (!response.ok) {
    const details=await response.json().catch(()=>null);
    throw new Error(details?.error || (response.status===503?"Merge execution is currently disabled by the server. No records were changed.":"Request failed ("+response.status+")."));
  }
  if (!response.headers.get("content-type")?.includes("application/json")) throw new Error("Subject Management API returned a webpage instead of data. Check that the running backend includes /api/admin/subject-management/audit. HTTP "+response.status+(response.redirected?" (redirected)":"")+".");
  return await response.json();
  } catch(e) { if(controller.signal.aborted)throw new Error("Subject Management request timed out after 20 seconds. Retry or check server logs."); throw e; } finally { clearTimeout(timeout); }
}
export default function SubjectManagementDashboard() {
  const [audit,setAudit]=useState<Audit|null>(null);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [source,setSource]=useState("");
  const [target,setTarget]=useState("");
  const [search,setSearch]=useState("");
  const [school,setSchool]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState<{operationId:string;assessmentsMoved:number;assignmentsMoved:number;assignmentsConsolidated?:number;retained:string}|null>(null);
  const [history,setHistory]=useState<{operation_id:string;source_name:string;target_name:string;created_at:string;assessment_count:number;assignment_count:number}[]>([]);
  const [recovery,setRecovery]=useState<{operationId:string;eligibleForReview:boolean;reasons:string[]}|null>(null);
  const [choices,setChoices]=useState<Record<string,string>>({});
  async function openHistory(){setTab("history");setBusy(true);setError("");setRecovery(null);try{setHistory(await request<typeof history>("/merge-history"));}catch(e){setError(e instanceof Error?e.message:"History failed");}finally{setBusy(false);}}
  async function reviewRecovery(id:string){setBusy(true);setError("");setRecovery(null);try{setRecovery(await request<{operationId:string;eligibleForReview:boolean;reasons:string[]}>("/recovery/"+id));}catch(e){setError(e instanceof Error?e.message:"Recovery review failed");}finally{setBusy(false);}}
  async function applyRecovery(){
    if(!recovery?.eligibleForReview||!audit?.mergeWritesEnabled||busy)return;
    if(!window.confirm("Restore the original subjects, scores and class assignments?"))return;
    setBusy(true);setError("");
    try{await request("/recovery/"+recovery.operationId,{confirmed:true});setRecovery(null);setSuccess(null);await refresh();await openHistory();}
    catch(e){setError(e instanceof Error?e.message:"Recovery failed");}
    finally{setBusy(false);}
  }
  const [tab,setTab]=useState("subjects");
  async function refresh(){
    setBusy(true);setError("");setAudit(null);setPreview(null);setSource("");setTarget("");
    try {setAudit(await request<Audit>("/audit"));}
    catch(e){setError(e instanceof Error?e.message:"Audit failed");}
    finally{setBusy(false);}
  }
  useEffect(()=>{void refresh();},[]);
  async function loadPreview(){
    setBusy(true);setError("");setPreview(null);setChoices({});
    try{setPreview(await request<Preview>("/preview",{sourceId:source,targetId:target}));}
    catch(e){setError(e instanceof Error?e.message:"Preview failed");}
    finally{setBusy(false);}
  }
  async function applyMerge(){
    if(!audit?.mergeWritesEnabled||!preview?.executionEnabled||busy||preview.overlaps.some(o=>!choices[o.records[0].id]))return;
    if(!window.confirm("Merge these subjects? Original scores are backed up before merging. Published results remain protected."))return;
    setBusy(true);setError("");
    try{const retained=audit?.subjects.find(s=>s.id===target)?.name ?? target;const result=await request<{operationId:string;assessmentsMoved:number;assignmentsMoved:number;assignmentsConsolidated?:number}>("/merge-apply",{sourceId:source,targetId:target,expectedRevision:preview.revision,confirmed:true,choices:preview.overlaps.filter(o=>choices[o.records[0].id]).map(o=>({student_id:o.student_id,class_id:o.class_id,session:o.session,term:o.term,revision:o.revision,retainId:choices[o.records[0].id]}))});setSuccess({...result,retained});await refresh();}
    catch(e){setError(e instanceof Error?e.message:"Merge blocked");setPreview(null);}
    finally{setBusy(false);}
  }
  const field="border rounded-md px-3 py-2 w-full bg-background";
  const btn="border rounded-md px-3 py-2 disabled:opacity-50";
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-semibold">Subject Management</h2><p className="text-sm text-muted-foreground">Audit subjects across all schools and safely preview duplicate merges.</p></div><button className={btn} disabled={busy} onClick={refresh}>Refresh audit</button></div>
    {success&&<div role="status" className="border rounded-lg p-4 space-y-2"><h3 className="font-semibold">Subjects merged successfully</h3><p>Retained subject: {success.retained}</p><p>Assessments transferred: {success.assessmentsMoved}</p><p>Class assignments transferred: {success.assignmentsMoved}</p><p>Duplicate assignments consolidated: {success.assignmentsConsolidated??0}</p><p>Operation reference: {success.operationId}</p><button className={btn} onClick={()=>setSuccess(null)}>Dismiss</button></div>}
    {error&&<p role="alert" className="text-red-600">{error}</p>}
    {busy&&<p role="status">Loading subject data...</p>}
    {audit&&<>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Subjects",audit.subjects.length],["Duplicate groups",audit.duplicates.length],["Classes",audit.classes.length],["Empty classes",audit.classes.filter(c=>!c.subject_count).length]].map(([label,n])=><div key={label} className="border rounded-lg p-4"><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold">{n}</p></div>)}</div>
      <nav className="flex flex-wrap gap-2">{[["subjects","All Subjects"],["duplicates","Duplicates"],["classes","Class Assignments"],["merge","Merge Preview"],["master","Master Configuration"],["history","Merge History"]].map(([id,label])=><button key={id} className={btn+(tab===id?" font-bold border-primary":"")} aria-pressed={tab===id} onClick={()=>id==="history"?void openHistory():setTab(id)}>{label}</button>)}</nav>
      {tab==="subjects"&&<><input className={field} placeholder="Search subjects" aria-label="Search subjects" value={search} onChange={e=>setSearch(e.target.value)}/><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Subject</th><th>Class assignments</th><th>Assessments</th></tr></thead><tbody>{audit.subjects.filter(s=>s.name.toLowerCase().includes(search.toLowerCase())).map(s=><tr key={s.id} className="border-b"><td className="py-3">{s.name}</td><td className="text-center">{s.assignments}</td><td className="text-center">{s.assessments}</td></tr>)}</tbody></table></div></>}
      {tab==="duplicates"&&<div className="space-y-3">{audit.duplicates.length===0&&<p>No exact-name duplicate groups found.</p>}{audit.duplicates.map(d=><div className="border rounded-md p-3" key={d.normalized_name}><strong>{d.normalized_name}</strong><p>{d.names.join(" / ")}</p><button className={btn} disabled={busy} onClick={()=>{setSource(d.subject_ids[1]);setTarget(d.subject_ids[0]);setPreview(null);setTab("merge");}}>Review merge</button></div>)}</div>}
      {tab==="classes"&&<><select className={field} aria-label="Filter school" value={school} onChange={e=>setSchool(e.target.value)}><option value="">All schools</option>{Array.from(new Set(audit.classes.map(c=>c.school))).map(s=><option key={s}>{s}</option>)}</select>{audit.classes.filter(c=>!school||c.school===school).map(c=><div key={c.id} className="border-b py-3"><strong>{c.name} — {c.school}</strong><p className="text-sm">{c.subject_count} subjects: {c.subjects.map(s=>s.name).join(", ")||"No subjects assigned"}</p></div>)}</>}
      {tab==="history"&&<div className="space-y-3">{history.length===0&&<p>No active merge operations found.</p>}{history.map(h=><div key={h.operation_id} className="border rounded p-3"><strong>{h.source_name} → {h.target_name}</strong><p>{new Date(h.created_at).toLocaleString()} · {h.assessment_count} original assessments · {h.assignment_count} original assignments</p><button className={btn} disabled={busy} onClick={()=>reviewRecovery(h.operation_id)}>Check recovery eligibility</button></div>)}{recovery&&<div className="border rounded p-3 space-y-2"><strong>{recovery.eligibleForReview?"Eligible for recovery":"Recovery blocked"}</strong>{recovery.reasons.map(reason=><p key={reason}>{reason}</p>)}<button className={btn} disabled={busy||!recovery.eligibleForReview||!audit.mergeWritesEnabled} onClick={applyRecovery}>Restore original subjects</button></div>}</div>}
      {tab==="master"&&<MasterSubjectConfiguration classes={audit.classes} subjects={audit.subjects}/>}
      {tab==="merge"&&<div className="space-y-3"><p className="text-sm">Choose the duplicate to merge and the subject to retain. Preview the impact before applying a merge.</p>{[["Source subject",source,setSource],["Keep subject",target,setTarget]].map(([label,value,setter])=><label key={label as string} className="block space-y-1"><span>{label as string}</span><select disabled={busy} className={field} value={value as string} onChange={e=>{(setter as (v:string)=>void)(e.target.value);setPreview(null);}}><option value="">Select subject</option>{audit.subjects.map(s=><option key={s.id} value={s.id}>{s.name} — {s.assessments} assessments ({s.id.slice(0,8)})</option>)}</select></label>)}<button className={btn} disabled={busy||!source||!target||source===target} onClick={loadPreview}>Preview merge</button>
        {preview&&<div className="space-y-3 border rounded-md p-4"><h3 className="font-semibold">Merge impact</h3>{preview.blockers?.length>0&&<div role="alert" className="border rounded p-3"><strong>Cannot merge these subjects</strong>{preview.blockers.map(b=><p key={b}>{b}</p>)}</div>}<p>{preview.counts.filter(c=>c.subject_id===source).reduce((sum,c)=>sum+c.assessment_count,0)} source assessments · {preview.assignments.length} affected classes · {preview.overlaps.length} assessment conflict groups</p>{preview.warnings.map(w=><p key={w} className="text-sm">{w}</p>)}{preview.overlaps.map((o,i)=><div key={i} className="border-t pt-2"><p>{o.session} / {o.term} — Student reference: {o.student_id}</p>{o.records.map(r=><label key={r.id} className="flex gap-2 text-sm"><input type="radio" name={"conflict-"+i} checked={choices[o.records[0].id]===r.id} onChange={()=>setChoices(old=>({...old,[o.records[0].id]:r.id}))}/>{audit.subjects.find(s=>s.id===r.subjectId)?.name}: CA1 {r.firstCA}, CA2 {r.secondCA}, Exam {r.exam}</label>)}<p className="text-xs">Select the original record to retain. The unselected record is preserved in the merge backup.</p></div>)}<p>{preview.overlaps.filter(o=>choices[o.records[0].id]).length} of {preview.overlaps.length} conflicts reviewed.</p><button className={btn} disabled={!preview.executionEnabled||!audit.mergeWritesEnabled||busy||preview.overlaps.some(o=>!choices[o.records[0].id])} onClick={applyMerge}>Merge Subjects</button><p className="text-xs">{audit.mergeWritesEnabled ? 'Server verification is required.' : 'Merge execution is disabled on the server. Preview only; no records will change.'} Published results and overlapping records remain restricted.</p></div>}
      </div>}
    </>}
  </section>;
}
