# Career Forge truth + application workflow report

## 1. Branch and commit

- Branch: `codex/career-forge-truth-workflow`
- Foundation: `8c2b0e95b823dabff3fcd75f4a18976de6bd88e2`
- Review commit: recorded in the final handoff after this report is committed
- Deployment: none

## 2. Files changed

- Product UI: dossier/profile, targets integration, résumé pack editor, tailoring, applications, settings, mobile command navigation
- Models/storage: dossier and command-center types, additive revival/migration defaults, analytics event allowlist
- Core logic: dossier import/materialization, local PDF/DOCX/text extraction, résumé pack generation/provenance, evidence-only job matching, application-question drafting, PDF/DOCX/ZIP export
- Verification: baseline report, truth-workflow regression, private redacted acceptance, full Playwright browser acceptance
- Dependencies: `mammoth` and `pdfjs-dist`

## 3. Schema changes

The persisted state and backup envelope remain version 2 so existing local data and backups continue to load. Changes are additive and revived with safe defaults:

- Evidence: rejected lifecycle, source excerpts, optional retained source filenames
- Projects: metrics, links, and default résumé placement
- Claim references: `supportType` (`direct`, `combined`, `transferred`)
- Variants: user-authored paths and section order
- Receipts: transferred claims and gaps left unclaimed
- Applications: source, discovery/direct URLs, posting/deadline dates, contact fields, baseline variant, and evidence-backed custom questions

## 4. Migration behavior

- Legacy v1/v2 state continues through the hardened `parseState` path.
- Existing lanes, applications, outreach, résumé versions, snapshots, packs, dossier evidence, export metadata, and cross-links are preserved.
- Legacy `jobPostUrl` becomes the discovery URL while remaining present for compatibility.
- Old evidence, projects, variants, receipts, and applications receive non-destructive defaults for all new fields.
- Bare legacy backups and schema-v1 envelopes still restore; newer unknown schemas remain blocked.

## 5. Import behavior

- Accepts multiple PDF, DOCX, and text files in one browser-local operation.
- Uses PDF.js and Mammoth locally; no API or upload path exists.
- Normalizes and deduplicates repeated records across résumé versions, retains exact source excerpts, and groups proposals into identity, employment, projects, education, tools, skills, metrics/outcomes, and other evidence.
- Review supports section approval, individual approval, editing, rejection, likely-duplicate merging, source inspection, and explicit save.
- Approved proposals materialize structured roles, projects, education, identity, tools, skills, metrics, and proof points where parsing is defensible.
- Binary contents are never persisted. Filenames are retained only when the user explicitly opts in; analytics records only the event name.

## 6. Résumé-generation changes

- Generation selects approved evidence by lane relevance instead of pushing the first dossier claims.
- Projects can carry the document and can default to Projects, Experience, Selected Projects, or omission.
- ATS variants use dense skills, employment-first order, conservative styling, and direct chronology.
- Recruiter variants use project-first ordering, fewer skills/bullets, narrative framing, and a distinct template/style.
- Full editing covers summary, skills, headings, bullets, education, and section order. Edits mark the variant and path as user-authored, preserve unchanged provenance, and support one-step undo.
- Dossier changes preserve old/user-edited outputs and mark affected variants out of date.

## 7. Provenance model

Every shipped reference contains `claimPath`, `claimText`, only the relevant `evidenceIds`, and `supportType`. Role/project/education facts are direct; lane-facing summaries and headlines are transferred. Claims without evidence are not added to the reference set or usable output. The receipt exposes evidence used/omitted, transferred claims, unsupported claims refused, and gaps left unclaimed. The editor expands each claim to its exact supporting evidence.

## 8. Matching changes

- Lane keywords are removed from the truth corpus.
- Covered requires direct approved dossier support.
- Partial requires related approved evidence and is labeled transferred.
- Gap means no approved support.
- Tests prove Salesforce lane text cannot become evidence, degrees remain gaps without education, customer service maps to SaaS support only as partial, and sportsbook policy enforcement maps to fraud/risk only as transferred unless the exact requirement is present.

## 9. LinkedIn workflow

Tailoring now records LinkedIn (or other) discovery source/URL separately from the employer application URL, plus posting/deadline/contact metadata and selected lane/baseline. Custom questions produce editable drafts backed only by approved evidence. Applications display both URLs, evidence for each answer, user-edit status, resume lineage, and automatic follow-up dates.

## 10. Tests and exact totals

- `npm test`: 347 named assertions passed, 0 failed; desktop/mobile usability flow passed; 82-persona quality regression scored 98/100 with 0 hallucinations.
- `npm run lint`: passed, 0 warnings/errors.
- `npm run typecheck`: passed.
- `npm run build`: passed; 16 static pages generated.
- `npm run smoke:generator`: 6 personas passed.
- `npm run smoke:interview`: 7 profiles simulated successfully.
- `npm run smoke:resume-intelligence`: 20/20 profiles rated Excellent.
- `npm run playtest:adversarial`: 10/10 profiles completed with 0 unsupported claims.
- `npm run acceptance:private`: 15/15 redacted real-workflow checks passed.
- `npm run acceptance:browser`: passed.

## 11. Browser QA

The fresh Playwright flow passed at 375×667 and 1440×900:

fresh storage → multi-file import → grouped approval → structured dossier → three active lanes → six baseline résumés → PDF/DOCX ZIP → job analysis → evidence-backed questions → applied application with both URLs → job-specific résumé generation with influence receipt and application attachment → refresh persistence → JSON backup → clear local data → restore → verify application, tailored résumé, and résumé pack.

No horizontal overflow was detected. Mobile navigation now uses a single horizontally scrollable row with 44px minimum targets. Keyboard focus lands on an interactive control on desktop.

## 12. Deferred items

- OCR for image-only/scanned PDFs is not included; those files need selectable text or a text export.
- Import parsing is deliberately heuristic and review-gated rather than pretending to infer ambiguous employers, dates, or outcomes perfectly.

## 13. Known risks

- Extremely unconventional résumé layouts may produce proposals in “Other proposed evidence” and need manual editing/merging.
- PDF output uses jsPDF’s built-in font set; common Unicode punctuation is covered by regression/export flows, but rare scripts may require an embedded font in a future iteration.
- The underlying legacy `ResumePackage` still represents projects as experience-shaped entries for rendering compatibility; placement and section-order metadata preserve the intended distinction in packs and exports.

## 14. Review readiness

SAFE FOR OWNER REVIEW
