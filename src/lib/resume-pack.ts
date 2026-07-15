import type { ResumePackage } from "@/types/career";
import type { TargetLane } from "@/types/command-center";
import type {
  CareerDossier,
  DossierEvidenceRecord,
  ResumeEvidenceReference,
  ResumePack,
  ResumeVariant
} from "@/types/dossier";

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function packId(nowIso: string): string {
  return `pack-${nowIso.replace(/\D/g, "").slice(0, 17)}`;
}

function words(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9+#.]{3,}/g)?.filter((word) => !["with", "from", "that", "this", "your", "their", "into", "using", "years", "role"].includes(word)) ?? []);
}

function relevance(item: DossierEvidenceRecord, lane: TargetLane): number {
  const evidenceWords = words(`${item.label} ${item.detail}`);
  const laneWords = words(`${lane.title} ${lane.resumeAngle} ${lane.keywords.join(" ")} ${lane.proof.join(" ")}`);
  let score = 0;
  laneWords.forEach((word) => { if (evidenceWords.has(word)) score += 2; });
  if (["role", "project", "responsibility", "proof", "metric"].includes(item.kind)) score += 1;
  return score;
}

function approvedEvidence(dossier: CareerDossier): DossierEvidenceRecord[] {
  return dossier.evidence.filter((item) => item.approved && !item.rejected);
}

function evidenceByIds(approved: DossierEvidenceRecord[], ids: string[]): DossierEvidenceRecord[] {
  const wanted = new Set(ids);
  return approved.filter((item) => wanted.has(item.id));
}

function refsForResume(
  resume: ResumePackage,
  mapping: Map<string, { evidenceIds: string[]; supportType: ResumeEvidenceReference["supportType"] }>
): ResumeEvidenceReference[] {
  const references: ResumeEvidenceReference[] = [];
  const add = (claimPath: string, claimText: string) => {
    const support = mapping.get(claimText);
    if (claimText.trim() && support?.evidenceIds.length) references.push({ claimPath, claimText, ...support });
  };
  add("summary", resume.summary);
  resume.coreSkills.forEach((claim, index) => add(`coreSkills.${index}`, claim));
  resume.experience.forEach((role, roleIndex) => {
    add(`experience.${roleIndex}.heading`, [role.title, role.company, role.time].filter(Boolean).join(" · "));
    role.bullets.forEach((claim, index) => add(`experience.${roleIndex}.bullets.${index}`, claim));
  });
  add("education", resume.education);
  add("linkedinHeadline", resume.linkedinHeadline);
  add("linkedinSummary", resume.linkedinSummary);
  return references;
}

