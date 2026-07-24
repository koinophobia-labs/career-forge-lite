// Final Role Sprint acceptance:
// structured proof validation, durable job linkage, answer preservation,
// applied-status preservation, offer priority, same-title posting replacement,
// manual-workspace upgrade, and safe linked-sprint deletion.
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

const sqlRequirement = "Ability to build weekly SQL dashboards for support leadership";
const knowledgeRequirement = "Ability to create a searchable onboarding knowledge base for new support agents";
const jobPost = `Product Support Specialist\n\nAcme Software\n\nResponsibilities:\n- Resolve customer tickets and explain next steps clearly\n- Document repeatable support workflows\n\nRequirements:\n- ${sqlRequirement}\n- ${knowledgeRequirement}\n- 3+ years of product support experience\n- Bachelor's degree preferred`;
const invalidDescription = "I would build a dashboard that helps leaders understand support trends, ticket volume, resolution time, escalation rates, and the categories that need attention each week.";
const validArtifact = `Weekly Support Dashboard Artifact\nFields: ticket_id, created_week, category, resolution_hours, escalation_status\nQuery: SELECT created_week, category, COUNT(*) AS ticket_volume FROM tickets GROUP BY created_week, category\nMetrics: weekly volume, average resolution time, escalation rate, top categories\nI chose these fields because leaders need both trend and severity context. With more time I would add drill-down filters.`;
const secondJobPost = `Product Support Specialist\n\nBeta Software\n\nResponsibilities:\n- Support enterprise customers\n\nRequirements:\n- Ability to build a customer escalation dashboard in SQL\n- Ability to design a repeatable incident handoff process`;
const manualJobPost = `Customer Experience Associate at Manual Co\n\nResponsibilities:\n- Resolve customer questions\n\nRequirements:\n- Strong written communication`;

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
  await page.getByLabel("Paste the full job posting").fill(jobPost);
  await page.getByText("Add application details", { exact: true }).click();
  await page.getByText("Company", { exact: true }).locator("..").getByRole("textbox").fill("Acme Software");
  await page.getByText("Application questions", { exact: true }).locator("..").getByRole("textbox").fill("Why do you want this role?");
  await page.getByRole("button", { name: "Analyze this job →" }).click();
  const startSprintButton = page.getByRole("button", { name: "Start one Role Sprint →" });
  await startSprintButton.waitFor();
  verify(/SQL dashboards/i.test(await startSprintButton.locator("..").textContent()), "ranking promotes the strongest addressable gap");

  await startSprintButton.click();
  await page.waitForURL(/\/role-sprint\?id=/);
  const firstSprintUrl = page.url();
  const started = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const firstApplicationId = started.applications[0].id;
  verify(started.roleSprints[0].applicationId === firstApplicationId && started.applications[0].company === "Acme Software", "starting a sprint saves and links the correct job");

  await page.getByLabel("Sprint work area").fill(invalidDescription);
  const finishButton = page.getByRole("button", { name: "Finish sprint →" });
  verify(await finishButton.isDisabled(), "live checklist blocks a description without artifact structure");
  verify(await page.getByText(/Complete the checklist before submitting/i).isVisible(), "live checklist explains why submission is blocked");

  await page.getByLabel("Sprint work area").fill(validArtifact);
  await page.getByText("Ready to submit", { exact: true }).waitFor();
  await finishButton.click();
  await page.getByText("Review your practice proof", { exact: true }).waitFor();
  await page.goto(baseUrl);
  await page.getByRole("heading", { name: "Review the practice proof you finished" }).waitFor();
  await page.goto(firstSprintUrl);
  await page.getByRole("button", { name: "Approve as practice →" }).click();
  await page.getByText("Approved.", { exact: false }).waitFor();
  await page.getByRole("link", { name: "Return to this job →" }).click();
  await page.waitForURL(/\/tailor\?applicationId=/);
  await page.getByText("Best next step", { exact: true }).waitFor();
  const sqlCard = page.locator("div.rounded-lg").filter({ hasText: /SQL dashboards/i }).first();
  await sqlCard.getByText("partial", { exact: true }).waitFor();
  verify(await sqlCard.getByText("partial", { exact: true }).isVisible(), "approved practice refreshes to partial, never covered");

  await page.goto(`${baseUrl}/applications`);
  let acmeCard = page.locator("article").filter({ hasText: /Acme Software/i }).first();
  const answerBox = acmeCard.getByText("Why do you want this role?", { exact: true }).locator("..").getByRole("textbox");
  await answerBox.fill("I want this role because it combines customer problem solving with product feedback.");
  await acmeCard.locator("select").selectOption("applied");
  await acmeCard.getByRole("link", { name: "Open job workspace →" }).click();
  await page.waitForURL(/\/tailor\?applicationId=/);
  const knowledgeCard = page.locator("div.rounded-lg").filter({ hasText: /onboarding knowledge base/i }).first();
  await knowledgeCard.getByRole("button", { name: /Practice this later|Build proof for this/ }).click();
  await page.waitForURL(/\/role-sprint\?id=/);
  const appliedState = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  const preservedApplication = appliedState.applications.find((item) => item.id === firstApplicationId);
  verify(preservedApplication?.status === "applied", "starting more practice does not downgrade an applied job");
  verify(preservedApplication?.applicationQuestions[0]?.draftAnswer.includes("customer problem solving"), "Role Sprint auto-save preserves an edited application answer");

  await page.goto(`${baseUrl}/applications`);
  acmeCard = page.locator("article").filter({ hasText: /Acme Software/i }).first();
  await acmeCard.locator("select").selectOption("offer");
  await page.goto(baseUrl);
  await page.getByRole("heading", { name: /Review your offer from Acme Software/i }).waitFor();
  verify(await page.getByRole("link", { name: "Open offer →" }).isVisible(), "Today prioritizes an offer over an unfinished sprint");

  await page.goto(`${baseUrl}/tailor?applicationId=${firstApplicationId}`);
  const postingBox = page.getByLabel("Paste the full job posting");
  await postingBox.waitFor();
  await postingBox.evaluate((element, value) => {
    const view = element.ownerDocument.defaultView;
    const setter = Object.getOwnPropertyDescriptor(view.HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(element, value);
    element.dispatchEvent(new view.InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: value }));
  }, secondJobPost);
  await page.getByText("Add application details", { exact: true }).click();
  await page.getByText("Company", { exact: true }).locator("..").getByRole("textbox").fill("Beta Software");
  await page.getByRole("button", { name: "Analyze this job →" }).click();
  await page.getByRole("button", { name: "Start one Role Sprint →" }).click();
  await page.waitForURL(/\/role-sprint\?id=/);
  const replaced = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  verify(replaced.applications.length === 2, "same-title pasted job creates a separate workspace");
  verify(replaced.applications.some((item) => item.company === "Acme Software" && item.status === "offer") && replaced.applications.some((item) => item.company === "Beta Software"), "new posting does not overwrite the original job or status");

  await page.goto(`${baseUrl}/applications`);
  const originalCard = page.locator("article").filter({ hasText: /Acme Software/i }).first();
  await originalCard.getByRole("button", { name: "Remove" }).click();
  await originalCard.getByRole("button", { name: "Delete job, keep practice" }).click();
  const removedState = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  verify(!removedState.applications.some((item) => item.id === firstApplicationId), "linked job can be removed explicitly");
  verify(removedState.roleSprints.filter((item) => item.company === "Acme Software").every((item) => item.applicationId === null), "keeping practice detaches linked sprints instead of orphaning them");

  await page.getByPlaceholder("Company name").fill("Manual Co");
  await page.getByPlaceholder("Role title").fill("Customer Experience Associate");
  await page.getByRole("button", { name: "Add application" }).click();
  const manualCard = page.locator("article").filter({ hasText: /Manual Co/i }).first();
  await manualCard.getByRole("link", { name: "Add job posting →" }).click();
  await page.waitForURL(/\/tailor\?applicationId=/);
  await page.getByText("Complete this saved application", { exact: false }).waitFor();
  const manualId = new URL(page.url()).searchParams.get("applicationId");
  await page.getByLabel("Paste the full job posting").fill(manualJobPost);
  await page.getByRole("button", { name: "Analyze this job →" }).click();
  await page.getByText("Other actions", { exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  const upgraded = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
  verify(upgraded.applications.filter((item) => item.id === manualId).length === 1, "manual application upgrades in place without duplication");
  verify(upgraded.applications.find((item) => item.id === manualId)?.jobPostUrl.startsWith("career-forge-job-text:v1:"), "manual application receives the pasted job workspace");

  console.log(`\nFinal Role Sprint browser acceptance: ${passes} passed, 0 failed`);
  await context.close();
} finally {
  await browser?.close();
  await stopServer();
}
