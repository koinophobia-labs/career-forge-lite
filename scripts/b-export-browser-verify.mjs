// Stream B self-contained end-to-end verification:
// identity export gate, identity quick-fill, full-document copy, working
// per-variant PDF/DOCX download with visible feedback, pack bundle export,
// /versions/view full-text copy, and the metrics uncertainty guard.
// Usage: node scripts/b-export-browser-verify.mjs
// Optional compatibility form:
//   node scripts/b-export-browser-verify.mjs <state-with-identity.json> <state-no-identity.json> <license.txt>
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";
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
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: absolute
  });
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

const port = 3240;
const baseUrl = `http://127.0.0.1:${port}`;
const fixtureArgs = process.argv.slice(2);
if (fixtureArgs.length !== 0 && fixtureArgs.length !== 3) {
  throw new Error("Pass either no fixture arguments or all three: <state-with-identity.json> <state-no-identity.json> <license.txt>");
}

function generatedState(withIdentity) {
  return execFileSync(
    process.execPath,
    ["scripts/b-seed-export-state.mjs", ...(withIdentity ? ["--with-identity"] : [])],
    { cwd: process.cwd(), encoding: "utf8" }
  );
}

const stateWithIdentity = fixtureArgs.length ? fs.readFileSync(fixtureArgs[0], "utf8") : generatedState(true);
const stateNoIdentity = fixtureArgs.length ? fs.readFileSync(fixtureArgs[1], "utf8") : generatedState(false);
let license = fixtureArgs.length ? fs.readFileSync(fixtureArgs[2], "utf8").trim() : "";
let testPublicKey = process.env.NEXT_PUBLIC_LICENSE_PUBLIC_KEY ?? "";
if (!fixtureArgs.length) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const privateB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
  testPublicKey = publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const { mintLicenseKey } = loadTsModule(path.join(root, "src/lib/server/license-mint.ts"));
  license = mintLicenseKey("career", "export-browser-test", Math.floor(Date.now() / 1000), privateB64) ?? "";
}

let passes = 0;
const verify = (condition, message) => { if (!condition) throw new Error(`FAIL ${message}`); passes += 1; console.log(`PASS ${message}`); };