function buildLaneResume(
  dossier: CareerDossier,
  lane: TargetLane,
  kind: "ats" | "recruiter"
): { resume: ResumePackage; references: ResumeEvidenceReference[]; evidenceUsed: string[] } {
  const approved = approvedEvidence(dossier);
  const ranked = [...approved].sort((a, b) => relevance(b, lane) - relevance(a, lane));
  const relevant = ranked.filter((item) => relevance(item, lane) > 0);
  const chosen = unique((relevant.length ? relevant : ranked).slice(0, kind === "ats" ? 18 : 10).map((item) => item.id));
  const chosenSet = new Set(chosen);
  const mapping = new Map<string, { evidenceIds: string[]; supportType: ResumeEvidenceReference["supportType"] }>();
  const mapClaim = (claim: string, ids: string[], supportType: ResumeEvidenceReference["supportType"] = "direct") => {
    const valid = unique(ids).filter((id) => chosenSet.has(id));
    if (claim.trim() && valid.length) mapping.set(claim, { evidenceIds: valid, supportType });
  };

  const skills = ranked.filter((item) => chosenSet.has(item.id) && (item.kind === "skill" || item.kind === "tool"))
    .slice(0, kind === "ats" ? 14 : 6).map((item) => { mapClaim(item.detail, [item.id]); return item.detail; });
  const proof = ranked.filter((item) => chosenSet.has(item.id) && ["role", "project", "responsibility", "proof", "metric"].includes(item.kind));
  const summaryEvidence = proof.slice(0, kind === "ats" ? 2 : 3);
  const summary = summaryEvidence.length
    ? kind === "ats"
      ? `${lane.title} focus backed by approved experience: ${summaryEvidence.map((item) => item.detail).join("; ")}.`
      : `Building toward ${lane.title} through hands-on work: ${summaryEvidence.map((item) => item.detail).join("; ")}.`
    : `Career focus: ${lane.title}. Add approved role or project evidence before using this résumé.`;
  mapClaim(summary, summaryEvidence.map((item) => item.id), "transferred");

  const roleEntries = dossier.roles.flatMap((role) => {
    const support = evidenceByIds(approved, role.evidenceIds).filter((item) => chosenSet.has(item.id));
    if (!support.length) return [];
    const heading = [role.title, role.employer, [role.startDate, role.endDate].filter(Boolean).join("–")].filter(Boolean).join(" · ");
    mapClaim(heading, support.map((item) => item.id));
    const bulletPool = unique([...role.outcomes, ...role.responsibilities]);
    const bullets = bulletPool.flatMap((bullet) => {
      const exact = support.filter((item) => item.detail.toLowerCase().includes(bullet.toLowerCase()) || bullet.toLowerCase().includes(item.detail.toLowerCase()));
      if (!exact.length) return [];
      mapClaim(bullet, exact.map((item) => item.id));
      return [bullet];
    }).slice(0, kind === "ats" ? 5 : 3);
    return [{ title: role.title, company: role.employer, time: [role.startDate, role.endDate].filter(Boolean).join("–"), bullets }];
  });

  const projectEntries = dossier.projects.flatMap((project) => {
    if (project.defaultPlacement === "omit") return [];
    const support = evidenceByIds(approved, project.evidenceIds).filter((item) => chosenSet.has(item.id));
    if (!support.length) return [];
    const heading = [project.name, project.organization, project.dates].filter(Boolean).join(" · ");
    mapClaim(heading, support.map((item) => item.id));
    const bulletPool = unique([project.description, ...project.outcomes, ...project.metrics, ...project.responsibilities]);
    const bullets = bulletPool.flatMap((bullet) => {
      const exact = support.filter((item) => item.detail.toLowerCase().includes(bullet.toLowerCase()) || bullet.toLowerCase().includes(item.detail.toLowerCase()));
      if (!exact.length) return [];
      mapClaim(bullet, exact.map((item) => item.id));
      return [bullet];
    }).slice(0, kind === "ats" ? 5 : 4);
    return [{ title: project.name, company: project.organization || "Independent project", time: project.dates, bullets }];
  });

  const experience = kind === "ats" ? [...roleEntries, ...projectEntries] : [...projectEntries, ...roleEntries];
  const educationEntries = dossier.education.flatMap((item) => {
    const support = evidenceByIds(approved, item.evidenceIds).filter((evidence) => chosenSet.has(evidence.id));
    if (!support.length) return [];
    const text = [item.credential, item.field, item.institution, item.dates].filter(Boolean).join(", ");
    mapClaim(text, support.map((evidence) => evidence.id));
    return [text];
  });
  const education = educationEntries.join("; ");
  const headline = `${lane.title} | ${kind === "ats" ? skills.slice(0, 3).join(" | ") : "Projects, support, and practical execution"}`.replace(/ \| $/, "");
  const headlineSupport = unique([...summaryEvidence.map((item) => item.id), ...ranked.filter((item) => skills.includes(item.detail)).map((item) => item.id)]);
  mapClaim(headline, headlineSupport, "transferred");
  const linkedinSummary = kind === "recruiter" ? summary : `Targeting ${lane.title}. ${summary}`;
  mapClaim(linkedinSummary, summaryEvidence.map((item) => item.id), "transferred");
  const resume = { summary, coreSkills: skills, experience, education, linkedinHeadline: headline, linkedinSummary };
  return { resume, references: refsForResume(resume, mapping), evidenceUsed: chosen };
}

function createVariant(pack: string, lane: TargetLane, kind: "ats" | "recruiter", dossier: CareerDossier, nowIso: string): ResumeVariant {
  const built = buildLaneResume(dossier, lane, kind);
  return {
    id: `${pack}-${lane.id}-${kind}`, laneId: lane.id, kind,
    title: `${lane.title} — ${kind === "ats" ? "ATS Submission" : "Recruiter / Networking"}`,
    status: built.references.length >= 3 ? "current" : "missing-evidence", canonical: true, userEdited: false,
    resume: built.resume, template: kind === "ats" ? "Modern ATS" : "Corporate", evidenceReferences: built.references,
    userAuthoredPaths: [], sectionOrder: kind === "ats"
      ? ["summary", "skills", "experience", "projects", "education"]
      : ["summary", "projects", "experience", "skills", "education"],
    sourceDossierUpdatedAt: dossier.updatedAt, baselineVariantId: null, applicationId: null,
    createdAt: nowIso, updatedAt: nowIso
  };
}

