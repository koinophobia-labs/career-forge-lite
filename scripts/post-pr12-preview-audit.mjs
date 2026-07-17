import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { chromium } from "playwright";
import JSZip from "jszip";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const BASE_URL = (process.env.AUDIT_BASE_URL || "https://career-forge-lite.vercel.app").replace(/\/$/, "");
const STORAGE_KEY = "career-forge-command-center-v1";
const OUT = path.resolve(process.env.AUDIT_OUTPUT_DIR || "post-pr12-audit");
fs.mkdirSync(OUT, { recursive: true });

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = new Map();
function loadTsModule(filePath) {
  const absolute = path.resolve(filePath);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const { outputText } = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022
    },
    fileName: absolute
  });
  const mod = { exports: {} };
  cache.set(absolute, mod);
  const localRequire = (request) => request.startsWith("@/")
    ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`))
    : request.startsWith(".")
      ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`))
      : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(
    localRequire,
    mod,
    mod.exports,
    path.dirname(absolute),
    absolute
  );
  return mod.exports;
}

const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { evidenceRecord } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const {
  sanitizeCareerDossier,
  sanitizeCommandCenterState,
  sanitizeResumeForProfessionalUse
} = loadTsModule(path.join(root, "src/lib/evidence-admissibility.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { createPackBundle } = loadTsModule(path.join(root, "src/lib/pack-export.ts"));
const { deriveDefensibilityReceipt } = loadTsModule(path.join(root, "src/lib/defensibility.ts"));

const results = { generatedAt: new Date().toISOString(), target: BASE_URL, checks: [], artifacts: [] };
function check(name, pass, details = {}, severity = "") {
  results.checks.push({ name, pass: Boolean(pass), details, severity });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${severity ? ` [${severity}]` : ""}${Object.keys(details).length ? ` — ${JSON.stringify(details)}` : ""}`);
}

const FORBIDDEN = [
  "No reliable numerical performance metrics",
  "Target roles: Product Operations Specialist; Implementation Specialist",
  "No full-time professional employment",
  "No SaaS employment",
  "No software implementation ownership",
  "No formal project-management credential"
];
function hits(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return FORBIDDEN.filter((needle) => text.includes(needle));
}

const NOW = "2026-07-17T06:30:00.000Z";
function make(kind, detail, label = kind) {
  return evidenceRecord(kind, detail, "manual", true, NOW, { label, sourceText: detail });
}

function buildFreshState() {
  const state = emptyState();
  const role = make("role", "Product Operations Coordinator · Acme · 2022–2025", "Employment record");
  const responsibility = make("responsibility", "Coordinated weekly release readiness across product, support, and engineering", "Responsibility");
  const metric = make("metric", "Reduced unresolved launch blockers from 12 to 3 by maintaining a cross-functional tracker", "Metric");
  const proof = make("proof", "Documented product issues and routed priority defects to owners", "Proof");
  const tools = ["Jira", "Notion", "Google Sheets"].map((tool) => make("tool", tool, "Tool"));
  const education = make("education", "Bachelor's degree · Earlham College", "Education");
  const professional = [role, responsibility, metric, proof, ...tools, education];
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
      tools: tools.map((item) => item.detail),
      outcomes: [metric.detail],
      evidenceIds: [role.id, responsibility.id, metric.id, proof.id, ...tools.map((item) => item.id)]
    }],
    education: [{ id: "education-1", institution: "Earlham College", credential: "Bachelor's degree", field: "", dates: "", evidenceIds: [education.id] }],
    responsibilities: [responsibility.detail, proof.detail],
    tools: tools.map((item) => item.detail),
    outcomes: [metric.detail],
    metrics: [metric.detail],
    proofPoints: [metric.detail, proof.detail],
    constraints: ["No reliable numerical performance metrics beyond the launch blocker count", "No SaaS employment. No software implementation ownership. No formal project-management credential"],
    targetRoleInterests: ["Product Operations Specialist", "Implementation Specialist"],
    approvedClaims: professional.map((item) => item.detail),
    evidence: professional,
    updatedAt: NOW
  };
  state.lanes = [
    { id: "lane-ops", title: "Junior Product Ops", status: "active", whyFit: "", resumeAngle: "Process coordination", proof: [], gaps: [], keywords: ["product operations", "launch", "coordination"], source: "custom", createdAt: NOW },
    { id: "lane-support", title: "Product Support Specialist", status: "active", whyFit: "", resumeAngle: "Issue resolution", proof: [], gaps: [], keywords: ["product support", "documentation", "triage"], source: "custom", createdAt: NOW }
  ];
  const sanitized = sanitizeCommandCenterState(state);
  const pack = generateResumePack(sanitized.dossier, sanitized.lanes, NOW);
  return sanitizeCommandCenterState({ ...sanitized, resumePacks: [pack] }, sanitized);
}

function buildMigrationState() {
  const state = buildFreshState();
  const preference = "Target roles: Product Operations Specialist; Implementation Specialist";
  const gap = "No reliable numerical performance metrics";
  state.resumePacks[0] = {
    ...state.resumePacks[0],
    lanePacks: state.resumePacks[0].lanePacks.map((item, index) => index === 0 ? { ...item, positioningPitch: preference } : item),
    linkedinHeadlines: [preference],
    linkedinAbout: `${preference}. ${gap}.`,
    masterProofBank: [preference, gap],
    coverLetterFoundation: preference,
    receipt: {
      ...state.resumePacks[0].receipt,
      laneFraming: [{ laneId: "lane-ops", angle: preference }],
      transferredClaims: [preference]
    }
  };
  return state;
}

async function pdfText(buffer) {
  const document = await pdfjsLib.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || "").join(" "));
  }
  return pages.join("\n");
}

async function sourceAndArtifactAudit() {
  const fresh = buildFreshState();
  const pack = fresh.resumePacks[0];
  const receipts = pack.variants.map((variant) => ({
    title: variant.title,
    status: variant.status,
    receipt: deriveDefensibilityReceipt(variant, fresh.dossier)
  }));
  check("fresh two-lane pack creates four variants", pack.variants.length === 4, { count: pack.variants.length }, "P1");
  check("all fresh variants retain complete provenance", receipts.every((item) => item.receipt.missingProvenance === 0), { receipts }, "P1");
  check("fresh pack remains UI-exportable", pack.status !== "needs-review" && pack.variants.every((variant) => variant.status !== "needs-review"), { packStatus: pack.status, variantStatuses: pack.variants.map((variant) => variant.status) }, "paid-outcome");
  check("fresh professional outputs exclude context-only strings", hits(pack).length === 0, { hits: hits(pack) }, "P1");

  const migrated = sanitizeCommandCenterState(buildMigrationState());
  check("migration scrubs lane positioning and receipt framing", migrated.resumePacks[0].lanePacks[0].positioningPitch === "" && migrated.resumePacks[0].receipt.laneFraming.length === 0, { lanePack: migrated.resumePacks[0].lanePacks[0], laneFraming: migrated.resumePacks[0].receipt.laneFraming }, "P1");
  check("migration scrubs LinkedIn and proof-bank metadata", hits({ headlines: migrated.resumePacks[0].linkedinHeadlines, about: migrated.resumePacks[0].linkedinAbout, proof: migrated.resumePacks[0].masterProofBank, cover: migrated.resumePacks[0].coverLetterFoundation }).length === 0, { hits: hits(migrated.resumePacks[0]) }, "P1");

  const projectEvidence = make("project", "School — Campus Accessibility Audit", "Project");
  const projectDossier = sanitizeCareerDossier({
    ...emptyState().dossier,
    evidence: [projectEvidence],
    approvedClaims: [projectEvidence.detail],
    projects: [{ id: "school-project", name: "School", organization: "Campus Accessibility Audit", dates: "2025", description: "Audited campus accessibility workflows", responsibilities: ["Documented access barriers"], tools: [], outcomes: [], metrics: [], links: [], defaultPlacement: "projects", evidenceIds: [projectEvidence.id] }]
  }).dossier;
  check("project-only semantics preserve the project name", projectDossier.projects[0]?.name === "Campus Accessibility Audit" && projectDossier.projects[0]?.organization === "School project", { project: projectDossier.projects[0] }, "P1");

  const safeResume = sanitizeResumeForProfessionalUse({
    summary: "Led store operations until I was laid off in June 2026, kept quality high. Handled escalations calmly.",
    coreSkills: ["Operations"],
    experience: [{ title: "Operations Lead", company: "Acme", time: "2022–2025", bullets: ["Handled escalations calmly"] }],
    education: "",
    linkedinHeadline: "Operations Lead",
    linkedinSummary: "Handled escalations calmly."
  });
  check("separation reason is stripped while safe sentence content survives", !/laid\s+off/i.test(safeResume.summary) && safeResume.summary.includes("kept quality high") && safeResume.summary.includes("Handled escalations calmly"), { summary: safeResume.summary }, "P1");

  const bundle = await createPackBundle(pack, fresh.dossier, fresh.lanes, ["pdf", "docx"]);
  const zip = await JSZip.loadAsync(await bundle.blob.arrayBuffer());
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  check("bundle contains four PDFs, four DOCX files, and two text companions", names.filter((name) => name.endsWith(".pdf")).length === 4 && names.filter((name) => name.endsWith(".docx")).length === 4 && names.filter((name) => name.endsWith(".txt")).length === 2, { names }, "artifact");
  for (const name of names) {
    const buffer = await zip.files[name].async("nodebuffer");
    let text = "";
    if (name.endsWith(".pdf")) text = await pdfText(buffer);
    else if (name.endsWith(".docx")) text = (await mammoth.extractRawText({ buffer })).value;
    else text = buffer.toString("utf8");
    results.artifacts.push({ name, hits: hits(text), reviewWarning: name.endsWith(".txt") ? /review every claim|draft materials|public beta/i.test(text) : null });
  }
  check("all exported artifacts exclude audited context strings", results.artifacts.every((item) => item.hits.length === 0), { artifacts: results.artifacts }, "P1");
  check("text companions retain review-before-use warnings", results.artifacts.filter((item) => item.reviewWarning !== null).every((item) => item.reviewWarning), { textArtifacts: results.artifacts.filter((item) => item.reviewWarning !== null) }, "release-boundary");
  fs.writeFileSync(path.join(OUT, "fresh-state.json"), JSON.stringify(fresh, null, 2));
  return fresh;
}

function stickyState() {
  const state = emptyState();
  state.pendingImportReviews = [{
    version: 1,
    id: "sticky-batch",
    proposals: [
      { id: "rejected-positive-metric", group: "metrics-outcomes", kind: "metric", label: "Metric or outcome", detail: "Reduced unresolved launch blockers from 12 to 3", sourceFilenames: [], sourceExcerpts: ["Reduced unresolved launch blockers from 12 to 3"], confidence: "high", status: "rejected", edited: false, likelyDuplicateOf: null },
      { id: "undecided-positive-metric", group: "metrics-outcomes", kind: "metric", label: "Metric or outcome", detail: "Maintained 40 verified troubleshooting articles", sourceFilenames: [], sourceExcerpts: ["Maintained 40 verified troubleshooting articles"], confidence: "high", status: "proposed", edited: false, likelyDuplicateOf: null }
    ],
    sourceFilenames: [],
    sourceFileCount: 1,
    retainSourceFilenames: false,
    importedAt: NOW,
    updatedAt: NOW
  }];
  return state;
}

async function browserAudit(fresh) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);

    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.getByText("PUBLIC BETA", { exact: true }).first().waitFor();
    check("deployed preview displays the public-beta boundary", true, {}, "release-boundary");
    const comparison = page.getByRole("region", { name: /comparison table/i });
    await comparison.waitFor();
    check("mobile comparison region is keyboard reachable and named", await comparison.evaluate((element) => element.tabIndex === 0 && Boolean(element.getAttribute("aria-label"))), {}, "P2");

    await page.goto(`${BASE_URL}/pricing`, { waitUntil: "networkidle" });
    await page.getByText("Public beta · No purchases enabled", { exact: true }).waitFor();
    const pricingText = await page.locator("body").innerText();
    check("public-beta pricing hides unsupported numeric offers", !/\$(49|79|99)\b/.test(pricingText) && /No purchases enabled/.test(pricingText), { numericPrices: pricingText.match(/\$(49|79|99)\b/g) ?? [] }, "release-boundary");

    await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [STORAGE_KEY, stickyState()]);
    await page.goto(`${BASE_URL}/profile#review`, { waitUntil: "networkidle" });
    const undecidedInput = page.locator('input[value="Maintained 40 verified troubleshooting articles"]');
    const section = undecidedInput.locator("xpath=ancestor::section[1]");
    await section.getByRole("button", { name: "Approve section" }).click();
    await page.waitForFunction(([key]) => {
      const state = JSON.parse(localStorage.getItem(key));
      return state.pendingImportReviews[0].proposals.some((item) => item.id === "undecided-positive-metric" && item.status === "approved");
    }, [STORAGE_KEY]);
    let stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
    check("bulk approval preserves an explicit rejection", stored.pendingImportReviews[0].proposals.find((item) => item.id === "rejected-positive-metric")?.status === "rejected", { proposals: stored.pendingImportReviews[0].proposals }, "P1");
    await page.reload({ waitUntil: "networkidle" });
    stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
    check("sticky rejection survives refresh", stored.pendingImportReviews[0].proposals.find((item) => item.id === "rejected-positive-metric")?.status === "rejected", {}, "P1");

    await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [STORAGE_KEY, fresh]);
    await page.goto(`${BASE_URL}/versions`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Your Résumé Pack is ready." }).waitFor();
    const exportButton = page.getByRole("button", { name: "Export complete pack" });
    await exportButton.waitFor();
    check("fresh pack export control is enabled in the deployed preview", !(await exportButton.isDisabled()), {}, "paid-outcome");

    const contactState = structuredClone(fresh);
    contactState.outreach = [{ id: "contact-1", name: "Riley Recruiter", company: "Acme", role: "Recruiter", channel: "linkedin", status: "planned", laneId: "lane-ops", lastContactedAt: null, nextFollowUpAt: null, followUpCount: 0, notes: "Applied to the company", createdAt: NOW }];
    await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [STORAGE_KEY, contactState]);
    await page.goto(`${BASE_URL}/outreach`, { waitUntil: "networkidle" });
    await page.getByLabel("Recipient").selectOption("contact-1");
    await page.getByLabel("Specific reason for contacting this company or person").fill("the team publishes clear operational playbooks");
    const evidenceSelect = page.getByLabel("Approved evidence to mention");
    await evidenceSelect.selectOption({ index: 1 });
    const copyButton = page.getByRole("button", { name: "Copy completed draft" });
    await copyButton.waitFor();
    check("outreach has explicit reason and evidence controls and produces a complete draft", !(await copyButton.isDisabled()) && !/\[[^\]]+\]/.test(await page.locator("pre").innerText()), { draft: await page.locator("pre").innerText() }, "paid-outcome");

    await page.screenshot({ path: path.join(OUT, "preview-outreach-complete.png"), fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }
}

const fresh = await sourceAndArtifactAudit();
await browserAudit(fresh);

results.conclusion = {
  failures: results.checks.filter((item) => !item.pass).map((item) => item.name),
  p1Failures: results.checks.filter((item) => !item.pass && item.severity === "P1").map((item) => item.name),
  paidOutcomeFailures: results.checks.filter((item) => !item.pass && item.severity === "paid-outcome").map((item) => item.name)
};
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
fs.writeFileSync(path.join(OUT, "report.md"), [
  "# Career Forge post-PR12 preview audit",
  "",
  `Generated: ${results.generatedAt}`,
  `Target: ${results.target}`,
  "",
  "| Result | Severity | Check | Details |",
  "|---|---|---|---|",
  ...results.checks.map((item) => `| ${item.pass ? "PASS" : "FAIL"} | ${item.severity || "—"} | ${item.name.replace(/\|/g, "\\|")} | ${JSON.stringify(item.details).replace(/\|/g, "\\|")} |`),
  "",
  `Failures: ${results.conclusion.failures.length}`,
  `P1 failures: ${results.conclusion.p1Failures.length}`,
  `Paid-outcome failures: ${results.conclusion.paidOutcomeFailures.length}`
].join("\n"));

if (results.conclusion.failures.length > 0) process.exit(1);
