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

const { computeWeeklyMetrics, computeWeeklyReview, detectStalled, isMomentumLow } = loadTsModule(
  path.join(root, "src/lib/weekly-review.ts")
);
const { emptyState, emptyProfile, parseState } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

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
    resumeVersionId: "resume-1",
    appliedAt: null,
    nextFollowUpAt: null,
    interviewAt: null,
    notes: "",
    analysisKeywords: [],
    analysisGaps: [],
    analysisWeakSpots: [],
    createdAt: daysAgo(1),
    ...overrides
  };
}

function makeVersion(overrides = {}) {
  return {
    id: `resume-${Math.random().toString(36).slice(2, 8)}`,
    label: "V",
    laneId: null,
    notes: "",
    source: "tailor",
    applicationId: null,
    targetCompany: "",
    targetTitle: "",
    keywordsUsed: [],
    gapsAcknowledged: [],
    influenceSummary: "",
    resumeText: "",
    resumeSnapshot: null,
    createdAt: daysAgo(1),
    ...overrides
  };
}

function makeContact(overrides = {}) {
  return {
    id: `contact-${Math.random().toString(36).slice(2, 8)}`,
    name: "Jordan",
    company: "Acme",
    role: "Recruiter",
    channel: "linkedin",
    status: "sent",
    laneId: null,
    lastContactedAt: null,
    nextFollowUpAt: null,
    followUpCount: 0,
    notes: "",
    createdAt: daysAgo(1),
    ...overrides
  };
}

// --- Current week counts + last week comparison -------------------------------------
const state = {
  ...emptyState(),
  applications: [
    makeApp({ id: "a1", createdAt: daysAgo(1), appliedAt: daysAgo(1) }),
    makeApp({ id: "a2", createdAt: daysAgo(2), appliedAt: daysAgo(2) }),
    makeApp({ id: "a3", createdAt: daysAgo(8), appliedAt: daysAgo(8) }),
    makeApp({ id: "a4", createdAt: daysAgo(20), appliedAt: daysAgo(20), status: "interviewing", interviewAt: daysAgo(-1) })
  ],
  resumeVersions: [
    makeVersion({ id: "v1", createdAt: daysAgo(3), source: "tailor" }),
    makeVersion({ id: "v2", createdAt: daysAgo(9), source: "builder" }),
    makeVersion({ id: "v3", createdAt: daysAgo(10), source: "tailor" })
  ],
  outreach: [
    makeContact({ id: "c1", createdAt: daysAgo(2), lastContactedAt: daysAgo(1) }),
    makeContact({ id: "c2", createdAt: daysAgo(12), lastContactedAt: daysAgo(11) })
  ]
};

const metrics = computeWeeklyMetrics(state, NOW);
const byKey = Object.fromEntries(metrics.map((item) => [item.key, item]));

check("applications sent this week counted", byKey.apps_sent.thisWeek === 2);
check("applications sent last week counted", byKey.apps_sent.lastWeek === 1);
check("8-day-old activity lands in last week, not this week", byKey.apps_added.thisWeek === 2 && byKey.apps_added.lastWeek === 1);
check("tailored resumes split by window", byKey.tailored_resumes.thisWeek === 1 && byKey.tailored_resumes.lastWeek === 1);
check("all versions counted separately", byKey.resume_versions.thisWeek === 1 && byKey.resume_versions.lastWeek === 2);
check("outreach added/messaged counted", byKey.outreach_added.thisWeek === 1 && byKey.outreach_messaged.thisWeek === 1);
check("upcoming interview date is not counted as past-week activity", byKey.interviews.thisWeek === 0);
check("trend up when this week beats last", byKey.apps_sent.trend === "up");
check("trend down when versions dropped", byKey.resume_versions.trend === "down");
check("trend same when equal and nonzero", byKey.tailored_resumes.trend === "same");

// --- No fabricated trends when dates are missing ---------------------------------------
const missingDates = parseState(
  JSON.stringify({
    applications: [{ id: "old-1", company: "X", roleTitle: "Y", status: "applied" }],
    resumeVersions: [{ id: "old-v", label: "L" }]
  })
);
const missingMetrics = computeWeeklyMetrics(missingDates, NOW);
check(
  "records without timestamps are counted in neither week",
  missingMetrics.every((item) => item.thisWeek === 0 && item.lastWeek === 0)
);
check("zero-both weeks shows 'none', not a fake trend", missingMetrics.every((item) => item.trend === "none"));

// --- Three moves ---------------------------------------------------------------------------
const review = computeWeeklyReview(state, NOW);
check("exactly three moves", review.moves.length === 3);
check("every move is actionable", review.moves.every((move) => move.title && move.detail.length > 20 && move.href && move.actionLabel));

