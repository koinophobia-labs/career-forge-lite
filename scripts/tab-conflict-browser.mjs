// Two-real-tab conflict acceptance: verifies that edits to UNRELATED fields
// from different tabs merge automatically, that SAME-FIELD edits from
// different stored revisions open an explicit keep-mine / keep-stored / merge
// dialog instead of silently last-write-winning, and that a refresh recovers
// cleanly. Runs against a real dev server with two Playwright pages sharing
// one browser context (same origin, real storage events).
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");
const moduleCache = new Map();
function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
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

// --- Seed: a real dossier + forged pack, exactly what the product generates ---
const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { mergeIntakeIntoDossier } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));

const NOW = new Date().toISOString();
const intake = { ...initialIntake, fullName: "Riley Example", email: "riley@example.com", phone: "555-0100", website: "", targetJobTitle: "Product Support Specialist", currentTitle: "Retail Associate", currentCompany: "ShopCo", currentTime: "2022–Present", tools: "Zendesk, Excel", responsibilities: "Resolved customer questions\nDocumented escalations", outcomes: "Improved handoff clarity for the support team", customersServed: "40+ customers per shift", education: "Associate degree" };
const dossier = mergeIntakeIntoDossier(emptyState().dossier, intake, "guided", true, "guided source", NOW);
const lanes = [{ id: "lane-0", title: "Product Support", status: "active", whyFit: "Verified fit", resumeAngle: "Angle", proof: [], gaps: [], keywords: ["Zendesk"], source: "custom", createdAt: NOW }];
const pack = generateResumePack(dossier, lanes, NOW);
const seedState = JSON.stringify({ ...emptyState(), dossier, lanes, resumePacks: [pack] });

let passes = 0;
const verify = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  passes += 1;
  console.log(`PASS ${message}`);
};

const port = 3221;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "off" }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });
async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server.exitCode !== null) throw new Error(`Server exited early.\n${output}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch { /* not accepting connections yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start.\n${output}`);
}

const summaryField = (page) => page.locator("label:has-text('Summary') textarea").first();
const educationField = (page) => page.locator("label:has-text('Education') textarea").first();
const storedSummary = (page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumePacks[0].variants[0].resume.summary
);
const storedEducation = (page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumePacks[0].variants[0].resume.education
);

