# Resume Substance Hardening Report

## Summary

This pass hardened Career Forge Lite's deterministic resume generator, export safety, ATS validation, and launch regression protection. It did not redesign the site, add accounts, payments, database storage, job boards, analytics, or AI API integration.

## Issues Fixed

- Reduced syntactically awkward bullets by moving to explicit role-family bullet pattern libraries.
- Reduced global tool/scope leakage by applying tools primarily to current-role bullets and using lighter prior-role bullets.
- Improved source-domain plus target-role blending so bullets ground the user's actual background while still connecting to the selected target family.
- Added weak-input guards for custom responsibilities, tools, company names, outcomes, and time-in-role values.
- Added a lightweight role-aware action follow-up inside the existing responsibility step.
- Expanded ATS validation beyond basic headings and action verbs.
- Prevented the education placeholder from being included in copied or printed resume exports.
- Omitted empty optional section bodies from copy/export text.
- Added a committed generator smoke test covering six launch personas.
- Replaced the fixed LinkedIn summary formula with role-family-specific summary variants.

## Generator Changes

- Added 8 hand-authored bullet patterns for each role family, including Customer Success, Operations, Admin, Sales, Business, Project Coordination, IT Support, Tech, and Security.
- Bullet output now follows a simple 3-bullet strategy:
  - grounded current role/domain bullet
  - transferable workflow/process/tool bullet
  - target-role bridge bullet
- Added `selectedActions` as a small extra signal so users can indicate how they did the work without adding another interview screen.
- Added safer input normalization so weak values like `test`, `asdf`, `n/a`, one-letter entries, and repeated symbols are ignored where appropriate.
- Added LinkedIn summary variants by role family to avoid repeated template fingerprints.

## Smoke Test Details

Added:

- `npm run smoke:generator`
- `scripts/smoke-generator.mjs`

Personas covered:

- Sportsbook Ticket Writer -> Customer Success Associate
- Sportsbook Supervisor -> Operations Associate
- Security Officer -> Operations Associate
- Retail Associate -> Administrative Assistant
- Entry-level IT Support -> Help Desk Technician
- Project Coordinator -> Project Coordinator

Assertions cover:

- no blank bullets
- no duplicate bullets
- no repeated noun issues such as `customers customers`
- no weak target leakage such as `ee`, `test`, or `asdf`
- no UI labels in export text
- no placeholder education in export text
- summary is 1-3 sentences
- each role has a reasonable bullet count
- output includes the selected target role
- no known unnatural tool phrase such as `managed onboarding using Python`

## Export Fixes

- Added `src/lib/resume-export.ts` to centralize copy/export text generation.
- Omitted placeholder education from exported resume text.
- Omitted empty section bodies from exported resume text.
- Kept the education placeholder editable in the UI while preventing it from leaving the app as real resume content.

## ATS Validation Improvements

Added ATS warnings for:

- duplicate bullets
- summary length issues
- missing company or time context
- placeholder education
- empty core sections
- suspicious repeated phrases
- too few or too many bullets per role
- repeated opening verbs inside a role

No fake ATS score was added.

## Remaining Limitations

- Tools and scope are still collected globally, so the generator remains conservative with older roles.
- The deterministic generator cannot infer exact achievements beyond the user's inputs.
- The smoke test is intentionally lightweight and does not replace full browser workflow QA.
- Final resume copy should still be reviewed by the user before applying to a specific job.

## Verification Results

- `npm run smoke:generator` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

Build output confirmed:

- Next.js production build compiled successfully.
- TypeScript completed successfully.
- Static pages generated successfully.

## Files Changed

- `package.json`
- `scripts/smoke-generator.mjs`
- `src/components/IntakeForm.tsx`
- `src/components/ResumePreview.tsx`
- `src/lib/ats.ts`
- `src/lib/career-data.ts`
- `src/lib/generator.ts`
- `src/lib/resume-export.ts`
- `src/types/career.ts`
- `RESUME_SUBSTANCE_HARDENING_REPORT.md`

## Commit And Push

- Implementation commit hash: `a25f19c`.
- Push result: pushed to `origin/main` successfully.
