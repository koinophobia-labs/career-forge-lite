#!/usr/bin/env node

// Safe, repeatable Career Forge self-service commerce packaging. This command
// provisions the four authoritative Stripe Prices, removes obsolete Career
// Forge Payment Links, configures Vercel without putting secrets in arguments,
// deploys, and proves checkout is safely open or fail-closed. Certification and
// authorization stay separate evidence-backed operator steps.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomUUID } from "node:crypto";

const EXPECTED_PROJECT = "career-forge-lite";
const CATALOG_KEY = "career-forge-self-serve-v1";
const CATALOG = [
  { tier: "resume", env: "STRIPE_PRICE_RESUME", name: "Career Forge — Resume Pack", description: "Finished PDF, DOCX, and ZIP résumé exports from reviewed career evidence.", priceCents: 900 },
  { tier: "job", env: "STRIPE_PRICE_JOB", name: "Career Forge — Job Pack", description: "One target-job résumé plus application, outreach, and interview materials.", priceCents: 1_500 },
  { tier: "career", env: "STRIPE_PRICE_CAREER", name: "Career Forge — Career Pack", description: "Résumé, LinkedIn/profile help, a tailored Job Pack, and interview preparation.", priceCents: 2_500 },
  { tier: "all-access", env: "STRIPE_PRICE_ALL_ACCESS", name: "Career Forge — 30-Day All Access", description: "Thirty days of generous paid Career Forge workflows with no automatic renewal.", priceCents: 3_900 },
];
const LEGACY_ENV_NAMES = ["STRIPE_PRICE_RESET", "PAID_BETA_TIER", "NEXT_PUBLIC_PAID_BETA_TIER", "STRIPE_LIVE_RESET_PAYMENT_LINK"];
const LEGACY_TIERS = new Set(["reset", "job-search", "career-switch"]);
const LEGACY_AMOUNTS = new Set([4_900, 7_900, 9_900, 14_900]);

function usage() {
  console.log(`Usage:
  npm run commerce:launch -- --target preview --app-url https://<preview-host> [--signing-key-file /absolute/test-license.json]
  npm run commerce:launch -- --target production --app-url https://career-forge-lite.vercel.app [--signing-key-file /absolute/live-license.json]
  npm run commerce:launch -- --dry-run --target <preview|production> --app-url <https-origin>

Required only when the selected Vercel environment has no Stripe key:
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
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("--app-url must be a clean HTTPS origin.");
  }
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
      try { value = JSON.parse(value); } catch { value = value.slice(1, -1); }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    parsed[key] = value;
  }
  return parsed;
}

function runVercel(args, { input, exposeOutput = false, allowFailure = false } = {}) {
  const executable = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(executable, ["vercel", ...args], {
    cwd: process.cwd(), encoding: "utf8", env: process.env,
    input: input === undefined ? undefined : `${input}\n`, maxBuffer: 10 * 1024 * 1024,
  });
  if (!allowFailure && (result.error || result.status !== 0)) throw new Error(`Vercel command failed: vercel ${args.join(" ")}`);
  return exposeOutput ? `${result.stdout ?? ""}\n${result.stderr ?? ""}` : "";
}

function pullVercelEnvironment(environment, filePath) {
  runVercel(["env", "pull", filePath, "--environment", environment, "--yes"]);
  fs.chmodSync(filePath, 0o600);
  return parseEnvFile(filePath);
}

function setVercelEnvironment(name, value, environment, sensitive) {
  runVercel(["env", "add", name, environment, "--force", "--yes", ...(sensitive ? [] : ["--no-sensitive"])], { input: value });
}

function removeVercelEnvironment(name, environment) {
  runVercel(["env", "rm", name, environment, "--yes"], { allowFailure: true });
}

function generateSigningPair() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  return {
    privateKey: privateKey.export({ format: "der", type: "pkcs8" }).toString("base64"),
    publicKey: publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  };
}

function validateSigningPair(privateKeyB64, publicKeyB64) {
  try {
    const privateKey = createPrivateKey({ key: Buffer.from(privateKeyB64, "base64"), format: "der", type: "pkcs8" });
    const derived = createPublicKey(privateKey).export({ format: "der", type: "spki" });
    return derived.equals(Buffer.from(publicKeyB64, "base64"));
  } catch { return false; }
}

function loadOrCreateSigningPair(filePath) {
  if (!filePath || !path.isAbsolute(filePath)) {
    throw new Error("--signing-key-file must be an absolute path outside the repository when no valid deployed pair exists.");
  }
  const resolved = path.resolve(filePath);
  if (resolved.startsWith(`${path.resolve(process.cwd())}${path.sep}`)) throw new Error("--signing-key-file must not be stored inside the repository.");
  if (fs.existsSync(resolved)) {
    const stat = fs.lstatSync(resolved);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Signing-key file must be a regular file.");
    fs.chmodSync(resolved, 0o600);
    const parsed = JSON.parse(fs.readFileSync(resolved, "utf8"));
    if (!validateSigningPair(parsed.privateKey, parsed.publicKey)) throw new Error("Signing-key file contains an invalid or mismatched pair.");
    return parsed;
  }
  const pair = generateSigningPair();
  const handle = fs.openSync(resolved, "wx", 0o600);
  try { fs.writeFileSync(handle, JSON.stringify(pair), "utf8"); } finally { fs.closeSync(handle); }
  fs.chmodSync(resolved, 0o600);
  return pair;
}

async function stripeRequest(pathname, secretKey, formBody, idempotencyKey) {
  const response = await fetch(`https://api.stripe.com${pathname}`, {
    method: formBody ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(formBody ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: formBody,
  });
  if (!response.ok) throw new Error(`Stripe request failed (${response.status}) at ${pathname}.`);
  return response.json();
}

