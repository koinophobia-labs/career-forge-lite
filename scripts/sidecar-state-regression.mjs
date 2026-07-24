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
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: absolute
  });
  const cjsModule = { exports: {} };
  moduleCache.set(absolute, cjsModule);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

const { createBackup, validateBackup, BACKUP_SCHEMA_VERSION } = loadTsModule(path.join(root, "src/lib/backup.ts"));
const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { prepDraftKey } = loadTsModule(path.join(root, "src/lib/interview-prep-drafts.ts"));
const { captureApplicationStatus, restoreApplicationStatus, transitionApplicationStatus } = loadTsModule(path.join(root, "src/lib/application-workflow.ts"));
const { intentNextMove } = loadTsModule(path.join(root, "src/lib/intent-router.ts"));

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

const NOW = "2026-07-24T17:30:00.000Z";
const state = emptyState();
state.applications = [{
  id: "app-1", company: "Acme", roleTitle: "Support", laneId: null, status: "applied", jobPostUrl: "",
  source: "other", discoveryUrl: "", applicationUrl: "", postingDate: null, deadline: null, contactName: "", contactUrl: "",
  resumeVariantId: null, applicationQuestions: [], resumeVersionId: null, appliedAt: NOW, nextFollowUpAt: "2026-07-24T17:00:00.000Z",
  followUpsSent: [], interviewAt: null, notes: "keep me", analysisKeywords: [], analysisGaps: [], analysisWeakSpots: [],
  createdAt: NOW, updatedAt: NOW, statusRevision: NOW, stageHistory: [{ status: "drafting", at: NOW }, { status: "applied", at: NOW }],
  interviewHistory: ["2026-07-20"]
}];
state.roleSprints = [{
  id: "sprint-1", applicationId: "app-1", company: "Acme", roleTitle: "Support", requirement: "Build a dashboard", originalStatus: "gap",
  sprintType: "build", title: "Dashboard", instructions: [], completionCriteria: [], supportingEvidenceIds: [], userWork: "draft",
  status: "draft", evidenceId: null, outputs: null, createdAt: NOW, updatedAt: NOW
}];

const session = {
  id: "session-1", messages: [], resumeDraft: {}, memory: {}, fieldStatuses: [], currentStage: "role_targeting",
  completedStages: [], createdAt: NOW, updatedAt: NOW
};
const sidecars = { interviewPrepDrafts: { "app-1::lane-1::q-1::hash": "Acme-only answer" }, interviewSession: session };
const backup = createBackup(state, NOW, sidecars);
const validated = validateBackup(JSON.stringify(backup));

check("backup schema advances to sidecar-aware version", BACKUP_SCHEMA_VERSION === 3 && backup.schemaVersion === 3);
check("backup round-trips interview prep drafts", validated.ok && validated.sidecars.interviewPrepDrafts["app-1::lane-1::q-1::hash"] === "Acme-only answer");
check("backup round-trips conversation interview session", validated.ok && validated.sidecars.interviewSession?.id === "session-1");
check("backup preview exposes Role Sprints and interview work", validated.ok && validated.preview.roleSprintCount === 1 && validated.preview.interviewDraftCount === 1 && validated.preview.interviewSessionPresent);
check("backup preserves lifecycle revision and history", validated.ok && validated.state.applications[0].statusRevision === NOW && validated.state.applications[0].stageHistory?.length === 2 && validated.state.applications[0].interviewHistory?.[0] === "2026-07-20");

const question = "The posting asks for a dashboard — how do you bridge the gap?";
const keyA = prepDraftKey({ applicationId: "app-a", laneId: "lane", questionId: "gap-0", question });
const keyB = prepDraftKey({ applicationId: "app-b", laneId: "lane", questionId: "gap-0", question });
const keyC = prepDraftKey({ applicationId: "app-a", laneId: "lane", questionId: "gap-0", question: `${question} Extra context.` });
check("interview draft identity includes application", keyA !== keyB);
check("interview draft identity includes full question", keyA !== keyC);

const before = state.applications[0];
const snapshot = captureApplicationStatus(before);
const transitioned = transitionApplicationStatus(before, "interviewing", "2026-07-24T17:31:00.000Z");
const withLaterNote = { ...transitioned, notes: "new note after stage change", updatedAt: "2026-07-24T17:32:00.000Z" };
const restored = restoreApplicationStatus(withLaterNote, snapshot, "2026-07-24T17:33:00.000Z");
check("status transition creates lifecycle revision", transitioned.statusRevision === "2026-07-24T17:31:00.000Z");
check("field-scoped restore preserves later notes", restored.notes === "new note after stage change" && restored.status === "applied");
check("restoring status creates a fresh revision", restored.statusRevision === "2026-07-24T17:33:00.000Z");

const next = intentNextMove(state, "new-job", NOW);
check("overdue follow-up deep-links the named application", next.href === "/applications#application-app-1");

const settingsSource = fs.readFileSync(path.join(root, "src/app/settings/page.tsx"), "utf8");
const prepSource = fs.readFileSync(path.join(root, "src/components/InterviewPrep.tsx"), "utf8");
const interviewPageSource = fs.readFileSync(path.join(root, "src/app/interview/page.tsx"), "utf8");
const applicationSource = fs.readFileSync(path.join(root, "src/components/applications/ApplicationsWorkspace.tsx"), "utf8");
check("restore captures rollback before replacement", settingsSource.includes("career-forge-before-restore") && settingsSource.includes("Undo restore"));
check("clear removes all workspace sidecars", settingsSource.includes("clearWorkspaceSidecars()"));
check("restore replaces sidecars atomically", settingsSource.includes("replaceWorkspaceSidecars(pendingImport.sidecars)"));
check("question cards use full scoped draft identity", prepSource.includes("prepDraftKey({") && prepSource.includes("key={draftKey}") && prepSource.includes("draftKey={draftKey}"));
check("interview route does not reorder durable applications", !interviewPageSource.includes("updateCommandCenter") && !interviewPageSource.includes("applications: [target"));
check("question edits derive from latest application array", applicationSource.includes("updateApplicationQuestion") && applicationSource.includes("application.applicationQuestions.map"));
check("Undo checks lifecycle revision", applicationSource.includes("application.statusRevision !== lastStatusChange.transitionRevision"));

console.log(`\nSidecar state regression: ${passes} passed, ${failures} failed`);
if (failures) process.exit(1);
