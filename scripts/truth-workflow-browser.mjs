import { once } from "node:events";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 3220;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    if (/Ready in|Local:/i.test(output)) return;
    if (server.exitCode !== null) throw new Error(`Server exited early.\n${output}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start.\n${output}`);
}

function verify(condition, message) {
  if (!condition) throw new Error(message);
}

async function noOverflow(page, label) {
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  verify(widths.content <= widths.viewport + 1, `${label} has horizontal overflow: ${widths.content} > ${widths.viewport}`);
}

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/profile`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await noOverflow(page, "fresh dossier mobile");
  verify((await page.getByText("Start with one real role or project").count()) === 1, "fresh empty state was not visible");

  const fileInput = page.getByLabel("Resume pack files");
  await fileInput.setInputFiles([
    { name: "ats-resume.txt", mimeType: "text/plain", buffer: Buffer.from("Associate Sportsbook Writer — DraftKings | 2021–2024\nPolicy enforcement and ID verification\nMaintained transaction accuracy\nTools: Excel\nEarlham College — Bachelor's degree") },
    { name: "networking-resume.txt", mimeType: "text/plain", buffer: Buffer.from("Associate Sportsbook Writer — DraftKings | 2021–2024\nPolicy enforcement and ID verification\nResolved customer disputes\nCareer Forge project\nMaintained 13 automated regression suites") }
  ]);
  await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
  const approveSections = page.getByRole("button", { name: "Approve section" });
  for (let index = 0; index < await approveSections.count(); index += 1) await approveSections.nth(index).click();
  await page.getByRole("button", { name: "Finish review" }).click();
  await page.getByText(/Truth Inbox complete:/).waitFor();

  await page.getByRole("textbox", { name: "Full name" }).fill("Blake Example");
  await page.getByLabel("Role title", { exact: true }).fill("Associate Sportsbook Writer");
  await page.getByLabel("Employer", { exact: true }).fill("DraftKings");
  await page.getByLabel("Dates", { exact: true }).fill("2021–2024");
  await page.getByLabel("Responsibilities", { exact: true }).fill("Policy enforcement and ID verification\nResolved customer disputes");
  await page.getByRole("button", { name: "Add approved role" }).click();
  await page.getByLabel("Project name", { exact: true }).fill("Career Forge");
  await page.getByLabel("Project organization", { exact: true }).fill("Koinophobia Labs");
  await page.getByLabel("Project dates", { exact: true }).fill("2024–Present");
  await page.getByLabel("Project description", { exact: true }).fill("Built a local-first career command center and maintained automated regression coverage.");
  await page.getByRole("button", { name: "Add approved project" }).click();
  await noOverflow(page, "populated dossier mobile");

  await page.goto(`${baseUrl}/targets`);
  for (let index = 0; index < 3; index += 1) await page.locator('[data-testid="adopt-lane"]:not(:disabled)').first().click();
  await page.getByText("3 active lane(s) · 6 baseline résumé(s)").waitFor();
  await page.getByRole("button", { name: "Forge complete résumé pack →" }).click();
  await page.waitForURL(`${baseUrl}/versions`);
  await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).waitFor();
  await noOverflow(page, "resume pack mobile");
  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete pack" }).click();
  const zipDownload = await zipPromise;
  verify(zipDownload.suggestedFilename().endsWith("-Resume-Pack.zip"), "bundle filename was not deterministic");

  await page.goto(`${baseUrl}/tailor`);
  await page.getByRole("textbox", { name: "Company", exact: true }).fill("Fin");
  await page.getByRole("textbox", { name: "Role title", exact: true }).fill("Technical Support Engineer");
  await page.getByRole("combobox", { name: "Lane", exact: true }).selectOption({ index: 1 });
  await page.getByRole("combobox", { name: "Baseline résumé", exact: true }).selectOption({ index: 1 });
  await page.getByLabel("Discovery URL").fill("https://linkedin.example/fin-role");
  await page.getByLabel("Direct application URL").fill("https://fin.example/careers/apply");
  await page.getByLabel("Paste the full job post here").fill("Technical Support Engineer\nRequirements:\n- Experience with technical support and regression testing required\n- Salesforce experience required\n- Bachelor's degree required");
  await page.getByLabel("Application questions").fill("What excites you most about this opportunity?\nDescribe a time you solved a difficult customer problem.");
  await page.getByRole("button", { name: "Analyze this post" }).click();
  const refusedGaps = page.getByText("A lane keyword cannot change that.");
  await refusedGaps.first().waitFor();
  verify((await refusedGaps.count()) >= 1, "unsupported requirements were not refused");
  await page.getByRole("button", { name: "I applied — track it" }).click();
  await page.getByText("Saved to your applications tracker.").waitFor();
  await noOverflow(page, "tailor mobile");
  await page.getByRole("button", { name: "Build the resume for this shot →" }).click();
  await page.waitForURL(`${baseUrl}/resume-builder`);
  await page.locator("#intake form").waitFor();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("heading", { name: "What job do you want next?" }).waitFor();
  const targetInput = page.getByPlaceholder("Example: Customer Support");
  if (!(await targetInput.inputValue()).trim()) {
    await targetInput.fill("Technical Support Engineer");
  }
  await targetInput.press("Tab");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("heading", { name: "What did you actually do there?" }).waitFor();
  await page.getByPlaceholder("Example: Helped customers, stocked shelves.").fill(
    "Resolved customer support issues, documented repeatable fixes, and ran regression tests before releases."
  );
  await page.getByRole("button", { name: "See recommendations" }).click();
  await page.getByRole("heading", { name: "Ready to generate?" }).waitFor();
  await page.getByRole("button", { name: "Generate draft" }).click();
  const influenceReceipt = page.getByText("Why this version changed");
  try {
    await influenceReceipt.waitFor({ timeout: 10_000 });
  } catch {
    const builderState = await page.locator("main").innerText();
    throw new Error(`Tailored preview was not generated. URL: ${page.url()}\n${builderState.slice(0, 3000)}`);
  }

  await page.goto(`${baseUrl}/applications`);
  await page.getByRole("heading", { name: /Technical Support Engineer/ }).first().waitFor();
  await page.getByRole("link", { name: /Resume attached:/ }).waitFor();
  verify((await page.getByRole("link", { name: "Discovery post" }).getAttribute("href")) === "https://linkedin.example/fin-role", "discovery URL was not retained");
  verify((await page.getByRole("link", { name: "Employer application" }).getAttribute("href")) === "https://fin.example/careers/apply", "direct URL was not retained");
  await page.getByText("Application answers").waitFor();
  await page.reload();
  await page.getByText("Application answers").waitFor();
  await noOverflow(page, "applications after refresh mobile");

  await page.goto(`${baseUrl}/settings`);
  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const backupDownload = await backupPromise;
  const backupPath = await backupDownload.path();
  verify(Boolean(backupPath), "backup did not produce a local file");
  await page.getByRole("button", { name: "Clear local data…" }).click();
  await page.getByRole("button", { name: "Yes, clear all local Career Forge data" }).click();
  await page.goto(`${baseUrl}/applications`);
  await page.getByText("No applications tracked yet.").waitFor();
  await page.goto(`${baseUrl}/settings`);
  await page.getByLabel("Restore backup file").setInputFiles(backupPath);
  await page.getByText("Backup contents").waitFor();
  await page.getByRole("button", { name: "Replace current data with this backup" }).click();
  await page.getByText("Backup restored at").waitFor();
  await page.goto(`${baseUrl}/applications`);
  await page.getByRole("heading", { name: /Technical Support Engineer/ }).first().waitFor();
  await page.goto(`${baseUrl}/versions`);
  await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).waitFor();
  await page.getByRole("heading", { name: /Technical Support Engineer.*tailored/i }).waitFor();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.reload();
  await noOverflow(page, "resume pack desktop");
  await page.keyboard.press("Tab");
  const activeTag = await page.evaluate(() => document.activeElement?.tagName ?? "");
  verify(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "SUMMARY"].includes(activeTag), `keyboard focus did not land on an interactive control (${activeTag})`);
  console.log("Career Forge truth workflow browser acceptance passed at 375x667 and 1440x900.");
  await context.close();
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null) server.kill("SIGTERM");
}