function form(entries) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(entries)) params.set(key, String(value));
  return params;
}

async function validateStripeAccount(secretKey, target) {
  const account = await stripeRequest("/v1/account", secretKey);
  if (target === "production") {
    if (account.charges_enabled !== true || account.payouts_enabled !== true) throw new Error("Stripe live charges and payouts must both be enabled before production launch.");
    if (!account.settings?.payments?.statement_descriptor?.trim()) throw new Error("Stripe statement descriptor must be configured before production launch.");
    if (!account.business_profile?.support_email?.trim()) throw new Error("Stripe business support email must be configured before production launch.");
  }
  return {
    chargesEnabled: account.charges_enabled === true,
    payoutsEnabled: account.payouts_enabled === true,
    statementDescriptorConfigured: Boolean(account.settings?.payments?.statement_descriptor?.trim()),
    supportEmailConfigured: Boolean(account.business_profile?.support_email?.trim()),
  };
}

async function provisionCatalog(secretKey) {
  const listedProducts = await stripeRequest("/v1/products?active=true&limit=100", secretKey);
  const priceIds = {};
  for (const item of CATALOG) {
    let product = (listedProducts.data ?? []).find((candidate) => candidate.metadata?.career_forge_catalog === CATALOG_KEY && candidate.metadata?.tier === item.tier);
    if (!product) {
      product = await stripeRequest("/v1/products", secretKey, form({ name: item.name, description: item.description, "metadata[tier]": item.tier, "metadata[career_forge_catalog]": CATALOG_KEY }), `${CATALOG_KEY}/${item.tier}/product`);
    }
    const listedPrices = await stripeRequest(`/v1/prices?active=true&limit=100&product=${encodeURIComponent(product.id)}`, secretKey);
    let price = (listedPrices.data ?? []).find((candidate) => candidate.type === "one_time" && candidate.currency === "usd" && candidate.unit_amount === item.priceCents && candidate.metadata?.career_forge_catalog === CATALOG_KEY && candidate.metadata?.tier === item.tier);
    if (!price) {
      price = await stripeRequest("/v1/prices", secretKey, form({ currency: "usd", unit_amount: item.priceCents, product: product.id, "metadata[tier]": item.tier, "metadata[career_forge_catalog]": CATALOG_KEY }), `${CATALOG_KEY}/${item.tier}/price/${item.priceCents}`);
    }
    for (const candidate of listedPrices.data ?? []) {
      if (
        candidate.id !== price.id &&
        candidate.metadata?.career_forge_catalog === CATALOG_KEY &&
        candidate.metadata?.tier === item.tier
      ) {
        await stripeRequest(`/v1/prices/${encodeURIComponent(candidate.id)}`, secretKey, form({ active: false }));
      }
    }
    priceIds[item.env] = price.id;
  }
  return priceIds;
}

