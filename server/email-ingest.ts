// IMAP email bank-alert listener.
//
// Connects to a dedicated Gmail inbox via IMAP (TLS port 993) and listens in
// real time for new messages using IMAP IDLE — new mail is processed within
// a few seconds of arrival instead of on a fixed polling interval. Credit-alert
// emails that pass DKIM/ARC authentication are parsed and inserted into
// bank_transactions with source = 'email'.
//
// ── Authentication ────────────────────────────────────────────────────────
//
//  DKIM verification: we read the Authentication-Results header that Gmail
//  adds server-side when the message is delivered to our inbox.  Because we
//  fetch this header from Gmail's own IMAP server (authenticated via App
//  Password), it cannot be injected by the sending party.  We require
//  dkim=pass with header.i pointing at a trusted bank domain (see
//  TRUSTED_BANK_DOMAINS) — or, for forwarded mail, a cryptographically
//  verified ARC chain proving the same (see verifyDkim's ARC fallback path,
//  used for Fidelity's forwarded alerts). There is deliberately no separate
//  From:-header domain pre-filter ahead of this: forwarding commonly
//  rewrites From: to the forwarder's own address, so a header-based
//  pre-filter would reject genuine forwarded bank alerts before this real
//  check ever ran. Trust is decided by the cryptographically verified
//  domain only, never by a header either side of the connection controls.
//
// ── Reliability ────────────────────────────────────────────────────────────
//
//  What's "new" is tracked with our own durable IMAP UID cursor (persisted via
//  storage.getEmailIngestCursor/setEmailIngestCursor — see shared/schema.ts
//  emailIngestState), NOT Gmail's shared \Seen flag. The old \Seen-based design
//  had a silent, permanent data-loss bug: if a human ever opened/read an alert
//  email in the monitored inbox before it was processed, it would become
//  "seen" and be skipped forever with no error and no log entry. A UID cursor
//  makes ingestion independent of what any other client does to the mailbox.
//  \Seen is still set after processing, but only as a cosmetic visual aid —
//  nothing reads it back.
//
//  The cursor only advances past a UID once it reaches a *terminal* outcome
//  (ingested/skipped). A "retry" outcome holds the cursor there, so the next
//  catch-up pass (range `cursor+1:*`) naturally retries it instead of skipping
//  it. See computeNextCursor().
//
//  The IMAP connection is long-lived (IDLE), not reconnected per cycle. Gmail
//  periodically drops long-held IDLE connections — the outer loop in
//  startEmailPoller() reconnects with exponential backoff whenever the
//  connection closes or errors.
//
// Required env vars (set via Replit Secrets — never commit to .replit):
//   EMAIL_INGEST_ADDRESS  — Gmail address to monitor
//   EMAIL_INGEST_PASSWORD — Google App Password (16-char code)

import { ImapFlow } from "imapflow";
import { authenticate } from "mailauth";
import { storage } from "./storage";
import { parseEmailAlert, extractBodyFromRfc2822, htmlToTabText } from "./email-bank-parser";
import type { InsertEmailReviewItem } from "@shared/schema";

// Re-issue IDLE well within Gmail's ~29 minute IMAP IDLE timeout (imapflow
// handles this renewal internally when maxIdleTime is set — see its
// lib/imap-flow.d.ts: "If set, then breaks and restarts IDLE every
// maxIdleTime ms").
const MAX_IDLE_TIME_MS = 15 * 60 * 1000;

// Heartbeat cadence for the admin-panel "last activity" timestamp during
// quiet periods with no new mail — matches the old poller's 60s cadence so
// the panel's staleness signal means the same thing it always did.
const HEARTBEAT_MS = 60_000;

// Reconnect backoff after a connection closes/errors.
const INITIAL_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 60_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── 1. Trusted bank sender domains ───────────────────────────────────────────
//
// This is consulted ONLY by the DKIM/ARC check below — the domain it accepts
// is read from the cryptographically-authenticated signature, never from the
// message's own From: header. Add entries as the school's banking
// relationships expand.
//
// (Previously there was also a pre-filter here that rejected a message
// outright if its From: header domain wasn't in this list, before DKIM ever
// ran. That was removed: forwarding — including the legitimate Gmail
// auto-forward path this system depends on for Fidelity — commonly rewrites
// From: to the forwarder's own address, so that pre-filter was rejecting
// genuine bank alerts before they ever reached the check that actually
// verifies authenticity. Removing it doesn't weaken security: anything that
// isn't cryptographically verified as coming from a domain in this set still
// gets rejected below, exactly as before — only the domain that decides is
// now always the DKIM/ARC-verified one, never the spoofable header.)

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

