# Career Forge Launch Checklist

Date: June 25, 2026

## Product

- [x] Clear one-sentence promise on landing page.
- [x] Free Guided Builder path is visible.
- [x] Interview Mode Premium Preview path is visible.
- [x] Generated resume stays ATS-safe and single-column.
- [x] LinkedIn headline/summary output remains focused.
- [x] No login, database, payments, job board, analytics, or AI API required.

## UX

- [x] First-time visitor can choose between Guided Builder and Interview Mode.
- [x] Primary CTA is `Build My Resume`.
- [x] Secondary CTA is `Try Interview Mode`.
- [x] Guided Builder explains what will happen before the user answers.
- [x] Interview Mode explains what will happen before the user answers.
- [x] Review screen includes before-you-apply guidance.
- [ ] Run a full browser click-through on a mobile device.

## Mobile

- [x] Layouts use responsive grids and wrapping chips.
- [x] CTAs have touch-friendly sizing.
- [x] Interview Mode stacks chat and coach dashboard.
- [ ] Capture final mobile screenshots after deployment.

## Accessibility

- [x] Form inputs have visible labels.
- [x] Buttons use visible text labels.
- [x] Disabled Generate Resume states have explanatory text in Interview Mode.
- [x] Copy avoids relying only on color to explain state.
- [ ] Run automated accessibility scan before paid launch.

## Copy

- [x] Landing page explains what Career Forge does in under 10 seconds.
- [x] Two paths are explained clearly.
- [x] Premium Preview copy is honest.
- [x] No claims of guaranteed interviews, ATS beating, job placement, or active payment.
- [x] Trust language avoids fake metrics and fake testimonials.

## Performance

- [x] `npm run build` passes.
- [x] App routes prerender as static content.
- [ ] Run Lighthouse after deployment.

## SEO

- [x] Page title and description exist.
- [ ] Add richer social preview metadata before broader public push.
- [ ] Add screenshot/OG image if needed.

## Analytics

- [x] No analytics added in MVP.
- [ ] Decide whether privacy-respecting analytics are needed after beta.

## Legal

- [x] No job placement guarantees.
- [x] No ATS score guarantee.
- [ ] Add simple terms/privacy page before paid product.

## Privacy

- [x] Local-state-only MVP.
- [x] No account or database storage.
- [x] No AI API data transfer.
- [ ] Add explicit privacy note if public traffic increases.

## Known Limitations

- Interview Mode is deterministic, not LLM-powered.
- Guided Builder data is not saved after refresh.
- No hosted account or resume library.
- No real PDF engine beyond browser print/save.
- No job-specific tailoring against uploaded job descriptions.

## Future Roadmap

- Browser/mobile QA automation.
- Optional AI extraction layer.
- Job-description tailoring.
- Saved drafts/accounts.
- Real PDF export.
- Payment-gated Interview Mode.

## Beta Checklist

- [x] `npm run smoke:generator`
- [x] `npm run smoke:interview`
- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run build`
- [ ] Manual mobile click-through.
- [ ] Collect beta feedback on confusing questions.

## Production Checklist

- [x] GitHub main branch updated.
- [x] Build passes locally.
- [ ] Confirm Vercel deployment after push.
- [ ] Verify live landing page.
- [ ] Verify live `/interview`.
- [ ] Verify print/save PDF output from live site.
