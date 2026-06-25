# Dual Mode Launch QA Report

## Summary

Completed launch QA for Career Forge Lite across both resume intake modes:

- Guided Interview
- Tell My Story

Both modes can generate resume output, ATS validation, LinkedIn output, and Visual Resume output where applicable.

## Manual QA Covered

- Landing page to build mode choice.
- Guided Interview end-to-end with a Sportsbook Ticket Writer targeting Customer Success Associate.
- Tell My Story end-to-end with messy natural input.
- Tell My Story missing-info follow-ups.
- Resume generation.
- ATS validation panel.
- Copy Resume export path.
- Visual Portfolio Resume rendering and controls.
- Mobile-oriented layout checks for home and `/story`.

## Issues Found

### 1. Tell My Story follow-up label mismatch

After contact was captured, the UI showed `Focused follow-up: responsibilities` while the actual question asked for tools.

Fix:
- Reordered missing-info priority so the label and focused question stay aligned.

### 2. Tell My Story name over-capture

Input:

`My name is Jordan Carter and my email is jordan.carter@example.com.`

Previously produced a bad name value like:

`Jordan Carter And My Email Is Jordan`

Fix:
- Updated the name parser to stop at the first delimiter such as `and`, comma, period, or end of string.
- Added smoke coverage for the exact contact phrase.

### 3. Scope/date false positive

Partial story input with `2023 to now` could be interpreted as scope.

Fix:
- Scope filtering now ignores year/date ranges such as `2023 to now`.

## Non-Blocking Notes

- Some hidden or decorative controls appear as empty-text buttons in DOM inspection during Guided Interview responsibility/scope steps. The visible flow was usable, but this is worth a future accessibility cleanup.
- Browser viewport override in the in-app browser did not reflect a true 390px `clientWidth`; however, checked pages reported no horizontal overflow and mobile-responsive structures are present.
- Screenshots were not refreshed because this pass fixed logic/follow-up correctness rather than changing the launch visual presentation.

## Export Checks

- `Copy Resume` output was clean.
- No `Copy Summary`, `Copy Skills`, `Copy Experience`, or `Copy Education` UI labels appeared in copied resume text.
- ATS Resume remained available as the default export view.
- Visual Portfolio Resume rendered and exposed customization controls.

## Files Changed

- `src/lib/story-mode.ts`
- `scripts/smoke-generator.mjs`
- `DUAL_MODE_LAUNCH_QA_REPORT.md`

## Verification Results

- `npm run smoke:resume-intelligence` - passed; 20 transformation profiles tested.
- `npm run smoke:generator` - passed; generator smoke passed for 6 personas.
- `npm run smoke:interview` - passed; 7 interview simulation profiles completed.
- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run build` - passed; Next.js built `/`, `/interview`, and `/story` successfully.

## Launch Readiness

Ready for LinkedIn update post with notes:

- Guided Interview works end-to-end.
- Tell My Story works end-to-end.
- Missing-info follow-ups no longer restart users or mismatch labels/questions.
- Resume generation, ATS validation, copy export, and Visual Resume rendering passed QA.

## Commit / Push

- Commit hash: pending
- Push result: pending
