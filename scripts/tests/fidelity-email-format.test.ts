import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractBodyFromRfc2822,parseEmailAlert} from '../../server/email-bank-parser';
const fields=[['Account','******0025'],['Account Name','TEST SCHOOL'],['Narration','TRF Example To SCHOOL|ussd transfer'],['Transaction Reference','TEST79869444'],['Date/Time','Oct 12, 2026 12:13:14 PM'],['Available Balance','₦28,828,457.12CR']];
const html=(suffix='CR',spaced=false)=>`<html><style>body { color: red; }</style><p>₦20,000.00${spaced?' ':''}${suffix}</p><table>${fields.map(([k,v])=>`<tr><td>\n\t\t${k}\n</td>\n<td>\n\t\t${v}\n</td></tr>`).join('\n')}</table></html>`;
const parse=(body:string)=>parseEmailAlert({from:'ibanking@fidelitybank.ng',subject:'Credit Transaction Alert',html:body});
for(const enc of ['8bit','quoted-printable','base64'])test(`Fidelity multiline ${enc} decodes currency and all transaction fields`,()=>{
 const body=html();const bytes=Buffer.from(body);
 const encoded=enc==='base64'?bytes.toString('base64'):enc==='quoted-printable'?Array.from(bytes).map(b=>b===10?'\r\n':b>=32&&b<127&&b!==61?String.fromCharCode(b):'='+b.toString(16).toUpperCase().padStart(2,'0')).join(''):body;
 const source=Buffer.from(`MIME-Version: 1.0\r\nContent-Transfer-Encoding: ${enc}\r\nContent-Type: text/html; charset="UTF-8"\r\n\r\n${encoded}`);
 const extracted=extractBodyFromRfc2822(source);assert.ok(extracted.html.includes('₦20,000.00CR'));
 const r=parse(extracted.html);assert.equal(r.ok,true);if(!r.ok)return;
 assert.equal(r.data.amount,20000);assert.equal(r.data.transactionDate,'12/10/2026');assert.equal(r.data.maskedAccount,'******0025');assert.equal(r.data.reference,'TEST79869444');assert.equal(r.data.balanceKey,'28828457.12');assert.equal(r.data.rawDescription,fields[2][1]);
});
test('legacy spaced credit remains supported',()=>assert.equal(parse(html('CR',true)).ok,true));
test('debit never becomes credit from its positive balance',()=>assert.equal(parse(html('DR')).ok,false));
test('balance alone is never treated as transaction amount',()=>assert.equal(parse(html().replace('<p>₦20,000.00CR</p>','')).ok,false));
test('missing date fails instead of substituting today',()=>assert.equal(parse(html().replace(fields[4][1], '')).ok,false));
