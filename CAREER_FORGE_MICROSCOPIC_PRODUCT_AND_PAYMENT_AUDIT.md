# Career Forge — Microscopic Product and Payment Audit

**Audit date:** 2026-08-03
**Repository:** `/Users/koi/Projects/career-forge-lite` @ `909a5bb` (`main` == `origin/main`)
**Live production:** `career-forge-lite.vercel.app`, deployment `dpl_EzGRZ3RCXRPTcHQsF7So167R7swT`, commit `98213c2` — **which does not exist in the repository**
**Method:** static reading of the full source, execution of the shipped modules against synthetic personas, live browser driving of two locally-built configurations (`COMMERCE_MODE=off` and `=test`), read-only probing of the production deployment and its Vercel/Stripe/CI metadata, and 20 forensic agents (10 survey dimensions, each adversarially verified by an independent refuter).
**Constraint honoured:** no file under `src/`, `scripts/`, `docs/` or `.github/` was modified. All audit scripts were written to a scratchpad outside the repository. The only artifact added to the repo is this report.

---

## 1. Executive verdict

| Dimension | Score | One-line basis |
|---|---:|---|
| Career-building depth | **3 / 10** | Real provenance architecture, but career *direction* is 9 hard-coded tech-support lanes, the model has no concept of level or seniority, and the generator largely echoes the user's own sentences back. |
| First-time usability | **4 / 10** | Clean three-goal chooser and a genuinely good `/tailor` entry — but nothing above the fold says what the product makes, the landing ships zero server-rendered content, and the first generated artifact contains an invented bullet. |
| Output quality | **3 / 10** | Honest by construction, yet the pack generator attributes one job's duties to a different employer and certifies it as "direct" evidence; the built-in quality meter scores a draft with broken sentences 100/100. |
| Continued-use value | **3 / 10** | The one genuine returning-user surface (`/weekly`) is linked from nowhere; momentum metrics reward typing rows, not progress; milestones contain no interview and no offer. |
| Payment-option clarity | **2 / 10** | Nine distinct money paths exist in the repo; zero can take a dollar today; `/pricing` and `/founding-beta` state contradictory facts about whether checkout is live. |
| Tier differentiation | **1 / 10** | The $99 tier's exclusive entitlement flag is read by no code at all. Its only enforced advantage over $79 is one extra résumé lane. |
| Pricing-to-value alignment | **2 / 10** | The free build grants *more* than the $49 pack (3 lanes vs 1, all features vs one). Prices are documented in-repo as untested hypotheses. |
| Billing implementation integrity | **6 / 10** | The verification core is genuinely strong — signature checking, Stripe re-query, price-derived tier, fail-closed sell gate. Undermined by a test-mode→production minting path, no revocation, and a launcher that provisions an ungated live Payment Link. |
| User trust | **3 / 10** | The honesty *intent* is the best thing about this product, and specific defects betray it: a panel headed "Nothing here was invented" displays an invented bullet; approved facts are silently deleted on read. |
| **Overall readiness to charge** | **1 / 10** | — |

### Verdict: **NOT READY TO CHARGE**

Not "ready for controlled paid beta." Not ready to accept a single dollar, including from the five founding-cohort customers, until the P0 set below is closed.

Three independent reasons, any one of which is sufficient:

1. **The product fabricates employment history in the artifact it sells.** `mergeIntakeIntoDossier` hands every role the same evidence-id array, so an exported résumé prints the current job's duties and metrics under a *previous, unrelated employer's* name — and the Defensibility Receipt reports `missingProvenance: 0` and certifies those bullets as "direct". (CF-P0-02)
2. **The product silently destroys user data.** A regex intended to detect self-declared gaps matches ordinary security/compliance phrasing ("Ensured contractors did not work without a valid permit"). On every state read, the matching *approved* record is deleted, its owning role is dropped, and the résumé's entire Experience section is emptied. No naming, no diff, no undo. (CF-P0-01)
3. **There is nothing to sell that is enforceable, and nothing purchasable anyway.** The `$49` tier's headline deliverable — résumé export — is obtainable by clicking the button the app itself labels **"View & export"** on an entirely ungated page. Meanwhile production has commerce gates *on* with checkout *closed*, so today's live product is strictly smaller than the free beta and cannot be unlocked at any price. (CF-P0-03, CF-P1-13)

A fourth, structural reason applies to the whole exercise: **the code serving users today cannot be read.** Commit `98213c2` resolves in no git ref, and GitHub's API returns `422 No commit found for SHA`. It contains at least one entitlement (`ats_structure_audit`), one pricing deliverable string, and two analytics events that exist in no file and no branch. Nothing audited here is guaranteed to be what is actually running. (CF-P0-04)

### What is genuinely good, and should not be lost

This is not a bad codebase. The strict verdict is about the gap between what it *promises commercially* and what it *enforces and delivers*, not about craft.

- **Billing verification is properly built.** Webhook signatures are HMAC-SHA256 over `${t}.${rawBody}` with timing-safe compare and a 300s replay window; the server never trusts the webhook payload and re-queries Stripe; tier is derived from the paid price id and a contradicting `metadata.tier` is a hard rejection; amount, currency and account are re-checked; promotion codes are disabled. I could not break it by reading.
- **The sell gate fails closed, correctly, right now.** `canSellSafely` requires commit-pinned certification *and* a separate human approval. Because the CLI deploy left `VERCEL_GIT_COMMIT_SHA` unset, `deploymentIdentity()` returns `"unknown"` and both evaluators reject it unconditionally. This control is the reason an unreviewable build has not charged anyone.
- **License cryptography is correct.** ECDSA P-256, verified *before* the payload is parsed. I minted a real key and confirmed: payload edited to a higher tier → `bad-signature`; key from a different keypair → `bad-signature`; absent public key → never grants.
- **Real truth-discipline machinery.** Termination reasons and uncertainty statements are stripped at every text→claim boundary and reported as deliberately withheld; roles with nothing defensible are omitted rather than rendered as empty headings; Role Sprint practice work carries its "practice work — separate from employment history" label inside the claim text; corrupt localStorage is quarantined to a recovery key rather than destroyed.
- **`/tailor` is the best thing in the product.** "Paste a job. See what you can prove." — one input, no profile required, and it says so.

---

## 2. Product reality map

*What Career Forge actually does today, counting only functionality that is reachable, works, and does not depend on the unreproducible production build.*

**Architecture.** Next.js 16 App Router, 21 pages, 7 API routes, ~30,600 lines of TS/TSX. Entirely client-side: every piece of career data lives in one browser's `localStorage` (`career-forge-command-center-v1`). **No accounts, no server-side user data, and no LLM** — all generation is deterministic TypeScript. The seven API routes are commerce plumbing only (checkout, license, redeem, invite, webhook, commerce-health, internal certification); not one of them generates, tailors, or exports anything.

**The workflow that exists and works:**

1. **Choose a goal** — `/` offers exactly three: *Get a job*, *Build or update my résumé*, *Practice for an interview*. The choice persists and drives a genuinely state-dependent "do this next" engine (`src/lib/intent-router.ts:65`).
2. **Build a dossier** — `/profile`. Import PDF/DOCX/text résumés (parsed in-browser via `pdfjs`/`mammoth`), or type roles, projects, education and evidence directly. Every extracted line becomes a *proposal* the user must approve. This review-and-approve loop is real and is the product's spine.
3. **Pick lanes** — `/targets`. Adopt from a fixed library of **9** roles, or type a custom title.
4. **Forge a Résumé Pack** — two variants (ATS + recruiter) per active lane, plus LinkedIn headline/About drafts, with a per-claim **Defensibility Receipt** linking each claim to its evidence records.
5. **Tailor to a posting** — `/tailor`. Paste a job post; get requirement-by-requirement `covered` / `partial` / `gap` verdicts against approved evidence, with formal credentials always reported as a gap and never claimed.
6. **Prepare for interviews** — `/interview`. Behavioural questions built from the user's own approved evidence, gap-defence coaching, and reverse questions.
7. **Track applications and outreach** — `/applications`, `/outreach`, with follow-up cadence, stage history, and a multi-tab conflict dialog.
8. **Export** — copy, print-to-PDF, DOCX, and a ZIP bundle with an honest README.

**What it is *not*, despite the interface implying otherwise:**

