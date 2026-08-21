# Career Forge — Microscopic Product & Payment Re-Audit

**Audited commit:** `af431c10092b311909e879ddcdc755314e1e73b8` (`main`, "Stop semantic invention and preserve user wording (#56)")
**Production verified at:** `af431c10092b` — confirmed from the deployed app's own `/api/commerce-health`, not inferred from git.
**Method:** clean `git clone` of pushed `main` + `npm ci` (exit 0). Independent first pass with new fixtures **before** reading the original audit or running any author-written regression.
**Scope:** audit only. No production code, pricing, commerce, deployment configuration or product behaviour was modified. Nothing merged, nothing deployed. No Stripe access, no refunds, no money moved.
**Protocol:** `truth-sensitive-merge-protocol` — independent adversarial verification with permission to contradict a green suite.

---

## 1. Executive verdict

| Dimension | Original | **Now** | Basis |
|---|---:|---:|---|
| Career-building depth | 3 | **3** | Unchanged. Still 9 hard-coded tech-support lanes, no concept of level or seniority, no career-direction engine. Nothing in #52 or #56 added career capability. |
| First-time usability | 4 | **5** | The invented first bullet is genuinely gone. But the first artifact can still print `"Supported DeSoto."` from a compound sentence and assert acts the user never described. |
| Output quality | 3 | **4** | Cross-employer fabrication is structurally fixed — the single biggest repair. Offset by a new P0 class: the generator asserts unmade claims and, in one path, **deletes a true statement** and fabricates a replacement. |
| Continued-use value | 3 | **3** | Unchanged. `/weekly` still linked from nowhere; milestones still contain no interview and no offer. |
| Payment-option clarity | 2 | **2** | Unchanged. Same contradictory copy, same nine money paths, still zero purchasable. |
| Tier differentiation | 1 | **1** | Unchanged. `career_switch_toolkit` is still granted and still read by no code. |
| Pricing-to-value alignment | 2 | **2** | Unchanged. Free still grants strictly more than the $49 pack (5/5 features and 3 lanes vs 1/5 and 1). |
| Billing implementation integrity | 6 | **7** | Release integrity restored: production is reproducible, the new SHA correctly invalidated stale certification, the sell gate fails closed. Test-mode→production license minting and absent revocation remain. |
| User trust | 3 | **4** | Silent data destruction is fixed and admissibility is genuinely derived and reversible. Undercut by the generator still putting words in the user's mouth. |
| **Overall readiness to charge** | 1 | **2** | — |

### Verdict: **NOT READY TO CHARGE**

Unchanged from the original audit, for changed reasons. The two headline defects that drove the first verdict are genuinely closed. Three independent reasons still block any payment:

1. **A user's own statement of a gap is printed on their résumé.** `classifyEvidenceAdmissibility` returns `claim` for `"As of today do not hold any certifications"`, `"Frankly I have never supervised anybody"`, `"Realistically lack any formal project management background"` and `"To be honest have no measurable results yet"`. Verified end-to-end: the text reaches `approvedClaims`, the in-memory résumé, the evidence drawer, the pack receipt **and the plain-text export**. One of those four (`"As of today do not hold…"`) was correctly caught on `909a5bb` and **regressed by PR #52**. (RA-P0-01)
2. **The generator asserts acts the user never described, and in one path destroys a true statement.** `composed()` gates its clauses but splices its **lead verb** in unconditionally, so `"Maintained the safety log"` yields `"Reported safety concerns."`. Separately, `splitResponsibilityText`'s narration filter deletes `"Reported to my manager"` from every surface while fabricating `"Escalated customer issues to leads or managers."` from the leftover word. (RA-P0-02, RA-P0-03)
3. **The export paywall is still a no-op.** `export_baseline_pack` — the only feature the only sellable tier grants — is still bypassed by `/versions/view`, a route the app itself links from every version row labelled "View & export". Unchanged since the original audit. (CF-P0-03, surviving)

### What genuinely improved, and must not be lost

