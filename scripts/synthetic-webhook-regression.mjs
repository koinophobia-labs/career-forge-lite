#!/usr/bin/env node
/**
 * Synthetic webhook regression — handler behaviour ONLY.
 *
 * This posts fabricated, correctly-signed events at a LOCAL server to exercise
 * signature handling and the fulfillment path. It is deliberately incapable of
 * certifying anything:
 *
 *   - it never writes the certification or approval documents
 *   - the webhook it talks to now re-reads every session from Stripe, so a
 *     fabricated session id simply fails verification
 *   - it refuses to run against anything but localhost
 *
 * That last point is enforced at runtime, not in a comment. The previous
 * version of this tool told you not to point it at production and then happily
 * would have.
 *
 *   node scripts/synthetic-webhook-regression.mjs --base http://localhost:3000
 */

import { createHmac } from "node:crypto";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { base: { type: "string", default: "http://localhost:3000" }, secret: { type: "string" } },
});

const BASE = values.base.replace(/\/$/, "");
const SECRET = values.secret ?? process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_synthetic_local_only";

/* ---------------------------------------------------------- runtime guards */

const url = new URL(BASE);
const LOCAL = ["localhost", "127.0.0.1", "::1", "0.0.0.0"];
if (!LOCAL.includes(url.hostname)) {
  console.error(
    `REFUSED: synthetic regression may only target localhost. Got "${url.hostname}".\n` +
      "This tool fabricates paid events; pointing it at a deployment is never correct."
  );
  process.exit(2);
}
if (/^sk_live|^rk_live/.test(process.env.STRIPE_SECRET_KEY ?? "")) {
  console.error("REFUSED: a live Stripe key is present in this environment.");
  process.exit(2);
}
if ((process.env.NEXT_PUBLIC_COMMERCE_MODE ?? "").trim() === "live") {
  console.error("REFUSED: NEXT_PUBLIC_COMMERCE_MODE is live.");
  process.exit(2);
}

/* ----------------------------------------------------------------- helpers */

let failures = 0;
const check = (label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const sign = (body) => {
  const t = Math.floor(Date.now() / 1000);
  return `t=${t},v1=${createHmac("sha256", SECRET).update(`${t}.${body}`).digest("hex")}`;
};

const post = (body, signature) =>
  fetch(`${BASE}/api/stripe-webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(signature ? { "stripe-signature": signature } : {}) },
    body,
  });

const fabricated = (sessionId) =>
  JSON.stringify({
    id: `evt_synthetic_${Date.now()}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        payment_status: "paid",
        created: Math.floor(Date.now() / 1000),
        metadata: { tier: "reset" },
        customer_details: { email: "synthetic@example.invalid" },
      },
    },
  });

/* ------------------------------------------------------------------- tests */

console.log(`Synthetic regression against ${BASE}\n`);

const unsigned = await post(fabricated("cs_test_synthetic_1"), null);
check("missing signature rejected", unsigned.status === 400 || unsigned.status === 503, `HTTP ${unsigned.status}`);

const badSig = await post(fabricated("cs_test_synthetic_2"), "t=1,v1=deadbeef");
check("invalid signature rejected", badSig.status === 400 || badSig.status === 503, `HTTP ${badSig.status}`);

// THE LOOPHOLE TEST. A correctly signed, fabricated "paid" event naming a
// session that does not exist in Stripe must not fulfill and must not certify.
const body = fabricated("cs_test_drill_would_have_certified");
const forged = await post(body, sign(body));
check(
  "correctly signed fabricated event does NOT fulfill",
  forged.status !== 200,
  `HTTP ${forged.status} (Stripe has no such session)`
);

const health = await fetch(`${BASE}/api/commerce-health`, { cache: "no-store" })
  .then((r) => r.json())
  .catch(() => null);
check("health still reports it cannot sell", health?.canSellSafely === false, JSON.stringify(health?.blockers?.slice(0, 1) ?? []));

console.log(`\n${failures === 0 ? "SYNTHETIC REGRESSION PASSED" : `FAILED (${failures})`}`);
console.log("This proves handler behaviour only. It certifies nothing.");
process.exit(failures === 0 ? 0 : 1);