- **Not a career-direction engine.** `src/lib/lane-library.ts` is nine hard-coded blueprints — *AI Support Specialist, Trust & Safety Analyst, Fraud/Risk Operations, Community Manager, Product Support Specialist, QA Tester, Junior Product Ops, Customer Success, Technical Support*. All nine are shown to every user, unranked and unfiltered. The file's own comment states the intended audience: *"Curated lanes for candidates moving from operations, customer-facing, or non-tech work into tech-adjacent roles."* That is a legitimate, narrow ICP — but the $99 card says "You are moving into a new industry or kind of work," which promises any industry. I ran `buildCareerRecommendations`: it returns `[]` for a registered nurse *and* for a senior software engineer, and "Office Assistant" for a chemistry teacher.
- **Not a writer.** I ran the real pipeline for two personas. The generated bullets are the user's own typed sentences, re-ordered and punctuated:

  > **Typed:** "Coordinated care for critically ill patients across shifts"
  > **Generated bullet:** "Coordinated care for critically ill patients across shifts"
  > **Generated summary:** "Clinical Operations Manager candidate. Audited medication administration records for compliance. Coordinated care for critically ill patients across shifts."

  There is no achievement reframing, no quantification, no translation of clinical language into operations language. This is *honest* — it cannot hallucinate a job you did not have — but it means the value is organisation and provenance, not writing quality. A user who writes weak bullets gets weak bullets back.
- **Not a practice tool.** `/interview` generates questions and lints answers, but `coachAnswer` is six regexes over surface features that never read the question being answered. Feedback is never persisted; there is no attempt history, no score, and nothing anywhere measures improvement.
- **Not level-aware.** `CareerDossier` and `TargetLane` carry no level, seniority, or scope field. Every target the system can produce is entry-level Associate/Assistant/Coordinator.
- **Not multi-device.** All state is one browser's `localStorage`. The backup file (`src/lib/backup.ts`) carries exactly one of ten Career Forge keys, so interview practice drafts and the Interview Mode transcript are silently lost on any device switch. `shouldNudgeBackup` is written and tested but rendered nowhere, so a user can work for months and never be prompted to back up.

**The honest one-sentence description:** *Career Forge is a local-first résumé and application organiser that turns work history you type or import into reviewed, source-linked draft documents, for people pivoting from customer-facing or operations work into nine specific tech-adjacent support roles.*

---

## 3. Full payment and entitlement matrix

### 3.1 Every payment path represented in the repository

Nine distinct money paths exist. **Zero can take a dollar today.** Confirmed against production: `POST /api/checkout {"tier":"reset"}` → `503 fulfillment_not_ready`; `{"tier":"job-search"}` and `{"tier":"career-switch"}` → `403`.

| # | Displayed name | Price | Cadence | Intended customer | Purchasable now? | Promise matches implementation? |
|---|---|---:|---|---|---|---|
| 1 | Career Reset Pack | $49 | one-time | "clean up or restart your job search" | **No** — 503 (sell gate closed) | **No** — headline deliverable (export) is free via `/versions/view`; live build also grants an `ats_structure_audit` feature absent from source |
| 2 | Job Search Pack | $79 | one-time | "actively applying to a specific kind of role" | **No** — hard 403 in live mode | **Partly** — 3 of 3 features are enforced, but tailoring is inert and bypassable via "Tailor again" |
| 3 | Career Switch Pack | $99 | one-time | "moving into a new industry" | **No** — hard 403 in live mode | **No** — its exclusive flag gates nothing; 3 of 5 exclusive deliverables have no implementing code |
| 4 | Career Forge Résumé Rebuild (human) | $149 | one-time | wants a person to review | Manual only — mailto, no in-app Stripe | **Yes** — clearly separated, and the only offer with a stated refund policy |
| 5 | Founder invite | $0 (comp) | one-time | founding cohort | No — fails closed, disabled | Yes — requires both `FOUNDER_INVITE_ENABLED=true` and a per-deployment 64-hex hash, no shipped default |
| 6 | Redemption access code | $0 (post-purchase) | one-time | buyer unlocking a 2nd device | Only after a purchase | Yes — 64.4 bits of entropy, hashed at rest, rate-limited, generic errors |
| 7 | Legacy live Stripe Payment Link | $49 | one-time | founding cohort, link sent manually | **Unknown — needs Stripe dashboard check** | **No** — provisioned outside every safety gate and **cannot be fulfilled** |
| 8 | Manual comp mint (`scripts/mint-license.mjs`) | $0 | one-time | press/review/support recovery | Operator-only | Yes — audited via a `ref` convention |
| 9 | Operator certification purchase | $49 test-mode | one-time | operator drill only | Operator-only | **No** — mints a *production-signed* license from a $0 test card |

### 3.2 Detail on the three SaaS packs

| Attribute | **Career Reset — $49** | **Job Search — $79** | **Career Switch — $99** |
|---|---|---|---|
| Included capabilities (config) | `export_baseline_pack` | + `tailored_resume_export`, `outreach_toolkit`, `interview_unlimited` | + `career_switch_toolkit` |
| Lane limit | 1 | 2 | 3 |
| **Capabilities actually enforced** | pack ZIP + DOCX only (copy/print leak) | tailoring (leaky), outreach, interview >6 answers | **nothing new** |
| Excluded | tailoring, outreach, interview beyond 6 answers | career-switch toolkit (which does nothing) | — |
| Upgrade path | none in product — no upgrade/prorate flow exists anywhere | none | n/a |
| Cancellation | n/a (one-time) | n/a | n/a |
| Renewal | none — `mode: "payment"`, no subscription code anywhere | none | none |
| Refund treatment | **Not stated in `/terms` at all.** `docs/PAYMENTS.md:142` documents that a refunded buyer's key keeps working. | same | same |
| Entitlement source | ECDSA P-256 signed key in `localStorage` (`career-forge-license-v1`) | same | same |
| **Server-side enforcement** | **None.** No `use server` files exist; no API route delivers product. | **None** | **None** |
| Client-side enforcement | `useEntitlement().hasFeature` — React render conditionals | same | same |
| Stripe mapping | `STRIPE_PRICE_RESET` | `STRIPE_PRICE_JOB_SEARCH` (never set; tier 403s first) | `STRIPE_PRICE_CAREER_SWITCH` (never set; tier 403s first) |

### 3.3 The entitlement matrix, measured

Output of an independent probe (`cf-audit-entitlement-probe.mjs`) that greps every `hasFeature()` call site and cross-references it against the tier config:

```
feature                   enforcement sites  where
------------------------------------------------------------------------------
export_baseline_pack      1                  src/app/versions/page.tsx:229
tailored_resume_export    2                  src/components/tailor/useTailorWorkspace.ts:274, :293
outreach_toolkit          1                  src/app/outreach/page.tsx:320
interview_unlimited       1                  src/components/InterviewMode.tsx:124
career_switch_toolkit     0                  *** NONE — GATES NOTHING ***

tier            export_base  tailored_re  outreach_to  interview_u  career_swit  laneLimit
------------------------------------------------------------------------------
(no license)    -            -            -            -            -            1
reset           GRANT        -            -            -            -            1
job-search      GRANT        GRANT        GRANT        GRANT        -            2
career-switch   GRANT        GRANT        GRANT        GRANT        GRANT*       3

GRANT* = the tier grants this feature but NO code consults it: the grant is inert.
```

**What the next tier actually buys:**

```
$49 reset  ->  $79 job-search   (+$30)
   new features declared : tailored_resume_export, outreach_toolkit, interview_unlimited
   of those, ENFORCED    : all three
   extra résumé lanes    : +1

$79 job-search  ->  $99 career-switch   (+$20)
   new features declared : career_switch_toolkit
   of those, ENFORCED    : NONE
   extra résumé lanes    : +1
```

**The $99 tier's $20 premium buys exactly one additional résumé lane.**

### 3.4 Contradictions between sources

| Source A | Source B | Contradiction |
|---|---|---|
| `/pricing` beta FAQ: *"Is anything for sale during the public beta?"* → **"No."** | `/founding-beta` (static, ungated): **"Secure checkout is live."** and "Secure checkout charges $49 once" | Same deployment, opposite claims. `scripts/ease-of-use-regression.mjs:64` **asserts the false string stays**. |
| `packages.ts` $99 deliverables: "Transferable-skill analysis", "Transition-narrative draft", "Interview objection practice" | Repo grep | `objection`, `transition narrative`, `careerSwitch` appear **nowhere** in `src/` except the marketing string itself. Transferable-skill inference (`transferable-targets.ts`) exists but is **free and ungated**. |
| `docs/PAYMENTS.md:25` — entitlement module "verified by `scripts/entitlement-regression.mjs`" | That script's imports | It loads `license.ts` and `packages.ts` only. **No test anywhere loads `src/lib/entitlement.ts`.** |
| `/pricing` FAQ: lost your code → *"Use the confirmation link in the Stripe receipt"* | `docs/PAYMENTS.md:149` | *"Stripe receipts do not link back to Career Forge."* The support instruction given to a paying customer is impossible. |
| `/terms` — refund clause exists only for the $149 human service | `docs/FOUNDING_USER_PILOT.md` — *"Refunds are available under the published terms"* | There are no published refund terms for the software packs. |
| Live `/pricing`: "✓ Detailed ATS structure audit with issue-by-issue guidance" | Repo | That string, and the `ats_structure_audit` entitlement it describes, exist in **no ref**. |

