import { initialIntake } from "@/lib/career-data";
import type { IntakeData } from "@/types/career";
import type { CareerProfile, CommandCenterState, ResumeSnapshot } from "@/types/command-center";
import type {
  CareerDossier,
  DossierEducation,
  DossierEvidenceRecord,
  DossierProject,
  DossierRole,
  EvidenceKind,
  EvidenceSource,
  ImportProposalGroup,
  ImportProposalRecord
} from "@/types/dossier";

function compact(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}

export function emptyDossier(nowIso = new Date(0).toISOString()): CareerDossier {
  return {
    id: "dossier-local",
    identity: { fullName: "", email: "", phone: "", location: "", links: [] },
    roles: [],
    projects: [],
    education: [],
    responsibilities: [],
    tools: [],
    transferableSkills: [],
    outcomes: [],
    metrics: [],
    proofPoints: [],
    interviewStories: [],
    constraints: [],
    preferredWorkStyle: [],
    careerGoals: [],
    targetRoleInterests: [],
    approvedClaims: [],
    evidence: [],
    unstructuredNotes: [],
    migrationReview: [],
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function reviveDossier(raw: unknown, fallbackProfile?: CareerProfile): CareerDossier {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return fallbackProfile ? migrateLegacyProfile(fallbackProfile, fallbackProfile.updatedAt ?? new Date(0).toISOString()) : emptyDossier();
  }
  const source = raw as Record<string, unknown>;
  const base = emptyDossier(text(source.createdAt) || new Date(0).toISOString());
  const identityRaw = source.identity && typeof source.identity === "object" && !Array.isArray(source.identity)
    ? source.identity as Record<string, unknown>
    : {};
  const evidence = Array.isArray(source.evidence)
    ? source.evidence.flatMap((entry): DossierEvidenceRecord[] => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const item = entry as Record<string, unknown>;
        const detail = text(item.detail);
        const id = text(item.id);
        if (!id || !detail) return [];
        const kind = ["identity", "role", "project", "education", "responsibility", "tool", "skill", "metric", "proof", "story", "constraint", "goal"].includes(text(item.kind))
          ? text(item.kind) as EvidenceKind
          : "proof";
        return [{
          id,
          kind,
          label: text(item.label) || "Evidence",
          detail,
          source: ["guided", "story", "resume-import", "legacy-profile", "manual"].includes(text(item.source))
            ? text(item.source) as EvidenceSource
            : "manual",
          sourceText: text(item.sourceText) || detail,
          confidence: item.confidence === "low" || item.confidence === "medium" ? item.confidence : "high",
          approved: item.approved === true,
          rejected: item.rejected === true,
          sourceFilenames: strings(item.sourceFilenames),
          sourceExcerpts: strings(item.sourceExcerpts).length ? strings(item.sourceExcerpts) : compact([text(item.sourceText) || detail]),
          createdAt: text(item.createdAt) || base.createdAt,
          updatedAt: text(item.updatedAt) || base.createdAt
        }];
      })
    : [];
  const roles = Array.isArray(source.roles)
    ? source.roles.flatMap((entry): DossierRole[] => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const item = entry as Record<string, unknown>;
        if (!text(item.id) || (!text(item.title) && !text(item.employer))) return [];
        return [{
          id: text(item.id), title: text(item.title), employer: text(item.employer), startDate: text(item.startDate),
          endDate: text(item.endDate), current: item.current === true, responsibilities: strings(item.responsibilities),
          tools: strings(item.tools), outcomes: strings(item.outcomes), evidenceIds: strings(item.evidenceIds)
        }];
      })
    : [];
  const projects = Array.isArray(source.projects)
    ? source.projects.flatMap((entry): DossierProject[] => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const item = entry as Record<string, unknown>;
        if (!text(item.id) || !text(item.name)) return [];
        return [{
          id: text(item.id), name: text(item.name), organization: text(item.organization), dates: text(item.dates),
          description: text(item.description), responsibilities: strings(item.responsibilities), tools: strings(item.tools),
          outcomes: strings(item.outcomes), metrics: strings(item.metrics), links: strings(item.links),
          defaultPlacement: item.defaultPlacement === "experience" || item.defaultPlacement === "selected-projects" || item.defaultPlacement === "omit"
            ? item.defaultPlacement
            : "projects",
          evidenceIds: strings(item.evidenceIds)
        }];
      })
    : [];
  const education = Array.isArray(source.education)
    ? source.education.flatMap((entry): DossierEducation[] => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const item = entry as Record<string, unknown>;
        if (!text(item.id) || !text(item.credential)) return [];
        return [{ id: text(item.id), institution: text(item.institution), credential: text(item.credential), field: text(item.field), dates: text(item.dates), evidenceIds: strings(item.evidenceIds) }];
      })
    : [];
  return {
    ...base,
    id: text(source.id) || base.id,
    identity: {
      fullName: text(identityRaw.fullName), email: text(identityRaw.email), phone: text(identityRaw.phone),
      location: text(identityRaw.location), links: strings(identityRaw.links)
    },
    roles,
    projects,
    education,
    responsibilities: strings(source.responsibilities),
    tools: strings(source.tools),
    transferableSkills: strings(source.transferableSkills),
    outcomes: strings(source.outcomes),
    metrics: strings(source.metrics),
    proofPoints: strings(source.proofPoints),
    interviewStories: strings(source.interviewStories),
    constraints: strings(source.constraints),
    preferredWorkStyle: strings(source.preferredWorkStyle),
    careerGoals: strings(source.careerGoals),
    targetRoleInterests: strings(source.targetRoleInterests),
    approvedClaims: strings(source.approvedClaims),
    evidence,
    unstructuredNotes: strings(source.unstructuredNotes),
    migrationReview: strings(source.migrationReview),
    createdAt: text(source.createdAt) || base.createdAt,
    updatedAt: text(source.updatedAt) || base.updatedAt
  };
}

