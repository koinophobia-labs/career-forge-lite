import { once } from "node:events";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 3231;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });
const waitForServer = async () => { const started = Date.now(); while (Date.now() - started < 30_000) { if (/Ready in|Local:/i.test(output)) return; if (server.exitCode !== null) throw new Error(output); await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error(output); };
const verify = (condition, message) => { if (!condition) throw new Error(message); };
const noOverflow = async (page, label) => { const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth })); verify(widths.content <= widths.viewport + 1, `${label}: ${widths.content} > ${widths.viewport}`); };

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 375, height: 667 }, acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("heading", { name: "One career history. A complete résumé pack." }).waitFor();
  await page.getByRole("link", { name: "Import my résumés", exact: true }).waitFor();
  await page.getByText("Files processed locally").waitFor();
  await noOverflow(page, "fresh landing 375");
  const storedBeforeSample = await page.evaluate(() => localStorage.getItem("career-forge-command-center-v1"));
  await page.getByRole("button", { name: "Explore sample pack" }).click();
  await page.getByText("Direct match:").waitFor();
  const storedAfterSample = await page.evaluate(() => localStorage.getItem("career-forge-command-center-v1"));
  verify(storedAfterSample === storedBeforeSample, "sample mode changed persisted user state");

  await page.getByRole("link", { name: "Import my résumés", exact: true }).click();
  await page.waitForURL(`${baseUrl}/profile#import`);
  await page.getByText("No file handy? Paste résumé text", { exact: true }).click();
  await page.getByLabel("Resume text import").fill("Customer Support Specialist — Northstar Software | January 2021 to January 2026\nResolved difficult customer issues and documented repeatable fixes\nProvided customer support for SaaS products\nMaintained 40 verified troubleshooting articles\nTools: Zendesk, Jira");
  await page.getByRole("button", { name: "Extract proposed evidence" }).click();
  await page.getByRole("heading", { name: "Review structured proposals" }).waitFor();
  const sections = page.getByRole("button", { name: "Approve section" });
  for (let index = 0; index < await sections.count(); index += 1) await sections.nth(index).click();
  await page.getByRole("button", { name: "Save reviewed evidence" }).click();
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
  await page.getByRole("link", { name: "Tailor a résumé to a real job →" }).waitFor();
  await page.reload();
  await page.getByText("Step 4 · Complete").waitFor();
  await noOverflow(page, "pack reveal 375");

  const zipPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete pack" }).click();
  const download = await zipPromise;
  verify(download.suggestedFilename().endsWith("-Resume-Pack.zip"), "full pack export was not a ZIP");
  await page.getByRole("link", { name: "Tailor a résumé to a real job →" }).click();
  await page.getByRole("heading", { name: "Tailor against the actual job post." }).waitFor();

  for (const [width, height] of [[320, 568], [375, 667], [390, 844], [430, 932], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await page.goto(baseUrl);
    await noOverflow(page, `landing ${width}x${height}`);
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