Of the **19 deliverable strings** across the three tiers, **12 trace to a real reachable capability and 7 do not.**

---

## 4. Payment-option comparison — does each option earn its place?

| # | Option | Verdict | Reasoning |
|---|---|---|---|
| 1 | **Career Reset $49** | **Reposition** | The only tier live checkout will ever sell, but it is sold on "export" — and export leaks through `/versions/view`'s "Print / Save as PDF" and "Copy plain text", plus `ResumePreview`'s ungated "Copy full resume" / "Print resume" on `/interview` and `/story`. Keep the price point; re-anchor it on something a client cannot trivially reproduce. |
| 2 | **Job Search $79** | **Merge** into a single paid tier | Its three features are the only genuinely enforced paid capabilities in the product. But tailoring is currently inert for the target persona, and "Tailor again" on `/versions` bypasses the gate entirely. This is the real product; it should not be tier 2 of 3. |
| 3 | **Career Switch $99** | **Remove** | Its exclusive entitlement is read by zero code. Three of five exclusive deliverables have no implementation. Its only enforced advantage is one extra lane. It is a price with no product behind it. |
| 4 | **Human service $149** | **Keep** | The only offer whose promise, fulfilment path, refund terms and cost-to-serve are all coherent. A human genuinely does the work; the buyer genuinely gets it; `/terms` states the refund rule. It is also the only offer immune to the enforcement problem. |
| 5 | **Founder invite $0** | **Keep** | Correctly fails closed, capped, no shipped default code. Useful for the pilot. |
| 6 | **Redemption code $0** | **Keep** | Solves the real multi-device problem for a no-account product. Strong entropy, hashed, rate-limited, generic errors. |
| 7 | **Legacy live Payment Link** | **Remove — urgently** | `scripts/commerce-launch.mjs:234` creates and *activates* a real $49 Payment Link on its own self-created Stripe Product/Price, never setting `STRIPE_PRICE_RESET`. It sits outside `canSellSafely` entirely — a URL hosted by Stripe cannot see the sell gate. Anything bought through it hits `/api/license`, fails `unknown_price`, and returns *"This checkout session is not a verified Career Forge purchase."* **Money in, nothing out.** |
| 8 | **Manual comp mint** | **Keep** | Operator tool with an auditable `ref` convention. |
| 9 | **Operator certification purchase** | **Replace** | Necessary in principle (you must certify the production host), but it currently mints a **production-signed, perpetual, unrevocable** license from a $0 Stripe test card using the same `LICENSE_SIGNING_PRIVATE_KEY` as a real purchase. Needs a separate certification keypair. |

### Pairwise comparison across the dimensions that matter

| | $49 → $79 | $79 → $99 |
|---|---|---|
| Career outcome enabled | Real: job-specific tailoring, outreach, unlimited interview turns | **None** |
| Time saved | Moderate | None |
| Quality improvement | Low today (tailoring inert for target persona) | None |
| Personalisation depth | Slightly higher | None |
| Usable outputs | +1 lane, +tailored variants | +1 lane |
| Continued career support | None either side | None |
| Export capabilities | Same | Same |
| Interview functionality | 6-answer cap lifted (on a *résumé intake chat*, not interview practice) | Same |
| Application tracking | Free at every tier | Same |
| AI usage | Zero — the product has no LLM | Zero |
| Data retention | Identical (one browser) | Identical |
| Collaboration / sharing | None | None |
| Support | Undifferentiated | Undifferentiated |
| Risk reduction | None stated | None stated |
| **Technical cost to serve** | **~$0 marginal** — everything runs in the buyer's browser | ~$0 |
| Reason to upgrade | Legible | **None a user could articulate** |
| Reason to remain subscribed | n/a (one-time) | n/a |

### Specific pathologies

- **Features promised in multiple tiers without differentiation.** "Interview story bank and practice interview" ($79) and "Interview objection practice" ($99) both gesture at `/interview`, which has **zero entitlement checks** and is free to everyone.
- **Arbitrary limits that punish normal usage.** `laneLimit` 1 on the $49 pack: a paying user gets *one* résumé lane while the free beta build grants three.
- **Paid features that should be free.** Résumé export is the act of *receiving your own data*. Gating it in a local-first product is both philosophically off-brand and technically unenforceable.
- **Free features that eliminate the reason to pay.** `/versions/view` ("View & export"), `ResumePreview`'s copy/print, and `/versions`' "Tailor again" each individually remove a tier's headline reason to buy.
- **Premium features that sound valuable but do not improve employment outcomes.** "Transition-narrative draft", "Interview objection practice" — no implementation exists, so they improve nothing by definition.
- **Tier differences users would not understand.** `career_switch_toolkit` cannot be explained because it does nothing.
- **Dead ends where a user pays but cannot complete the journey.** The legacy Payment Link (option 7) is exactly this: a completed payment that provably cannot be fulfilled.
- **Entitlement differences in copy but not in code.** All five $99 exclusive deliverables.
- **Entitlement differences in code but never communicated.** `ats_structure_audit` in the production build; `laneLimit`'s silent truncation at `targets/page.tsx:148` (`.slice(0, packLaneCap)`) — lanes beyond the cap are dropped from forging with only a small gold note.
- **Ways to bypass paid access.** Four, in increasing effort: (1) clone the **public** repo and `npm run dev` — `COMMERCE_MODE` defaults to `off`, `hasFeature()` returns `true` for everything and `laneLimit()` returns 3, i.e. the complete $99 product with no forgery; (2) click "View & export" on `/versions/view`; (3) read the pack straight out of `localStorage` as JSON; (4) call `createVariantFile(...)` from devtools — `pack-export` is in the free bundle.
- **Ways legitimate payers could be wrongly blocked.** Cleared site data; a different browser or device (mitigated only by the emailed redemption code); a rotated `NEXT_PUBLIC_LICENSE_PUBLIC_KEY`; a key minted for the other environment; `crypto.subtle` unavailable (non-HTTPS origin).

---

## 5. User-journey findings

### 5.1 First use

Choosing **"Get a job"** routes to `/profile#import` — a five-step path (*Import or add history → Review the facts → Choose role lanes → Forge the Résumé Pack → Use it on a real application*). Verified in-browser.

- **Ten-second comprehension: fails.** Everything above the fold on a cold visit is: kicker "Start here"; H1 **"What are you trying to do?"**; subhead "Pick one. Career Forge will take you to the next step."; three buttons; and the reassurance strip "No account required · Files stay on this device · You approve every career claim." **Nothing names the artifact.** The one differentiating sentence in the product — *"Not another AI résumé writer."* — is inside a collapsed `<details>`.
- **Zero server-rendered content.** `IntentRouter` returns an empty `min-h-52` box until hydration and every section of `page.tsx` is gated on `hydrated`. Production HTML contains **0 `<h1>` elements**. Bad for a slow connection, and invisible to search and link previews.
- **The career-change goal cannot be chosen.** `intent-router.ts:8` defines five goals including `career-change`; `IntentRouter.tsx:19` renders three, and `career-change` is not among them. **The goal behind the $99 Career Switch Pack has no first-run entry point.**
- **First result is fast but wrong.** After adding one role, `/profile` shows *"Your first résumé bullets — ready now"* with the copy *"Nothing here was invented."* Typing the single line "Trained six new support agents during onboarding" produces two bullets — the second reads **"Built six new support agents during onboarding."** Root cause: `addRole()` stores each responsibility *twice* (on the role and as an approved evidence record); `resume-intelligence.ts:179` runs `unique(diversifyOpeningVerbs(...))`, so the duplicate's opening verb is rewritten *before* dedup can remove it. Reproduced by executing the shipped modules.
- **Onboarding friction without payoff.** A realistic single-résumé import produced **22 proposals, 3 preselected**, contradicting the on-screen promise *"Clear facts are preselected."* Five of the 22 were section headings — "EXPERIENCE", "SKILLS", "PROFESSIONAL SUMMARY" — offered as career facts to approve.
- **Four collected fields are never read by any recommendation surface.** Constraints ("Prevents recommendations that waste your time"), target-role interests ("Seeds dossier-aware lane recommendations"), career goals, and work style. The hints promise steering that does not happen.
- **Good:** save state is visible everywhere (`SaveStatusPill`), save failure raises a real `role="alert"` banner pointing at Download backup, `/versions` has a genuine empty state with two concrete next steps, and a real sample built by the production export engine is available before any data entry.

### 5.2 Core workflow

