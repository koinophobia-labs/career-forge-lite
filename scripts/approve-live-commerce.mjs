#!/usr/bin/env node
/**
 * DISABLED — this script wrote an UNSIGNED approval document.
 *
 * On 2026-07-21 an unsigned approval was inserted into the store and opened live
 * checkout with no human signing act. The gate now requires a cryptographic
 * signature from the release owner's offline key, so an unsigned record — however
 * it is written — is rejected. Writing one here would accomplish nothing except
 * re-creating the shape that was exploited.
 *
 * To authorize checkout, sign with the offline key instead:
 *
 *   APPROVAL_DATABASE_URL=… node scripts/authorize-live-commerce.mjs \
 *     --private-key-file /secure/offline/cf-approval.key \
 *     --commit <deployed-sha> --host career-forge-lite.vercel.app \
 *     --environment production
 *
 * If you have no key yet: node scripts/generate-approval-keypair.mjs --out <path>
 */

console.error(
  [
    "",
    "✖ approve-live-commerce.mjs is disabled.",
    "",
    "  Unsigned approvals are no longer honored by the runtime.",
    "  Authorize with a signed approval instead:",
    "",
    "    APPROVAL_DATABASE_URL=… node scripts/authorize-live-commerce.mjs \\",
    "      --private-key-file /secure/offline/cf-approval.key \\",
    "      --commit <deployed-sha> --host career-forge-lite.vercel.app \\",
    "      --environment production",
    "",
  ].join("\n")
);
process.exit(2);
