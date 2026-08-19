# Automatic Email Bank-Alert Ingestion

This guide explains how to set up automatic ingestion of bank credit-alert emails into the reconciliation queue. Once configured, the server listens to a dedicated Gmail inbox in real time (IMAP IDLE) and imports credit alerts from Zenith, Access, and Fidelity within a few seconds of arrival — no manual upload required.

Credit-alert emails that arrive via this route are **deduplicated against SMS alerts** using the same fingerprint system, so a payment that triggers both an SMS and an email never creates a duplicate row.

---

## Prerequisites

- A Gmail account dedicated to bank alerts (e.g. `sowabankealerts@gmail.com`)
- Google 2-Step Verification must be **enabled** on that Gmail account
- Each bursar must be willing to set up a one-time auto-forward rule in their existing email client

---

## Step 1 — Create a dedicated Gmail account

1. Go to [https://accounts.google.com](https://accounts.google.com) and create a new Google account.
2. Use a name that clearly identifies its purpose, e.g. `sowabankealerts@gmail.com`.
3. Enable 2-Step Verification:
   - Google Account → **Security** → **2-Step Verification** → follow the prompts.

---

## Step 2 — Generate an App Password

Google does not allow IMAP access with a regular password when 2-Step Verification is on. Use an **App Password** instead.

1. Go to **Google Account → Security → 2-Step Verification → App passwords** (scroll to the bottom).
2. Under **Select app**, choose **Mail**. Under **Select device**, choose **Other** and type `Bank Alerts Server`.
3. Click **Generate**. Google shows a **16-character code** (e.g. `abcd efgh ijkl mnop`).
4. Copy the code — you will need it for Step 4. You cannot view it again.

---

## Step 3 — Bursars: set up auto-forward

Each bursar whose email account receives bank credit alerts should forward new alerts to the monitoring Gmail:

### Gmail (bursar's personal or work Gmail)
1. Open Gmail → **Settings** (gear icon) → **See all settings** → **Filters and Blocked Addresses**.
2. Click **Create a new filter**.
3. In the **From** field, enter the bank's alert sender, e.g.:
   - Zenith: `alerts@zenithbank.com`
   - Access: `noreply@accessbankplc.com`
   - Fidelity: `alerts@fidelitybank.ng`
4. Click **Create filter** → tick **Forward it to** → enter the monitoring Gmail address.
5. Click **Create filter**. Done.

### Outlook / other clients
Use the equivalent "create a rule" option to forward matching emails to the monitoring Gmail address.

> **Note:** Only new emails (arriving after the rule is set) are forwarded. Historical alerts are not replayed.

---

## Step 4 — Add the two environment variables

In Replit, go to the **Secrets** panel and add:

| Secret key | Value |
|---|---|
| `EMAIL_INGEST_ADDRESS` | The Gmail address from Step 1 (e.g. `sowabankealerts@gmail.com`) |
| `EMAIL_INGEST_PASSWORD` | The 16-character App Password from Step 2 (spaces optional) |

After saving, restart the server. You should see a log line like:

```
[email-ingest] Starting real-time IMAP listener for sowabankealerts@gmail.com...
[email-ingest] Connected — listening on sowabankealerts@gmail.com (cursor: UID 118, uidValidity: 1699999999)
```

If the variables are missing the server logs a warning and the listener is simply disabled — the rest of the app continues to work normally.

---

## How it works

1. The server opens one long-lived IMAP connection (TLS, port 993) to the Gmail inbox and holds it open using **IMAP IDLE** — Gmail pushes a notification the instant a new message arrives, instead of the server checking on a timer.
2. What's "new" is tracked with the server's own **persisted UID cursor** (not Gmail's read/unread flag — see the note below), so a message is processed exactly once and nothing is silently missed.
3. Each email is parsed for: amount, masked account number, transaction date, and narration.
4. **Credit alerts** are inserted into the reconciliation queue with `source = "email"` and an **EMAIL** badge visible in the Finance → Bank Transactions view.
5. **Non-credit emails** (debits, OTPs, balance alerts, newsletters) are skipped — no row is created.
6. **Duplicates** — same fingerprint as an existing SMS or PDF row — are skipped silently.
7. Processed emails are still marked as seen (read) in Gmail as a visual convenience, but this is cosmetic only — nothing about correctness depends on it (see below).
8. If the connection drops (Gmail periodically closes long-held IDLE connections — this is normal, not an outage), the server reconnects automatically with a short backoff and resumes exactly where its cursor left off.

### Why not the Gmail "unread" flag?

An earlier version of this feature tracked "what's new" using Gmail's shared `\Seen` flag (i.e., only unread messages were considered). That had a serious flaw: if anyone with access to the monitored inbox opened or read an alert email — checking it in a browser, a phone's mail app, anything — before the server processed it, that message would silently and *permanently* stop being considered, with no error and no log entry. The current design tracks its own UID cursor instead, which is independent of what any other client does to the mailbox. **You can safely ignore the old advice to never open this inbox** — but it's still good hygiene to leave it as a machine-only account.

---

## Routing unmatched emails

If the bank account masked number (e.g. `238****209`) is not yet in the **Bank Accounts** settings, the transaction is saved with no school assigned and shown with an **Unrouted** badge.

To backfill:
1. Go to **Finance → Bank Accounts** and add the masked account number mapped to the correct school.
2. Click **Re-route unmatched** — the system will assign the school to all previously unrouted email (and SMS) transactions from that account.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `[email-ingest] EMAIL_INGEST_ADDRESS or EMAIL_INGEST_PASSWORD not set` | Secrets not added or server not restarted |
| `connection ended: ... Invalid credentials` | Wrong App Password or 2-Step Verification not enabled |
| Frequent `[email-ingest] connection ended — reconnecting in ...` | Normal in small numbers (Gmail periodically closes long-held IDLE connections) — only becomes a real problem if `pollerEnabled`/`lastPollOk` in the admin panel goes red, which needs 2+ *consecutive* failed reconnects |
| Credit alert visible in Gmail but not in reconciliation | Check that the email body contains credit keywords (CR / Credit / credited). Debit alerts are intentionally skipped. |
| Duplicate row for the same payment | Should not happen — if it does, check that both the SMS and email rows have the same balance figure (the fingerprint includes the running balance). |
| Nothing ingesting after a fresh deploy to a new database | The UID cursor (`email_ingest_state` table) is per-database. On first run against a new database it runs a one-time legacy unseen-scan to catch anything pending, then starts tracking forward from there — check the server log for `"No stored cursor — first run"`. |
