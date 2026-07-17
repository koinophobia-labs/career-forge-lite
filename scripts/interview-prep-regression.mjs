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
  buildGapDefenseQuestions,
  buildReverseQuestions,
  coachAnswer,
  generateInterviewPrep,
  getRoleQuestions,
  loadPrepDraft,
  resolvePrepLane,
  savePrepDraft,
  HONESTY_NOTE,
  PREP_DRAFT_KEY
} = loadTsModule(path.join(root, "src/lib/interview-prep.ts"));
const { laneLibrary } = loadTsModule(path.join(root, "src/lib/lane-library.ts"));
const { emptyProfile } = loadTsModule(path.join(root, "src/lib/command-center-store.ts"));

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

const profile = {
  ...emptyProfile(),
  currentSituation: "operations and customer-facing work, building a software company on the side",
  targetRoles: "AI Support Specialist, QA Tester",
  transferableSkills: ["de-escalation", "troubleshooting", "written documentation"],
  experienceSummary: "Six years of retail and operations work.",
  strengths: ["calm under pressure", "fast learner"],
  proofPoints:
    "Handled 50+ customer issues a day with a 96% satisfaction score.\nWrote the onboarding doc still used to train new hires.\nBuilt and shipped a software product at Koinophobia Labs.",
  updatedAt: NOW
};

function makeLane(title, overrides = {}) {
  return {
    id: "lane-1",
    title,
    status: "active",
    whyFit: "fits",
    resumeAngle: "angle",
    proof: ["proof one"],
    gaps: ["Learn one ticketing system at a demo level", "Practice reading basic logs"],
    keywords: ["customer support", "triage"],
    source: "library",
    createdAt: NOW,
    ...overrides
  };
}

const application = {
  id: "app-1",
  company: "Acme",
  roleTitle: "Product Support Specialist",
  laneId: "lane-1",
  status: "interviewing",
  jobPostUrl: "",
  resumeVersionId: null,
  appliedAt: NOW,
  nextFollowUpAt: null,
  interviewAt: NOW,
  notes: "",
  analysisKeywords: ["zendesk", "customer support"],
  analysisGaps: ["2+ years of customer support experience", "Familiarity with Zendesk"],
  analysisWeakSpots: ["The post emphasizes zendesk"],
  createdAt: NOW
};

// --- Role banks: every requested lane gets specific questions -----------------
const laneTitles = [
  "AI Support Specialist",
  "Trust & Safety Analyst",
  "Fraud / Risk Operations",
  "Community Manager",
  "Product Support Specialist",
  "QA Tester",
  "Junior Product Ops",
  "Customer Success",
  "Technical Support"
];
for (const title of laneTitles) {
  check(`role bank exists for "${title}"`, getRoleQuestions(title).length >= 3);
}
check(
  "every library lane title matches a role bank",
  laneLibrary.every((blueprint) => getRoleQuestions(blueprint.title).length >= 3)
);
check(
  "role questions carry coaching",
  getRoleQuestions("Fraud / Risk Operations").every((entry) => entry.coaching.length >= 2 && entry.why.length > 10)
);
check(
  "distinct lanes get distinct questions",
  getRoleQuestions("QA Tester")[0].question !== getRoleQuestions("Trust & Safety Analyst")[0].question
);

// --- Custom lane fallback ------------------------------------------------------
const customPack = generateInterviewPrep(profile, makeLane("Solutions Wrangler", { source: "custom" }), null);
check(
  "custom lane falls back to keyword-built role questions",
  customPack.questions.some((question) => question.category === "role" && question.question.includes("customer support"))
);

// --- Behavioral questions from profile claims ----------------------------------
const pack = generateInterviewPrep(profile, makeLane("Product Support Specialist"), application);
const behavioral = pack.questions.filter((question) => question.category === "behavioral");
check("behavioral questions generated", behavioral.length >= 5);
check(
  "behavioral questions quote proof points",
  behavioral.some((question) => question.question.includes("96% satisfaction"))
);
check(
  "behavioral questions cover strengths",
  behavioral.some((question) => question.question.includes("calm under pressure"))
);
check(
  "behavioral questions cover transferable skills",
  behavioral.some((question) => question.question.includes("de-escalation"))
);
check(
  "empty profile produces no fabricated behavioral questions",
  generateInterviewPrep(emptyProfile(), null, null).questions.filter((q) => q.category === "behavioral").length === 0
);

