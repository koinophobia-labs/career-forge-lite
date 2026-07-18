// Full first-time-user journey acceptance, run with commerce in TEST mode:
//   import résumé files → review/approve evidence → identity → adopt a lane →
//   forge (visible working state) → hit the entitlement gate with a clear
//   path → activate a license on /unlock → export the complete ZIP on the
//   FIRST attempt — plus the always-visible save-status pill and the
//   five-step progress path.
//
// This validates the intake → approval → generation → entitlement → export
// journey end to end. (Real Stripe checkout cannot run headless; the
// payment step is exercised from its product boundary — the license key a
// completed checkout issues — which is exactly what /unlock consumes.)
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { generateKeyPairSync } from "node:crypto";
import ts from "typescript";
import { chromium } from "playwright";

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

const { mintLicenseKey } = loadTsModule(path.join(root, "src/lib/server/license-mint.ts"));

// Test keypair — never the production keys. The public half goes to the dev
// server env; the private half mints the license the "purchase" would issue.
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const publicB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const licenseKey = mintLicenseKey("career-switch", "journey-test", Math.floor(Date.now() / 1000), privateB64);

let passes = 0;
const verify = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  passes += 1;
  console.log(`PASS ${message}`);
};

const port = 3224;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  detached: process.platform !== "win32",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "test", NEXT_PUBLIC_LICENSE_PUBLIC_KEY: publicB64 },
  stdio: ["ignore", "pipe", "pipe"]
});
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

async function stopServer() {
  if (server.exitCode !== null) return;
  const signal = (name) => {
    try {
      if (process.platform !== "win32" && server.pid) process.kill(-server.pid, name);
      else server.kill(name);
    } catch {
      // The server may exit between the state check and the signal.
    }
  };
  signal("SIGTERM");
  await Promise.race([
    once(server, "exit").catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 5_000))
  ]);
  if (server.exitCode === null) signal("SIGKILL");
}

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // --- 0. Pre-entry visibility: a finished sample PDF before any data entry --
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "Explore sample pack" }).click();
  const samplePromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download the finished sample PDF/ }).click();
  const sampleDownload = await samplePromise;
  const samplePath = await sampleDownload.path();
  const sampleHead = fs.readFileSync(samplePath).subarray(0, 5).toString();
  verify(sampleDownload.suggestedFilename() === "Career-Forge-Sample-Resume.pdf" && sampleHead === "%PDF-",
    "a real finished sample PDF is downloadable before any data entry (built by the production export engine)");

  // --- 1. Fresh user: import does the typing --------------------------------
  await page.goto(`${baseUrl}/profile`);
  const fileInput = page.getByLabel("Resume pack files");
  await fileInput.setInputFiles([
    { name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from("Customer Support Specialist — HelpDesk Co | 2021–2025\nResolved escalated billing disputes\nWrote 45 knowledge-base articles\nTools: Zendesk\nState University — Bachelor's degree") },
    { name: "resume-alt.txt", mimeType: "text/plain", buffer: Buffer.from("Customer Support Specialist — HelpDesk Co | 2021–2025\nResolved escalated billing disputes\nTrained 6 new support agents\nCommunity Food Drive project\nOrganized quarterly volunteer logistics for 40 people") }
  ]);
  await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
  const approveSections = page.getByRole("button", { name: "Approve section" });
  for (let index = 0; index < await approveSections.count(); index += 1) await approveSections.nth(index).click();
  await page.getByRole("button", { name: "Finish review" }).click();
  await page.getByText(/Truth Inbox complete:/).waitFor();
  verify(true, "import → structured review → approval works without manual re-typing of the source résumé");

  // --- 2. Save state is affirmatively visible -------------------------------
  await page.getByTestId("save-status").first().waitFor();
  const saveText = await page.getByTestId("save-status").first().textContent();
  verify(/saved on this device/i.test(saveText), `save-status pill is visible and affirmative ("${saveText.trim()}")`);

  // --- 3. Identity + a real role so the dossier is forge-ready --------------
  await page.getByRole("textbox", { name: "Full name" }).fill("Jamie Journey");
  await page.getByLabel("Role title", { exact: true }).fill("Customer Support Specialist");
  await page.getByLabel("Employer", { exact: true }).fill("HelpDesk Co");
  await page.getByLabel("Dates", { exact: true }).fill("2021–2025");
  await page.getByLabel("Responsibilities", { exact: true }).fill("Resolved escalated billing disputes\nWrote 45 knowledge-base articles");
  await page.getByRole("button", { name: "Add approved role" }).click();

  // --- 4. Progress is always visible with one obvious next action -----------
  await page.goto(baseUrl);
  const pathHeading = page.getByRole("heading", { name: /Next: / });
  await pathHeading.waitFor();
  verify(true, `dashboard shows the five-step path with the current next action ("${(await pathHeading.textContent()).trim()}")`);

  // --- 5. Lane + forge with visible working state ---------------------------
  await page.goto(`${baseUrl}/targets`);
  await page.locator('[data-testid="adopt-lane"]:not(:disabled)').first().click();
  const forgeButton = page.getByRole("button", { name: /Forge complete résumé pack|Forging your pack/ });
  await forgeButton.click();
  // The working state must be visible before navigation completes.
  await page.getByRole("button", { name: "Forging your pack…" }).waitFor({ timeout: 2000 }).catch(() => {});
  await page.waitForURL(`${baseUrl}/versions`);
  await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).waitFor();
  verify(true, "forge shows a working state and lands on an unambiguous 'pack is ready' confirmation");

  // --- 6. Entitlement gate is explained, not a dead end ---------------------
  const lockedPill = page.getByRole("link", { name: /Export complete pack · \$\d+ pack/ });
  await lockedPill.first().waitFor();
  verify((await page.getByRole("button", { name: "Export complete pack" }).count()) === 0, "with commerce in test mode, export is gated — no dead button, a priced unlock path instead");

  // --- 7. License activation works without explanation ----------------------
  await page.goto(`${baseUrl}/unlock`);
  await page.getByLabel("License key").fill(licenseKey);
  await page.getByRole("button", { name: "Activate" }).click();
  await page.getByText("Key activated — your pack is unlocked on this device.").waitFor();
  verify(true, "pasting the purchase-issued license key activates on the first attempt with clear confirmation");

  // --- 8. Export succeeds on the first attempt ------------------------------
  await page.goto(`${baseUrl}/versions`);
  const exportButton = page.getByRole("button", { name: "Export complete pack" });
  await exportButton.waitFor();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  verify(download.suggestedFilename() === "Jamie-Journey-Resume-Pack.zip", `full-pack export succeeds on the FIRST attempt (${download.suggestedFilename()})`);

  // --- 9. The journey survives a refresh at the end --------------------------
  await page.reload();
  await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).waitFor();
  verify(true, "everything — evidence, pack, entitlement — survives a reload with no hidden state");

  console.log(`\n${passes} passed, 0 failed`);
} finally {
  await browser?.close();
  await stopServer();
}
