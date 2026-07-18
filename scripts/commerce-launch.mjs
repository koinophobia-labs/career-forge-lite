#!/usr/bin/env node

// Safe, repeatable Career Reset commerce launch automation.
//
// Secrets are accepted only through target-specific process environment
// variables or an authenticated Vercel env pull into a mode-0600 temporary
// file. Values are sent to Vercel over stdin and are never printed or placed in
// command arguments. The temporary directory is removed in a finally block.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createPrivateKey, createPublicKey, generateKeyPairSync } from "node:crypto";

const OFFER_KEY = "career-forge-reset-founding-v1";
const EXPECTED_PROJECT = "career-forge-lite";
const RESET_PRICE_CENTS = 4_900;
const COHORT_LIMIT = 5;

function usage() {
  console.log(`Usage:
  npm run commerce:launch -- --target preview --app-url https://<preview-host> --signing-key-file /absolute/test-license.json
  npm run commerce:launch -- --target production --app-url https://career-forge-lite.vercel.app --signing-key-file /absolute/live-license.json
  npm run commerce:launch -- --dry-run --target <preview|production> --app-url <https-origin>

Required secret environment variable:
  Preview:    STRIPE_TEST_SECRET_KEY
  Production: STRIPE_LIVE_SECRET_KEY`);
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function canonicalOrigin(value) {
  if (!value) throw new Error("--app-url is required.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("--app-url must be a clean HTTPS origin.");
  }
  if (url.pathname !== "/") throw new Error("--app-url must not contain a path.");
  return url.origin;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const parsed = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator);
    let value = line.slice(separator + 1);
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function runVercel(args, { input, exposeOutput = false } = {}) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(executable, ["vercel", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    input: input === undefined ? undefined : `${input}\n`,
    maxBuffer: 10 * 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Vercel command failed: vercel ${args.join(" ")}`);
  }
  return exposeOutput ? `${result.stdout ?? ""}\n${result.stderr ?? ""}` : "";
}

function pullVercelEnvironment(environment, filePath) {
  runVercel(["env", "pull", filePath, "--environment", environment, "--yes"]);
  fs.chmodSync(filePath, 0o600);
  return parseEnvFile(filePath);
}

function setVercelEnvironment(name, value, environment, sensitive) {
  const visibilityArgs = sensitive ? [] : ["--no-sensitive"];
  runVercel(["env", "add", name, environment, "--force", "--yes", ...visibilityArgs], { input: value });
}

function generateSigningPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    publicKey: publicKey.export({ format: "der", type: "spki" }).toString("base64")
  };
}

function loadOrCreateSigningPair(filePath) {
  if (!filePath || !path.isAbsolute(filePath)) {
    throw new Error("--signing-key-file must be an absolute path outside the repository.");
  }
  const resolved = path.resolve(filePath);
  const repositoryPrefix = `${path.resolve(process.cwd())}${path.sep}`;
  if (resolved.startsWith(repositoryPrefix)) {
    throw new Error("--signing-key-file must not be stored inside the repository.");
  }
  if (fs.existsSync(resolved)) {
    const stat = fs.lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Signing-key file must be a regular file.");
    fs.chmodSync(resolved, 0o600);
    const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
    if (!validateSigningPair(parsed.privateKey, parsed.publicKey)) {
      throw new Error("Signing-key file contains an invalid or mismatched pair.");
    }
    return parsed;
  }
  const pair = generateSigningPair();
  const handle = fs.openSync(resolved, "wx", 0o600);
  try {
    fs.writeFileSync(handle, JSON.stringify(pair), "utf8");
  } finally {
    fs.closeSync(handle);
  }
  fs.chmodSync(resolved, 0o600);
  return pair;
}

function validateSigningPair(privateKeyB64, publicKeyB64) {
  try {
    const privateKey = createPrivateKey({
      key: Buffer.from(privateKeyB64, "base64"),
      format: "der",
      type: "pkcs8"
    });
    const derived = createPublicKey(privateKey).export({ format: "der", type: "spki" });
    return derived.equals(Buffer.from(publicKeyB64, "base64"));
  } catch {
    return false;
  }
}

async function stripeRequest(pathname, secretKey, form, idempotencyKey) {
  const response = await fetch(`https://api.stripe.com${pathname}`, {
    method: form ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
    },
    body: form
  });
  if (!response.ok) throw new Error(`Stripe request failed (${response.status}) at ${pathname}.`);
  return response.json();
}

function form(entries) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) params.set(key, String(value));
  return params;
}

function isPaymentLinkUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "buy.stripe.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/[A-Za-z0-9]+$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

async function validateStripeAccount(secretKey, target) {
  const account = await stripeRequest("/v1/account", secretKey);
  if (target === "production") {
    if (account.charges_enabled !== true || account.payouts_enabled !== true) {
      throw new Error("Stripe live charges and payouts must both be enabled before production launch.");
    }
    if (!account.settings?.payments?.statement_descriptor?.trim()) {
      throw new Error("Stripe statement descriptor must be configured before production launch.");
    }
    if (!account.business_profile?.support_email?.trim()) {
      throw new Error("Stripe business support email must be configured before production launch.");
    }
  }
  return {
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    statementDescriptorConfigured: Boolean(account.settings?.payments?.statement_descriptor?.trim()),
    supportEmailConfigured: Boolean(account.business_profile?.support_email?.trim())
  };
}

async function paymentLinkHasResetPrice(link, secretKey) {
  const lineItems = await stripeRequest(`/v1/payment_links/${encodeURIComponent(link.id)}/line_items?limit=20`, secretKey);
  return (
    lineItems.data?.length === 1 &&
    lineItems.data[0]?.quantity === 1 &&
    lineItems.data[0]?.price?.currency === "usd" &&
    lineItems.data[0]?.price?.unit_amount === RESET_PRICE_CENTS &&
    lineItems.data[0]?.price?.type === "one_time"
  );
}

async function updatePaymentLink(linkId, appUrl, secretKey, active = true) {
  return stripeRequest(
    `/v1/payment_links/${encodeURIComponent(linkId)}`,
    secretKey,
    form({
      active,
      allow_promotion_codes: false,
      "metadata[tier]": "reset",
      "metadata[career_forge_offer]": OFFER_KEY,
      "after_completion[type]": "redirect",
      "after_completion[redirect][url]": `${appUrl}/unlock?session_id={CHECKOUT_SESSION_ID}`,
      "restrictions[completed_sessions][limit]": COHORT_LIMIT
    })
  );
}

async function provisionLivePaymentLink(appUrl, secretKey) {
  const listed = await stripeRequest("/v1/payment_links?limit=100", secretKey);
  const candidates = (listed.data ?? []).filter(
    (link) => link.metadata?.career_forge_offer === OFFER_KEY && link.metadata?.tier === "reset"
  );
  let selected = null;
  for (const candidate of candidates) {
    if (!selected && (await paymentLinkHasResetPrice(candidate, secretKey))) selected = candidate;
  }

  for (const candidate of candidates) {
    if (!selected || candidate.id !== selected.id) await updatePaymentLink(candidate.id, appUrl, secretKey, false);
  }

  if (selected) {
    const updated = await updatePaymentLink(selected.id, appUrl, secretKey, true);
    if (!isPaymentLinkUrl(updated.url)) throw new Error("Stripe returned an invalid Payment Link URL.");
    return updated.url;
  }

  const product = await stripeRequest(
    "/v1/products",
    secretKey,
    form({
      name: "Career Forge — Career Reset Pack",
      description: "Founding Career Reset cohort: reviewed local-first career foundation and export pack.",
      "metadata[tier]": "reset",
      "metadata[career_forge_offer]": OFFER_KEY
    }),
    `${OFFER_KEY}-product-v1`
  );
  const price = await stripeRequest(
    "/v1/prices",
    secretKey,
    form({
      currency: "usd",
      unit_amount: RESET_PRICE_CENTS,
      product: product.id,
      "metadata[tier]": "reset",
      "metadata[career_forge_offer]": OFFER_KEY
    }),
    `${OFFER_KEY}-price-v1`
  );
  const link = await stripeRequest(
    "/v1/payment_links",
    secretKey,
    form({
      "line_items[0][price]": price.id,
      "line_items[0][quantity]": 1,
      allow_promotion_codes: false,
      submit_type: "pay",
      "metadata[tier]": "reset",
      "metadata[career_forge_offer]": OFFER_KEY,
      "after_completion[type]": "redirect",
      "after_completion[redirect][url]": `${appUrl}/unlock?session_id={CHECKOUT_SESSION_ID}`,
      "restrictions[completed_sessions][limit]": COHORT_LIMIT
    }),
    `${OFFER_KEY}-payment-link-v1`
  );
  if (!isPaymentLinkUrl(link.url)) throw new Error("Stripe returned an invalid Payment Link URL.");
  return link.url;
}

