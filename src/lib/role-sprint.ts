import { createId } from "@/lib/command-center-store";
import { evidenceRecord } from "@/lib/dossier";
import { requiredYearsFromRequirement, type RequirementMatch } from "@/lib/job-post-analyzer";
import { isUncertaintyStatement, stripTerminationReasons, toResumeVoice } from "@/lib/truth-guards";
import type {
  CommandCenterState,
  RoleSprintOutputs,
  RoleSprintRecord,
  RoleSprintType
} from "@/types/command-center";
import type { CareerDossier, DossierEvidenceRecord } from "@/types/dossier";

// Role Sprints turn one honest job-post gap into one bounded practice
// exercise. The honesty contract, enforced here and tested in
// scripts/role-sprint-regression.mjs:
// - only `gap`/`partial` requirements a short exercise can honestly address
//   are eligible — never credentials, licenses, clearances, degrees, or
//   years-of-experience;
// - completing a sprint NEVER changes the requirement's match status; the
//   result is new evidence pending the user's explicit approval;
// - the evidence detail text itself carries the practice label, so every
//   downstream surface that quotes it stays honest by construction;
// - generated drafts are assembled only from the user's submitted work, the
//   requirement, the company/role the user typed, and already-approved
//   dossier evidence.

export const ROLE_SPRINT_MIN_WORK_CHARS = 120;
const WORK_EXCERPT_MAX_CHARS = 180;
const SOURCE_EXCERPT_MAX_CHARS = 2000;

// Requirements a 20–60 minute exercise cannot honestly replace. Mirrors the
// analyzer's CREDENTIAL_SIGNAL and adds licensure variants.
const SPRINT_CREDENTIAL_SIGNAL =
  /\b(degree|bachelor|master|mba|phd|doctorate|diploma|certification|certified|certificate|licens\w*|clearance)\b/i;

export type SprintEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

export function sprintEligibility(requirement: RequirementMatch): SprintEligibility {
  if (requirement.status === "covered") {
    return { eligible: false, reason: "Approved evidence already covers this requirement — a practice sprint would add nothing." };
  }
  if (SPRINT_CREDENTIAL_SIGNAL.test(requirement.requirement)) {
    return {
      eligible: false,
      reason:
        "This asks for a formal credential, license, certification, degree, or clearance. A short practice exercise cannot honestly replace one — only the real credential can."
    };
  }
  if (requiredYearsFromRequirement(requirement.requirement) !== null) {
    return {
      eligible: false,
      reason:
        "This asks for years of experience. Tenure only accrues from real dated work — a practice sprint cannot honestly shorten it."
    };
  }
  return { eligible: true };
}

// One deterministic template per requirement, picked from the requirement's
// own wording. Checks run most-specific first; "explain" is the fallback
// because a concise written explanation is the safest bounded exercise.
export function pickSprintType(requirement: string): RoleSprintType {
  const text = requirement.toLowerCase();
  if (/\b(review|evaluat\w*|audit\w*|assess\w*|quality assurance|\bqa\b|moderat\w*|triage|test(?:ing)? (?:case|plan)s?|grade|rubric)\b/.test(text)) {
    return "evaluate";
  }
  if (/\b(plan\w*|organiz\w*|coordinat\w*|schedul\w*|roadmap|prioritiz\w*|time management|project management|process(?:es)?|workflow\w*|onboarding|multitask\w*)\b/.test(text)) {
    return "plan";
  }
  if (/\b(build\w*|creat\w*|develop\w*|design\w*|dashboard\w*|report(?:s|ing)?|sql|excel|spreadsheet\w*|google sheets|documentation|knowledge base|help center|macro\w*|template\w*|portfolio|automation\w*|data entry)\b/.test(text)) {
    return "build";
  }
  if (/\b(customer\w*|client\w*|support|de-?escalat\w*|conflict\w*|difficult|stakeholder\w*|communicat\w*|respond\w*|escalation\w*|empathy|zendesk|intercom|salesforce|hubspot|crm|ticket\w*)\b/.test(text)) {
    return "simulate";
  }
  return "explain";
}

// The honesty noun used in evidence labels and generated drafts.
export function sprintProvenanceNoun(sprintType: RoleSprintType): string {
  if (sprintType === "build") return "practice project";
  if (sprintType === "simulate") return "simulation exercise";
  return "practice exercise";
}

