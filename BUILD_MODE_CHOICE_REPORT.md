# Build Mode Choice Report

## Summary

Added a build-mode choice screen after the landing CTA so users can choose how they want to start Career Forge Lite before entering a resume flow.

## What Changed

- Added a new `mode` step to the home page flow.
- Updated landing/header CTAs to open the build-mode choice screen instead of jumping directly into the builder.
- Added two Product Lab Module 05-styled mode cards:
  - **Guided Interview**: "Answer focused questions. Best if you want structure."
  - **Tell My Story**: "Describe your work naturally. Career Forge organizes the details."
- Routed Guided Interview to the existing one-question guided builder flow.
- Routed Tell My Story to the existing conversational `/interview` mode.
- Preserved the existing resume generation, ATS review, LinkedIn preview, and static builder behavior.

## Files Changed

- `src/app/page.tsx`
- `scripts/smoke-generator.mjs`
- `BUILD_MODE_CHOICE_REPORT.md`

## Smoke Coverage Added

- Confirms the build-mode screen exists.
- Confirms both mode labels render.
- Confirms the required mode copy is present.
- Confirms Guided Interview still opens the existing builder flow.
- Confirms Tell My Story opens `/interview`.

## Verification Results

- `npm run smoke:resume-intelligence` - passed; 20 transformation profiles tested.
- `npm run smoke:generator` - passed; generator smoke passed for 6 personas.
- `npm run smoke:interview` - passed; 7 interview simulation profiles completed.
- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run build` - passed; Next.js built `/` and `/interview` successfully.

## Commit / Push

- Implementation commit hash: `7fc07f6`
- Push result: succeeded to `origin/main`
