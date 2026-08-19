/**
 * Unit tests for verifyDkim() in server/email-ingest.ts.
 *
 * Test cases:
 *   1. Direct Zenith email — standard Authentication-Results dkim=pass → accepted
 *   2. Forwarded Fidelity — properly signed ARC i=1 chain → accepted
 *      (Uses sealMessage + custom DNS resolver so no internet needed)
 *   3. Forged ARC: Google authserv-id claimed but ARC-Seal signed with WRONG
 *      RSA key → mailauth RSA verification fails → rejected
 *   4. ARC chain at i=2 only (no i=1) → i=1 auth results missing → rejected
 *   5. Completely unsigned spoofed email → rejected
 *   6. Valid ARC chain but untrusted signing domain → rejected
 *
 * Run with:  npx tsx scripts/test-dkim-verification.ts
 */

import crypto from "crypto";
import { sealMessage } from "mailauth";
import { verifyDkim } from "../server/email-ingest";

let failures = 0;
let total = 0;

function check(name: string, cond: boolean, detail?: unknown) {
  total++;
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}`, detail !== undefined ? detail : "");
  }
}

// ── Test key pair ─────────────────────────────────────────────────────────────
// Generate a temporary RSA key pair used to sign ARC seals in test fixtures.
// Tests pass a custom DNS resolver that returns this public key so no internet
// access is required.

const { privateKey: TEST_PRIVATE_KEY_PEM, publicKey: TEST_PUBLIC_KEY_DER } =
  crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

const TEST_PUBLIC_KEY_B64 = (TEST_PUBLIC_KEY_DER as unknown as Buffer).toString(
  "base64"
);

// Selector and domain used in test ARC seals.
// We use google.com as the signing domain (the real signer for Fidelity
// forwarded emails) with a custom resolver that returns our test public key.
// In production mailauth would look up the real Google DNS record.
const TEST_SELECTOR = "arc-test";
const TEST_DOMAIN = "google.com";  // Must match what verifyDkim() checks
const TEST_AUTHSERV = `mx.${TEST_DOMAIN}`;
const TEST_DNS_NAME = `${TEST_SELECTOR}._domainkey.${TEST_DOMAIN}`;

// Attacker domain — for the negative test proving non-Google signers are rejected.
const ATTACKER_DOMAIN = "attacker.example";
const ATTACKER_AUTHSERV = `mx.${ATTACKER_DOMAIN}`;

/** Custom DNS resolver: returns our test RSA public key for the test domain. */
const testResolver = async (
  domain: string,
  _type: string
): Promise<string[]> => {
  if (domain === TEST_DNS_NAME) {
    return [`v=DKIM1; k=rsa; p=${TEST_PUBLIC_KEY_B64}`];
  }
  return [];
};

/**
 * Wrong-key resolver: returns a DIFFERENT public key than what was used to
 * sign the ARC seal, causing RSA verification to fail.
 */
const wrongKeyResolver = async (
  domain: string,
  _type: string
): Promise<string[]> => {
  const { publicKey: wrongDer } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const wrongB64 = (wrongDer as unknown as Buffer).toString("base64");
  if (domain.includes("_domainkey.")) {
    return [`v=DKIM1; k=rsa; p=${wrongB64}`];
  }
  return [];
};

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeRaw(headers: string[], body = "Test body"): Buffer {
  return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`, "binary");
}

/** Fixture 1: Zenith direct — standard Authentication-Results path. */
function rawZenithDirect(): Buffer {
  return makeRaw([
    "Authentication-Results: mx.google.com; dkim=pass header.i=@zenithbank.com header.s=selector1 header.b=abcdef12",
    "From: ebusinessgroup@zenithbank.com",
    "Subject: ZENITH BANK TRANSACTION ALERT[CREDIT:NGN100.00]",
  ]);
}

/**
 * Fixture 2: Forwarded Fidelity — creates a properly signed ARC i=1 chain
 * using our test RSA key via mailauth sealMessage.
 *
 * The base email has a failing top-level Authentication-Results (simulating
 * what Gmail adds when receiving the forwarded copy where DKIM is broken)
 * and no valid DKIM-Signature (same scenario).  sealMessage adds ARC-Seal,
 * ARC-Message-Signature, and ARC-Authentication-Results at i=1 — all signed
 * with TEST_PRIVATE_KEY_PEM.
 */
async function rawFidelityForwarded(): Promise<Buffer> {
  const base = makeRaw(
    [
      // Top-level result at alert-inbox delivery — live DKIM broken by forwarding.
      "Authentication-Results: mx.google.com; dkim=fail header.i=@fidelitybank.ng; spf=fail; dmarc=fail",
      "From: ibanking@fidelitybank.ng",
      "To: test-alert@example.com",
      "Subject: Fidelity Bank Credit Alert",
    ],
    "Credit alert body"
  );

  // sealMessage returns ONLY the three ARC header lines (not the full email).
  // We prepend them to the base email to get the complete message.
  // cv: 'none' is required for i=1 (no prior chain to validate).
  const arcHeaders = await sealMessage(base, {
    signingDomain: TEST_DOMAIN,
    selector: TEST_SELECTOR,
    privateKey: TEST_PRIVATE_KEY_PEM as string,
    cv: "none",
    // The authResults value becomes ARC-Authentication-Results: i=1; <value>
    authResults: `${TEST_AUTHSERV}; dkim=pass header.i=@fidelitybank.ng header.s=pepipost`,
  });
  return Buffer.concat([arcHeaders as Buffer, base]);
}

