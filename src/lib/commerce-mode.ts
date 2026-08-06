// The commerce posture, readable from BOTH server components and client
// components. It lives in its own module because entitlement.ts is a client
// module: a server page that imported getCommerceMode from there failed the
// build ("Attempted to call getCommerceMode() from the server").
//
// One source of truth matters here — the fallback below is a safety property,
// not a formatting detail. An unrecognised or misspelled value must resolve to
// "off" (no checkout, nothing gated), never to "live".

export type CommerceMode = "off" | "test" | "live";

export function getCommerceMode(): CommerceMode {
  const raw = process.env.NEXT_PUBLIC_COMMERCE_MODE;
  if (raw === "test" || raw === "live") return raw;
  return "off";
}
