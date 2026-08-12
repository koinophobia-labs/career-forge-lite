import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const root = process.cwd();
const port = 3247;
const baseUrl = `http://127.0.0.1:${port}`;
const artifactDir = process.env.ROLE_DISTINCTNESS_ARTIFACT_DIR || "/tmp/career-forge-closure-pass-05";
fs.mkdirSync(artifactDir, { recursive: true });
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, detached: process.platform !== "win32", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "off" }, stdio: ["ignore", "pipe", "pipe"] });
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });
async function waitForServer() {
  const start = Date.now();
  while (Date.now() - start < 90_000) {
    if (server.exitCode !== null) throw new Error(`Server exited early.\n${serverOutput}`);
    try { if ((await fetch(`${baseUrl}/profile`)).ok) return; } catch { /* retry */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start.\n${serverOutput}`);
}
async function stopServer() {
  if (server.exitCode !== null) return;
  try { process.kill(process.platform === "win32" ? server.pid : -server.pid, "SIGTERM"); } catch { /* already stopped */ }
  await Promise.race([once(server, "exit").catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5000))]);
}

let passed = 0; let failed = 0;
function verify(condition, label, detail = "") {
  if (condition) { passed += 1; console.log(`PASS ${label}`); }
  else { failed += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}
async function addRole(page, responsibilities) {
  await page.goto(`${baseUrl}/profile`);
  await page.getByRole("textbox", { name: "Role title", exact: true }).fill("Customer Operations Associate");
  await page.getByRole("textbox", { name: "Employer", exact: true }).fill("Northstar Software");
  await page.getByRole("textbox", { name: "Dates", exact: true }).fill("2021–2025");
  await page.getByRole("textbox", { name: "Responsibilities", exact: true }).fill(responsibilities.join("\n"));
  await page.getByRole("button", { name: "Add approved role", exact: true }).click();
}
async function addProject(page, name, description) {
  await page.getByRole("textbox", { name: "Project name", exact: true }).fill(name);
  await page.getByRole("textbox", { name: "Project organization", exact: true }).fill("Independent");
  await page.getByRole("textbox", { name: "Project dates", exact: true }).fill("2024");
  await page.getByRole("textbox", { name: "Project description", exact: true }).fill(description);
  await page.getByRole("button", { name: "Add approved project", exact: true }).click();
}
async function addSkills(page, skills, tools = []) {
  await page.getByRole("button", { name: /Add more supporting evidence/ }).click();
  if (tools.length) {
    await page.getByRole("textbox", { name: "Tools & workflows", exact: true }).fill(tools.join("\n"));
    await page.getByRole("button", { name: "Save tools & workflows", exact: true }).click();
  }
  await page.getByRole("textbox", { name: "Transferable skills", exact: true }).fill(skills.join("\n"));
  await page.getByRole("button", { name: "Save transferable skills", exact: true }).click();
}
function laneCard(page, title, index = 0) {
  return page.locator("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).nth(index);
}
async function adoptAndDescribe(page, title, description) {
  const card = laneCard(page, title).last();
  await card.getByTestId("adopt-lane").click();
  const adopted = laneCard(page, title).first();
  await adopted.getByRole("button", { name: "Details", exact: true }).click();
  await adopted.getByRole("textbox", { name: /Target description/ }).fill(description);
}
async function addCustomLane(page, title, description) {
  await page.getByPlaceholder("Or add a custom lane, e.g. Payments Operations").fill(title);
  await page.getByPlaceholder("Optional target description — requirements, responsibilities, and outcomes").fill(description);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const card = page.locator("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).last();
  await card.getByRole("button", { name: `Make ${title} active`, exact: true }).click();
}
async function forge(page) {
  await page.getByRole("button", { name: "Forge complete résumé pack →", exact: true }).click();
  await page.waitForURL(`${baseUrl}/versions`);
  await page.getByRole("region", { name: "Your Résumé Pack is ready." }).waitFor();
}
async function selectedEvidence(page, title) {
  const card = page.locator("[data-lane-pack]").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  return card.locator("[data-selected-evidence]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-selected-evidence")));
}
async function variantSnapshot(page, laneTitle, style) {
  const card = page.locator("[data-lane-pack]").filter({ has: page.getByRole("heading", { name: laneTitle, exact: true }) });
  const variant = card.locator("article").filter({ hasText: style }).first();
  await variant.getByRole("button", { name: "View / edit", exact: true }).click();
  const skills = (await variant.getByRole("textbox", { name: "Skills", exact: true }).inputValue()).split("\n").filter(Boolean);
  const bulletBoxes = variant.getByLabel(/Edit bullets/);
  const bullets = [];
  for (let i = 0; i < await bulletBoxes.count(); i += 1) bullets.push(...(await bulletBoxes.nth(i).inputValue()).split("\n").filter(Boolean));
  const summary = await variant.getByRole("textbox", { name: "Summary", exact: true }).inputValue();
  const headings = variant.getByLabel(/Edit heading/);
  const projectText = [];
  for (let i = 0; i < await headings.count(); i += 1) projectText.push(await headings.nth(i).inputValue());
  await variant.getByRole("button", { name: "Close", exact: true }).click();
  return { skills, bullets, summary, projectText };
}
async function runScenario(browser, name, task) {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const pageErrors = []; const consoleErrors = []; const external = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("request", (request) => { if (!request.url().startsWith(baseUrl)) external.push(request.url()); });
  await task(page);
  await page.screenshot({ path: path.join(artifactDir, `${name}.png`), fullPage: true });
  verify(pageErrors.length === 0, `${name}: no page errors`, pageErrors.join(" | "));
  verify(consoleErrors.filter((item) => !/React DevTools/i.test(item)).length === 0, `${name}: no console errors`, consoleErrors.join(" | "));
  verify(external.every((url) => /vercel-insights|vercel-scripts/.test(url)), `${name}: no unexpected external requests`, external.join(" | "));
  await context.tracing.stop({ path: path.join(artifactDir, `${name}.trace.zip`) });
  await context.close();
}

const strongResponsibilities = [
  "Triaged customer tickets and routed urgent issues to the right team.",
  "Troubleshot software issues and explained technical workarounds to customers.",
  "Handled issue escalations while keeping customers informed through resolution.",
  "Improved service response consistency by documenting recurring customer issue patterns.",
  "Mapped an internal process and redesigned the workflow to reduce missed handoffs.",
  "Built spreadsheet reporting that tracked operational status and exceptions.",
  "Coordinated a cross-functional launch checklist and project timeline.",
  "Automated a repetitive tracking step and standardized the operating procedure.",
  "Documented customer issue patterns in a shared guide that standardized an internal support workflow.",
  "Coordinated across customer support and operations teams to troubleshoot issues, track handoffs, and communicate next steps."
];
const skills = ["Troubleshooting", "Customer communication", "Ticket triage", "Knowledge-base writing", "Issue escalation", "Process mapping", "Spreadsheet analysis", "Workflow documentation", "Project coordination", "Operational reporting", "Collaboration", "Problem solving"];

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  await runScenario(browser, "a-audited-role-pair", async (page) => {
    await addRole(page, strongResponsibilities);
    await addProject(page, "Customer Troubleshooting Guide", "Created a customer troubleshooting guide and knowledge system from recurring issues.");
    await addProject(page, "Operations Workflow Tracker", "Built an operations workflow tracker and spreadsheet reporting dashboard.");
    await addProject(page, "Cross-team Launch Checklist", "Created a cross-team launch checklist with shared documentation.");
    await addSkills(page, skills, ["Zendesk", "Jira", "Google Sheets", "Excel", "Notion", "Zapier"]);
    await page.goto(`${baseUrl}/targets`);
    await adoptAndDescribe(page, "Product Support Specialist", "Must troubleshoot customer software issues, triage tickets, explain technical resolutions, handle escalations, and maintain knowledge-base documentation.");
    await adoptAndDescribe(page, "Junior Product Ops", "Must improve workflows, map processes, coordinate cross-functional projects, maintain operational trackers, and analyze spreadsheet reporting.");
    await forge(page);
    const decision = page.locator('[data-distinctness-decision="meaningfully-distinct"]');
    verify(await decision.count() === 1, "A: audited pair passes visible role-priority check");
    const supportEvidence = await selectedEvidence(page, "Product Support Specialist");
    const opsEvidence = await selectedEvidence(page, "Junior Product Ops");
    verify(supportEvidence.filter((id) => !opsEvidence.includes(id)).length >= 3, "A: support top evidence has at least three unique IDs");
    verify(opsEvidence.filter((id) => !supportEvidence.includes(id)).length >= 3, "A: operations top evidence has at least three unique IDs");
    const supportAts = await variantSnapshot(page, "Product Support Specialist", "ATS Submission");
    const opsAts = await variantSnapshot(page, "Junior Product Ops", "ATS Submission");
    verify(supportAts.skills.slice(0, 6).filter((item) => !opsAts.skills.slice(0, 6).includes(item)).length >= 2 && supportAts.skills.slice(0, 6).some((item) => /ticket|customer|issue|knowledge|troubleshoot/i.test(item)), "A: support skills visibly lead with support evidence", JSON.stringify(supportAts.skills));
    verify(opsAts.skills.slice(0, 6).filter((item) => !supportAts.skills.slice(0, 6).includes(item)).length >= 2 && opsAts.skills.slice(0, 6).some((item) => /process|spreadsheet|workflow|project|operational/i.test(item)), "A: operations skills visibly lead with operations evidence", JSON.stringify(opsAts.skills));
    verify(supportAts.bullets.slice(0, 4).filter((item) => !opsAts.bullets.slice(0, 4).includes(item)).length >= 2, "A/B: first bullets differ by meaning, not order alone");
    verify(supportAts.summary !== opsAts.summary, "A/B: summaries reflect different selected facts");
    verify(supportAts.projectText.join(" ").includes("Customer Troubleshooting Guide"), "H: support artifact includes support project");
    verify(opsAts.projectText.join(" ").includes("Operations Workflow Tracker"), "H: operations artifact includes operations project");
    await page.reload();
    verify(await page.locator('[data-distinctness-decision="meaningfully-distinct"]').count() === 1, "I: target definitions and receipts survive reload");
    await page.goto(`${baseUrl}/settings`);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download backup", exact: true }).click();
    const backup = await downloadPromise; const backupPath = await backup.path();
    await page.getByRole("button", { name: "Clear local data…", exact: true }).click();
    await page.getByRole("button", { name: "Yes, clear all local Career Forge data", exact: true }).click();
    await page.getByLabel("Restore backup file").setInputFiles(backupPath);
    await page.getByRole("button", { name: "Replace current data with this backup", exact: true }).click();
    await page.getByText(/Backup restored/i).waitFor();
    await page.goto(`${baseUrl}/versions`);
    verify(await page.locator('[data-distinctness-decision="meaningfully-distinct"]').count() === 1, "I: backup restore preserves distinctness receipts");
    await page.goto(`${baseUrl}/profile`);
    const roleDetails = page.locator("details").filter({ hasText: /Customer Operations Associate.*Northstar Software/s }).first();
    await roleDetails.locator("summary").click();
    const roleEditor = roleDetails.getByLabel("Edit role responsibilities", { exact: true });
    await roleEditor.fill(["Corrected: Troubleshot account setup issues and documented only confirmed resolutions.", ...strongResponsibilities.filter((item) => !item.startsWith("Troubleshot software"))].join("\n"));
    await roleDetails.getByRole("button", { name: "Save role", exact: true }).click();
    await page.goto(`${baseUrl}/versions`);
    verify((await page.locator("main").innerText()).includes("evidence review"), "G: editing source evidence visibly blocks stale output");
  });

  await runScenario(browser, "c-sparse-and-aspiration", async (page) => {
    await addRole(page, ["Documented shared team procedures.", "Communicated next steps and collaborated on customer questions.", "Solved routine problems with teammates."]);
    await addSkills(page, ["Communication", "Documentation", "Collaboration"]);
    await page.goto(`${baseUrl}/targets`);
    await addCustomLane(page, "Product Support", "Support customers and document issues. SQL preferred.");
    await addCustomLane(page, "Product Operations", "Coordinate processes and analyze operations. SQL required.");
    await forge(page);
    verify(await page.locator('[data-distinctness-decision="insufficient-evidence-for-distinctness"]').count() === 1, "C: sparse candidate visibly reports limited role distinctness");
    verify(!(await page.locator("main").innerText()).match(/\bSQL\b(?=.*Skills)/s), "F: desired SQL is not presented as a candidate skill");
    const snapshots = [await variantSnapshot(page, "Product Support", "ATS Submission"), await variantSnapshot(page, "Product Operations", "ATS Submission")];
    verify(snapshots.every((snapshot) => !snapshot.skills.some((skill) => /sql/i.test(skill))), "F: aspiration never enters visible skill fields");
    verify(snapshots.every((snapshot) => snapshot.projectText.join("").trim() === "" || !/project/i.test(snapshot.projectText.join(" "))), "C: sparse candidate gains no fake project");
  });

  await runScenario(browser, "d-e-adjacent-description-sensitive", async (page) => {
    await addRole(page, strongResponsibilities);
    await addSkills(page, skills);
    await page.goto(`${baseUrl}/targets`);
    await addCustomLane(page, "Operations Coordinator", "Coordinate customer onboarding, explain setup, deliver training, and manage relationship communication.");
    await addCustomLane(page, "Operations Coordinator", "Analyze spreadsheet reporting, map workflows, track projects, and improve internal handoffs.");
    await forge(page);
    const receipts = page.getByRole("group", { name: /role priority receipt/i });
    verify(await receipts.count() === 2, "E: same-title descriptions persist as two target contracts");
    const idsA = await page.locator("[data-lane-pack]").nth(0).locator("[data-selected-evidence]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-selected-evidence")));
    const idsB = await page.locator("[data-lane-pack]").nth(1).locator("[data-selected-evidence]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-selected-evidence")));
    verify(idsA.join() !== idsB.join(), "E: same title with different descriptions changes evidence priority");
    verify(idsA.some((id) => idsB.includes(id)), "D: adjacent targets retain legitimate shared evidence");
    verify((await page.locator("main").innerText()).includes("description-backed"), "D/E: UI distinguishes description-backed targeting");
  });
} catch (error) {
  failed += 1; console.error(error?.stack ?? error);
} finally {
  if (browser) await browser.close();
  await stopServer();
}

if (failed) {
  console.error(`\nrole distinctness browser: ${passed} passed, ${failed} failed`);
  process.exit(1);
}
console.log(`\nrole distinctness browser: ${passed}/${passed} passed · artifacts ${artifactDir}`);
