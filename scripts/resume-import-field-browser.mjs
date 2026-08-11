import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { generateResumeImportFieldFixtures } from "./lib/resume-import-field-fixtures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = "/tmp/career-forge-pass-03";
const fixtureRoot = path.join(artifactRoot, "fixtures");
const screenshotRoot = path.join(artifactRoot, "screenshots");
const traceRoot = path.join(artifactRoot, "traces");
fs.mkdirSync(screenshotRoot, { recursive: true });
fs.mkdirSync(traceRoot, { recursive: true });
await generateResumeImportFieldFixtures(fixtureRoot);

let passed = 0;
function verify(condition, label, detail = "") {
  if (!condition) throw new Error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  passed += 1;
  console.log(`PASS ${label}`);
}

const port = 3235;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  detached: process.platform !== "win32",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server.exitCode !== null) throw new Error(`Server exited early.\n${serverOutput}`);
    try { if ((await fetch(baseUrl)).ok) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start.\n${serverOutput}`);
}

async function stopServer() {
  if (server.exitCode !== null) return;
  const signal = (name) => {
    try { if (process.platform !== "win32" && server.pid) process.kill(-server.pid, name); else server.kill(name); } catch { /* exited */ }
  };
  signal("SIGTERM");
  await Promise.race([once(server, "exit").catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (server.exitCode === null) signal("SIGKILL");
}

const stateFrom = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1") ?? "null"));
const proposalsFrom = async (page) => (await stateFrom(page)).pendingImportReviews[0]?.proposals ?? [];

let browser;
async function withScenario(name, run) {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const events = { requests: [], errors: [], consoleErrors: [], navigations: [] };
  page.on("request", (request) => events.requests.push(request.url()));
  page.on("pageerror", (error) => events.errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") events.consoleErrors.push(message.text()); });
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) events.navigations.push(frame.url()); });
  try {
    await page.goto(`${baseUrl}/profile`);
    await page.getByLabel("Resume pack files").waitFor();
    await run({ page, context, events });
    verify(events.errors.length === 0, `${name}: no page errors`, JSON.stringify(events.errors));
    verify(events.requests.every((url) => new URL(url).origin === baseUrl || new URL(url).hostname === "va.vercel-scripts.com"), `${name}: no résumé-derived external request`);
    await page.screenshot({ path: path.join(screenshotRoot, `${name}.png`), fullPage: true });
  } finally {
    await context.tracing.stop({ path: path.join(traceRoot, `${name}.zip`) });
    await context.close();
  }
}

async function importFiles(page, files) {
  await page.getByLabel("Resume pack files").setInputFiles(files);
  await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
}

async function approveAll(page, field) {
  const articles = page.locator(`article[data-proposed-field="${field}"]`);
  for (let index = 0; index < await articles.count(); index += 1) {
    const article = articles.nth(index);
    if ((await article.textContent()).includes("proposed")) await article.getByRole("button", { name: /Approve|Choose this value/ }).click();
  }
}

async function saveDecisions(page) {
  const button = page.getByRole("button", { name: /Save decisions and continue later|Finish review/ });
  await button.click();
  await page.getByRole("status").filter({ hasText: /Decisions saved|Import review complete|Import decisions saved/ }).waitFor();
}

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  await withScenario("a-clean-resume", async ({ page }) => {
    await importFiles(page, path.join(fixtureRoot, "clean.txt"));
    let proposals = await proposalsFrom(page);
    verify(["identity.fullName", "identity.email", "identity.phone", "identity.location"].every((field) => proposals.some((item) => item.proposedField === field)), "A: exact identity and contact proposals are visible");
    verify(proposals.filter((item) => item.proposedField === "identity.link").length === 2, "A: LinkedIn and portfolio both survive");
    verify(proposals.some((item) => item.roleCandidate?.employer === "Northstar Software" && item.roleCandidate.startDate === "Jan 2021" && item.roleCandidate.current), "A: current role chronology is exact");
    verify(proposals.some((item) => item.roleCandidate?.employer === "Harbor Health" && item.roleCandidate.endDate === "2020"), "A: ended role chronology is exact");
    verify(proposals.some((item) => item.educationCandidate?.institution === "Lakeview University" && item.educationCandidate?.credential === "BS" && item.educationCandidate?.field === "Information Systems") && proposals.some((item) => item.projectCandidate?.name === "Skills Matrix") && proposals.some((item) => item.proposedField === "skill"), "A: education project and skills survive");
    verify(!proposals.some((item) => item.proposedField === "structure"), "A: headings do not appear as reviewable evidence");
    for (const field of ["identity.fullName", "identity.email", "identity.phone", "identity.location", "identity.link"]) await approveAll(page, field);
    await saveDecisions(page);
    let state = await stateFrom(page);
    verify(state.dossier.identity.fullName === "Morgan Lee" && state.dossier.identity.phone === "(312) 555-0142" && state.dossier.identity.links.length === 2, "A: explicitly confirmed identity enters the dossier");
    verify(state.dossier.roles.length === 2 && state.dossier.projects.length === 1 && state.dossier.education.length === 1, "A: clean structured records enter the dossier", JSON.stringify({ roles: state.dossier.roles, projects: state.dossier.projects, education: state.dossier.education, pending: state.pendingImportReviews }));
    await page.reload();
    state = await stateFrom(page);
    verify(state.dossier.roles.length === 2 && state.dossier.identity.email === "morgan.lee@example.com", "A: clean result survives reload");

    const downloadReady = page.waitForEvent("download");
    await page.goto(`${baseUrl}/settings`);
    await page.getByRole("button", { name: "Download backup" }).click();
    const downloaded = await downloadReady;
    const backupPath = await downloaded.path();
    await page.getByRole("button", { name: "Clear local data…" }).click();
    await page.getByRole("button", { name: "Yes, clear all local Career Forge data" }).click();
    verify((await stateFrom(page)).dossier.roles.length === 0, "A: UI clear removes the working copy before restore");
    await page.getByLabel("Restore backup file").setInputFiles(backupPath);
    await page.getByRole("button", { name: "Replace current data with this backup" }).click();
    await page.getByText(/Backup restored at/).waitFor();
    state = await stateFrom(page);
    verify(state.dossier.roles.length === 2 && state.dossier.identity.links.length === 2, "A: UI backup restore returns the same structured state");
    const backupText = fs.readFileSync(backupPath, "utf8");
    verify(!/%PDF-|data:application\/pdf|blob:|PK\u0003\u0004/.test(backupText), "A: backup contains no raw résumé bytes or Blob URL");
  });

  await withScenario("b-audited-employer-as-phone", async ({ page }) => {
    await importFiles(page, path.join(fixtureRoot, "noisy.txt"));
    const proposals = await proposalsFrom(page);
    const audited = proposals.filter((item) => item.sourceExcerpts.includes("Northstar Software / Support Lead / 2021-2024"));
    verify(audited.length === 1 && audited[0].proposedField === "role" && audited[0].validation === "conflicting", "B: audited blob is a visible chronology conflict, never identity");
    verify(proposals.some((item) => item.proposedField === "identity.phone" && item.candidateValue === "(312) 555-0142"), "B: genuine phone remains a phone candidate");
    await approveAll(page, "identity.phone");
    await saveDecisions(page);
    const state = await stateFrom(page);
    verify(state.dossier.identity.phone === "(312) 555-0142" && !JSON.stringify(state.dossier.identity).includes("Northstar Software"), "B: corrupted phone never enters durable identity");
    verify(state.dossier.roles.every((role) => role.employer !== "Northstar Software"), "B: unresolved role conflict does not silently enter history");
    verify((await page.getByText(/not ready/i).count()) > 0 || state.dossier.roles.length + state.dossier.projects.length > 0, "B: readiness is based on confirmed structure, not the save action");
  });

  await withScenario("c-contact-conflicts", async ({ page }) => {
    await importFiles(page, [path.join(fixtureRoot, "contact-a.txt"), path.join(fixtureRoot, "contact-b.txt")]);
    let proposals = await proposalsFrom(page);
    verify(["identity.email", "identity.phone", "identity.location"].every((field) => proposals.filter((item) => item.proposedField === field).length === 2 && proposals.filter((item) => item.proposedField === field).every((item) => item.validation === "conflicting")), "C: differing contact values form visible conflicts");
    verify(proposals.filter((item) => item.proposedField === "identity.link").length === 1 && proposals.find((item) => item.proposedField === "identity.link").occurrenceCount === 2, "C: normalized duplicate LinkedIn collapses with support count");
    await page.locator('article[data-proposed-field="identity.email"]').first().getByRole("button", { name: "Choose this value" }).click();
    await page.reload();
    proposals = await proposalsFrom(page);
    verify(proposals.filter((item) => item.proposedField === "identity.email" && item.status === "approved").length === 1 && proposals.filter((item) => item.proposedField === "identity.email" && item.status === "rejected").length === 1, "C: visible conflict resolution survives reload");
    await saveDecisions(page);
    verify((await stateFrom(page)).dossier.identity.email === "morgan.lee@example.com", "C: only the chosen email becomes durable");
  });

  await withScenario("d-chronology-conflicts", async ({ page }) => {
    await importFiles(page, path.join(fixtureRoot, "chronology.txt"));
    let proposals = await proposalsFrom(page);
    const conflicts = proposals.filter((item) => item.conflictGroup?.startsWith("conflict-role-"));
    verify(conflicts.length === 2 && conflicts.every((item) => item.sourceFilenames.includes("chronology.txt")), "D: conflicting role dates identify both source values and filename");
    verify(proposals.filter((item) => ["Northstar Software", "Harbor Health"].includes(item.roleCandidate?.employer)).every((item) => !item.conflictGroup), "D: concurrent roles remain nonconflicting");
    await page.locator('article[data-proposed-field="role"]').filter({ has: page.locator('input[value="Advisor · Civic Lab · 2019-2021"]') }).getByRole("button", { name: "Choose this value" }).click();
    await saveDecisions(page);
    const state = await stateFrom(page);
    verify(state.dossier.roles.some((role) => role.employer === "Civic Lab" && role.startDate === "2019") && !state.dossier.roles.some((role) => role.employer === "Civic Lab" && role.startDate === "2018"), "D: chosen chronology persists without silent winner selection");
  });

  await withScenario("e-malformed-structure", async ({ page }) => {
    await importFiles(page, path.join(fixtureRoot, "malformedStructure.txt"));
    const proposals = await proposalsFrom(page);
    verify(proposals.some((item) => item.roleCandidate?.employer === "Education Works"), "E: Education Works remains an employer");
    verify(proposals.some((item) => item.projectCandidate?.name === "Skills Matrix"), "E: Skills Matrix remains a project");
    verify(!proposals.some((item) => /MORGAN LEE.*RESUME|2 \/ 2/.test(item.candidateValue)), "E: repeated page furniture is absent from review");
    await saveDecisions(page);
    const state = await stateFrom(page);
    verify(state.dossier.roles.length === 2 && state.dossier.projects.length === 1, "E: meaningful malformed-section content remains structured");
  });

  await withScenario("f-no-formal-employment", async ({ page }) => {
    await importFiles(page, path.join(fixtureRoot, "noFormalEmployment.txt"));
    let proposals = await proposalsFrom(page);
    verify(proposals.some((item) => item.projectCandidate?.name === "Community Garden Volunteer") && proposals.some((item) => item.educationCandidate?.institution === "City College"), "F: volunteer project and education survive");
    for (const text of ["Coordinated weekly volunteer schedules.", "Organized neighborhood planting events."]) {
      await page.locator("article").filter({ has: page.locator(`input[value="${text}"]`) }).getByRole("button", { name: "Approve" }).click();
    }
    await saveDecisions(page);
    const state = await stateFrom(page);
    verify(state.dossier.roles.length === 0 && state.dossier.projects.length === 1, "F: user is not forced to invent formal employment");
    verify((await page.getByText("A credible foundation is forming").count()) === 1, "F: explicitly supported project experience gets truthful foundation messaging");
  });

  const parity = [];
  for (const [format, file] of [["txt", "clean.txt"], ["docx", "clean.docx"], ["pdf", "clean.pdf"]]) {
    await withScenario(`g-format-${format}`, async ({ page }) => {
      await importFiles(page, path.join(fixtureRoot, file));
      const proposals = await proposalsFrom(page);
      const signature = {
        contacts: proposals.filter((item) => item.group === "identity").map((item) => `${item.proposedField}:${item.candidateValue}`).sort(),
        roles: proposals.filter((item) => item.roleCandidate).map((item) => `${item.roleCandidate.title}|${item.roleCandidate.employer}|${item.roleCandidate.startDate}|${item.roleCandidate.endDate}|${item.roleCandidate.current}`).sort(),
        education: proposals.filter((item) => item.educationCandidate).map((item) => `${item.educationCandidate.institution}|${item.educationCandidate.credential}|${item.educationCandidate.field}|${item.educationCandidate.dates}`),
        projects: proposals.filter((item) => item.projectCandidate).map((item) => `${item.projectCandidate.name}|${item.projectCandidate.dates}`),
        skills: proposals.filter((item) => item.proposedField === "skill").map((item) => item.candidateValue)
      };
      parity.push([format, signature]);
      verify(signature.contacts.length === 6 && signature.roles.length === 2 && signature.education.length === 1 && signature.projects.length === 1 && signature.skills.length === 1, `G: ${format.toUpperCase()} reaches all critical field types`, JSON.stringify(signature));
    });
  }
  verify(new Set(parity.map(([, value]) => JSON.stringify(value))).size === 1, "G: PDF DOCX and TXT produce equivalent structured results", JSON.stringify(parity));

  await withScenario("h-interruption-recovery", async ({ page }) => {
    await importFiles(page, path.join(fixtureRoot, "noisy.txt"));
    await approveAll(page, "identity.phone");
    await page.reload();
    let proposals = await proposalsFrom(page);
    verify(proposals.find((item) => item.proposedField === "identity.phone")?.status === "approved" && proposals.some((item) => item.validation === "conflicting" && item.status === "proposed"), "H: partial decisions and unresolved conflicts survive reload");
    await saveDecisions(page);
    await page.goto(`${baseUrl}/dashboard`);
    await page.goto(`${baseUrl}/profile`);
    proposals = await proposalsFrom(page);
    verify(proposals.some((item) => item.validation === "conflicting" && item.status === "proposed"), "H: unresolved conflict survives save navigation and return");
    const state = await stateFrom(page);
    verify(state.dossier.identity.phone === "(312) 555-0142" && !JSON.stringify(state.dossier.identity).includes("Northstar Software"), "H: interruption never autoapproves the audited corruption");
  });

  console.log(`\n${passed} browser import-field checks passed; 0 failed.`);
} finally {
  await browser?.close();
  await stopServer();
}
