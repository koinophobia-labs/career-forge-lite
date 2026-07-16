# Career Forge 2026 market map

Research date: **2026-07-15**

Scope: public product, pricing, help, and onboarding surfaces; no purchases, private résumé uploads, paywall bypasses, or production use.

Notation: **Yes** = publicly demonstrated; **Partial** = adjacent behavior; **No evidence** = not found on audited public surfaces, not proof of absence; **Unknown** = inaccessible or ambiguous.

## Method

The audit started with official product and pricing pages, then official help content and public onboarding. Research papers were used for technical/category context. User discussions were used only to form hypotheses. Eight representative products were also walked through interactively with synthetic/no personal information: Teal, Huntr, Jobscan, Simplify, Kickresume, TopResume, ResumeForge, and Bragora. The first CTA, signup boundary, visible input model, output explanation, tracker/tailoring behavior, and trust language were recorded.

Pricing is a timestamped snapshot, not a purchase recommendation. Some pages localize or render prices client-side; those rows explicitly retain the uncertainty. Detailed page-level provenance is in [CAREER_FORGE_MARKET_SOURCES.md](./CAREER_FORGE_MARKET_SOURCES.md).

## Market archetypes and comparison set

| Archetype | Audited products | Promise the archetype tends to own |
|---|---|---|
| Integrated job-search systems | [Teal](https://www.tealhq.com/), [Huntr](https://huntr.co/), [Career.io](https://career.io/), [Careerflow](https://www.careerflow.ai/), [Simplify](https://simplify.jobs/) | Manage more of the search in one place: profile, résumé, matching, tracking, outreach, or autofill. |
| ATS and résumé optimization | [Jobscan](https://www.jobscan.co/), [Rezi](https://www.rezi.ai/), [Resume Worded](https://resumeworded.com/) | Improve a document against a role or rubric through keywords, scores, or feedback. |
| Résumé creation and design | [Kickresume](https://www.kickresume.com/), [Enhancv](https://enhancv.com/), [Resume.io](https://resume.io/), [Zety](https://zety.com/) | Produce polished résumé and cover-letter documents quickly. |
| Human and managed services | [TopResume](https://topresume.com/) | Buy expert writing, review, or managed search support. |
| Career-memory/evidence systems | [Career Vault](https://www.careervault.ai/), [Career Vault Cloud](https://careervault.cloud/), [ResumeForge](https://resume.foundation/), [Bragora](https://bragora.com/) | Preserve reusable history, stories, achievements, or evidence across applications. |
| Explainable hiring research | [Career-aware tailoring](https://arxiv.org/abs/2605.05257), [JobMatchAI](https://arxiv.org/abs/2603.14558), [Smart-Hiring](https://arxiv.org/abs/2511.02537) | Use longitudinal context, knowledge graphs, provenance, or explanations in matching/tailoring. |

Categories overlap. Teal, Huntr, Careerflow, Simplify, and Enhancv span several commodity categories; ResumeForge and Bragora overlap Career Forge most directly on evidence/provenance language.

## Matrix A — promise, input, and data model

| Product | Core promise / primary user | First input and explanation before signup | Career data model | Multi-document import | Approval / contradictions | Multiple role directions |
|---|---|---|---|---|---|---|
| Teal | AI résumé + job-search workspace for active seekers | `Get Started for Free`; account boundary; official guide recommends a comprehensive source résumé then tailoring | Profile/source résumé + documents + tracker | Multiple résumé versions; no public evidence of historical-document reconciliation | No public pre-trust approval or contradiction queue | Tailored versions, not a compiled multi-lane pack |
| Huntr | Tracker, résumé builder/tailor, autofill, contacts | `Sign Up for Free`; account required | Profile + base resumes + job/CRM tracker | Upload/store resumes; no public reconciliation model | Suggestion review exists; no public imported-fact trust gate | Separate resumes/jobs; no public simultaneous lane compilation |
| Career.io | All-in-one career services and tools | `Get Started`; account/trial path | Cloud profile, documents, job tools, services | Document/profile features; reconciliation unknown | No public evidence | Career pathways exist; pack behavior not demonstrated |
| Careerflow | AI job-search copilot | `Get Started for Free`; account required | Profile + résumé tools + job tracker | Multiple documents are supported; longitudinal merge unknown | No public evidence | No public multi-lane pack |
| Simplify | One profile powering matches, tailoring, tracking, and autofill | `Join Now`; account/extension ecosystem | Cloud candidate profile + applications/tracker | Resume versions/tailoring; historical reconciliation not demonstrated | No public evidence | Job-specific versions, not lane packs |
| Jobscan | ATS-specific résumé/job-description match report | `Scan Your Resume`; résumé + job description, then account boundary | Document-to-job analysis + optimizer | Multiple scans/versions; no longitudinal vault publicly demonstrated | No fact approval; identifies match gaps | No public lane pack |
| Rezi | AI résumé builder with keyword targeting and scoring | Create/import résumé in account | Resume documents | Multiple resumes on paid plan; no reconciliation | No public evidence | Multiple documents, not lane compilation |
| Resume Worded | Automated résumé/LinkedIn feedback | Upload résumé/account workflow | Uploaded document + target job | Multiple reviews; no longitudinal merge demonstrated | No public evidence | Targeted résumé workflow only |
| Kickresume | Templates + AI writing/checking | `Create My Resume`; registration boundary | Resume/cover-letter documents + Career Map | Import/create versions; no public history merge | No public evidence | Career Map is adjacent; no paired lane pack |
| Enhancv | Recruiter-facing design plus ATS/tailoring tools | `Build My Resume Now`; account app | Resume documents + tracker | Resume variants; no public historical reconciliation | No public evidence | Job tailoring, not compiled role lanes |
| Resume.io | Fast résumé/cover-letter creation | `Create my resume`; builder/account path | Resume documents + job tools | Multiple documents on premium; no public reconciliation | No public evidence | No public lane pack |
| Zety | Guided résumé/cover-letter builder | `Create My Resume`; questionnaire/builder | Resume documents | Multiple documents; no public reconciliation | No public evidence | No public lane pack |
| TopResume | Human review/writing/managed search | Upload a résumé for review | Service engagement + documents | Human writer may use supplied materials; system model not public | Human editorial process, not an explicit user fact queue | Package-dependent human deliverables |
| Career Vault | Reusable interview-story bank | Add stories/account | Story vault | Multi-story, not necessarily multi-document résumé history | User-curated; contradictions not public | Stories can serve multiple roles |
| Career Vault Cloud | Career document vault with tailoring | Upload PDF/DOCX/account | Cloud document vault | Yes; smart dedupe claimed | Dedupe advertised; approval/contradiction semantics unclear | Tailored outputs; lane pack unknown |
| ResumeForge | “Career evidence engine” with Truth Mode | Create account | Longitudinal evidence vault | Historical evidence/vault publicly claimed | Fact/evidence orientation; exact approval and contradiction flow behind signup | Job-search paths claimed; paired lane pack not public |
| Bragora | Career vault, fact-guarded tailoring, linked application assets | Create account / import old résumés | Deduplicated cloud career vault + tracker | Yes, multiple old résumés | Dedupe/fact guarding claimed; durable undecided gate not public | Tailoring from vault; simultaneous paired lane packs not public |
| Career Forge | Local-first career evidence compiler for nonlinear careers | Import or paste several résumés; behavior and privacy explained before use; no account | Approved dossier + durable Truth Inbox + derived lanes, outputs, answers, applications | Yes, locally extracted and grouped | Explicit proposed/approved/rejected queue, edit/duplicate review, persistent undecided work | Yes, separate credible role lanes |

Sources: official product/help pages linked in the source ledger; the Career Forge row describes the current branch implementation.

## Matrix B — grounding, outputs, and lineage

| Product | Claim provenance | Direct vs transferred proof | Duration verification | Pack generation | ATS + human variant | Application lineage / answers | Unsupported-claim behavior |
|---|---|---|---|---|---|---|---|
| Teal | No public claim-to-source receipt found | No public direct/combined/transferred labels found | No public proof verification found | Individual documents | No demonstrated paired baseline per lane | Tracker links jobs/documents; grounded answer lineage not public | Keyword guidance; refusal semantics not public |
| Huntr | Suggestions can be reviewed; source-level claim receipt not found | No public labels found | No public proof verification found | Individual documents | No public paired baseline | Strong job/document tracker; answer provenance not public | AI suggestions can be approved/rejected; evidence-based refusal not public |
| Career.io | No public claim receipt found | No public labels found | Unknown | Individual tools/services | Not publicly demonstrated | Tracker/career tools; evidence lineage not demonstrated | Unknown |
| Careerflow | No public claim receipt found | No public labels found | No public proof verification found | Individual documents | Not publicly demonstrated | Tracker + application tools; claim lineage not public | Unknown |
| Simplify | No public claim receipt found | No public labels found | No public proof verification found | Job-specific documents | Not publicly demonstrated | Deep profile/application tracking and question/autofill tooling; evidence chain not public | Unknown |
| Jobscan | Explains score inputs and missing keywords, not career-source provenance | No | Experience-level feedback is not source-backed duration proof | Single analysis/output at a time | No public pair | Scan/job relation, not evidence→answer lineage | Flags missing terms; does not claim to be a truth refusal engine |
| Rezi | Score/checks, not source provenance | No public labels found | No public proof verification found | Individual documents | No public pair | No public evidence lineage | Keyword targeting/checking; refusal unknown |
| Resume Worded | Feedback trace to document sections, not underlying sources | No public labels | No public proof verification found | Individual documents | No public pair | No public evidence lineage | Feedback/rewrite, not public claim refusal |
| Kickresume | No public source receipt found | No public labels | No public proof verification found | Individual documents | No public pair | Career Map is adjacent; evidence-to-application chain not shown | AI writer/checker; refusal unknown |
| Enhancv | Feedback/ATS explanations, not career-source receipt | No public labels | No public proof verification found | Individual documents | Design serves humans and ATS, but no deliberate pair per lane | Tracker attaches resumes to applications; underlying evidence lineage not public | Suggestions/checks; refusal unknown |
| Resume.io | No public source receipt found | No public labels | No public proof verification found | Individual documents | No public pair | Job tools, not public evidence chain | Unknown |
| Zety | No public source receipt found | No public labels | No public proof verification found | Individual documents | No public pair | No public evidence chain | Content guidance; refusal unknown |
| TopResume | Human review may check plausibility; no productized source map demonstrated | Editorial, not explicit labels | Human-dependent | Service/package documents | Human-dependent | Managed-service context; no self-serve evidence chain public | Human editorial judgment |
| Career Vault | Stories are the source objects; résumé claim mapping not public | No public labels | User-entered | No public lane pack | No | Story reuse, not full application lineage | Unknown |
| Career Vault Cloud | Vault source exists; exact claim links unclear | No public labels found | Unknown | Tailored resumes | Unknown | Documents/job use; exact chain unclear | Unknown |
| ResumeForge | Publicly claims claim-to-evidence tracing and Truth Mode | Evidence strength language; exact three-label taxonomy not public | Gaps/evidence claimed; exact duration rule unknown | Tailored outputs; multi-lane pair not public | Not demonstrated | Evidence-backed job search claimed; full answer/application chain not public | Publicly claims unsupported claims are exposed/controlled |
| Bragora | Publicly claims bullets trace to vault evidence | Fact-guarded; exact direct/combined/transferred labels not public | Unknown | Tailored outputs; multi-lane pair not public | Not demonstrated | Tracker links exact résumé; answer lineage not public | Fact guarding claimed |
| Career Forge | Claim → one or more approved evidence records with excerpts | Explicit direct, combined, transferred labels | Verified/unverified duration state is visible | One operation produces every selected lane | ATS Submission + Recruiter/Networking per lane | Evidence → lane → baseline/job-specific variant → grounded answers → saved application | Separate known gaps and claims actually considered then refused; empty when none |

## Matrix C — adjacent capabilities, privacy, and response

| Product | Tracker / CRM / autofill / interview | Design depth and exports | Privacy and no-login | Moat | Weakness relative to Career Forge job | Career Forge response |
|---|---|---|---|---|---|---|
| Teal | Tracker; contacts; extensions; interview/job tools | Strong builder; PDF/Word availability varies by feature/plan | Cloud account | Integrated job-search workflow and education | Public surfaces do not show pre-trust evidence review or claim lineage | Differentiate; possible future export/integration only |
| Huntr | Deep tracker/CRM; autofill | Builder and exports | Cloud account | Organized job-search workspace | No public direct/transfer taxonomy or local evidence compiler | Differentiate; do not rebuild CRM now |
| Career.io | Tracker/search/interview/expert services | Builder/export | Cloud account | Breadth and human services | Suite breadth can obscure evidence integrity; grounding not public | Ignore breadth; compete on trust foundation |
| Careerflow | Tracker, networking, interview/LinkedIn tools | Resume tools/export | Cloud account | Copilot breadth | No public durable evidence approval/lineage | Ignore suite race |
| Simplify | Strong tracker/autofill/networking/application automation | Tailored resume export | Cloud account + extension | Submission acceleration and one-profile convenience | Speed does not publicly establish career-truth foundation | Position Career Forge before acceleration; future handoff only |
| Jobscan | Tracking/auto-apply features advertised | Optimization/export tools | Cloud account for full workflow | ATS-specific scan familiarity | Score/keyword orientation does not solve longitudinal evidence truth | Differentiate; never imitate universal score |
| Rezi | Interview feature; limited tracker emphasis | Strong AI builder; PDF/DOCX | Cloud account | Focused AI writing and value pricing | Resume-first; provenance/lanes not public | Ignore writing arms race |
| Resume Worded | LinkedIn tools; no deep tracker/autofill | Feedback rather than template moat | Cloud account | Fast rubric feedback | Document feedback is not an evidence system | Differentiate |
| Kickresume | Interview/Career Map adjacent | Very deep templates; PDF/DOCX | Cloud account | Design, AI writing, broad creation flow | Design-first; source lineage not public | Refuse template race |
| Enhancv | Tracker/interview/job board/extension | Deep design; PDF | Cloud account | Human-readable design plus broad tools | No public fact gate or claim-source chain | Refuse design race; keep clean functional exports |
| Resume.io | Job search/interview/career tools | Deep templates; PDF, TXT free limitation | Cloud account | Fast polished documents | Resume-first and cloud/account based | Refuse template race |
| Zety | Interview/job resources | Deep guided templates; TXT free, paid downloads | Cloud account | Guided writing funnel | Resume-first; renewal pricing can dominate perception | Compete on durable value, not funnel mechanics |
| TopResume | Human service and managed search | Professional writer deliverables | Upload/service account/contact | Human expertise and done-for-you help | Expensive, slower, less reusable/self-serve | Serve users who need control, auditability, and repeated compilation; do not replace coaching |
| Career Vault | No deep application automation public | Story exports/workflows | Cloud account | Interview memory | Narrower story bank | Treat as validation of memory need; differentiate on full dossier/output lineage |
| Career Vault Cloud | Document vault/tailoring | Resume exports | Cloud account | Multi-document vault/dedupe | Public trust semantics and local use unclear | Monitor closely |
| ResumeForge | Job-search workflow | Output formats behind account | Cloud account | Direct evidence-engine/provenance framing | Public no-login/local behavior and full lane-pair/application-answer chain not found | Primary moat risk; never claim provenance alone |
| Bragora | Tracker links exact resume | Output formats behind account | Cloud account | Vault + dedupe + fact-guarded tailoring + document tracking | Durable pre-trust queue, transfer taxonomy, paired multi-lane pack, local/no-account not publicly shown | Primary moat risk; differentiate on combination and usability |
| Career Forge | Intentionally lightweight tracker; grounded application answers; no autofill | Functional ATS/human baselines; PDF/DOCX/JSON backup where supported | Local-first, no account; explicit backup; raw import files not retained | Trust-before-generation plus end-to-end visible lineage across several credible directions | Smaller ecosystem, limited design, no cloud sync; requires user review | Own the evidence-compiler wedge; integrate only when it preserves truth |

## Current public pricing snapshot

| Product | Free | Short-term / monthly | Quarterly / annual / lifetime / service | Confidence |
|---|---|---|---|---|
| Teal | Unlimited resumes/tracking | Teal+ $13/week or $29/30 days | $79/90 days | High — [official](https://www.tealhq.com/pricing) |
| Huntr | Base resumes, limited tailoring, 100 tracked jobs | Pro $40/month | $90/quarter; $160/6 months | High — [official](https://api.huntr.co/pricing) |
| Career.io | Basic free | Premium $25.95/month after a 7-day trial | — | High — [official help](https://help.career.io/en/articles/3835520) |
| Careerflow | Free | Premium $23.99/month; Premium Plus $44.99/month; weekly $19.99 observed | $172.99/year Premium; $299.99/year Plus observed | Medium — public page contains duration/promotion variants; [official](https://www.careerflow.ai/premium?via=digital) |
| Simplify | Core tools free | $19.99/week; $39.99/month | $89.99/3 months | High — [official help](https://help.simplify.jobs/en/help/articles/5623502-whats-included-in-simplify-features-and-pricing) |
| Jobscan | Limited free scanning | Public tutorial states $89.95/3 months after trial | $89.95/quarter | Medium — checkout redirects to app; [official tutorial](https://www.jobscan.co/jobscan-tutorial) |
| Rezi | 1 résumé / 3 PDFs | Pro $29/month | Lifetime $149; enterprise $99/month per 200 users shown | High — [official](https://www.rezi.ai/pricing) |
| Resume Worded | Limited free review | $49/month | $99/quarter; $229/year | High — [official](https://resumeworded.com/get-pro) |
| Kickresume | Limited free | Regular $24/month; sale $19.20 observed | Regular equivalent $18/month quarterly, $8/month annual; sale $43.20/q, $76.80/y | Medium — promotion-specific; [official](https://www.kickresume.com/en/pricing/sale/) |
| Enhancv | 7-day free plan | Public title says “starting from $16.50”; rendered US price was broken/localized during audit | Quarterly plan exists; stable USD billing total not exposed in audited render | Medium-low — [official](https://enhancv.com/pricing/) |
| Resume.io | One résumé/cover letter, TXT only | $2.95 7-day trial, auto-renews $29.95 every 4 weeks | $49.95/quarter | High for US render — [official](https://resume.io/pricing) |
| Zety | TXT download | $1.95 14-day trial, then $25.95 every 4 weeks | $71.40/year | High — [official](https://zety.com/pricing) |
| TopResume | Free review funnel | DIY tools $24.95/month | Writing from $179; managed service from $2,495 | High — [official](https://topresume.com/plans) |
| Career Vault | Free | $12/month early-bird shown | $79/year early-bird shown | Medium — early-bird offer; [official](https://www.careervault.ai/) |
| Career Vault Cloud | Unknown | No stable public price found | Unknown | Low — [official](https://careervault.cloud/) |
| ResumeForge | Account required | No stable public price found | Unknown | Low — [official](https://resume.foundation/) |
| Bragora | Account required | No stable public price found | Unknown | Low — [official](https://bragora.com/) |

No Career Forge price is proposed in this work.

## Commodity analysis

The audit confirms that AI bullet/summary/cover-letter generation, keyword extraction, ATS-style scores, multiple document versions, job tracking, browser autofill, templates, interview practice, and LinkedIn rewriting are already broadly offered across the official surfaces above. “AI résumé builder,” “all-in-one career tool,” “match score,” or “many templates” therefore cannot carry Career Forge’s positioning.

Less commoditized—but no longer unique by itself—are multi-document career vaults, deduplication, evidence-aware tailoring, and claim provenance. ResumeForge and Bragora make that boundary explicit.

## Uniqueness test

| Publicly demonstrated behavior | Teal | Huntr | Jobscan | Simplify | Kickresume | TopResume | ResumeForge | Bragora | Career Forge |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Durable Truth Inbox before trust | No evidence | No evidence | No evidence | No evidence | No evidence | No evidence | Partial/unknown | Partial/unknown | Yes |
| Explicit evidence approval | No evidence | Partial suggestions | No | No evidence | No evidence | Human process | Partial/unknown | Partial/unknown | Yes |
| Contradiction/duplicate review | No evidence | No evidence | No | No evidence | No evidence | Human process | Partial/unknown | Dedupe claimed | Yes |
| Claim-to-source provenance | No evidence | No evidence | No | No evidence | No evidence | No productized map | Yes claimed | Yes claimed | Yes |
| Direct/combined/transferred labels | No evidence | No evidence | No | No evidence | No evidence | No evidence | No public three-way taxonomy | No public three-way taxonomy | Yes |
| Verified duration handling | No evidence | No evidence | No evidence | No evidence | No evidence | Human-dependent | Unknown | Unknown | Yes |
| Multi-lane pack in one operation | No evidence | No evidence | No | No evidence | No evidence | Package-dependent | No public evidence | No public evidence | Yes |
| ATS + recruiter baseline per lane | No evidence | No evidence | No | No evidence | No evidence | Human-dependent | No public evidence | No public evidence | Yes |
| Evidence-backed application answers | No public lineage | No public lineage | No | No public lineage | No public lineage | Human-dependent | Unknown | Unknown | Yes |
| Full application lineage | Partial tracker | Partial tracker | Scan relation | Partial tracker | No public chain | Human-dependent | Partial/unknown | Resume-to-application link claimed | Yes |
| Local, useful without an account | No | No | No | No | No | No | No | No | Yes |

**Conclusion, medium-high confidence:** we found no public evidence among the audited products that combines all eleven behaviors in one workflow. This is a qualified combination claim, not a claim that no competitor has any component. Confidence is capped because account-only behavior, unannounced features, and fast-moving emerging products cannot be exhaustively observed.

## Pain points: evidence versus hypotheses

Verified or supported recurring problems:

- Maintaining role-specific source versions consumes repeated effort; Indeed advises multiple core versions and reports job seekers spend about an hour updating a résumé ([Indeed](https://www.indeed.com/career-advice/finding-a-job/multiple-resumes)).
- Platforms need explicit mechanisms for managing uploaded résumé files and avoiding the wrong document ([Indeed help](https://www.indeed.com/help/job-seekers/articles/11314976176141-faqs-creating-uploading-and-managing-a-resume-file)).
- AI-generated résumé inaccuracies are a real trust risk; survey evidence is directionally useful but vendor/user-base limited ([Kickresume survey](https://www.kickresume.com/en/press/resume-trends-survey/)); hallucination is also a documented general LLM failure mode ([survey paper](https://arxiv.org/abs/2309.01219)).
- Résumé upload privacy and visibility require user understanding and controls ([LinkedIn help](https://www.linkedin.com/help/linkedin/answer/a506429/visibility-and-usage-of-your-uploaded-resume?lang=en)).
- Explainable person-job recommendations remain an active research need ([systematic review](https://pmc.ncbi.nlm.nih.gov/articles/PMC12546238/)).

Strong hypotheses to test in moderated sessions: nonlinear workers lose project evidence; dates conflict across old documents; users cannot explain what “transfers”; generic scores invite keyword stuffing; application context is lost after submission; repeated re-entry creates abandonment. These were not elevated to verified prevalence claims.

One-off anecdotes and vendor-commissioned privacy/credibility surveys were retained only as discovery inputs, not used to size demand or prove category fit.

## Interactive product-test record and screenshots

The in-app public-surface walkthrough recorded DOM snapshots for Teal, Huntr, Jobscan, Simplify, Kickresume, TopResume, ResumeForge, and Bragora. Screenshot capture was attempted twice but the browser capture API timed out, so no competitor image artifacts were retained or shipped. No personal data was entered and no plan was purchased. Career Forge final-state screenshots are listed in the activation report.

## Confidence and unknowns

- High confidence: official public feature and price text captured directly on 2026-07-15.
- Medium confidence: conclusions about what public surfaces did not demonstrate; absence from a page is not absence from a product.
- Low/unknown: account-only import reconciliation, duration verification, enterprise behavior, and prices not publicly rendered.
- Fastest moat threats: ResumeForge and Bragora. Career Vault Cloud also merits quarterly monitoring.
- The category passes the documented combination test, but human 10-second comprehension has not yet been run. It is therefore an owner-review hypothesis, not validated market demand.
