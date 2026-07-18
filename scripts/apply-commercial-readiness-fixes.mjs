import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = (relative) => path.join(root, relative);
const read = (relative) => fs.readFileSync(file(relative), "utf8");
const write = (relative, content) => {
  fs.mkdirSync(path.dirname(file(relative)), { recursive: true });
  fs.writeFileSync(file(relative), content.endsWith("\n") ? content : `${content}\n`);
};
const replaceOnce = (relative, before, after) => {
  const source = read(relative);
  if (!source.includes(before)) throw new Error(`Expected text not found in ${relative}: ${before.slice(0, 120)}`);
  if (source.indexOf(before) !== source.lastIndexOf(before)) throw new Error(`Expected unique text appears more than once in ${relative}`);
  write(relative, source.replace(before, after));
};

// ---------------------------------------------------------------------------
// 1. User-authored edits remain exportable without being mislabeled as traced.
// ---------------------------------------------------------------------------
write("src/lib/defensibility.ts", `import type { CareerDossier, PackGenerationReceipt, ResumeVariant } from "@/types/dossier";

export type DefensibilityStatus = "Fully traced" | "Traced with transfers" | "Needs evidence review" | "User-edited, recheck required";

export type DefensibilityReceipt = {
  totalClaims: number;
  directlySupported: number;
  combinedEvidence: number;
  transferred: number;
  missingProvenance: number;
  incompleteProvenance: number;
  verifiedDurations: number;
  unverifiedDurations: number;
  userEditedClaimsNeedingReview: number;
  status: DefensibilityStatus;
};

type Claim = { path: string; text: string };

function claimsForVariant(variant: ResumeVariant): Claim[] {
  const claims: Claim[] = [];
  const add = (path: string, text: string) => { if (text.trim()) claims.push({ path, text }); };
  add("summary", variant.resume.summary);
  variant.resume.coreSkills.forEach((text, index) => add(\`coreSkills.\${index}\`, text));
  variant.resume.experience.forEach((role, roleIndex) => {
    add(\`experience.\${roleIndex}.heading\`, [role.title, role.company, role.time].filter(Boolean).join(" · "));
    role.bullets.forEach((text, index) => add(\`experience.\${roleIndex}.bullets.\${index}\`, text));
  });
  add("education", variant.resume.education);
  add("linkedinHeadline", variant.resume.linkedinHeadline);
  add("linkedinSummary", variant.resume.linkedinSummary);
  return claims;
}

function isUserAuthoredClaim(variant: ResumeVariant, claimPath: string): boolean {
  if (!variant.userEdited) return false;
  return variant.userAuthoredPaths.some((editedPath) => {
    if (editedPath === "document") return true;
    if (editedPath === claimPath) return true;
    if (editedPath === "coreSkills") return claimPath.startsWith("coreSkills.");
    const match = editedPath.match(/^experience\.(\d+)\.(title|company|time|bullets)$/);
    if (!match) return false;
    const prefix = \`experience.\${match[1]}.\`;
    return match[2] === "bullets"
      ? claimPath.startsWith(\`\${prefix}bullets.\`)
      : claimPath === \`\${prefix}heading\`;
  });
}

function yearTokens(value: string): string[] {
  return value.match(/(?:19|20)\d{2}|present|current/gi)?.map((item) => item.toLowerCase()) ?? [];
}

export function deriveDefensibilityReceipt(variant: ResumeVariant, dossier: CareerDossier): DefensibilityReceipt {
  const claims = claimsForVariant(variant);
  const approved = new Map(dossier.evidence.filter((item) => item.approved && !item.rejected).map((item) => [item.id, item]));
  const incompletePaths = new Set(variant.evidenceReferences.filter((reference) =>
    reference.evidenceIds.length === 0 || reference.evidenceIds.some((id) => !approved.has(id))
  ).map((reference) => reference.claimPath));
  const validReferences = variant.evidenceReferences.filter((reference) =>
    !incompletePaths.has(reference.claimPath) && reference.evidenceIds.length > 0 && reference.evidenceIds.every((id) => approved.has(id))
  );
  const validByPath = new Map(validReferences.map((reference) => [reference.claimPath, reference]));
  const userAuthoredClaims = claims.filter((claim) => isUserAuthoredClaim(variant, claim.path));
  const userAuthoredPaths = new Set(userAuthoredClaims.map((claim) => claim.path));
  // A user-authored field is intentionally not described as evidence-backed,
  // but it is also not a broken citation. It remains exportable with a visible
  // human-recheck status. Only untouched generated claims require provenance.
  const missing = claims.filter((claim) => !validByPath.has(claim.path) && !userAuthoredPaths.has(claim.path));
  const incompleteProvenance = missing.filter((claim) => incompletePaths.has(claim.path)).length;
  const evidenceBackedReferences = validReferences.filter((reference) => !userAuthoredPaths.has(reference.claimPath));
  const durationClaims = claims.filter((claim) => yearTokens(claim.text).length > 0);
  const verifiedDurations = durationClaims.filter((claim) => {
    if (userAuthoredPaths.has(claim.path)) return false;
    const reference = validByPath.get(claim.path);
    if (!reference) return false;
    const wanted = yearTokens(claim.text);
    const source = reference.evidenceIds.flatMap((id) => yearTokens(approved.get(id)?.detail ?? ""));
    return wanted.every((token) => source.includes(token));
  }).length;
  const userEditedClaimsNeedingReview = userAuthoredClaims.length;
  const status: DefensibilityStatus = missing.length
    ? "Needs evidence review"
    : userEditedClaimsNeedingReview
      ? "User-edited, recheck required"
      : evidenceBackedReferences.some((reference) => reference.supportType === "transferred")
        ? "Traced with transfers"
        : "Fully traced";
  return {
    totalClaims: claims.length,
    directlySupported: evidenceBackedReferences.filter((reference) => reference.supportType === "direct").length,
    combinedEvidence: evidenceBackedReferences.filter((reference) => reference.supportType === "combined").length,
    transferred: evidenceBackedReferences.filter((reference) => reference.supportType === "transferred").length,
    missingProvenance: missing.length,
    incompleteProvenance,
    verifiedDurations,
    unverifiedDurations: durationClaims.length - verifiedDurations,
    userEditedClaimsNeedingReview,
    status
  };
}

export function uniqueUnclaimedReceiptItems(receipt: PackGenerationReceipt): string[] {
  return [...new Set([...receipt.gapsLeftUnclaimed, ...receipt.unsupportedClaimsRefused].map((item) => item.trim()).filter(Boolean))];
}
`);

