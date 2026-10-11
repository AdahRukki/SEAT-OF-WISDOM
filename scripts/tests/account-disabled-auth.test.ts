import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import jwt from 'jsonwebtoken';

// Execute the actual middleware with real JWT verification and a controlled
// user lookup. No production accounts, database or HTTP writes are involved.
const source=fs.readFileSync(new URL('../../server/routes.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('routes.ts',source,ts.ScriptTarget.Latest,true);
const initializers=new Map<string,string>();
function visit(node:ts.Node){
  if(ts.isVariableDeclaration(node)&&['authenticate','optionalAuthenticate'].includes(node.name.getText(ast))) initializers.set(node.name.getText(ast),node.initializer!.getText(ast));
  ts.forEachChild(node,visit);
}
visit(ast);
const secret='isolated-auth-regression-test-secret';
function fixture(){
  let user:any={id:'test-user',role:'admin',isActive:true,passwordUpdatedAt:null};
  const invalidatedTokens=new Set<string>();
  const storage={getUserById:async(id:string)=>user?.id===id?user:undefined};
  const create=(name:string)=>{
    const compiled=ts.transpileModule('const middleware='+initializers.get(name),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
    return new Function('jwt','storage','invalidatedTokens','JWT_SECRET',compiled+';return middleware;')(jwt,storage,invalidatedTokens,secret);
  };
  const middlewares={authenticate:create('authenticate'),optionalAuthenticate:create('optionalAuthenticate')};
  const token=jwt.sign({userId:user.id},secret,{expiresIn:'1h'});
  async function request(name:keyof typeof middlewares,credential:string|undefined=token){
    const req:any={headers:credential?{authorization:`Bearer ${credential}`}:{}};
    const res:any={statusCode:200,body:null,status(code:number){this.statusCode=code;return this;},json(body:any){this.body=body;return this;}};
    let nextCalled=false;
    await middlewares[name](req,res,()=>{nextCalled=true;});
    return {req,res,nextCalled};
  }
  return {request,token,invalidatedTokens,setUser:(value:any)=>{user=value;},getUser:()=>user};
}
test('an existing valid token stops working on the next request after its account is disabled',async()=>{
  const f=fixture();assert.equal((await f.request('authenticate')).nextCalled,true);
  f.getUser().isActive=false;
  const result=await f.request('authenticate');
  assert.equal(result.res.statusCode,401);assert.equal(result.nextCalled,false);assert.equal(result.req.user,undefined);
});
test('disabled and null-active accounts receive no identity on optional-auth object routes',async()=>{
  const f=fixture();
  for(const isActive of [false,null]){
    f.getUser().isActive=isActive;
    const protectedResult=await f.request('authenticate');assert.equal(protectedResult.nextCalled,false);assert.equal(protectedResult.res.statusCode,401);
    const optional=await f.request('optionalAuthenticate');assert.equal(optional.nextCalled,true);assert.equal(optional.req.user,undefined);assert.equal(optional.req.token,undefined);
  }
});
test('active accounts retain access through both authentication paths',async()=>{
  const f=fixture();for(const name of ['authenticate','optionalAuthenticate'] as const){const r=await f.request(name);assert.equal(r.nextCalled,true);assert.equal(r.req.user.id,'test-user');}
});
test('missing users and invalid JWTs cannot acquire an identity',async()=>{
  const f=fixture();f.setUser(undefined);
  assert.equal((await f.request('authenticate')).res.statusCode,401);
  assert.equal((await f.request('optionalAuthenticate')).req.user,undefined);
  assert.equal((await f.request('authenticate','invalid-token')).res.statusCode,401);
  assert.equal((await f.request('optionalAuthenticate','invalid-token')).req.user,undefined);
});
test('password-change and token-revocation protections still apply to active accounts',async()=>{
  const f=fixture();f.getUser().passwordUpdatedAt=new Date(Date.now()+1000);
  assert.equal((await f.request('authenticate')).res.statusCode,401);
  assert.equal((await f.request('optionalAuthenticate')).req.user,undefined);
  f.getUser().passwordUpdatedAt=null;f.invalidatedTokens.add(f.token);
  assert.equal((await f.request('authenticate')).res.statusCode,401);
  assert.equal((await f.request('optionalAuthenticate')).req.user,undefined);
});
