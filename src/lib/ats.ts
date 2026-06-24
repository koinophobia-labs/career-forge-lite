import type { AtsCheck, IntakeData, ResumePackage } from "@/types/career";

const actionVerbs = [
  "coordinated",
  "supported",
  "handled",
  "maintained",
  "documented",
  "tracked",
  "resolved",
  "managed",
  "improved",
  "assisted",
  "communicated",
  "reported"
];

const fillerTerms = [
  "hard worker",
  "team player",
  "go-getter",
  "responsible for",
  "detail-oriented",
  "results-driven",
  "self-starter"
];

function resumeText(data: IntakeData, resume: ResumePackage) {
  return [
    data.fullName,
    data.email,
    data.phone,
    data.website,
    "Summary",
    resume.summary,
    "Core Skills",
    resume.coreSkills.join(", "),
    "Experience",
    resume.experience
      .map((role) => `${role.title} ${role.company} ${role.time} ${role.bullets.join(" ")}`)
      .join(" "),
    "Education",
    resume.education
  ]
    .join(" ")
    .toLowerCase();
}

function hasQuantifiedContent(data: IntakeData, resume: ResumePackage) {
  const scopeValues = [
    data.customersServed,
    data.ticketsHandled,
    data.projectsSupported,
    data.teamSizeSupported,
    data.callsHandled,
    data.revenueInfluenced,
    data.reportsCreated
  ];
  const outcomeValues = [data.outcomes, ...data.selectedOutcomes];

  return Boolean(scopeValues.some((value) => value.trim()) || outcomeValues.some((value) => value.trim()) || /\d/.test(resumeText(data, resume)));
}

export function runAtsChecks(data: IntakeData, resume: ResumePackage): AtsCheck[] {
  const text = resumeText(data, resume);
  const fillerMatches = fillerTerms.filter((term) => text.includes(term));
  const hasActionVerb = actionVerbs.some((verb) => text.includes(verb));
  const hasContact = Boolean(data.fullName.trim() && data.email.trim());
  const hasSkills = resume.coreSkills.length >= 4;

  return [
    {
      label: "Standard section headings",
      status: "PASS",
      detail: "Resume uses Summary, Core Skills, Experience, and Education."
    },
    {
      label: "Single-column structure",
      status: "PASS",
      detail: "Templates render as one-column resume content without sidebars, tables, or charts."
    },
    {
      label: "Quantified achievements present",
      status: hasQuantifiedContent(data, resume) ? "PASS" : "WARNING",
      detail: hasQuantifiedContent(data, resume)
        ? "Scope or outcome fields give the resume measurable achievement context."
        : "Missing scope or outcome context. Add estimates for customers, tickets, calls, projects, reports, revenue, team support, or what the work improved so bullets read as evidence instead of duties."
    },
    {
      label: "Action verbs present",
      status: hasActionVerb ? "PASS" : "WARNING",
      detail: hasActionVerb
        ? "Experience bullets include resume action verbs."
        : "Start bullets with clear verbs such as supported, coordinated, resolved, tracked, or maintained."
    },
    {
      label: "Skills section present",
      status: hasSkills ? "PASS" : "WARNING",
      detail: hasSkills
        ? "Core Skills includes multiple ATS-searchable phrases."
        : "Add more tools, responsibilities, or role skills to strengthen keyword coverage."
    },
    {
      label: "Contact section present",
      status: hasContact ? "PASS" : "WARNING",
      detail: hasContact
        ? "Name and email are present for recruiter contact."
        : "Name and email are required for a complete resume header."
    },
    {
      label: "Excessive filler language",
      status: fillerMatches.length <= 1 ? "PASS" : "WARNING",
      detail:
        fillerMatches.length <= 1
          ? "Resume avoids heavy generic filler language."
          : `Consider replacing generic phrases: ${fillerMatches.join(", ")}.`
    }
  ];
}
