import type { ExperienceRole, IntakeData, ResumePackage } from "@/types/career";

export const educationPlaceholder = "Education or Certification | School or Provider | Year";

export function normalizeHeaderName(value: string) {
  return (
    value
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase()) || "Candidate Name"
  );
}

export function roleHasContent(role: ExperienceRole) {
  return role.title.trim() || role.company.trim() || role.time.trim() || role.bullets.some((bullet) => bullet.trim());
}

export function isPlaceholderEducation(value: string) {
  return value.trim().toLowerCase() === educationPlaceholder.toLowerCase();
}

export function experienceToText(resume: ResumePackage) {
  return resume.experience
    .filter(roleHasContent)
    .map(
      (role) =>
        `${role.title} | ${role.company} | ${role.time}\n${role.bullets
          .filter((bullet) => bullet.trim())
          .map((bullet) => `- ${bullet}`)
          .join("\n")}`
    )
    .join("\n\n");
}

export function resumeToText(data: IntakeData, resume: ResumePackage) {
  const contact = [data.email, data.phone, data.website].filter(Boolean).join(" | ");
  const sections = [
    `${normalizeHeaderName(data.fullName)}${contact ? `\n${contact}` : ""}`,
    resume.summary.trim() ? `SUMMARY\n${resume.summary.trim()}` : "",
    resume.coreSkills.filter((skill) => skill.trim()).length
      ? `CORE SKILLS\n${resume.coreSkills.filter((skill) => skill.trim()).join(", ")}`
      : "",
    experienceToText(resume) ? `EXPERIENCE\n${experienceToText(resume)}` : "",
    resume.education.trim() && !isPlaceholderEducation(resume.education) ? `EDUCATION\n${resume.education.trim()}` : ""
  ];

  return sections.filter(Boolean).join("\n\n");
}
