// IMAP email bank-alert poller.
//
// Connects to a dedicated Gmail inbox via IMAP (TLS port 993) and polls for
// unseen messages every 60 seconds.  Credit-alert emails are parsed by
// email-bank-parser.ts and inserted into the bank_transactions reconciliation
// queue with source = 'email'.  Duplicates are detected by fingerprint (the
// same algorithm used for SMS and PDF rows, so a transaction that arrives via
// both SMS and email is never double-entered).
//
// Required env vars (set via Replit Secrets):
//   EMAIL_INGEST_ADDRESS  — Gmail address (e.g. sowabankealerts@gmail.com)
//   EMAIL_INGEST_PASSWORD — Google App Password (16-char code)
//
// If either variable is absent the poller logs a warning and returns without
// starting — the rest of the application is unaffected.

import { ImapFlow } from "imapflow";
import { storage } from "./storage";
import { parseEmailAlert, extractBodyFromRfc2822 } from "./email-bank-parser";

const POLL_INTERVAL_MS = 60_000; // 1 minute

// ── Helper: parse a date string "DD/MM/YYYY" → JS Date ───────────────────────
function parseTransactionDate(dateStr: string): Date {
  const [dd, mm, yyyy] = dateStr.split("/");
  return new Date(`${yyyy}-${mm}-${dd}`);
}

// ── One poll cycle ────────────────────────────────────────────────────────────

async function pollOnce(address: string, password: string): Promise<void> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: address, pass: password },
    logger: false, // suppress verbose imapflow logging
  });

  await client.connect();

  const lock = await client.getMailboxLock("INBOX");
  let ingested = 0;
  let skipped = 0;

  try {
    // Collect all unseen UIDs first so we can iterate safely.
    const unseenUids = await client.search({ seen: false }, { uid: true });

    if (unseenUids.length === 0) return; // nothing to do

    for await (const message of client.fetch(
      unseenUids,
      { uid: true, envelope: true, source: true },
      { uid: true }
    )) {
      const uid = message.uid;
      const from = message.envelope?.from?.[0]?.address ?? "";
      const subject = message.envelope?.subject ?? "";
      const receivedAt: Date = message.envelope?.date ?? new Date();

      try {
        const sourceBuffer = message.source as Buffer | undefined;
        if (!sourceBuffer || sourceBuffer.length === 0) {
          await client.messageFlagsAdd(`${uid}`, ["\\Seen"], { uid: true });
          skipped++;
          continue;
        }

        const { html, text } = extractBodyFromRfc2822(sourceBuffer);
        const bodyForParsing = html || text;

        if (!bodyForParsing.trim()) {
          console.log(`[email-ingest] Skipping empty body: "${subject}" from ${from}`);
          await client.messageFlagsAdd(`${uid}`, ["\\Seen"], { uid: true });
          skipped++;
          continue;
        }

        const result = parseEmailAlert({ from, subject, html: bodyForParsing });

        if (!result.ok) {
          console.log(`[email-ingest] Skipping (${result.reason}): "${subject}" from ${from}`);
          await client.messageFlagsAdd(`${uid}`, ["\\Seen"], { uid: true });
          skipped++;
          continue;
        }

        const alert = result.data;

        // ── Duplicate check ─────────────────────────────────────────────────
        const alreadyExists = await storage.checkTransactionFingerprint(alert.fingerprint);
        if (alreadyExists) {
          console.log(
            `[email-ingest] Duplicate fingerprint (${alert.fingerprint.substring(0, 8)}…): "${subject}"`
          );
          await client.messageFlagsAdd(`${uid}`, ["\\Seen"], { uid: true });
          skipped++;
          continue;
        }

        // ── Route by masked account ─────────────────────────────────────────
        let schoolId: string | undefined;
        if (alert.maskedAccount) {
          const account = await storage.getSchoolBankAccountByMasked(alert.maskedAccount);
          if (account?.isActive) {
            schoolId = account.schoolId;
          }
        }

        const transactionDate = parseTransactionDate(alert.transactionDate);

        // ── Insert ──────────────────────────────────────────────────────────
        try {
          await storage.createBankTransaction({
            statementId: null,
            schoolId: schoolId ?? null,
            transactionDate,
            amount: alert.amount.toString(),
            transactionType: "credit",
            rawDescription: alert.rawDescription,
            normalizedDescription: alert.rawDescription.toLowerCase().trim(),
            reference: alert.reference ?? null,
            fingerprint: alert.fingerprint,
            status: "unmatched",
            classification: alert.rawDescription.length < 20 ? "code_only" : "named",
            source: "email",
            // Store masked account in smsAccount so the shared re-route action
            // (rerouteUnroutedSmsTransactions) can backfill schoolId later.
            smsAccount: alert.maskedAccount ?? null,
            emailFrom: from || null,
            emailSubject: subject || null,
            emailReceivedAt: receivedAt,
          });

          ingested++;
          console.log(
            `[email-ingest] Ingested ${alert.bankName} ₦${alert.amount.toLocaleString()} — ` +
              `"${alert.rawDescription.substring(0, 60)}"${schoolId ? "" : " [unrouted]"}`
          );
        } catch (insertError: any) {
          // Lost a fingerprint-uniqueness race — treat as duplicate.
          if (
            insertError?.code === "23505" ||
            /unique/i.test(insertError?.message ?? "")
          ) {
            skipped++;
          } else {
            throw insertError;
          }
        }

        await client.messageFlagsAdd(`${uid}`, ["\\Seen"], { uid: true });
      } catch (msgErr) {
        console.error(`[email-ingest] Error processing UID ${uid}:`, msgErr);
        // Mark as seen anyway to avoid re-processing a broken message forever.
        try {
          await client.messageFlagsAdd(`${uid}`, ["\\Seen"], { uid: true });
        } catch {
          /* ignore secondary error */
        }
      }
    }
  } finally {
    lock.release();
  }

  await client.logout();

  if (ingested > 0 || skipped > 0) {
    console.log(`[email-ingest] Poll done: ${ingested} ingested, ${skipped} skipped`);
  }
}

// ── Public: start the background poller ──────────────────────────────────────

export function startEmailPoller(): void {
  const address = process.env.EMAIL_INGEST_ADDRESS?.trim();
  const password = process.env.EMAIL_INGEST_PASSWORD?.trim();

  if (!address || !password) {
    console.warn(
      "[email-ingest] EMAIL_INGEST_ADDRESS or EMAIL_INGEST_PASSWORD not set — " +
        "email bank-alert ingestion is disabled. See docs/email-ingest-setup.md."
    );
    return;
  }

  const run = () =>
    pollOnce(address, password).catch((err) =>
      console.error("[email-ingest] Poll failed (will retry):", err)
    );

  // Run once immediately, then on the interval.
  run();
  setInterval(run, POLL_INTERVAL_MS);

  console.log(
    `[email-ingest] Poller started — monitoring ${address} every ${POLL_INTERVAL_MS / 1000}s`
  );
}
