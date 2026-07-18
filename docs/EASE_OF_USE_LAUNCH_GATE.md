# Ease-of-Use Launch Gate

**Current audited ease of use: 7.5 / 10.**
**Required launch-standard ease of use: 10 / 10.**

The score is not being revised upward — the product is being revised until an audit
honestly supports 10. Changing the number without changing the product would weaken the
report's credibility. Ease of use at 10/10 is a product requirement, not a decorative
score painted over unfinished edges.

## Verdict

Career Forge is ready for a **controlled beta**, but ease of use is not yet at the
required 10/10 standard. The product should not be considered broadly launch-ready until
a first-time user can move from résumé import to a trusted, exported Career Pack without
confusion, repeated entry, hidden states, or founder assistance.

## The 10/10 launch gate

A 10/10 experience means all ten of the following hold. Status is the current honest
assessment with the evidence that supports it — "Met (mechanical)" means automated
verification passes; only the north-star human test can upgrade any row to "Met".

| # | Criterion | Status | Evidence / gap |
| --- | --- | --- | --- |
| 1 | A user immediately understands what Career Forge will produce | Partial | Landing explains the category difference and the explorable sample pack shows evidence→variant logic (`SampleExperience`), but there is no rendered example résumé document visible before import. Gap: show a real (synthetic) finished PDF preview pre-import. |
| 2 | Import eliminates most manual entry | Partial | PDF/DOCX/TXT import runs fully in-browser and produces structured, groupable proposals (`acceptance:journey` proves import→approval with no re-typing of the source). Gap: imported roles still need confirmation in the role form for forge-readiness in some paths; measure real minutes-to-ready in the pilot. |
| 3 | Evidence approval feels fast rather than administrative | Partial | Section-level bulk approve + Finish review exists and is exercised in acceptance. Gap: "fast vs administrative" is a felt quality only the five-user test can score. |
| 4 | Progress and saving are always visible | Met (mechanical) | Five-step `ActivationPath` with the current next action on the dashboard and key pages; NEW `SaveStatusPill` in the global nav shows "✓ Saved on this device · time" on every page, flipping to a red back-up-now path if a write ever fails (`SaveHealthBanner` covers quota loss). Verified in `acceptance:journey`. |
| 5 | Every screen has one obvious next action | Partial | ActivationPath names the next action; each core page leads with a primary CTA. Gap: not yet audited screen-by-screen for competing CTAs; pilot observation required. |
| 6 | Users can edit outputs without breaking consistency | Met (mechanical) | Full-document editor with provenance re-check (`needs-review` status), undo, revision-aware multi-tab conflict dialogs, and export-boundary re-sanitization (`acceptance:conflict`, 13 checks). |
| 7 | Mobile use introduces no meaningful friction | Partial | 15-route keyboard/scroll-region audit at 390×844 passes with no page overflow (`acceptance:mobile-a11y`). Gap: mobile ENTRY effort (typing into intake forms on a phone) has not been human-tested. |
| 8 | Payment and entitlement work without explanation | Met (mechanical) | With commerce in test mode: export is gated by a priced unlock pill (never a dead button), pasting the purchase-issued key on /unlock activates first-try with clear confirmation, and entitlement survives reload (`acceptance:journey`). Gap: real Stripe checkout has only been exercised to the license boundary, not through a live card flow. |
| 9 | Export succeeds on the first attempt | Met (mechanical) | `acceptance:journey` performs the full ZIP export on the first click after unlock; rendered-export stress (`test:render`, 176 checks) covers document quality across 10 personas. |
| 10 | A first-time user completes the full journey without outside help | Not yet demonstrable | The automated journey passes end to end, but this criterion is DEFINED by unassisted human completion. Only the north-star test below can close it. |

## What must still be built or proven (friction backlog)

1. **Reduce heavy intake typing further** — pre-import rendered example, smarter defaults
   from imported evidence into the role/project forms, inline examples on every free-text
   field.
2. **Pre-purchase visibility into actual output quality** — a rendered synthetic PDF
   viewable before any data entry (the sample pack describes it; it should show it).
3. **Skip / defer / return without penalty** — guided intake already allows sparse
   completion (sparse-evidence persona exports cleanly), but nonessential fields should
   say "optional — skip for now" explicitly.
