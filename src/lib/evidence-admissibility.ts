import { asClaimText, type ClaimText } from "@/lib/claim-text";
import {
  mergeImportProposals as mergeBaseImportProposals,
  parseResumePackToProposals as parseBaseResumePackToProposals,
  projectProfileFromDossier
} from "@/lib/dossier";
import {
  containsTerminationReason,
  isUncertaintyStatement,
  // (no truth-guard withholding on this path -- see sanitizeProfessionalLine)
} from "@/lib/truth-guards";
import { eligibleUserText, evidenceEligibility, isUsable, resolutionIsStale } from "@/lib/evidence-read";
import { harvestHistoricalRoles, missingEmploymentCandidates, organizationIdentity, recoverRoleStructure, roleHasStructure } from "@/lib/employment-structure";
import type { ResumePackage } from "@/types/career";
import type { CommandCenterState, ResumeVersionRecord } from "@/types/command-center";
import type {
  CareerDossier,
  DossierEvidenceRecord,
  DossierProject,
  EvidenceKind,
  ImportProposalRecord,
  PendingImportReview,
  ResumeEvidenceReference,
  ResumePack,
  ResumeVariant
} from "@/types/dossier";

export type EvidenceAdmissibility =
  | "claim"
  | "constraint"
  | "preference"
  | "gap"
  | "separation_reason"
  | "uncertainty";

/**
 * Usable in a generated document.
 *
 * A record flagged as a possible disclosure is NOT usable until the user has
 * resolved it: "needs_review" waits for them, "exclude" is their decision to
 * leave it off, "keep" is their confirmation that it describes their work.
 * The record is never deleted and its text is never altered — the only thing
 * the flag changes is whether generation may draw on it yet.
 */
type ReviewableEvidence = {
  approved: boolean;
  rejected: boolean;
  detail?: string;
  disclosureReview?: string;
  disclosureReviewedText?: string;
};

/**
 * These three now DELEGATE to the canonical reader in evidence-read.ts. They
 * are kept as named predicates because call sites read well, but there is only
 * one definition of eligibility in the product and it is not this one.
 */
export function disclosureResolutionIsStale(item: ReviewableEvidence): boolean {
  return resolutionIsStale(item as Parameters<typeof resolutionIsStale>[0]);
}

export function isUsableEvidence(item: ReviewableEvidence): boolean {
  return isUsable(item as Parameters<typeof isUsable>[0]);
}

/** Flagged and still undecided — an export must surface these, not guess. */
export function needsDisclosureReview(item: ReviewableEvidence): boolean {
  const reason = evidenceEligibility(item as Parameters<typeof evidenceEligibility>[0]).reason;
  return reason === "awaiting_review" || reason === "stale_resolution" || reason === "unreviewed_disclosure";
}

const PROFESSIONAL_KINDS = new Set<EvidenceKind>([
  "role",
  "project",
  "education",
  "responsibility",
  "tool",
  "skill",
  "metric",
  "proof",
  "story"
]);