write("src/lib/version-sync.ts", `import { variantPlainText } from "@/lib/pack-export";
import type { CommandCenterState, ResumeVersionRecord } from "@/types/command-center";
import type { ResumePack } from "@/types/dossier";

export function syncBuilderVersionsWithPack(state: CommandCenterState, next: ResumePack): ResumeVersionRecord[] {
  return state.resumeVersions.map((version) => {
    const variant = next.variants.find((item) => item.id === version.id);
    if (!variant || version.source !== "builder") return version;
    const userEditNote = variant.userEdited && !version.notes.includes("User-edited")
      ? " User-edited fields require a final human recheck."
      : "";
    return {
      ...version,
      notes: \`\${version.notes}\${userEditNote}\`,
      resumeText: variantPlainText(state.dossier, variant.resume, variant.sectionOrder, variant.kind),
      resumeSnapshot: {
        fullName: state.dossier.identity.fullName,
        email: state.dossier.identity.email,
        phone: state.dossier.identity.phone,
        website: state.dossier.identity.links[0] ?? "",
        template: variant.template,
        resume: variant.resume
      }
    };
  });
}
`);

replaceOnce(
  "src/app/versions/page.tsx",
  'import { updatePackVariant } from "@/lib/resume-pack";\n',
  'import { updatePackVariant } from "@/lib/resume-pack";\nimport { syncBuilderVersionsWithPack } from "@/lib/version-sync";\n'
);
replaceOnce(
  "src/app/versions/page.tsx",
  `  function updatePack(next: ResumePack) {
    update((current) => ({ ...current, resumePacks: current.resumePacks.map((pack) => pack.id === next.id ? next : pack) }));
  }
`,
  `  function updatePack(next: ResumePack) {
    update((current) => ({
      ...current,
      resumePacks: current.resumePacks.map((pack) => pack.id === next.id ? next : pack),
      resumeVersions: syncBuilderVersionsWithPack(current, next)
    }));
  }
`
);

write("scripts/user-edit-export-regression.mjs", `// User-authored edit regression: editing generated text must preserve the exact
// wording through reload and export without pretending the new wording is
// evidence-backed.
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
  const { outputText } = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const cjsModule = { exports: {} };
  moduleCache.set(absolute, cjsModule);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", \`\${request.slice(2)}.ts\`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : \`\${request}.ts\`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

const { emptyState, parseState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { evidenceRecord } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { generateResumePack, updatePackVariant } = loadTsModule(path.join(root, "src/lib/resume-pack.ts"));
const { sanitizeCommandCenterState } = loadTsModule(path.join(root, "src/lib/evidence-admissibility.ts"));
const { deriveDefensibilityReceipt } = loadTsModule(path.join(root, "src/lib/defensibility.ts"));
const { syncBuilderVersionsWithPack } = loadTsModule(path.join(root, "src/lib/version-sync.ts"));
const { createVariantFile, variantPlainText } = loadTsModule(path.join(root, "src/lib/pack-export.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(\`PASS \${label}\`); }
  else { failures += 1; console.error(\`FAIL \${label}\${detail ? \` — \${detail}\` : ""}\`); }
}

const T0 = "2026-07-18T10:00:00.000Z";
const T1 = "2026-07-18T10:05:00.000Z";
const T2 = "2026-07-18T10:10:00.000Z";
const base = emptyState();
const roleEvidence = evidenceRecord("role", "Customer Support Specialist · HelpDesk Co · 2021–2025", "manual", true, T0, { label: "Employment record" });
const proofEvidence = evidenceRecord("proof", "Resolved escalated billing disputes and wrote 45 knowledge-base articles", "manual", true, T0, { label: "Proof" });
const dossier = {
  ...base.dossier,
  identity: { fullName: "Jamie Editor", email: "jamie@example.com", phone: "", location: "Chicago, IL", links: [] },
  roles: [{ id: "role-1", title: "Customer Support Specialist", employer: "HelpDesk Co", startDate: "2021", endDate: "2025", current: false, responsibilities: [proofEvidence.detail], tools: [], outcomes: [], evidenceIds: [roleEvidence.id, proofEvidence.id] }],
  responsibilities: [proofEvidence.detail],
  approvedClaims: [roleEvidence.detail, proofEvidence.detail],
  evidence: [roleEvidence, proofEvidence],
  createdAt: T0,
  updatedAt: T0
};
const lane = { id: "lane-1", title: "Customer Success", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: ["customer"], source: "custom", createdAt: T0 };
const pack = generateResumePack(dossier, [lane], T1);
const variant = pack.variants.find((item) => item.kind === "ats");
if (!variant) throw new Error("ATS variant missing");
const version = {
  id: variant.id, label: variant.title, laneId: variant.laneId, notes: "Canonical ats baseline generated from dossier.", source: "builder", applicationId: null,
  targetCompany: "", targetTitle: lane.title, keywordsUsed: [], gapsAcknowledged: [], influenceSummary: "",
  resumeText: variantPlainText(dossier, variant.resume, variant.sectionOrder, variant.kind),
  resumeSnapshot: { fullName: dossier.identity.fullName, email: dossier.identity.email, phone: "", website: "", template: variant.template, resume: variant.resume },
  createdAt: T1
};
const state = { ...base, dossier, lanes: [lane], resumePacks: [pack], resumeVersions: [version] };
const editedText = "Customer support professional trusted with complex billing escalations and knowledge-base ownership.";
const editedPack = updatePackVariant(pack, variant.id, { ...variant.resume, summary: editedText }, T2, ["summary"]);
const sanitized = sanitizeCommandCenterState({ ...state, resumePacks: [editedPack] }, state);
const editedVariant = sanitized.resumePacks[0].variants.find((item) => item.id === variant.id);
if (!editedVariant) throw new Error("Edited variant missing");
const receipt = deriveDefensibilityReceipt(editedVariant, dossier);
check("edited wording survives the safety sanitizer", editedVariant.resume.summary === editedText, editedVariant.resume.summary);
check("a user-authored field does not become a missing-provenance export blocker", receipt.missingProvenance === 0, JSON.stringify(receipt));
check("the receipt labels the document for human recheck instead of calling the edit traced", receipt.status === "User-edited, recheck required" && receipt.userEditedClaimsNeedingReview >= 1, JSON.stringify(receipt));
const syncedVersions = syncBuilderVersionsWithPack({ ...sanitized, resumeVersions: [version] }, sanitized.resumePacks[0]);
const roundTrip = parseState(JSON.stringify({ ...sanitized, resumeVersions: syncedVersions }));
const restoredVersion = roundTrip.resumeVersions.find((item) => item.id === variant.id);
check("saved version snapshot carries the exact edited wording after reload", restoredVersion?.resumeSnapshot?.resume.summary === editedText, restoredVersion?.resumeSnapshot?.resume.summary ?? "missing");
check("saved plain text carries the exact edited wording", restoredVersion?.resumeText.includes(editedText) === true);
const pdf = await createVariantFile(editedVariant, dossier, lane.title, "pdf");
check("the edited document still produces a real PDF", pdf.filename.endsWith(".pdf") && pdf.blob.size > 500, \`\${pdf.filename} \${pdf.blob.size}\`);

console.log(\`\\n\${passes} passed, \${failures} failed\`);
if (failures > 0) process.exit(1);
`);

