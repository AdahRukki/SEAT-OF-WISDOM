// Selected-UID recovery; defaults to a read-only preview. Never moves the cursor.
import 'dotenv/config';
import pg from 'pg';
import {ImapFlow} from 'imapflow';
import {writeFile} from 'node:fs/promises';
import {recoveryEligible,assertRecoveryIdentity} from '../server/email-recovery-guard';
import {extractBodyFromRfc2822,parseEmailAlert} from '../server/email-bank-parser';

const [bank,rawUids,mode]=process.argv.slice(2);
if(!['access','fidelity'].includes(bank)||!/^\d+(,\d+)*$/.test(rawUids||'')||(mode&&mode!=='--apply'))
  throw new Error('Usage: node --import tsx scripts/recover-bank-email-uids.ts access UID,UID [--apply]');
const uids=[...new Set(rawUids.split(',').map(Number))];
if(uids.length>100||uids.some(uid=>!Number.isSafeInteger(uid)||uid<=0))throw new Error('Use 1–100 positive UIDs.');
const mailbox=process.env.EMAIL_INGEST_ADDRESS?.trim();
const password=process.env.EMAIL_INGEST_PASSWORD?.trim();
if(!mailbox||!password)throw new Error('Email credentials are not configured.');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,query_timeout:15000});
const client=new ImapFlow({host:'imap.gmail.com',port:993,secure:true,auth:{user:mailbox,pass:password},logger:false});
let runtimePool:any;
let stage='connecting';
const timer=setTimeout(()=>{console.error('Timed out at',stage,'Rerun to inspect remaining records.');client.close();process.exit(1);},180000);
client.on('error',error=>console.error('IMAP:',error.message));
const resultColumns='uid,outcome,review_status,amount,school_id,linked_transaction_id,reason';
try {
  await db.connect();
  await db.query("SET TIME ZONE 'UTC'");
  const lock=await db.query('SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',['email-recovery:'+mailbox]);
  if(!lock.rows[0].acquired)throw new Error('Another recovery is running.');
  await client.connect();
  const box=await client.mailboxOpen('INBOX',{readOnly:true});
  const {rows:states}=await db.query('SELECT * FROM email_ingest_state WHERE mailbox=$1',[mailbox]);
  const {rows:before}=await db.query('SELECT * FROM email_review_queue WHERE mailbox=$1 AND uid=ANY($2::int[]) ORDER BY uid',[mailbox,uids]);
  if(before.length!==uids.length)throw new Error('Some UIDs have no saved review record. Nothing processed.');
  const pending:any[]=[];
  for(const row of before){
    if(!recoveryEligible(row)){console.log('SKIP UID',row.uid,row.outcome,row.review_status);continue;}
    stage=`preflight UID ${row.uid}`;
    const message=await client.fetchOne(String(row.uid),{uid:true,envelope:true,source:true},{uid:true});
    assertRecoveryIdentity(states[0],box,row,message,bank);
    if(!message||!message.source)throw new Error('Message disappeared.');
    const body=extractBodyFromRfc2822(message.source);
    const parsed=parseEmailAlert({from:row.from_address,subject:row.subject,html:body.html||body.text});
    if(!parsed.ok)throw new Error(`UID ${row.uid}: ${parsed.reason}. Nothing processed.`);
    if(parsed.data.bankName.toLowerCase()!==bank)throw new Error('Parsed bank mismatch.');
    console.log('READY UID',row.uid,parsed.data.transactionDate,parsed.data.amount,parsed.data.reference);
    pending.push({row,message,parsed:parsed.data});
  }
  if(mode!=='--apply'){
    console.log(`PREVIEW: ${pending.length} eligible. No changes saved. Add --apply to recover.`);
  }else if(pending.length){
    const backup=`/tmp/email-recovery-${bank}-${Date.now()}.json`;
    await writeFile(backup,JSON.stringify(before,null,2),{mode:0o600,flag:'wx'});
    console.log('Previous review records saved:',backup);
    const {processMessage}=await import('../server/email-ingest');
    runtimePool=(await import('../server/db')).pool;
    for(const item of pending){
      stage=`recovering UID ${item.row.uid}`;
      const {rows}=await db.query('SELECT * FROM email_review_queue WHERE mailbox=$1 AND uid=$2',[mailbox,item.row.uid]);
      if(!recoveryEligible(rows[0])){console.log('SKIP changed UID',item.row.uid);continue;}
      // Reuse normal authentication, fingerprint dedupe, school routing and audit.
      await processMessage(mailbox,item.message);
      // Existing upsert does not attach the inserted transaction on conflict.
      // Restore that pointer only when the pipeline recorded success and its
      // exact fingerprint resolves to a saved bank transaction.
      await db.query(`UPDATE email_review_queue q SET linked_transaction_id=t.id
        FROM bank_transactions t WHERE q.mailbox=$1 AND q.uid=$2
        AND q.outcome='auto_ingested' AND q.review_status='approved'
        AND q.linked_transaction_id IS NULL AND q.fingerprint=t.fingerprint`,[mailbox,item.row.uid]);
      const saved=await db.query(`SELECT ${resultColumns} FROM email_review_queue WHERE mailbox=$1 AND uid=$2`,[mailbox,item.row.uid]);
      console.log(JSON.stringify(saved.rows[0],null,2));
      if(saved.rows[0]?.outcome==='error'){process.exitCode=1;break;}
    }
  }
  console.log('\nFINAL SAVED STATUS');
  console.table((await db.query(`SELECT ${resultColumns} FROM email_review_queue WHERE mailbox=$1 AND uid=ANY($2::int[]) ORDER BY uid`,[mailbox,uids])).rows);
  console.log('Inbox position unchanged by this command. Unverified items require manual review; duplicate items are not inserted again.');
}catch(error){console.error('STOPPED AT:',stage,error instanceof Error?error.message:String(error));process.exitCode=1;}
finally{clearTimeout(timer);client.close();if(runtimePool)await runtimePool.end();await db.end();}
