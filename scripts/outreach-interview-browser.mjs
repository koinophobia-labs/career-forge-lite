// Outreach + interview acceptance against a real dev server. Proves:
// 1. Every outreach scenario's copy action stays disabled until the recipient,
//    company-specific reason, and approved evidence are supplied, with an
//    exact in-UI list of what is still missing — then produces a sendable
//    message with zero unresolved placeholders (verified from the actual
//    clipboard, not the DOM).
// 2. Interview prep grounds behavioral questions in story-substantial
//    evidence and routes thin claims and self-reported strengths to a
//    clearly-labeled "Needs more evidence" discovery section instead of
//    inviting a fabricated story.
// Sendable messages and the generated interview plan are preserved under
// docs/evidence/paid-beta-surge/ as PR evidence.
import fs from "node:fs";
import path from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
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

const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { mergeIntakeIntoDossier } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));

const OUTREACH_DIR = path.join(root, "docs/evidence/paid-beta-surge/outreach-examples");
const INTERVIEW_DIR = path.join(root, "docs/evidence/paid-beta-surge/interview-examples");
fs.rmSync(OUTREACH_DIR, { recursive: true, force: true });
fs.rmSync(INTERVIEW_DIR, { recursive: true, force: true });
fs.mkdirSync(OUTREACH_DIR, { recursive: true });
fs.mkdirSync(INTERVIEW_DIR, { recursive: true });

// A realistic dossier: substantial story-backed evidence for behavioral
// grounding, plus a deliberately thin claim that must become discovery.
const NOW = new Date().toISOString();
const intake = {
  ...initialIntake,
  fullName: "Riley Example", email: "riley@example.com", phone: "555-0100", website: "",
  targetJobTitle: "Product Support Specialist",
  currentTitle: "Retail Associate", currentCompany: "ShopCo", currentTime: "2022–Present",
  tools: "Zendesk, Excel",
  responsibilities: "Resolved customer questions across chat and phone\nDocumented escalations for the on-call engineer",
  outcomes: "Cut repeat-contact rate 18% by rewriting the top 20 help macros after tagging 400 tickets by root cause",
  customersServed: "40+ customers per shift",
  education: "Associate degree"
};
const baseDossier = mergeIntakeIntoDossier(emptyState().dossier, intake, "guided", true, "guided source", NOW);
// A deliberately thin, approved claim: real users save exactly this kind of
// one-liner, and it must surface as a discovery prompt, never a behavioral
// question inviting a fabricated story. (The profile is derived from the
// dossier on load, so the thin claim must live in dossier evidence.)
const thinClaim = {
  id: "ev-thin-claim", kind: "proof", label: "Proof point", detail: "Good with people",
  source: "guided", sourceText: "guided source", confidence: "medium",
  approved: true, rejected: false, sourceFilenames: [], sourceExcerpts: [],
  createdAt: NOW, updatedAt: NOW
};
const dossier = { ...baseDossier, evidence: [...baseDossier.evidence, thinClaim] };
const lanes = [{ id: "lane-0", title: "Product Support Specialist", status: "active", whyFit: "Verified fit", resumeAngle: "Angle", proof: [], gaps: ["No formal QA certification"], keywords: ["Zendesk"], source: "custom", createdAt: NOW }];
const seedState = JSON.stringify({ ...emptyState(), dossier, lanes });

let passes = 0;
const verify = (condition, message) => {
  if (!condition) throw new Error(`FAIL ${message}`);
  passes += 1;
  console.log(`PASS ${message}`);
};

const port = 3223;
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

// The six required sendable scenarios (UI labels from the scenario picker).
const SCENARIOS = [
  { key: "recruiter_intro", label: "Recruiter intro" },
  { key: "hiring_manager", label: "Hiring manager (active posting)" },
  { key: "referral_request", label: "Referral request" },
  { key: "informational", label: "Informational chat" },
  { key: "follow_up_1", label: "Follow-up #1" },
  { key: "application_bump", label: "Post-interview thank you" }
];
const SPECIFIC_REASON = "your support team publishes unusually candid incident postmortems";

