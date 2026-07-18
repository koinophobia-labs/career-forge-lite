# Fable 5 Paid Beta Surge — close every release blocker with verified evidence

Commerce stays **off by default**. No price is declared validated. No acceptance bar was weakened to obtain a green check.

## Audit-blocker → fix matrix

| # | Blocker (from the charter) | Root cause | Fix | Commit |
| --- | --- | --- | --- | --- |
| 1 | Fresh two-lane ATS `linkedinSummary` loses its evidence reference | Generated "Targeting {lane}." prefix collided with the sanitizer's user-preference classifier, so reconciliation dropped the reference | Removed the redundant prefix; 227-check provenance-completeness regression across every lane pairing | `0d5f70e` |
| 2 | Migration leaves context-only text in derived metadata | (a) narrow termination vocabulary; (b) numeric-comma clause mangling; (c) LINE-level headline sanitization let "Role. Target roles: X" through into variants, pack materials, saved versions, and the ZIP | Widened separation vocabulary (+"before" conjunction), thousands-separator-safe clause splitting, sentence-level headline sanitization; full-surface migration sweep incl. rendered PDF/DOCX/ZIP | `54e4a70`, `287becf`, `f89646d` |
| 3 | Clean-checkout suite not reproducible; private fixture absent | Fixture was git-ignored but had also been committed once; no deterministic generator | `git rm --cached` + deterministic synthetic fixture generator; `acceptance:private` passes from an empty fixtures dir | `10e9a8d` |
| 4 | Outreach can leave `[specific reason]` with no copy block | Already implemented in the product | Verified end to end from the real clipboard for all 6 scenarios; sendable examples preserved | `1b164b0` |
| 5 | Project-only candidates flattened into fake employer rows | Generator emitted "Independent project" employer labels; and `reviveResumeSnapshot()` silently DROPPED the new `kind` field on every localStorage load (why unit tests were green while the live UI was wrong) | True project semantics end to end: `kind` tagging, separate Projects/Selected Projects sections in viewer + PDF/DOCX/plain-text, revive-path fix + `parseState` regression | `f2c5fff` |
| 6 | Interview prep invites fabricated stories from thin evidence | Thin claims and self-reported strengths routed to behavioral | Story-substance gate; thin/self-reported material becomes a clearly labeled "Needs more evidence" discovery prompt, never a rehearsal question | `f0eab1f`, verified live in `1b164b0` |
| 7 | Same-field two-tab edits silently last-write-win | Uncontrolled editor drafts committed on blur against possibly-stale state | Base-capture at focus + freshest-storage comparison at commit + explicit Keep mine / Keep stored / Merge dialog; commits rebase on freshest pack; two-REAL-tab acceptance incl. refresh recovery | `c225297` |
| 8 | Mobile horizontal content not keyboard accessible | /unlock license key block was focusable-nowhere; needed a full audit | 15-route sweep at 390×844 fails on any unnamed/unfocusable scroll region; keyboard-only trace with screenshots; /unlock fixed | `2027a61` |
| 9 | PDF/DOCX rendering insufficiently stressed | Text-only assertions can't see layout | Rendered-geometry regression (clipping, collisions, orphan headings, blank pages, pagination, selectable text) + rasterized page PNGs + DOCX structural/rendered checks across 10 stress personas; caught the "Resolved 4" numeric-comma bug on sight | `287becf` |
| 10 | $49/$79/$99 remain hypotheses | Cannot be closed by internal tests, by definition | Founding-user pilot protocol with an explicit 8-criterion human-evidence bar, consent-gated no-content pilot summary export, blinded recruiter packet generator; $149 human-reviewed bridge shipped separately | `34c971d` |
| — | Flaky "bit-flipped signature" test | Mutating trailing base64url characters can change only ignored padding bits (proven: 10/3000 byte-identical) | Flip a real decoded signature bit; 30 consecutive clean runs | `d570d8a` |

## Commits (oldest first)

