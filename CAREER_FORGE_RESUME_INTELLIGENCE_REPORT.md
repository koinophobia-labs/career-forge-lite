# Career Forge Resume Intelligence Report

## Summary

Mega Input 11 focused on resume output quality, not product scope. This pass adds a deterministic resume intelligence layer that polishes generated content after the existing generator runs, then surfaces a user-facing Resume Quality signal in the review experience.

Career Forge now does a better job translating messy input into recruiter-ready resume language while preserving the core rule: no invented experience, no invented metrics, and no exaggerated claims.

## Output Audit Findings

- Generated bullets were structurally solid but still needed a final grammar, punctuation, and weak-language pass.
- Weak user phrasing such as "I helped customers" and "I stocked shelves" needed deterministic professional rewrites.
- Repeated opening verbs could still make a role feel mechanical.
- Skills could contain duplicate or inconsistently capitalized terms.
- Resume review had ATS checks, but did not yet summarize resume-writing quality separately from ATS compatibility.
- LinkedIn output benefited from headline length cleanup and acronym normalization.
- Export formatting was already ATS-safe, but the preview needed clearer coaching about what was strong and what still needed proof.

## Files Changed

- `src/lib/resume-intelligence.ts`
- `src/lib/generator.ts`
- `src/components/ResumePreview.tsx`
- `scripts/smoke-generator.mjs`
- `CAREER_FORGE_RESUME_INTELLIGENCE_REPORT.md`

## Pipeline Architecture

Added `src/lib/resume-intelligence.ts` with a post-generation polish pipeline:

1. Spelling and acronym normalization
2. Weak opener replacement
3. Weak filler removal
4. Sentence casing
5. Punctuation normalization
6. Duplicate bullet removal
7. Action verb diversification
8. Skill cleanup and deduplication
9. LinkedIn headline cleanup
10. Resume Quality analysis and coaching

The existing generator remains the source of resume content. The new intelligence layer runs at the end of `generateResumePackage()` so both the free builder and Interview Mode benefit from the same polish.

## Grammar Improvements

Added deterministic rewrites for weak but common user input:

- "I helped customers" becomes a stronger customer-support sentence.
- "I stocked shelves" becomes inventory and operations language.
- Common spelling issues such as "customer sucess," "adminstrative," and "comunication" are corrected.
- Common acronyms such as CRM, ATS, SQL, IT, API, KPI, POS, QA, UI, and UX are normalized.
- Repeated noun issues such as "customers customers" and "tickets tickets" are cleaned.

## Writing Improvements

Added action verb diversification for bullets within the same role. Repeated openers are rotated through professional verbs when it can be done without changing meaning.

The polish layer also removes vague filler terms including:

- stuff
- things
- various
- candidate targeting

The goal is concise, truthful improvement rather than inflated writing.

## ATS Formatting Improvements

The resume body remains ATS-safe:

- single column
- standard section headings
- no icons in resume content
- no tables
- no sidebars
- no graphics or skill bars
- UI copy remains outside printed/exported resume content

The review screen now adds a Resume Quality panel outside the resume paper so coaching does not leak into exported resume content.

## Resume Quality Scoring

Added `analyzeResumeQuality()` to evaluate writing quality separately from ATS validation.

Ratings:

- Needs Work
- Good
- Strong
- Excellent

Signals considered:

- summary completeness
- skill coverage
- bullet count
- repeated opening verbs
- measurable scope
- action/result language
- leadership or collaboration evidence
- project or portfolio evidence
- role/company/date completeness
- obvious weak or awkward wording

This is intentionally not presented as an ATS score.

## Preview Polish

`ResumePreview` now shows:

- Resume Quality rating
- strongest sections
- suggested improvements
- reminder that the rating is a writing-quality signal, not an ATS score

This gives users clearer coaching before copying or printing the resume.

## Smoke Test Additions

`scripts/smoke-generator.mjs` now checks:

- grammar pipeline strengthens weak customer phrasing
- stocked-shelves phrasing is rewritten professionally
- repeated opening verbs are diversified
- skills are normalized and deduplicated
- filler terms are removed
- generated resumes receive a quality rating
- generated roles avoid repeated opening verbs where possible
- fake metrics are not introduced
- ATS-safe exported text still includes standard sections

## Verification Results

Commands run:

- `npm run smoke:generator` - passed
- `npm run smoke:interview` - passed
- `npm run lint` - passed
- `npm run typecheck` - passed
- `npm run build` - passed

Build result:

- Next.js production build completed successfully.
- Routes prerendered: `/`, `/_not-found`, `/interview`

## Known Limitations

- The grammar engine is deterministic and limited to known weak patterns.
- It does not perform full natural-language grammar correction.
- Quality scoring is heuristic and should be treated as coaching, not a hiring or ATS prediction.
- The engine improves wording but cannot replace missing user evidence.
- Metrics are never invented; if users provide no scope, coaching remains the correct path.

## Future Ideas

- Add a broader phrase library for more frontline, technical, and project-based roles.
- Add tense normalization by current vs. past role.
- Add role-specific LinkedIn summary variants.
- Add browser-based print snapshot smoke checks.
- Add a small UI disclosure explaining how Resume Quality differs from ATS validation.

