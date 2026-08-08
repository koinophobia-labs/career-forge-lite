# Verified defect census — frozen head `6b4b66c`

Verification debt cleared. **29 open findings, every one adversarially verified**, clustering into **7 mechanisms**.

This is a census, not a certification. `6b4b66c` cannot certify — it has verified open P0s.

## How the census was built

| Pass | Findings | Method |
| --- | --- | --- |
| Round 1 (subsystem cert) | 13 verified, capped at 4/lens | refuter + independent reproducer |
| Round 2 (this pass) | 23 verified, no cap | refuter + independent reproducer, `FIXED_AT_HEAD` separated from `REFUTED` |
| Pre-verified | 1 (`S4-09`) | reproduced by me directly; no agents spent |

Round 2: 46 agents, 23/23 verified, no session ceiling. **21 survived, 2 refuted, 0 fixed-at-head** — none of these were incidentally closed by the four repair programs.

Verification moved severity on six findings, in both directions. Three were **upgraded to P0** (`S1-08` P2→P0, `S4-06` P1→P0, `TI-05` P1→P0) and one **downgraded** (`S4-05` P0→P2, because the reproduction bypassed the gate the product actually puts in front of delivery). Filed severity is not evidence.

**Refuted and struck:** `S1-05` (both verifiers), `S4-08` (single verifier; the mechanism reproduced but the claimed defect did not).

---

## The 7 mechanisms

### A — Withholding decided by string similarity instead of provenance
**4 findings · P0 ×2**

The export revalidator identifies what to withhold by lexical containment against the raw text of ineligible records. The variant already carries a claim→evidence provenance link; the gate ignores it. Both failure directions follow from the same gap:

- `S4-03` **P0** one record's ineligibility deletes unrelated, still-approved content that happens to share a span
- `S4-04` **P0** sentences the user typed in the editor are deleted — they have no evidence record, so no approval route can ever exist for them
- `S4-05` P2 education is assembled from structured fields, so text matching cannot see it
- `S4-07` P2 the 12-character floor lets short atoms of a rejected record through

*Invariant:* withholding is a provenance decision. A claim is withheld because the evidence it was generated from became ineligible — never because its words resemble something else. **This also means authorship is part of the ownership model:** user-authored text has no evidence record and must not be judged by a ledger only evidence records can enter.

### B — Snapshot replay paths that were never wired to revalidation
**2 findings · P0 ×2**

Revalidation was wired to two export entry points. It needed to be wired to every surface that replays a stored snapshot.

- `S4-02` **P0** the ZIP's materials file re-derives eligibility only for résumé variants; every other snapshot field is copied out verbatim
- `S4-06` **P0** saved résumé versions are a second, entirely unrevalidated export path

*Invariant:* eligibility is decided at the moment bytes leave the product, not when a snapshot is written. Any surface that replays a snapshot is an export.

### C — Evidence admissibility applied to employment metadata
**9 findings · P0 ×5** — the largest cluster, and exactly the deeper invariant predicted before this pass ran

Employer names, job titles and date ranges are structural facts about the user's employment history. They are being run through classifiers built to judge résumé *claims*.

- `S1-08` **P0** `role.time` bypasses every gate on the dossier path and prints "(was made redundant)" in the delivered DOCX and PDF
- `S3-F5` **P0** the approval token is minted per composite role record while eligibility is withheld per field, so Keep can never restore an organization field
- `S1-01` **P0** an employer name the user typed is deleted from DOCX, PDF **and storage**
- `S1-02` **P0** a job title, same
- `S1-03` **P0** saved versions lose the whole heading line and re-attribute its bullets to the previous employer
- `S3-F6` P1 occupational vocabulary in a label field ("Parenta", leave/restructuring as a *domain of work*) reads as the user disclosing their own circumstances
- `S3-F7` P1 a withheld field empties to the same value as never-filled, so the form scaffold "Dates" prints as the employment record
- `S1-04` P1 when only the employer identifies a role, the DOCX emits an empty bold heading and bullets visually join the previous job
- `S1-09` P2 a withheld LinkedIn headline is silently backfilled with machine-assembled text

