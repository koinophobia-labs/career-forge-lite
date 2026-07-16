# Improve Career Forge first-run activation

## Outcome

This branch turns the merged truth workflow into an import-first activation experience and closes the three owner-review blockers. A fresh user now sees Career Forge as a local-first career evidence compiler; reviews imports in a durable Truth Inbox; follows a five-stage path derived from canonical local state; receives an explicit pack reveal and Defensibility Receipt; and can inspect bidirectional lineage in the Career Truth Map.

No authentication, database, paywall, LLM dependency, OCR, scraping, recommendations service, or résumé-content transmission was added. The truth engine, provenance model, parser, and generator were not redesigned.

## Baseline

Foundation: `f99633a97661d7b9d7edcd0dee1757a76b6e63ea` on merged `main`.

Before editing, the full suite passed, but the activation journey had four blocking presentation defects:

- At 375×667, the CTA was below the fold and eleven navigation destinations occupied the opening viewport.
- Résumé import sat below identity, employment, projects, education, and nine evidence panels.
- Nine lane cards appeared equally viable and did not expose dossier support or the résumé payoff.
- Successful generation opened a résumé archive without a completion reveal, variant-use guidance, or a dominant real-application bridge.

The measured synthetic baseline required 13 decisions to open a résumé. Instrumented time was 35.7s to approved evidence, 58.4s to a lane, 74.5s to a pack, and 110.7s to an opened variant. See `docs/CAREER_FORGE_ACTIVATION_BASELINE.md` for the complete untouched report.

The PR #5 market/moat baseline was separately captured before this pass in `docs/CAREER_FORGE_MARKET_MOAT_BASELINE.md`. At that point the full 405-check suite passed, but pending import proposals could be cleared, activation fired on a save rather than a real readiness transition, and one known gap could be counted twice.

## Owner-review blocker repairs

### 1. Durable Truth Inbox

Root cause: import proposals lived only in component state. `mergeImportProposals` correctly ignored `proposed` records, but the UI cleared the entire array after any save.

Fix: canonical command-center state now owns additive, versioned `pendingImportReviews`. The queue stores proposed/approved/rejected state, edits, duplicate relationships, excerpts, timestamps, and opt-in filenames. Partial saves commit only decided records and retain undecided work across refresh/navigation. Completed batches clear only after all items are committed. New imports can join the active batch or start separately; discard uses the exact explicit confirmation. Legacy, corrupt, backup, and restore paths revive safely. Pending items never affect readiness, claims, lanes, answers, or activation.

### 2. Transition-based activation

Root cause: `dossier_activation_reached` was attached to import-save behavior rather than canonical truth/readiness state.

Fix: `hasReachedDossierActivation` requires a non-`not-ready` dossier plus a structured role/project linked to approved, non-rejected evidence. `activationEventsForTransition(previous, next)` is the single pure gate for dossier activation and other first milestones. It emits only on a false→true transition, never from render, refresh, unrelated edits, later evidence, or restoring an already activated state.

### 3. Truthful gap receipt

Root cause: the deterministic generator copied lane gaps into both `gapsLeftUnclaimed` and `unsupportedClaimsRefused`, and the UI added their lengths.

Fix: lane gaps remain known evidence gaps; `unsupportedClaimsRefused` is empty unless the generator actually considers and rejects a claim candidate. The reveal uses a unique set union. The expanded receipt separates the two concepts and hides an empty refusal section.

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
- `/truth-map`: derived evidence-first and output-first lineage across approved evidence, lanes, baseline/job-specific claims, and application answers.
- `/tailor`: dossier-native readiness and content-free activation events.
- `/resume-builder`: tailored-resume completion event.
- Shared activation logic: `src/lib/activation.ts`.
- Shared UI: `ActivationPath`, `SampleExperience`, `ActivationFeedback`.

## Content-free analytics

Added and wired the required event-name-only activation events:

`landing_primary_cta_clicked`, `import_started`, `import_completed`, `proposal_review_started`, `first_evidence_approved`, `dossier_activation_reached`, `first_lane_activated`, `resume_pack_started`, `resume_pack_completed`, `resume_variant_opened`, `full_pack_exported`, `tailor_started`, `tailored_resume_completed`, `application_saved`, and `activation_feedback_submitted`.

Moat discovery adds event-name-only `truth_inbox_created`, `truth_inbox_resumed`, `truth_inbox_completed`, `truth_inbox_discarded`, `truth_map_opened`, `evidence_usage_opened`, `claim_provenance_opened`, `defensibility_receipt_opened`, and `differentiation_section_cta_clicked`.

`trackCareerEvent` still accepts only the event name. No résumé, dossier, posting, employer, title, URL, filename, compensation, contact, or answer content is passed.

## Activation coverage

`scripts/activation-regression.mjs` adds 22 checks covering homepage comprehension, import routing, review gating, unlock semantics, progress persistence, sample isolation, one-lane/two-variant and three-lane/six-variant output, semantic use guidance, tailoring bridge, analytics safety, feedback safety, backup/restore, legacy users, mobile navigation, touch targets, low-evidence honesty, and substantive variant distinction.

`scripts/activation-browser.mjs` covers fresh storage, landing comprehension, isolated sample mode, paste import, grouped approval, dossier unlock, lane selection, pack reveal, use guidance, full export, direct tailoring bridge, refresh persistence, keyboard entry, and no horizontal overflow at 320×568, 375×667, 390×844, 430×932, 768×1024, and 1440×900.

