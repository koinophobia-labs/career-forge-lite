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

const { buildHandoff, parseHandoff, recordTailoredResumeVersion, HANDOFF_TTL_MS } = loadTsModule(
  path.join(root, "src/lib/tailor-handoff.ts")
);
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

const lane = {
  id: "lane-1",
  title: "Product Support Specialist",
  status: "active",
  whyFit: "fits",
  resumeAngle: "Position every service interaction as issue resolution: diagnose, resolve, document, escalate.",
  proof: [],
  gaps: [],
  keywords: ["customer support"],
  source: "library",
  createdAt: NOW
};

const analysis = {
  keywords: [
    { term: "customer support", count: 3, inProfile: true },
    { term: "zendesk", count: 2, inProfile: false }
  ],
  requirements: [
    { requirement: "Strong written communication", status: "covered", evidence: "e" },
    { requirement: "2+ years of customer support experience", status: "partial", evidence: "e" },
    { requirement: "Familiarity with Zendesk", status: "gap", evidence: "e" },
    { requirement: "Bachelor degree preferred", status: "gap", evidence: "e" }
  ],
  weakSpots: ["The post emphasizes zendesk"],
  bulletSuggestions: [{ suggestion: "Rework a bullet to lead with customer support", basedOn: "keyword overlap" }],
  honestyNote: "note"
};

// --- buildHandoff ---------------------------------------------------------------
const handoff = buildHandoff({
  analysis,
  lane,
  company: "  Acme  ",
  roleTitle: "Product Support Specialist",
  applicationId: "app-1",
  nowIso: NOW
});

check("handoff carries applicationId", handoff.applicationId === "app-1");
check("handoff trims company", handoff.company === "Acme");
check("handoff splits covered requirements", handoff.coveredRequirements.length === 1 && handoff.coveredRequirements[0] === "Strong written communication");
check("handoff splits partial requirements", handoff.partialRequirements.length === 1);
check("handoff splits gaps", handoff.gaps.length === 2 && handoff.gaps.includes("Familiarity with Zendesk"));
check("handoff copies keywords verbatim", handoff.keywords.join(",") === "customer support,zendesk");
check("handoff copies weak spots and bullet prompts", handoff.weakSpots.length === 1 && handoff.bulletPrompts.length === 1);
check("handoff carries lane angle", handoff.laneId === "lane-1" && handoff.resumeAngle === lane.resumeAngle);
check(
  "handoff falls back to lane title when role title is blank",
  buildHandoff({ analysis, lane, company: "", roleTitle: "  ", applicationId: null, nowIso: NOW }).roleTitle ===
    "Product Support Specialist"
);
check(
  "handoff synthesizes nothing — every string comes from inputs",
  (() => {
    const inputStrings = [
      ...analysis.keywords.map((hit) => hit.term),
      ...analysis.requirements.map((req) => req.requirement),
      ...analysis.weakSpots,
      ...analysis.bulletSuggestions.map((item) => item.suggestion),
      lane.resumeAngle,
      lane.title,
      "Acme",
      "Product Support Specialist"
    ];
    const outputStrings = [
      ...handoff.keywords,
      ...handoff.coveredRequirements,
      ...handoff.partialRequirements,
      ...handoff.gaps,
      ...handoff.weakSpots,
      ...handoff.bulletPrompts,
      handoff.resumeAngle,
      handoff.company,
      handoff.roleTitle
    ];
    return outputStrings.every((value) => inputStrings.includes(value));
  })()
);

