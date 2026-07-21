#!/usr/bin/env node
/**
 * Thin operator client for production-host Stripe test certification.
 *
 * The deployment owns every credential and every verification decision. This
 * client supplies only a controlled test address or Stripe identifiers, then
 * displays the deployment-owned result. It cannot write approval.
 *
 * Secrets are accepted only through the process environment so they do not
 * appear in shell history or the process argument list:
 *
 *   CERTIFICATION_OPERATOR_TOKEN=... CERTIFICATION_TEST_EMAIL=... \
 *   node scripts/certify-fulfillment.mjs --base https://career-forge-lite.vercel.app
 *
 * After Stripe has delivered and then re-delivered the same event from a fresh
 * deployment instance:
 *
 *   CERTIFICATION_OPERATOR_TOKEN=... CERTIFICATION_REDEMPTION_CODE=... \
 *   node scripts/certify-fulfillment.mjs --base https://career-forge-lite.vercel.app \
 *     --session-id cs_test_... --event-id evt_...
 */

import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    base: { type: "string" },
    "session-id": { type: "string" },
    "event-id": { type: "string" },
  },
});

const die = (message) => {
  console.error(`REFUSED: ${message}`);
  process.exit(2);
};

const base = values.base?.replace(/\/$/, "");
const token = process.env.CERTIFICATION_OPERATOR_TOKEN?.trim();
const testEmail = process.env.CERTIFICATION_TEST_EMAIL?.trim();
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
const redemptionCode = process.env.CERTIFICATION_REDEMPTION_CODE?.trim();

if (!base || !token) {
  die("set CERTIFICATION_OPERATOR_TOKEN and pass --base with the exact production URL");
}

const target = new URL("/api/internal/commerce-certification", base);
if (target.protocol !== "https:" || target.hostname !== "career-forge-lite.vercel.app") {
  die("certification must target the exact Career Forge production hostname over HTTPS");
}
if (bypass) target.searchParams.set("x-vercel-protection-bypass", bypass);

const sessionId = values["session-id"];
const eventId = values["event-id"];
const recording = Boolean(sessionId || eventId);
if (recording && (!sessionId || !eventId)) {
  die("recording requires both --session-id and --event-id");
}
if (recording && !redemptionCode) {
  die("set CERTIFICATION_REDEMPTION_CODE to the short code received by the controlled test mailbox");
}
if (!recording && !testEmail) {
  die("set CERTIFICATION_TEST_EMAIL to create the controlled test Checkout Session");
}

const response = await fetch(target, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(
    recording
      ? { action: "record", sessionId, eventId, redemptionCode }
      : { action: "create", email: testEmail }
  ),
});
const result = await response.json().catch(() => null);
if (!response.ok) {
  die(result?.error ?? `deployment returned ${response.status}`);
}

if (!recording) {
  console.log("Genuine production-host Stripe test Checkout created.");
  console.log(`session ${result.sessionId}`);
  console.log(`url     ${result.url}`);
  console.log("Complete the $49 test payment, verify inbox delivery, redeploy the same commit, and re-deliver the Stripe event before recording.");
  process.exit(0);
}

console.log("Operational certification recorded by the production deployment.");
console.log(`evidence ${result.evidenceId}`);
console.log(`commit   ${result.evidence?.commitSha}`);
console.log(`host     ${result.evidence?.host}`);
console.log(`stripe   ${result.evidence?.stripeAccountId} (test)`);
console.log(`price    ${result.evidence?.priceId} -> ${result.evidence?.tier}`);
console.log(`event    ${result.evidence?.stripeEventId}`);
console.log(`provider ${result.evidence?.emailProviderMessageId}`);
console.log("This is evidence, not permission. No live-commerce approval was created.");
