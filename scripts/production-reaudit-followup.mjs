import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "playwright";
import JSZip from "jszip";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const BASE_URL = (process.env.AUDIT_BASE_URL || "https://career-forge-lite.vercel.app").replace(/\/$/, "");
const STORAGE_KEY = "career-forge-command-center-v1";
const OUT = path.resolve(process.env.AUDIT_FOLLOWUP_OUTPUT_DIR || "audit-followup");
const EXTRACTED = path.join(OUT, "extracted");
const RENDERS = path.join(OUT, "renders");
const SHOTS = path.join(OUT, "screenshots");
for (const dir of [OUT, EXTRACTED, RENDERS, SHOTS]) fs.mkdirSync(dir, { recursive: true });

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

const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { evidenceRecord } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { sanitizeCommandCenterState } = loadTsModule(path.join(root, "src/lib/evidence-admissibility.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { createPackBundle } = loadTsModule(path.join(root, "src/lib/pack-export.ts"));
const { deriveDefensibilityReceipt } = loadTsModule(path.join(root, "src/lib/defensibility.ts"));

const results = { generatedAt: new Date().toISOString(), target: BASE_URL, checks: [], artifacts: [], notes: [] };
function check(name, pass, details = {}, severity = "") {
  const entry = { name, pass: Boolean(pass), severity, details };
  results.checks.push(entry);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${severity ? ` [${severity}]` : ""}${Object.keys(details).length ? ` — ${JSON.stringify(details)}` : ""}`);
  return pass;
}

const forbidden = [
  "No reliable numerical performance metrics",
  "Target roles: Product Operations Specialist; Implementation Specialist",
  "No SaaS employment",
  "No software implementation ownership",
  "No formal project-management credential"
];
function hits(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return forbidden.filter((needle) => text.includes(needle));
}

function stickyState() {
  const state = emptyState();
  state.pendingImportReviews = [{
    version: 1,
    id: "sticky-batch",
    proposals: [
      {
        id: "rejected-positive-metric",
        group: "metrics-outcomes",
        kind: "metric",
        label: "Metric or outcome",
        detail: "Reduced unresolved launch blockers from 12 to 3",
        sourceFilenames: [],
        sourceExcerpts: ["Reduced unresolved launch blockers from 12 to 3"],
        confidence: "high",
        status: "rejected",
        edited: false,
        likelyDuplicateOf: null
      },
      {
        id: "undecided-positive-metric",
        group: "metrics-outcomes",
        kind: "metric",
        label: "Metric or outcome",
        detail: "Maintained 40 verified troubleshooting articles",
        sourceFilenames: [],
        sourceExcerpts: ["Maintained 40 verified troubleshooting articles"],
        confidence: "high",
        status: "proposed",
        edited: false,
        likelyDuplicateOf: null
      }
    ],
    sourceFilenames: [],
    sourceFileCount: 1,
    retainSourceFilenames: false,
    importedAt: "2026-07-16T12:00:00.000Z",
    updatedAt: "2026-07-16T12:00:00.000Z"
  }];
  return state;
}

async function readState(page) {
  return page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
}

async function waitFor(page, predicate, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const state = await readState(page);
    if (predicate(state)) return state;
    await page.waitForTimeout(100);
  }
  throw new Error("Timed out waiting for state");
}

async function auditStickyRejection() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [STORAGE_KEY, stickyState()]);
    await page.goto(`${BASE_URL}/profile#review`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor();
    await page.screenshot({ path: path.join(SHOTS, "sticky-before.png"), fullPage: true });
    const input = page.locator('input[value="Maintained 40 verified troubleshooting articles"]');
    const group = input.locator("xpath=ancestor::section[1]");
    await group.getByRole("button", { name: "Approve section" }).click();
    let state = await waitFor(page, (current) => current.pendingImportReviews[0].proposals.some((item) => item.id === "undecided-positive-metric" && item.status === "approved"));
    const rejectedStatus = state.pendingImportReviews[0].proposals.find((item) => item.id === "rejected-positive-metric")?.status;
    const approvedStatus = state.pendingImportReviews[0].proposals.find((item) => item.id === "undecided-positive-metric")?.status;
    check("bulk section approval leaves a prior rejection untouched", rejectedStatus === "rejected", { rejectedStatus }, "P1");
    check("bulk section approval changes only the undecided item", approvedStatus === "approved", { approvedStatus }, "P1");
    await page.reload({ waitUntil: "networkidle" });
    state = await readState(page);
    check("rejection remains sticky after refresh", state.pendingImportReviews[0].proposals.find((item) => item.id === "rejected-positive-metric")?.status === "rejected", {}, "P1");
    await page.screenshot({ path: path.join(SHOTS, "sticky-after.png"), fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }
}

function buildStateAndPack() {
  const now = "2026-07-17T04:00:00.000Z";
  const state = emptyState();
  const make = (kind, detail, label = kind) => evidenceRecord(kind, detail, "manual", true, now, { label, sourceText: detail });
  const roleHeading = make("role", "Product Operations Coordinator · Acme · 2022–2025", "Employment record");
  const responsibility = make("responsibility", "Coordinated weekly release readiness across product, support, and engineering", "Responsibility");
  const metric = make("metric", "Reduced unresolved launch blockers from 12 to 3 by maintaining a cross-functional tracker", "Metric");
  const proof = make("proof", "Documented product issues and routed priority defects to owners", "Proof");
  const toolJira = make("tool", "Jira", "Tool");
  const toolNotion = make("tool", "Notion", "Tool");
  const toolSheets = make("tool", "Google Sheets", "Tool");
  const education = make("education", "Bachelor's degree, Earlham College", "Education");
  const preference = make("goal", "Target roles: Product Operations Specialist; Implementation Specialist", "Target preference");
  const gapMetrics = make("constraint", "No reliable numerical performance metrics beyond the launch blocker count", "Constraint");
  const gapSaas = make("constraint", "No SaaS employment. No software implementation ownership. No formal project-management credential", "Constraint");
  const professional = [roleHeading, responsibility, metric, proof, toolJira, toolNotion, toolSheets, education];
  state.dossier = {
    ...state.dossier,
    identity: { fullName: "Jordan Ellis", email: "jordan@example.com", phone: "", location: "Chicago, IL", links: [] },
    roles: [{
      id: "role-1",
      title: "Product Operations Coordinator",
      employer: "Acme",
      startDate: "2022",
      endDate: "2025",
      current: false,
      responsibilities: [responsibility.detail, proof.detail],
      tools: ["Jira", "Notion", "Google Sheets"],
      outcomes: [metric.detail],
      evidenceIds: [roleHeading.id, responsibility.id, metric.id, proof.id, toolJira.id, toolNotion.id, toolSheets.id]
    }],
    education: [{ id: "education-1", institution: "Earlham College", credential: "Bachelor's degree", field: "", dates: "", evidenceIds: [education.id] }],
    responsibilities: [responsibility.detail, proof.detail],
    tools: ["Jira", "Notion", "Google Sheets"],
    outcomes: [metric.detail],
    metrics: [metric.detail],
    proofPoints: [metric.detail, proof.detail],
    constraints: [gapMetrics.detail, gapSaas.detail],
    targetRoleInterests: ["Product Operations Specialist", "Implementation Specialist"],
    approvedClaims: professional.map((item) => item.detail),
    evidence: [...professional, preference, gapMetrics, gapSaas],
    updatedAt: now
  };
  state.lanes = [
    { id: "lane-ops", title: "Junior Product Ops", status: "active", whyFit: "", resumeAngle: "Process coordination", proof: [], gaps: [], keywords: ["product operations", "launch", "coordination"], source: "custom", createdAt: now },
    { id: "lane-support", title: "Product Support Specialist", status: "active", whyFit: "", resumeAngle: "Issue resolution", proof: [], gaps: [], keywords: ["product support", "documentation", "triage"], source: "custom", createdAt: now }
  ];
  const sanitizedBefore = sanitizeCommandCenterState(state);
  const generated = generateResumePack(sanitizedBefore.dossier, sanitizedBefore.lanes, now);
  const withPack = sanitizeCommandCenterState({ ...sanitizedBefore, resumePacks: [generated] }, sanitizedBefore);
  return { state: withPack, pack: withPack.resumePacks[0] };
}

function claimPaths(variant) {
  const paths = [];
  const add = (pathName, value) => { if (String(value || "").trim()) paths.push(pathName); };
  add("summary", variant.resume.summary);
  variant.resume.coreSkills.forEach((value, index) => add(`coreSkills.${index}`, value));
  variant.resume.experience.forEach((role, roleIndex) => {
    add(`experience.${roleIndex}.heading`, [role.title, role.company, role.time].filter(Boolean).join(" · "));
    role.bullets.forEach((value, index) => add(`experience.${roleIndex}.bullets.${index}`, value));
  });
  add("education", variant.resume.education);
  add("linkedinHeadline", variant.resume.linkedinHeadline);
  add("linkedinSummary", variant.resume.linkedinSummary);
  return paths;
}

async function pdfText(filePath) {
  const document = await pdfjsLib.getDocument({ data: new Uint8Array(fs.readFileSync(filePath)), disableWorker: true }).promise;
  const parts = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const content = await page.getTextContent();
    parts.push(content.items.map((item) => item.str || "").join(" "));
  }
  return { pages: document.numPages, text: parts.join("\n") };
}

function renderPdf(filePath, prefix) {
  execFileSync("pdftoppm", ["-png", "-r", "144", filePath, prefix], { stdio: "pipe" });
}

function renderDocx(filePath, prefix) {
  const convertDir = path.join(RENDERS, "docx-pdf");
  fs.mkdirSync(convertDir, { recursive: true });
  execFileSync("libreoffice", ["--headless", "--convert-to", "pdf", "--outdir", convertDir, filePath], { stdio: "pipe", timeout: 120000 });
  const pdfPath = path.join(convertDir, `${path.basename(filePath, ".docx")}.pdf`);
  if (fs.existsSync(pdfPath)) renderPdf(pdfPath, prefix);
}

async function auditGeneratedPackAndExports() {
  const { state, pack } = buildStateAndPack();
  fs.writeFileSync(path.join(OUT, "source-generated-state.json"), JSON.stringify(state, null, 2));
  const professionalOutput = {
    variants: pack.variants,
    linkedinHeadlines: pack.linkedinHeadlines,
    linkedinAbout: pack.linkedinAbout,
    linkedinSkills: pack.linkedinSkills,
    masterProofBank: pack.masterProofBank,
    coverLetterFoundation: pack.coverLetterFoundation
  };
  check("source-generated professional outputs exclude preferences and negative gaps", hits(professionalOutput).length === 0, { hits: hits(professionalOutput) }, "P1");

  const receipts = pack.variants.map((variant) => ({
    title: variant.title,
    status: variant.status,
    receipt: deriveDefensibilityReceipt(variant, state.dossier),
    claimPaths: claimPaths(variant),
    referencePaths: variant.evidenceReferences.map((reference) => reference.claimPath)
  }));
  fs.writeFileSync(path.join(OUT, "defensibility-receipts.json"), JSON.stringify(receipts, null, 2));
  const incomplete = receipts.filter((item) => item.receipt.missingProvenance > 0);
  check("every newly generated variant retains complete provenance after sanitization", incomplete.length === 0, { incomplete }, "P1");
  check("newly generated pack would be exportable through the UI", incomplete.length === 0, { blockedVariants: incomplete.map((item) => item.title) }, "paid-outcome");

  const bundle = await createPackBundle(pack, state.dossier, state.lanes, ["pdf", "docx"]);
  const zipPath = path.join(OUT, bundle.filename);
  fs.writeFileSync(zipPath, Buffer.from(await bundle.blob.arrayBuffer()));
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  check("source export bundle contains four PDFs and four DOCX files", names.filter((name) => /\.pdf$/i.test(name)).length === 4 && names.filter((name) => /\.docx$/i.test(name)).length === 4, { names }, "artifact");

  for (const name of names) {
    const filePath = path.join(EXTRACTED, name);
    fs.writeFileSync(filePath, await zip.files[name].async("nodebuffer"));
    if (/\.pdf$/i.test(name)) {
      const parsed = await pdfText(filePath);
      const fileHits = hits(parsed.text);
      results.artifacts.push({ name, type: "pdf", pages: parsed.pages, hits: fileHits });
      renderPdf(filePath, path.join(RENDERS, `pdf-${path.basename(name, ".pdf")}`));
    } else if (/\.docx$/i.test(name)) {
      const text = (await mammoth.extractRawText({ buffer: fs.readFileSync(filePath) })).value;
      const fileHits = hits(text);
      results.artifacts.push({ name, type: "docx", hits: fileHits });
      renderDocx(filePath, path.join(RENDERS, `docx-${path.basename(name, ".docx")}`));
    } else if (/\.txt$/i.test(name)) {
      const text = fs.readFileSync(filePath, "utf8");
      results.artifacts.push({ name, type: "text", hits: hits(text), betaWarning: /review every claim|draft materials|public beta/i.test(text) });
    }
  }
  check("source-generated PDF, DOCX, and text artifacts exclude preferences and negative gaps", results.artifacts.every((item) => item.hits.length === 0), { artifacts: results.artifacts }, "P1");
  check("source-generated text artifacts carry review-before-use warnings", results.artifacts.filter((item) => item.type === "text").every((item) => item.betaWarning), { textArtifacts: results.artifacts.filter((item) => item.type === "text") }, "release-boundary");
}

await auditStickyRejection();
await auditGeneratedPackAndExports();

results.conclusion = {
  p1Failures: results.checks.filter((item) => !item.pass && item.severity === "P1").map((item) => item.name),
  paidOutcomeFailures: results.checks.filter((item) => !item.pass && item.severity === "paid-outcome").map((item) => item.name)
};
fs.writeFileSync(path.join(OUT, "followup-results.json"), JSON.stringify(results, null, 2));
const report = [
  "# Career Forge production re-audit follow-up",
  "",
  `Generated: ${results.generatedAt}`,
  `Target: ${results.target}`,
  "",
  "| Result | Severity | Check | Details |",
  "|---|---|---|---|",
  ...results.checks.map((item) => `| ${item.pass ? "PASS" : "FAIL"} | ${item.severity || "—"} | ${item.name.replace(/\|/g, "\\|")} | ${JSON.stringify(item.details).replace(/\|/g, "\\|")} |`),
  "",
  `P1 failures: ${results.conclusion.p1Failures.length}`,
  `Paid-outcome failures: ${results.conclusion.paidOutcomeFailures.length}`,
  ""
].join("\n");
fs.writeFileSync(path.join(OUT, "followup-report.md"), report);