// --- Gap defense ---------------------------------------------------------------
const gapQuestions = buildGapDefenseQuestions(makeLane("Product Support Specialist"), application);
check(
  "gap defense uses job-post analysis gaps",
  gapQuestions.some((question) => question.question.includes("2+ years of customer support experience"))
);
check(
  "gap defense names the company",
  gapQuestions.some((question) => question.why.includes("Acme"))
);
check(
  "gap defense also drills lane gap plan",
  gapQuestions.some((question) => question.basedOn.includes("lane gap plan"))
);
check(
  "gap defense coaching forbids inventing credentials",
  gapQuestions
    .filter((question) => question.basedOn.includes("analysis"))
    .every((question) => question.coaching.some((tip) => /never claim/i.test(tip)))
);
const laneOnlyGaps = buildGapDefenseQuestions(makeLane("Product Support Specialist"), null);
check(
  "gap defense falls back to lane gaps without an application",
  laneOnlyGaps.length >= 2 && laneOnlyGaps.every((question) => question.basedOn.includes("lane gap plan"))
);
check("no lane and no application → no gap questions", buildGapDefenseQuestions(null, null).length === 0);

// --- Transition + pack structure -------------------------------------------------
const transition = pack.questions.filter((question) => question.category === "transition");
check("transition questions present", transition.length === 2);
check(
  "transition question references the lane",
  transition.some((question) => question.question.includes("Product Support Specialist"))
);
check(
  "side-venture commitment question exists when the profile shows founder work",
  transition.some((question) => /own venture/i.test(question.question))
);
check(
  "founder commitment question attributes its real source",
  transition.every((question) => !/own venture/i.test(question.question) || /current situation/i.test(question.basedOn))
);
const noFounderTransition = generateInterviewPrep(
  { ...profile, currentSituation: "Five years of retail shift work", proofPoints: "", experienceSummary: "Retail work." },
  makeLane("Product Support Specialist"),
  null
).questions.filter((question) => question.category === "transition");
check(
  "no founder evidence → no fabricated side-venture question",
  noFounderTransition.every((question) => !/own (venture|company)/i.test(question.question))
);
check(
  "commitment fallback is labeled generic, not personalized",
  noFounderTransition.some((question) => /generic/i.test(question.basedOn))
);
check("pack carries honesty note", pack.honestyNote === HONESTY_NOTE && /never claim/i.test(pack.honestyNote));
check("pack labels the application", pack.applicationLabel === "Product Support Specialist at Acme");
check("answer framework has 5 steps", pack.answerFramework.length === 5);

