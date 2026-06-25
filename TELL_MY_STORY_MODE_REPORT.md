# Tell My Story Mode Report

## Summary

Added a deterministic Tell My Story intake mode where users can describe their work naturally, review an extracted dossier, add context or edit details, and generate a resume package through the existing Career Forge resume engine.

## What Changed

- Added a new `/story` route.
- Added a natural story input screen with the prompt: "Tell Career Forge about your work history."
- Added a deterministic story parser that reuses the existing natural role parser.
- Extracts, where possible:
  - role/title
  - company
  - dates
  - target role fallback
  - role family
  - responsibilities
  - tools
  - scope/metrics
  - transferable signals
- Shows an extracted dossier under "I read this as..."
- Added dossier actions:
  - Looks right
  - Edit details
  - Add more context
- Added focused follow-up copy when critical details are missing.
- Feeds parsed data into the existing resume generator, ATS validation panel, resume preview, and LinkedIn preview.
- Updated the Build Mode choice so Tell My Story opens `/story`.

## Files Changed

- `src/app/page.tsx`
- `src/app/story/page.tsx`
- `src/components/TellMyStoryMode.tsx`
- `src/lib/story-mode.ts`
- `scripts/smoke-generator.mjs`
- `TELL_MY_STORY_MODE_REPORT.md`

## Parser Behavior

The story parser uses deterministic local logic only. It does not call an external AI API.

Supported examples include:

- "I worked at DraftKings as a sportsbook writer from 2023 to now."
- "I founded Koinophobia Labs in 2025."
- "I was a security officer at Allied Universal for two years."

The parser identifies known role aliases where possible, such as mapping "sportsbook writer" to "Sportsbook Ticket Writer."

## Follow-Up Behavior

If critical details are missing, Tell My Story asks one focused follow-up instead of restarting the intake:

- Missing target role: "What role should this resume target?"
- Missing recent role: "What was your title, company, and approximate date range?"
- Missing responsibilities: "What work were you trusted with most often?"
- Missing tools or skills: "What tools, software, systems, or skills did you use?"

## Smoke Coverage Added

- Confirms `/story` UI exists.
- Confirms required story prompt exists.
- Confirms extracted dossier copy exists.
- Confirms Looks right / Edit details / Add more context controls exist.
- Confirms Story Mode uses the deterministic natural role parser.
- Confirms the DraftKings sportsbook story parses into role, company, dates, responsibilities, intake data, and resume generation.

## Verification Results

- `npm run smoke:resume-intelligence` - passed; 20 transformation profiles tested.
- `npm run smoke:generator` - passed; generator smoke passed for 6 personas.
- `npm run smoke:interview` - passed; 7 interview simulation profiles completed.
- `npm run lint` - passed.
- `npm run typecheck` - passed.
- `npm run build` - passed; Next.js built `/`, `/interview`, and `/story` successfully.

## Known Limitations

- Parsing is deterministic and intentionally conservative.
- The story parser can miss unusual phrasing or multiple roles in one long paragraph.
- Users may still need to edit details or add context for weak stories.
- No external AI API, backend, database, or saved sessions were added.

## Commit / Push

- Implementation commit hash: `f010e99`
- Push result: succeeded to `origin/main`
