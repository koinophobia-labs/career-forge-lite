import { classifyEvidenceAdmissibility, isProfessionalEvidence } from "@/lib/evidence-admissibility";
import { isUncertaintyStatement, stripTerminationReasons, toResumeVoice } from "@/lib/truth-guards";
import { isUsableEvidence } from "@/lib/evidence-admissibility";
import type { ResumePackage } from "@/types/career";
import type { TargetLane } from "@/types/command-center";
import type {
  CareerDossier,
  DossierEvidenceRecord,
  DossierRole,
  ResumeEvidenceReference,
  ResumePack,
  ResumeVariant
} from "@/types/dossier";

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/** Why an approved record was kept out of every document, for the receipt. */
function withheldReason(item: DossierEvidenceRecord): string {
  if (item.kind === "goal") return "Target preference (never résumé content)";
  if (item.kind === "constraint") return "Constraint (never résumé content)";
  const category = classifyEvidenceAdmissibility(item.detail);
  if (category === "separation_reason") return "Reason for leaving a role (never résumé content)";
  if (category === "uncertainty") return "Uncertain statement (not evidence)";
  if (category === "preference") return "Target preference (never résumé content)";
  if (category === "constraint") return "Constraint (never résumé content)";
  return "Evidence gap (never résumé content)";
}

// Approved evidence arrives as the user wrote it — first person, sometimes
// with the reason a job ended. Documents get the same fact in résumé voice,
// and termination reasons are withheld (and reported as withheld, so the
// omission is visibly deliberate).
function cleanFact(detail: string): { text: string; withheld: boolean } {
  const stripped = stripTerminationReasons(detail);
  const voiced = toResumeVoice(stripped.text)
    .replace(/\s{2,}/g, " ")
    .replace(/[.;,\s]+$/, "");
  // Nothing is withheld by a heuristic any more — the classifier cannot mutate
  // text and cannot decide. Exclusions come from the user's own resolution of
  // a needs_review item, and are reported as such by the receipt.
  return { text: voiced, withheld: stripped.withheld };
}

// "Tools: Workday, Kronos, and some Excel from class" is ONE evidence record
// but many (or zero) résumé skills. Split into defensible atoms; prefer
// dropping a fragment over shipping a broken one.
function skillAtoms(detail: string): string[] {
  const withoutLabel = detail.replace(/^[A-Za-z &/-]{2,24}:\s*/, "");
  return unique(
    withoutLabel
      .split(/[,;|•\n]/)
      .map((part) => part.trim().replace(/^(and|or|plus|also)\s+/i, "").replace(/^some\s+/i, ""))
      .map((part) => part.replace(/\s+from\s+(a\s+|my\s+)?(class|classes|school|college|course|work|training|bootcamp).*$/i, "").trim())
      .filter((part) => {
        if (part.length < 2 || part.length > 40) return false;
        if (part.split(/\s+/).length > 4) return false; // sentences aren't skills
        return !/^(etc\.?|other|more|misc)$/i.test(part);
      })
  );
}

const bulletEvidenceKinds = new Set(["responsibility", "metric", "proof", "story"]);

// Heading-shaped evidence ("Founder — Loomwork Studio | 2023–Present") heads
// a section; reprinting it as a bullet or summary fact reads as broken.
function looksLikeHeading(detail: string): boolean {
  return /—|·|\|/.test(detail) && /(19|20)\d{2}|present|current/i.test(detail) && detail.length < 90 && !/[.!?]$/.test(detail.trim());
}