const packageJson = JSON.parse(read("package.json"));
if (!packageJson.scripts["test:unit"].includes("user-edit-export-regression.mjs")) {
  packageJson.scripts["test:unit"] += " && node scripts/user-edit-export-regression.mjs";
}
write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);

// ---------------------------------------------------------------------------
// 2. Pilot metrics remain sane, immutable, durable, and content-free.
// ---------------------------------------------------------------------------
replaceOnce(
  "src/lib/truth-inbox.ts",
  `  const dossier = mergeSafeImportProposals(state.dossier, decided, nowIso, batch.retainSourceFilenames);
  const nextWithDossier = withUpdatedDossier(state, dossier);
`,
  `  const mergedDossier = mergeSafeImportProposals(state.dossier, decided, nowIso, batch.retainSourceFilenames);
  const contextOnlyCaught = decided.filter((item) =>
    item.group === "other" && (item.kind === "goal" || item.kind === "constraint")
  ).length;
  // The completed queue is removed, so preserve only a content-free aggregate
  // and the import-start timestamp. This keeps pilot metrics durable without
  // retaining résumé text or a shadow analytics database.
  const integrityMarker = contextOnlyCaught > 0
    ? \`Career Forge integrity metric: imported \${batch.importedAt}; \${contextOnlyCaught} context-only imported item(s) separated from professional evidence in review \${batch.id}.\`
    : "";
  const dossier = integrityMarker
    ? { ...mergedDossier, migrationReview: unique([...mergedDossier.migrationReview, integrityMarker]) }
    : mergedDossier;
  const nextWithDossier = withUpdatedDossier(state, dossier);
`
);

