# Career Forge

Career Forge turns messy work history into a complete, truthful career package: a reviewed evidence base, an ATS and a recruiter résumé per target lane, LinkedIn positioning, job-specific tailoring, outreach templates, an application pipeline, and interview preparation — all grounded in facts the user explicitly approved.

**The honesty contract:** nothing enters a generated document unless the user provided it and approved it. Missing experience stays missing; reasons for leaving a job are withheld (and reported as withheld); uncertainty ("I don't know my numbers") never becomes a claim. Every claim in an exported document traces to approved evidence.

**Local-first:** no accounts, no server database. Career data lives in the browser's localStorage; imported résumé files are parsed in-browser and never retained. Backup and restore are file-based and user-controlled (`/settings`).

## The product loop

| Step | Route | What happens |
| --- | --- | --- |
| Choose a goal | `/` | Five plain-language goals route into distinct workflows; returning users resume where they left off |
| Capture history | `/profile` | Import old résumés (PDF/DOCX/text, parsed locally) or describe work directly |
| Approve facts | `/profile` → Truth Inbox | Imported facts stay proposals until approved; source excerpts attached |
| Choose lanes | `/targets` | Role-family lanes with fit rationale; custom lanes supported |
| Forge the pack | `/targets` → `/versions` | ATS + recruiter résumé per active lane, LinkedIn kit, evidence receipt |
| Use it | `/tailor`, `/applications`, `/outreach`, `/interview` | Job-post tailoring, pipeline tracking, outreach templates, interview prep |

Supporting stations: `/truth-map` (claim→evidence lineage), `/weekly` (honest weekly review), `/settings` (backup/restore/clear), `/story` (free-text intake), `/resume-builder` (guided question-by-question builder).

## Commerce (one-time packs, no accounts)

Three configurable packs — Career Reset ($49), Job Search ($79), Career Switch ($99) — defined entirely in [src/lib/packages.ts](src/lib/packages.ts). Prices are product hypotheses; change them in that one file.

- Building, reviewing, and editing are free; **exporting and power features unlock with a pack**.
- Fulfillment is a signed **license key** (ECDSA P-256), minted server-side after Stripe Checkout and verified offline in the browser. No account, no career data server-side. See [docs/PAYMENTS.md](docs/PAYMENTS.md) for architecture, setup, and the go-live checklist.
- `NEXT_PUBLIC_COMMERCE_MODE=off` (default) keeps everything free-beta: no gates, no buy buttons, no dead checkout.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # regression suites (pure Node, no browser needed)
npm run lint
npm run typecheck
npm run build      # production build: static pages + 3 API routes
```

Env vars: copy `.env.example` and see [docs/PAYMENTS.md](docs/PAYMENTS.md). With nothing set, the app runs fully as the free beta.

Useful scripts:

- `node scripts/generate-license-keys.mjs` — mint an ECDSA keypair for license signing
- `node scripts/mint-license.mjs <tier> [ref]` — mint a license manually (support/QA)
- `npm run acceptance:browser` / `acceptance:activation` — Playwright end-to-end suites against a local server

## Testing philosophy

Every regression suite is a plain Node script (`scripts/*-regression.mjs`) that transpiles the TypeScript sources on the fly and asserts behavior — including an 82-persona generation-quality suite with a hallucination gate, truth-workflow provenance checks, entitlement/license forgery checks, and data-durability checks. `npm test` runs them all.

## Deployment

Vercel (`career-forge-lite.vercel.app`). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for environment configuration, payment modes, and the release smoke-test checklist.

Built by [Koinophobia Labs](https://koinophobialabs.com).
