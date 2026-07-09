# Source Reconciliation Notes

Two passes so far. Newest first.

## Pass 2 — Final reconciliation with Blake-confirmed source details (2026-07-09)

Blake confirmed details from his prior resume/audit material. Applied:

| Fact | Final wording | Source |
|---|---|---|
| Education | **Earlham College — B.A. Global Management, May 2024 · Track: Social Entrepreneurship · Minors: Political Science, Leadership, Philosophy** — `[VERIFY_CONFLICT]` removed on all four resumes | Blake-confirmed from prior resume sources (the "Global Management" vs "Social Entrepreneurship" conflict resolved: Global Management is the degree, Social Entrepreneurship is the track) |
| DraftKings | **Associate Sportsbook Writer — DraftKings, 2023 – [VERIFY END DATE]** | Blake-confirmed title and start year; end date still unprovided, so bullets stay in present tense and no "former" claim is made |
| DraftKings metrics/specifics | Transaction-volume and RG-program-specifics brackets **removed entirely** (not filled) — bullets now claim only duty-level facts | Blake's instruction: do not invent numbers or program specifics |
| Career Forge Lite | Described everywhere as **deterministic / rule-based**, never a live AI generator | Blake-confirmed + codebase |
| You Know Ball | **"web app MVP"** — NOT described as live. The audit/source notes available to this session (Vercel deployment-failure emails, June 2026) do not support "live", so per Blake's own conditional ("live web MVP **if supported** by the audit/source notes") the claim stays at MVP with status = export blocker #7 | Gmail evidence + Blake's conditional rule |
| Responsible Gaming Community Framework | **Elevated to a major selected project** on the fraud/RG, AI-support (CX AI), and community/T&S resumes; added as an experience bullet where relevant | Blake's instruction; repo verified public |
| Trendi / Koi Cave | Minimal, **"in private development"**, one-line status = export blockers #5–6; no TestFlight/App Store claims | Blake's instruction; no public evidence |
| Social metrics | **Omitted entirely** from resume text; inclusion decision = export blocker #8. The unverified Discord-servers placeholder line was deleted; core skills now say "Discord & Community Platforms" (platform familiarity) rather than claiming moderation roles | Blake's instruction |
| Contact | `[PRIVATE_EMAIL]` / `[PRIVATE_PHONE]` / `[LINKEDIN_URL]` placeholders kept in all committed files | Privacy rule (public repo) |

Remaining brackets are exactly the 8 export blockers — see `private-export-checklist.md`.

## Pass 1 — Hardening against available sources (2026-07-09, earlier)

The named source artifacts (`Blake_Taylor_Resume_v2.docx`, latest `Resume.pdf`, `koinophobia_evidence_audit.docx`) were **not received** — not in the environment, not in the connected Gmail. That pass used: Blake's task instructions, the connected Gmail (read-only), and this repository + the GitHub org's repo list.

Key evidence established then (still standing):

- **Chicago, IL** — Blake's own sent outreach emails ("Chicago-based founder", "small studio in the Chicago area"), Jul 7–8 2026
- **Client audit outreach is real**: 13 personalized website-audit emails observed in Gmail Sent (Jul 7–8, 2026) to Chicago-area tattoo studios, barbershops, med spas, fitness studios, a salon/spa, landscaping, and pet grooming businesses — each with a specific site finding. Basis for the "12+ businesses contacted in a single outreach wave" claim
- **You Know Ball is a web project** — Vercel deployment notifications for project `you-know-ball` (June 2, 2026); those were failures, so live status was never claimed
- **DraftKings has no trace in the business Gmail** — title/dates could not be evidenced from email
- **Founder, Koinophobia Labs, 2025–Present** — consistent across repo history, sent emails, and instructions
- Branch history was rewritten in Pass 1 to remove a real email address committed in the first draft

## If the original source files ever arrive

Cross-check: DraftKings end date, the Earlham wording as printed on the actual resume, and any client-work numbers. Anything that disagrees with the current files gets flagged, not silently changed.
