# Career Forge self-serve monetization assessment

Date: 2026-08-20

## Current product state

Career Forge is a production-stable, local-first career workspace with a useful free journey, reviewed-evidence safeguards, browser-side document generation, PDF/DOCX/ZIP exports, and extensive regression coverage. Its commerce foundation is unusually strong for this stage: Stripe Checkout Sessions are created server-side, paid sessions are re-read from Stripe, tiers are derived from authoritative Price IDs, signed entitlements cannot be upgraded by editing browser state, webhook fulfillment is durable and idempotent, and live checkout fails closed until delivery is certified and explicitly authorized.

The remaining problem is product packaging rather than a missing payments architecture. The deployed product still presents a free beta plus a prominent $149 human service, while the dormant automated catalog is the obsolete $49/$79/$99 package model and live checkout is intentionally restricted to its entry tier.

## Five highest-impact problems

1. **The offer does not match the product direction.** The primary pricing path sells free self-service versus a $149 human rebuild instead of an accessible self-service value ladder.
2. **The automated catalog and Stripe mapping are obsolete.** Package IDs, environment variables, checkout restrictions, certification tooling, and documentation still assume the old `reset`, `job-search`, and `career-switch` tiers.
3. **Entitlements cannot represent the new ownership model.** The browser stores one perpetual license, so activating another purchase replaces the first and there is no trustworthy 30-day expiry for All Access.
4. **Package boundaries are only partially explicit.** Existing gates cover résumé export, job tailoring, outreach, interview depth, and lane counts, but the copy does not clearly explain the useful free baseline, paid outcomes, or whether limits are per-use, permanent, or time-bound.
5. **Release evidence is tied to the old offer.** Regression tests, readiness requirements, the commerce fingerprint, environment examples, and runbooks assert legacy prices and the former $149-first positioning.

## Work to complete

- Replace the primary catalog with Free, $9 Resume Pack, $15 Job Pack, $25 Career Pack, and $39 30-Day All Access.
- Keep free data import, evidence review, editing, previews, and job-search organization genuinely useful.
- Make each paid package describe its outcome, included features, limits, persistence, and post-purchase activation in plain language.
- Map all four paid packages to server-only Stripe Price IDs; remove legacy live-tier restrictions and fail closed if any advertised package cannot be fulfilled.
- Upgrade signed entitlements to support multiple purchases and a server-minted 30-day expiration while continuing to accept valid legacy keys.
- Preserve durable webhook delivery, short-code recovery, price-derived fulfillment, idempotency, and the human authorization gate.
- Replace legacy monetization tests and release documentation, then verify test Stripe purchases before any live authorization.

## Intentionally left alone

- The local-first career-data model and no-account product posture.
- The import, dossier, evidence-review, résumé-generation, job-analysis, application, outreach, interview, backup, and export architecture.
- Existing visual language and primary navigation.
- The durable fulfillment store, redemption-code delivery, reconciliation model, and fail-closed certification gate except where new package IDs must be added.
- The secondary human-service page may remain reachable only if it no longer competes with the self-service pricing funnel; it will not be a primary upgrade path.
