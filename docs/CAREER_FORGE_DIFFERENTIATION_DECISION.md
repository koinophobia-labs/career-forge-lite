# Career Forge differentiation decision

Decision date: **2026-07-15**

## Decision

Make the category observable with the smallest coherent loop:

```text
untrusted imports → Truth Inbox → approved Career Dossier
→ role-lane baseline pair → Defensibility Receipt
→ Truth Map → grounded application lineage
```

The selected descriptor is **local-first career evidence compiler**. The public message is `Your career is bigger than your last résumé.` with category-level contrast `Not another AI résumé writer.`

## Implemented

| Change | Market reason | Product proof |
|---|---|---|
| Versioned canonical Truth Inbox | Approval is only credible when undecided work cannot disappear; public competitor surfaces rarely demonstrate a pre-trust queue | Pending batches survive refresh/navigation, partial decisions commit safely, new imports add or separate, discard confirms |
| Transition-based activation helper | A saved import is not value; activation must mean approved structured work can support a defensible output | Pure previous→next helper gates dossier and all “first” milestones |
| Truthful gap/refusal semantics | ATS-style diagnostics are commodity; false “refusal” language undermines trust | Known gaps and actually considered/refused claims are separate; unique union count deduplicates |
| Career Truth Map | Provenance alone is no longer unique, but visible bidirectional lineage is central to the combination | Evidence-first and output-first expandable views include lanes, claims, answers, unused/stale, and user-edited state |
| Defensibility Receipt | Users need audit facts, not hiring probabilities | Per variant: total/direct/combined/transferred/missing, durations, edits, gaps/refusals, and traced status |
| Public differentiation section | Internal architecture is not a category | Category-level table appears before advanced workspace and names no competitor |
| Option A positioning | Best balance of comprehension, emotion, multi-document import intent, and nonlinear-career fit | Homepage headline/subhead and local-first evidence compiler descriptor |
| Event-name-only moat analytics | Measure first-session discovery without leaking career content | Truth Inbox, Truth Map, receipt, provenance, and differentiation CTA names only |

## Deliberately not implemented

| Refusal | Why |
|---|---|
| AI generation or new LLM dependency | Would re-enter the commodity writing race and add transmission/hallucination risk |
| Account, database, sync, or paywall | Outside authorization and would weaken the current local/no-account trust wedge |
| Job scraping, board aggregation, autofill, or auto-apply | Submission acceleration is owned by established systems and does not establish truth |
| Template gallery or design editor | Kickresume, Enhancv, Resume.io, and Zety already have depth; it would dilute the evidence-compiler spine |
| Universal ATS or hiring score | Not defensible and conflicts with receipt-based positioning |
| New persisted graph | Truth Map relationships can be derived from canonical evidence/output references, avoiding a second source of truth |
| Competitor names in production | Detailed comparison remains internal pending product/legal review |
| Pricing recommendation | The owner requested market expectation context, not monetization design |
| Claims that Career Forge alone has a vault/provenance | ResumeForge, Bragora, and Career Vault Cloud make those claims unsafe |

## Measurable success criteria

- Zero loss of undecided proposals in regression and browser acceptance.
- Dossier activation emits only on a false→true canonical readiness transition.
- A single gap displays once; actual refusals remain semantically separate.
- Truth Map derivation for 500 evidence records remains comfortably interactive under the deterministic acceptance budget.
- No sensitive content or event properties enter analytics.
- At least 4/5 cold human participants meet the ten-second uniqueness target.
- At least 4/5 complete import→review→pack without confusing proposed facts with approved evidence.
- At least 4/5 correctly explain direct versus transferred support and what happens to unsupported claims.

The automated criteria are tested in this branch. The human criteria remain unmeasured.

## Follow-up experiments

1. Run the five-person moderated protocol in `CAREER_FORGE_MARKET_MOAT_PLAYTEST.md` using Option A.
2. A/B the hero against Option B only if users understand the category but lack urgency.
3. Time the Truth Inbox with 25–40 proposals; test section approval and duplicate handling without weakening explicit trust.
4. Ask participants to find one claim’s source in both directions and explain its support label.
5. Test backup comprehension immediately after first pack completion.
6. Monitor ResumeForge, Bragora, and Career Vault Cloud quarterly with the same uniqueness grid.
7. Explore a content-local export handoff to one tracker only after owner approval; do not build a tracker replacement.

## Owner decisions still required

- Approve the category descriptor and Option A for a public test.
- Decide whether `Career Truth Map` should remain a route label while the broader product uses `approved evidence` rather than `truth`.
- Approve the opt-in filename retention policy.
- Choose the backup reminder cadence.
- Decide whether any future cloud/export integration is compatible with the local-first promise.
- Decide which human participant profiles are recruitable now and what threshold triggers another positioning iteration.

## Recommendation

The implementation is ready for owner re-review after full CI/preview validation. The category is **differentiated with medium-high confidence at the public-feature-combination level**, but is not yet human-validated and should not be described as an uncontested market category.
