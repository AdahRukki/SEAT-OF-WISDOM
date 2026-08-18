// IMAP email bank-alert poller.
//
// Connects to a dedicated Gmail inbox via IMAP (TLS port 993) and polls for
// unseen messages every 60 seconds.  Credit-alert emails that pass two
// independent authentication checks are parsed and inserted into
// bank_transactions with source = 'email'.
//
// ── Authentication layers ──────────────────────────────────────────────────
//
//  1. From-domain allowlist (TRUSTED_BANK_DOMAINS): only emails whose
//     RFC 5322 From address belongs to a known bank domain are considered.
//
//  2. DKIM verification: we read the Authentication-Results header that Gmail
//     adds server-side when the message is delivered to our inbox.  Because we
//     fetch this header from Gmail's own IMAP server (authenticated via App
//     Password), it cannot be injected by the sending party.  We require
//     dkim=pass with header.i pointing at a trusted bank domain.
//     NOTE: this check covers emails delivered *directly* from bank servers.
//     Bursars should configure their bank accounts to send alert emails
//     directly to the monitored inbox; see docs/email-ingest-setup.md.
//
// ── Reliability ────────────────────────────────────────────────────────────
//
//  A message is marked \Seen only after a successful insert, a confirmed
//  duplicate, or an intentional skip (debit, OTP, auth failure, etc.).
//  Transient DB errors leave the message unseen so it is retried next cycle.
//  The IMAP connection is always closed in a finally block regardless of the
//  control-flow path taken inside the poll cycle.
//
// Required env vars (set via Replit Secrets — never commit to .replit):
//   EMAIL_INGEST_ADDRESS  — Gmail address to monitor
//   EMAIL_INGEST_PASSWORD — Google App Password (16-char code)

import { ImapFlow } from "imapflow";
import { storage } from "./storage";
import { parseEmailAlert, extractBodyFromRfc2822 } from "./email-bank-parser";

const POLL_INTERVAL_MS = 60_000;

// ── 1. Trusted bank sender domains ───────────────────────────────────────────
//
// Both the From-domain check AND the DKIM check require the signing domain to
// be present here.  Add entries as the school's banking relationships expand.

const TRUSTED_BANK_DOMAINS = new Set<string>([
  "zenithbank.com",       // Zenith Bank
  "accessbankplc.com",    // Access Bank (legacy domain)
  "accessbank.com",       // Access Bank (current domain)
  "fidelitybank.ng",      // Fidelity Bank
  "firstbanknigeria.com", // First Bank of Nigeria
  "gtbank.com",           // GTBank / GTCo
  "gtcoplc.com",
  "uba.africa",           // United Bank for Africa
  "ubagroup.com",
  "unionbankng.com",      // Union Bank
  "polarisbankng.com",    // Polaris Bank
  "wemabank.com",         // Wema Bank
  "keystonebankng.com",   // Keystone Bank
  "sterlingbank.com",     // Sterling Bank
  "stanbicibtc.com",      // Stanbic IBTC
  "fcmb.com",             // First City Monument Bank
  "ecobank.com",          // Eco Bank
]);

function isTrustedBankSender(fromAddress: string): boolean {
  if (!fromAddress) return false;
  const atIdx = fromAddress.lastIndexOf("@");
  if (atIdx === -1) return false;
  const domain = fromAddress.slice(atIdx + 1).toLowerCase();
  return TRUSTED_BANK_DOMAINS.has(domain);
}

// ── 2. DKIM authentication check ─────────────────────────────────────────────
//
// Gmail appends an Authentication-Results header server-side before delivery.
// We read it from the raw RFC 2822 source fetched via IMAP.  Since we are
// reading from Gmail's own servers (authenticated with App Password), this
// header is trustworthy — the sender cannot forge it.
//
// We require dkim=pass with header.i=@<trusted-bank-domain>.  This means the
// email was cryptographically signed by the bank's mail infrastructure.

