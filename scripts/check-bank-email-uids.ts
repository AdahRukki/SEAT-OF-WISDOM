// Read-only: does not insert payments, update the review queue, move the cursor,
// or mark Gmail messages read. Run on the VPS with its existing .env.
import 'dotenv/config';
import {ImapFlow} from 'imapflow';
import {extractBodyFromRfc2822,parseEmailAlert,htmlToTabText} from '../server/email-bank-parser';

const [bank, rawUids] = process.argv.slice(2);
if (!['access','fidelity'].includes(bank) || !/^\d+(,\d+)*$/.test(rawUids || '')) {
  console.error('Usage: node --import tsx scripts/check-bank-email-uids.ts access 1762,1773');
  process.exit(1);
}
const uids = [...new Set(rawUids.split(',').map(Number))];
if(uids.length > 100 || uids.some(uid=>!Number.isSafeInteger(uid)||uid<=0))throw new Error('Use 1–100 positive UIDs.');
const address=process.env.EMAIL_INGEST_ADDRESS?.trim();
const password=process.env.EMAIL_INGEST_PASSWORD?.trim();
if(!address||!password)throw new Error('Email ingestion credentials are not configured.');
const client=new ImapFlow({host:'imap.gmail.com',port:993,secure:true,auth:{user:address,pass:password},logger:false});
let stage='connecting';
const timer=setTimeout(()=>{console.error('TIMED OUT AT:',stage);client.close();process.exit(1);},120000);
client.on('error',error=>console.error('IMAP:',error.message));
let passed=0;
try {
  await client.connect();
  await client.mailboxOpen('INBOX',{readOnly:true});
  for(const uid of uids){
    stage=`fetching UID ${uid}`;
    const message=await client.fetchOne(String(uid),{envelope:true,source:true},{uid:true});
    if(!message?.source){console.log('UID',uid,'NOT FOUND');process.exitCode=1;continue;}
    const from=message.envelope?.from?.[0]?.address||'';
    const expected=bank==='access'?/^[^@]+@(?:accessbankplc\.com|accessbank\.com)$/i:/^[^@]+@fidelitybank\.ng$/i;
    if(!expected.test(from)){console.log('UID',uid,'WRONG BANK SENDER');process.exitCode=1;continue;}
    const body=extractBodyFromRfc2822(message.source);
    const result=parseEmailAlert({from,subject:message.envelope?.subject||'',html:body.html||body.text});
    console.log('\nUID:',uid,JSON.stringify(result,null,2));
    if(result.ok){passed++;}else{
      process.exitCode=1;
      console.log('EXTRACTED BODY:',JSON.stringify(htmlToTabText(body.html||body.text).slice(0,6000)));
    }
  }
  console.log(`\n${passed}/${uids.length} parsed successfully. READ ONLY: no transactions were saved.`);
} catch(error){console.error('FAILED AT:',stage,error instanceof Error?error.message:String(error));process.exitCode=1;}
finally{clearTimeout(timer);client.close();}
