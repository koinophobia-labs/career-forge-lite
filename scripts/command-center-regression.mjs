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

const {
  emptyState,
  emptyProfile,
  parseState,
  isProfileComplete,
  isProfileStarted
} = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));
const {
  addDays,
  applicationFollowUpsDue,
  computeDashboardStats,
  getNextBestAction,
  isDue,
  outreachFollowUpsDue,
  APPLICATION_FOLLOW_UP_DAYS,
  MAX_OUTREACH_FOLLOW_UPS
} = loadTsModule(path.join(root, "src/lib/command-center-insights.ts"));
const { analyzeJobPost, extractKeywords, extractRequirements } = loadTsModule(
  path.join(root, "src/lib/job-post-analyzer.ts")
);
const { laneLibrary } = loadTsModule(path.join(root, "src/lib/lane-library.ts"));
const { fillTemplate, getTemplate, outreachTemplates, remainingPlaceholders } = loadTsModule(
  path.join(root, "src/lib/outreach-templates.ts")
);

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

// --- Store: parsing and revival ---------------------------------------------
check("parseState handles null", parseState(null).lanes.length === 0);
check("parseState handles corrupt JSON", parseState("{not json").applications.length === 0);
check(
  "parseState drops malformed records but keeps valid ones",
  (() => {
    const state = parseState(
      JSON.stringify({
        lanes: [{ id: "lane-1", title: "QA Tester", status: "bogus" }, { title: "missing id" }, "junk"],
        applications: [{ id: "app-1", status: "applied" }],
        outreach: null
      })
    );
    return (
      state.lanes.length === 1 &&
      state.lanes[0].status === "exploring" &&
      state.applications.length === 1 &&
      state.outreach.length === 0
    );
  })()
);

const completeProfile = {
  ...emptyProfile(),
  currentSituation: "Operations background, moving into tech-adjacent work while building a software company.",
  targetRoles: "AI Support Specialist, QA Tester",
  transferableSkills: ["troubleshooting", "de-escalation", "written documentation", "attention to detail"],
  experienceSummary: "Six years of customer-facing and operations work: 50+ customers a day, training, reconciliation.",
  strengths: ["calm under pressure"],
  proofPoints: "Building a software product; wrote team training docs; cut restock errors.",
  constraints: "",
  workStyle: "",
  updatedAt: NOW
};

check("isProfileStarted false for empty profile", !isProfileStarted(emptyProfile()));
check("isProfileComplete true for full profile", isProfileComplete(completeProfile));
check(
  "isProfileComplete false with under 3 skills",
  !isProfileComplete({ ...completeProfile, transferableSkills: ["one", "two"] })
);

// --- Insights: follow-up scheduling ------------------------------------------
check("addDays adds exactly N days", addDays("2026-07-01T00:00:00.000Z", 5) === "2026-07-06T00:00:00.000Z");
check("isDue true at exact due time", isDue(NOW, NOW));
check("isDue false for future", !isDue("2026-07-07T00:00:00.000Z", NOW));
check("isDue false for null", !isDue(null, NOW));

function makeState(overrides = {}) {
  return { ...emptyState(), profile: completeProfile, ...overrides };
}

const lane = {
  id: "lane-1",
  title: "QA Tester",
  status: "active",
  whyFit: "Detail-oriented operations work",
  resumeAngle: "Emphasize precision and process",
  proof: ["Checklist-driven work"],
  gaps: [],
  keywords: ["QA", "testing", "bug report", "attention to detail"],
  source: "library",
  createdAt: NOW
};

const dueApp = {
  id: "app-1",
  company: "Acme",
  roleTitle: "QA Tester",
  laneId: "lane-1",
  status: "applied",
  jobPostUrl: "",
  resumeVersionId: null,
  appliedAt: addDays(NOW, -APPLICATION_FOLLOW_UP_DAYS - 1),
  nextFollowUpAt: addDays(NOW, -1),
  interviewAt: null,
  notes: "",
  createdAt: NOW
};

const dueContact = {
  id: "contact-1",
  name: "Jordan",
  company: "Acme",
  role: "Recruiter",
  channel: "linkedin",
  status: "sent",
  laneId: "lane-1",
  lastContactedAt: addDays(NOW, -5),
  nextFollowUpAt: addDays(NOW, -1),
  followUpCount: 0,
  notes: "",
  createdAt: NOW
};

check(
  "applicationFollowUpsDue finds overdue applied apps only",
  (() => {
    const state = makeState({
      applications: [dueApp, { ...dueApp, id: "app-2", status: "rejected" }, { ...dueApp, id: "app-3", nextFollowUpAt: addDays(NOW, 3) }]
    });
    const due = applicationFollowUpsDue(state, NOW);
    return due.length === 1 && due[0].id === "app-1";
  })()
);

check(
  "outreachFollowUpsDue respects max follow-up cap",
  (() => {
    const state = makeState({
      outreach: [dueContact, { ...dueContact, id: "contact-2", followUpCount: MAX_OUTREACH_FOLLOW_UPS }]
    });
    const due = outreachFollowUpsDue(state, NOW);
    return due.length === 1 && due[0].id === "contact-1";
  })()
);

