# Career Forge activation baseline

## Repository and runtime

- Repository: `/Users/koi/Documents/Codex/2026-07-15/files-mentioned-by-the-user-career/career-forge-lite`
- Branch: `codex/career-forge-activation-launch`
- Foundation: `f99633a97661d7b9d7edcd0dee1757a76b6e63ea` (`Add Career Forge evidence provenance and truth workflow (#4)`)
- Working tree before this report: clean
- Package manager: npm `11.13.0`
- Runtime: Node `v24.16.0`

## Untouched validation baseline

- `npm test`: 383 named assertions passed; desktop/mobile usability regression passed; 82-persona quality regression scored 98/100 with 0 hallucinations.
- `npm run lint`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; 16 static pages generated.
- `npm run smoke:generator`: 6 personas passed.
- `npm run smoke:interview`: 7 profiles completed.
- `npm run smoke:resume-intelligence`: 20/20 profiles rated Excellent.
- `npm run playtest:adversarial`: 10/10 profiles completed with 0 unsupported claims.
- `npm run acceptance:private`: 15/15 checks passed.
- `npm run acceptance:browser`: passed at 375×667 and 1440×900.

## Cleared-storage first-run map

### `/`

- First visible headline: “Build your career profile once. Get a complete résumé pack for your strongest lanes.”
- First CTA: “Start profile,” inside a separate “Next best action” panel.
- The page leads with internal nouns—profile, evidence, lane, résumé angle—before showing a concrete pack.
- Desktop exposes seven equal workflow destinations plus eleven navigation destinations.
- At 375×667, the primary CTA is below the fold. The visible first viewport contains the brand, a horizontally scrolling eleven-item navigation row, the headline, and supporting copy.
- Mobile page height is 3,632px; desktop page height is 1,483px. No horizontal overflow was detected.

### `/profile`

- The page begins with identity, employment, project, education, and nine evidence-entry panels.
- Import is below all manual entry sections, despite being the strongest entrance for users with existing résumés.
- Before import, a cold user sees “Canonical source of truth,” “Career Arsenal,” “readiness,” “proof points,” “approved claims,” and “active lanes.”
- Import copy correctly states local processing and review gating, but the value of multiple old versions and deduplication is not explained until the user reaches the control.
- Proposal review correctly prevents unapproved facts from becoming usable evidence, but approved items do not explain which output they unlock.

### `/targets`

- “Lane” is defined, but nine library options are presented with equal visual weight.
- Recommendations are framed for a generic operations-to-tech transition rather than ranked by the current dossier.
- Each option has a fit rationale, but cards do not expose supporting evidence, gaps, confidence, or the specific résumé payoff.
- The generate action uses internal language: “Forge complete résumé pack.”

### `/versions`

- Generation succeeds and creates two variants per active lane.
- The completion page leads with “Resume archive” and “Every version, and why it exists,” not a success reveal.
- ATS and recruiter variants are named, but cards do not plainly say when to use each document.
- The evidence receipt exists but the page does not foreground coverage, intentionally unclaimed gaps, or the dominant next action.
- There is no direct “Tailor a résumé to a real job” bridge in the pack completion panel.

### `/tailor`

- The route preserves lane/baseline lineage and truth matching.
- A first-time user must understand “canonical lane résumé,” “lineage,” “baseline,” and covered/partial/gap before acting.
- The form exposes all application metadata at once; the job post and baseline choice compete with optional contact/date/question fields.

## Minimum decision count and measured path

Synthetic paste-import path used one support role and one independent project.

- Decisions before reaching import: 2 (choose the profile path, then choose file or paste entrance), plus a long scroll past manual fields.
- Decisions from paste to approved evidence: 7 minimum (extract, approve five proposal groups, save review).
- Decisions from approved evidence to pack: 3 minimum (continue to lanes, adopt one lane, forge pack).
- Decision to recognize a useful document: open a variant from the versions archive.
- Total minimum decisions to an opened résumé: 13.
- Instrumented browser time while reading and recording each state: 35.7s to approved evidence, 58.4s to a first lane, 74.5s to a pack, and 110.7s to an opened variant. This is an automation-assisted lower bound, not a cold-human usability estimate.

## Cold-user friction inventory

1. What is this? The homepage says “career transition command center” and “profile” before showing the tangible pack contents.
2. Why should I do this? The output is described abstractly; no concrete pack preview appears above the fold.
3. What happens next? The dashboard exposes advanced destinations before establishing a five-stage activation path.
4. Why does it need this information? Manual fields precede the import-first explanation.
5. Can I trust the output? Local/privacy language is present, but approval, omission, and no-invention rules are scattered.
6. Which résumé should I use? Variant names exist, but use-case guidance is absent from the cards.
7. Did it save? Persistence exists, but the first-run stage is not surfaced as a durable progress model.
8. “Profile” and “Career Dossier” are used interchangeably.
9. “Lane,” “canonical,” “baseline,” “lineage,” “traced claims,” “receipt,” and “forge” require product knowledge.
10. The post-generation page resembles storage management rather than a payoff moment.
11. Imported facts do not explain the résumé, lane, or question they can support.
12. There is no isolated sample walkthrough for users unwilling to enter personal data yet.

## Baseline screenshots

- `docs/activation/baseline-375x667.png`
- `docs/activation/baseline-390x844.png`
- `docs/activation/baseline-1440x900.png`

The mobile screenshots show the CTA below the fold and navigation occupying a large share of the opening viewport. The desktop screenshot shows the seven equal workflow cards and profile-first CTA.

## Baseline conclusion

The truth workflow, local persistence, export, and browser behavior are reliable. The activation defect is presentation and sequencing: the strongest entrance is buried, terminology arrives before payoff, the first-run path is not persistent or singular, and the pack does not convert completion into a real application action.
