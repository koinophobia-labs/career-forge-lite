# Career Forge market-moat baseline

## Starting point

- Research/verification date: 2026-07-15 (America/Chicago)
- Repository: `/Users/koi/Documents/Codex/2026-07-15/files-mentioned-by-the-user-career/career-forge-lite`
- Branch: `codex/career-forge-activation-launch`
- HEAD and remote head: `e7fd05fae9bc2839b47da83132403e693feaa8f5`
- Truth-workflow foundation: `f99633a97661d7b9d7edcd0dee1757a76b6e63ea`
- Existing draft PR: https://github.com/koinophobia-labs/career-forge-lite/pull/5
- PR state before edits: open, draft, mergeable; Vercel and Vercel Preview Comments checks successful
- Worktree before this report: clean
- Runtime: Node `v24.16.0`; npm `11.13.0`

The local branch and remote branch matched exactly after `git fetch origin`. The merged truth-workflow commit is an ancestor of the current head. No fast-forward was required.

## Complete pre-edit validation

- `npm test`: passed. 405 named regression checks passed, the desktop/mobile usability regression passed, and the 82-persona quality suite scored 98/100 with 0 hallucinations.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; 16 static pages generated.
- `npm run smoke:generator`: passed for 6 personas.
- `npm run smoke:interview`: completed for 7 profiles.
- `npm run smoke:resume-intelligence`: 20/20 profiles rated Excellent.
- `npm run playtest:adversarial`: completed for 10 profiles with 0 unsupported claims.
- `npm run acceptance:private`: 15/15 checks passed.
- `npm run acceptance:browser`: passed at 375×667 and 1440×900.
- `npm run acceptance:activation`: 22 activation regressions passed; 10 fresh-state persona simulations passed; the browser workflow passed fresh landing, sample isolation, import, approval, lane selection, pack reveal, export, tailoring bridge, refresh, keyboard, and six viewports.

## Confirmed owner-review blockers

### 1. Import-review work can disappear

`/profile` stores `importProposals` only in React state. `commitImportReview()` merges only approved/rejected decisions into the dossier, clears the entire component queue, and has no durable pending-review envelope. Therefore an undecided proposal can disappear on save, navigation, refresh, or component unmount. A second import also replaces the in-memory queue.

### 2. Dossier activation analytics can report false success

`commitImportReview()` emits `dossier_activation_reached` after every saved review. It does not compare previous and next canonical state or call dossier readiness. All-rejected, identity-only, tool-only, and still-not-ready saves can report activation. The current `first_evidence_approved` check is closer to a transition but is based on component intent rather than the committed next state.

### 3. Pack reveal doubles known gaps

`generateResumePack()` currently populates both `unsupportedClaimsRefused` and `gapsLeftUnclaimed` from the same unique union of active lane gaps. `/versions` then adds the two array lengths. One known gap therefore appears as two even though no separate claim candidate was actively considered and refused.

## Architectural constraints for the repair

- Canonical command-center state is version 2 and is revived defensively from local storage.
- Backups serialize the revived canonical state, so an additive pending-review field can inherit migration, corruption handling, backup, and restore behavior without a second storage system.
- Dossier readiness already distinguishes `not-ready`, `foundation`, and `resume-ready`; activation should reuse that truth model.
- Résumé claim references already carry `direct`, `combined`, and `transferred` support types and evidence IDs. A Truth Map and Defensibility Receipt can be derived without new persistence.
- Heavy PDF.js and Mammoth libraries are already dynamically imported only from the local import path and should remain absent from the homepage bundle.

## Baseline conclusion

The existing truth engine and activation surface are stable, but PR #5 is not owner-review ready. The three blockers are reproducible in current code, the pending review lacks a durable lifecycle, and the category differentiation is not yet supported by a current sourced market comparison. Research must precede the public positioning and moat implementation.