// --- parseHandoff (stale/missing/corrupt fallback) --------------------------------
const serialized = JSON.stringify(handoff);
const parsed = parseHandoff(serialized, NOW);
check("fresh handoff parses back completely", parsed && parsed.roleTitle === handoff.roleTitle && parsed.gaps.length === 2);
check("null input → null", parseHandoff(null, NOW) === null);
check("corrupt JSON → null", parseHandoff("{nope", NOW) === null);
check("wrong version → null", parseHandoff(JSON.stringify({ ...handoff, version: 2 }), NOW) === null);
check("missing role title → null", parseHandoff(JSON.stringify({ ...handoff, roleTitle: " " }), NOW) === null);
check(
  "stale handoff (past TTL) → null",
  parseHandoff(serialized, new Date(new Date(NOW).getTime() + HANDOFF_TTL_MS + 1000).toISOString()) === null
);
check("future-dated handoff → null", parseHandoff(serialized, "2026-07-06T11:00:00.000Z") === null);
check(
  "malformed arrays are cleaned, not crashed",
  (() => {
    const messy = parseHandoff(JSON.stringify({ ...handoff, keywords: ["ok", 42, null], gaps: "not-an-array" }), NOW);
    return messy && messy.keywords.length === 1 && messy.gaps.length === 0;
  })()
);

// --- recordTailoredResumeVersion + application linkage ------------------------------
const baseState = {
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
    },
    {
      id: "app-2",
      company: "Other",
      roleTitle: "QA Tester",
      laneId: null,
      status: "drafting",
      jobPostUrl: "",
      resumeVersionId: null,
      appliedAt: null,
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

const linked = recordTailoredResumeVersion(baseState, handoff, NOW);
const version = linked.resumeVersions[0];
check("tailored version is recorded", linked.resumeVersions.length === 1);
check("version source is tailor", version.source === "tailor");
check("version label names the shot", version.label === "Product Support Specialist @ Acme — 2026-07-06");
check(
  "version carries tailoring metadata",
  version.applicationId === "app-1" &&
    version.targetCompany === "Acme" &&
    version.targetTitle === "Product Support Specialist" &&
    version.laneId === "lane-1" &&
    version.keywordsUsed.length === 2 &&
    version.gapsAcknowledged.length === 2 &&
    version.createdAt === NOW
);
check("application is linked via resumeVersionId", linked.applications.find((app) => app.id === "app-1").resumeVersionId === version.id);
check("other applications untouched", linked.applications.find((app) => app.id === "app-2").resumeVersionId === null);
check(
  "no applicationId → version recorded without linking",
  (() => {
    const unlinked = recordTailoredResumeVersion(baseState, { ...handoff, applicationId: null }, NOW);
    return unlinked.resumeVersions.length === 1 && unlinked.applications.every((app) => app.resumeVersionId === null);
  })()
);
check(
  "version invents no credentials or metrics",
  !/certified|degree earned|licensed/i.test(JSON.stringify(version)) &&
    version.keywordsUsed.every((keyword) => handoff.keywords.includes(keyword)) &&
    version.gapsAcknowledged.every((gap) => handoff.gaps.includes(gap))
);

// --- localStorage compatibility -------------------------------------------------------
const legacyState = parseState(
  JSON.stringify({
    resumeVersions: [{ id: "resume-old", label: "Old — 2026-06-01", laneId: null, notes: "", createdAt: NOW }],
    applications: [{ id: "app-1", status: "applied", resumeVersionId: "resume-old" }]
  })
);
check(
  "legacy resume versions revive with builder defaults",
  legacyState.resumeVersions[0].source === "builder" &&
    legacyState.resumeVersions[0].applicationId === null &&
    legacyState.resumeVersions[0].keywordsUsed.length === 0
);
check("application resumeVersionId survives revival", legacyState.applications[0].resumeVersionId === "resume-old");
check(
  "tailored versions round-trip through parseState",
  (() => {
    const revived = parseState(JSON.stringify(linked));
    const revivedVersion = revived.resumeVersions[0];
    return (
      revivedVersion.source === "tailor" &&
      revivedVersion.applicationId === "app-1" &&
      revivedVersion.keywordsUsed.length === 2 &&
      revived.applications.find((app) => app.id === "app-1").resumeVersionId === revivedVersion.id
    );
  })()
);

// --- Result ------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