- Dossier review, approval, and provenance are the strongest part of the product and work as advertised.
- The pack generator fabricates cross-role attribution (CF-P0-02).
- Editing any bullet, title, company or date in `/versions` **disables every export button for the whole pack** — `defensibility.ts:41` is missing its regex backslashes (`/^experience.(d+).(title|company|time|bullets)$/`), so a user's own edit is misclassified as missing provenance and the user is told *"A cited source is missing, rejected, or incomplete"* about text they just wrote (CF-P1-04).
- Tailoring is effectively inert for the flagship persona: `containsTerm` does whole-phrase literal matching with no stemming or synonyms, so for a bartender targeting customer support **all 12 posting keywords were skipped**, `coreSkills` and `experience` were byte-identical to the base, and the tailored résumé gained exactly one sentence: *"Focused on Customer Support Specialist work."*
- Builder preview edits are never persisted at all; the recorded version keeps the pre-edit draft.
- PDF export emits mojibake for any name outside Latin-1 — no font is embedded in the jsPDF path.

### 5.3 Returning use

- `/weekly` — "This week's momentum", 8 rolling metrics, three prescribed moves, a stalled-pipeline detector — is **linked from nowhere**. Verified against production: `/weekly` returns 200 and ten live routes contain zero `href="/weekly"`.
- Momentum rewards volume: five typed-but-never-sent application rows score 5; one real scheduled interview scores 1. One tailored résumé is double-counted.
- `intentMilestones` contains **no interview and no offer**. Moving an application to "offer" *un-checks* "Follow-up scheduled", so the offer user's ladder reads 2/7 while a user with one fake row reads 3/7.
- Nothing consumes outcomes: `generateResumePack(dossier, lanes)` never sees an application, an interview, or a rejection. The product cannot learn that something worked.
- What genuinely compounds: approved Role Sprint practice evidence lands in `dossier.approvedClaims` and improves every future pack.

### 5.4 Upgrade, checkout, recovery, cancellation

- **Upgrade prompts** land well. `LockedFeaturePanel` appears immediately after "Your Résumé Pack is ready." — the highest-intent moment — with non-punitive copy ("Everything you have built here stays yours and stays free to edit"). `/pricing` is deliberately absent from the primary nav, so no price is shown before value.
- **Limits are explained before they are hit** for interviews (`PremiumPreviewMeter` renders from the first answer).
- **Abandoned checkout is met with silence.** `stripe.ts:138` sets `cancel_url` to `/pricing?checkout=cancelled`, and `pricing/page.tsx` **never reads a search param**. Verified in-browser: the page contains no cancellation acknowledgement, no "no charge was made", no recovery path. The parameter is dead.
- **Failed/unconfigured unlock** degrades cleanly — `/unlock?session_id=cs_test_garbage` renders "Payments are not configured on this deployment" plus support guidance rather than crashing (message is misleading for a real buyer, but the state is only reachable on a misconfigured deployment).
- **Cancellation is a non-issue** and consistently framed: "One-time purchase · No account · No subscription", price suffix "once", FAQ "Is this a subscription? No." No subscription code exists anywhere (`mode: "payment"`).
- **Refunds are the gap.** No refund policy for the software packs anywhere in `/terms`, and `revokeRedemption` is never called by any route — even a SQL-level revoke does not help, because `/api/license` never imports the fulfilment store, so the buyer's original success URL re-mints a fresh perpetual license forever after a refund or chargeback.
- **The paid experience does not visibly feel more capable than the free one.** With `COMMERCE_MODE=off` a user has all five features and three lanes. With a $49 license they have one feature and one lane.

---

## 6. Findings ledger

**162 findings were raised; 158 survived adversarial verification** (4 were refuted by an independent refuter and are excluded). Distribution after verification: **4 P0, 13 P1, 102 P2, 37 P3/P4**. Every P0 and P1 is listed in full below, followed by the most consequential P2s. Every entry was confirmed by reading the cited code; entries marked *(ran)* were additionally reproduced by executing the shipped modules or driving the live app.

### P0 — billing, security, data, or access-control failure

| ID | Area | Finding | Evidence | User impact | Revenue impact | Correction | Effort | Blocker |
|---|---|---|---|---|---|---|---|---|
| **CF-P0-01** | Data integrity | Evidence classifier false-positives **silently delete approved facts, dossier roles, and entire résumé Experience sections** on every state read *(ran)* | `src/lib/evidence-admissibility.ts:54` — `/\b(?:do\|does\|did\|have\|has)\s+not\s+(?:manage\|own\|lead\|…)\b/i`. `classifyEvidenceAdmissibility("Ensured contractors did not work without a valid permit")` → `"gap"`. `sanitizeCareerDossier:174` then deletes the approved record; `:196` drops the owning role; `sanitizeResumeForProfessionalUse:317` returns `experience: []`. Runs on every read/write via `use-command-center.ts:57-63, 93-100`. | A security officer, compliance analyst or safety supervisor — exactly the ICP — loses their entire employment record between sessions, with no name, no diff and no undo. Already-exported résumés empty their Experience section on the next visit. | Refund-and-churn event on a $49–$99 purchase; directly contradicts the trust positioning that justifies the price. | Never delete approved evidence on a read path. Tighten the regex so a negation inside a compound clause ("ensured X did not…") is not a self-reported gap, and demote misclassifications to a named, restorable quarantine list. Add a fixture per false-positive phrase. | M | **before any payment** |
| **CF-P0-02** | Output integrity | Exported résumés **attribute the current job's duties and metrics to a previous, unrelated employer** — and the receipt certifies them "direct" *(ran)* | `src/lib/dossier.ts:367-372` — `const roleEvidenceIds = proposed.filter(…).map(i => i.id)` is passed unchanged to all three `roleFromIntake` calls. `resume-pack.ts:187-207` treats `role.evidenceIds` as that role's own facts. Real pipeline output for a Help Desk Technician with a prior security job: `Security Guard \| Sentinel Group` printed with bullets "Troubleshot laptops", "Reset passwords", "40 tickets a week". `missingProvenance: 0`, so export is enabled. | A candidate submits a PDF claiming help-desk work at a security firm. Dies in any reference check — and the user was told the claim was fully traced. | Charging for a document that fabricates employment history is a refund-and-reputation event. Cannot take money for this. | Build per-role evidence arrays in `mergeIntakeIntoDossier`. Assert in `buildLaneResume` that a role's bullets may only cite evidence linked to that role, and treat a violation as `missingProvenance` so export fails closed. | M | **before any payment** |
| **CF-P0-03** | Access control | `export_baseline_pack` — the only feature the only sellable tier grants — is **bypassed by the product's own UI in two clicks** | `src/app/versions/page.tsx:229` gates the dashboard, but the same documents are rendered at `/versions/view`, linked from the same page under the label **"View & export"** (`:82-89`). `src/app/versions/view/page.tsx` contains **zero** entitlement references and renders `onClick={() => window.print()}` "Print / Save as PDF" (`:93`) and `onClick={copyText}` "Copy plain text" (`:117`), serialising the whole snapshot. | A user who declines to pay clicks the button the UI recommends and gets a submission-ready PDF plus the complete résumé text. A user who pays $49 finds it was one click away. | Destroys the revenue case for the only SKU live checkout can sell. What remains paywalled is the `.docx` and `.zip` — packaging convenience, not value. | Either gate `/versions/view`'s print/copy on `hasFeature`, or stop selling "export" and re-price the pack on something a client cannot trivially reproduce. | M | **before any payment** |
| **CF-P0-04** | Release integrity | **Production serves code that exists in no git ref**, including security logic from two unmerged branches *(ran)* | `git cat-file -t 98213c25…` → fails; `gh api repos/…/commits/98213c25…` → **HTTP 422 "No commit found for SHA"**. Live `/api/commerce-health` returns a check named `isolated_approval_store` and the phrase "the release owner does, per commit, with a signed approval" — strings found only on unmerged `origin/remediation/cf-approval-boundary` and `origin/security/approval-signing-boundary`. Deployed by CLI actor `codex` with `gitCommitRef: HEAD`, bypassing all three steps in `docs/DEPLOYMENT.md:19-28`. | Users run code nobody can read, review, diff or re-derive. If the live site corrupts state or leaks data there is no source to debug against. | Zero today only by accident — `canSellSafely` is false *because* the commit is unknown. The moment anyone redeploys git-linked, an unreviewed tree becomes a sell-gate candidate. | Treat the live artifact as untrusted. Commit the producing tree to a branch and PR it, or discard and redeploy from a green `main`. Then disable direct CLI production deploys (git-linked only, production branch `main`, required checks). | M | **before any payment** |

### P1 — prevents the product from delivering or charging for its primary value

