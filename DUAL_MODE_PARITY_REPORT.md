# Guided Interview vs Tell My Story Parity Report

## Summary

Audited Career Forge Lite's two resume-building modes to answer one product question:

Can two users with the same work history receive equally strong resumes regardless of whether they choose Guided Interview or Tell My Story?

Result: the modes now converge on equivalent resume quality while preserving different intake experiences.

## Capture Comparison

| Signal | Guided Interview | Tell My Story | Result |
| --- | --- | --- | --- |
| Role | Captured through focused prompt | Parsed from natural role language | Equivalent |
| Company | Captured through role detail prompt | Parsed from natural role language | Equivalent |
| Dates | Captured through role detail prompt | Parsed from date phrases such as `from 2023 to now` | Equivalent |
| Target role | Captured through target prompt | Parsed from targeting language or inferred fallback | Equivalent |
| Responsibilities | Captured through chips/custom text | Parsed from action/responsibility language | Equivalent |
| Tools | Captured through searchable selection | Parsed from tool names and tool clauses | Equivalent |
| AI workflows | Captured after AI tool selection | Parsed only when AI tools and workflows are mentioned | Equivalent |
| Arsenal items | Captured through role-aware suggestions | Inferred from known role/independent work context and confirmed story signals | Equivalent |
| Measurable scope | Captured through scope prompts | Parsed from numbers, frequency, volume, reports, customers, projects, and money language | Equivalent |
| Outcomes | Captured through outcome chips | Parsed from transferable/result language such as accuracy, efficiency, reliability, satisfaction, and compliance | Equivalent |
| Independent work | Captured through independent context | Detected from gig, creator, side-business, freelance, and self-employed story language | Equivalent |
| Education | Captured through review/edit path | Fixed: now parsed from story language and carried into generated resume data | Equivalent |

## Resume Comparison

Both modes feed the same `generateResumePackage()` pipeline and therefore receive the same resume intelligence, ATS formatting, LinkedIn headline generation, quality checks, and export cleanup.

Compared output for these identical-work-history personas:

- Sportsbook Ticket Writer -> Customer Success Associate
- Security Officer -> Operations Associate
- Retail Associate -> Administrative Assistant
- Entry-level IT Support -> Help Desk Technician
- Project Coordinator -> Project Coordinator
- Content Creator -> Social Media Manager
- Uber Driver -> Operations Associate
- Etsy Seller -> Customer Success Associate
- Founder using AI workflows -> Product Operations Associate

For each persona, smoke coverage now verifies:

- Both modes generate substantive summaries.
- Both modes produce populated core skills.
- Both modes generate at least three professional bullets.
- Both modes preserve the target role in LinkedIn output.
- Both modes omit placeholder education.
- Both modes avoid fake metrics, placeholder language, and generic AI phrasing.
- Tell My Story reaches a signal score within an acceptable parity band of Guided Interview.

## Conversation Comparison

Guided Interview remains structured and best for users who want memory-jogging prompts.

Tell My Story remains narrative and best for users who can describe their experience in paragraphs.

The audit confirmed:

- Guided Interview captures extra free-text signals through reactive parsing.
- Tell My Story does not re-ask for role, company, or dates after extracting them.
- Tell My Story asks focused follow-ups only for missing high-value signals.
- AI workflow follow-ups trigger only when AI tools are present.
- Unknown and independent roles still receive context prompts instead of being ignored.

## Signal Score Comparison

Added an internal `getResumeSignalScore()` helper. This is not shown to users and is not an ATS score.

Tracked signals:

- Role
- Company
- Dates
- Target role
- Responsibilities
- Tools
- AI workflows
- Arsenal
- Scope
- Outcomes
- Independent work
- Education

The score helps smoke tests confirm that both modes converge toward comparable completeness without forcing identical UI.

## Friction Comparison

Guided Interview:

- More clicks
- More structured prompts
- Better for users who need help remembering details
- Lower risk of missing a category because the flow presents it directly

Tell My Story:

- More typing up front
- Fewer required prompts when the story is complete
- Faster for experienced users, founders, managers, and narrative thinkers
- Higher dependency on parsing, now protected by signal-score and missing-info checks

## Parity Issues Found

1. Story Mode could recognize education as captured but did not carry it into the generated resume package.
   - Impact: a Story Mode user mentioning education could receive a weaker resume than a Guided Interview user who edited education later.
   - Fix: added `education` to shared intake data, wired it into generation, and added deterministic Story Mode education extraction.

2. Story Mode dossier did not visibly show AI workflow or education extraction.
   - Impact: users could not easily verify those signals before generation.
   - Fix: added AI workflows and Education rows to the extracted dossier.

3. There was no internal parity scoring for the two modes.
   - Impact: future changes could make one mode silently weaker.
   - Fix: added `getResumeSignalScore()` and smoke assertions comparing Guided Interview vs Tell My Story personas.

## Fixes Made

- Added a shared `education` field to `IntakeData`.
- Added `education` to `initialIntake`.
- Updated `generateResumePackage()` to use real intake education when provided.
- Updated Interview Mode conversion so extracted education/certifications can enter the shared generator input.
- Updated Story Mode parsing to extract education/certification/training language.
- Updated Story Mode dossier UI to show AI workflows and education.
- Added internal resume signal scoring.
- Added dual-mode parity smoke tests across edge-case personas.

## Remaining Intentional Differences

- Guided Interview remains structured, chip-driven, and memory-jogging.
- Tell My Story remains narrative-first and parser-driven.
- Guided Interview may ask more questions because it is designed for users who need structure.
- Tell My Story may reach generation faster when the user provides a complete story.
- Output wording can differ because extracted signals may be phrased differently, but core substance and professionalism should remain equivalent.

## Files Changed

- `src/types/career.ts`
- `src/lib/career-data.ts`
- `src/lib/generator.ts`
- `src/lib/interview-state.ts`
- `src/lib/interview-mode.ts`
- `src/lib/story-mode.ts`
- `src/components/TellMyStoryMode.tsx`
- `scripts/smoke-generator.mjs`
- `DUAL_MODE_PARITY_REPORT.md`

## Verification Results

Passed:

- `npm run smoke:resume-intelligence`
- `npm run smoke:generator`
- `npm run smoke:interview`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Recommendation

Both modes are product-aligned:

- Keep Guided Interview as the structured free path.
- Keep Tell My Story as the fast narrative path.
- Continue testing them against the same personas whenever generator or parser behavior changes.

## Are Guided Interview and Tell My Story equivalent in resume quality?

YES

They now preserve different user experiences while converging on equivalent professional resume output.
