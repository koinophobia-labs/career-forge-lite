import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { ResumePackage } from "@/types/career";
import type { CareerDossier, ResumePack, ResumeVariant } from "@/types/dossier";
import type { TargetLane } from "@/types/command-center";
import { isPlaceholderEducation } from "@/lib/resume-export";
import { stripTerminationReasons } from "@/lib/truth-guards";

export type PackExportFormat = "pdf" | "docx";
export type SectionKey = ResumeVariant["sectionOrder"][number];

const DEFAULT_SECTION_ORDER: SectionKey[] = ["summary", "skills", "experience", "projects", "education"];

export type ExportSection =
  | { key: "summary" | "skills" | "education"; heading: string; text: string }
  | { key: "experience"; heading: string; roles: ResumePackage["experience"] };

// Resolves the render plan for one document. Single source of truth for every
// format (PDF, DOCX, plain text) so they cannot drift: the variant's chosen
// sectionOrder is respected, empty sections are dropped entirely (never an
// empty heading), and the summary passes through the termination-reason guard
// as an export-time safety net on top of the generation-side filter.
// "projects" has no dedicated ResumePackage section — project work is already
// folded into experience — so that key renders nothing extra.
export function exportSections(
  resume: ResumePackage,
  sectionOrder?: SectionKey[],
  kind: ResumeVariant["kind"] = "ats"
): { sections: ExportSection[]; withheldFacts: string[] } {
  const order = sectionOrder?.length ? sectionOrder : DEFAULT_SECTION_ORDER;
  const withheldFacts: string[] = [];
  const sections: ExportSection[] = [];
  for (const key of order) {
    if (key === "summary") {
      const cleaned = stripTerminationReasons(resume.summary ?? "");
      if (cleaned.withheld) withheldFacts.push("reason for leaving");
      if (cleaned.text.trim()) sections.push({ key, heading: "Professional Summary", text: cleaned.text.trim() });
    } else if (key === "skills") {
      const skills = resume.coreSkills.filter((skill) => skill.trim());
      if (skills.length) sections.push({ key, heading: "Core Skills", text: skills.join(" | ") });
    } else if (key === "experience") {
      const roles = resume.experience.filter((role) => [role.title, role.company, role.time, ...role.bullets].some((value) => value?.trim()));
      if (roles.length) sections.push({ key, heading: kind === "recruiter" ? "Selected Experience & Projects" : "Experience", roles });
    } else if (key === "education") {
      const education = (resume.education ?? "").trim();
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

// Full plain-text serialization of one variant — clipboard/paste-into-portal
// path. Reads identity from the CURRENT dossier at call time, so a name added
// after forging still lands on the copied document.
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
      parts.push(`${section.heading.toUpperCase()}\n${resume.coreSkills.filter((skill) => skill.trim()).join(", ")}`);
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
    ensure(32);
    y += 7;
    pdf.setDrawColor(kind === "recruiter" ? 50 : 30, kind === "recruiter" ? 85 : 55, kind === "recruiter" ? 75 : 95);
    pdf.setLineWidth(0.7);
    write(text.toUpperCase(), { bold: true, size: 10, after: 3 });
    pdf.line(margin, y - 2, margin + width, y - 2);
    y += 5;
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

function materialsText(pack: ResumePack, lanes: TargetLane[]): string {
  const pitches = pack.lanePacks.map((lanePack) => {
    const lane = lanes.find((item) => item.id === lanePack.laneId);
    return `${lane?.title ?? "Custom lane"}: ${lanePack.positioningPitch}`;
  }).join("\n");
  return [
    "LINKEDIN HEADLINE OPTIONS", ...pack.linkedinHeadlines, "", "LINKEDIN ABOUT", pack.linkedinAbout,
    "", "RECOMMENDED LINKEDIN SKILLS", pack.linkedinSkills.join(", "), "", "LANE POSITIONING PITCHES", pitches,
    "", "MASTER PROOF BANK", ...pack.masterProofBank.map((item) => `- ${item}`), "", "COVER LETTER FOUNDATION", pack.coverLetterFoundation
  ].join("\n");
}

function readmeText(pack: ResumePack, lanes: TargetLane[], formats: PackExportFormat[]): string {
  return [
    "Career Forge Résumé Pack",
    "",
    `Generated: ${pack.createdAt}`,
    `Formats: ${formats.join(", ").toUpperCase()}`,
    "",
    "Use the ATS Submission résumé for application portals and direct submissions.",
    "Use the Recruiter / Networking résumé for referrals, conversations, and human-first sharing.",
    "Tailor a copy for each specific job; keep these originals unchanged as your starting points.",
    "",
    "Lanes:",
    // Internal lane ids never ship in exported documents.
    ...pack.lanePacks.map((item) => `- ${lanes.find((lane) => lane.id === item.laneId)?.title ?? "Custom lane"}`),
    "",
    "Evidence receipt:",
    `- Approved evidence used: ${pack.receipt.evidenceUsed.length}`,
    // evidenceOmitted holds APPROVED items these documents didn't use — never
    // call them "unapproved" (that misstates the user's own decisions).
    `- Approved evidence not used by these documents: ${pack.receipt.evidenceOmitted.length}`,
    `- Unsupported claims refused: ${pack.receipt.unsupportedClaimsRefused.length}`
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
  // Duplicated variants (same lane + kind) produce identical filenames; suffix
  // -2, -3… so no document silently overwrites another inside the ZIP.
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
    for (const format of formats) {
      const filename = uniqueName(resumeVariantFilename(dossier.identity.fullName, laneTitle, variant.kind, format));
      const blob = format === "docx"
        ? await docxBlob(dossier, variant.resume, variant.kind, variant.sectionOrder)
        : pdfBlob(dossier, variant.resume, variant.kind, variant.sectionOrder);
      zip.file(filename, await blob.arrayBuffer());
      filenames.push(filename);
    }
  }
  zip.file("LinkedIn-and-Career-Materials.txt", materialsText(pack, lanes));
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
  return {
    blob: format === "docx"
      ? await docxBlob(dossier, variant.resume, variant.kind, variant.sectionOrder)
      : pdfBlob(dossier, variant.resume, variant.kind, variant.sectionOrder),
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