async function retireLegacyCareerForgeLinks(secretKey) {
  const listed = await stripeRequest("/v1/payment_links?active=true&limit=100", secretKey);
  let retired = 0;
  for (const link of listed.data ?? []) {
    const lineItems = await stripeRequest(`/v1/payment_links/${encodeURIComponent(link.id)}/line_items?limit=20`, secretKey);
    const first = lineItems.data?.[0];
    const productId = typeof first?.price?.product === "string" ? first.price.product : first?.price?.product?.id;
    const product = productId ? await stripeRequest(`/v1/products/${encodeURIComponent(productId)}`, secretKey) : null;
    const belongsToCareerForge = product?.name?.startsWith("Career Forge") || Boolean(link.metadata?.career_forge_offer) || Boolean(product?.metadata?.career_forge_offer);
    const legacy = LEGACY_TIERS.has(link.metadata?.tier) || LEGACY_TIERS.has(product?.metadata?.tier) || LEGACY_AMOUNTS.has(first?.price?.unit_amount);
    if (belongsToCareerForge && legacy) {
      await stripeRequest(`/v1/payment_links/${encodeURIComponent(link.id)}`, secretKey, form({ active: false }));
      retired += 1;
    }
  }
  return retired;
}

async function probeDeployment(url, target) {
  const fetchPage = async (pathname, init) => {
    if (target !== "preview") return fetch(`${url}${pathname}`, init);
    const executable = process.platform === "win32" ? "npx.cmd" : "npx";
    const args = ["vercel", "curl", pathname, "--deployment", url, "--yes", "--", "--silent", "--show-error", "--write-out", "\n%{http_code}"];
    if (init?.method) args.push("--request", init.method);
    if (init?.body) args.push("--header", "content-type: application/json", "--data", init.body);
    const result = spawnSync(executable, args, { cwd: process.cwd(), encoding: "utf8", env: process.env });
    if (result.error || result.status !== 0) throw new Error(`Protected Preview probe failed at ${pathname}.`);
    const lines = (result.stdout ?? "").trimEnd().split("\n");
    const status = Number(lines.pop());
    return { status, json: async () => JSON.parse(lines.join("\n") || "{}") };
  };

  const [home, pricing, health, diagnostic] = await Promise.all([
    fetchPage("/"), fetchPage("/pricing"), fetchPage("/api/commerce-health"), fetchPage("/api/internal/commerce-certification"),
  ]);
  if (home.status !== 200 || pricing.status !== 200 || health.status !== 200) throw new Error("Deployment probe failed for homepage, pricing, or commerce health.");
  if (target === "production" && diagnostic.status !== 404) throw new Error("The temporary commerce-certification route is exposed in production.");
  const healthBody = await health.json();
  const checkoutStatuses = {};
  for (const item of CATALOG) {
    const response = await fetchPage("/api/checkout", { method: "POST", body: JSON.stringify({ tier: item.tier, requestId: `release_${randomUUID().replaceAll("-", "")}` }) });
    const body = await response.json();
    const host = typeof body.url === "string" ? new URL(body.url).hostname : null;
    const safelyClosed = response.status === 503 && healthBody.canSellSafely !== true;
    const safelyOpen = response.status === 200 && host === "checkout.stripe.com" && (target !== "production" || healthBody.canSellSafely === true);
    if (!safelyClosed && !safelyOpen) throw new Error(`Checkout probe failed for ${item.tier}.`);
    checkoutStatuses[item.tier] = response.status;
  }
  return { health: healthBody, checkoutStatuses, diagnostic: diagnostic.status };
}

