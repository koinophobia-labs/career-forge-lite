#!/usr/bin/env node

// Standalone offline minting was retired by Entitlement Revocation Pass 01.
// A CF2 token without a matching durable issuance record can never authorize,
// and creating such a record from a laptop would bypass purchase authority.

console.error(
  "REFUSED: standalone license minting is retired. " +
    "Recover a verified Stripe purchase through /api/license?session_id=... " +
    "so the existing durable entitlement identity is preserved."
);
process.exit(2);
