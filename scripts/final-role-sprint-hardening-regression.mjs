import path from "node:path";
import fs from "node:fs";
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
  const module = { exports: {} };
  cache.set(absolute, module);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, module, module.exports, dirname, absolute);
  return module.exports;
}

const workflow = loadTsModule(path.join(root, "src/lib/application-workflow.ts"));
const jobs = loadTsModule(path.join(root, "src/lib/job-workspace.ts"));
const sprintUx = loadTsModule(path.join(root, "src/lib/role-sprint-ux.ts"));
const sprintValidation = loadTsModule(path.join(root, "src/lib/role-sprint-work-validator.ts"));
const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

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

check("status: auto-save preserves applied", workflow.statusForWorkspaceSave("applied", "drafting") === "applied");
check("status: auto-save preserves interviewing", workflow.statusForWorkspaceSave("interviewing", "drafting") === "interviewing");
check("status: auto-save preserves offer", workflow.statusForWorkspaceSave("offer", "drafting") === "offer");
check("status: explicit apply advances draft", workflow.statusForWorkspaceSave("drafting", "applied") === "applied");
check("status: explicit apply cannot downgrade offer", workflow.statusForWorkspaceSave("offer", "applied") === "offer");

const app = (id, status) => ({ id, status, createdAt: "2026-07-24T00:00:00.000Z" });
check("priority: offer ranks first", workflow.applicationPriority(app("offer", "offer")) < workflow.applicationPriority(app("interview", "interviewing")));
check("priority: interview ranks before applied", workflow.applicationPriority(app("interview", "interviewing")) < workflow.applicationPriority(app("applied", "applied")));
check("priority: applied ranks before draft", workflow.applicationPriority(app("applied", "applied")) < workflow.applicationPriority(app("draft", "drafting")));

const postA = "Product Manager at Alpha\nRequirements:\n- Build analytics dashboards\n- Lead discovery";
const postB = "Product Manager at Beta\nRequirements:\n- Build billing systems\n- Lead pricing research";
check("posting: full-content fingerprints differ for same-title jobs", jobs.jobPostFingerprint(postA) !== jobs.jobPostFingerprint(postB));
check("posting: same-title full paste is a new job", jobs.isLikelyNewJobPost(postA, postB, "insertFromPaste") === true);
check("posting: whitespace-only edit stays attached", jobs.isLikelyNewJobPost(postA, `  ${postA}\n`, "insertText") === false);

const baseState = emptyState();
baseState.applications = [{ id: "app-1" }];
baseState.roleSprints = [
  { id: "sprint-1", applicationId: "app-1", updatedAt: "2026-07-24T00:00:00.000Z" },
  { id: "sprint-2", applicationId: null, updatedAt: "2026-07-24T00:00:00.000Z" }
];
const detached = workflow.removeApplicationWorkspace(baseState, "app-1", "keep-sprints");
check("delete: keep-practice removes job", detached.applications.length === 0);
check("delete: keep-practice detaches linked sprint", detached.roleSprints.find((item) => item.id === "sprint-1")?.applicationId === null);
const removed = workflow.removeApplicationWorkspace(baseState, "app-1", "remove-sprints");
check("delete: remove-sprints deletes linked record only", removed.roleSprints.length === 1 && removed.roleSprints[0].id === "sprint-2");

const req = (requirement, status = "gap") => ({ requirement, status, evidence: "No approved evidence", evidenceIds: [] });
const requirements = [
  req("Ability to build weekly SQL dashboards for support leadership"),
  req("Strong written communication", "partial")
];
const sprintNow = sprintUx.recommendRoleSprintRequirement(requirements, postA, { hasResumeBaseline: false, nowIso: "2026-07-24T00:00:00.000Z" });
check("recommendation: strong missing artifact can recommend sprint", sprintNow?.decision === "sprint");
const applyAfterSubmitted = sprintUx.recommendRoleSprintRequirement(requirements, postA, { hasResumeBaseline: true, applicationStatus: "applied", nowIso: "2026-07-24T00:00:00.000Z" });
check("recommendation: submitted application says apply first", applyAfterSubmitted?.decision === "apply-first");
const urgent = sprintUx.recommendRoleSprintRequirement(requirements, postA, { hasResumeBaseline: true, deadline: "2026-07-25T00:00:00.000Z", nowIso: "2026-07-24T00:00:00.000Z" });
check("recommendation: close deadline says apply first", urgent?.decision === "apply-first");

const validBuild = "Dashboard artifact\nFields: ticket_id, week, category, resolution_hours\nQuery: SELECT week, COUNT(*) FROM tickets GROUP BY week\nMetrics: volume, resolution time, escalation rate\nOutput: weekly leadership report";
check("validation: build requires artifact structure", sprintValidation.validateSprintArtifact("I would build a dashboard that helps leaders understand support.", "build").ok === false);
check("validation: structured build passes", sprintValidation.validateSprintArtifact(validBuild, "build").ok === true);
check("validation: evaluate requires rubric verdict and fix", sprintValidation.validateSprintArtifact("Scenario: ticket reply. Rubric checks tone and accuracy. Verdict: fail. Fix: add the missing next step.", "evaluate").ok === true);
check("validation: plan requires steps done conditions and risk", sprintValidation.validateSprintArtifact("1. Gather inputs. Done when all owners confirm.\n2. Draft workflow. Checkpoint: review complete.\n3. Test it. Risk: missing data; catch it early.\n4. Launch and measure success.", "plan").ok === true);
check("validation: simulate requires scenario response and debrief", sprintValidation.validateSprintArtifact("Scenario: an upset customer reports a duplicate charge. Response: I would send a clear reply and take these steps. Debrief: I prioritized safety and would watch for another charge next.", "simulate").ok === true);
check("validation: explain requires depth and examples", sprintValidation.validateSprintArtifact(`${"This explains the concept in plain language and how it changes daily decisions. ".repeat(12)} Example one covers onboarding. Example two covers escalation.`, "explain").ok === true);

console.log(`\nFinal Role Sprint hardening regression: ${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
