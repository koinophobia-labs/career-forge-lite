import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import JSZip from "jszip";
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const BASE_URL = (process.env.AUDIT_BASE_URL || "https://career-forge-lite.vercel.app").replace(/\/$/, "");
const STORAGE_KEY = "career-forge-command-center-v1";
const OUT = path.resolve(process.env.AUDIT_OUTPUT_DIR || "audit-artifacts");
const SHOTS = path.join(OUT, "screenshots");
const DOWNLOADS = path.join(OUT, "downloads");
const EXTRACTED = path.join(DOWNLOADS, "extracted");
const RENDERS = path.join(OUT, "renders");
for (const dir of [OUT, SHOTS, DOWNLOADS, EXTRACTED, RENDERS]) fs.mkdirSync(dir, { recursive: true });

const audit = {
  generatedAt: new Date().toISOString(),
  target: BASE_URL,
  checks: [],
  scenarios: {},
  consoleErrors: [],
  failedRequests: [],
  downloads: [],
  notes: []
};

function record(name, pass, details = {}, severity = "") {
  const entry = { name, pass: Boolean(pass), severity, details };
  audit.checks.push(entry);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${severity ? ` [${severity}]` : ""}${Object.keys(details).length ? ` — ${JSON.stringify(details)}` : ""}`);
  return pass;
}

async function scenario(name, fn) {
  const startedAt = Date.now();
  try {
    const details = await fn();
    audit.scenarios[name] = { status: "completed", elapsedMs: Date.now() - startedAt, ...details };
  } catch (error) {
    const message = error instanceof Error ? `${error.message}\n${error.stack || ""}` : String(error);
    audit.scenarios[name] = { status: "failed", elapsedMs: Date.now() - startedAt, error: message };
    record(`${name}: scenario completed`, false, { error: message }, "blocking");
  }
}

function emptyProfile() {
  return {
    currentSituation: "",
    targetRoles: "",
    transferableSkills: [],
    experienceSummary: "",
    strengths: [],
    constraints: "",
    workStyle: "",
    proofPoints: "",
    updatedAt: null
  };
}

function emptyDossier(now = "2026-07-16T12:00:00.000Z") {
  return {
    id: "dossier-local",
    identity: { fullName: "", email: "", phone: "", location: "", links: [] },
    roles: [],
    projects: [],
    education: [],
    responsibilities: [],
    tools: [],
    transferableSkills: [],
    outcomes: [],
    metrics: [],
    proofPoints: [],
    interviewStories: [],
    constraints: [],
    preferredWorkStyle: [],
    careerGoals: [],
    targetRoleInterests: [],
    approvedClaims: [],
    evidence: [],
    unstructuredNotes: [],
    migrationReview: [],
    createdAt: now,
    updatedAt: now
  };
}

function emptyState(now = "2026-07-16T12:00:00.000Z") {
  return {
    version: 2,
    profile: emptyProfile(),
    dossier: emptyDossier(now),
    lanes: [],
    applications: [],
    outreach: [],
    resumeVersions: [],
    resumePacks: [],
    exports: [],
    pendingImportReviews: [],
    activeGoal: null
  };
}

function evidence(id, kind, detail, label = kind, approved = true) {
  return {
    id,
    kind,
    label,
    detail,
    source: "resume-import",
    sourceText: detail,
    confidence: "high",
    approved,
    rejected: false,
    sourceFilenames: [],
    sourceExcerpts: [detail],
    createdAt: "2026-07-16T12:00:00.000Z",
    updatedAt: "2026-07-16T12:00:00.000Z"
  };
}

const FORBIDDEN = [
  "No reliable numerical performance metrics",
  "Target roles: Product Operations Specialist; Implementation Specialist",
  "No full-time professional employment",
  "No formal leadership title",
  "No numerical outcomes",
  "No SaaS employment",
  "No software implementation ownership",
  "No formal project-management credential"
];

function forbiddenHits(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return FORBIDDEN.filter((needle) => text.includes(needle));
}

function contaminatedState() {
  const now = "2026-07-16T12:00:00.000Z";
  const state = emptyState(now);
  const goodRole = evidence("e-good-role", "role", "Product Operations Coordinator — Acme | 2022–2025", "Employment");
  const goodResponsibility = evidence("e-good-resp", "responsibility", "Coordinated weekly release readiness across product, support, and engineering", "Responsibility");
  const goodMetric = evidence("e-good-metric", "metric", "Reduced unresolved launch blockers from 12 to 3 by maintaining a cross-functional tracker", "Metric");
  const badMetric = evidence("e-bad-metric", "metric", "No reliable numerical performance metrics", "Metric");
  const preference = evidence("e-preference", "proof", "Target roles: Product Operations Specialist; Implementation Specialist", "Other proposed evidence");
  const badEmployment = evidence("e-bad-employment", "role", "No full-time professional employment. No formal leadership title. No numerical outcomes", "Employment");
  const badProject = evidence("e-bad-project", "project", "No SaaS employment. No software implementation ownership. No formal project-management credential", "Project");
  const all = [goodRole, goodResponsibility, goodMetric, badMetric, preference, badEmployment, badProject];
  state.dossier = {
    ...state.dossier,
    identity: { fullName: "Jordan Ellis", email: "jordan@example.com", phone: "", location: "Chicago, IL", links: [] },
    roles: [
      {
        id: "role-good",
        title: "Product Operations Coordinator",
        employer: "Acme",
        startDate: "2022",
        endDate: "2025",
        current: false,
        responsibilities: [goodResponsibility.detail, badMetric.detail],
        tools: ["Jira"],
        outcomes: [goodMetric.detail],
        evidenceIds: [goodRole.id, goodResponsibility.id, goodMetric.id, badMetric.id]
      },
      {
        id: "role-bad",
        title: badEmployment.detail,
        employer: "",
        startDate: "",
        endDate: "",
        current: false,
        responsibilities: [badMetric.detail],
        tools: [],
        outcomes: [],
        evidenceIds: [badEmployment.id, badMetric.id]
      }
    ],
    projects: [
      {
        id: "project-bad",
        name: badProject.detail,
        organization: "Independent project",
        dates: "",
        description: badProject.detail,
        responsibilities: [preference.detail],
        tools: [],
        outcomes: [],
        metrics: [],
        links: [],
        defaultPlacement: "projects",
        evidenceIds: [badProject.id, preference.id]
      }
    ],
    responsibilities: [goodResponsibility.detail, badMetric.detail],
    tools: ["Jira"],
    outcomes: [goodMetric.detail],
    metrics: [goodMetric.detail, badMetric.detail],
    proofPoints: [goodMetric.detail, preference.detail, badMetric.detail],
    interviewStories: [badMetric.detail, preference.detail],
    approvedClaims: all.map((item) => item.detail),
    evidence: all,
    updatedAt: now
  };
  const lane = {
    id: "lane-product-ops",
    title: "Junior Product Ops",
    status: "active",
    whyFit: "",
    resumeAngle: "Process coordination",
    proof: [],
    gaps: [],
    keywords: ["product operations", "coordination"],
    source: "library",
    createdAt: now
  };
  state.lanes = [lane];
  const resume = {
    summary: `${preference.detail}. ${badMetric.detail}.`,
    coreSkills: ["Jira", preference.detail],
    experience: [
      { title: "Product Operations Coordinator", company: "Acme", time: "2022–2025", bullets: [goodResponsibility.detail, goodMetric.detail, badMetric.detail] },
      { title: badProject.detail, company: "Independent project", time: "", bullets: [badProject.detail, preference.detail] }
    ],
    education: "",
    linkedinHeadline: preference.detail,
    linkedinSummary: `${preference.detail}. ${badMetric.detail}.`
  };
  const variant = {
    id: "pack-old-lane-product-ops-ats",
    laneId: lane.id,
    kind: "ats",
    title: "Junior Product Ops — ATS Submission",
    status: "current",
    canonical: true,
    userEdited: false,
    resume,
    template: "Modern ATS",
    evidenceReferences: [
      { claimPath: "summary", claimText: resume.summary, evidenceIds: [preference.id, badMetric.id], supportType: "combined" },
      { claimPath: "experience.0.bullets.0", claimText: goodResponsibility.detail, evidenceIds: [goodResponsibility.id], supportType: "direct" },
      { claimPath: "experience.0.bullets.1", claimText: goodMetric.detail, evidenceIds: [goodMetric.id], supportType: "direct" },
      { claimPath: "experience.0.bullets.2", claimText: badMetric.detail, evidenceIds: [badMetric.id], supportType: "direct" },
      { claimPath: "experience.1.heading", claimText: badProject.detail, evidenceIds: [badProject.id], supportType: "direct" }
    ],
    userAuthoredPaths: [],
    sectionOrder: ["summary", "skills", "experience", "projects", "education"],
    sourceDossierUpdatedAt: now,
    baselineVariantId: null,
    applicationId: null,
    createdAt: now,
    updatedAt: now
  };
  state.resumePacks = [{
    id: "pack-old",
    dossierId: state.dossier.id,
    status: "current",
    lanePacks: [{ laneId: lane.id, positioningPitch: preference.detail, variantIds: [variant.id], evidenceUsed: all.map((item) => item.id), evidenceOmitted: [], gapsAvoided: [] }],
    variants: [variant],
    linkedinHeadlines: [preference.detail],
    linkedinAbout: resume.linkedinSummary,
    linkedinSkills: ["Jira"],
    masterProofBank: [goodMetric.detail, badMetric.detail, preference.detail],
    coverLetterFoundation: `Approved evidence to draw from: ${preference.detail}; ${badMetric.detail}`,
    receipt: {
      id: "pack-old-receipt",
      generatedAt: now,
      evidenceUsed: all.map((item) => item.id),
      evidenceOmitted: [],
      laneFraming: [{ laneId: lane.id, angle: preference.detail }],
      keywordsIncluded: ["product operations"],
      gapsAvoided: [],
      unsupportedClaimsRefused: [],
      transferredClaims: [preference.detail],
      gapsLeftUnclaimed: []
    },
    createdAt: now,
    updatedAt: now
  }];
  state.resumeVersions = [{
    id: variant.id,
    label: variant.title,
    laneId: lane.id,
    notes: "Canonical ats baseline generated from dossier dossier-local.",
    source: "builder",
    applicationId: null,
    targetCompany: "",
    targetTitle: lane.title,
    keywordsUsed: [],
    gapsAcknowledged: [],
    influenceSummary: "",
    resumeText: [resume.summary, ...resume.coreSkills, ...resume.experience.flatMap((role) => role.bullets)].join("\n"),
    resumeSnapshot: { fullName: "Jordan Ellis", email: "jordan@example.com", phone: "", website: "", template: "Modern ATS", resume },
    createdAt: now
  }];
  return state;
}

function pendingReviewState() {
  const state = emptyState();
  state.dossier.identity.fullName = "Jordan Ellis";
  state.pendingImportReviews = [{
    version: 1,
    id: "truth-inbox-sticky",
    proposals: [
      {
        id: "proposal-rejected",
        group: "metrics-outcomes",
        kind: "metric",
        label: "Metric or outcome",
        detail: "No reliable numerical performance metrics",
        sourceFilenames: [],
        sourceExcerpts: ["No reliable numerical performance metrics"],
        confidence: "medium",
        status: "rejected",
        edited: false,
        likelyDuplicateOf: null
      },
      {
        id: "proposal-undecided",
        group: "metrics-outcomes",
        kind: "metric",
        label: "Metric or outcome",
        detail: "Reduced unresolved launch blockers from 12 to 3",
        sourceFilenames: [],
        sourceExcerpts: ["Reduced unresolved launch blockers from 12 to 3"],
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

async function installState(page, state) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(([key, value]) => localStorage.setItem(key, JSON.stringify(value)), [STORAGE_KEY, state]);
  await page.reload({ waitUntil: "networkidle" });
}

async function readState(page) {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }, STORAGE_KEY);
}

function attachDiagnostics(page, label) {
  page.on("console", (message) => {
    if (message.type() === "error") audit.consoleErrors.push({ label, text: message.text() });
  });
  page.on("requestfailed", (request) => {
    audit.failedRequests.push({ label, url: request.url(), error: request.failure()?.errorText || "unknown" });
  });
}

async function waitForState(page, predicate, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const state = await readState(page);
    if (state && predicate(state)) return state;
    await page.waitForTimeout(120);
  }
  throw new Error("Timed out waiting for local state condition");
}

async function extractZip(zipPath) {
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  const names = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  for (const name of names) {
    const outputPath = path.join(EXTRACTED, name);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, await zip.files[name].async("nodebuffer"));
  }
  return names;
}

async function pdfText(pdfPath) {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data, disableWorker: true }).promise;
  const pages = [];
  for (let index = 1; index <= doc.numPages; index += 1) {
    const page = await doc.getPage(index);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return { pages: doc.numPages, text: pages.join("\n") };
}

function renderPdf(pdfPath, prefix) {
  try {
    execFileSync("pdftoppm", ["-png", "-r", "144", pdfPath, prefix], { stdio: "pipe" });
    return fs.readdirSync(path.dirname(prefix)).filter((name) => name.startsWith(path.basename(prefix)) && name.endsWith(".png"));
  } catch (error) {
    audit.notes.push(`PDF render failed for ${pdfPath}: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function convertDocx(docxPath, outDir) {
  try {
    fs.mkdirSync(outDir, { recursive: true });
    execFileSync("libreoffice", ["--headless", "--convert-to", "pdf", "--outdir", outDir, docxPath], { stdio: "pipe", timeout: 120000 });
    const pdfName = `${path.basename(docxPath, path.extname(docxPath))}.pdf`;
    const converted = path.join(outDir, pdfName);
    return fs.existsSync(converted) ? converted : null;
  } catch (error) {
    audit.notes.push(`DOCX render failed for ${docxPath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await scenario("production identity", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachDiagnostics(page, "identity");
    const response = await page.goto(BASE_URL, { waitUntil: "networkidle" });
    const body = await page.locator("body").innerText();
    fs.writeFileSync(path.join(OUT, "production-home.txt"), body);
    fs.writeFileSync(path.join(OUT, "production-home.html"), await page.content());
    await page.screenshot({ path: path.join(SHOTS, "production-home-1440x900.png"), fullPage: true });
    record("production returns HTTP 200", response?.status() === 200, { status: response?.status(), finalUrl: page.url() }, "blocking");
    record("production serves current dossier-first application shell", body.includes("Your career is bigger than your last résumé."), { bodyStart: body.slice(0, 400) }, "blocking");
    record("public beta notice is visible", body.includes("PUBLIC BETA") && body.includes("Review every claim, date, heading, and export before use."), {}, "release-boundary");
    record("production does not present outputs as automatically send-ready", !body.includes("recruiter-ready language") && !body.includes("No fake ATS score"), {}, "release-boundary");
    record("pricing claims remain visible on product", /one-time packs from \$49/i.test(body), { found: body.match(/.{0,40}one-time packs from \$49.{0,80}/i)?.[0] || "" }, "pricing");
    await context.close();
    return { status: response?.status(), finalUrl: page.url(), bodyStart: body.slice(0, 1000) };
  });

  await scenario("migration of pre-fix local state", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachDiagnostics(page, "migration");
    await installState(page, contaminatedState());
    await page.waitForTimeout(1000);
    const state = await readState(page);
    fs.writeFileSync(path.join(OUT, "migration-state-after.json"), JSON.stringify(state, null, 2));
    await page.screenshot({ path: path.join(SHOTS, "migration-home.png"), fullPage: true });
    const dossierText = JSON.stringify(state?.dossier || {});
    const packText = JSON.stringify(state?.resumePacks || []);
    const versionText = JSON.stringify(state?.resumeVersions || []);
    record("migration preserves admissible professional evidence", dossierText.includes("Coordinated weekly release readiness") && dossierText.includes("Reduced unresolved launch blockers from 12 to 3"), {}, "blocking");
    record("migration removes context-only strings from professional dossier surfaces", forbiddenHits({
      roles: state?.dossier?.roles,
      projects: state?.dossier?.projects,
      responsibilities: state?.dossier?.responsibilities,
      metrics: state?.dossier?.metrics,
      proofPoints: state?.dossier?.proofPoints,
      interviewStories: state?.dossier?.interviewStories,
      approvedClaims: state?.dossier?.approvedClaims
    }).length === 0, { hits: forbiddenHits(dossierText) }, "blocking");
    record("migration preserves gaps as context", state?.dossier?.constraints?.some((item) => item.includes("No reliable numerical performance metrics")) && state?.dossier?.constraints?.some((item) => item.includes("No SaaS employment")), { constraints: state?.dossier?.constraints }, "blocking");
    record("migration preserves target roles as preferences", state?.dossier?.targetRoleInterests?.includes("Product Operations Specialist") && state?.dossier?.targetRoleInterests?.includes("Implementation Specialist"), { targetRoleInterests: state?.dossier?.targetRoleInterests }, "blocking");
    record("migration sanitizes existing packs and versions", forbiddenHits(packText).length === 0 && forbiddenHits(versionText).length === 0, { packHits: forbiddenHits(packText), versionHits: forbiddenHits(versionText) }, "blocking");
    record("migration marks affected pack and variant for review", state?.resumePacks?.[0]?.status === "needs-review" && state?.resumePacks?.[0]?.variants?.[0]?.status === "needs-review", { packStatus: state?.resumePacks?.[0]?.status, variantStatus: state?.resumePacks?.[0]?.variants?.[0]?.status }, "blocking");
    record("migration annotates saved version for review", /evidence-safety review/i.test(state?.resumeVersions?.[0]?.notes || ""), { notes: state?.resumeVersions?.[0]?.notes }, "blocking");
    const first = JSON.stringify(state);
    await page.reload({ waitUntil: "networkidle" });
    const second = JSON.stringify(await readState(page));
    record("migration is idempotent across reload", first === second, {}, "durability");
    await context.close();
    return { packStatus: state?.resumePacks?.[0]?.status, constraints: state?.dossier?.constraints, targets: state?.dossier?.targetRoleInterests };
  });

  await scenario("sticky rejection under bulk approval", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    attachDiagnostics(page, "sticky-rejection");
    await installState(page, pendingReviewState());
    await page.goto(`${BASE_URL}/profile#review`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor({ timeout: 15000 });
    await page.screenshot({ path: path.join(SHOTS, "sticky-before.png"), fullPage: true });
    await page.getByRole("button", { name: "Approve section" }).click();
    await waitForState(page, (state) => state.pendingImportReviews[0].proposals.some((item) => item.id === "proposal-undecided" && item.status === "approved"));
    let state = await readState(page);
    const rejected = state.pendingImportReviews[0].proposals.find((item) => item.id === "proposal-rejected")?.status;
    const approved = state.pendingImportReviews[0].proposals.find((item) => item.id === "proposal-undecided")?.status;
    record("bulk approval preserves prior rejection", rejected === "rejected", { rejected }, "blocking");
    record("bulk approval approves only undecided item", approved === "approved", { approved }, "blocking");
    await page.reload({ waitUntil: "networkidle" });
    state = await readState(page);
    record("sticky rejection persists across refresh", state.pendingImportReviews[0].proposals.find((item) => item.id === "proposal-rejected")?.status === "rejected", {}, "blocking");
    await page.screenshot({ path: path.join(SHOTS, "sticky-after.png"), fullPage: true });
    await context.close();
    return { rejected, approved };
  });

  await scenario("fresh persona generation and exports", async () => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    attachDiagnostics(page, "fresh-persona");
    await page.goto(`${BASE_URL}/profile#import`, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Build your Career Dossier once." }).waitFor({ timeout: 15000 });
    const nameInput = page.getByLabel("Name on your documents");
    if (await nameInput.count()) await nameInput.fill("Jordan Ellis");
    const emailInput = page.getByLabel("Email on your documents");
    if (await emailInput.count()) await emailInput.fill("jordan@example.com");
    const detailsSummary = page.getByText("No file handy? Paste résumé text", { exact: true });
    if (await detailsSummary.count()) await detailsSummary.click();
    const personaText = [
      "Jordan Ellis",
      "jordan@example.com",
      "Product Operations Coordinator — Acme | 2022–2025",
      "Coordinated weekly release readiness across product, support, and engineering",
      "Reduced unresolved launch blockers from 12 to 3 by maintaining a cross-functional tracker",
      "Documented product issues and routed priority defects to owners",
      "Tools: Jira, Notion, Google Sheets",
      "Earlham College — Bachelor's degree",
      "Target roles: Product Operations Specialist; Implementation Specialist",
      "No reliable numerical performance metrics beyond the launch blocker count",
      "No SaaS employment. No software implementation ownership. No formal project-management credential"
    ].join("\n");
    await page.getByLabel("Resume text import").fill(personaText);
    await page.getByRole("button", { name: "Extract proposed evidence" }).click();
    await page.getByRole("heading", { name: "Review what Career Forge found" }).waitFor({ timeout: 15000 });
    let state = await readState(page);
    fs.writeFileSync(path.join(OUT, "fresh-proposals.json"), JSON.stringify(state.pendingImportReviews?.[0]?.proposals || [], null, 2));
    const proposals = state.pendingImportReviews?.[0]?.proposals || [];
    const targetProposal = proposals.find((item) => item.detail.startsWith("Target roles:"));
    const metricGap = proposals.find((item) => item.detail.startsWith("No reliable numerical"));
    const saasGap = proposals.find((item) => item.detail.startsWith("No SaaS employment"));
    record("fresh import classifies target-role list as context", targetProposal?.kind === "goal" && targetProposal?.group === "other", { targetProposal }, "blocking");
    record("fresh import classifies no-metrics statement as context", metricGap?.kind === "constraint" && metricGap?.group === "other", { metricGap }, "blocking");
    record("fresh import classifies no-SaaS statement as context", saasGap?.kind === "constraint" && saasGap?.group === "other", { saasGap }, "blocking");
    const sectionButtons = page.getByRole("button", { name: "Approve section" });
    const sectionCount = await sectionButtons.count();
    for (let index = 0; index < sectionCount; index += 1) await sectionButtons.nth(index).click();
    await page.getByRole("button", { name: "Finish review" }).click();
    await waitForState(page, (state) => state.pendingImportReviews.length === 0);
    state = await readState(page);
    fs.writeFileSync(path.join(OUT, "fresh-dossier-after-review.json"), JSON.stringify(state.dossier, null, 2));
    record("fresh review keeps target roles out of approved claims", !state.dossier.approvedClaims.some((item) => item.startsWith("Target roles:")) && state.dossier.targetRoleInterests.includes("Product Operations Specialist"), { approvedClaims: state.dossier.approvedClaims, targetRoleInterests: state.dossier.targetRoleInterests }, "blocking");
    record("fresh review keeps negative gaps out of professional evidence", forbiddenHits({ approvedClaims: state.dossier.approvedClaims, roles: state.dossier.roles, projects: state.dossier.projects, metrics: state.dossier.metrics, proofPoints: state.dossier.proofPoints }).length === 0, { hits: forbiddenHits(state.dossier) }, "blocking");
    record("fresh review retains negative gaps as constraints", state.dossier.constraints.some((item) => item.startsWith("No reliable numerical")) && state.dossier.constraints.some((item) => item.startsWith("No SaaS employment")), { constraints: state.dossier.constraints }, "blocking");
    await page.screenshot({ path: path.join(SHOTS, "fresh-dossier.png"), fullPage: true });

    await page.goto(`${BASE_URL}/targets`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Pick the lanes you’re running in." }).waitFor({ timeout: 15000 });
    async function adoptLane(title) {
      const card = page.locator("article").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
      await card.getByTestId("adopt-lane").click();
    }
    await adoptLane("Junior Product Ops");
    await adoptLane("Product Support Specialist");
    await page.getByRole("button", { name: "Forge complete résumé pack →" }).click();
    await page.waitForURL(/\/versions/, { timeout: 20000 });
    await page.getByRole("heading", { name: /Your Résumé Pack (?:is ready|needs evidence review)\./ }).waitFor({ timeout: 15000 });
    state = await readState(page);
    fs.writeFileSync(path.join(OUT, "fresh-state-with-pack.json"), JSON.stringify(state, null, 2));
    const pack = state.resumePacks.filter((item) => item.status !== "archived").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    record("fresh persona creates two-lane four-resume pack", pack?.lanePacks?.length === 2 && pack?.variants?.length === 4, { lanes: pack?.lanePacks?.length, variants: pack?.variants?.length }, "outcome");
    const outputSurface = { pack, versions: state.resumeVersions, profile: state.profile };
    record("generated résumé, LinkedIn, and proof outputs exclude context-only strings", forbiddenHits(outputSurface).length === 0, { hits: forbiddenHits(outputSurface) }, "blocking");
    const professionalKinds = new Set(["role", "project", "education", "responsibility", "tool", "skill", "metric", "proof", "story"]);
    const professionalIds = new Set(state.dossier.evidence.filter((item) => item.approved && !item.rejected && professionalKinds.has(item.kind)).map((item) => item.id));
    const references = pack?.variants?.flatMap((variant) => variant.evidenceReferences) || [];
    record("all generated claim references point to approved professional evidence", references.length > 0 && references.every((ref) => ref.evidenceIds.length > 0 && ref.evidenceIds.every((id) => professionalIds.has(id))), { referenceCount: references.length }, "blocking");
    await page.screenshot({ path: path.join(SHOTS, "fresh-pack.png"), fullPage: true });

    const exportButton = page.getByRole("button", { name: "Export complete pack" });
    const exportAvailable = (await exportButton.count()) > 0 && !(await exportButton.isDisabled());
    record("complete pack export is available after successful generation", exportAvailable, { buttonCount: await exportButton.count() }, "outcome");
    let zipPath = null;
    if (exportAvailable) {
      const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
      await exportButton.click();
      const download = await downloadPromise;
      zipPath = path.join(DOWNLOADS, download.suggestedFilename());
      await download.saveAs(zipPath);
      audit.downloads.push({ type: "zip", filename: download.suggestedFilename(), path: zipPath });
      const names = await extractZip(zipPath);
      fs.writeFileSync(path.join(OUT, "zip-contents.json"), JSON.stringify(names, null, 2));
      const pdfs = names.filter((name) => name.toLowerCase().endsWith(".pdf"));
      const docxs = names.filter((name) => name.toLowerCase().endsWith(".docx"));
      record("bundle contains four PDFs and four DOCX files", pdfs.length === 4 && docxs.length === 4, { pdfs, docxs }, "artifact");
      const artifactAudit = [];
      for (const name of pdfs) {
        const filePath = path.join(EXTRACTED, name);
        const parsed = await pdfText(filePath);
        const hits = forbiddenHits(parsed.text);
        artifactAudit.push({ name, type: "pdf", pages: parsed.pages, hits });
        const prefix = path.join(RENDERS, `pdf-${path.basename(name, ".pdf")}`);
        renderPdf(filePath, prefix);
      }
      for (const name of docxs) {
        const filePath = path.join(EXTRACTED, name);
        const extractedText = (await mammoth.extractRawText({ buffer: fs.readFileSync(filePath) })).value;
        const hits = forbiddenHits(extractedText);
        artifactAudit.push({ name, type: "docx", hits });
        const outDir = path.join(RENDERS, "docx-pdf");
        const converted = convertDocx(filePath, outDir);
        if (converted) renderPdf(converted, path.join(RENDERS, `docx-${path.basename(name, ".docx")}`));
      }
      for (const name of names.filter((item) => /\.txt$/i.test(item))) {
        const text = fs.readFileSync(path.join(EXTRACTED, name), "utf8");
        artifactAudit.push({ name, type: "text", hits: forbiddenHits(text), betaWarning: /review every claim|draft materials|public beta/i.test(text) });
      }
      fs.writeFileSync(path.join(OUT, "artifact-audit.json"), JSON.stringify(artifactAudit, null, 2));
      record("all exported artifacts exclude context-only strings", artifactAudit.every((item) => item.hits.length === 0), { artifactAudit }, "blocking");
      record("exported text bundle carries review-before-use warning", artifactAudit.filter((item) => item.type === "text").every((item) => item.betaWarning), { textArtifacts: artifactAudit.filter((item) => item.type === "text") }, "release-boundary");
    }

    await page.goto(`${BASE_URL}/outreach`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Get out of the resume pile." }).waitFor({ timeout: 15000 });
    await page.getByLabel("Name").fill("Taylor Recruiter");
    await page.getByLabel("Company").fill("Example Co");
    await page.getByLabel("Their role").fill("Recruiter");
    await page.getByRole("button", { name: "Add contact" }).click();
    const contactSelect = page.getByRole("combobox").filter({ has: page.locator("option", { hasText: "Fill for contact" }) });
    if (await contactSelect.count()) await contactSelect.selectOption({ index: 1 });
    const outreachBody = await page.locator("body").innerText();
    const outreachForbidden = forbiddenHits(outreachBody);
    const outreachPlaceholders = [...new Set(outreachBody.match(/\[[^\]]+\]/g) || [])];
    record("outreach no longer asserts unsupported real results", !/real results behind it/i.test(outreachBody) && outreachForbidden.length === 0, { outreachForbidden }, "blocking");
    record("outreach remains visibly incomplete until a specific reason exists", outreachPlaceholders.includes("[specific reason]") || outreachBody.includes("Still to personalize"), { outreachPlaceholders }, "product-value");
    await page.screenshot({ path: path.join(SHOTS, "fresh-outreach.png"), fullPage: true });

    await page.goto(`${BASE_URL}/interview`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const interviewBody = await page.locator("body").innerText();
    record("interview prep excludes target preferences and negative gap statements", forbiddenHits(interviewBody).length === 0, { hits: forbiddenHits(interviewBody) }, "blocking");
    await page.screenshot({ path: path.join(SHOTS, "fresh-interview.png"), fullPage: true });

    const tabA = page;
    const tabB = await context.newPage();
    await tabA.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
    await tabB.goto(`${BASE_URL}/profile`, { waitUntil: "networkidle" });
    await tabA.getByLabel("Location").fill("Chicago, IL");
    await tabA.getByLabel("Location").blur();
    await tabB.getByLabel("Phone").fill("312-555-0101");
    await tabB.getByLabel("Phone").blur();
    await tabA.waitForTimeout(500);
    const afterTabs = await readState(tabA);
    record("two-tab unrelated identity edits both survive", afterTabs.dossier.identity.location === "Chicago, IL" && afterTabs.dossier.identity.phone === "312-555-0101", { identity: afterTabs.dossier.identity }, "P2");
    await tabB.close();

    await context.close();
    return { zipPath, packStatus: pack?.status, variants: pack?.variants?.length, outreachPlaceholders };
  });

  await scenario("mobile keyboard accessibility", async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    attachDiagnostics(page, "mobile-a11y");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    const scrollRegions = page.locator(".overflow-x-auto");
    const count = await scrollRegions.count();
    const regions = [];
    for (let index = 0; index < count; index += 1) {
      regions.push(await scrollRegions.nth(index).evaluate((element) => ({
        tabIndex: element.tabIndex,
        role: element.getAttribute("role"),
        ariaLabel: element.getAttribute("aria-label"),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      })));
    }
    const problematic = regions.filter((region) => region.scrollWidth > region.clientWidth + 1 && region.tabIndex < 0);
    record("mobile horizontal comparison regions are keyboard focusable", problematic.length === 0, { regions, problematic }, "P2");
    const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    record("mobile homepage has no global horizontal overflow", widths.content <= widths.viewport + 1, widths, "mobile");
    await page.screenshot({ path: path.join(SHOTS, "mobile-home-390x844.png"), fullPage: true });
    await context.close();
    return { regions, widths };
  });
} finally {
  await browser.close();
}

const blockingFailures = audit.checks.filter((item) => !item.pass && ["blocking", "release-boundary"].includes(item.severity));
const pricingClaimVisible = audit.checks.find((item) => item.name === "pricing claims remain visible on product")?.pass === true;
const readiness = blockingFailures.length === 0 && !pricingClaimVisible
  ? "P1 pathways verified; paid readiness still requires human artifact review"
  : blockingFailures.length === 0
    ? "P1 pathways verified, but pricing remains unsupported and visible"
    : "Material production failures remain; paid beta blocked";
audit.conclusion = { readiness, blockingFailureCount: blockingFailures.length, blockingFailures: blockingFailures.map((item) => item.name), pricingClaimVisible };
fs.writeFileSync(path.join(OUT, "production-reaudit-results.json"), JSON.stringify(audit, null, 2));

const markdown = [
  "# Career Forge production re-audit",
  "",
  `Generated: ${audit.generatedAt}`,
  `Target: ${BASE_URL}`,
  `Conclusion: **${readiness}**`,
  "",
  "## Checks",
  "",
  "| Result | Severity | Check | Details |",
  "|---|---|---|---|",
  ...audit.checks.map((item) => `| ${item.pass ? "PASS" : "FAIL"} | ${item.severity || "—"} | ${item.name.replace(/\|/g, "\\|")} | ${JSON.stringify(item.details).replace(/\|/g, "\\|")} |`),
  "",
  "## Scenario status",
  "",
  ...Object.entries(audit.scenarios).map(([name, value]) => `- **${name}:** ${value.status} (${value.elapsedMs} ms)${value.error ? ` — ${value.error.split("\n")[0]}` : ""}`),
  "",
  "## Diagnostics",
  "",
  `- Console errors: ${audit.consoleErrors.length}`,
  `- Failed requests: ${audit.failedRequests.length}`,
  `- Downloads: ${audit.downloads.length}`,
  ""
].join("\n");
fs.writeFileSync(path.join(OUT, "production-reaudit-report.md"), markdown);
console.log(`\nAUDIT CONCLUSION: ${readiness}`);
console.log(`Artifacts written to ${OUT}`);