// --- Insights: dashboard stats ------------------------------------------------
const statsState = makeState({
  lanes: [lane, { ...lane, id: "lane-2", status: "paused" }],
  applications: [
    dueApp,
    { ...dueApp, id: "app-2", status: "interviewing", nextFollowUpAt: null, interviewAt: addDays(NOW, 2) },
    { ...dueApp, id: "app-3", status: "drafting", appliedAt: null, nextFollowUpAt: null }
  ],
  outreach: [dueContact],
  resumeVersions: [{ id: "resume-1", label: "QA Tester — 2026-07-01", laneId: "lane-1", notes: "", createdAt: NOW }]
});
const stats = computeDashboardStats(statsState, NOW);
check("stats.activeLanes excludes paused", stats.activeLanes === 1);
check("stats.applicationsSent excludes drafting", stats.applicationsSent === 2);
check("stats.followUpsDue counts apps and outreach", stats.followUpsDue === 2);
check("stats.interviews counts interviewing", stats.interviews === 1);
check("stats.resumeVersions counts versions", stats.resumeVersions === 1);

// --- Insights: next best action priority --------------------------------------
check(
  "next action: empty state → profile",
  getNextBestAction(emptyState(), NOW).href === "/profile"
);
check(
  "next action: profile done, no lanes → targets",
  getNextBestAction(makeState(), NOW).href === "/targets"
);
check(
  "next action: interview beats follow-ups",
  getNextBestAction(statsState, NOW).href === "/interview"
);
check(
  "next action: follow-up when no interview",
  (() => {
    const state = makeState({ lanes: [lane], applications: [dueApp] });
    return getNextBestAction(state, NOW).href === "/applications";
  })()
);
check(
  "next action: low weekly pace → tailor",
  (() => {
    const state = makeState({ lanes: [lane] });
    return getNextBestAction(state, NOW).href === "/tailor";
  })()
);

// --- Job post analyzer ----------------------------------------------------------
const jobPost = `About the role
We are hiring a Product Support Specialist to join our team.

Responsibilities:
- Handle customer support tickets and escalation paths in Zendesk
- Write knowledge base articles and documentation
- Partner with QA on bug report triage

Requirements:
- 2+ years of customer support experience
- Strong written communication and attention to detail
- Familiarity with troubleshooting SaaS products
- Bachelor degree in a related field preferred`;

const keywords = extractKeywords(jobPost, completeProfile, lane);
check("analyzer finds keywords with counts", keywords.some((hit) => hit.term === "customer support" && hit.count >= 2));
check(
  "analyzer marks profile-covered keywords",
  keywords.some((hit) => hit.term === "troubleshooting" && hit.inProfile)
);
check(
  "analyzer marks missing keywords",
  keywords.some((hit) => hit.term === "zendesk" && !hit.inProfile)
);

const requirements = extractRequirements(jobPost);
check("analyzer extracts requirement lines", requirements.length >= 3);
check(
  "analyzer keeps years requirement",
  requirements.some((line) => line.includes("2+ years"))
);

const analysis = analyzeJobPost(jobPost, completeProfile, lane);
check(
  "credential requirements are flagged, never claimed",
  analysis.requirements.some(
    (req) => /degree/i.test(req.requirement) && req.status === "gap" && /never claim/i.test(req.evidence)
  )
);
check(
  "covered requirement cites real profile evidence",
  analysis.requirements.some((req) => req.status === "covered")
);
check("analysis includes honesty note", /never invent/i.test(analysis.honestyNote));
check("analysis produces weak spots", analysis.weakSpots.length >= 1);
check("analysis produces bullet suggestions", analysis.bulletSuggestions.length >= 1);
check(
  "bullet suggestions are grounded in profile claims",
  analysis.bulletSuggestions.every((item) => item.basedOn.length > 0)
);

const thinAnalysis = analyzeJobPost(jobPost, emptyProfile(), null);
check(
  "thin profile → analyzer says so instead of inventing",
  thinAnalysis.bulletSuggestions.some((item) => /too thin/i.test(item.suggestion)) ||
    thinAnalysis.weakSpots.some((spot) => /proof points/i.test(spot))
);

// --- Lane library ----------------------------------------------------------------
check("lane library has 9 lanes", laneLibrary.length === 9);
check(
  "every lane is fully specified",
  laneLibrary.every(
    (item) =>
      item.title && item.whyFit.length > 40 && item.resumeAngle.length > 40 && item.proof.length >= 3 && item.gaps.length >= 3 && item.keywords.length >= 5
  )
);
check(
  "lane keys are unique",
  new Set(laneLibrary.map((item) => item.key)).size === laneLibrary.length
);

// --- Outreach templates ------------------------------------------------------------
check("templates exist for core scenarios", ["recruiter_intro", "follow_up_1", "follow_up_2"].every((key) => getTemplate(key)));
check(
  "every template is short enough to read",
  outreachTemplates.every((template) => template.body.length < 700)
);
const filled = fillTemplate(getTemplate("recruiter_intro"), {
  contact: { name: "Jordan", company: "Acme", role: "Recruiter" },
  lane: { title: "QA Tester" },
  profile: { currentSituation: "operations" }
});
check("fillTemplate replaces known placeholders", filled.includes("Jordan") && filled.includes("Acme") && filled.includes("QA Tester"));
check(
  "remainingPlaceholders reports unfilled brackets",
  remainingPlaceholders(filled).length > 0 && remainingPlaceholders("no brackets").length === 0
);

// --- Result ---------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
