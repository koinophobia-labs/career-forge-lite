# Round 8 — Certification result at `2d0791a`

**Verdict: NOT CERTIFIED.** 17 P0 and 13 P1 across five independent lenses.
The stopping condition (`docs/CERTIFICATION_PROTOCOL.md`: zero P0, zero P1) is
not met, and not narrowly.

Round 7 results are historical evidence only. No certification was carried
forward by inheritance — every lens restarted from zero against this SHA, and
each reviewer authored its own fixtures with no reuse from `scripts/*.mjs`.

Current head: `cd6f143` (one revert on top of the frozen `2d0791a`).

---

## The headline: the repair introduced the worst defect

`sanitizeProfessionalLine` was changed during this session's "fix a defect,
grep for its twins" sweep from the inert `stripTerminationReasons` to
`withholdSeparationFromGeneratedProse`. That call site is **not** a product-prose
path. It is reached by:

```
sanitizeProfessionalParagraph -> safeParagraphArray -> sanitizeResumeForProfessionalUse
```

— i.e. over the **user's own résumé bullets** on the way into the exported file.
A role whose bullets all vanish is dropped whole (`evidence-admissibility.ts:537`),
so an employer and its dates disappeared from the DOCX and PDF while the
on-screen résumé still showed them.

Differential test against the previous freeze `72b5401`:

| SHA | roles surviving export sanitization |
| --- | --- |
| `72b5401` (before) | Warehouse Team Leader \| Corran Logistics **and** Stock Assistant \| Ferrybank Foods |
| `2d0791a` (after) | Stock Assistant \| Ferrybank Foods |

Six years of employment silently erased, producing a gap the candidate has to
explain, visible only in the delivered file. **Reverted in `cd6f143` and pinned**
by a regression asserting an employer is never deleted and a user bullet is
never amputated.

This is the seventh consecutive round in which the repair that closed the
previous round opened the next one. The comment attached to the change asserted
the path was migration-only; it was never verified, and it was false.

---

## Structural finding (Lens B) — the gate is in the wrong place

The disclosure gate is applied **at the point of intake filtering**:
`intakeEligibleForGeneration` narrows three named strings (`responsibilities`,
`outcomes`, `customRoleNotes`) for three evidence kinds (`responsibility`,
`proof`, `metric`). At least five other paths read the same user text from
fields the gate never touches:

1. `selected*` arrays refilled by `intakeFromDossier` on every mount
2. the global `dossier.proofPoints` / `unstructuredNotes` pools
3. evidence kinds outside the three covered (`education`, `skill`, `story`, …)
4. `pack-export.ts:236` gating on `approved && !rejected` instead of `isUsableEvidence`
5. the outcomes bullet path, which has no `possibleDisclosure` backstop at all

Adding a fourth field to the `withhold` list will leak at the fifth. The gate
belongs at the **point of read** — one `isUsableEvidence` predicate every
consumer must pass — not at intake.

This is an architectural decision, deferred to Blake. It is the same shape as
the two retirements already made: a contextual question answered in one place
while many other places ask it independently.

---

## Findings register

### P0 — truth of generated content (Lens A)

| # | Finding | Location |
| --- | --- | --- |
| A1 | Education bank matches aliases as bare substrings and **replaces** the user's entry. `"Started the CNA program but never finished"` → `"Certified Nursing Assistant (CNA)"`; `"AA in Workplace Safety"` → `"ACE Certified Personal Trainer"` (alias `ACE` matching inside *Workpl**ace***). Asserts credentials the user denied. | `education-intelligence.ts:274` |
| A2 | A period inside an abbreviation splits the sentence: `"St. Mary's clinic"` → bullet `"Answered the phones at St, …"` plus invented `"Supported Mary's clinic, Patel and Dr, and Nguyen."`; `"Nguyen"` and `"Dept"` ship as core skills. | `generator.ts:965` |
| A3 | Keep does not restore a paragraph. Evidence records are line-granular; the generator matches per sentence. Typed as one paragraph, two of three kept duties stay deleted after the user clicks Keep. | `dossier.ts:379` vs `generator.ts:965` |
| A4 | `weakTerms` deletes the user's own words, stranding transitive verbs: `"put stuff away"` → `"put away"`. | `resume-intelligence.ts:13` |
| A5 | Slice caps silently drop later sentences — `"Won the quarterly service award twice."` absent from the entire package. | `generator.ts:2085`, `:2096`, `:2098` |
| A6 | Product prose reframes third-party actions and denials as the candidate's strengths: `"Brings The night crew kept the care notes for me and never handled any medication…"` in the summary a recruiter reads first. | `generator.ts:2287`, `:2340` |

### P0 — disclosure lifecycle (Lens B)

| # | Finding | Location |
| --- | --- | --- |
| B1 | `selected*` arrays bypass the gate. After one reload, an **excluded** disclosure prints in summary, bullet and LinkedIn summary. | `dossier.ts:996`, `generator.ts:1023` |
| B2 | The outcomes lane has no backstop filter — leaks in the **first** session, before any review is possible. Semicolon splitting desyncs record key from intake line. | `generator.ts:1251`, `dossier.ts:381` vs `:989` |
| B3 | `education` evidence is flagged but never gated; prints in `resume.education` and `resumeToText` after an explicit Exclude. | `dossier.ts:974` |
| B4 | Pack export prints unresolved **and** excluded disclosures under `APPROVED PROFESSIONAL EVIDENCE FOR COVER-LETTER DRAFTING`. | `pack-export.ts:236` |
| B5 | `masterProofBank` seeds from the ungated global `proofPoints` pool. | `resume-pack.ts:481` |