- **Cross-employer fabrication is structurally fixed.** Evidence carries an explicit `roleId` stamped at write, revived explicitly, and participating in the record id. A full job-change replay through `intakeFromDossier` no longer re-attributes the previous employer's duties. Independently reproduced with new fixtures.
- **Admissibility is derived, not stored.** `sanitizeCareerDossier` returns the record byte-identical, is a fixed point, and correcting quarantined wording restores the record through to generated output. The irreversible `kind` rewrite is gone.
- **Release integrity is restored.** Production runs a commit that exists in git. `/api/commerce-health` reports `this deployment runs af431c10092b` where it previously reported `unknown`. The phantom `ats_structure_audit` entitlement is gone from both code and the live bundle.
- **The sell gate is working exactly as designed.** The new SHA invalidated the stale certification (`certifies 28d3def1ef5f; this deployment runs af431c10092b`), `canSellSafely` is `false`, and no paid-but-unfulfilled session is recorded.
- **License cryptography and session verification held under attack.** An independently minted forged localStorage license was rejected (`bad-signature`); `verifyPaidSession` rejected metadata-tier-upgrade, amount tampering, unpaid status and session-id mismatch.
- **Identity no longer grounds work.** Six new title+employer fixtures (`"Inventory Control Clerk" @ "Barcode Accuracy Systems Inc"`, `"Sanitation Technician" @ "SafeClean Facilities"`, …) each produced zero bullets, zero skills, no strengths sentence and no competency claim.
- **Proper nouns survive.** Seven of eight new fixtures (`Ypsilanti`, `Baie-Comeau`, `LaGrange`, `Trader Joe's`, `FitzGerald`, `Wal-Mart`, `DuPont`) verbatim through generation, narrative, JSON round-trip and plain-text export. The eighth failed on sentence **splitting**, not casing.

---

## 2. What changed since the original audit

Closure is asserted only where independently reproduced through the real user-facing pipeline. A merged PR earns nothing.

| ID | Original defect | Status | Independent reproduction |
|---|---|---|---|
| **CF-P0-01** | Gap classifier false-positives silently delete approved facts, roles and Experience sections on every read | **Partially fixed — with a regression** | Deletion is gone: sanitize returns the record byte-identical and is a fixed point. But the classifier's *false-negative* surface is now larger. `"As of today do not hold any certifications"` = `gap` on `909a5bb` → `claim` on `0f379fb` → `claim` on `af431c1`. Four more gap phrasings classify as `claim` on all three commits. Now **RA-P0-01**. |
| **CF-P0-02** | Exported résumés attribute one job's duties to a previous employer; receipt certifies "direct" | **Fixed** | Full job-change replay (`Dispatch Clerk @ Vance Freight` → `Operations Coordinator @ Kestrel Supply` via `intakeFromDossier`): new employer inherits no prior duty. Evidence carries `roleId`. Two-word fragment cannot corroborate a foreign claim. |
| **CF-P0-03** | `export_baseline_pack` bypassed by the product's own UI | **Unchanged** | `/versions/view` imports no entitlement code; `resumeToText(data, resume)` has no tier parameter. Linked from every version row as "View & export". |
| **CF-P0-04** | Production serves code in no git ref | **Fixed** | `/api/commerce-health` reports `af431c10092b`; commit resolves in `origin/main`. Phantom `ats_structure_audit` absent from code and from the live `/pricing` bundle. |
| **CF-P1-01** | First output fabricates a bullet under "nothing was invented" | **Fixed** | Early-win preview returns only the user's own approved lines across duplication paths. |
| **CF-P1-02** | The regression whitelisted the rewrite that invents | **Fixed** | Whitelist gone; assertion compares whole bullets. |
| **CF-P1-03** | No paid capability enforceable; default build grants everything | **Unchanged** | Free (`COMMERCE_MODE=off`) = 5/5 features, laneLimit 3; `$49` reset = 1/5, laneLimit 1. All feature gates client-side. |
| **CF-P1-04** | Editing any field disables every export button | **Fixed** | Edits to bullets, title, company and time each keep `missingProvenance: 0` with a human-recheck status. |
| **CF-P1-05** | Tailoring effectively inert | **Unverified** | Not independently re-driven this pass. Disclosed rather than assumed. |
| **CF-P1-06** | Occupation detection scans whole history; previous job rewrites current | **Likely fixed, method-limited** | Occupation gates now ground on `buildActivityCorpus`, which excludes all title fields, so a previous *title* can no longer drive the template. Not proven by a dedicated two-occupation runtime fixture. |
| **CF-P1-07** | "Clear all data" leaves interview answers on device | **Fixed** | `settings/page.tsx:136` now removes `INTERVIEW_SESSION_KEY`. |
| **CF-P1-08** | `commerce:launch` provisions an ungated live Payment Link | **Unchanged** | `scripts/commerce-launch.mjs:234-295` still provisions a live `buy.stripe.com` link gated only by local possession of an `sk_live_` key — not by `canSellSafely`. |
| **CF-P1-09** | TEST-mode session mints a real PRODUCTION license | **Unchanged** | `api/license/route.ts:22-28` still selects the certification key for `cs_test_` sessions and signs with the single production signing key. |
| **CF-P1-10** | Revocation does not exist in usable form | **Unchanged** | `revokeRedemption` exists only in `fulfillment-store.ts`; no route calls it. |
| **CF-P1-11** | $49 headline deliverable free via `ResumePreview` | **Unchanged** | `ResumePreview.tsx:300` `CopyButton "Copy full resume"` — no `hasFeature` in the file. |
| **CF-P1-12** | `tailored_resume_export` bypassed by "Tailor again" | **Unchanged** | `versions/page.tsx:444` `tailorAgain()` reachable with no entitlement check. |
| **CF-P1-13** | Live gates on, nothing buyable, product smaller than free beta | **Unchanged** | `canSellSafely: false`, live mode on. |
| **CF-P1-14** | Production enforces `ats_structure_audit`, existing in no ref | **Fixed** | Gone from code and from production. |