async function openFirstEditor(page) {
  await page.goto(`${baseUrl}/versions`);
  await page.getByRole("heading", { name: /Your Résumé Pack/ }).waitFor();
  await page.getByRole("button", { name: "View / edit" }).first().click();
  await summaryField(page).waitFor();
}

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const tab1 = await context.newPage();
  const tab2 = await context.newPage();

  await tab1.goto(baseUrl);
  await tab1.evaluate((state) => { localStorage.clear(); localStorage.setItem("career-forge-command-center-v1", state); }, seedState);

  await openFirstEditor(tab1);
  await openFirstEditor(tab2);
  const originalSummary = await storedSummary(tab1);

  // --- 1. Unrelated fields from two tabs merge automatically -----------------
  await summaryField(tab1).fill(`${originalSummary} Tab-one summary sentence.`);
  await summaryField(tab1).blur();
  await tab1.waitForFunction((expected) =>
    JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumePacks[0].variants[0].resume.summary.includes(expected), "Tab-one summary sentence.");
  // Tab 2's editor is stale (it opened before tab 1's edit) — editing a
  // DIFFERENT field must not clobber tab 1's summary edit.
  await educationField(tab2).fill("Associate degree — Community College | 2020");
  await educationField(tab2).blur();
  await tab2.waitForFunction(() =>
    JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumePacks[0].variants[0].resume.education.includes("Community College"));
  verify((await storedSummary(tab2)).includes("Tab-one summary sentence."), "unrelated-field edits from two tabs merge automatically (tab 1 summary survived tab 2 education commit)");
  verify((await storedEducation(tab1)).includes("Community College"), "tab 2 education edit persisted");

  // --- 2. Same-field conflict opens the explicit dialog ----------------------
  // Tab 1 starts editing the summary (focus captures its base), then tab 2
  // commits a different summary first.
  await tab1.reload(); await openFirstEditor(tab1);
  await tab2.reload(); await openFirstEditor(tab2);
  await summaryField(tab1).focus();
  await summaryField(tab2).fill("TAB TWO wrote this summary first.");
  await summaryField(tab2).blur();
  await tab2.waitForFunction(() =>
    JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumePacks[0].variants[0].resume.summary.includes("TAB TWO"));
  await summaryField(tab1).fill("TAB ONE wrote this competing summary.");
  await summaryField(tab1).blur();
  const dialog = tab1.getByTestId("edit-conflict-dialog");
  await dialog.waitFor();
  verify(true, "same-field edit from a stale revision opens the conflict dialog instead of committing");
  verify((await tab1.getByTestId("conflict-mine").textContent()).includes("TAB ONE"), "dialog shows this tab's edit");
  verify((await tab1.getByTestId("conflict-stored").textContent()).includes("TAB TWO"), "dialog shows the newer stored edit");
  verify((await storedSummary(tab1)).includes("TAB TWO"), "nothing was overwritten while the dialog is open (stored value intact)");

  // --- 3. Keep stored version -------------------------------------------------
  await tab1.getByTestId("conflict-keep-stored").click();
  await dialog.waitFor({ state: "detached" });
  verify((await storedSummary(tab1)).includes("TAB TWO"), "Keep stored version leaves the newer edit in place");
  verify((await summaryField(tab1).inputValue()).includes("TAB TWO"), "editor field refreshes to the stored value after Keep stored");

  // --- 4. Keep mine -----------------------------------------------------------
  await summaryField(tab1).focus();
  await summaryField(tab2).fill("TAB TWO second competing summary.");
  await summaryField(tab2).blur();
  await tab2.waitForFunction(() =>
    JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumePacks[0].variants[0].resume.summary.includes("second competing"));
  await summaryField(tab1).fill("TAB ONE insists on this version.");
  await summaryField(tab1).blur();
  await dialog.waitFor();
  await tab1.getByTestId("conflict-keep-mine").click();
  await dialog.waitFor({ state: "detached" });
  await tab1.waitForFunction(() =>
    JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumePacks[0].variants[0].resume.summary.includes("insists"));
  verify((await storedSummary(tab1)).includes("TAB ONE insists"), "Keep mine commits this tab's edit explicitly");

  // --- 5. Manual merge --------------------------------------------------------
  // Tab 2 is itself stale after tab 1's "Keep mine" — reload it so its next
  // edit starts from the current revision (its own conflict handling was
  // verified above).
  await tab2.reload(); await openFirstEditor(tab2);
  await summaryField(tab1).focus();
  await summaryField(tab2).fill("TAB TWO adds churn-reduction detail.");
  await summaryField(tab2).blur();
  await tab2.waitForFunction(() =>
    JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumePacks[0].variants[0].resume.summary.includes("churn-reduction"));
  await summaryField(tab1).fill("TAB ONE adds tenure detail.");
  await summaryField(tab1).blur();
  await dialog.waitFor();
  await tab1.getByTestId("conflict-merge-input").fill("Merged: tenure detail plus churn-reduction detail.");
  await tab1.getByTestId("conflict-save-merge").click();
  await dialog.waitFor({ state: "detached" });
  await tab1.waitForFunction(() =>
    JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumePacks[0].variants[0].resume.summary.startsWith("Merged:"));
  verify((await storedSummary(tab1)).startsWith("Merged:"), "manual merge commits the user-authored combination");

  // --- 6. Refresh recovery ----------------------------------------------------
  await tab2.reload(); await openFirstEditor(tab2);
  await summaryField(tab1).focus();
  await summaryField(tab2).fill("TAB TWO post-merge follow-up summary.");
  await summaryField(tab2).blur();
  await tab2.waitForFunction(() =>
    JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumePacks[0].variants[0].resume.summary.includes("post-merge"));
  await summaryField(tab1).fill("TAB ONE about to be interrupted.");
  await summaryField(tab1).blur();
  await dialog.waitFor();
  await tab1.reload();
  await openFirstEditor(tab1);
  verify((await tab1.getByTestId("edit-conflict-dialog").count()) === 0, "refresh mid-conflict recovers with no dialog and no corruption");
  verify((await storedSummary(tab1)).includes("post-merge"), "stored value survives a refresh mid-conflict (nothing silently committed)");
  verify((await summaryField(tab1).inputValue()).includes("post-merge"), "reloaded editor shows the latest stored value");

  console.log(`\n${passes} passed, 0 failed`);
} finally {
  await browser?.close();
  server.kill();
}