### P0 — export artifacts (Lens C)

| # | Finding | Location |
| --- | --- | --- |
| C1 | ZIP materials file leaks unresolved and excluded disclosures verbatim while `README.txt` in the same archive claims they were refused. *(Same defect as B4, found independently.)* | `pack-export.ts:236` |
| C2 | A bullet the user KEPT is deleted from every delivered file; when it is a role's only bullet the employer and dates vanish. **Introduced today — reverted in `cd6f143`.** | `evidence-admissibility.ts:314`, `:537` |
| C3 | Text typed into the document editor (`userEdited: true`) is deleted at export by the same chain. | same |
| C4 | PDF writes UTF-16BE bytes into a single-byte WinAnsi core font: `"Marek Dvořák"` → `"Marek DvoYák"`, `"Kovač"` → `"Kova"`. Worse, width mis-measurement **drops whole words** — a controlled A/B shows `wrote` disappearing when `Şişli` is present. DOCX and plain text render correctly, so two delivered files disagree on the candidate's name and accomplishments. | `pack-export.ts:174-225` |

### P0 — persistence (Lens D) and commerce (Lens E)

| # | Finding | Location |
| --- | --- | --- |
| D1 | `reviveDossier`'s whitelist omits `disclosureReviewedText`, so the staleness guard works only within one un-reloaded session. Proven end to end: keep → reload → edit to a separation sentence via the profile evidence editor → it prints as a bullet. The identical edit without a reload is correctly withheld. *(Corroborates Lens B's P1-D, escalated to P0 by a real UI path.)* | `dossier.ts:91-118` |
| E1 | `/founding-beta` page `metadata.description` — *"Join one of five founding Career Reset purchases"* — is a module constant evaluated above the `purchasesEnabled` gate and never flips. Verified in `.next/server/app/founding-beta.html` on a commerce-unset build. This is the string Google, LinkedIn, Slack and iMessage render; the qualifying copy does not travel with it. | `founding-beta/page.tsx:7-10` |

### P1 (13) — abridged

Lens A: decimal corruption in summary/LinkedIn (`"$1.5M"` → `"$1. 5M"`); invented
`"Supported"` lead plus invented tool links on irregular verbs; classifier flags
ordinary duties (`"the store closed"`, `"sick leave"`). Lens B: every re-merge
resets the user's decision to `needs_review`; Keep on a two-sentence line
authorizes nothing; clicking Keep never re-runs generation though the UI says it
does; a curly apostrophe (`couldn’t`, the macOS default) defeats the financial
classifier entirely; `customRoleNotes` never becomes evidence. Lens C:
evidence-gap placeholder prose ships as the Professional Summary. Lens D:
pre-lifecycle stored dossiers are never retro-flagged — every existing user.
Lens E: `/pricing` asserts "the prices are not displayed" while `/founding-beta`
renders `$49` in the same build; the export entitlement is defeated by a
"View & export" link on the same screen that shows the lock.

---

## What genuinely passed

Recorded so the negative space is honest:

- **Commerce fails closed, proven in compiled output.** An adversarial build with
  `NEXT_PUBLIC_COMMERCE_MODE=LIVE` constant-folded to `function(){return"off"}`.
  A direct POST to `/api/checkout` returns 503 before any Stripe call.
- **Occupation templates are dead in production.** With the research flag set
  under `NODE_ENV=production`, the env var appears only in sourcemaps; template
  strings appear in zero executable files. All 19 gates are genuine.
- **No career data leaves the device.** Every egress point enumerated; all
  first-party and commerce/license only. Clear-data registry covers all 10
  `setItem` sites — zero orphaned keys.
- **Cross-role evidence isolation is correct**, including the legacy ownerless case.
- **Storage-failure handling is correct** — errors surface, and work done while
  storage was broken reached disk once it recovered.
- **Backup/restore round-trips cleanly**, including legacy files; all six corrupt
  backups rejected without throwing. Corrupt input fails safe, 34/36.
- **DOCX integrity is sound** — central directory intact, XML escaping correct and
  round-tripping, every DOCX in every bundle opens. 1,177-character bullets and
  20-role résumés render with no text outside the page box.

---

## The methodology point

`migration-coverage-regression` (24/24), `resume-export-regression` (26/26),
`user-edit-export-regression` (6/6), `truth-integrity-regression` (172/172) and
the full 1,999-assertion suite are **all green on this commit** while every
finding above is live. `grep -rn disclosureReviewedText scripts/` returned
nothing before this round: the field carrying the staleness guarantee had zero
coverage.

A green suite remains a necessary condition and not remotely a sufficient one.
Reviewer-authored fixtures in real-user language found 17 P0s that 1,999
assertions did not — because the assertions were written by the same mind, in
the same vocabulary, as the code.