type SprintTemplate = {
  title: (topic: string) => string;
  instructions: (topic: string, roleTitle: string) => string[];
  completionCriteria: (topic: string) => string[];
};

// Trim a requirement line down to a short topic phrase usable inside
// sentences ("Strong written communication skills" → "strong written
// communication skills"). Verbatim words only — no synthesis.
function requirementTopic(requirement: string): string {
  const cleaned = requirement.trim().replace(/[.;:]+$/, "");
  const lower = cleaned.length > 1 ? cleaned[0].toLowerCase() + cleaned.slice(1) : cleaned;
  return lower.length > 90 ? `${lower.slice(0, 87).trimEnd()}…` : lower;
}

const SPRINT_TEMPLATES: Record<RoleSprintType, SprintTemplate> = {
  explain: {
    title: (topic) => `Write a concise explainer: ${topic}`,
    instructions: (topic, roleTitle) => [
      `Set a 20–60 minute timer. One sitting, one artifact.`,
      `Write a plain-language explanation of ${topic} as it applies to day-to-day ${roleTitle || "target-role"} work: what it is, why it matters, and how you would apply it in your first month.`,
      "Use only what you actually know or can reason through — where you are unsure, say so explicitly rather than papering over it.",
      "Close with three concrete situations where this knowledge changes what you would do."
    ],
    completionCriteria: (topic) => [
      `The explanation covers what ${topic} means in practice, not just a definition.`,
      "A hiring manager could read it in under two minutes.",
      "Every statement is something you can defend in an interview without notes."
    ]
  },
  evaluate: {
    title: (topic) => `Run a small evaluation exercise: ${topic}`,
    instructions: (topic, roleTitle) => [
      `Set a 20–60 minute timer. One sitting, one artifact.`,
      `Write down a realistic small scenario a ${roleTitle || "person in the target role"} would review (a ticket reply, a piece of work output, a short process) — 3–6 lines is enough.`,
      `Define a rubric of 4–6 checks that matter for ${topic}, then apply it line by line to the scenario you wrote.`,
      "Record what passes, what fails, and the single most important fix, with your reasoning for each verdict."
    ],
    completionCriteria: (topic) => [
      "The rubric's checks are specific enough that two people would score the scenario the same way.",
      `Each verdict includes the reasoning, so the exercise demonstrates ${topic} rather than asserting it.`,
      "The scenario, rubric, and verdicts are all in the submission."
    ]
  },
  plan: {
    title: (topic) => `Draft a working plan: ${topic}`,
    instructions: (topic, roleTitle) => [
      `Set a 20–60 minute timer. One sitting, one artifact.`,
      `Draft the practical plan or checklist you would actually run to handle ${topic} in a ${roleTitle || "target"} role: steps in order, who or what each step touches, and how you would know it worked.`,
      "Mark the two steps most likely to go wrong and write one sentence on how you would catch each early.",
      "Keep it real-world: constraints, sequencing, and checkpoints — not aspirations."
    ],
    completionCriteria: () => [
      "Someone could pick up the plan and start executing step one today.",
      "Each step has an observable done-condition.",
      "The two riskiest steps are flagged with an early-warning check."
    ]
  },
  simulate: {
    title: (topic) => `Work a realistic scenario: ${topic}`,
    instructions: (topic, roleTitle) => [
      `Set a 20–60 minute timer. One sitting, one artifact.`,
      `Write a realistic scenario that tests ${topic} — the kind a ${roleTitle || "person in the target role"} would face in week one. Two or three sentences of setup is enough.`,
      "Write your full response exactly as you would deliver it (the message you would send, the steps you would take, in order).",
      "Add a short debrief: what you prioritized, what you deliberately did not do, and what you would watch for next."
    ],
    completionCriteria: () => [
      "The response is the deliverable itself (sendable message or executable steps), not a description of one.",
      "The debrief explains the priorities behind the response.",
      "The scenario setup is included, so the response can be judged against it."
    ]
  },
  build: {
    title: (topic) => `Build a small portfolio artifact: ${topic}`,
    instructions: (topic, roleTitle) => [
      `Set a 20–60 minute timer. One sitting, one artifact.`,
      `Build one small, self-contained artifact that demonstrates ${topic} — for example a one-page reference doc, a worked spreadsheet layout, a query set with expected results, or a short process template a ${roleTitle || "target-role"} team could use.`,
      "Paste the artifact itself (or its full text/structure) into the work area — the artifact is the proof.",
      "Add two sentences on the choices you made and what you would improve with more time."
    ],
    completionCriteria: () => [
      "The artifact is complete enough to show someone as-is.",
      "The submission contains the artifact itself, not a summary of it.",
      "Design choices are explained in one or two sentences."
    ]
  }
};

