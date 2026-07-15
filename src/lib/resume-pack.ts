import { generateResumePackage } from "@/lib/generator";
import { intakeFromDossier } from "@/lib/dossier";
import type { TargetLane } from "@/types/command-center";
import type { CareerDossier, ResumeEvidenceReference, ResumePack, ResumeVariant } from "@/types/dossier";
import type { ResumePackage } from "@/types/career";

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function packId(nowIso: string): string {
  return `pack-${nowIso.replace(/\D/g, "").slice(0, 17)}`;
}

function approvedEvidenceIds(dossier: CareerDossier): string[] {
  return dossier.evidence.filter((item) => item.approved).map((item) => item.id);
}

function evidenceReferences(resume: ResumePackage, evidenceIds: string[]): ResumeEvidenceReference[] {
  const refs: ResumeEvidenceReference[] = [];
  const add = (claimPath: string, claimText: string) => {
    if (claimText.trim()) refs.push({ claimPath, claimText, evidenceIds: [...evidenceIds] });
  };
  add("summary", resume.summary);
  resume.coreSkills.forEach((skill, index) => add(`coreSkills.${index}`, skill));
  resume.experience.forEach((role, roleIndex) => {
    add(`experience.${roleIndex}.heading`, [role.title, role.company, role.time].filter(Boolean).join(" · "));
    role.bullets.forEach((bullet, bulletIndex) => add(`experience.${roleIndex}.bullets.${bulletIndex}`, bullet));
  });
  add("education", resume.education);
  add("linkedinHeadline", resume.linkedinHeadline);
  add("linkedinSummary", resume.linkedinSummary);
  return refs;
}

function recruiterVariant(base: ResumePackage, dossier: CareerDossier, lane: TargetLane): ResumePackage {
  const approvedSkills = dossier.evidence
    .filter((item) => item.approved && (item.kind === "skill" || item.kind === "tool"))
    .map((item) => item.detail);
  const lead = unique(approvedSkills).slice(0, 2).join(" and ");
  const fallbackProof = dossier.evidence.find((item) => item.approved && ["role", "project", "responsibility", "proof"].includes(item.kind))?.detail ?? "";
  const narrative = lead
    ? `${lane.title} candidate bringing ${lead}. ${base.summary}`
    : fallbackProof
      ? `${lane.title} candidate grounded in this approved evidence: ${fallbackProof}. ${base.summary}`
      : base.summary;
  return {
    ...base,
    summary: narrative,
    coreSkills: [...base.coreSkills].reverse(),
    experience: base.experience.map((role) => ({ ...role, bullets: [...role.bullets].reverse() })),
    linkedinHeadline: base.linkedinHeadline,
    linkedinSummary: narrative
  };
}

function variant(
  pack: string,
  lane: TargetLane,
  kind: "ats" | "recruiter",
  resume: ResumePackage,
  dossier: CareerDossier,
  nowIso: string
): ResumeVariant {
  const evidenceIds = approvedEvidenceIds(dossier);
  return {
    id: `${pack}-${lane.id}-${kind}`,
    laneId: lane.id,
    kind,
    title: `${lane.title} — ${kind === "ats" ? "ATS Submission" : "Recruiter / Networking"}`,
    status: evidenceIds.length >= 3 ? "current" : "missing-evidence",
    canonical: true,
    userEdited: false,
    resume,
    template: "Modern ATS",
    evidenceReferences: evidenceReferences(resume, evidenceIds),
    sourceDossierUpdatedAt: dossier.updatedAt,
    baselineVariantId: null,
    applicationId: null,
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

export function generateResumePack(
  dossier: CareerDossier,
  lanes: TargetLane[],
  nowIso = new Date().toISOString()
): ResumePack {
  const active = lanes.filter((lane) => lane.status === "active").slice(0, 3);
  const id = packId(nowIso);
  const approved = dossier.evidence.filter((item) => item.approved);
  const omitted = dossier.evidence.filter((item) => !item.approved);
  const variants: ResumeVariant[] = [];
  const lanePacks = active.map((lane) => {
    const intake = intakeFromDossier(dossier, lane.title);
    const base = generateResumePackage(intake);
    const ats = variant(id, lane, "ats", base, dossier, nowIso);
    const recruiter = variant(id, lane, "recruiter", recruiterVariant(base, dossier, lane), dossier, nowIso);
    variants.push(ats, recruiter);
    return {
      laneId: lane.id,
      positioningPitch: lane.resumeAngle || `${lane.title} positioned through approved, transferable evidence.`,
      variantIds: [ats.id, recruiter.id],
      evidenceUsed: approved.map((item) => item.id),
      evidenceOmitted: omitted.map((item) => item.id),
      gapsAvoided: lane.gaps
    };
  });
  const first = variants[0]?.resume;
  const headlines = unique(variants.map((item) => item.resume.linkedinHeadline)).slice(0, 6);
  const linkedinSkills = unique(variants.flatMap((item) => item.resume.coreSkills)).slice(0, 30);
  const masterProofBank = unique([
    ...dossier.proofPoints,
    ...approved.filter((item) => item.kind === "proof" || item.kind === "metric").map((item) => item.detail)
  ]);
  const coverEvidence = masterProofBank.slice(0, 3).join(" ");
  return {
    id,
    dossierId: dossier.id,
    status: "current",
    lanePacks,
    variants,
    linkedinHeadlines: headlines,
    linkedinAbout: first?.linkedinSummary || first?.summary || "",
    linkedinSkills,
    masterProofBank,
    coverLetterFoundation: coverEvidence
      ? `I am interested in roles where this evidence is relevant: ${coverEvidence}`
      : "Add and approve proof points before creating a cover-letter foundation.",
    receipt: {
      id: `${id}-receipt`,
      generatedAt: nowIso,
      evidenceUsed: approved.map((item) => item.id),
      evidenceOmitted: omitted.map((item) => item.id),
      laneFraming: active.map((lane) => ({ laneId: lane.id, angle: lane.resumeAngle })),
      keywordsIncluded: unique(active.flatMap((lane) => lane.keywords).filter((keyword) => {
        const corpus = approved.map((item) => item.detail).join(" ").toLowerCase();
        return corpus.includes(keyword.toLowerCase());
      })),
      gapsAvoided: unique(active.flatMap((lane) => lane.gaps)),
      unsupportedClaimsRefused: unique(active.flatMap((lane) => lane.gaps))
    },
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

export function updatePackVariant(
  pack: ResumePack,
  variantId: string,
  resume: ResumePackage,
  nowIso = new Date().toISOString()
): ResumePack {
  return {
    ...pack,
    status: "needs-review",
    variants: pack.variants.map((item) => item.id === variantId
      ? { ...item, resume, userEdited: true, status: "needs-review", updatedAt: nowIso }
      : item),
    updatedAt: nowIso
  };
}
