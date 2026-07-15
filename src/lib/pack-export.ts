import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
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

async function docxBlob(dossier: CareerDossier, resume: ResumePackage, kind: ResumeVariant["kind"] = "ats"): Promise<Blob> {
  const children: Paragraph[] = [];
  const contact = [dossier.identity.email, dossier.identity.phone, dossier.identity.location, ...dossier.identity.links]
    .filter(Boolean)
    .join(" | ");
  children.push(new Paragraph({ text: dossier.identity.fullName || "Résumé", heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, keepNext: true }));
  if (contact) children.push(new Paragraph({ text: contact, alignment: AlignmentType.CENTER, spacing: { after: 180 } }));
  children.push(new Paragraph({ text: "Professional Summary", heading: HeadingLevel.HEADING_1, keepNext: true }));
  children.push(new Paragraph({ text: resume.summary }));
  children.push(new Paragraph({ text: "Core Skills", heading: HeadingLevel.HEADING_1, keepNext: true }));
  children.push(new Paragraph({ text: resume.coreSkills.join(" | ") }));
  children.push(new Paragraph({ text: kind === "recruiter" ? "Selected Experience & Projects" : "Experience", heading: HeadingLevel.HEADING_1, keepNext: true }));
  resume.experience.forEach((role) => {
    children.push(new Paragraph({ keepNext: role.bullets.length > 0, spacing: { before: 120, after: 40 }, children: [new TextRun({ text: [role.title, role.company, role.time].filter(Boolean).join(" | "), bold: true })] }));
    role.bullets.forEach((bullet) => children.push(new Paragraph({ text: bullet, bullet: { level: 0 } })));
  });
  if (resume.education) {
    children.push(new Paragraph({ text: "Education", heading: HeadingLevel.HEADING_1, keepNext: true }));
    children.push(new Paragraph({ text: resume.education }));
  }
  const document = new Document({
    styles: { default: { document: { run: { font: kind === "recruiter" ? "Georgia" : "Arial", size: 21 }, paragraph: { spacing: { after: 80, line: 260 } } } } },
    sections: [{ properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } }, children }]
  });
  return Packer.toBlob(document);
}

function pdfBlob(dossier: CareerDossier, resume: ResumePackage, kind: ResumeVariant["kind"] = "ats"): Blob {
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
  const contact = [dossier.identity.email, dossier.identity.phone, dossier.identity.location, ...dossier.identity.links].filter(Boolean).join(" | ");
  if (contact) write(contact, { size: 9, after: 5 });
  heading("Professional Summary");
  write(resume.summary, { after: 4 });
  if (resume.coreSkills.length) {
    heading("Core Skills");
    write(resume.coreSkills.join(" | "), { after: 3 });
  }
  heading(kind === "recruiter" ? "Selected Experience & Projects" : "Experience");
  resume.experience.forEach((role) => {
    ensure(42);
    write([role.title, role.company, role.time].filter(Boolean).join(" | "), { bold: true, after: 2 });
    role.bullets.forEach((bullet) => write(`•  ${bullet}`, { indent: 10, after: 1 }));
    y += 3;
  });
  if (resume.education) { heading("Education"); write(resume.education); }
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
      const blob = format === "docx" ? await docxBlob(dossier, variant.resume, variant.kind) : pdfBlob(dossier, variant.resume, variant.kind);
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
    blob: format === "docx" ? await docxBlob(dossier, variant.resume, variant.kind) : pdfBlob(dossier, variant.resume, variant.kind),
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
