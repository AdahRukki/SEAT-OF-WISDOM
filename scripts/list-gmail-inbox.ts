// Diagnostic: lists every message currently in the monitored Gmail inbox
// directly via IMAP — completely bypassing all of email-ingest.ts's
// filtering/parsing/routing logic. Use this to compare against
// `email_review_queue` and find genuine gaps: a UID that exists here but
// has no row at all in that table was never even attempted by the
// listener, as opposed to one that was attempted and just didn't parse or
// route the way you expected.
//
// Run on the VPS (uses the same EMAIL_INGEST_ADDRESS/EMAIL_INGEST_PASSWORD
// the app already has configured):
//   npx tsx scripts/list-gmail-inbox.ts
//
// Read-only — does not mark anything as read, does not modify the mailbox.

import "dotenv/config"; // same .env the app itself loads — this script is run standalone, not via pm2
import { ImapFlow } from "imapflow";

async function main() {
  const address = process.env.EMAIL_INGEST_ADDRESS?.trim();
  const password = process.env.EMAIL_INGEST_PASSWORD?.trim();

  if (!address || !password) {
    console.error("EMAIL_INGEST_ADDRESS / EMAIL_INGEST_PASSWORD not set in the environment.");
    process.exit(1);
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: address, pass: password },
    logger: false,
  });

  await client.connect();
  const mailboxInfo = await client.mailboxOpen("INBOX");
  console.log(`Connected to ${address} — INBOX has ${mailboxInfo.exists} message(s), uidNext=${mailboxInfo.uidNext}\n`);

  const lock = await client.getMailboxLock("INBOX");
  try {
    const rows: Array<{ uid: number; date: string; from: string; subject: string }> = [];
    for await (const message of client.fetch("1:*", { uid: true, envelope: true }, { uid: true })) {
      rows.push({
        uid: message.uid,
        date: message.envelope?.date ? new Date(message.envelope.date).toISOString() : "?",
        from: message.envelope?.from?.[0]?.address ?? "?",
        subject: message.envelope?.subject ?? "",
      });
    }
    rows.sort((a, b) => a.uid - b.uid);
    console.log(`UID\tDate\t\t\tFrom\t\t\t\tSubject`);
    for (const r of rows) {
      console.log(`${r.uid}\t${r.date}\t${r.from}\t${r.subject}`);
    }
    console.log(`\nTotal: ${rows.length} message(s) currently in INBOX.`);
  } finally {
    lock.release();
  }

  await client.logout();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
