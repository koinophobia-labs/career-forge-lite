# Career Forge — Code Certification Protocol

Written after six review rounds in which **every round found defects introduced by the repair that preceded it**. The rule this encodes: *"repair, then green suite" is not a closure signal.*

## The stopping condition

Code is certified when, and only when, all five hold at once:

1. The review ran against the **current head**, not an ancestor.
2. It used **independent fixtures the reviewer authored**, not derived from or resembling the repo's existing assertions.
3. It inspected **decoded artifacts** — DOCX `word/document.xml`, PDF content streams, ZIP contents — not generator return values or the on-screen preview.
4. It exercised the **persistence lifecycle**, comparing saved state, regenerated output and exported file at each step.
5. **Zero P0 and zero P1.**

Anything less is not certification. This is a bar, not a target to argue down.

## The freeze rule

While certification runs, the head is **frozen**. No cleanup, polish, refactors, or opportunistic fixes — not even obviously safe ones. A moving head means the reviewer certifies code that does not ship.

## The invalidation rule

If a round finds something and the fix changes generation, evidence handling or export behaviour, **the affected lenses are invalidated and must be rerun.** A fix cannot inherit the review performed on the code it replaced.

This is the rule that prevents "seventh review" from becoming "review until the reviewer gets tired."

## Both failure directions are disqualifying

| Direction | Meaning | Example from this audit |
| --- | --- | --- |
| **Fabrication** | A claim, competency, environment, trait or title the user did not state | "The night crew kept the care notes for me." → **"Kept care notes."** |
| **Amputation** | True user content deleted or altered | "I care for her three days a week in her own home." → **deleted** |

Amputation was the harder one to see, because a green suite and a *higher* quality score can both coexist with it. A thinner résumé that faithfully represents the user is launchable; a gleaming one that quietly borrows someone else's work is not.

## Fixture authorship

Fixtures must be written in the language real users write, not in the language the code expects.

The proof: the disclosure guard's own control used **"Cared for 40 patients per shift"** — past tense, with a number — and passed, while **"I care for her three days a week in her own home."** was silently deleted. The control was phrased too close to the implementation's assumptions to catch its defect. Laboratory phrasing hides real-user failures.

## Richness is not the metric

The `quality-regression-suite` score fell from 94/100 to 79/100 when the occupation-template layer was retired, and weak outputs rose from 24 to 82. **That is the correct direction.** The score partly measured synthesized decoration.

Do not chase the old number if reaching it requires claims the user did not make. Hallucination count, not richness, is the truth metric — and it is 0.

## What launch generation may do

Permitted:
- clean user-authored evidence into résumé voice (leading "I"/"My" removal, terminal punctuation)
- select and reorder supported statements
- combine statements **only** where subject and ownership are already explicit
- shorten or format without adding activities
- ask targeted questions when evidence is thin
- suggest missing evidence **as a prompt**, never as résumé content

Forbidden:
- introducing any activity, competency, environment, trait or title the user did not state
- attributing a third party's action to the candidate
- asserting the affirmative of something the user denied
- silent withholding — every omission must be reported, and labelled with its true reason

Occupation knowledge may **ask** — *"Security roles often involve incident documentation. Did you personally write incident reports?"* — it may never silently **answer**.

## After certification

Merge, then in order: commerce-off deployment → Stripe issue #55 → production smoke test → the five-human gate (`docs/FIVE_USER_LAUNCH_GATE.md`).

No further broad software audit is scheduled. Six rounds excavated the mine; certification proves no new ones were planted while the holes were filled. Future review is narrow: production monitoring, customer feedback, targeted incident audits, and a focused re-audit of any surface that gains a paywall.
