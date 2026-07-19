# Ease-of-Use Launch Gate

**Current status: mechanically ready for a controlled founding-user pilot.**
**Broad-launch status: gated on unassisted human completion.**

Career Forge now passes the complete automated journey from first entry through résumé import, fact review, role targeting, résumé generation, license activation, first-click export, backup, total local-data loss, restore, re-activation, and export after recovery. Automation proves that the machinery works. It cannot prove that a first-time job seeker experiences the product as effortless.

## Current verdict

Career Forge is ready for real users inside a controlled beta. Development is frozen unless an observed user breaks a gate criterion.

The product should not be described as broadly launch-ready until first-time users complete the entire journey without founder assistance and rate the experience highly.

## The launch-standard criteria

| # | Criterion | Current status | Evidence or remaining proof |
| --- | --- | --- | --- |
| 1 | A user immediately understands what Career Forge will produce | Met mechanically | A real synthetic résumé PDF can be downloaded before any data entry through the sample pack. Human comprehension is measured in the pilot. |
| 2 | Import eliminates most manual entry | Met mechanically | PDF, DOCX, and TXT import runs in-browser and creates structured proposals. Clear high-confidence facts are preselected but remain untrusted until the user explicitly saves the review. |
| 3 | Evidence review feels fast rather than administrative | Improved, human proof pending | Clear facts are preselected; metrics, outcomes, low-confidence facts, duplicates, and context still require judgment. Pilot timing and stall observation determine whether the experience feels fast. |
| 4 | Progress and saving are always visible | Met mechanically | The dashboard exposes the current next action, and the global save-status pill confirms local persistence or points directly to backup after a write failure. |
| 5 | Every screen has one obvious next action | Met mechanically on the core journey | The homepage chooses one goal, returning users receive one next move, and Guided Setup now opens directly on “What job do you want next?” instead of asking how to begin twice. Human observation remains the final proof. |
| 6 | Users can edit outputs without breaking consistency | Met mechanically | Full-document editing triggers provenance re-check, supports undo, handles stale-tab conflicts, and re-sanitizes at export. |
| 7 | Mobile use introduces no meaningful friction | Engine-level proof complete, human proof pending | Device and accessibility sweeps pass without page overflow. Actual phone-entry effort must be observed with pilot users. |
| 8 | Payment and entitlement work without explanation | Met mechanically and in production smoke | The real $49 Career Reset purchase completed, activated, survived reload, exported, and was fully refunded. Live commerce remains limited to Career Reset. |
| 9 | Export succeeds on the first attempt | Met mechanically | The complete ZIP exports on the first click after unlock. Rendered PDF and DOCX stress coverage includes long, sparse, project-only, and multi-page personas. |
| 10 | A first-time user completes the full journey without outside help | Not yet demonstrable | This is a human criterion by definition and is the only remaining broad-launch gate. |

## Final pre-user product changes

1. The homepage goal router remains the single top-level intent decision.
2. Guided Setup no longer displays its old mode-selection screen.
3. Guided Setup automatically bypasses its legacy internal quick-start question and lands on the target-role question.
4. “Tell My Story” remains available as a secondary path instead of competing with the primary action.
5. Primary navigation remains limited to Today, My Résumé, Applications, Interview, and More.
6. Imported facts are reviewed by exception while the explicit save boundary remains intact.

## North-star usability test

> **Five out of five first-time users complete résumé import through exported Career Pack without assistance, and each rates ease of use 9 or 10.**

Run the protocol in `docs/FOUNDING_USER_PILOT.md`:

- Observe but do not guide.
- Any founder intervention marks that session as failed.
- Record time to first approved fact, time to usable export, editing burden, stall points, and artifact disposition.
- Fix only defects or repeated friction revealed by observed behavior.

## Commerce and release proof

### Production checkout and entitlement: passed

The Career Reset production launch was completed through the real Stripe-hosted path:

- live checkout returned a Stripe-hosted URL;
- only the $49 Career Reset tier was purchasable;
- the five-completed-session founding cap was configured;
- a real $49 purchase completed;
- the production license activated and survived reload;
- a reviewed résumé export completed;
- the charge was fully refunded;
- Stripe payment and refund emails were enabled;
- replies route to the monitored support address.

The optional webhook and Resend backup path remains intentionally deferred because no verified sending-domain configuration was available. Receipt return and same-session license reissue are the verified recovery paths.

### Automated release path: passed

The required quality gate covers:

- deterministic unit regressions;
- desktop and mobile browser regression;
- redacted private acceptance;
- full first-time-user journey in test-mode commerce;
- backup and recovery proof;
- lint;
- typecheck;
- production build.

The quality gate preserves unit, browser, journey, and recovery logs as artifacts and uses `pipefail` so a failed command cannot be hidden by log piping.

### Device and accessibility sweep: passed at engine level

WebKit iPhone-profile, Chromium Android-profile, desktop keyboard-only, and zoom-equivalent tests pass without route overflow. Physical-phone use still belongs in the founding-user sessions because typing effort is a felt experience, not a layout assertion.

## Remaining risks to watch during the pilot

- sparse evidence can still produce thin but truthful bullets;
- novel separation or preference phrasing may evade pattern-based classification;
- DOCX checks are structural and rendered through headless tooling, not pixel-identical Microsoft Word automation;
- profile identity and application-note multi-tab edits do not receive the full choose-or-merge dialog;
- mobile typing effort and long-tail device confidence remain human-observation items.

## Freeze declaration

Do not add templates, dashboards, analytics, sharing, accounts, team features, or speculative polish before the pilot.

The next product change must be justified by one of these:

1. a failing release gate;
2. an observed first-time user becoming stuck;
3. a generated artifact requiring more than light editing;
4. a factual-defensibility failure;
5. a payment, entitlement, export, or recovery failure.

Everything else waits. The product now needs people, not another secret basement full of features.
