# Private Export Checklist

The committed markdown files in this folder are **public drafts** — they deliberately contain `[PRIVATE_*]` placeholders instead of real contact details, because this repository is public. Export-ready copies with real contact info must never be committed here.

## How to produce an export safely

1. Copy the four resume `.md` files into `resume-pack/private/` (git-ignored — see `.gitignore`) or anywhere outside this repo.
2. In the copies only, replace:
   - `[PRIVATE_EMAIL]` → the real application email. Decide which one: the personal address or the Koinophobia Labs business address. Pick one and use it consistently across all four resumes and LinkedIn.
   - `[PRIVATE_PHONE]` → real phone number.
   - `[LINKEDIN_URL]` → real LinkedIn profile URL (the short custom one, e.g. `linkedin.com/in/...`).
3. Resolve every remaining `[VERIFY]` in the copies: fill with the confirmed fact, or **delete the claim entirely**. A resume must leave this checklist with zero brackets.
4. `[VERIFY_CONFLICT]` (education) is a hard gate: do not export any version until the degree wording is resolved. If unresolved on a deadline, export with the EDUCATION section removed rather than guessing.
5. Export per `design-brief.md` (Version A ATS + Version B designed) using the file names listed there.
6. Confirm no export file (PDF/DOCX) gets committed to this repo. Keep them in `resume-pack/private/`, local disk, or private storage.

## Export gate — must be answered before any PDF/DOCX goes out

**Blocking:**

1. Education: "B.A. Global Management" or "B.A. Social Entrepreneurship & Social Change"? Plus institution and year.
2. DraftKings: exact internal job title, start date, end date (or keep `[VERIFY END DATE]` → then the dates line must be resolved to at least "20XX – 20XX" honestly).

**Required per resume (fill or delete the line):**

3. Fraud/Risk: daily transaction volume / cash handled; RG program specifics; escalation example.
4. AI/QA: You Know Ball live URL + one-liner; Trendi one-liner + TestFlight truth; Koi Cave one-liner.
5. Community/T&S: real Discord servers + roles; social platforms; audience numbers only if current and defensible.
6. Customer Success: any delivered client projects/conversions worth naming (with client permission).

**Contact:**

7. Which email goes on resumes; phone; LinkedIn URL; confirm "Chicago, IL" is the wording you want (sources say "Chicago area").

## Git history note

An earlier commit on this branch (before this hardening pass) contained a real email address in these files. The branch history was rewritten to remove it; if you ever see a real address in any committed file here, treat it as a bug and scrub it.