write("src/lib/pilot-metrics.ts", `import type { CommandCenterState } from "@/types/command-center";

// Founding-user pilot summary: timings, counts, and dispositions ONLY.
//
// Hard privacy rule: this summary must never contain résumé content — no
// claim text, no evidence details, no names, employers, dates-of-employment,
// or generated document text. Everything here is a count or a timestamp
// already implied by using the product. The user reviews the JSON before
// sending it; nothing is transmitted automatically.

export type PilotSummary = {
  schema: "career-forge-pilot-summary-v1";
  generatedAt: string;
  consent: true;
  journey: {
    dossierStartedAt: string | null;
    firstEvidenceApprovedAt: string | null;
    firstPackGeneratedAt: string | null;
    firstExportAt: string | null;
    minutesFromStartToFirstApprovedEvidence: number | null;
    minutesFromStartToFirstExport: number | null;
  };
  counts: {
    approvedEvidence: number;
    rejectedEvidence: number;
    activeLanes: number;
    generatedVariants: number;
    userEditedVariants: number;
    userEditedFieldPaths: number;
    savedVersions: number;
    exports: number;
    exportedFiles: number;
    applicationsTracked: number;
    outreachContacts: number;
  };
  integrity: {
    packsNeedingReview: number;
    claimsRefusedByGenerator: number;
    wrongCategoryItemsCaught: number;
  };
};

const MIN_REAL_TIMESTAMP = Date.UTC(2000, 0, 1);
const INTEGRITY_MARKER = /^Career Forge integrity metric: imported ([^;]+); (\d+) context-only imported item\(s\)/;

function validTimestamp(value: string | null | undefined): value is string {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= MIN_REAL_TIMESTAMP;
}

function minutesBetween(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const minutes = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000;
  return Number.isFinite(minutes) && minutes >= 0 ? Math.round(minutes) : null;
}

function earliest(values: Array<string | null | undefined>): string | null {
  const valid = values.filter(validTimestamp).sort();
  return valid[0] ?? null;
}

function durableIntegrity(state: CommandCenterState): { importedAt: string[]; wrongCategoryItemsCaught: number } {
  const markers = state.dossier.migrationReview.flatMap((item) => {
    const match = item.match(INTEGRITY_MARKER);
    return match ? [{ importedAt: match[1], count: Number(match[2]) }] : [];
  });
  const pendingCaught = state.pendingImportReviews.reduce(
    (total, batch) => total + batch.proposals.filter((proposal) =>
      proposal.status !== "proposed" && proposal.group === "other" && (proposal.kind === "goal" || proposal.kind === "constraint")
    ).length,
    0
  );
  return {
    importedAt: markers.map((item) => item.importedAt),
    wrongCategoryItemsCaught: markers.reduce((total, item) => total + item.count, 0) + pendingCaught
  };
}

export function buildPilotSummary(state: CommandCenterState, nowIso: string): PilotSummary {
  const evidence = state.dossier.evidence;
  const approved = evidence.filter((item) => item.approved && !item.rejected);
  const integrity = durableIntegrity(state);
  const dossierStartedAt = earliest([
    state.dossier.createdAt,
    ...integrity.importedAt,
    ...evidence.map((item) => item.createdAt),
    ...state.pendingImportReviews.map((item) => item.importedAt),
    state.activeGoal?.selectedAt,
    ...state.lanes.map((item) => item.createdAt),
    ...state.resumePacks.map((item) => item.createdAt),
    ...state.resumeVersions.map((item) => item.createdAt),
    ...state.exports.map((item) => item.exportedAt)
  ]);
  // Evidence records are created when a Truth Inbox decision is committed or a
  // manual fact is approved. createdAt is immutable; updatedAt is not, so a
  // later edit can never rewrite the pilot's first-approval milestone.
  const firstEvidenceApprovedAt = earliest(approved.map((item) => item.createdAt));
  const firstPackGeneratedAt = earliest(state.resumePacks.map((pack) => pack.createdAt));
  const firstExportAt = earliest(state.exports.map((item) => item.exportedAt));
  const variants = state.resumePacks.flatMap((pack) => pack.variants);

  return {
    schema: "career-forge-pilot-summary-v1",
    generatedAt: nowIso,
    consent: true,
    journey: {
      dossierStartedAt,
      firstEvidenceApprovedAt,
      firstPackGeneratedAt,
      firstExportAt,
      minutesFromStartToFirstApprovedEvidence: minutesBetween(dossierStartedAt, firstEvidenceApprovedAt),
      minutesFromStartToFirstExport: minutesBetween(dossierStartedAt, firstExportAt)
    },
    counts: {
      approvedEvidence: approved.length,
      rejectedEvidence: evidence.filter((item) => item.rejected).length,
      activeLanes: state.lanes.filter((lane) => lane.status === "active").length,
      generatedVariants: variants.length,
      userEditedVariants: variants.filter((variant) => variant.userEdited).length,
      userEditedFieldPaths: variants.reduce((total, variant) => total + variant.userAuthoredPaths.length, 0),
      savedVersions: state.resumeVersions.length,
      exports: state.exports.length,
      exportedFiles: state.exports.reduce((total, item) => total + item.filenames.length, 0),
      applicationsTracked: state.applications.length,
      outreachContacts: state.outreach.length
    },
    integrity: {
      packsNeedingReview: state.resumePacks.filter((pack) => pack.status === "needs-review").length,
      claimsRefusedByGenerator: state.resumePacks.reduce((total, pack) => total + pack.receipt.unsupportedClaimsRefused.length, 0),
      wrongCategoryItemsCaught: integrity.wrongCategoryItemsCaught
    }
  };
}

// Guard used by tests and the settings UI: fails closed if any résumé-content
// field ever leaks into the summary shape.
const FORBIDDEN_SUMMARY_KEYS = ["detail", "claimText", "resume", "summary", "bullets", "fullName", "email", "evidence", "title", "company"];
export function pilotSummaryContainsContent(summary: PilotSummary): boolean {
  const check = (value: unknown): boolean => {
    if (Array.isArray(value)) return value.some(check);
    if (value && typeof value === "object") {
      return Object.entries(value).some(([key, child]) => FORBIDDEN_SUMMARY_KEYS.includes(key) || check(child));
    }
    return false;
  };
  return check(summary);
}
`);

