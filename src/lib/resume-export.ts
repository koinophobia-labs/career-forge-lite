import type { ExperienceRole, ResumePackage } from "@/types/career";
import { stripTerminationReasons } from "@/lib/truth-guards";

// Structural subset of IntakeData/ResumeSnapshot: everything the plain-text
// export needs, so saved snapshots serialize without a full intake object.
export type ResumeContactFields = {
  fullName: string;
  email: string;
  phone: string;
  website: string;
};

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

export function resumeToText(data: ResumeContactFields, resume: ResumePackage) {
  const contact = [data.email, data.phone, data.website].filter(Boolean).join(" | ");
  // Export-time safety net: termination reasons are never résumé content even
  // if one slipped past the generation-side filter.
  const summary = stripTerminationReasons(resume.summary).text;
  const sections = [
    `${normalizeHeaderName(data.fullName)}${contact ? `\n${contact}` : ""}`,
    summary.trim() ? `SUMMARY\n${summary.trim()}` : "",
    resume.coreSkills.filter((skill) => skill.trim()).length
      ? `CORE SKILLS\n${resume.coreSkills.filter((skill) => skill.trim()).join(", ")}`
      : "",
    experienceToText(resume) ? `EXPERIENCE\n${experienceToText(resume)}` : "",
    resume.education.trim() && !isPlaceholderEducation(resume.education) ? `EDUCATION\n${resume.education.trim()}` : ""
  ];

  return sections.filter(Boolean).join("\n\n");
}
