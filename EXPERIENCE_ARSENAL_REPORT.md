# Experience Arsenal Intelligence Report

## Summary

Career Forge Lite now includes a local job-specific experience arsenal layer. When the interview recognizes a current, previous, additional, or target job title, it can suggest likely responsibilities, skills, workflows, and tools to help users remember what they actually did.

No backend, database, external API, login, analytics, payments, job boards, or AI integration were added.

## Jobs Covered

- Initial arsenal coverage: 100 job titles.
- Coverage includes common early-career, transfer, and associate-level roles across:
  - Sportsbook / gaming service
  - Security
  - Retail
  - Administrative support
  - Operations
  - Customer success and support
  - Sales
  - Business analysis and reporting
  - Project coordination
  - IT support
  - Tech and product-adjacent support

## Arsenal Categories

Each arsenal can include:

- Common responsibilities
- Transferable skills
- Common workflows
- ATS keywords
- Common tools
- Measurable activities
- Domain-specific language

## Interview Improvements

- Added a "People in this role commonly worked with..." panel on the responsibilities step.
- The panel appears only when a recognized title is found.
- Suggestions are grouped into:
  - Responsibilities
  - Skills
  - Workflows
  - Common tools
- Users must click items to confirm them.
- Confirmed responsibility, skill, and workflow chips are saved into existing selected responsibility signals.
- Confirmed tool chips are saved into the existing tools field.
- Custom fallback remains unchanged.

## Generator Improvements

- Generator logic was not structurally changed.
- Confirmed arsenal items flow through existing generator inputs:
  - selected responsibilities
  - selected tools
  - role family
  - source job title and company context
- This strengthens summaries, core skills, bullets, ATS keyword coverage, and LinkedIn output only when the user confirms the relevant experience.
- The app does not invent responsibilities from the arsenal automatically.

## Files Changed

- `src/lib/job-arsenal.ts`
- `src/lib/career-data.ts`
- `src/components/IntakeForm.tsx`
- `scripts/smoke-generator.mjs`
- `EXPERIENCE_ARSENAL_REPORT.md`

## Verification

- `npm run smoke:generator` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

## Commit And Push

- Commit hash: pending
- Push result: pending
