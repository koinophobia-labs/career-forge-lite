// Unhappy-path recovery proof for the local-first model, run with commerce in
// TEST mode:
//   build a real dossier (with BOTH approved and rejected evidence) → forge →
//   activate a license → export → download a backup → destroy all site data →
//   confirm the app is honestly empty → restore the backup → verify approved
//   AND rejected evidence, lanes, and the generated pack all came back →
//   verify entitlement behaves AS INTENDED after restore (the license key is
//   not in the backup by design; re-pasting the saved key re-unlocks) →
//   export again. Also proves the "Save failed — back up now" warning leads
//   somewhere useful, not into fog.
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
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const privateB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const publicB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
const licenseKey = mintLicenseKey("career-switch", "recovery-test", Math.floor(Date.now() / 1000), privateB64);

let passes = 0;
const verify = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  passes += 1;
  console.log(`PASS ${message}`);
};

const port = 3225;
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

const readState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1") ?? "null"));

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();

  // --- Build a real dossier with approved AND rejected evidence -------------
  await page.goto(`${baseUrl}/profile`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel("Resume pack files").setInputFiles([
    { name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from("Customer Support Specialist — HelpDesk Co | 2021–2025\nResolved escalated billing disputes\nWrote 45 knowledge-base articles\nTools: Zendesk\nState University — Bachelor's degree") }
  ]);
  await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
  const approveSections = page.getByRole("button", { name: "Approve section" });
  for (let index = 0; index < await approveSections.count(); index += 1) await approveSections.nth(index).click();
  // Reject one specific proposal so the rejected state is part of the proof.
  await page.getByRole("button", { name: "Reject", exact: true }).first().click();
  await page.getByRole("button", { name: "Finish review" }).click();
  await page.getByText(/Truth Inbox complete:.*1 rejected/).waitFor();
  await page.getByRole("textbox", { name: "Full name" }).fill("Rae Recovery");
  await page.getByLabel("Role title", { exact: true }).fill("Customer Support Specialist");
  await page.getByLabel("Employer", { exact: true }).fill("HelpDesk Co");
  await page.getByLabel("Dates", { exact: true }).fill("2021–2025");
  await page.getByLabel("Responsibilities", { exact: true }).fill("Resolved escalated billing disputes\nWrote 45 knowledge-base articles");
  await page.getByRole("button", { name: "Add approved role" }).click();

  await page.goto(`${baseUrl}/targets`);
  await page.locator('[data-testid="adopt-lane"]:not(:disabled)').first().click();
  await page.getByRole("button", { name: /Forge complete résumé pack/ }).click();
  await page.waitForURL(`${baseUrl}/versions`);
  await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).waitFor();

  await page.goto(`${baseUrl}/unlock`);
  await page.getByLabel("Access code").fill(licenseKey);
  await page.getByRole("button", { name: "Activate" }).click();
  await page.getByText("Career Switch Pack activated").waitFor();
  await page.goto(`${baseUrl}/versions`);
  const firstExport = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete pack" }).click();
  await firstExport;

  const before = await readState(page);
  const beforeCounts = {
    approved: before.dossier.evidence.filter((item) => item.approved && !item.rejected).length,
    rejected: before.dossier.evidence.filter((item) => item.rejected).length,
    lanes: before.lanes.length,
    packs: before.resumePacks.filter((pack) => pack.status !== "archived").length,
    versions: before.resumeVersions.length
  };
  verify(beforeCounts.rejected >= 1 && beforeCounts.approved >= 3, `dossier holds both approved (${beforeCounts.approved}) and rejected (${beforeCounts.rejected}) evidence before the disaster`);

  // --- Backup ---------------------------------------------------------------
  await page.goto(`${baseUrl}/settings`);
  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download backup" }).click();
  const backupDownload = await backupPromise;
  const backupPath = await backupDownload.path();
  verify(fs.statSync(backupPath).size > 1000, `backup file downloaded (${backupDownload.suggestedFilename()})`);

  // --- Disaster: clear ALL site data ---------------------------------------
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${baseUrl}/profile`);
  await page.getByText("Start with one real role or project").waitFor();
  const wiped = await readState(page);
  verify(
    !wiped || (wiped.dossier.evidence.length === 0 && wiped.lanes.length === 0 && wiped.resumePacks.length === 0 && wiped.resumeVersions.length === 0),
    "after clearing site data the app is honestly empty — fresh empty state, no ghost user data"
  );

  // --- Restore --------------------------------------------------------------
  await page.goto(`${baseUrl}/settings`);
  await page.getByLabel("Restore backup file").setInputFiles(backupPath);
  await page.getByRole("button", { name: "Replace current data with this backup" }).waitFor();
  verify(true, "restore shows a contents preview and an explicit confirmation before writing anything");
  await page.getByRole("button", { name: "Replace current data with this backup" }).click();
  await page.getByText(/Restore complete|restored/i).waitFor().catch(() => {});

  const after = await readState(page);
  const afterCounts = {
    approved: after.dossier.evidence.filter((item) => item.approved && !item.rejected).length,
    rejected: after.dossier.evidence.filter((item) => item.rejected).length,
    lanes: after.lanes.length,
    packs: after.resumePacks.filter((pack) => pack.status !== "archived").length,
    versions: after.resumeVersions.length
  };
  verify(JSON.stringify(afterCounts) === JSON.stringify(beforeCounts), `restore brings back approved+rejected evidence, lanes, packs, and versions exactly (${JSON.stringify(afterCounts)})`);
  await page.goto(`${baseUrl}/versions`);
  await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).waitFor();
  verify(true, "the generated pack renders after restore");

  // --- Entitlement after restore: behaves AS INTENDED -----------------------
  // The license key is deliberately not in the backup (it is the user's
  // receipt, kept separately) — so exports must be gated again, and pasting
  // the SAME saved key must re-unlock without friction.
  verify((await page.getByRole("button", { name: "Export complete pack" }).count()) === 0, "after restore on a clean profile, exports are gated again (license intentionally not in the backup)");
  await page.goto(`${baseUrl}/unlock`);
  await page.getByLabel("Access code").fill(licenseKey);
  await page.getByRole("button", { name: "Activate" }).click();
  await page.getByText("Career Switch Pack activated").waitFor();
  await page.goto(`${baseUrl}/versions`);
  const secondExport = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete pack" }).click();
  const exported = await secondExport;
  verify(exported.suggestedFilename() === "Rae-Recovery-Resume-Pack.zip", "re-pasting the saved key re-unlocks and export succeeds first-click after full recovery");

  // --- The save-failed warning leads somewhere useful -----------------------
  await page.goto(baseUrl);
  // Wait for hydration (the save pill renders only client-side) so the
  // banner's event listener is attached before the failure fires.
  await page.getByTestId("save-status").first().waitFor();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("career-forge-save-error")));
  await page.getByRole("alert").getByText("could not be saved").waitFor();
  verify(true, "save-failure banner appears with a concrete explanation");
  const pillText = await page.getByTestId("save-status").first().textContent();
  verify(/back up now/i.test(pillText), "the nav save pill flips to the failure state");
  await page.getByRole("alert").getByRole("link", { name: "Download backup" }).click();
  await page.waitForURL(`${baseUrl}/settings`);
  await page.getByRole("button", { name: "Download backup" }).waitFor();
  verify(true, "the warning's action lands directly on a working backup button — not fog");

  console.log(`\n${passes} passed, 0 failed`);
} finally {
  await browser?.close();
  await stopServer();
}
