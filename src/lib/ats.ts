import type { AtsCheck, IntakeData, ResumePackage } from "@/types/career";
import { isPlaceholderEducation, roleHasContent } from "@/lib/resume-export";

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

const suspiciousPhrases = [
  "customers customers",
  "tickets tickets",
  "documented documentation",
  "managed onboarding using python",
  "candidate targeting"
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
  const suspiciousMatches = suspiciousPhrases.filter((term) => text.includes(term));
  const hasActionVerb = actionVerbs.some((verb) => text.includes(verb));
  const hasContact = Boolean(data.fullName.trim() && data.email.trim());
  const hasSkills = resume.coreSkills.length >= 4;
  const allBullets = resume.experience.flatMap((role) => role.bullets.map((bullet) => bullet.trim()).filter(Boolean));
  const duplicateBulletCount = allBullets.length - new Set(allBullets.map((bullet) => bullet.toLowerCase())).size;
  const repeatedOpeners = resume.experience.some((role) => {
    const openers = role.bullets.map((bullet) => bullet.trim().split(" ")[0]?.toLowerCase()).filter(Boolean);
    return openers.length !== new Set(openers).size;
  });
  const bulletCountsHealthy = resume.experience.every((role) => {
    const count = role.bullets.filter((bullet) => bullet.trim()).length;
    return count >= 2 && count <= 4;
  });
  const missingRoleContext = resume.experience.some((role) => !role.company.trim() || role.company.includes("Company") || !role.time.trim() || role.time === "Dates");
  const hasEmptySections = !resume.summary.trim() || resume.coreSkills.filter((skill) => skill.trim()).length === 0 || resume.experience.length === 0;
  // Real checks, not template assertions: headings only render when their
  // section has content, and column artifacts come from the user's own text.
  const missingHeadings = [
    resume.summary.trim() ? null : "Summary",
    resume.coreSkills.some((skill) => skill.trim()) ? null : "Core Skills",
    resume.experience.some(roleHasContent) ? null : "Experience",
    resume.education.trim() && !isPlaceholderEducation(resume.education) ? null : "Education"
  ].filter((heading): heading is string => Boolean(heading));
  const columnArtifacts = [
    resume.summary,
    ...resume.coreSkills,
    resume.education,
    ...resume.experience.flatMap((role) => [role.title, role.company, role.time, ...role.bullets])
  ].filter((line) => /\t| {3,}/.test(line ?? ""));

  return [
    {
      label: "Standard section headings",
      status: missingHeadings.length === 0 ? "PASS" : "WARNING",
      detail:
        missingHeadings.length === 0
          ? "All four standard ATS headings will render: Summary, Core Skills, Experience, and Education each have content."
          : `Empty sections omit their headings from the export: ${missingHeadings.join(", ")}. Add content so ATS parsers find every standard section.`
    },
    {
      label: "Single-column structure",
      status: columnArtifacts.length === 0 ? "PASS" : "WARNING",
      detail:
        columnArtifacts.length === 0
          ? "No tabs or wide spacing that ATS parsers can misread as columns or tables were found in the resume text."
          : `Some lines contain tabs or wide spacing that can parse as columns or tables. Replace them with single spaces: ${columnArtifacts.slice(0, 2).map((line) => `“${line.trim().slice(0, 60)}”`).join(", ")}.`
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
    },
    {
      label: "Duplicate bullets",
      status: duplicateBulletCount === 0 ? "PASS" : "WARNING",
      detail: duplicateBulletCount === 0 ? "Experience bullets are not duplicated." : "Duplicate bullets make the resume feel generated. Revise repeated experience bullets."
    },
    {
      label: "Bullet count",
      status: bulletCountsHealthy ? "PASS" : "WARNING",
      detail: bulletCountsHealthy ? "Each role has a reasonable number of bullets." : "Aim for 2-4 bullets per role so experience is substantial but not padded."
    },
    {
      label: "Repeated opening verbs",
      status: repeatedOpeners ? "WARNING" : "PASS",
      detail: repeatedOpeners ? "Some bullets in the same role start with the same verb. Vary action verbs where possible." : "Opening verbs are varied within roles."
    },
    {
      label: "Role context",
      status: missingRoleContext ? "WARNING" : "PASS",
      detail: missingRoleContext ? "One or more roles are missing company or date context. Add company names and time ranges for recruiter credibility." : "Roles include company and time context."
    },
    {
      label: "Education placeholder",
      status: isPlaceholderEducation(resume.education) ? "WARNING" : "PASS",
      detail: isPlaceholderEducation(resume.education) ? "Education is still using placeholder text. Edit it or leave it out of export." : "Education no longer uses placeholder text."
    },
    {
      label: "Empty resume sections",
      status: hasEmptySections ? "WARNING" : "PASS",
      detail: hasEmptySections ? "One or more core sections are empty. Add summary, skills, and at least one role before exporting." : "Core resume sections contain content."
    },
    {
      label: "Suspicious phrasing",
      status: suspiciousMatches.length ? "WARNING" : "PASS",
      detail: suspiciousMatches.length ? `Review awkward repeated wording: ${suspiciousMatches.join(", ")}.` : "No obvious repeated-noun or awkward template phrases detected."
    }
  ];
}
