#!/usr/bin/env node
/**
 * Real certification — the only thing that can produce operational proof.
 *
 * It cannot fabricate anything. It creates a genuine Stripe TEST-MODE Checkout
 * Session, waits for a human to complete it with a test card, then confirms with
 * Stripe that the session was really paid before recording evidence.
 *
 * What it refuses to do, enforced at runtime:
 *   - run against the production hostname
 *   - run with a live Stripe key (sk_live / rk_live)
 *   - accept a session Stripe reports as livemode
 *   - accept a webhook secret as evidence of anything
 *   - authorize live checkout (that needs a separate approval record)
 *
 *   node scripts/certify-fulfillment.mjs \
 *     --base https://<preview>.vercel.app \
 *     --stripe-key sk_test_... \
 *     --email you@example.com
 */

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    "stripe-key": { type: "string" },
    email: { type: "string" },
    tier: { type: "string", default: "reset" },
    "session-id": { type: "string" },
  },
});

const BASE = values.base?.replace(/\/$/, "");
const KEY = values["stripe-key"] ?? process.env.STRIPE_TEST_SECRET_KEY;
const EMAIL = values.email;

const PRODUCTION_HOSTS = ["career-forge-lite.vercel.app"];

/* ---------------------------------------------------------- runtime guards */

const die = (msg) => {
  console.error(`REFUSED: ${msg}`);
  process.exit(2);
};

if (!BASE || !KEY || !EMAIL) {
  console.error(
    "usage: certify-fulfillment.mjs --base <preview-url> --stripe-key sk_test_... --email <you@address>"
  );
  process.exit(2);
}

const host = new URL(BASE).hostname;
if (PRODUCTION_HOSTS.includes(host)) {
  die(`"${host}" is the production host. Certification runs against a preview, never production.`);
}
if (!/^sk_test_|^rk_test_/.test(KEY)) {
  die("the Stripe key is not a test-mode key. Certification never touches live keys.");
}

/* ----------------------------------------------------------- stripe client */

const stripe = async (path, method = "GET", form) => {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path} failed: ${json?.error?.message ?? res.status}`);
  return json;
};

let failures = 0;
const step = (n, label, ok, detail = "") => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${n}. ${label}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------- flow */

console.log(`Certifying ${BASE}\n`);

const account = await stripe("/account");
step(1, "Stripe test account reachable", Boolean(account.id), account.id);

let sessionId = values["session-id"];

if (!sessionId) {
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": process.env.STRIPE_PRICE_RESET ?? "",
    "line_items[0][quantity]": "1",
    success_url: `${BASE}/unlock?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${BASE}/pricing?checkout=cancelled`,
    customer_email: EMAIL,
  });
  if (!process.env.STRIPE_PRICE_RESET) {
    die("STRIPE_PRICE_RESET is not set. The price id is the authoritative tier signal.");
  }
  const created = await stripe("/checkout/sessions", "POST", form);
  sessionId = created.id;

  console.log(
    `\nOpen this in a browser and pay with Stripe's test card 4242 4242 4242 4242:\n\n  ${created.url}\n\n` +
      `Then re-run with --session-id ${sessionId}\n`
  );
  process.exit(0);
}

// Verify with Stripe — never with the payload, never with a signature.
const session = await stripe(`/checkout/sessions/${sessionId}?expand[]=line_items`);

step(2, "session exists in this Stripe account", session.id === sessionId, session.id);
step(3, "session is test mode", session.livemode === false, `livemode=${session.livemode}`);
step(4, "Stripe reports the session paid", session.payment_status === "paid", session.payment_status);

const priceId = session.line_items?.data?.[0]?.price?.id ?? null;
step(5, "price id present and known", Boolean(priceId && priceId === process.env.STRIPE_PRICE_RESET), priceId ?? "none");
step(6, "amount matches the package", session.amount_total === 4900, String(session.amount_total));
step(7, "currency is usd", (session.currency ?? "").toLowerCase() === "usd", session.currency);

// Did OUR application actually fulfill it? Ask the deployment, not ourselves.
const record = await fetch(`${BASE}/api/commerce-health`, { cache: "no-store" }).then((r) => r.json());
step(8, "deployment health reachable", typeof record?.canSellSafely === "boolean");

// Confirm the license endpoint issues a key for the real session.
const license = await fetch(`${BASE}/api/license`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sessionId }),
}).then((r) => r.json().then((j) => ({ status: r.status, j })));
step(9, "license issued for the real paid session", license.status === 200 && Boolean(license.j?.license));

console.log(
  `\n${failures === 0 ? "CERTIFICATION STEPS PASSED" : `CERTIFICATION FAILED (${failures})`}\n`
);

if (failures === 0) {
  console.log(
    "Evidence NOT yet written. Recording it requires the deployment's own\n" +
      "certification endpoint with an operator token, so that a laptop holding a\n" +
      "test key cannot certify a deployment by itself.\n\n" +
      "Still to confirm by hand before any reopening:\n" +
      "  - Stripe delivered checkout.session.completed to the registered endpoint\n" +
      "  - the fulfillment email arrived and the provider returned a message id\n" +
      "  - the success and cancel URLs behaved\n" +
      "  - what the Stripe receipt actually links to\n\n" +
      "And then: live checkout still requires Blake's explicit approval record\n" +
      "for this exact commit. Certification is evidence, not permission.\n"
  );
}

process.exit(failures === 0 ? 0 : 1);