function verifyDkim(rawSource: Buffer): { ok: boolean; domain?: string } {
  // Work in binary latin1 to avoid encoding issues with the header bytes.
  const raw = rawSource.toString("binary");

  // Locate the header section (ends at the first blank line).
  const headerEnd = raw.indexOf("\r\n\r\n");
  const headerSection = headerEnd !== -1 ? raw.slice(0, headerEnd) : raw;

  // Unfold RFC 2822 header folding (CRLF + WSP → single space).
  const unfolded = headerSection.replace(/\r\n[ \t]+/g, " ");

  // Split into individual header lines and inspect each Authentication-Results.
  for (const line of unfolded.split("\r\n")) {
    if (!/^authentication-results:/i.test(line)) continue;

    // Look for dkim=pass ... header.i=@<domain>
    const m = line.match(/dkim=pass\b[^;]*header\.i=@([\w.-]+)/i);
    if (!m) continue;

    const signingDomain = m[1].toLowerCase();
    if (TRUSTED_BANK_DOMAINS.has(signingDomain)) {
      return { ok: true, domain: signingDomain };
    }
  }

  return { ok: false };
}

// ── Helper: parse "DD/MM/YYYY" → Date ────────────────────────────────────────

function parseTransactionDate(dateStr: string): Date {
  const [dd = "01", mm = "01", yyyy = "2000"] = dateStr.split("/");
  return new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
}

// ── Per-message processing ────────────────────────────────────────────────────
//
// Returns:
//   'ingested' — successful DB insert; caller should mark \Seen
//   'skipped'  — intentional skip (debit, OTP, auth failure, dup); mark \Seen
//   'retry'    — transient error; leave unseen so next poll retries

type ProcessResult = "ingested" | "skipped" | "retry";

async function processMessage(message: {
  uid: number;
  envelope?: any;
  source?: Buffer;
}): Promise<ProcessResult> {
  const uid = message.uid;
  const from: string = message.envelope?.from?.[0]?.address ?? "";
  const subject: string = message.envelope?.subject ?? "";
  const receivedAt: Date = message.envelope?.date ?? new Date();

  // ── Check 1: From-domain allowlist ──────────────────────────────────────
  if (!isTrustedBankSender(from)) {
    console.log(
      `[email-ingest] UID ${uid}: untrusted sender "${from}" — skipped (not in allowlist)`
    );
    return "skipped";
  }

  // ── Require raw source for both DKIM check and body extraction ──────────
  const sourceBuffer = message.source;
  if (!sourceBuffer || sourceBuffer.length === 0) {
    console.log(`[email-ingest] UID ${uid}: empty source buffer, skipping permanently`);
    return "skipped";
  }

  // ── Check 2: DKIM authentication (via Gmail's Authentication-Results) ───
  const dkimResult = verifyDkim(sourceBuffer);
  if (!dkimResult.ok) {
    console.log(
      `[email-ingest] UID ${uid}: DKIM not verified for "${from}" — ` +
        `skipped (ensure bank sends alerts directly to the monitored inbox, not via forwarding)`
    );
    return "skipped";
  }

  // ── Body extraction ──────────────────────────────────────────────────────
  let html = "";
  let text = "";
  try {
    ({ html, text } = extractBodyFromRfc2822(sourceBuffer));
  } catch (extractErr) {
    // Pure-function failure → skip permanently.
    console.error(`[email-ingest] UID ${uid}: body extraction error:`, extractErr);
    return "skipped";
  }

  const body = html || text;
  if (!body.trim()) {
    console.log(`[email-ingest] UID ${uid}: empty body after extraction`);
    return "skipped";
  }

  // ── Parse credit alert ───────────────────────────────────────────────────
  let result: ReturnType<typeof parseEmailAlert>;
  try {
    result = parseEmailAlert({ from, subject, html: body });
  } catch (parseErr) {
    // Pure-function failure → skip permanently.
    console.error(`[email-ingest] UID ${uid}: parser threw unexpectedly:`, parseErr);
    return "skipped";
  }

  if (!result.ok) {
    console.log(
      `[email-ingest] UID ${uid}: skipped (${result.reason}): "${subject}" from ${from}`
    );
    return "skipped"; // debit / OTP / non-credit — intentional
  }

  const alert = result.data;

  // ── Duplicate check ──────────────────────────────────────────────────────
  let alreadyExists: boolean;
  try {
    alreadyExists = await storage.checkTransactionFingerprint(alert.fingerprint);
  } catch (fpErr) {
    console.error(`[email-ingest] UID ${uid}: fingerprint check failed (transient):`, fpErr);
    return "retry";
  }

  if (alreadyExists) {
    console.log(
      `[email-ingest] UID ${uid}: duplicate fingerprint (${alert.fingerprint.slice(0, 8)}…)`
    );
    return "skipped";
  }

  // ── Route by masked account ──────────────────────────────────────────────
  let schoolId: string | undefined;
  if (alert.maskedAccount) {
    try {
      const account = await storage.getSchoolBankAccountByMasked(alert.maskedAccount);
      if (account?.isActive) schoolId = account.schoolId;
    } catch (routeErr) {
      console.error(`[email-ingest] UID ${uid}: routing lookup failed (transient):`, routeErr);
      return "retry";
    }
  }

  const transactionDate = parseTransactionDate(alert.transactionDate);

  // ── Insert ───────────────────────────────────────────────────────────────
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
      // (rerouteUnroutedSmsTransactions) can backfill schoolId when the
      // account mapping is added later.
      smsAccount: alert.maskedAccount ?? null,
      emailFrom: from || null,
      emailSubject: subject || null,
      emailReceivedAt: receivedAt,
    });

    console.log(
      `[email-ingest] UID ${uid}: ✓ ${alert.bankName} ₦${alert.amount.toLocaleString()} — ` +
        `"${alert.rawDescription.slice(0, 60)}"${schoolId ? "" : " [unrouted]"}`
    );
    return "ingested";
  } catch (insertErr: any) {
    if (insertErr?.code === "23505" || /unique/i.test(insertErr?.message ?? "")) {
      // Lost fingerprint-uniqueness race — treat as dup.
      return "skipped";
    }
    // Any other DB failure is transient — leave unseen for retry.
    console.error(`[email-ingest] UID ${uid}: insert failed (transient):`, insertErr);
    return "retry";
  }
}

