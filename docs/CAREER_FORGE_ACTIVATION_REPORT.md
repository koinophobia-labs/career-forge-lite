# Improve Career Forge first-run activation

## Outcome

This branch turns the merged truth workflow into an import-first activation experience. A fresh user now sees the input, transformation, output, privacy model, and primary action in the first viewport; follows a durable five-stage path derived from canonical local state; understands what approved evidence unlocks; sees dossier-specific evidence on lane cards; receives an explicit pack-completion reveal; knows when to use ATS versus recruiter variants; and is led directly into a real posting.

No authentication, database, paywall, LLM dependency, OCR, scraping, recommendations service, or résumé-content transmission was added. The truth engine, provenance model, parser, and generator were not redesigned.

## Baseline

Foundation: `f99633a97661d7b9d7edcd0dee1757a76b6e63ea` on merged `main`.

Before editing, the full suite passed, but the activation journey had four blocking presentation defects:

- At 375×667, the CTA was below the fold and eleven navigation destinations occupied the opening viewport.
- Résumé import sat below identity, employment, projects, education, and nine evidence panels.
- Nine lane cards appeared equally viable and did not expose dossier support or the résumé payoff.
- Successful generation opened a résumé archive without a completion reveal, variant-use guidance, or a dominant real-application bridge.

The measured synthetic baseline required 13 decisions to open a résumé. Instrumented time was 35.7s to approved evidence, 58.4s to a lane, 74.5s to a pack, and 110.7s to an opened variant. See `docs/CAREER_FORGE_ACTIVATION_BASELINE.md` for the complete untouched report.

## Product-message and first-run changes

- Reframed the hero as `One career history. A complete résumé pack.`
- Added an above-the-fold pack inventory, compact trust strip, import CTA, and pack-preview CTA.
- Added a concrete three-step public demonstration and plain-language rationale for multiple baselines.
- Moved advanced dashboard stations below first-run explanation and converted mobile navigation to one compact menu.
- Added an isolated, disposable synthetic sample. It uses component state only and never touches the command-center store or local storage.
- Added a persistent five-stage activation path derived from dossier evidence, active lanes, packs, and saved applications. No parallel onboarding schema or percentage score was introduced.
- Moved file import to the top of the dossier route, kept paste/manual entry available, and explained multi-file grouping, deduplication, local processing, and approval gating.
- Added per-proposal `Can support` guidance plus a readiness-backed `What your approvals unlock` panel.
- Added conservative lane labels (`Strong lane`, `Credible transition`, `Exploratory`, `Not enough evidence yet`) based on overlap with approved evidence. Cards expose supporting facts, proof to add, a first gap, and the two-baseline outcome.
- Rebuilt the pack completion state around `Your Résumé Pack is ready.` with lane/variant/evidence/gap counts.
- Added semantic `Use this for` and `Why it differs` guidance to ATS, recruiter/networking, and job-specific résumé cards.
- Kept the evidence receipt expandable and made `Tailor a résumé to a real job` the dominant completion action.
- Replaced the legacy-profile completeness warning on `/tailor` with canonical dossier readiness.
- Added optional local JSON feedback after dossier approval and pack generation. The file contains only milestone, yes/not-yet, and timestamp.

## Routes and implementation

- `/`: conversion hero, pack preview, five-stage path, public demonstration, sample, trust explanation, deferred advanced workspace.
- `/profile`: import-first entrance, grouped approval value, unlock explanation, feedback, progress.
- `/targets`: lane definition, approved-evidence view, credibility labels, proof/gap/payoff details, progress.
- `/versions`: completion reveal, use guidance, evidence coverage/gaps, export, feedback, direct tailoring bridge, progress.
- `/tailor`: dossier-native readiness and content-free activation events.
- `/resume-builder`: tailored-resume completion event.
- Shared activation logic: `src/lib/activation.ts`.
- Shared UI: `ActivationPath`, `SampleExperience`, `ActivationFeedback`.

## Content-free analytics

Added and wired the required event-name-only activation events:

`landing_primary_cta_clicked`, `import_started`, `import_completed`, `proposal_review_started`, `first_evidence_approved`, `dossier_activation_reached`, `first_lane_activated`, `resume_pack_started`, `resume_pack_completed`, `resume_variant_opened`, `full_pack_exported`, `tailor_started`, `tailored_resume_completed`, `application_saved`, and `activation_feedback_submitted`.

`trackCareerEvent` still accepts only the event name. No résumé, dossier, posting, employer, title, URL, filename, compensation, contact, or answer content is passed.

## Activation coverage

`scripts/activation-regression.mjs` adds 22 checks covering homepage comprehension, import routing, review gating, unlock semantics, progress persistence, sample isolation, one-lane/two-variant and three-lane/six-variant output, semantic use guidance, tailoring bridge, analytics safety, feedback safety, backup/restore, legacy users, mobile navigation, touch targets, low-evidence honesty, and substantive variant distinction.

`scripts/activation-browser.mjs` covers fresh storage, landing comprehension, isolated sample mode, paste import, grouped approval, dossier unlock, lane selection, pack reveal, use guidance, full export, direct tailoring bridge, refresh persistence, keyboard entry, and no horizontal overflow at 320×568, 375×667, 390×844, 430×932, 768×1024, and 1440×900.

`scripts/cold-user-activation-playtest.mjs` runs ten synthetic fresh-state personas. Nine produce a pack with zero unsupported claims; the intentionally thin persona is stopped with honest evidence guidance. Full results and the five manual comprehension prompts are in `docs/CAREER_FORGE_COLD_USER_PLAYTEST.md`.

## Final validation

- `npm test`: passed; 405 named regression checks, desktop/mobile usability regression, and 82-persona quality suite at 98/100 with 0 hallucinations.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; 16 static pages generated.
- `npm run smoke:generator`: passed for 6 personas.
- `npm run smoke:interview`: passed for 7 profiles.
- `npm run smoke:resume-intelligence`: 20/20 rated Excellent.
- `npm run playtest:adversarial`: 10/10 completed with 0 unsupported claims.
- `npm run acceptance:private`: 15/15 passed.
- `npm run acceptance:browser`: passed at 375×667 and 1440×900.
- `npm run acceptance:activation`: 22 activation regressions, 10 persona simulations, and the full six-viewport browser workflow passed.

## Screenshots

Baseline:

- `docs/activation/baseline-375x667.png`
- `docs/activation/baseline-390x844.png`
- `docs/activation/baseline-1440x900.png`

Final production-build captures:

- `docs/activation/final-375x667.png`
- `docs/activation/final-390x844.png`
- `docs/activation/final-1440x900.png`

## Conversion risks and deferred items

- The ten persona runs are deterministic workflow simulations, not moderated human sessions. Owner review should ask the five documented comprehension questions with at least a few truly cold users.
- Feedback is intentionally local-file export because the product has no approved backend. Collection requires the tester to share the tiny JSON file with the owner.
- Lane credibility labels are conservative evidence-overlap explanations, not labor-market predictions or a new scoring engine.
- The tailoring route still exposes optional application metadata in the same screen as the core posting/baseline inputs. The dominant entry and copy are clearer, but progressive disclosure is a reasonable follow-up experiment.
- The sample is a disposable explanatory walkthrough, not a second full command-center instance; this keeps sample data provably isolated.

## Recommendation

The branch is ready for owner review. It should not be merged or deployed until the owner completes a short cold-comprehension pass and approves the conversion framing.

**READY FOR OWNER REVIEW**
