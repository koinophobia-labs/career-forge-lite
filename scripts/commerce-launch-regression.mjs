// Credential-free checks for the self-service catalog launch command and the
// server-side checkout boundary. This suite never contacts Stripe or Vercel.

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
let passes = 0;
let failures = 0;

function check(label, condition) {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

const launchPath = path.join(root, "scripts/commerce-launch.mjs");
const launch = read("scripts/commerce-launch.mjs");
const checkout = read("src/app/api/checkout/route.ts");
const stripe = read("src/lib/server/stripe.ts");
const verification = read("src/lib/server/session-verification.ts");

for (const [tier, cents] of [["resume", "900"], ["job", "1_500"], ["career", "2_500"], ["all-access", "3_900"]]) {
  check(`${tier} is provisioned at the approved price`, launch.includes(`tier: "${tier}"`) && launch.includes(`priceCents: ${cents}`));
  check(`${tier} uses server-side Stripe metadata`, launch.includes(`"metadata[tier]": item.tier`));
}
for (const envName of ["STRIPE_PRICE_RESUME", "STRIPE_PRICE_JOB", "STRIPE_PRICE_CAREER", "STRIPE_PRICE_ALL_ACCESS"]) {
  check(`${envName} is provisioned and mapped`, launch.includes(envName) && stripe.includes(envName) && verification.includes(envName));
}

check("products and prices use Stripe idempotency keys", /provisionCatalog[\s\S]*CATALOG_KEY[\s\S]*Idempotency-Key/.test(launch) || (launch.includes("idempotencyKey") && launch.includes(`${"${CATALOG_KEY}"}/${"${item.tier}"}/product`)));
check("Vercel secrets are sent over stdin", /setVercelEnvironment[\s\S]*\{ input: value \}/.test(launch));
check("launch never uses Vercel --value", !launch.includes('"--value"'));
check("temporary credential directory is mode 0700", /chmodSync\(tempDir, 0o700\)/.test(launch));
check("temporary credential directory is deleted", /rmSync\(tempDir, \{ recursive: true, force: true \}\)/.test(launch));
check("new signing key files are mode 0600", /openSync\(resolved, "wx", 0o600\)/.test(launch));
check("signing key file stays outside the repository", launch.includes("--signing-key-file must not be stored inside the repository"));
check("production requires charges and payouts", /charges_enabled !== true \|\| account\.payouts_enabled !== true/.test(launch));
check("legacy Vercel checkout configuration is removed", ["STRIPE_PRICE_RESET", "PAID_BETA_TIER", "NEXT_PUBLIC_PAID_BETA_TIER", "STRIPE_LIVE_RESET_PAYMENT_LINK"].every((name) => launch.includes(name)) && launch.includes("removeVercelEnvironment"));
check("only Career Forge legacy links are retired", launch.includes("belongsToCareerForge && legacy"));
check("no Payment Link is created", !launch.includes('stripeRequest("/v1/payment_links", secretKey, form'));
check("production diagnostic route must be 404", launch.includes("diagnostic.status !== 404"));
check("technical packaging does not self-certify", !launch.includes("CERTIFICATION_RECORD_ID") && /Certification and[\s\S]*stay separate/i.test(launch));

for (const target of ["preview", "production"]) {
  const appUrl = target === "preview" ? "https://career-forge-lite-preview.example.vercel.app" : "https://career-forge-lite.vercel.app";
  const result = spawnSync(process.execPath, [launchPath, "--dry-run", "--target", target, "--app-url", appUrl], { cwd: root, encoding: "utf8", env: {} });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  check(`${target} dry-run exits without credentials`, result.status === 0);
  check(`${target} dry-run names all four prices`, ["resume=$9", "job=$15", "career=$25", "all-access=$39"].every((value) => output.includes(value)));
  check(`${target} dry-run emits no secret-shaped value`, !/sk_(?:test|live)_|whsec_|LICENSE_SIGNING_PRIVATE_KEY=/.test(output));
}

check("checkout accepts only current package tiers", checkout.includes("isPackageTier(tier)"));
check("off mode rejects direct API calls", checkout.includes('commerceMode !== "live" && commerceMode !== "test"'));
check("test mode rejects live Stripe keys", checkout.includes('stripeKeyMode(secretKey) !== "test"'));
check("live mode requires the full sell verdict", checkout.includes("sellVerdict()") && checkout.includes("!verdict.canSellSafely"));
check("checkout requires a client retry identity", checkout.includes("requestId") && checkout.includes("Invalid checkout request."));
check("checkout passes a scoped Stripe idempotency key", checkout.includes("`career-forge/${tier}/${requestId}`"));
check("pricing synchronously suppresses double-click checkout", read("src/app/pricing/page.tsx").includes("checkoutInFlightRef.current") && read("src/app/pricing/page.tsx").includes("checkoutRequestRef.current?.tier"));
check("checkout creates sessions, not static links", checkout.includes("createCheckoutSession") && !checkout.includes("getLiveResetPaymentLinkUrl"));
check("server price mapping has no retired tier env", !stripe.includes("STRIPE_PRICE_RESET") && !verification.includes("STRIPE_PRICE_RESET"));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
