import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true});
try {
 const context=await browser.newContext({viewport:{width:360,height:740},serviceWorkers:'block'});
 await context.addInitScript(()=>localStorage.setItem('auth_token','test-only'));
 const page=await context.newPage(); const errors=[]; const posted=[];
 page.on('pageerror',e=>errors.push(e.message));
 const school={id:'00000000-0000-4000-8000-000000000001',name:'School One'};
 const cls={id:'a',name:'Primary 1',schoolId:school.id};
 let students=[1,2].map(n=>({id:`00000000-0000-4000-8000-00000000000${n+3}`,studentId:`SOWA/100${n}`,classId:'a',status:'active',class:cls,user:{firstName:`Ada${n}`,middleName:'Grace',lastName:'Student',isActive:true}}));
 await context.route('**/api/**',async route=>{
  const p=new URL(route.request().url()).pathname; let body=[];
  if(p==='/api/auth/me') body={id:'admin',firstName:'Test',lastName:'Admin',role:'admin',schoolId:school.id};
  if(p==='/api/admin/schools') body=[school];
  if(p==='/api/admin/classes') body=[cls];
  if(p==='/api/admin/students') body=students.filter(s=>s.user.isActive);
  if(p==='/api/admin/students/inactive') body=students.filter(s=>!s.user.isActive);
  if(p==='/api/current-academic-info') body={currentTerm:'First Term',currentSession:'2026/2027'};
  if(p.includes('financial-summary')) body={totalCollected:0,totalExpected:0,totalOutstanding:0};
  if(p.includes('activity-logs')) body={logs:[],total:0};
  if(p==='/api/logo') body={logoUrl:'/favicon.png'};
  if(p==='/api/admin/students/deactivate-batch') {posted.push(route.request().postDataJSON());students=students.map(s=>({...s,user:{...s.user,isActive:false}}));body={deactivatedCount:2};}
  await route.fulfill({json:body});
 });
 await page.goto(process.env.BATCH_TEST_URL || `http://127.0.0.1:5176/portal/admin/school/${school.id}?tab=students`);
 await page.getByText('Choose a class to view students...', {exact:true}).click();
 await page.getByRole('option',{name:/Primary 1/}).click();
 await page.getByLabel('Select all',{exact:true}).check();
 await page.getByTestId('button-batch-deactivate').click();
 const dialog=page.getByRole('dialog');
 await dialog.getByText('Deactivate 2 students?',{exact:true}).waitFor();
 assert.equal(await dialog.getByText(/SOWA\/100/).count(),2);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click(); assert.equal(posted.length,0);
 await page.getByTestId('button-batch-deactivate').click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await dialog.getByRole('button',{name:'Confirm deactivation',exact:true}).click();
 await page.getByText('Students deactivated',{exact:true}).waitFor();
 assert.equal(posted.length,1); assert.equal(posted[0].studentIds.length,2); assert.equal(posted[0].classId,'a');
 assert.deepEqual(errors,[]); console.log('PASS: mobile selection, name confirmation, cancel, submission, no overflow or runtime errors');
 await context.close();
} finally {await browser.close();}
