# Career Forge Revenue Readiness Gauntlet

> Historical evidence for the former $149-first manual-service posture. The
> current self-service revenue release is governed by `docs/PAYMENTS.md`.

Last run: August 20, 2026

Candidate branch: `codex/career-forge-polish`

Application commits: `88859ca`, `4a8d93f`

## Verdict

- **Controlled free-beta release:** READY
- **Paid users:** NOT READY

The application candidate is buildable, testable, and safe to release with
automated commerce off. Paid-user readiness is withheld until the remaining
live-account and human-fulfillment gates below are proven.

## Proven

- The connected Gmail profile address exactly matches the public $149 service
  inquiry address. No message was sent or mailbox state changed during the check.
- A temporary Stripe **test-mode** Payment Link was created for exactly $149.
- The hosted Stripe checkout was completed with synthetic customer and card data.
- Stripe reported the resulting Checkout Session as `complete`, `paid`, and
  `livemode: false`.
- The temporary test Payment Link, price, and product were deactivated after the
  drill. The preview-only operator route was removed; the clean preview returns
  `404` for both temporary diagnostic paths.
- A direct valid package request against the clean preview returns
  `403 commerce_off`; hiding the buy button is not the only checkout control.
- The old `/founding-beta` URL redirects to current pricing.
- The hosted offer states that the complete self-serve workflow is free during
  beta and presents the $149 service as optional, human-reviewed, capacity-limited,
  and inquiry-first.
- PDF, DOCX, and ZIP exports were independently downloaded and verified by the
  browser export suite.
- The first-time-user, backup/restore, desktop/mobile, private-fixture, unit,
  fulfillment-safety, revenue-readiness, lint, typecheck, and production-build
  gates passed for the candidate.

## Release gates still open

1. **Publish and promote the exact candidate.** The commits remain local until an
   operator explicitly authorizes a Git push. Production promotion also requires
   an explicit operator decision. Vercel Production is configured with
   `NEXT_PUBLIC_COMMERCE_MODE=off` for its next build, but the currently served
   artifact does not change until deployment.
2. **Audit live Payment Links.** Preview and local environments do not expose a
   usable live Stripe credential. An authenticated live-account audit must prove
   zero active legacy $49 links and exactly one active $149 reviewed-service link
   whose completed-session limit is `1`.
3. **Complete one real fulfillment cycle.** Record only operational facts for one
   controlled founding client: inquiry, capacity acceptance, scope confirmation,
   payment, delivery date, reviewed PDF/DOCX, headline, target-role directions,
   walkthrough, revision close, refund state, and file-deletion date. Do not put
   résumé content or personal data in this repository.

## Evidence summary

| Gate | Result |
| --- | --- |
| Revenue posture regression | 23 passed, 0 failed |
| Commerce launch regression | 35 passed, 0 failed |
| Fulfillment safety regression | 149 passed, 0 failed |
| Export browser verification | 19 passed, 0 failed |
| First-time-user journey | 11 passed, 0 failed |
| Backup and recovery journey | 12 passed, 0 failed |
| Private workflow fixture | 15 passed, 0 failed |
| Vercel clean build | 28 routes, READY |
| Direct checkout probe in `off` mode | HTTP 403, `commerce_off` |
| Temporary diagnostic routes after cleanup | HTTP 404 |
| $149 Stripe test payment | `complete`, `paid`, `livemode: false` |
| Live Stripe Payment Link inventory | Not authenticated; gate remains open |

## Preview handling

Use the latest protected Vercel preview created from this branch and record its
immutable deployment URL in the release handoff. A preview is a review artifact,
not production authorization. Do not promote a different commit or re-enable
automated Career Pack commerce under this report.
