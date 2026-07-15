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
  EvidenceSource
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
          outcomes: strings(item.outcomes), evidenceIds: strings(item.evidenceIds)
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
    createdAt: nowIso,
    updatedAt: nowIso
  };
}

function mergeEvidence(current: DossierEvidenceRecord[], additions: DossierEvidenceRecord[]): DossierEvidenceRecord[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  additions.forEach((item) => {
    const previous = byId.get(item.id);
    byId.set(item.id, previous ? { ...previous, ...item, approved: previous.approved || item.approved } : item);
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
