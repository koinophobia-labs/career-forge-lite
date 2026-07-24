// Role Sprint continuity acceptance:
// approved profile → paste one job → recommended gap → auto-save/link job →
// complete sprint → Today resumes review → approve practice inline → return to
// the exact posting → refreshed analysis shows honest partial practice support.
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

const { emptyState, STORAGE_KEY } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { evidenceRecord } = loadTsModule(path.join(root, "src/lib/dossier.ts"));

const NOW = "2026-07-24T05:00:00.000Z";
const port = 3238;
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

const seed = emptyState();
const roleEvidence = evidenceRecord("role", "Customer Support Specialist at Northstar Software, 2022–2026", "manual", true, NOW, { label: "Employment record" });
const responsibilityEvidence = evidenceRecord("responsibility", "Resolved escalated billing and account-access issues for customers", "manual", true, NOW, { label: "Role responsibility" });
seed.activeGoal = { kind: "new-job", selectedAt: NOW, updatedAt: NOW };
seed.profile.currentSituation = "Customer support professional seeking a product support role";
seed.profile.targetRoles = "Product Support Specialist";
seed.profile.experienceSummary = "Customer support and issue resolution";
seed.profile.transferableSkills = ["Customer communication", "Issue resolution", "Documentation"];
seed.profile.updatedAt = NOW;
seed.dossier = {
  ...seed.dossier,
  evidence: [roleEvidence, responsibilityEvidence],
  approvedClaims: [roleEvidence.detail, responsibilityEvidence.detail],
  responsibilities: [responsibilityEvidence.detail],
  updatedAt: NOW
};

const requirement = "Ability to build weekly SQL dashboards for support leadership";
const jobPost = `Product Support Specialist at Acme Software\n\nResponsibilities:\n- Resolve customer tickets and explain next steps clearly\n- Document repeatable support workflows\n\nRequirements:\n- ${requirement}\n- 3+ years of product support experience\n- Bachelor's degree preferred`;
const submission = "Practice artifact: Weekly Support Dashboard Specification. I defined five fields for a mock ticket dataset: ticket ID, created date, resolution date, category, and escalation status. I wrote a SQL outline that groups tickets by week and category, calculates ticket volume and average resolution time, and counts escalations. The dashboard layout includes weekly volume, average resolution time, escalation rate, and the top three ticket categories, followed by a short leadership note explaining what changed and which workflow needs attention.";

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto(baseUrl);
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: STORAGE_KEY, state: seed });
  await page.goto(`${baseUrl}/tailor`);

  await page.getByRole("heading", { name: "Paste a job. See what you can prove." }).waitFor();
  verify(await page.getByText("The job post is the only required input.", { exact: false }).isVisible(), "job analysis opens with one required input");
  verify(!(await page.getByText("Add application details", { exact: true }).locator("..").evaluate((node) => node.hasAttribute("open"))), "optional application details start collapsed");

  await page.getByLabel("Paste the full job posting").fill(jobPost);
  await page.getByRole("button", { name: "Analyze this job →" }).click();
  await page.getByText("Best next step", { exact: true }).waitFor();
  const startSprintButton = page.getByRole("button", { name: "Start one Role Sprint →" });
  await startSprintButton.waitFor();
  const recommendationText = await startSprintButton.locator("..").textContent();
  verify(/SQL dashboards/i.test(recommendationText ?? ""), "ranking promotes the strongest addressable gap");
  verify(/Recommended because/i.test(recommendationText ?? ""), "the recommendation explains why this gap was selected");

  await startSprintButton.click();
  await page.waitForURL(/\/role-sprint\?id=/);
  const sprintUrl = page.url();
  await page.getByRole("heading", { name: "Close this gap" }).waitFor();

  const started = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const startedSprint = started.roleSprints[0];
  const savedApplication = started.applications[0];
  verify(started.applications.length === 1 && startedSprint.applicationId === savedApplication.id, "starting a sprint auto-saves and links one job workspace");
  verify(savedApplication.jobPostUrl.startsWith("career-forge-job-text:v1:"), "the full posting is stored durably in the backed-up application record");
  verify(savedApplication.company === "Acme Software" && savedApplication.roleTitle === "Product Support Specialist", "job identity is inferred into the saved workspace");

  await page.getByLabel("Sprint work area").fill(submission);
  await page.getByRole("button", { name: "Finish sprint →" }).click();
  await page.getByText("Sprint complete.", { exact: false }).waitFor();
  await page.getByText("Review your practice proof", { exact: true }).waitFor();
  await page.getByText("Best way to use this", { exact: true }).waitFor();
  verify(await page.getByRole("textbox", { name: "Portfolio summary" }).inputValue().then((value) => /practice/i.test(value)), "a build sprint promotes the portfolio summary instead of forcing a résumé bullet first");
  verify(!(await page.getByText("Other ways to use this work", { exact: true }).locator("..").evaluate((node) => node.hasAttribute("open"))), "secondary outputs stay collapsed");

  const pending = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const pendingSprint = pending.roleSprints[0];
  const pendingEvidence = pending.dossier.evidence.find((item) => item.id === pendingSprint.evidenceId);
  verify(pendingEvidence && !pendingEvidence.approved && !pendingEvidence.rejected, "sprint evidence starts pending rather than approved");

  await page.goto(baseUrl);
  await page.getByRole("heading", { name: "Review the practice proof you finished" }).waitFor();
  verify(await page.getByRole("link", { name: "Review practice proof →" }).isVisible(), "Today prioritizes completed practice review");
  await page.goto(sprintUrl);

  await page.getByRole("button", { name: "Approve as practice →" }).click();
  await page.getByText("Approved.", { exact: false }).waitFor();
  verify(await page.getByText("Approved practice", { exact: true }).isVisible(), "inline review synchronizes the approved-practice state");
  const approvalText = await page.getByText("Approved.", { exact: false }).first().locator("..").textContent();
  verify(/not employment experience/i.test(approvalText ?? ""), "approved work remains explicitly separate from employment experience");

  await page.getByRole("link", { name: "Return to this job →" }).click();
  await page.waitForURL(/\/tailor\?applicationId=/);
  await page.getByText("Best next step", { exact: true }).waitFor();
  verify(await page.getByLabel("Paste the full job posting").inputValue().then((value) => value === jobPost), "returning to the job restores the exact posting");
  const requirementCard = page.locator("div.rounded-lg").filter({ hasText: /SQL dashboards/i }).first();
  verify(await requirementCard.getByText("partial", { exact: true }).isVisible(), "refreshed analysis moves approved practice support to partial, never covered");
  verify(/Role Sprint practice|labeled practice/i.test(await requirementCard.textContent()), "refreshed analysis explains the practice-only support");

  console.log(`\nRole Sprint continuity acceptance: ${passes} passed, 0 failed`);
  await context.close();
} finally {
  await browser?.close();
  await stopServer();
}