const server = spawn(
  "npm",
  ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)],
  {
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_COMMERCE_MODE: "off",
      NEXT_PUBLIC_LICENSE_PUBLIC_KEY: testPublicKey
    },
    stdio: ["ignore", "pipe", "pipe"]
  }
);
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server.exitCode !== null) throw new Error(`Dev server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await delay(250);
  }
  throw new Error(`Dev server did not become ready.\n${serverOutput}`);
}

async function stopServer() {
  if (server.exitCode !== null) return;
  const signal = (name) => {
    try {
      if (process.platform !== "win32" && server.pid) process.kill(-server.pid, name);
      else server.kill(name);
    } catch {
      // The process may have exited between checks.
    }
  };
  signal("SIGTERM");
  await Promise.race([once(server, "exit").catch(() => undefined), delay(5_000)]);
  if (server.exitCode === null) signal("SIGKILL");
}

let browser;
let page;
const seed = async (state) => {
  await page.goto(baseUrl);
  await page.evaluate(([s, l]) => {
    localStorage.clear();
    localStorage.setItem("career-forge-command-center-v1", s);
    if (l) localStorage.setItem("career-forge-license-v1", l);
  }, [state, license]);
};

try {
  await Promise.race([
    waitForServer(),
    once(server, "exit").then(([code]) => { throw new Error(`Dev server exited with ${code}.\n${serverOutput}`); })
  ]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
  page = await context.newPage();

  // --- No identity: exports blocked with a real explanation, not a dead button ---
  await seed(stateNoIdentity);
  await page.goto(`${baseUrl}/versions`);
  await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).waitFor();
  const gateLinks = page.getByRole("link", { name: "Add your name first → one field, 10 seconds" });
  verify((await gateLinks.count()) >= 3, "identity gate replaces pack + variant export buttons");
  verify((await page.getByRole("button", { name: "Export complete career bundle" }).count()) === 0, "career bundle export button hidden while identity is empty");
  verify((await page.getByRole("button", { name: "Print / PDF" }).count()) === 0, "variant export buttons hidden while identity is empty");
  await page.getByText("Exports are paused so you never send a résumé without your name on it.", { exact: false }).waitFor();
  await gateLinks.first().click();
  await page.waitForURL(`${baseUrl}/profile#identity`);
  await page.locator("#identity").waitFor();
  verify(await page.locator("#identity").isVisible(), "gate link lands on the identity panel anchor");

  // --- Identity quick-fill callout on /profile ---
  await page.getByRole("heading", { name: "Put your name on your documents" }).waitFor();
  await page.getByRole("textbox", { name: "Name on your documents" }).fill("Riley Example");
  await page.getByRole("textbox", { name: "Email on your documents" }).fill("riley@example.com");
  await page.goto(`${baseUrl}/versions`);
  await page.getByRole("button", { name: "Export complete career bundle" }).waitFor();
  verify((await page.getByRole("link", { name: "Add your name first → one field, 10 seconds" }).count()) === 0, "quick-fill unblocks exports without re-forging");

  // --- Callout dismissal persists ---
  await seed(stateNoIdentity);
  await page.goto(`${baseUrl}/profile`);
  await page.getByRole("heading", { name: "Put your name on your documents" }).waitFor();
  await page.getByRole("button", { name: "Dismiss" }).click();
  verify((await page.getByRole("heading", { name: "Put your name on your documents" }).count()) === 0, "identity callout dismisses");
  await page.reload();
  await page.getByRole("heading", { name: "Build your Career Dossier once." }).waitFor();
  verify((await page.getByRole("heading", { name: "Put your name on your documents" }).count()) === 0, "identity callout dismissal persists across reload");

  // --- Uncertainty guard on metrics ---
  await page.getByLabel("Metrics & outcomes").fill("I don't know my numbers\nCut backlog 30% in one quarter");
  await page.getByRole("button", { name: "Save metrics & outcomes" }).click();
  await page.getByText("skip it or add what you CAN defend", { exact: false }).waitFor();
  const savedMetrics = await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).dossier.metrics);
  verify(savedMetrics.length === 1 && savedMetrics[0] === "Cut backlog 30% in one quarter", "uncertainty statements are not saved as metric evidence");
  const savedEvidence = await page.evaluate(() => JSON.parse(localStorage.getItem("career-forge-command-center-v1")).dossier.evidence.map((item) => item.detail));
  verify(!savedEvidence.some((detail) => /don'?t know my numbers/i.test(detail)), "uncertainty statements never enter the evidence record");

  // --- With identity: copy is the full document, downloads give feedback ---
  await seed(stateWithIdentity);
  await page.goto(`${baseUrl}/versions`);
  await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).waitFor();
  await page.getByRole("button", { name: "Copy", exact: true }).first().click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  verify(copied.startsWith("Riley Example") && copied.includes("riley@example.com"), "variant copy starts with the identity header");
  verify(copied.includes("CORE SKILLS") && copied.includes("EXPERIENCE") && copied.includes("- "), "variant copy contains skills and experience bullets");
  verify(await page.getByText("Copied the complete document", { exact: false }).isVisible(), "copy gives visible feedback");

  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Print / PDF" }).first().click();
  const pdfFile = await pdfDownload;
  verify(pdfFile.suggestedFilename() === "Riley-Example-Resume-Product-Support-ATS.pdf", "PDF download carries current identity in the filename");
  await page.getByText(`Saved ${pdfFile.suggestedFilename()} to your downloads`, { exact: false }).waitFor();
  verify(true, "PDF export shows a visible confirmation (never a silent no-op)");

  const docxDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "DOCX" }).first().click();
  verify((await docxDownload).suggestedFilename().endsWith(".docx"), "DOCX download works from the pack card");

  const zipDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export complete career bundle" }).click();
  verify((await zipDownload).suggestedFilename() === "Riley-Example-Resume-Pack.zip", "pack bundle exports with identity-based filename");

  // --- /versions/view copies the whole document, not the summary sentence ---
  await page.goto(`${baseUrl}/versions/view?id=version-snapshot-1`);
  await page.getByRole("button", { name: "Copy plain text" }).waitFor();
  await page.getByRole("button", { name: "Copy plain text" }).click();
  await page.getByRole("button", { name: "Copied" }).waitFor();
  const viewCopy = await page.evaluate(() => navigator.clipboard.readText());
  verify(viewCopy.startsWith("Riley Example"), "view copy includes the name header");
  verify(viewCopy.includes("SUMMARY") && viewCopy.includes("CORE SKILLS") && viewCopy.includes("EXPERIENCE") && viewCopy.includes("EDUCATION"), "view copy includes every rendered section");
  verify(viewCopy.includes("- Resolved customer questions"), "view copy includes experience bullets");

  console.log(`\n${passes} browser checks passed`);
} finally {
  await browser?.close();
  await stopServer();
}