write("scripts/pilot-metrics-regression.mjs", `// Pilot-summary regression: timings/counts remain durable after the Truth Inbox
// is completed and evidence is later edited; the export can never contain
// résumé content.
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
  const { outputText } = ts.transpileModule(source, { compilerOptions: { esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: absolute });
  const cjsModule = { exports: {} };
  moduleCache.set(absolute, cjsModule);
  const dirname = path.dirname(absolute);
  const localRequire = (request) => {
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", \`\${request.slice(2)}.ts\`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : \`\${request}.ts\`));
    return require(request);
  };
  new Function("require", "module", "exports", "__dirname", "__filename", outputText)(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { createPendingImportReview, commitTruthInboxReview } = loadTsModule(path.join(root, "src/lib/truth-inbox.ts"));
const { buildPilotSummary, pilotSummaryContainsContent } = loadTsModule(path.join(root, "src/lib/pilot-metrics.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(\`PASS \${label}\`); }
  else { failures += 1; console.error(\`FAIL \${label}\${detail ? \` — \${detail}\` : ""}\`); }
}

const T0 = "2026-07-01T10:00:00.000Z";
const T1 = "2026-07-01T10:25:00.000Z";
const T2 = "2026-07-01T10:50:00.000Z";
const T3 = "2026-07-01T11:40:00.000Z";
const SECRET = "Extremely identifying employer name: Meridian Logistics";
const proposals = [
  { id: "p-proof", group: "metrics-outcomes", kind: "proof", label: "Proof", detail: SECRET, sourceFilenames: [], sourceExcerpts: [SECRET], confidence: "high", status: "approved", edited: false, likelyDuplicateOf: null },
  { id: "p-pref", group: "other", kind: "goal", label: "Target preference (context only)", detail: "Target roles: Product Operations", sourceFilenames: [], sourceExcerpts: ["Target roles: Product Operations"], confidence: "high", status: "approved", edited: false, likelyDuplicateOf: null },
  { id: "p-gap", group: "other", kind: "constraint", label: "Evidence gap (not career-material content)", detail: "No SaaS implementation experience", sourceFilenames: [], sourceExcerpts: ["No SaaS implementation experience"], confidence: "high", status: "rejected", edited: false, likelyDuplicateOf: null }
];
const batch = createPendingImportReview("review-1", proposals, T0, false);
const initial = { ...emptyState(), pendingImportReviews: [batch] };
const committed = commitTruthInboxReview(initial, batch.id, T1);
check("completed Truth Inbox is removed from the active queue", committed.completed && committed.state.pendingImportReviews.length === 0);
check("a durable content-free integrity marker remains", committed.state.dossier.migrationReview.some((item) => item.includes("2 context-only imported item(s)")));
const approvedEvidence = committed.state.dossier.evidence.map((item) => item.approved ? { ...item, updatedAt: T2 } : item);
const state = {
  ...committed.state,
  dossier: { ...committed.state.dossier, evidence: approvedEvidence },
  lanes: [{ id: "lane-1", title: "Lane", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: T1 }],
  resumePacks: [{
    id: "pack-1", dossierId: "d", status: "needs-review", lanePacks: [],
    variants: [{ id: "v1", laneId: "lane-1", kind: "ats", title: "T", status: "current", canonical: true, userEdited: true, resume: { summary: SECRET, coreSkills: [], experience: [], education: "", linkedinHeadline: "", linkedinSummary: "" }, template: "Modern ATS", evidenceReferences: [], userAuthoredPaths: ["summary", "education"], sectionOrder: ["summary", "skills", "experience", "projects", "education"], sourceDossierUpdatedAt: T1, baselineVariantId: null, applicationId: null, createdAt: T1, updatedAt: T2 }],
    linkedinHeadlines: [], linkedinAbout: "", linkedinSkills: [], masterProofBank: [], coverLetterFoundation: "",
    receipt: { id: "r", generatedAt: T1, evidenceUsed: [], evidenceOmitted: [], laneFraming: [], keywordsIncluded: [], gapsAvoided: [], unsupportedClaimsRefused: ["refused-1", "refused-2"], transferredClaims: [], gapsLeftUnclaimed: [] },
    createdAt: T1, updatedAt: T2
  }],
  exports: [{ id: "e1", packId: "pack-1", formats: ["pdf"], filenames: ["a.pdf", "a.docx"], exportedAt: T3 }]
};

const summary = buildPilotSummary(state, T3);
check("time starts at the durable import timestamp, not the 1970 empty-state sentinel", summary.journey.dossierStartedAt === T0, JSON.stringify(summary.journey));
check("time to first approved evidence is stable after a later evidence edit", summary.journey.minutesFromStartToFirstApprovedEvidence === 25, JSON.stringify(summary.journey));
check("time to first export is sane", summary.journey.minutesFromStartToFirstExport === 100, JSON.stringify(summary.journey));
check("wrong-category count survives completion of the review queue", summary.integrity.wrongCategoryItemsCaught === 2, JSON.stringify(summary.integrity));
check("counts reflect edits, exports, and refused claims", summary.counts.userEditedVariants === 1 && summary.counts.userEditedFieldPaths === 2 && summary.counts.exportedFiles === 2 && summary.integrity.claimsRefusedByGenerator === 2, JSON.stringify(summary));
check("summary JSON contains no résumé content", !JSON.stringify(summary).includes("Meridian") && !JSON.stringify(summary).includes(SECRET));
check("content guard passes a clean summary", pilotSummaryContainsContent(summary) === false);
check("content guard fails closed when a content field sneaks into the shape", pilotSummaryContainsContent({ ...summary, extra: { detail: "leaked claim text" } }) === true);
check("content guard fails closed on nested résumé objects", pilotSummaryContainsContent({ ...summary, deep: [{ nested: { resume: {} } }] }) === true);

const empty = buildPilotSummary(emptyState(), T3);
check("literal emptyState produces null timings instead of a 29-million-minute journey", empty.journey.dossierStartedAt === null && empty.journey.minutesFromStartToFirstExport === null && empty.counts.approvedEvidence === 0, JSON.stringify(empty.journey));

console.log(\`\\n\${passes} passed, \${failures} failed\`);
if (failures > 0) process.exit(1);
`);

// ---------------------------------------------------------------------------
// 3. Align the separate $149 service, privacy, and terms with the parent site.
// ---------------------------------------------------------------------------
write("src/app/reviewed-service/page.tsx", `import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

const deliverables: Array<[string, string]> = [
  ["Career diagnostic", "A human reviews your current résumé, goals, and strongest evidence before rebuilding anything."],
  ["Rebuilt résumé", "One professionally reviewed résumé delivered in editable DOCX and finished PDF formats."],
  ["LinkedIn headline", "A concise headline aligned with the reviewed résumé and your strongest credible direction."],
  ["Three target-role directions", "Three realistic role directions with a short explanation of why each fits your evidence."],
  ["Loom walkthrough", "A recorded walkthrough explaining the changes, positioning decisions, and how to use the files."],
  ["One revision", "One focused revision round included when requested within 14 days of delivery."]
];

const processSteps: Array<[string, string]> = [
  ["1. Inquire", "Email your current background, target roles, and what is not working in your résumé. No payment is collected yet."],
  ["2. Confirm scope", "Koinophobia Labs confirms the deliverables, intake needs, privacy terms, and 48-hour delivery window in writing."],
  ["3. Pay", "You receive a secure payment link for the flat $149 after the scope is confirmed."],
  ["4. Review and rebuild", "Blake reviews the supplied material, rebuilds the package, and checks the PDF and DOCX page by page."],
  ["5. Delivery", "You receive the files, three target-role directions, LinkedIn headline, Loom walkthrough, and revision instructions."]
];

export default function ReviewedServicePage() {
  const inquiry = `mailto:koinophobia999@gmail.com?subject=${encodeURIComponent("Career Forge Résumé Rebuild ($149) — inquiry")}&body=${encodeURIComponent("Hi Blake — I'm interested in the Career Forge Résumé Rebuild.\n\nName:\nCurrent role or background:\nTarget roles:\nWhat is not working in my current résumé:\n")}`;
  return (
    <main>
      <CommandNav active="/pricing" />
      <section className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Human service · Separate from the SaaS beta</p>
        <h1 className="mt-3 text-3xl font-bold text-paper sm:text-4xl">Career Forge Résumé Rebuild — $149 flat</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-paper/68">
          This is the same done-for-you offer shown by Koinophobia Labs: a diagnostic, rebuilt résumé, LinkedIn headline,
          three target-role directions, Loom walkthrough, and one revision. It is not an automated Career Pack and does
          not imply that public-beta output received human review.
        </p>

        <div className="trust-panel mt-8 p-5 sm:p-6" aria-labelledby="reviewed-deliverables-title">
          <h2 id="reviewed-deliverables-title" className="text-xl font-bold text-paper">What the $149 includes</h2>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            {deliverables.map(([item, description]) => (
              <div key={item} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <dt className="text-sm font-bold text-cyan">{item}</dt>
                <dd className="mt-1 text-xs leading-5 text-paper/65">{description}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="trust-panel mt-6 p-5 sm:p-6" aria-labelledby="reviewed-process-title">
          <h2 id="reviewed-process-title" className="text-xl font-bold text-paper">How it works</h2>
          <ol className="mt-4 grid gap-3">
            {processSteps.map(([step, description]) => (
              <li key={step} className="rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-sm font-bold text-paper">{step}</p>
                <p className="mt-1 text-xs leading-5 text-paper/65">{description}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 grid gap-2 text-xs leading-5 text-paper/70 sm:grid-cols-2">
            <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2"><strong className="text-gold">Turnaround:</strong> within 48 hours after payment and complete intake.</p>
            <p className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-2"><strong className="text-gold">Revision:</strong> one focused round included within 14 days of delivery.</p>
          </div>
          <a href={inquiry} className="lab-pill-button mt-5 inline-flex min-h-11 items-center px-6 py-2.5 text-sm font-black">
            Request the rebuild — no payment yet →
          </a>
        </div>

        <div className="mt-6 rounded-xl border border-cyan/25 bg-cyan/5 p-4 text-xs leading-5 text-paper/70">
          Choosing this human service means voluntarily sending your résumé or Career Forge export to Koinophobia Labs.
          That is a separate data flow from the local-first app. Read the <Link href="/privacy" className="font-bold text-cyan underline">service privacy terms</Link> and <Link href="/terms" className="font-bold text-cyan underline">service terms</Link> before sending files.
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
`);