export function evidenceRecord(
  kind: EvidenceKind,
  detail: string,
  source: EvidenceSource,
  approved: boolean,
  nowIso: string,
  options?: { label?: string; sourceText?: string; confidence?: DossierEvidenceRecord["confidence"] }
): DossierEvidenceRecord {
  const normalized = detail.trim();
  return {
    id: stableId("evidence", `${kind}|${source}|${normalized.toLowerCase()}`),
    kind,
    label: options?.label ?? kind[0].toUpperCase() + kind.slice(1),
    detail: normalized,
    source,
    sourceText: options?.sourceText ?? normalized,
    confidence: options?.confidence ?? "high",
    approved,
    rejected: false,
    sourceFilenames: [],
    sourceExcerpts: compact([options?.sourceText ?? normalized]),
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

function mergeEvidence(current: DossierEvidenceRecord[], additions: DossierEvidenceRecord[]): DossierEvidenceRecord[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  additions.forEach((item) => {
    const previous = byId.get(item.id);
    byId.set(item.id, previous ? {
      ...previous,
      ...item,
      approved: previous.approved || item.approved,
      rejected: previous.rejected && item.rejected,
      sourceFilenames: compact([...previous.sourceFilenames, ...item.sourceFilenames]),
      sourceExcerpts: compact([...previous.sourceExcerpts, ...item.sourceExcerpts])
    } : item);
  });
  return [...byId.values()];
}

export function migrateLegacyProfile(profile: CareerProfile, nowIso = new Date().toISOString()): CareerDossier {
  const dossier = emptyDossier(nowIso);
  const evidence: DossierEvidenceRecord[] = [];
  const add = (kind: EvidenceKind, detail: string, label: string) => {
    if (detail.trim()) evidence.push(evidenceRecord(kind, detail, "legacy-profile", true, nowIso, { label }));
  };

  add("goal", profile.currentSituation, "Current situation");
  add("goal", profile.targetRoles, "Target roles");
  profile.transferableSkills.forEach((item) => add("skill", item, "Transferable skill"));
  add("role", profile.experienceSummary, "Legacy experience summary");
  profile.strengths.forEach((item) => add("skill", item, "Strength"));
  add("constraint", profile.constraints, "Constraint");
  add("goal", profile.workStyle, "Preferred work style");
  add("proof", profile.proofPoints, "Legacy proof points");

  return {
    ...dossier,
    transferableSkills: compact([...profile.transferableSkills, ...profile.strengths]),
    constraints: compact([profile.constraints]),
    preferredWorkStyle: compact([profile.workStyle]),
    careerGoals: compact([profile.currentSituation]),
    targetRoleInterests: compact(profile.targetRoles.split(/[,\n]/)),
    proofPoints: compact(profile.proofPoints.split(/\n+/)),
    approvedClaims: evidence.map((item) => item.detail),
    evidence,
    unstructuredNotes: compact([profile.experienceSummary]),
    migrationReview: profile.experienceSummary.trim()
      ? ["Review the legacy experience summary and convert it into structured roles or projects when ready."]
      : [],
    updatedAt: profile.updatedAt ?? nowIso
  };
}

export function mergeLegacyResumeSnapshots(
  dossier: CareerDossier,
  snapshots: ResumeSnapshot[],
  nowIso = dossier.updatedAt
): CareerDossier {
  if (!snapshots.length) return dossier;
  const roles = [...dossier.roles];
  const education = [...dossier.education];
  const evidence: DossierEvidenceRecord[] = [];
  const notes = [...dossier.unstructuredNotes];
  snapshots.forEach((snapshot) => {
    snapshot.resume.experience.forEach((experience) => {
      const heading = [experience.title, experience.company, experience.time].filter(Boolean).join(" · ");
      if (!heading) return;
      const record = evidenceRecord("role", heading, "legacy-profile", true, nowIso, { label: "Legacy builder role", sourceText: heading });
      const role: DossierRole = {
        id: stableId("role", heading.toLowerCase()), title: experience.title, employer: experience.company,
        startDate: experience.time, endDate: "", current: /present|current|now/i.test(experience.time),
        responsibilities: [], tools: [], outcomes: [], evidenceIds: [record.id]
      };
      if (!roles.some((item) => item.id === role.id)) roles.push(role);
      evidence.push(record);
      if (experience.bullets.length) notes.push(`Legacy generated résumé bullets for ${heading}: ${experience.bullets.join(" | ")}`);
    });
    if (snapshot.resume.education.trim()) {
      const record = evidenceRecord("education", snapshot.resume.education, "legacy-profile", true, nowIso, { label: "Legacy builder education" });
      evidence.push(record);
      const item: DossierEducation = { id: stableId("education", snapshot.resume.education.toLowerCase()), institution: "", credential: snapshot.resume.education, field: "", dates: "", evidenceIds: [record.id] };
      if (!education.some((entry) => entry.id === item.id)) education.push(item);
    }
  });
  const latest = snapshots[snapshots.length - 1];
  const mergedEvidence = mergeEvidence(dossier.evidence, evidence);
  return {
    ...dossier,
    identity: {
      ...dossier.identity,
      fullName: dossier.identity.fullName || latest?.fullName || "",
      email: dossier.identity.email || latest?.email || "",
      phone: dossier.identity.phone || latest?.phone || "",
      links: compact([...dossier.identity.links, latest?.website || ""])
    },
    roles,
    education,
    evidence: mergedEvidence,
    approvedClaims: compact([...dossier.approvedClaims, ...evidence.map((item) => item.detail)]),
    unstructuredNotes: compact(notes),
    migrationReview: compact([...dossier.migrationReview, "Legacy generated résumé bullets were preserved as notes and require review before becoming evidence."])
  };
}

export function projectProfileFromDossier(dossier: CareerDossier): CareerProfile {
  const experience = dossier.roles
    .map((role) => [role.title, role.employer].filter(Boolean).join(" at "))
    .concat(dossier.projects.map((project) => project.name))
    .filter(Boolean)
    .join("; ");
  return {
    currentSituation: dossier.careerGoals.join("; "),
    targetRoles: dossier.targetRoleInterests.join(", "),
    transferableSkills: dossier.transferableSkills,
    experienceSummary: experience || dossier.unstructuredNotes.join("\n"),
    strengths: dossier.transferableSkills.slice(0, 8),
    constraints: dossier.constraints.join("; "),
    workStyle: dossier.preferredWorkStyle.join("; "),
    proofPoints: dossier.proofPoints.join("\n"),
    updatedAt: dossier.updatedAt
  };
}

function roleFromIntake(
  title: string,
  employer: string,
  dates: string,
  responsibilities: string[],
  tools: string[],
  outcomes: string[],
  evidenceIds: string[]
): DossierRole | null {
  if (!title.trim() && !employer.trim()) return null;
  return {
    id: stableId("role", `${title}|${employer}|${dates}`.toLowerCase()),
    title: title.trim(),
    employer: employer.trim(),
    startDate: dates.trim(),
    endDate: "",
    current: /present|current|now/i.test(dates),
    responsibilities,
    tools,
    outcomes,
    evidenceIds
  };
}

export function mergeIntakeIntoDossier(
  current: CareerDossier,
  intake: IntakeData,
  source: EvidenceSource,
  approved: boolean,
  sourceText = "",
  nowIso = new Date().toISOString()
): CareerDossier {
  const responsibilities = compact([...intake.selectedResponsibilities, ...intake.responsibilities.split(/\n|;/)]);
  const tools = compact([...intake.tools.split(/,|\n/), ...intake.selectedAiWorkflows]);
  const outcomes = compact([...intake.selectedOutcomes, ...intake.outcomes.split(/\n|;/)]);
  const metrics = compact([
    intake.customersServed,
    intake.ticketsHandled,
    intake.projectsSupported,
    intake.teamSizeSupported,
    intake.callsHandled,
    intake.revenueInfluenced,
    intake.reportsCreated
  ]);
  const proofPoints = compact([...outcomes, ...metrics]);
  const proposed = [
    ...compact([intake.fullName, intake.email, intake.phone, intake.website]).map((detail) => evidenceRecord("identity", detail, source, approved, nowIso, { sourceText })),
    ...responsibilities.map((detail) => evidenceRecord("responsibility", detail, source, approved, nowIso, { sourceText })),
    ...tools.map((detail) => evidenceRecord("tool", detail, source, approved, nowIso, { sourceText })),
    ...outcomes.map((detail) => evidenceRecord("proof", detail, source, approved, nowIso, { sourceText })),
    ...metrics.map((detail) => evidenceRecord("metric", detail, source, approved, nowIso, { sourceText })),
    ...compact([intake.targetJobTitle]).map((detail) => evidenceRecord("goal", detail, source, approved, nowIso, { sourceText }))
  ];
  const roleEvidenceIds = proposed.filter((item) => item.kind !== "goal").map((item) => item.id);
  const roles = [
    roleFromIntake(intake.currentTitle, intake.currentCompany, intake.currentTime, responsibilities, tools, outcomes, roleEvidenceIds),
    roleFromIntake(intake.previousTitle, intake.previousCompany, intake.previousTime, [], [], [], roleEvidenceIds),
    roleFromIntake(intake.additionalTitle, intake.additionalCompany, intake.additionalTime, [], [], [], roleEvidenceIds)
  ].filter((role): role is DossierRole => role !== null);
  roles.forEach((role) => proposed.push(evidenceRecord("role", [role.title, role.employer, role.startDate].filter(Boolean).join(" · "), source, approved, nowIso, { sourceText })));

  let education: DossierEducation[] = current.education;
  if (intake.education.trim()) {
    const record = evidenceRecord("education", intake.education, source, approved, nowIso, { sourceText });
    proposed.push(record);
    education = [
      ...current.education.filter((item) => item.credential.toLowerCase() !== intake.education.trim().toLowerCase()),
      {
        id: stableId("education", intake.education.toLowerCase()),
        institution: "",
        credential: intake.education.trim(),
        field: "",
        dates: "",
        evidenceIds: [record.id]
      }
    ];
  }

  const projects: DossierProject[] = [...current.projects];
  if (intake.independentWorkType.trim()) {
    const detail = compact([intake.independentWorkType, ...intake.selectedIndependentWorkSignals]).join(" · ");
    const record = evidenceRecord("project", detail, source, approved, nowIso, { sourceText });
    proposed.push(record);
    const project: DossierProject = {
      id: stableId("project", detail.toLowerCase()),
      name: intake.independentWorkType.trim(),
      organization: "Independent",
      dates: "",
      description: detail,
      responsibilities,
      tools,
      outcomes,
      metrics,
      links: compact([intake.website]),
      defaultPlacement: "projects",
      evidenceIds: [record.id, ...roleEvidenceIds]
    };
    if (!projects.some((item) => item.id === project.id)) projects.push(project);
  }

  const evidence = mergeEvidence(current.evidence, proposed);
  const approvedClaims = compact([
    ...current.approvedClaims,
    ...evidence.filter((item) => item.approved).map((item) => item.detail)
  ]);
  return {
    ...current,
    identity: {
      ...current.identity,
      fullName: intake.fullName.trim() || current.identity.fullName,
      email: intake.email.trim() || current.identity.email,
      phone: intake.phone.trim() || current.identity.phone,
      links: compact([...current.identity.links, intake.website])
    },
    roles: [...current.roles.filter((item) => !roles.some((role) => role.id === item.id)), ...roles],
    projects,
    education,
    responsibilities: compact([...current.responsibilities, ...responsibilities]),
    tools: compact([...current.tools, ...tools]),
    transferableSkills: compact([
      ...current.transferableSkills,
      ...intake.customRoleTransferableSkills,
      ...intake.selectedActions
    ]),
    outcomes: compact([...current.outcomes, ...outcomes]),
    metrics: compact([...current.metrics, ...metrics]),
    proofPoints: compact([...current.proofPoints, ...proofPoints]),
    targetRoleInterests: compact([...current.targetRoleInterests, intake.targetJobTitle]),
    approvedClaims,
    evidence,
    unstructuredNotes: compact([...current.unstructuredNotes, intake.customRoleNotes]),
    updatedAt: nowIso
  };
}

export function intakeFromDossier(dossier: CareerDossier, targetTitle = ""): IntakeData {
  const [current, previous, additional] = dossier.roles;
  return {
    ...initialIntake,
    fullName: dossier.identity.fullName,
    email: dossier.identity.email,
    phone: dossier.identity.phone,
    website: dossier.identity.links[0] ?? "",
    targetJobTitle: targetTitle || dossier.targetRoleInterests[0] || "",
    currentTitle: current?.title ?? "",
    currentCompany: current?.employer ?? "",
    currentTime: current?.startDate ?? "",
    previousTitle: previous?.title ?? "",
    previousCompany: previous?.employer ?? "",
    previousTime: previous?.startDate ?? "",
    additionalTitle: additional?.title ?? "",
    additionalCompany: additional?.employer ?? "",
    additionalTime: additional?.startDate ?? "",
    tools: dossier.tools.join(", "),
    responsibilities: dossier.responsibilities.join("\n"),
    selectedResponsibilities: dossier.responsibilities,
    customRoleTransferableSkills: dossier.transferableSkills,
    selectedOutcomes: dossier.outcomes,
    outcomes: dossier.outcomes.join("\n"),
    education: dossier.education.map((item) => [item.credential, item.institution].filter(Boolean).join(", ")).join("; ")
  };
}

export type DossierReadiness = {
  level: "not-ready" | "foundation" | "resume-ready";
  reasons: string[];
  nextActions: string[];
};

export function assessDossierReadiness(dossier: CareerDossier): DossierReadiness {
  const approved = dossier.evidence.filter((item) => item.approved);
  const roleProof = approved.filter((item) => ["role", "project", "responsibility", "proof"].includes(item.kind));
  const quality = roleProof.length + dossier.metrics.length * 2 + dossier.proofPoints.length;
  const reasons = [
    `${dossier.roles.length} role${dossier.roles.length === 1 ? "" : "s"} and ${dossier.projects.length} project${dossier.projects.length === 1 ? "" : "s"} captured`,
    `${approved.length} approved evidence item${approved.length === 1 ? "" : "s"}`,
    `${dossier.metrics.length} measurable outcome${dossier.metrics.length === 1 ? "" : "s"}`
  ];
  const nextActions: string[] = [];
  if (!dossier.roles.length && !dossier.projects.length) nextActions.push("Add one role or project to unlock experience sections.");
  if (roleProof.length < 3) nextActions.push(`Approve ${Math.max(1, 3 - roleProof.length)} more evidence item${3 - roleProof.length === 1 ? "" : "s"} to support defensible bullets.`);
  if (!dossier.metrics.length) nextActions.push("Add one measurable outcome to strengthen lane résumé bullets.");
  if (!dossier.education.length) nextActions.push("Add education once and it can appear across every résumé.");
  return {
    level: quality >= 8 && (dossier.roles.length > 0 || dossier.projects.length > 0) ? "resume-ready" : quality >= 3 ? "foundation" : "not-ready",
    reasons,
    nextActions
  };
}

export function withUpdatedDossier(state: CommandCenterState, dossier: CareerDossier): CommandCenterState {
  const packs = state.resumePacks.map((pack) => {
    if (pack.dossierId !== dossier.id || pack.updatedAt >= dossier.updatedAt) return pack;
    return {
      ...pack,
      status: "out-of-date" as const,
      variants: pack.variants.map((variant) =>
        variant.sourceDossierUpdatedAt < dossier.updatedAt
          ? { ...variant, status: "out-of-date" as const }
          : variant
      )
    };
  });
  return { ...state, dossier, profile: projectProfileFromDossier(dossier), resumePacks: packs };
}

export function parseResumeTextToProposal(text: string, nowIso = new Date().toISOString()): DossierEvidenceRecord[] {
  return compact(text.split(/\n+/))
    .filter((line) => line.length >= 3)
    .slice(0, 80)
    .map((line) => {
      const kind: EvidenceKind = /\d|%|\$/.test(line)
        ? "metric"
        : /education|university|college|certificate|degree/i.test(line)
          ? "education"
          : /skills?|tools?|technologies/i.test(line)
            ? "skill"
            : "proof";
      return evidenceRecord(kind, line, "resume-import", false, nowIso, {
        label: "Imported résumé line",
        sourceText: line,
        confidence: "low"
      });
    });
}

function normalizedImportKey(value: string): string {
  return value.toLowerCase().replace(/[\u2013\u2014]/g, "-").replace(/[^a-z0-9+#.]+/g, " ")
    .replace(/\b(the|and|at|of|a|an)\b/g, " ").replace(/\s+/g, " ").trim();
}

function classifyImportLine(line: string): { group: ImportProposalGroup; kind: EvidenceKind; label: string; confidence: ImportProposalRecord["confidence"] } {
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$|(?:https?:\/\/|linkedin\.com|github\.com)|\+?\d[\d ().-]{7,}/i.test(line))
    return { group: "identity", kind: "identity", label: "Identity or link", confidence: "high" };
  if (/\b(university|college|bachelor|master|associate(?:'s)?\s+degree|degree|certificate|certification)\b/i.test(line))
    return { group: "education", kind: "education", label: "Education", confidence: "high" };
  if (/\b(project|founder|independent|freelance|open.source|volunteer|portfolio|labs?)\b/i.test(line))
    return { group: "projects", kind: "project", label: "Project or independent work", confidence: "medium" };
  if (/\b(19|20)\d{2}\b.*(?:present|current|\b(19|20)\d{2}\b)|\b(?:present|current)\b/i.test(line) || /\s[-|@]\s/.test(line))
    return { group: "employment", kind: "role", label: "Employment", confidence: "medium" };
  if (/\b(skills?|competencies|strengths?)\s*:/i.test(line)) return { group: "skills", kind: "skill", label: "Skill", confidence: "medium" };
  if (/\b(tools?|technologies|platforms?|software)\s*:/i.test(line)) return { group: "tools", kind: "tool", label: "Tool", confidence: "medium" };
  if (/\d|%|\$|\b(increased|reduced|improved|grew|saved|maintained|delivered|launched|resolved)\b/i.test(line))
    return { group: "metrics-outcomes", kind: /\d|%|\$/.test(line) ? "metric" : "proof", label: "Metric or outcome", confidence: "medium" };
  if (/^[\w .+#/&-]{2,40}(?:,\s*[\w .+#/&-]{2,40}){2,}$/.test(line)) return { group: "skills", kind: "skill", label: "Skills", confidence: "low" };
  return { group: "other", kind: "proof", label: "Other proposed evidence", confidence: "low" };
}

/** Deduplicates text extracted from multiple local files. Raw binaries never
 * enter this function or persistent storage. */
export function parseResumePackToProposals(files: Array<{ filename: string; text: string }>): ImportProposalRecord[] {
  const proposals = new Map<string, ImportProposalRecord>();
  for (const file of files) {
    const lines = compact(file.text.split(/\r?\n+/)).flatMap((line) => line.length > 220 ? line.split(/(?<=[.;])\s+/) : [line])
      .map((line) => line.replace(/^[\s\u2022*-]+/, "").trim()).filter((line) => line.length >= 3 && line.length <= 320).slice(0, 220);
    for (const line of lines) {
      const classification = classifyImportLine(line);
      const normalized = normalizedImportKey(line);
      if (!normalized) continue;
      const key = `${classification.group}|${normalized}`;
      const previous = proposals.get(key);
      if (previous) {
        previous.sourceFilenames = compact([...previous.sourceFilenames, file.filename]);
        previous.sourceExcerpts = compact([...previous.sourceExcerpts, line]);
      } else {
        proposals.set(key, {
          id: stableId("proposal", key), ...classification, detail: line,
          sourceFilenames: [file.filename], sourceExcerpts: [line], status: "proposed",
          edited: false, likelyDuplicateOf: null
        });
      }
    }
  }
  return [...proposals.values()];
}

export function mergeImportProposals(dossier: CareerDossier, proposals: ImportProposalRecord[], nowIso = new Date().toISOString(), retainSourceFilenames = false): CareerDossier {
  const decided = proposals.filter((item) => item.status !== "proposed");
  const records = decided.map((item) => ({
    ...evidenceRecord(item.kind, item.detail, "resume-import", item.status === "approved", nowIso, {
      label: item.label, sourceText: item.sourceExcerpts[0] ?? item.detail, confidence: item.confidence
    }),
    rejected: item.status === "rejected",
    sourceFilenames: retainSourceFilenames ? compact(item.sourceFilenames) : [],
    sourceExcerpts: compact(item.sourceExcerpts)
  }));
  const evidence = mergeEvidence(dossier.evidence, records);
  const accepted = decided.filter((item) => item.status === "approved");
  const recordFor = (proposal: ImportProposalRecord) => records.find((item) => item.detail === proposal.detail && item.approved);
  const importedRoles = accepted.filter((item) => item.group === "employment").flatMap((item): DossierRole[] => {
    const evidenceRecordForRole = recordFor(item);
    if (!evidenceRecordForRole) return [];
    const dates = item.detail.match(/(?:19|20)\d{2}\s*[–—-]\s*(?:present|current|(?:19|20)\d{2})/i)?.[0] ?? "";
    const heading = item.detail.replace(dates, "").replace(/[|·,\s-]+$/, "").trim();
    const parts = heading.split(/\s+(?:—|–|@|at|\|)\s+/i).map((value) => value.trim()).filter(Boolean);
    return [{ id: stableId("role", normalizedImportKey(heading)), title: parts[0] ?? heading, employer: parts[1] ?? "", startDate: dates, endDate: "", current: /present|current/i.test(dates), responsibilities: [], tools: [], outcomes: [], evidenceIds: [evidenceRecordForRole.id] }];
  });
  const importedProjects = accepted.filter((item) => item.group === "projects").flatMap((item): DossierProject[] => {
    const support = recordFor(item);
    if (!support) return [];
    const name = item.detail.split(/\s+(?:—|–|\||project\b)/i)[0]?.trim() || item.detail;
    return [{ id: stableId("project", normalizedImportKey(name)), name, organization: "", dates: "", description: item.detail, responsibilities: [], tools: [], outcomes: [], metrics: [], links: [], defaultPlacement: "projects", evidenceIds: [support.id] }];
  });
  const importedEducation = accepted.filter((item) => item.group === "education").flatMap((item): DossierEducation[] => {
    const support = recordFor(item);
    if (!support) return [];
    const parts = item.detail.split(/\s+(?:—|–|\|)\s+/).map((value) => value.trim()).filter(Boolean);
    const institutionFirst = /college|university|school/i.test(parts[0] ?? "");
    return [{ id: stableId("education", normalizedImportKey(item.detail)), institution: institutionFirst ? parts[0] : parts[1] ?? "", credential: institutionFirst ? parts.slice(1).join(" · ") : parts[0] ?? item.detail, field: "", dates: item.detail.match(/(?:19|20)\d{2}(?:\s*[–—-]\s*(?:19|20)\d{2})?/)?.[0] ?? "", evidenceIds: [support.id] }];
  });
  const identity = { ...dossier.identity };
  accepted.filter((item) => item.group === "identity").forEach((item) => {
    if (item.detail.includes("@")) identity.email ||= item.detail;
    else if (/https?:\/\/|linkedin\.com|github\.com/i.test(item.detail)) identity.links = compact([...identity.links, item.detail]);
    else if (/\d[\d ().-]{7,}/.test(item.detail)) identity.phone ||= item.detail;
    else identity.fullName ||= item.detail;
  });
  const tools = accepted.filter((item) => item.group === "tools").flatMap((item) => item.detail.replace(/^.*?:/, "").split(/[,;|]/));
  const skills = accepted.filter((item) => item.group === "skills").flatMap((item) => item.detail.replace(/^.*?:/, "").split(/[,;|]/));
  const metrics = accepted.filter((item) => item.kind === "metric").map((item) => item.detail);
  const proofPoints = accepted.filter((item) => item.kind === "proof").map((item) => item.detail);

  // Imported roles used to carry only their own heading record, leaving every
  // approved responsibility/metric/proof stranded — the pack generator then
  // rendered roles with zero bullets. Attach each approved fact to the role
  // it plausibly belongs to: the role whose title/employer it mentions, or
  // the only role there is. Ambiguous facts stay unattached (the generator
  // surfaces those under "Selected accomplishments" rather than guessing).
  const mergedRoles = [...dossier.roles.filter((role) => !importedRoles.some((item) => item.id === role.id)), ...importedRoles];
  const attachableKinds = new Set(["responsibility", "metric", "proof", "story"]);
  const attachable = decided
    .filter((item) => item.status === "approved" && attachableKinds.has(item.kind))
    .flatMap((item) => {
      const record = recordFor(item);
      return record ? [record] : [];
    });
  attachable.forEach((record) => {
    const detailLower = record.detail.toLowerCase();
    const mentioned = mergedRoles.filter((role) => {
      const anchors = [role.title, role.employer].filter((anchor) => anchor && anchor.length >= 4);
      return anchors.some((anchor) => detailLower.includes(anchor.toLowerCase()));
    });
    const target = mentioned.length === 1 ? mentioned[0] : mergedRoles.length === 1 ? mergedRoles[0] : null;
    if (target && !target.evidenceIds.includes(record.id)) target.evidenceIds = [...target.evidenceIds, record.id];
  });

  return {
    ...dossier,
    identity,
    roles: mergedRoles,
    projects: [...dossier.projects.filter((project) => !importedProjects.some((item) => item.id === project.id)), ...importedProjects],
    education: [...dossier.education.filter((education) => !importedEducation.some((item) => item.id === education.id)), ...importedEducation],
    tools: compact([...dossier.tools, ...tools]),
    transferableSkills: compact([...dossier.transferableSkills, ...skills]),
    metrics: compact([...dossier.metrics, ...metrics]),
    proofPoints: compact([...dossier.proofPoints, ...proofPoints]),
    evidence,
    approvedClaims: compact(evidence.filter((item) => item.approved && !item.rejected).map((item) => item.detail)),
    updatedAt: nowIso
  };
}
