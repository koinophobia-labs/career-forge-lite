# Career Forge Interview Mode Mega 7 QA Report

Date: June 25, 2026

## Goal

Stress-test Interview Mode with deterministic real-user simulations and fix issues that prevented it from behaving like a credible conversational resume coach.

## Simulated Profiles

| Profile | Scenario | Readiness | Strength | Generated |
| --- | --- | --- | --- | --- |
| `vague_user` | Short answers such as "I helped customers" and "I used software" | Not ready | Draft | No |
| `strong_user` | Clear operations background with tools, metrics, and achievements | Ready | Strong | Yes |
| `career_changer` | Retail background targeting Administrative Assistant | Ready | Strong | Yes |
| `no_metrics_user` | Useful project coordination evidence but no numbers | Ready | Strong | Yes |
| `student_or_entry_level` | Coursework, class projects, tools, and no full-time tech role | Ready | Strong | Yes |
| `technical_founder` | Product/project builder with GitHub, shipped tools, and nontraditional employment | Ready | Application Ready | Yes |
| `customer_service_worker` | Frontline customer service with volume, conflict handling, and tools | Ready | Application Ready | Yes |

## QA Coverage Added

Created `npm run smoke:interview`, which runs `scripts/interview-mode-simulation.mjs`.

The runner verifies:

- Initial session creation and answer ingestion.
- Assistant acknowledgement after user answers.
- No exact duplicate questions.
- No near-duplicate question topics.
- Conversation score tracking.
- Smart interview summary facts.
- Readiness does not unlock too early.
- Expected facts are extracted into the draft or generated resume.
- Weak answers receive coaching instead of premature generation.
- Strong profiles can generate resume output.
- No fake metrics are invented.
- Gaps and weak positioning notes do not leak into resume body.
- Static builder generation still works.

## Issues Found

1. Student/entry-level path flagged distinct responsibility follow-ups as duplicates.
   - Cause: duplicate detection grouped all responsibility-style questions into one broad topic.
   - Fix: split question topics into `problem_solving`, `workflow_scope`, `role_bridge`, and `responsibility_detail`.

2. Technical founder path repeated a recent-role question.
   - Cause: project/product proof could be strong enough for a resume, but stage progression still required conventional role/company data.
   - Fix: allowed strong project evidence plus responsibilities, achievements, or education to satisfy the recent-experience checkpoint.

3. No-metrics path treated role dates as metrics.
   - Cause: metrics stage fallback accepted any answer containing a number.
   - Fix: removed the broad numeric fallback and filtered date ranges from metric extraction.

4. Target roles containing "Project" were misclassified as project evidence.
   - Cause: project extraction triggered on the word `project` alone.
   - Fix: project extraction now requires actual project-proof context such as built, created, launched, class project, dashboard, workflow, or similar evidence.

5. Education and gap fields accepted unrelated stage answers.
   - Cause: fallback logic stored any non-skip answer as education or positioning.
   - Fix: education now requires education/certification signals; gaps now require explicit gap/positioning signals.

6. Dotted framework names were truncated.
   - Cause: tool extraction stopped at periods, so `Next.js` became `Next`.
   - Fix: tool-clause extraction now preserves periods inside tool names while still trimming final punctuation.

7. Explicit title/company/date parsing was too brittle.
   - Cause: role extraction could miss natural answers like "I worked as an Administrative Coordinator at Northstar Services from 2024 - Present."
   - Fix: added a direct explicit-role parse before the looser fallback parser.

## Fixes Applied

- Added `scripts/interview-mode-simulation.mjs`.
- Added `npm run smoke:interview`.
- Hardened duplicate and near-duplicate question detection.
- Improved stage progression for nontraditional, project-heavy users.
- Improved role extraction for title/company/date answers.
- Prevented date ranges from being treated as metrics.
- Prevented broad project-role false positives.
- Prevented unrelated education/gap export contamination.
- Preserved tool names such as `Next.js`.

## Readiness Results By Profile

| Profile | Conversation Score | Weak Areas |
| --- | ---: | --- |
| `vague_user` | 4 | Work history, responsibilities, achievements, metrics, skills, projects |
| `strong_user` | 20 | Skills, projects |
| `career_changer` | 17 | Scope or metrics |
| `no_metrics_user` | 13 | Scope or metrics, skills |
| `student_or_entry_level` | 14 | Scope or metrics, skills |
| `technical_founder` | 25 | Work history |
| `customer_service_worker` | 18 | None |

## Verification Results

Commands run:

```bash
npm run smoke:interview
npm run smoke:generator
npm run lint
npm run typecheck
npm run build
```

Results:

- `npm run smoke:interview` passed. Seven simulated profiles completed with expected readiness outcomes.
- `npm run smoke:generator` passed. Generator smoke passed for 6 personas.
- `npm run lint` passed. `eslint .` completed with no errors.
- `npm run typecheck` passed. `tsc --noEmit` completed with no errors.
- `npm run build` passed. Next.js built `/` and `/interview` successfully.

## Remaining Risks

- The deterministic extractor still cannot infer nuanced role context as well as an LLM-backed parser.
- Technical founders and nontraditional builders may still show "Work history" as a weak area even when project evidence is strong.
- The no-metrics path is intentionally allowed to generate when other evidence is strong, but the output remains stronger if the user adds approximate scale.
- Near-duplicate detection is topic-based and intentionally conservative; future tuning may be needed as more follow-up prompts are added.

## Recommendation For Mega 8

Focus Mega 8 on browser-level Interview Mode QA and generated-output review from the UI:

- Run Playwright or browser automation through `/interview`.
- Verify mobile chat ergonomics.
- Verify premium preview limit behavior.
- Compare generated review text for the seven profiles.
- Add a small snapshot or fixture-based check for generated interview resume text.

## Final Status

Mega 7 QA pass is complete and verification is green.

Commit hash: Pending commit.
Push result: Pending push.
