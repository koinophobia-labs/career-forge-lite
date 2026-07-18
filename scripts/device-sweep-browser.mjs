// Tiny device and accessibility sweep — journey blockers only, not pixel
// dust. Engine-level emulation: WebKit + iPhone 13 profile (closest headless
// stand-in for iPhone Safari), Chromium + Pixel 7 profile (Android Chrome),
// desktop keyboard-only navigation, 200% zoom equivalent, visible focus
// states, and status announcements around save/export.
// Physical-device passes remain part of the founder's release ritual.
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium, webkit, devices } from "playwright";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { mergeIntakeIntoDossier } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));

const NOW = new Date().toISOString();
const intake = { ...initialIntake, fullName: "Sweep User", email: "sweep@example.com", phone: "555-0100", website: "", targetJobTitle: "Product Support Specialist", currentTitle: "Retail Associate", currentCompany: "ShopCo", currentTime: "2022–Present", tools: "Zendesk, Excel", responsibilities: "Resolved customer questions\nDocumented escalations", outcomes: "Improved handoff clarity for the support team", customersServed: "40+ customers per shift", education: "Associate degree" };
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

const port = 3226;
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

const ROUTES = ["/", "/profile", "/targets", "/versions"];

async function journeySurfaces(page, label) {
  await page.goto(baseUrl);
  await page.evaluate((state) => { localStorage.clear(); localStorage.setItem("career-forge-command-center-v1", state); }, seedState);
  for (const route of ROUTES) {
    await page.goto(`${baseUrl}${route}`);
    await page.waitForLoadState("networkidle");
    const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    verify(widths.content <= widths.viewport + 1, `${label} ${route}: no horizontal page overflow (${widths.content} <= ${widths.viewport})`);
  }
  await page.goto(`${baseUrl}/profile`);
  verify(await page.getByLabel("Resume pack files").isVisible(), `${label} /profile: résumé import input is reachable`);
  await page.goto(`${baseUrl}/targets`);
  verify(await page.getByRole("button", { name: /Forge complete résumé pack/ }).isVisible(), `${label} /targets: forge action visible`);
  await page.goto(`${baseUrl}/versions`);
  verify(await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).isVisible(), `${label} /versions: pack confirmation visible`);
}

const browsers = [];
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);

  // --- iPhone Safari stand-in: WebKit engine, iPhone 13 profile -------------
  const webkitBrowser = await webkit.launch({ headless: true });
  browsers.push(webkitBrowser);
  const iphone = await webkitBrowser.newContext({ ...devices["iPhone 13"] });
  await journeySurfaces(await iphone.newPage(), "webkit/iPhone13");

  // --- Android Chrome stand-in: Chromium, Pixel 7 profile -------------------
  const chromiumBrowser = await chromium.launch({ headless: true });
  browsers.push(chromiumBrowser);
  const pixel = await chromiumBrowser.newContext({ ...devices["Pixel 7"] });
  await journeySurfaces(await pixel.newPage(), "chromium/Pixel7");

  // --- Desktop keyboard-only navigation -------------------------------------
  const desktop = await chromiumBrowser.newContext({ viewport: { width: 1280, height: 800 } });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(baseUrl);
  await desktopPage.evaluate((state) => { localStorage.clear(); localStorage.setItem("career-forge-command-center-v1", state); }, seedState);
  await desktopPage.reload();
  await desktopPage.keyboard.press("Tab");
  const skipLink = await desktopPage.evaluate(() => document.activeElement?.textContent?.trim());
  verify(skipLink === "Skip to content", "keyboard: first Tab lands on the skip-to-content link");
  await desktopPage.keyboard.press("Enter");
  verify(await desktopPage.evaluate(() => document.activeElement?.tagName === "MAIN"), "keyboard: Enter on skip link moves focus into main content");
  // Sample the next ten focus stops for a visible focus indication.
  let visibleFocus = 0;
  for (let step = 0; step < 10; step += 1) {
    await desktopPage.keyboard.press("Tab");
    const focused = await desktopPage.evaluate(() => {
      const element = document.activeElement;
      if (!element || element === document.body) return null;
      const style = getComputedStyle(element);
      return { outline: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0, boxShadow: style.boxShadow !== "none" };
    });
    if (focused && (focused.outline || focused.boxShadow)) visibleFocus += 1;
  }
  verify(visibleFocus >= 8, `keyboard: visible focus indication on ${visibleFocus}/10 sampled tab stops`);

  // --- 200% zoom equivalent (1440px window at 2× → 720 CSS px) --------------
  const zoomed = await chromiumBrowser.newContext({ viewport: { width: 720, height: 450 } });
  const zoomedPage = await zoomed.newPage();
  await zoomedPage.goto(baseUrl);
  await zoomedPage.evaluate((state) => { localStorage.clear(); localStorage.setItem("career-forge-command-center-v1", state); }, seedState);
  for (const route of ROUTES) {
    await zoomedPage.goto(`${baseUrl}${route}`);
    await zoomedPage.waitForLoadState("networkidle");
    const widths = await zoomedPage.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    verify(widths.content <= widths.viewport + 1, `200% zoom ${route}: no horizontal overflow (${widths.content} <= ${widths.viewport})`);
  }

  // --- Status announcements during save and export ---------------------------
  const statusRole = await desktopPage.getByTestId("save-status").first().getAttribute("role");
  verify(statusRole === "status", "save pill announces as role=status for screen readers");
  await desktopPage.goto(`${baseUrl}/versions`);
  const exportButton = desktopPage.getByRole("button", { name: "Export complete pack" });
  await exportButton.waitFor();
  const downloadPromise = desktopPage.waitForEvent("download");
  await exportButton.click();
  await downloadPromise;
  const exportNotice = desktopPage.getByRole("status").filter({ hasText: /Saved .* to your downloads/ });
  await exportNotice.first().waitFor();
  verify((await exportNotice.first().getAttribute("aria-live")) === "polite", "export confirmation is announced via role=status aria-live=polite");

  console.log(`\n${passes} passed, 0 failed`);
} finally {
  for (const instance of browsers) await instance.close().catch(() => {});
  server.kill();
}
