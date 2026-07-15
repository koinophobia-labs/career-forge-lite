# Career Forge truth workflow baseline

Recorded before implementation on 2026-07-15.

## Repository state

- Repository: `koinophobia-labs/career-forge-lite`
- Foundation commit: `8c2b0e95b823dabff3fcd75f4a18976de6bd88e2`
- Starting branch: `main`, clean and aligned with `origin/main`
- Working branch: `codex/career-forge-truth-workflow`
- Dependency install: `npm install` reported up to date

## Required command baseline

- `npm test`: passed after allowing the browser regression to bind localhost. The script reports 321 named unit/regression assertions across its verbose suites, one desktop/mobile usability flow, and a 75+ persona quality regression dataset. The first sandboxed run stopped only because localhost returned `EPERM`; no product assertion failed.
- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm run build`: passed with 16 statically generated pages
- Baseline failures: none after localhost permission was granted

## Existing routes

`/`, `/_not-found`, `/applications`, `/icon.svg`, `/interview`, `/outreach`, `/profile`, `/resume-builder`, `/settings`, `/story`, `/tailor`, `/targets`, `/versions`, `/versions/view`, `/weekly`.

## Existing persistence and migration

- Local-storage key: `career-forge-command-center-v1`
- State version: `2`
- Backup envelope version: `2`
- `parseState` revives malformed sections independently and migrates legacy state into v2.
- Legacy profile fields are preserved as approved canonical evidence, with the old experience summary retained for migration review.
- Legacy generated résumé snapshots are merged into structured role/education candidates; generated bullets are retained as notes and are not silently promoted to evidence.
- Applications, outreach, lanes, résumé versions, version/application linkage, snapshots, dossier data, packs, and export metadata survive revival.
- Backups accept both the v2 envelope and bare legacy local-storage state. Newer schemas are rejected with guidance.

## Existing résumé output

The current `ResumePackage` has a summary, a flat core-skills list, experience entries (`title`, `company`, `time`, `bullets`), one education string, LinkedIn headline, and LinkedIn summary. Pack generation creates ATS and recruiter variants per active lane, up to three lanes. The recruiter variant currently prepends a short narrative and reverses skills/bullets; it is not substantively distinct. Every claim currently cites every approved evidence ID, which is the central provenance defect in this mission.

## Existing import and dossier behavior

- `/profile` accepts pasted text only and turns non-empty lines into low-confidence, unapproved evidence.
- No PDF, DOCX, or multi-file extraction exists.
- Proposed evidence is reviewed as individual lines, not grouped structured records.
- Roles, projects, and education can be added but not fully edited/deleted.
- List fields save on blur without a visible confirmation.
- Projects have basic name/organization/dates/description fields but no structured metrics, links, or per-variant placement.

## Existing matching behavior

The analyzer builds its match corpus from the legacy profile plus lane proof and lane keywords. Consequently a lane keyword can currently make a requirement appear covered. Credentials receive a special gap check, but matching is not based exclusively on approved dossier evidence.

## Existing application behavior

Applications store one `jobPostUrl`; they do not distinguish discovery and direct-application URLs, source, posting/deadline dates, contacts, a pack variant, or evidence-backed application questions.

## Responsive baseline at 375 x 667

- Rendered viewport and document width are both exactly 375px; no horizontal overflow was detected.
- The global navigation wraps into four rows and consumes roughly the first 271px of vertical space.
- The dashboard then stacks the workflow and metric cards into one column.
- Interactive navigation targets are approximately 34px high, below the preferred 44px mobile touch target.
- The dashboard is readable but very long (about 3,787px), and its primary action/hero content is pushed well below the wrapped navigation.
- Existing scripted usability coverage uses 390x844, not the required 375x667 viewport.

## Baseline conclusion

The foundation builds and preserves legacy data, but the current import, provenance, lane matching, variant differentiation, project modeling, application workflow, editing, and required mobile coverage do not meet the mission acceptance standard.