write("src/app/privacy/page.tsx", `import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Privacy — Career Forge" };

export default function PrivacyPage() {
  return (
    <main>
      <CommandNav active="/privacy" />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Privacy</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">The Career Forge app keeps your career data on your device.</h1>
        <p className="mt-2 text-sm text-paper/50">Last updated: July 18, 2026</p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-paper/75">
          <section>
            <h2 className="text-lg font-bold text-paper">Local-first app data</h2>
            <p className="mt-2">Your work history, imported résumés, approved evidence, generated documents, applications, contacts, and interview practice live in your browser&apos;s local storage. There are no Career Forge accounts and no career-profile database. Imported résumé files are parsed in your browser and the raw files are not retained by the app. Koinophobia Labs cannot read this local career data.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Anonymous product events</h2>
            <p className="mt-2">Career Forge records content-free event names such as &quot;evidence approved&quot; or &quot;résumé exported&quot; through Vercel Analytics. Events contain no résumé text, employer names, job descriptions, personal details, or Career Forge account identifier.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Founding-user pilot summaries</h2>
            <p className="mt-2">Pilot summaries are never transmitted automatically. A participant must explicitly consent, generate the counts-and-timings JSON in Settings, review it, and send it manually. The summary contains no résumé content, name, employer, or contact information.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Optional $149 human service</h2>
            <p className="mt-2">The Career Forge Résumé Rebuild is separate from the local-first app. When you choose that service, you voluntarily email a résumé, Career Forge export, or other intake material to Koinophobia Labs so Blake Taylor can perform the work. Only Koinophobia Labs and the email/file providers used for delivery may access those files. Working files are deleted within 30 days after final delivery unless you request earlier deletion or longer retention in writing. Transaction records may be retained where required for accounting, fraud prevention, or legal compliance.</p>
            <p className="mt-2">Request early deletion or ask a service-data question at <a href="mailto:koinophobia999@gmail.com" className="text-cyan underline hover:text-gold">koinophobia999@gmail.com</a>.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Purchases</h2>
            <p className="mt-2">Checkout happens on Stripe. Stripe handles payment details and email under <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-cyan underline hover:text-gold">Stripe&apos;s privacy policy</a>; Koinophobia Labs never sees your full card number. A Career Pack license contains the pack tier and an order reference, not your career data.</p>
          </section>
          <section>
            <h2 className="text-lg font-bold text-paper">Deleting app data</h2>
            <p className="mt-2"><Link href="/settings" className="text-cyan underline hover:text-gold">Settings → Clear local data</Link> removes every Career Forge record from this browser. Clearing the site&apos;s browser storage does the same. Human-service files follow the separate deletion policy above.</p>
          </section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
`);

