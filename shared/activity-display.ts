import { ALL_PERMISSIONS } from "./permissions";
// Presentation only: preserve the original audit payloads unchanged.
const labels: Record<string,string> = {
  firstName:'First name',middleName:'Middle name',lastName:'Surname',isActive:'Account access',
  studentType:'Student category',classId:'Class reference',studentId:'Student reference',
  schoolId:'School reference',userId:'User reference',feeTypeId:'Fee reference',
  amountMoved:'Amount moved to tuition',amount:'Amount',totalAmount:'Total amount',
  tuitionAssigned:'Tuition charge',tuitionPaid:'Tuition paid',balance:'Balance',discount:'Discount',
  ca1:'First CA',ca2:'Second CA',exam:'Exam score',purpose:'Payment purpose',
  term:'Term',session:'Session',reason:'Reason',status:'Status',permissions:'Access permissions',
  deactivatedCount:'Accounts deactivated',movedCount:'Students moved',studentIds:'Student references',
  currentClassId:'Previous class reference',nextClassId:'Destination class reference',
};
export function readableLabel(key:string):string {
  return labels[key] || key.replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase());
}
const hidden = /password|token|secret|credential|authorization|cookie|hash/i;
const money = /^(amount|amountMoved|totalAmount|allocatedAmount|tuitionAssigned|tuitionPaid|balance|discount|totalPaid|totalFees)$/;
export function activityValue(key:string,value:unknown):string {
  if(value === undefined) return 'Not recorded';
  if(value === null || value === '') return 'Not set';
  if(typeof value === 'boolean') return key==='isActive' ? (value?'Enabled':'Disabled') : (value?'Yes':'No');
  if(money.test(key) && (typeof value==='number'||typeof value==='string') && Number.isFinite(Number(value)))
    return new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:2}).format(Number(value));
  const text=String(value);
  if(/^\d{4}-\d{2}-\d{2}T/.test(text) && !Number.isNaN(Date.parse(text))) return new Date(text).toLocaleString('en-GB',{timeZone:'Africa/Lagos'})+' WAT';
  const values:Record<string,string>={recorded:'Awaiting confirmation',confirmed:'Confirmed',reversed:'Reversed',new:'New student',returning:'Returning student','sub-admin':'Sub-admin',admin:'Main admin',true:'Yes',false:'No'};
  if(['status','studentType','role'].includes(key) && values[text]) return values[text];
  return text;
}
function flatten(data:unknown,path:string[]=[],out=new Map<string,{label:string;key:string;value:unknown}>()) {
  if(Array.isArray(data) && path[path.length-1] === 'permissions') {
    const text=data.map(key=>ALL_PERMISSIONS.find(p=>p.key===key)?.label || readableLabel(String(key))).sort().join(', ') || 'None';
    out.set(path.join('.'),{label:'Access permissions',key:'permissions',value:text});
  } else if(data && typeof data==='object') {
    const items=Array.isArray(data) ? data.map((value,i)=>[String(i),value] as const) : Object.entries(data);
    if(!items.length && path.length) out.set(path.join('.'),{label:path.map(readableLabel).join(' · '),key:path.at(-1)!,value:'None'});
    for(const [key,value] of items) {
      if(hidden.test(key) || ['createdAt','updatedAt','clientRequestId','batchId','fingerprint'].includes(key)) continue;
      const part=Array.isArray(data)?`Item ${Number(key)+1}`:key;
      flatten(value,[...path,part],out);
    }
  } else {
    const key=path.at(-1)||'Details';
    out.set(path.join('.'),{label:path.map(readableLabel).join(' · ')||'Details',key,value:data});
  }
  return out;
}
export function activityChanges(before:unknown,after:unknown) {
  const old=before==null?new Map():flatten(before), next=after==null?new Map():flatten(after);
  return Array.from(new Set([...Array.from(old.keys()),...Array.from(next.keys())])).flatMap(path=>{
    const a=old.get(path), b=next.get(path);
    if(a && b && Object.is(a.value,b.value)) return [];
    const field=b||a;
    return [{field:field.label,before:activityValue(field.key,a?.value),after:activityValue(field.key,b?.value)}];
  });
}
export function activitySubject(before:any,after:any):string {
  for(const data of [after,before]) {
    if(!data || typeof data!=='object')continue;
    for(const key of ['studentName','fullName','className','subjectName','name'])
      if(typeof data[key]==='string' && data[key].trim())return data[key];
    const name=[data.firstName,data.middleName,data.lastName].filter(v=>typeof v==='string'&&v.trim()).join(' ');
    if(name)return name;
  }
  return '';
}
