# Education Intelligence Report

## Summary

Expanded Career Forge Lite's education system so resumes can represent traditional education, certifications, trades, bootcamps, military training, online learning, and self-directed learning without overstating credentials.

Core principle preserved: no degree is required, and Career Forge does not invent education.

## Education Types Added

Added a local education type bank covering:

- High School Diploma
- GED
- Associate Degree
- Bachelor's Degree
- Master's Degree
- MBA
- Doctorate
- Professional Degree
- Community College
- Trade School
- Apprenticeship
- Bootcamp
- Military Training
- Professional Certificate
- Industry Certification
- Continuing Education
- Online Course
- Self-Directed Learning
- Other

## Majors Added

Added a searchable major/focus bank covering common academic and career-adjacent paths, including:

- Business, Finance, Accounting, Economics, Marketing, Management
- Supply Chain, Operations, Communications, Journalism, English
- Psychology, Sociology, Political Science, Education
- Biology, Chemistry, Physics, Mathematics, Statistics
- Computer Science, Information Technology, Cybersecurity, Information Systems
- Software Engineering, Data Science, AI / Machine Learning
- Mechanical Engineering, Civil Engineering, Electrical Engineering
- Nursing, Healthcare Administration, Exercise Science, Criminal Justice
- Hospitality, Sports Management, Graphic Design, Film, Music, Fine Arts
- Architecture, Construction Management, Public Administration, Human Resources
- Project Management, Logistics, Web Development, General Studies

When a user selects a major by itself, Career Forge formats it as a study focus instead of pretending it is a completed degree.

## Certifications Added

Added a searchable certification bank across:

- Technology: CompTIA A+, Network+, Security+, AWS CCP, AWS SAA, Azure Fundamentals, Google IT Support, Cisco CCNA, ITIL
- Business: Scrum Master, PMP, Lean Six Sigma, CAPM, Google Project Management, Salesforce Administrator, HubSpot Certifications
- Marketing: Google Analytics, Google Ads, Meta Blueprint, Hootsuite
- Healthcare: CPR, CNA, EMT, BLS, ACLS
- Fitness: NASM, ACE, ISSA
- Creative: Adobe Certified Professional, Autodesk
- Food/Hospitality: ServSafe, Food Handler

Aliases are supported for common short forms such as `Security+`, `AWS CCP`, `CCNA`, `PMP`, `CNA`, and `ServSafe`.

## Trade Support

Added trade intelligence for:

- Electrician
- Plumber
- HVAC
- Welder
- Carpenter
- Machinist
- Auto Technician
- Heavy Equipment Operator
- CDL
- Construction
- Pipefitter
- Industrial Maintenance

Each trade includes credential examples, transferable skills, tools, and ATS keywords. Trade titles selected alone are formatted as trade focus areas unless the user provides a specific license, apprenticeship, or certification.

## Interview Changes

Guided Interview now includes a compact education and credential step before template selection.

The step supports:

- Searchable education/major/certification/trade suggestions
- Traditional education chips
- Certification chips
- Trade and modern learning chips
- Custom education lines
- Optional skip behavior

The helper copy adapts based on what the user searches or selects:

- Trade/apprenticeship prompts ask for trade, license, and certification details.
- Bachelor's/college prompts ask for school, major/program, degree, and year.
- Bootcamp prompts ask for program, provider, focus, and completion year.
- Military prompts ask for training/specialty/course details without overstating rank or credentials.
- Self-directed learning prompts ask for topic and practical work supported.

Tell My Story and Interview Mode now use the shared education intelligence parser to recognize more legitimate learning paths from natural language.

## Generator Changes

The generator now normalizes education entries before placing them in the resume package.

Examples:

- `google it support` -> `Google IT Support Professional Certificate`
- `CompTIA A+` remains `CompTIA A+`
- `Computer Science` -> `Study Focus: Computer Science`
- `Electrician` -> `Trade Focus: Electrician`
- `Self-directed learning in AI workflow automation` is preserved as a truthful modern learning path

If no education is entered, export still omits the placeholder.

## Tests

Smoke coverage now checks:

- Bachelor education export
- Associate education export
- Trade education export
- Bootcamp education export
- Military training export
- Certification-only export
- No education entered
- Self-taught founder education
- Education type bank coverage
- Degree/major bank coverage
- Certification bank coverage
- Trade bank coverage
- Story Mode education extraction
- Guided Builder education step presence

## Files Changed

- `src/lib/education-intelligence.ts`
- `src/lib/generator.ts`
- `src/lib/interview-mode.ts`
- `src/lib/interview-state.ts`
- `src/lib/story-mode.ts`
- `src/components/IntakeForm.tsx`
- `scripts/smoke-generator.mjs`
- `EDUCATION_INTELLIGENCE_REPORT.md`

## Verification

Passed:

- `npm run smoke:resume-intelligence`
- `npm run smoke:generator`
- `npm run smoke:interview`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

## Known Limitations

- Education parsing is deterministic and local, so unusual phrasing may still need manual edit.
- The app does not verify credentials externally.
- Major-only selections are intentionally formatted as study focus areas unless the user provides a degree.
- There is no backend credential database by design.

## Commit and Push

Commit hash and push result are reported in the final response after commit and push complete.
