# Career Forge — Five-User Launch Gate

**Status: NOT YET RUN.** This gate runs only after the editing workflow reaches launch quality (see §1). It is the last item on the launch-closure queue.

The gate exists because automated validation cannot certify this product. The suite scored **87/100 with 0 hallucinations** while six independent fabrication vectors were live in exported résumés. Five real people using it unaided is the check that has no shared assumptions with the code.

---

## 1. Readiness precondition

Run this before scheduling anyone. It is the same clean-account journey, and it takes about ten minutes.

| Precondition | How to check | Status at `8394214` |
| --- | --- | --- |
| A typed sentence survives to the export verbatim | Enter `It was my job to reconcile the drawer.`, forge, open the PDF | **PASS** — verbatim (was `It was job to reconcile the drawer`) |
| A sentence is not fragmented | Enter `Mopped, swept, wiped the front end.` | **PASS** — one claim (was `- Mopped` / `- Swept`) |
| A denial does not become a skill | Enter `I never handled the safe.` | **PASS** — no affirmative skill minted |
| Editing the preview changes the export | Edit the summary, re-open `/versions/view` | **PASS** — verified live |
| Deleting a duty keeps it deleted | Delete a duty, re-forge | **PASS** — behavioural regression |
| One guided session does not corrupt the dossier | Complete a session, check role count | **PASS** — 1 role (was 5, with a duplicated id) |
| No paid-state copy with commerce off | Load `/founding-beta` | **PASS** — "Planned packaging · Not on sale" |
| **Storage-failure recovery is user-visible** | Fill the quota, keep editing, confirm the banner explains what is unsaved | **NOT VERIFIED** — the data is now retained (DS-01 fixed) but the banner copy has not been tested with a real user |

**Do not run the gate while any precondition is failing.** A failed precondition guarantees a failed session and burns a participant.

---

## 2. Participant criteria

Five people, none of whom have seen Career Forge. At least:

- **two** in non-office/hourly work (retail, food service, warehouse, care) — the product's actual audience and the population every fabrication vector was found against
- **one** with an employment gap or a career change
- **one** who will use a phone or tablet
- **one** who is not confident with computers

Exclude anyone who has heard the pitch, and anyone who works with Blake.

---

## 3. Protocol

**No facilitator intervention.** The facilitator may only say: *"Do whatever you would do if I weren't here."* Any other help ends that session as a failure.

1. Hand over a device with a clean browser profile at the root URL. Say only: *"This is a tool for building a résumé. Use it however makes sense to you."*
2. Ask the participant to think aloud. Record the screen if they consent; otherwise take notes.
3. Stop at 45 minutes regardless of progress.
4. Debrief with exactly these questions, in this order, before any discussion:
   - *What did this do for you?*
   - *What should you do next?*
   - *Was anything on your résumé not true, or not something you'd say?*
   - *How easy was that, one to ten?*
   - *Would you send this to a real employer?*

Question 3 is the one that matters most. **The participant is the only person who can tell you whether a claim is theirs.** Ask it while the export is open in front of them, and have them read every bullet aloud.

---

## 4. Pass criteria

All of the following. There is no partial credit and no averaging.

- [ ] **5 of 5** reach a usable export
- [ ] **Zero** facilitator interventions
- [ ] **Zero** fabricated claims in any final output — judged by the participant reading their own résumé, not by us
- [ ] **Zero** lost data
- [ ] **Zero** critical errors
- [ ] Every participant rates ease **9 or 10**
- [ ] Every participant can say in their own words what the product did
- [ ] Every participant knows what to do next
- [ ] **No two participants get stuck at the same step** — a repeated stall is a product defect, not user error

**Do not average away a failed user.** One participant who cannot finish is a failed gate.

---

## 5. Observation sheet (one per participant)

```
Participant:            P__          Date: ________   Device: phone / tablet / laptop
Background:             ______________________________________________
Prior résumé tooling:   none / Word / Canva / other: ______

TIMELINE
  first meaningful action at   __:__   (what: ____________________)
  first hesitation > 10s at    __:__   (where: ___________________)
  reached an export at         __:__   / did not reach one
  total unaided time                __ min

HESITATION / BACKTRACK LOG   (one line each — where, what they said, what they did)
  ____________________________________________________________________
  ____________________________________________________________________

TERMINOLOGY THEY DID NOT RECOGNISE
  ( ) lane      ( ) dossier    ( ) evidence   ( ) Truth Inbox
  ( ) pack      ( ) tailor     ( ) sprint     ( ) other: __________

TRUST
  Did they doubt anything the product produced?   yes / no
    what: _____________________________________________________________
  Did they ask whether something was true?        yes / no
  Did they say a bullet was not theirs?           yes / no   ← ANY YES FAILS THE GATE
    exact bullet: _____________________________________________________

DEBRIEF (verbatim)
  "What did this do for you?"      _______________________________________
  "What should you do next?"       _______________________________________
  "Anything not true / not yours?" _______________________________________
  Ease 1-10: ___        Would send to a real employer: yes / no

FACILITATOR INTERVENTIONS (any entry fails the session): ____________________
```

---

## 6. What to do with the result

- **All criteria met** → the gate is closed. Proceed to the release checklist in `CAREER_FORGE_LAUNCH_CERTIFICATION_AUDIT.md` §8.
- **A fabricated claim appears** → treat as **P0**. Six vectors have been found and closed; the classes are not exhausted. Add the participant's exact input as a fixture in `generator-truth-regression.mjs` before fixing anything, then re-run the whole gate with five *new* participants.
- **Two users stall at the same step** → that step is a product defect. Fix it, then re-run the gate. Participants who already completed a session cannot be reused.
- **A user cannot finish** → failed gate. Do not reason about why they were unrepresentative.

Record every session's sheet in `docs/evidence/five-user-gate/`.