// ── 2. DKIM authentication check ─────────────────────────────────────────────
//
// Gmail appends an Authentication-Results header server-side before delivery.
// Since we fetch raw source from Gmail's IMAP servers (authenticated with App
// Password), that header cannot be injected by the sender.
//
// Fast path — standard Authentication-Results:
//   We require dkim=pass with header.i=@<trusted-bank-domain>.  This covers
//   Zenith Bank, which delivers directly and whose DKIM survives intact.
//
// ARC fallback path — forwarded Fidelity emails:
//   Fidelity routes through etransmail.com using Content-Transfer-Encoding:
//   binary.  Gmail normalises this during forwarding from the primary inbox to
//   the alert inbox, changing the body and breaking the live DKIM signature.
//   The ARC i=1 entry records the original dkim=pass at the primary-inbox
//   delivery, sealed by Google with an RSA signature.
//
//   We use mailauth to verify the ARC-Seal RSA signature cryptographically
//   against Google's DNS-published public key.  Only when the full chain passes
//   do we trust the i=1 ARC-Authentication-Results and extract the bank domain.
//
// Security guarantee: a forger must produce a valid RSA signature over the ARC
// headers using Google's private key — this is computationally infeasible.
//
// Optional `resolver` parameter accepts a custom async DNS function; pass one
// in unit tests to avoid live DNS lookups and use a generated key pair.

type DnsResolver = (domain: string, type: string) => Promise<string[]>;

// Exported for unit testing.
export async function verifyDkim(
  rawSource: Buffer,
  resolver?: DnsResolver
): Promise<{ ok: boolean; domain?: string }> {
  // Work in binary latin1 to avoid encoding issues with the header bytes.
  const raw = rawSource.toString("binary");

  // Locate the header section (ends at the first blank line).
  const headerEnd = raw.indexOf("\r\n\r\n");
  const headerSection = headerEnd !== -1 ? raw.slice(0, headerEnd) : raw;

  // Unfold RFC 2822 header folding (CRLF + WSP → single space).
  const unfolded = headerSection.replace(/\r\n[ \t]+/g, " ");
  const lines = unfolded.split("\r\n");

  // ── Fast path: Gmail's Authentication-Results (authserv-id = mx.google.com) ──
  // Gmail prepends its own Authentication-Results header at delivery time with
  // authserv-id "mx.google.com".  Since we read from Gmail's IMAP server
  // (authenticated via App Password), we know Gmail's header always appears
  // before any sender-supplied headers in the raw message.
  //
  // Security properties:
  //  • We filter by authserv-id "mx.google.com" so relay headers from other
  //    hops (e.g. Zenith's own Exchange relay) are ignored.
  //  • A sender who injects "Authentication-Results: mx.google.com; dkim=pass …"
  //    cannot win: Gmail prepends its own (genuine) mx.google.com header on top,
  //    so the injected one is encountered later in the scan and we stop after
  //    processing the first mx.google.com result.
  for (const line of lines) {
    if (!/^authentication-results:/i.test(line)) continue;
    // The authserv-id is the token that immediately follows the field name.
    const authservM = line.match(/^authentication-results:\s*([\w.-]+)/i);
    if (!authservM) continue;
    const authserv = authservM[1].toLowerCase();
    // Only trust results from Google's mail servers.
    if (authserv !== "mx.google.com" && !authserv.endsWith(".google.com")) continue;
    // This is Google's genuine server-side result; stop after it regardless of
    // outcome so a later injected header cannot be reached.
    const m = line.match(/dkim=pass\b[^;]*header\.i=@([\w.-]+)/i);
    if (m) {
      const domain = m[1].toLowerCase();
      if (TRUSTED_BANK_DOMAINS.has(domain)) {
        return { ok: true, domain };
      }
    }
    break; // Gmail's result processed — do not check any further headers.
  }

  // ── ARC fallback path: cryptographic chain verification via mailauth ───────
  // Used when live DKIM is broken by forwarding (e.g. Fidelity via etransmail).
  //
  // Security model:
  //   mailauth verifies each ARC-Seal RSA signature against the DNS-published
  //   public key.  "Pass" proves only that the signer controls that domain's DNS
  //   key — an attacker who owns attacker.example can sign a valid chain that
  //   claims dkim=pass for fidelitybank.ng.  We therefore add a second gate:
  //   the i=1 ARC-Seal must have d=google.com (or *.google.com).  Combined with
  //   the RSA verification, this proves Google's mail infrastructure created the
  //   seal — only Google controls the private key matching the DNS record at
  //   <selector>._domainkey.google.com.
  try {
    const authOpts: Record<string, unknown> = { trustReceived: true };
    if (resolver) authOpts.resolver = resolver;

    const { arc: arcResult } = await authenticate(rawSource, authOpts);

    // arcResult is false when there are no ARC headers to verify.
    if (arcResult && arcResult.status?.result === "pass") {
      // Step 1: confirm the i=1 ARC-Seal was signed by Google.
      const i1SealLine = lines.find((l) => {
        if (!/^arc-seal:/i.test(l)) return false;
        const idx = l.match(/\bi=(\d+)\b/i);
        return idx ? parseInt(idx[1], 10) === 1 : false;
      });
      if (i1SealLine) {
        const sealDomM = i1SealLine.match(/\bd=([\w.-]+)/i);
        const sealDomain = sealDomM?.[1]?.toLowerCase() ?? "";
        const isGoogleSeal =
          sealDomain === "google.com" || sealDomain.endsWith(".google.com");

        if (isGoogleSeal) {
          // Step 2: read the i=1 ARC-Authentication-Results.
          // The RSA proof + Google-domain check means this header was genuinely
          // added by Google and reflects what it observed at the primary inbox.
          for (const line of lines) {
            if (!/^arc-authentication-results:/i.test(line)) continue;
            const idxM = line.match(/^arc-authentication-results:\s*i=(\d+)/i);
            if (!idxM || parseInt(idxM[1], 10) !== 1) continue;
            const m = line.match(/dkim=pass\b[^;]*header\.i=@([\w.-]+)/i);
            if (!m) continue;
            const domain = m[1].toLowerCase();
            if (TRUSTED_BANK_DOMAINS.has(domain)) {
              return { ok: true, domain };
            }
          }
        }
      }
    }
  } catch (arcErr) {
    // DNS unavailable, parse error, or key error — treat as not verified.
    console.debug("[email-ingest] ARC verification error:", arcErr);
  }

  return { ok: false };
}