async function main() {
  if (process.argv.includes("--help")) return usage();
  const target = option("--target");
  if (target !== "preview" && target !== "production") throw new Error("--target must be preview or production.");
  const appUrl = canonicalOrigin(option("--app-url"));
  const signingKeyFile = option("--signing-key-file");
  const environment = target;
  const dryRun = process.argv.includes("--dry-run");
  const stripeInputName = target === "preview" ? "STRIPE_TEST_SECRET_KEY" : "STRIPE_LIVE_SECRET_KEY";
  const plannedVariables = ["STRIPE_SECRET_KEY", ...CATALOG.map((item) => item.env), "LICENSE_SIGNING_PRIVATE_KEY", "NEXT_PUBLIC_LICENSE_PUBLIC_KEY", "NEXT_PUBLIC_COMMERCE_MODE", "NEXT_PUBLIC_APP_URL"];

  if (dryRun) {
    console.log(`DRY RUN: ${target} self-service commerce packaging for ${EXPECTED_PROJECT}`);
    console.log(`Credential input: deployed STRIPE_SECRET_KEY or ${stripeInputName} (value never logged)`);
    console.log(`Stripe catalog: ${CATALOG.map((item) => `${item.tier}=$${item.priceCents / 100}`).join(", ")}`);
    console.log(`Vercel variables: ${plannedVariables.join(", ")}`);
    console.log(`Retire obsolete Career Forge links and variables: ${LEGACY_ENV_NAMES.join(", ")}`);
    console.log("Signing keys: preserve the deployed pair or create a mode-0600 pair outside the repository.");
    console.log(`Deploy and fail-closed probe: ${appUrl}; certification and live authorization remain separate.`);
    return;
  }

  const projectFile = path.join(process.cwd(), ".vercel", "project.json");
  if (!fs.existsSync(projectFile)) throw new Error("Run `vercel link` before packaging commerce.");
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
    if (!stripeSecret?.startsWith(expectedPrefix)) throw new Error(`${stripeInputName} with the correct mode prefix is required.`);

    const deployedPair = { privateKey: targetEnv.LICENSE_SIGNING_PRIVATE_KEY, publicKey: targetEnv.NEXT_PUBLIC_LICENSE_PUBLIC_KEY };
    const signingPair = validateSigningPair(deployedPair.privateKey, deployedPair.publicKey) ? deployedPair : loadOrCreateSigningPair(signingKeyFile);
    if (otherEnv.NEXT_PUBLIC_LICENSE_PUBLIC_KEY === signingPair.publicKey) throw new Error("Preview and production license-signing keypairs must be different.");

    const accountStatus = await validateStripeAccount(stripeSecret, target);
    const priceIds = await provisionCatalog(stripeSecret);
    const retiredLinks = await retireLegacyCareerForgeLinks(stripeSecret);
    const variables = [
      ["STRIPE_SECRET_KEY", stripeSecret, true],
      ...CATALOG.map((item) => [item.env, priceIds[item.env], false]),
      ["LICENSE_SIGNING_PRIVATE_KEY", signingPair.privateKey, true],
      ["NEXT_PUBLIC_LICENSE_PUBLIC_KEY", signingPair.publicKey, false],
      ["NEXT_PUBLIC_COMMERCE_MODE", target === "production" ? "live" : "test", false],
      ["NEXT_PUBLIC_APP_URL", appUrl, false],
    ];
    for (const [name, value, sensitive] of variables) setVercelEnvironment(name, value, environment, sensitive);
    for (const name of LEGACY_ENV_NAMES) removeVercelEnvironment(name, environment);

    const deploymentOutput = runVercel(["deploy", "--yes", ...(target === "production" ? ["--prod"] : [])], { exposeOutput: true });
    const deploymentUrl = (deploymentOutput.match(/https:\/\/[^\s]+\.vercel\.app/g) ?? []).at(-1);
    if (!deploymentUrl) throw new Error("Vercel deployment completed without a deployment URL.");
    if (target === "preview") {
      const previewAlias = new URL(appUrl).hostname;
      if (!previewAlias.endsWith(".vercel.app")) throw new Error("Preview --app-url must use a vercel.app alias.");
      runVercel(["alias", "set", deploymentUrl, previewAlias]);
    }
    const probe = await probeDeployment(appUrl, target);

    console.log(`Commerce packaging complete: ${target}`);
    console.log(`Project: ${project.projectName}`);
    console.log(`Deployment: ${deploymentUrl}`);
    console.log(`Catalog: ${CATALOG.map((item) => `${item.tier}=$${item.priceCents / 100}`).join(", ")}`);
    console.log(`Retired obsolete Career Forge links: ${retiredLinks}`);
    console.log(`Checkout statuses: ${JSON.stringify(probe.checkoutStatuses)}`);
    console.log(`Commerce ready: ${probe.health.canSellSafely === true}; certification route: ${probe.diagnostic}`);
    console.log(`Stripe account gates: charges=${accountStatus.chargesEnabled} payouts=${accountStatus.payoutsEnabled} descriptor=${accountStatus.statementDescriptorConfigured} support-email=${accountStatus.supportEmailConfigured}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Commerce packaging failed: ${error.message}`);
  process.exit(1);
});
