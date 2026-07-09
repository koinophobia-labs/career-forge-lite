# Resume Pack — Design Brief (for Fable/Claude/Canva)

Two renditions per resume. Same text content in both — design never adds or removes claims.

## Version A — Conservative ATS (all four resumes)

The safe default. Use for every online application portal (Workday, Greenhouse, Lever, iCIMS).

- **Layout:** single column, no tables, no text boxes, no columns, no images, no icons
- **Type:** one typeface throughout — Calibri, Arial, or Georgia; 10.5–11pt body, 13–14pt section headings, 20–22pt name
- **Headings:** standard ATS-recognized labels exactly as written in the files: SUMMARY, CORE SKILLS, EXPERIENCE, SELECTED PROJECTS, EDUCATION
- **Bullets:** plain round bullets only; no glyphs, arrows, or emoji
- **Spacing:** 0.6–0.8in margins; one page, hard stop — cut the weakest bullet before shrinking the font below 10.5pt
- **Color:** black text only; the headline line under the name may be dark gray
- **Output:** export as PDF *and* keep a .docx — some portals parse .docx more reliably

## Version B — Designed PDF (Canva or HTML-to-PDF)

For direct emails to hiring managers, LinkedIn DMs, referrals, and printed copies. Modern but hiring-manager-safe: strong typography, not decoration.

**Shared system (all four):**

- Still one page, still effectively single column (a narrow left meta-strip is acceptable, but body content stays in one main column so it also survives ATS in a pinch)
- **Type pairing:** Inter or Source Sans 3 for body (10–10.5pt); the same family in SemiBold/Bold for name and section heads — no display fonts, no scripts
- **Name block:** name at 24–28pt, headline directly beneath in the lane's accent color, contact line in small caps or 8.5pt gray
- **Section heads:** 11pt bold, letterspaced +5%, with a thin (0.75pt) rule in the accent color running to the right margin — this is the entire "design"
- **Skills:** render CORE SKILLS as a tight two- or three-line wrapped list separated by "·" — not pills, not tag chips
- **Whitespace:** more space above sections than below; let the page breathe — a fast 6-second recruiter scan should land on: name → headline → current title → first bullet of each role
- **No:** photos, skill bars, star ratings, radial charts, sidebars with icons, background textures

**Accent color per lane (one accent only, used for headline + section rules):**

| Resume | Accent | Rationale |
|---|---|---|
| Fraud / Risk Ops / Responsible Gaming | Deep navy `#1B3A5B` | Trust, regulation, seriousness |
| AI Product Support / QA / Product Ops | Teal `#0F766E` | Modern product/tech without startup-loud |
| Community / Trust & Safety / Discord | Indigo `#4338CA` | Community/platform feel, still corporate-safe |
| Customer Success / Implementation | Warm slate blue `#33526E` | Approachable, consultative, stable |

**Canva execution notes:**

- Start from a blank US Letter doc, not a template — templates fight the single-column rule
- Set up the 4 accents as brand colors; duplicate one master layout 4× and swap text + accent
- Lock line spacing at 1.15; paragraph space 6pt after bullets, 14pt before section heads
- Export: PDF Standard (not Print) to keep file size small enough for email

## File naming

**Exports (what recruiters see):**

- `Blake-Taylor-Resume-Fraud-Risk-Operations.pdf`
- `Blake-Taylor-Resume-AI-Product-Support-QA.pdf`
- `Blake-Taylor-Resume-Community-Trust-Safety.pdf`
- `Blake-Taylor-Resume-Customer-Success-Implementation.pdf`

Append `-ATS` to the Version A exports if keeping both variants in the same folder (portals don't care about the file name being pretty; humans do — send the un-suffixed designed version to humans).

**Sources (this folder):** the four `.md` files are the single source of truth. Edit here first, then re-export — never let the Canva copy drift from the text files.