`0d5f70e` provenance fix · `10e9a8d` release-suite integrity · `f0eab1f` interview discovery · `f2c5fff` project semantics · `54e4a70` termination vocabulary · `287becf` rendered stress + comma fix · `d570d8a` deterministic signature test · `c225297` tab conflicts · `2027a61` mobile a11y · `1b164b0` outreach/interview proof · `f89646d` migration sweep + headline leak · `34c971d` pilot + $149 bridge

## Evidence (all under `docs/evidence/paid-beta-surge/`)

- **export-stress/** — 10 personas × (PDF + DOCX + rasterized page PNGs + extracted text), incl. project-only, two-page, three-page, long-name, career-changer
- **browser-traces/** — project-only saved-version + pack dashboard screenshots (state created through the real UI)
- **migration-trace/** — contaminated state before/after JSON + decontaminated plain-text/PDF/DOCX exports
- **outreach-examples/** — six sendable messages copied from the real clipboard (recruiter, hiring manager, referral, informational, follow-up, post-interview thank-you)
- **interview-examples/** — generated prep plan showing grounded behavioral vs labeled discovery
- **mobile-a11y/** — keyboard-only focus + arrow-scroll screenshots at 390×844

Browser traces run live in the acceptance suite: fresh two-lane export (`acceptance:browser`), two-tab conflict (`acceptance:conflict`), mobile keyboard (`acceptance:mobile-a11y`), outreach/interview (`acceptance:outreach-interview`).

## Clean-checkout verification — run twice from fresh clones

Both runs: fresh `git clone`, then `npm ci`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:usability`, `npm run test:render`, `npm run acceptance:private`, `npm run acceptance:browser`, `npm run acceptance:activation`, `npm run acceptance:conflict`, `npm run acceptance:mobile-a11y`, `npm run acceptance:outreach-interview`, `npm run playtest:adversarial`, `npm run playtest:cold`. **Every command exited 0 in both runs.**

Test counts (test:unit alone): 931 PASS lines across 21 suites — intent-router 18, command-center 42, interview-prep 67, input-guidance 42, tailor-handoff 29, tailored-resume 25, version-management 22, resume-export 26, backup 31, weekly-review 34, follow-up-log 16, dossier-pack 44, truth-workflow 94, provenance-completeness 227, usability-hotfix 36, migration-coverage 24, pilot-metrics 8, durability 17, entitlement 39, activation 22, market-moat 68, quality-suite 97/100 score. Plus rendered-export 176, conflict-browser 13, mobile-a11y 20, outreach-interview 37.

## Remaining risks (candid)

1. **Pricing is still a hypothesis.** Nothing in this PR validates $49/$79/$99 — the pilot protocol defines what would. Do not quote prices as supported.
2. **The termination/preference classifiers are pattern-based.** The vocabulary was widened and false-positive-tested, but novel phrasings ("we parted ways after the acquisition") can still slip through; the export-boundary re-sanitization is the backstop, not a guarantee.
3. **Conflict handling covers the full-document editor** (the highest-value user-authored edits). Other commit-on-change surfaces (profile identity, application notes) converge live across tabs via controlled inputs and store rebase, but do not get the explicit dialog.
4. **Rendered DOCX checks are structural + mammoth-rendered**, not Word-pixel-identical; true Word rendering was not exercised (no Word automation available headlessly).
5. **quality-regression-suite scores 97/100** with 10 known "weak outputs" (thin bullets for sparse personas) — tracked, not hidden.
6. **The $149 service email (hello@koinophobia.dev)** must be monitored; fulfillment is manual by design.

## Rollback

Every change is on `feature/paid-beta-surge`; revert the merge commit to restore `main` (`7fc203f`). No data migrations are destructive: the evidence-admissibility sanitizer only removes inadmissible content from DERIVED surfaces at read time and flags packs `needs-review`; user evidence records and edits are preserved, and reverting the code restores prior rendering without data loss. localStorage schema is unchanged (`kind` is an optional additive field older code ignores).
