# Unknown Role Fallback Report

## Summary

Career Forge Lite now handles custom or unknown job titles with a lightweight fallback context layer. If a typed role is not found in the career target bank or job arsenal, the interview asks for a few practical signals so the generator can translate the role without guessing.

No backend, database, external API, login, payments, job boards, analytics, or AI integration were added.

## What Triggers Fallback

Fallback context appears when any entered target, current, previous, or additional role title is not recognized by:

- an exact career target title
- an exact job arsenal title
- a job arsenal alias

Partial matching was intentionally tightened so a title like `Casino Cage Cashier` is not incorrectly treated as the known `Cashier` arsenal.

## Industries Supported

- Retail
- Customer Service
- Hospitality
- Gaming / Sportsbook
- Healthcare
- Finance
- Banking
- Insurance
- Logistics
- Warehouse
- Manufacturing
- Technology
- Education
- Government
- Security
- Food Service
- Entertainment
- Nonprofit
- Other

Custom industry input remains available.

## Work Styles Supported

- Customer-facing
- Administrative
- Operations
- Sales
- Technical support
- Data / reporting
- Coordination
- Management / supervision
- Physical / field work
- Compliance / safety
- Cash handling
- Inventory / fulfillment
- Creative / content
- Other

Multiple selections and custom work styles are supported.

## Transferable Skill Chips

- Customer communication
- Cash handling
- Payment processing
- Documentation
- Scheduling
- Record keeping
- Issue escalation
- Conflict resolution
- Compliance
- Policy enforcement
- Inventory tracking
- Reporting
- Team coordination
- Training others
- Data entry
- Quality control
- Safety procedures
- Technical troubleshooting
- Process improvement
- High-volume service

Multiple selections and custom transferable skills are supported.

## Generator Behavior

When a job arsenal exists, Career Forge continues using the arsenal and role-aware prompts.

When a role is unknown, Career Forge now uses confirmed fallback context to influence:

- resume summary environment
- core skills
- experience bullet responsibilities
- process/workflow language
- LinkedIn headline and summary strengths

The generator does not invent unconfirmed duties. It only uses fallback industry, work styles, transferable skills, and notes that the user provides.

## Review Dossier

The review step now shows custom role context when fallback was triggered:

- Industry
- Work style
- Transferable skills
- Optional notes

The review item links back to the responsibilities step for editing.

## Tests Added

`npm run smoke:generator` now checks:

- known roles do not need fallback
- unknown roles trigger the fallback path
- fallback industry/work style/skills appear in generated output
- fallback resume generation has no blank bullets
- placeholder education is omitted from export text
- weak target/UI leakage does not appear

## Files Changed

- `src/types/career.ts`
- `src/lib/career-data.ts`
- `src/lib/job-arsenal.ts`
- `src/lib/generator.ts`
- `src/components/IntakeForm.tsx`
- `scripts/smoke-generator.mjs`
- `UNKNOWN_ROLE_FALLBACK_REPORT.md`

## Verification Results

- `npm run smoke:generator` passed.
- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

## Commit And Push

- Implementation commit hash: `a0f8cb5`
- Push result: pushed to `origin/main` successfully.
