// Founding-user Role Sprint browser acceptance:
// approved profile → paste one job → start one gap sprint → submit work →
// review pending practice evidence → approve → confirm it remains labeled
// practice rather than employment experience.
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
const roleEvidence = evidenceRecord(
  "role",
  "Customer Support Specialist at Northstar Software, 2022–2026",
  "manual",
  true,
  NOW,
  { label: "Employment record" }
);
const responsibilityEvidence = evidenceRecord(
  "responsibility",
  "Resolved escalated billing and account-access issues for customers",
  "manual",
  true,
  NOW,
  { label: "Role responsibility" }
);
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
  verify(/SQL dashboards/i.test(recommendationText ?? ""), "analysis promotes the intended addressable gap as one clear action");

  await startSprintButton.click();
  await page.waitForURL(/\/role-sprint\?id=/);
  const sprintUrl = page.url();
  await page.getByRole("heading", { name: "Close this gap" }).waitFor();
  await page.getByRole("heading", { name: "Do this" }).waitFor();
  verify(await page.getByText(/SQL dashboards/i).first().isVisible(), "sprint keeps the selected job gap visible");
  verify(!(await page.getByText("Why this task?", { exact: true }).locator("..").evaluate((node) => node.hasAttribute("open"))), "honesty details stay available but collapsed during the task");

  await page.getByLabel("Sprint work area").fill(submission);
  await page.getByRole("button", { name: "Finish sprint →" }).click();
  await page.getByText("Sprint complete.", { exact: false }).waitFor();
  await page.getByText("Best way to use this", { exact: true }).waitFor();
  verify(await page.getByRole("textbox", { name: "Résumé / project bullet" }).inputValue().then((value) => value.toLowerCase().includes("practice")), "recommended résumé output keeps the practice label");
  verify(!(await page.getByText("Other ways to use this work", { exact: true }).locator("..").evaluate((node) => node.hasAttribute("open"))), "secondary outputs stay collapsed behind the recommended output");

  const pending = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const pendingSprint = pending.roleSprints[0];
  const pendingEvidence = pending.dossier.evidence.find((item) => item.id === pendingSprint.evidenceId);
  verify(pendingSprint.status === "completed", "finishing the sprint creates a completed record");
  verify(pendingEvidence && !pendingEvidence.approved && !pendingEvidence.rejected && pendingEvidence.source === "role-sprint", "sprint evidence starts pending rather than approved");
  verify(/practice/i.test(pendingEvidence.detail) && !/employed|employment experience/i.test(pendingEvidence.detail), "pending evidence is labeled practice and does not claim employment");

  await page.getByRole("link", { name: "Review this evidence →" }).click();
  await page.waitForURL(/\/profile#evidence-review/);
  await page.getByRole("heading", { name: "Review proposed or migrated evidence" }).waitFor();
  const practiceCard = page.locator("article").filter({ hasText: /labeled practice work/i }).first();
  await practiceCard.getByRole("button", { name: "Approve fact" }).click();

  await page.goto(sprintUrl);
  await page.getByText("Approved.", { exact: false }).waitFor();
  verify(await page.getByText("This is labeled practice evidence, not employment experience.", { exact: true }).isVisible(), "approved sprint still states that it is not employment experience");
  verify(await page.getByText("Approved practice", { exact: true }).isVisible(), "approved state uses a truthful practice label");

  const approved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const approvedSprint = approved.roleSprints[0];
  const approvedEvidence = approved.dossier.evidence.find((item) => item.id === approvedSprint.evidenceId);
  verify(approvedSprint.status === "approved-as-evidence" && approvedEvidence.approved, "profile approval synchronizes the sprint and evidence states");

  console.log(`\nRole Sprint browser acceptance: ${passes} passed, 0 failed`);
  await context.close();
} finally {
  await browser?.close();
  await stopServer();
}
