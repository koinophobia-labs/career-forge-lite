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

const { deleteResumeVersion, emptyState, parseState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { handoffFromApplication, parseHandoff, recordTailoredResumeVersion } = loadTsModule(
  path.join(root, "src/lib/tailor-handoff.ts")
);
const { applicationsMissingTailoredResume } = loadTsModule(path.join(root, "src/lib/command-center-insights.ts"));

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

function makeApplication(overrides = {}) {
  return {
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
    analysisKeywords: ["customer support", "zendesk"],
    analysisGaps: ["Familiarity with Zendesk"],
    analysisWeakSpots: ["The post emphasizes zendesk"],
    createdAt: NOW,
    ...overrides
  };
}

const lane = {
  id: "lane-1",
  title: "Product Support Specialist",
  status: "active",
  whyFit: "fits",
  resumeAngle: "Position every service interaction as issue resolution.",
  proof: [],
  gaps: [],
  keywords: ["customer support"],
  source: "library",
  createdAt: NOW
};

const handoff = {
  version: 1,
  createdAt: NOW,
  applicationId: "app-1",
  company: "Acme",
  roleTitle: "Product Support Specialist",
  laneId: "lane-1",
  laneTitle: "Product Support Specialist",
  resumeAngle: lane.resumeAngle,
  keywords: ["customer support"],
  coveredRequirements: [],
  partialRequirements: [],
  gaps: ["Familiarity with Zendesk"],
  weakSpots: [],
  bulletPrompts: []
};

const RESUME_TEXT = "TEST PERSON\nSUMMARY\nFocused on Product Support Specialist work.\nCORE SKILLS\nCustomer Support";

// --- Stored resume text persistence ------------------------------------------------
const baseState = { ...emptyState(), applications: [makeApplication()] };
const withVersion = recordTailoredResumeVersion(baseState, handoff, NOW, "Framed for the shot.", RESUME_TEXT);
const version = withVersion.resumeVersions[0];

check("resume text is persisted on the version", version.resumeText === RESUME_TEXT);
check(
  "resume text is stored verbatim — nothing added",
  JSON.stringify(version.resumeText) === JSON.stringify(RESUME_TEXT)
);
check("influence summary persisted alongside text", version.influenceSummary === "Framed for the shot.");
check(
  "stored text survives a localStorage round-trip",
  parseState(JSON.stringify(withVersion)).resumeVersions[0].resumeText === RESUME_TEXT
);

// --- Legacy revival -----------------------------------------------------------------
const legacy = parseState(
  JSON.stringify({
    resumeVersions: [{ id: "resume-old", label: "Old — 2026-06-01", laneId: null, notes: "", createdAt: NOW }],
    applications: [makeApplication({ resumeVersionId: "resume-old" })]
  })
);
check("legacy versions revive without stored text", legacy.resumeVersions[0].resumeText === "");
check("legacy versions keep builder defaults", legacy.resumeVersions[0].source === "builder");
check("legacy application linkage survives", legacy.applications[0].resumeVersionId === "resume-old");

// --- Linked application lookup + tailored metadata ------------------------------------
check("version knows its application", version.applicationId === "app-1");
check("application points back at the version", withVersion.applications[0].resumeVersionId === version.id);
check(
  "tailored metadata is display-ready",
  version.source === "tailor" && version.targetCompany === "Acme" && version.keywordsUsed.length === 1 && version.gapsAcknowledged.length === 1
);

// --- Delete behavior --------------------------------------------------------------------
const afterDelete = deleteResumeVersion(withVersion, version.id);
check("delete removes the version", afterDelete.resumeVersions.length === 0);
check("delete unlinks the application", afterDelete.applications[0].resumeVersionId === null);
check(
  "delete leaves unrelated versions and links intact",
  (() => {
    const two = recordTailoredResumeVersion(withVersion, { ...handoff, applicationId: null }, NOW, "", "other text");
    const kept = deleteResumeVersion(two, version.id);
    return kept.resumeVersions.length === 1 && kept.resumeVersions[0].resumeText === "other text";
  })()
);
check("deleting an unknown id is a no-op", deleteResumeVersion(withVersion, "nope").resumeVersions.length === 1);

// --- Tailor-again from application --------------------------------------------------------
const rebuilt = handoffFromApplication(makeApplication(), lane, NOW);
check("rebuilt handoff parses as valid and fresh", parseHandoff(JSON.stringify(rebuilt), NOW) !== null);
check(
  "rebuilt handoff carries the application's saved analysis verbatim",
  rebuilt.keywords.join(",") === "customer support,zendesk" &&
    rebuilt.gaps[0] === "Familiarity with Zendesk" &&
    rebuilt.weakSpots.length === 1
);
check("rebuilt handoff links back to the application", rebuilt.applicationId === "app-1");
check("rebuilt handoff uses the lane angle", rebuilt.resumeAngle === lane.resumeAngle);
check(
  "rebuilt handoff blanks placeholder company/title instead of claiming them",
  (() => {
    const fromPlaceholder = handoffFromApplication(
      makeApplication({ company: "Unknown company", roleTitle: "Untitled role" }),
      lane,
      NOW
    );
    return fromPlaceholder.company === "" && fromPlaceholder.roleTitle === lane.title;
  })()
);
check(
  "rebuilt handoff synthesizes nothing",
  (() => {
    const app = makeApplication();
    const inputs = [
      app.company,
      app.roleTitle,
      ...app.analysisKeywords,
      ...app.analysisGaps,
      ...app.analysisWeakSpots,
      lane.title,
      lane.resumeAngle
    ];
    const outputs = [rebuilt.company, rebuilt.roleTitle, ...rebuilt.keywords, ...rebuilt.gaps, ...rebuilt.weakSpots, rebuilt.resumeAngle];
    return outputs.every((value) => inputs.includes(value));
  })()
);

// --- Dashboard visibility -------------------------------------------------------------------
const mixed = {
  ...emptyState(),
  applications: [
    makeApplication({ id: "a1", status: "applied", resumeVersionId: null }),
    makeApplication({ id: "a2", status: "interviewing", resumeVersionId: null }),
    makeApplication({ id: "a3", status: "applied", resumeVersionId: "resume-x" }),
    makeApplication({ id: "a4", status: "rejected", resumeVersionId: null }),
    makeApplication({ id: "a5", status: "closed", resumeVersionId: null })
  ]
};
const missing = applicationsMissingTailoredResume(mixed);
check("active applications without a version are flagged", missing.map((app) => app.id).join(",") === "a1,a2");
check("covered and closed applications are not flagged", !missing.some((app) => app.id === "a3" || app.id === "a4" || app.id === "a5"));

// --- Result -----------------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