**Closure: 6 fixed, 1 partially fixed with a regression, 9 unchanged, 1 likely-fixed method-limited, 1 unverified.**

---

## 3. Product reality map

What a job seeker can genuinely accomplish today, unaided, on the deployed build:

- **Paste a job posting and see what they can prove** (`/tailor`). Still the best entry in the product: one input, no profile required.
- **Enter work history through a guided intake** and get a deterministic résumé assembled from their own sentences, with per-role evidence ownership that no longer misattributes duties between employers.
- **Approve or reject each claim**, and see quarantined items excluded from output — and now recover them by correcting the wording.
- **Edit any field and still export.** Export produces plain text, PDF, DOCX and a ZIP pack.
- **Track applications, run interview preparation, generate outreach drafts.**

What it does **not** do, despite implication: choose a career direction beyond 9 hard-coded tech-support lanes; model level or seniority; improve the user's writing (it echoes their sentences); provide any recurring reason to return (`/weekly` remains unlinked); or enforce a single paid capability.

**Category reality:** a local-first résumé and application organiser with an unusually rigorous provenance layer. Not a career operating system, not a career-direction engine, not an AI writer.

---

## 4. Full payment and entitlement matrix

| Plan | Price | Cadence | Claimed capability | Actual enforcement | Purchasable today |
|---|---:|---|---|---|---|
| Career Reset | $49 | one-time | `export_baseline_pack` (`packages.ts:26-43`) | Client-side on `/versions`; **ungated on `/versions/view`** | **No** — `canSellSafely: false`; `pricing/page.tsx:198` blocks any tier ≠ `paidBetaTier` |
| Job Search | $79 | one-time | + `tailored_resume_export`, `outreach_toolkit`, `interview_unlimited` | Client-side; `tailored_resume_export` bypassed by "Tailor again" | **No** |
| Career Switch | $99 | one-time | + `career_switch_toolkit`, laneLimit 3 | laneLimit enforced; **`career_switch_toolkit` read by zero code** | **No** |
| Reviewed Service | $149 | one-time | Human résumé review (`reviewed-service/page.tsx:31`) | `mailto:` only — no Stripe, no entitlement | Yes, manually — outside automated commerce |
| Free beta (`COMMERCE_MODE=off`) | $0 | — | — | **5/5 features, laneLimit 3** | n/a |

**Dead / phantom:** `career_switch_toolkit` (granted `packages.ts:83`, consumed nowhere); "closes after five completed purchases" (`founding-beta/page.tsx:56` — no purchase-count logic in `api/checkout` or `server/stripe.ts`); `STRIPE_LIVE_RESET_PAYMENT_LINK` (`stripe.ts:65-68`, read by nothing in `src/app`).

**Server-side gates:** `/api/checkout` live mode (`sellVerdict()` + tier match), `/api/license`, `/api/redeem`, `/api/invite`, `canSellSafely`. **Client-side only:** every feature entitlement.

