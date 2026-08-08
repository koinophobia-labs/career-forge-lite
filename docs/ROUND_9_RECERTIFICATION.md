# Round 9 — Launch Re-Certification

**Frozen head:** `8b3a613` on `feat/point-of-read-evidence-gate`
**Date:** 2026-08-06
**Scope:** full re-certification. Every Round 8 lens was invalidated by the point-of-read evidence gate, so nothing was carried forward by inheritance.

---

## 1. Executive verdict

# NOT CERTIFIED

**26 P0 and 14 P1 findings survived adversarial verification.** The stopping condition requires zero of each. Not close, and not a matter of interpretation.

The gate change did what it was designed to do: the five Round 8 "tunnels under the fence" are closed, and the record-path leaks stayed closed under attack. But certifying an evidence gate is not the same as certifying a product. Eight lenses looking at the whole launch surface found that **the two largest defect classes were never about eligibility at all**, and the gate could not have addressed them:

- **The export sanitizer deletes real employers.** A role whose only bullet the classifier dislikes is removed whole — employer, job title and three years of dates vanish from the delivered DOCX and PDF, silently, while the on-screen preview still shows them. This is data loss the user cannot see.
- **Fabrication is not closed.** It moved. `resume-intelligence.ts` strips a leading "we" from every bullet, converting team accomplishments into personal claims; `story-mode.ts` mints competencies out of sentences that mean the opposite.

Four of the P0s are defects **in the new gate itself**, and one of them is the same class of mistake I fixed this morning: `NON_EVIDENCE_INTAKE_FIELDS` still exempts `currentCompany`, `previousCompany` and the title fields. I corrected the four fields the inventory named and never re-examined the rest of the list.

### What I verified personally

I did not sign this on the agents' word. Three P0s I reproduced myself, with my own fixtures, on the frozen head:

| Finding | My input | What shipped |
| --- | --- | --- |
| `fabrication-we-stripped-team-credit` | `"we cleared the whole discharge backlog before christmas"` + `"we got the ward audit up to 98% that year"` | `"Cleared the whole discharge backlog before christmas and got the ward audit up to 98% that year."` — the "we" is gone **and two separate team statements are fused into one personal claim**. Worse than reported. |
| `amputation-weakterms-deletes-sentence-objects` | `"helped people find stuff on the shop floor"` | `"Helped people find on the shop floor"` — the object of the verb is deleted |
| `intake-employer-and-title-fields-exempt-from-gate` | `currentCompany = "Wincanton (agency, until my position was cut)"` | `possibleDisclosure` returns `{"reason":"separation"}`, `getUsableIntake` returns it **unchanged**, and the résumé prints `Wincanton (agency, Until My Position Was Cut)` |

---

## 2. Stopping condition

| # | Requirement | Met | Evidence |
| --- | --- | --- | --- |
| 1 | Ran against the current head | **Yes** | All 114 agents pinned to `8b3a613`; tree verified clean of tracked changes throughout and after |
| 2 | Independent reviewer-authored fixtures | **Yes** | Lenses were barred from reading `scripts/*.mjs` for fixtures (loader only) and wrote in real-person register — UK care, warehouse, kitchen and cleaning workers, lowercase starts, curly apostrophes, run-ons |
| 3 | Decoded artifacts, not return values | **Yes** | DOCX `word/document.xml`, PDF content-stream `Tj` literals, and ZIP entry listings were decoded; several findings exist *only* at the artifact level |
| 4 | Persistence lifecycle exercised | **Partial** | Save → revive → regenerate → export was driven, but 5 of the persistence lens's verifications died mid-run (see §7) |
| 5 | Zero P0 and zero P1 | **No** | 26 P0, 14 P1 |

Requirement 5 alone is decisive.

---

## 3. Findings register

46 findings survived adversarial verification. Each was checked by two independent agents: a **refuter** told to default to REFUTED and re-run the reporter's steps, and a **reproducer** told to ignore those steps and design its own route to the same property.

### P0 — 26 finding(s)

**`amputation-employer-deleted-from-docx-and-pdf`** — A role whose bullets the classifier dislikes is deleted whole — employer, title and dates vanish from the DOCX and the PDF, silently  
*lens:* amputation · *site:* `src/lib/evidence-admissibility.ts:538` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> withheldFacts: []
> --- word/document.xml <w:t> runs ---
>   |Donna Marsh
>   |donna.marsh@example.com | 07700 900123 | Bolton
>   |Professional Summary
>   |Care assistant of eleven years, night and day shifts, dementia and end of life.
>   |Core Skills
>   |Personal care | Medication rounds
>   |Experience
>   |Ward Support Worker | St. Mary&apos;s Hospice | 2012 to 2016
>   |I look after the residents on the memory floor, mostly the ones who wander at night.
>   |Education
>   |NVQ Level 3 in Health and Social Care, Bolton College, 2014
> 
> "Senior Care Assistant | Brookvale House | March 2016 to present" (her CURRENT job) and "Stock Assistant | Hargreaves Wholesale | 2009 to 2012" appea

**`amputation-preview-shows-what-storage-drops`** — The résumé-builder preview shows a complete résumé; the saved version it writes contains no experience at all  
*lens:* amputation · *site:* `src/lib/evidence-admissibility.ts:701` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> sentences flagged for the user to review: 0
> --- what ResumePreview renders (the `resume` state object) ---
>   Goods In Operative | Fairhurst Distribution | 2018 to present
>     - Flag anything the shrink wrapper cannot handle and get the shift lead to sign it off.
>     - There were no training records when I started so I made a folder for every new starter.
>     - Didn't have any data on stock levels so I built a spreadsheet off the delivery notes.
> --- what was SAVED (what /versions/view shows and what exports) ---
> experience: []
> resumeText:
> Goods In Operative.
> Gcses, Ravensbourne School
> notes: "Needs review after evidence-safety update."

**`story-mode-prints-a-family-circumstance-as-the-job-title`** — Tell My Story replaces the user's real employment with "On Maternity Leave" as her job title — employer, dates and every duty are deleted, and the DOCX ships it  
*lens:* amputation · *site:* `src/lib/story-mode.ts:302` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> CONTROL -> title: "" company: "Brookvale House Since March 2016" dates: "" responsibilities: ""
> +maternity cover -> title: "On Maternity Leave" company: "" dates: "" responsibilities: ""
> +sick leave cover -> title: "I Picked Up The Shifts When My Manager Was On Sick Leave For Six Weeks" company: "" dates: "" responsibilities: "Picked Up The Shifts When My Manager Was On Sick Leave For Six Weeks"
> roles stored in her dossier: [{"title":"On Maternity Leave","employer":"","start":""}]
> --- word/document.xml ---
>   |Donna Marsh
>   |donna.marsh@example.com
>   |Professional Summary
>   |Senior Care Assistant candidate. Documentation.
>   |Experience
>   |On Maternity Leave
>   |Documentat