// The user's own name/email/phone sometimes gets classified as generic proof
// during import; identity values must never become document content.
function identityValueSet(dossier: CareerDossier): Set<string> {
  return new Set(
    [dossier.identity.fullName, dossier.identity.email, dossier.identity.phone, ...dossier.identity.links]
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isIdentityFact(detail: string, identityValues: Set<string>): boolean {
  return identityValues.has(detail.trim().toLowerCase());
}

// Turns one evidence record into at most a few résumé bullets: multi-line
// details split per line, everything cleaned into résumé voice. Returns []
// rather than a broken fragment.
function bulletsFromEvidence(item: DossierEvidenceRecord, withheld: string[]): string[] {
  return item.detail
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2 && !isUncertaintyStatement(line))
    .slice(0, 3)
    .flatMap((line) => {
      const cleaned = cleanFact(line);
      if (cleaned.withheld) withheld.push("Withheld from this document");
      if (!cleaned.text || cleaned.text.split(/\s+/).length < 2) return [];
      return [cleaned.text];
    });
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
  // Admissibility is derived, never stored on the record — sanitization does
  // not rewrite `kind`, so approval alone says nothing about whether a record
  // may enter career materials. Without this check a quarantined gap statement
  // or target-role preference kept its original kind, entered the in-memory
  // résumé, its evidence references and the pack receipt, and rendered in the
  // /versions editor and evidence drawer. The exported file stayed clean only
  // because sanitizeResumeForProfessionalUse catches it at the export boundary.
  return dossier.evidence.filter((item) => isUsableEvidence(item) && isProfessionalEvidence(item));
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
): { resume: ResumePackage; references: ResumeEvidenceReference[]; evidenceUsed: string[]; withheldFacts: string[]; omittedRoles: string[] } {
  const approved = approvedEvidence(dossier);
  const withheldFacts: string[] = [];
  const omittedRoles: string[] = [];
  // Records the user approved that are not admissible are excluded above, so
  // nothing downstream can report them. Naming them here keeps the receipt
  // honest about WHAT was withheld and WHY — quarantine that is invisible is
  // just a quieter version of deleting the record.
  //
  // Only content-shaped records count as "withheld". Goals, constraints and
  // identity are context by design and were never candidates for a document, so
  // listing them would turn every ordinary pack receipt into a false refusal.
  dossier.evidence
    .filter((item) =>
      isUsableEvidence(item) &&
      item.kind !== "goal" && item.kind !== "constraint" && item.kind !== "identity" &&
      !isProfessionalEvidence(item))
    .forEach((item) => withheldFacts.push(withheldReason(item)));
  const identityValues = identityValueSet(dossier);
  const isDocumentFact = (item: DossierEvidenceRecord) =>
    !isIdentityFact(item.detail, identityValues) && !looksLikeHeading(item.detail);
  const ranked = [...approved].sort((a, b) => relevance(b, lane) - relevance(a, lane));
  const relevant = ranked.filter((item) => relevance(item, lane) > 0);
  const chosen = unique((relevant.length ? relevant : ranked).slice(0, kind === "ats" ? 18 : 10).map((item) => item.id));
  const chosenSet = new Set(chosen);
  // Education, skills/tools, and role/project support are structural: they
  // render whenever approved, regardless of lane-relevance ranking (a résumé
  // with the education or skills silently missing is broken, not "focused").
  approved.forEach((item) => {
    const structural = item.kind === "education" || item.kind === "skill" || item.kind === "tool" ||
      dossier.roles.some((role) => role.evidenceIds.includes(item.id)) ||
      dossier.projects.some((project) => project.evidenceIds.includes(item.id));
    if (structural && !chosenSet.has(item.id)) {
      chosenSet.add(item.id);
      chosen.push(item.id);
    }
  });
  const mapping = new Map<string, { evidenceIds: string[]; supportType: ResumeEvidenceReference["supportType"] }>();
  const mapClaim = (claim: string, ids: string[], supportType: ResumeEvidenceReference["supportType"] = "direct") => {
    const valid = unique(ids).filter((id) => chosenSet.has(id));
    if (claim.trim() && valid.length) mapping.set(claim, { evidenceIds: valid, supportType });
  };

  const skills = unique(
    ranked
      .filter((item) => chosenSet.has(item.id) && (item.kind === "skill" || item.kind === "tool"))
      .flatMap((item) => skillAtoms(item.detail).map((atom) => { mapClaim(atom, [item.id]); return atom; }))
  ).slice(0, kind === "ats" ? 14 : 6);

  const proof = ranked.filter((item) => chosenSet.has(item.id) && ["responsibility", "proof", "metric"].includes(item.kind) && isDocumentFact(item));
  const summaryEvidence = proof.slice(0, kind === "ats" ? 2 : 3);
  const summaryFacts = summaryEvidence.flatMap((item) => {
    const cleaned = cleanFact(item.detail.split(/\n/)[0]);
    if (cleaned.withheld) withheldFacts.push("Withheld from this document");
    return cleaned.text ? [cleaned.text] : [];
  });
  const summary = summaryFacts.length
    ? kind === "ats"
      ? `${lane.title} candidate. ${summaryFacts.join(". ")}.`
      : `${summaryFacts.join(". ")}. Focused on ${lane.title} work.`
    : `Career focus: ${lane.title}. Add approved role or project evidence before using this résumé.`;
  mapClaim(summary, summaryEvidence.map((item) => item.id), "transferred");

  // ---------------------------------------------------------------------
  // Evidence ownership.
  //
  // PRIMARY, structural: a record stamped with `roleId` may be cited only by
  // that role. Nothing about the text matters, so one employer's duties can
  // never be printed under another — including when both roles legitimately
  // record the same string, which happens routinely because intakeFromDossier()
  // prefills the intake form from the GLOBAL dossier pool.
  //
  // FALLBACK, for records written before ownership existed: an unowned record
  // linked to MORE THAN ONE role is ambiguous, and may be used only by a role
  // that independently records the same detail. Corroboration requires a real
  // token match, not a substring — a two-word fragment like "customer service"
  // must not vouch for "Troubleshot Northwind laptops for the customer service
  // floor". Legacy dossiers are therefore repaired at generation time, with no
  // migration and without ever guessing an attribution.
  // ---------------------------------------------------------------------
  const roleClaimCounts = new Map<string, number>();
  dossier.roles.forEach((role) => {
    new Set(role.evidenceIds).forEach((id) => roleClaimCounts.set(id, (roleClaimCounts.get(id) ?? 0) + 1));
  });
  const ambiguousEvidenceIds = new Set(
    [...roleClaimCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id)
  );
  const contentTokens = (value: string): Set<string> =>
    new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
  const roleRecordsDetail = (role: DossierRole, detail: string): boolean => {
    const needle = contentTokens(detail);
    if (needle.size === 0) return false;
    return [...role.responsibilities, ...role.outcomes, ...role.tools].some((text) => {
      const own = contentTokens(text);
      // Too short to vouch for anything.
      if (own.size < 3) return false;
      const overlap = [...needle].filter((token) => own.has(token)).length;
      // The role's own wording must account for most of the evidence, in both
      // directions — a shared phrase is not the same as a shared fact.
      return overlap / needle.size >= 0.8 && overlap / own.size >= 0.8;
    });
  };
  const roleOwnsEvidence = (role: DossierRole, item: DossierEvidenceRecord): boolean => {
    if (item.roleId) return item.roleId === role.id;
    if (!ambiguousEvidenceIds.has(item.id)) return true;
    return roleRecordsDetail(role, item.detail);
  };
  // Any record owned by a role is off-limits to projects and to the loose
  // accomplishments section, which would otherwise reprint it without an
  // employer boundary.
  const roleOwnedEvidenceIds = new Set(
    dossier.evidence.filter((item) => item.roleId).map((item) => item.id)
  );

  const usedByRoles = new Set<string>();
  const roleEntries = dossier.roles.flatMap((role) => {
    const support = evidenceByIds(approved, role.evidenceIds)
      .filter((item) => chosenSet.has(item.id))
      .filter((item) => roleOwnsEvidence(role, item));
    if (!support.length) return [];
    const heading = [role.title, role.employer, [role.startDate, role.endDate].filter(Boolean).join("–")].filter(Boolean).join(" · ");
    mapClaim(heading, support.map((item) => item.id));
    // Bullets come from the role's structured outcomes/responsibilities AND
    // directly from its linked evidence — an imported role whose facts only
    // exist as evidence records still gets real bullets.
    const structuredBullets = unique([...role.outcomes, ...role.responsibilities]).flatMap((bullet) => {
      const exact = support.filter((item) => item.detail.toLowerCase().includes(bullet.toLowerCase()) || bullet.toLowerCase().includes(item.detail.toLowerCase()));
      if (!exact.length) return [];
      const cleaned = cleanFact(bullet);
      if (cleaned.withheld) withheldFacts.push("Withheld from this document");
      if (!cleaned.text) return [];
      mapClaim(cleaned.text, exact.map((item) => item.id));
      return [cleaned.text];
    });
    const headingKey = `${role.title} ${role.employer}`.toLowerCase();
    const evidenceBullets = support
      .filter((item) => bulletEvidenceKinds.has(item.kind) && isDocumentFact(item))
      .filter((item) => item.detail.toLowerCase() !== headingKey && !item.detail.toLowerCase().startsWith(role.title.toLowerCase() + " "))
      .flatMap((item) => bulletsFromEvidence(item, withheldFacts).map((bullet) => { mapClaim(bullet, [item.id]); return bullet; }));
    support.forEach((item) => usedByRoles.add(item.id));
    const bullets = unique([...structuredBullets, ...evidenceBullets]).slice(0, kind === "ats" ? 5 : 3);
    if (!bullets.length) {
      // A heading with nothing defensible under it is worse than omission.
      omittedRoles.push([role.title, role.employer].filter(Boolean).join(" · "));
      return [];
    }
    return [{ title: role.title, company: role.employer, time: [role.startDate, role.endDate].filter(Boolean).join("–"), bullets, kind: "role" as const }];
  });

  const projectEntries = dossier.projects.flatMap((project) => {
    if (project.defaultPlacement === "omit") return [];
    // A project may not reprint an employer's facts. The intake-derived
    // independent-work project inherits the current role's evidence ids, and
    // this section applies neither the role guard nor usedByRoles, so without
    // this filter the current job's duties were printed again under a project
    // heading.
    const support = evidenceByIds(approved, project.evidenceIds)
      .filter((item) => chosenSet.has(item.id) && !roleOwnedEvidenceIds.has(item.id));
    if (!support.length) return [];
    // A project is not an employer. No fake "Independent project" company
    // label — the organization line is whatever the user actually recorded
    // (often nothing at all for a personal/school/volunteer project), and
    // the entry is tagged so rendering can put it under its own Projects
    // section instead of flattening it into Experience.
    const heading = [project.name, project.organization, project.dates].filter(Boolean).join(" · ");
    mapClaim(heading, support.map((item) => item.id));
    const structuredBullets = unique([project.description, ...project.outcomes, ...project.metrics, ...project.responsibilities])
      .flatMap((candidate) => candidate.split(/\n+/))
      .map((candidate) => candidate.trim())
      .filter((candidate) => Boolean(candidate) && !looksLikeHeading(candidate))
      .flatMap((bullet) => {
        const exact = support.filter((item) => item.detail.toLowerCase().includes(bullet.toLowerCase()) || bullet.toLowerCase().includes(item.detail.toLowerCase()));
        if (!exact.length) return [];
        const cleaned = cleanFact(bullet);
        if (!cleaned.text) return [];
        mapClaim(cleaned.text, exact.map((item) => item.id));
        return [cleaned.text];
      });
    const evidenceBullets = support
      .filter((item) => bulletEvidenceKinds.has(item.kind) && isDocumentFact(item))
      .flatMap((item) => bulletsFromEvidence(item, withheldFacts).map((bullet) => { mapClaim(bullet, [item.id]); return bullet; }));
    support.forEach((item) => usedByRoles.add(item.id));
    const bullets = unique([...structuredBullets, ...evidenceBullets]).slice(0, kind === "ats" ? 5 : 4);
    if (!bullets.length) return [];
    // The user explicitly chose "Experience" placement for this project (via
    // the dossier's placement selector) — honor it and render alongside
    // roles rather than splitting it into a separate section they didn't ask
    // for. Every other placement ("projects"/"selected-projects", and the
    // default) renders as a project.
    const entryKind: "role" | "project" = project.defaultPlacement === "experience" ? "role" : "project";
    return [{ title: project.name, company: project.organization, time: project.dates, bullets, kind: entryKind }];
  });

  // Approved metrics and proof that no role or project claimed still belong
  // on the document — a "Selected accomplishments" block beats silently
  // wasting the user's strongest facts.
  const looseIds: string[] = [];
  const looseAccomplishments = ranked
    .filter((item) => chosenSet.has(item.id) && !usedByRoles.has(item.id) && (item.kind === "metric" || item.kind === "proof") && isDocumentFact(item))
    .flatMap((item) => bulletsFromEvidence(item, withheldFacts).map((bullet) => { mapClaim(bullet, [item.id]); looseIds.push(item.id); return bullet; }))
    .slice(0, kind === "ats" ? 5 : 3);
  const accomplishmentEntries = looseAccomplishments.length
    ? [{ title: "Selected accomplishments", company: "", time: "", bullets: looseAccomplishments }]
    : [];
  if (accomplishmentEntries.length) mapClaim("Selected accomplishments", looseIds);

  const experience = kind === "ats"
    ? [...roleEntries, ...projectEntries, ...accomplishmentEntries]
    : [...projectEntries, ...roleEntries, ...accomplishmentEntries];

  const educationEntries = dossier.education.flatMap((item) => {
    const support = evidenceByIds(approved, item.evidenceIds).filter((evidence) => chosenSet.has(evidence.id));
    if (!support.length) return [];
    const text = [item.credential, item.field, item.institution, item.dates].filter(Boolean).join(", ");
    mapClaim(text, support.map((evidence) => evidence.id));
    return [text];
  });
  const education = educationEntries.join("; ");

  const headline = `${lane.title}${skills.length ? ` | ${skills.slice(0, 3).join(" | ")}` : ""}`.slice(0, 200).replace(/ \| $/, "");
  const headlineSupport = unique([...summaryEvidence.map((item) => item.id), ...ranked.filter((item) => item.kind === "skill" || item.kind === "tool").filter((item) => chosenSet.has(item.id)).map((item) => item.id)]);
  mapClaim(headline, headlineSupport, "transferred");
  // linkedinSummary intentionally equals `summary` for both kinds rather than
  // prepending a standalone "Targeting {lane}." sentence: that sentence is
  // redundant (ATS summary already opens with "{lane.title} candidate.") and,
  // more importantly, the evidence-admissibility sanitizer treats any
  // sentence starting with "targeting" as a user preference statement (real
  // free text like "I'm targeting a career change..." must stay caught) and
  // silently drops it on every read, desyncing the stored claim text from the
  // resume field and losing that claim's evidence reference. Reusing the
  // already-safe `summary` text sidesteps the collision entirely instead of
  // trying to out-guess the classifier's preference patterns.
  const linkedinSummary = summary;
  mapClaim(linkedinSummary, summaryEvidence.map((item) => item.id), "transferred");
  const resume = { summary, coreSkills: skills, experience, education, linkedinHeadline: headline, linkedinSummary };
  return { resume, references: refsForResume(resume, mapping), evidenceUsed: chosen, withheldFacts: unique(withheldFacts), omittedRoles };
}

function createVariant(
  pack: string,
  lane: TargetLane,
  kind: "ats" | "recruiter",
  dossier: CareerDossier,
  nowIso: string
): { variant: ResumeVariant; withheldFacts: string[]; omittedRoles: string[] } {
  const built = buildLaneResume(dossier, lane, kind);
  const variant: ResumeVariant = {
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
  return { variant, withheldFacts: built.withheldFacts, omittedRoles: built.omittedRoles };
}

// A lane pitch that ships in documents must be first-person-safe fact, not
// second-person coaching ("Frame yourself as..."). Compose it from what the
// pack actually contains.
function composePositioningPitch(lane: TargetLane, skills: string[], summaryFactCount: number): string {
  const lead = skills.slice(0, 3).join(", ");
  if (lead) return `${lane.title} — leading with ${lead}.`;
  if (summaryFactCount > 0) return `${lane.title} — positioned on approved experience.`;
  return `${lane.title} — add approved evidence to strengthen this lane.`;
}

export function generateResumePack(dossier: CareerDossier, lanes: TargetLane[], nowIso = new Date().toISOString()): ResumePack {
  const active = lanes.filter((lane) => lane.status === "active").slice(0, 3);
  const id = packId(nowIso);
  const approved = approvedEvidence(dossier);
  const variants: ResumeVariant[] = [];
  const withheld: string[] = [];
  const omitted: string[] = [];
  const lanePacks = active.map((lane) => {
    const ats = createVariant(id, lane, "ats", dossier, nowIso);
    const recruiter = createVariant(id, lane, "recruiter", dossier, nowIso);
    variants.push(ats.variant, recruiter.variant);
    withheld.push(...ats.withheldFacts, ...recruiter.withheldFacts);
    omitted.push(...ats.omittedRoles, ...recruiter.omittedRoles);
    const evidenceUsed = unique([...ats.variant.evidenceReferences, ...recruiter.variant.evidenceReferences].flatMap((item) => item.evidenceIds));
    return {
      laneId: lane.id,
      positioningPitch: composePositioningPitch(lane, ats.variant.resume.coreSkills, ats.variant.evidenceReferences.length),
      variantIds: [ats.variant.id, recruiter.variant.id], evidenceUsed,
      evidenceOmitted: approved.filter((item) => !evidenceUsed.includes(item.id)).map((item) => item.id), gapsAvoided: lane.gaps
    };
  });
  // The receipt is a factual claim about this document, so it is derived from
  // what the document ACTUALLY CONTAINS — not from generation success and not
  // from the count of approved facts. Deriving it from evidenceReferences
  // reported "Approved professional evidence used: 11 / not used: 0" for a
  // pack whose résumés contained neither of two typed responsibilities. A
  // reference records that a fact was considered; only the rendered text
  // records that it was used.
  const renderedCorpus = variants
    .map((variant) => JSON.stringify(variant.resume))
    .join(" ")
    .toLowerCase();
  const appearsInDocument = (item: DossierEvidenceRecord): boolean => {
    const cleaned = cleanFact(item.detail).text.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    if (!cleaned) return false;
    const haystack = renderedCorpus.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ");
    if (haystack.includes(cleaned)) return true;
    // A long sentence may be rendered as a trimmed clause; require a
    // substantial run of its words rather than a single shared token.
    const words = cleaned.split(" ").filter((word) => word.length > 3);
    if (words.length < 4) return false;
    return haystack.includes(words.slice(0, 4).join(" "));
  };
  const used = unique(approved.filter(appearsInDocument).map((item) => item.id));
  const transferred = unique(variants.flatMap((variant) => variant.evidenceReferences.filter((reference) => reference.supportType === "transferred").map((reference) => reference.claimText)));
  const first = variants[0]?.resume;
  // Proof-bank entries are user-facing document material: uncertainty
  // statements and termination reasons never belong in it.
  const identityValues = identityValueSet(dossier);
  const proofBank = unique(
    dossier.proofPoints
      .concat(approved.filter((item) => item.kind === "proof" || item.kind === "metric").map((item) => item.detail))
      .filter((entry) => !isUncertaintyStatement(entry) && !isIdentityFact(entry, identityValues) && !looksLikeHeading(entry))
      .flatMap((entry) => {
        const cleaned = cleanFact(entry);
        if (cleaned.withheld) withheld.push("Withheld from this document");
        return cleaned.text ? [cleaned.text] : [];
      })
  );
  return {
    id, dossierId: dossier.id, status: "current", lanePacks, variants,
    linkedinHeadlines: unique(variants.map((item) => item.resume.linkedinHeadline)).slice(0, 6),
    linkedinAbout: first?.linkedinSummary || first?.summary || "",
    linkedinSkills: unique(variants.flatMap((item) => item.resume.coreSkills)).slice(0, 30),
    masterProofBank: proofBank,
    coverLetterFoundation: approved.length ? (() => {
          // Withheld facts leave an empty slot, which rendered as bare
          // semicolons: "Approved evidence to draw from: ; Drove clients; ".
          const usable = approved.map((item) => cleanFact(item.detail).text).filter(Boolean).slice(0, 3);
          return usable.length
            ? `Approved evidence to draw from: ${usable.join("; ")}`
            : "Approve proof points before drafting a cover letter.";
        })() : "Approve proof points before drafting a cover letter.",
    receipt: {
      id: `${id}-receipt`, generatedAt: nowIso, evidenceUsed: used,
      // Unresolved items are not "omitted" — nobody has decided yet. Counting
      // them as omitted would be the product answering a question it just
      // asked the user.
      evidenceOmitted: approved
        .filter((item) => !used.includes(item.id) && item.disclosureReview !== "needs_review")
        .map((item) => item.id),
      laneFraming: lanePacks.map((lanePack) => ({ laneId: lanePack.laneId, angle: lanePack.positioningPitch })),
      keywordsIncluded: unique(active.flatMap((lane) => lane.keywords).filter((keyword) => approved.some((item) => item.detail.toLowerCase().includes(keyword.toLowerCase())))),
      gapsAvoided: unique(active.flatMap((lane) => lane.gaps)),
      // Truthful accounting. An exclusion is the USER'S decision, named as
      // such — the product no longer invents a reason for a disappearance.
      // Items still awaiting review are reported as awaiting review, and are
      // counted as neither used nor omitted.
      itemsExcludedByUser: dossier.evidence.filter((item) => item.disclosureReview === "exclude").length,
      itemsAwaitingReview: dossier.evidence.filter((item) => item.disclosureReview === "needs_review").length,
      unsupportedClaimsRefused: unique([
        ...withheld,
        ...(dossier.evidence.some((item) => item.disclosureReview === "exclude")
          ? [`${dossier.evidence.filter((item) => item.disclosureReview === "exclude").length} item(s) excluded by you after review`]
          : []),
        ...(dossier.evidence.some((item) => item.disclosureReview === "needs_review")
          ? [`${dossier.evidence.filter((item) => item.disclosureReview === "needs_review").length} item(s) still awaiting your review`]
          : []),
        ...unique(omitted).map((role) => `Role omitted (no usable approved detail yet): ${role}`)
      ]),
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
