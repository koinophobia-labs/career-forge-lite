import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
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
  const fn = new Function("require", "module", "exports", "__dirname", "__filename", outputText);
  fn(localRequire, cjsModule, cjsModule.exports, dirname, absolute);
  return cjsModule.exports;
}

const { emptyState, parseState, reviveResumeSnapshot } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { recordTailoredResumeVersion } = loadTsModule(path.join(root, "src/lib/tailor-handoff.ts"));
const { resumeToText } = loadTsModule(path.join(root, "src/lib/resume-export.ts"));
const { runAtsChecks } = loadTsModule(path.join(root, "src/lib/ats.ts"));
const { generateResumePackage } = loadTsModule(path.join(root, "src/lib/generator.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));

let failures = 0;
let passes = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passes += 1;
    console.log(`PASS ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const NOW = "2026-07-06T12:00:00.000Z";

// A realistic generated package, snapshotted the way the builder does it.
const intake = {
  ...initialIntake,
  fullName: "Test Person",
  email: "test@example.com",
  phone: "555-0100",
  website: "example.com",
  targetJobTitle: "Product Support Specialist",
  currentTitle: "Customer Service Representative",
  currentCompany: "RetailCo",
  currentTime: "3 years",
  tools: "spreadsheets, ticketing systems",
  responsibilities: "customer support, troubleshooting billing issues, escalation handling",
  outcomes: "kept customer satisfaction high during peak volume",
  customersServed: "50"
};
const generated = generateResumePackage(intake);
const storedText = resumeToText(intake, generated);

const snapshot = {
  fullName: intake.fullName,
  email: intake.email,
  phone: intake.phone,
  website: intake.website,
  template: "Tech ATS",
  resume: {
    summary: generated.summary,
    coreSkills: [...generated.coreSkills],
    experience: generated.experience.map((role) => ({ ...role, bullets: [...role.bullets] })),
    education: generated.education,
    linkedinHeadline: generated.linkedinHeadline,
    linkedinSummary: generated.linkedinSummary
  }
};

const handoff = {
  version: 1,
  createdAt: NOW,
  applicationId: "app-1",
  company: "Acme",
  roleTitle: "Product Support Specialist",
  laneId: null,
  laneTitle: null,
  resumeAngle: "",
  keywords: [],
  coveredRequirements: [],
  partialRequirements: [],
  gaps: [],
  weakSpots: [],
  bulletPrompts: []
};

const baseState = {
  ...emptyState(),
  applications: [
    {
      id: "app-1",
      company: "Acme",
      roleTitle: "Product Support Specialist",
      laneId: null,
      status: "applied",
      jobPostUrl: "",
      resumeVersionId: null,
      appliedAt: NOW,
      nextFollowUpAt: null,
      interviewAt: null,
      notes: "",
      analysisKeywords: [],
      analysisGaps: [],
      analysisWeakSpots: [],
      createdAt: NOW
    }
  ]
};

// --- Snapshot persistence ---------------------------------------------------------
const withVersion = recordTailoredResumeVersion(baseState, handoff, NOW, "influence", storedText, snapshot);
const version = withVersion.resumeVersions[0];

check("snapshot is persisted on the version", version.resumeSnapshot !== null);
check(
  "snapshot is stored verbatim — byte-identical",
  JSON.stringify(version.resumeSnapshot) === JSON.stringify(snapshot)
);
check("resumeText fallback still persisted alongside snapshot", version.resumeText === storedText);

const revived = parseState(JSON.stringify(withVersion));
check(
  "snapshot survives a localStorage round-trip intact",
  JSON.stringify(revived.resumeVersions[0].resumeSnapshot) === JSON.stringify(snapshot)
);
check("template style survives revival", revived.resumeVersions[0].resumeSnapshot.template === "Tech ATS");

// --- Export displays stored content, not regenerated content ------------------------
const revivedSnapshot = revived.resumeVersions[0].resumeSnapshot;
check(
  "stored snapshot reproduces the exact stored text (no regeneration needed)",
  resumeToText(revivedSnapshot, revivedSnapshot.resume) === storedText
);
check(
  "snapshot summary/skills/bullets match what was generated",
  revivedSnapshot.resume.summary === generated.summary &&
    revivedSnapshot.resume.coreSkills.join("|") === generated.coreSkills.join("|") &&
    revivedSnapshot.resume.experience[0].bullets.join("|") === generated.experience[0].bullets.join("|")
);
check(
  "snapshot invents nothing — every section string exists in the generated package or intake",
  (() => {
    const inputs = new Set([
      generated.summary,
      ...generated.coreSkills,
      generated.education,
      generated.linkedinHeadline,
      generated.linkedinSummary,
      ...generated.experience.flatMap((role) => [role.title, role.company, role.time, ...role.bullets]),
      intake.fullName,
      intake.email,
      intake.phone,
      intake.website
    ]);
    const outputs = [
      revivedSnapshot.resume.summary,
      ...revivedSnapshot.resume.coreSkills,
      revivedSnapshot.resume.education,
      revivedSnapshot.resume.linkedinHeadline,
      revivedSnapshot.resume.linkedinSummary,
      ...revivedSnapshot.resume.experience.flatMap((role) => [role.title, role.company, role.time, ...role.bullets]),
      revivedSnapshot.fullName,
      revivedSnapshot.email,
      revivedSnapshot.phone,
      revivedSnapshot.website
    ];
    return outputs.every((value) => inputs.has(value));
  })()
);

// --- Application link opens the correct version ----------------------------------------
check(
  "application resumeVersionId resolves to the version with the snapshot",
  (() => {
    const app = revived.applications[0];
    const linked = revived.resumeVersions.find((item) => item.id === app.resumeVersionId);
    return linked && linked.resumeSnapshot !== null && linked.resumeText === storedText;
  })()
);

// --- Legacy fallback ---------------------------------------------------------------------
const legacy = parseState(
  JSON.stringify({
    resumeVersions: [
      { id: "text-only", label: "Text only", resumeText: "PLAIN TEXT RESUME", createdAt: NOW },
      { id: "meta-only", label: "Metadata only", createdAt: NOW }
    ]
  })
);
check("text-only legacy version revives with null snapshot", legacy.resumeVersions[0].resumeSnapshot === null);
check("text-only legacy version keeps its copyable text", legacy.resumeVersions[0].resumeText === "PLAIN TEXT RESUME");
check("metadata-only legacy version revives safely", legacy.resumeVersions[1].resumeSnapshot === null && legacy.resumeVersions[1].resumeText === "");

// --- Snapshot revival hardening -------------------------------------------------------------
check("null snapshot → null", reviveResumeSnapshot(null) === null);
check("non-object snapshot → null", reviveResumeSnapshot("junk") === null);
check("snapshot missing resume → null", reviveResumeSnapshot({ fullName: "X" }) === null);
check(
  "snapshot with malformed resume sections → null",
  reviveResumeSnapshot({ fullName: "X", resume: { summary: 42, coreSkills: "nope" } }) === null
);
check(
  "unknown template falls back to Modern ATS",
  reviveResumeSnapshot({ ...snapshot, template: "Fancy" }).template === "Modern ATS"
);
check(
  "junk inside experience is cleaned, not crashed",
  (() => {
    const messy = reviveResumeSnapshot({
      ...snapshot,
      resume: { ...snapshot.resume, experience: [null, "junk", { title: "Ok", bullets: ["b", 42] }] }
    });
    return messy && messy.resume.experience.length === 1 && messy.resume.experience[0].bullets.length === 1;
  })()
);

// --- Plain-text export is the full document, not one sentence -------------------------------
check(
  "plain-text export carries header, contact, and every section",
  storedText.startsWith("Test Person") &&
    storedText.includes("test@example.com") &&
    storedText.includes("SUMMARY") &&
    storedText.includes("CORE SKILLS") &&
    storedText.includes("EXPERIENCE") &&
    storedText.includes("- ")
);
check(
  "snapshot-shaped contact fields serialize without a full intake object",
  resumeToText(
    { fullName: "Snapshot Person", email: "snap@example.com", phone: "", website: "" },
    generated
  ).startsWith("Snapshot Person")
);

// --- Export-time termination-reason safety net ------------------------------------------------
const leakySummary = "Kept satisfaction high until I was laid off in June 2026. Handled escalations calmly.";
const leakyText = resumeToText(intake, { ...generated, summary: leakySummary });
check("termination reasons never survive into exported text", !/laid\s+off/i.test(leakyText));
check("the rest of a stripped summary is preserved", leakyText.includes("Handled escalations calmly."));

// --- ATS checks are computed, never hardcoded PASS ---------------------------------------------
const atsResume = {
  summary: "Supported customers across billing and onboarding.",
  coreSkills: ["Customer Support", "Troubleshooting", "Documentation", "Escalations"],
  experience: [{ title: "Support Rep", company: "RetailCo", time: "2022–2026", bullets: ["Resolved tickets daily", "Documented repeat fixes"] }],
  education: "Associate degree",
  linkedinHeadline: "",
  linkedinSummary: ""
};
const findCheck = (resume, label) => runAtsChecks(intake, resume).find((item) => item.label === label);
check("section-headings check passes only when every standard section has content", findCheck(atsResume, "Standard section headings").status === "PASS");
const missingEducation = findCheck({ ...atsResume, education: "" }, "Standard section headings");
check("section-headings check warns and names the empty section", missingEducation.status === "WARNING" && missingEducation.detail.includes("Education"));
check("single-column check passes on clean text", findCheck(atsResume, "Single-column structure").status === "PASS");
const tabbedResume = { ...atsResume, experience: [{ ...atsResume.experience[0], bullets: ["Resolved tickets\tdaily queue", "Documented repeat fixes"] }] };
check("single-column check detects real column artifacts", findCheck(tabbedResume, "Single-column structure").status === "WARNING");

// --- Result -----------------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
