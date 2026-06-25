# Target Role UX Streamline Report

## Summary

Career Forge Lite now treats role-family mapping as an internal intelligence layer instead of a required interview step. Known target roles still map automatically to the correct family, but users now see a lightweight confirmation line and can open a correction panel only when needed.

No new product scope was added. The generator logic and existing role-family mappings were preserved.

## Role-Family Step Change

- Removed the standalone required "Mapped Role Family" interview screen.
- Target role selection now shows: "We'll tailor this for [Role Family]."
- Added a secondary "Change lane" action inside the target role question.
- The full role-family grid only appears when "Change lane" is clicked.
- Review dossier now labels the value as "Tailored career lane" instead of exposing backend mapping language.

## Typeahead And Search Changes

- Target role selection:
  - Searches all mapped career targets.
  - Includes role aliases.
  - Shows role title plus the family Career Forge will tailor for.
  - Supports Enter selection of the first match.
- Company selection:
  - Uses a focused search panel with top matches only.
  - Supports Enter selection of the first match.
  - Keeps custom company fallback available.
- Tool selection:
  - Shows role-aware suggestions when focused with an empty search.
  - Searches the full local tool bank when the user types.
  - Displays selected tools as removable chips.
  - Keeps custom tool fallback available.
- Responsibility selection:
  - Shows role-aware suggestions when focused.
  - Filters responsibility suggestions by search text.
  - Displays selected responsibilities as removable chips.
  - Keeps custom responsibility fallback available.

## Custom Fallback Behavior

- Custom target roles still work.
- Custom companies still work.
- Custom tools still work.
- Custom responsibilities still work.
- Known target roles continue to update `roleFamily` internally.
- User-selected lane overrides still power adaptive prompts and generated output.

## Files Changed

- `src/components/IntakeForm.tsx`
- `scripts/smoke-generator.mjs`
- `TARGET_ROLE_UX_STREAMLINE_REPORT.md`

## Tests Updated

`npm run smoke:generator` now includes checks for:

- Known role auto-mapping.
- Role-family override behavior.
- Career target search filtering.
- Company search filtering.
- Tool search filtering.
- Responsibility search filtering.
- Custom fallback compatibility.

## Verification Results

- `npm run smoke:generator` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

## Commit And Push

- Commit hash: pending
- Push result: pending
