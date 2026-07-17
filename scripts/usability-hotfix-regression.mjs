import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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
  const localRequire = (request) => request.startsWith("@/")
    ? loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`))
    : request.startsWith(".")
      ? loadTsModule(path.resolve(path.dirname(absolute), request.endsWith(".ts") ? request : `${request}.ts`))
      : require(request);
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(
    localRequire,
    cjsModule,
    cjsModule.exports,
    path.dirname(absolute),
    absolute
  );
  return cjsModule.exports;
}

const {
  classifyEvidenceAdmissibility,
  mergeSafeImportProposals,
  parseResumePackToSafeProposals,
  sanitizeCareerDossier,
  sanitizeCommandCenterState,
  sanitizeResumeForProfessionalUse
} = loadTsModule(path.join(root, "src/lib/evidence-admissibility.ts"));
const { emptyDossier, evidenceRecord } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { generateResumePack } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { deriveDefensibilityReceipt } = loadTsModule(path.join(root, "src/lib/defensibility.ts"));
const { fillTemplate, outreachTemplates, remainingPlaceholders } = loadTsModule(path.join(root, "src/lib/outreach-templates.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const NOW = "2026-07-16T18:00:00.000Z";
const targetWish = "Target roles: Product Operations Specialist; Implementation Specialist";
const noMetrics = "No reliable numerical performance metrics";
const noEmployment = "No full-time professional employment. No formal leadership title. No numerical outcomes";
const noSaas = "No SaaS employment. No software implementation ownership. No formal project-management credential";

check("target-role wish is a preference", classifyEvidenceAdmissibility(targetWish) === "preference");
check("no-metrics statement is a gap", classifyEvidenceAdmissibility(noMetrics) === "gap");
check("no-employment statement is a gap", classifyEvidenceAdmissibility(noEmployment) === "gap");
check("no-SaaS statement is a gap", classifyEvidenceAdmissibility(noSaas) === "gap");
check("real no-code work remains a claim", classifyEvidenceAdmissibility("No-code automation reduced intake time") === "claim");

const proposals = parseResumePackToSafeProposals([{ filename: "audit.txt", text: [targetWish, noMetrics, noEmployment, noSaas].join("\n") }]);
const targetProposal = proposals.find((item) => item.detail === targetWish);
const gapProposals = proposals.filter((item) => [noMetrics, noEmployment, noSaas].includes(item.detail));
check("target role imports as context-only goal", targetProposal?.kind === "goal" && targetProposal.group === "other");
check("negative constraints cannot become project proposals", gapProposals.every((item) => item.kind === "constraint" && item.group === "other"));

const approved = proposals.map((item) => ({ ...item, status: "approved" }));
const merged = mergeSafeImportProposals(emptyDossier(NOW), approved, NOW, true);
check("negative statements create no roles", merged.roles.length === 0, JSON.stringify(merged.roles));
check("negative statements create no projects", merged.projects.length === 0, JSON.stringify(merged.projects));
check("target roles move to target-role interests", merged.targetRoleInterests.includes("Product Operations Specialist") && merged.targetRoleInterests.includes("Implementation Specialist"));
check("gaps move to constraints", [noMetrics, noEmployment, noSaas].every((item) => merged.constraints.includes(item)));
check("context-only items are absent from approved claims", [targetWish, noMetrics, noEmployment, noSaas].every((item) => !merged.approvedClaims.includes(item)));

const previous = emptyState();
previous.pendingImportReviews = [{
  version: 1,
  id: "batch-1",
  proposals: [
    { id: "rejected-1", group: "other", kind: "proof", label: "Evidence", detail: "Did not manage engineers", sourceFilenames: [], sourceExcerpts: ["Did not manage engineers"], confidence: "low", status: "rejected", edited: false, likelyDuplicateOf: null },
    { id: "proposed-1", group: "metrics-outcomes", kind: "proof", label: "Outcome", detail: "Resolved customer escalations", sourceFilenames: [], sourceExcerpts: ["Resolved customer escalations"], confidence: "medium", status: "proposed", edited: false, likelyDuplicateOf: null }
  ],
  sourceFilenames: [],
  sourceFileCount: 1,
  retainSourceFilenames: false,
  importedAt: NOW,
  updatedAt: NOW
}];
const bulkApproved = structuredClone(previous);
bulkApproved.pendingImportReviews[0].proposals = bulkApproved.pendingImportReviews[0].proposals.map((item) => ({ ...item, status: "approved" }));
const reconciled = sanitizeCommandCenterState(bulkApproved, previous);
check("bulk approval cannot reverse rejection", reconciled.pendingImportReviews[0].proposals.find((item) => item.id === "rejected-1")?.status === "rejected");
check("bulk approval still approves undecided items", reconciled.pendingImportReviews[0].proposals.find((item) => item.id === "proposed-1")?.status === "approved");

const unsafeEvidence = evidenceRecord("proof", noMetrics, "manual", true, NOW, { label: "Proof" });
const safeEvidence = evidenceRecord("proof", "Resolved customer escalations and documented the outcome", "manual", true, NOW, { label: "Proof" });
const dirtyDossier = {
  ...emptyDossier(NOW),
  evidence: [unsafeEvidence, safeEvidence],
  proofPoints: [noMetrics, safeEvidence.detail],
  approvedClaims: [noMetrics, safeEvidence.detail],
  projects: [{
    id: "fake-project",
    name: noSaas,
    organization: "Independent project",
    dates: "",
    description: noSaas,
    responsibilities: [],
    tools: [],
    outcomes: [],
    metrics: [],
    links: [],
    defaultPlacement: "projects",
    evidenceIds: [unsafeEvidence.id]
  }]
};
const cleaned = sanitizeCareerDossier(dirtyDossier).dossier;
check("existing unsafe proof is migrated out of evidence", !cleaned.evidence.some((item) => item.id === unsafeEvidence.id));
check("existing unsafe proof is removed from proof bank", !cleaned.proofPoints.includes(noMetrics));
check("fake negative project is removed", cleaned.projects.length === 0);
check("safe proof remains usable", cleaned.approvedClaims.includes(safeEvidence.detail));

const projectEvidence = evidenceRecord("project", "School — Campus Accessibility Audit", "manual", true, NOW, { label: "Project" });
const projectDossier = sanitizeCareerDossier({
  ...emptyDossier(NOW),
  evidence: [projectEvidence],
  approvedClaims: [projectEvidence.detail],
  projects: [{
    id: "school-project",
    name: "School",
    organization: "Campus Accessibility Audit",
    dates: "2025",
    description: "Audited campus accessibility workflows",
    responsibilities: ["Documented access barriers"],
    tools: [],
    outcomes: [],
    metrics: [],
    links: [],
    defaultPlacement: "projects",
    evidenceIds: [projectEvidence.id]
  }]
}).dossier;
check("generic project type is not rendered as the project name", projectDossier.projects[0]?.name === "Campus Accessibility Audit" && projectDossier.projects[0]?.organization === "School project", JSON.stringify(projectDossier.projects));

const safeResume = sanitizeResumeForProfessionalUse({
  summary: `${targetWish}. ${noMetrics}. Resolved customer escalations and documented the outcome.`,
  coreSkills: ["Customer support", noMetrics],
  experience: [
    { title: noSaas, company: "Independent project", time: "", bullets: [noSaas] },
    { title: "Customer Support Associate", company: "Acme", time: "2023–2025", bullets: [noMetrics, "Resolved customer escalations"] }
  ],
  education: "Earlham College",
  linkedinHeadline: "Customer Support | Documentation",
  linkedinSummary: `${targetWish}. Resolved customer escalations.`
});
check("unsafe summary sentences are removed", !safeResume.summary.includes("Target roles") && !safeResume.summary.includes("No reliable"));
check("negative fake project is removed from resume", !safeResume.experience.some((item) => item.title.includes("No SaaS")));
check("safe role bullet survives", safeResume.experience.some((item) => item.bullets.includes("Resolved customer escalations")));
const terminationSafe = sanitizeResumeForProfessionalUse({
  ...safeResume,
  summary: "Led store operations until I was laid off in June 2026, kept quality high. Handled escalations calmly."
});
check("termination clause is removed while safe remainder survives", !/laid\s+off/i.test(terminationSafe.summary) && terminationSafe.summary.includes("kept quality high") && terminationSafe.summary.includes("Handled escalations calmly"), terminationSafe.summary);

const roleEvidence = evidenceRecord("role", "Product Operations Coordinator · Acme · 2022–2025", "manual", true, NOW, { label: "Employment" });
const responsibilityEvidence = evidenceRecord("responsibility", "Coordinated weekly release readiness across product, support, and engineering", "manual", true, NOW, { label: "Responsibility" });
const metricEvidence = evidenceRecord("metric", "Reduced unresolved launch blockers from 12 to 3", "manual", true, NOW, { label: "Metric" });
const toolEvidence = evidenceRecord("tool", "Jira, Notion, Google Sheets", "manual", true, NOW, { label: "Tools" });
const freshDossier = {
  ...emptyDossier(NOW),
  identity: { fullName: "Jordan Ellis", email: "jordan@example.com", phone: "", location: "", links: [] },
  roles: [{ id: "role-1", title: "Product Operations Coordinator", employer: "Acme", startDate: "2022", endDate: "2025", current: false, responsibilities: [responsibilityEvidence.detail], tools: ["Jira", "Notion", "Google Sheets"], outcomes: [metricEvidence.detail], evidenceIds: [roleEvidence.id, responsibilityEvidence.id, metricEvidence.id, toolEvidence.id] }],
  responsibilities: [responsibilityEvidence.detail],
  tools: ["Jira", "Notion", "Google Sheets"],
  outcomes: [metricEvidence.detail],
  metrics: [metricEvidence.detail],
  proofPoints: [metricEvidence.detail],
  constraints: [noMetrics, noSaas],
  evidence: [roleEvidence, responsibilityEvidence, metricEvidence, toolEvidence],
  approvedClaims: [roleEvidence.detail, responsibilityEvidence.detail, metricEvidence.detail, toolEvidence.detail],
  updatedAt: NOW
};
const lanes = ["Junior Product Ops", "Product Support Specialist"].map((title, index) => ({ id: `lane-${index}`, title, status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: ["product", "support", "Jira"], source: "custom", createdAt: NOW }));
const generatedPack = generateResumePack(freshDossier, lanes, NOW);
const sanitizedState = sanitizeCommandCenterState({ ...emptyState(), dossier: freshDossier, lanes, resumePacks: [generatedPack] });
const sanitizedPack = sanitizedState.resumePacks[0];
const receipts = sanitizedPack.variants.map((variant) => deriveDefensibilityReceipt(variant, sanitizedState.dossier));
check("fresh two-lane pack keeps complete provenance after sanitization", receipts.every((receipt) => receipt.missingProvenance === 0), JSON.stringify(receipts));
check("fresh pack remains exportable after sanitization", sanitizedPack.status !== "needs-review" && sanitizedPack.variants.every((variant) => variant.status !== "needs-review"), JSON.stringify({ pack: sanitizedPack.status, variants: sanitizedPack.variants.map((variant) => variant.status) }));
check("context gaps do not leak into the legacy profile projection", !sanitizedState.profile.constraints.includes("No reliable") && !sanitizedState.profile.constraints.includes("No SaaS"), sanitizedState.profile.constraints);

const contaminatedPackState = {
  ...emptyState(),
  dossier: dirtyDossier,
  resumePacks: [{
    id: "pack-old",
    dossierId: dirtyDossier.id,
    status: "current",
    lanePacks: [{ laneId: "lane-old", positioningPitch: targetWish, variantIds: [], evidenceUsed: [unsafeEvidence.id], evidenceOmitted: [], gapsAvoided: [] }],
    variants: [],
    linkedinHeadlines: [targetWish],
    linkedinAbout: targetWish,
    linkedinSkills: [],
    masterProofBank: [targetWish, noMetrics],
    coverLetterFoundation: targetWish,
    receipt: { id: "receipt-old", generatedAt: NOW, evidenceUsed: [unsafeEvidence.id], evidenceOmitted: [], laneFraming: [{ laneId: "lane-old", angle: targetWish }], keywordsIncluded: [], gapsAvoided: [], unsupportedClaimsRefused: [], transferredClaims: [targetWish], gapsLeftUnclaimed: [] },
    createdAt: NOW,
    updatedAt: NOW
  }]
};
const migratedPack = sanitizeCommandCenterState(contaminatedPackState).resumePacks[0];
check("migration removes context from lane positioning pitch", migratedPack.lanePacks[0].positioningPitch === "");
check("migration removes context from receipt lane framing", migratedPack.receipt.laneFraming.length === 0);
check("migration removes context from LinkedIn and proof-bank metadata", !JSON.stringify({ headlines: migratedPack.linkedinHeadlines, about: migratedPack.linkedinAbout, proof: migratedPack.masterProofBank, cover: migratedPack.coverLetterFoundation, transferred: migratedPack.receipt.transferredClaims }).includes("Target roles:"));

const recruiter = outreachTemplates.find((item) => item.key === "recruiter_intro");
const rendered = fillTemplate(recruiter, {
  contact: { name: "Riley", company: "Acme", role: "Recruiter" },
  lane: { title: "Product Operations Specialist" },
  profile: { currentSituation: "", experienceSummary: "Customer operations", proofPoints: safeEvidence.detail },
  specificReason: "the team publishes clear operational playbooks",
  approvedEvidence: safeEvidence.detail
});
check("outreach no longer asserts unverified results", !rendered.includes("real results behind it"));
check("approved evidence can fill outreach draft", rendered.includes(safeEvidence.detail));
check("completed recruiter draft has no unresolved placeholders", remainingPlaceholders(rendered).length === 0, rendered);

const packExportSource = fs.readFileSync(path.join(root, "src/lib/pack-export.ts"), "utf8");
const gapMatch = packExportSource.match(/PDF_RULE_TO_CONTENT_GAP\s*=\s*(\d+)/);
check("PDF section rule has explicit content clearance", Number(gapMatch?.[1] ?? 0) >= 12);
check("PDF rule is no longer drawn through the next text baseline", !/pdf\.line\(margin,\s*y\s*-\s*2/.test(packExportSource));

const homeSource = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
check("mobile comparison region is keyboard focusable and named", /tabIndex=\{0\}[\s\S]*role="region"[\s\S]*aria-label=/.test(homeSource));
check("public-beta homepage does not hard-code the unsupported $49 offer", !/One-time packs from \$49/i.test(homeSource));

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