**`abbreviation-split-shreds-user-sentences`** — A period inside "St. Mary's" or "Dr. Okonjo" splits the sentence; the residue is printed as a bullet with an invented lead verb  
*lens:* amputation · *site:* `src/lib/generator.ts:966` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> typed  : I covered the ward at St. Mary's on a Sunday.
> typed  : I took the obs round with Dr. Okonjo and wrote up the charts.
> typed  : I ordered the stock from J. Sainsbury and checked it in myself.
> bullet : "Covered the ward at St, took the obs round with Dr, and ordered the stock from J."
> bullet : "Supported Mary's on a Sunday."
> bullet : "Okonjo and wrote up the charts."
> bullet : "Sainsbury and checked it in myself."

**`profile-role-record-loses-typed-duties`** — The user's own stored role record loses duties on every read, and the pruned copy is written back to disk  
*lens:* amputation · *site:* `src/lib/evidence-admissibility.ts:421` · *verification:* refute=SEVERITY_WRONG, reproduce=CONFIRMED  
> role.responsibilities kept: ["I do the medication round at seven and again at two."]
> dossier.responsibilities kept: 1 of 4
> unstructuredNotes: []
> migrationReview (the only user-facing note): []

**`founding-beta-meta-advertises-purchases`** — /founding-beta ships a meta description inviting people to buy, while commerce is off and the page body says "Not on sale"  
*lens:* commerce · *site:* `src/app/founding-beta/page.tsx:7` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> HTTP 200, and:
> <title>Founding Career Reset Cohort — Career Forge</title>
> <meta name="description" content="Join one of five founding Career Reset purchases: a one-time, one-lane Career Forge pack with guided onboarding and priority support."/>
> No <meta name="robots"> tag is emitted and /robots.txt returns 404, so the page is fully crawlable. The rendered BODY of the very same response says the opposite: "Planned packaging · Not on sale", "No purchases are enabled right now.", "Checkout is closed. This page describes how Career Reset is intended to be packaged — it is not an offer, and nothing on it can take payment today."