// --- Gap defense verifies stored gaps against approved evidence -------------------
// analysisGaps merges PARTIAL and GAP verdicts at save time, so prep must
// re-check them: covered → dropped, partial → bridge phrasing, gap → honest.
function evidenceRecord(id, kind, detail) {
  return {
    id,
    kind,
    label: kind,
    detail,
    source: "resume-import",
    sourceText: detail,
    confidence: "high",
    approved: true,
    rejected: false,
    sourceFilenames: [],
    sourceExcerpts: [detail],
    createdAt: NOW,
    updatedAt: NOW
  };
}
const csEvidence = evidenceRecord("ev-cs-role", "role", "Customer Success Manager owning onboarding and renewals for mid-market accounts");
const csDossier = {
  evidence: [
    csEvidence,
    evidenceRecord("ev-metric", "metric", "Cut churn from 14% to 8% across 45 mid-market accounts"),
    evidenceRecord("ev-proof", "proof", "Grew the managed book of business to $3.2M ARR"),
    evidenceRecord("ev-saas", "responsibility", "Provided SaaS support and resolved product escalations")
  ],
  roles: [
    {
      id: "role-cs",
      title: "Customer Success Manager",
      employer: "Northwind",
      startDate: "January 2022",
      endDate: "",
      current: true,
      responsibilities: ["Owned customer success onboarding and renewals"],
      tools: [],
      outcomes: [],
      evidenceIds: ["ev-cs-role"]
    }
  ],
  projects: []
};
const tenureApplication = {
  ...application,
  analysisGaps: [
    "3+ years of customer success experience required",
    "2+ years of SaaS support experience required",
    "Familiarity with Zendesk"
  ]
};
const verifiedGapQuestions = buildGapDefenseQuestions(makeLane("Customer Success"), tenureApplication, csDossier, profile);
check(
  "tenure computed from role date ranges — covered requirement asserts no false gap",
  !verifiedGapQuestions.some((question) => question.question.includes("3+ years of customer success")),
  JSON.stringify(verifiedGapQuestions.map((question) => question.question))
);
check(
  "no gap question ever uses the old 'not on your resume' assertion",
  verifiedGapQuestions.every((question) => !/not on your resume/i.test(question.question)) &&
    generateInterviewPrep(profile, makeLane("Product Support Specialist"), application).questions.every(
      (question) => !/not on your resume/i.test(question.question)
    )
);
const partialQuestion = verifiedGapQuestions.find((question) => question.question.includes("2+ years of SaaS support"));
check(
  "partially-covered requirement gets bridge phrasing citing the user's strongest proof",
  Boolean(partialQuestion) && /strongest related proof/i.test(partialQuestion.question) && /bridge/i.test(partialQuestion.question)
);
check(
  "partial phrasing never asserts absence",
  Boolean(partialQuestion) && !/doesn't cover it|not on your resume/i.test(partialQuestion.question)
);
const zendeskQuestion = verifiedGapQuestions.find((question) => question.question.includes("Familiarity with Zendesk"));
check(
  "true gap is asserted only when evidence genuinely lacks it",
  Boolean(zendeskQuestion) && /approved evidence doesn't cover it/i.test(zendeskQuestion.question)
);
const statedTenureDossier = {
  evidence: [evidenceRecord("ev-stated", "role", "4+ years of customer success experience managing mid-market accounts")],
  roles: [],
  projects: []
};
const statedTenureQuestions = buildGapDefenseQuestions(
  null,
  { ...application, analysisGaps: ["3+ years of customer success experience required"] },
  statedTenureDossier,
  profile
);
check(
  "explicit stated tenure in approved evidence covers an N+-year requirement",
  statedTenureQuestions.length === 0,
  JSON.stringify(statedTenureQuestions.map((question) => question.question))
);
check(
  "without a dossier, stored gaps use honest 'not fully proven' phrasing",
  buildGapDefenseQuestions(null, application).every((question) => /doesn't fully prove it yet/i.test(question.question))
);
const coveredLaneGapDossier = {
  evidence: [evidenceRecord("ev-zendesk", "tool", "Zendesk ticketing at demo level")],
  roles: [],
  projects: []
};
check(
  "lane gaps covered by approved evidence are dropped from the drill list",
  !buildGapDefenseQuestions(
    makeLane("Product Support Specialist", { gaps: ["Zendesk ticketing at demo level", "Practice reading basic logs"] }),
    null,
    coveredLaneGapDossier,
    profile
  ).some((question) => question.question.includes("Zendesk ticketing at demo level"))
);
check(
  "library lane gaps are attributed to the lane plan, not the user",
  buildGapDefenseQuestions(makeLane("Product Support Specialist"), null).every(
    (question) => !/you identified this yourself/i.test(question.why)
  )
);

// --- Behavioral questions from imported dossier evidence ---------------------------
const dossierPack = generateInterviewPrep(emptyProfile(), makeLane("Customer Success"), null, csDossier);
const dossierBehavioral = dossierPack.questions.filter((question) => question.category === "behavioral");
check(
  "imported dossier metrics and achievements each seed a behavioral question",
  dossierBehavioral.filter((question) => question.basedOn.startsWith("Approved evidence")).length >= 2
);
check(
  "dossier behavioral questions quote the actual claims",
  dossierBehavioral.some((question) => question.question.includes("14% to 8%")) &&
    dossierBehavioral.some((question) => question.question.includes("$3.2M ARR"))
);
check(
  "quantified dossier claims rank ahead of unquantified ones",
  dossierBehavioral.findIndex((question) => /[\d$%]/.test(question.question)) === 0
);

// --- Application lane wins over the active lane -------------------------------------
const activeLane = makeLane("AI Support Specialist", { id: "lane-active" });
const appLane = makeLane("Customer Success", { id: "lane-app", status: "exploring" });
const lanes = [activeLane, appLane];
const appForLane = { ...application, laneId: "lane-app" };
check(
  "selected application's lane wins over the active-lane default",
  resolvePrepLane(lanes, null, appForLane, activeLane)?.id === "lane-app"
);
check(
  "explicit lane choice still overrides the application lane",
  resolvePrepLane(lanes, "lane-active", appForLane, null)?.id === "lane-active"
);
check("explicit 'no lane' resolves to generic prep", resolvePrepLane(lanes, "none", appForLane, activeLane) === null);
check(
  "no application and no choice falls back to the default lane",
  resolvePrepLane(lanes, null, null, activeLane)?.id === "lane-active"
);

// --- Reverse questions ---------------------------------------------------------------
check("pack includes questions to ask the interviewer", pack.reverseQuestions.length >= 3);
check(
  "reverse questions get specific when an analysis exists",
  pack.reverseQuestions.some((item) => item.basedOn.includes("Job-post analysis")) &&
    pack.reverseQuestions.some((item) => item.question.includes("zendesk") || item.question.includes("customer support"))
);
const genericReverse = buildReverseQuestions(null, null);
check(
  "reverse questions fall back to labeled generic staples",
  genericReverse.length >= 3 && genericReverse.every((item) => /generic/i.test(item.basedOn))
);

// --- Practice draft persistence --------------------------------------------------------
const draftStore = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (draftStore.has(key) ? draftStore.get(key) : null),
    setItem: (key, value) => draftStore.set(key, String(value)),
    removeItem: (key) => draftStore.delete(key)
  }
};
savePrepDraft("Why this role?", "Because the work is the same skill in a new context.");
check("practice drafts persist per question", loadPrepDraft("Why this role?") === "Because the work is the same skill in a new context.");
savePrepDraft("Why this role?", "   ");
check("blank drafts are removed instead of stored", loadPrepDraft("Why this role?") === "");
draftStore.set(PREP_DRAFT_KEY, "{not json");
check("corrupt draft storage revives to empty, not a crash", loadPrepDraft("Why this role?") === "");
draftStore.set(PREP_DRAFT_KEY, JSON.stringify({ ok: "kept", bad: 42 }));
check("non-string draft entries are dropped on revival", loadPrepDraft("ok") === "kept" && loadPrepDraft("bad") === "");
delete globalThis.window;

