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

const { applyTailoredContext, buildEvidenceCorpus, contextFromHandoff } = loadTsModule(
  path.join(root, "src/lib/tailored-resume.ts")
);
const { generateResumePackage } = loadTsModule(path.join(root, "src/lib/generator.ts"));
const { initialIntake } = loadTsModule(path.join(root, "src/lib/career-data.ts"));
const { recordTailoredResumeVersion } = loadTsModule(path.join(root, "src/lib/tailor-handoff.ts"));
const { emptyState, parseState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

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

const intake = {
  ...initialIntake,
  fullName: "Test Person",
  email: "test@example.com",
  targetJobTitle: "Product Support Specialist",
  currentTitle: "Customer Service Representative",
  currentCompany: "RetailCo",
  currentTime: "3 years",
  tools: "spreadsheets, ticketing systems",
  responsibilities: "customer support, troubleshooting billing issues, escalation handling, de-escalation",
  outcomes: "kept customer satisfaction high during peak volume",
  customersServed: "50",
  education: ""
};

const context = {
  roleTitle: "Product Support Specialist",
  company: "Acme",
  laneTitle: "Product Support Specialist",
  resumeAngle: "Position every service interaction as issue resolution: diagnose, resolve, document, escalate.",
  keywords: ["customer support", "troubleshooting", "zendesk", "sql", "de-escalation"],
  coveredRequirements: ["Strong written communication"],
  partialRequirements: ["2+ years of customer support experience"],
  gaps: ["Familiarity with Zendesk", "Basic SQL knowledge", "Bachelor degree preferred"]
};

const plain = generateResumePackage(intake);
const plainAgain = generateResumePackage(intake);
const plainSnapshot = JSON.stringify(plain);
const { resume: tailored, influence } = applyTailoredContext(plain, context, intake);

// --- Plain generation unchanged --------------------------------------------------
check("plain generation is deterministic", JSON.stringify(plainAgain) === plainSnapshot);
check("applyTailoredContext does not mutate the base package", JSON.stringify(plain) === plainSnapshot);
check("tailored output differs from plain output", JSON.stringify(tailored) !== plainSnapshot);

// --- Summary and role framing ------------------------------------------------------
check("tailored summary opens with target framing", tailored.summary.startsWith("Focused on Product Support Specialist work"));
check("tailored summary keeps the original summary content", tailored.summary.includes(plain.summary));
check(
  "framing mentions evidence-backed keywords",
  /customer support|troubleshooting|de-escalation/i.test(influence.targetFraming)
);
check("plain summary has no target framing", !plain.summary.startsWith("Focused on"));

// --- Keyword partitioning ------------------------------------------------------------
check(
  "evidence-backed keywords are woven",
  influence.keywordsWoven.includes("customer support") && influence.keywordsWoven.includes("troubleshooting")
);
check(
  "gap keywords with no evidence are avoided, not claimed",
  influence.gapsAvoided.includes("zendesk") && influence.gapsAvoided.includes("sql")
);
check(
  "gap keywords never appear in skills",
  tailored.coreSkills.every((skill) => !/zendesk|(?<![a-z])sql(?![a-z])/i.test(skill))
);
check("gap keywords never appear in the added framing", !/zendesk|sql/i.test(influence.targetFraming));
check(
  "skip reasons explain themselves",
  influence.keywordsSkipped.every((item) => item.reason.length > 20)
);

// --- Skills prioritization -------------------------------------------------------------
check(
  "woven keywords are present in tailored skills",
  influence.keywordsWoven.every((term) =>
    tailored.coreSkills.some((skill) => skill.toLowerCase().includes(term) || term.includes(skill.toLowerCase()))
  )
);
check("skills stay within the cap", tailored.coreSkills.length <= 15);
check("skills contain no duplicates", new Set(tailored.coreSkills.map((skill) => skill.toLowerCase())).size === tailored.coreSkills.length);

// --- Bullet prioritization ----------------------------------------------------------------
const bulletBase = {
  summary: "Base summary.",
  coreSkills: ["Communication"],
  experience: [
    {
      title: "Rep",
      company: "Co",
      time: "2 years",
      bullets: ["Organized the stockroom weekly", "Resolved customer support escalations daily", "Filed paperwork"]
    }
  ],
  education: "—",
  linkedinHeadline: "h",
  linkedinSummary: "s"
};
const reordered = applyTailoredContext(bulletBase, context, intake).resume;
check(
  "bullets matching woven keywords move to the top",
  reordered.experience[0].bullets[0] === "Resolved customer support escalations daily"
);
check(
  "no bullet text is rewritten or invented",
  reordered.experience[0].bullets.slice().sort().join("|") === bulletBase.experience[0].bullets.slice().sort().join("|")
);

// --- Honesty: nothing invented ----------------------------------------------------------
const addedText = influence.targetFraming + tailored.coreSkills.filter((skill) => !plain.coreSkills.includes(skill)).join(" ");
check("added text invents no credentials", !/certified|certification|degree|licensed|bachelor/i.test(addedText));
check("added text invents no metrics", !/\d/.test(addedText));
check(
  "every added skill is evidence-backed",
  tailored.coreSkills
    .filter((skill) => !plain.coreSkills.includes(skill))
    .every((skill) => buildEvidenceCorpus(intake).includes(skill.toLowerCase()))
);

// --- Influence summary + version metadata --------------------------------------------------
check(
  "influence summary names framing, keywords, and declined gaps",
  /Framed for Product Support Specialist at Acme/.test(influence.summaryText) &&
    /Wove in evidence-backed keywords/.test(influence.summaryText) &&
    /Declined to claim gap terms/.test(influence.summaryText)
);

const handoff = {
  version: 1,
  createdAt: NOW,
  applicationId: "app-1",
  company: "Acme",
  roleTitle: "Product Support Specialist",
  laneId: "lane-1",
  laneTitle: "Product Support Specialist",
  resumeAngle: context.resumeAngle,
  keywords: context.keywords,
  coveredRequirements: context.coveredRequirements,
  partialRequirements: context.partialRequirements,
  gaps: context.gaps,
  weakSpots: [],
  bulletPrompts: []
};
check("contextFromHandoff carries all tailoring fields", JSON.stringify(contextFromHandoff(handoff).gaps) === JSON.stringify(context.gaps));

const stateWithApp = {
  ...emptyState(),
  applications: [
    {
      id: "app-1",
      company: "Acme",
      roleTitle: "Product Support Specialist",
      laneId: "lane-1",
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
const linked = recordTailoredResumeVersion(stateWithApp, handoff, NOW, influence.summaryText);
check("version metadata records the influence summary", linked.resumeVersions[0].influenceSummary === influence.summaryText);
check(
  "influence summary survives localStorage round-trip",
  parseState(JSON.stringify(linked)).resumeVersions[0].influenceSummary === influence.summaryText
);
check(
  "legacy versions revive with empty influence summary",
  parseState(JSON.stringify({ resumeVersions: [{ id: "old", label: "Old" }] })).resumeVersions[0].influenceSummary === ""
);

// --- Result ------------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