| ID | Area | Finding | Evidence | User impact | Correction | Effort | Blocker |
|---|---|---|---|---|---|---|---|
| **CF-P1-01** | Trust | The first output a new user sees **fabricates a bullet, under copy saying nothing was invented** *(ran)* | `src/lib/early-win.ts:13-22` + `resume-intelligence.ts:179` (`unique(diversifyOpeningVerbs(…))` — diversify runs *before* dedup). Typed "Trained six new support agents during onboarding" → displayed "…" **and** "Built six new support agents during onboarding." Rendered at `profile/page.tsx:487` under "Nothing here was invented". | The product's thesis is violated in the same panel that asserts it, at minute two. | Dedup before diversifying; better, never diversify a user-authored line in a preview promising verbatim fidelity. | S | before any payment |
| **CF-P1-02** | Test integrity | The regression guaranteeing the early-win preview invents nothing **explicitly whitelists the rewrite that invents** | `scripts/beta-readiness-regression.mjs:66` — comment "Allow the polisher's opening-verb diversification" then `const tail = core.split(" ").slice(1).join(" ")` — it strips the first word before comparing. | The one test that would have caught CF-P1-01 is written to pass despite it. | Require every preview bullet, first word included, to be a substring of an approved input line. | S | before any payment |
| **CF-P1-03** | Access control | **No paid capability is enforceable at all** — zero server-side enforcement, a public repo, and a default build where every gate returns `true` *(ran)* | `src/lib/entitlement.ts:104-112` — `if (!commerceEnabled) return true` / `return 3`. `grep -rln 'use server' src/` → nothing. Repo is `"visibility":"PUBLIC"`. Verified in-browser with commerce **on** and **no license**: the page still downloads jszip, jspdf, docx and the export code (`versions/page.tsx:15` is a static import). | None for users; a total seller-side failure. Any curious buyer discovers the tiers are advisory. | Decide the model honestly: either move a capability behind an authenticated server endpoint (none exists today), or sell what a local-first architecture can withhold — human review, updates, support. Stop describing `entitlement.ts` as "enforcement" in docs. | L | before any payment |
| **CF-P1-04** | Delivery | Editing any bullet/title/company/date in the paid editor **disables every export button for the entire pack** *(ran)* | `src/lib/defensibility.ts:41` — `/^experience.(d+).(title\|company\|time\|bullets)$/` — **the backslashes are absent from the source file**. `re.test("experience.0.bullets") === false`. `versions/page.tsx:235` then sets `packExportBlocked`, showing "A cited source is missing, rejected, or incomplete" about text the user just wrote. | A paying user fixes a clumsy bullet and loses PDF, DOCX, Copy and the ZIP for the whole pack. Only recovery is to discard the correction. | Fix to `/^experience\.(\d+)\.(title\|company\|time\|bullets)$/` and add a unit test. A user's own edit must never produce a blocking status. | S | before any payment |
| **CF-P1-05** | Value | **Tailoring is effectively inert** — for the flagship persona all posting keywords were skipped and the tailored résumé differed by one sentence *(ran)* | `src/lib/tailored-resume.ts:76-79` `containsTerm` — whole-phrase literal regex, no stemming or synonyms. Bartender → Customer Support: `keywordsWoven: []`, 12 skipped, `coreSkills` and `experience` byte-identical, summary +1 sentence. | The user pastes a job post and receives a résumé one sentence different, beside a red panel listing 12 things they may not claim. Reads as "you're unqualified". | Map bank keywords to evidence synonym sets — the `groundingAliasGroups` technique already exists in `generator.ts:56-106`. Then actually reorder bullets and show a real before/after diff. | M | before any payment |
| **CF-P1-06** | Output integrity | Occupation detection scans the **whole** work history, so a previous job's template rewrites the current job *(ran)* | `src/lib/generator.ts:1074-1078` — `evidenceText(data)` includes `previousTitle`/`additionalTitle`. Help Desk Technician + prior Security Guard → headline "Security Professional \| Technical Support", summary "…a safety-focused public-facing environment", plus an **ungated canned bullet** (`:1166`) under the IT employer. | Someone leaving security for IT gets a résumé anchored to the job they are leaving — the opposite of what a switcher pays for. | Detect occupation from the current role's own title/company (the `role` param is already threaded). Add a `when` gate to every canned bullet. | M | before public launch |
| **CF-P1-07** | Privacy | **"Clear all local Career Forge data" leaves the user's interview answers on the device** | `src/app/settings/page.tsx:129-141` removes five keys and omits `PREP_DRAFT_KEY = "career-forge-prep-drafts-v1"` (`interview-prep.ts:940`), written on every keystroke, holding up to 300 free-text answers — routinely containing terminations, layoffs, health, immigration status and salary. Also absent from the backup envelope. | On a shared or resold machine, a user who explicitly wipes their data leaves their most sensitive admissions behind. Symmetrically, backup/restore silently loses every draft. | Add the key to `clearLocalData` and cover it with a regression asserting the clear list equals all `career-forge-*` keys. Decide whether drafts belong in backups and say so. | S | before public launch |
| **CF-P1-08** | Billing | `npm run commerce:launch --target production` **provisions a live Stripe Payment Link that bypasses every safety gate and cannot be fulfilled** | `scripts/commerce-launch.mjs:234` `provisionLivePaymentLink` creates its own Product+Price at `RESET_PRICE_CENTS`, activates a `/v1/payment_links`, and never sets `STRIPE_PRICE_RESET`. A Payment Link is hosted by Stripe — `canSellSafely`, the certification pin and the approval record all live inside `/api/checkout` and cannot see it. | A buyer pays $49 on Stripe, is redirected to `/unlock`, and gets *"This checkout session is not a verified Career Forge purchase."* No email, no code, no license. | Delete `provisionLivePaymentLink`/`updatePaymentLink` and the env var; **log into Stripe and deactivate any existing link carrying metadata `career_forge_offer`.** | M | **before any payment** |
| **CF-P1-09** | Billing | A Stripe **TEST-mode session mints a real PRODUCTION license**, signed with the live key | `src/app/api/license/route.ts:23-28` — `useCertificationKey` is selected *precisely because* the primary key is live, then `getSigningKeyB64()` returns the same `LICENSE_SIGNING_PRIVATE_KEY`. `license.ts:15` has no `mode` field, so nothing downstream can tell a test license from a paid one. Same path in the webhook (`:60`, `:150`). Violates `docs/PAYMENTS.md:63` verbatim. | Anyone holding `CERTIFICATION_OPERATOR_TOKEN` can issue unlimited perpetual licenses at zero cost, indistinguishable from paid. | Use a separate certification signing keypair; add a `mode` field to the payload; make "CERTIFICATION_* absent" a hard `canSellSafely` blocker and surface their presence (boolean) in `/api/commerce-health`. | M | **before any payment** |
| **CF-P1-10** | Billing | **Revocation does not exist in any usable form** | `revokeRedemption` is never called by any route, and `/api/license` never imports the fulfilment store. `docs/PAYMENTS.md:142` documents this. The payload has no expiry and verification is fully offline. | After a refund or chargeback, the buyer's original success URL re-mints a fresh perpetual license forever. | Add a `ref` denylist checked in `/api/license` and `/api/redeem`, and ship a client denylist with each deploy. Document the refund policy in `/terms` first. | M | before public launch |
| **CF-P1-11** | Value leak | The $49 pack's headline deliverable is **free and nav-reachable** via `ResumePreview` | `src/components/ResumePreview.tsx:299-307` — `CopyButton "Copy full resume"` and `window.print()` "Print resume", with **no entitlement logic in the file at all**. Mounted at `/resume-builder`, `/interview` (in the nav as "Interview Practice") and `/story`. | Substantially the thing the $49 pack sells, two clicks away, on a nav route. | Gate all three mount points, or stop selling export. | M | before any payment |
| **CF-P1-12** | Value leak | `tailored_resume_export` is bypassed by the ungated **"Tailor again"** button | `src/app/versions/page.tsx:444` `tailorAgain()` calls `saveHandoff(...)` and pushes `/resume-builder` with no entitlement check; the consumer has none either. *(Verifier's qualification: the bypassed output is degraded — `handoffFromApplication` drops `coveredRequirements`/`bulletPrompts` — so the free path is real but weaker.)* | Removes the primary reason to move from $49 to $79. | Enforce where the capability happens (`resume-builder`'s `consumeHandoff`), not per-button. | S | before any payment |
| **CF-P1-13** | Commercial | Production runs gates **ON** in live mode while **nothing is buyable** — the deployed product is strictly smaller than the free beta *(ran)* | Live bundle chunk inlines `commerceMode="live", commerceEnabled=true`. `/api/commerce-health` → `canSellSafely:false`. `/pricing` → "Paid beta paused · Checkout closed while I verify delivery"; upper tiers → "Coming later · not for sale". | Every visitor today hits locks on `/versions`, `/tailor` and `/outreach`, is sent to `/pricing`, and is told it is unavailable. | Set `NEXT_PUBLIC_COMMERCE_MODE=off` on production until checkout is genuinely open and certified. Turn gates on in the *same deploy* that opens checkout. | S | before public launch |
| **CF-P1-14** | Release | Production enforces a **sixth entitled feature (`ats_structure_audit`) that exists in no ref** | Live chunk: `features:["export_baseline_pack","ats_structure_audit"]` for reset, plus a real `LockedFeaturePanel` consumption site. Live `/pricing` lists "Detailed ATS structure audit with issue-by-issue guidance". `git log --all -S 'ats_structure_audit'` → nothing. In source, `ATSValidationPanel` is ungated. | The matrix a customer would be charged against is not the matrix in git and not the one any test asserts. | Reconstruct the live matrix in source, land it, assert one test per feature, and redeploy from a commit that exists before opening checkout. | M | before any payment |