async function probeDeployment(url, target) {
  const expectedCheckoutHost = target === "production" ? "buy.stripe.com" : "checkout.stripe.com";
  if (target === "preview") {
    const vercelCurl = (requestPath, { method = "GET", body } = {}) => {
      const executable = process.platform === "win32" ? "npx.cmd" : "npx";
      const curlArgs = [
        "vercel",
        "curl",
        requestPath,
        "--deployment",
        url,
        "--yes",
        "--",
        "--silent",
        "--show-error",
        "--write-out",
        "\n%{http_code}",
        "--request",
        method
      ];
      if (body !== undefined) {
        curlArgs.push("--header", "content-type: application/json", "--data", JSON.stringify(body));
      }
      const result = spawnSync(executable, curlArgs, {
        cwd: process.cwd(),
        encoding: "utf8",
        env: process.env,
        maxBuffer: 10 * 1024 * 1024
      });
      if (result.error || result.status !== 0) throw new Error(`Protected Preview probe failed at ${requestPath}.`);
      const lines = (result.stdout ?? "").trimEnd().split("\n");
      const status = Number(lines.pop());
      return { status, body: lines.join("\n") };
    };
    const home = vercelCurl("/");
    const pricing = vercelCurl("/pricing");
    const checkout = vercelCurl("/api/checkout", { method: "POST", body: { tier: "reset" } });
    const invalidLicense = vercelCurl("/api/license?session_id=invalid");
    const checkoutBody = JSON.parse(checkout.body);
    const checkoutHost = typeof checkoutBody.url === "string" ? new URL(checkoutBody.url).hostname : null;
    if (home.status !== 200 || pricing.status !== 200 || checkout.status !== 200 || checkoutHost !== expectedCheckoutHost) {
      throw new Error("Deployment probe failed for homepage, pricing, or checkout.");
    }
    if (invalidLicense.status !== 400) throw new Error("Invalid license-session probe did not fail closed with 400.");
    return { home: 200, pricing: 200, checkout: 200, checkoutHost, invalidLicense: 400 };
  }

  let latest;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const [home, pricing, checkout, invalidLicense] = await Promise.all([
      fetch(`${url}/`),
      fetch(`${url}/pricing`),
      fetch(`${url}/api/checkout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tier: "reset" })
      }),
      fetch(`${url}/api/license?session_id=invalid`)
    ]);
    const checkoutBody = await checkout.json().catch(() => ({}));
    const checkoutHost = typeof checkoutBody.url === "string" ? new URL(checkoutBody.url).hostname : null;
    latest = { home: home.status, pricing: pricing.status, checkout: checkout.status, checkoutHost, invalidLicense: invalidLicense.status };
    if (
      latest.home === 200 &&
      latest.pricing === 200 &&
      latest.checkout === 200 &&
      latest.checkoutHost === expectedCheckoutHost &&
      latest.invalidLicense === 400
    ) {
      return latest;
    }
    if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
  throw new Error(
    `Deployment probe failed after retries (home=${latest?.home} pricing=${latest?.pricing} checkout=${latest?.checkout} host=${latest?.checkoutHost} invalid-license=${latest?.invalidLicense}).`
  );
}

async function main() {
  if (process.argv.includes("--help")) {
    usage();
    return;
  }
  const target = option("--target");
  if (target !== "preview" && target !== "production") throw new Error("--target must be preview or production.");
  const appUrl = canonicalOrigin(option("--app-url"));
  const signingKeyFile = option("--signing-key-file");
  const dryRun = process.argv.includes("--dry-run");
  const environment = target;
  const stripeInputName = target === "preview" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_LIVE_SECRET_KEY";
  const plannedVariables = [
    "STRIPE_SECRET_KEY",
    "LICENSE_SIGNING_PRIVATE_KEY",
    "NEXT_PUBLIC_LICENSE_PUBLIC_KEY",
    "NEXT_PUBLIC_COMMERCE_MODE",
    "PAID_BETA_TIER",
    "NEXT_PUBLIC_PAID_BETA_TIER",
    "NEXT_PUBLIC_APP_URL",
    ...(target === "production" ? ["STRIPE_LIVE_RESET_PAYMENT_LINK"] : [])
  ];

  if (dryRun) {
    console.log(`DRY RUN: ${target} commerce launch for ${EXPECTED_PROJECT}`);
    console.log(`Credential input: ${stripeInputName} (presence validated; value never logged)`);
    console.log(`Vercel variables: ${plannedVariables.join(", ")}`);
    console.log("Signing keys: preserve a valid existing pair or generate a new P-256 pair; reject cross-environment reuse.");
    if (target === "production") {
      console.log(`Stripe: require charges+payouts, statement descriptor, and support email; enforce $49 reset link cap=${COHORT_LIMIT}.`);
    }
    console.log(`Deploy and probe: ${appUrl}`);
    console.log("Signing-key file: absolute mode-0600 path outside the repository; delete after verified launch.");
    return;
  }

  const projectFile = path.join(process.cwd(), ".vercel", "project.json");
  if (!fs.existsSync(projectFile)) throw new Error("Run `vercel link` before launching commerce.");
  const project = JSON.parse(fs.readFileSync(projectFile, "utf8"));
  if (project.projectName !== EXPECTED_PROJECT) throw new Error(`Refusing to configure Vercel project ${project.projectName}.`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "career-forge-commerce-"));
  fs.chmodSync(tempDir, 0o700);
  try {
    const targetEnv = pullVercelEnvironment(environment, path.join(tempDir, `${environment}.env`));
    const otherEnvironment = target === "preview" ? "production" : "preview";
    const otherEnv = pullVercelEnvironment(otherEnvironment, path.join(tempDir, `${otherEnvironment}.env`));

    const stripeSecret = process.env[stripeInputName] || targetEnv.STRIPE_SECRET_KEY;
    const expectedPrefix = target === "preview" ? "sk_test_" : "sk_live_";
    if (!stripeSecret?.startsWith(expectedPrefix)) {
      throw new Error(`${stripeInputName} with the correct mode prefix is required.`);
    }

    const signingPair = loadOrCreateSigningPair(signingKeyFile);
    if (otherEnv.NEXT_PUBLIC_LICENSE_PUBLIC_KEY === signingPair.publicKey) {
      throw new Error("Preview and production license-signing keypairs must be different.");
    }

    const accountStatus = await validateStripeAccount(stripeSecret, target);
    const paymentLink = target === "production" ? await provisionLivePaymentLink(appUrl, stripeSecret) : null;
    const variables = [
      ["STRIPE_SECRET_KEY", stripeSecret, true],
      ["LICENSE_SIGNING_PRIVATE_KEY", signingPair.privateKey, true],
      ["NEXT_PUBLIC_LICENSE_PUBLIC_KEY", signingPair.publicKey, false],
      ["NEXT_PUBLIC_COMMERCE_MODE", target === "production" ? "live" : "test", false],
      ["PAID_BETA_TIER", "reset", false],
      ["NEXT_PUBLIC_PAID_BETA_TIER", "reset", false],
      ["NEXT_PUBLIC_APP_URL", appUrl, false],
      ...(paymentLink ? [["STRIPE_LIVE_RESET_PAYMENT_LINK", paymentLink, false]] : [])
    ];
    for (const [name, value, sensitive] of variables) {
      setVercelEnvironment(name, value, environment, sensitive);
    }

    const deployArgs = ["deploy", "--yes", ...(target === "production" ? ["--prod"] : [])];
    const deploymentOutput = runVercel(deployArgs, { exposeOutput: true });
    const urls = deploymentOutput.match(/https:\/\/[^\s]+\.vercel\.app/g) ?? [];
    const deploymentUrl = urls.at(-1);
    if (!deploymentUrl) throw new Error("Vercel deployment completed without a deployment URL.");
    if (target === "preview") {
      const previewAlias = new URL(appUrl).hostname;
      if (!previewAlias.endsWith(".vercel.app")) {
        throw new Error("Preview --app-url must use a vercel.app alias.");
      }
      runVercel(["alias", "set", deploymentUrl, previewAlias]);
    }
    const probe = await probeDeployment(appUrl, target);

    console.log(`Commerce launch complete: ${target}`);
    console.log(`Project: ${project.projectName}`);
    console.log(`Deployment: ${deploymentUrl}`);
    console.log(`Canonical URL: ${appUrl}`);
    console.log(`Probe: home=${probe.home} pricing=${probe.pricing} checkout=${probe.checkout} host=${probe.checkoutHost} invalid-license=${probe.invalidLicense}`);
    console.log(
      `Stripe account gates: charges=${accountStatus.chargesEnabled} payouts=${accountStatus.payoutsEnabled} descriptor=${accountStatus.statementDescriptorConfigured} support-email=${accountStatus.supportEmailConfigured}`
    );
    if (paymentLink) console.log(`Founding cohort: tier=reset amount=$49 cap=${COHORT_LIMIT} host=buy.stripe.com`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Commerce launch failed: ${error.message}`);
  process.exit(1);
});
