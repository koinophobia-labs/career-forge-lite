# Selection UI Readability Report

## Summary

Career Forge Lite keeps the expanded local role, company, tool, and responsibility banks, but the interview now shows fewer choices at once. Selection screens are lighter, more mobile-friendly, and closer to a guided interview than an admin-style option directory.

No generator logic, backend behavior, authentication, database, API integration, or product scope was changed.

## Screens Simplified

- Target role selection
- Role-family correction
- Company selection
- Tool selection
- Responsibility selection
- Adaptive scope prompts

## Before / After UX Summary

Before:

- Search results could expose large option blocks.
- Target role cards repeated "Tailors for..." on every row.
- Company suggestions felt like a directory.
- Tools and responsibilities used heavier bordered panels.
- Scope prompts showed too many primary fields at once.

After:

- Search lists show 5-6 options by default and 8 when filtering.
- Target role results show only the role title plus a small family pill.
- "Change lane" stays collapsed unless the user asks to correct the mapping.
- Lane override uses compact chips instead of large cards.
- Company picker shows a search box, a small suggestion list, and custom fallback.
- Tool picker shows six role-aware suggestions, search, selected chips, and optional "More suggestions."
- Responsibility picker shows six role-aware suggestions, search, selected chips, and custom fallback.
- Scope prompts show three priority signals first, with extra fields collapsed under "Add more scope details."

## Behavior Preserved

- Known target roles still auto-map to role families.
- "Change lane" still allows role-family override.
- Custom target role fallback still works.
- Custom company fallback still works.
- Custom tool fallback still works.
- Custom responsibility fallback still works.
- Selected tools still serialize to the existing `tools` field.
- Selected responsibilities still feed the existing generator data.
- Scope values still map to the same generator fields.
- Smoke tests still pass.

## Screenshots

Screenshot refresh was attempted against the local dev server using the in-app browser. The app loaded successfully, but the browser screenshot API repeatedly timed out on capture, including a viewport-only screenshot. Local Playwright was not installed, and no new screenshot dependency was added for this UI-only pass.

Existing screenshot files were left unchanged rather than committing stale or partially captured assets.

## Files Changed

- `src/components/IntakeForm.tsx`
- `SELECTION_UI_READABILITY_REPORT.md`

## Verification Results

- `npm run smoke:generator` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

## Commit And Push

- Implementation commit hash: `671a125`
- Push result: pushed to `origin/main` successfully.
