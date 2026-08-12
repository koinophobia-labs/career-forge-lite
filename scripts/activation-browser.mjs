import { once } from "node:events";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { chromium } from "playwright";

const port = 3231;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "off" }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });
const waitForServer = async () => { const started = Date.now(); while (Date.now() - started < 30_000) { if (/Ready in|Local:/i.test(output)) return; if (server.exitCode !== null) throw new Error(output); await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error(output); };
const verify = (condition, message) => { if (!condition) throw new Error(message); };
const noOverflow = async (page, label) => { const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth })); verify(widths.content <= widths.viewport + 1, `${label}: ${widths.content} > ${widths.viewport}`); };

let browser;
try {
  fs.mkdirSync("/tmp/career-forge-pass-06/activation", { recursive: true });
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("heading", { name: "What are you trying to do?" }).waitFor();
  for (const goal of ["Get a job", "Build or update my résumé", "Practice for an interview"]) await page.getByRole("button", { name: new RegExp(`^${goal}`) }).waitFor();
  await page.getByRole("button", { name: /^Get a job/ }).click();
  await page.waitForURL(`${baseUrl}/profile#import`);
  verify(await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).activeGoal.kind === "new-job"), "selected intent did not persist");
  await page.goto(baseUrl);
  await page.getByText("Continue: New Job Search", { exact: true }).waitFor();
  await page.reload();
  await page.getByText("Continue: New Job Search", { exact: true }).waitFor();
  await page.evaluate(() => localStorage.clear());
  await page.goto(baseUrl);
  await page.getByRole("heading", { name: "What are you trying to do?" }).waitFor();
  await page.getByRole("button", { name: /^Build or update my résumé/ }).waitFor();
  await page.getByText("Files stay on this device").waitFor();
  await noOverflow(page, "fresh landing 375");
  await page.screenshot({ path: "/tmp/career-forge-pass-06/activation/final-375x667.png", fullPage: false });
  const storedBeforeSample = await page.evaluate(() => localStorage.getItem("career-forge-command-center-v1"));
  await page.locator("summary", { hasText: "See a finished sample first" }).click();
  await page.getByRole("button", { name: "Explore sample pack" }).click();
  await page.getByText("Direct match:").waitFor();
  const storedAfterSample = await page.evaluate(() => localStorage.getItem("career-forge-command-center-v1"));
  verify(storedAfterSample === storedBeforeSample, "sample mode changed persisted user state");

  await page.getByRole("button", { name: /^Build or update my résumé/ }).click();
  await page.waitForURL(`${baseUrl}/profile#import`);
  await page.getByText("No file handy? Paste résumé text", { exact: true }).click();
  await page.getByLabel("Resume text import").fill("Customer Support Specialist — Northstar Software | January 2021 to January 2026\nResolved difficult customer issues and documented repeatable fixes\nProvided customer support for SaaS products\nMaintained 40 verified troubleshooting articles\nTools: Zendesk, Jira");
  await page.getByRole("button", { name: "Extract proposed evidence" }).click();
  await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
  const preSaveImport = await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")));
  verify(preSaveImport.dossier.evidence.length === 0 && preSaveImport.pendingImportReviews[0].proposals.some((proposal) => proposal.status === "proposed"), "preselected import facts escaped the Truth Inbox before the user saved decisions");
  const originalProposalCount = await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).pendingImportReviews[0].proposals.length);
  await page.getByLabel("Resume text import").fill("Independent Project — Synthetic Portfolio | 2025–Present\nBuilt a documented support workflow");
  await page.getByRole("button", { name: "Extract proposed evidence" }).click();
  await page.getByRole("heading", { name: "A Truth Inbox already exists" }).waitFor();
  await page.getByRole("button", { name: "Add files to current review" }).waitFor();
  await page.getByRole("button", { name: "Start a separate review batch" }).waitFor();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  verify(await page.evaluate(() => { const batches = JSON.parse(localStorage.getItem("career-forge-command-center-v1")).pendingImportReviews; return batches.length === 1 && batches[0].proposals.length; }) === originalProposalCount, "second import overwrote the existing Truth Inbox");
  let discardConfirmation = "";
  page.once("dialog", async (dialog) => { discardConfirmation = dialog.message(); await dialog.dismiss(); });
  await page.getByRole("button", { name: "Discard this import review" }).click();
  verify(discardConfirmation === "This removes the pending review but does not delete evidence you already approved in earlier sessions.", "discard confirmation was missing or changed");
  verify(await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).pendingImportReviews.length === 1), "dismissed discard removed the Truth Inbox");
  await page.getByRole("button", { name: "Approve", exact: true }).nth(0).click();
  await page.getByRole("button", { name: "Approve", exact: true }).nth(1).click();
  await page.getByRole("button", { name: "Reject", exact: true }).nth(2).click();
  await page.getByRole("button", { name: "Save decisions and continue later" }).click();
  await page.getByText(/still need review/).last().waitFor();
  const pendingBeforeRefresh = await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).pendingImportReviews[0].proposals.length);
  verify(pendingBeforeRefresh > 0, "partial Truth Inbox did not preserve undecided proposals");
  await page.reload();
  await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
  const pendingAfterRefresh = await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).pendingImportReviews[0].proposals.length);
  verify(pendingAfterRefresh === pendingBeforeRefresh, "Truth Inbox changed across refresh");
  const sections = page.getByRole("button", { name: "Approve clear items" });
  for (let index = 0; index < await sections.count(); index += 1) await sections.nth(index).click();
  const undecided = page.locator("article").filter({ hasText: /proposed$/ });
  for (let index = (await undecided.count()) - 1; index >= 0; index -= 1) {
    await undecided.nth(index).getByRole("button", { name: /Approve|Choose this value/ }).click();
  }
  await page.getByRole("button", { name: "Finish review" }).click();
  verify(await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).pendingImportReviews.length === 0), "finished Truth Inbox did not clear");
  await page.getByText("What your approvals unlock").waitFor();
  await noOverflow(page, "approved dossier 375");

  await page.getByRole("link", { name: "See dossier-backed role lanes →" }).click();
  await page.waitForURL(`${baseUrl}/targets`);
  await page.getByText("A lane is a role family", { exact: false }).waitFor();
  await page.getByTestId("adopt-lane").first().click();
  await page.getByRole("button", { name: "Forge complete résumé pack →" }).click();
  await page.waitForURL(`${baseUrl}/versions`);
  await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).waitFor();
  verify(await page.getByText("Use this for:").count() >= 2, "variant use guidance missing");
  await page.getByText("Open Defensibility Receipt").first().click();
  await page.getByText("Missing provenance:").first().waitFor();
  await page.getByRole("link", { name: "Tailor a résumé to a real job →" }).waitFor();
  await page.reload();
  await page.getByText("Step 4 · Complete").waitFor();
  await noOverflow(page, "pack reveal 375");

  await page.goto(`${baseUrl}/truth-map`);
  await page.getByRole("heading", { name: "See what supports every claim—and where each fact is used." }).waitFor();
  await page.getByRole("heading", { name: "Evidence-first" }).waitFor();
  await page.getByRole("heading", { name: "Output-first" }).waitFor();
  await noOverflow(page, "truth map 375");
  await page.screenshot({ path: "/tmp/career-forge-pass-06/activation/truth-map-375x667.png", fullPage: false });

  // Exports are identity-gated: a nameless pack must never leave the app, so
  // the persona fills their name the way the gate directs before exporting.
  await page.goto(`${baseUrl}/profile`);
  await page.getByRole("textbox", { name: "Full name" }).first().fill("Riley Example");
  await page.getByRole("textbox", { name: "Full name" }).first().blur();

  await page.goto(`${baseUrl}/versions`);
  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete pack" }).click();
  const download = await zipPromise;
  verify(download.suggestedFilename().endsWith("-Resume-Pack.zip"), "full pack export was not a ZIP");
  await page.goto(`${baseUrl}/versions`);
  await page.getByRole("link", { name: "Tailor a résumé to a real job →" }).click();
  await page.getByRole("heading", { name: "Paste a job. See what you can prove." }).waitFor();
  await page.getByRole("textbox", { name: "Paste the full job posting" }).fill("Product Support Specialist at Synthetic Co\nRequirements:\n- Resolve difficult customer issues\n- Document repeatable fixes\n- Maintain customer support knowledge");
  await page.getByRole("button", { name: /Analyze this job/ }).click();
  await page.locator("summary", { hasText: "Other actions" }).click();
  await page.getByRole("button", { name: "Save as draft" }).click();
  verify(await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).applications.length === 1), "saved application did not enter the tracker");
  verify(await page.evaluate(() => decodeURIComponent(JSON.parse(localStorage.getItem("career-forge-command-center-v1")).applications[0].jobPostUrl).includes("Resolve difficult customer issues")), "saved application lost its analyzed posting");
  await page.goto(`${baseUrl}/truth-map`);
  await page.getByRole("heading", { name: "Output-first" }).waitFor();
  verify(await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).applications.length === 1), "saved application lineage disappeared");
  await page.screenshot({ path: "/tmp/career-forge-pass-06/activation/truth-map-restored-375x667.png", fullPage: false });

  await page.goto(`${baseUrl}/settings`);
  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const backupDownload = await backupPromise;
  const backupPath = await backupDownload.path();
  verify(Boolean(backupPath), "backup download path was unavailable");
  await page.getByRole("button", { name: "Clear local data…" }).click();
  await page.getByRole("button", { name: "Yes, clear all local Career Forge data" }).click();
  await page.getByLabel("Restore backup file").setInputFiles(backupPath);
  await page.getByText("Backup contents").waitFor();
  await page.getByRole("button", { name: "Replace current data with this backup" }).click();
  await page.getByText(/Backup restored at/).waitFor();
  await page.goto(`${baseUrl}/truth-map`);
  await page.getByRole("heading", { name: "Output-first" }).waitFor();
  verify(await page.getByText(/direct|transferred/).count() > 0, "restored Truth Map lost claim relationships");

  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto(baseUrl);
    await noOverflow(page, `landing ${width}x${height}`);
    if (width === 1440) await page.screenshot({ path: "/tmp/career-forge-pass-06/activation/final-1440x900.png", fullPage: false });
  }
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(baseUrl);
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => ({ tag: document.activeElement?.tagName, visible: document.activeElement ? getComputedStyle(document.activeElement).display !== "none" : false }));
  verify(["A", "BUTTON", "SUMMARY"].includes(focused.tag) && focused.visible, "keyboard focus did not reach a visible control");
  console.log("Career Forge activation browser acceptance passed: fresh landing, isolated sample, import, approval, lane, pack reveal, export, tailoring bridge, refresh, keyboard, and six viewports.");
  await context.close();
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) server.kill("SIGTERM");
}
