import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { ResumePackage } from "@/types/career";
import type { CareerDossier, ResumePack, ResumeVariant } from "@/types/dossier";
import type { TargetLane } from "@/types/command-center";
import { isPlaceholderEducation } from "@/lib/resume-export";
import {
  classifyEvidenceAdmissibility,
  isProfessionalEvidence,
  sanitizeResumeForProfessionalUse
} from "@/lib/evidence-admissibility";
import { stripTerminationReasons } from "@/lib/truth-guards";

export type PackExportFormat = "pdf" | "docx";
export type SectionKey = ResumeVariant["sectionOrder"][number];

const DEFAULT_SECTION_ORDER: SectionKey[] = ["summary", "skills", "experience", "projects", "education"];
export const PDF_RULE_TO_CONTENT_GAP = 13;

export type ExportSection =
  | { key: "summary" | "skills" | "education"; heading: string; text: string }
  | { key: "experience"; heading: string; roles: ResumePackage["experience"] };

function sourceContainsWithheldFact(resume: ResumePackage): boolean {
  const values = [
    resume.summary,
    resume.linkedinSummary,
    ...resume.experience.flatMap((role) => [role.title, role.company, ...role.bullets])
  ];
  return values.some((value) => stripTerminationReasons(value ?? "").withheld);
}

// One render plan for PDF, DOCX, and plain text. The resume is sanitized at the
// export boundary as a final fail-closed check, even when the pack was created
// before the evidence-admissibility migration. The receipt is derived from the
// original source so a removed separation reason remains visibly accounted for.
export function exportSections(
  resume: ResumePackage,
  sectionOrder?: SectionKey[],
  kind: ResumeVariant["kind"] = "ats"
): { sections: ExportSection[]; withheldFacts: string[] } {
  const withheldFacts = sourceContainsWithheldFact(resume) ? ["reason for leaving"] : [];
  const safeResume = sanitizeResumeForProfessionalUse(resume);
  const order = sectionOrder?.length ? sectionOrder : DEFAULT_SECTION_ORDER;
  const sections: ExportSection[] = [];
  for (const key of order) {
    if (key === "summary") {
      if (safeResume.summary.trim()) sections.push({ key, heading: "Professional Summary", text: safeResume.summary.trim() });
    } else if (key === "skills") {
      const skills = safeResume.coreSkills.filter((skill) => skill.trim());
      if (skills.length) sections.push({ key, heading: "Core Skills", text: skills.join(" | ") });
    } else if (key === "experience") {
      const roles = safeResume.experience.filter((role) => [role.title, role.company, role.time, ...role.bullets].some((value) => value?.trim()));
      if (roles.length) sections.push({ key, heading: kind === "recruiter" ? "Selected Experience & Projects" : "Experience", roles });
    } else if (key === "education") {
      const education = (safeResume.education ?? "").trim();
      if (education && !isPlaceholderEducation(education)) sections.push({ key, heading: "Education", text: education });
    }
  }
  return { sections, withheldFacts };
}

function identityContactLine(dossier: CareerDossier): string {
  return [dossier.identity.email, dossier.identity.phone, dossier.identity.location, ...dossier.identity.links]
    .filter(Boolean)
    .join(" | ");
}

export function variantPlainText(
  dossier: CareerDossier,
  resume: ResumePackage,
  sectionOrder?: SectionKey[],
  kind: ResumeVariant["kind"] = "ats"
): string {
  const header = [dossier.identity.fullName.trim(), identityContactLine(dossier)].filter(Boolean).join("\n");
  const { sections } = exportSections(resume, sectionOrder, kind);
  const parts: string[] = header ? [header] : [];
  for (const section of sections) {
    if (section.key === "experience") {
      const roles = section.roles
        .map((role) => {
          const headline = [role.title, role.company, role.time].filter((value) => value?.trim()).join(" | ");
          const bullets = role.bullets.filter((bullet) => bullet.trim()).map((bullet) => `- ${bullet}`).join("\n");
          return [headline, bullets].filter(Boolean).join("\n");
        })
        .join("\n\n");
      parts.push(`${section.heading.toUpperCase()}\n${roles}`);
    } else if (section.key === "skills") {
      parts.push(`${section.heading.toUpperCase()}\n${section.text.replace(/ \| /g, ", ")}`);
    } else {
      parts.push(`${section.heading.toUpperCase()}\n${section.text}`);
    }
  }
  return parts.join("\n\n");
}

function slug(value: string, fallback: string): string {
  const safe = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return safe || fallback;
}

