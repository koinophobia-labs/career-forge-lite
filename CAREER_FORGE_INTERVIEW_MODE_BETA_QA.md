# Career Forge Interview Mode Beta QA Notes

Date: June 25, 2026

## Local Run

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/interview`

## Routes To Test

- `/` landing page
- `/#demo` free guided builder
- `/interview` Interview Mode premium preview

## Interview Mode Sample Answers

Use these answers one at a time in `/interview`:

```text
Customer Success Associate in retail technology
I worked as a Customer Service Associate at Walgreens from 2021 - 2024.
I handled conflict resolution, returns, cash handling, policy enforcement, inventory questions, and teamwork during busy shifts.
I improved customer satisfaction by resolving routine issues and escalating complex cases.
I helped 60+ customers per shift and handled register transactions accurately.
I used POS systems, inventory systems, phone support, and Microsoft Teams.
```

Expected behavior:

- Assistant acknowledges each answer before asking another question.
- Assistant does not repeat the same question.
- Sidebar updates learned facts and missing items.
- Generate Resume unlocks only after enough target, role, responsibility, tool/skill, and result/project evidence exists.
- Resume review shows summary, bullets, skills/tools, LinkedIn headline, evidence, and improvement targets.
- Copy resume and copy headline buttons work.

## Preview Limit Check

Use short answers until the preview meter reaches `6 of 6`.

Expected behavior:

- Text input disables after the preview limit.
- Lock panel explains this is a premium preview.
- Copy says no payment is required.
- User can Start Over, Use Free Builder, or return Home.
- No checkout, payment, Stripe, or charge flow appears.

## Free Builder Check

From `/`, use the free guided builder:

- Start the interview from the landing page.
- Select a known target role.
- Confirm or change the mapped lane only if needed.
- Select tools and responsibilities.
- Add scope/outcomes.
- Generate the resume.

Expected behavior:

- Static builder remains free and usable.
- Resume output remains ATS-safe and single-column.
- Export/copy content does not include UI-only labels.

## Accessibility Basics

Check:

- Main chat input has a readable label.
- Send button works with keyboard submit.
- Generate Resume disabled state has explanatory text.
- Preview meter and readiness text are understandable.
- Buttons have visible text labels.
- Focus states remain visible on inputs and links.
- Mobile layout stacks chat before the coach dashboard.

## Known Limitations

- Interview Mode is deterministic and local; it does not call an AI API.
- Contact details are not collected conversationally yet.
- The preview limit is hardcoded and not connected to auth or billing.
- Browser-console and visual regression testing are manual for now.
- Nontraditional project-heavy users may still show work history as a weaker area, even when project proof is enough to generate.

## Release Blocker Checklist

- [ ] Landing page entry works.
- [ ] Header Interview Mode link works.
- [ ] `/interview` route loads.
- [ ] Chat accepts answers.
- [ ] Preview limit locks honestly.
- [ ] Generate Resume unlocks only after enough evidence.
- [ ] Review screen renders generated resume content.
- [ ] Copy buttons work.
- [ ] Improve Weak Areas returns to interview mode.
- [ ] Start Over resets the session.
- [ ] Use Free Builder returns to `/#demo`.
- [ ] No fake metrics are generated.
- [ ] No payment or guarantee claims appear.
- [ ] Static builder remains usable.
- [ ] `npm run smoke:interview` passes.
- [ ] `npm run smoke:generator` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