4. **Mobile entry effort** — human-tested, not just audited.
5. **Generation confidence** — forge now shows an immediate "Forging your pack…" working
   state and lands on an explicit "ready" confirmation; long-tail devices should be
   pilot-observed.

## North-star beta test (the only thing that closes criterion 10 — and the gate)

> **Five out of five first-time users complete the full journey — résumé import to
> exported Career Pack — without assistance, and each rates ease of use 9 or 10.**

Protocol: run inside the founding-user pilot (`docs/FOUNDING_USER_PILOT.md`), observed
but unassisted; any founder intervention marks the session failed. Record time-to-export
and the per-step stall points from the consent-based pilot summary. Until this test
passes, the public claim remains: **ease of use 7.5/10, target 10/10** — and broad
launch stays gated.

---

## Closure checks (pre-freeze record)

Scope is frozen once all four pass. Product changes after the freeze require an observed
pilot user breaking a gate criterion.

### 1. Manual commerce smoke test — PENDING (founder ritual, blocked on Stripe test key)

The headless suite exercises checkout to its product boundary (the issued license) —
`acceptance:journey`, 9/9. The hosted Stripe test-mode checkout requires
`STRIPE_SECRET_KEY` (sk_test_…), which is not present in any environment available to
automation. **Five-minute ritual, record the result here:**

1. Set `NEXT_PUBLIC_COMMERCE_MODE=test` + Stripe test keys, open /pricing, buy any tier
   with card 4242 4242 4242 4242.
2. Checkout completes → /unlock shows the license → it activates on the FIRST attempt.
3. Refresh, then quit and reopen the browser → entitlement survives both.
4. /versions → "Export complete pack" → ZIP downloads on the FIRST click.
5. Open the ZIP: PDFs open, DOCX opens, README/LinkedIn text files read correctly.

| Date | Commit | Browser | Device | Result |
| --- | --- | --- | --- | --- |
| _(pending)_ | | | | |

### 2. Backup and recovery — PASSED 2026-07-17

`npm run acceptance:recovery` (11/11, log at
`docs/evidence/paid-beta-surge/clean-checkout/recovery-run.log`): dossier with approved
AND rejected evidence → forge → license → export → backup → **all site data destroyed** →
app honestly empty → restore (with contents preview + explicit confirmation) → approved
7 / rejected 1 / lanes / packs / versions restored exactly → entitlement behaves as
intended (license deliberately not in the backup; re-pasting the saved key re-unlocks;
export succeeds first-click) → the "Save failed — back up now" warning was fired and its
action lands directly on a working backup button. The warning does not point into fog.

### 3. Journey test on the release path — DONE 2026-07-17

`acceptance:journey` and `acceptance:recovery` are now **required steps in the CI quality
gate** (`.github/workflows/quality-gate.yml`) on every pull request, with their outputs
uploaded as the `journey-and-recovery-results` artifact. Local reference runs are
committed at `docs/evidence/paid-beta-surge/clean-checkout/journey-run.log` and
`recovery-run.log`. The 9/9 result is reproducible, not folklore.

### 4. Device and accessibility sweep — PASSED 2026-07-17 (engine-level)

`node scripts/device-sweep-browser.mjs`, 23/23: WebKit + iPhone 13 profile (closest
headless stand-in for iPhone Safari), Chromium + Pixel 7 profile (Android Chrome),
desktop keyboard-only (skip link first, Enter into main, visible focus on 10/10 sampled
stops), 200%-zoom-equivalent viewport with no overflow on the four journey routes, save
pill announced as `role=status`, export confirmation announced via
`role=status aria-live=polite`. The sweep caught and fixed one real defect: the lane-card
control row overflowed the page by 4px on WebKit at iPhone width (native `<select>`
renders wider there) — now wraps. **Physical iPhone Safari and Android Chrome passes
belong to the founder's release ritual alongside check 1.**

## Freeze declaration

As of the tagged beta release, scope is frozen: no analytics additions, sharing, team
features, new templates, or speculative polish. The known-friction list above stands.
The five-user pilot runs against the frozen tag. The product changes only when observed
user behavior breaks a gate criterion — the pilot is the reason to leave the code alone.
