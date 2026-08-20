#!/usr/bin/env node

// Read-only release audit for live Stripe Payment Links. It intentionally
// prints no secret keys, customer data, or shareable Payment Link URLs.

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey || !/^(?:sk|rk)_live_/.test(secretKey)) {
  console.error("REFUSED: run with the production STRIPE_SECRET_KEY in the process environment.");
  process.exit(2);
}

const authorization = `Basic ${Buffer.from(`${secretKey}:`, "utf8").toString("base64")}`;
const links = [];
let startingAfter = null;

do {
  const query = new URLSearchParams({ active: "true", limit: "100" });
  query.append("expand[]", "data.line_items.data.price.product");
  if (startingAfter) query.set("starting_after", startingAfter);
  const response = await fetch(`https://api.stripe.com/v1/payment_links?${query}`, {
    headers: { Authorization: authorization }
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data) {
    console.error(`Stripe Payment Link audit failed (${response.status}).`);
    process.exit(1);
  }
  links.push(...body.data);
  startingAfter = body.has_more && body.data.length > 0 ? body.data.at(-1).id : null;
} while (startingAfter);

function lineItemSummary(link) {
  const items = link.line_items?.data ?? [];
  const amounts = items.map((item) => Number(item.price?.unit_amount ?? 0) * Number(item.quantity ?? 1));
  const currencies = [...new Set(items.map((item) => item.price?.currency).filter(Boolean))];
  const names = items.map((item) => {
    const product = item.price?.product;
    return typeof product === "object" && product?.name ? product.name : "unnamed product";
  });
  return {
    amount: amounts.reduce((sum, amount) => sum + amount, 0),
    currency: currencies.length === 1 ? currencies[0] : currencies.join(",") || "unknown",
    names
  };
}

const summaries = links.map((link) => {
  const items = lineItemSummary(link);
  return {
    id: link.id,
    active: link.active === true,
    livemode: link.livemode === true,
    amount: items.amount,
    currency: items.currency,
    products: items.names,
    offer: link.metadata?.career_forge_offer ?? null,
    tier: link.metadata?.tier ?? null
  };
});

console.log(`Active live Stripe Payment Links: ${summaries.length}`);
for (const summary of summaries) {
  const money = summary.currency === "usd" ? `$${(summary.amount / 100).toFixed(2)}` : `${summary.amount} ${summary.currency}`;
  console.log(`- ${summary.id}: ${money}; ${summary.products.join(" + ")}; offer=${summary.offer ?? "none"}; tier=${summary.tier ?? "none"}`);
}

const legacyPackLinks = summaries.filter((link) => link.amount === 4900 || link.offer === "career_reset_founding_beta");
const reviewedServiceLinks = summaries.filter((link) => link.amount === 14900);
console.log(`Legacy $49 links active: ${legacyPackLinks.length}`);
console.log(`$149 reviewed-service links active: ${reviewedServiceLinks.length}`);

if (process.argv.includes("--require-release-posture")) {
  if (legacyPackLinks.length > 0 || reviewedServiceLinks.length !== 1) {
    console.error("NOT READY: require zero active legacy $49 links and exactly one active $149 service link.");
    process.exit(1);
  }
  console.log("READY: Stripe Payment Links match the manual-service release posture.");
}
