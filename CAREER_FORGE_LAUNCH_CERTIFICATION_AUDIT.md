# Career Forge — Final Launch Certification Audit

**Date:** 2026-08-05 → 2026-08-06
**Baseline:** `main` @ `af431c1` (= production at audit start, confirmed via `/api/commerce-health`)
**Work produced:** PR #57 (`fix/truth-p0-generator`), PR #58 (`audit/closure-repairs`) — both **DRAFT**
**Method:** architecture mapping (6 parallel readers) → live browser journey on a clean account → 7-dimension static audit with adversarial verification of every P0/P1 → repair with fail-first regressions → independent adversarial review of the truth repairs

---

## 1. Executive launch verdict

# NOT READY FOR RELEASE

Not because the product is bad — the evidence model is genuinely strong and much of the honest-by-design behaviour works as advertised — but because **the core promise still fails on a clean account today**, and the repairs are in unmerged draft branches that have not been independently reviewed or deployed.

The verdict rests on four load-bearing facts, each verified by running code, not by reading it:

1. **A first-time user's own words were corrupted in every export.** The persona typed *"It was my job to reconcile the drawer."* The generated PDF and DOCX — opened and read, not merely generated — both contained *"It was job to reconcile the drawer."* `toResumeVoice` stripped every mid-sentence "my". This is now fixed (PR #58) but not merged.
2. **The guided/tailored stack fabricated claims and said it hadn't.** The recorded, exportable résumé text contained `"Assisted customers with returns."` (never described), `"Supported Escalation handling, Retail, and the shift lead."` (an industry chip and a sentence fragment fused into a duty), and `"Processed payments using POS Systems and Cash Drawer."` (from naming two tools) — while the same screen displayed *"Matched evidence was prioritized. No text was invented"* and a RESUME QUALITY rating of **Excellent**. Four vectors fixed (PR #58); the false assurance text (FAB-11) is still on screen.
3. **A public endpoint published a bearer credential.** `/api/commerce-health` printed the certified Stripe session id; `/api/license` mints a production-signed paid licence from that id. An unauthenticated caller could read one and mint the other. Fixed (PR #58), unmerged.
4. **Production is not in the posture the product describes.** The live deployment is built with `COMMERCE_MODE=live`, so every visitor meets `$49` feature locks that dead-end at a checkout that is correctly closed (`canSellSafely: false`), while `/pricing` says *"No purchases enabled"* and `/founding-beta` says *"Secure checkout is live"*. This is a **deployment-configuration decision the founder must make**; no code change can resolve the contradiction alone.

**What must happen before this verdict can change** is listed in §9. The shortest honest path is: independent review and merge of #57 and #58, close the four remaining launch blockers, decide the commerce posture, deploy, then run the five-user gate.

---

## 2. Core journey scorecard

Scored on the **repaired** branches unless noted. 1–10; every score below 9 is explained.

| # | Step | Clarity | Effort | Reliability | Trust | Polish |
|---|------|:---:|:---:|:---:|:---:|:---:|
| 1 | Begin as a new user | 9 | 10 | 9 | 9 | 9 |
| 2 | Add or import career information | 8 | 8 | 7 | 9 | 8 |
| 3 | Review and correct imported information | 9 | 8 | 8 | **10** | 9 |
| 4 | Add a real job description | 8 | 9 | 8 | 8 | 8 |
| 5 | Generate tailored materials | 6 | 8 | 6 | **4** | 6 |
| 6 | Review AI-generated claims | 7 | 7 | 7 | **5** | 7 |
| 7 | Edit, approve, reject, regenerate | **5** | 6 | **4** | 6 | 6 |
| 8 | Prepare for interviews / outreach | 7 | 8 | 6 | 8 | 7 |
| 9 | Export or copy final materials | 8 | 9 | 8 | 7 | 8 |
| 10 | Understand the next recommended action | 9 | 9 | 8 | 9 | 9 |

**Explanations for every score below 9**

- **Step 2 — clarity 8 / effort 8 / reliability 7.** Manual entry is genuinely fast and the two entry paths are clear. Import categorises poorly: role titles (`"Assistant Store Manager (2022 - 2024)"`) are classified as *identity* and **auto-approved**, as is a caregiving gap disclosure; section headers become proposed facts. The review gate still stands between this and the dossier, but auto-approval of misclassified items weakens it. Multi-file import is all-or-nothing with a single raw library error (`"Corrupted zip: can't find end of central directory"`) and no per-file result.
- **Step 3 — effort 8, reliability 8, polish 9; trust 10.** The Truth Inbox is the best thing in the product: durable across refresh, per-item Approve/Reject/Undecide, every record showing `Sources: manual · Exact text: …`. Effort and reliability lose a point for the 17-item review of a short résumé and for quarantined evidence still being invisible in the UI (issue #54).
- **Step 4 — clarity 8, reliability 8, trust 8, polish 8.** The analyzer extracted **6 of 9** qualifications from a realistic posting, silently dropping two *required* ones (Food Handler's Card, open availability). Required and preferred are merged under one "Requirements" heading. Match quality misfires: 2021–2024 employment reads as PARTIAL for "2+ years" because duration is never computed from dates, and "NetSuite or similar" is called PARTIAL citing *"Reported to my manager and the shift lead."* as transferable evidence.
- **Step 5 — trust 4.** The lowest score in the audit, and the reason for the verdict. Pre-repair this step fabricated claims while asserting it had not. Post-repair the fabrication vectors are closed, but the tailored output still silently drops the second employment record and the education year, and the false-assurance copy remains.
- **Step 6 — trust 5, clarity 7.** The review screen asserts unevidenced "strengths" (✓ Upselling services, ✓ Inventory accuracy) and prints an "EVIDENCE CHAIN" containing activities the user never described. It also recommended *Inventory Associate — HIGH CONFIDENCE* (a demotion) to a supervisor targeting Assistant Store Manager.
- **Step 7 — clarity 5, reliability 4.** The weakest workflow. Builder and tailored preview edits never reach the saved version record, and tailored versions have **no edit surface at all** afterwards. Deleting a duty in the `/profile` role editor does not stop it printing — the approved evidence record survives and the next forge resurrects it. "Undo latest edit" reverts *all* edits since the editor opened. Drafts across the capture surface live in unpersisted React state with no unload guard.
- **Step 8 — reliability 6, clarity 7, polish 7.** Interview transcripts and prep drafts fail to save silently when storage is full. The Role Sprint "best next step" proposed building honest proof for *"Ability to lift 50 lbs and stand for full shifts"* — a physical requirement no practice task can address.
- **Step 9 — trust 7, clarity 8, polish 8.** Export mechanics are sound (see §5) and the pack README is admirably honest. Trust is docked because what exports is only as good as step 5 produced, and because `export_baseline_pack` is bypassed by the page's own "View & export" link and by ungated Copy/Print in the legacy preview.
- **Step 10 — reliability 8.** `intentNextMove` is a real strength: one clear next action, correctly re-derived. Docked for `/tailor` showing a blank slate on return with no pointer to saved jobs, and for `/truth-map`, `/weekly`, and `/founding-beta` having zero inbound links.

---

## 3. Findings register

**85 findings** (6 P0, 29 P1, 31 P2, 19 P3) plus 20 live-journey findings. Every P0/P1 went through an adversarial verifier instructed to refute it: **37 CONFIRMED, 3 DOWNGRADED, 1 UPGRADED, 0 REFUTED.**

Full per-finding detail (reproduction, expected/actual, root cause, evidence, file:line) is preserved at:
- `scratchpad/static-audit/finder-{0..6}.json` — every finding as structured data
- `scratchpad/live-findings.md` — the 20 live-journey findings
- The verifier verdicts are in the workflow journal at `subagents/workflows/wf_709f9dd5-705/journal.jsonl`

### P0 — release-stopping

| ID | Finding | Fix status | Regression |
|---|---|---|---|
| FAB-01 | `"…complaints and refunds."` authorised the bullet `"Assisted customers with returns."` | **FIXED** #58 `0afd7bd` | `closure-audit-regression.mjs` ✓ fails pre-fix |
| FAB-02 | Naming tools produced `"Processed payments…"` + a `Cash Handling` skill | **FIXED** #58 `0afd7bd` | ✓ fails pre-fix |
| FAB-03 | Narration text grounded derived claims while being deleted as content (RA-P0-03) | **FIXED** #57 `e643796` | `generator-truth-regression` 50/50 |
| FAB-04 | Industry chip + sentence fragment fused: `"Supported Escalation handling, Retail, and the shift lead."` | **FIXED** #58 `0afd7bd` | ✓ fails pre-fix |
| FAB-05 | Tailored layer grounded JD keywords against the JD's own title → `Store Manager` in CORE SKILLS | **FIXED** #58 `166ff43` | ✓ fails pre-fix |
| SEC-01 | Public `/api/commerce-health` printed the Stripe session id; `/api/license` mints a signed licence from it | **FIXED** #58 `166ff43` | ✓ fails pre-fix |
| RA-P0-04a | *PR-introduced:* rescued narration got an invented lead — `"Supported It was hectic."` | **FIXED** #57 `0e4318e` | `generator-truth-regression` RA-P0-04 |

### P1 — launch-blocking

**Fixed (9):**

| ID | Finding | Fix |
|---|---|---|
| FAB-08 | `toResumeVoice` stripped every mid-sentence "my" — broken English in *every* export | #58 `0afd7bd` |
| A11Y-01 | Guided builder text at **1.08:1** on its own card (intake, review, LinkedIn editor) | #58 `2a0dfd6` → measured **15.84:1** |
| DS-05 / SEC-02 | "Clear local data" cleared 5 of 10 keys; transcripts, practice answers, testimonials survived | #58 `2a0dfd6` + key registry |
| SEC-03 | Restore left the previous person's transcript and practice answers on the device | #58 `2a0dfd6` |
| LIVE-04 | Tailored session silently lost on refresh (consume-once handoff) | #58 `1f83111` |
| LIVE-15 / DS-12 | Guided write-back turned 2 dossier roles into 5, with a duplicated id | #58 `1f83111` |
| RA-P0-04b | `"De-escalated upset callers"` → `"Escalated concerns…"` (the opposite claim) | #57 `0e4318e` |
| RA-P0-04c | `"Scrubbed the kitchen floors"` → `"Coordinated with coworkers…"` + Team Coordination | #57 `0e4318e` |
| RA-P0-04d | `"I have never trained anyone"` classified as a claim and printed as a bullet | #57 `0e4318e` |

**Open (20)** — the launch blockers that remain:

| ID | Finding | Why it blocks |
|---|---|---|
| FAB-11 | Preview asserts *"No text was invented"* directly above generated content | The claim is now closer to true, but asserting it unconditionally is what made the fabrications dangerous |
| FAB-06/07/09/10/12 | Outcome chip spliced as a purpose clause; chip path bypasses narration filters; weak target silently replaced by a role-family default (`tbd` → `Technical Support Associate`); title keyword `shift` classifies a grocer as food service; `intakeFromDossier` truncates dates | Each puts unentered text or wrong framing into exportable output |
| DS-01 / RELY-01 | After one quota-failed save, every later edit silently reverts | Silent data loss |
| DS-02 | Deleting a duty does not stop it printing — the evidence record survives and the next forge resurrects it | A rejected claim quietly returns |
| DS-03 | Builder/tailored preview edits never reach the saved version; tailored versions have no edit path | Export does not match the editor state |
| DS-04 | Capture-surface drafts held in unpersisted React state, no unload guard | Data loss on navigation |
| RELY-02 | Interview transcripts and prep drafts fail to save silently when storage is full | Silent data loss |
| PE-01 | `/founding-beta` claims *"Secure checkout is live"* while checkout is closed | Pricing copy contradicts behaviour |
| PE-02 | Production runs `COMMERCE_MODE=live`: every visitor hits `$49` locks dead-ending at a closed checkout | Founder decision required |
| PE-03 | `export_baseline_pack` bypassed by the page's own "View & export" and ungated Copy/Print | Paywall unenforceable |
| PE-04 | `/api/checkout`'s non-live branch is ungated — a direct POST creates a real session for any tier | Wrong-charge risk |
| PE-05 | Stray live Stripe Payment Link (issue #55) — the one path a visitor can actually pay today, and it cannot be fulfilled | **Needs a human with Stripe access; cannot be fixed from the repo** |
| VAL-01…05 | Fabrication oracle circular with the generator; preservation fixtures avoid first-person vocabulary; zero behavioural entitlement coverage | The suite could not have caught most of this audit's P0s |

### P2 / P3 — 50 findings

Recorded in full in the JSON register; not expanded here. Highlights worth scheduling: no error boundaries anywhere (RELY-05); ~1.5 MB of export libraries in the home route's first load (RELY-04); per-keystroke full-state persistence (RELY-03); no security headers at all (SEC-06); `EditConflictDialog` has no focus trap or Escape (A11Y-02); 73 usages of low-contrast small text (A11Y-07); `scripts/mobile-a11y-browser.mjs` is a dead instrument (A11Y-06).

---

## 4. Fabrication and evidence report

Adversarial cases were written specifically to trigger fabrication. **Pre-repair, the system failed 8 of 12 classes.**

| Adversarial case | Pre-repair behaviour | Post-repair |
|---|---|---|
| Evidence naming a *sibling* concept (`refunds`) | Fabricated `"Assisted customers with returns."` | Prevented |
| Naming tools only, describing no work | Fabricated `"Processed payments…"` + `Cash Handling` skill | Prevented |
| Industry chip tapped (`Retail`) | Rendered as a duty, fused into a fake bullet | Prevented |
| Job posting's own title | `Store Manager` added to CORE SKILLS as the user's skill | Prevented |
| First-person narration (`"It was my job to…"`) | Sentence deleted; leftover token still grounded a claim | Preserved verbatim; grounding shares the same gate |
| Self-declared gap with an unlisted verb (`"I have never trained anyone"`) | Printed as a positive résumé bullet | Withheld |
| Described *de*-escalation | Emitted `"Escalated concerns…"` — the opposite claim | Prevented |
| Situation words (`"stayed calm"`, `"felt safe"`, `"kitchen"`) | Grounded De-Escalation, Safety Procedures, Team Coordination | Prevented |
| Negated bad outcome (`"did not lose any data"`) | Correctly kept as an achievement | Unchanged ✓ |
| Third-party negation (`"Contractors did not have experience"`) | Correctly kept as a claim | Unchanged ✓ |
| Credential bait in a JD (ServSafe, NetSuite, degree) | Correctly refused; gaps surfaced explicitly | Unchanged ✓ |
| Compound object (`"Logged calls from O'Fallon and DeSoto."`) | Correctly kept whole | Unchanged ✓ |

**Still exposed:** the guided review screen asserts unevidenced strengths and an invented "EVIDENCE CHAIN" (FAB-11, LIVE-08), and title-case artifacts without a `they/them` marker still take a `Supported` lead (documented in #57, reproduces on the parent).

**The load-bearing lesson:** the quality suite scored this product **87/100 with 0 hallucinations** while every one of the above was live. Its fabrication oracle is built from the same taxonomy the generator draws from, so the whole RA-P0-03 family was invisible by construction (VAL-01). **A green suite was not evidence of truthfulness.**

---

## 5. Export certification report

Every export was **downloaded and opened**, not merely generated.

| Format | Path | Density | Result |
|---|---|---|---|
| **DOCX** (ATS) | `/versions` → DOCX | dense (2 roles, 8 duties, education) | Unzipped and read `word/document.xml`. Structure correct: name, contact line, Professional Summary, Experience with per-role headings and bulleted duties, Education. **Content carried the pronoun corruption** (now fixed). |
| **DOCX** (Recruiter) | `/versions` → DOCX | dense | Same structure, different selection. 9,053 bytes, valid OOXML. |
| **PDF** (ATS) | pack ZIP | dense | Rendered and read the actual page: clean single-column, sensible margins, no clipping, bullets and section rules correct, en-dashes (`2021–2024`) intact, one page. Same content corruption. |
| **PDF** (Recruiter) | pack ZIP | dense | 4,550 bytes, valid, same rendering quality. |
| **ZIP pack** | "Export complete pack" | 4 documents + 2 text files | 18,648 bytes. Contains both PDFs, both DOCXs, `LinkedIn-and-Career-Materials.txt`, `README.txt`. Filenames are useful and human: `Jordan-Reyes-Resume-Retail-Shift-Supervisor-ATS.docx`. |
| **README.txt** | in pack | — | **Exemplary.** States generation time, formats, which résumé is for which use, and an evidence receipt: *"Approved professional evidence used: 11 / not used: 0 / Unsupported or context-only claims refused: 1"*. |
| **Clipboard** | Copy / Copy resume text | both | Works; ungated (PE-03). |
| **Backup JSON** | `/settings` | full state | Round-trips; covers only the command-center blob (DS-06). |

**Certified:** file generation, structure, formatting, page breaks, special characters, filenames, ZIP assembly, and the honesty of the pack README.
**Not certified:** export *content* fidelity to the editor state — DS-03 (preview edits never reach the saved version) is open, so an export can still diverge from what a user last edited in the legacy stack.

---

## 6. Pricing and entitlement verification

Tested against the running app in both `COMMERCE_MODE=off` (local) and live production.

| Surface | Copy says | Behaviour | Verdict |
|---|---|---|---|
| `/pricing` | *"Public beta · No purchases enabled"*, *"not offers"*, *"Every feature is included free"* | Accurate in `off` mode | **Honest — and a model for the rest** |
| `/founding-beta` | *"Secure checkout charges $49 once"*, *"Start Career Reset →"* | Checkout is closed (`canSellSafely: false`) | **Contradicts `/pricing`** (PE-01) |
| Production runtime | — | Built `COMMERCE_MODE=live`; visitors meet `$49` locks that dead-end | **Contradicts the free-beta posture** (PE-02) |
| `/unlock` invalid code | — | *"That access code could not be activated. Check the code and try again."* | **Good** — clear, human, no leak |
| `/unlock` rate-limited | — | 429 and 503 collapse into the same message | PE-09 |
| `/api/checkout` non-live branch | — | Ungated; any tier, no safety gates | PE-04 |
| `/api/redeem` | Terms imply one licence | One code minted **5 licences in 5 attempts**; `redemptionCount` is written and never read | SEC-04 (downgraded P1→P2) |
| `$99` tier | 5 exclusive deliverables | `career_switch_toolkit` read by **zero** product code; 3 of 5 have no implementation | PE-07 |
| `$79` tier | "Cover-letter evidence foundation" | Computed, persisted, rendered by nothing | PE-08 |
| Free vs `$49` | — | `off` mode grants strictly **more** (all features, 3 lanes vs 1) | PE-06 — paying is a downgrade |
| `/reviewed-service` | `$149` human service | mailto-only, cannot take money in-app | Honest |

**Money paths that can take a dollar today: one** — the stray live Stripe Payment Link (issue #55), which provably cannot be fulfilled. It is outside the application and needs a human with Stripe dashboard access.

**Recommendation:** do not open commerce with this tier structure. The `$49`/`$79`/`$99` ladder cannot be honestly enforced client-side, and two tiers advertise features that do not exist. The free public beta posture (`COMMERCE_MODE=off`) is both honest and already implemented — ship that.

---

## 7. Remaining-risk register

### Accepted launch risks (if the founder ships the free beta after the blockers close)
- **All generation runs client-side in a public repo.** No paid capability is technically enforceable. Acceptable while everything is free; disqualifying the moment a paywall means anything.
- **`localStorage` is the only store.** Clearing site data destroys months of work. Mitigated by backup/restore and the `SaveHealthBanner`, not eliminated.
- **The lane library is 9 hardcoded ops→tech roles.** Honest about zero overlap for other fields, but a retail persona gets no library value. Custom lanes work well.
- **The generator does not improve writing.** It selects, orders, and formats the user's own sentences. That is the honest design — but "polished export" in marketing copy should not overstate it.

### Required post-launch monitoring
1. **Fabrication watch.** Any user report of an unrecognised sentence is a P0 — this audit found six independent vectors, and the classes are not exhausted.
2. **Storage-quota failures.** DS-01/RELY-01/RELY-02 remain open: silent data loss on a full store.
3. **Stripe dashboard.** Until issue #55 is closed, watch for completed sessions on the stray Payment Link. Anyone who paid received nothing and needs a refund and direct contact.
4. **`/api/commerce-health`.** `canSellSafely` must stay `false` until a fresh certification and approval are recorded for the deployed commit.
5. **Console errors in production.** Zero error boundaries (RELY-05): a render throw blanks the whole app.

### Future enhancements (not launch-relevant)
Required-vs-preferred qualification split; duration computed from dates; lane library beyond ops→tech; surfacing quarantined evidence (issue #54); an edit path for tailored versions; per-file import results.

---

## 8. Release checklist

**Do not run this until §9 is satisfied.**

**Pre-merge**
- [ ] Independent adversarial review of PR #58 with reviewer-authored fixtures (PR #57 has had one; #58 has not)
- [ ] Integrate #57 and #58 — both modify `src/lib/generator.ts` in different functions
- [ ] `npm run test:unit` exit 0 on the integrated branch, `typecheck`, `lint`, `npm run build`
- [ ] `npm run test:browser` and the `acceptance:*` suites on the integrated branch
- [ ] Clean-clone verification (`git clone` fresh, install, test) — the branch must not depend on local state

**Environment**
- [ ] Decide the commerce posture and set `NEXT_PUBLIC_COMMERCE_MODE` deliberately (`off` recommended)
- [ ] If `off`: confirm `/api/checkout` returns 503 (needs PE-04 fixed first)
- [ ] Confirm no `sk_live` key is reachable by the non-live checkout branch
- [ ] Regenerate the surface hash if any checkout-path file changed; expect certification to invalidate

**Migrations / data**
- [ ] None required (localStorage-only). Confirm `parseState` revives the current schema from a pre-upgrade backup file.

**Deploy**
- [ ] Merge to `main` (auto-deploys production)
- [ ] Verify `/api/commerce-health` reports the new commit and `canSellSafely: false`

**Smoke tests on the deployed URL**
- [ ] Clean profile → manual entry → lane → forge pack → open the PDF and read it → confirm the user's sentences are verbatim
- [ ] Paste a job description → analysis → tailored résumé → refresh mid-session → confirm the session survives
- [ ] `/settings` → clear local data → confirm every `career-forge-*` key except the licence is gone
- [ ] `/unlock` with an invalid code → confirm the human error message
- [ ] Guided builder at 375px → confirm text is readable (the 1.08:1 regression)

**Payments**
- [ ] Issue #55 closed with recorded evidence (link id, deactivation timestamp, completed-session count)
- [ ] Confirm no in-app path can create a Stripe session

**Monitoring / rollback**
- [ ] Vercel runtime error alerts enabled
- [ ] Confirm the previous deployment is one click from promotion
- [ ] Analytics: verify events are content-free (`trackCareerEvent` takes an event name only — asserted by `dossier-pack-regression`)

---

## 9. Closure statement

> **Can Career Forge now be released without scheduling another broad product audit?**

**No — not yet.** But the remaining work is bounded and enumerable, which was not true when this audit began.

Concretely, another **broad** audit is not what is needed. What is needed is:

1. **Independent adversarial review of PR #58** (the pattern used on #57 found a P0 the author had introduced — that step is not optional).
2. **Closing the 20 open P1s**, most of which are small and localised. The heaviest cluster is the editing surface (DS-01…DS-04): edits that never reach the saved version, a deleted duty that resurrects itself, and silent loss after a storage failure.
3. **One founder decision** on commerce posture (PE-02), plus one human action in the Stripe dashboard (issue #55) that cannot be performed from the repository.
4. **The five-user gate**, which has not been run. It cannot pass while step 7 of the journey scores 4/10 on reliability.

**Once those close and a re-verification pass confirms them, the appropriate future reviews are narrow, not broad:**

- **Production monitoring** — fabrication reports, storage-quota failures, console errors.
- **Customer feedback review** — especially on steps 5–7, where trust scored lowest.
- **Targeted incident audits** — triggered by a specific report rather than scheduled.
- **A focused re-audit of any surface that gains a paywall**, because no paid capability is currently enforceable.

The honest summary: Career Forge's *evidence model* is close to release quality and in places genuinely excellent — the Truth Inbox, the defensibility receipts, the pack README, the refusal to invent credentials. Its *generation and editing surfaces* were not, and are now materially better but unmerged and unreviewed. The distance to a defensible release is one review cycle and one bounded blocker list — not another audit.

---

### Appendix — validation results at the time of writing

| Check | Result |
|---|---|
| `npm run test:unit` (`audit/closure-repairs` @ `166ff43`) | **exit 0**, 1682 PASS |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors, 1 pre-existing warning |
| `npm run build` | succeeds, compiled in 3.3s |
| `generator-truth-regression` (#57 @ `0e4318e`) | **66/66** |
| `truth-integrity-regression` | **172/172** |
| `quality-regression-suite` (#58) | **98/100**, 0 hallucinations, 7 weak (from 87/100, 31 weak) |
| `closure-audit-regression` (new) | **29/29**, every assertion proven to fail pre-fix |
| Adversarial verification of P0/P1 findings | 37 CONFIRMED, 3 DOWNGRADE, 1 UPGRADE, **0 REFUTED** |
| Independent review of #57 | 48 reviewer-authored fixtures; 1 PR-introduced P0 found and fixed |


---

# ADDENDUM — Launch-closure queue execution (2026-08-06)

Work done against the founder's six-item queue. Branch: `integration/launch-closure` (PR #59), which supersedes #57 and #58.

## Queue status

| # | Item | Status |
| --- | --- | --- |
| 1 | Integrate #57 and #58 without losing either generator repair | **DONE** — clean merge, all seven repair markers verified present, both suites green on the result |
| 2 | Adversarially review #58 (narration, negation, gaps, unsupported claims) | **DONE** — 218 reviewer-authored fixtures, 4 lenses, **FAIL on 3**; every defect repaired |
| 3 | Fix remaining P1s, editing surface first | **DONE for the named cluster** — DS-03, DS-02, DS-01/RELY-01, plus RELY-09 and an input-boundary defect found by re-running the journey |
| 4 | Choose the commerce posture | **CODE DONE** — PE-04, PE-01 closed; **one env var still to change on Vercel** |
| 5 | Resolve Stripe issue #55 | **KIT PREPARED** — cannot be done from the repo; execution steps + evidence template posted to the issue |
| 6 | Five-user gate | **PROTOCOL READY, NOT RUN** — `docs/FIVE_USER_LAUNCH_GATE.md`; 7 of 8 readiness preconditions pass |

## What the second review changed about the verdict

It found **two P0s that this audit's own repairs had introduced**, plus six lesser regressions. That is the single most important result in this addendum: the first review caught one introduced P0, the second caught two more. **Every repair round to the truth surface has introduced a defect that only an independent reviewer with their own fixtures found.**

It also exposed a systemic pre-existing P0 that both earlier passes missed: **grounding had no notion of polarity anywhere.** `"I never handled cash"` produced the core skill *Cash Handling* and the summary line *"Strengths the candidate reports include cash Handling"*. This is now fixed at the corpus level, with a positive control asserted alongside every denial fixture.

## Validation at `8394214`

| Check | Result |
| --- | --- |
| `npm run test:unit` | **exit 0 — 1813 PASS** |
| `generator-truth-regression` | **93/93** — RA-P0-04 + RA-P0-05 hold 43 reviewer-authored fixtures |
| `closure-audit-regression` | **60/60** |
| `dossier-pack-regression` | **58/58** |
| `truth-integrity-regression` | **172/172** |
| `quality-regression-suite` | **94/100**, 0 hallucinations, weak outputs 31 → 24 |
| `typecheck` / `build` | clean / succeeds |

## Verdict change

**NOT READY FOR RELEASE → READY AFTER LISTED BLOCKERS**, with exactly three blockers remaining, none of which is a code defect:

1. **Set `NEXT_PUBLIC_COMMERCE_MODE=off` on the Vercel production environment and redeploy.** Until then production still shows $49 locks that dead-end at a closed checkout. One setting; no code change.
2. **Close issue #55** — deactivate the stray live Stripe Payment Link and record the evidence. Needs Stripe dashboard access.
3. **Run the five-user gate** and meet every criterion.

Two verification steps must accompany them: an independent adversarial review of this integration branch (the pattern has found an introduced P0 every single time), and re-running the §1 readiness preconditions immediately before the gate.

## Still open, and deliberately not fixed here

Recorded so they are not rediscovered as surprises:

- The `composed()` cross-concept gate fix is **a one-off patch in the retail pool** — the same shape survives in roughly 25 clause pairs across other occupation profiles (LENS-C2). Highest-value remaining truth work.
- An employer name plus a target job title can still manufacture a bullet and a summary strength with no user text at all (LENS-C4); the beauty-service lane is ungated (LENS-C5).
- The guided and pack stacks still produce different documents from identical input.
- Interview transcripts and prep drafts still fail to save silently when storage is full (RELY-02); the capture surface still holds drafts in unpersisted React state (DS-04).
- `"I was laid off before I trained the new hires."` still exports `"Trained the new hires."` — the termination-reason splitter keeps the dependent clause and re-asserts it (lens A, pre-existing P0). **This one is a genuine P0 and belongs at the top of the next queue.**