// ── Helper: parse "DD/MM/YYYY" → Date ────────────────────────────────────────

function parseTransactionDate(dateStr: string): Date {
  const [dd = "01", mm = "01", yyyy = "2000"] = dateStr.split("/");
  return new Date(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
}

// ── Helper: derive bank label from sender domain ──────────────────────────────

function bankFromSender(from: string): string {
  const atIdx = from.lastIndexOf("@");
  if (atIdx === -1) return "Unknown";
  const domain = from.slice(atIdx + 1).toLowerCase();
  if (domain.includes("zenithbank")) return "Zenith";
  if (domain.includes("fidelitybank")) return "Fidelity";
  if (domain.includes("accessbank") || domain.includes("accessbankplc")) return "Access";
  if (domain.includes("gtbank") || domain.includes("gtcoplc")) return "GTBank";
  if (domain.includes("firstbanknigeria")) return "First Bank";
  if (domain.includes("uba") || domain.includes("ubagroup")) return "UBA";
  if (domain.includes("fcmb")) return "FCMB";
  if (domain.includes("stanbicibtc")) return "Stanbic IBTC";
  if (domain.includes("sterlingbank")) return "Sterling";
  if (domain.includes("wemabank")) return "Wema";
  return "Unknown";
}

// ── Ingest visibility ─────────────────────────────────────────────────────────
//
// Every message this listener reads is persisted to email_review_queue (see
// shared/schema.ts) — never just logged in memory. That table, not this
// module, is now the source of truth for "what has the listener seen" and
// is what the admin panel and /api/admin/email-review-queue read from
// (server/storage.ts getEmailReviewQueue / approveEmailReviewItem /
// dismissEmailReviewItem). Nothing here decides a message "doesn't matter"
// and makes it disappear — that decision belongs to a human, from that table.

let lastPollAt: string | null = null;
let lastPollOk: boolean | null = null;
// Count consecutive connection failures so a single transient drop (Gmail
// closes long-held IDLE connections periodically — normal, not an outage)
// does not flip the panel to "connection failed". Only 2+ consecutive
// failures set lastPollOk to false, giving one automatic reconnect attempt
// before the UI reacts.
let consecutiveFailures = 0;

/** Returns the timestamp and success flag of the most recent connection activity. */
export function getLastPollStatus(): { lastPollAt: string | null; lastPollOk: boolean | null } {
  return { lastPollAt, lastPollOk };
}

// A soft, informational label only — never a gate. Case-insensitive match
// against subject + body for the word "credit"/"credited"/etc. Rows that hit
// this still go through DKIM/ARC + the parser exactly like any other row;
// this only affects how the admin panel sorts/highlights them, so a
// differently-worded genuine alert never becomes invisible because of it.
function looksLikeCredit(text: string): boolean {
  return /credit/i.test(text);
}

// ── Per-message processing ────────────────────────────────────────────────────
//
// Returns:
//   'ingested' — successful DB insert; cursor may advance past this UID
//   'skipped'  — intentional skip (debit, OTP, auth failure, dup); cursor may
//                advance past this UID
//   'retry'    — transient error; cursor holds here so the next catch-up pass
//                retries this UID instead of skipping it

type ProcessResult = "ingested" | "skipped" | "retry";
type ReviewOutcome = "auto_ingested" | "duplicate" | "unverified" | "unparsed" | "error";

// Maps a review-queue outcome to the UID-cursor result. auto_ingested/
// duplicate/unverified/unparsed are all terminal for cursor purposes — the
// cursor's only job is "has the listener read this UID yet", which is
// independent of whether a human still needs to act on it in the review
// queue. Only 'error' (transient failure) holds the cursor for a retry.
function cursorResultFor(outcome: ReviewOutcome): ProcessResult {
  return outcome === "error" ? "retry" : outcome === "auto_ingested" ? "ingested" : "skipped";
}

async function processMessage(mailbox: string, message: {
  uid: number;
  envelope?: any;
  source?: Buffer;
}): Promise<ProcessResult> {
  const uid = message.uid;
  const from: string = message.envelope?.from?.[0]?.address ?? "";
  const subject: string = message.envelope?.subject ?? "";
  const receivedAt: Date = message.envelope?.date ?? new Date();

  // Detect bank from sender domain early so every review-queue row carries it.
  let detectedBank = bankFromSender(from);

  // Every exit from this function goes through here: writes one row to
  // email_review_queue (upserted on mailbox+uid, so a retried UID updates
  // its row instead of duplicating it) and returns the mapped cursor result.
  // `extra` carries full parsed transaction detail whenever parsing
  // succeeded, verified or not — that's the whole point of removing the old
  // pre-parse gates: a human reviewing this row gets to see it either way.
  const record = async (
    outcome: ReviewOutcome,
    reason: string,
    opts: {
      verified: boolean;
      bodySnippet?: string;
      linkedTransactionId?: string;
      extra?: Pick<
        InsertEmailReviewItem,
        "amount" | "maskedAccount" | "transactionDate" | "rawDescription" | "reference" | "balanceKey" | "fingerprint"
      >;
    }
  ): Promise<ProcessResult> => {
    const likelyTransaction = looksLikeCredit(`${subject} ${opts.bodySnippet ?? ""}`);
    await storage.upsertEmailReviewItem({
      mailbox,
      uid,
      fromAddress: from || null,
      subject: subject || null,
      detectedBank,
      receivedAt,
      verified: opts.verified,
      likelyTransaction,
      parseOk: !!opts.extra,
      bodySnippet: opts.bodySnippet?.slice(0, 4000) ?? null,
      outcome,
      reason,
      linkedTransactionId: opts.linkedTransactionId ?? null,
      ...opts.extra,
    } as InsertEmailReviewItem);
    return cursorResultFor(outcome);
  };

  // ── Require raw source for both DKIM check and body extraction ──────────
  // (No From:-header domain pre-filter here — see the comment above
  // TRUSTED_BANK_DOMAINS. The DKIM/ARC check immediately below is what
  // actually decides trust, against the cryptographically verified domain —
  // and even a DKIM failure no longer hides the message; see 'unverified'.)
  const sourceBuffer = message.source;
  if (!sourceBuffer || sourceBuffer.length === 0) {
    console.log(`[email-ingest] UID ${uid}: empty source buffer`);
    return record("unparsed", "empty source buffer", { verified: false });
  }

  // ── Check: DKIM authentication (via Gmail's Authentication-Results) ─────
  // This is now a label ("verified" vs "unverified"), not a gate — an
  // unverified message still gets parsed and shown in full below.
  const dkimResult = await verifyDkim(sourceBuffer);
  const verified = dkimResult.ok;

  // ── Body extraction ──────────────────────────────────────────────────────
  let html = "";
  let text = "";
  try {
    ({ html, text } = extractBodyFromRfc2822(sourceBuffer));
  } catch (extractErr) {
    console.error(`[email-ingest] UID ${uid}: body extraction error:`, extractErr);
    return record("unparsed", "body extraction error", { verified });
  }

  const body = html || text;
  const plainSnippet = text || (html ? htmlToTabText(html) : "");
  if (!body.trim()) {
    console.log(`[email-ingest] UID ${uid}: empty body after extraction`);
    return record("unparsed", "empty body after extraction", { verified, bodySnippet: plainSnippet });
  }

  // ── Parse credit alert ───────────────────────────────────────────────────
  let result: ReturnType<typeof parseEmailAlert>;
  try {
    result = parseEmailAlert({ from, subject, html: body });
  } catch (parseErr) {
    console.error(`[email-ingest] UID ${uid}: parser threw unexpectedly:`, parseErr);
    return record("unparsed", "parser error", { verified, bodySnippet: plainSnippet });
  }

  if (!result.ok) {
    console.log(
      `[email-ingest] UID ${uid}: not a recognized transaction (${result.reason}): "${subject}" from ${from}` +
        (verified ? "" : " [unverified]")
    );
    return record("unparsed", result.reason, { verified, bodySnippet: plainSnippet });
  }

  const alert = result.data;
  // Refine bank label from parse result now that we have it.
  detectedBank = alert.bankName !== "Unknown" ? alert.bankName : detectedBank;
  const parsedExtra = {
    amount: alert.amount.toString(),
    maskedAccount: alert.maskedAccount,
    transactionDate: alert.transactionDate,
    rawDescription: alert.rawDescription,
    reference: alert.reference,
    balanceKey: alert.balanceKey,
    fingerprint: alert.fingerprint,
  };

  // ── Duplicate check ──────────────────────────────────────────────────────
  let alreadyExists: boolean;
  try {
    alreadyExists = await storage.checkTransactionFingerprint(alert.fingerprint);
  } catch (fpErr) {
    console.error(`[email-ingest] UID ${uid}: fingerprint check failed (transient):`, fpErr);
    return record("error", "fingerprint check failed — will retry", {
      verified, bodySnippet: plainSnippet, extra: parsedExtra,
    });
  }

  if (alreadyExists) {
    console.log(
      `[email-ingest] UID ${uid}: duplicate fingerprint (${alert.fingerprint.slice(0, 8)}…)`
    );
    return record("duplicate", "duplicate fingerprint", {
      verified, bodySnippet: plainSnippet, extra: parsedExtra,
    });
  }

  // Unverified but parsed fine — surface with full detail, let a human
  // decide via the Approve action instead of auto-creating the transaction.
  if (!verified) {
    console.log(
      `[email-ingest] UID ${uid}: parsed but unverified (DKIM/ARC did not pass) — held for manual review: ` +
        `${alert.bankName} ₦${alert.amount.toLocaleString()}`
    );
    return record("unverified", "DKIM/ARC not verified — needs manual approval", {
      verified, bodySnippet: plainSnippet, extra: parsedExtra,
    });
  }

  // ── Route by masked account ──────────────────────────────────────────────
  let schoolId: string | undefined;
  if (alert.maskedAccount) {
    try {
      const account = await storage.getSchoolBankAccountByMasked(alert.maskedAccount);
      if (account?.isActive) schoolId = account.schoolId;
    } catch (routeErr) {
      console.error(`[email-ingest] UID ${uid}: routing lookup failed (transient):`, routeErr);
      return record("error", "routing lookup failed — will retry", {
        verified, bodySnippet: plainSnippet, extra: parsedExtra,
      });
    }
  }

  const transactionDate = parseTransactionDate(alert.transactionDate);

  // ── Insert (verified + parsed + not a duplicate → auto-ingest) ───────────
  try {
    const transaction = await storage.createBankTransaction({
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
    return record(
      "auto_ingested",
      `₦${alert.amount.toLocaleString()} — ${alert.rawDescription.slice(0, 50)}`,
      { verified, bodySnippet: plainSnippet, linkedTransactionId: transaction.id, extra: parsedExtra }
    );
  } catch (insertErr: any) {
    if (insertErr?.code === "23505" || /unique/i.test(insertErr?.message ?? "")) {
      // Lost fingerprint-uniqueness race — treat as dup.
      return record("duplicate", "duplicate fingerprint (race)", {
        verified, bodySnippet: plainSnippet, extra: parsedExtra,
      });
    }
    // Any other DB failure is transient — leave for retry.
    console.error(`[email-ingest] UID ${uid}: insert failed (transient):`, insertErr);
    return record("error", "DB insert failed — will retry", {
      verified, bodySnippet: plainSnippet, extra: parsedExtra,
    });
  }
}

// ── UID cursor advancement ────────────────────────────────────────────────────
//
// Pure function — exported for unit testing (scripts/test-email-ingest-cursor.ts).
//
// Given the cursor before this pass and the per-message outcomes from this
// pass (ascending UID order), returns the new cursor. Advances past a
// contiguous run of terminal outcomes (ingested/skipped) starting right after
// the current cursor; stops at the first 'retry' so that UID is re-attempted
// on the next pass rather than silently skipped forever.

export function computeNextCursor(
  currentCursor: number,
  results: Array<{ uid: number; outcome: ProcessResult }>
): number {
  let cursor = currentCursor;
  const sorted = [...results].sort((a, b) => a.uid - b.uid);
  for (const { uid, outcome } of sorted) {
    if (uid <= cursor) continue; // already accounted for
    if (outcome === "retry") break; // hold here; retried next pass
    cursor = uid; // ingested/skipped are terminal — safe to advance past
  }
  return cursor;
}

// ── Catch-up pass: fetch and process everything after the cursor ─────────────
//
// Persists cursor progress after EVERY message, not just once at the end of
// the whole batch. If the connection dies mid-batch (Gmail periodically
// closes long-held connections — see MAX_IDLE_TIME_MS above), the `for
// await` loop throws and everything after it — including the one-shot
// cursor save that used to live after this loop — never runs, silently
// losing all progress made in this pass even though messages in it were
// already successfully processed and logged. Saving incrementally means a
// mid-batch disconnect only loses the *unsent* remainder, not everything.

async function catchUp(client: ImapFlow, mailbox: string, uidValidity: string, cursor: number): Promise<number> {
  const startingCursor = cursor; // for the summary log below — `cursor` itself advances as we go
  const results: Array<{ uid: number; outcome: ProcessResult }> = [];

  const lock = await client.getMailboxLock("INBOX");
  try {
    for await (const message of client.fetch(
      `${cursor + 1}:*`,
      { uid: true, envelope: true, source: true },
      { uid: true }
    )) {
      // A range fetch on an up-to-date mailbox with nothing new can still
      // return the highest existing message (IMAP "*" placeholder behaviour)
      // even when its UID is <= cursor — skip anything already accounted for.
      if (message.uid <= cursor) continue;

      let outcome: ProcessResult;
      try {
        outcome = await processMessage(mailbox, message as any);
      } catch (unexpected) {
        console.error(`[email-ingest] UID ${message.uid}: unexpected error:`, unexpected);
        outcome = "retry";
      }

      // Cosmetic only — nothing reads this back for correctness. Best-effort.
      if (outcome === "ingested" || outcome === "skipped") {
        try {
          await client.messageFlagsAdd(message.uid.toString(), ["\\Seen"], { uid: true });
        } catch (flagErr) {
          console.error(`[email-ingest] UID ${message.uid}: could not mark seen:`, flagErr);
        }
      }

      results.push({ uid: message.uid, outcome });

      // Persist progress after every message — see function comment above.
      const cursorSoFar = computeNextCursor(cursor, results);
      if (cursorSoFar !== cursor) {
        cursor = cursorSoFar;
        await storage.setEmailIngestCursor(mailbox, uidValidity, cursor);
      }
    }
  } finally {
    lock.release();
  }

  // cursor already reflects every incremental save made above; this final
  // computation is a no-op in the common case and only matters if the loop
  // completed without cursor ever changing (e.g. everything held for retry).
  const nextCursor = computeNextCursor(cursor, results);

  if (results.length > 0) {
    const ingested = results.filter((r) => r.outcome === "ingested").length;
    const skipped = results.filter((r) => r.outcome === "skipped").length;
    const retried = results.filter((r) => r.outcome === "retry").length;
    console.log(
      `[email-ingest] Catch-up done: ${ingested} ingested, ${skipped} skipped` +
        (retried > 0 ? `, ${retried} held for retry` : "") +
        ` (cursor ${startingCursor} → ${nextCursor})`
    );
  }

  if (nextCursor !== cursor) {
    await storage.setEmailIngestCursor(mailbox, uidValidity, nextCursor);
  }

  return nextCursor;
}

// ── One connection lifecycle: connect, establish cursor, listen via IDLE ─────
//
// Resolves when the connection ends (closed or errored) so the outer
// reconnect loop in startEmailPoller() can retry. Never rejects — connection
// failures are logged and surfaced via lastPollOk instead of thrown, so one
// bad cycle can't crash the poller loop.

async function connectAndListen(address: string, password: string): Promise<void> {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: address, pass: password },
    logger: false,
    maxIdleTime: MAX_IDLE_TIME_MS,
  });

  // Prevent Node.js from crashing on an unhandled 'error' EventEmitter event.
  client.on("error", (_err) => { /* surfaced via the settle() path below */ });

  let processing = false; // guards against overlapping catch-up passes
  let pending = false;    // another 'exists' fired while one was already running
  let cursor = 0;
  let uidValidity = ""; // set once mailboxOpen resolves; constant for this connection's lifetime
  let heartbeatTimer: NodeJS.Timeout | undefined;

  const runCatchUpLoop = async () => {
    if (processing) {
      pending = true;
      return;
    }
    processing = true;
    try {
      do {
        pending = false;
        cursor = await catchUp(client, address, uidValidity, cursor);
      } while (pending);
    } catch (err) {
      console.error("[email-ingest] catch-up pass failed:", err);
    } finally {
      processing = false;
    }
  };

  return new Promise<void>((resolve) => {
    let settled = false;
    const settle = (err?: unknown) => {
      if (settled) return;
      settled = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      client.removeAllListeners();
      if (err) console.error("[email-ingest] connection ended:", err);
      // Best-effort cleanup — fire and forget so a hung/half-dead socket can't
      // delay reconnection. The original poller always called logout() in a
      // finally block; this path didn't, leaving sockets to linger on error.
      client.logout().catch(() => {});
      resolve();
    };

    client.on("close", () => settle());
    client.on("exists", () => {
      runCatchUpLoop().catch((err) => console.error("[email-ingest] unexpected error in catch-up loop:", err));
    });

    (async () => {
      try {
        await client.connect();
        const mailboxInfo = await client.mailboxOpen("INBOX");
        uidValidity = mailboxInfo.uidValidity.toString();

        const stored = await storage.getEmailIngestCursor(address);
        if (stored && stored.uidValidity === uidValidity) {
          cursor = stored.lastProcessedUid;
        } else {
          // First run for this mailbox, or the mailbox was recreated
          // (UIDVALIDITY changed — any previously stored UID is meaningless).
          //
          // One-time cutover safety net: catch anything left unseen by the
          // previous \Seen-based poller before switching to pure UID tracking,
          // so nothing sitting unprocessed at deploy time is silently dropped.
          console.log(
            stored
              ? `[email-ingest] UIDVALIDITY changed (${stored.uidValidity} → ${uidValidity}) — resetting cursor, running legacy unseen-scan once`
              : "[email-ingest] No stored cursor — first run, running legacy unseen-scan once"
          );
          cursor = await legacyUnseenCatchUp(client, address, uidValidity);
          // Floor to uidNext-1 so a mailbox with no unseen backlog (or a scan
          // that finished with nothing left to advance past) doesn't leave the
          // cursor at 0 — which would make the next catchUp() re-fetch the
          // entire mailbox history via a "1:*" range instead of just new mail.
          cursor = Math.max(cursor, mailboxInfo.uidNext - 1);
        }
        await storage.setEmailIngestCursor(address, uidValidity, cursor);

        console.log(`[email-ingest] Connected — listening on ${address} (cursor: UID ${cursor}, uidValidity: ${uidValidity})`);
        consecutiveFailures = 0;
        lastPollAt = new Date().toISOString();
        lastPollOk = true;

        // Catch anything that arrived between the mailboxOpen snapshot and now.
        await runCatchUpLoop();

        // Heartbeat: keeps lastPollAt fresh during quiet periods (matches the
        // old poller's 60s cadence) and detects a half-dead connection.
        heartbeatTimer = setInterval(async () => {
          if (!client.usable) {
            settle(new Error("connection no longer usable"));
            return;
          }
          try {
            await client.noop();
            lastPollAt = new Date().toISOString();
            lastPollOk = true;
            consecutiveFailures = 0;
          } catch (err) {
            settle(err);
          }
        }, HEARTBEAT_MS);

        // Auto-IDLE (imapflow default — see ImapFlowOptions.disableAutoIdle,
        // which we leave false) engages automatically once the connection has
        // been otherwise inactive for autoIdleDelay (default 15s), and is
        // renewed automatically per maxIdleTime. No manual idle() loop needed:
        // the 'exists' listener above fires regardless of whether IDLE was
        // entered manually or automatically.
      } catch (err) {
        consecutiveFailures++;
        lastPollAt = new Date().toISOString();
        if (consecutiveFailures >= 2) lastPollOk = false;
        settle(err);
      }
    })();
  });
}

