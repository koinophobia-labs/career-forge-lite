// Role Sprint regression — the honesty contract for practice proof.
//
// Guards, in order: eligibility (credentials/licenses/clearances/degrees/
// years-of-experience are never sprintable), deterministic template pick,
// grounded plan copy, submission → pending evidence conversion (never
// approved, always practice-labeled, provenance preserved), analyzer cap
// (practice can never produce "covered" and never enters the experience
// corpus), persistence/migration (revive round-trip, legacy blobs, backup),
// and status sync with the dossier review workflow.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const moduleCache = new Map();

function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: absolute
  });
  const cjsModule = { exports: {} };
  moduleCache.set(absolute, cjsModule);
  const localRequire = (request) => request.startsWith("@/")
    ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`))
    : request.startsWith(".")
      ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`))
      : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(
    localRequire, cjsModule, cjsModule.exports, path.dirname(absolute), absolute
  );
  return cjsModule.exports;
}

const {
  ROLE_SPRINT_MIN_WORK_CHARS,
  buildSprintPlan,
  completeRoleSprint,
  createRoleSprint,
  generateSprintOutputs,
  pickSprintType,
  sprintEligibility,
  sprintEvidenceFromWork,
  sprintSupportingEvidence,
  sprintUnprovenStatement,
  sprintWorkExcerpt,
  syncRoleSprintsWithEvidence,
  validateSprintWork
} = loadTsModule(path.join(root, "src/lib/role-sprint.ts"));
const { emptyState, parseState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { evidenceRecord } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { analyzeJobPost, matchRequirement } = loadTsModule(path.join(root, "src/lib/job-post-analyzer.ts"));
const { classifyEvidenceAdmissibility, isProfessionalEvidence, sanitizeCareerDossier, sanitizeCommandCenterState } =
  loadTsModule(path.join(root, "src/lib/evidence-admissibility.ts"));
const { createBackup, validateBackup } = loadTsModule(path.join(root, "src/lib/backup.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const NOW = "2026-07-23T21:00:00.000Z";
const LATER = "2026-07-23T21:45:00.000Z";

function requirementMatch(requirement, status, evidenceIds = []) {
  return { requirement, status, evidence: "test", evidenceIds, supportType: null };
}

function baseState() {
  const state = emptyState();
  const zendesk = evidenceRecord("tool", "Tools: Zendesk, Salesforce", "manual", true, NOW, { label: "Tool" });
  const service = evidenceRecord(
    "role",
    "Customer service lead handling escalations and refunds at a retail chain",
    "manual",
    true,
    NOW,
    { label: "Employment record" }
  );
  return {
    ...state,
    dossier: { ...state.dossier, evidence: [zendesk, service] },
    ids: { zendesk: zendesk.id, service: service.id }
  };
}

// ---------------------------------------------------------------- eligibility
{
  const ineligible = [
    "Bachelor's degree in Communications or related field",
    "Master's degree preferred",
    "PMP certification required",
    "Certified ScrumMaster",
    "Valid driver's license required",
    "Professional licensure in nursing",
    "Active security clearance",
    "3+ years of customer support experience",
    "At least 2 years working with SQL"
  ];
  for (const requirement of ineligible) {
    const verdict = sprintEligibility(requirementMatch(requirement, "gap"));
    check(`eligibility: excludes "${requirement.slice(0, 44)}"`, verdict.eligible === false && verdict.reason.length > 10);
  }
  const eligibleGap = sprintEligibility(requirementMatch("Strong written communication with customers", "gap"));
  const eligiblePartial = sprintEligibility(requirementMatch("Comfortable working with support ticketing workflows", "partial"));
  const covered = sprintEligibility(requirementMatch("Strong written communication", "covered"));
  check("eligibility: plain gap requirement is eligible", eligibleGap.eligible === true);
  check("eligibility: partial requirement is eligible", eligiblePartial.eligible === true);
  check("eligibility: covered requirement offers no sprint", covered.eligible === false);
}

// ------------------------------------------------------------- template pick
{
  const cases = [
    ["Review support ticket quality against internal rubrics", "evaluate"],
    ["Ability to prioritize and manage multiple workflows", "plan"],
    ["Build weekly reports in Excel for the leadership team", "build"],
    ["De-escalate difficult customer conversations", "simulate"],
    ["Knowledge of consumer privacy fundamentals", "explain"]
  ];
  for (const [requirement, expected] of cases) {
    check(`template: "${requirement.slice(0, 40)}" → ${expected}`, pickSprintType(requirement) === expected);
  }
  check("template: deterministic", pickSprintType(cases[0][0]) === pickSprintType(cases[0][0]));
  const plan = buildSprintPlan("De-escalate difficult customer conversations", "Support Specialist");
  check("plan: single bounded sprint (3-5 steps, not a curriculum)", plan.instructions.length >= 3 && plan.instructions.length <= 5);
  check("plan: timebox stated", plan.instructions.some((step) => step.includes("20–60 minute")));
  check("plan: completion criteria present", plan.completionCriteria.length >= 3);
  check("plan: title quotes requirement topic", plan.title.toLowerCase().includes("de-escalate difficult customer conversations"));
}

// ------------------------------------------- sprint creation + grounded plan
const state0 = baseState();
const sprintReq = requirementMatch("Comfortable using Zendesk to resolve customer tickets", "partial", [state0.ids.zendesk]);
const sprint = createRoleSprint({
  requirement: sprintReq,
  company: "Acme",
  roleTitle: "Product Support Specialist",
  applicationId: "app-test-1",
  nowIso: NOW
});
{
  check("create: draft status + provenance fields", sprint.status === "draft" && sprint.requirement === sprintReq.requirement && sprint.applicationId === "app-test-1" && sprint.originalStatus === "partial");
  check("create: supporting evidence ids copied", sprint.supportingEvidenceIds.length === 1 && sprint.supportingEvidenceIds[0] === state0.ids.zendesk);
  const supporting = sprintSupportingEvidence(sprint, state0.dossier);
  check("supporting: resolves approved records verbatim", supporting.length === 1 && supporting[0].detail === "Tools: Zendesk, Salesforce");
  const revoked = {
    ...state0.dossier,
    evidence: state0.dossier.evidence.map((item) => item.id === state0.ids.zendesk ? { ...item, approved: false, rejected: true } : item)
  };
  check("supporting: revoked approvals drop out", sprintSupportingEvidence(sprint, revoked).length === 0);
  check("unproven statement: honest and non-empty", sprintUnprovenStatement(sprint).includes("practice"));
}

// ------------------------------------------------- submission validation
{
  const boundaryWork = "Practice reply covering refunds, timelines, and ownership. ".repeat(6);
  check("validate: exact minimum length boundary", validateSprintWork(boundaryWork.slice(0, ROLE_SPRINT_MIN_WORK_CHARS - 1)).ok === false && validateSprintWork(boundaryWork.slice(0, ROLE_SPRINT_MIN_WORK_CHARS)).ok === true);
  check("validate: short work refused", validateSprintWork("too short").ok === false);
  check("validate: uncertainty refused", validateSprintWork(`I don't know how to do this yet${" filler".repeat(30)}`).ok === false);
  check("validate: real work accepted", validateSprintWork("Scenario: A customer writes in furious about a double charge. My reply: I apologize, confirm the duplicate, issue the refund immediately, and explain the timeline. Debrief: I prioritized speed and ownership.").ok === true);
}

// ----------------------------------------- completion → pending evidence
const userWork =
  "Scenario: A customer was double-charged for an annual plan and is threatening a chargeback. " +
  "My response: I apologize once, confirm the duplicate charge in the billing tool, issue the refund on the spot, " +
  "give a concrete refund timeline of 3-5 business days, and offer to stay on the ticket until it lands. " +
  "Debrief: I prioritized ownership and a concrete timeline; I deliberately did not offer a discount because the fix itself rebuilds trust.";
const stateWithSprint = { ...state0, roleSprints: [sprint] };
const completion = completeRoleSprint(stateWithSprint, sprint.id, userWork, LATER);
{
  check("complete: succeeds on valid work", completion.ok === true);
  if (!completion.ok) throw new Error("completion failed; cannot continue");
  const { state: completedState, sprint: completedSprint, evidence } = completion;

  check("complete: sprint completed + userWork stored", completedSprint.status === "completed" && completedSprint.userWork === userWork);
  check("complete: evidence linked to sprint", completedSprint.evidenceId === evidence.id);
  check("evidence: pending, never auto-approved", evidence.approved === false && evidence.rejected === false);
  check("evidence: role-sprint provenance source", evidence.source === "role-sprint");
  check("evidence: practice label inside detail", /practice|simulation/i.test(evidence.detail) && evidence.detail.includes("separate from employment history"));
  check("evidence: names the requirement", evidence.detail.includes(sprintReq.requirement));
  check("evidence: kind matches sprint type", evidence.kind === "proof");
  check("evidence: submission is the source excerpt", evidence.sourceExcerpts[0].startsWith("Scenario: A customer was double-charged"));
  check("evidence: appended to dossier as pending", completedState.dossier.evidence.some((item) => item.id === evidence.id && !item.approved));
  check("evidence: detail classifies as claim (survives admissibility)", classifyEvidenceAdmissibility(evidence.detail) === "claim");
  check("evidence: professional once approved", isProfessionalEvidence({ ...evidence, approved: true }) === true);
  check("complete: approvedClaims untouched", completedState.dossier.approvedClaims.length === state0.dossier.approvedClaims.length);
  check("complete: dossier.updatedAt untouched (packs stay current)", completedState.dossier.updatedAt === state0.dossier.updatedAt);

  // Honesty: sanitizer keeps the pending record, and keeps it after approval.
  const sanitizedPending = sanitizeCareerDossier(completedState.dossier);
  check("sanitize: pending practice evidence survives", sanitizedPending.dossier.evidence.some((item) => item.id === evidence.id));
  const approvedDossier = {
    ...completedState.dossier,
    evidence: completedState.dossier.evidence.map((item) => item.id === evidence.id ? { ...item, approved: true } : item)
  };
  const sanitizedApproved = sanitizeCareerDossier(approvedDossier);
  check("sanitize: approved practice evidence survives with label", sanitizedApproved.dossier.evidence.some((item) => item.id === evidence.id && item.detail.includes("practice")));

  // Outputs: grounded, labeled, editable drafts.
  const outputs = completedSprint.outputs;
  check("outputs: all four drafts + title generated", Boolean(outputs) && [outputs.portfolioTitle, outputs.portfolioSummary, outputs.resumeBullet, outputs.starStory, outputs.talkingPoint].every((text) => text.trim().length > 20));
  check("outputs: every draft carries the practice label", [outputs.portfolioSummary, outputs.resumeBullet, outputs.starStory, outputs.talkingPoint].every((text) => /practice|simulation/i.test(text)));
  check("outputs: STAR story has all four beats", ["Situation:", "Task:", "Action:", "Result:"].every((beat) => outputs.starStory.includes(beat)));
  check("outputs: grounded in the submission", outputs.starStory.includes("double-charged") && outputs.talkingPoint.includes("double-charged"));
  check("outputs: never imply employment/production/certification", [outputs.portfolioSummary, outputs.resumeBullet, outputs.starStory, outputs.talkingPoint].every((text) => !/(certified|production experience|professional experience|employment experience|years of experience|at work|on the job)/i.test(text)));
  const allOutputs = [outputs.portfolioTitle, outputs.portfolioSummary, outputs.resumeBullet, outputs.starStory, outputs.talkingPoint].join("\n");
  const allowedSources = `${userWork} ${sprintReq.requirement} ${sprint.title} Acme Product Support Specialist 20–60 Tools: Zendesk, Salesforce`;
  const numbers = allOutputs.match(/\d+(?:[-–]\d+)?/g) ?? [];
  check("outputs: every number traces to the submission/requirement/timebox", numbers.every((value) => allowedSources.includes(value)), `unexpected: ${numbers.filter((value) => !allowedSources.includes(value)).join(", ")}`);
  check("outputs: userEdited starts false", outputs.userEdited === false);
  check("outputs: deterministic for identical input", JSON.stringify(generateSprintOutputs(completedSprint, userWork, completedState.dossier)) === JSON.stringify(generateSprintOutputs(completedSprint, userWork, completedState.dossier)));

  // Requirement status: completing the sprint must not change the match.
  const before = matchRequirement(sprintReq.requirement, completedState.profile, state0.dossier, NOW);
  const afterPending = matchRequirement(sprintReq.requirement, completedState.profile, completedState.dossier, NOW);
  check("honesty: pending evidence never changes the requirement match", before.status === afterPending.status && before.evidence === afterPending.evidence);

  // Analyzer cap: approved practice evidence yields at most "partial".
  const gapOnlyDossier = {
    ...completedState.dossier,
    evidence: completedState.dossier.evidence.map((item) => item.id === evidence.id ? { ...item, approved: true } : { ...item, approved: false })
  };
  const practiceOnly = matchRequirement(sprintReq.requirement, completedState.profile, gapOnlyDossier, NOW);
  check("honesty: approved practice alone is partial, never covered", practiceOnly.status === "partial");
  check("honesty: practice support says practice, cites the record", practiceOnly.evidence.includes("practice") && practiceOnly.evidenceIds.includes(evidence.id));
  const yearsWithPractice = matchRequirement("3+ years of Zendesk customer tickets experience", completedState.profile, gapOnlyDossier, NOW);
  check("honesty: practice never verifies tenure", yearsWithPractice.status !== "covered" && (yearsWithPractice.evidenceIds.length === 0 || yearsWithPractice.evidence.toLowerCase().includes("practice")));
  const fullyApproved = {
    ...completedState.dossier,
    evidence: completedState.dossier.evidence.map((item) => item.id === evidence.id ? { ...item, approved: true } : item)
  };
  const withRealEvidence = matchRequirement(sprintReq.requirement, completedState.profile, fullyApproved, NOW);
  check("honesty: with real evidence approved, covered cites the real record, not practice", withRealEvidence.status === "covered" && !/practice|Role Sprint/i.test(withRealEvidence.evidence));
  const keywordAnalysis = analyzeJobPost("Requirements:\n- Comfortable using Zendesk to resolve customer tickets", completedState.profile, null, gapOnlyDossier, NOW);
  const zendeskHit = keywordAnalysis.keywords.find((hit) => hit.term === "zendesk");
  check("honesty: practice evidence stays out of the keyword corpus", !zendeskHit || zendeskHit.inProfile === false);

  // Resubmission with the same opening line keeps the same stable id: the
  // record updates in place with the new source text — never duplicated.
  const sameLeadResubmit = completeRoleSprint(completedState, sprint.id, `${userWork} Additionally, I wrote a short macro template for future duplicate-charge tickets.`, LATER);
  check("resubmit (same lead): record updates in place, no duplicate", sameLeadResubmit.ok === true && sameLeadResubmit.evidence.id === evidence.id && sameLeadResubmit.state.dossier.evidence.filter((item) => item.source === "role-sprint").length === 1 && sameLeadResubmit.state.dossier.evidence.find((item) => item.id === evidence.id)?.sourceExcerpts[0].includes("macro template"));

  // Reworked submission (new lead line) mints a new id: the superseded
  // pending record is removed, no orphan left behind.
  const resubmitWork = `Reworked scenario: a customer disputes a duplicate annual charge and wants proof in writing. ${userWork}`;
  const resubmission = completeRoleSprint(completedState, sprint.id, resubmitWork, LATER);
  check("resubmit: succeeds", resubmission.ok === true);
  if (resubmission.ok) {
    const oldGone = !resubmission.state.dossier.evidence.some((item) => item.id === evidence.id);
    const newPresent = resubmission.state.dossier.evidence.some((item) => item.id === resubmission.evidence.id && !item.approved);
    check("resubmit: pending record replaced, not duplicated", oldGone && newPresent && resubmission.evidence.id !== evidence.id);
  }

  // Rejected records persist as decisions; resubmission adds a new pending one.
  const rejectedState = {
    ...completedState,
    dossier: {
      ...completedState.dossier,
      evidence: completedState.dossier.evidence.map((item) => item.id === evidence.id ? { ...item, rejected: true } : item)
    }
  };
  const afterRejectResubmit = completeRoleSprint(rejectedState, sprint.id, resubmitWork, LATER);
  check("resubmit after rejection: rejected record is kept as a decision", afterRejectResubmit.ok === true && afterRejectResubmit.state.dossier.evidence.some((item) => item.id === evidence.id && item.rejected));

  // Status sync mirrors the dossier review workflow.
  const approvedEvidenceList = completedState.dossier.evidence.map((item) => item.id === evidence.id ? { ...item, approved: true, rejected: false } : item);
  const synced = syncRoleSprintsWithEvidence(completedState.roleSprints, approvedEvidenceList, LATER);
  check("sync: approval flips sprint to approved-as-evidence", synced[0].status === "approved-as-evidence");
  const rejectedEvidenceList = completedState.dossier.evidence.map((item) => item.id === evidence.id ? { ...item, approved: false, rejected: true } : item);
  const syncedBack = syncRoleSprintsWithEvidence(synced, rejectedEvidenceList, LATER);
  check("sync: rejection falls back to completed", syncedBack[0].status === "completed");
  const syncedMissing = syncRoleSprintsWithEvidence(synced, [], LATER);
  check("sync: deleted evidence falls back to completed", syncedMissing[0].status === "completed");
  const draftSprint = { ...sprint, id: "sprint-draft", status: "draft", evidenceId: null };
  check("sync: drafts never move", syncRoleSprintsWithEvidence([draftSprint], approvedEvidenceList, LATER)[0].status === "draft");

  // ---------------------------------------------- persistence + migration
  const persisted = { ...completedState, roleSprints: [completedSprint] };
  const revived = parseState(JSON.stringify(persisted));
  check("persist: sprint survives a storage round-trip", revived.roleSprints.length === 1);
  const revivedSprint = revived.roleSprints[0];
  const fieldsIntact = ["id", "applicationId", "company", "roleTitle", "requirement", "originalStatus", "sprintType", "title", "userWork", "status", "evidenceId", "createdAt", "updatedAt"]
    .every((key) => JSON.stringify(revivedSprint[key]) === JSON.stringify(completedSprint[key]));
  check("persist: every scalar field revives verbatim (whitelist complete)", fieldsIntact, JSON.stringify(revivedSprint));
  check("persist: arrays + outputs revive verbatim", JSON.stringify(revivedSprint.instructions) === JSON.stringify(completedSprint.instructions) && JSON.stringify(revivedSprint.completionCriteria) === JSON.stringify(completedSprint.completionCriteria) && JSON.stringify(revivedSprint.supportingEvidenceIds) === JSON.stringify(completedSprint.supportingEvidenceIds) && JSON.stringify(revivedSprint.outputs) === JSON.stringify(completedSprint.outputs));
  check("persist: evidence source revives as role-sprint", revived.dossier.evidence.find((item) => item.id === completedSprint.evidenceId)?.source === "role-sprint");

  const legacyBlob = JSON.stringify({ ...state0, roleSprints: undefined });
  const migrated = parseState(legacyBlob);
  check("migrate: pre-sprint blobs revive with an empty slice", Array.isArray(migrated.roleSprints) && migrated.roleSprints.length === 0);
  const malformed = parseState(JSON.stringify({ ...persisted, roleSprints: [{ id: "x" }, { requirement: "no id" }, 42, null, { ...completedSprint, status: "bogus", sprintType: "bogus" }] }));
  check("migrate: malformed sprints drop, bogus enums fall back safely", malformed.roleSprints.length === 1 && malformed.roleSprints[0].status === "draft" && malformed.roleSprints[0].sprintType === "explain");
  check("migrate: corrupt top-level state still parses", parseState("{not json").roleSprints.length === 0);

  const sanitizedState = sanitizeCommandCenterState(persisted);
  check("sanitize: state pipeline preserves roleSprints", sanitizedState.roleSprints.length === 1 && sanitizedState.roleSprints[0].id === completedSprint.id);

  const backup = createBackup(persisted, LATER);
  check("backup: sprints included in the envelope", backup.state.roleSprints.length === 1);
  const restored = validateBackup(JSON.stringify(backup));
  check("backup: restore preserves sprints + preview counts them", restored.ok === true && restored.state.roleSprints.length === 1 && restored.preview.roleSprintCount === 1);
  const legacyRestore = validateBackup(legacyBlob);
  check("backup: legacy (pre-sprint) backups still restore", legacyRestore.ok === true && legacyRestore.state.roleSprints.length === 0);
}

// ------------------------------------------------ excerpt + build-kind edge
{
  const buildReq = requirementMatch("Build weekly reports in Excel for the leadership team", "gap");
  const buildSprint = createRoleSprint({ requirement: buildReq, company: "", roleTitle: "", applicationId: null, nowIso: NOW });
  const work = `Report layout: columns for week, ticket volume, CSAT, refunds.${" Detail row explains each metric source and owner.".repeat(4)}`;
  const buildEvidence = sprintEvidenceFromWork(buildSprint, work, NOW);
  check("build sprints produce project-kind evidence", buildEvidence.kind === "project" && buildEvidence.label.includes("practice project"));
  check("evidence without a target omits the application clause", !buildEvidence.detail.includes("preparing an application for"));
  const excerpt = sprintWorkExcerpt(`I was managing refunds until I was laid off in June 2026. The playbook covers refunds end to end.`);
  check("excerpt strips termination reasons from quoted work", !/laid off/i.test(excerpt));
  const longExcerpt = sprintWorkExcerpt("word ".repeat(100));
  check("excerpt respects the length cap", longExcerpt.length <= 181);
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
