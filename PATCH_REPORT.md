# Career Forge Lite Patch Report

## What Was Broken or Incomplete

- The intake only supported two roles and could not collect the requested optional third role.
- Required fields were not validated before users moved into template selection or generation.
- Users could bypass intake requirements through the workflow navigation.
- The mock generator did not use time-in-role strongly and only produced bullets for current and previous roles.
- Resume copying worked only at the full-resume level.
- Clipboard behavior depended only on `navigator.clipboard`.
- Empty generated experience states were not handled clearly.

## What Was Fixed

- Added support for up to three roles: current/most recent, previous, and optional additional role.
- Added validation for required name, email, target role, and current role.
- Routed workflow navigation and template generation through the same validation gate.
- Improved deterministic mock generation so bullets use target role, role family, tools/software, selected and free-text responsibilities, time in role, and measurable scope/outcomes.
- Kept resume output ATS-safe: single-column, standard headings, no icons, no sidebars, no tables, no charts, no skill bars.
- Added editable generated sections for Summary, Core Skills, Experience bullets, Education, LinkedIn headline, and LinkedIn summary.
- Added copy buttons for full resume, Summary, Core Skills, Experience, Education, LinkedIn headline, and LinkedIn text.
- Added clipboard fallback for browsers where `navigator.clipboard` is unavailable.
- Improved mobile button/layout behavior in the intake and resume preview.
- Kept templates limited to Corporate, Modern ATS, and Tech ATS.
- Confirmed exported/copied resume content does not include Koinophobia Labs branding.

## Files Changed

- `README.md`
- `PATCH_REPORT.md`
- `src/app/page.tsx`
- `src/components/CopyButton.tsx`
- `src/components/IntakeForm.tsx`
- `src/components/LandingPage.tsx`
- `src/components/ResumePreview.tsx`
- `src/lib/career-data.ts`
- `src/lib/generator.ts`
- `src/types/career.ts`

## How To Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification Commands

Run before shipping:

```bash
npm run lint
npm run typecheck
npm run build
```

## Remaining Known Limitations

- Resume generation is deterministic mock logic, not connected to an AI API yet.
- Print / Save PDF uses the browser print dialog rather than a dedicated PDF renderer.
- Data is stored only in local React state and resets on refresh.
- No accounts, saved drafts, job matching, payments, or database are included by design.
