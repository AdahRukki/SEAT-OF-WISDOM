import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractBodyFromRfc2822,htmlToTabText,parseEmailAlert} from '../../server/email-bank-parser';
const fields=[['A/C Number','192******748'],['Account Name','TEST SCHOOL'],['Description','Transfer from EXAMPLE PAYER'],['Reference Number','TEST2625700Hx'],['Transaction Branch','ASABA BRANCH'],['Transaction Date','12-Oct-2026'],['Value Date','12-Oct-2026'],['Available Balance','13,470,475.95']];
const html=(signal='Credited')=>`<html><!--\nLayout comments for Windows 10 Mail\n-->\n<style>body {color:red}</style><h2>Your account has been ${signal}</h2><h1>NGN 8,000.00</h1><h2>Transaction Summary</h2><table>${fields.map(([k,v])=>`<tr><td>\n\t${k}\n</td><td>\n\t${v}\n</td></tr>`).join('\n')}</table></html>`;
const parse=(body:string,subject='AccessAlert Transaction Alert [Credit: 8,000.00 NGN]')=>parseEmailAlert({from:'no_reply@accessbankplc.com',subject,html:body});
const verify=(r:ReturnType<typeof parse>)=>{assert.equal(r.ok,true);if(!r.ok)return;assert.equal(r.data.bankName,'Access');assert.equal(r.data.amount,8000);assert.equal(r.data.transactionDate,'12/10/2026');assert.equal(r.data.maskedAccount,'192******748');assert.equal(r.data.reference,'TEST2625700Hx');assert.equal(r.data.rawDescription,'Transfer from EXAMPLE PAYER');assert.equal(r.data.balanceKey,'13470475.95');};
for(const encoding of ['8bit','quoted-printable','base64'])test(`Access full body survives HTML comment with ${encoding}`,()=>{
 const data=Buffer.from(html());const payload=encoding==='base64'?data.toString('base64'):encoding==='quoted-printable'?Array.from(data).map(b=>b===10?'\r\n':b>=32&&b<127&&b!==61?String.fromCharCode(b):'='+b.toString(16).toUpperCase().padStart(2,'0')).join(''):html();
 const raw=`MIME-Version: 1.0\r\nContent-Type: multipart/alternative;\r\n boundary="actual-boundary"\r\n\r\nPreamble\r\n--actual-boundary\r\nContent-Type: text/plain\r\n\r\nplain alternative\r\n--actual-boundary\r\nContent-Transfer-Encoding: ${encoding}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${payload}\r\n--actual-boundary--\r\nEpilogue`;
 const body=extractBodyFromRfc2822(Buffer.from(raw));assert.equal(body.text,'plain alternative');assert.ok(body.html.includes('Reference Number'));assert.ok(!body.html.includes('Epilogue'));assert.ok(!htmlToTabText(body.html).includes('Windows 10'));verify(parse(body.html));
});
test('single-part email with HTML comments is complete',()=>verify(parse(extractBodyFromRfc2822(Buffer.from('Content-Type: text/html\r\n\r\n'+html())).html)));
test('nested multipart ignores HTML attachments and keeps real HTML',()=>{
 const raw=`Content-Type: multipart/mixed; boundary=outer\n\n--outer\nContent-Type: text/html\nContent-Disposition: attachment; filename="fake.html"\n\nFAKE PAYMENT\n--outer\nContent-Type: multipart/alternative; boundary=inner\n\n--inner\nContent-Type: text/html; charset=UTF-8\n\n${html()}\n--inner--\n--outer--`;
 verify(parse(extractBodyFromRfc2822(Buffer.from(raw)).html));
});
test('debit body rejected despite credit subject',()=>assert.equal(parse(html('Debited')).ok,false));
test('debit subject rejected despite credit body',()=>assert.equal(parse(html(),'AccessAlert [Debit: 8,000.00 NGN]').ok,false));
test('subject alone cannot authorize credit',()=>assert.equal(parse(html().replace('Your account has been Credited','Transaction alert')).ok,false));
test('mismatched subject amount rejected',()=>assert.equal(parse(html(),'AccessAlert [Credit: 80,000.00 NGN]').ok,false));
test('available balance cannot substitute missing transaction amount',()=>assert.equal(parse(html().replace('<h1>NGN 8,000.00</h1>','').replace('13,470,475.95','NGN 13,470,475.95')).ok,false));
test('conflicting heading amounts rejected',()=>assert.equal(parse(html().replace('<h1>NGN 8,000.00</h1>','<h1>NGN 8,000.00</h1><p>NGN 9,000.00</p>')).ok,false));
for(const value of ['192******748','Transfer from EXAMPLE PAYER','TEST2625700Hx','12-Oct-2026'])test(`missing required detail ${value} rejected`,()=>assert.equal(parse(html().replaceAll(value,'')).ok,false));
test('impossible date rejected',()=>assert.equal(parse(html().replaceAll('12-Oct-2026','31-Feb-2026')).ok,false));
test('a boundary prefix inside HTML does not terminate the body',()=>{
 const raw=`Content-Type: multipart/alternative; boundary=real\r\n\r\n--real\r\nContent-Type: text/html\r\n\r\n<!--\r\n--real-not-a-delimiter\r\n-->\r\n${html()}\r\n--real--`;
 verify(parse(extractBodyFromRfc2822(Buffer.from(raw)).html));
});
test('Zenith multipart credit still extracts and parses',()=>{
 const body='<h1>CREDIT TRANSACTION NOTIFICATION</h1><table>'+[['Account Number','238****209'],['Date of Transaction','12/10/2026'],['Amount','70,000.00'],['Currency','NGN'],['Description','CIP CR EXAMPLE'],['Transaction Type','CREDIT'],['Available Balance','155,881.17']].map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')+'</table>';
 const extracted=extractBodyFromRfc2822(Buffer.from(`Content-Type: multipart/alternative; boundary=z\r\n\r\n--z\r\nContent-Type: text/html\r\n\r\n${body}\r\n--z--`));
 const result=parseEmailAlert({from:'ebusinessgroup@zenithbank.com',subject:'ZENITH BANK TRANSACTION ALERT',html:extracted.html});
 assert.equal(result.ok,true);if(result.ok){assert.equal(result.data.amount,70000);assert.equal(result.data.transactionDate,'12/10/2026');}
});
