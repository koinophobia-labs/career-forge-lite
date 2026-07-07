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

const { APPLICATION_FOLLOW_UP_DAYS, addDays, logApplicationFollowUp } = loadTsModule(
  path.join(root, "src/lib/command-center-insights.ts")
);
const { emptyState, parseState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const { computeWeeklyMetrics } = loadTsModule(path.join(root, "src/lib/weekly-review.ts"));

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
const daysAgo = (days) => new Date(new Date(NOW).getTime() - days * 24 * 60 * 60 * 1000).toISOString();

function makeApp(overrides = {}) {
  return {
    id: `app-${Math.random().toString(36).slice(2, 8)}`,
    company: "Acme",
    roleTitle: "Product Support Specialist",
    laneId: null,
    status: "applied",
    jobPostUrl: "",
    resumeVersionId: null,
    appliedAt: daysAgo(20),
    nextFollowUpAt: daysAgo(1),
    followUpsSent: [],
    interviewAt: null,
    notes: "",
    analysisKeywords: [],
    analysisGaps: [],
    analysisWeakSpots: [],
    createdAt: daysAgo(20),
    ...overrides
  };
}

// --- Marking a follow-up done ------------------------------------------------------
const app = makeApp();
const logged = logApplicationFollowUp(app, NOW);

check("completion timestamp is recorded", logged.followUpsSent.length === 1 && logged.followUpsSent[0] === NOW);
check("nextFollowUpAt still reschedules", logged.nextFollowUpAt === addDays(NOW, APPLICATION_FOLLOW_UP_DAYS));
check("original application is not mutated", app.followUpsSent.length === 0 && app.nextFollowUpAt === daysAgo(1));
check(
  "second completion appends, not replaces",
  (() => {
    const twice = logApplicationFollowUp(logged, addDays(NOW, APPLICATION_FOLLOW_UP_DAYS));
    return twice.followUpsSent.length === 2 && twice.followUpsSent[0] === NOW;
  })()
);
check(
  "logging works on legacy records missing the array",
  (() => {
    const legacy = makeApp();
    delete legacy.followUpsSent;
    return logApplicationFollowUp(legacy, NOW).followUpsSent.length === 1;
  })()
);

// --- Revival: legacy + malformed ------------------------------------------------------
const revived = parseState(
  JSON.stringify({
    applications: [
      { id: "legacy-1", company: "X", roleTitle: "Y", status: "applied" },
      { id: "messy-1", company: "X", roleTitle: "Y", status: "applied", followUpsSent: ["2026-07-01T00:00:00.000Z", 42, null, "not-a-date", "2026-07-02T00:00:00.000Z"] },
      { id: "junk-1", company: "X", roleTitle: "Y", status: "applied", followUpsSent: "nope" }
    ]
  })
);
check("legacy applications revive with empty follow-up history", revived.applications[0].followUpsSent.length === 0);
check(
  "malformed entries are cleaned, valid timestamps kept",
  revived.applications[1].followUpsSent.length === 2 && revived.applications[1].followUpsSent[0] === "2026-07-01T00:00:00.000Z"
);
check("non-array history degrades to empty", revived.applications[2].followUpsSent.length === 0);
check(
  "follow-up history survives a localStorage round-trip",
  parseState(JSON.stringify({ applications: [{ id: "a", status: "applied", followUpsSent: [NOW] }] })).applications[0].followUpsSent[0] === NOW
);

// --- Weekly review counts ----------------------------------------------------------------
const weeklyState = {
  ...emptyState(),
  applications: [
    makeApp({ id: "w1", followUpsSent: [daysAgo(1), daysAgo(2), daysAgo(9)] }),
    makeApp({ id: "w2", followUpsSent: [daysAgo(10)] }),
    makeApp({ id: "w3", followUpsSent: [] })
  ]
};
const metrics = computeWeeklyMetrics(weeklyState, NOW);
const followUps = metrics.find((item) => item.key === "follow_ups_completed");

check("weekly review counts this week's completions", followUps.thisWeek === 2);
check("weekly review counts last week's completions", followUps.lastWeek === 2);
check("trend computed for completions", followUps.trend === "same");
check("metric label says completed, not due", /completed/i.test(followUps.label) && !/due/i.test(followUps.label));

// --- No fabrication from due dates ---------------------------------------------------------
const dueOnlyState = {
  ...emptyState(),
  applications: [
    makeApp({ id: "d1", nextFollowUpAt: daysAgo(1), followUpsSent: [] }),
    makeApp({ id: "d2", nextFollowUpAt: daysAgo(3), followUpsSent: [] })
  ]
};
const dueOnlyMetrics = computeWeeklyMetrics(dueOnlyState, NOW);
check(
  "due dates never count as completions",
  dueOnlyMetrics.find((item) => item.key === "follow_ups_completed").thisWeek === 0
);
check(
  "no completions → 'none' trend, not a fake one",
  dueOnlyMetrics.find((item) => item.key === "follow_ups_completed").trend === "none"
);
check(
  "records without the array don't crash weekly metrics",
  (() => {
    const bare = { ...emptyState(), applications: [(() => { const a = makeApp(); delete a.followUpsSent; return a; })()] };
    return computeWeeklyMetrics(bare, NOW).find((item) => item.key === "follow_ups_completed").thisWeek === 0;
  })()
);

// --- Result -----------------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
