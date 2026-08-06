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
          // Must be revived explicitly: this whitelist silently drops any field
          // it does not name, which would erase ownership on every page load.
          ...(text(item.roleId) ? { roleId: text(item.roleId) } : {}),
          source: ["guided", "story", "resume-import", "legacy-profile", "manual", "role-sprint"].includes(text(item.source))
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
  options?: { label?: string; sourceText?: string; confidence?: DossierEvidenceRecord["confidence"]; roleId?: string }
): DossierEvidenceRecord {
  const normalized = detail.trim();
  return {
    // Ownership participates in the identity of the record. Two employers can
    // legitimately record the same responsibility; without this they collapse
    // to one record, mergeEvidence keeps whichever roleId was written last, and
    // the other role loses its own fact. Records with no owner keep their
    // historical id exactly, so nothing already stored changes.
    id: stableId("evidence", `${kind}|${source}|${options?.roleId ? `${options.roleId}|` : ""}${normalized.toLowerCase()}`),
    kind,
    label: options?.label ?? kind[0].toUpperCase() + kind.slice(1),
    detail: normalized,
    ...(options?.roleId ? { roleId: options.roleId } : {}),
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
  let proposed = [
    ...compact([intake.fullName, intake.email, intake.phone, intake.website]).map((detail) => evidenceRecord("identity", detail, source, approved, nowIso, { sourceText })),
    ...responsibilities.map((detail) => evidenceRecord("responsibility", detail, source, approved, nowIso, { sourceText })),
    ...tools.map((detail) => evidenceRecord("tool", detail, source, approved, nowIso, { sourceText })),
    ...outcomes.map((detail) => evidenceRecord("proof", detail, source, approved, nowIso, { sourceText })),
    ...metrics.map((detail) => evidenceRecord("metric", detail, source, approved, nowIso, { sourceText })),
    ...compact([intake.targetJobTitle]).map((detail) => evidenceRecord("goal", detail, source, approved, nowIso, { sourceText }))
  ];
  // Intake collects responsibilities, tools, outcomes and metrics for the
  // CURRENT role only — there are no per-role fields for the previous or
  // additional employer. Handing every role the same evidence array made the
  // pack generator print the current job's duties and metrics under a previous,
  // unrelated employer's name, and the Defensibility Receipt certified those
  // fabricated bullets as "direct".
  //
  // Ownership is now EXPLICIT: every record collected here is stamped with the
  // id of the role it describes, and resume-pack refuses to let a role cite
  // evidence it does not own. Text similarity is not used as an ownership
  // signal — intakeFromDossier() prefills these very fields from the GLOBAL
  // dossier pool, so after a job change both roles legitimately record the same
  // strings and a text-matching guard would clear both.
  const intakeLanes = [
    roleFromIntake(intake.currentTitle, intake.currentCompany, intake.currentTime, responsibilities, tools, outcomes, []),
    roleFromIntake(intake.previousTitle, intake.previousCompany, intake.previousTime, [], [], [], []),
    roleFromIntake(intake.additionalTitle, intake.additionalCompany, intake.additionalTime, [], [], [], [])
  ].filter((role): role is DossierRole => role !== null);
  // Roles created on /profile carry ids from their own creation path, so a
  // stableId derived from intake text will not match them. An unmatched id
  // means the SAME employment lands as a second role (and the id mismatch
  // spuriously trips prefillMovedEmployer below, un-stamping ownership).
  // Adopt the existing role's id whenever title+employer already exist, and
  // drop heading-only lanes that duplicate an already-recorded role — the
  // previous/additional lanes are heading-only by design and must never
  // shadow a recorded role with an empty copy.
  const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const adoptExisting = (role: DossierRole): DossierRole => {
    // DATES ARE PART OF THE IDENTITY. Matching on title+employer alone fused
    // two genuinely separate stints at one employer — "Associate, Jun 2021 -
    // Dec 2023" and "Associate, Jan 2024 - present" — into one record, and the
    // later stint's work was exported under the earlier stint's dates.
    const existing = current.roles.find(
      (item) =>
        sameText(item.title, role.title) &&
        sameText(item.employer, role.employer) &&
        sameText(item.startDate, role.startDate)
    );
    if (!existing) return role;
    // MERGE onto the stored role rather than replacing it. Overwriting wiped
    // the end date, tools, outcomes and any duties recorded on /profile that
    // this intake pass did not happen to carry.
    return {
      ...existing,
      title: role.title || existing.title,
      employer: role.employer || existing.employer,
      startDate: role.startDate || existing.startDate,
      current: role.current || existing.current,
      responsibilities: compact([...existing.responsibilities, ...role.responsibilities]),
      tools: compact([...existing.tools, ...role.tools]),
      outcomes: compact([...existing.outcomes, ...role.outcomes]),
      evidenceIds: [...new Set([...existing.evidenceIds, ...role.evidenceIds])]
    };
  };
  const roles = intakeLanes.map(adoptExisting).filter((role, index, all) => {
    const alreadyRecorded = current.roles.some((item) => item.id === role.id);
    const headingOnly = !role.responsibilities.length && !role.tools.length && !role.outcomes.length;
    if (alreadyRecorded && headingOnly) return false;
    return all.findIndex((other) => other.id === role.id) === index;
  });
  const currentRole = roles[0] && roles[0].title === intake.currentTitle.trim() && roles[0].employer === intake.currentCompany.trim() ? roles[0] : null;
  // The role-scoped fields were prefilled from a DIFFERENT job than the one
  // being submitted: the user changed employer and left the carried-over detail
  // in the form. Recording it against the new employer would re-create exactly
  // the cross-attribution this ownership model exists to prevent, so the new
  // role starts with only its own heading. The text still reaches the global
  // pools below, where the user can attribute it deliberately on /profile.
  const prefillMovedEmployer = Boolean(intake.sourceRoleId) && Boolean(currentRole) && intake.sourceRoleId !== currentRole!.id;
  if (currentRole && !prefillMovedEmployer) {
    proposed = proposed.map((item) => (item.kind === "goal" || item.kind === "identity" ? item : { ...item, roleId: currentRole.id }));
  }
  const currentRoleEvidenceIds = currentRole
    ? proposed.filter((item) => item.roleId === currentRole.id).map((item) => item.id)
    : [];
  // Union, never overwrite: an adopted role keeps the evidence links it earned
  // on /profile in addition to the records this merge just stamped.
  if (currentRole) currentRole.evidenceIds = [...new Set([...currentRole.evidenceIds, ...currentRoleEvidenceIds])];
  roles.forEach((role) => {
    const record = evidenceRecord("role", [role.title, role.employer, role.startDate].filter(Boolean).join(" · "), source, approved, nowIso, { sourceText, roleId: role.id });
    proposed.push(record);
    // Each role owns its own heading record and nothing belonging to another.
    role.evidenceIds = [...new Set([...role.evidenceIds, record.id])];
  });

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
      // Independent work is described by the same intake fields as the current
      // role. Those records are OWNED by that role, and resume-pack refuses to
      // reprint role-owned evidence under a project heading, so listing them
      // here is inert — the project renders from its own record only.
      evidenceIds: [record.id, ...currentRoleEvidenceIds]
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
    // Order is meaning: a résumé's employment history is read top-down.
    // Appending updated roles to the end inverted it — one unedited re-run of
    // the builder moved the previous job above the current one, and the
    // builder then prefilled the old job as "current". Roles the dossier
    // already knows keep their position; only genuinely new ones are appended.
    roles: [
      ...current.roles.map((item) => roles.find((role) => role.id === item.id) ?? item),
      ...roles.filter((role) => !current.roles.some((item) => item.id === role.id))
    ],
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
    sourceRoleId: current?.id,
    // Scoped to the CURRENT role, not the global dossier pool. These fields are
    // re-submitted as that role's evidence, so prefilling them from every role
    // the user has ever held meant a job change silently re-recorded the old
    // employer's duties against the new one — cross-attribution reappearing
    // through the ordinary /resume-builder flow rather than through the data
    // model. The wider pools remain available on /profile.
    tools: (current?.tools ?? []).join(", "),
    responsibilities: (current?.responsibilities ?? []).join("\n"),
    selectedResponsibilities: current?.responsibilities ?? [],
    customRoleTransferableSkills: dossier.transferableSkills,
    selectedOutcomes: current?.outcomes ?? [],
    outcomes: (current?.outcomes ?? []).join("\n"),
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
  // A short line of 2-3 capitalized words with no digits or separators is a
  // person's name (résumés lead with it) — misfiling it as "proof" used to
  // print the user's own name as a résumé bullet.
  if (/^[A-Z][a-zA-Z'’.-]+(?:\s+[A-Z][a-zA-Z'’.-]+){1,2}$/.test(line.trim()) && line.trim().length <= 40 && !/\d|—|·|\||,|:/.test(line))
    return { group: "identity", kind: "identity", label: "Name", confidence: "medium" };
  if (/\b(university|college|bachelor|master|associate(?:'s)?\s+degree|degree|certificate|certification)\b/i.test(line))
    return { group: "education", kind: "education", label: "Education", confidence: "high" };
  if (/\b(project|founder|independent|freelance|open.source|volunteer|portfolio|labs?)\b/i.test(line))
    return { group: "projects", kind: "project", label: "Project or independent work", confidence: "medium" };
  if (/\b(19|20)\d{2}\b.*(?:present|current|\b(19|20)\d{2}\b)|\b(?:present|current)\b/i.test(line) || /\s[-—–|@]\s/.test(line))
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
    const dates = item.detail.match(/(?:19|20)\d{2}\s*[–—-]\s*(?:present|current|(?:19|20)\d{2})/i)?.[0] ?? "";
    const segments = item.detail.replace(dates, "").split(/\s+(?:—|–|\|)\s+/).map((value) => value.replace(/[|·,\s-]+$/, "").trim()).filter(Boolean);
    const name = segments[0]?.replace(/\s+project\b.*$/i, "").trim() || item.detail;
    return [{ id: stableId("project", normalizedImportKey(name)), name, organization: segments[1] ?? "", dates, description: item.detail, responsibilities: [], tools: [], outcomes: [], metrics: [], links: [], defaultPlacement: "projects", evidenceIds: [support.id] }];
  });
  const importedEducation = accepted.filter((item) => item.group === "education").flatMap((item): DossierEducation[] => {
    const support = recordFor(item);
    if (!support) return [];
    const parts = item.detail.split(/\s+(?:—|–|\|)\s+/).map((value) => value.trim()).filter(Boolean);
    const institutionFirst = /college|university|school/i.test(parts[0] ?? "");
    const dates = item.detail.match(/(?:19|20)\d{2}(?:\s*[–—-]\s*(?:19|20)\d{2})?/)?.[0] ?? "";
    const rawCredential = institutionFirst ? parts.slice(1).join(" · ") : parts[0] ?? item.detail;
    // The year lives in its own field; leaving it inside the credential too
    // prints "BS in Communications · 2019, State University, 2019".
    const credential = dates ? rawCredential.replace(dates, "").replace(/[·|,\s-]+$/, "").trim() || rawCredential : rawCredential;
    return [{ id: stableId("education", normalizedImportKey(item.detail)), institution: institutionFirst ? parts[0] : parts[1] ?? "", credential, field: "", dates, evidenceIds: [support.id] }];
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
  // Facts attach to the role whose heading they FOLLOWED in the source text —
  // that is the résumé's own structure, not a guess. Mention-matching remains
  // as a secondary signal; facts with neither signal stay unattached and the
  // generator surfaces them under "Selected accomplishments".
  const mergedProjects = [...dossier.projects.filter((project) => !importedProjects.some((item) => item.id === project.id)), ...importedProjects];
  const roleIdForHeading = (detail: string): string | null => {
    const dates = detail.match(/(?:19|20)\d{2}\s*[–—-]\s*(?:present|current|(?:19|20)\d{2})/i)?.[0] ?? "";
    const heading = detail.replace(dates, "").replace(/[|·,\s-]+$/, "").trim();
    const id = stableId("role", normalizedImportKey(heading));
    return mergedRoles.some((role) => role.id === id) ? id : null;
  };
  const projectIdForHeading = (detail: string): string | null => {
    const name = detail.split(/\s+(?:—|–|\||project\b)/i)[0]?.trim() || detail;
    const id = stableId("project", normalizedImportKey(name));
    return mergedProjects.some((project) => project.id === id) ? id : null;
  };
  const positionalTargetByRecordId = new Map<string, { kind: "role" | "project"; id: string }>();
  let positionalTarget: { kind: "role" | "project"; id: string } | null = null;
  for (const item of accepted) {
    if (item.group === "employment") {
      const roleId = roleIdForHeading(item.detail);
      positionalTarget = roleId ? { kind: "role", id: roleId } : null;
      continue;
    }
    if (item.group === "projects") {
      const projectId = projectIdForHeading(item.detail);
      positionalTarget = projectId ? { kind: "project", id: projectId } : null;
      continue;
    }
    if (item.group === "education") {
      positionalTarget = null; // a new section ends the run of facts
      continue;
    }
    if (positionalTarget && attachableKinds.has(item.kind)) {
      const record = recordFor(item);
      if (record) positionalTargetByRecordId.set(record.id, positionalTarget);
    }
  }
  attachable.forEach((record) => {
    const positional = positionalTargetByRecordId.get(record.id);
    if (positional?.kind === "project") {
      const project = mergedProjects.find((item) => item.id === positional.id);
      if (project && !project.evidenceIds.includes(record.id)) project.evidenceIds = [...project.evidenceIds, record.id];
      return;
    }
    const detailLower = record.detail.toLowerCase();
    const mentioned = mergedRoles.filter((role) => {
      const anchors = [role.title, role.employer].filter((anchor) => anchor && anchor.length >= 4);
      return anchors.some((anchor) => detailLower.includes(anchor.toLowerCase()));
    });
    const target = positional
      ? mergedRoles.find((role) => role.id === positional.id) ?? null
      : mentioned.length === 1
        ? mentioned[0]
        : null;
    if (target && !target.evidenceIds.includes(record.id)) target.evidenceIds = [...target.evidenceIds, record.id];
  });

  return {
    ...dossier,
    identity,
    roles: mergedRoles,
    projects: mergedProjects,
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

/**
 * Applies an edit to one role's responsibility list, keeping the role's
 * EVIDENCE in step with it.
 *
 * A role's duties live in two places: `role.responsibilities` (what the
 * editor writes) and role-owned evidence records (what the generator reads).
 * The editor used to write only the first, so a duty the user deleted
 * survived as an approved record and the next forge printed it again — with
 * the Defensibility Receipt certifying the resurrected bullet as "direct".
 *
 * Removed duties are marked rejected rather than deleted: that is the
 * reversible path the Truth Inbox already understands, so the record stays
 * visible and restorable instead of being destroyed.
 */
export function withRoleResponsibilitiesEdited(
  dossier: CareerDossier,
  roleId: string,
  responsibilities: string[],
  nowIso = new Date().toISOString(),
  roleFields: { title?: string; employer?: string; startDate?: string } = {}
): CareerDossier {
  const norm = (value: string) => value.trim().toLowerCase();
  const keptText = new Set(responsibilities.map(norm));
  const role = dossier.roles.find((item) => item.id === roleId);
  const ownedByThisRole = new Set(role?.evidenceIds ?? []);

  const added = responsibilities.map((detail) =>
    evidenceRecord("responsibility", detail, "manual", true, nowIso, { label: "Role responsibility", roleId })
  );
  const known = new Set(dossier.evidence.map((item) => item.id));
  const additions = added.filter((item) => !known.has(item.id));

  // Ownership must be EXCLUSIVE before a record may be rejected here. The
  // first version also swept in anything listed in this role's evidenceIds,
  // so editing one job rejected evidence stamped to a DIFFERENT employer —
  // the user edited their current role and lost bullets from a previous one.
  // A record with no owner at all is only claimed when no other role lists it.
  const listedElsewhere = new Set(
    dossier.roles.filter((role) => role.id !== roleId).flatMap((role) => role.evidenceIds)
  );
  const removed = dossier.evidence.filter((item) => {
    if (item.kind !== "responsibility" || item.rejected) return false;
    if (keptText.has(norm(item.detail))) return false;
    if (item.roleId) return item.roleId === roleId;
    return ownedByThisRole.has(item.id) && !listedElsewhere.has(item.id);
  });
  const removedIds = new Set(removed.map((item) => item.id));
  const removedText = new Set(removed.map((item) => norm(item.detail)));

  return {
    ...dossier,
    roles: dossier.roles.map((item) =>
      item.id === roleId
        ? {
            ...item,
            title: roleFields.title ?? item.title,
            employer: roleFields.employer ?? item.employer,
            startDate: roleFields.startDate ?? item.startDate,
            responsibilities,
            evidenceIds: [...new Set([...item.evidenceIds, ...added.map((record) => record.id)])].filter(
              (evidenceId) => !removedIds.has(evidenceId)
            )
          }
        : item
    ),
    responsibilities: [...new Set([...dossier.responsibilities, ...responsibilities])].filter(
      (item) => !removedText.has(norm(item))
    ),
    evidence: [...dossier.evidence, ...additions].map((item) =>
      removedIds.has(item.id) ? { ...item, rejected: true, approved: false } : item
    ),
    approvedClaims: [...new Set([...dossier.approvedClaims, ...responsibilities])].filter(
      (item) => !removedText.has(norm(item))
    ),
    updatedAt: nowIso
  };
}
