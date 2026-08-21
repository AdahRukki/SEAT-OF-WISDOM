// Diagnostic: checks whether bank emails are ever leaving Gmail's INBOX
// folder before the listener gets a chance to see them.
//
// server/email-ingest.ts only ever opens and watches "INBOX" — if a Gmail
// filter routes a bank sender's mail to a label with "Skip the Inbox"
// applied, or Gmail's own spam filter catches it, the message is delivered
// somewhere the listener never looks. That message gets ZERO row in
// email_review_queue and zero log line — not because anything in the app
// filtered it out, but because it was never delivered to the folder the
// app watches in the first place. This script finds that case directly,
// via IMAP, without guessing.
//
// What it does:
//   1. Lists every mailbox/label on the account, so you can see exactly
//      what Gmail calls its Spam and "All Mail" folders on this account.
//   2. Searches Spam for mail from any known bank domain — anything found
//      here was caught by Gmail's spam filter and never reached the
//      listener.
//   3. Searches "All Mail" (which holds every message regardless of label,
//      except Spam/Trash) for mail from any known bank domain, and
//      compares each one's Message-ID against what's currently in INBOX.
//      A bank email present in "All Mail" but NOT in INBOX proves a Gmail
//      filter (or a manual archive/label action) routed it away from
//      INBOX — the listener could never have seen it.
//
// This does NOT reach Gmail's Settings > Filters and Blocked Addresses
// list itself (that's a web/API-only feature, not exposed over plain
// IMAP) — but the "All Mail minus INBOX" comparison shows the *effect* of
// such a filter directly, which is what actually matters here.
//
// Run on the VPS:
//   npx tsx scripts/check-gmail-routing.ts
//
// Read-only — does not move, label, or delete anything.

import "dotenv/config";
import { ImapFlow } from "imapflow";

// Same trusted domain list as server/email-ingest.ts's TRUSTED_BANK_DOMAINS,
// plus etransmail.com (Fidelity's forwarding relay — the address these
// alerts actually arrive *from* once forwarded, even though DKIM/ARC
// verification looks past it to the original fidelitybank.ng signer).
const BANK_DOMAINS = [
  "zenithbank.com",
  "accessbankplc.com",
  "accessbank.com",
  "fidelitybank.ng",
  "etransmail.com",
  "firstbanknigeria.com",
  "gtbank.com",
  "gtcoplc.com",
  "uba.africa",
  "ubagroup.com",
  "unionbankng.com",
  "polarisbankng.com",
  "wemabank.com",
  "keystonebankng.com",
  "sterlingbank.com",
  "stanbicibtc.com",
  "fcmb.com",
  "ecobank.com",
];

type Row = { uid: number; messageId: string; date: string; from: string; subject: string };

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
  console.log(`Connected to ${address}.\n`);

  const mailboxes = await client.list();
  console.log("Mailboxes/labels on this account:");
  for (const mb of mailboxes) {
    console.log(`  ${mb.path}${mb.specialUse ? `  [${mb.specialUse}]` : ""}`);
  }

  const spamBox = mailboxes.find((m) => m.specialUse === "\\Junk");
  const allMailBox = mailboxes.find((m) => m.specialUse === "\\All");

  async function scanForBankMail(path: string, label: string): Promise<Row[]> {
    console.log(`\nScanning ${label} ("${path}") for mail from known bank domains...`);
    const lock = await client.getMailboxLock(path);
    const rows: Row[] = [];
    try {
      const uidSet = new Set<number>();
      for (const domain of BANK_DOMAINS) {
        try {
          const uids = await client.search({ from: domain }, { uid: true });
          const list: number[] = Array.isArray(uids) ? uids : [];
          for (const u of list) uidSet.add(u);
        } catch (searchErr) {
          console.error(`  (search for "${domain}" in ${label} failed:`, searchErr, ")");
        }
      }
      if (uidSet.size === 0) {
        console.log(`  0 message(s) found.`);
        return rows;
      }
      for await (const message of client.fetch(
        [...uidSet],
        { uid: true, envelope: true },
        { uid: true }
      )) {
        rows.push({
          uid: message.uid,
          messageId: message.envelope?.messageId ?? "",
          date: message.envelope?.date ? new Date(message.envelope.date).toISOString() : "?",
          from: message.envelope?.from?.[0]?.address ?? "?",
          subject: message.envelope?.subject ?? "",
        });
      }
    } finally {
      lock.release();
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    console.log(`  ${rows.length} message(s) found.`);
    for (const r of rows) {
      console.log(`    UID ${r.uid}\t${r.date}\t${r.from}\t${r.subject}`);
    }
    return rows;
  }

  const inboxRows = await scanForBankMail("INBOX", "INBOX");
  const spamRows = spamBox ? await scanForBankMail(spamBox.path, "Spam") : [];
  const allMailRows = allMailBox ? await scanForBankMail(allMailBox.path, "All Mail") : [];

  console.log(`\n${"=".repeat(70)}`);
  console.log("RESULT");
  console.log("=".repeat(70));

  if (!spamBox) {
    console.log("\nCould not find a Spam/Junk mailbox on this account (unexpected for Gmail) — skipped.");
  } else if (spamRows.length > 0) {
    console.log(
      `\n⚠ ${spamRows.length} bank email(s) found in Spam. These were caught by Gmail's ` +
        `spam filter and never reached INBOX — the listener never saw them and never will, ` +
        `unless you move them to INBOX yourself (or add a Gmail filter to never send this ` +
        `sender to Spam).`
    );
  } else {
    console.log("\n✓ No bank emails found in Spam.");
  }

  if (!allMailBox) {
    console.log("\nCould not find an \"All Mail\" mailbox on this account (unexpected for Gmail) — skipped.");
  } else {
    const inboxIds = new Set(inboxRows.map((r) => r.messageId).filter(Boolean));
    const missing = allMailRows.filter((r) => r.messageId && !inboxIds.has(r.messageId));
    if (missing.length > 0) {
      console.log(
        `\n⚠ ${missing.length} bank email(s) exist somewhere in the account (per "All Mail") ` +
          `but are NOT currently in INBOX. This means either a Gmail filter routed them away ` +
          `from Inbox on arrival (a filter with "Skip the Inbox" / "Apply label" checked), or ` +
          `they were manually archived after arriving — either way, the listener could not ` +
          `have seen them while they were outside INBOX:`
      );
      for (const r of missing) {
        console.log(`    ${r.date}\t${r.from}\t${r.subject}`);
      }
      console.log(
        `\nTo confirm a filter is the cause: Gmail web UI > Settings (gear icon) > See all ` +
          `settings > Filters and Blocked Addresses — look for any rule matching these senders ` +
          `with "Skip the Inbox" checked, and either delete that rule or uncheck that box.`
      );
    } else {
      console.log("\n✓ Every bank email found in \"All Mail\" is also currently in INBOX — no routing rule is diverting them.");
    }
  }

  await client.logout();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
