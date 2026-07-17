import type { ResumePackage } from "@/types/career";

// Same-field multi-tab conflict handling for the full-document editor.
//
// The store already rebases every write on the latest localStorage state, so
// edits to UNRELATED fields from different tabs merge automatically. What it
// cannot do alone is protect the same field: an editor field holds its draft
// in the DOM, so a tab that started from an older stored value would silently
// overwrite a newer edit committed by another tab. These helpers detect that
// case at commit time so the UI can show an explicit keep-mine / keep-stored /
// merge choice instead of last-write-wins.

export type EditableFieldPath =
  | "summary"
  | "coreSkills"
  | "education"
  | `experience.${number}.${"title" | "company" | "time" | "bullets"}`;

export type FieldConflict = {
  variantId: string;
  path: string;
  label: string;
  /** The stored value this tab's edit started from. */
  base: string;
  /** This tab's proposed new value. */
  mine: string;
  /** The newer value another tab committed while this one was editing. */
  stored: string;
};

// One canonical string serialization per field so values captured from the
// DOM, the store, and a manual merge all compare and commit identically.
export function fieldValueAtPath(resume: ResumePackage, path: string): string {
  if (path === "summary") return resume.summary;
  if (path === "coreSkills") return resume.coreSkills.join("\n");
  if (path === "education") return resume.education;
  const match = path.match(/^experience\.(\d+)\.(title|company|time|bullets)$/);
  if (match) {
    const role = resume.experience[Number(match[1])];
    if (!role) return "";
    return match[2] === "bullets" ? role.bullets.join("\n") : role[match[2] as "title" | "company" | "time"];
  }
  return "";
}

export function resumeWithFieldValue(resume: ResumePackage, path: string, value: string): ResumePackage {
  const lines = () => [...new Set(value.split(/\n+/).map((line) => line.trim()).filter(Boolean))];
  if (path === "summary") return { ...resume, summary: value };
  if (path === "coreSkills") return { ...resume, coreSkills: lines() };
  if (path === "education") return { ...resume, education: value };
  const match = path.match(/^experience\.(\d+)\.(title|company|time|bullets)$/);
  if (match) {
    const index = Number(match[1]);
    return {
      ...resume,
      experience: resume.experience.map((role, roleIndex) =>
        roleIndex === index
          ? match[2] === "bullets"
            ? { ...role, bullets: lines() }
            : { ...role, [match[2]]: value }
          : role
      )
    };
  }
  return resume;
}

export function fieldLabel(path: string): string {
  if (path === "summary") return "Summary";
  if (path === "coreSkills") return "Skills";
  if (path === "education") return "Education";
  const match = path.match(/^experience\.(\d+)\.(title|company|time|bullets)$/);
  if (match) {
    const part = { title: "heading", company: "company", time: "dates", bullets: "bullets" }[match[2] as "title"];
    return `Role/project ${Number(match[1]) + 1} ${part}`;
  }
  return path;
}

// True when committing `proposed` would silently discard a newer stored edit:
// the stored value moved away from what this tab started from, and neither
// side already matches the other.
export function isFieldConflict(base: string, stored: string, proposed: string): boolean {
  return stored !== base && stored !== proposed && proposed !== base;
}
