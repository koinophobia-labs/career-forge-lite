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
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: absolute
  });
  const mod = { exports: {} };
  cache.set(absolute, mod);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, mod, mod.exports, dirname, absolute);
  return mod.exports;
}

const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { evidenceRecord } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { encodeJobPostText, decodeJobPostText } = loadTsModule(path.join(root, "src/lib/job-workspace.ts"));
const { recommendRoleSprintRequirement, primarySprintOutput } = loadTsModule(path.join(root, "src/lib/role-sprint-ux.ts"));
const { intentNextMove, recentCareerItems } = loadTsModule(path.join(root, "src/lib/intent-router.ts"));

let passes = 0;
function check(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passes += 1;
  console.log(`PASS ${label}`);
}

const jobPost = "Product Support Specialist at Acme\nRequired: Build weekly SQL dashboards\nPreferred: Strong written communication";
const encoded = encodeJobPostText(jobPost);
check("job workspace uses an explicit durable prefix", encoded.startsWith("career-forge-job-text:v1:"));
check("job workspace round-trips the exact posting", decodeJobPostText(encoded) === jobPost);
check("malformed or normal URLs do not masquerade as posting text", decodeJobPostText("https://example.com/job") === "");

const requirements = [
  { requirement: "Strong written communication preferred", status: "gap", evidence: "None", evidenceIds: [], supportType: null },
  { requirement: "Ability to build weekly SQL dashboards for support leadership", status: "gap", evidence: "None", evidenceIds: [], supportType: null },
  { requirement: "Bachelor's degree required", status: "gap", evidence: "None", evidenceIds: [], supportType: null }
];
const recommendation = recommendRoleSprintRequirement(requirements, jobPost, { hasResumeBaseline: false, nowIso: "2026-07-24T06:00:00.000Z" });
check("ranking ignores ineligible credentials", recommendation?.requirement?.requirement !== "Bachelor's degree required");
check("ranking favors a required demonstrable artifact over an optional soft skill", /SQL dashboards/.test(recommendation?.requirement?.requirement ?? ""));
check("ranking explains the recommendation", /Recommended because/.test(recommendation?.reason ?? "") && recommendation?.decision === "sprint");

check("build sprint promotes portfolio summary", primarySprintOutput("build").key === "portfolioSummary");
check("evaluate sprint promotes evaluation summary", primarySprintOutput("evaluate").key === "portfolioSummary");
check("simulate sprint promotes interview story", primarySprintOutput("simulate").key === "starStory");
check("explain sprint may lead with a resume bullet", primarySprintOutput("explain").key === "resumeBullet");

const NOW = "2026-07-24T06:00:00.000Z";
const pendingEvidence = evidenceRecord("project", "Completed labeled Role Sprint practice", "role-sprint", false, NOW, { label: "Role Sprint practice project" });
const pendingState = emptyState();
pendingState.activeGoal = { kind: "new-job", selectedAt: NOW, updatedAt: NOW };
pendingState.dossier.evidence = [pendingEvidence];
pendingState.roleSprints = [{
  id: "sprint-pending", applicationId: "app-1", company: "Acme", roleTitle: "Support", requirement: "Build SQL dashboard",
  originalStatus: "gap", sprintType: "build", title: "Build dashboard", instructions: [], completionCriteria: [], supportingEvidenceIds: [],
  userWork: "Finished dashboard artifact with fields and query outline.", status: "completed", evidenceId: pendingEvidence.id,
  outputs: { portfolioTitle: "Dashboard", portfolioSummary: "Practice summary", resumeBullet: "Practice bullet", starStory: "Story", talkingPoint: "Point", userEdited: false },
  createdAt: NOW, updatedAt: NOW
}];
check("Today prioritizes completed sprint evidence review when no live event exists", intentNextMove(pendingState).href === "/role-sprint?id=sprint-pending" && /Review/.test(intentNextMove(pendingState).actionLabel));
check("Recent work includes Role Sprints", recentCareerItems(pendingState).some((item) => item.id === "sprint-pending"));

const draftState = emptyState();
draftState.activeGoal = { kind: "new-job", selectedAt: NOW, updatedAt: NOW };
draftState.roleSprints = [{ ...pendingState.roleSprints[0], id: "sprint-draft", status: "draft", evidenceId: null, outputs: null }];
check("Today prioritizes unfinished Role Sprints when no live event exists", intentNextMove(draftState).href === "/role-sprint?id=sprint-draft");

const tailor = `${read("src/components/tailor/TailorWorkspace.tsx")}\n${read("src/components/tailor/useTailorWorkspace.ts")}`;
const sprintPage = read("src/components/role-sprint/RoleSprintWorkspacePage.tsx");
check("starting a sprint auto-saves the job first", tailor.includes('const applicationId = saveAsApplication("drafting")') && tailor.includes("encodeJobPostText(form.jobPost)"));
check("new posting identity resets from full-content comparison", tailor.includes("isLikelyNewJobPost") && tailor.includes("companyEdited: false") && tailor.includes("roleTitleEdited: false"));
check("saved jobs reopen by application id", tailor.includes("applicationJobPost(application)") && tailor.includes('new URLSearchParams(window.location.search).get("applicationId")'));
check("inline practice review shows exact claim", sprintPage.includes("Approve this exact claim") && sprintPage.includes("Career Forge will save this claim") && sprintPage.includes("reviewPractice(true)"));
check("pending submission is frozen until explicit revision", sprintPage.includes("Revise submission") && sprintPage.includes("beginRoleSprintRevision") && sprintPage.includes("disabled={submittedLocked}"));
check("sprint returns to the exact saved job", sprintPage.includes("Return to this job") && sprintPage.includes("/tailor?applicationId="));
check("edited output regeneration requires confirmation", sprintPage.includes("Regenerate drafts from your updated work?") && sprintPage.includes("record.outputs?.userEdited"));

console.log(`\n${passes} Role Sprint continuity regression checks passed`);
