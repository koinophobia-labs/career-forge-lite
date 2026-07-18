// User-authored edit regression: editing generated text must preserve the exact
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
    if (request.startsWith("@/")) return loadTsModule(path.join(root, "src", `${request.slice(2)}.ts`));
    if (request.startsWith(".")) return loadTsModule(path.resolve(dirname, request.endsWith(".ts") ? request : `${request}.ts`));
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
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
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
check("the edited document still produces a real PDF", pdf.filename.endsWith(".pdf") && pdf.blob.size > 500, `${pdf.filename} ${pdf.blob.size}`);

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
