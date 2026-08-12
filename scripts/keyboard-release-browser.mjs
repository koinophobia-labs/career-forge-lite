import fs from "node:fs";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 3246;
const baseUrl = `http://127.0.0.1:${port}`;
const evidenceDir = "/tmp/career-forge-pass-06/keyboard";
fs.mkdirSync(evidenceDir, { recursive: true });
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: process.cwd(),
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "off" },
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
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not start.\n${serverOutput}`);
}

let passes = 0;
function check(label, condition) {
  if (!condition) throw new Error(`FAIL ${label}`);
  passes += 1;
  console.log(`PASS ${label}`);
}

async function activeControl(page) {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    const label = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : "";
    const wrappingLabel = element.closest("label")?.textContent;
    const style = getComputedStyle(element);
    return {
      name: (element.getAttribute("aria-label") || label || wrappingLabel || element.getAttribute("placeholder") || element.textContent || "").replace(/\s+/g, " ").trim(),
      tag: element.tagName,
      disabled: "disabled" in element ? Boolean(element.disabled) : false,
      visible: element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0,
      focusVisible: style.outlineStyle !== "none" || style.boxShadow !== "none" || style.borderColor !== "rgba(0, 0, 0, 0)",
      proposalStatus: element.closest("article")?.textContent?.match(/(?:low|medium|high) confidence · [^·]+ · (proposed|approved|rejected)/i)?.[1]?.toLowerCase() ?? null
    };
  });
}

async function tabTo(page, pattern, { reverse = false, limit = 500 } = {}) {
  for (let index = 0; index < limit; index += 1) {
    await page.keyboard.press(reverse ? "Shift+Tab" : "Tab");
    const active = await activeControl(page);
    if (active?.visible && !active.disabled && pattern.test(active.name)) return active;
  }
  throw new Error(`Keyboard could not reach ${pattern} from ${page.url()}`);
}

async function activate(page, pattern, options) {
  const active = await tabTo(page, pattern, options);
  check(`keyboard reaches ${pattern}`, active.focusVisible);
  await page.keyboard.press("Enter");
}

async function approveNextProposed(page) {
  for (let index = 0; index < 700; index += 1) {
    await page.keyboard.press("Tab");
    const active = await activeControl(page);
    if (active?.visible && !active.disabled && active.name === "Approve" && active.proposalStatus === "proposed") {
      await page.keyboard.press("Enter");
      return true;
    }
  }
  return false;
}

async function fillFocused(page, value) {
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type(value);
}

async function activateDownload(page, pattern) {
  const downloadPromise = page.waitForEvent("download");
  await activate(page, pattern);
  return downloadPromise;
}

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${serverOutput}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();

  // A. First run: all primary choices are discoverable; skip navigation works.
  await page.goto(baseUrl);
  const skip = await tabTo(page, /^Skip to content$/);
  check("first-run skip link is keyboard reachable and visibly focused", skip.focusVisible);
  await page.keyboard.press("Enter");
  check("skip link moves focus to main content", (await activeControl(page))?.tag === "MAIN");
  const foundChoices = new Set();
  for (let index = 0; index < 40 && foundChoices.size < 3; index += 1) {
    await page.keyboard.press("Tab");
    const active = await activeControl(page);
    for (const label of ["Get a job", "Build or update my résumé", "Practice for an interview"]) if (active?.name.startsWith(label)) foundChoices.add(label);
  }
  check("all three first-run choices appear in logical keyboard order", foundChoices.size === 3);
  await activate(page, /^Get a job/);
  await page.waitForURL(`${baseUrl}/profile#import`);
  check("keyboard activation reaches the résumé import path", page.url().endsWith("/profile#import"));

  // B. Import: only the OS chooser is automated; every in-app decision uses Tab/Enter.
  const importTextA = "Taylor Morgan\ntaylor.one@example.com\n(312) 555-0144\nChicago, IL\nProduct Support Specialist — Northstar Software | January 2021–Present\nTriaged customer issues, troubleshot account setup, documented recurring fixes, and escalated complex incidents.\nOperations Coordinator — Civic Lab | June 2019–December 2020\nMapped workflows, built spreadsheet reporting, coordinated handoffs, and tracked projects.\nProject: Customer Troubleshooting Guide | 2024\nProject: Operations Workflow Tracker | 2023\nSkills: Ticket triage, Customer communication, Issue escalation, Workflow documentation, Project coordination, Operational reporting, Process mapping, Spreadsheet analysis";
  const importTextB = "Taylor Morgan\ntaylor.two@example.com\n(312) 555-0144\nChicago, IL\nProduct Support Specialist — Northstar Software | January 2021–Present\nDocumented recurring customer issues and support handoffs.";
  await tabTo(page, /^Resume pack files$/);
  await page.locator(":focus").setInputFiles([
    { name: "taylor-primary.txt", mimeType: "text/plain", buffer: Buffer.from(importTextA) },
    { name: "taylor-conflict.txt", mimeType: "text/plain", buffer: Buffer.from(importTextB) }
  ]);
  await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
  const groupCount = await page.getByRole("button", { name: "Approve clear items" }).count();
  for (let index = 0; index < groupCount; index += 1) await activate(page, /^Approve clear items$/);
  const conflictChoiceCount = await page.getByRole("button", { name: "Choose this value" }).count();
  check("import conflict is visible and cannot resolve itself", conflictChoiceCount > 0);
  if (conflictChoiceCount) await activate(page, /^Choose this value$/);
  let pendingProposals = await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).pendingImportReviews[0].proposals.filter((proposal) => proposal.status === "proposed" && !proposal.conflictGroup).length);
  while (pendingProposals > 0) {
    check("keyboard reaches an individually reviewed import fact", await approveNextProposed(page));
    pendingProposals = await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).pendingImportReviews[0].proposals.filter((proposal) => proposal.status === "proposed" && !proposal.conflictGroup).length);
  }
  const finish = page.getByRole("button", { name: /Finish review|Save decisions and continue later/ });
  check("import review exposes a keyboard-operable save decision", await finish.count() > 0);
  await activate(page, /Finish review|Save decisions and continue later/);
  const importStatus = page.getByRole("status").filter({ hasText: /complete:|still need review/ }).last();
  await importStatus.waitFor();
  const importStatusText = await importStatus.innerText();
  check("conflicting import values require an explicit keyboard choice", conflictChoiceCount > 0);
  check("rejected conflict alternative is reported rather than silently merged", /rejected/i.test(importStatusText));

  // C. Story: preserve uncertainty and omission using keyboard decisions.
  await page.goto(`${baseUrl}/story`);
  await tabTo(page, /^Describe the work in plain language/);
  await fillFocused(page, "I helped at Lakeside Café around 2022 for about a year. I served customers and trained new volunteers, but I do not know exact months and I have no metrics. I volunteered on a spreadsheet project for a neighborhood pantry. I had a career gap while caring for family. I hope to move into Product Operations and learn SQL in the future.");
  await activate(page, /^Turn my story into facts to review$/);
  await page.getByRole("region", { name: "Story fact ledger" }).waitFor();
  await activate(page, /^Confirm$/);
  await activate(page, /^Keep approximate$/);
  await activate(page, /^Omit intentionally$/);
  await activate(page, /^Edit details$/);
  await tabTo(page, /^Name/);
  await fillFocused(page, "Taylor Morgan");
  await activate(page, /^Confirm safe facts and save review$/);
  await page.getByText("Review saved to career foundation").waitFor();
  check("story review is savable without converting uncertainty into exact facts", await page.getByText(/approximate|unknown/).count() > 0);

  // D/E. Two description-backed targets and generation.
  await page.goto(`${baseUrl}/targets`);
  await tabTo(page, /Or add a custom lane/);
  await fillFocused(page, "Product Support Specialist");
  await tabTo(page, /Optional target description/);
  await fillFocused(page, "Troubleshoot customer issues, communicate resolutions, document support knowledge, and manage escalations.");
  await activate(page, /^Add$/, { reverse: true });
  await tabTo(page, /Or add a custom lane/);
  await fillFocused(page, "Junior Product Operations");
  await tabTo(page, /Optional target description/);
  await fillFocused(page, "Map workflows, coordinate projects, analyze spreadsheet reporting, and improve operational handoffs.");
  await activate(page, /^Add$/, { reverse: true });
  const targetState = await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")));
  check("both keyboard-added lanes preserve their target descriptions", ["Product Support Specialist", "Junior Product Operations"].every((title) => targetState.lanes.some((lane) => lane.title === title && lane.targetDescription.trim())));
  await activate(page, /^Make Product Support Specialist active$/);
  await activate(page, /^Make Junior Product Operations active$/);
  const forgeControl = page.getByRole("button", { name: /^Forge complete résumé pack/ });
  if (!(await forgeControl.count()) || await forgeControl.isDisabled()) {
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")));
    throw new Error(`Forge control unavailable after keyboard target setup. activeLanes=${state.lanes.filter((lane) => lane.status === "active").length} roles=${state.dossier.roles.length} projects=${state.dossier.projects.length} evidence=${state.dossier.evidence.length}\n${(await page.locator("main").innerText()).slice(-1800)}`);
  }
  await activate(page, /^Forge complete résumé pack/);
  await page.waitForURL(`${baseUrl}/versions`);
  const packHeading = page.getByRole("heading", { name: /Your Résumé Pack (?:is ready|needs evidence review)/ });
  await packHeading.waitFor();
  const packHeadingText = await packHeading.innerText();
  if (!packHeadingText.includes("is ready")) {
    const debug = await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem("career-forge-command-center-v1"));
      return state.resumePacks.at(-1).variants.map((variant) => ({ title: variant.title, summary: variant.resume.summary, skills: variant.resume.coreSkills, experience: variant.resume.experience, references: variant.evidenceReferences.map((reference) => reference.claimPath) }));
    });
    throw new Error(`Fresh pack failed defensibility:\n${JSON.stringify(debug, null, 2)}`);
  }
  check("keyboard-generated pack is current at creation", true);
  check("keyboard-generated pack exposes role priority receipts", await page.getByRole("region", { name: "Role distinctness" }).count() === 1);
  check("keyboard-generated pack includes ATS and recruiter variants", await page.getByText("Use this for:").count() >= 4);

  // F. Correct a cited source; stale outbound controls fail closed; regenerate.
  await activate(page, /^Workspace$/);
  await activate(page, /^Work History$/);
  await page.waitForURL(`${baseUrl}/profile`);
  const correctionTarget = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("career-forge-command-center-v1"));
    const evidenceId = state.resumePacks.at(-1).variants.flatMap((variant) => variant.evidenceReferences).flatMap((reference) => reference.evidenceIds)[0];
    return state.dossier.evidence.find((item) => item.id === evidenceId);
  });
  check("source correction has an approved cited evidence target", Boolean(correctionTarget));
  await activate(page, new RegExp(`^${correctionTarget.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`));
  await tabTo(page, new RegExp(`^Edit evidence ${correctionTarget.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await fillFocused(page, "Corrected: documented only confirmed customer resolutions and escalation steps.");
  await page.keyboard.press("Tab");
  await activate(page, /^Résumé$/);
  await page.waitForURL(`${baseUrl}/versions`);
  check("stale source correction disables Copy", await page.getByRole("button", { name: "Copy", exact: true }).first().isDisabled());
  check("stale source correction disables PDF", await page.getByRole("button", { name: "Print / PDF" }).first().isDisabled());
  check("stale source correction disables DOCX", await page.getByRole("button", { name: "DOCX", exact: true }).first().isDisabled());
  check("stale source correction disables ZIP", await page.getByRole("button", { name: "Export complete pack" }).isDisabled());
  await activate(page, /^Workspace$/);
  await activate(page, /^Target Roles$/);
  await page.waitForURL(`${baseUrl}/targets`);
  await activate(page, /^Forge complete résumé pack/);
  await page.waitForURL(`${baseUrl}/versions`);
  check("regeneration restores current outbound controls", !(await page.getByRole("button", { name: "Copy", exact: true }).first().isDisabled()));

  // G. Every in-app export action is reached and activated from the keyboard.
  await activate(page, /^Copy$/);
  await page.getByRole("status").filter({ hasText: /Copied the complete document/ }).waitFor();
  const pdfDownload = await activateDownload(page, /^Print \/ PDF$/);
  check("keyboard PDF export downloads a PDF", (await pdfDownload).suggestedFilename().endsWith(".pdf"));
  const docxDownload = await activateDownload(page, /^DOCX$/);
  check("keyboard DOCX export downloads a DOCX", (await docxDownload).suggestedFilename().endsWith(".docx"));
  const zipDownload = await activateDownload(page, /^Export complete pack$/);
  const backupSourcePath = await (await zipDownload).path();
  check("keyboard full-pack export downloads a ZIP", Boolean(backupSourcePath));

  // H. Backup, clear, and restore. The native file chooser is the only non-DOM step.
  await activate(page, /^Workspace$/);
  await activate(page, /^Data & Backup$/);
  await page.waitForURL(`${baseUrl}/settings`);
  const backupDownload = await activateDownload(page, /^Download backup$/);
  const backupPath = await (await backupDownload).path();
  check("keyboard backup creates a file", Boolean(backupPath));
  await activate(page, /^Clear local data/);
  await activate(page, /^Yes, clear all local Career Forge data$/);
  const chooserPromise = page.waitForEvent("filechooser");
  await activate(page, /^Choose backup file/);
  const chooser = await chooserPromise;
  await chooser.setFiles(backupPath);
  await page.getByText("Backup contents").waitFor();
  await activate(page, /^Replace current data with this backup$/);
  await page.getByText(/Backup restored at/).waitFor();
  check("keyboard restore returns generated versions", await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).resumeVersions.length >= 4));

  await page.screenshot({ path: `${evidenceDir}/keyboard-release-final.png`, fullPage: false });
  await context.tracing.stop({ path: `${evidenceDir}/keyboard-release.trace.zip` });
  console.log(`\nKeyboard release acceptance: ${passes}/${passes} passed · ${evidenceDir}`);
  await context.close();
} finally {
  await browser?.close();
  if (server.exitCode === null) server.kill("SIGTERM");
}
