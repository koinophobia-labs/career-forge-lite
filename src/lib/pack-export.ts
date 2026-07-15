import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import type { ResumePackage } from "@/types/career";
import type { CareerDossier, ResumePack, ResumeVariant } from "@/types/dossier";
import type { TargetLane } from "@/types/command-center";

export type PackExportFormat = "pdf" | "docx";

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

function resumeLines(dossier: CareerDossier, resume: ResumePackage): string[] {
  const contact = [dossier.identity.email, dossier.identity.phone, dossier.identity.location, ...dossier.identity.links]
    .filter(Boolean)
    .join(" | ");
  const lines = [dossier.identity.fullName, contact, "", "PROFESSIONAL SUMMARY", resume.summary, "", "CORE SKILLS", resume.coreSkills.join(" | "), "", "EXPERIENCE"];
  resume.experience.forEach((role) => {
    lines.push("", [role.title, role.company, role.time].filter(Boolean).join(" | "));
    role.bullets.forEach((bullet) => lines.push(`• ${bullet}`));
  });
  if (resume.education) lines.push("", "EDUCATION", resume.education);
  return lines;
}

async function docxBlob(dossier: CareerDossier, resume: ResumePackage): Promise<Blob> {
  const children: Paragraph[] = [];
  const contact = [dossier.identity.email, dossier.identity.phone, dossier.identity.location, ...dossier.identity.links]
    .filter(Boolean)
    .join(" | ");
  children.push(new Paragraph({ text: dossier.identity.fullName || "Résumé", heading: HeadingLevel.TITLE }));
  if (contact) children.push(new Paragraph({ text: contact }));
  children.push(new Paragraph({ text: "Professional Summary", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: resume.summary }));
  children.push(new Paragraph({ text: "Core Skills", heading: HeadingLevel.HEADING_1 }));
  children.push(new Paragraph({ text: resume.coreSkills.join(" | ") }));
  children.push(new Paragraph({ text: "Experience", heading: HeadingLevel.HEADING_1 }));
  resume.experience.forEach((role) => {
    children.push(new Paragraph({ children: [new TextRun({ text: [role.title, role.company, role.time].filter(Boolean).join(" | "), bold: true })] }));
    role.bullets.forEach((bullet) => children.push(new Paragraph({ text: bullet, bullet: { level: 0 } })));
  });
  if (resume.education) {
    children.push(new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_1 }));
    children.push(new Paragraph({ text: resume.education }));
  }
  const document = new Document({ sections: [{ properties: {}, children }] });
  return Packer.toBlob(document);
}

function pdfBlob(dossier: CareerDossier, resume: ResumePackage): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 54;
  const width = 612 - margin * 2;
  let y = 58;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const write = (line: string) => {
    const wrapped = pdf.splitTextToSize(line || " ", width) as string[];
    wrapped.forEach((part) => {
      if (y > 738) { pdf.addPage(); y = 58; }
      pdf.text(part, margin, y);
      y += 14;
    });
  };
  resumeLines(dossier, resume).forEach(write);
  return pdf.output("blob");
}

function materialsText(pack: ResumePack, lanes: TargetLane[]): string {
  const pitches = pack.lanePacks.map((lanePack) => {
    const lane = lanes.find((item) => item.id === lanePack.laneId);
    return `${lane?.title ?? "Lane"}: ${lanePack.positioningPitch}`;
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
    "Tailor from the closest lane baseline; never overwrite the canonical baseline.",
    "",
    "Lanes:",
    ...pack.lanePacks.map((item) => `- ${lanes.find((lane) => lane.id === item.laneId)?.title ?? item.laneId}`),
    "",
    "Evidence receipt:",
    `- Approved evidence used: ${pack.receipt.evidenceUsed.length}`,
    `- Unapproved evidence omitted: ${pack.receipt.evidenceOmitted.length}`,
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
  for (const variant of pack.variants.filter((item) => item.kind !== "job-specific")) {
    const laneTitle = lanes.find((lane) => lane.id === variant.laneId)?.title ?? "General";
    for (const format of formats) {
      const filename = resumeVariantFilename(dossier.identity.fullName, laneTitle, variant.kind, format);
      const blob = format === "docx" ? await docxBlob(dossier, variant.resume) : pdfBlob(dossier, variant.resume);
      zip.file(filename, blob);
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
    blob: format === "docx" ? await docxBlob(dossier, variant.resume) : pdfBlob(dossier, variant.resume),
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