export function resumeVariantFilename(
  fullName: string,
  laneTitle: string,
  kind: ResumeVariant["kind"],
  format: PackExportFormat
): string {
  const name = slug(fullName, "Career-Forge-User");
  const lane = slug(laneTitle, "General");
  const variant = kind === "ats" ? "ATS" : kind === "recruiter" ? "Recruiter" : "Job-Specific";
  return `${name}-Resume-${lane}-${variant}.${format}`;
}

async function docxBlob(
  dossier: CareerDossier,
  resume: ResumePackage,
  kind: ResumeVariant["kind"] = "ats",
  sectionOrder?: SectionKey[]
): Promise<Blob> {
  const children: Paragraph[] = [];
  const contact = identityContactLine(dossier);
  children.push(new Paragraph({ text: dossier.identity.fullName || "Résumé", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, keepNext: true }));
  if (contact) children.push(new Paragraph({ text: contact, alignment: AlignmentType.CENTER, spacing: { after: 180 } }));
  for (const section of exportSections(resume, sectionOrder, kind).sections) {
    children.push(new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1, keepNext: true }));
    if (section.key === "experience") {
      section.roles.forEach((role) => {
        children.push(new Paragraph({ keepNext: role.bullets.length > 0, spacing: { before: 120, after: 40 }, children: [new TextRun({ text: [role.title, role.company, role.time].filter(Boolean).join(" | "), bold: true })] }));
        role.bullets.filter((bullet) => bullet.trim()).forEach((bullet) => children.push(new Paragraph({ text: bullet, bullet: { level: 0 } })));
      });
    } else {
      children.push(new Paragraph({ text: section.text }));
    }
  }
  const document = new Document({
    styles: { default: { document: { run: { font: kind === "recruiter" ? "Georgia" : "Arial", size: 21 }, paragraph: { spacing: { after: 80, line: 260 } } } } },
    sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }]
  });
  return Packer.toBlob(document);
}

function pdfBlob(
  dossier: CareerDossier,
  resume: ResumePackage,
  kind: ResumeVariant["kind"] = "ats",
  sectionOrder?: SectionKey[]
): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const width = 612 - margin * 2;
  let y = 54;
  const ensure = (height: number) => { if (y + height > 748) { pdf.addPage(); y = 54; } };
  const write = (line: string, options?: { bold?: boolean; size?: number; indent?: number; after?: number }) => {
    const size = options?.size ?? 10;
    const indent = options?.indent ?? 0;
    pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const wrapped = pdf.splitTextToSize(line || " ", width - indent) as string[];
    ensure(wrapped.length * (size + 3) + (options?.after ?? 0));
    wrapped.forEach((part) => {
      pdf.text(part, margin + indent, y);
      y += size + 3;
    });
    y += options?.after ?? 0;
  };
  const heading = (text: string) => {
    ensure(44);
    y += 7;
    pdf.setDrawColor(kind === "recruiter" ? 50 : 30, kind === "recruiter" ? 85 : 55, kind === "recruiter" ? 75 : 95);
    pdf.setLineWidth(0.7);
    write(text.toUpperCase(), { bold: true, size: 10, after: 1 });
    const ruleY = y + 1;
    pdf.line(margin, ruleY, margin + width, ruleY);
    y = ruleY + PDF_RULE_TO_CONTENT_GAP;
  };
  write(dossier.identity.fullName || "Résumé", { bold: true, size: kind === "recruiter" ? 18 : 16, after: 2 });
  const contact = identityContactLine(dossier);
  if (contact) write(contact, { size: 9, after: 5 });
  for (const section of exportSections(resume, sectionOrder, kind).sections) {
    heading(section.heading);
    if (section.key === "experience") {
      section.roles.forEach((role) => {
        ensure(42);
        write([role.title, role.company, role.time].filter(Boolean).join(" | "), { bold: true, after: 2 });
        role.bullets.filter((bullet) => bullet.trim()).forEach((bullet) => write(`•  ${bullet}`, { indent: 10, after: 1 }));
        y += 3;
      });
    } else {
      write(section.text, { after: 4 });
    }
  }
  return pdf.output("blob");
}

function safeMaterialLines(values: string[]): string[] {
  return values.filter((value) => value.trim() && classifyEvidenceAdmissibility(value) === "claim");
}

