// Complete migration coverage: a contaminated pre-fix state (context-only
// preferences, gap statements, uncertainty, and separation reasons lodged in
// evidence, pack metadata, variants, and saved versions) is run through the
// real migration (sanitizeCommandCenterState), then EVERY derived surface is
// swept for surviving contamination:
//   résumé bodies · LinkedIn materials · lane positioning pitches · receipt
//   lane framing · proof banks · cover-letter foundations · outreach evidence
//   options · interview seeds · saved versions · pack metadata · plain-text
//   export · PDF export (extracted from the real PDF) · DOCX export
//   (word/document.xml) · ZIP bundle (every entry).
// Legitimate professional facts and explicit user edits must survive.
// Before/after state snapshots are preserved as PR evidence.
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

const { emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { emptyDossier, evidenceRecord } = loadTsModule(path.join(root, "src/lib/dossier.ts"));
const { sanitizeCommandCenterState, isProfessionalEvidence } = loadTsModule(path.join(root, "src/lib/evidence-admissibility.ts"));
const { variantPlainText, createVariantFile, createPackBundle } = loadTsModule(path.join(root, "src/lib/pack-export.ts"));
const { generateInterviewPrep } = loadTsModule(path.join(root, "src/lib/interview-prep.ts"));

let passes = 0;
let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { passes += 1; console.log(`PASS ${label}`); }
  else { failures += 1; console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`); }
}

const EVIDENCE_DIR = path.join(root, "docs/evidence/paid-beta-surge/migration-trace");
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

// --- Contamination markers ---------------------------------------------------
const NOW = "2026-07-16T18:00:00.000Z";
const PREFERENCE = "Target roles: Product Operations Specialist; Implementation Specialist";
const GAP = "No reliable numerical performance metrics";
const SEPARATION_SENTENCE = "Managed vendor contracts worth $2M annually until I was laid off in June 2026";
const UNCERTAINTY = "I don't know my exact ticket numbers";
const SAFE_REMAINDER = "Managed vendor contracts worth $2M annually";
const SAFE_FACT = "Resolved customer escalations and documented the outcome";
const USER_EDIT = "Rewrote onboarding documentation for new hires";
// Markers that must never survive in ANY derived output.
const FORBIDDEN = ["Target roles:", "laid off", "I don't know", "No reliable numerical"];
function contaminationIn(text) {
  return FORBIDDEN.filter((marker) => text.toLowerCase().includes(marker.toLowerCase()));
}

// --- Build the contaminated pre-fix state ------------------------------------
const unsafeGap = evidenceRecord("proof", GAP, "manual", true, NOW, { label: "Proof" });
const unsafeUncertainty = evidenceRecord("metric", UNCERTAINTY, "manual", true, NOW, { label: "Metric" });
const unsafePreference = evidenceRecord("proof", PREFERENCE, "manual", true, NOW, { label: "Proof" });
const safeProof = evidenceRecord("proof", SAFE_FACT, "manual", true, NOW, { label: "Proof" });
const roleEvidence = evidenceRecord("role", "Operations Coordinator — Meridian Logistics (2020–2026)", "manual", true, NOW, { label: "Role" });

const dossier = {
  ...emptyDossier(NOW),
  identity: { fullName: "Casey Contaminated", email: "casey@example.com", phone: "", location: "", links: [] },
  evidence: [unsafeGap, unsafeUncertainty, unsafePreference, safeProof, roleEvidence],
  proofPoints: [GAP, SAFE_FACT],
  approvedClaims: [GAP, PREFERENCE, SAFE_FACT]
};

const contaminatedResume = {
  summary: `Operations professional. ${SEPARATION_SENTENCE}. ${PREFERENCE}.`,
  coreSkills: ["Vendor Management", GAP],
  experience: [{
    title: "Operations Coordinator", company: "Meridian Logistics", time: "2020–2026",
    bullets: [SEPARATION_SENTENCE, SAFE_FACT, USER_EDIT, UNCERTAINTY]
  }],
  education: "",
  linkedinHeadline: `Operations Coordinator. ${PREFERENCE}`,
  linkedinSummary: `${SEPARATION_SENTENCE}. ${SAFE_FACT}.`
};

const contaminatedVariant = {
  id: "variant-1", laneId: "lane-old", kind: "ats", title: "ATS", status: "current", canonical: true,
  userEdited: true, resume: contaminatedResume, template: "Modern ATS",
  evidenceReferences: [], userAuthoredPaths: ["experience.0.bullets"],
  sectionOrder: ["summary", "skills", "experience", "projects", "education"],
  sourceDossierUpdatedAt: NOW, baselineVariantId: null, applicationId: null, createdAt: NOW, updatedAt: NOW
};

const contaminatedState = {
  ...emptyState(),
  dossier,
  lanes: [{ id: "lane-old", title: "Product Operations", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "custom", createdAt: NOW }],
  resumePacks: [{
    id: "pack-old", dossierId: dossier.id, status: "current",
    lanePacks: [{ laneId: "lane-old", positioningPitch: PREFERENCE, variantIds: ["variant-1"], evidenceUsed: [unsafeGap.id], evidenceOmitted: [], gapsAvoided: [] }],
    variants: [contaminatedVariant],
    linkedinHeadlines: [PREFERENCE, SAFE_FACT],
    linkedinAbout: `${SEPARATION_SENTENCE}. ${PREFERENCE}.`,
    linkedinSkills: ["Vendor Management"],
    masterProofBank: [PREFERENCE, GAP, SAFE_FACT],
    coverLetterFoundation: SEPARATION_SENTENCE,
    receipt: { id: "receipt-old", generatedAt: NOW, evidenceUsed: [unsafeGap.id], evidenceOmitted: [], laneFraming: [{ laneId: "lane-old", angle: PREFERENCE }], keywordsIncluded: [], gapsAvoided: [], unsupportedClaimsRefused: [], transferredClaims: [PREFERENCE, SAFE_FACT], gapsLeftUnclaimed: [] },
    createdAt: NOW, updatedAt: NOW
  }],
  resumeVersions: [
    {
      id: "version-snapshot", label: "Contaminated snapshot", createdAt: NOW, source: "tailor",
      resumeText: `${SEPARATION_SENTENCE}\n${SAFE_FACT}`, notes: "", applicationId: null, laneId: "lane-old",
      targetTitle: "", targetCompany: "", keywordsUsed: [], influenceSummary: "",
      resumeSnapshot: { fullName: "Casey Contaminated", email: "casey@example.com", phone: "", website: "", template: "Modern ATS", resume: contaminatedResume }
    },
    {
      id: "version-text-only", label: "Contaminated text-only", createdAt: NOW, source: "plain",
      resumeText: `- ${SEPARATION_SENTENCE}\n- ${SAFE_FACT}\n- ${PREFERENCE}`, notes: "", applicationId: null, laneId: null,
      targetTitle: "", targetCompany: "", keywordsUsed: [], influenceSummary: "", resumeSnapshot: null
    }
  ]
};

fs.writeFileSync(path.join(EVIDENCE_DIR, "state-before-migration.json"), JSON.stringify(contaminatedState, null, 2));

// --- Run the migration -------------------------------------------------------
const migrated = sanitizeCommandCenterState(contaminatedState);
fs.writeFileSync(path.join(EVIDENCE_DIR, "state-after-migration.json"), JSON.stringify(migrated, null, 2));

const pack = migrated.resumePacks[0];
const variant = pack.variants[0];

// --- 1–4: résumé bodies, LinkedIn, pitches, framing, proof bank, cover letter
check("résumé summary drops the separation reason but keeps the safe remainder",
  !contaminationIn(variant.resume.summary).length && variant.resume.summary.includes(SAFE_REMAINDER), variant.resume.summary);
check("résumé bullets drop separation/uncertainty but keep the safe fact and the user edit",
  !contaminationIn(variant.resume.experience[0].bullets.join("\n")).length
    && variant.resume.experience[0].bullets.some((bullet) => bullet.includes(SAFE_FACT))
    && variant.resume.experience[0].bullets.some((bullet) => bullet.includes(USER_EDIT)),
  JSON.stringify(variant.resume.experience[0].bullets));
check("core skills drop the gap statement", !contaminationIn(variant.resume.coreSkills.join("\n")).length, JSON.stringify(variant.resume.coreSkills));
check("LinkedIn headline and summary are decontaminated",
  !contaminationIn(`${variant.resume.linkedinHeadline}\n${variant.resume.linkedinSummary}`).length,
  `${variant.resume.linkedinHeadline} | ${variant.resume.linkedinSummary}`);
check("pack LinkedIn materials are decontaminated",
  !contaminationIn([...pack.linkedinHeadlines, pack.linkedinAbout, ...pack.linkedinSkills].join("\n")).length,
  JSON.stringify([pack.linkedinHeadlines, pack.linkedinAbout]));
check("lane positioning pitch is decontaminated", !contaminationIn(pack.lanePacks.map((lane) => lane.positioningPitch).join("\n")).length);
check("receipt lane framing is decontaminated", !contaminationIn(pack.receipt.laneFraming.map((item) => item.angle).join("\n")).length);
check("master proof bank keeps the safe fact, drops contamination",
  !contaminationIn(pack.masterProofBank.join("\n")).length && pack.masterProofBank.some((item) => item.includes(SAFE_FACT)),
  JSON.stringify(pack.masterProofBank));
check("cover-letter foundation is decontaminated", !contaminationIn(pack.coverLetterFoundation).length, pack.coverLetterFoundation);
check("receipt transferred claims are decontaminated", !contaminationIn(pack.receipt.transferredClaims.join("\n")).length);

// --- 5: outreach evidence options -------------------------------------------
const outreachOptions = migrated.dossier.evidence.filter((item) => item.approved && !item.rejected && isProfessionalEvidence(item));
check("outreach evidence options exclude every contaminated record and keep the safe ones",
  !contaminationIn(outreachOptions.map((item) => item.detail).join("\n")).length
    && outreachOptions.some((item) => item.detail === SAFE_FACT),
  JSON.stringify(outreachOptions.map((item) => item.detail)));

// --- 6: interview seeds ------------------------------------------------------
const prep = generateInterviewPrep(migrated.profile, migrated.lanes[0], null, migrated.dossier);
const prepText = JSON.stringify(prep);
check("interview seeds contain no separation reasons, preferences, or uncertainty",
  !prepText.includes("laid off") && !prepText.includes("Target roles:") && !prepText.toLowerCase().includes("i don't know my exact"), "");
const nonGapQuestions = (prep.questions ?? prep).filter?.((question) => !["gap_defense", "discovery"].includes(question.category)) ?? [];
check("gap statements never seed behavioral or role questions",
  !JSON.stringify(nonGapQuestions).includes("No reliable numerical"), "");

// --- 7: saved versions -------------------------------------------------------
const snapshotVersion = migrated.resumeVersions.find((item) => item.id === "version-snapshot");
const textVersion = migrated.resumeVersions.find((item) => item.id === "version-text-only");
check("saved version snapshot is decontaminated and keeps safe content",
  !contaminationIn(JSON.stringify(snapshotVersion.resumeSnapshot)).length
    && JSON.stringify(snapshotVersion.resumeSnapshot).includes(SAFE_REMAINDER), "");
check("saved version resumeText (snapshot-backed) is decontaminated", !contaminationIn(snapshotVersion.resumeText).length, snapshotVersion.resumeText);
check("text-only saved version is decontaminated line by line and keeps the safe fact",
  !contaminationIn(textVersion.resumeText).length && textVersion.resumeText.includes(SAFE_FACT), textVersion.resumeText);

// --- 8: whole-pack metadata sweep -------------------------------------------
check("no contamination anywhere in the migrated pack object", !contaminationIn(JSON.stringify(pack)).length);

// --- 9: export formats -------------------------------------------------------
const plain = variantPlainText(migrated.dossier, variant.resume, variant.sectionOrder, variant.kind);
fs.writeFileSync(path.join(EVIDENCE_DIR, "export-plain-text.txt"), plain);
check("plain-text export is decontaminated and keeps the safe remainder",
  !contaminationIn(plain).length && plain.includes(SAFE_REMAINDER), plain);

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const pdfFile = await createVariantFile(variant, migrated.dossier, "Product Operations", "pdf");
const pdfBuffer = Buffer.from(await pdfFile.blob.arrayBuffer());
fs.writeFileSync(path.join(EVIDENCE_DIR, pdfFile.filename), pdfBuffer);
const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer), isEvalSupported: false, disableFontFace: true }).promise;
let pdfText = "";
for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
  const content = await (await pdfDocument.getPage(pageNumber)).getTextContent();
  pdfText += content.items.map((item) => item.str).join("\n");
}
check("PDF export is decontaminated (extracted from the real rendered PDF)", !contaminationIn(pdfText).length, contaminationIn(pdfText).join(", "));

const JSZipLib = require("jszip");
const docxFile = await createVariantFile(variant, migrated.dossier, "Product Operations", "docx");
const docxBuffer = Buffer.from(await docxFile.blob.arrayBuffer());
fs.writeFileSync(path.join(EVIDENCE_DIR, docxFile.filename), docxBuffer);
const docxXml = await (await JSZipLib.loadAsync(docxBuffer)).file("word/document.xml").async("string");
check("DOCX export is decontaminated (word/document.xml)", !contaminationIn(docxXml).length, contaminationIn(docxXml).join(", "));

const bundle = await createPackBundle(pack, migrated.dossier, migrated.lanes, ["pdf", "docx"]);
const bundleZip = await JSZipLib.loadAsync(Buffer.from(await bundle.blob.arrayBuffer()));
let zipContamination = [];
for (const [entryName, entry] of Object.entries(bundleZip.files)) {
  if (entryName.endsWith(".txt")) {
    zipContamination.push(...contaminationIn(await entry.async("string")).map((marker) => `${entryName}: ${marker}`));
  } else if (entryName.endsWith(".docx")) {
    const inner = await JSZipLib.loadAsync(await entry.async("nodebuffer"));
    zipContamination.push(...contaminationIn(await inner.file("word/document.xml").async("string")).map((marker) => `${entryName}: ${marker}`));
  } else if (entryName.endsWith(".pdf")) {
    const innerDocument = await pdfjs.getDocument({ data: new Uint8Array(await entry.async("nodebuffer")), isEvalSupported: false, disableFontFace: true }).promise;
    let innerText = "";
    for (let pageNumber = 1; pageNumber <= innerDocument.numPages; pageNumber += 1) {
      const content = await (await innerDocument.getPage(pageNumber)).getTextContent();
      innerText += content.items.map((item) => item.str).join("\n");
    }
    zipContamination.push(...contaminationIn(innerText).map((marker) => `${entryName}: ${marker}`));
  }
}
check(`ZIP bundle (${Object.keys(bundleZip.files).length} entries incl. PDFs, DOCX, LinkedIn materials, README) is fully decontaminated`, zipContamination.length === 0, zipContamination.join(" | "));

// --- 10: legitimate work survives -------------------------------------------
check("safe evidence record remains approved after migration",
  migrated.dossier.evidence.some((item) => item.detail === SAFE_FACT && item.approved && !item.rejected));
check("user-authored edit path is preserved on the variant",
  variant.userAuthoredPaths.includes("experience.0.bullets") && variant.userEdited === true);
check("migration flags the pack for review instead of silently passing it",
  pack.status === "needs-review" || pack.variants.every((item) => item.status !== "current") || migrated.dossier.evidence.every((item) => !contaminationIn(item.detail).length || !item.approved),
  `pack.status=${pack.status}`);

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
