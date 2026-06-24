# Adaptive Questionnaire Report

## Summary

Career Forge Lite now adapts the questionnaire prompts to the selected role family while preserving the existing one-question-at-a-time Product Lab interview flow and generator data model.

This pass did not add login, payments, database storage, job boards, AI API integration, or new product scope.

## UX Changes Made

- Added role-aware scope prompts for every supported role family.
- Replaced the generic volume screen with adaptive prompts such as ticket count for IT Support, prospect volume for Sales, report volume for Business, and visitor/support volume for Security.
- Added an expandable "Add more scope details" area so users can still enter any existing scope field without crowding the main question.
- Added role-aware suggested outcomes so each role family sees the most relevant improvement areas first.
- Added a "Show all outcomes" control for users whose impact does not fit the suggested set.
- Updated the review dossier with an "Adaptive signals" item showing the selected role family and recommended outcome signals.

## Data Preservation and Generator Compatibility

- The existing `IntakeData` fields were preserved.
- No generator contract changed.
- Adaptive scope prompts write into the same fields already used by the generator:
  - `customersServed`
  - `ticketsHandled`
  - `projectsSupported`
  - `teamSizeSupported`
  - `callsHandled`
  - `reportsCreated`
  - `revenueInfluenced`
- Adaptive outcomes write into the existing `selectedOutcomes` and `outcomes` fields.
- Existing resume, LinkedIn, ATS validation, copy, and print/export behavior remain compatible.

## Validation Behavior

- Existing required validation remains unchanged:
  - full name
  - email
  - target role
  - current or most recent role
- Adaptive scope and outcome questions remain optional so users can continue even when they do not know exact metrics.
- Helper copy continues to encourage estimates where appropriate.

## Mobile Behavior

- The one-question interview remains mobile-first.
- Adaptive scope prompts stack cleanly on narrow screens.
- Outcome chips wrap instead of forcing horizontal scrolling.
- The expandable scope area keeps the primary question compact on mobile.

## Screenshots Updated

- `public/screenshots/landing.png`
- `public/screenshots/intake.png`
- `public/screenshots/responsibilities.png`
- `public/screenshots/ats-review.png`
- `public/screenshots/resume-preview.png`
- `public/screenshots/mobile.png` was recaptured during QA and did not require a committed visual diff.

## Files Changed

- `src/lib/career-data.ts`
- `src/components/IntakeForm.tsx`
- `public/screenshots/landing.png`
- `public/screenshots/intake.png`
- `public/screenshots/responsibilities.png`
- `public/screenshots/ats-review.png`
- `public/screenshots/resume-preview.png`
- `ADAPTIVE_QUESTIONNAIRE_REPORT.md`

## Verification Results

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

Build output confirmed:

- Next.js production build compiled successfully.
- TypeScript completed successfully.
- Static pages generated successfully.

## Commit and Push

- Commit hash: pending final commit.
- Push result: pending final push.

## Remaining Limitations

- Scope and outcome intelligence is deterministic and rule-based.
- Users still need to provide honest estimates; the app does not verify numbers.
- The generator remains local/mock only and does not call an AI API.

## Next Recommended Patch

Add lightweight manual QA notes around edge cases, especially sparse input, no scope data, and users selecting a role family after entering responsibilities.
