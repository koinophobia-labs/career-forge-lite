# Career Forge Lite - Questionnaire Experience Report

## Summary

The grouped intake form was replaced with a focused one-question-at-a-time Product Lab interview. The experience now feels more like a guided `career://interview` dossier and less like filling out a long form, while preserving the same local state fields and resume generator behavior.

## Files Changed

- `src/components/IntakeForm.tsx`
- `src/components/LandingPage.tsx`
- `public/screenshots/landing.png`
- `public/screenshots/intake.png`
- `public/screenshots/responsibilities.png`
- `public/screenshots/ats-review.png`
- `public/screenshots/resume-preview.png`
- `public/screenshots/mobile.png`
- `QUESTIONNAIRE_EXPERIENCE_REPORT.md`

## UX Changes Made

- Replaced the previous grouped six-step intake with 15 focused interview questions.
- Added `Question 01 / 15` progress language and a thin cyan progress bar.
- Reframed the intake as `career://interview` with Product Lab / Module 05 language.
- Kept Back and Continue navigation on every question.
- Reduced visible form density by showing one main prompt at a time.
- Kept grouped fields only where practical:
  - phone + portfolio
  - company + dates
  - optional role details
  - scope/volume estimates
- Added a final review dossier before generation with editable sections:
  - Contact
  - Target
  - Roles
  - Tools
  - Responsibilities
  - Scope
  - Outcomes
  - Template

## Data Preservation

The component still uses the existing `IntakeData` shape and the same parent callbacks:

- `onChange`
- `onValidate`
- `onTemplateSelect`
- `onGenerate`

No generator contract was changed. Existing captured fields remain preserved:

- name
- email
- phone
- website
- target role
- role family
- current role
- previous role
- optional third role
- tools/software
- responsibilities
- selected responsibility chips
- customers, tickets, projects, team size, calls, reports, revenue
- outcomes improved
- template selection

## Validation Behavior

- Required validation is preserved for:
  - full name
  - email
  - target role
  - current or most recent role
- Required errors still appear inline on the relevant question.
- Optional questions can be skipped.
- The final review screen lets users jump back to edit sections before generating.

## Mobile Behavior

- The interview card stacks into a single-column mobile layout.
- The question context appears first, followed by the answer area.
- Buttons remain large enough for mobile use.
- The layout avoids horizontal scrolling and keeps the resume output unchanged.

## Screenshots Updated

- `public/screenshots/landing.png`
- `public/screenshots/intake.png`
- `public/screenshots/responsibilities.png`
- `public/screenshots/ats-review.png`
- `public/screenshots/resume-preview.png`
- `public/screenshots/mobile.png`

## Verification Results

- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm run build` - passed

## Commit And Push

- Commit hash: pending
- Push result: pending

## Remaining Limitations

- The resume generator remains deterministic mock logic.
- Data remains local browser state only.
- Browser print remains the lightweight export path.
- The one-by-one interview is intentionally not a saved account or multi-session onboarding system.
