# $149 Human-Reviewed Résumé Service — Fulfillment Guide

The public page is `/reviewed-service`. This document is the founder-side checklist.
The service is deliberately separate from the automated beta: a human reviews every
layer before delivery, and nothing here implies automated outputs get this review.

## Path

1. **Inquiry** arrives at koinophobia999@gmail.com (template on the page includes target
   role, timeline, and whether they use Career Forge).
2. **Capacity check:** accept only one active paid rebuild at a time during the founding
   release. If a rebuild is already active, offer a no-payment waitlist and give no start-date
   promise until the current delivery closes.
3. **Intake reply** (within 1 business day): request their Career Forge backup export or
   any existing résumé, plus 5 intake questions (target role, 3 proudest outcomes,
   constraints, timeline, anything they refuse to claim).
4. **Payment-ready handoff:** after intake is complete, confirm the exact deliverables,
   five-business-day delivery date, revision window, privacy terms, and refund terms in
   writing. Then create and send a new Stripe payment link for the flat $149 with its
   completed-session limit set to **1**. Never reuse a prior client link, and never send
   it before scope and capacity are confirmed. (This uses a manually
   created payment link — automated-tier commerce in the app remains off.)
5. **Fulfillment** (checklist below), within 5 business days of payment + complete intake.
6. **Delivery** (checklist below).
7. **Revision round:** one included, within 14 days of delivery.
8. **Retention close:** delete working files within 30 days after final delivery (or earlier
   on request) and record only the deletion date in the private operations log.

## Capacity and order record

- Keep the order record outside this repository. Record only the Stripe order reference,
  payment date, promised delivery date, status, revision deadline, refund status, and file
  deletion date. Never copy résumé content into the record.
- Allowed statuses: `inquiry`, `waitlisted`, `scope-confirmed`, `paid`, `in-progress`,
  `delivered`, `revision-open`, `closed`, `refunded`.
- Do not send a second payment link while another order is `paid`, `in-progress`, or
  `revision-open`. The founder may raise this limit only after measuring the first complete
  fulfillment cycle.
- Confirm the link's completed-session limit is `1` before sending it. Deactivate the link
  immediately after successful payment even when Stripe reports that its limit was reached.
- If the promised date becomes unsafe, notify the client before the deadline and offer a
  new written date or a full refund.

## Fulfillment checklist (all required)

- [ ] Read the entire dossier / source material; flag wrong-category items back to the client.
- [ ] Confirm the target lane(s) against the evidence; recommend dropping any lane the evidence cannot carry.
- [ ] Review every résumé claim for defensibility; rewrite weak or unverifiable phrasing by hand.
- [ ] Verify no separation reasons, preferences, gaps-as-claims, or uncertainty statements appear anywhere.
- [ ] Rewrite the LinkedIn headline from the strongest reviewed evidence. Add an About
      section only when it was included in the written scope; it is not part of the base offer.
- [ ] Generate final PDF and DOCX; open both and read every page (layout, pagination, wrapping, headings).
- [ ] Write the change-notes memo: every significant change and why.

## Delivery checklist (all required)

- [ ] Final PDF + DOCX attached, filenames carrying the client's name and target role.
- [ ] LinkedIn headline included in the delivery email or an attached text document.
- [ ] Change-notes memo attached.
- [ ] Turnaround met (5 business days) — if not, tell the client before the deadline passes, not after.
- [ ] Revision policy restated in the delivery email (one round, 14 days).
- [ ] Working-file deletion date scheduled no later than 30 days after final delivery.
- [ ] No claim anywhere that automated Career Forge output receives this review.

## Boundaries

- Never invent or "strengthen" a claim the client's material does not support — the
  service inherits the product's honesty rules.
- Client materials never enter this repository or any shared analytics.
- If the client's material cannot support a credible résumé for their target, say so and
  offer a refund rather than delivering something indefensible.

## Copy-ready operator messages

### Waitlist

> Thanks for asking about the Career Forge Résumé Rebuild. The current founding slot is
> occupied, so I will not take payment yet. If you would like, I can hold your place and
> confirm a start date after the active delivery closes.

### Scope and payment

> I can take this rebuild. The $149 scope is one diagnostic, one rebuilt résumé in PDF and
> DOCX, one LinkedIn headline, three target-role directions, a Loom walkthrough, and one
> focused revision requested within 14 days. With complete intake and payment by [date],
> delivery is due by [date, within 5 business days]. Working files are deleted within 30
> days after final delivery. Reply “I agree” before I send the secure payment link.

### Delivery

> Attached are the reviewed PDF, DOCX, target-role directions, and change-notes memo. Your
> LinkedIn headline and Loom walkthrough are linked below. One focused revision is included
> if requested by [date, 14 days after delivery]. Please review every date and claim before
> submitting the résumé. Working files are scheduled for deletion by [date].
