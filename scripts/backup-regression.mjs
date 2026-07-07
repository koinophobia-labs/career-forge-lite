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

const { BACKUP_SCHEMA_VERSION, backupFilename, buildPreview, createBackup, shouldNudgeBackup, validateBackup } =
  loadTsModule(path.join(root, "src/lib/backup.ts"));
const { emptyProfile, emptyState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

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

const snapshot = {
  fullName: "Test Person",
  email: "t@example.com",
  phone: "",
  website: "",
  template: "Tech ATS",
  resume: {
    summary: "Focused on Product Support work.",
    coreSkills: ["Customer Support", "Troubleshooting"],
    experience: [{ title: "Rep", company: "RetailCo", time: "3 years", bullets: ["Resolved escalations daily"] }],
    education: "—",
    linkedinHeadline: "h",
    linkedinSummary: "s"
  }
};

const fullState = {
  ...emptyState(),
  profile: {
    ...emptyProfile(),
    currentSituation: "Transitioning from sportsbook operations into fraud/risk.",
    targetRoles: "Fraud/Risk Operations",
    transferableSkills: ["policy enforcement", "de-escalation", "fraud spotting"],
    experienceSummary: "Years of sportsbook operations.",
    strengths: ["pattern recognition"],
    proofPoints: "Shipped a product to TestFlight.",
    constraints: "",
    workStyle: "",
    updatedAt: NOW
  },
  lanes: [
    {
      id: "lane-1",
      title: "Fraud / Risk Operations",
      status: "active",
      whyFit: "fits",
      resumeAngle: "angle",
      proof: ["p"],
      gaps: ["g"],
      keywords: ["fraud"],
      source: "library",
      createdAt: NOW
    }
  ],
  applications: [
    {
      id: "app-1",
      company: "Acme",
      roleTitle: "Fraud Analyst",
      laneId: "lane-1",
      status: "applied",
      jobPostUrl: "",
      resumeVersionId: "resume-1",
      appliedAt: NOW,
      nextFollowUpAt: null,
      interviewAt: null,
      notes: "n",
      analysisKeywords: ["fraud"],
      analysisGaps: ["SQL"],
      analysisWeakSpots: [],
      createdAt: NOW
    }
  ],
  outreach: [
    {
      id: "contact-1",
      name: "Jordan",
      company: "Acme",
      role: "Recruiter",
      channel: "linkedin",
      status: "sent",
      laneId: "lane-1",
      lastContactedAt: NOW,
      nextFollowUpAt: null,
      followUpCount: 1,
      notes: "We've never spoken; this is cold outreach.",
      createdAt: NOW
    }
  ],
  resumeVersions: [
    {
      id: "resume-1",
      label: "Fraud Analyst @ Acme — 2026-07-06",
      laneId: "lane-1",
      notes: "Tailored from job-post analysis.",
      source: "tailor",
      applicationId: "app-1",
      targetCompany: "Acme",
      targetTitle: "Fraud Analyst",
      keywordsUsed: ["fraud"],
      gapsAcknowledged: ["SQL"],
      influenceSummary: "Framed for Fraud Analyst at Acme.",
      resumeText: "PLAIN TEXT",
      resumeSnapshot: snapshot,
      createdAt: NOW
    }
  ]
};

// --- Export shape -----------------------------------------------------------------
const stateSnapshotBefore = JSON.stringify(fullState);
const backup = createBackup(fullState, NOW);

check("backup carries app marker", backup.app === "career-forge");
check("backup carries schema version", backup.schemaVersion === BACKUP_SCHEMA_VERSION);
check("backup carries exportedAt", backup.exportedAt === NOW);
check(
  "backup contains every persisted section",
  backup.state.profile && backup.state.lanes.length === 1 && backup.state.applications.length === 1 && backup.state.outreach.length === 1 && backup.state.resumeVersions.length === 1
);
check("export does not mutate live state", JSON.stringify(fullState) === stateSnapshotBefore);
check("backup state is a copy, not a reference", backup.state !== fullState && backup.state.applications !== fullState.applications);
check("filename is dated", backupFilename(NOW) === "career-forge-backup-2026-07-06.json");

// --- Round-trip fidelity -------------------------------------------------------------
const serialized = JSON.stringify(backup);
const validated = validateBackup(serialized);
check("exported backup validates", validated.ok === true);
check(
  "resume snapshot survives export/import",
  validated.ok && JSON.stringify(validated.state.resumeVersions[0].resumeSnapshot) === JSON.stringify(snapshot)
);
check(
  "application → resume version link survives export/import",
  validated.ok && validated.state.applications[0].resumeVersionId === "resume-1" && validated.state.resumeVersions[0].applicationId === "app-1"
);
check(
  "restored state equals exported state exactly",
  validated.ok && JSON.stringify(validated.state) === JSON.stringify(backup.state)
);
check(
  "no data invented during backup/restore",
  validated.ok && !JSON.stringify(validated.state).includes("undefined") && JSON.stringify(validated.state) === JSON.stringify(backup.state)
);

// --- Preview -----------------------------------------------------------------------------
check(
  "preview reports accurate counts",
  validated.ok &&
    validated.preview.applicationCount === 1 &&
    validated.preview.resumeVersionCount === 1 &&
    validated.preview.snapshotCount === 1 &&
    validated.preview.outreachCount === 1 &&
    validated.preview.laneCount === 1 &&
    validated.preview.profilePresent === true &&
    validated.preview.exportedAt === NOW &&
    validated.preview.schemaVersion === 1
);
check("preview of empty state shows profile absent", buildPreview(emptyState(), null, null).profilePresent === false);

// --- Import validation ----------------------------------------------------------------------
check("invalid JSON is rejected with a clear message", (() => { const r = validateBackup("{nope"); return !r.ok && /valid JSON/i.test(r.error); })());
check("array root is rejected", validateBackup("[1,2]").ok === false);
check("string root is rejected", validateBackup("\"hello\"").ok === false);
check(
  "foreign app envelope is rejected",
  (() => { const r = validateBackup(JSON.stringify({ app: "other-app", schemaVersion: 1, state: {} })); return !r.ok && /wasn't exported by Career Forge/i.test(r.error); })()
);
check(
  "newer schema version is blocked with guidance",
  (() => { const r = validateBackup(JSON.stringify({ app: "career-forge", schemaVersion: 99, state: {} })); return !r.ok && /newer/i.test(r.error); })()
);
check(
  "missing state section is rejected",
  validateBackup(JSON.stringify({ app: "career-forge", schemaVersion: 1 })).ok === false
);
check("unrelated JSON object is rejected", validateBackup(JSON.stringify({ hello: "world" })).ok === false);

// --- Legacy backup (bare localStorage state) ---------------------------------------------------
const legacy = validateBackup(JSON.stringify(fullState));
check("bare state object imports as legacy backup", legacy.ok === true);
check("legacy backup preview has no exportedAt", legacy.ok && legacy.preview.exportedAt === null && legacy.preview.schemaVersion === null);
check("legacy backup keeps snapshots and links", legacy.ok && legacy.state.resumeVersions[0].resumeSnapshot !== null && legacy.state.applications[0].resumeVersionId === "resume-1");

// --- Corrupt sections degrade, not crash --------------------------------------------------------
const corrupt = validateBackup(
  JSON.stringify({
    app: "career-forge",
    schemaVersion: 1,
    exportedAt: NOW,
    state: { profile: "junk", lanes: "junk", applications: [{ id: "ok-app" }, "junk"], resumeVersions: [{ id: "v", resumeSnapshot: "junk" }], outreach: 42 }
  })
);
check("corrupt sections degrade safely instead of crashing", corrupt.ok === true);
check(
  "corrupt sections revive to safe defaults",
  corrupt.ok &&
    corrupt.state.lanes.length === 0 &&
    corrupt.state.outreach.length === 0 &&
    corrupt.state.applications.length === 1 &&
    corrupt.state.resumeVersions[0].resumeSnapshot === null &&
    corrupt.state.profile.currentSituation === ""
);

// --- Backup nudge logic -----------------------------------------------------------------------------
check("no nudge for near-empty state", shouldNudgeBackup(emptyState(), null, NOW) === false);
check("no nudge below the meaningful-data threshold", shouldNudgeBackup(fullState, null, NOW) === false);
check(
  "nudge when meaningful data and never backed up",
  shouldNudgeBackup(
    { ...fullState, applications: Array.from({ length: 3 }, (_, index) => ({ ...fullState.applications[0], id: `a${index}` })) },
    null,
    NOW
  ) === true
);
check(
  "no nudge right after a backup",
  shouldNudgeBackup(
    { ...fullState, applications: Array.from({ length: 4 }, (_, index) => ({ ...fullState.applications[0], id: `a${index}` })) },
    NOW,
    NOW
  ) === false
);
check(
  "nudge again when the backup is stale",
  shouldNudgeBackup(
    { ...fullState, applications: Array.from({ length: 4 }, (_, index) => ({ ...fullState.applications[0], id: `a${index}` })) },
    "2026-06-01T00:00:00.000Z",
    NOW
  ) === true
);

// --- Result -------------------------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
