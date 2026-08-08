# Cluster C certification — frozen head `502f432`

# FAIL — 17 P0, 1 P1

Pass condition was 0 P0 + 0 P1. Cluster C is **not** closed.

3 lenses, 39 agents, 27 findings raised, 18 verified and survived, 9 left unverified by the per-lens cap. No repairs were made during the run and the head did not move.

---

## What actually got fixed

Worth stating plainly, because it is the thing the program was for and it holds:

- **The persisted path is repaired.** `sanitizeCareerDossier` left all 16 hazardous employer names and every `Recovery Support Worker` title intact, and dropped no role (16 in, 16 out). Employer names are no longer destroyed on disk by a read.
- **`dossier.roles` survives five save/reload cycles byte-for-byte**, including `No Boundaries Training Ltd`.
- **The parser does not amputate ordinary names.** 0 of 58 real organisations and job titles were altered — legal suffixes, internal commas, locations, pipes, slashes, hyphens, dates inside names, accented Latin, non-Latin scripts, single characters, a 137-character CIC name. `Marks & Spencer, Leeds` keeps its comma.
- **`roleHasStructure` is correct in both directions.**

The damage did not survive where it was attacked. It survived *everywhere else*.

---

## The 6 mechanisms

### C-α — One invariant, six enforcement points, one of them updated
**6 findings · P0 ×6 · the dominant cluster**

The rule "structural fields are not judged by the claims classifier" was applied to `sanitizeCareerDossier` and nowhere else. Every other site that judges structure still does.

| Finding | Site still applying admissibility to structure |
| --- | --- |
| `C1-05` / `C2-01` | `sanitizeResumeForProfessionalUse` — still runs `sanitizeProfessionalLine` on `role.title` / `role.company`, on the export path |
| `C2-02` | `sanitizeVersion` legacy branch — classifies a rendered heading line, deletes the row, **re-parents its bullets to the employer above** |
| `C3-05` | `dossier.education` — credential and institution still go through the claims classifier, and the row is dropped when both blank |
| `C2-03` | `reviveDossier` — enforces its own stricter survival rule (`id && (title \|\| employer)`) than `roleHasStructure`, and runs *before* C3 recovery can see the row |
| `C2-05` | `buildLaneResume` — an early `if (!support.length) return []` drops the container before the omission bookkeeping runs |

**This is the third time I have made this mistake.** Occupation templates: patched one exit, found another. `NON_EVIDENCE_INTAKE_FIELDS`: fixed the four fields the inventory named, left the rest. Now: fixed the one sanitizer the census named, left five. Each time the census named a site and I repaired *the site* rather than enumerating every place the invariant must hold.

The repair is not "fix five more call sites". It is that structural fields must be unreachable by the claims classifier — the way `UsableEvidence` made ungated evidence a compile error.

### C-β — The parser's own fallback re-applies the classifier
**3 findings · P0 ×3**

`parseOrganizationField`'s whole-value branch returns `identity: ""` when `possibleDisclosure` matches the entire field. That is C1 undoing C1's own rule.

- `C1-02` / `C2-06` — `Maternity Leave Cover Teacher`, `Bereavement Leave Administrator`, `Sick Leave Cover Supervisor`: real job titles, erased whole
- `C1-03` — when title *and* employer both trip it, the whole job disappears from the résumé
- `C1-06` — `isWeakFreeText`'s `/^[^\w]+$/` uses a non-Unicode `\w`, so **any employer name written wholly in a non-Latin script** is treated as junk and deleted

If no delimiter is found, the value *is* the identity. Blanking it was me hedging, and the hedge is the defect.

### C-γ — A blanked field is backfilled with an invented one
**1 finding · P0**

- `C1-04` — `buildExperience` substitutes `"Current Company"` / `"Previous Company"` whenever the employer reads empty, and that scaffold is **persisted into the saved résumé version**

β and γ together are the seesaw inside a single record: one user's document loses `Let Go Yoga Studio` and gains `Current Company`.

### C-δ — The harvester admits non-headings and mis-resolves within a version
**4 findings · P0 ×4**

- `C3-02` — any line whose split on `|` yields two non-empty segments becomes an employment record. Contact lines, user summaries, `*` bullets and education lines all qualify; **a user's own self-description becomes their employer**
- `C3-03` — the `DATE_RANGE` guard recognises only dash-separated numeric years, so `Jan 2018 to present` is restored as the company name
- `C3-01` — `historyFor` matches on title **or** employer, so a sibling role's history lands in the damaged role's match set
- `C3-04` — `decide()`'s per-version `find(Boolean)` was written to merge two *representations of one job*; it also merges **two genuinely different jobs** in the same version, and array order becomes the confidently-applied answer

`C3-04` is a defect in the fix I made two commits ago for the scar-tissue finding. Grouping by version was right; collapsing *within* a version by first-non-empty was not.

### C-ε — Whole-container damage has no anchor
**1 finding · P1**

- `C3-06` — recovery is a `map` over surviving roles, so a role the pre-fix build deleted *outright* has nothing to attach a recovery or a review to. Neither recovered nor flagged. The scar-tissue corpus records a `roleSurvived` flag that is asserted nowhere.

### C-ζ — Contamination the classifier misses
**1 finding · P0**

- `C1-01` — 25 of 30 contaminated employer values reach the delivered DOCX, because the split needs both a recognised delimiter *and* a `possibleDisclosure` hit

This is Cluster D's bound showing through C. The lens quantified it rather than guessing, and deliberately did not propose the boundary.

---

## Coverage gaps

- **9 findings unverified** — the per-lens cap of 6 bit again. Same debt shape as last time; clear it before the next Cluster C run rather than after.
- Not exercised: the browser UI, the pack-bundle ZIP path in the C1 lens, and classifier tuning (Cluster D owns it).

## Sequencing for the repair

By P0 weight and dependency:

1. **C-α** — make structural fields unreachable by the claims classifier, structurally. Six P0s, and the mistake is architectural rather than local.
2. **C-β** — delete the whole-value blanking fallback; fix the non-Unicode `\w`.
3. **C-γ** — never backfill a blanked structural field with a scaffold. Depends on β.
4. **C-δ** — the harvester needs corroboration and section awareness, and `decide()` must distinguish representations from jobs.
5. **C-ε** — recovery needs an anchor for deleted containers.
6. **C-ζ** — leave to Cluster D.

Bidirectional control pairs on every one. β and γ must be fixed together or the seesaw simply tips the other way.
