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
const packages = read("src/lib/packages.ts");
const service = read("src/app/reviewed-service/page.tsx");
const terms = read("src/app/terms/page.tsx");
const privacy = read("src/app/privacy/page.tsx");
const versions = read("src/app/versions/page.tsx");
const footer = read("src/components/SiteFooter.tsx");
const founding = read("src/app/founding-beta/page.tsx");
const checkout = read("src/app/api/checkout/route.ts");
const stripe = read("src/lib/server/stripe.ts");
const verification = read("src/lib/server/session-verification.ts");
const entitlement = read("src/lib/entitlement.ts");
const license = read("src/lib/license.ts");
const envExample = read(".env.example");
const hashScript = read("scripts/compute-surface-hash.mjs");
const certification = read("src/lib/server/certification.ts");
const stripeAudit = read("scripts/audit-stripe-payment-links.mjs");

for (const [tier, name, price] of [
  ["resume", "Resume Pack", 9],
  ["job", "Job Pack", 15],
  ["career", "Career Pack", 25],
  ["all-access", "30-Day All Access", 39],
]) {
  const tierKey = tier.includes("-") ? `"${tier}": {` : `${tier}: {`;
  check(`${name} has the approved price`, packages.includes(tierKey) && packages.includes(`name: "${name}"`) && packages.includes(`priceUsd: ${price}`));
}
check("free experience is useful and cardless", packages.includes("Import or enter your history") && packages.includes("No card or account required"));
check("every paid card explains limit and post-purchase behavior", pricing.includes("<strong className=\"text-paper\">Limit:</strong>") && pricing.includes("<strong className=\"text-paper\">After purchase:</strong>"));
check("pricing explains free versus paid", pricing.includes("What stays free?") && pricing.includes("What paid access changes"));
check("pricing explains why the product saves effort", pricing.includes("instead of repeatedly prompting a general chatbot") && pricing.includes("less re-entry"));
check("pricing has no high-ticket service in the primary funnel", !pricing.includes("$149") && !pricing.includes("reviewed-service"));
check("versions has no human-service upsell", !versions.includes("reviewed-service") && !versions.includes("$149"));
check("footer presents self-service pricing", footer.includes("Free &amp; paid self-service packs"));

check("optional human service remains inquiry-first", service.includes("mailto:${SERVICE_EMAIL}") && service.includes("no payment yet") && !service.includes("/api/checkout"));
check("terms call human work secondary", terms.includes("Separate optional human résumé service"));
check("privacy separates service inquiry from file transfer", privacy.includes("An availability inquiry does not require résumé files"));
check("retired cohort page redirects to pricing", founding.includes('redirect("/pricing")') && !founding.includes("Secure checkout is live"));

check("commerce defaults off in a fresh environment", /^NEXT_PUBLIC_COMMERCE_MODE=off$/m.test(envExample));
check("all four authoritative price variables are documented", ["STRIPE_PRICE_RESUME", "STRIPE_PRICE_JOB", "STRIPE_PRICE_CAREER", "STRIPE_PRICE_ALL_ACCESS"].every((name) => envExample.includes(name)));
check("legacy checkout variables are absent from the example", !envExample.includes("STRIPE_PRICE_RESET") && !envExample.includes("PAID_BETA_TIER") && !envExample.includes("RESET_PAYMENT_LINK"));
check("checkout fails closed unless mode is explicit", checkout.includes('commerceMode !== "live" && commerceMode !== "test"') && checkout.includes('code: "commerce_off"'));
check("test checkout refuses live keys", checkout.includes('stripeKeyMode(secretKey) !== "test"'));
check("live checkout requires operational evidence", checkout.includes("sellVerdict()") && checkout.includes("!verdict.canSellSafely"));
check("checkout creates only server-side sessions", checkout.includes("createCheckoutSession") && !checkout.includes("PaymentLinkUrl"));
check("Stripe client has no unverifiable inline-price fallback", !stripe.includes("price_data") && stripe.includes("if (!priceId)"));
check("Stripe price mapping is server-authoritative", ["STRIPE_PRICE_RESUME", "STRIPE_PRICE_JOB", "STRIPE_PRICE_CAREER", "STRIPE_PRICE_ALL_ACCESS"].every((name) => stripe.includes(name) && verification.includes(name)));
check("retired tiers cannot enter checkout", !stripe.includes("STRIPE_PRICE_RESET") && !verification.includes("STRIPE_PRICE_RESET"));
check("checkout has retry idempotency", checkout.includes("requestId") && checkout.includes("`career-forge/${tier}/${requestId}`"));

check("paid access is a signature, not a client boolean", entitlement.includes("verifyLicenseKey") && !entitlement.includes("paid: true"));
check("multiple purchases coexist in the signed wallet", entitlement.includes("activeEntitlements") && entitlement.includes("expiredEntitlements") && entitlement.includes("entitlementIdentity"));
check("30-day access has signed expiration", license.includes("exp") && license.includes('tier === "all-access"') && license.includes('reason: "expired"'));
check("old signed purchases remain compatible", license.includes("raw.v === 1") && license.includes("normalizePackageTier") && packages.includes("normalizePackageTier"));

check("Stripe audit is read-only and never prints URLs", !stripeAudit.includes("method:") && !stripeAudit.includes("link.url"));
check("Stripe audit requires zero active Career Forge links", stripeAudit.includes("zero active Career Forge Payment Links") && stripeAudit.includes("activeCareerForgeLinks !== 0"));
check("Stripe audit verifies the exact four prices", ["900", "1_500", "2_500", "3_900"].every((amount) => stripeAudit.includes(amount)));

const criticalSurfaceFiles = [
  "src/app/api/commerce-health/route.ts",
  "src/lib/entitlement.ts",
  "src/lib/license.ts",
  "src/lib/server/certification.ts",
  "src/lib/server/fulfillment-readiness.ts",
];
check("commerce hash covers verification and readiness", criticalSurfaceFiles.every((file) => hashScript.includes(`\"${file}\"`)));
check("runtime surface covers verification and readiness", criticalSurfaceFiles.every((file) => certification.includes(`\"${file}\"`)));

const quotedFiles = (source, declaration) => {
  const block = source.match(new RegExp(`${declaration}\\s*=\\s*\\[([\\s\\S]*?)\\n\\]`))?.[1] ?? "";
  return [...block.matchAll(/"(src\/[^\"]+\.(?:ts|tsx))"/g)].map((match) => match[1]);
};
check("hash script and runtime certified surfaces match", JSON.stringify(quotedFiles(hashScript, "const SURFACE")) === JSON.stringify(quotedFiles(certification, "export const CERTIFIED_SURFACE")));

console.log(`\nRevenue readiness regression: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
