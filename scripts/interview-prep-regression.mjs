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

const { buildGapDefenseQuestions, coachAnswer, generateInterviewPrep, getRoleQuestions, HONESTY_NOTE } = loadTsModule(
  path.join(root, "src/lib/interview-prep.ts")
);
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
  "side-company commitment question exists",
  transition.some((question) => /own company/i.test(question.question))
);
check("pack carries honesty note", pack.honestyNote === HONESTY_NOTE && /never claim/i.test(pack.honestyNote));
check("pack labels the application", pack.applicationLabel === "Product Support Specialist at Acme");
check("answer framework has 5 steps", pack.answerFramework.length === 5);

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
