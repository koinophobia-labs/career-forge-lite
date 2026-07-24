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
const calendar = loadTsModule(path.join(root, "src/lib/calendar-date.ts"));
const interview = loadTsModule(path.join(root, "src/lib/application-interview.ts"));
const router = loadTsModule(path.join(root, "src/lib/intent-router.ts"));
const sprintUx = loadTsModule(path.join(root, "src/lib/role-sprint-ux.ts"));
const sprintValidation = loadTsModule(path.join(root, "src/lib/role-sprint-work-validator.ts"));
const sprintLifecycle = loadTsModule(path.join(root, "src/lib/role-sprint-lifecycle.ts"));
const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

let passes = 0;
let failures = 0;
function check(label, condition) {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}`); }
}

const NOW = "2026-07-24T12:00:00.000Z";
const application = {
  id: "app-1", company: "Acme", roleTitle: "Support", laneId: null, status: "applied", jobPostUrl: "", source: "other",
  discoveryUrl: "", applicationUrl: "", postingDate: null, deadline: null, contactName: "", contactUrl: "", resumeVariantId: null,
  applicationQuestions: [], resumeVersionId: null, appliedAt: "2026-07-20T12:00:00.000Z", nextFollowUpAt: "2026-07-21T12:00:00.000Z",
  followUpsSent: [], interviewAt: "2026-07-30", notes: "", analysisKeywords: [], analysisGaps: [], analysisWeakSpots: [], createdAt: NOW, updatedAt: NOW
};

const draftPatch = workflow.applicationStatusPatch(application, "drafting", NOW);
check("status transition: drafting preserves first applied date", draftPatch.appliedAt === application.appliedAt);
check("status transition: drafting clears stale follow-up", draftPatch.nextFollowUpAt === null);
check("status transition: drafting clears interview date", draftPatch.interviewAt === null);
const reappliedPatch = workflow.applicationStatusPatch({ ...application, status: "interviewing", nextFollowUpAt: null }, "applied", NOW);
check("status transition: returning to applied schedules a fresh follow-up", typeof reappliedPatch.nextFollowUpAt === "string" && reappliedPatch.nextFollowUpAt > NOW);
check("status transition: returning to applied preserves original date", reappliedPatch.appliedAt === application.appliedAt);
check("status transition: interviewing clears follow-up", workflow.applicationStatusPatch(application, "interviewing", NOW).nextFollowUpAt === null);

check("calendar: legacy UTC midnight revives as intended date", calendar.normalizeCalendarDate("2026-07-24T00:00:00.000Z") === "2026-07-24");
check("calendar: date-only input stays date-only", calendar.calendarDateInputValue("2026-07-24") === "2026-07-24");
check("calendar: passed deadline is distinct from urgent", calendar.deadlineState("2026-07-23", NOW) === "passed");

const staleDraftState = emptyState();
staleDraftState.activeGoal = { kind: "new-job", selectedAt: NOW, updatedAt: NOW };
staleDraftState.applications = [{ ...application, status: "drafting" }];
check("Today: stale draft follow-up is ignored", router.intentNextMove(staleDraftState).actionLabel !== "Log follow-up");

const rejectedState = emptyState();
rejectedState.dossier.evidence = [{
  id: "e-1", kind: "project", label: "Practice", detail: "Rejected practice", source: "role-sprint", sourceText: "",
  confidence: "high", approved: false, rejected: true, sourceFilenames: [], sourceExcerpts: [], createdAt: NOW, updatedAt: NOW
}];
rejectedState.roleSprints = [{
  id: "s-1", applicationId: null, company: "", roleTitle: "", requirement: "Build dashboard", originalStatus: "gap", sprintType: "build",
  title: "Dashboard", instructions: [], completionCriteria: [], supportingEvidenceIds: [],
  userWork: "Dashboard artifact\nFields: id, week\nMetrics: volume\nI chose weekly grouping because it shows trends. With more time I would add filters and validation.",
  status: "completed", evidenceId: "e-1",
  outputs: { portfolioTitle: "", portfolioSummary: "", resumeBullet: "", starStory: "", talkingPoint: "", userEdited: false }, createdAt: NOW, updatedAt: NOW
}];
check("Recent work: rejected proof is labeled rejected", /rejected/i.test(router.recentCareerItems(rejectedState)[0]?.detail ?? ""));
const resubmitted = sprintLifecycle.submitRoleSprintForReview(rejectedState, "s-1", rejectedState.roleSprints[0].userWork, "2026-07-25T12:00:00.000Z");
check("rejected proof: revised submission returns to pending", resubmitted.ok && resubmitted.state.dossier.evidence.find((item) => item.id === resubmitted.evidence.id)?.rejected === false);

const requirement = { requirement: "Ability to build weekly SQL dashboards", status: "gap", evidence: "None", evidenceIds: [] };
const posting = `Support Analyst\nRequired: ${requirement.requirement}`;
check("recommendation: offer routes to offer review without gaps", sprintUx.recommendRoleSprintRequirement([], posting, { hasResumeBaseline: true, applicationStatus: "offer" })?.decision === "review-offer");
check("recommendation: interview routes to interview prep", sprintUx.recommendRoleSprintRequirement([requirement], posting, { hasResumeBaseline: true, applicationStatus: "interviewing" })?.decision === "prepare-interview");
check("recommendation: applied job routes to tracking", sprintUx.recommendRoleSprintRequirement([requirement], posting, { hasResumeBaseline: true, applicationStatus: "applied" })?.decision === "application-live");
check("recommendation: rejected job is closed", sprintUx.recommendRoleSprintRequirement([], posting, { hasResumeBaseline: true, applicationStatus: "rejected" })?.decision === "application-closed");
check("recommendation: expired deadline does not suggest apply", sprintUx.recommendRoleSprintRequirement([requirement], posting, { hasResumeBaseline: true, deadline: "2026-07-23", nowIso: NOW })?.decision === "deadline-passed");

const interviewApps = [
  { ...application, id: "past", interviewAt: "2026-07-20", updatedAt: "2026-07-24T11:00:00.000Z", status: "interviewing" },
  { ...application, id: "undated", interviewAt: null, updatedAt: "2026-07-24T12:00:00.000Z", status: "interviewing" },
  { ...application, id: "tomorrow", interviewAt: "2026-07-25", updatedAt: "2026-07-23T12:00:00.000Z", status: "interviewing" }
];
check("interview selection: upcoming dated interview wins", interview.selectInterviewApplication(interviewApps, null, NOW)?.id === "tomorrow");
check("interview selection: explicit application id wins", interview.selectInterviewApplication(interviewApps, "undated", NOW)?.id === "undated");
check("Today: interview link carries exact application", router.intentNextMove({ ...emptyState(), applications: interviewApps }).href === "/interview?applicationId=tomorrow");

const incompleteBuild = "I would build a dashboard with useful metrics and a clean layout.";
const linkOnlyBuild = "https://example.com";
const completeBuild = "Dashboard artifact\nFields: ticket_id, week, category, resolution_hours\nQuery: SELECT week, COUNT(*) FROM tickets GROUP BY week\nMetrics: volume, resolution time, escalation rate\nI chose these fields because leaders need trend and severity context. With more time I would add drill-down filters.";
check("live checklist: incomplete build exposes missing items", sprintValidation.sprintArtifactChecks(incompleteBuild, "build").some((item) => !item.met));
check("validation: URL alone is not a finished artifact", sprintValidation.validateSprintArtifact(linkOnlyBuild, "build").ok === false);
check("live checklist: structured build can become ready", sprintValidation.sprintArtifactChecks(completeBuild, "build").every((item) => item.met));
check("validation: structured build passes", sprintValidation.validateSprintArtifact(completeBuild, "build").ok === true);

const cleanupState = emptyState();
cleanupState.applications = [{ ...application, id: "cleanup" }];
cleanupState.roleSprints = [{ ...rejectedState.roleSprints[0], id: "cleanup-sprint", applicationId: "cleanup", evidenceId: "cleanup-evidence" }];
cleanupState.dossier.evidence = [{ ...rejectedState.dossier.evidence[0], id: "cleanup-evidence", approved: false }];
const cleaned = workflow.removeApplicationWorkspace(cleanupState, "cleanup", "remove-sprints");
check("delete: unapproved sprint evidence is removed with records", !cleaned.dossier.evidence.some((item) => item.id === "cleanup-evidence"));

const tailorHook = read("src/components/tailor/useTailorWorkspace.ts");
const tailorUi = read("src/components/tailor/TailorWorkspace.tsx");
const sprintUi = read("src/components/role-sprint/RoleSprintWorkspacePage.tsx");
const applicationsUi = read("src/components/applications/ApplicationsWorkspace.tsx");
const interviewPage = read("src/app/interview/page.tsx");
check("manual application: existing id loads without requiring a saved post", tailorHook.includes("if (!application) return") && !tailorHook.includes("if (!application || !savedPost) return"));
check("manual application: UI asks user to complete the workspace", tailorUi.includes("Complete this saved application"));
check("answers: saved edited answers merge by prompt", tailorHook.includes("if (saved) return { ...saved, prompt }"));
check("answers: empty field intentionally clears question records", tailorHook.includes("if (!prompts.length) return []"));
check("baselines: mismatch is visible and blocks generation", tailorHook.includes("baselineIssue") && tailorUi.includes("Résumé baseline needs attention"));
check("tracker: every application exposes a workspace action", applicationsUi.includes("Add job posting →") && applicationsUi.includes("Open job workspace →"));
check("sprint UI: rejected and missing proof hide output-use sections", sprintUi.includes('evidenceState !== "rejected" && evidenceState !== "missing"'));
check("sprint UI: user-edited outputs are always marked unverified", sprintUi.includes("User edited · not checked by Career Forge") && sprintUi.includes("outputNeedsVerification"));
check("sprint UI: live completion checklist is visible", sprintUi.includes("Ready-to-finish checklist") && sprintUi.includes("sprintArtifactChecks"));
check("interview page: exact requested application is promoted", interviewPage.includes("requestedApplicationId") && interviewPage.includes("applications: [target, ...applications]"));

console.log(`\nState integrity regression: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
