import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chromium } from "playwright";

const root = process.cwd();
const port = 3242;
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = process.env.STORY_ARTIFACT_DIR || "/tmp/career-forge-closure-pass-04";
fs.mkdirSync(artifactDir, { recursive: true });
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });
async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 90_000) {
    if (server.exitCode !== null) throw new Error(`Server exited early.\n${serverOutput}`);
    try { if ((await fetch(`${baseUrl}/story`)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not start.\n${serverOutput}`);
}
async function stopServer() {
  if (server.exitCode !== null) return;
  try { process.kill(process.platform === "win32" ? server.pid : -server.pid, "SIGTERM"); } catch { /* already stopped */ }
  await Promise.race([once(server, "exit").catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5000))]);
}

let passed = 0;
let failed = 0;
function verify(condition, label, detail = "") {
  if (condition) { passed += 1; console.log(`PASS ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
const fixtures = {
  cafe: "I worked at a neighborhood café for a few years, but I am not sure of the exact start month. I handled customers and trained newer workers. I do not know any numerical metrics. I built a volunteer spreadsheet project to organize community donations. After leaving the café, I took time away during a career transition. I am now moving toward product operations.",
  chronology: "I worked at Northstar as an operations assistant around 2021 and left in late 2022. I was there two or three years and do not remember the exact months. I am currently building a personal inventory app.",
  noMetrics: "My phone is 312-555-0142. I worked at Beacon as a coordinator from 2021 to 2024. I handled customer calls and prepared reports. We did not track numbers and I cannot quantify the result.",
  volunteers: "I built a volunteer spreadsheet project using Google Sheets for a food pantry around 2022. I created a community event coordination project using Trello in late 2023. Both were unpaid.",
  gap: "I worked at Harbor Shop as a sales associate from 2019 to 2021. I took time away after the store closed. During that gap I built a portfolio website project. I returned to job searching and want to move into support operations.",
  conflict: "I worked at Atlas as a service associate starting in 2020. Later I remembered it may have been 2021. I handled customer questions. I am not sure whether my title was lead or supervisor.",
  sparse: "I worked at Corner Shop as a helper for a short time. I stocked shelves. I do not know any metrics.",
  aspiration: "I worked at HelpCo as a customer service representative from 2022 to 2024. I want to move into product operations and want to learn SQL and analytics.",
  omission: "I worked at Private Studio as an assistant in 2022 and organized client files.",
  downstream: "My name is Jamie Rivera and my email is jamie@example.com. I worked at Beacon as a support coordinator from 2021 to 2024. I handled customer calls and prepared weekly reports. I handled 40 customer calls per week. I used Excel and Zendesk. I completed a service operations certificate. I want to move into customer success."
};

async function scenario(browser, name, raw, run) {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const externalRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("request", (request) => { if (!request.url().startsWith(baseUrl)) externalRequests.push(request.url()); });
  await page.goto(`${baseUrl}/story`);
  await page.getByLabel("Describe the work in plain language").fill(raw);
  await page.getByRole("button", { name: "Turn my story into facts to review" }).click();
  await page.getByRole("region", { name: "Story fact ledger" }).waitFor();
  await run(page);
  await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true });
  verify(pageErrors.length === 0, `${name}: no page errors`, pageErrors.join(" | "));
  verify(consoleErrors.filter((item) => !/Download the React DevTools/i.test(item)).length === 0, `${name}: no console errors`, consoleErrors.join(" | "));
  verify(externalRequests.every((url) => /vercel-insights|vercel-scripts|localhost/.test(url)), `${name}: no story-derived external request`, externalRequests.join(" | "));
  await context.tracing.stop({ path: path.join(artifactDir, `${name}.trace.zip`) });
  await context.close();
}

const readState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1") ?? "null"));

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  await scenario(browser, "a-audited-cafe", fixtures.cafe, async (page) => {
    const text = await page.locator("main").innerText();
    verify(text.includes("Neighborhood Café"), "A: café employer remains the café name");
    verify(!text.includes("A Neighborhood Café For A Few Years"), "A: uncertainty is not in the employer");
    verify(text.includes("volunteer spreadsheet project"), "A: volunteer spreadsheet project is visible");
    verify(/career-gap/i.test(text) && /career-transition/i.test(text), "A: gap and transition are visible context");
    verify(!text.includes("Community Organizer at"), "A: target direction is not historical experience");
    verify(await page.locator('[data-story-fact="metric"]').filter({ hasText: "not-applicable" }).count() >= 1, "A: explicit absence of metrics is visible");
    await page.getByRole("button", { name: "Confirm safe facts and save review" }).click();
    await page.goto(`${baseUrl}/profile`);
    const state = await readState(page);
    verify(state.dossier.roles.length === 1 && state.dossier.roles[0].employer === "Neighborhood Café" && state.dossier.roles[0].title === "", "A: saved role has no invented title");
    verify(state.dossier.projects.length === 1 && state.dossier.projects[0].volunteer === true, "A: project is first-class in the dossier");
    verify(state.dossier.metrics.length === 0, "A: no metric is generated");
    verify(state.dossier.identity.fullName === "" && state.dossier.education.length === 0, "A: no identity or education placeholder");
    verify(new Set(state.dossier.roles[0].responsibilities.map((item) => item.toLowerCase())).size === 2, "A: responsibilities are distinct, not padded");
    await page.reload();
    verify((await readState(page)).dossier.storyFacts.length > 0, "A: fact ledger survives reload");
    await page.goto(`${baseUrl}/settings`);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download backup" }).click();
    const download = await downloadPromise;
    const backupPath = await download.path();
    await page.getByRole("button", { name: "Clear local data…" }).click();
    await page.getByRole("button", { name: "Yes, clear all local Career Forge data" }).click();
    await page.getByLabel("Restore backup file").setInputFiles(backupPath);
    await page.getByRole("button", { name: "Replace current data with this backup" }).click();
    await page.getByText(/Backup restored/i).waitFor();
    verify((await readState(page)).dossier.projects[0].volunteer === true, "A: project and ledger survive UI backup restore");
  });

  await scenario(browser, "b-approximate-chronology", fixtures.chronology, async (page) => {
    const dates = page.locator('[data-story-fact="role-date"]');
    verify(await dates.filter({ hasText: "approximate" }).count() >= 2, "B: approximate dates are visible");
    verify(await dates.filter({ hasText: "unknown" }).count() >= 1, "B: unknown month is visible");
    const around = dates.filter({ hasText: "around 2021" }).first();
    await around.getByLabel("Correct role-date fact").fill("2021");
    await page.getByRole("button", { name: "Confirm safe facts and save review" }).click();
    await page.reload();
    await page.getByRole("region", { name: "Story fact ledger" }).waitFor();
    verify(await page.locator('[data-story-fact="role-date"]').filter({ hasText: "user-corrected" }).count() >= 1, "B: corrected date persists");
    verify(await page.locator('[data-story-fact="role-date"]').filter({ hasText: "approximate" }).count() >= 1, "B: other uncertainty remains");
  });

  await scenario(browser, "c-no-metrics", fixtures.noMetrics, async (page) => {
    verify(await page.locator('[data-story-fact="metric"]').filter({ hasText: "not-applicable" }).count() >= 1, "C: no-metrics fact is not applicable");
    await page.getByRole("button", { name: "Confirm safe facts and save review" }).click();
    await page.goto(`${baseUrl}/profile`);
    const state = await readState(page);
    verify(state.dossier.metrics.length === 0, "C: dates and phone do not create metrics");
    verify(state.dossier.roles[0].responsibilities.length === 2, "C: qualitative responsibilities remain usable");
  });

  await scenario(browser, "d-volunteer-projects", fixtures.volunteers, async (page) => {
    const projects = page.locator('[data-story-fact="project"]');
    verify(await projects.count() === 2, "D: two distinct project facts are visible");
    await projects.nth(1).getByRole("button", { name: "Reject" }).click();
    await page.getByRole("button", { name: "Confirm safe facts and save review" }).click();
    await page.goto(`${baseUrl}/profile`);
    verify((await readState(page)).dossier.projects.length === 1, "D: only approved project enters dossier");
    await page.reload();
    verify((await readState(page)).dossier.storyFacts.some((item) => item.disposition === "user-rejected"), "D: project rejection persists");
  });

  await scenario(browser, "e-career-gap-project", fixtures.gap, async (page) => {
    const gap = page.locator('[data-story-fact="career-gap"]').first();
    verify(await gap.count() === 1, "E: gap is visible as context");
    await gap.getByRole("button", { name: "Omit intentionally" }).click();
    await page.getByRole("button", { name: "Confirm safe facts and save review" }).click();
    const state = await readState(page);
    verify(!state.dossier.roles.some((item) => /gap|time away/i.test(`${item.title} ${item.employer}`)), "E: gap is not a role");
    verify(state.dossier.projects.some((item) => /portfolio website project/i.test(item.name)), "E: project during gap survives");
    verify(state.dossier.storyFacts.some((item) => item.category === "career-gap" && item.disposition === "intentionally-omitted"), "E: gap omission stays visible");
  });

  await scenario(browser, "f-conflicting-memory", fixtures.conflict, async (page) => {
    const conflicts = page.locator('[data-story-fact="role-date"]').filter({ hasText: "conflicting" });
    verify(await conflicts.count() >= 2, "F: date conflict is visible without a winner");
    await page.getByRole("button", { name: "Confirm safe facts and save review" }).click();
    await page.reload();
    verify(await page.locator('[data-story-fact="role-date"]').filter({ hasText: "conflicting" }).count() >= 2, "F: unresolved conflict persists");
    const first = page.locator('[data-story-fact="role-date"]').first();
    await first.getByLabel("Correct role-date fact").fill("2020-01");
    const second = page.locator('[data-story-fact="role-date"]').nth(1);
    await second.getByRole("button", { name: "Reject" }).click();
    await page.getByRole("button", { name: "Confirm safe facts and save review" }).click();
    verify((await readState(page)).dossier.roles[0].startDate === "2020-01", "F: explicit resolution updates chronology");
  });

  await scenario(browser, "g-sparse-story", fixtures.sparse, async (page) => {
    verify((await page.locator('[data-story-fact="responsibility"]').count()) === 1, "G: one responsibility remains one fact");
    await page.getByRole("button", { name: "Confirm safe facts and save review" }).click();
    verify(await page.getByText(/Story saved does not mean application-ready/).isVisible(), "G: sparse story is not called application-ready");
    verify((await readState(page)).dossier.projects.length === 0, "G: no placeholder project or education");
  });

  await scenario(browser, "h-aspiration-separation", fixtures.aspiration, async (page) => {
    verify(await page.locator('[data-story-fact="aspiration"]').count() >= 1, "H: future direction is aspiration");
    verify(!(await page.locator('[data-story-fact="title"]').allTextContents()).some((text) => /product operations/i.test(text)), "H: desired title is not historical");
    verify(!(await page.locator('[data-story-fact="skill"]').allTextContents()).some((text) => /SQL|analytics/i.test(text)), "H: desired skills are not current skills");
  });

  await scenario(browser, "i-explicit-omission", fixtures.omission, async (page) => {
    const responsibility = page.locator('[data-story-fact="responsibility"]').first();
    await responsibility.getByRole("button", { name: "Omit intentionally" }).click();
    await page.getByRole("button", { name: "Confirm safe facts and save review" }).click();
    let state = await readState(page);
    verify(state.dossier.roles[0].responsibilities.length === 0, "I: omitted fact does not enter role material");
    verify(state.dossier.storyFacts.some((item) => item.disposition === "intentionally-omitted"), "I: omission is visible in ledger");
    await page.reload();
    state = await readState(page);
    verify(state.dossier.storyFacts.some((item) => item.disposition === "intentionally-omitted"), "I: omission survives reload");
  });

  await scenario(browser, "j-downstream-truth", fixtures.downstream, async (page) => {
    await page.getByRole("button", { name: "Confirm safe facts and save review" }).click();
    await page.goto(`${baseUrl}/targets`);
    await page.locator('[data-testid="adopt-lane"]:not(:disabled)').first().click();
    await page.getByRole("button", { name: /Forge complete résumé pack/ }).click();
    await page.waitForURL(`${baseUrl}/versions`);
    verify(await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).isVisible(), "J: reviewed story can generate traced downstream material");
    const before = await readState(page);
    verify(before.resumePacks[0].variants.every((variant) => variant.evidenceReferences.every((reference) => Object.keys(reference.evidenceRevisions ?? {}).length > 0)), "J: generated claims carry evidence revisions");
    await page.goto(`${baseUrl}/profile`);
    await page.getByText(/Story responsibility: handled customer calls/i).first().click();
    const editor = page.getByLabel(/Edit evidence Story responsibility/).first();
    await editor.fill("Handled priority customer calls");
    await editor.press("Tab");
    await page.waitForTimeout(300);
    const after = await readState(page);
    verify(after.resumePacks[0].status === "out-of-date", "J: editing story evidence invalidates downstream pack");
    verify(!after.dossier.approvedClaims.includes("Handled Customer Calls"), "J: obsolete wording is no longer approved");
  });

  console.log(`\n${passed} story browser checks passed; ${failed} failed.`);
  if (failed) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await stopServer();
}
