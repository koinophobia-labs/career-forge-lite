# Source Reconciliation Notes — 2026-07-09

What changed in this hardening pass, which sources support each change, and what remains open.

## Source artifacts status

| Named source | Status |
|---|---|
| `Blake_Taylor_Resume_v2.docx` | **NOT RECEIVED** — not found in this environment or in the connected Gmail account (searched `filename:(resume)`, `"Blake_Taylor"`, attachment queries). Full reconcile pending upload. |
| Most recent `Resume.pdf` | **NOT RECEIVED** — same searches, no hit. |
| `koinophobia_evidence_audit.docx` | **NOT RECEIVED** — searched `koinophobia OR "evidence audit"`; no such attachment. |

Sources actually used for this pass:

1. **Blake's instructions** (this task): DraftKings as the sportsbook employer; the education conflict wording; honesty constraints on Career Forge / You Know Ball / Trendi / Koi Cave.
2. **Connected Gmail (the Koinophobia Labs business account), read-only**: sent outreach emails, Vercel deployment notifications.
3. **This repository + `list_repos`**: live product links, public repos, test-suite counts.

## Changes made (fact → source)

| Change | Source | Confidence |
|---|---|---|
| Sportsbook employer named **DraftKings** | Blake's instruction | Stated by Blake; exact internal title + dates still `[VERIFY]` |
| DraftKings end date → `[VERIFY END DATE]` | No email/document evidence found (zero DraftKings emails in the connected Gmail — it's the business account) | Open |
| Location → **Chicago, IL** | Blake's own sent emails, repeatedly: "I run a small studio in the Chicago area called Koinophobia Labs", "Chicago-based founder" (Jul 7–8, 2026) | Strong |
| Contact details → `[PRIVATE_EMAIL]`, `[PRIVATE_PHONE]`, `[LINKEDIN_URL]` | Privacy rule for public repo | n/a |
| Education → `[VERIFY_CONFLICT]` block listing both B.A. wordings | Blake's instruction that prior sources disagree ("B.A. Global Management" vs "B.A. Social Entrepreneurship & Social Change"); no email/document evidence found to resolve it | **Blocking conflict — do not export until resolved** |
| Career Forge described as **deterministic / rule-based** in all technical mentions | Blake's instruction + the actual codebase (regex/knowledge-bank generator, no LLM at runtime) | Strong |
| **You Know Ball → "web app MVP deployed via Vercel"**; removed any implication it might be iOS | Vercel deployment-notification emails for project `you-know-ball` (June 2, 2026). Those notifications were deployment *failures*, so "live" is NOT claimed — current status `[VERIFY]` | Strong on "web MVP exists"; open on live status |
| **Trendi → "iOS app built with SwiftUI, in private development"**; explicit note not to claim TestFlight/App Store unless true | Blake's prior instruction (SwiftUI/iOS); no status evidence anywhere | Claim kept minimal per "specific but not over-verifiable" |
| **Koi Cave → private repository, description `[VERIFY]`** | `list_repos` confirms the private repo exists; nothing else | Minimal claim |
| Client work bullet upgraded to a **concrete, evidenced claim**: structured website-audit outreach to Chicago-area local businesses, "12+ businesses contacted in a single outreach wave, July 2026" | 13 personalized audit-outreach emails observed in Gmail Sent (Jul 7–8, 2026): tattoo studios, barbershops, med spas, fitness studios, a salon/spa, landscaping, pet grooming. Each contains a specific site finding (booking button routing off-site, missing contact info, external sign-up links) | Strong — directly observed |
| Client *conversions/delivered projects* remain `[VERIFY]` | Outreach is evidenced; closed clients and outcomes are not | Open |
| Follower/engagement metrics: none included; placeholders now instruct to include numbers **only if current and defensible, otherwise omit** | Blake's instruction | n/a |
| Koinophobia Labs title/date kept: **Founder, 2025 – Present** | Consistent across repo history, Blake's sent emails ("I'm Blake, I run a small studio... called Koinophobia Labs"), and prior instructions. `[VERIFY]` removed from title/start year; cross-check against `Blake_Taylor_Resume_v2.docx` when it arrives | Strong |

## Still [VERIFY] — unchanged because no source supports them

- DraftKings exact internal job title, start date, end date, location/property
- Daily transaction volume / cash handled at DraftKings
- DraftKings responsible-gaming program specifics and real escalation examples
- Responsible Gaming Community Framework exact scope wording
- You Know Ball live URL / current status + one-line description
- Trendi one-line description and TestFlight status
- Koi Cave one-line description
- Discord servers founded/moderated (resume 3)
- Creator/social platforms and any audience numbers (resume 3)
- Client conversions and delivered client projects (resume 4)
- Education: degree name conflict (`[VERIFY_CONFLICT]`), institution, graduation year

## Open questions Blake must answer before PDF/DOCX export

See the numbered list in `README.md` and the export gate in `private-export-checklist.md`. The two **blocking** items are: (1) the education degree-name conflict, and (2) DraftKings exact title + dates. Everything else can ship with the bracket removed and the claim deleted if unconfirmed.
