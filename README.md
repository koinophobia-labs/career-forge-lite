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

## Commerce (self-service packs, no accounts)

The product contract is centralized in [src/lib/packages.ts](src/lib/packages.ts): useful Free access, a $9 Resume Pack, $15 Job Pack, $25 Career Pack, and non-renewing $39 30-Day All Access.

- Free users can import or enter history, approve evidence, build and edit one role direction, inspect résumé drafts, analyze jobs, track applications, and try six interview answers.
- Paid packs unlock the specific exports, workflows, and role-direction limits shown at checkout. Resume, Job, and Career Packs are permanent; All Access expires exactly 30 days after purchase.
- Stripe Price IDs are authoritative server configuration. Fulfillment is a signed ECDSA P-256 entitlement plus a short emailed recovery code; the client never trusts a `paid=true` flag.
- Multiple purchases coexist, an expired pass falls back to any permanent pack, and career data remains local to the browser. See [docs/PAYMENTS.md](docs/PAYMENTS.md).
- `NEXT_PUBLIC_COMMERCE_MODE=off` (default) closes checkout but does not silently grant premium features.

## Development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # regression suites (pure Node, no browser needed)
npm run lint
npm run typecheck
npm run build      # production Next.js build
```

Env vars: copy `.env.example` and see [docs/PAYMENTS.md](docs/PAYMENTS.md). With nothing set, the useful Free experience runs and checkout stays closed.

Useful scripts:

- `node scripts/generate-license-keys.mjs` — mint an ECDSA keypair for license signing
- `node scripts/mint-license.mjs <tier> [ref]` — mint a license manually (support/QA)
- `npm run acceptance:browser` / `acceptance:activation` — Playwright end-to-end suites against a local server

## Testing philosophy

Every regression suite is a plain Node script (`scripts/*-regression.mjs`) that transpiles the TypeScript sources on the fly and asserts behavior — including an 82-persona generation-quality suite with a hallucination gate, truth-workflow provenance checks, entitlement/license forgery checks, and data-durability checks. `npm test` runs them all.

## Deployment

Vercel (`career-forge-lite.vercel.app`). See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for environment configuration, payment modes, and the release smoke-test checklist.

Built by [Koinophobia Labs](https://koinophobialabs.com).
