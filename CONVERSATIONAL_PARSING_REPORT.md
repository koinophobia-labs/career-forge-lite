# Conversational Parsing Report

## Summary

Added lightweight deterministic parsing for natural role/company/date answers in the guided intake. Users can now answer role-history prompts conversationally, and Career Forge will fill the existing structured resume fields when it can.

This does not add a backend, database, external API, analytics, or AI integration.

## Parsing Cases Supported

### Founded Company In Year

Input:

`I founded Koinophobia Labs in 2025`

Parsed as:

- Title: Founder
- Company: Koinophobia Labs
- Dates: 2025-Present

### Worked At Company As Title From Year To Now

Input:

`I worked at DraftKings as a sportsbook writer from 2024 to now`

Parsed as:

- Title: Sportsbook Writer
- Company: DraftKings
- Dates: 2024-Present

### Role At Company For Duration

Input:

`I was a security officer at Allied Universal for two years`

Parsed as:

- Title: Security Officer
- Company: Allied Universal
- Dates / time in role: 2 years

## Fallback Behavior

When parsing confidence is low, Career Forge does not ask the user to re-enter everything. It shows one focused follow-up based on the missing field:

- What was your title?
- What company was that with?
- What dates or time in role should I use?

The UI avoids technical parsing language and instead says, `I read that as...`

## Manual Edit Behavior

After a natural answer is parsed, users see:

- Looks right
- Edit details

Choosing Edit details reveals the existing structured fields for title, company, and dates. This preserves the original manual path and keeps all resume generation data compatible with the existing `IntakeData` shape.

## Data Compatibility

Parsed answers populate the existing fields:

- `currentTitle`, `currentCompany`, `currentTime`
- `previousTitle`, `previousCompany`, `previousTime`
- `additionalTitle`, `additionalCompany`, `additionalTime`

The resume generator continues using the same structured data and was not rewritten.

## Tests Added

Smoke coverage now validates:

- founded company in year
- worked at company as title from year to now
- role at company for X years
- low-confidence fallback
- confirmation UI copy
- manual edit copy
- generated resume output uses parsed fields correctly

## Files Changed

- `src/lib/natural-role-parser.ts`
- `src/components/IntakeForm.tsx`
- `scripts/smoke-generator.mjs`
- `CONVERSATIONAL_PARSING_REPORT.md`

## Verification Results

Commands run:

- `npm run smoke:resume-intelligence` - passed
- `npm run smoke:generator` - passed
- `npm run smoke:interview` - passed
- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm run build` - passed

Build result:

- Next.js production build completed successfully.
- Static routes prerendered: `/`, `/_not-found`, `/interview`

## Commit And Push

- Feature commit hash: `8fbe5209c6a4e05bfcfe0669d0e47776517303fd`
- Push result: pushed to `origin/main`
