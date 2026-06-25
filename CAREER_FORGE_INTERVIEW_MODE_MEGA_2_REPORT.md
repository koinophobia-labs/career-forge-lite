# Career Forge Interview Mode Mega 2 Report

## Summary

Upgraded Interview Mode from an architecture preview into a functional deterministic extraction engine. User answers now populate the hidden `InterviewResumeDraft`, field readiness updates live, stage progression waits for usable information, and the assistant asks focused follow-up questions instead of repeating fixed stage prompts.

## Files Changed

- `src/lib/interview-mode.ts`
- `src/components/InterviewMode.tsx`
- `scripts/smoke-generator.mjs`
- `CAREER_FORGE_INTERVIEW_MODE_MEGA_2_REPORT.md`

## Extraction Heuristics Added

- Target extraction:
  - Detects target role from conversational phrases such as “targeting” or “aiming for.”
  - Detects industry from “in,” “within,” or “for” clauses.
  - Detects experience level phrases such as entry-level, early-career, junior, senior, or career changer.
- Role extraction:
  - Extracts current/recent title, company, and time in role from conversational answers.
- Responsibility extraction:
  - Detects phrases using responsible-for/action language such as handled, supported, coordinated, tracked, documented, resolved, prepared, scheduled, and escalated.
- Achievement extraction:
  - Detects result-oriented language such as improved, built, led, created, reduced, increased, launched, automated, implemented, trained, saved, grew, and delivered.
  - Tightened false positives so ordinary dates and responsibility verbs do not count as achievements.
- Metric extraction:
  - Detects numbers, percentages, dollar amounts, time/volume signals, customers, tickets, calls, reports, projects, transactions, teams, and requests.
- Tool extraction:
  - Uses the existing local `allToolOptions` bank.
  - Also extracts short comma-list tools from phrases like “used,” “worked with,” “tools like,” “platforms like,” and “systems like.”
- Skills extraction:
  - Detects transferable skill language such as documentation, record keeping, issue escalation, conflict resolution, reporting, troubleshooting, cash handling, compliance, and process improvement.
- Education/certification extraction:
  - Detects degree, certification, certificate, bootcamp, course, university, college, school, training, license, diploma, bachelor’s, and master’s language.
  - Avoids treating job-title words such as “Associate” as education.
- Project and gap extraction:
  - Detects project/portfolio/workflow proof.
  - Detects positioning concerns such as “I don’t have,” “I lack,” “not much experience,” “still learning,” “career change,” and “limited direct experience.”

## Stage Progression Behavior

- Stages now advance when their required fields are at least usable.
- Weak or vague answers keep the user on the current stage and trigger a better follow-up.
- Optional stages such as metrics, projects, education, and gaps can move forward after a best-effort answer or skip.
- Resume generation now requires:
  - usable target role
  - usable current/recent role
  - usable responsibilities
  - usable tools or skills
  - usable achievement or project
- Metrics improve confidence but are not strictly required.

## Assistant Question Generator

Added `getNextAssistantQuestion(session)`:

- Uses current stage and missing/weak field state.
- Asks one focused question at a time.
- Avoids repeating the most recent assistant question when alternatives exist.
- Prompts for specifics such as examples, metrics, tools, impact, projects, education, or positioning concerns.

## UI Updates

- Interview Mode now uses `getNextAssistantQuestion(session)` after each user answer.
- Sidebar now shows:
  - current stage
  - readiness score
  - counts for strong, usable, weak, and empty fields
  - missing/weak field list
- Added a collapsible extracted draft preview for:
  - target role
  - responsibilities
  - achievements
  - metrics
  - tools
  - skills
  - projects

## Smoke Test Coverage Added

`npm run smoke:generator` now verifies:

- weak target answers stay on the target stage
- assistant follow-up generation responds to weak answers
- target role and industry extraction
- background-stage progression
- current role title/company/date extraction
- responsibility extraction
- achievement extraction
- metric extraction
- tool extraction
- skill extraction
- field status scoring from specificity
- generation remains disabled until required data exists
- conversion into the existing `IntakeData` shape
- generated export remains clean
- existing static builder persona smoke checks still pass

## Verification Results

- `npm run smoke:generator` - PASS
- `npm run lint` - PASS
- `npm run typecheck` - PASS
- `npm run build` - PASS

## Known Limitations

- Extraction is deterministic and intentionally conservative; it does not infer facts the user did not provide.
- The Interview Mode route still stops at readiness/generation confirmation rather than opening the full existing resume review UI.
- Contact information is not yet collected through Interview Mode.
- The extractor recognizes common phrasing, but unusual sentence structure may still require follow-up answers.
- No real AI API call, login, database, analytics, payments, or job board integration was added.

## Next Recommended Mega Input

Wire Interview Mode into the full resume review package: collect contact details conversationally, let the user inspect/edit the converted `IntakeData`, and render the existing Resume Preview, ATS Validation, LinkedIn Preview, copy, and print/export controls from the interview-derived data.

## Git Status

- Commit hash: `83f1221`
- Push result: Pending