**`excluded-evidence-survives-in-saved-variant`** — A sentence the user EXCLUDED after generating a pack still ships in the exported DOCX, with export unblocked and the receipt reporting zero exclusions  
*lens:* evidence-gate · *site:* `src/lib/evidence-admissibility.ts:595` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> excluded by user: [ 'i was off on maternity leave for nine month and came back to a different ward' ]
> ats missingProvenance= 0 exportBlocked= false
> recruiter missingProvenance= 0 exportBlocked= false
> Priya-Raghunathan-Resume-Healthcare-Assistant-ATS.docx ["Healthcare Assistant candidate. Covered the whole ward on nights when we were down to two, twelve hour shifts. Off on maternity leave for nine month and came back to a different ward."]
> Priya-Raghunathan-Resume-Healthcare-Assistant-Recruiter.docx ["Covered the whole ward on nights when we were down to two, twelve hour shifts. Off on maternity leave for nine month and came back to a different ward. Got the trust award for the falls 

**`role-heading-bypasses-reader`** — role.employer / role.title / role.startDate print the withheld record's text into the exported DOCX and PDF while the same archive's receipt says the item was withheld  
*lens:* evidence-gate · *site:* `src/lib/resume-pack.ts:281` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> WITHHELD RECORD: role "Sales Assistant · The Body Shop — Meadowhall (store closed 2024) · 2018-2024" {"usable":false,"reason":"awaiting_review"}
> getUsableEvidenceForRole(role,'role') = []
> Sharon-Ekwueme-Resume-Retail-Supervisor-ATS.docx "Sales Assistant | The Body Shop — Meadowhall (store closed 2024) | 2018-2024"
> Sharon-Ekwueme-Resume-Retail-Supervisor-ATS.pdf "Sales Assistant | The Body Shop  Meadowhall \\(store closed 2024\\) | 2018-2024"
> Sharon-Ekwueme-Resume-Retail-Supervisor-Recruiter.docx "Sales Assistant | The Body Shop — Meadowhall (store closed 2024) | 2018-2024"
> Sharon-Ekwueme-Resume-Retail-Supervisor-Recruiter.pdf "Sales Assistant | The Body Shop  Meadowhall \\(store cl

**`intake-employer-and-title-fields-exempt-from-gate`** — NON_EVIDENCE_INTAKE_FIELDS exempts currentTitle/currentCompany/previousTitle/previousCompany/additionalTitle/additionalCompany, so a separation typed in the employer box prints verbatim on the builder résumé and its "Copy full resume" output  
*lens:* evidence-gate · *site:* `src/lib/evidence-read.ts:290` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> possibleDisclosure(currentCompany) = {"reason":"separation"}
> gated.currentCompany : "Wincanton (agency, until my position was cut)"
> gated.previousCompany: "DHL — laid off when the site shut"
> gated.currentTime    : "2019-2025"
> ...
> EXPERIENCE
> Warehouse Operative | Wincanton (agency, Until My Position Was Cut) | 2019-2025
> - Loaded the cages and ran the goods-in bay and kept the pick face topped up to support picked 900 lines a shift on nights.
> - Picked 900 lines a shift on nights.
> 
> Picker | Dhl — Laid Off When The Site Shut | 2016-2019

**`pdf-non-cp1252-corruption`** — PDF export garbles every string containing a character outside CP1252 — including the user's own name — while the DOCX in the same ZIP is correct  
*lens:* exports · *site:* `src/lib/pack-export.ts:175` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> PDF font dictionary is `/BaseFont /Helvetica /Subtype /Type1 /Encoding /WinAnsiEncoding` — a simple font, no Type0/CMap anywhere in the file. jsPDF nevertheless emits any string containing a non-CP1252 character as UTF-16BE bytes.
> 
> Input `"Nguyễn Thị Hương"` (U+004E U+0067 U+0075 U+0079 U+1EC5 U+006E U+0020 U+0054 U+0068 U+1ECB U+0020 U+0048 U+01B0 U+01A1 U+006E U+0067).
> Raw first `Tj` operand, read as latin1: `" N g u yÅ n   T hË   H°¡ n g"`.
> pdf.js renders the title line as three items: `"N g u y Å n"`, `"T h Ë"`, `"H ° ¡ n g"`.
> 
> The DOCX built from the identical dossier in the SAME ZIP is correct: `Nguyen-Thi-Huong-Resume-Salon-Manager-ATS.docx` → `word/document.xml` first

**`termination-reason-ships-in-role-dates`** — A termination reason typed into the résumé's dates field prints verbatim in the delivered DOCX, PDF and clipboard text, and the archive README reports "refused: 0"  
*lens:* exports · *site:* `src/lib/evidence-admissibility.ts:530` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> `containsTerminationReason(TYPED)` = `true`. `classifyEvidenceAdmissibility(TYPED)` = `"separation_reason"`.
> `sanitizeResumeForProfessionalUse(resume).experience[0].time` returns the string UNCHANGED — the function sanitizes `title`, `company`, `bullets`, `summary`, `education`, `linkedinHeadline`, `linkedinSummary`, and never touches `time`.
> 
> Delivered `Marie-Whelan-Resume-Catering-Assistant-ATS.docx`, `word/document.xml` run [5]:
>   `Kitchen Assistant | Bayside Nursing Home | 2011 to 2014, until my position was cut because I raised the fridge temperature log`
> 
> Delivered `Marie-Whelan-Resume-Catering-Assistant-ATS.pdf`, Tj operands [6] and [7]:
>   `Kitchen Assistant | Bayside Nu

**`employer-amputated-when-bullets-inadmissible`** — An entire employer, job title and three years of dates are deleted from the delivered DOCX and PDF when that role's only bullet is classified non-claim — silently, with the receipt reporting nothing withheld  
*lens:* exports · *site:* `src/lib/evidence-admissibility.ts:538` · *verification:* reproduce=CONFIRMED, refute=CONFIRMED  
> After the edit the app's variant still holds the role, and this is what the editor shows the user:
>   `[1] ["Kitchen Assistant","Bayside Nursing Home","2011–2014"] bullets=["I dont really know how many covers we did, it was just constant from 7 in the morning"]`
> 
> The delivered `Marie-Whelan-Resume-Catering-Supervisor-ATS.docx` `word/document.xml` contains only:
>   `[4] Experience`
>   `[5] Catering Supervisor | St Brigid's Community School | 2014–2025`
>   `[6] Run the hot counter on my own from 11 til half one, roughly 300 dinners`
> 
> `'Bayside Nursing Home' in app variant: true` / `in DOCX: false` / `in PDF: false`; `'Kitchen Assistant' in DOCX: false`. The job title, the employer 

**`fabrication-we-stripped-team-credit`** — Leading "we" is deleted from every bullet, converting a team accomplishment into a personal claim  
*lens:* fabrication · *site:* `src/lib/resume-intelligence.ts:121` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> Unit level:
> "we hit 98% on the audit that year" -> "Hit 98% on the audit that year."
> "We recovered £14,000 of unbilled work." -> "Recovered £14,000 of unbilled work."
> "we rebuilt the whole filing system over one weekend" -> "Rebuilt the whole filing system over one weekend."
> 
> End to end, user typed outcomes "we won the site award for least downtime in 2022"; the shipped PDF content stream contains the Tj literal:
> "  Won the site award for least downtime in 2022."
> and word/document.xml paragraph [7] is "Won the site award for least downtime in 2022."

**`fabrication-third-party-work-credited`** — Work the user explicitly attributed to someone else is printed as their experience bullet and asserted as their strength  
*lens:* fabrication · *site:* `src/lib/generator.ts:2276` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> Shipped DOCX word/document.xml for the care-worker fixture:
> [2] "Care Assistant. Brings look after Mrs Patel three mornings a week, getting her washed and dressed and her breakfast, the night crew kept the care notes for me because i'm not great with the computer, and do the tea round on the top floor with a transition focus toward Care Assistant roles."
> [6] "The night crew kept the care notes for me because i'm not great with the computer."   <- an EXPERIENCE bullet under "Care Assistant | Bramblewood Residential"
> 
> linkedinSummary: "Care Assistant candidate. Strongest reported areas include look after Mrs Patel three mornings a week, ..., the night crew kept the care notes for me be

**`fabrication-question-becomes-declarative-claim`** — A question typed by the user is stripped of its "?" and printed as a declarative résumé bullet and summary claim (keyword laundering)  
*lens:* fabrication · *site:* `src/lib/generator.ts:2276` · *verification:* reproduce=CONFIRMED, refute=CONFIRMED  
> User typed: "Does this need Sage Payroll experience? I only ever printed the picking notes and filed the delivery dockets. Am I supposed to say I can do SAP?"
> 
> Shipped PDF content-stream Tj literals:
> <7> "  Does this need Sage Payroll experience."
> <9> "  Am I supposed to say I can do SAP."
> <2>/<3>/<4> "Warehouse Admin. Brings Does this need Sage Payroll experience, only ever printed the picking notes and filed the delivery dockets, and Am I supposed to say I can do SAP with a transition focus toward Payroll Administrator roles."
> The "?" is gone in every case, replaced by ".".
> 
> Second fixture, user typed the literal string "Active Directory?":
> coreSkills: ["Active Directory"

**`fabrication-supported-tools-duty`** — The "Supported … with <tools>" template invents a performed duty using tools the user never described using  
*lens:* fabrication · *site:* `src/lib/generator.ts:2083` · *verification:* refute=REFUTED, reproduce=CONFIRMED  
> User is a cleaner whose entire description of the job is "I hoover the offices and empty the bins after everyone's gone home. that's the whole job."
> 
> Shipped PDF content-stream Tj literal:
> <8> "  Supported that's the whole job with Sap and Excel."
> DOCX word/document.xml paragraph [7]: "Supported that's the whole job with Sap and Excel."
> CORE SKILLS section in both files: "that's the whole job | Forklift | Pallet Truck | Sap | Excel"
> linkedinHeadline: "Cleaner | Warehouse Associate | Forklift, Pallet Truck, Sap"
> 
> Same template on the other fixture: "Supported Active Directory." and "Supported Stock control."

**`amputation-weakterms-deletes-sentence-objects`** — The words "stuff", "things" and "various" are deleted mid-sentence, destroying the object of the user's verb  
*lens:* fabrication · *site:* `src/lib/resume-intelligence.ts:122` · *verification:* reproduce=CONFIRMED, refute=CONFIRMED  
> "helped people find stuff on the shop floor" -> "Helped people find on the shop floor."
> "I sorted things out when the machines jammed" -> "Sorted out when the machines jammed."
> "we packed all the christmas stuff into the container" -> "Packed all the christmas into the container."
> "I covered various sites across the north east" -> "Covered sites across the north east."
> 
> Shipped PDF content-stream Tj literal:
> <8> "  What I did was help people find on the shop floor and I sorted out when a delivery came in wrong."
> DOCX word/document.xml paragraph [6]: identical.
> User had written: "What I did was help people find stuff on the shop floor and I sorted things out when a delivery ca

**`fabrication-competency-from-denial`** — Tell My Story mints competencies from words that mean the opposite, and they ship in the DOCX as résumé bullets  
*lens:* journeys · *site:* `src/lib/story-mode.ts:378` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> selectedOutcomes: ["Safety Awareness"]
> 
> Decoded word/document.xml of Denise-Okafor-Resume-Caretaker-ATS.docx:
>   |Professional Summary
>   |Caretaker candidate. Mop and buff 12 offices, 2 stairwells and 6 toilets every night and lock up on my own. Safety Awareness.
>   |Core Skills
>   |Mop
>   |Experience
>   |Cleaner | Sparkle Facilities | 2019 to now
>   |Safety Awareness
>   |Mop and buff 12 offices, 2 stairwells and 6 toilets every night and lock up on my own
> CONTAINS 'Safety Awareness': true
> 
> Groundworker case: coreSkills: ["Documentation"], plain-text export CORE SKILLS line reads "Documentation".

**`disclosure-printed-under-education`** — A user's statement that they were never trained is printed under the EDUCATION heading of the shipped DOCX  
*lens:* journeys · *site:* `src/lib/story-mode.ts:366` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> Decoded word/document.xml, final run:
>   |Education
>   |Nobody Has Ever Given Me Any Safety Training, They Handed Me The Mop On Day One And Said Get On With IT I Want A Job As A Caretaker At A School
> 
> Plain-text export:
> EDUCATION
> Nobody Has Ever Given Me Any Safety Training, They Handed Me The Mop On Day One And Said Get On With IT I Want A Job As A Caretaker At A School

**`identity-kind-bypasses-point-of-read-gate`** — REVIEWABLE_KINDS exempts identity/goal/constraint, so a health disclosure the guard flags passes the gate and prints in the DOCX and PDF  
*lens:* journeys · *site:* `src/lib/evidence-read.ts:118` · *verification:* refute=REFUTED, reproduce=CONFIRMED  
> possibleDisclosure: {"reason":"health"}
> responsibility {"usable":false,"reason":"unreviewed_disclosure"}
> identity     {"usable":true,"reason":"ok"}
> goal         {"usable":true,"reason":"ok"}
> constraint   {"usable":true,"reason":"ok"}
> pendingReviews: []
> identity.phone = "Career break 2019 - 2021  ·  I had to care for my mother after her stroke"
> 
> Decoded word/document.xml:
>   |Marta Kowalczyk
>   |marta.kowalczyk91@gmail.com | Career break 2019 - 2021  ·  I had to care for my mother after her stroke
> DOCX CONTAINS 'stroke': true
> 
> Decoded PDF Tj operands of the ATS PDF, same line, PDF STREAM CONTAINS 'stroke': true

**`import-routes-job-title-into-phone`** — Résumé import writes a job title (or a career-gap sentence) into identity.phone; it prints in the contact line and the current job disappears  
*lens:* journeys · *site:* `src/lib/dossier.ts:809` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> identity.email = "Nuneaton, Warwickshire  ·  darren.oconnell88@gmail.com  ·  07812 445 901"
> identity.phone = "GOODS IN / OUT OPERATIVE (FLT B1 & B2)      Jan 2021 - present"
> 
> Decoded word/document.xml, contact line of DARREN-O-CONNELL-Resume-Warehouse-Team-Leader-ATS.docx:
>   |Nuneaton, Warwickshire  ·  darren.oconnell88@gmail.com  ·  07812 445 901 | GOODS IN / OUT OPERATIVE (FLT B1 &amp; B2)      Jan 2021 - present | linkedin.com/in/darrenoc88
> 
> The same line is in the PDF content stream. The Experience section of both documents contains no DHL entry at all.
> 
> With the same code and a shorter CV where the gap sentence is the first phone-ish match, identity.phone = "(gap 2019-20

**`import-prints-certificate-as-employer`** — Import prints a forklift certificate as an employer with a skills line as its bullet, and the two most recent jobs are absent from the export  
*lens:* journeys · *site:* `src/lib/dossier.ts:726` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> Decoded word/document.xml of DARREN-O-CONNELL-Resume-Warehouse-Team-Leader-ATS.docx:
>   |Experience
>   |CUSTOMER ASSISTANT   May 2013 - Aug 2016
>   |Tesco Extra, Bedworth
>   |· Checkouts, shelf stacking, some cash office
>   |FLT Counterbalance &amp; Reach - RTITB 2017, renewed 2024
>   |RF scanner, MHE, SAP (basic), Health &amp; Safety, Manual Handling
>   |Selected accomplishments
>   |Reliable and hardworking. 11 yrs experience in warehousing and distribution, looking for a step up into a team leader position
>   |DHL Supply Chain (contract for Sainsbury's), Rugby DC
>   |· was on the pick face til they moved me to goods in, now I book in the wagons and check the pallets off against t

**`story-mode-discards-the-story`** — Tell My Story deletes almost the entire narrative and writes a sentence fragment into the dossier as the user's job title  
*lens:* journeys · *site:* `src/lib/story-mode.ts:445` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> ### coop {"currentTitle":"T Greggs For A Bit","currentCompany":"","targetJobTitle":"Administrative Assistant","responsibilities":""}
> SUMMARY
> T Greggs For A Bit. Brings hands-on work experience with a transition focus toward Administrative Assistant roles.
> EXPERIENCE
> T Greggs For A Bit | Current Company | Dates
> 
> ### decorator {"currentTitle":"For Two Letting Agents","currentCompany":"","targetJobTitle":"Something Employed Now Because My Knees Are Going","responsibilities":""}
> EXPERIENCE
> For Two Letting Agents | Current Company | Dates
> 
> ### hca {"currentTitle":"","currentCompany":"The Royal, Mostly On The Elderly Care Wards","targetJobTitle":"Permanent Contract On One Ward 

**`editproject-destroys-description-text`** — Editing a project description on /profile destroys the user's text at save time — it is deleted, not withheld, and exists nowhere on disk  
*lens:* persistence · *site:* `src/lib/evidence-admissibility.ts:432` · *verification:* refute=CONFIRMED  
> after addProject  : "ran it every Saturday for two years"
> after editProject : ""
> after reload      : ""
> D2 on disk at all : false
> evidence details  : ["Saturday craft club · St Peter’s · 2022-2024 · ran it every Saturday for two years"]
> A sweep of five realistic descriptions through the same loop shows two of five destroyed: "I had no budget so I did the whole thing myself out of my own pocket" -> stored as "", text anywhere on disk: false; "I set it up from scratch, there was no system before me and no training" -> stored as "", false. The other three survive.
> The same function also deletes the ENTIRE project record when `name` blanks out (`if (!name) return []`, evidence-admiss

**`false-withheld-facts-notice`** — "1 fact withheld (reason for leaving) — deliberately kept out of every copy and export" is false, and the reason is invented  
*lens:* trust-surfaces · *site:* `src/lib/pack-export.ts:51` · *verification:* reproduce=CONFIRMED, refute=CONFIRMED  
> exportSections(...).withheldFacts = ["reason for leaving"]  (for BOTH the ats and recruiter variants)
> → /versions renders: "1 fact withheld (reason for leaving) — deliberately kept out of every copy and export."
> 
> Decoded bytes of every copy and export:
>   ATS DOCX word/document.xml <w:t> → "The store was reorganised and I ended up running the back office on my own for six months"
>   ATS PDF Tj → "  The store was reorganised and I ended up running the back office on my own for six months"
>   Recruiter DOCX and Recruiter PDF: same, present.
>   variantPlainText (the Copy button) also emits it in PROFESSIONAL SUMMARY and as a bullet.
> 
> The stated reason is also invented. Shaun's sen

**`excluded-disclosure-ships-in-materials`** — A disclosure the user EXCLUDED after generation ships verbatim in the delivered LinkedIn-and-Career-Materials.txt  
*lens:* trust-surfaces · *site:* `src/lib/pack-export.ts:260` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> reader: {"usable":false,"reason":"excluded_by_user"}
> getUserExcludedEvidence: [ 'e-cover' ]
> packExportBlocked = false          ← the ZIP export button is enabled
> 
> LinkedIn-and-Career-Materials.txt, as delivered inside the ZIP:
>   MASTER PROOF BANK
>   - Covered my managers job for 3 month while she was on maternity leave and I kept the rota going the whole time
>   - We went from 3 people short every week to none by the summer
> 
> The SAME file's sibling block is correctly gated — "APPROVED PROFESSIONAL EVIDENCE FOR COVER-LETTER DRAFTING" does not list it, because that block was migrated to getUsableEvidenceForGeneration (pack-export.ts:241) while the MASTER PROOF BANK block (pack-


### P1 — 14 finding(s)

**`keep-does-not-restore-two-sentence-line`** — Pressing Keep on a review card does not restore the sentence when it shares a line with another sentence — it is deleted anyway, and the card disappears  
*lens:* amputation · *site:* `src/lib/evidence-read.ts:325` · *verification:* refute=SEVERITY_WRONG, reproduce=CONFIRMED  
> review card shows: ["I do the medication round at seven and again at two. I covered the ward myself when Shona was on maternity leave."]
> after KEEP, disclosureApproved: ["I do the medication round at seven and again at two. I covered the ward myself when Shona was on maternity leave."]
> after getUsableIntake: "I do the medication round at seven and again at two."
> bullets: ["Do the medication round at seven and again at two."]
> still pending: 0

**`receipt-names-a-false-reason-for-the-omission`** — The pack receipt tells the user a care duty was withheld as a "reason for leaving a role"  
*lens:* amputation · *site:* `src/lib/resume-pack.ts:24` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> classify s1: separation_reason | classify s2: constraint
> receipt.unsupportedClaimsRefused: [
>  "Reason for leaving a role (never résumé content)",
>  "Constraint (never résumé content)"
> ]

**`checkout-no-stripe-key-mode-gate`** — /api/checkout never checks the Stripe key mode: commerce mode "test" with a live secret key opens a real chargeable Checkout Session while the page promises "no real charge"  
*lens:* commerce · *site:* `src/app/api/checkout/route.ts:87` · *verification:* reproduce=CONFIRMED, refute=CONFIRMED  
> route http=502 time=0.135519s  ->  {"error":"Stripe rejected the checkout request."}
> direct-stripe http=401 time=0.163775s  ->  {"error":{"message":"Invalid API Key provided: sk_live_**************************AAAA"}}
> key removed: route http=503 time=0.021015s -> {"error":"Payments are not configured on this deployment."}
> and /pricing renders: "Test mode. Checkout uses Stripe test cards and creates no real charge." alongside live "Get the …" buttons at $49 once / $79 once / $99 once.
> The 502 body is only produced after `createCheckoutSession` receives an HTTP response from https://api.stripe.com/v1/checkout/sessions, and its 135 ms matches the 163 ms direct round trip while the no-key

**`reviewable-kinds-omits-constraint-and-goal`** — REVIEWABLE_KINDS excludes constraint/goal/identity, so an unreviewed health or separation disclosure on those kinds is eligible, never queued for review, and prints into an employer application answer  
*lens:* evidence-gate · *site:* `src/lib/evidence-read.ts:57` · *verification:* refute=SEVERITY_WRONG, reproduce=CONFIRMED  
> ROUTE A:
> constraint  {"usable":true,"reason":"ok"} "I can't do nights any more, I'm on medication for my own hea"
> goal        {"usable":true,"reason":"ok"} "I got made redundant in March when they shut the home down. "
> review queue: []
> possibleDisclosure(constraint) = {"reason":"health"}
> ANSWER: My approved dossier records: I can't do nights any more, I'm on medication for my own health and it knocks me right out.. I would verify that this directly answers the question before submitting.
> 
> ROUTE B:
> constraint  {"usable":true,"reason":"ok"} "Note for the agency: I am not available for early turns, I w"
> constraint  {"usable":true,"reason":"ok"} "Left the company because my hou

**`exclude-plus-edit-is-invisible-and-unrecoverable`** — exclude + later text edit falls between getUserExcludedEvidence and getPendingReviews: the record is withheld forever, cannot be re-reviewed, and the pack receipt reports zero withheld items  
*lens:* evidence-gate · *site:* `src/lib/evidence-read.ts:130` · *verification:* refute=SEVERITY_WRONG, reproduce=CONFIRMED  
> after exclude -> excluded: 1 pending: 0
> eligibility: {"usable":false,"reason":"excluded_by_user"}
> getUserExcludedEvidence: 0
> getPendingReviews      : 0
> pendingDisclosureReviews: 0
> receipt excluded/awaiting/refused: 0 0 []
> bullets: ["The head teacher put me forward for the trust award in 2024 for helping with the breakfast club","Clean two floors and the hall on me own, 6 til 9 every morning before the kids come in"]
> 
> In the full run I also exported the pack: word/document.xml contains no run with "trained the two new starters", the PDF Tj operators contain none, and README.txt says "Unsupported or context-only claims refused: 0".

**`curly-apostrophe-financial-disclosure-not-flagged`** — A financial disclosure typed with a smart apostrophe ("couldn’t afford") is never flagged, is eligible, and prints as a résumé bullet in the exported DOCX — its straight-apostrophe twin is correctly withheld  
*lens:* evidence-gate · *site:* `src/lib/truth-guards.ts:210` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> straight: {"reason":"financial"}  curly: null
> review queue: []
> eligibility : {"usable":true,"reason":"ok"}
> Nadia-Hussain-Resume-Care-Assistant-ATS.docx ["Care Assistant candidate. Look after Mrs Patel three mornings a week, wash and breakfast and her tablets. Couldn’t afford the childcare so I dropped to three days.","Couldn’t afford the childcare so I dropped to three days"]
> Nadia-Hussain-Resume-Care-Assistant-Recruiter.docx ["Care Assistant candidate...","Couldn’t afford the childcare so I dropped to three days"]
> receipt awaiting/excluded: 0 0

**`keep-does-not-restore-a-withheld-intake-field`** — Resolving KEEP does not restore a withheld intake field: the user's employment dates are withheld permanently and the résumé prints the literal placeholder "Dates"  
*lens:* evidence-gate · *site:* `src/lib/evidence-read.ts:303` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> flagged: [ 'Sales Assistant · The Body Shop · March 2019 to Nov 2025, left because the store closed' ]
> all eligible after keep: true
> disclosureApproved: ["Sales Assistant · The Body Shop · March 2019 to Nov 2025, left because the store closed"]
> getUsableIntake.currentTime: ""
> résumé experience: [["Sales Assistant","The Body Shop","Dates"]]

**`careergoals-pool-ungated-into-outreach-message`** — dossier.careerGoals and targetRoleInterests are ungated denormalized pools; a legacy user's separation/financial disclosure is substituted into the outreach message they send to a stranger and restated as their target roles  
*lens:* evidence-gate · *site:* `src/lib/dossier.ts:339` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> profile.currentSituation: "Company folded in January, I've been signing on since and doing a bit of cash work for me brother-in-law."
> profile.targetRoles     : "Warehouse operative, Company folded in January, I've been signing on since and doing a bit of cash work for me brother-in-law."
> 
> Hi Priya — I'm moving toward Warehouse Operative work from Company folded in January, I've been signing on since and doing a bit of cash work for me brother-in-law., and your path at DHL Doncaster stood out because you started on the floor too.

**`readme-refused-count-is-array-length`** — README.txt reports "Unsupported or context-only claims refused: 2" when nine of the user's records were withheld — the number is a count of summary sentences, not of claims  
*lens:* exports · *site:* `src/lib/pack-export.ts:285` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> Ground truth from the canonical reader on the same dossier:
>   `getPendingReviews(dossier).length      = 6`
>   `getUserExcludedEvidence(dossier).length= 3`  → 9 records withheld from the documents
>   `receipt.itemsAwaitingReview = 6`, `receipt.itemsExcludedByUser = 3`
>   `receipt.unsupportedClaimsRefused = ["3 item(s) excluded by you after review", "6 item(s) still awaiting your review"]`
> 
> The delivered README.txt says, verbatim:
> ```
> Evidence receipt:
> - Approved professional evidence used: 2
> - Approved professional evidence not used by these documents: 0
> - Unsupported or context-only claims refused: 2
> ```
> `README says 'awaiting'? false   says 'excluded'? false`
> 
> So 

**`fabrication-aspiration-printed-as-experience`** — A stated aspiration is printed as an Experience bullet and asserted as one of the candidate's "strongest reported areas"  
*lens:* fabrication · *site:* `src/lib/generator.ts:2329` · *verification:* refute=SEVERITY_WRONG, reproduce=CONFIRMED  
> Shipped DOCX word/document.xml, Experience section under "Dental Nurse | Riverbank Dental | 2019 - 2025":
> [7] "One day I'd like to move into managing a practice myself."
> Same string as PDF Tj literal <9> "  One day I'd like to move into managing a practice myself."
> 
> linkedinSummary: "Practice Manager candidate. Strongest reported areas include the practice manager did all the rotas and the invoicing, set up the surgery and passed instruments and cleaned the room between patients, and one day I'd like to move into managing a practice myself."
> 
> Other fixtures:
> BULLET: "Hoping to learn Excel at some point, everyone says you need it."  (printed as the FIRST bullet, above the actual

**`disclosure-education-prints-raw-prose`** — The Education section prints raw personal prose — failed exams, abandoned courses, mental-health and childbirth disclosures — as credential entries  
*lens:* fabrication · *site:* `src/lib/truth-guards.ts:208` · *verification:* reproduce=CONFIRMED, refute=SEVERITY_WRONG  
> possibleDisclosure returns a flag for exactly one phrasing and null for every other real-world phrasing of the same class:
> "Dropped out of the plumbing diploma after the first term." -> {"reason":"education"}   (withheld, correct)
> "Also failed my gas safe exam twice." -> null
> "I never finished my GCSEs." -> null
> "enrolled on a CIPD course, had to quit when my mum got ill." -> null
> "I had to stop my course because of my anxiety." -> null
> "Left college when I had my daughter." -> null
> 
> Shipped DOCX word/document.xml, Education section:
> [7] "I Had To Stop My Course Because Of My Anxiety. Left College When I Had My Daughter. Failed The Maths Resit Three Times"
> Same text as PD

**`fabrication-invented-causation-to-support`** — The generator welds two unrelated user sentences together with "to support", inventing a causal claim  
*lens:* fabrication · *site:* `src/lib/generator.ts:2077` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> Shipped DOCX word/document.xml paragraph [5] / PDF Tj literals <6>+<7>:
> "Ran the packing line as a team of six and brought the reject rate down from 4% to under 1% over about a year to support we won the site award for least downtime in 2022."
> 
> The user wrote three independent sentences about duties and, separately, one outcome sentence. They never said the line work was done in order to win the award. The clause is also ungrammatical ("to support we won the site award") because the outcome string is a full clause, not a noun phrase.

**`reload-duplicates-bullets-and-drops-a-sentence`** — The same account, reloaded and regenerated with no edits, produces a résumé whose first bullet duplicates the next two verbatim  
*lens:* journeys · *site:* `src/lib/dossier.ts:637` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> S1 [
>  "Look after Mrs Patel three mornings a week, get her washed and dressed, do her breakfast and sort her tablets out of the blister pack.",
>  "Do the shopping for two other clients on the same round and write everything in the folder they keep in the hallway.",
>  "When the district nurse comes I tell her what's changed."
> ]
> S2 [
>  "Look after Mrs Patel three mornings a week, get her washed and dressed, do her breakfast and sort her tablets out of the blister pack. I do the shopping for two other clients on the same round and write everything in the folder they keep in the hallway. When the district nurse comes I tell her what's changed.",
>  "Look after Mrs Patel three mornings a

**`readme-refusal-undercount`** — Delivered README.txt reports "Unsupported or context-only claims refused: 0" while an item was excluded by the user and is in the archive  
*lens:* trust-surfaces · *site:* `src/lib/pack-export.ts:285` · *verification:* refute=SEVERITY_WRONG, reproduce=CONFIRMED  
> README.txt, verbatim from inside the delivered ZIP:
> 
>   Evidence receipt:
>   - Approved professional evidence used: 3
>   - Approved professional evidence not used by these documents: 1
>   - Unsupported or context-only claims refused: 0
> 
> At the moment that file was written: `getUserExcludedEvidence(dossier)` = ['e-cover'] (1 item), `evidenceEligibility` = {usable:false, reason:"excluded_by_user"}, and that item's text is printed in full in LinkedIn-and-Career-Materials.txt in the same ZIP.
> 
> Stored receipt fields: itemsExcludedByUser = 0, itemsAwaitingReview = 0, unsupportedClaimsRefused = [] — all correct for T0, all stale at T1, and the README presents them under the unqualifie


### P2 — 6 finding(s)

**`three-bullet-cap-silently-discards-typed-duties`** — Only the first three typed responsibilities ever become bullets; the rest are discarded with no indication  
*lens:* amputation · *site:* `src/lib/generator.ts:2085` · *verification:* refute=CONFIRMED  
> 6 typed -> 3 bullets
>   - Look after the residents on the memory floor, mostly the ones who wander at night.
>   - Do the medication round at seven and again at two.
>   - Sign the MAR chart for every one of them.
> 
> The handover duty, the laundry duty and the daily-notes duty are absent. Running the same three sentences alone produces all three, so the loss is positional, not content-based.

**`founding-beta-ignores-sell-verdict`** — In live mode /founding-beta asserts "Secure checkout is live" and offers a buy CTA while /api/checkout is returning 503 fulfillment_not_ready and /pricing correctly says checkout is closed  
*lens:* commerce · *site:* `src/app/founding-beta/page.tsx:18` · *verification:* reproduce=CONFIRMED, refute=SEVERITY_WRONG  
> POST /api/checkout -> {"error":"Checkout is temporarily closed. This deployment cannot guarantee delivery of a purchase yet, so it will not take payment.","code":"fulfillment_not_ready"}
> /pricing -> "Paid beta paused · Checkout closed while I verify delivery"
> /founding-beta (same deployment, same moment) -> "Founding paid beta · Five purchases", "Start Career Reset →", "Secure checkout charges $49 once. Career Reset is the only paid tier in the founding beta, and checkout closes after five completed purchases.", "Founding price $ 49 one time ·", "Secure checkout is live."

**`interview-capped-copy-false-when-free`** — The interview prep page tells users the conversational intake is "capped" when, with commerce off, there is no cap at all  
*lens:* commerce · *site:* `src/components/InterviewPrep.tsx:244` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> All 9 answers accepted. Every turn logged: placeholder="Type naturally. I'll translate it.", taDisabled=false, previewMeter=false, lockedPanel=false. The 6-answer meter, the "Beta preview limit reached." placeholder and the "Preview limit reached" panel never appear. Meanwhile the prep page it came from still renders: "Opens the capped résumé-building intake. This prep page is the uncapped practice tool."

**`filename-slug-erases-non-latin-names`** — Résumé and ZIP filenames drop non-Latin names entirely — a user named 王小明 downloads "Career-Forge-User-Resume-Pack.zip"  
*lens:* exports · *site:* `src/lib/pack-export.ts:126` · *verification:* refute=CONFIRMED, reproduce=CONFIRMED  
> ```
> "Donna Okonkwo"              -> Donna-Okonkwo-Resume-Pack.zip
> "José Muñoz"                 -> Jose-Munoz-Resume-Pack.zip
> "Łukasz Wójcik"              -> ukasz-Wojcik-Resume-Pack.zip
> "Ngũgĩ wa Thiong'o"          -> Ngugi-wa-Thiong-o-Resume-Pack.zip
> "王小明"                       -> Career-Forge-User-Resume-Pack.zip
> "Олена Ковальчук"            -> Career-Forge-User-Resume-Pack.zip
> "محمد الأحمد"                 -> Career-Forge-User-Resume-Pack.zip
> ```
> `slug()` does `.normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[^a-zA-Z0-9]+/g,"-")`. NFKD strips combining marks, so Latin-with-diacritics survives; characters with no Latin decomposition (Ł) are deleted outright, and scripts 

**`story-mode-cannot-generate`** — Tell My Story never enables its Generate button — the follow-up question repeats forever and filling every editable field does not unlock it  
*lens:* journeys · *site:* `src/components/TellMyStoryMode.tsx:70` · *verification:* refute=SEVERITY_WRONG, reproduce=CONFIRMED  
> r1 canGenerate=false
> r2 canGenerate=false followUp="What was your most recent role or real work experience?"
> r3 canGenerate=false followUp="What kind of work did that role mostly involve: customer-facing, operations, admin, technical support, sales, coordination, compliance, or something else?"
> r4 canGenerate=false followUp="What kind of work did that role mostly involve: customer-facing, operations, admin, technical support, sales, coordination, compliance, or something else?"
> r5 canGenerate=false followUp=(identical)
> r6 canGenerate=false followUp=(identical)
> r7 canGenerate=false followUp=(identical)
> r8 canGenerate=false followUp=(identical)
> after Edit details canGenerate= f

**`fabricated-withholding-receipt`** — Pack receipt reports a withholding that never happens — the "withheld" sentence ships in all four documents  
*lens:* trust-surfaces · *site:* `src/lib/resume-pack.ts:541` · *verification:* refute=SEVERITY_WRONG, reproduce=CONFIRMED  
> receipt.generatedSentencesWithheld = 2
> receipt.unsupportedClaimsRefused = ["1 generated sentence withheld during export review (your evidence was not changed)"]
> (/versions renders that string under the heading "Claims Career Forge refused to generate"; README.txt in the ZIP renders "- Unsupported or context-only claims refused: 1")
> 
> Decoded delivered files — the sentence the receipt says was withheld is present in ALL of them:
>   Shaun-Kelleher-Resume-Retail-operations-ATS.docx  [word/document.xml] contains 'reorganised': true
>      <w:t> → "Retail operations candidate. The store was reorganised and I ended up running the back office on my own for six months. Did the cash up every 

---

## 4. Fabrication report

**Fabricated claims observed: 8 classes, all reproduced at artifact level.**

| The user's actual words | What the product asserted |
| --- | --- |
| "we hit 98% on the audit that year" | "Hit 98% on the audit that year." — sole credit |
| "the night crew kept the care notes for me" | printed as the candidate's own experience bullet and as a reported strength |
| "Does this need Sage Payroll experience? … Am I supposed to say I can do SAP?" | the `?` stripped, printed as a declarative bullet |
| "One day I'd like to move into managing a practice myself." | printed under **Experience** and called one of her "strongest reported areas" |
| "I hoover the offices and empty the bins after everyone's gone home. that's the whole job." | "Supported that's the whole job…" — an invented duty, using tools never mentioned |
| a sentence stating she was **never trained** on something | minted into a competency and shipped as a bullet |
| two unrelated sentences | welded with "to support", inventing a causal claim |
| default `roleFamily` (never chosen by the user) | asserted as experience |

The occupation-template retirement did remove the *template* fabrication class. These are different mechanisms — voice normalization, story-mode competency mining, and sentence fusion — in different files.

## 5. Amputation report

**True user content deleted: 7 classes.** This is the class a green suite hides best, and it is the more dangerous half here because the user cannot see it happen.

- An **entire employer** — name, title, three years of dates — deleted from the delivered DOCX and PDF when that role's only bullet is classified non-claim. The receipt reports nothing withheld.
- The **preview shows a complete résumé; the saved version has no experience at all.**
- `"stuff"`, `"things"`, `"various"` deleted mid-sentence, destroying the object of the verb.
- `"St. Mary's"` and `"Dr. Okonjo"` split the sentence at the abbreviation's period; the residue is printed as a bullet **with an invented lead verb**.
- Tell My Story replaces a woman's real employment with `"On Maternity Leave"` **as her job title**, deleting employer, dates and every duty.
- Editing a project description on `/profile` destroys the text at save time — deleted, not withheld; it exists nowhere on disk.
- The user's stored role record loses duties on every read, and the pruned copy is **written back to disk**.

## 6. Export certification

Decoded, not inferred: DOCX `word/document.xml`, PDF content streams, ZIP entry lists, plain-text and clipboard paths.

**The formats do not agree**, which is itself a finding:

- **PDF garbles every string containing a character outside CP1252 — including the user's own name — while the DOCX in the same archive is correct.** UTF-16 text pushed through a WinAnsi encoder.
- Filenames drop non-Latin names entirely: a user named 王小明 downloads `Career-Forge-User-Resume-Pack.zip`.
- The archive's `README.txt` contradicts its siblings: it reports `refused: 0` while an item the user excluded is printed verbatim in `LinkedIn-and-Career-Materials.txt` in the same ZIP.
- The "refused" number is an array length of summary sentences, not a count of claims — it read `2` when nine of the user's records had been withheld.

## 7. Verification integrity — read this before using the register

The run **hit the session limit** during the final verification wave. Consequences, stated plainly:

- **14 agents died**, including the completeness critic and the verdict writer. This document is assembled by me from the journal, not by the workflow.
- **16 findings were never verified.** They are listed below and are **not** counted in the 26/14. Do not treat them as confirmed — but note that two are P0-severity claims about excluded evidence surviving a re-forge into DOCX/PDF, which is the same class as several confirmed findings.
- **The refutation rate was 1 in 47.** That is low enough to be suspicious of rubber-stamping, which is why I reproduced three P0s independently before signing. All three held, and one was worse than reported. I did not independently check the other 43.

### Unverified — verifier died mid-run

- **[P0]** `editeducation-blanks-credential-then-revive-deletes-the-row` — Editing an education credential into an honest phrasing blanks it at save, and reviveDossier then deletes the whole education row on the next page load (`src/lib/evidence-admissibility.ts:450`)
- **[P0]** `excluded-disclosure-survives-reforge-into-docx-pdf` — A disclosure the user clicked "Exclude from résumé" is carried forward verbatim by preserveUserEditedVariants and ships in the exported DOCX and PDF (`src/lib/resume-pack.ts:579`)
- **[P1]** `acronym-corruption-in-education-and-skills` — Title-casing corrupts real qualification and product names in the Education and Core Skills sections (AAT -> Aat, GCSEs -> Gcses, SAP -> Sap) (`src/lib/education-intelligence.ts:282`)
- **[P1]** `default-rolefamily-asserted-as-experience` — generateResumePackage claims "customer success experience" for any intake with no experience role, from the default roleFamily the user never chose (`src/lib/generator.ts:2264`)
- **[P1]** `filler-fragment-printed-as-core-skill` — Conversational filler from the user's answer is printed under the CORE SKILLS heading as a competency (`src/lib/generator.ts:1135`)
- **[P1]** `pack-readme-receipt-misdescribes-the-documents` — The exported pack's README certifies an evidence receipt for documents that assert an employer the user never had (`src/lib/pack-export.ts:282`)
- **[P1]** `placeholder-company-and-dates-in-export` — The minimum submission the guided builder accepts ships literal "Current Company | Dates" placeholders in the EXPERIENCE section (`src/lib/generator.ts:2163`)
- **[P1]** `resume-version-notes-grow-without-bound-on-every-read` — Every saved résumé version's notes field gains " Needs review after evidence-safety update." on every single page read, forever — the guard sentinel never matches the text it appends (`src/lib/evidence-admissibility.ts:696`)
- **[P1]** `sanitize-drop-causes-unrelated-edit-to-reject-approved-evidence` — A duty sanitize quietly removes from role.responsibilities is auto-REJECTED the next time the user edits anything else on that role (`src/lib/evidence-admissibility.ts:421`)
- **[P2]** `job-analysis-misses-most-requirements` — Job-post analysis extracts 2 of 13 requirements, credits none of the ones the user meets, and tells them their profile is too thin (`src/lib/job-post-analyzer.ts:405`)
- **[P2]** `long-input-run-on-splice` — Sixty distinct duties collapse to two run-on bullets that splice three unrelated tasks into one sentence (`src/lib/generator.ts:2054`)
- **[P2]** `readiness-loop-single-job-user` — A user with one job and no numbers is told to add the work history they just added, forever (`src/lib/dossier.ts:667`)
- **[P2]** `saved-version-without-snapshot-loses-a-kept-sentence` — A saved résumé version that carries no snapshot is re-filtered with an empty approval set, deleting a sentence the user had kept (`src/lib/evidence-admissibility.ts:689`)
- **[P3]** `record-with-no-detail-passes-the-gate` — evidenceEligibility returns usable:true for a record with no `detail` field at all (`src/lib/evidence-read.ts:126`)
- **[P3]** `revive-drops-receipt-honesty-counters` — reviveResumePack silently drops the receipt's three withholding counters on every page load and on backup restore (`src/lib/command-center-store.ts:435`)
- **[P3]** `test-suite-rewrites-tracked-artifacts` — npm run test:unit rewrites tracked binary artifacts in docs/evidence, dirtying a frozen head (`scripts/migration-coverage-regression.mjs:1`)
### Refuted and thrown out

- **`snapshot-copy-bypasses-export-sanitizer`** — The /versions/view "Copy" button puts a separation-reason bullet on the clipboard that the DOCX, PDF and /versions "Copy" of the same saved résumé all withhold
  - *Thrown out:* I ran their script verbatim on frozen HEAD 8b3a613 and it reproduces exactly as quoted — their "observed" output is not misquoted:

```
separation bullet -> DOCX: false | /versions Copy: false | /versions/view Copy: true
separation DATES  -> DOCX: true | /versions Copy: true | /versions/view Copy: t | MY ROUTE (not the reporter's): I ignored the reported repro and instead tested the underlying property directly — take ONE saved résumé, push it through all five delivery surfaces, and decode the real artifacts. Fixtures authored fresh in a care-worker/warehouse voice ("Donna Okafor", Wolverhampton,
---

## 8. Coverage gaps — what this certification does NOT establish

- **Accessibility, mobile layout and performance were never examined.** No lens covered them and the critic that would have flagged this died. They remain uncertified.
- **No human used the product.** Every finding is from driving code and decoding files. The five-user gate is still owed and nothing here substitutes for it.
- **No production deployment was tested.** Findings are against local code at a frozen SHA.
- **43 of 46 findings rest on agent verification alone.** I personally reproduced 3.
- **Round 8's separate blockers were not re-checked** except where a lens happened to hit them: the education-bank substring aliasing (`ACE` inside *Workpl**ace***) was not specifically retested.

## 9. Release checklist

**Code — blocking.** In dependency order, because several share a root cause:

1. **The export sanitizer's delete-the-whole-role behaviour** (`evidence-admissibility.ts:538`) — 3 P0s share this root. A role must never lose its heading because its bullets were filtered.
2. **Snapshot resurrection** — excluded evidence surviving in saved variants, role headings and the materials file. This is the design decision the read-layer inventory flagged and I deferred; it is now four confirmed P0s. Stored artifacts must re-derive from live evidence or be re-gated at export.
3. **`NON_EVIDENCE_INTAKE_FIELDS` and `REVIEWABLE_KINDS`** — both hand-maintained lists, both holed. Employer/title fields and `identity`/`goal`/`constraint` kinds must be gated.
4. **`resume-intelligence.ts` voice normalization** — stop deleting leading "we" and stop deleting `stuff`/`things`/`various`.
5. **`story-mode.ts`** — competency mining from denials, family circumstance as job title, and the story being discarded.
6. **PDF encoder** — non-CP1252 characters, including names.
7. **Résumé import** — job title routed into `identity.phone`; a certificate printed as an employer.
8. **`/founding-beta` metadata** advertising purchases while commerce is off, and the `/api/checkout` key-mode gate.
9. **Receipt honesty** — every count and every stated reason.

**Non-code gates — unchanged, still owed, and none are mine to do:**

- Set `NEXT_PUBLIC_COMMERCE_MODE=off` on Vercel and redeploy.
- Close Stripe issue #55 — deactivate the stray live Payment Link (needs dashboard access).
- Run the five-user gate (`docs/FIVE_USER_LAUNCH_GATE.md`).

## 10. Closure statement

**What a reasonable person may conclude from this document:** the point-of-read gate is sound in its core design and held under deliberate attack on the record path; the product around it is not ready to launch; and the reason the previous certification looked better than this one is that it asked narrower questions.

**What a reasonable person may not conclude:** that this list is complete. The critic never ran, three dimensions were never examined, 16 findings are unverified, and one lens's own verification was truncated. A shorter list next round will not mean the product improved unless the same breadth is applied.

**On the pattern:** Round 8 found 17 P0s and produced one architectural fix. Round 9 found 26. That is not a regression — it is eight lenses looking where five looked before, at a product whose truth-critical surfaces have never all been examined in one pass. The gate work was correct and should stand. It was also, on this evidence, roughly a fifth of the remaining work.