const untailoredState = { ...state, applications: [makeApp({ id: "u1", resumeVersionId: null, status: "applied" })] };
check(
  "application move targets untailored application first",
  computeWeeklyReview(untailoredState, NOW).moves[0].title.includes("Tailor a resume")
);
check(
  "application move pushes pace when everything is tailored",
  /more application|pace is on target/i.test(computeWeeklyReview(state, NOW).moves[0].title)
);
const followUpState = {
  ...state,
  applications: [makeApp({ id: "f1", status: "applied", nextFollowUpAt: daysAgo(1), resumeVersionId: "r" })]
};
check("outreach move surfaces overdue follow-up", computeWeeklyReview(followUpState, NOW).moves[1].title.includes("Follow up on"));
check(
  "outreach move suggests queuing contacts when nothing is pending",
  /queue two people/i.test(computeWeeklyReview({ ...state, outreach: [] }, NOW).moves[1].title.toLowerCase())
);
check("prep move targets live interview", computeWeeklyReview(state, NOW).moves[2].title.includes("Rehearse for"));
check(
  "prep move falls back to profile when thin and no interviews",
  computeWeeklyReview({ ...emptyState(), applications: [makeApp({ resumeVersionId: "r" })] }, NOW).moves[2].href === "/profile"
);

// --- Stalled pipeline detection ----------------------------------------------------------------
const stalledState = {
  ...emptyState(),
  profile: { ...emptyProfile(), currentSituation: "x" },
  lanes: [
    { id: "lane-1", title: "QA Tester", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "library", createdAt: daysAgo(60) },
    { id: "lane-2", title: "Fresh Lane", status: "active", whyFit: "", resumeAngle: "", proof: [], gaps: [], keywords: [], source: "library", createdAt: daysAgo(60) }
  ],
  applications: [
    makeApp({ id: "s1", status: "applied", resumeVersionId: null, nextFollowUpAt: daysAgo(2), laneId: "lane-2", createdAt: daysAgo(3) }),
    makeApp({ id: "s2", status: "interviewing", resumeVersionId: "r", laneId: "lane-2", createdAt: daysAgo(5) })
  ]
};
const stalled = detectStalled(stalledState, NOW);
check("stalled: untailored applications detected", stalled.some((item) => item.label.includes("no tailored resume")));
check("stalled: overdue follow-ups detected", stalled.some((item) => item.label.includes("overdue")));
check("stalled: live interviews flagged for prep", stalled.some((item) => item.href === "/interview"));
check(
  "stalled: active lane with no recent applications flagged",
  stalled.some((item) => item.label.includes("no applications in 14 days") && item.detail.includes("QA Tester"))
);
check(
  "stalled: lane with recent applications not flagged",
  !stalled.some((item) => item.detail.includes("Fresh Lane"))
);
check("no stalled items on a healthy empty pipeline", detectStalled(emptyState(), NOW).length === 0);

// --- Empty states --------------------------------------------------------------------------------
const emptyReview = computeWeeklyReview(emptyState(), NOW);
check("new user flagged via hasAnyData=false", emptyReview.hasAnyData === false);
check("no applications flagged separately", emptyReview.hasApplications === false);
check(
  "setup-done-but-no-applications state distinguishable",
  (() => {
    const setupOnly = { ...emptyState(), profile: { ...emptyProfile(), currentSituation: "moving into support work" } };
    const r = computeWeeklyReview(setupOnly, NOW);
    return r.hasAnyData === true && r.hasApplications === false;
  })()
);
check("quiet week detectable via totalThisWeek", computeWeeklyReview(missingDates, NOW).totalThisWeek === 0);

// --- Momentum nudge threshold -----------------------------------------------------------------------
check("no nudge for brand-new users", isMomentumLow(emptyState(), NOW) === false);
check(
  "no nudge for barely-started searches",
  isMomentumLow({ ...emptyState(), applications: [makeApp({ createdAt: daysAgo(30) })] }, NOW) === false
);
check(
  "nudge when established search goes quiet",
  isMomentumLow(
    {
      ...emptyState(),
      applications: [makeApp({ id: "q1", createdAt: daysAgo(30), appliedAt: daysAgo(30) }), makeApp({ id: "q2", createdAt: daysAgo(25), appliedAt: daysAgo(25) })],
      resumeVersions: [makeVersion({ createdAt: daysAgo(28) })]
    },
    NOW
  ) === true
);
check("no nudge when this week is active", isMomentumLow(state, NOW) === false);

// --- Result -------------------------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
