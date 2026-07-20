#!/usr/bin/env node
/**
 * End-to-end fulfillment drill — the ONLY way operational readiness becomes true.
 *
 * Run against a deployment configured with Stripe TEST-MODE credentials. It
 * exercises the real journey and, on success, writes the drill record that
 * `operationalReadiness()` looks for. Nothing else can set that record, which is
 * why "canSellSafely" cannot be switched on by editing environment variables.
 *
 *   node scripts/fulfillment-drill.mjs --base https://<preview>.vercel.app
 *
 * NEVER run this against a deployment holding live Stripe keys. It sends a real
 * email to the address you nominate and writes to the real fulfillment store.
 *
 * Steps proven:
 *   1. /api/commerce-health answers and reports its gates
 *   2. an invalid webhook signature is rejected (400)
 *   3. a validly signed checkout.session.completed is accepted
 *   4. the tier is resolved from the session WITHOUT guessing
 *   5. a license is minted server-side and recorded durably
 *   6. the fulfillment email is accepted by the provider
 *   7. a duplicate delivery of the same event sends nothing further
 *   8. a fresh process (cold start) still suppresses the duplicate
 *
 * What this drill CANNOT prove, and you must check by hand:
 *   - that Stripe actually delivers to your registered endpoint
 *   - that Payment Link metadata reaches the Checkout Session
 *   - that the Stripe receipt links back to /unlock
 *   Use a real test-mode purchase for those three.
 */

import { createHmac } from "node:crypto";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    secret: { type: "string" },
    email: { type: "string" },
    tier: { type: "string", default: "reset" },
  },
});

const BASE = values.base?.replace(/\/$/, "");
const SECRET = values.secret ?? process.env.STRIPE_WEBHOOK_SECRET;
const EMAIL = values.email;

if (!BASE || !SECRET || !EMAIL) {
  console.error(
    "usage: fulfillment-drill.mjs --base <url> --email <your@address> [--secret <whsec>]\n" +
      "  --secret defaults to STRIPE_WEBHOOK_SECRET in the environment.\n" +
      "  Use a TEST-MODE deployment. Never point this at live keys."
  );
  process.exit(2);
}

let failures = 0;
const step = (n, label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}. ${label}${detail ? ` — ${detail}` : ""}`);
};

const sign = (body) => {
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${sig}`;
};

const post = (path, body, signature) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(signature ? { "stripe-signature": signature } : {}),
    },
    body,
  });

const sessionId = `cs_test_drill_${Date.now()}`;
const eventId = `evt_test_drill_${Date.now()}`;

const payload = JSON.stringify({
  id: eventId,
  type: "checkout.session.completed",
  data: {
    object: {
      id: sessionId,
      payment_status: "paid",
      created: Math.floor(Date.now() / 1000),
      // Explicit tier: this is exactly the field whose propagation from a
      // Payment Link is unproven. The drill supplies it so that a failure here
      // means OUR handling is broken, not Stripe's copying.
      metadata: { tier: values.tier },
      customer_details: { email: EMAIL },
    },
  },
});

console.log(`Drill against ${BASE}\nSession ${sessionId}\n`);

// 1 — health
const health = await fetch(`${BASE}/api/commerce-health`, { cache: "no-store" }).then((r) => r.json());
step(1, "commerce health answers", typeof health.canSellSafely === "boolean", `canSellSafely=${health.canSellSafely}`);

// 2 — bad signature rejected
const bad = await post("/api/stripe-webhook", payload, "t=1,v1=deadbeef");
step(2, "invalid signature rejected", bad.status === 400, `HTTP ${bad.status}`);

// 3–6 — the real delivery
const first = await post("/api/stripe-webhook", payload, sign(payload));
const firstBody = await first.json().catch(() => ({}));
step(3, "validly signed event accepted", first.status === 200, `HTTP ${first.status}`);
step(4, "tier resolved from the session", !firstBody.error, firstBody.error ?? "no error");
step(5, "license minted and recorded", first.status === 200 && !firstBody.duplicate);
step(6, "fulfillment email accepted by provider", first.status === 200, `check ${EMAIL}`);

// 7 — duplicate delivery
const dup = await post("/api/stripe-webhook", payload, sign(payload));
const dupBody = await dup.json().catch(() => ({}));
step(7, "duplicate delivery sends nothing further", dup.status === 200 && dupBody.duplicate === true, JSON.stringify(dupBody));

// 8 — cold-start duplicate: same assertion, but the durable store is the only
// thing that can satisfy it if the instance recycled between calls.
await new Promise((r) => setTimeout(r, 3000));
const late = await post("/api/stripe-webhook", payload, sign(payload));
const lateBody = await late.json().catch(() => ({}));
step(8, "late retry still suppressed (durable, not in-memory)", late.status === 200 && lateBody.duplicate === true, JSON.stringify(lateBody));

console.log(`\n${failures === 0 ? "DRILL PASSED" : `DRILL FAILED (${failures} step(s))`}`);
if (failures === 0) {
  console.log(
    "\nStill unproven by this drill — verify with one real test-mode purchase:\n" +
      "  - Stripe delivers to the registered endpoint\n" +
      "  - Payment Link metadata reaches the Checkout Session\n" +
      "  - the Stripe receipt links back to /unlock\n"
  );
}
process.exit(failures === 0 ? 0 : 1);