export function generateResumePack(dossier: CareerDossier, lanes: TargetLane[], nowIso = new Date().toISOString()): ResumePack {
  const active = lanes.filter((lane) => lane.status === "active").slice(0, 3);
  const id = packId(nowIso);
  const approved = approvedEvidence(dossier);
  const variants: ResumeVariant[] = [];
  const lanePacks = active.map((lane) => {
    const ats = createVariant(id, lane, "ats", dossier, nowIso);
    const recruiter = createVariant(id, lane, "recruiter", dossier, nowIso);
    variants.push(ats, recruiter);
    const evidenceUsed = unique([...ats.evidenceReferences, ...recruiter.evidenceReferences].flatMap((item) => item.evidenceIds));
    return {
      laneId: lane.id, positioningPitch: lane.resumeAngle || `${lane.title} positioned through approved, transferable evidence.`,
      variantIds: [ats.id, recruiter.id], evidenceUsed,
      evidenceOmitted: approved.filter((item) => !evidenceUsed.includes(item.id)).map((item) => item.id), gapsAvoided: lane.gaps
    };
  });
  const used = unique(variants.flatMap((variant) => variant.evidenceReferences.flatMap((reference) => reference.evidenceIds)));
  const transferred = unique(variants.flatMap((variant) => variant.evidenceReferences.filter((reference) => reference.supportType === "transferred").map((reference) => reference.claimText)));
  const first = variants[0]?.resume;
  return {
    id, dossierId: dossier.id, status: "current", lanePacks, variants,
    linkedinHeadlines: unique(variants.map((item) => item.resume.linkedinHeadline)).slice(0, 6),
    linkedinAbout: first?.linkedinSummary || first?.summary || "",
    linkedinSkills: unique(variants.flatMap((item) => item.resume.coreSkills)).slice(0, 30),
    masterProofBank: unique(dossier.proofPoints.concat(approved.filter((item) => item.kind === "proof" || item.kind === "metric").map((item) => item.detail))),
    coverLetterFoundation: approved.length ? `Approved evidence to draw from: ${approved.slice(0, 3).map((item) => item.detail).join("; ")}` : "Approve proof points before drafting a cover letter.",
    receipt: {
      id: `${id}-receipt`, generatedAt: nowIso, evidenceUsed: used,
      evidenceOmitted: approved.filter((item) => !used.includes(item.id)).map((item) => item.id),
      laneFraming: active.map((lane) => ({ laneId: lane.id, angle: lane.resumeAngle })),
      keywordsIncluded: unique(active.flatMap((lane) => lane.keywords).filter((keyword) => approved.some((item) => item.detail.toLowerCase().includes(keyword.toLowerCase())))),
      gapsAvoided: unique(active.flatMap((lane) => lane.gaps)), unsupportedClaimsRefused: unique(active.flatMap((lane) => lane.gaps)),
      transferredClaims: transferred, gapsLeftUnclaimed: unique(active.flatMap((lane) => lane.gaps))
    },
    createdAt: nowIso, updatedAt: nowIso
  };
}

export function updatePackVariant(pack: ResumePack, variantId: string, resume: ResumePackage, nowIso = new Date().toISOString(), userAuthoredPaths: string[] = ["document"]): ResumePack {
  return {
    ...pack, status: "needs-review",
    variants: pack.variants.map((item) => item.id === variantId ? {
      ...item, resume, userEdited: true, userAuthoredPaths: unique([...item.userAuthoredPaths, ...userAuthoredPaths]), status: "needs-review", updatedAt: nowIso
    } : item),
    updatedAt: nowIso
  };
}

export function preserveUserEditedVariants(previous: ResumePack | undefined, next: ResumePack): ResumePack {
  if (!previous) return next;
  return {
    ...next,
    variants: next.variants.map((variant) => {
      const old = previous.variants.find((item) => item.laneId === variant.laneId && item.kind === variant.kind && item.userEdited);
      return old ? { ...old, status: "out-of-date", sourceDossierUpdatedAt: variant.sourceDossierUpdatedAt } : variant;
    })
  };
}
