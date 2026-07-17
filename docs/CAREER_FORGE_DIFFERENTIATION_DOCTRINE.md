# Career Forge — Differentiation Doctrine

Why not just use Claude (or any generic AI writer) for a résumé? Because Career
Forge owns something a chat window cannot: **memory, verification, coherence,
and packaging across time and targets.** Generic generation — turning facts
into well-worded sentences — is a commodity. It is not what Career Forge
sells.

## The thesis

- The **Career Dossier** is the single source of truth for a user's career.
- Only **approved evidence** reaches final materials — nothing else, ever.
- Every output (résumé, LinkedIn, outreach, interview prep) draws from the
  **same factual foundation**, so they agree with each other.
- A user can **reuse their history for a new target** without re-entering it.
- Every feature must strengthen one of: persistence, verification, or
  packaging. If it doesn't, it doesn't belong in the product.

## Four pillars

Every future feature maps to one of these. Anything outside them is either
supporting infrastructure or a candidate for removal.

1. **Career Memory** — stores approved experience, edits, roles, applications,
   and preparation, durably, on the user's own device.
2. **Claim Verification** — separates user facts, AI interpretations,
   suggestions, and excluded claims, and never blurs the line between them.
3. **Pack Coherence** — keeps résumé, LinkedIn, outreach, and interview
   outputs consistent with one another and with the approved dossier.
4. **Career Reusability** — lets a user target another role without
   rebuilding their history from zero.

## Language corrections

**Compounding value, not lock-in.** The product goal is not switching cost —
it's compounding value with portability:

> These create compounding value: the more verified history a user builds,
> the faster and more coherent every future application becomes. Users can
> export their approved career data at any time.

Career Forge should feel like a vault the user owns, not a nightclub that
confiscated their coat.

**Personal data compounding, not network effects.** One user's accumulated
history is not a network effect — nobody else benefits from it:

> Personal data compounding: each approved role, project, metric, target, and
> edit improves future packs without forcing the user to reconstruct their
> career.

An optional anonymized data flywheel may eventually help the system, but it
is not a moat today and must not shape current product decisions.

**No absolute hallucination promise.** "Never" is a promise the
implementation must earn continuously, not a claim to make once:

> Career Forge builds final materials only from claims you approve.

Marketing variant, still specific and testable:

> Nothing enters your final career materials without your approval.

**No numerical defensibility scores.** Do not present "92% grounded" or
similar false precision. Use legible statuses instead:

- **Verified** — directly supported by approved evidence, exact match.
- **Supported** — supported by approved evidence with some inference.
- **Needs confirmation** — plausible but not yet backed by an approved fact.
- **Excluded** — explicitly rejected or withheld; will never appear in output.

Résumé truth is not a weather forecast.

## The commercial boundary

Career Forge is a living system a user returns to for years. The purchase is
a one-time transaction. These must not be conflated — a $49 purchase does not
sell unlimited lifetime generation. Each purchased Career Pack defines:

- **Permanent ownership** of the user's approved evidence and manual edits —
  exportable, never revoked, never re-priced.
- **Permanent access** to the specific Career Pack tier's deliverables once
  generated.
- A **defined number of target lanes** the pack covers (see
  `src/lib/packages.ts`: 1 / 2 / 3 lanes for Reset / Job Search / Career
  Switch).
- A **defined regeneration allowance** — re-forging is unlimited today
  (client-side, no metering exists yet); this is a scope gap, not a design
  decision, and should not be marketed as unlimited before it is deliberately
  scoped.
- **Paid expansion** for additional target lanes or tiers beyond what was
  purchased.

Working phrase: **permanent ownership of your work; defined access to future
AI generation.**

## What Claude must prove, not just build

The differentiation thesis is only as real as the software underneath it.
The next verification pass must confirm — against the running application,
not the pitch — that:

1. A second target pack can be generated without re-entering experience.
2. Every final claim traces to approved evidence.
3. A rejected claim never reappears in any generated artifact.
4. Manual edits survive both refresh and regeneration.
5. Résumé, LinkedIn, outreach, and interview outputs stay factually
   consistent with each other and with the dossier.
6. The approved evidence itself is exportable, independent of any generated
   document.
7. The user can see, in the product, exactly what Career Forge remembers.
8. The pricing model actually communicates permanent access vs. generation
   limits — not just in this document, but on `/pricing` and `/unlock`.
