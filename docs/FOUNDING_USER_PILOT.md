# Founding-User Pilot Protocol

Internal tests establish mechanical readiness. They cannot establish usefulness or willingness to pay. Career Forge will validate **one commercial outcome first: the $49 Career Reset Pack**. The $79 Job Search and $99 Career Switch packs remain hypotheses until the first tier earns its footing.

## Release stages

### Stage 0 — production and commerce proof

- Fresh production re-audit is green.
- Commerce runs in Stripe **test mode** and completes checkout → signed license → activation → first export.
- General live commerce remains off.

### Stage 1 — three guided usability sessions

- Three individually recruited participants complete the Career Reset workflow without payment.
- The founder observes friction, reviews every artifact, and fixes release-blocking defects.
- Participants explicitly consent before sharing the content-free pilot summary or any résumé with a reviewer.

### Stage 2 — five-user paid founding cohort

- Open invite-only live checkout for **Career Reset only** at $49.
- Five users pay, complete one lane, and receive normal product support.
- Refunds are available under the published terms; actual refund behavior is measured.
- $79 and $99 checkout remain closed even though their scopes may stay visible as future hypotheses.

## Privacy boundary

Participants export the pilot summary from Settings. It contains counts and timestamps only (career-forge-pilot-summary-v1) and is never transmitted automatically. Résumé content, names, employers, and contact details are excluded by a fail-closed content guard. Recruiter review is separate, optional, and requires explicit consent.

## Per-participant measurements

| Metric | Source |
| --- | --- |
| Time to first approved evidence | pilot summary |
| Time to first usable export | pilot summary |
| Export success and blockers | pilot summary + interview |
| Editing minutes per artifact | participant self-report |
| Artifact disposition: used / lightly edited / heavily edited / abandoned | participant interview |
| Wrong-category items caught | pilot summary + interview |
| Usefulness rating (1–5) | participant interview |
| Would request refund / did request refund | interview + actual paid cohort |
| Used in a real application | two-week follow-up |
| Open-ended willingness to pay | ask before naming $49 in Stage 1 |

## Blinded recruiter review

For each consenting participant, use node scripts/build-recruiter-packet.mjs to randomize:

1. The prior résumé.
2. Career Forge output after logged light edits.
3. A generic-AI baseline built from the same history.

At least two independent recruiters score credibility, clarity, target-role alignment, factual defensibility, likelihood of interview, and editing burden. Reviewers never see the label key.

## Career Reset support threshold

The $49 tier is supported only when all are true:

1. At least five **paid** participants complete the one-lane workflow.
2. At least four of five rate the core artifacts 4/5 or higher.
3. Median editing burden is 15 minutes or less per artifact.
4. Recruiter review finds zero generation-caused factual-defensibility failures.
5. Career Forge beats or ties the generic-AI baseline on credibility and factual defensibility for each participant.
6. At least three participants use an artifact in a real application.
7. At least three of five say the result was worth $49 after use.
8. The completed-cohort refund rate is no more than one of five, and every refund cause is documented.

Until all criteria hold, public language remains **founding paid beta**, not validated pricing. The $79 and $99 tiers do not open automatically when Career Reset passes; each requires its own cohort and evidence.

## Records

Personal pilot records live outside the repository. The repository stores only this protocol, content-free schemas and aggregate conclusions, test evidence, and blinded-packet tooling.
