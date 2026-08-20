# Career Forge Manual QA Checklist

Run before promoting any release to production. Automated coverage:
`npm test && npm run lint && npm run typecheck && npm run build` must be green
first — this checklist covers what only a human (or a browser pass) can judge.

## First-run journey (fresh browser profile)

- [ ] `/` shows the goal picker; each of the five goals routes somewhere sensible
- [ ] Reload after choosing a goal → the goal is remembered, resume path offered
- [ ] Paste-import a résumé (no file) → Truth Inbox appears with grouped facts
- [ ] Every proposal shows its fact text and source excerpt before approval
- [ ] Approve facts → dossier counts update; identity quick-fill prompts if name empty
- [ ] Add a CUSTOM lane → "Make this lane active" is visible and works
- [ ] Forge with 0 active lanes is disabled WITH an explanation, not silently
- [ ] Forge → `/versions`: every role shows real bullets; summary reads like a
      résumé (no "I…", no reason-for-leaving, no double periods)
- [ ] Receipt wording says "N of your M approved facts" (never "unapproved")
- [ ] Skills are individual items (no "Tools:" prefix, no sentence fragments)
- [ ] Approved education appears on the document

## Honesty spot-checks (the product's reason to exist)

- [ ] Type "I don't know my numbers" into metrics → warned, not saved as evidence
- [ ] Include "until I was laid off" in a work description → never appears in
      any document, export, or LinkedIn text; receipt notes a withheld fact
- [ ] Guided builder: generated draft contains ONLY things you typed —
      no template bullets, no invented skills
- [ ] Interview prep: no gap question asserts you lack something your
      evidence shows; founder question absent without founder evidence
- [ ] Tailor: recruiter message contains no second-person coaching text

## Commerce (with NEXT_PUBLIC_COMMERCE_MODE=test)

- [ ] `/pricing` shows useful Free plus $9 Resume, $15 Job, $25 Career, and $39 30-Day All Access; every card names its limit and after-purchase behavior
- [ ] No $49 legacy pack or $149 human-service upsell appears in the primary pricing, résumé-completion, or footer flow
- [ ] Without a license: exports/tailor-build/outreach-templates show the
      locked panel with price and pricing link — never a dead button
- [ ] Interview mode stops at 6 answers with the upgrade panel; transcript
      survives refresh
- [ ] Buy each pack with 4242… → `/unlock` activates exactly the sold features and the Stripe Session has the expected Price/amount
- [ ] Emailed short code in a second fresh browser restores access; the signed entitlement is never displayed or emailed
- [ ] Buy a second permanent pack → both purchases remain in the wallet after reload
- [ ] Expired All Access → paid workflows re-lock, work remains, and any permanent pack still works
- [ ] Tamper with the stored key (change tier) → reload → invalid, not upgraded
- [ ] "Clear local data" wipes career data but NOT the license
- [ ] With COMMERCE_MODE=off: paid gates remain honest, no buy buttons appear,
      and the useful Free workflow still works
- [ ] Cancel checkout → `/pricing?checkout=cancelled`; no access is granted
- [ ] Reuse the same checkout request identity → Stripe creates no duplicate Session
- [ ] Production `/api/internal/commerce-certification` returns 404 after temporary credentials are removed

## Resilience

- [ ] Refresh mid-import-review → pending review persists
- [ ] Two tabs open: change data in one → other updates without clobbering
- [ ] Corrupt `career-forge-command-center-v1` in devtools → app loads empty,
      original blob quarantined under …-recovery
- [ ] Paste a 200KB job post into tailor → no freeze, honest analysis or guidance
- [ ] Double-click Forge / double-click checkout → one pack, one session

## Accessibility / responsive

- [ ] Keyboard: skip-to-content works; goal picker and Truth Inbox reachable
      and operable by keyboard alone
- [ ] 320px width: no horizontal scroll on /, /profile, /targets, /versions,
      /pricing; mobile menu opens AND closes (Escape, outside tap)
- [ ] Every form control announces a label (spot-check with VoiceOver)

## Exports (with the matching paid entitlement)

- [ ] PDF and DOCX open in real apps; name/contact present; sections in the
      order chosen in the editor; no internal ids or debug text anywhere
- [ ] ZIP bundle: every variant present (duplicate titles get -2 suffix),
      LinkedIn text + README included, README counts match contents
- [ ] Long content: 3 roles × 5 bullets + long names → nothing clipped