// --- Answer coaching --------------------------------------------------------------
const gapQuestion = gapQuestions[0];
const roleQuestion = { id: "r", category: "role", question: "q", why: "w", coaching: [], basedOn: "b" };

check(
  "coach rejects too-short answers",
  coachAnswer("I did stuff.", roleQuestion).some((item) => item.tone === "fix" && /too short/i.test(item.message))
);

const bluff =
  "I am certified in Zendesk and have many years of experience with every support platform. We always did a great job and we handled everything perfectly without any problems at all whatsoever.";
const bluffFeedback = coachAnswer(bluff, gapQuestion);
check(
  "coach flags credential claims",
  bluffFeedback.some((item) => item.tone === "fix" && /only claim certifications/i.test(item.message))
);
check(
  "coach flags we-heavy answers",
  bluffFeedback.some((item) => item.tone === "fix" && /more "we" than "i"/i.test(item.message))
);
check(
  "coach flags gap answers that never concede the gap",
  bluffFeedback.some((item) => item.tone === "fix" && /never concedes the gap/i.test(item.message))
);

const honest =
  "Honestly, I don't have two years in a formal support queue yet. The closest I've done is handling 50+ customer issues a day in retail, where I resolved billing disputes and kept a 96% satisfaction score. I'm working on Zendesk through its demo environment now, so the tooling gap is closing. That combination reduced escalations at my store by a noticeable margin.";
const honestFeedback = coachAnswer(honest, gapQuestion);
check(
  "coach rewards honest gap acknowledgment",
  honestFeedback.some((item) => item.tone === "good" && /acknowledge the gap/i.test(item.message))
);
check(
  "coach rewards numbers",
  honestFeedback.some((item) => item.tone === "good" && /number/i.test(item.message))
);
check(
  "coach rewards stated results",
  honestFeedback.some((item) => item.tone === "good" && /outcome/i.test(item.message))
);
check(
  "coach flags missing numbers",
  coachAnswer(
    "I resolved a difficult situation with a customer by listening carefully and offering a fix that worked for them, which improved the relationship.",
    roleQuestion
  ).some((item) => item.tone === "fix" && /no numbers/i.test(item.message))
);
const ramble = Array(60).fill("and then I did another thing that mattered a lot").join(" ");
check(
  "coach flags rambling answers",
  coachAnswer(ramble, roleQuestion).some((item) => item.tone === "fix" && /ramble/i.test(item.message))
);

// --- Result -----------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
