// Release responsive/semantic acceptance. Audits every durable route at the
// supported mobile, tablet, desktop, and reduced-CSS viewport sizes. Assertions
// use landmarks, accessible names, focus state, and observable overflow rather
// than retired landing-page copy or DOM position.
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE_DIR = "/tmp/career-forge-pass-06/mobile-a11y";
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

const ROUTES = ["/", "/profile", "/story", "/targets", "/truth-map", "/versions", "/versions/view", "/tailor", "/applications", "/outreach", "/interview", "/weekly", "/role-sprint", "/settings", "/pricing", "/privacy", "/terms"];
const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 720 },
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "zoom-200-equivalent", width: 640, height: 450 }
];

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

async function semanticAudit(page) {
  return page.evaluate(() => {
    const interactive = [...document.querySelectorAll("button, a[href], input, select, textarea, summary")];
    const unnamed = interactive.filter((element) => {
      if (element instanceof HTMLInputElement && element.type === "hidden") return false;
      const labelled = element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || element.getAttribute("placeholder");
      const label = (element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : "") || element.closest("label")?.textContent;
      return !(labelled || label || element.textContent?.trim() || element.getAttribute("title"));
    });
    const ids = [...document.querySelectorAll("[id]")].map((element) => element.id).filter(Boolean);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    return {
      main: document.querySelectorAll("main").length,
      headings: document.querySelectorAll("h1, h2").length,
      unnamed: unnamed.map((element) => element.outerHTML.slice(0, 120)),
      duplicateIds: [...new Set(duplicateIds)],
      bodyWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth
    };
  });
}

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    for (const route of ROUTES) {
      await page.goto(`${baseUrl}${route}`);
      await page.waitForLoadState("networkidle");
      const regions = await auditScrollRegions(page);
      const violations = regions.filter((region) => !region.focusable || !region.name);
      const semantic = await semanticAudit(page);
      verify(violations.length === 0, `${viewport.name} ${route}: scroll regions are named and keyboard reachable${violations.length ? ` (${JSON.stringify(violations)})` : ""}`);
      verify(semantic.main === 1 && semantic.headings > 0, `${viewport.name} ${route}: one main landmark and visible heading hierarchy`);
      verify(semantic.unnamed.length === 0, `${viewport.name} ${route}: every interactive control has an accessible name${semantic.unnamed.length ? ` (${semantic.unnamed.join(" | ")})` : ""}`);
      verify(semantic.duplicateIds.length === 0, `${viewport.name} ${route}: no duplicate form or landmark ids`);
      verify(semantic.bodyWidth <= semantic.viewportWidth + 1, `${viewport.name} ${route}: no page-level horizontal overflow`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl);
  await page.keyboard.press("Tab");
  const focus = await page.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement)) return null;
    const style = getComputedStyle(element);
    return { tag: element.tagName, outline: style.outlineStyle, boxShadow: style.boxShadow, visible: element.getBoundingClientRect().width > 0 };
  });
  verify(Boolean(focus?.visible && focus.tag), "keyboard focus reaches a visible control on first run");
  verify(focus?.outline !== "none" || focus?.boxShadow !== "none", "focused control has a visible focus treatment");
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "first-run-keyboard-focus-390.png"), fullPage: false });

  console.log(`\n${passes} passed, 0 failed`);
} finally {
  await browser?.close();
  server.kill();
}
