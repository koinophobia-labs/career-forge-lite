#!/usr/bin/env node
/**
 * Generate the release owner's live-commerce approval keypair. Run ONCE, on a
 * trusted machine, offline.
 *
 * Ed25519. The PRIVATE key is the only thing in the world that can authorize
 * checkout; it must never enter Vercel, this repository, an automation
 * environment, or any shared agent configuration. The PUBLIC key is safe to
 * publish — paste it into src/lib/server/approval-public-key.ts, commit, deploy.
 *
 *   node scripts/generate-approval-keypair.mjs --out /secure/offline/cf-approval.key
 *
 * Writes the private key (PKCS8 PEM) to --out with mode 0600 and prints the
 * base64 SPKI public key to stdout. It prints the private key nowhere.
 */

import { generateKeyPairSync } from "node:crypto";
import { writeFileSync, existsSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({ options: { out: { type: "string" } } });
const out = values.out?.trim();
if (!out) {
  console.error("REFUSED: pass --out <absolute path> for the offline private key file.");
  process.exit(2);
}
if (existsSync(out)) {
  console.error(`REFUSED: ${out} already exists. Refusing to overwrite an existing key.`);
  process.exit(2);
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519");

const privatePem = privateKey.export({ type: "pkcs8", format: "pem" });
writeFileSync(out, privatePem, { mode: 0o600 });

const publicSpkiB64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

console.log("Approval keypair generated (Ed25519).\n");
console.log(`Private key written (0600): ${out}`);
console.log("  → keep this OFFLINE. Never commit it, never put it in Vercel or any agent env.\n");
console.log("Public key — paste into src/lib/server/approval-public-key.ts, commit, deploy:\n");
console.log(publicSpkiB64);
console.log("\nChanging this key changes the certified surface hash, which voids any");
console.log("prior certification and approval. That is intended.");
