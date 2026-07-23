/**
 * Trust root for live-commerce authorization.
 *
 * This is the PUBLIC half of the release owner's approval key. It is safe to
 * commit and safe to ship: a public key can verify a signature but cannot
 * create one. Nothing that holds this value can authorize checkout.
 *
 * Fail-closed by construction
 * ---------------------------
 * The placeholder below is empty. While it is empty, `loadApprovalPublicKey`
 * returns null, every approval fails verification, and `canSellSafely` stays
 * false. Checkout cannot open until the owner installs the real public key that
 * corresponds to a private key held only offline.
 *
 * Installing it (owner, once)
 * ---------------------------
 *   node scripts/generate-approval-keypair.mjs
 * writes a private key to an offline 0600 file and prints the base64 SPKI public
 * key. Paste that value here, commit it, and deploy. Because this file is part
 * of the certified surface, swapping the key changes the surface hash and voids
 * any prior certification and approval — a key substitution cannot pass silently.
 *
 * This value is intentionally NOT read from an environment variable: env vars
 * are writable by anyone with Vercel access, which is one of the very surfaces
 * this boundary exists to distrust. Pinning the trust root in reviewed source
 * keeps key changes on the code-review path.
 */

export const APPROVAL_PUBLIC_KEY_SPKI_BASE64 = "";