**Commerce closure verified:** `canSellSafely: false`; stale certification correctly forces false (`certifies 28d3def1ef5f; this deployment runs af431c10092b`) and a synthetic fresh cert+approval control correctly flips it true — the mechanism works, it is simply not satisfied. No route writes `APPROVAL_RECORD_ID`. No paid-but-unfulfilled session recorded. A forged localStorage license is rejected. Legitimate buyers are **not** blocked post-fulfilment — `/api/license` and `/api/redeem` deliberately do not consult `canSellSafely`.

**Issue #55 — separating evidence from inference.** *Evidence:* `scripts/commerce-launch.mjs:234-295` can still provision a live Payment Link, gated only by local possession of an `sk_live_` key, not by any in-app gate; the app no longer reads the resulting env var. *Inference, not evidence:* whether any such link is currently active on Stripe. **This is unverifiable from here and was not checked.** Issue #55 remains correctly classified as requiring an authorized human with dashboard access. Deactivating links and issuing refunds are not agent actions.

---

## 5. Payment-option comparison

| Option | Disposition | Reason |
|---|---|---|
| $49 Career Reset | **Replace** | Its only deliverable is reachable free via two ungated routes. Nothing to sell until enforcement exists. |
| $79 Job Search | **Remove** | Three of its four exclusives are unenforced or bypassed. |
| $99 Career Switch | **Remove** | Exclusive entitlement is dead code; real delta over $79 is one résumé lane. |
| $149 Reviewed Service | **Keep — lead with it** | The only offer whose value is delivered by a human and cannot be bypassed by a client-side gate. |
| Free beta | **Keep, and say so** | Currently the most capable configuration. Stop implying paid tiers exceed it. |

---

## 6. User-journey findings

- **First run:** landing still ships no server-rendered statement of what the product makes. The three-goal chooser and `/tailor` remain the strongest entries.
- **Intake → generation:** works, and the output is now genuinely the user's own sentences — except where the lead verb asserts an unmade act, a compound sentence is split, or a narration filter deletes a true clause.
- **Editing → export:** repaired. Editing no longer disables export for the whole pack.
- **Returning use:** unchanged and weak. No linked weekly surface, no interview or offer milestone.
- **Payment:** no path can take money. Copy on `/pricing` and `/founding-beta` still implies purchasability, including a five-purchase cohort cap that nothing enforces.
- **Cancellation / refund / renewal:** not applicable — all offers are one-time and none is live.
- **Recovery:** corrupt local state is quarantined rather than destroyed; "clear all data" now includes interview answers.

---

## 7. Findings ledger