write("src/app/terms/page.tsx", `import Link from "next/link";
import { CommandNav } from "@/components/CommandNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = { title: "Terms of Use — Career Forge" };

export default function TermsPage() {
  return (
    <main>
      <CommandNav active="/terms" />
      <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <p className="trust-kicker text-sm font-bold uppercase">Terms of Use</p>
        <h1 className="mt-3 text-3xl font-bold text-paper">Plain terms for Career Forge</h1>
        <p className="mt-2 text-sm text-paper/50">Last updated: July 18, 2026</p>
        <div className="mt-8 space-y-8 text-sm leading-7 text-paper/75">
          <section><h2 className="text-lg font-bold text-paper">What Career Forge is</h2><p className="mt-2">Career Forge, by Koinophobia Labs, helps you organize real work history into résumés, positioning, outreach, application records, and interview preparation. It is a writing and organization tool, not a recruiter, employer, legal adviser, or guarantee of a hiring outcome.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Career Pack purchases and licenses</h2><p className="mt-2">Paid Career Packs are one-time purchases, not subscriptions. A purchase issues a personal license key that unlocks the stated pack features in a browser where you enter it. Do not publish, transfer, or resell a key. Payments are processed by Stripe. The exact tier scope shown at checkout controls the purchase.</p><p className="mt-2">If payment succeeds but the key is not delivered or does not activate, contact <a href="mailto:koinophobia999@gmail.com" className="text-cyan underline hover:text-gold">koinophobia999@gmail.com</a> with the Stripe receipt reference.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Your content and responsibility</h2><p className="mt-2">Everything you enter remains yours. Career Forge is designed to build generated fields from approved evidence and clearly mark user-authored edits, but you remain responsible for reviewing every claim, date, heading, company, link, and layout before submitting material to an employer. No product can guarantee that every applicant-tracking system will parse a file identically.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Local data and backups</h2><p className="mt-2">Career data lives in your browser&apos;s local storage. Koinophobia Labs cannot recover local data after you clear it or lose the device. Use the backup tools in <Link href="/settings" className="text-cyan underline hover:text-gold">Settings</Link>. See <Link href="/privacy" className="text-cyan underline hover:text-gold">Privacy</Link> for the separate rules that apply when you voluntarily use the human service.</p></section>
          <section>
            <h2 className="text-lg font-bold text-paper">$149 Career Forge Résumé Rebuild</h2>
            <p className="mt-2">The human service includes a diagnostic, one rebuilt résumé in PDF and DOCX, one LinkedIn headline, three target-role directions, a Loom walkthrough, and one focused revision requested within 14 days. Delivery is targeted within 48 hours after payment and complete intake. The service begins only after the scope is confirmed in writing.</p>
            <p className="mt-2">Cancel before work begins for a full refund. Once the human review or rebuild has begun, the fee is non-refundable except when Koinophobia Labs cannot deliver the agreed scope. Requests beyond the listed deliverables or included revision require a separate quote. Sending files for this service authorizes Koinophobia Labs to access them only for intake, delivery, revision, support, and the retention period described on the privacy page.</p>
          </section>
          <section><h2 className="text-lg font-bold text-paper">Warranty and liability</h2><p className="mt-2">Career Forge is provided as-is during beta. To the maximum extent the law allows, Koinophobia Labs is not liable for indirect damages, missed opportunities, employer decisions, or third-party outages. Total liability is limited to the amount paid for the affected product or service.</p></section>
          <section><h2 className="text-lg font-bold text-paper">Changes</h2><p className="mt-2">Material changes update the date above. A purchase remains governed by the tier scope and service terms presented when the order was placed.</p></section>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
`);

// ---------------------------------------------------------------------------
// 4. Validate the $49 Career Reset tier first; keep higher tiers closed.
// ---------------------------------------------------------------------------
replaceOnce(
  "src/app/pricing/page.tsx",
  `  const isPublicBeta = commerceMode === "off";
  const faqs = isPublicBeta ? betaFaqs : purchaseFaqs;
`,
  `  const isPublicBeta = commerceMode === "off";
  const configuredPaidBetaTier = process.env.NEXT_PUBLIC_PAID_BETA_TIER;
  const paidBetaTier: PackageTier = configuredPaidBetaTier === "job-search" || configuredPaidBetaTier === "career-switch" ? configuredPaidBetaTier : "reset";
  const faqs = isPublicBeta ? betaFaqs : purchaseFaqs;
`
);
replaceOnce(
  "src/app/pricing/page.tsx",
  `  async function startCheckout(tier: PackageTier) {
    if (pendingTier || !commerceEnabled) return;
`,
  `  async function startCheckout(tier: PackageTier) {
    if (pendingTier || !commerceEnabled || (commerceMode === "live" && tier !== paidBetaTier)) return;
`
);
replaceOnce(
  "src/app/pricing/page.tsx",
  `{isPublicBeta ? "Public beta · No purchases enabled" : "One-time purchase · No account · No subscription"}`,
  `{isPublicBeta ? "Public beta · No purchases enabled" : commerceMode === "live" ? "Founding paid beta · Career Reset only" : "One-time purchase · No account · No subscription"}`
);
replaceOnce(
  "src/app/pricing/page.tsx",
  `            const highlighted = tier === "job-search";
            const owned = entitlement.status === "valid" && entitlement.tier === tier;
`,
  `            const tierAvailable = commerceMode !== "live" || tier === paidBetaTier;
            const highlighted = commerceMode === "live" ? tier === paidBetaTier : tier === "job-search";
            const owned = entitlement.status === "valid" && entitlement.tier === tier;
`
);
replaceOnce(
  "src/app/pricing/page.tsx",
  `                {commerceEnabled ? (
                  owned ? (
`,
  `                {commerceEnabled ? (
                  !tierAvailable ? (
                    <p className="mt-6 rounded-md border border-white/15 bg-white/5 px-4 py-3 text-center text-sm font-bold text-paper/60">
                      Not in the founding paid beta yet
                    </p>
                  ) : owned ? (
`
);

replaceOnce(
  "src/app/api/checkout/route.ts",
  `  if (!isPackageTier(tier)) {
    return NextResponse.json({ error: "Unknown package." }, { status: 400 });
  }

  const result = await createCheckoutSession(tier, requestOrigin(request), secretKey);
`,
  `  if (!isPackageTier(tier)) {
    return NextResponse.json({ error: "Unknown package." }, { status: 400 });
  }
  const configuredTier = process.env.PAID_BETA_TIER;
  const paidBetaTier = configuredTier === "job-search" || configuredTier === "career-switch" ? configuredTier : "reset";
  if (process.env.NEXT_PUBLIC_COMMERCE_MODE === "live" && tier !== paidBetaTier) {
    return NextResponse.json({ error: "That package is not open in the founding paid beta yet." }, { status: 403 });
  }

  const result = await createCheckoutSession(tier, requestOrigin(request), secretKey);
`
);

replaceOnce(
  ".env.example",
  `NEXT_PUBLIC_COMMERCE_MODE=off
`,
  `NEXT_PUBLIC_COMMERCE_MODE=off

# Invite-only live commerce opens one tier at a time. Test mode may exercise all
# tiers; live mode defaults to Career Reset unless both values are changed.
PAID_BETA_TIER=reset
NEXT_PUBLIC_PAID_BETA_TIER=reset
`
);