### Most consequential P2s (102 total; 24 shown)

| ID | Area | Finding | Evidence |
|---|---|---|---|
| CF-P2-01 | Career direction | Lane suggestions are still a fixed **9-lane tech-pivot library**, shown unranked and unfiltered to everyone | `src/lib/lane-library.ts:15`. A nurse sees QA Tester and Trust & Safety Analyst, all labelled "Exploratory". |
| CF-P2-02 | Career direction | The only history→role inference engine covers **17 hard-coded worker archetypes**, returns nothing for anyone else, and lives on a route absent from the nav | `src/lib/career-recommendations.ts:53`. Returns `[]` for a nurse and for a senior engineer. |
| CF-P2-03 | Data model | **No level, seniority or scope anywhere** — every producible target is entry-level | `src/types/dossier.ts:71`; every recommendation title is Associate/Assistant/Coordinator. |
| CF-P2-04 | Output integrity | Approved **Role Sprint practice work reaches the PROFESSIONAL SUMMARY** of the exported résumé | `resume-pack.ts:102` `approvedEvidence()` omits the `source !== "role-sprint"` filter that `job-post-analyzer.ts:123` has. |
| CF-P2-05 | Honesty | `matchRequirement` can return **"covered" citing approved evidence with an empty `evidenceIds`** | `job-post-analyzer.ts:454` falls back to `profile.transferableSkills` when no approved evidence exists. |
| CF-P2-06 | Honesty | The **"Resume Quality" meter rates a draft with broken sentences "Excellent — 100"** | `resume-intelligence.ts:294-352` is a structural checklist with no prose check. |
| CF-P2-07 | Output quality | Bullet composition welds fragments into ungrammatical sentences | `generator.ts:1555` — e.g. "…trained two new bartenders to support Regulars started asking for me by name." |
| CF-P2-08 | Output quality | **PDF export emits mojibake** for any name outside Latin-1 — no font embedded | `pack-export.ts:181` uses standard-14 Helvetica; no `addFileToVFS` anywhere. |
| CF-P2-09 | Data loss | Every edit in the résumé preview is **discarded**; the version keeps the pre-edit draft | `resume-builder/page.tsx:190-234`. |
| CF-P2-10 | Honesty | Termination-reason stripping **welds two sentences into a run-on** | `truth-guards.ts:55-62` rejoins clauses with a bare space and no terminator. |
| CF-P2-11 | Analysis | The requirement extractor keeps credential/years gates and drops plain responsibility lines, so **every analysis skews toward "unqualified"** | `job-post-analyzer.ts:55-59` `REQUIREMENT_SIGNAL`. |
| CF-P2-12 | Discoverability | `/truth-map` — the fact-vs-assumption provenance view, the headline differentiator — is **linked from nowhere** | `CommandNav.tsx:10`. |
| CF-P2-13 | Discoverability | `/weekly` — the only real returning-user surface — is **linked from nowhere** | Verified against 10 live routes: zero `href="/weekly"`. |
| CF-P2-14 | Retention | Momentum metrics **reward volume**; tailored résumés are double-counted; 5 unsent drafts outscore a real interview | `command-center-insights.ts`, `weekly-review.ts`. |
| CF-P2-15 | Retention | `intentMilestones` contains **no interview and no offer**; reaching "offer" *lowers* the ladder | Verified by running. |
| CF-P2-16 | Onboarding | **"Clear facts are preselected" is false** — a realistic import preselects 3 of 22 | `intent-router.ts:45` + `classifyImportLine`. |
| CF-P2-17 | Onboarding | Résumé **section headings are proposed as career facts** ("EXPERIENCE", "SKILLS") | `dossier.ts:545`. |
| CF-P2-18 | Onboarding | Bulk-approving Identity can set the résumé header to **"PROFESSIONAL SUMMARY"**, and doing so silences the guard that would have caught it | `dossier.ts:636`. |
| CF-P2-19 | Onboarding | Two of three first-run goals route to the same destination, and the **career-change goal cannot be chosen at all** | `IntentRouter.tsx:19` vs `intent-router.ts:8`. |
| CF-P2-20 | Copy | `/founding-beta` unconditionally prints **"Secure checkout is live."** regardless of commerce mode — and `ease-of-use-regression.mjs:64` **asserts that string must stay** | `founding-beta/page.tsx:55,61,67`. |
| CF-P2-21 | Test integrity | **No test anywhere loads `src/lib/entitlement.ts`** — the module that decides gating. `docs/PAYMENTS.md:25` claims otherwise | Grepped all 66 scripts for `hasFeature`/`laneLimit`: zero hits. |
| CF-P2-22 | Test integrity | The only end-to-end paid/unpaid proof activates a **$99** key; **no browser test ever activates the $49 key**, the only tier live checkout sells | `scripts/journey-browser.mjs:165`. |
| CF-P2-23 | CI | Both workflows trigger **only on `pull_request`** — nothing verifies `main` after merge or verifies a deployment | `.github/workflows/*.yml`. |
| CF-P2-24 | Certification | The certified-surface hash **omits `license.ts`, `entitlement.ts`, and `certification.ts` itself** — the signature verifier can be rewritten without voiding a certification | `scripts/compute-surface-hash.mjs`. |

### Refuted (recorded for completeness)

Four findings did not survive verification and are excluded from all counts and scores. The most notable: a claim that the résumé `time`/dates field failed to render — I raised it from my own probe and disproved it myself; the field is `time` and is correctly populated (`"2018–Present"`). This is why the ledger separates *ran* from *read*.

---

## 7. Recommended payment architecture

### The decision the architecture forces

Career Forge is a **local-first, no-account, no-LLM, deterministic** product. That is a deliberate and defensible strategy — but it has one unavoidable commercial consequence: **the client cannot withhold a capability it has already shipped.** Every gate is a render conditional over code in the buyer's browser, in a public repository. No amount of hardening changes this; only an architecture change or a different thing-to-sell does.

So the honest choice is between:

- **(A) Sell something the architecture *can* withhold** — human work, or a server-side capability that does not exist yet; or
- **(B) Accept that gates are honour-system**, price accordingly, and stop describing client conditionals as enforcement.

**Recommendation: (A), with a bridge.**

### Recommended primary model: **free software + a single one-time paid offer, led by the $149 human review**

*(Primary = the $149 human-reviewed service, which is enforceable and coherent today. Secondary = at most **one** one-time software pack, replacing all three current tiers, and only after the pilot produces willingness-to-pay evidence.)*

**Why one-time and not subscription.** Job searching is episodic — intense for weeks, then over. Recurring payment must be supported by recurring *value*, not recurring access, and this product currently has no recurring value: `/weekly` is orphaned, nothing consumes outcomes, no notification can reach a user who closed the tab, and cost-to-serve is ~$0 because everything runs client-side. Charging monthly for a local app that cannot even tell time has passed would be extractive and would churn at the first renewal.

| | Recommendation |
|---|---|
| **Free experience** | The entire build-and-review workflow **including export**. Dossier, evidence review, lanes, Résumé Pack, PDF/DOCX/ZIP, application tracking, outreach tracking, interview question generation. Rationale: export is the act of receiving your own data; gating it in a local-first product is off-brand *and* unenforceable, and it is already bypassable in two clicks. |
| **Paid option** | **One** paid pack. Boundary drawn at *judgement and review*, not at *file format*. |
| **Exact boundary** | Free = *everything the machine can do with what you typed.* Paid = *someone or something checked your work.* Concretely: (a) the $149 human résumé review — already built, already honest, already refundable; (b) a genuinely server-side tailoring/critique capability if and when one is built (see §9). |
| **Billing cadence** | One-time, per engagement. No subscription, no trial, no credits. |
| **Usage limits** | None on the free tier. Limits on a free local product are unenforceable theatre. |
| **Upgrade moments** | Exactly one, and it already exists in the right place: after "Your Résumé Pack is ready." Change the offer from "unlock your export" to "have a person review this before you send it." |
| **Must remain free** | Export in every format; dossier and evidence review; application and outreach tracking; interview question generation; all three résumé lanes. |
| **Credibly deserves payment** | Human review. Server-side capability that cannot ship to the client. Priority support and guided onboarding (the `/founding-beta` promises). |
| **Required to justify recurring payment** | Would need *all* of: outcome-aware learning (the pack improves because you got an interview), a reachable time-aware surface (notifications or email digest, neither of which exists), multi-device sync, and a server-side capability. That is a different product. Do not attempt recurring revenue until at least three of those exist. |
| **Remove** | The $79 and $99 tiers; the legacy Payment Link; the `career_switch_toolkit` flag; the `laneLimit` gate. |

