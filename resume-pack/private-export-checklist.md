# Private Export Checklist — Final

The committed markdown files are **public drafts** with privacy placeholders. Export-ready copies with real contact details are never committed — put them in the git-ignored `resume-pack/private/` folder or outside the repo.

## Remaining blockers (the ONLY open items)

| # | Blocker | Where it lands |
|---|---|---|
| 1 | DraftKings exact end date (or confirm still employed → keep "2023 – Present") | Dates line, all four resumes. Until answered, do not claim "former" and do not guess a year |
| 2 | Which private email to use (personal vs. lab address) | `[PRIVATE_EMAIL]`, all four headers |
| 3 | Phone on resume: yes/no (if yes, the number) | `[PRIVATE_PHONE]` — delete the field entirely if no |
| 4 | LinkedIn URL | `[LINKEDIN_URL]`, all four headers |
| 5 | Trendi one-line current status | AI/QA resume, Selected Projects |
| 6 | Koi Cave one-line current status | AI/QA resume, Selected Projects |
| 7 | You Know Ball one-line current status (may upgrade "web app MVP" to "live web MVP" only if actually live) | AI/QA resume, experience bullet + Selected Projects |
| 8 | Social metrics: include current, defensible numbers — or confirm omit (resumes currently omit them) | Community/T&S resume, if included |

## Export procedure

1. Copy the four resume `.md` files into `resume-pack/private/` (git-ignored) or outside the repo.
2. Resolve blockers 1–8 in the copies. A resume leaves this checklist with **zero brackets** — every remaining `[...]` is either filled with a confirmed fact or the line is deleted.
3. Export per `design-brief.md`: Version A (conservative ATS, PDF + DOCX) and Version B (designed PDF), using the file names listed there.
4. Never commit any export file or any file containing real contact details to this public repo.

## Already resolved — do not reopen

- Education: **Earlham College — B.A. Global Management, May 2024 · Track: Social Entrepreneurship · Minors: Political Science, Leadership, Philosophy** (Blake-confirmed; override only on his explicit instruction)
- DraftKings title: **Associate Sportsbook Writer**, start **2023**
- Location: **Chicago, IL**
- Career Forge Lite: deterministic/rule-based wording
- Responsible Gaming Community Framework: elevated as a major project on the fraud/RG, AI-support, and community/T&S resumes
- Transaction numbers / RG program specifics: intentionally absent — do not add without Blake providing them

## Git history note

An early commit on this branch contained a real email address; the branch history was rewritten to remove it. If you ever see a real address in any committed file here, treat it as a bug and scrub it.