let browser;
try {
  await Promise.race([waitForServer(), once(server, "exit").then(([code]) => { throw new Error(`Server exited with ${code}.\n${output}`); })]);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
  const page = await context.newPage();
  await page.goto(baseUrl);
  await page.evaluate((state) => { localStorage.clear(); localStorage.setItem("career-forge-command-center-v1", state); }, seedState);

  // --- Outreach: all six scenarios to a sendable, placeholder-free copy ------
  await page.goto(`${baseUrl}/outreach`);
  await page.getByRole("heading", { name: "Evidence-backed message draft" }).waitFor();

  // Save one real contact through the actual UI.
  await page.getByPlaceholder("Contact name").fill("Jordan Alvarez");
  await page.getByPlaceholder("Company").fill("Northbeam Software");
  await page.getByPlaceholder("e.g., Recruiter").fill("Support Team Lead");
  await page.getByRole("button", { name: /Add contact/i }).click();

  const scenarioSelect = page.locator("label:has-text('Scenario') select");
  const recipientSelect = page.locator("label:has-text('Recipient') select");
  const reasonInput = page.locator("label:has-text('Specific reason') textarea");
  const copyButton = page.getByRole("button", { name: /Copy completed draft|Complete the draft before copying|Copied/ });

  for (const scenario of SCENARIOS) {
    await scenarioSelect.selectOption({ label: scenario.label });
    await recipientSelect.selectOption({ label: "Choose a saved contact" });

    // Gate: with no recipient (and no reason where required), copying is
    // blocked and the UI names exactly what is still missing.
    await page.getByText(/Still required:/).waitFor();
    const missing = await page.getByText(/Still required:/).textContent();
    verify(await copyButton.isDisabled(), `${scenario.key}: copy is disabled while the draft is incomplete (${missing.trim()})`);
    verify(missing.includes("[Name]"), `${scenario.key}: the missing-field list names the unresolved placeholder(s)`);

    // Complete the draft through the real inputs.
    await recipientSelect.selectOption({ label: "Jordan Alvarez — Northbeam Software" });
    if (await reasonInput.count()) await reasonInput.fill(SPECIFIC_REASON);
    await page.getByText("Draft complete. Read it once for tone and accuracy before sending.").waitFor();
    verify(await copyButton.isEnabled(), `${scenario.key}: copy unlocks once every required field is supplied`);

    await copyButton.click();
    await page.getByRole("button", { name: "Copied" }).waitFor();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    verify(!/\[[^\]]+\]/.test(clipboard), `${scenario.key}: the copied message contains zero unresolved placeholders`);
    verify(clipboard.includes("Jordan Alvarez") || clipboard.includes("Northbeam"), `${scenario.key}: the copied message is addressed to the real recipient`);
    fs.writeFileSync(path.join(OUTREACH_DIR, `${scenario.key}.txt`), `SCENARIO: ${scenario.label}\n\n${clipboard}\n`);
  }

  // --- Interview: grounded behavioral vs labeled discovery -------------------
  await page.goto(`${baseUrl}/interview`);
  await page.getByRole("heading", { name: "Behavioral — from your own claims" }).waitFor();
  const pageText = await page.evaluate(() => document.querySelector("main")?.innerText ?? "");
  fs.writeFileSync(path.join(INTERVIEW_DIR, "interview-prep-plan.txt"), pageText);

  verify(pageText.includes("Needs more evidence"), "discovery section is present and clearly labeled");
  verify(pageText.includes("reminders to go add evidence, not questions to rehearse"), "discovery section explains it is not a rehearsal prompt");
  // The substantial, quantified story generates a behavioral deep-dive…
  verify(/repeat-contact rate/.test(pageText), "story-substantial evidence produced a behavioral question grounded in the real claim");
  // …while the thin claim and self-reported strength appear ONLY as discovery.
  const behavioralBlock = pageText.split("Behavioral — from your own claims")[1]?.split("Needs more evidence")[0] ?? "";
  const discoveryBlock = pageText.split("Needs more evidence")[1] ?? "";
  verify(!behavioralBlock.includes("Good with people"), "thin claim ('Good with people') is NOT presented as a behavioral question");
  verify(discoveryBlock.includes("Good with people"), "thin claim is routed to the labeled discovery section");
  verify(discoveryBlock.includes("40+ customers per shift"), "bare metric without a story is routed to discovery, not behavioral");
  verify(!behavioralBlock.includes("40+ customers per shift"), "bare metric does not appear as a behavioral question");

  console.log(`\n${passes} passed, 0 failed`);
} finally {
  await browser?.close();
  server.kill();
}