export type SprintPlan = {
  sprintType: RoleSprintType;
  title: string;
  instructions: string[];
  completionCriteria: string[];
};

export function buildSprintPlan(requirement: string, roleTitle: string): SprintPlan {
  const sprintType = pickSprintType(requirement);
  const template = SPRINT_TEMPLATES[sprintType];
  const topic = requirementTopic(requirement);
  return {
    sprintType,
    title: template.title(topic),
    instructions: template.instructions(topic, roleTitle.trim()),
    completionCriteria: template.completionCriteria(topic)
  };
}

export function createRoleSprint(input: {
  requirement: RequirementMatch;
  company: string;
  roleTitle: string;
  applicationId: string | null;
  nowIso: string;
}): RoleSprintRecord {
  const plan = buildSprintPlan(input.requirement.requirement, input.roleTitle);
  return {
    id: createId("sprint"),
    applicationId: input.applicationId,
    company: input.company.trim(),
    roleTitle: input.roleTitle.trim(),
    requirement: input.requirement.requirement,
    originalStatus: input.requirement.status === "partial" ? "partial" : "gap",
    sprintType: plan.sprintType,
    title: plan.title,
    instructions: plan.instructions,
    completionCriteria: plan.completionCriteria,
    supportingEvidenceIds: [...input.requirement.evidenceIds],
    userWork: "",
    status: "draft",
    evidenceId: null,
    outputs: null,
    createdAt: input.nowIso,
    updatedAt: input.nowIso
  };
}

// "What you already have" — the supporting evidence the analysis linked to
// this requirement, re-checked against the live dossier so revoked approvals
// drop out instead of being quoted as still-valid support.
export function sprintSupportingEvidence(sprint: RoleSprintRecord, dossier: CareerDossier): DossierEvidenceRecord[] {
  return sprint.supportingEvidenceIds
    .map((id) => dossier.evidence.find((item) => item.id === id))
    .filter((item): item is DossierEvidenceRecord => Boolean(item && item.approved && !item.rejected));
}

// Honest statement of what stays unproven even after the sprint. Shown on the
// sprint page and echoed by the analyzer's practice-support wording.
export function sprintUnprovenStatement(sprint: RoleSprintRecord): string {
  return sprint.originalStatus === "partial"
    ? "Approved evidence is related, but the exact requirement stays unproven. This sprint adds labeled practice proof — it does not turn related experience into the real thing."
    : "You have zero approved evidence for this requirement. This sprint produces labeled practice proof you can honestly show — it does not create employment experience.";
}