/**
 * Fixture 3: Forged ARC — attacker claims dkim=pass for fidelitybank.ng with
 * a forged ARC-Seal signed using a DIFFERENT key than what the DNS resolver
 * returns.  mailauth's RSA verification will fail → arc.status.result='fail'.
 */
async function rawFidelityForgedWrongKey(): Promise<Buffer> {
  // Generate a key that won't match what wrongKeyResolver returns.
  const { privateKey: attackerKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const base = makeRaw(
    [
      "Authentication-Results: mx.google.com; dkim=fail header.i=@fidelitybank.ng",
      "From: ibanking@fidelitybank.ng",
      "To: test-alert@example.com",
      "Subject: Fidelity Bank Credit Alert",
    ],
    "Attacker body"
  );

  // Sign the ARC-Seal with the attacker's key; the test resolver returns
  // a completely different public key so RSA verification fails.
  const arcHeaders = await sealMessage(base, {
    signingDomain: TEST_DOMAIN,
    selector: TEST_SELECTOR,
    privateKey: attackerKey as string,
    cv: "none",
    authResults: `${TEST_AUTHSERV}; dkim=pass header.i=@fidelitybank.ng header.s=pepipost`,
  });
  return Buffer.concat([arcHeaders as Buffer, base]);
}

/** Fixture 4: No i=1 ARC auth results — chain starts at i=2 (no valid i=1 entry). */
function rawArcWrongIndex(): Buffer {
  return makeRaw([
    "Authentication-Results: mx.google.com; dkim=fail header.i=@fidelitybank.ng",
    // i=2 only — there is no i=1 ARC-Authentication-Results in this email.
    "ARC-Seal: i=2; a=rsa-sha256; t=1000000000; cv=pass; d=google.com; s=arc-20260327; b=FAKESIG==",
    "ARC-Authentication-Results: i=2; mx.google.com; dkim=pass header.i=@fidelitybank.ng",
    "From: ibanking@fidelitybank.ng",
    "Subject: Fake Alert",
  ]);
}

/** Fixture 5: No authentication at all — spoofed From, everything fails. */
function rawSpoofedNoAuth(): Buffer {
  return makeRaw([
    "Authentication-Results: mx.google.com; dkim=fail header.i=@fidelitybank.ng; spf=fail; dmarc=fail",
    "From: ibanking@fidelitybank.ng",
    "Subject: Fake Credit Alert",
  ]);
}

/**
 * Fixture 7: Header injection bypass attempt.
 *
 * Gmail's genuine result (dkim=fail) appears first, as it always does
 * because Gmail prepends its header at delivery.  An attacker has injected
 * a second Authentication-Results header lower in the message that claims
 * dkim=pass.  Only the first header must be trusted; the injected one must
 * be ignored.
 */
function rawInjectedDkimPass(): Buffer {
  return makeRaw([
    // First header — Gmail's genuine delivery result.
    "Authentication-Results: mx.google.com; dkim=fail header.i=@fidelitybank.ng; spf=fail",
    "From: ibanking@fidelitybank.ng",
    "Subject: Fake Credit Alert",
    // Second header — injected by the attacker in the email body/headers.
    "Authentication-Results: mx.attacker.com; dkim=pass header.i=@fidelitybank.ng",
  ]);
}

/** Fixture 6: Valid ARC chain signed by Google but BANK domain not in TRUSTED_BANK_DOMAINS. */
async function rawUntrustedBankDomain(): Promise<Buffer> {
  const base = makeRaw(
    [
      "Authentication-Results: mx.google.com; dkim=fail header.i=@unknownbank.com",
      "From: alerts@unknownbank.com",
      "Subject: Unknown Bank Alert",
    ],
    "Unknown bank body"
  );
  const arcHeaders = await sealMessage(base, {
    signingDomain: TEST_DOMAIN,
    selector: TEST_SELECTOR,
    privateKey: TEST_PRIVATE_KEY_PEM as string,
    cv: "none",
    authResults: `${TEST_AUTHSERV}; dkim=pass header.i=@unknownbank.com header.s=s1`,
  });
  return Buffer.concat([arcHeaders as Buffer, base]);
}

/**
 * Fixture 8: Attacker-controlled signer domain.
 *
 * The attacker owns `attacker.example` and publishes their own RSA public key
 * in its DNS.  They use that key to create a cryptographically valid ARC seal
 * (mailauth's crypto check would pass) but claim dkim=pass for fidelitybank.ng.
 * verifyDkim() must reject this because the i=1 ARC-Seal d= is NOT google.com.
 */
async function rawAttackerControlledDomain(): Promise<Buffer> {
  const base = makeRaw(
    [
      "Authentication-Results: mx.google.com; dkim=fail header.i=@fidelitybank.ng",
      "From: ibanking@fidelitybank.ng",
      "Subject: Fidelity Bank Credit Alert",
    ],
    "Attacker-crafted body"
  );
  // Signed with our test key under attacker.example (NOT google.com).
  const arcHeaders = await sealMessage(base, {
    signingDomain: ATTACKER_DOMAIN,
    selector: TEST_SELECTOR,
    privateKey: TEST_PRIVATE_KEY_PEM as string,
    cv: "none",
    authResults: `${ATTACKER_AUTHSERV}; dkim=pass header.i=@fidelitybank.ng header.s=pepipost`,
  });
  return Buffer.concat([arcHeaders as Buffer, base]);
}

/** DNS resolver that returns our test public key for attacker.example. */
const attackerResolver = async (
  domain: string,
  _type: string
): Promise<string[]> => {
  if (domain === `${TEST_SELECTOR}._domainkey.${ATTACKER_DOMAIN}`) {
    return [`v=DKIM1; k=rsa; p=${TEST_PUBLIC_KEY_B64}`];
  }
  return [];
};

// ── Tests ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Running verifyDkim() unit tests…\n");

  // ── Test 1: Zenith direct — standard Authentication-Results path ─────────────
  console.log(
    "Test 1: Zenith direct — Authentication-Results dkim=pass → accepted"
  );
  {
    const r = await verifyDkim(rawZenithDirect());
    check("ok:true", r.ok === true, r);
    if (r.ok) check("domain=zenithbank.com", r.domain === "zenithbank.com", r.domain);
  }
  console.log();

  // ── Test 2: Forwarded Fidelity — cryptographically signed ARC i=1 → accepted ─
  console.log(
    "Test 2: Forwarded Fidelity — properly signed ARC i=1 (custom resolver) → accepted"
  );
  {
    const raw = await rawFidelityForwarded();
    const r = await verifyDkim(raw, testResolver);
    check("ok:true", r.ok === true, r);
    if (r.ok) check("domain=fidelitybank.ng", r.domain === "fidelitybank.ng", r.domain);
  }
  console.log();

  // ── Test 3: Forged ARC — RSA key mismatch → mailauth rejects → ok:false ──────
  console.log(
    "Test 3: Forged ARC (ARC-Seal signed with key ≠ DNS-published key) → rejected"
  );
  {
    const raw = await rawFidelityForgedWrongKey();
    const r = await verifyDkim(raw, wrongKeyResolver);
    check("ok:false", r.ok === false, r);
  }
  console.log();

  // ── Test 4: ARC at i=2 only — no i=1 results → rejected ─────────────────────
  console.log("Test 4: ARC chain with only i=2 entry, no i=1 → rejected");
  {
    const r = await verifyDkim(rawArcWrongIndex());
    check("ok:false", r.ok === false, r);
  }
  console.log();

  // ── Test 5: Spoofed From, no valid auth anywhere → rejected ──────────────────
  console.log("Test 5: Spoofed From, dkim=fail everywhere → rejected");
  {
    const r = await verifyDkim(rawSpoofedNoAuth());
    check("ok:false", r.ok === false, r);
  }
  console.log();

  // ── Test 6: Valid Google ARC chain but bank domain not in trusted list → rejected
  console.log(
    "Test 6: Google-signed ARC chain but bank domain not in trusted list → rejected"
  );
  {
    const raw = await rawUntrustedBankDomain();
    const r = await verifyDkim(raw, testResolver);
    check("ok:false", r.ok === false, r);
  }
  console.log();

  // ── Test 7: Injected second Authentication-Results with dkim=pass → rejected ──
  // Gmail's genuine result (dkim=fail) is first; an attacker-injected header
  // claiming dkim=pass appears later.  Only the first header must be used.
  console.log(
    "Test 7: Gmail dkim=fail first, attacker-injected dkim=pass second → rejected"
  );
  {
    const r = await verifyDkim(rawInjectedDkimPass());
    check("ok:false", r.ok === false, r);
  }
  console.log();

  // ── Test 8: Attacker-controlled ARC signer domain → rejected ─────────────────
  // The attacker owns attacker.example, publishes their own RSA public key in
  // DNS, and creates a cryptographically valid ARC seal claiming Fidelity
  // dkim=pass.  mailauth's crypto check would pass, but verifyDkim() must
  // reject this because the i=1 ARC-Seal d= is not google.com.
  console.log(
    "Test 8: Valid ARC chain signed by attacker.example (not google.com) → rejected"
  );
  {
    const raw = await rawAttackerControlledDomain();
    // attackerResolver returns our test public key for attacker.example's selector,
    // so the crypto verification itself passes — only the domain check stops it.
    const r = await verifyDkim(raw, attackerResolver);
    check("ok:false", r.ok === false, r);
  }
  console.log();

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log("─".repeat(50));
  if (failures > 0) {
    console.error(`\n${failures} of ${total} check(s) FAILED`);
    process.exit(1);
  }
  console.log(`\nAll ${total} checks passed.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Test run crashed:", err);
  process.exit(1);
});