// ── Legacy one-time catch-up: search({seen:false}) ────────────────────────────
//
// Used only during the cutover from the old \Seen-based poller (see the
// "first run" branch in connectAndListen). After this runs once per mailbox,
// all tracking is UID-cursor based and this is never called again for that
// mailbox (guarded by the persisted cursor row existing).
//
// Persists cursor progress after EVERY message, not just once at the very
// end. The backlog scanned here can be large enough — each message needs a
// DKIM/ARC check, and the ARC fallback path does live DNS lookups — that the
// IMAP socket can time out partway through. Without incremental saves, a
// mid-scan timeout meant the cursor was never written at all: the next
// reconnect saw "no cursor" and restarted this entire scan from message #1,
// forever re-processing the same early messages while never reaching later
// ones in the backlog. Saving after each message means a timeout just means
// "resume via the normal cursor-based catchUp() from here" instead of
// "start over from zero."

async function legacyUnseenCatchUp(
  client: ImapFlow,
  mailbox: string,
  uidValidity: string
): Promise<number> {
  let cursor = 0;
  const results: Array<{ uid: number; outcome: ProcessResult }> = [];

  const lock = await client.getMailboxLock("INBOX");
  try {
    const searchResult = await client.search({ seen: false }, { uid: true });
    const unseenUids: number[] = Array.isArray(searchResult) ? searchResult : [];
    if (unseenUids.length === 0) return cursor;

    console.log(`[email-ingest] Legacy scan: ${unseenUids.length} unseen message(s) to check`);
    let ingested = 0, skipped = 0, retried = 0;
    for await (const message of client.fetch(
      unseenUids,
      { uid: true, envelope: true, source: true },
      { uid: true }
    )) {
      let outcome: ProcessResult;
      try {
        outcome = await processMessage(mailbox, message as any);
      } catch (unexpected) {
        console.error(`[email-ingest] UID ${message.uid}: unexpected error (legacy scan):`, unexpected);
        outcome = "retry";
      }
      if (outcome === "ingested" || outcome === "skipped") {
        try {
          await client.messageFlagsAdd(message.uid.toString(), ["\\Seen"], { uid: true });
        } catch { /* cosmetic only */ }
      }
      if (outcome === "ingested") ingested++;
      else if (outcome === "skipped") skipped++;
      else retried++;

      // Persist progress after every message — see function comment above.
      results.push({ uid: message.uid, outcome });
      const nextCursor = computeNextCursor(cursor, results);
      if (nextCursor !== cursor) {
        cursor = nextCursor;
        await storage.setEmailIngestCursor(mailbox, uidValidity, cursor);
      }
    }
    console.log(`[email-ingest] Legacy scan done: ${ingested} ingested, ${skipped} skipped, ${retried} left for the UID cursor to retry`);
  } finally {
    lock.release();
  }
  return cursor;
}

// ── Public: start the background listener ─────────────────────────────────────

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

  console.log(`[email-ingest] Starting real-time IMAP listener for ${address}...`);

  (async function loop() {
    let backoffMs = INITIAL_BACKOFF_MS;
    for (;;) {
      try {
        await connectAndListen(address, password);
      } catch (err) {
        // connectAndListen is designed not to throw, but guard anyway so the
        // outer loop can never die.
        console.error("[email-ingest] unexpected error, reconnecting:", err);
      }
      const delay = Math.min(backoffMs, MAX_BACKOFF_MS);
      console.log(`[email-ingest] connection ended — reconnecting in ${Math.round(delay / 1000)}s...`);
      await sleep(delay);
      backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
    }
  })();
}
