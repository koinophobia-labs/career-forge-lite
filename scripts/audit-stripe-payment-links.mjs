#!/usr/bin/env node

// Read-only live Stripe audit. Career Forge uses server-created Checkout
// Sessions; no public Payment Link—legacy $49 packs or the optional $149 human
// service—may remain active. URLs, customer data, and credentials are never
// printed.

const secretKey = process.env.STRIPE_LIVE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
if (!/^(?:sk|rk)_live_/.test(secretKey ?? "")) {
  console.error("Provide a restricted or secret live Stripe key through STRIPE_LIVE_SECRET_KEY.");
  process.exit(2);
}

const EXPECTED = new Map([
  ["resume", 900],
  ["job", 1_500],
  ["career", 2_500],
  ["all-access", 3_900],
]);
const CATALOG_KEY = "career-forge-self-serve-v1";

async function stripe(pathname) {
  const response = await fetch(`https://api.stripe.com${pathname}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok) throw new Error(`Stripe returned ${response.status} for ${pathname}.`);
  return response.json();
}

const products = await stripe("/v1/products?active=true&limit=100");
const catalog = [];
for (const product of products.data ?? []) {
  if (product.metadata?.career_forge_catalog !== CATALOG_KEY) continue;
  const tier = product.metadata?.tier;
  const prices = await stripe(`/v1/prices?active=true&limit=100&product=${encodeURIComponent(product.id)}`);
  const exact = (prices.data ?? []).filter(
    (price) =>
      price.type === "one_time" &&
      price.currency === "usd" &&
      price.unit_amount === EXPECTED.get(tier) &&
      price.metadata?.career_forge_catalog === CATALOG_KEY &&
      price.metadata?.tier === tier
  );
  catalog.push({ tier, exactPrices: exact.length });
}

const links = await stripe("/v1/payment_links?active=true&limit=100");
let activeCareerForgeLinks = 0;
for (const link of links.data ?? []) {
  const lineItems = await stripe(`/v1/payment_links/${encodeURIComponent(link.id)}/line_items?limit=20`);
  const productId = lineItems.data?.[0]?.price?.product;
  const product = typeof productId === "string" ? await stripe(`/v1/products/${encodeURIComponent(productId)}`) : productId;
  if (product?.name?.startsWith("Career Forge") || link.metadata?.career_forge_offer || product?.metadata?.career_forge_offer) {
    activeCareerForgeLinks += 1;
  }
}

const counts = new Map(catalog.map((entry) => [entry.tier, entry.exactPrices]));
const catalogReady = [...EXPECTED].every(([tier]) => counts.get(tier) === 1);
console.log(`Self-service catalog exact-price counts: ${[...EXPECTED].map(([tier]) => `${tier}=${counts.get(tier) ?? 0}`).join(", ")}`);
console.log(`Active Career Forge Payment Links: ${activeCareerForgeLinks}`);

if (!catalogReady || activeCareerForgeLinks !== 0) {
  console.error("NOT READY: require one exact live Price per package and zero active Career Forge Payment Links.");
  process.exit(1);
}
console.log("READY: the live catalog is exact and obsolete checkout links are closed.");
