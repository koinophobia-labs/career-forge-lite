# PDF Export Fix Report

## Issue Found

The print stylesheet hid non-resume UI with `visibility: hidden`, which prevented visible chrome from leaking into print but still allowed the hidden app layout to reserve page height. That could create blank or excessive pages when users saved the resume as a PDF.

The printable target also lived at the broader resume review section level, so the export path depended on hiding the review controls correctly instead of treating the resume paper as the primary print document.

## CSS And Markup Changes

- Added `id="print-resume"` to the resume article so the actual resume document is the print target.
- Updated print CSS to remove non-resume app chrome from print layout with `main > :not(#resume) { display: none !important; }`.
- Kept only the resume review section available during print and hid its screen-only controls.
- Added `@page` margins and compact print typography for real resume spacing.
- Removed glows, dark backgrounds, shadows, borders, and decorative template accents during print.
- Forced print output to white paper with black resume text.
- Reduced printed section spacing, heading size, list spacing, and header spacing.
- Kept sections together where practical while avoiding the large spacing that could cause page bloat.
- Filtered blank skills, empty roles, empty education text, and blank bullets from printed/copied resume output.

## Personas Tested

PDF page counts were tested from the local production build using headless Chrome print-to-PDF against the real app flow.

| Persona | Result |
| --- | --- |
| Sportsbook Ticket Writer targeting Customer Success Associate | 1 page |
| Security Officer targeting Operations Associate | 1 page |
| Customer Success Associate | 1 page |
| IT Support | 1 page |
| Project Coordinator | 1 page |

## Page Count Results

All tested normal-content resumes exported to 1-page PDFs. No blank extra pages were produced in the regression pass.

Longer user-edited content can still exceed one page, but the print path now uses compact resume spacing and should stay within 2 pages for reasonable longer drafts.

## Verification Results

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.
- `node work/pdf-export-page-test.mjs` passed during QA before the temporary script and generated PDF artifacts were removed.

## Files Changed

- `src/components/ResumePreview.tsx`
- `src/app/globals.css`
- `PDF_EXPORT_FIX_REPORT.md`

## Commit And Push

- Commit hash: pending.
- Push result: pending.
