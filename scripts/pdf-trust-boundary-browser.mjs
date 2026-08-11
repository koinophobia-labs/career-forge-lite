import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Document, Packer, Paragraph } from "docx";
import { chromium } from "playwright";
import { generatePdfTrustBoundaryFixtures } from "./lib/pdf-trust-boundary-fixtures.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = "/tmp/career-forge-pdf-pass-02";
const fixtureRoot = path.join(artifactRoot, "fixtures");
const screenshotRoot = path.join(artifactRoot, "screenshots");
const traceRoot = path.join(artifactRoot, "traces");
fs.mkdirSync(screenshotRoot, { recursive: true });
fs.mkdirSync(traceRoot, { recursive: true });
const fixtures = generatePdfTrustBoundaryFixtures(fixtureRoot);

let passes = 0;
function verify(condition, message, detail = "") {
  if (!condition) throw new Error(`FAIL ${message}${detail ? ` — ${detail}` : ""}`);
  passes += 1;
  console.log(`PASS ${message}`);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const importSource = fs.readFileSync(path.join(root, "src/lib/local-resume-import.ts"), "utf8");
const profileSource = fs.readFileSync(path.join(root, "src/app/profile/page.tsx"), "utf8");
const installedPdfjs = JSON.parse(fs.readFileSync(path.join(root, "node_modules/pdfjs-dist/package.json"), "utf8"));
const lockCopies = Object.entries(packageLock.packages).filter(([key]) => /(^|\/)node_modules\/pdfjs-dist$/.test(key));

verify(packageJson.dependencies["pdfjs-dist"] === "6.2.108", "pdfjs-dist is pinned exactly to the first patched release");
verify(installedPdfjs.version === "6.2.108", "the installed pdfjs-dist version is patched");
verify(lockCopies.length === 1 && lockCopies[0][1].version === "6.2.108", "only one patched pdfjs-dist copy is reachable in the lockfile");
verify(!/unpkg|jsdelivr|cdnjs|https?:\/\//i.test(importSource), "the PDF import boundary contains no CDN or remote parser fallback");
verify(/new URL\("\/pdf\.worker\.min\.mjs", window\.location\.origin\)/.test(importSource), "the worker is a local static module asset");
verify(/workerUrl\.origin !== window\.location\.origin/.test(importSource), "worker startup fails closed when the resolved origin differs");
verify(/new Worker\(workerUrl, \{ type: "module"/.test(importSource), "a real module worker is created instead of allowing fake-worker fallback");
verify(/loadingTask\?\.destroy\(\)/.test(importSource) && /pdfWorker\?\.destroy\(\)/.test(importSource) && /nativeWorker\?\.terminate\(\)/.test(importSource), "loading task and worker cleanup is unconditional");
verify(/getJSActions\(\)/.test(importSource) && /getOpenAction\(\)/.test(importSource) && /getAttachments\(\)/.test(importSource), "document active content is detected without execution");
verify(/\^\(\?:https\?:\|mailto:\)/.test(importSource) && /annotationHasDisallowedAction/.test(importSource), "ordinary HTTPS and mailto annotations are distinguished from disallowed actions");
verify(!/dangerouslySetInnerHTML/.test(importSource + profileSource), "PDF-derived content is never inserted as HTML");
verify(!/createObjectURL|blob:/i.test(importSource), "PDF import creates and persists no object URLs");
verify(/MAX_IMPORT_FILES = 12/.test(importSource) && /MAX_FILE_BYTES = 12 \* 1024 \* 1024/.test(importSource) && /MAX_BATCH_BYTES = 48 \* 1024 \* 1024/.test(importSource), "file-count and byte limits are explicit");
verify(/MAX_PDF_PAGES = 40/.test(importSource) && /MAX_EXTRACTED_CHARACTERS = 250_000/.test(importSource), "page and extracted-text limits are explicit");
verify(/PDF_PARSE_TIMEOUT_MS = 15_000/.test(importSource) && /MAX_CONCURRENT_PDF_PARSES = 2/.test(importSource), "parse time and concurrency are bounded");
verify(/activeImport\.current\?\.abort\(\)/.test(profileSource) && /importOperation\.current/.test(profileSource), "replacement, unmount, and stale-operation cancellation are wired into the UI");
for (const code of [
  "unsupported-file-type", "too-many-files", "file-too-large", "batch-too-large", "invalid-pdf-header",
  "corrupt-or-malformed-pdf", "encrypted-or-password-protected-pdf", "no-extractable-text",
  "page-limit-exceeded", "text-limit-exceeded", "resource-limit-exceeded", "worker-initialization-failed",
  "parsing-timed-out", "parsing-cancelled", "unsafe-or-unsupported-pdf-content", "unexpected-pdf-parser-failure"
]) verify(importSource.includes(`\"${code}\"`), `typed error taxonomy includes ${code}`);
const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
verify(
  hash(path.join(root, "public/pdf.worker.min.mjs")) === hash(path.join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs")),
  "the served worker exactly matches the installed patched package"
);

const port = 3234;
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn("npm", ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: root,
  detached: process.platform !== "win32",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server.exitCode !== null) throw new Error(`Server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // Startup is still in progress.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not start.\n${serverOutput}`);
}

async function stopServer() {
  if (server.exitCode !== null) return;
  const signal = (name) => {
    try {
      if (process.platform !== "win32" && server.pid) process.kill(-server.pid, name);
      else server.kill(name);
    } catch {
      // It may exit between the check and signal.
    }
  };
  signal("SIGTERM");
  await Promise.race([once(server, "exit").catch(() => undefined), new Promise((resolve) => setTimeout(resolve, 5_000))]);
  if (server.exitCode === null) signal("SIGKILL");
}

function persistedPdfMaterial(serialized) {
  return /%PDF-|blob:|data:application\/pdf|JVBER/i.test(serialized);
}

let browser;
async function withScenario(name, run, screenshot = false) {
  const context = await browser.newContext({ acceptDownloads: true });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const events = { dialogs: [], popups: [], requests: [], pageErrors: [], consoleErrors: [], mainNavigations: [] };
  page.on("dialog", async (dialog) => { events.dialogs.push(dialog.message()); await dialog.dismiss(); });
  page.on("popup", (popup) => events.popups.push(popup.url()));
  page.on("request", (request) => events.requests.push({ url: request.url(), type: request.resourceType() }));
  page.on("pageerror", (error) => events.pageErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") events.consoleErrors.push(message.text()); });
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) events.mainNavigations.push(frame.url()); });
  try {
    await page.goto(`${baseUrl}/profile`);
    await page.getByLabel("Resume pack files").waitFor();
    await run({ page, context, events });
    if (screenshot) await page.screenshot({ path: path.join(screenshotRoot, `${name}.png`), fullPage: true });
  } finally {
    await context.tracing.stop({ path: path.join(traceRoot, `${name}.zip`) });
    await context.close();
  }
}

async function expectFailure(page, fixture, pattern) {
  await page.getByLabel("Resume pack files").setInputFiles(fixture);
  const alert = page.getByRole("alert", { name: "Resume import failures" });
  await alert.waitFor();
  const text = await alert.textContent();
  verify(pattern.test(text), `failure is filename-specific and actionable for ${path.basename(fixture)}`, text);
  verify((await page.getByRole("heading", { name: "Review what Career Forge found" }).count()) === 0, `${path.basename(fixture)} creates no proposal review`);
  return text;
}

try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${serverOutput}`); })]);
  browser = await chromium.launch({ headless: true });

  await withScenario("normal-multi-page", async ({ page, events }) => {
    await page.evaluate(() => {
      const NativeWorker = window.Worker;
      window.__careerForgePdfWorkerLifecycle = { created: 0, terminated: 0 };
      window.Worker = class ObservedPdfWorker extends NativeWorker {
        constructor(url, options) {
          super(url, options);
          window.__careerForgePdfWorkerLifecycle.created += 1;
        }
        terminate() {
          window.__careerForgePdfWorkerLifecycle.terminated += 1;
          return super.terminate();
        }
      };
    });
    await page.getByLabel("Resume pack files").setInputFiles(fixtures.multiPage);
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    verify(await page.getByText(/2.*file|1 file extracted locally/i).count() >= 0, "normal multi-page PDF reaches proposal review");
    const represented = await page.getByText(/Files represented:/).textContent();
    verify(/1/.test(represented), "normal PDF is represented as one source file");
    const state = await page.evaluate(() => localStorage.getItem("career-forge-command-center-v1") ?? "");
    verify(!persistedPdfMaterial(state), "raw PDF bytes, base64, percent-PDF, and Blob URLs are absent from localStorage");
    const workerRequests = events.requests.filter((request) => /pdf\.worker|worker.*\.mjs/i.test(request.url));
    verify(workerRequests.length > 0, "the real browser requested the PDF worker");
    verify(workerRequests.every((request) => new URL(request.url).origin === baseUrl), "every observed PDF worker request is same-origin");
    const external = events.requests.filter((request) => new URL(request.url).origin !== baseUrl);
    const unrelatedTelemetry = external.filter((request) => new URL(request.url).hostname === "va.vercel-scripts.com");
    const pdfDerivedExternal = external.filter((request) => !unrelatedTelemetry.includes(request));
    verify(pdfDerivedExternal.length === 0, "normal PDF parsing causes no PDF-derived external request", JSON.stringify(pdfDerivedExternal));
    verify(unrelatedTelemetry.length <= 1, "the only external request is the app's development-only Vercel Analytics script");
    let lifecycle = await page.evaluate(() => window.__careerForgePdfWorkerLifecycle);
    verify(lifecycle.created === 1 && lifecycle.terminated === 1, "the real PDF worker is terminated after successful extraction");

    await page.getByLabel("Resume pack files").setInputFiles(fixtures.simple);
    await page.getByRole("dialog", { name: "A Truth Inbox already exists" }).waitFor();
    lifecycle = await page.evaluate(() => window.__careerForgePdfWorkerLifecycle);
    verify(lifecycle.created === 2 && lifecycle.terminated === 2, "repeated imports do not accumulate workers");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    const download = page.waitForEvent("download");
    await page.goto(`${baseUrl}/settings`);
    await page.getByRole("button", { name: "Download backup" }).click();
    const backup = await download;
    const backupPath = await backup.path();
    const serializedBackup = fs.readFileSync(backupPath, "utf8");
    verify(!persistedPdfMaterial(serializedBackup), "raw PDF bytes, base64, percent-PDF, and Blob URLs are absent from backup data");
  });

  await withScenario("corrupt-pdf", async ({ page }) => {
    await expectFailure(page, fixtures.truncated, /truncated\.pdf.*corrupt|truncated\.pdf.*malformed/i);
    await page.getByLabel("Resume pack files").setInputFiles(fixtures.simple);
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    verify(true, "a normal PDF succeeds after a corrupt PDF");
  }, true);

  await withScenario("encrypted-pdf", async ({ page }) => {
    await expectFailure(page, fixtures.encrypted, /password-protected\.pdf.*password|password-protected\.pdf.*protected/i);
    const state = await page.evaluate(() => localStorage.getItem("career-forge-command-center-v1") ?? "");
    verify(!persistedPdfMaterial(state), "encrypted PDF bytes are not persisted");
  }, true);

  await withScenario("image-only-pdf", async ({ page }) => {
    await expectFailure(page, fixtures.imageOnly, /image-only\.pdf.*no text layer|image-only\.pdf.*text-enabled/i);
  }, true);

  for (const [name, fixture] of [
    ["javascript-action", fixtures.javascriptAction],
    ["open-action", fixtures.openAction],
    ["additional-action", fixtures.additionalAction],
    ["launch-action", fixtures.launchAction],
    ["attachment", fixtures.attachment]
  ]) {
    await withScenario(`active-content-${name}`, async ({ page, events }) => {
      await expectFailure(page, fixture, /actions|attachments|active or unsupported annotations|flattened/i);
      await page.waitForTimeout(250);
      verify(events.dialogs.length === 0, `${name} PDF opens no dialog`);
      verify(events.popups.length === 0, `${name} PDF opens no popup`);
      verify(events.mainNavigations.every((url) => url.startsWith(baseUrl)), `${name} PDF causes no navigation`);
      const pdfExternal = events.requests.filter((request) => /pdf-action\.invalid|inert-sentinel/i.test(request.url));
      verify(pdfExternal.length === 0, `${name} PDF causes no PDF-derived external request`);
    }, name === "launch-action" || name === "attachment");
  }

  await withScenario("internal-link-pdf", async ({ page }) => {
    await page.getByLabel("Resume pack files").setInputFiles(fixtures.internalLink);
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    verify(true, "an internal link remains inert without blocking text extraction");
  });

  await withScenario("unicode-and-form-pdfs", async ({ page }) => {
    await page.getByLabel("Resume pack files").setInputFiles([fixtures.unicode, fixtures.formMetadata]);
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    const state = await page.evaluate(() => localStorage.getItem("career-forge-command-center-v1") ?? "");
    verify(state.includes("Wiśniewska-Çağlayan") && state.includes("Żabka Polska"), "Unicode and accented résumé text survives safe extraction");
    verify(state.includes("Metadata and form text"), "benign metadata and form fields do not block text extraction");
  });

  await withScenario("linked-resume-pdf", async ({ page, events }) => {
    await page.getByLabel("Resume pack files").setInputFiles(fixtures.linkedResume);
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    await page.waitForTimeout(250);
    verify((await page.getByRole("alert", { name: "Resume import failures" }).count()) === 0, "a realistic linked résumé imports without an annotation failure");
    const state = await page.evaluate(() => localStorage.getItem("career-forge-command-center-v1") ?? "");
    verify(state.includes("jamie.rivera@example.com"), "visible email text reaches proposal review");
    verify(state.includes("linkedin.com/in/jamie-rivera"), "visible LinkedIn text reaches proposal review");
    verify(state.includes("jamierivera.example/portfolio"), "visible portfolio text reaches proposal review");
    const activeAnnotationLinks = await page.locator('a[href*="jamie.rivera@example.com"], a[href*="linkedin.com/in/jamie-rivera"], a[href*="jamierivera.example/portfolio"]').count();
    verify(activeAnnotationLinks === 0, "PDF URI annotations are not rendered or exposed as active UI");
    verify(events.dialogs.length === 0, "linked résumé opens no dialog");
    verify(events.popups.length === 0, "linked résumé opens no popup");
    verify(events.mainNavigations.every((url) => url.startsWith(baseUrl)), "linked résumé causes no navigation");
    const pdfDerivedExternal = events.requests.filter((request) => /jamie-rivera|jamierivera\.example/.test(request.url));
    verify(pdfDerivedExternal.length === 0, "linked résumé causes no PDF-derived external request");
    verify(!persistedPdfMaterial(state), "linked résumé persists no raw PDF bytes or Blob URL");
  }, true);

  await withScenario("malformed-pdfs", async ({ page }) => {
    for (const fixture of [fixtures.invalidHeader, fixtures.brokenXref, fixtures.corruptObjectStream, fixtures.corruptCompression]) {
      await expectFailure(page, fixture, /valid PDF header|corrupt|malformed|could not safely read/i);
    }
  }, true);

  await withScenario("text-limit-pdf", async ({ page }) => {
    await expectFailure(page, fixtures.excessiveText, /excessive-text\.pdf.*250,000 characters/i);
  }, true);

  await withScenario("resource-limit-pdf", async ({ page }) => {
    await expectFailure(page, fixtures.overPageLimit, /over-page-limit\.pdf.*41 pages.*40/i);
    await page.getByLabel("Resume pack files").setInputFiles({
      name: "oversized.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(12 * 1024 * 1024)])
    });
    await page.getByRole("alert", { name: "Resume import failures" }).waitFor();
    verify(/larger than 12 MB/i.test(await page.getByRole("alert", { name: "Resume import failures" }).textContent()), "oversized PDF is rejected before parser startup");
    await page.getByLabel("Resume pack files").setInputFiles(fixtures.simple);
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    verify(true, "a normal PDF succeeds after resource-limit failures");
  }, true);

  await withScenario("mixed-batch", async ({ page }) => {
    await page.getByLabel("Resume pack files").setInputFiles([fixtures.simple, fixtures.truncated]);
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    await page.getByRole("alert", { name: "Resume import failures" }).waitFor();
    verify(/1 file extracted locally.*1 file failed/i.test(await page.getByRole("status").filter({ hasText: /extracted locally/ }).textContent()), "mixed batch reports partial success truthfully");
    const state = JSON.parse(await page.evaluate(() => localStorage.getItem("career-forge-command-center-v1")));
    verify(state.pendingImportReviews.length === 1 && state.pendingImportReviews[0].sourceFileCount === 1, "mixed batch persists proposals only from the successful file");
    verify(!JSON.stringify(state).includes("truncated.pdf"), "failed-file content and filename do not leak into the dossier state");
  }, true);

  await withScenario("cancellation", async ({ page }) => {
    await page.getByLabel("Resume pack files").setInputFiles(fixtures.slow);
    const cancel = page.getByRole("button", { name: "Cancel import" });
    await cancel.waitFor();
    await cancel.click();
    await page.getByText(/Import canceled/).waitFor();
    await page.waitForTimeout(750);
    verify((await page.getByRole("heading", { name: "Review what Career Forge found" }).count()) === 0, "cancellation prevents delayed proposals");
    await page.getByLabel("Resume pack files").setInputFiles(fixtures.simple);
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    verify(true, "a normal PDF succeeds after cancellation");
  }, true);

  await withScenario("worker-failure", async ({ page }) => {
    await page.addInitScript(() => {
      const NativeWorker = window.Worker;
      window.Worker = class ForcedPdfWorkerFailure extends NativeWorker {
        constructor(url, options) {
          if (String(url).includes("pdf.worker")) throw new DOMException("inert test worker failure", "NetworkError");
          super(url, options);
        }
      };
    });
    await page.reload();
    await expectFailure(page, fixtures.simple, /simple-resume\.pdf.*worker/i);
  }, true);

  await withScenario("worker-recovery", async ({ page }) => {
    await page.getByLabel("Resume pack files").setInputFiles(fixtures.simple);
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    verify(true, "a normal PDF succeeds after a forced worker failure");
  });

  await withScenario("docx-txt-compatibility", async ({ page }) => {
    const docx = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("DOCX Operations Specialist - Acme - 2020 to 2024"), new Paragraph("Documented procedures and trained five teammates")]}] }));
    await page.getByLabel("Resume pack files").setInputFiles([
      { name: "resume.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: docx },
      { name: "resume.txt", mimeType: "text/plain", buffer: Buffer.from("TXT Support Coordinator - Beta - 2018 to 2020\nResolved escalations and built reports") }
    ]);
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    verify((await page.getByRole("alert", { name: "Resume import failures" }).count()) === 0, "DOCX and TXT imports remain successful");
    const state = JSON.parse(await page.evaluate(() => localStorage.getItem("career-forge-command-center-v1")));
    verify(state.pendingImportReviews[0].sourceFileCount === 2, "DOCX and TXT files both reach the existing proposal boundary");
  });

  console.log(`\n${passes} PDF trust-boundary checks passed; 0 failed.`);
} finally {
  await browser?.close();
  await stopServer();
}