write("docs/FOUNDING_USER_PILOT.md", `# Founding-User Pilot Protocol

Internal tests establish mechanical readiness. They cannot establish usefulness or willingness to pay. Career Forge will validate **one commercial outcome first: the $49 Career Reset Pack**. The $79 Job Search and $99 Career Switch packs remain hypotheses until the first tier earns its footing.

## Release stages

### Stage 0 — production and commerce proof

- Fresh production re-audit is green.
- Commerce runs in Stripe **test mode** and completes checkout → signed license → activation → first export.
- General live commerce remains off.

### Stage 1 — three guided usability sessions

- Three individually recruited participants complete the Career Reset workflow without payment.
- The founder observes friction, reviews every artifact, and fixes release-blocking defects.
- Participants explicitly consent before sharing the content-free pilot summary or any résumé with a reviewer.

### Stage 2 — five-user paid founding cohort

- Open invite-only live checkout for **Career Reset only** at $49.
- Five users pay, complete one lane, and receive normal product support.
- Refunds are available under the published terms; actual refund behavior is measured.
- $79 and $99 checkout remain closed even though their scopes may stay visible as future hypotheses.

## Privacy boundary

Participants export the pilot summary from Settings. It contains counts and timestamps only (`career-forge-pilot-summary-v1`) and is never transmitted automatically. Résumé content, names, employers, and contact details are excluded by a fail-closed content guard. Recruiter review is separate, optional, and requires explicit consent.

## Per-participant measurements

| Metric | Source |
| --- | --- |
| Time to first approved evidence | pilot summary |
| Time to first usable export | pilot summary |
| Export success and blockers | pilot summary + interview |
| Editing minutes per artifact | participant self-report |
| Artifact disposition: used / lightly edited / heavily edited / abandoned | participant interview |
| Wrong-category items caught | pilot summary + interview |
| Usefulness rating (1–5) | participant interview |
| Would request refund / did request refund | interview + actual paid cohort |
| Used in a real application | two-week follow-up |
| Open-ended willingness to pay | ask before naming $49 in Stage 1 |

## Blinded recruiter review

For each consenting participant, use `node scripts/build-recruiter-packet.mjs` to randomize:

1. The prior résumé.
2. Career Forge output after logged light edits.
3. A generic-AI baseline built from the same history.

At least two independent recruiters score credibility, clarity, target-role alignment, factual defensibility, likelihood of interview, and editing burden. Reviewers never see the label key.

## Career Reset support threshold

The $49 tier is supported only when all are true:

1. At least five **paid** participants complete the one-lane workflow.
2. At least four of five rate the core artifacts 4/5 or higher.
3. Median editing burden is 15 minutes or less per artifact.
4. Recruiter review finds zero generation-caused factual-defensibility failures.
5. Career Forge beats or ties the generic-AI baseline on credibility and factual defensibility for each participant.
6. At least three participants use an artifact in a real application.
7. At least three of five say the result was worth $49 after use.
8. The completed-cohort refund rate is no more than one of five, and every refund cause is documented.

Until all criteria hold, public language remains **founding paid beta**, not validated pricing. The $79 and $99 tiers do not open automatically when Career Reset passes; each requires its own cohort and evidence.

## Records

Personal pilot records live outside the repository. The repository stores only this protocol, content-free schemas and aggregate conclusions, test evidence, and blinded-packet tooling.
`);

// ---------------------------------------------------------------------------
// 5. Fix discovery-question language and the second browser-server teardown.
// ---------------------------------------------------------------------------
replaceOnce(
  "src/components/InterviewPrep.tsx",
  `{open ? "Collapse" : "Practice"}`,
  `{open ? "Collapse" : question.category === "discovery" ? "Add evidence" : "Practice"}`
);
replaceOnce(
  "src/components/InterviewPrep.tsx",
  `<span className="text-sm font-bold text-paper">Draft your answer</span>`,
  `<span className="text-sm font-bold text-paper">{question.category === "discovery" ? "Record the real example or missing evidence" : "Draft your answer"}</span>`
);
replaceOnce(
  "src/components/InterviewPrep.tsx",
  `placeholder="Write it the way you'd say it out loud — or insert the structure below and fill in each line."`,
  `placeholder={question.category === "discovery" ? "Write the real situation, action, result, source, or detail you still need to verify." : "Write it the way you'd say it out loud — or insert the structure below and fill in each line."}`
);
replaceOnce(
  "src/components/InterviewPrep.tsx",
  `{pendingTier === tier ? "Opening secure checkout…" : \`Get the \${pack.name}\`}`,
  `{pendingTier === tier ? "Opening secure checkout…" : \`Get the \${pack.name}\`}`
);

replaceOnce(
  "scripts/recovery-proof-browser.mjs",
  `  cwd: root,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "test", NEXT_PUBLIC_LICENSE_PUBLIC_KEY: publicB64 },
`,
  `  cwd: root,
  detached: process.platform !== "win32",
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NEXT_PUBLIC_COMMERCE_MODE: "test", NEXT_PUBLIC_LICENSE_PUBLIC_KEY: publicB64 },
`
);
replaceOnce(
  "scripts/recovery-proof-browser.mjs",
  `async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server.exitCode !== null) throw new Error(\`Server exited early.\\n\${output}\`);
    try { const response = await fetch(baseUrl); if (response.ok) return; } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(\`Server did not start.\\n\${output}\`);
}
`,
  `async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 90_000) {
    if (server.exitCode !== null) throw new Error(\`Server exited early.\\n\${output}\`);
    try { const response = await fetch(baseUrl); if (response.ok) return; } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(\`Server did not start.\\n\${output}\`);
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
`
);
replaceOnce(
  "scripts/recovery-proof-browser.mjs",
  `} finally {
  await browser?.close();
  server.kill();
}
`,
  `} finally {
  await browser?.close();
  await stopServer();
}
`
);

console.log("Applied Career Forge commercial-readiness fixes.");