### Secondary option (only if a server capability lands)

A **credit pack** for server-side operations — e.g. 10 deep tailoring runs for a fixed price. This fits the episodic lifecycle, is genuinely enforceable because the work happens on a server, and its cost-to-serve is real and bounded. Do **not** introduce it before such a capability exists; today it would be selling credits redeemable against client-side code.

### On price

Repository evidence does **not** support any specific number. `docs/PAYMENTS.md`, `docs/FOUNDING_USER_PILOT.md` and `docs/CAREER_FORGE_MARKET_MAP_2026.md` all state that $49/$79/$99 are hypotheses with no willingness-to-pay evidence. The only price with evidence behind it is **$149**, because a human does bounded, describable work with a stated refund policy and a fulfilment runbook.

If a single paid pack is wanted as a bridge, **$29–$49** is the defensible range, on these stated assumptions: (1) the market map records competitor anchors at $19–$89; (2) marginal cost to serve is ~$0; (3) the buyer receives no ongoing service; (4) the differentiator is provenance discipline, which is real but invisible until used. **Do not set a price before the five founding-cohort interviews in `docs/FOUNDING_USER_PILOT.md` are actually run** — that is the evidence gate the repo already defined for itself, and it has not been met.

---

## 8. Launch blockers

### Must fix before accepting any payment (including founding-cohort dollars)

1. **CF-P0-01** — approved evidence, roles and Experience sections silently deleted by the gap classifier.
2. **CF-P0-02** — cross-role evidence attribution fabricates employment history and the receipt certifies it.
3. **CF-P0-03** — `/versions/view` gives away the only sellable tier's headline deliverable.
4. **CF-P0-04** — production runs a commit that exists in no ref; re-establish a reproducible deployment and disable CLI production deploys.
5. **CF-P1-08** — delete the ungated live Payment Link path **and deactivate any link already provisioned in Stripe.** *(Requires a human with Stripe dashboard access — I cannot and did not check the account.)*
6. **CF-P1-09** — test-mode sessions minting production-signed licenses.
7. **CF-P1-01 / CF-P1-02** — the fabricated early-win bullet and the regression that whitelists it.
8. **CF-P1-04** — the malformed `defensibility.ts` regex that blocks export after any edit.
9. **CF-P1-11 / CF-P1-12** — the `ResumePreview` and "Tailor again" entitlement leaks.
10. **CF-P1-14** — reconstruct the live entitlement matrix in source before charging against it.
11. **Publish a refund policy for the software packs in `/terms`.** Selling a digital product with no stated refund terms is a consumer-protection exposure and contradicts `docs/FOUNDING_USER_PILOT.md`.
12. **Fix `main`'s red test suite** — `npm run test:unit` exits 1 today, and the `&&` chain aborts before `trust-boundary`, `founding-user-simplicity` and `compute-surface-hash --check` ever run.

### Must fix before public launch

- **CF-P1-13** — set `COMMERCE_MODE=off` in production until checkout genuinely opens.
- **CF-P1-03** — resolve the enforceability question honestly (§7); at minimum stop calling client conditionals "enforcement" in docs.
- **CF-P1-05 / CF-P1-06** — inert tailoring and cross-role occupation contamination.
- **CF-P1-07** — `clearLocalData` leaving interview drafts behind.
- **CF-P1-10** — a usable revocation path.
- **CF-P2-20** — the `/founding-beta` "Secure checkout is live" contradiction and the test that pins it.
- **CF-P2-23** — add a `push: [main]` CI trigger; a red `main` currently has no detector.
- **CF-P2-21 / CF-P2-22** — test `entitlement.ts` at all, and test the $49 tier specifically.
- **CF-P2-01 / CF-P2-02** — either rank and filter lanes against the user's own evidence, or state the narrow ICP honestly on `/pricing` and the landing page.
- **CF-P2-12 / CF-P2-13** — link `/truth-map` and `/weekly` from the navigation.
- Say what the product makes, above the fold, in server-rendered HTML.

### Can follow after launch

- Level and seniority modelling (CF-P2-03); transferable **traits** as a first-class concept.
- PDF Unicode font embedding (CF-P2-08).
- Prose-quality checks in the résumé quality meter (CF-P2-06) — or rename it "Completeness".
- Real interview practice: persisted attempts, question-aware coaching, measurable improvement.
- Outcome-aware learning (packs that improve because an application progressed).

---

## 9. Highest-leverage implementation sequence

| # | Change | Reason | Dependencies | User impact | Revenue impact | Validation |
|---|---|---|---|---|---|---|
| 1 | **Set `NEXT_PUBLIC_COMMERCE_MODE=off` in production** | One env var converts today's worst state (maximum friction, zero income, unbuyable locks) into an honest, fully usable free beta. Nothing else is cheaper. | None | Every locked surface becomes usable immediately | Unblocks the pilot that generates the WTP evidence the pricing decision needs | `curl /api/commerce-health`; confirm `/versions` shows export controls with no license |
| 2 | **Deactivate any live Stripe Payment Link; delete the provisioning code** | The single path by which money can be taken and provably not delivered | Stripe dashboard access (human) | None | Removes chargeback exposure | Stripe dashboard shows no active link with metadata `career_forge_offer` |
| 3 | **Fix CF-P0-01 and CF-P0-02** | Data destruction and résumé fabrication. Everything else is commercial; these are harm. | None | Users stop losing approved work; exports stop naming the wrong employer | Prerequisite to any sale | New fixtures: the three false-positive phrases; a two-job persona asserting `role[1].bullets` is empty without its own evidence |
| 4 | **Fix CF-P1-01, CF-P1-02, CF-P1-04** (three small diffs) | The fabricated first bullet, the test that permits it, and the regex that blocks export after any edit. High trust damage per unit of effort. | None | First artifact stops lying; editing stops breaking export | Removes two guaranteed refund triggers | Assert every preview bullet is a substring of approved input; assert `isUserAuthoredClaim("experience.0.bullets")` is true |
| 5 | **Reconstruct or discard commit `98213c2`; disable CLI production deploys** | Until the live artifact is in git, no audit, rollback, or certification means anything | Vercel project settings | None directly | Makes the sell gate trustworthy rather than accidentally closed | `gh api …/commits/<sha>` returns 200; `/api/commerce-health` reports a known commit |
| 6 | **Add `push: [main]` to CI and fix the date-dependent fixture** | `main` is red today and nothing detects it; the fix already exists on unmerged PR #51 (`4195002`) | None | None | Protects everything above from silent regression | A push to `main` produces a run; `npm run test:unit` exits 0 |
| 7 | **Run the five founding-cohort interviews** per `docs/FOUNDING_USER_PILOT.md` | The repo already defined this as its own evidence gate for pricing and has not met it | Steps 1, 3, 4 (users need a working, honest product) | Users get guided onboarding | **Produces the first real willingness-to-pay evidence in the project's history** | The 8-criterion bar in the pilot doc, honestly scored |
| 8 | **Collapse to one paid option** (§7): remove $79/$99, re-anchor $49 (or $29–$49) away from "export" | Tier differentiation is currently fictional; one honest option beats three unenforceable ones | Step 7's evidence | Pricing becomes explicable in one sentence | Higher conversion on a claim that survives scrutiny | Show the new pricing to 5 people; ask each what they get. If they cannot answer, it is not fixed. |
| 9 | **Make lanes evidence-ranked, or state the ICP honestly** | The career-direction engine is the biggest gap between promise and behaviour | None | A nurse stops being offered QA Tester | Determines whether the addressable market is "job seekers" or "people pivoting into tech support" | Run the non-ICP persona probe; assert no lane above threshold without real overlap |
| 10 | **Build one genuinely server-side capability, or commit to the human service** | The only way to make paid access enforceable, or to stop pretending it is | Steps 7–8 | A paid tier that visibly does more | Converts honour-system pricing into real pricing | An unlicensed client cannot obtain the output by any client-side means |

---

## 10. Final adversarial judgment

**1. Would a job seeker understand why they should use Career Forge instead of ChatGPT?**
**No.** Nothing a first-time visitor sees explains it. The H1 is "What are you trying to do?", and the one sentence that would differentiate it — *"Not another AI résumé writer."* — is inside a collapsed `<details>`. The real answer (*ChatGPT will invent a plausible bullet; this will not, and it shows you the source of every claim*) is a strong answer that the product never says out loud. Worse, the manual first-run path currently *does* invent a bullet, so even a user who understood the pitch would see it broken at minute two.

