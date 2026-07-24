import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: absolute
  });
  const cjsModule = { exports: {} };
  cache.set(absolute, cjsModule);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const workflow = loadTsModule(path.join(root, "src/lib/application-workflow.ts"));
const interviews = loadTsModule(path.join(root, "src/lib/application-interview.ts"));
const lifecycle = loadTsModule(path.join(root, "src/lib/role-sprint-lifecycle.ts"));
const backupTools = loadTsModule(path.join(root, "src/lib/backup.ts"));
const router = loadTsModule(path.join(root, "src/lib/intent-router.ts"));
const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { evidenceRecord } = loadTsModule(path.join(root, "src/lib/dossier.ts"));

let passes = 0;
let failures = 0;
function check(label, condition) {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

const NOW = "2026-07-24T12:00:00.000Z";
const applied = {
  id: "app-1", company: "Acme", roleTitle: "Support", laneId: null, status: "applied", jobPostUrl: "", source: "other",
  discoveryUrl: "", applicationUrl: "", postingDate: null, deadline: null, contactName: "", contactUrl: "", resumeVariantId: null,
  applicationQuestions: [], resumeVersionId: null, appliedAt: "2026-07-20T10:00:00.000Z", nextFollowUpAt: "2026-07-27T10:00:00.000Z",
  followUpsSent: [], interviewAt: null, notes: "", analysisKeywords: [], analysisGaps: [], analysisWeakSpots: [],
  createdAt: "2026-07-19T10:00:00.000Z", updatedAt: "2026-07-20T10:00:00.000Z", stageHistory: [{ status: "applied", at: "2026-07-20T10:00:00.000Z" }], interviewHistory: []
};
const draftPatch = workflow.applicationStatusPatch(applied, "drafting", NOW);
check("status history: moving to drafting preserves first applied date", draftPatch.appliedAt === applied.appliedAt);
check("status history: moving to drafting clears active follow-up", draftPatch.nextFollowUpAt === null);
check("status history: transition is recorded", draftPatch.stageHistory?.at(-1)?.status === "drafting");

const interviewing = { ...applied, status: "interviewing", interviewAt: "2026-07-23", stageHistory: [{ status: "interviewing", at: "2026-07-21T10:00:00.000Z" }] };
const offerPatch = workflow.applicationStatusPatch(interviewing, "offer", NOW);
check("interview history: prior interview date is preserved", offerPatch.interviewHistory?.includes("2026-07-23"));
check("interview timing: past date is recognized", interviews.interviewTiming(interviewing, NOW) === "past");
check("interview timing: future date is recognized", interviews.interviewTiming({ ...interviewing, interviewAt: "2026-07-30" }, NOW) === "upcoming");

const beforeUndo = { ...applied, notes: "original note" };
const statusSnapshot = workflow.captureApplicationStatus(beforeUndo);
const afterStatus = { ...workflow.transitionApplicationStatus(beforeUndo, "drafting", NOW), notes: "new note after status change" };
const restoredStatus = workflow.restoreApplicationStatus(afterStatus, statusSnapshot, "2026-07-24T12:05:00.000Z");
check("field-scoped undo restores the prior stage", restoredStatus.status === "applied");
check("field-scoped undo preserves later note edits", restoredStatus.notes === "new note after status change");

const backupState = emptyState();
backupState.applications = [{
  ...interviewing,
  updatedAt: "2026-07-24T11:30:00.000Z",
  stageHistory: [
    { status: "drafting", at: "2026-07-19T10:00:00.000Z" },
    { status: "applied", at: "2026-07-20T10:00:00.000Z" },
    { status: "interviewing", at: "2026-07-21T10:00:00.000Z" }
  ],
  interviewHistory: ["2026-07-22", "2026-07-23"]
}];
const backup = backupTools.createBackup(backupState, NOW);
const restoredBackup = backupTools.validateBackup(JSON.stringify(backup));
check("backup preserves application activity timestamp", restoredBackup.ok && restoredBackup.state.applications[0].updatedAt === "2026-07-24T11:30:00.000Z");
check("backup preserves every stage transition", restoredBackup.ok && restoredBackup.state.applications[0].stageHistory?.length === 3);
check("backup preserves prior interview dates", restoredBackup.ok && restoredBackup.state.applications[0].interviewHistory?.join(",") === "2026-07-22,2026-07-23");

const state = emptyState();
const pendingEvidence = evidenceRecord("project", "Completed labeled practice", "role-sprint", false, NOW, { label: "Role Sprint artifact", sourceText: "Frozen version A" });
state.dossier.evidence = [pendingEvidence];
state.roleSprints = [{
  id: "sprint-1", applicationId: null, company: "Acme", roleTitle: "Support", requirement: "Build dashboard", originalStatus: "gap",
  sprintType: "build", title: "Build dashboard", instructions: [], completionCriteria: [], supportingEvidenceIds: [], userWork: "Frozen version A",
  status: "completed", evidenceId: pendingEvidence.id,
  outputs: { portfolioTitle: "Title", portfolioSummary: "Summary", resumeBullet: "Bullet", starStory: "Story", talkingPoint: "Point", userEdited: false },
  createdAt: NOW, updatedAt: NOW
}];
const revised = lifecycle.beginRoleSprintRevision(state, "sprint-1", "2026-07-24T12:05:00.000Z");
check("proof versioning: revision removes pending evidence", revised.dossier.evidence.length === 0);
check("proof versioning: revision returns sprint to draft", revised.roleSprints[0].status === "draft" && revised.roleSprints[0].evidenceId === null);
check("proof versioning: revision preserves user work", revised.roleSprints[0].userWork === "Frozen version A");
check("proof versioning: revision clears generated outputs", revised.roleSprints[0].outputs === null);

const urgencyState = emptyState();
urgencyState.applications = [
  { ...applied, id: "follow-up", nextFollowUpAt: "2020-01-01T00:00:00.000Z" },
  { ...interviewing, id: "waiting", interviewAt: null, updatedAt: "2026-07-24T11:00:00.000Z" }
];
check("unscheduled interview yields to overdue follow-up", router.intentNextMove(urgencyState).actionLabel === "Log follow-up");
const waitingOnly = { ...emptyState(), applications: [{ ...interviewing, id: "waiting", interviewAt: null }] };
check("unscheduled interview requests the next date instead of more practice", router.intentNextMove(waitingOnly).actionLabel === "Set interview date");

const substantialPractice = emptyState();
substantialPractice.roleSprints = Array.from({ length: 3 }, (_, index) => ({ ...state.roleSprints[0], id: `sprint-${index}`, evidenceId: null, status: "draft" }));
check("backup nudge notices substantial Role Sprint work", backupTools.shouldNudgeBackup(substantialPractice, null, NOW) === true);

const tailorHook = read("src/components/tailor/useTailorWorkspace.ts");
const tailorPage = read("src/components/tailor/TailorWorkspace.tsx");
const sprintPage = read("src/components/role-sprint/RoleSprintWorkspacePage.tsx");
const applicationsPage = read("src/components/applications/ApplicationsWorkspace.tsx");
const intentRouter = read("src/lib/intent-router.ts");
const backupSource = read("src/lib/backup.ts");

check("job form: cleared dates save as null", tailorHook.includes("postingDate: form.postingDate || null") && tailorHook.includes("deadline: form.deadline || null"));
check("job form: explicit none sentinel exists", tailorHook.includes('NO_SELECTION = "__none__"') && tailorPage.includes("No saved target") && tailorPage.includes("No baseline selected"));
check("job form: replacement baseline validates current selection", tailorHook.includes("selectedBaseline") && tailorHook.includes("baselineIssue = form.baselineVariantId"));
check("job form: explicit applied action uses shared transition", tailorHook.includes("transitionApplicationStatus(record, finalStatus, nowIso)"));
check("proof review: pending work is locked", sprintPage.includes('submittedLocked = evidenceState === "pending" || evidenceState === "approved"') && sprintPage.includes("disabled={submittedLocked}"));
check("proof review: exact claim and source are visible", sprintPage.includes("Career Forge will save this claim") && sprintPage.includes("Submitted source excerpt"));
check("proof review: revision is explicit", sprintPage.includes("Revise submission") && sprintPage.includes("beginRoleSprintRevision"));
check("output trust: user edits are always labeled unchecked", sprintPage.includes("User edited · not checked by Career Forge") && sprintPage.includes("outputNeedsVerification"));
check("application safety: destructive drafting move confirms", applicationsPage.includes("Move this application back to Drafting?") && applicationsPage.includes("Undo"));
check("application undo: only status fields are restored", applicationsPage.includes("captureApplicationStatus") && applicationsPage.includes("restoreApplicationStatus") && !applicationsPage.includes("lastStatusChange.before.id"));
check("application history: stage and interview history are displayed", applicationsPage.includes("Application history") && applicationsPage.includes("Prior interviews"));
check("interview routing: past interviews request an outcome", intentRouter.includes("How did the") && intentRouter.includes("Update interview result"));
check("interview routing: unscheduled rounds wait for a date", intentRouter.includes("Set the next interview date") && intentRouter.includes("Set interview date"));
check("backup durability: optional history is restored", backupSource.includes("restoreApplicationDurability") && backupSource.includes("stageHistory") && backupSource.includes("interviewHistory"));

console.log(`\nTrust boundary regression: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