| ID | Sev | Area | Finding | Evidence | User impact | Revenue impact | Correction | Effort | Blocker | State |
|---|---|---|---|---|---|---|---|---|---|---|
| RA-P0-01 | P0 | Truth | Self-declared gaps classify as `claim` and reach the exported résumé | `classifyEvidenceAdmissibility` returns `claim` for 4 phrasings; confirmed on in-memory résumé, evidence drawer, receipt and plain-text export | A candidate's admission of a gap is printed on their résumé | Cannot charge for a document that harms the buyer | Subject+object detection covering `never`, multi-word adverbials, non-initial `no`, and `lack …background` | M | **Yes** | **Regressed (1 shape) + surviving (4)** |
| RA-P0-02 | P0 | Truth | `composed()` splices its lead verb unconditionally; only clauses are gated | `"Maintained the safety log"` → `"Reported safety concerns."`; `"Reorder supplies when we run low"` → `"Reported supply needs."` | Résumé asserts acts the user never performed | Same | Gate the lead on evidence, or derive it from the matched clauses | M | **Yes** | **New** |
| RA-P0-03 | P0 | Truth | Narration filter deletes a true statement and fabricates a replacement | `"Reported to my manager and the shift lead."` → phrase absent from every surface; emits `"Supported the shift lead."` + `"Escalated customer issues to leads or managers."` | Supported evidence destroyed; unrelated claim invented | Same | Never drop a user clause silently; surface it as withheld | M | **Yes** | **New** |
| CF-P0-03 | P0 | Access control | Export paywall bypassed by `/versions/view` | Route imports no entitlement code; `resumeToText(data, resume)` has no tier param | Paid feature free to all | Entire export paywall is a no-op | Server-render gated export, or stop selling export | M | **Yes** | **Surviving** |
| RA-P1-01 | P1 | Truth | Compound sentences split on `\band\b`, producing fabricated fragments | `splitResponsibilityText` (`generator.ts:887-895`): `"Logged calls from O'Fallon and DeSoto."` → `"Supported DeSoto."` | Nonsense claims on the résumé | Trust | Split on line breaks and terminal punctuation only | S | **Yes** | **New** |
| RA-P1-02 | P1 | Truth | Global scope metrics attach to roles that never earned them | `customersServed: "200"` on a Warehouse role → `"Handled 200 customers as part of regular workload."` | Misattributed metric | Trust | Scope metrics per role | M | **Yes** | **New** |
| RA-P1-03 | P1 | Truth | Setting/task mention becomes an asserted personal trait | Delivery: `"I drove through a lot of traffic."` → `"Maintained reliable follow-through while handling traffic."` | Invented character claim | Trust | Remove the trait clause or require explicit evidence | S | No | **New** |
| CF-P1-03 | P1 | Access control | No paid capability enforceable; free grants more than paid | free 5/5 + 3 lanes vs $49 1/5 + 1 lane | Paying is a downgrade | Cannot charge honestly | Server-side enforcement, or sell judgment not features | L | **Yes** | **Surviving** |
| CF-P1-08 | P1 | Billing | `commerce:launch` provisions an ungated live Payment Link | `scripts/commerce-launch.mjs:234-295` | Unfulfillable purchase possible | Chargeback risk | Gate provisioning on `canSellSafely` | S | **Yes** | **Surviving** |
| CF-P1-09 | P1 | Billing | TEST-mode session mints a production license | `api/license/route.ts:22-28` | Free production entitlement | Revenue leak | Bind signing key to session mode | S | **Yes** | **Surviving** |
| CF-P1-10 | P1 | Billing | Revocation unwired | `revokeRedemption` called by no route | Cannot revoke after refund | Loss | Wire revocation into refund handling | M | No | **Surviving** |
| CF-P1-11 | P1 | Value leak | `ResumePreview` copies the full résumé free | `ResumePreview.tsx:300` | Paid deliverable free | Leak | Gate or accept as free | S | No | **Surviving** |
| CF-P1-12 | P1 | Value leak | "Tailor again" bypasses `tailored_resume_export` | `versions/page.tsx:444` | Paid deliverable free | Leak | Gate | S | No | **Surviving** |
| RA-P2-01 | P2 | Truth | One evidence record backs a bullet under two employers when both roles record identical text | Two roles, one shared record, identical responsibility → printed under both | Ambiguous provenance | Trust | `roleId` should win over textual corroboration | M | No | **Surviving** |
| RA-P2-02 | P2 | Truth | Lead+clause assert unmentioned concepts | `"Ran the register during my shift."` → `"Balanced register accuracy and shift responsibilities during busy periods."` | Mild embellishment | Trust | Same fix as RA-P0-02 | — | No | **New** |
| RA-P2-03 | P2 | Commercial | `founding-beta` claims a five-purchase cap that nothing enforces | `founding-beta/page.tsx:56`; no count logic in checkout | False scarcity | Trust | Remove the claim or enforce it | S | No | **New** |
| RA-P2-04 | P2 | Billing | Non-live `/api/checkout` ignores commerce mode | `checkout/route.ts:28-34` branches only on `liveMode` | "Off" relies on discipline, not code | Risk | Check mode explicitly | S | No | **New** |
| RA-P3-01 | P3 | Polish | Repeated user verbs joined into one run-on bullet | 3 × `"Maintained …"` → single sentence repeating the verb | Awkward | — | Emit separate bullets | S | No | **New** |
| CF-P1-05 | — | Value | Tailoring inertness | Not re-driven | — | — | Re-test | — | No | **Unverified** |

**Counts: 4 P0 · 9 P1 · 4 P2 · 1 P3 · 1 unverified.** New this audit: 3 P0, 3 P1, 3 P2, 1 P3.

---

## 8. Recommended payment architecture

Unchanged in direction, reinforced by evidence.

- **Free:** the entire software beta, including export. Every attempt to gate it client-side has been bypassed by the product's own UI, twice audited, still true.
- **Paid:** the **$149 reviewed service** — human judgment, undeliverable by a client-side flag and therefore unbypassable. Lead with it after the résumé pack is generated.
- **Remove:** $79 and $99 outright. **Replace** $49 rather than repair it.
- **Cadence:** one-time. Job search is episodic; nothing in the product yet earns recurring payment, and `/weekly` — the only surface that might — is linked from nowhere.
- **Before any software tier returns:** server-side enforcement must exist. Until a capability is computed on a server the user does not control, no price is defensible.