`scripts/cold-user-activation-playtest.mjs` runs ten synthetic fresh-state personas. Nine produce a pack with zero unsupported claims; the intentionally thin persona is stopped with honest evidence guidance. Full results and the five manual comprehension prompts are in `docs/CAREER_FORGE_COLD_USER_PLAYTEST.md`.

`scripts/market-moat-regression.mjs` adds 66 behavioral checks covering the three blockers, at least twelve Truth Inbox cases, pure activation transitions, Truth Map correctness, fail-closed Defensibility Receipt semantics, positioning, event-name-only analytics, legacy/backup behavior, 500-evidence derivation, storage/backup size, and homepage heavy-library isolation. Browser acceptance now continues through partial review and refresh, completion, receipt, Truth Map, grounded application answers, backup/clear/restore, relationship verification, and all six target viewports.

## Market and category conclusion

The 2026 audit covers Teal, Huntr, Career.io, Careerflow, Simplify, Jobscan, Rezi, Resume Worded, Kickresume, Enhancv, Resume.io, Zety, TopResume, Career Vault, Career Vault Cloud, ResumeForge, Bragora, and three explainable/provenance research prototypes. AI writing, keyword scoring, templates, document versions, tracking, autofill, interview tools, and LinkedIn rewriting are commodities. Career vaults and provenance are emerging but are no longer unique by themselves.

Selected category: **local-first career evidence compiler** for people with nonlinear careers whose strongest evidence is spread across jobs, projects, independent work, old résumés, and real responsibilities. Selected positioning: `Your career is bigger than your last résumé.` The qualified one-of-one conclusion is medium-high confidence: no audited public surface demonstrated the complete combination of durable pre-trust review, direct/combined/transferred lineage, duration handling, paired multi-lane compilation, grounded answers, and local no-account use. This does not claim that competitors lack every component or that account-only behavior was exhaustively observed.

The named comparison, price snapshot, source ledger, category strategy, implementation decision, and five-human moderated protocol are in the new `CAREER_FORGE_MARKET_*` and `CAREER_FORGE_*STRATEGY/DECISION` documents. Human ten-second comprehension testing has not occurred.

## Final validation

- `npm test`: passed; 471 named regression checks, desktop/mobile usability regression, and 82-persona quality suite at 98/100 with 0 hallucinations.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; 17 static pages generated, including `/truth-map`.
- `npm run smoke:generator`: passed for 6 personas.
- `npm run smoke:interview`: passed for 7 profiles.
- `npm run smoke:resume-intelligence`: 20/20 rated Excellent.
- `npm run playtest:adversarial`: 10/10 completed with 0 unsupported claims.
- `npm run acceptance:private`: 15/15 passed.
- `npm run acceptance:browser`: passed at 375×667 and 1440×900.
- `npm run acceptance:activation`: 22 activation regressions, 10 persona simulations, and the full six-viewport browser workflow passed.
- `npm run acceptance:market-moat`: 66 market/moat regressions plus the extended six-viewport end-to-end browser workflow passed.
- Production homepage script references total 769,678 uncompressed bytes in the local build snapshot; the regression confirms neither PDF.js nor Mammoth is eagerly imported on the homepage. Truth Map derivation remained below its 250ms budget for 500 evidence records, and the synthetic local/backup envelopes remained below 2MB.

## Screenshots

Baseline:

- `docs/activation/baseline-375x667.png`
- `docs/activation/baseline-390x844.png`
- `docs/activation/baseline-1440x900.png`

Final production-build captures:

- `docs/activation/final-375x667.png`
- `docs/activation/final-390x844.png`
- `docs/activation/final-1440x900.png`

Market/moat captures from the extended browser journey:

- `docs/market-moat/final-375x667.png`
- `docs/market-moat/final-1440x900.png`
- `docs/market-moat/truth-map-375x667.png`

## Conversion risks and deferred items

- The ten persona runs are deterministic workflow simulations, not moderated human sessions. Owner review should ask the five documented comprehension questions with at least a few truly cold users.
- Feedback is intentionally local-file export because the product has no approved backend. Collection requires the tester to share the tiny JSON file with the owner.
- Lane credibility labels are conservative evidence-overlap explanations, not labor-market predictions or a new scoring engine.
- The tailoring route still exposes optional application metadata in the same screen as the core posting/baseline inputs. The dominant entry and copy are clearer, but progressive disclosure is a reasonable follow-up experiment.
- The sample is a disposable explanatory walkthrough, not a second full command-center instance; this keeps sample data provably isolated.
- ResumeForge and Bragora publicly overlap on evidence, provenance, and fact-guarded tailoring. The defensible claim is the audited combination, not provenance alone.
- Local-only storage is a trust advantage and a continuity risk. Backup comprehension and reminder cadence still require owner review.
- Competitor pricing and account-only workflows can change quickly; the ledger records uncertainty rather than inferring inaccessible behavior.

## Recommendation

The branch is ready for owner re-review. It should not be merged or deployed until the owner approves the category framing and reviews the five-human comprehension protocol. Passing automation establishes workflow integrity; it does not claim moderated market validation.

**READY FOR OWNER RE-REVIEW**
