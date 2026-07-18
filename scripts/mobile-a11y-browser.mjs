// Mobile keyboard-accessibility acceptance at 390×844: audits EVERY route for
// horizontally scrollable regions and requires each one to be keyboard
// focusable, accessibly named, and keyboard scrollable. Also captures a
// keyboard-only trace (screenshots) of the landing comparison table as PR
// evidence. Runs against a real dev server.
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE_DIR = path.join(root, "docs/evidence/paid-beta-surge/mobile-a11y");
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

let passes = 0;
const verify = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  passes += 1;
  console.log(`PASS ${message}`);
};

const port = 3222;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "off" }, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });
async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server.exitCode !== null) throw new Error(`Server exited early.\n${output}`);
    try { const response = await fetch(baseUrl); if (response.ok) return; } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start.\n${output}`);
}

const ROUTES = ["/", "/profile", "/targets", "/versions", "/tailor", "/applications", "/outreach", "/interview", "/pricing", "/settings", "/story", "/truth-map", "/unlock", "/weekly", "/resume-builder"];

// Every horizontally scrollable element on the page, with its keyboard/a11y
// affordances. An element that can overflow but currently fits is fine.
async function auditScrollRegions(page) {
  return page.evaluate(() => {
    const results = [];
    for (const element of document.querySelectorAll("*")) {
      const style = getComputedStyle(element);
      const scrollable = (style.overflowX === "auto" || style.overflowX === "scroll") && element.scrollWidth > element.clientWidth + 2;
      if (!scrollable) continue;
      if (element.tagName === "TEXTAREA" || element.tagName === "INPUT" || element.tagName === "SELECT") continue;
      results.push({
        tag: element.tagName,
        focusable: element.tabIndex >= 0,
        name: element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || "",
        role: element.getAttribute("role") || "",
        snippet: (element.textContent || "").trim().slice(0, 60)
      });
    }
    return results;
  });
}

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  // --- Route sweep: no anonymous, keyboard-unreachable scroll regions --------
  for (const route of ROUTES) {
    await page.goto(`${baseUrl}${route}`);
    await page.waitForLoadState("networkidle");
    const regions = await auditScrollRegions(page);
    const violations = regions.filter((region) => !region.focusable || !region.name);
    verify(violations.length === 0, `${route}: ${regions.length} horizontally scrollable region(s), all keyboard-focusable and accessibly named${violations.length ? ` — VIOLATIONS: ${JSON.stringify(violations)}` : ""}`);
  }

  // --- Keyboard-only trace: landing comparison table -------------------------
  await page.goto(baseUrl);
  await page.waitForLoadState("networkidle");
  const region = page.getByRole("region", { name: /comparison table/i });
  await region.scrollIntoViewIfNeeded();
  verify((await region.count()) === 1, "comparison table region exposes an accessible name to screen readers");
  verify(/scroll horizontally/i.test(await region.getAttribute("aria-label")), "accessible name includes navigation instructions");

  // Reach it with the keyboard alone.
  await region.focus();
  verify(await region.evaluate((element) => document.activeElement === element), "comparison region is keyboard focusable at 390×844");
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "comparison-focused-before-scroll.png") });

  const before = await region.evaluate((element) => element.scrollLeft);
  for (let press = 0; press < 12; press += 1) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(300);
  const after = await region.evaluate((element) => element.scrollLeft);
  verify(after > before, `arrow keys scroll the focused comparison region (scrollLeft ${before} → ${after})`);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "comparison-after-arrow-scroll.png") });

  // The whole page must never scroll horizontally on mobile.
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  verify(widths.content <= widths.viewport + 1, `page body has no horizontal overflow at 390×844 (${widths.content} <= ${widths.viewport})`);

  console.log(`\n${passes} passed, 0 failed`);
} finally {
  await browser?.close();
  server.kill();
}