---

## 9. Launch blockers

**Must fix before accepting any payment**
1. RA-P0-01 gap statements reaching the résumé
2. RA-P0-02 unconditional lead verb
3. RA-P0-03 true-statement deletion + fabrication
4. CF-P0-03 export paywall bypass — or stop selling export
5. CF-P1-08 ungated live Payment Link provisioning
6. CF-P1-09 test-mode → production license minting
7. Issue #55 resolved by an authorized human

**Must fix before public launch**
RA-P1-01 sentence splitting · RA-P1-02 metric misattribution · CF-P1-03 free > paid · CF-P1-10 revocation · RA-P2-03 false scarcity · RA-P2-04 mode-blind checkout

**Can follow**
RA-P1-03 trait inference · RA-P2-01 shared-record provenance · RA-P2-02 · RA-P3-01 · CF-P1-11/12 value leaks · CF-P1-05 verification

---

## 10. Highest-leverage implementation sequence

| # | Change | Why | Depends on | Validation |
|---|---|---|---|---|
| 1 | Rebuild gap detection on subject **and** object, covering `never`, multi-word adverbials, non-initial `no`, `lack …background` | A gap printed on a résumé is the worst output this product can produce | — | Fixtures whose phrasings appear in no existing suite; must fail on `af431c1` |
| 2 | Gate the `composed()` lead verb on evidence, or derive it from matched clauses | Removes the whole unmade-act class in one change | — | Sweep all ten occupations; typed input → emitted bullet table |
| 3 | Stop deleting user clauses in `splitResponsibilityText`; split only on line breaks and terminal punctuation | Ends both the deletion and the `"Supported DeSoto."` fabrication | — | Compound-object fixtures; assert every clause present or explicitly withheld |
| 4 | Decide export: gate server-side or make it permanently free | Determines whether any software tier can exist | 1–3 | Direct-route access with no entitlement |
| 5 | Gate `commerce-launch.mjs` on `canSellSafely`; bind license signing key to session mode | Closes both live billing leaks | — | Attempt provisioning with a stale cert; attempt `cs_test_` mint |
| 6 | Scope metrics per role | Removes misattribution | 2 | Metric on a role with no matching evidence |
| 7 | Remove $79/$99, reposition $149 as the paid offer | Aligns price with what is enforceable | 4 | Copy review against the entitlement matrix |

---

## 11. Score comparison

| Dimension | Original | Now | Evidence for the change |
|---|---:|---:|---|
| Career-building depth | 3 | 3 | No new capability. Lanes, level modelling and direction unchanged. |
| First-time usability | 4 | **5** | +1: fabricated first bullet genuinely gone. Held back by remaining distortion in the first artifact. |
| Output quality | 3 | **4** | +1: cross-employer fabrication structurally fixed and independently reproduced. Held back by three new/surviving truth P0s. |
| Continued-use value | 3 | 3 | Nothing changed. |
| Payment-option clarity | 2 | 2 | Nothing changed. |
| Tier differentiation | 1 | 1 | `career_switch_toolkit` still dead. |
| Pricing-to-value alignment | 2 | 2 | Free still exceeds paid. |
| Billing implementation integrity | 6 | **7** | +1: production reproducible; stale certification correctly invalidated; forged license and session tampering rejected under attack. Test→prod minting and absent revocation cap it. |
| User trust | 3 | **4** | +1: data destruction fixed; admissibility derived and reversible. Capped by the generator asserting unmade claims. |
| **Overall readiness to charge** | 1 | **2** | +1 for release integrity and the closure of two P0s; still blocked by four. |

No score moved on the strength of a merged PR. Every increase is tied to a reproduction listed in §2.

---

## 12. Final adversarial judgment