*Invariant:* **metadata that preserves the historical structure of employment must never be subjected to evidence admissibility as though it were a résumé claim.** Withholding a label must be distinguishable from never having one, must be reportable, and must never be backfilled with authored text.

### D — Surface syntax standing in for semantic role
**7 findings · P0 ×0**

The gap/claim and disclosure classifiers decide from adjacent tokens rather than clause structure and *whose* circumstance is described.

- `S1-06` P1 the identical accomplishment is admissible as "with no supervision" and deleted as ", no supervision"
- `S1-07` P1 one preposition-led "no" anywhere in a string vetoes every gap detector for the whole string
- `S3-F8` P2 administering other people's leave reads as disclosing one's own
- `S3-F9` P1 one schema category answers two different questions — what a datum *means*, and whether its free text is gated
- `TI-02` P2 aspiration matches only a straight apostrophe
- `TI-03` P2 agency misses team phrasings that avoid we/our team/us
- `TI-04` P2 denial recall measured at 4 of 15

*Invariant:* a lexical classifier may raise its hand; it may not decide a question that requires clause structure or whose circumstance is described. Where it cannot tell, the answer is *ask*, not *act*.

### E — The truth invariant guards a step, not a value
**4 findings · P0 ×1**

`transformPreservingTruth` wraps one leaf polish step. Meaning-changing edits happen outside it.

- `TI-05` **P0** the leading first-person and possessive strips run at earlier, unwrapped normalization sites — the invariant exists to police exactly this and never sees it
- `TI-06` P1 the invariant models three dimensions, so the punctuation and function-word edits this transform actually makes are unguarded (an ellipsis becomes a full stop mid-sentence)
- `TI-07` P2 the classifier is re-run on output that deleted the token it keys on, so it reverts its own sanctioned edit
- `TI-08` P2 a mutation chained after the guard means the invariant certifies one string while a shorter one ships

*Invariant:* the guard must cover the field's whole pipeline from user text to rendered bytes, not one function inside it.

### F — Receipt and artifact derived from different ledgers
**2 findings · P0 ×0**

- `S4-09` P1 (pre-verified) export-time withholding is silent; the archive's only receipt reports zero omissions
- `S1-10` P3 a role emptied by admissibility is reported by neither ledger

*Invariant:* **the artifact and its receipt must derive from the same final inclusion ledger.** Not one more patch to `itemsExcludedByUser`.

### G — Genuinely separate
**1 finding**

- `TI-09` P3 the per-role bullet cap is duplicated at three independent pipeline stages; the finding's file attribution points at the permanently-shadowed copy

---

## What this changes

29 findings, 7 mechanisms, and the two largest (C and A/B) account for 9 of the 13 open P0s. Cluster C alone is 5.

Notably, **cluster A is one mechanism wearing two masks**: the same missing provenance link causes both a fabrication (ineligible content surviving) and an amputation (approved and user-authored content deleted). Repairing it in one direction only will produce the other — which is the seesaw this project has hit at every round.

## Sequencing

Repair programs should follow cluster size and P0 weight, not finding count:

1. **C** — employment metadata out of admissibility (5 P0, and it touches storage, not just export)
2. **A** — provenance-based withholding, including an authorship model (2 P0)
3. **B** — revalidate every snapshot replay path (2 P0)
4. **E** — invariant scoped to the value (1 P0)
5. **F** — single inclusion ledger
6. **D** — classifier precision/recall, which bounds everything above it
7. **G**

Each with the mandatory bidirectional control pair, and each followed by bounded subsystem verification rather than a whole-product run.

## Process note

The bounded loop is working. Round 1: 20 agents, ~30 min, clean. Round 2: 46 agents, 23/23 verified, clean. The 114-agent whole-product run died at a session ceiling with its critic and verdict writer unrun. Cheap verification is what made completing this census possible at all — and completing it turned 29 apparent problems into 7 real ones.
