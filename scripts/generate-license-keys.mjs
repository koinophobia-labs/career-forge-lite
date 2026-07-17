// Generates the ECDSA P-256 keypair that signs Career Forge license keys.
// Run once per environment (test/live must use DIFFERENT keypairs so test
// licenses never unlock production):
//
//   node scripts/generate-license-keys.mjs
//
// Store the private key ONLY in server env (Vercel project settings). The
// public key ships with the client bundle — it is not a secret.

import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });

const privateDer = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const publicDer = publicKey.export({ format: "der", type: "spki" }).toString("base64");

console.log("Add to server-side environment (SECRET — never commit, never expose to the client):\n");
console.log(`LICENSE_SIGNING_PRIVATE_KEY=${privateDer}\n`);
console.log("Add to build-time environment (public, ships in the client bundle):\n");
console.log(`NEXT_PUBLIC_LICENSE_PUBLIC_KEY=${publicDer}`);
