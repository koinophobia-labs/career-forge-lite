# Missing Info Assistant Report

## Summary

Tell My Story mode now detects what Career Forge captured from a natural story and what would still help the resume, then asks one focused follow-up at a time without sending users back into the full guided questionnaire.

## What Changed

- Added structured missing-info metadata to `StoryDossier`.
- Added a dossier checklist:
  - Captured
  - Still helpful
- Detects these fields:
  - target role
  - contact
  - tools
  - responsibilities
  - scope
  - outcomes
  - education
- Shows one focused follow-up based on the first missing helpful field.
- Keeps `Looks right`, `Edit details`, and `Add more context`.
- Accumulates follow-up answers into the story context so users do not have to restart.
- Keeps Guided Interview unchanged.

## Issue Found And Fixed

During smoke testing, the partial story:

`I worked at DraftKings as a sportsbook writer from 2023 to now.`

was incorrectly treating the year range as scope. Scope filtering now ignores year/date ranges such as `2023 to now`.

## Files Changed

- `src/components/TellMyStoryMode.tsx`
- `src/lib/story-mode.ts`
- `scripts/smoke-generator.mjs`
- `MISSING_INFO_ASSISTANT_REPORT.md`

## Smoke Coverage Added

- Confirms Tell My Story shows `Captured` and `Still helpful`.
- Confirms focused follow-up copy exists.
- Confirms users are told they do not need to restart.
- Adds partial-story assertions for:
  - captured role
  - captured company
  - missing responsibilities
  - missing scope
  - focused follow-up generation

## Verification Results

- `npm run smoke:generator` - passed; generator smoke passed for 6 personas.
- `npm run typecheck` - passed.
- `npm run lint` - passed.
- `npm run smoke:resume-intelligence` - passed; 20 transformation profiles tested.
- `npm run smoke:interview` - passed; 7 interview simulation profiles completed.
- `npm run build` - passed; Next.js built `/`, `/interview`, and `/story` successfully.

## Remaining Limitations

- Missing-info detection is deterministic and conservative.
- Contact detection is limited to email and simple "my name is..." phrasing unless users edit details manually.
- Education is treated as helpful, not required, because many users may not want it in the first story pass.

## Commit / Push

- Implementation commit hash: `0be61ee`
- Push result: succeeded to `origin/main`
