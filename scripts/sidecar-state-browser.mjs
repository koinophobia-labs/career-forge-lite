import path from "node:path";
import fs from "node:fs";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "playwright";

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

const { createBackup } = loadTsModule(path.join(root, "src/lib/backup.ts"));
const { emptyState, STORAGE_KEY, RECOVERY_KEY } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { prepDraftKey, PREP_DRAFT_KEY, LEGACY_PREP_DRAFT_KEY } = loadTsModule(path.join(root, "src/lib/interview-prep-drafts.ts"));
const { INTERVIEW_SESSION_KEY } = loadTsModule(path.join(root, "src/lib/interview-session-store.ts"));
const { HANDOFF_KEY } = loadTsModule(path.join(root, "src/lib/tailor-handoff.ts"));
const { APPLICATION_ACTIVITY_KEY } = loadTsModule(path.join(root, "src/lib/application-activity.ts"));
const { LAST_BACKUP_KEY } = loadTsModule(path.join(root, "src/lib/backup.ts"));

const NOW = "2026-07-24T18:00:00.000Z";
const port = 3241;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  detached: process.platform !== "win32",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "off" },
  stdio: ["ignore", "pipe", "pipe"]
});
let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server.exitCode !== null) throw new Error(`Server exited early.\n${output}`);
    try { const response = await fetch(baseUrl); if (response.ok) return; } catch { /* not ready */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start.\n${output}`);
}

async function stopServer() {
  if (server.exitCode !== null) return;
  const signal = (name) => {
    try {
      if (process.platform !== "win32" && server.pid) process.kill(-server.pid, name);
      else server.kill(name);
    } catch { /* already exited */ }
  };
  signal("SIGTERM");
  await Promise.race([once(server, "exit").catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (server.exitCode === null) signal("SIGKILL");
}

let passes = 0;
function verify(condition, message) {
  if (!condition) throw new Error(`FAIL ${message}`);
  passes += 1;
  console.log(`PASS ${message}`);
}

function application(id, company) {
  return {
    id, company, roleTitle: "Customer Success Manager", laneId: "lane-cs", status: "interviewing", jobPostUrl: "",
    source: "other", discoveryUrl: "", applicationUrl: "", postingDate: null, deadline: null, contactName: "", contactUrl: "",
    resumeVariantId: null, applicationQuestions: [], resumeVersionId: null, appliedAt: NOW, nextFollowUpAt: null, followUpsSent: [],
    interviewAt: "2026-07-30", notes: "", analysisKeywords: ["customer success"], analysisGaps: ["Renewal forecasting"], analysisWeakSpots: [],
    createdAt: NOW, updatedAt: NOW, statusRevision: NOW, stageHistory: [{ status: "interviewing", at: NOW }], interviewHistory: []
  };
}

const stateA = emptyState();
stateA.activeGoal = { kind: "practice-interview", selectedAt: NOW, updatedAt: NOW };
stateA.profile.currentSituation = "Customer support professional moving into customer success";
stateA.profile.targetRoles = "Customer Success Manager";
stateA.profile.experienceSummary = "Support and account relationship work";
stateA.profile.transferableSkills = ["Customer communication", "Retention", "Troubleshooting"];
stateA.profile.updatedAt = NOW;
stateA.lanes = [{ id: "lane-cs", title: "Customer Success", status: "active", whyFit: "fit", resumeAngle: "angle", proof: [], gaps: [], keywords: ["retention"], source: "custom", createdAt: NOW }];
stateA.applications = [application("app-a", "Acme"), application("app-b", "Beta")];

const sessionA = { id: "session-a", messages: [], resumeDraft: {}, memory: {}, fieldStatuses: [], currentStage: "role_targeting", completedStages: [], createdAt: NOW, updatedAt: NOW };
const sessionB = { ...sessionA, id: "session-b" };
const genericQuestion = "What would keep you here two years from now?";
const keyA = prepDraftKey({ applicationId: "app-a", laneId: "lane-cs", questionId: "transition-1", question: genericQuestion });
const keyB = prepDraftKey({ applicationId: "app-b", laneId: "lane-cs", questionId: "transition-1", question: genericQuestion });

const stateB = emptyState();
stateB.activeGoal = { kind: "new-job", selectedAt: NOW, updatedAt: NOW };
stateB.applications = [{ ...application("app-restored", "Restored Co"), status: "drafting", interviewAt: null, stageHistory: [{ status: "drafting", at: NOW }] }];
const backupB = createBackup(stateB, NOW, { interviewPrepDrafts: { restored: "restored answer" }, interviewSession: sessionB });

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await context.newPage();

  await page.goto(baseUrl);
  await page.evaluate(({ keys, state, session }) => {
    localStorage.setItem(keys.store, JSON.stringify(state));
    localStorage.setItem(keys.session, JSON.stringify(session));
    localStorage.setItem(keys.handoff, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), roleTitle: "Old handoff" }));
    localStorage.setItem(keys.activity, JSON.stringify({ "app-a": state.applications[0].updatedAt }));
    localStorage.setItem(keys.legacyDraft, JSON.stringify({ legacy: "old answer" }));
  }, {
    keys: { store: STORAGE_KEY, session: INTERVIEW_SESSION_KEY, handoff: HANDOFF_KEY, activity: APPLICATION_ACTIVITY_KEY, legacyDraft: LEGACY_PREP_DRAFT_KEY },
    state: stateA,
    session: sessionA
  });

  await page.goto(`${baseUrl}/interview?applicationId=app-a`);
  await page.getByRole("heading", { name: "Practice the interview you’ll actually get." }).waitFor();
  const applicationSelect = page.getByLabel("Application (optional)");
  verify(await applicationSelect.inputValue() === "app-a", "requested interview target opens without reordering durable applications");

  let questionCard = page.locator("article").filter({ hasText: genericQuestion }).first();
  await questionCard.getByRole("button", { name: "Practice" }).click();
  await questionCard.getByRole("textbox").fill("Acme-specific commitment answer");
  await applicationSelect.selectOption("app-b");
  questionCard = page.locator("article").filter({ hasText: genericQuestion }).first();
  await questionCard.getByRole("button", { name: "Practice" }).click();
  verify(await questionCard.getByRole("textbox").inputValue() === "", "switching applications does not reuse the prior company answer");
  await questionCard.getByRole("textbox").fill("Beta-specific commitment answer");
  await applicationSelect.selectOption("app-a");
  questionCard = page.locator("article").filter({ hasText: genericQuestion }).first();
  await questionCard.getByRole("button", { name: "Practice" }).click();
  verify(await questionCard.getByRole("textbox").inputValue() === "Acme-specific commitment answer", "returning to an application restores only its scoped answer");

  const drafts = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), PREP_DRAFT_KEY);
  verify(drafts[keyA] === "Acme-specific commitment answer" && drafts[keyB] === "Beta-specific commitment answer", "scoped interview drafts persist under distinct keys");
  const durableOrder = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).applications.map((item) => item.id), STORAGE_KEY);
  verify(durableOrder.join(",") === "app-a,app-b", "interview navigation leaves durable application order unchanged");

  await page.goto(`${baseUrl}/settings`);
  await page.getByRole("heading", { name: "Backup & restore" }).waitFor();
  await page.getByLabel("Restore backup file").setInputFiles({ name: "restore.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backupB)) });
  await page.getByText("Backup contents", { exact: true }).waitFor();
  verify(await page.getByText("Role Sprints:", { exact: true }).isVisible(), "restore preview shows Role Sprints");
  verify(await page.getByText("Interview answer drafts:", { exact: true }).isVisible(), "restore preview shows interview drafts");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Replace current data with this backup" }).click();
  const rollbackDownload = await downloadPromise;
  verify((await rollbackDownload.suggestedFilename()).startsWith("career-forge-before-restore-"), "restore automatically creates a rollback download");

  const restored = await page.evaluate((keys) => ({
    state: JSON.parse(localStorage.getItem(keys.store)),
    drafts: JSON.parse(localStorage.getItem(keys.drafts) ?? "{}"),
    session: JSON.parse(localStorage.getItem(keys.session)),
    handoff: localStorage.getItem(keys.handoff)
  }), { store: STORAGE_KEY, drafts: PREP_DRAFT_KEY, session: INTERVIEW_SESSION_KEY, handoff: HANDOFF_KEY });
  verify(restored.state.applications[0].id === "app-restored", "restore replaces the primary workspace");
  verify(restored.drafts.restored === "restored answer" && !restored.drafts[keyA], "restore replaces interview drafts instead of mixing datasets");
  verify(restored.session.id === "session-b", "restore replaces the conversation interview session");
  verify(restored.handoff === null, "restore removes stale consume-once résumé handoffs");

  await page.getByRole("button", { name: "Undo restore" }).click();
  const undone = await page.evaluate((keys) => ({
    state: JSON.parse(localStorage.getItem(keys.store)),
    drafts: JSON.parse(localStorage.getItem(keys.drafts) ?? "{}"),
    session: JSON.parse(localStorage.getItem(keys.session))
  }), { store: STORAGE_KEY, drafts: PREP_DRAFT_KEY, session: INTERVIEW_SESSION_KEY });
  verify(undone.state.applications.some((item) => item.id === "app-a"), "Undo restore returns the previous primary workspace");
  verify(undone.drafts[keyA] === "Acme-specific commitment answer" && undone.session.id === "session-a", "Undo restore returns the previous interview sidecars");

  await page.getByRole("button", { name: "Clear local data…" }).click();
  await page.getByRole("button", { name: "Yes, clear all local Career Forge data" }).click();
  const keysAfterClear = await page.evaluate((keys) => Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, localStorage.getItem(key)])), {
    store: STORAGE_KEY,
    drafts: PREP_DRAFT_KEY,
    legacyDraft: LEGACY_PREP_DRAFT_KEY,
    session: INTERVIEW_SESSION_KEY,
    handoff: HANDOFF_KEY,
    activity: APPLICATION_ACTIVITY_KEY,
    backup: LAST_BACKUP_KEY,
    recovery: RECOVERY_KEY
  });
  verify(Object.values(keysAfterClear).every((value) => value === null), "Clear local data removes every Career Forge storage key");

  console.log(`\nSidecar state browser acceptance: ${passes} passed, 0 failed`);
  await context.close();
} finally {
  await browser?.close();
  await stopServer();
}