const TARGET_PREFERENCE_PATTERNS = [
  /^\s*(?:target(?:ed|ing)?|preferred|desired|ideal)\s+roles?\s*:/i,
  /^\s*(?:roles?\s+(?:of interest|wanted)|career targets?)\s*:/i,
  /^\s*(?:i(?:'m| am)?\s+)?(?:seeking|looking for|interested in|targeting)\b/i,
  /^\s*i\s+(?:want|would like|hope)\s+to\b/i
];

// ---------------------------------------------------------------------------
// Self-declared gap detection
//
// Two failure modes have to be avoided at once, and an earlier attempt at this
// traded one for the other:
//
//   FALSE POSITIVE — an ordinary achievement is read as a gap and withheld:
//     "Ensured contractors did not work without a valid permit"
//     "We did not have a single security breach in 18 months"
//   FALSE NEGATIVE — a genuine self-reported gap is treated as a claim and
//   printed on the résumé, which is far worse:
//     "Currently do not have leadership experience"
//     "Unfortunately did not manage anyone directly"
//
// Sentence position is the wrong signal: an adverb in front ("Currently…",
// "Honestly…") defeats a leading anchor. Two signals are used instead, and BOTH
// must hold:
//   1. SUBJECT — the negation is about the candidate, not a third party. The
//      word immediately before the auxiliary decides it; adverbs are skipped.
//   2. OBJECT — what is negated is evidence, a credential, or people managed.
//      "did not have a security breach" negates a bad outcome (an achievement);
//      "do not have a degree" negates a credential (a gap).
// ---------------------------------------------------------------------------

// The verb slot is OPEN. A closed list ("manage|own|lead|…") let any gap
// phrased with an unlisted verb through as a positive claim: "I have never
// trained anyone" was classified as a claim and shipped as the résumé bullet
// "Supported have never trained anyone." The real signals are the three that
// follow — negation, a self subject, and a gap OBJECT — and none of them
// depend on which verb the user reached for.
//
// The one thing worth enumerating is the opposite case: negating a BAD
// OUTCOME is an accomplishment, not a gap ("did not lose any data", "never
// missed a deadline"). Those verbs are a small, closed, and stable set,
// unlike the open set of things people do at work.
const ACHIEVEMENT_VERBS = "lose|loses|losing|lost|miss|misses|missing|missed|break|breaks|breaking|broke|broken|fail|fails|failing|failed|damage|damages|damaging|damaged|breach|breaches|breaching|breached|violate|violates|violating|violated";
// The scan anchors on the NEGATION itself rather than on a verb. Trying to
// name the verb slot failed both ways: a closed list missed "trained", and an
// open slot swallowed the auxiliary carrying the negation ("havent" read as
// the verb). The negator is the one token that must be present, so it is the
// anchor, and the subject and object are read around it.
// The apostrophe is REQUIRED. With it optional, every word ending in "nt"
// (management, equipment, different, important) scanned as a negation.
const NEGATOR = /\b(?:not|never)\b|\b(?:do|does|did|have|has|had|is|are|was|were|ca|wo|would|could|should|must|need|ai)n['’]?t\b/gi;

// Nouns whose ABSENCE is a gap in a candidate's evidence.
const GAP_OBJECTS =
  /\b(?:employment|experience|metrics?|outcomes?|results?|leadership|title|ownership|credentials?|certif\w*|degree|diploma|qualifications?|licen[cs]e[sd]?|background|history|training|education|supervis\w*|budget|p&l|team|teams|reports?|anyone|anybody|people|staff|direct\s+reports?|numbers?|data|saas|software\s+implementation|project[-\s]?management)\b/i;

// Words that may sit between the subject and the auxiliary without changing who
// the subject is. Adverbs are open-class, so anything ending in -ly counts too.
const SUBJECT_SKIP = /^(?:currently|honestly|truthfully|unfortunately|sadly|generally|really|still|yet|ever|also|now|today|personally|admittedly|frankly|so|far|right|just|simply|even|actually|point|moment|present|date|stage|time|case)$/i;
const FIRST_PERSON = /^(?:i|we|my|our|me|us)$/i;
// A subordinator before the auxiliary means the clause subject is elided from
// the candidate's own sentence, e.g. "Built the runbook so we did not have…".
const SUBORDINATOR = /^(?:that|so|because|since|until|till|when|where|which|who|whom|whose|while|after|before|if|and|but|or|then|thus)$/i;
const AUXILIARY_WORD = /^(?:do|does|did|have|has|had|is|are|was|were|be|been|being|not|never|n['’]?t)$/i;
const DETERMINER = /^(?:the|that|this|these|those|a|an|my|our|his|her|their|its)$/i;
const PREPOSITION = /^(?:in|at|on|during|for|with|from|by|under|over|across|after|before|since|throughout|within|of|as|to|up|about|around|per|via)$/i;

/**
 * True when a negated clause is the CANDIDATE reporting a gap in their own
 * evidence, rather than an accomplishment described with a negation.
 */
function hasSelfDeclaredGapClause(value: string): boolean {
  // Anchor on the negator: "not", "never", or any contraction ending in n't.
  // Everything after it, up to the first preposition, is the object.
  const pattern = new RegExp(NEGATOR.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    // A contraction only negates when the n't is the contraction's own tail
    // ("havent", "didn't") — never a word that merely ends in those letters.
    if (!/^(?:not|never)$/i.test(match[0]) && !/(?:do|does|did|have|has|had|is|are|was|were|ca|wo|would|could|should|must|need)n['’]?t$/i.test(match[0])) continue;

    // --- 1. Whose gap is it? Walk left, skipping adverbs, to find the subject.
    const before = value.slice(0, match.index).trim().split(/\s+/).filter(Boolean);
    const wordAt = (i: number) => (before[i] ?? "").replace(/[^A-Za-z'’&]/g, "");
    let subject = "";
    for (let i = before.length - 1; i >= 0; i -= 1) {
      const word = wordAt(i);
      if (!word) continue;
      if (SUBJECT_SKIP.test(word) || /ly$/i.test(word)) continue;
      // When `never` carries the negation the match starts after the
      // auxiliary, so the walk would otherwise read "have" as the subject
      // of "I have never supervised anybody" and call it a third party.
      if (AUXILIARY_WORD.test(word)) continue;
      // A leading adverbial phrase is not a subject: in "In that role did not
      // manage people", "role" is the object of a preposition, and the real
      // subject is the elided candidate.
      if (DETERMINER.test(wordAt(i - 1)) && PREPOSITION.test(wordAt(i - 2))) { i -= 2; continue; }
      if (PREPOSITION.test(wordAt(i - 1))) { i -= 1; continue; }
      subject = word;
      break;
    }
    // No subject at all (clause start, or only adverbs) = the candidate.
    // A first-person subject is the candidate. A subordinator means the subject
    // was elided, which in practice is still the candidate speaking.
    // Anything else — "contractors", "visitors", "auditors", "they" — is a third
    // party, and negating THEIR action is an accomplishment, not a gap.
    const selfReported = subject === "" || FIRST_PERSON.test(subject) || SUBORDINATOR.test(subject);
    if (!selfReported) continue;

    // --- 2. Is evidence being negated, or a bad outcome? Read the object up to
    // the next preposition, which usually starts a qualifying phrase.
    const rest = value.slice(match.index + match[0].length);
    const object = rest.split(/\b(?:on|in|at|for|during|since|with|without|across|over|under|from|to|by)\b/i)[0] ?? rest;
    // Negating a BAD OUTCOME is an accomplishment, not a gap: "did not lose
    // any data", "never missed a deadline". Those verbs are a small, closed,
    // stable set — unlike the open set of things people do at work, which is
    // why the verb is not otherwise named.
    if (new RegExp(`^\\W*(?:${ACHIEVEMENT_VERBS})\\b`, "i").test(rest)) continue;
    // A NAMED EVIDENCE NOUN is required. Treating any first-person "never" as
    // a gap was too blunt: it quarantined true achievements — "I never had to
    // escalate a single ticket", "I never missed a shift" — and deleted them
    // from the résumé while telling the user they were "not career-material
    // content". Withholding a real accomplishment is its own truth failure.
    // "I have never trained anyone" is still caught, because "anyone" is a gap
    // object; "…closed the register on my own" is not, and stays a claim.
    if (GAP_OBJECTS.test(object)) return true;
  }
  return false;
}

// "no <evidence noun>" is a GAP only when the candidate is describing what
// they lack — not when "with no X" describes HOW they did the work. The two
// readings are opposite claims:
//
//   GAP          "I have no supervisory experience."
//                "No formal training or certifications yet."
//   ACHIEVEMENT  "Completed closing procedures with no supervision."
//                "Trained six new hires with no formal training budget."
//                "Rebuilt the schedule with no history to work from."
//
// A previous version matched "no <noun>" ANYWHERE, so it deleted three of four
// approved accomplishments from every exported document and told the user each
// was an "Evidence gap (never résumé content)". Relation first: a preposition
// in front of "no" makes it adverbial — a description of the conditions, which
// is evidence of independence rather than an absence of evidence.
const ADVERBIAL_NO = /\b(?:with|without|under|despite|using|given|on|after|before|through|from)\s+no\b/i;

const GAP_PATTERNS = [
  /\bno\s+(?![-\s]?code\b)(?:[\w&-]+\s+){0,5}(?:employment|experience|metrics?|outcomes?|results?|leadership|title|ownership|credentials?|certif\w*|degree|diploma|qualifications?|licen[cs]\w*|background|history|training|education|supervis\w*|budget|numbers?|data|saas|software\s+implementation|project[-\s]?management)\b/i,
  /\b(?:i|we)\s+(?:lack|lacks|lacking)\b/i,
  // lack/without + any evidence noun, including ones the old short list missed
  // ("lack any formal project management BACKGROUND").
  /\b(?:lack|lacks|lacking|without)\s+(?:any\s+)?(?:formal\s+)?(?:[\w&-]+\s+){0,5}(?:employment|experience|metrics?|outcomes?|results?|leadership|title|ownership|credentials?|certif\w*|degree|diploma|qualifications?|licen[cs]\w*|background|history|training|education|supervis\w*|budget|project[-\s]?management)\b/i,
  /\bnot\s+(?:yet\s+)?(?:experienced|certified|qualified|credentialed)\b/i,
  /\b(?:i|we)\s+(?:am|are|was|were)\s+(?:not|never)\s+responsible\s+for\b/i
];

const CONSTRAINT_PATTERNS = [
  /^\s*(?:constraint|constraints|availability|schedule|location|salary|compensation|work authorization)\s*:/i,
  /\b(?:cannot|can['’]?t|unable to|must not|not available|only available|requires? remote|requires? hybrid)\b/i
];

const GENERIC_PROJECT_TYPES = /^(?:school|academic|class|course|volunteer|personal|portfolio|independent|community)$/i;

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function contextCategory(kind: EvidenceKind, detail: string): EvidenceAdmissibility {
  if (kind === "goal") return "preference";
  if (kind === "constraint") return "constraint";
  return classifyEvidenceAdmissibility(detail);
}

export function classifyEvidenceAdmissibility(text: string): EvidenceAdmissibility {
  const value = text.trim();
  if (!value) return "gap";
  if (/^no[-\s]?code\b/i.test(value) || /^no\.\s*\d/i.test(value)) return "claim";
  if (isUncertaintyStatement(value)) return "uncertainty";
  if (containsTerminationReason(value)) return "separation_reason";
  if (TARGET_PREFERENCE_PATTERNS.some((pattern) => pattern.test(value))) return "preference";
  if ((!ADVERBIAL_NO.test(value) && GAP_PATTERNS.some((pattern) => pattern.test(value))) || hasSelfDeclaredGapClause(value)) return "gap";
  if (CONSTRAINT_PATTERNS.some((pattern) => pattern.test(value))) return "constraint";
  return "claim";
}

function contextLabel(category: Exclude<EvidenceAdmissibility, "claim">): string {
  if (category === "preference") return "Target preference (context only)";
  if (category === "gap") return "Evidence gap (not career-material content)";
  if (category === "separation_reason") return "Separation reason (withheld from career materials)";
  if (category === "uncertainty") return "Uncertainty (not evidence)";
  return "Constraint (context only)";
}

export function normalizeImportProposal(proposal: ImportProposalRecord): ImportProposalRecord {
  const category = contextCategory(proposal.kind, proposal.detail);
  if (category === "claim") return proposal;
  return {
    ...proposal,
    group: "other",
    kind: category === "preference" ? "goal" : "constraint",
    label: contextLabel(category),
    confidence: category === "uncertainty" ? "high" : proposal.confidence
  };
}

export function parseResumePackToSafeProposals(
  files: Array<{ filename: string; text: string }>
): ImportProposalRecord[] {
  return parseBaseResumePackToProposals(files).map(normalizeImportProposal);
}

export function isProfessionalEvidence(record: DossierEvidenceRecord): boolean {
  return PROFESSIONAL_KINDS.has(record.kind) && contextCategory(record.kind, record.detail) === "claim";
}

function targetRoleValues(detail: string): string[] {
  const cleaned = detail
    .replace(/^.*?(?:target(?:ed|ing)?|preferred|desired|ideal)\s+roles?\s*:\s*/i, "")
    .replace(/^.*?(?:seeking|looking for|interested in|targeting)\s+/i, "")
    .trim();
  return unique(cleaned.split(/\r?\n|;|\||,(?=\s*[A-Z])/));
}

export function sanitizeProfessionalLine(value: ClaimText): string {
  // NOT a product-prose path. It is reached from sanitizeProfessionalParagraph
  // -> safeParagraphArray -> sanitizeResumeForProfessionalUse, i.e. over the
  // USER'S OWN résumé bullets on the way into the exported file. Routing
  // withholdSeparationFromGeneratedProse through here deleted a bullet the user
  // had reviewed and KEPT, and where it was a role's only bullet the employer
  // and its dates went with it — six years of employment erased from the DOCX
  // and PDF while the on-screen résumé still showed them. Admissibility is
  // judged below; nothing is withheld here.
  const stripped = value.trim();
  if (!stripped) return "";
  return classifyEvidenceAdmissibility(stripped) === "claim" ? stripped : "";
}

export function sanitizeProfessionalParagraph(value: ClaimText): string {
  return value
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((part) => sanitizeProfessionalLine(asClaimText(part.trim())))
    .filter(Boolean)
    .join(" ")
    .trim();
}

function safeArray(values: string[]): string[] {
  return unique(values.map((value) => sanitizeProfessionalLine(asClaimText(value))));
}

function safeParagraphArray(values: string[]): string[] {
  return unique(values.map((value) => sanitizeProfessionalParagraph(asClaimText(value))));
}

function normalizeProjectSemantics(project: DossierProject): DossierProject {
  const name = project.name.trim();
  const organization = project.organization.trim();
  if (!GENERIC_PROJECT_TYPES.test(name) || !organization) return project;
  const type = `${name[0]?.toUpperCase() ?? ""}${name.slice(1).toLowerCase()} project`;
  return { ...project, name: organization, organization: type };
}

/** A record the user approved that is not eligible for career materials. */
export type QuarantinedEvidence = {
  id: string;
  /** The user's exact wording, unmodified. */
  detail: string;
  /** The kind the user's record still carries — sanitization does not change it. */
  kind: EvidenceKind;
  category: Exclude<EvidenceAdmissibility, "claim">;
  /** Human-readable reason, for the UI to show the user what was withheld and why. */
  reason: string;
};

export type DossierSanitization = {
  dossier: CareerDossier;
  /**
   * Approved records that are not eligible for career materials. They are
   * QUARANTINED, not deleted and not rewritten: the record stays in
   * `dossier.evidence` exactly as the user left it. Eligibility is DERIVED on
   * every read, so correcting the wording restores the record automatically.
   */
  quarantinedEvidenceIds: string[];
  /** Same set with the reason attached, so a surface can name what was withheld. */
  quarantined: QuarantinedEvidence[];
  contextItems: string[];
};

export function sanitizeCareerDossier(dossier: CareerDossier): DossierSanitization {
  const approvedContext = dossier.evidence.filter(
    (item) => isUsableEvidence(item) && contextCategory(item.kind, item.detail) !== "claim"
  );
  const contextItems = approvedContext.map((item) => item.detail);
  const quarantinedEvidenceIds = approvedContext.map((item) => item.id);
  const quarantined: QuarantinedEvidence[] = approvedContext.map((item) => {
    const category = contextCategory(item.kind, item.detail) as Exclude<EvidenceAdmissibility, "claim">;
    return { id: item.id, detail: item.detail, kind: item.kind, category, reason: contextLabel(category) };
  });

  // Sanitization runs on every state READ (see use-command-center.ts, which
  // persists the result), so it must not mutate the user's record at all.
  //
  // Two earlier designs were wrong. Deleting an approved record erased real
  // work history. Rewriting its `kind` to "constraint" was silently
  // irreversible: contextCategory() short-circuits on kind before it ever
  // classifies the text, so a quarantined record could never be reclassified —
  // correcting the wording did nothing, and the label churned between two
  // values on successive reads, persisting a different state each time.
  //
  // Admissibility is now DERIVED, never stored. The record is returned exactly
  // as the user left it; only its ELIGIBILITY for career materials is computed,
  // and that computation re-runs from the current text on every read. Fixing a
  // misclassification — in the user's wording or in GAP_PATTERNS — restores the
  // record automatically, including for dossiers already on disk.
  const evidence = dossier.evidence;

  const approvedProfessionalIds = new Set(
    evidence.filter((item) => isUsableEvidence(item) && isProfessionalEvidence(item)).map((item) => item.id)
  );
  const approvedProfessional = evidence.filter(
    (item) => isUsableEvidence(item) && isProfessionalEvidence(item)
  );

  const roles = dossier.roles.flatMap((role) => {
    const evidenceIds = role.evidenceIds.filter((id) => approvedProfessionalIds.has(id));
    // TITLE AND EMPLOYER ARE NO LONGER TOUCHED HERE.
    //
    // They used to run through sanitizeProfessionalLine — a classifier that
    // judges whether a RÉSUMÉ CLAIM is defensible — which blanked "No
    // Boundaries Training Ltd", "Parenta" and "Recovery Support Worker". This
    // function runs on every state READ and its output is PERSISTED, so the
    // employer name was not withheld from one document, it was destroyed on
    // disk and the next read had nothing left to recover from.
    //
    // Admissibility is derived, never stored — the same rule the evidence
    // records above already follow. The structural record comes back exactly as
    // the user left it, and the identity/narrative split happens where a
    // document is actually built (organizationIdentity), so nothing a
    // classifier decides can ever reach storage.
    //
    // The role is kept whenever ANY structural field identifies it. Employment
    // is a fact about the person's life; the admissibility of a bullet, or of
    // the employer's own name, says nothing about whether they held the job.
    if (!roleHasStructure(role)) return [];
    return [{
      ...role,
      responsibilities: safeParagraphArray(role.responsibilities),
      tools: safeArray(role.tools),
      outcomes: safeArray(role.outcomes).length ? safeParagraphArray(role.outcomes) : role.outcomes,
      evidenceIds
    }];
  });

  const projects = dossier.projects.flatMap((rawProject) => {
    const normalized = normalizeProjectSemantics(rawProject);
    // Projects are NOT employment structure and deliberately keep admissibility
    // here. A role is a fact about where someone worked; a project row is often
    // synthesized by the importer out of the user's prose, and one whose name is
    // a denial ("I never built a SaaS") is noise, not history.
    //
    // Residual risk, recorded rather than hidden: a REAL project whose name the
    // gap classifier dislikes ("Recovery Support Programme") is still dropped
    // here. That is the same class as the role defect and belongs to the
    // cluster C follow-up, but it needs container-vs-contents semantics for
    // projects specifically, not the employment rule copied across.
    // PROJECTS ARE DELIBERATELY LEFT AS THEY WERE, and this asClaimText() is
    // the marker for that decision rather than an oversight.
    //
    // A project name is structural in the same way an employer is, so by the
    // Cluster C rule these two lines are wrong. But projects are a separate
    // container-vs-content problem with their own behaviour attached — the
    // classifier is currently what removes a "project" whose name is really a
    // gap statement ("No SaaS experience yet") — and unpicking that belongs to
    // its own repair with its own controls, not to a widening of Cluster C.
    //
    // Recorded, scoped out, and visible: grep asClaimText in this file and this
    // is the one call that is knowingly on the wrong side of the line.
    const name = sanitizeProfessionalLine(asClaimText(normalized.name));
    const organization = sanitizeProfessionalLine(asClaimText(normalized.organization));
    const description = sanitizeProfessionalParagraph(asClaimText(normalized.description));
    const evidenceIds = normalized.evidenceIds.filter((id) => approvedProfessionalIds.has(id));
    // Kept whenever it still has a usable name — see the role comment above.
    if (!name) return [];
    return [{
      ...normalized,
      name,
      organization,
      description,
      responsibilities: safeParagraphArray(normalized.responsibilities),
      tools: safeArray(normalized.tools),
      outcomes: safeParagraphArray(normalized.outcomes),
      metrics: safeArray(normalized.metrics),
      evidenceIds
    }];
  });

  const education = dossier.education.flatMap((item) => {
    // STRUCTURAL — not a claim, so not classified. These are facts about where
    // the user worked or studied, and the claim classifier reads real
    // organisation names ("No Boundaries Training Ltd", "Parenta") as evidence
    // gaps and blanks them. The type barrier in claim-text.ts now makes handing
    // them to it a compile error rather than something to remember.
    const credential = item.credential;
    const institution = item.institution;
    const field = item.field;
    const evidenceIds = item.evidenceIds.filter((id) => approvedProfessionalIds.has(id));
    // Kept whenever it still names a credential or institution.
    if (!credential && !institution) return [];
    return [{ ...item, credential, institution, field, evidenceIds }];
  });

  const preferences = approvedContext.filter((item) => contextCategory(item.kind, item.detail) === "preference");
  const constraints = approvedContext.filter((item) => contextCategory(item.kind, item.detail) !== "preference");
  const safetyNote = quarantinedEvidenceIds.length
    ? "Context-only import items were separated from professional evidence and cannot enter generated career materials."
    : "";

  return {
    quarantinedEvidenceIds,
    quarantined,
    contextItems,
    dossier: {
      ...dossier,
      roles,
      projects,
      education,
      responsibilities: safeParagraphArray(dossier.responsibilities),
      tools: safeArray(dossier.tools),
      transferableSkills: safeArray(dossier.transferableSkills),
      outcomes: safeParagraphArray(dossier.outcomes),
      metrics: safeArray(dossier.metrics),
      proofPoints: safeParagraphArray(dossier.proofPoints),
      interviewStories: safeParagraphArray(dossier.interviewStories),
      constraints: unique([...dossier.constraints, ...constraints.map((item) => item.detail)]),
      targetRoleInterests: unique([
        ...dossier.targetRoleInterests,
        ...preferences.flatMap((item) => targetRoleValues(item.detail))
      ]),
      approvedClaims: unique(approvedProfessional.map((item) => item.detail)),
      evidence,
      unstructuredNotes: safeParagraphArray(dossier.unstructuredNotes),
      migrationReview: unique([...dossier.migrationReview, safetyNote])
    }
  };
}

export function mergeSafeImportProposals(
  dossier: CareerDossier,
  proposals: ImportProposalRecord[],
  nowIso = new Date().toISOString(),
  retainSourceFilenames = false
): CareerDossier {
  const merged = mergeBaseImportProposals(
    dossier,
    proposals.map(normalizeImportProposal),
    nowIso,
    retainSourceFilenames
  );
  return sanitizeCareerDossier(merged).dossier;
}

function claimsForResume(resume: ResumePackage): Array<{ path: string; text: string }> {
  const claims: Array<{ path: string; text: string }> = [];
  const add = (path: string, text: string) => { if (text.trim()) claims.push({ path, text }); };
  add("summary", resume.summary);
  resume.coreSkills.forEach((text, index) => add(`coreSkills.${index}`, text));
  resume.experience.forEach((role, roleIndex) => {
    add(`experience.${roleIndex}.heading`, [role.title, role.company, role.time].filter(Boolean).join(" · "));
    role.bullets.forEach((text, index) => add(`experience.${roleIndex}.bullets.${index}`, text));
  });
  add("education", resume.education);
  add("linkedinHeadline", resume.linkedinHeadline);
  add("linkedinSummary", resume.linkedinSummary);
  return claims;
}

function sanitizeClaimForPath(path: string, text: string): string {
  return path === "summary" || path === "linkedinSummary" || path.includes(".bullets.")
    ? sanitizeProfessionalParagraph(asClaimText(text))
    : sanitizeProfessionalLine(asClaimText(text));
}

export function sanitizeResumeForProfessionalUse(resume: ResumePackage): ResumePackage {
  const coreSkills = safeArray(resume.coreSkills);
  // THE ROLE CONTAINER AND ITS CONTENTS SURVIVE INDEPENDENTLY.
  //
  // This function used to return [] for a role whose bullets were all
  // withheld, and again for one whose title and company both sanitized to
  // empty. Either way an entire employment record — employer, job title and
  // years of dates — disappeared from the delivered DOCX and PDF while the
  // on-screen preview still showed it. Silent, invisible, and unrecoverable
  // by the user, who has no reason to re-read an export they just watched the
  // product build.
  //
  // A sanitizer may withhold a generated SENTENCE. It may never make a JOB
  // disappear. Employment history is a fact about the user's life; the
  // admissibility of one bullet says nothing about whether they held the job.
  // So bullets are filtered on their own merits, an empty bullet list is a
  // legitimate outcome, and the container is dropped only when the user gave
  // us nothing to identify it with at all.
  const experience = resume.experience.flatMap((role) => {
    // STRUCTURAL — not a claim, so not classified. These are facts about where
    // the user worked or studied, and the claim classifier reads real
    // organisation names ("No Boundaries Training Ltd", "Parenta") as evidence
    // gaps and blanks them. The type barrier in claim-text.ts now makes handing
    // them to it a compile error rather than something to remember.
    // Employment rows: title and employer are structural and are NOT judged.
    // Project rows keep their existing treatment — see the note on projects in
    // sanitizeCareerDossier; that cousin has its own repair and its own
    // controls, and widening Cluster C into it here would change behaviour
    // nobody has written a control pair for yet.
    // Employment rows get STRUCTURAL PARSING — organizationIdentity separates a
    // real name from narrative typed alongside it. That is not admissibility:
    // it never asks whether the value is a defensible claim, only which part of
    // it is the organisation. Project rows keep their existing treatment; see
    // the note in sanitizeCareerDossier.
    const isProject = role.kind === "project";
    const title = isProject ? sanitizeProfessionalLine(asClaimText(role.title)) : organizationIdentity(role.title);
    const company = isProject ? sanitizeProfessionalLine(asClaimText(role.company)) : organizationIdentity(role.company);
    const time = typeof role.time === "string" ? role.time.trim() : "";
    const bullets = safeParagraphArray(role.bullets);
    // Nothing identifies this row and nothing survives inside it: there is no
    // job here to preserve. Note this tests the ORIGINAL identity fields too,
    // so a role is never dropped merely because sanitizing its heading emptied
    // it — a withheld employer name loses the name, not the job.
    const hasIdentity = Boolean(title || company || time || role.title?.trim() || role.company?.trim());
    if (!hasIdentity && !bullets.length) return [];
    return [{ ...role, title, company, bullets }];
  });
  const summary = sanitizeProfessionalParagraph(asClaimText(resume.summary));
  const linkedinSummary = sanitizeProfessionalParagraph(asClaimText(resume.linkedinSummary));
  // Sentence-level, not line-level: a mixed headline like "Operations
  // Coordinator. Target roles: X; Y" must lose the preference sentence while
  // keeping the professional one — line-level classification let the whole
  // line through because its first sentence is a legitimate claim.
  const headline = sanitizeProfessionalParagraph(asClaimText(resume.linkedinHeadline));
  return {
    summary,
    coreSkills,
    experience,
    education: resume.education,
    linkedinHeadline: headline,
    linkedinSummary
  };
}

function reconcileReferences(
  variant: ResumeVariant,
  resume: ResumePackage,
  validEvidenceIds: Set<string>
): ResumeEvidenceReference[] {
  const candidates = variant.evidenceReferences.map((reference) => ({
    ...reference,
    evidenceIds: reference.evidenceIds.filter((id) => validEvidenceIds.has(id)),
    sanitizedText: sanitizeClaimForPath(reference.claimPath, reference.claimText)
  }));
  const used = new Set<number>();
  return claimsForResume(resume).flatMap((claim): ResumeEvidenceReference[] => {
    let index = candidates.findIndex((reference, candidateIndex) =>
      !used.has(candidateIndex) &&
      reference.claimPath === claim.path &&
      reference.sanitizedText === claim.text &&
      reference.evidenceIds.length > 0
    );
    if (index < 0) {
      index = candidates.findIndex((reference, candidateIndex) =>
        !used.has(candidateIndex) &&
        reference.sanitizedText === claim.text &&
        reference.evidenceIds.length > 0
      );
    }
    if (index < 0) return [];
    used.add(index);
    const reference = candidates[index];
    return [{
      claimPath: claim.path,
      claimText: claim.text,
      evidenceIds: reference.evidenceIds,
      supportType: reference.supportType
    }];
  });
}

function sanitizeVariant(
  variant: ResumeVariant,
  validEvidenceIds: Set<string>,
  forceReview: boolean
): ResumeVariant {
  const resume = sanitizeResumeForProfessionalUse(variant.resume);
  const references = reconcileReferences(variant, resume, validEvidenceIds);
  const claims = claimsForResume(resume);
  const complete = claims.length > 0 && references.length === claims.length;
  const status = variant.status === "archived"
    ? "archived"
    : forceReview || !complete
      ? "needs-review"
      : variant.status === "missing-evidence"
        ? "current"
        : variant.status;
  return { ...variant, resume, evidenceReferences: references, status };
}

function sanitizePack(pack: ResumePack, dossier: CareerDossier, forceReview: boolean): ResumePack {
  const validEvidenceIds = new Set(
    dossier.evidence
      .filter((item) => isUsableEvidence(item) && isProfessionalEvidence(item))
      .map((item) => item.id)
  );
  const variants = pack.variants.map((variant) => sanitizeVariant(variant, validEvidenceIds, forceReview));
  const first = variants.find((variant) => variant.kind === "recruiter")?.resume ?? variants[0]?.resume;
  const approvedFacts = dossier.evidence
    .filter((item) => isUsableEvidence(item) && isProfessionalEvidence(item))
    .map((item) => sanitizeProfessionalParagraph(asClaimText(item.detail)))
    .filter(Boolean);
  const lanePacks = pack.lanePacks.map((lanePack) => ({
    ...lanePack,
    positioningPitch: sanitizeProfessionalParagraph(asClaimText(lanePack.positioningPitch)),
    evidenceUsed: lanePack.evidenceUsed.filter((id) => validEvidenceIds.has(id)),
    evidenceOmitted: lanePack.evidenceOmitted.filter((id) => validEvidenceIds.has(id))
  }));
  const laneFraming = pack.receipt.laneFraming.flatMap((item) => {
    const angle = sanitizeProfessionalParagraph(asClaimText(item.angle));
    return angle ? [{ ...item, angle }] : [];
  });
  const needsReview = forceReview || variants.some((variant) => variant.status === "needs-review");
  return {
    ...pack,
    status: pack.status === "archived" ? "archived" : needsReview ? "needs-review" : pack.status,
    variants,
    lanePacks,
    linkedinHeadlines: unique(variants.map((variant) => variant.resume.linkedinHeadline)).filter(Boolean),
    linkedinAbout: first?.linkedinSummary || first?.summary || "",
    linkedinSkills: unique(variants.flatMap((variant) => variant.resume.coreSkills)).slice(0, 30),
    masterProofBank: safeParagraphArray(pack.masterProofBank),
    coverLetterFoundation: approvedFacts.length
      ? `Approved evidence to draw from: ${approvedFacts.slice(0, 3).join("; ")}`
      : "Add approved professional evidence before drafting a cover letter.",
    receipt: {
      ...pack.receipt,
      evidenceUsed: pack.receipt.evidenceUsed.filter((id) => validEvidenceIds.has(id)),
      evidenceOmitted: pack.receipt.evidenceOmitted.filter((id) => validEvidenceIds.has(id)),
      laneFraming,
      unsupportedClaimsRefused: unique([
        ...pack.receipt.unsupportedClaimsRefused,
        ...(forceReview ? ["Context-only items withheld after evidence-safety review"] : [])
      ]),
      transferredClaims: safeParagraphArray(pack.receipt.transferredClaims)
    }
  };
}

function resumeText(resume: ResumePackage): string {
  return [
    resume.summary,
    resume.coreSkills.join(", "),
    ...resume.experience.flatMap((role) => [
      [role.title, role.company, role.time].filter(Boolean).join(" | "),
      ...role.bullets.map((bullet) => `- ${bullet}`)
    ]),
    resume.education
  ].filter(Boolean).join("\n");
}

function sanitizeVersion(version: ResumeVersionRecord, forceReview: boolean): ResumeVersionRecord {
  if (!version.resumeSnapshot) {
    const lines = version.resumeText.split(/\r?\n/).flatMap((line): string[] => {
      if (!line.trim()) return [""];
      const bullet = line.match(/^([-•]\s*)/i)?.[1] ?? "";
      // A saved version is a RENDERED product artifact, not the user's live
      // bullets — their evidence is untouched in the store and can be
      // regenerated. So it gets the eligibility-aware text read with an empty
      // approval set: nobody is present to resolve a flag on a document
      // written months ago. Applied HERE and not inside
      // sanitizeProfessionalParagraph, which is shared with
      // sanitizeResumeForProfessionalUse — putting whole-sentence withholding
      // on that shared path deleted a bullet the user had kept, and with it the
      // employer whose only bullet it was.
      const body = line.replace(/^[-•]\s*/, "");
      // A rendered "Title | Employer | Dates" row is STRUCTURE, not a claim.
      // Classifying it deleted the whole employment row while leaving its
      // bullets in place, so they re-parented to the employer above — one
      // person's work silently filed under somebody else's job. Section
      // headings are structure too. Neither is judged; only prose is.
      const isHeading = !bullet && (body.includes("|") || /^[A-Z][A-Z \-/&]{2,}$/.test(body.trim()));
      if (isHeading) return [line];
      const eligible = eligibleUserText(body, new Set<string>());
      const cleaned = sanitizeProfessionalParagraph(asClaimText(eligible));
      return cleaned ? [`${bullet}${cleaned}`] : [];
    });
    return {
      ...version,
      resumeText: lines.join("\n"),
      notes: forceReview && !version.notes.includes("evidence-safety review")
        ? `${version.notes} Needs review after evidence-safety update.`.trim()
        : version.notes
    };
  }
  const resume = sanitizeResumeForProfessionalUse(version.resumeSnapshot.resume);
  return {
    ...version,
    resumeText: resumeText(resume),
    resumeSnapshot: { ...version.resumeSnapshot, resume },
    notes: forceReview && !version.notes.includes("evidence-safety review")
      ? `${version.notes} Needs review after evidence-safety update.`.trim()
      : version.notes
  };
}

function reconcilePendingReviews(
  previous: PendingImportReview[] | undefined,
  next: PendingImportReview[]
): PendingImportReview[] {
  const previousStatus = new Map(
    (previous ?? []).flatMap((batch) => batch.proposals.map((proposal) => [proposal.id, proposal.status] as const))
  );
  return next.map((batch) => ({
    ...batch,
    proposals: batch.proposals.map((proposal) => {
      const normalized = normalizeImportProposal(proposal);
      if (previousStatus.get(proposal.id) === "rejected" && normalized.status === "approved") {
        return { ...normalized, status: "rejected" };
      }
      return normalized;
    })
  }));
}

export function sanitizeCommandCenterState(
  next: CommandCenterState,
  previous?: CommandCenterState
): CommandCenterState {
  const pendingImportReviews = reconcilePendingReviews(previous?.pendingImportReviews, next.pendingImportReviews);
  // C3 — RECOVERY MIGRATION, on load, before anything else reads the roles.
  //
  // Earlier builds ran employer and title through an admissibility classifier
  // on every read and persisted the result, so existing users have employment
  // records with structural fields already destroyed on disk. Stopping the
  // damage does not undo it.
  //
  // Recovery draws ONLY on preserved historical records of the field itself —
  // saved résumé snapshots. It never reconstructs an employer or a title from
  // generated bullet text: knowing only that a bullet says "Managed inventory
  // for a regional gym chain" does not tell anyone the company was No
  // Boundaries Training Ltd, and inventing it here would be the fabrication
  // this audit exists to prevent, arriving through a repair. Where history is
  // unambiguous the value is restored; where it conflicts the user is offered
  // the choices; where nothing survives the role is preserved and the field is
  // marked for the user to restore.
  //
  // Idempotent by construction: a recovered field is no longer empty, so the
  // second run finds nothing to do, and review markers are replaced rather than
  // appended.
  const history = harvestHistoricalRoles(next);
  const recoveredDossier = {
    ...next.dossier,
    roles: next.dossier.roles.map((role) => recoverRoleStructure(role, history)),
    // Whole containers the old build deleted outright. DERIVED, never stored,
    // and never inserted into roles — restoring a job the user deliberately
    // removed is its own fabrication, and on disk that is indistinguishable
    // from one Career Forge destroyed. The user confirms; the migration offers.
    missingRoleCandidates: missingEmploymentCandidates(next, next.dossier)
  };
  const sanitized = sanitizeCareerDossier(recoveredDossier);
  const forceReview = sanitized.quarantinedEvidenceIds.length > 0;
  const dossier = sanitized.dossier;
  const profile = projectProfileFromDossier(dossier);
  profile.constraints = unique(
    dossier.constraints.filter((value) => {
      const category = classifyEvidenceAdmissibility(value);
      return category === "constraint" || category === "claim";
    })
  ).join("; ");
  return {
    ...next,
    profile,
    dossier,
    pendingImportReviews,
    resumePacks: next.resumePacks.map((pack) => sanitizePack(pack, dossier, forceReview)),
    resumeVersions: next.resumeVersions.map((version) => sanitizeVersion(version, forceReview))
  };
}