// ── One poll cycle ────────────────────────────────────────────────────────────

async function pollOnce(address: string, password: string): Promise<void> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: address, pass: password },
    logger: false,
  });

  // Prevent Node.js from crashing on an unhandled 'error' EventEmitter event
  // (e.g. socket timeout while idle).  All errors also surface through the
  // promise rejections of the awaited IMAP calls, which our try/finally catches.
  client.on("error", (_err) => { /* surfaced via promise rejection below */ });

  await client.connect();

  // Outer finally ensures the connection is always closed, regardless of
  // early returns, thrown errors, or lock-release paths inside.
  try {
    let ingested = 0;
    let skipped = 0;
    let retried = 0;

    const lock = await client.getMailboxLock("INBOX");
    try {
      // search() may return false when the mailbox is empty or SEARCH is
      // unsupported by the server; guard both cases.
      const searchResult = await client.search({ seen: false }, { uid: true });
      const unseenUids: number[] = Array.isArray(searchResult) ? searchResult : [];

      // Iterating over an empty array is a no-op — no early return needed.
      for await (const message of client.fetch(
        unseenUids,
        { uid: true, envelope: true, source: true },
        { uid: true }
      )) {
        let result: ProcessResult;
        try {
          result = await processMessage(message as any);
        } catch (unexpected) {
          console.error(`[email-ingest] UID ${message.uid}: unexpected error:`, unexpected);
          result = "retry";
        }

        const shouldMarkSeen = result === "ingested" || result === "skipped";

        if (shouldMarkSeen) {
          try {
            await client.messageFlagsAdd(message.uid.toString(), ["\\Seen"], { uid: true });
          } catch (flagErr) {
            console.error(`[email-ingest] UID ${message.uid}: could not mark seen:`, flagErr);
          }
        }

        if (result === "ingested") ingested++;
        else if (result === "skipped") skipped++;
        else retried++;
      }
    } finally {
      lock.release();
    }

    if (ingested + skipped + retried > 0) {
      console.log(
        `[email-ingest] Poll done: ${ingested} ingested, ${skipped} skipped` +
          (retried > 0 ? `, ${retried} left unseen for retry` : "")
      );
    }
  } finally {
    // Always close the IMAP connection — covers normal exit, early returns,
    // and any exception thrown inside the try block above.
    try {
      await client.logout();
    } catch {
      /* ignore logout errors — socket may already be broken */
    }
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

  run();
  setInterval(run, POLL_INTERVAL_MS);

  console.log(
    `[email-ingest] Poller started — monitoring ${address} every ${POLL_INTERVAL_MS / 1000}s`
  );
}
