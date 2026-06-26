# Reactive Interview Logic Report

## Summary

Added deterministic interview state awareness so Guided Interview and Tell My Story mode can react to what the user already provided instead of asking every possible follow-up.

No backend, login, payments, database, job boards, external APIs, analytics, or AI API integration were added.

## Reactive Rules Added

Career Forge now checks whether the intake already has:

- Contact info
- Target role
- Mapped role family
- Recent role
- Company or independent work source
- Dates or time in role
- Tools
- AI workflows when AI tools are selected
- Responsibilities and action signals
- Independent work context
- Unknown role context
- Scope/proof
- Outcomes
- Education or training notes

## State and Missing Signal Logic

Added `src/lib/interview-state.ts` with:

- `getInterviewState()`
- `getMissingSignals()`
- `hasEnoughResumeSignal()`
- `getNextUsefulPrompt()`
- `mergeReactiveSignals()`

The helper scores missing signals by priority and returns the smallest next useful question.

High-priority missing signals include target role, recent role, company/source, dates, AI workflow follow-up, independent work context, unknown role context, tools, responsibilities, scope, and outcomes.

## Prompts Skipped Based on Captured Info

Tell My Story mode now avoids asking for role/company/dates again when the story already contains them.

Examples covered by smoke tests:

- Story with DraftKings + sportsbook writer + 2023-present does not ask for company, role, or dates again.
- Story with AI tools asks for AI workflow usage.
- Story without AI tools skips AI workflow follow-up.
- Unknown roles ask for role context instead of the full questionnaire.
- Independent work can generate once enough source/context signal exists.

## Guided Interview Reactivity

Guided Builder now runs free-text target and role answers through `mergeReactiveSignals()`.

Example:

Input:

`I want customer success because I handled escalations at DraftKings.`

Captured:

- Target role: Customer Success Associate
- Role family: Customer Success
- Company: DraftKings
- Responsibility signal: Escalation handling

This preserves useful extra information instead of ignoring it.

## Enough-Signal Behavior

When enough signal exists, Guided Builder shows:

`You gave Career Forge enough signal to build your first resume package.`

Users can:

- Generate now
- Keep adding detail

Tell My Story mode also unlocks generation from the shared signal score rather than a rigid company/title/responsibility-only check.

## Tests Added

Expanded generator smoke coverage for:

- Story input with role/company/dates does not ask for those again
- Story input with AI tools asks AI workflow follow-up
- Story input without AI tools skips AI workflow follow-up
- Unknown role triggers fallback context
- Known role uses existing arsenal
- Enough signal allows Generate now
- Extra free text in Guided Builder gets captured
- Generated resume remains ATS-safe

## Files Changed

- `src/lib/interview-state.ts`
- `src/lib/story-mode.ts`
- `src/components/TellMyStoryMode.tsx`
- `src/components/IntakeForm.tsx`
- `scripts/smoke-generator.mjs`
- `REACTIVE_INTERVIEW_LOGIC_REPORT.md`

## Verification Results

Passed:

- `npm run smoke:resume-intelligence`
- `npm run smoke:generator`
- `npm run smoke:interview`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Commit and Push

Commit hash and push result are reported in the final task response after commit and push complete.