1. **Would a job seeker understand why Career Forge beats ChatGPT alone?** No. The differentiator — provenance and refusal to invent — is real in architecture but never explained above the fold, and is still contradicted by output that asserts unmade acts.
2. **Does the free product now earn enough trust?** Closer, not yet. It no longer destroys approved work, which was the disqualifier. It still prints statements the user did not make.
3. **Does the system preserve employment truth through the complete lifecycle?** For **ownership and persistence, yes** — verified through generation, sanitation, persistence, editing, receipts and export. For **wording, no** — one path deletes a true clause and fabricates a replacement.
4. **Does the generator still invent, escalate, distort, omit, or misattribute?** Invent: **yes** (unconditional lead). Escalate: **no** — verb escalation is genuinely gone. Distort: **yes** (sentence splitting). Omit: **yes** (narration filter, and only 6 of 7+ verb-led lines are ever bulleted). Misattribute: **between employers, no**; **between roles and global metrics, yes**.
5. **Would a paying user understand what payment unlocks?** No. The headline deliverable is free through two routes the app itself links.
6. **Are the payment options meaningfully different?** No. Unchanged.
7. **Does the product earn recurring revenue?** No, and it should not attempt to.
8. **Largest remaining career-building gap:** it organises evidence but does not help a user decide *what to pursue*. Nine hard-coded lanes, no level model, no direction engine.
9. **Largest remaining pricing/entitlement gap:** every paid capability is enforced client-side in a public repo, and the flagship one is bypassed by the product's own navigation.
10. **What must change before commerce can safely open?** The seven payment blockers in §9, then a fresh commit-pinned certification and human approval against the new SHA.
11. **Has Career Forge reached the 10/10 ease-of-use launch gate?** No — and ease is still the wrong next gate. Truth integrity is not closed.
12. **Honest launch classification today:** **Not ready to charge.** Suitable for a free, clearly-labelled beta.

---

## Appendix A — commands, exit codes, totals

All from the clean clone at `af431c1`.

| Command | Exit | Result |
|---|---:|---|
| `npm ci` | 0 | 455 packages |
| `npm run test:unit` | 0 | **1640 PASS, 0 FAIL** (37 scripts) |
| `node scripts/truth-integrity-regression.mjs` | 0 | 172 passed, 0 failed |
| `node scripts/quality-regression-suite.mjs` | 0 | **98/100**, 82 personas, **0 hallucinations** |
| `node scripts/trust-boundary-regression.mjs` | 0 | 32 passed |
| `node scripts/entitlement-regression.mjs` | 0 | 42 passed |
| `node scripts/fulfillment-safety-regression.mjs` | 0 | 149 passed |
| `npm run acceptance:private` | 0 | pass |
| `npm run test:browser` | 0 | **25 passed, 0 failed** |
| `npm run typecheck` | 0 | clean |
| `npm run lint` | 0 | clean |
| `npm run build` | 0 | production build succeeded |
| `node scripts/compute-surface-hash.mjs --check` | 0 | `d6ff88a641606e0d8583189b483170ad` |

**Every suite passes. All four P0s in this report survive them.** That is the central finding about the test estate, not an aside.

Temporary harnesses were written under the session scratchpad and removed; none touched the repository. Not run: nothing. `npm run test:browser` executed successfully here, unlike the previous session where Chromium download was unavailable.

## Appendix B — corrections to my own audit process

Recorded because the protocol requires it, and because two of these produced false confidence that was reported upstream.

1. **A substring assertion certified a distortion.** A previous harness asserted `out.some(b => b.includes(head))`, so `"Supported mopped."` passed as preservation of `"Mopped."` across 32 probes. Every assertion in this audit compares exact expected output. This is why RA-P0-02 and RA-P1-01 were findable now and were not before.
2. **A published baseline was wrong.** I reported the quality suite moving "90 → 95" as an improvement when `main` scored 97 and the branch scored 95 — a regression. The baseline was a mid-work measurement. This audit re-measured from a clean clone before comparing anything.
3. **False positive in this audit, corrected.** My section B asserted each typed line must appear as its own bullet. Joining three lines into one sentence preserves every word; that is a polish defect (RA-P3-01), not a truth defect. Reclassified.
4. **False positive in this audit, corrected.** My section D flagged `"Logged calls from O'Fallon and DeSoto."` as a proper-noun failure. The proper nouns are preserved; the defect is sentence **splitting** (RA-P1-01). Reattributed.
5. **A gap the author-written suite could not surface.** `scripts/truth-integrity-regression.mjs` passes 172/172 on the exact code that prints a user's stated gap on their résumé, because its gap fixtures use the four shapes the classifier still catches. Independent fixtures were not optional here; they were the only way to see it.
6. **Explicitly not verified:** any Stripe Payment Link's live status (no dashboard access, and not an agent action); CF-P1-05 tailoring inertness; CF-P1-06 by dedicated runtime fixture; real production environment variables; mobile browser journeys, which were not driven this pass.