function materialsText(pack: ResumePack, lanes: TargetLane[], dossier: CareerDossier): string {
  const pitches = pack.lanePacks.map((lanePack) => {
    const lane = lanes.find((item) => item.id === lanePack.laneId);
    return `${lane?.title ?? "Custom lane"}: ${lanePack.positioningPitch}`;
  }).join("\n");
  const approvedFacts = dossier.evidence
    .filter((item) => item.approved && !item.rejected && isProfessionalEvidence(item))
    .map((item) => item.detail);
  return [
    "DRAFT MATERIALS — REVIEW EVERY CLAIM BEFORE USE",
    "",
    "LINKEDIN HEADLINE OPTIONS",
    ...safeMaterialLines(pack.linkedinHeadlines),
    "",
    "LINKEDIN ABOUT",
    safeMaterialLines([pack.linkedinAbout]).join("\n"),
    "",
    "RECOMMENDED LINKEDIN SKILLS",
    safeMaterialLines(pack.linkedinSkills).join(", "),
    "",
    "LANE POSITIONING PITCHES",
    pitches,
    "",
    "MASTER PROOF BANK",
    ...safeMaterialLines(pack.masterProofBank).map((item) => `- ${item}`),
    "",
    "APPROVED PROFESSIONAL EVIDENCE FOR COVER-LETTER DRAFTING",
    ...approvedFacts.slice(0, 8).map((item) => `- ${item}`)
  ].join("\n");
}

function readmeText(pack: ResumePack, lanes: TargetLane[], formats: PackExportFormat[]): string {
  return [
    "Career Forge Résumé Pack — Public Beta",
    "",
    `Generated: ${pack.createdAt}`,
    `Formats: ${formats.join(", ").toUpperCase()}`,
    "",
    "IMPORTANT: Every generated document is a draft. Review every claim, heading, date, and layout before using it.",
    "Use the ATS Submission résumé for application portals and direct submissions.",
    "Use the Recruiter / Networking résumé for referrals, conversations, and human-first sharing.",
    "Tailor a copy for each specific job; keep these originals unchanged as your starting points.",
    "",
    "Lanes:",
    ...pack.lanePacks.map((item) => `- ${lanes.find((lane) => lane.id === item.laneId)?.title ?? "Custom lane"}`),
    "",
    "Evidence receipt:",
    `- Approved professional evidence used: ${pack.receipt.evidenceUsed.length}`,
    `- Approved professional evidence not used by these documents: ${pack.receipt.evidenceOmitted.length}`,
    `- Unsupported or context-only claims refused: ${pack.receipt.unsupportedClaimsRefused.length}`
  ].join("\n");
}

export async function createPackBundle(
  pack: ResumePack,
  dossier: CareerDossier,
  lanes: TargetLane[],
  formats: PackExportFormat[]
): Promise<{ blob: Blob; filename: string; filenames: string[] }> {
  const zip = new JSZip();
  const filenames: string[] = [];
  const used = new Set<string>();
  const uniqueName = (filename: string): string => {
    if (!used.has(filename)) { used.add(filename); return filename; }
    const dot = filename.lastIndexOf(".");
    for (let n = 2; ; n += 1) {
      const candidate = `${filename.slice(0, dot)}-${n}${filename.slice(dot)}`;
      if (!used.has(candidate)) { used.add(candidate); return candidate; }
    }
  };
  for (const variant of pack.variants.filter((item) => item.kind !== "job-specific")) {
    const laneTitle = lanes.find((lane) => lane.id === variant.laneId)?.title ?? "General";
    const safeResume = sanitizeResumeForProfessionalUse(variant.resume);
    for (const format of formats) {
      const filename = uniqueName(resumeVariantFilename(dossier.identity.fullName, laneTitle, variant.kind, format));
      const blob = format === "docx"
        ? await docxBlob(dossier, safeResume, variant.kind, variant.sectionOrder)
        : pdfBlob(dossier, safeResume, variant.kind, variant.sectionOrder);
      zip.file(filename, await blob.arrayBuffer());
      filenames.push(filename);
    }
  }
  zip.file("LinkedIn-and-Career-Materials.txt", materialsText(pack, lanes, dossier));
  zip.file("README.txt", readmeText(pack, lanes, formats));
  filenames.push("LinkedIn-and-Career-Materials.txt", "README.txt");
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { blob, filename: `${slug(dossier.identity.fullName, "Career-Forge-User")}-Resume-Pack.zip`, filenames };
}

export async function createVariantFile(
  variant: ResumeVariant,
  dossier: CareerDossier,
  laneTitle: string,
  format: PackExportFormat
): Promise<{ blob: Blob; filename: string }> {
  const safeResume = sanitizeResumeForProfessionalUse(variant.resume);
  return {
    blob: format === "docx"
      ? await docxBlob(dossier, safeResume, variant.kind, variant.sectionOrder)
      : pdfBlob(dossier, safeResume, variant.kind, variant.sectionOrder),
    filename: resumeVariantFilename(dossier.identity.fullName, laneTitle, variant.kind, format)
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