function firstMeaningfulLine(text: string): string {
  const line = text
    .split(/\r?\n+/)
    .map((part) => part.replace(/^[\s•*#>-]+/, "").trim())
    .find((part) => part.length >= 8);
  return line ?? text.trim();
}

// A short, safe excerpt of the user's own submission: first meaningful line,
// termination reasons stripped, cut at a sentence/word boundary.
export function sprintWorkExcerpt(userWork: string, maxChars = WORK_EXCERPT_MAX_CHARS): string {
  const line = stripTerminationReasons(firstMeaningfulLine(userWork)).text.trim();
  if (line.length <= maxChars) return line;
  const sentenceEnd = line.slice(0, maxChars).match(/^[\s\S]*[.!?](?=\s|$)/)?.[0];
  if (sentenceEnd && sentenceEnd.length >= 40) return sentenceEnd.trim();
  const cut = line.slice(0, maxChars);
  return `${cut.slice(0, Math.max(40, cut.lastIndexOf(" "))).trimEnd()}…`;
}

export type SprintWorkValidation = { ok: true } | { ok: false; error: string };

export function validateSprintWork(userWork: string): SprintWorkValidation {
  const trimmed = userWork.trim();
  if (trimmed.length < ROLE_SPRINT_MIN_WORK_CHARS) {
    return {
      ok: false,
      error: `The submission is too short to count as completed work (${trimmed.length} of at least ${ROLE_SPRINT_MIN_WORK_CHARS} characters). Paste the actual work, not a placeholder.`
    };
  }
  if (isUncertaintyStatement(trimmed) || isUncertaintyStatement(firstMeaningfulLine(trimmed))) {
    return {
      ok: false,
      error: "This reads as a statement of uncertainty, not completed work. Finish the exercise first — honest proof needs the work itself."
    };
  }
  return { ok: true };
}

// The pending evidence record a completed sprint produces. The practice label
// lives INSIDE the detail text so any surface that quotes the claim carries
// the provenance with it; `source: "role-sprint"` is the machine-readable
// marker the analyzer and truth surfaces key on. Never approved here — the
// user approves it through the existing dossier review workflow.
export function sprintEvidenceFromWork(sprint: RoleSprintRecord, userWork: string, nowIso: string): DossierEvidenceRecord {
  const noun = sprintProvenanceNoun(sprint.sprintType);
  const excerpt = sprintWorkExcerpt(userWork);
  const target = [sprint.roleTitle, sprint.company].filter(Boolean).join(" at ");
  const detail =
    `Completed a self-directed ${noun} (Role Sprint, labeled practice work — separate from employment history)` +
    `${target ? ` while preparing an application for ${target}` : ""}, addressing the job requirement "${sprint.requirement}". ` +
    `Work produced: ${excerpt}`;
  return evidenceRecord(
    sprint.sprintType === "build" ? "project" : "proof",
    detail,
    "role-sprint",
    false,
    nowIso,
    {
      label: `Role Sprint ${noun}`,
      sourceText: stripTerminationReasons(userWork.trim()).text.slice(0, SOURCE_EXCERPT_MAX_CHARS),
      confidence: "high"
    }
  );
}

function shortRequirement(requirement: string): string {
  const cleaned = requirement.trim().replace(/[.;:]+$/, "");
  return cleaned.length > 70 ? `${cleaned.slice(0, 67).trimEnd()}…` : cleaned;
}

const OUTPUT_VERBS: Record<RoleSprintType, string> = {
  explain: "Wrote",
  evaluate: "Ran",
  plan: "Drafted",
  simulate: "Drafted",
  build: "Built"
};

const OUTPUT_ARTIFACTS: Record<RoleSprintType, string> = {
  explain: "a concise written explainer on",
  evaluate: "a rubric-based evaluation exercise on",
  plan: "a working plan for",
  simulate: "a realistic scenario response for",
  build: "a small portfolio artifact demonstrating"
};

// Every sentence below is assembled from: the user's submitted work, the
// requirement, the company/role the user typed, the sprint's own definition,
// and approved supporting evidence. Nothing else — no invented tools,
// metrics, employers, or outcomes.
export function generateSprintOutputs(
  sprint: RoleSprintRecord,
  userWork: string,
  dossier: CareerDossier
): RoleSprintOutputs {
  const noun = sprintProvenanceNoun(sprint.sprintType);
  const excerpt = sprintWorkExcerpt(userWork);
  const requirement = shortRequirement(sprint.requirement);
  const target = [sprint.roleTitle, sprint.company].filter(Boolean).join(" at ");
  const supporting = sprintSupportingEvidence(sprint, dossier);
  const supportingDetail = supporting[0] ? stripTerminationReasons(supporting[0].detail).text : "";

  const portfolioTitle = `${sprint.title} — ${noun}`;
  const portfolioSummary =
    `A ${noun} completed as a bounded Role Sprint${target ? ` while preparing an application for ${target}` : ""}. ` +
    `It addresses the posting requirement "${requirement}". What was produced: ${excerpt} ` +
    `Labeled as self-directed practice, separate from employment history.` +
    (supportingDetail ? ` It builds on approved evidence: "${supportingDetail}".` : "");

  const resumeBullet =
    `${OUTPUT_VERBS[sprint.sprintType]} ${OUTPUT_ARTIFACTS[sprint.sprintType]} "${requirement}" as a self-directed ${noun}` +
    `${target ? ` while preparing a ${sprint.roleTitle || "role"} application` : ""} — ${toResumeVoice(excerpt).replace(/[.;:]+$/, "")} (labeled practice work).`;

  const starStory = [
    `Situation: While preparing an application${target ? ` for ${target}` : ""}, my gap analysis flagged "${requirement}" as unproven in my approved evidence.`,
    `Task: Close that gap honestly with one bounded ${noun} (20–60 minutes) rather than overstating my experience.`,
    `Action: ${excerpt}`,
    `Result: A finished, labeled ${noun} I can show and walk through${supportingDetail ? `, building on my approved evidence ("${supportingDetail}")` : ""}. It stays labeled as practice until real work replaces it.`
  ].join("\n");

  const talkingPoint =
    `To prepare for this role, I completed a self-directed ${noun} addressing "${requirement}": ${excerpt} ` +
    `I keep it labeled as practice work, and I'm happy to walk through it in detail.`;

  return { portfolioTitle, portfolioSummary, resumeBullet, starStory, talkingPoint, userEdited: false };
}

export type CompleteRoleSprintResult =
  | { ok: true; state: CommandCenterState; sprint: RoleSprintRecord; evidence: DossierEvidenceRecord }
  | { ok: false; error: string };

// Submission: validate the work, convert it into ONE pending evidence record,
// and store the editable drafts. Pure state → state. Deliberately does NOT
// touch dossier.updatedAt (nothing approved changed, so résumé packs must not
// be marked stale) and NOT approvedClaims (the evidence is pending).
export function completeRoleSprint(
  state: CommandCenterState,
  sprintId: string,
  userWork: string,
  nowIso: string
): CompleteRoleSprintResult {
  const sprint = state.roleSprints.find((item) => item.id === sprintId);
  if (!sprint) return { ok: false, error: "This sprint no longer exists. Start a new one from a job-post analysis." };
  const validation = validateSprintWork(userWork);
  if (!validation.ok) return { ok: false, error: validation.error };

  const evidence = sprintEvidenceFromWork(sprint, userWork, nowIso);
  const outputs = generateSprintOutputs(sprint, userWork, state.dossier);
  const updatedSprint: RoleSprintRecord = {
    ...sprint,
    userWork,
    status: "completed",
    evidenceId: evidence.id,
    outputs,
    updatedAt: nowIso
  };

  // Resubmission replaces the sprint's own earlier record only while it is
  // still pending. Approved and rejected records are user decisions and stay.
  const priorId = sprint.evidenceId;
  const withoutSupersededPending = state.dossier.evidence.filter(
    (item) => !(priorId && item.id === priorId && item.id !== evidence.id && !item.approved && !item.rejected)
  );
  const evidenceList = withoutSupersededPending.some((item) => item.id === evidence.id)
    ? withoutSupersededPending.map((item) => (item.id === evidence.id ? { ...evidence, approved: item.approved, rejected: item.rejected } : item))
    : [...withoutSupersededPending, evidence];

  return {
    ok: true,
    state: {
      ...state,
      dossier: { ...state.dossier, evidence: evidenceList },
      roleSprints: state.roleSprints.map((item) => (item.id === sprintId ? updatedSprint : item))
    },
    sprint: updatedSprint,
    evidence
  };
}

// Keeps sprint status in step with the linked evidence record's real state:
// approved → "approved-as-evidence"; anything else (pending, rejected,
// deleted) falls back to "completed". Draft sprints never move.
export function syncRoleSprintsWithEvidence(
  sprints: RoleSprintRecord[],
  evidence: DossierEvidenceRecord[],
  nowIso: string
): RoleSprintRecord[] {
  return sprints.map((sprint) => {
    if (!sprint.evidenceId || sprint.status === "draft") return sprint;
    const record = evidence.find((item) => item.id === sprint.evidenceId);
    const nextStatus: RoleSprintRecord["status"] =
      record && record.approved && !record.rejected ? "approved-as-evidence" : "completed";
    return sprint.status === nextStatus ? sprint : { ...sprint, status: nextStatus, updatedAt: nowIso };
  });
}
