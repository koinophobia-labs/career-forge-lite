// Credential-free regression coverage for the commerce launch command and
// live Payment Link allowlist. This suite never contacts Stripe or Vercel.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

function loadStripeModule() {
  const filePath = path.join(root, "src/lib/server/stripe.ts");
  const source = fs.readFileSync(filePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filePath
  });
  const cjsModule = { exports: {} };
  const localRequire = (request) => {
    if (request === "node:crypto") return require(request);
    if (request === "@/lib/packages") {
      return {
        getPackage: () => ({ name: "Career Reset Pack", priceUsd: 49, summary: "Reset" })
      };
    }
    return require(request);
  };
  new Function("require", "module", "exports", outputText)(localRequire, cjsModule, cjsModule.exports);
  return cjsModule.exports;
}

const { isStripePaymentLinkUrl } = loadStripeModule();
for (const valid of ["https://buy.stripe.com/abc123", "https://buy.stripe.com/9AQ8xY6xZ"]){
  check(`accepts exact Stripe Payment Link ${valid}`, isStripePaymentLinkUrl(valid));
}
for (const invalid of [
  "http://buy.stripe.com/abc123",
  "https://checkout.stripe.com/abc123",
  "https://buy.stripe.com.evil.example/abc123",
  "https://buy.stripe.com/abc123?coupon=free",
  "https://buy.stripe.com/abc123#fragment",
  "https://buy.stripe.com/a/b",
  "not-a-url",
  ""
]) {
  check(`rejects non-allowlisted link ${JSON.stringify(invalid)}`, !isStripePaymentLinkUrl(invalid));
}

const launchPath = path.join(root, "scripts/commerce-launch.mjs");
const launchSource = fs.readFileSync(launchPath, "utf8");
check("five-completed-session restriction is encoded", /COHORT_LIMIT = 5/.test(launchSource));
check("founding price is fixed at $49", /RESET_PRICE_CENTS = 4_900/.test(launchSource));
check("Stripe metadata fixes the tier to reset", /"metadata\[tier\]": "reset"/.test(launchSource));
check("Vercel secrets are sent over stdin", /setVercelEnvironment[\s\S]*\{ input: value \}/.test(launchSource));
check("launch command never uses Vercel --value", !launchSource.includes('"--value"'));
check("temporary credential directory is mode 0700", /chmodSync\(tempDir, 0o700\)/.test(launchSource));
check("temporary credential directory is deleted", /rmSync\(tempDir, \{ recursive: true, force: true \}\)/.test(launchSource));
check("signing key file must stay outside the repository", launchSource.includes("--signing-key-file must not be stored inside the repository"));
check("signing key file is created mode 0600", /openSync\(resolved, "wx", 0o600\)/.test(launchSource));
check("production requires charges and payouts", /charges_enabled !== true \|\| account\.payouts_enabled !== true/.test(launchSource));
check("preview deployment is attached to its canonical alias", /runVercel\(\["alias", "set", deploymentUrl, previewAlias\]\)/.test(launchSource));
check("protected Preview probes use authenticated Vercel curl", launchSource.includes('"vercel",\n        "curl"'));

for (const target of ["preview", "production"]) {
  const appUrl = target === "preview" ? "https://career-forge-lite-git-issue-20.example.vercel.app" : "https://career-forge-lite.vercel.app";
  const result = spawnSync(process.execPath, [launchPath, "--dry-run", "--target", target, "--app-url", appUrl], {
    cwd: root,
    encoding: "utf8",
    env: {}
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  check(`${target} dry-run exits cleanly without credentials`, result.status === 0);
  check(`${target} dry-run reports the non-mutating plan`, output.includes("DRY RUN:") && output.includes("value never logged"));
  check(`${target} dry-run emits no secret-shaped value`, !/sk_(?:test|live)_|whsec_|LICENSE_SIGNING_PRIVATE_KEY=/.test(output));
}

const checkoutSource = fs.readFileSync(path.join(root, "src/app/api/checkout/route.ts"), "utf8");
// The Payment Link was fire-and-forget: the server never learned the session
// id, so it could not verify payment, record it durably, or notice a purchase
// that was never delivered. Live mode now creates a real Checkout Session.
check("live checkout creates a real Stripe Checkout Session", checkoutSource.includes("createCheckoutSession"));
check("live checkout no longer hands out a static Payment Link", !checkoutSource.includes("getLiveResetPaymentLinkUrl"));
check("live checkout hard-codes the only paid tier to reset", checkoutSource.includes('liveMode && tier !== "reset"'));
check("live checkout fails closed if PAID_BETA_TIER drifts", checkoutSource.includes('process.env.PAID_BETA_TIER !== "reset"'));
check(
  "live checkout rejects closed tiers before creating a session",
  checkoutSource.indexOf('tier !== "reset"') < checkoutSource.indexOf("createCheckoutSession(tier")
);

console.log(`\n${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