**2. Would a free user encounter enough value to trust the product?**
**Not today.** Locally, with commerce off, a user gets a genuinely useful reviewed dossier and a source-linked résumé pack — that is real value. But on production right now they hit locks they cannot buy out of; the manual path shows an invented bullet under "Nothing here was invented"; and a security or compliance worker will silently lose their entire work history. Trust is the product's whole thesis, and three specific defects break it in the first session.

**3. Would a paying user immediately understand what their money unlocked?**
**No.** A $49 buyer would find that they still have one lane where the free build had three, that export was reachable from a button labelled "View & export", and — if they edit a single bullet — that every export button switches off with a message blaming missing evidence. A $99 buyer would find nothing at all changed except one extra lane.

**4. Are the payment options meaningfully different?**
**$49 → $79 is real** (tailoring, outreach, unlimited interview turns are genuinely enforced), though leaky and currently low-value. **$79 → $99 is not.** Its exclusive entitlement is read by zero lines of code, three of its five exclusive deliverables have no implementation, and its measured advantage is one extra résumé lane for $20.

**5. Does the product currently earn recurring revenue?**
**No — and it should not try.** There is no recurring value: the one returning-user surface is unlinked, nothing consumes outcomes, the app cannot notify or even observe that time passed, and marginal cost to serve is ~$0. Job searching is episodic. A subscription here would sell access, not value.

**6. Which payment option should Career Forge lead with?**
**The $149 human-reviewed résumé service.** It is the only offer whose promise, fulfilment, refund terms and cost-to-serve are all coherent — and, critically, the only one immune to the enforceability problem, because a person doing work cannot be bypassed by clicking a different button. Lead with it; make the software free while the pilot runs.

**7. Which option should be eliminated?**
**The $99 Career Switch Pack**, immediately — it is a price with no product behind it. And with equal urgency, though it is not a "tier": **the legacy live Stripe Payment Link**, which can take money that provably cannot be fulfilled.

**8. What is the single largest gap between the career-building promise and actual behaviour?**
**Career Forge promises career *direction* and delivers résumé *formatting*.** The interface asks "What are you trying to do?" and the $99 card says "You are moving into a new industry or kind of work." What exists is nine hard-coded tech-support lanes shown unranked to everyone, an inference engine covering 17 archetypes that returns nothing for a nurse or a senior engineer, no concept of level or seniority anywhere in the data model, and a generator that hands your own sentences back re-punctuated. I ran an ICU nurse through the real pipeline: her exported bullets were her nursing bullets verbatim, and her career options were AI Support Specialist and QA Tester.

**9. What is the single largest gap between the pricing promise and entitlement implementation?**
**`career_switch_toolkit`.** The $99 tier's entire reason to exist is a flag that appears in exactly three places: the type union, the tier's feature list, and a test asserting the tier has it. Zero code reads it — in the repo *and* in all 26 chunks of the production bundle. The test suite passes a check literally named *"career-switch toolkit is exclusive to the top tier"* while the toolkit gates nothing. That is the perfect illustration of the systemic problem: **the tests assert the configuration, never the enforcement.**

**10. What must change for a genuine 10/10 ease-of-use launch gate?**
Six things, in order:

1. **Say what it makes, above the fold, in server-rendered HTML.** A first-time visitor must know within ten seconds that this turns work history into source-linked résumé drafts that never invent claims.
2. **Never show an invented bullet, and never silently delete an approved fact.** These two defects invalidate the product's only differentiator. Nothing else matters until they are closed.
3. **Make the first result honest and fast, and make the free path complete.** A user must be able to go from landing to a downloaded résumé without meeting a lock they cannot open.
4. **Offer one paid thing whose value a user can state in their own words.** If five people cannot each say what they get, the packaging has failed.
5. **Make the career-direction engine reflect the user, or state the ICP plainly.** "For people pivoting from customer-facing and operations work into tech-adjacent support roles" is an honest, sellable positioning. "Your career is bigger than your last résumé" is not, while a nurse is being offered QA Tester.
6. **Make the deployed artifact reproducible from source, and keep `main` green.** Ease of use cannot be certified on a build nobody can read.

The existing gate document scores itself 7.5/10 against a required 10/10. **On this audit's evidence the honest score is lower**, because that document does not account for the fabrication defects, the silent data deletion, or the fact that the live product cannot be reproduced from the repository.

---

## Appendix A — Commands run, and their results

All commands were run read-only from `/Users/koi/Projects/career-forge-lite` on `main` @ `909a5bb`, node v24.16.0, on 2026-08-03.

| Command | Result |
|---|---|
| `npm install --no-audit --no-fund` | exit 0 (`node_modules` was absent) |
| `npm run test:unit` | **exit 1** — 1403 `PASS`, 1 `FAIL`: `FAIL Today: interview link carries exact application`; `State integrity regression: 34 passed, 1 failed`. The `&&` chain aborts, so `trust-boundary-regression`, `founding-user-simplicity-regression` and `compute-surface-hash --check` **never ran**. |
| `node scripts/state-integrity-regression.mjs` | exit 1 — reproduced in isolation. Fixture is wall-clock dependent; a fix (`4195002 "Make interview routing fixture date-safe"`) exists only on unmerged draft PR #51. |
| `node scripts/entitlement-regression.mjs` | exit 0 — **42 passed, 0 failed** |
| `node scripts/fulfillment-safety-regression.mjs` | exit 0 — **149 passed, 0 failed** |
| `node scripts/trust-boundary-regression.mjs` | exit 0 — **32 passed, 0 failed** |
| `node scripts/commerce-launch-regression.mjs` | exit 0 — **33 passed, 0 failed** |
| `node scripts/interview-prep-regression.mjs` | exit 0 — **67 passed, 0 failed** |
| `npm run typecheck` | exit 0, no output |
| `npm run lint` | exit 0, one warning (`src/components/tailor/TailorWorkspace.tsx`) |
| `npm run test:browser` | exit 0 — 39 `PASS`, "Career Forge usability regression passed on desktop and mobile", "Final Role Sprint browser acceptance: 25 passed, 0 failed". *First attempt failed with `browserType.launch: Executable doesn't exist` — an environment gap, not a code defect; passes after `npx playwright install chromium`.* |
| `git cat-file -t 98213c25…` | **fatal: could not get object info** |
| `gh api repos/koinophobia-labs/career-forge-lite/commits/98213c25…` | **HTTP 422 — "No commit found for SHA"** |
| `gh run list --limit 15` | All runs `pull_request`-triggered; none from a push to `main` |
| `curl https://career-forge-lite.vercel.app/api/commerce-health` | `liveMode:true, canSellSafely:false`; blockers: certification pins `28d3def`, deployment runs `unknown`; "Live checkout has not been authorized" |
| `POST /api/checkout {"tier":"reset"}` (production) | `503 fulfillment_not_ready` |
| `POST /api/checkout {"tier":"job-search"\|"career-switch"}` (production) | `403` |
| Vercel `list_deployments` | Production = `dpl_EzGRZ3RCXRPTcHQsF7So167R7swT`, commit `98213c2`, actor `codex`, `gitCommitRef: HEAD`, 2026-07-28T20:29:09Z |

### Audit-only scripts (written to a scratchpad, **not** to the repository)

- `cf-audit-entitlement-probe.mjs` — loads the real `packages.ts`, `license.ts`, `license-mint.ts`, `feature-access.ts`; greps every `hasFeature()` site; emits the enforcement census, the tier matrix, the per-upgrade capability delta, the free-vs-paid comparison, the interview-limit boundary table, and nine license-integrity assertions. Key results are reproduced verbatim in §3.3.
  - License integrity: genuine key verifies; payload edited to `career-switch` → `rejected (bad-signature)`; key from another keypair → `rejected (bad-signature)`; no public key → never grants; payload has **no expiry field**.
  - Interview boundary: free locks at exactly **6** answers; paid is `Infinity`.
- `cf-audit-output-quality-probe.mjs` — runs `mergeIntakeIntoDossier` → `generateResumePack` for an in-ICP persona (retail → product support) and an off-ICP career changer (ICU nurse → clinical operations), printing the real generated summary, bullets and LinkedIn headline, then enumerates the lane library offered to both. Output is quoted in §2.

### Coverage note

This audit did **not** verify: the state of the live Stripe account (no dashboard access — the Payment Link in CF-P1-08 must be checked by a human); whether the four `CERTIFICATION_*` variables are currently set on production (not externally observable, which is itself part of CF-P1-09); the contents of the Neon `cf_docs`/`cf_approvals` tables; or the behaviour of the unreproducible production commit beyond its served HTML, its JS chunks and its API responses. Claims about production are limited to what those three surfaces show.

