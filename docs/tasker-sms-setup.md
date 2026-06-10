# Automatic bank-alert SMS → Reconciliation (Tasker setup)

This guide sets up **one Android phone** to forward every bank credit-alert SMS to
Seat of Wisdom Academy automatically. Once configured, a parent's transfer shows
up in the **Payments → Reconcile** queue within seconds — no PDF upload, no copy-paste.

You only do this **once**, on the single phone that receives alerts for all 4 school
bank accounts (2 Zenith, 1 Access, 1 Fidelity).

---

## How it works (plain English)

1. Money lands in a school account → the bank sends a credit-alert SMS to the phone.
2. The free app **Tasker** notices the new SMS and quietly sends its text to our server.
3. The server reads the SMS, picks out the amount, date, payer and account number,
   and files it under the right school using the **account number** in the message.
4. The bursar/admin sees it in the **Reconcile** tab and matches it to a student as usual.

Only **credit** alerts are kept. Debit alerts, OTP codes and marketing texts are ignored.

---

## Before you start — you need two things

1. **The web address (URL) of the server**, then add `/api/ingest/sms` to the end.
   Example: `https://your-app-name.replit.app/api/ingest/sms`
2. **The secret token** (a long random password). This is stored on the server as the
   `SMS_INGEST_TOKEN` secret. Ask the developer/admin for the exact value. Keep it private —
   anyone with it could post fake alerts.

> The phone never logs in. The secret token in the request header is what proves the
> message really came from your phone.

---

## Step 1 — Map each account to its school (do this in the app first)

1. Log in to the app as the **main admin**.
2. Go to **Payments → Bank Accounts** tab.
3. For **each** of the 4 accounts, click **Add** and fill in:
   - **School** — which branch the account belongs to.
   - **Bank** — Zenith, Access, or Fidelity.
   - **Account number (as shown in SMS)** — type it **exactly** as it appears in the
     text message, including the stars. Examples:
     - Zenith: `238****209` and `217****822`
     - Fidelity: `**0025`
     - Access: `192****748`
   - **Label** (optional) — e.g. "Main" or "Fees".
4. Click **Add**. Repeat for all 4 accounts.

If a credit SMS arrives for an account that hasn't been mapped yet, it still gets saved
but shows an **"Unrouted"** badge. Add the mapping, then click **"Re-route unmatched SMS"**
on the Bank Accounts tab to file those waiting alerts under the right school.

---

## Step 2 — Install Tasker on the phone

1. On the phone that receives the alerts, install **Tasker** from the Google Play Store
   (one-time small fee, made by joaomgcd).
2. Open Tasker. If asked, grant it permission to **read SMS** and to **run in the background**.
   On many phones you must also turn off battery optimization for Tasker so it keeps
   running. (Settings → Apps → Tasker → Battery → Unrestricted.)

---

## Step 3 — Create the forwarding rule in Tasker

### 3a. Create the Profile (the trigger)

1. On the Tasker **Profiles** tab, tap **+**.
2. Choose **Event → Phone → Received Text**.
3. Leave **Type** as **Any** (or **SMS**). You can leave **Sender** blank to forward all
   SMS, or list your banks' sender IDs separated by `/` to limit it
   (for example: `Zenith/Access/Fidelity`). Leaving it blank is simplest — the server
   ignores anything that isn't a credit alert anyway.
4. Tap the back/check to save.

### 3b. Create the Task (the action)

1. When prompted to attach a task, tap **New Task**, give it a name like `Forward Bank SMS`.
2. Add an action: **+ → Net → HTTP Request**.
3. Fill it in:
   - **Method**: `POST`
   - **URL**: `https://your-app-name.replit.app/api/ingest/sms`
   - **Headers** (one per line):
     ```
     Content-Type:application/json
     X-SMS-Token:PASTE_YOUR_SECRET_TOKEN_HERE
     ```
   - **Body** (JSON — Tasker fills `%SMSRF` and `%SMSRB` with the sender and text):
     ```json
     {"sender":"%SMSRF","body":"%SMSRB","receivedAt":%TIMES}
     ```
     > `%TIMES` is the time the SMS was received (in seconds). It's optional — you can
     > remove `,"receivedAt":%TIMES` if your Tasker version complains.
4. Tap the back/check to save the action, then save the task.

That's it. The phone will now forward every incoming SMS to the server.

---

## Step 4 — Test it

### Option A — quick test from a computer (using `curl`)

Replace the URL and token, then run this in a terminal. It sends a sample Zenith alert:

```bash
curl -X POST "https://your-app-name.replit.app/api/ingest/sms" \
  -H "Content-Type: application/json" \
  -H "X-SMS-Token: PASTE_YOUR_SECRET_TOKEN_HERE" \
  -d '{
    "sender": "Zenith",
    "body": "Acct:238****209\nDT:08/06/2026 10:47:37 AM\nISW UCHE OGADIMM Trf for Custo\nCR Amt:48,000.00\nBal:1,043,716.95\nDial *966# for quick airtime/Data purchase"
  }'
```

A successful response looks like:

```json
{"status":"created","id":"...","bankName":"Zenith","amount":48000,"routed":true}
```

Then open the app → **Payments → Reconcile** and you'll see a new transaction with an
**SMS** badge.

### Option B — real test on the phone

Ask someone to transfer a small amount into one of the school accounts (or wait for the
next real payment). Within a few seconds it should appear in the **Reconcile** tab.

---

## What the responses mean

The server replies with a short status for each SMS:

| status      | meaning                                                                 |
|-------------|-------------------------------------------------------------------------|
| `created`   | Credit alert saved and filed under the right school. ✅                  |
| `unrouted`  | Credit saved, but the account number isn't mapped yet. Add it in **Bank Accounts**, then **Re-route**. |
| `duplicate` | We already have this exact alert (e.g. it was sent twice). Ignored.      |
| `skipped`   | Not a credit alert (debit, OTP, marketing). Nothing to do.              |

---

## Troubleshooting

- **Nothing shows up after a transfer.**
  - Check the phone has internet (mobile data or Wi-Fi).
  - Confirm Tasker is allowed to run in the background and isn't battery-optimized.
  - Re-check the **URL** ends in `/api/ingest/sms` and the **X-SMS-Token** matches the
    server secret exactly (no extra spaces).
- **Response says `401 Unauthorized`.** The token is wrong or missing. Fix the
  `X-SMS-Token` header.
- **Response says `503 SMS ingestion not configured`.** The server doesn't have the
  `SMS_INGEST_TOKEN` secret set yet. Ask the admin to add it.
- **Alerts show as `unrouted`.** The account number in the SMS isn't mapped. Open
  **Payments → Bank Accounts**, add the exact masked number, then click
  **Re-route unmatched SMS**.

---

## Security notes

- Treat the **token like a password**. If it ever leaks, the admin should change the
  `SMS_INGEST_TOKEN` secret and update the header on the phone.
- The server limits how many alerts one source can send per minute, to guard against
  accidental floods.
- Only credit alerts are stored; the raw SMS text is kept only as the payment narration.
