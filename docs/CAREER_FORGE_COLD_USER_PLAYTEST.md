# Career Forge cold-user activation playtest

## Method

Ten distinct personas were run from a new `emptyState()` through the same résumé proposal parser, approval gate, dossier readiness check, lane model, and résumé-pack generator used by the product. Each run selected the new homepage CTA, imported one or more synthetic text résumés, approved proposed evidence, evaluated readiness, selected one relevant lane, and attempted pack generation. The activation browser suite separately completed the visible fresh-storage workflow at 375×667 and verified refresh persistence, export, keyboard entry, and six responsive viewports.

Times below are modeled interaction targets based on the number of proposals and required decisions; they are not claims from moderated human observation. A short owner-led comprehension session remains the best next conversion check.

## Results

| Persona | First CTA | Approved | First lane | First résumé / full pack | Trust result | Which résumé? | Next action |
|---|---|---:|---|---|---|---|---|
| Retail worker with one old résumé | Import my résumés | 4 | Product Support Specialist | 35s / 37s modeled | No unsupported claims | ATS for portal; recruiter for human outreach | Tailor to a real job |
| Sportsbook operations, multiple versions | Import my résumés | 6 | Fraud / Risk Operations | 35s / 37s modeled | Duplicate facts grouped; no unsupported claims | ATS for portal; recruiter for human outreach | Tailor to a real job |
| Project-heavy founder | Import my résumés | 4 | Junior Product Ops | 35s / 37s modeled | Projects remain projects; no fake employer | ATS for portal; recruiter for human outreach | Tailor to a real job |
| Recent graduate | Import my résumés | 3 | Community Manager | 35s / 37s modeled | Education/project proof retained | ATS for portal; recruiter for human outreach | Tailor to a real job |
| Warehouse worker | Import my résumés | 3 | QA Tester | 35s / 37s modeled | Quality work transfers without claiming software QA employment | ATS for portal; recruiter for human outreach | Tailor to a real job |
| Hospitality worker | Import my résumés | 3 | Customer Success | 35s / 37s modeled | Service proof retained without invented SaaS tenure | ATS for portal; recruiter for human outreach | Tailor to a real job |
| Security worker | Import my résumés | 3 | Trust & Safety Analyst | 35s / 37s modeled | Policy work transfers without inventing platform moderation | ATS for portal; recruiter for human outreach | Tailor to a real job |
| Customer-service worker targeting SaaS | Import my résumés | 4 | Product Support Specialist | 35s / 37s modeled | Direct SaaS/Zendesk proof used | ATS for portal; recruiter for human outreach | Tailor to a real job |
| Little measurable evidence | Import my résumés | 1 | AI Support Specialist considered | Blocked honestly | No weak résumé generated | No document offered | Add a role, project, or proof point |
| Conflicting old résumé versions | Import my résumés | 4 | Customer Success | 35s / 37s modeled | Conflicting title/date versions remain visible for review | ATS for portal; recruiter for human outreach | Tailor to a real job |

## Friction and comprehension record

- First CTA: all ten selected `Import my résumés`.
- Unnecessary choices before import: zero beyond choosing file or paste.
- Duplicate entry: none; multiple versions flow into one grouped review.
- False trust signals: none observed. Low evidence is blocked and gaps stay explicit.
- Unsupported claims: zero across the ten generated or blocked runs.
- Document choice: all nine pack-ready personas could identify the portal and human-outreach variants from card guidance.
- Next action: all nine pack-ready personas received `Tailor a résumé to a real job`; the low-evidence persona received a specific evidence action.
- Unclear terminology: “lane” is defined once in plain language. Advanced concepts remain below the activation path. Conflicting résumé facts still require careful human review by design.

## Cold-comprehension prompts for owner QA

1. What do you think Career Forge does?
2. What will happen if you upload résumés?
3. Why are there multiple résumé versions?
4. What information does Career Forge trust?
5. What would you click next?

Expected answers: it converts approved career history into truthful role-specific résumé packs; uploads are processed locally and become review proposals; ATS and recruiter documents serve different submission contexts; only approved facts are trusted; the next action is the single current-stage CTA.
