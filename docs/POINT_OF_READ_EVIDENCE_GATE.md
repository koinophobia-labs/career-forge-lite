# The point-of-read evidence gate

**Head:** `fcaca9d` on `feat/point-of-read-evidence-gate`. Clean-clone verified —
typecheck, 2032 assertions, build all green.

## The rule

> No generation, transformation, résumé surface, or export code may consume
> user evidence except through an eligibility-aware read.

Eligibility used to live at intake: one function narrowed three named strings
for three evidence kinds. Round 8 proved that shape cannot hold — the same
evidence is reachable through several representations, and each was its own
tunnel under the fence. Patching an exit relocates the leak; the fifth exit is
found the day after you close the fourth.

`src/lib/evidence-read.ts` is the choke point.

## Three properties, not one function

Creating `getUsableEvidence()` was the easy half. What makes the rule stick:

**1. Fail closed.** Usable only if it affirmatively passes every rule:
unresolved, excluded, rejected, resolved-against-older-text, or owned by
another role all withhold.

**2. Derived, not stored.** Eligibility is recomputed from the text on every
read. Both of Round 8's fail-OPEN defects existed because eligibility was
trusted from stored fields — `reviveDossier` dropped the reviewed-text
fingerprint, so one reload turned a stale keep into a live approval; and every
dossier written before the lifecycle had no review state at all, so it sailed
through. Deriving at read time means a dropped field or a legacy record
degrades to *ask the user*, never to *publish*.

**3. Unforgeable.** `UsableEvidence` and `UsableIntake` are branded types only
this module can mint. Handing a builder raw evidence is a compile error.

That third property is not decoration. It caught Unit 2 — the raw intake being
passed to `applyTailoredContext` — at the exact line, before any test ran.

## Raw evidence is not deleted evidence

`getEvidence()` returns the store untouched. Review queues, evidence editors and
provenance trails read raw and *should* — gating them would hide exactly the
records the user needs to find. "Not usable for generation right now" never
means "gone".

## What was migrated

| Unit | Was | Consequence |
| --- | --- | --- |
| Generator boundary | per-lane filters, ~22 read sites | one `getUsableIntake` call; a lane added later is gated by default |
| `intakeFromDossier` | role string pools | excluded disclosure printed after one reload (P0-B1) |
| `pack-export` materials | `approved && !rejected` | unresolved + excluded disclosures under "APPROVED PROFESSIONAL EVIDENCE" while the README claimed they were refused |
| `resume-pack` proof bank | raw `proofPoints` pool | excluded financial disclosure in the master proof bank |
| `interview-prep` | `approved && !rejected` | unresolved disclosure seeding an interview question |
| `disclosureApproved` allow-list | review flag only | a REJECTED record still authorized its sentence |
| `deriveDefensibilityReceipt` | `approved && !rejected` | **enables the export buttons** — a false PASS ships the document |
| application answers, outreach, role-sprint portfolio, early-win | `approved && !rejected` | text a third party reads |
| pack receipt counts | string equality on the flag | undercount in a delivered file, worsening as generation withholds more |
| saved-version migration | separation-only | health disclosures survived in legacy saved text |

## The two the inventory proved by execution

**The exemption list.** `getUsableIntake` is exhaustive except a hand-maintained
allowlist — and that list exempted `education` and the three `*Time` fields,
which print on the résumé. The control is what made it conclusive: the
byte-identical sentence was withheld from `customRoleNotes` and printed from
`education` **in the same generation call**.

**Laundering.** The raw intake was handed to `applyTailoredContext` ten lines
after the eligible one was computed. The withheld sentence was never printed —
it *authorized* a posting keyword to be claimed as a skill. `"I dropped out of
the phlebotomy program after one term."` produced `coreSkills: ["Phlebotomy"]`.
Worse than printing it, because the resulting claim has no citation to
invalidate.

While fixing the first, a blunt string replace removed `"education"` from
`REVIEWABLE_KINDS` instead of the exemption list, silently reopening Round 8's
P0-B3 on the record path. Caught only because the fixture was executed rather
than assumed. Same lesson as every previous round.

## Testing

`scripts/evidence-gate-bypass-regression.mjs` — 33 assertions that deliberately
bypass intake, because every other suite enters through the guided form. It
hand-builds dossiers, populates `proofPoints` and `selected*` directly, uses
every evidence kind, calls generators and exporters straight, exports after a
round trip, edits reviewed text after approval, and resolves evidence owned by
another role.

Verified the pack-export assertion **fails on the pre-fix code** (three
disclosures leak) and passes after — a guard, not a restatement.

One warning from the inventory worth keeping: `quality-regression-suite`
constructs `selected*` arrays directly instead of going through
`intakeFromDossier`. That is structurally why an 87/100 green suite could not
have caught the refill leak. Any regression for this area must go through
`intakeFromDossier` or it reproduces the same blind spot.

## Known limits — stated, not hidden

- **Classifier recall bounds the whole guarantee.** The retro-flag for legacy
  records is only as strong as `possibleDisclosure`, and it misses natural
  phrasings: *"I was signed off sick for most of the winter."*, *"I took unpaid
  leave to care for my father after his stroke."*, *"I had to take time off when
  my mum got ill."* Deliberately not pinned in the suite — pinning it would hide
  it behind green.
- **Bare text has no provenance.** Where career facts arrive as strings with no
  record (a hand-built intake, `CareerProfile`, the interview session store),
  the classifier is the only signal available.
- **Over-flagging is now costlier.** Retro-flagging at read means the
  classifier's false positives ("the store closed", "sick leave" in an ordinary
  duty) surface as review items on legacy dossiers.

## Deliberately out of scope

Per the decision that took this on: the gate redesign does not swallow the
separate Round 8 findings. Still open and independent — denied education
becoming a credential, `ACE` matching inside *Workpl**ace***, `"St. Mary's"`
sentence fragmentation, PDF Unicode corruption, and the `/founding-beta`
metadata advertising purchases while commerce is off.

Also flagged by the inventory as needing a design decision rather than a
call-site swap:

- **Snapshot resurrection** (`evidence-admissibility.ts:600/645/677/691`,
  `resume-pack.ts:565`) — these re-classify stored prose for admissibility but
  never re-derive from currently-usable evidence. No reader migration fixes it.
- **Merge semantics** (`dossier.ts:234`) — `approved: previous.approved || item.approved`
  with `rejected: previous.rejected && item.rejected` means re-importing a
  résumé can resurrect a record the user rejected. Point-of-read limits the
  blast radius; it does not fix the merge.
- **`truth-inbox.ts:26`** — high-confidence proposals auto-flip to `approved`
  with no disclosure review ever performed. The strongest argument *for*
  point-of-read: the reader catches these regardless of how approval was
  obtained.
- **The `approvedClaims` pool** — six writers strip record identity into bare
  strings. Safe today only because `sanitizeCareerDossier` re-derives through
  the gate on the next read.

**Do not add a stored eligibility field.** Legacy records would inherit it as
"clean". They fail closed today *only* because eligibility is re-derived at
read. That property is the design.
