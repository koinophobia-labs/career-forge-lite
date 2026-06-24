# Career Target Database Report

## Summary

Career Forge Lite now includes a local searchable career target database so users can choose more specific target titles while the app continues to map each title into the existing role-family intelligence system.

No login, payments, backend database, job board, or AI API integration was added.

## Roles Added

Added 67 mapped career target entries across the existing career families requested for this pass:

- Customer Success: 9 titles
- Operations: 9 titles
- Admin: 9 titles
- Sales: 8 titles
- Business: 8 titles
- Project Coordination: 8 titles
- IT Support: 8 titles
- Tech: 8 titles

## Role-Family Mapping

The target database maps specific titles to the existing role families:

- Customer Success: Customer Success Associate, Customer Support Specialist, Customer Experience Associate, Client Services Coordinator, Onboarding Specialist, Account Coordinator, Member Services Representative, Client Support Representative, Customer Care Coordinator
- Operations: Operations Associate, Operations Coordinator, Logistics Coordinator, Fulfillment Coordinator, Scheduling Coordinator, Process Coordinator, Business Operations Associate, Facilities Coordinator, Inventory Coordinator
- Admin: Administrative Assistant, Office Coordinator, Front Desk Coordinator, Receptionist, Administrative Coordinator, Records Coordinator, Executive Assistant, Office Assistant, Data Entry Clerk
- Sales: Sales Development Representative, Business Development Representative, Sales Coordinator, Account Representative, Inside Sales Representative, Lead Generation Specialist, Sales Support Specialist, Account Development Representative
- Business: Business Analyst, Business Operations Associate, Operations Analyst, Program Associate, Strategy Associate, Process Analyst, Reporting Analyst, Business Support Specialist
- Project Coordination: Project Coordinator, Project Administrator, Program Coordinator, Implementation Coordinator, PMO Coordinator, Project Support Specialist, Project Assistant, Implementation Associate
- IT Support: Help Desk Technician, IT Support Specialist, Technical Support Representative, Desktop Support Technician, Service Desk Analyst, Support Technician, IT Support Technician, Help Desk Analyst
- Tech: QA Tester, Junior Product Analyst, Technical Operations Associate, Data Associate, Product Operations Associate, Implementation Specialist, Junior QA Analyst, Technical Support Associate

## Behavior Added

- The target role question now supports searching known career targets.
- Selecting a known target automatically updates the internal role family.
- Users can still type a custom role if the database does not include their exact title.
- The role family remains visible and editable on the confirmation step.
- The generator continues to use `targetJobTitle` for the specific resume/LinkedIn target.
- Responsibilities, scope prompts, outcome suggestions, ATS keywords, and value areas continue to use `roleFamily`.
- The review dossier now separates selected target role from mapped role family.

## Files Changed

- `src/lib/career-data.ts`
- `src/components/IntakeForm.tsx`
- `README.md`
- `public/screenshots/intake.png`
- `public/screenshots/responsibilities.png`
- `public/screenshots/ats-review.png`
- `public/screenshots/resume-preview.png`
- `CAREER_TARGET_DATABASE_REPORT.md`

## Screenshots Updated

- `public/screenshots/intake.png`
- `public/screenshots/responsibilities.png`
- `public/screenshots/ats-review.png`
- `public/screenshots/resume-preview.png`

The screenshot pass verified selecting `Implementation Coordinator` maps to `Project Coordination` and reaches generated output.

## Known Limitations

- The career target database is local/static, not a backend database.
- Some real-world titles can reasonably belong to more than one role family. For example, `Business Operations Associate` is available under both Operations and Business; users can confirm or change the mapped lane on the next step.
- Search is simple substring matching across title and role family.
- Custom roles still rely on the user confirming the closest role family.

## Verification Results

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run build` passed.

Build output confirmed:

- Next.js production build compiled successfully.
- TypeScript completed successfully.
- Static pages generated successfully.
