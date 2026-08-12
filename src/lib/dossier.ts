import { initialIntake } from "@/lib/career-data";
import { possibleDisclosure } from "@/lib/truth-guards";
import { disclosureResolutionIsStale, isUsableEvidence, needsDisclosureReview } from "@/lib/evidence-admissibility";
import { getUsableEvidenceForRole, isUsable } from "@/lib/evidence-read";
import { roleHasStructure } from "@/lib/employment-structure";
import { parseResumeFilesToImportProposals } from "@/lib/resume-import-contract";
import type { IntakeData } from "@/types/career";
import type { StoryFactContract } from "@/lib/story-facts";
import type { CareerProfile, CommandCenterState, ResumeSnapshot } from "@/types/command-center";
import type { DisclosureReason } from "@/lib/truth-guards";
import type {
  CareerDossier,
  DossierEducation,
  DossierEvidenceRecord,
  DossierProject,
  DossierRole,
  EvidenceKind,
  EvidenceSource,
  ImportProposalRecord
  , StoryFact
} from "@/types/dossier";

// Only body content is flagged for disclosure review.
const PROFESSIONAL_EVIDENCE_KINDS = new Set<EvidenceKind>([
  "responsibility", "proof", "metric", "story", "role", "project", "education", "skill", "tool"
]);

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
    storyFacts: [],
    storyRawSources: [],
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
          // Same rule for the review state — losing it on reload would silently
          // re-admit an item the user had excluded, or re-flag one they kept.
          ...(["needs_review", "keep", "exclude"].includes(text(item.disclosureReview))
            ? { disclosureReview: text(item.disclosureReview) as "needs_review" | "keep" | "exclude" }
            : {}),
          ...(["health", "separation", "education", "financial"].includes(text(item.disclosureReason))
            ? { disclosureReason: text(item.disclosureReason) as DisclosureReason }
            : {}),
          // The reviewed-text fingerprint MUST survive the round trip. Dropping
          // it here meant the staleness guard only worked inside one un-reloaded
          // session: keep a sentence, reload, edit it into something newly
          // sensitive, and the old approval silently authorised the new words.
          // The canonical reader now treats a resolution with no fingerprint as
          // stale, so losing it fails closed rather than open — but it should
          // not be lost at all.
          ...(typeof item.disclosureReviewedText === "string"
            ? { disclosureReviewedText: item.disclosureReviewedText }
            : {}),
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
        // Survival on READ must match survival on WRITE. This enforced its own
        // stricter rule than roleHasStructure — id AND (title OR employer) —
        // so a row whose title and employer had both been blanked by the old
        // classifier was deleted on load, taking its dates, bullets, outcomes
        // and evidence links with it, BEFORE the recovery migration could ever
        // see it. Dates alone still identify a job.
        if (!text(item.id) || !roleHasStructure({
          title: text(item.title), employer: text(item.employer),
          startDate: text(item.startDate), endDate: text(item.endDate)
        })) return [];
        return [{
          id: text(item.id), title: text(item.title), employer: text(item.employer), startDate: text(item.startDate),
          endDate: text(item.endDate), current: item.current === true, responsibilities: strings(item.responsibilities),
          tools: strings(item.tools), outcomes: strings(item.outcomes), evidenceIds: strings(item.evidenceIds),
          ...(item.chronology && typeof item.chronology === "object" && !Array.isArray(item.chronology)
            ? { chronology: {
                sourceText: text((item.chronology as Record<string, unknown>).sourceText),
                certainty: text((item.chronology as Record<string, unknown>).certainty) as DossierRole["chronology"] extends infer C ? C extends { certainty: infer T } ? T : never : never,
                precision: text((item.chronology as Record<string, unknown>).precision) as DossierRole["chronology"] extends infer C ? C extends { precision: infer T } ? T : never : never
              } }
            : {}),
          // The recovery migration's own findings. Dropped by this whitelist,
          // a candidate the user was about to confirm vanished on reload and
          // the refusal half of the invariant became invisible — the migration
          // asked a question nobody could hear. Recomputed on every read, so a
          // stale entry cannot outlive the state that produced it.
          ...(Array.isArray(item.structuralReview) ? { structuralReview: item.structuralReview as DossierRole["structuralReview"] } : {})
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
          evidenceIds: strings(item.evidenceIds), volunteer: item.volunteer === true,
          ...(item.chronology && typeof item.chronology === "object" && !Array.isArray(item.chronology)
            ? { chronology: {
                sourceText: text((item.chronology as Record<string, unknown>).sourceText),
                certainty: text((item.chronology as Record<string, unknown>).certainty) as DossierProject["chronology"] extends infer C ? C extends { certainty: infer T } ? T : never : never,
                precision: text((item.chronology as Record<string, unknown>).precision) as DossierProject["chronology"] extends infer C ? C extends { precision: infer T } ? T : never : never
              } }
            : {})
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
  const storyFacts = Array.isArray(source.storyFacts)
    ? source.storyFacts.flatMap((entry): StoryFact[] => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const item = entry as Record<string, unknown>;
        const categories = ["identity", "employer", "title", "role-date", "responsibility", "achievement", "metric", "skill", "project", "project-date", "volunteer-role", "informal-work", "education", "career-gap", "career-transition", "aspiration", "personal-context", "unresolved"];
        const certainties = ["exact", "approximate", "bounded-range", "user-estimated", "unknown", "conflicting", "not-applicable", "unsupported"];
        const precisions = ["day", "month", "year", "range", "duration", "current", "qualitative", "unknown", "not-applicable"];
        const dispositions = ["represented", "needs-review", "user-confirmed", "user-corrected", "user-rejected", "intentionally-omitted", "non-resume-context", "duplicate", "conflicting", "unresolved"];
        if (!text(item.id) || !categories.includes(text(item.category)) || !text(item.sourceExcerpt)) return [];
        return [{
          id: text(item.id), category: text(item.category) as StoryFact["category"], sourceExcerpt: text(item.sourceExcerpt),
          sourceStart: typeof item.sourceStart === "number" ? item.sourceStart : 0,
          sourceEnd: typeof item.sourceEnd === "number" ? item.sourceEnd : 0,
          candidateValue: text(item.candidateValue), userWording: text(item.userWording) || text(item.sourceExcerpt),
          certainty: certainties.includes(text(item.certainty)) ? text(item.certainty) as StoryFact["certainty"] : "unsupported",
          precision: precisions.includes(text(item.precision)) ? text(item.precision) as StoryFact["precision"] : "unknown",
          reviewRequired: item.reviewRequired === true,
          disposition: dispositions.includes(text(item.disposition)) ? text(item.disposition) as StoryFact["disposition"] : "unresolved",
          ...(text(item.omissionReason) ? { omissionReason: text(item.omissionReason) } : {}),
          ...(text(item.conflictGroup) ? { conflictGroup: text(item.conflictGroup) } : {}),
          ...(text(item.associationId) ? { associationId: text(item.associationId) } : {}),
          origin: item.origin === "user-supplied" || item.origin === "generated-wording" ? item.origin : "parser-separated",
          ...(text(item.evidenceId) ? { evidenceId: text(item.evidenceId) } : {}),
          downstreamClaims: strings(item.downstreamClaims), updatedAt: text(item.updatedAt) || base.createdAt
        }];
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
    // User intent, so it MUST survive the round trip. This whitelist silently
    // drops any field it does not name, and dropping the tombstone would make
    // every deliberately-deleted job look like one Career Forge destroyed —
    // and be offered back on the next load.
    ...(strings(source.removedRoleIds).length ? { removedRoleIds: strings(source.removedRoleIds) } : {}),
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
    storyFacts,
    storyRawSources: strings(source.storyRawSources),
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
    // The classifier raises a hand here and does nothing else: the detail
    // above is the user's text, unaltered. Only professional-evidence kinds
    // are flagged — a goal or a constraint is not résumé body content.
    ...(() => {
      if (!PROFESSIONAL_EVIDENCE_KINDS.has(kind)) return {};
      const flag = possibleDisclosure(normalized);
      return flag ? { disclosureReview: "needs_review" as const, disclosureReason: flag.reason } : {};
    })(),
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

function storyFactApproved(item: StoryFact): boolean {
  return item.disposition === "user-confirmed" || item.disposition === "user-corrected";
}

/**
 * Converts reviewed typed-story facts into the canonical dossier. The ledger is
 * always persisted; only explicitly confirmed/corrected facts become evidence.
 * Approximate chronology is metadata, never an exact date field.
 */
export function mergeStoryFactsIntoDossier(
  current: CareerDossier,
  contract: StoryFactContract,
  nowIso = new Date().toISOString()
): CareerDossier {
  const approvedFacts = contract.facts.filter(storyFactApproved);
  const evidenceByFact = new Map<string, DossierEvidenceRecord>();
  const proposed: DossierEvidenceRecord[] = [];
  const addEvidence = (item: StoryFact, kind: EvidenceKind, detail = item.candidateValue, roleId?: string) => {
    if (!detail.trim()) return undefined;
    const record = evidenceRecord(kind, detail, "story", true, nowIso, {
      label: `Story ${item.category}`,
      sourceText: item.sourceExcerpt,
      confidence: item.certainty === "exact" ? "high" : "low",
      roleId
    });
    proposed.push(record);
    evidenceByFact.set(item.id, record);
    return record;
  };

  const roles = contract.roles.flatMap((candidate): DossierRole[] => {
    const associated = approvedFacts.filter((item) => item.associationId === candidate.id);
    const employerFact = associated.find((item) => item.category === "employer");
    const titleFact = associated.find((item) => item.category === "title" && item.candidateValue);
    if (!employerFact && !titleFact) return [];
    const employer = employerFact?.candidateValue ?? "";
    const title = titleFact?.candidateValue ?? "";
    const dateFact = associated.find((item) => item.category === "role-date");
    const exactDate = dateFact && dateFact.certainty === "exact" ? dateFact.candidateValue : "";
    const roleId = stableId("role", `story|${candidate.id}|${title}|${employer}`.toLowerCase());
    const responsibilities = associated.filter((item) => item.category === "responsibility").map((item) => item.candidateValue);
    const tools = associated.filter((item) => item.category === "skill").map((item) => item.candidateValue);
    const metrics = associated.filter((item) => item.category === "metric" && item.certainty !== "not-applicable").map((item) => item.candidateValue);
    const evidenceIds = associated.flatMap((item) => {
      if (item.category === "responsibility") {
        const record = addEvidence(item, "responsibility", item.candidateValue, roleId);
        return record ? [record.id] : [];
      }
      if (item.category === "skill") {
        const record = addEvidence(item, "skill", item.candidateValue, roleId);
        return record ? [record.id] : [];
      }
      if (item.category === "metric" && item.certainty !== "not-applicable") {
        const record = addEvidence(item, "metric", item.candidateValue, roleId);
        return record ? [record.id] : [];
      }
      return [];
    });
    const headingSource = employerFact ?? titleFact!;
    const heading = [title, employer, exactDate].filter(Boolean).join(" · ");
    const roleRecord = addEvidence(headingSource, "role", heading, roleId);
    if (roleRecord) evidenceIds.push(roleRecord.id);
    return [{
      id: roleId,
      title,
      employer,
      startDate: exactDate,
      endDate: "",
      current: dateFact?.precision === "current",
      responsibilities,
      tools,
      outcomes: metrics,
      evidenceIds: [...new Set(evidenceIds)],
      ...(dateFact ? { chronology: { sourceText: dateFact.sourceExcerpt, certainty: dateFact.certainty, precision: dateFact.precision } } : {})
    }];
  });

  const projects = contract.projects.flatMap((candidate): DossierProject[] => {
    const associated = approvedFacts.filter((item) => item.associationId === candidate.id);
    const projectFact = associated.find((item) => item.category === "project" || item.category === "informal-work");
    if (!projectFact) return [];
    const volunteer = associated.some((item) => item.category === "volunteer-role") || candidate.volunteer;
    const dateFact = associated.find((item) => item.category === "project-date");
    const exactDate = dateFact && dateFact.certainty === "exact" ? dateFact.candidateValue : "";
    const record = addEvidence(projectFact, "project", projectFact.candidateValue);
    if (!record) return [];
    return [{
      id: stableId("project", `story|${candidate.id}|${projectFact.candidateValue}`.toLowerCase()),
      name: projectFact.category === "informal-work" ? candidate.name : projectFact.candidateValue,
      organization: "",
      dates: exactDate,
      description: candidate.description,
      responsibilities: associated.filter((item) => item.category === "responsibility").map((item) => item.candidateValue),
      tools: associated.filter((item) => item.category === "skill").map((item) => item.candidateValue), outcomes: [], metrics: [], links: [], defaultPlacement: "projects",
      evidenceIds: [record.id], volunteer,
      ...(dateFact ? { chronology: { sourceText: dateFact.sourceExcerpt, certainty: dateFact.certainty, precision: dateFact.precision } } : {})
    }];
  });

  const identity = { ...current.identity };
  approvedFacts.filter((item) => item.category === "identity").forEach((item) => {
    addEvidence(item, "identity");
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item.candidateValue)) identity.email = item.candidateValue;
    else if (!identity.fullName) identity.fullName = item.candidateValue;
  });
  const education = approvedFacts.filter((item) => item.category === "education").map((item): DossierEducation => {
    const record = addEvidence(item, "education");
    return { id: stableId("education", `story|${item.id}`), institution: "", credential: item.candidateValue, field: "", dates: "", evidenceIds: record ? [record.id] : [] };
  });
  const aspirations = approvedFacts.filter((item) => item.category === "aspiration").map((item) => item.candidateValue);
  const evidence = mergeEvidence(current.evidence, proposed);
  const mergedRoles = [...current.roles.filter((item) => !roles.some((candidate) => candidate.id === item.id)), ...roles];
  const mergedProjects = [...current.projects.filter((item) => !projects.some((candidate) => candidate.id === item.id)), ...projects];
  const persistedFacts = contract.facts.map((item) => {
    const record = evidenceByFact.get(item.id);
    return { ...item, ...(record ? { evidenceId: record.id } : {}), updatedAt: nowIso };
  });
  return {
    ...current,
    identity,
    roles: mergedRoles,
    projects: mergedProjects,
    education: [...current.education.filter((item) => !education.some((candidate) => candidate.id === item.id)), ...education],
    responsibilities: compact([...current.responsibilities, ...roles.flatMap((item) => item.responsibilities)]),
    tools: compact([...current.tools, ...roles.flatMap((item) => item.tools), ...projects.flatMap((item) => item.tools)]),
    transferableSkills: compact([...current.transferableSkills, ...approvedFacts.filter((item) => item.category === "skill").map((item) => item.candidateValue)]),
    metrics: compact([...current.metrics, ...approvedFacts.filter((item) => item.category === "metric" && item.certainty !== "not-applicable").map((item) => item.candidateValue)]),
    proofPoints: compact([...current.proofPoints, ...approvedFacts.filter((item) => item.category === "achievement").map((item) => item.candidateValue)]),
    targetRoleInterests: compact([...current.targetRoleInterests, ...aspirations]),
    evidence,
    approvedClaims: compact(evidence.filter((item) => item.approved && !item.rejected).map((item) => item.detail)),
    storyFacts: persistedFacts,
    storyRawSources: compact([...(current.storyRawSources ?? []), contract.rawStory]),
    updatedAt: nowIso
  };
}

/**
 * The user's facts for one role, read through the eligibility gate. Ineligible
 * records are withheld, never deleted — they stay in the store and in the
 * review queue. The denormalized role pool is used only as a fallback for
 * dossiers written before evidence records existed, and is itself filtered
 * against anything the store says is ineligible.
 */
function roleFacts(
  dossier: CareerDossier,
  role: DossierRole | undefined,
  kind: EvidenceKind,
  fallback: string[] | undefined
): string[] {
  if (!role) return [];
  const owned = getUsableEvidenceForRole(dossier, role.id, { kinds: [kind] }).map((item) => item.detail);
  if (owned.length) return owned;
  const blocked = new Set(
    dossier.evidence.filter((item) => !isUsable(item)).map((item) => item.detail.trim().toLowerCase())
  );
  return (fallback ?? []).filter((entry) => !blocked.has(entry.trim().toLowerCase()));
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
    // These prefill fields are a READ of the user's career facts, so they
    // resolve through the canonical reader rather than through the role's
    // denormalized string pools. Those pools carry no review state, which is
    // how an EXCLUDED disclosure printed in the summary, a bullet and the
    // LinkedIn summary after a single reload: intakeFromDossier refilled the
    // selected* arrays from them on every mount, and the generator read the
    // arrays raw. Falling back to the pool only when the role owns no evidence
    // records at all keeps pre-evidence dossiers working.
    responsibilities: roleFacts(dossier, current, "responsibility", current?.responsibilities).join("\n"),
    selectedResponsibilities: roleFacts(dossier, current, "responsibility", current?.responsibilities),
    customRoleTransferableSkills: dossier.transferableSkills,
    selectedOutcomes: roleFacts(dossier, current, "metric", current?.outcomes),
    outcomes: roleFacts(dossier, current, "metric", current?.outcomes).join("\n"),
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
  const hasStructuredExperience = dossier.roles.length > 0 || dossier.projects.length > 0;
  return {
    // Saving isolated evidence is real progress, but it is not a usable career
    // profile until at least one structured role or first-class project exists.
    level: hasStructuredExperience ? quality >= 8 ? "resume-ready" : quality >= 3 ? "foundation" : "not-ready" : "not-ready",
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

/** Deduplicates text extracted from multiple local files. Raw binaries never
 * enter this function or persistent storage. */
export function parseResumePackToProposals(files: Array<{ filename: string; text: string }>): ImportProposalRecord[] {
  return parseResumeFilesToImportProposals(files);
}

export function mergeImportProposals(dossier: CareerDossier, proposals: ImportProposalRecord[], nowIso = new Date().toISOString(), retainSourceFilenames = false): CareerDossier {
  const decided = proposals.filter((item) => item.status !== "proposed" && item.proposedField !== "structure" && item.validation !== "structural" && item.validation !== "noise");
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
  const recordByProposalId = new Map(decided.map((proposal, index) => [proposal.id, records[index]]));
  const recordFor = (proposal: ImportProposalRecord) => {
    const record = recordByProposalId.get(proposal.id);
    return record?.approved ? record : undefined;
  };
  const importedRoles = accepted.filter((item) => item.group === "employment").flatMap((item): DossierRole[] => {
    const evidenceRecordForRole = recordFor(item);
    const role = item.roleCandidate;
    if (!evidenceRecordForRole || !role?.title || !role.employer) return [];
    const identityKey = `${normalizedImportKey(role.title)}|${normalizedImportKey(role.employer)}`;
    return [{ id: stableId("role", identityKey), title: role.title, employer: role.employer, startDate: role.startDate, endDate: role.endDate, current: role.current, responsibilities: [], tools: [], outcomes: [], evidenceIds: [evidenceRecordForRole.id] }];
  });
  const importedProjects = accepted.filter((item) => item.group === "projects").flatMap((item): DossierProject[] => {
    const support = recordFor(item);
    const project = item.projectCandidate;
    if (!support || !project?.name) return [];
    return [{ id: stableId("project", normalizedImportKey(project.name)), name: project.name, organization: project.organization, dates: project.dates, description: project.description, responsibilities: [], tools: [], outcomes: [], metrics: [], links: project.links, defaultPlacement: "projects", evidenceIds: [support.id] }];
  });
  const importedEducation = accepted.filter((item) => item.group === "education").flatMap((item): DossierEducation[] => {
    const support = recordFor(item);
    const education = item.educationCandidate;
    if (!support || !education?.institution || !education.credential) return [];
    return [{ id: stableId("education", `${normalizedImportKey(education.institution)}|${normalizedImportKey(education.credential)}|${normalizedImportKey(education.dates)}`), institution: education.institution, credential: education.credential, field: education.field, dates: education.dates, evidenceIds: [support.id] }];
  });
  const identity = { ...dossier.identity };
  accepted.filter((item) => item.group === "identity").forEach((item) => {
    const value = item.candidateValue ?? item.detail;
    if (item.proposedField === "identity.email") identity.email = value;
    else if (item.proposedField === "identity.phone") identity.phone = value;
    else if (item.proposedField === "identity.location") identity.location = value;
    else if (item.proposedField === "identity.link") identity.links = compact([...identity.links, value]);
    else if (item.proposedField === "identity.fullName") identity.fullName = value;
  });
  const tools = accepted.filter((item) => item.group === "tools").flatMap((item) => (item.candidateValue ?? item.detail).replace(/^.*?:/, "").split(/[,;|]/));
  const skills = accepted.filter((item) => item.group === "skills").flatMap((item) => (item.candidateValue ?? item.detail).replace(/^.*?:/, "").split(/[,;|]/));
  const metrics = accepted.filter((item) => item.kind === "metric").map((item) => item.candidateValue ?? item.detail);
  const proofPoints = accepted.filter((item) => item.kind === "proof").map((item) => item.candidateValue ?? item.detail);

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
  const roleIdForHeading = (proposal: ImportProposalRecord): string | null => {
    const role = proposal.roleCandidate;
    if (!role) return null;
    const id = stableId("role", `${normalizedImportKey(role.title)}|${normalizedImportKey(role.employer)}`);
    return mergedRoles.some((role) => role.id === id) ? id : null;
  };
  const projectIdForHeading = (proposal: ImportProposalRecord): string | null => {
    const name = proposal.projectCandidate?.name;
    if (!name) return null;
    const id = stableId("project", normalizedImportKey(name));
    return mergedProjects.some((project) => project.id === id) ? id : null;
  };
  const positionalTargetByRecordId = new Map<string, { kind: "role" | "project"; id: string }>();
  let positionalTarget: { kind: "role" | "project"; id: string } | null = null;
  for (const item of accepted) {
    if (item.group === "employment") {
      const roleId = roleIdForHeading(item);
      positionalTarget = roleId ? { kind: "role", id: roleId } : null;
      continue;
    }
    if (item.group === "projects") {
      const projectId = projectIdForHeading(item);
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
  // Retyping a duty that was previously removed must bring it back. The record
  // already exists, so it is not in `additions`; without this it stayed
  // rejected and the retyped text silently failed to appear.
  const revivedIds = new Set(added.filter((item) => known.has(item.id)).map((item) => item.id));

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
            // The link is KEPT even for a removed duty. Stripping the id
            // orphaned the record: "Restore and approve" flipped it back to
            // approved but nothing re-linked it, so the restored duty never
            // reached the résumé again and the user could not recover their
            // own text by any documented path. Exclusion is carried by the
            // rejected flag alone — every consumer already filters on
            // `approved && !rejected` — so restoring is a single flag flip.
            evidenceIds: [...new Set([...item.evidenceIds, ...added.map((record) => record.id)])]
          }
        : item
    ),
    responsibilities: [...new Set([...dossier.responsibilities, ...responsibilities])].filter(
      (item) => !removedText.has(norm(item))
    ),
    evidence: [...dossier.evidence, ...additions].map((item) => {
      if (removedIds.has(item.id)) return { ...item, rejected: true, approved: false };
      if (revivedIds.has(item.id) && item.rejected) return { ...item, rejected: false, approved: true };
      return item;
    }),
    approvedClaims: [...new Set([...dossier.approvedClaims, ...responsibilities])].filter(
      (item) => !removedText.has(norm(item))
    ),
    updatedAt: nowIso
  };
}


/**
 * Makes the GUIDED path use the canonical evidence lifecycle instead of a
 * second one of its own.
 *
 * The guided textarea used to flow straight into generation, so a flagged
 * sentence had no durable record to be flagged ON, nowhere to be resolved, and
 * nothing to audit — it simply appeared in a bullet. Rather than build a
 * guided-only review mechanism (two lifecycles that would eventually
 * disagree), the intake is filtered against the records the dossier already
 * holds: a sentence whose evidence is unresolved, excluded, or carrying a
 * stale resolution is withheld from generation exactly as it would be on the
 * dossier path.
 *
 * The user's text is NEVER altered here. Whole sentences are withheld or they
 * are not; nothing is trimmed, and the intake the user typed is untouched in
 * storage.
 */
export function intakeEligibleForGeneration(intake: IntakeData, dossier: CareerDossier): IntakeData {
  const blocked = new Map<string, DossierEvidenceRecord>();
  for (const record of dossier.evidence) {
    if (record.kind !== "responsibility" && record.kind !== "proof" && record.kind !== "metric") continue;
    if (isUsableEvidence(record)) continue;
    if (!record.disclosureReview && !disclosureResolutionIsStale(record)) continue;
    blocked.set(record.detail.trim().toLowerCase(), record);
  }
  // Records the user explicitly KEPT become the approval list, so a flagged
  // sentence they confirmed goes straight back into the draft.
  // This is an ALLOW-list, not a filter: generation uses it to RE-ADMIT an
  // otherwise-flagged sentence. It checked only the review flag, so a record
  // the user later REJECTED still authorized its sentence back into the draft.
  // A fail-open in an allow-list publishes immediately, so it takes the full
  // eligibility test.
  const approved = dossier.evidence
    .filter((record) => isUsable(record) && record.disclosureReview === "keep")
    .map((record) => record.detail);

  if (!blocked.size) return approved.length ? { ...intake, disclosureApproved: approved } : intake;

  const withhold = (text: string): string =>
    text
      .split(/\n/)
      .filter((line) => !blocked.has(line.trim().toLowerCase()))
      .join("\n");

  return {
    ...intake,
    disclosureApproved: approved,
    responsibilities: withhold(intake.responsibilities),
    outcomes: withhold(intake.outcomes),
    customRoleNotes: withhold(intake.customRoleNotes)
  };
}

/** Records the guided path has flagged and the user has not yet resolved. */
export function pendingDisclosureReviews(dossier: CareerDossier): DossierEvidenceRecord[] {
  return dossier.evidence.filter((record) => needsDisclosureReview(record));
}

/** Resolves one flagged record, binding the decision to the reviewed text. */
export function resolveDisclosure(
  dossier: CareerDossier,
  evidenceId: string,
  decision: "keep" | "exclude",
  nowIso = new Date().toISOString()
): CareerDossier {
  return {
    ...dossier,
    evidence: dossier.evidence.map((record) =>
      record.id === evidenceId
        ? { ...record, disclosureReview: decision, disclosureReviewedText: record.detail, updatedAt: nowIso }
        : record
    ),
    updatedAt: nowIso
  };
}
