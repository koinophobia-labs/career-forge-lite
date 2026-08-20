#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

let passed = 0;
let failed = 0;
function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL ${label}`);
  }
}

const pricing = read("src/app/pricing/page.tsx");
const service = read("src/app/reviewed-service/page.tsx");
const terms = read("src/app/terms/page.tsx");
const privacy = read("src/app/privacy/page.tsx");
const runbook = read("docs/REVIEWED_SERVICE_FULFILLMENT.md");
const versions = read("src/app/versions/page.tsx");
const founding = read("src/app/founding-beta/page.tsx");
const checkout = read("src/app/api/checkout/route.ts");
const envExample = read(".env.example");
const hashScript = read("scripts/compute-surface-hash.mjs");
const certification = read("src/lib/server/certification.ts");
const stripeLinkAudit = read("scripts/audit-stripe-payment-links.mjs");

check("free self-serve is the public-beta promise", pricing.includes("complete self-serve workflow is free during beta"));
check("$149 service is explicitly human-reviewed", pricing.includes("$149 human-reviewed rebuild") && service.includes("Human service · Separate from the SaaS beta"));
check("reviewed service stays inquiry-first", service.includes("mailto:${SERVICE_EMAIL}") && service.includes("no payment yet") && !service.includes("/api/checkout"));
check("public service states one-client founding capacity", service.includes("one paid rebuild is handled at a time"));
check("operator runbook enforces one active paid rebuild", runbook.includes("accept only one active paid rebuild at a time") && runbook.includes("Do not send a second payment link"));
check("service page and runbook use the monitored address", service.includes("koinophobia999@gmail.com") && runbook.includes("koinophobia999@gmail.com"));
check("no stale service inbox remains", !runbook.includes("hello@koinophobia.dev"));
check("service, terms, and runbook promise five business days", [service, terms, runbook].every((source) => source.includes("5 business days")));
check("no public 48-hour promise remains", !service.includes("48 hours") && !terms.includes("48 hours"));
check("terms require availability before payment", terms.includes("one active paid rebuild at a time") && terms.includes("will not send a payment link until a start date is available"));
check("privacy separates inquiry from file transfer", privacy.includes("An availability inquiry does not require résumé files"));
check("customer-facing deliverables agree on LinkedIn headline", service.includes("LinkedIn headline") && versions.includes("a LinkedIn headline") && !versions.includes("LinkedIn positioning"));
check("commerce defaults to off", /^NEXT_PUBLIC_COMMERCE_MODE=off$/m.test(envExample));
check("checkout API fails closed unless mode is explicitly test or live", checkout.includes('commerceMode !== "live" && commerceMode !== "test"') && checkout.includes('code: "commerce_off"'));
check("test checkout refuses a live Stripe key", checkout.includes('stripeKeyMode(secretKey) !== "test"'));
check("retired $49 cohort page redirects to current pricing", founding.includes('redirect("/pricing")') && !founding.includes("Secure checkout is live"));
check("Stripe link audit is read-only and redacts shareable URLs", stripeLinkAudit.includes("GET") === false && stripeLinkAudit.includes("method:") === false && !stripeLinkAudit.includes("link.url"));
check("Stripe link audit accepts restricted live keys", stripeLinkAudit.includes("(?:sk|rk)_live_"));
check("Stripe link audit enforces the manual-service posture", stripeLinkAudit.includes("zero active legacy $49 links") && stripeLinkAudit.includes("exactly one active $149 service link"));

const criticalSurfaceFiles = [
  "src/app/api/commerce-health/route.ts",
  "src/lib/entitlement.ts",
  "src/lib/license.ts",
  "src/lib/server/certification.ts",
  "src/lib/server/fulfillment-readiness.ts"
];
check("commerce hash covers verification and readiness code", criticalSurfaceFiles.every((file) => hashScript.includes(`\"${file}\"`)));
check("runtime surface declaration covers verification and readiness code", criticalSurfaceFiles.every((file) => certification.includes(`\"${file}\"`)));

const quotedFiles = (source, declaration) => {
  const block = source.match(new RegExp(`${declaration}\\s*=\\s*\\[([\\s\\S]*?)\\n\\]`))?.[1] ?? "";
  return [...block.matchAll(/"(src\/[^"]+\.(?:ts|tsx))"/g)].map((match) => match[1]);
};
const scriptSurface = quotedFiles(hashScript, "const SURFACE");
const runtimeSurface = quotedFiles(certification, "export const CERTIFIED_SURFACE");
check("hash script and runtime certified surfaces are identical", JSON.stringify(scriptSurface) === JSON.stringify(runtimeSurface));

console.log(`\nRevenue readiness regression: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
