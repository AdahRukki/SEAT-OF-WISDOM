import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {studentImportKey} from '../../server/student-history';

const source=fs.readFileSync(new URL('../../client/src/lib/queryClient.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('queryClient.ts',source,ts.ScriptTarget.Latest,true);
const names=['apiRequest','isWriteMethod'];
const code=ast.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name!.text)).map(n=>n.getText(ast).replace('export async function','async function')).join('\n');
const compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;

test('the actual browser request and queued offline replay share a command key, including a response lost after a server write',async()=>{
  const sent:any[]=[];const queued:any[]=[];
  class OfflineQueuedError extends Error {}
  const request=new Function('fetch','localStorage','enqueueOperation','generateClientRequestId','dispatchOffline','dispatchOnline','isOfflineStub','throwIfResNotOk','clearAuthOnly','OfflineQueuedError',compiled+';return apiRequest;')(
    async(url:string,options:any)=>{sent.push({url,body:JSON.parse(options.body)});throw new TypeError('Connection lost after write');},
    {getItem:()=>null},(url:string,method:string,body:any)=>queued.push({url,method,body}),()=> 'stable-command-key',()=>{},()=>{},async()=>false,async()=>{},()=>{},OfflineQueuedError);
  await assert.rejects(request('/api/admin/withdraw-students',{method:'POST',body:{studentIds:['student']}}),OfflineQueuedError);
  assert.equal(sent[0].body.clientRequestId,'stable-command-key');assert.deepEqual(queued[0].body,sent[0].body);
  await assert.rejects(request('/api/admin/students/student',{method:'PATCH',body:{isActive:true,clientRequestId:'already-keyed'}}),OfflineQueuedError);
  assert.equal(sent[1].body.clientRequestId,'already-keyed');assert.deepEqual(queued[1].body,sent[1].body);
});

test('bulk import keys depend on normalized rows and target class, preserving replay identity across workbook metadata changes',()=>{
  const rows=[{'First Name':' Ada ','Last Name':'Student','Parent WhatsApp':123}];
  const reSaved=[{'Parent WhatsApp':'123','Last Name':'Student','First Name':'Ada'}];
  assert.equal(studentImportKey('class-a',rows),studentImportKey('class-a',reSaved));
  assert.notEqual(studentImportKey('class-a',rows),studentImportKey('class-b',rows));
  assert.notEqual(studentImportKey('class-a',rows),studentImportKey('class-a',[...rows,...rows]));
});
