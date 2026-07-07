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
  answerScaffold,
  appendLine,
  appendSentence,
  applyStarterPack,
  assessApplication,
  assessJobPost,
  assessProfile,
  mergeChips,
  relationshipPhrases,
  scaffoldTemplate,
  starterPacks,
  validateApplicationInput
} = loadTsModule(path.join(root, "src/lib/input-guidance.ts"));
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

// --- Chip selections compose into clean human language --------------------------
check("appendSentence starts a clean sentence", appendSentence("", "I need a salaried role with benefits") === "I need a salaried role with benefits.");
check(
  "appendSentence joins with proper punctuation",
  appendSentence("I can start immediately.", "Remote or hybrid strongly preferred") ===
    "I can start immediately. Remote or hybrid strongly preferred."
);
check(
  "appendSentence adds period to unterminated base",
  appendSentence("I can start immediately", "Remote preferred") === "I can start immediately. Remote preferred."
);
check(
  "appendSentence dedupes case-insensitively",
  appendSentence("Remote or hybrid strongly preferred.", "remote or hybrid strongly preferred") ===
    "Remote or hybrid strongly preferred."
);
check("appendSentence produces no tag soup", !appendSentence(appendSentence("", "First thing"), "Second thing").includes(","));
check("appendLine starts clean", appendLine("", "Shipped a product to TestFlight") === "Shipped a product to TestFlight");
check("appendLine appends on new line", appendLine("Line one", "Line two") === "Line one\nLine two");
check("appendLine dedupes", appendLine("Shipped a product to TestFlight", "shipped a product to testflight") === "Shipped a product to TestFlight");
check("mergeChips dedupes case-insensitively", mergeChips(["De-escalation"], ["de-escalation", "fraud spotting"]).length === 2);

// --- Starter packs ---------------------------------------------------------------
const requiredBackgrounds = [
  "customer_facing",
  "operations",
  "security",
  "sportsbook",
  "fraud_risk",
  "responsible_gaming",
  "community",
  "product_support",
  "qa",
  "ai_support",
  "technical_support"
];
check(
  "starter packs cover all required backgrounds",
  requiredBackgrounds.every((key) => starterPacks.some((pack) => pack.key === key))
);
check("builder pack exists for side-project founders", starterPacks.some((pack) => pack.key === "builder"));
check(
  "every pack is fully specified",
  starterPacks.every(
    (pack) => pack.label && pack.situation.length > 20 && pack.experienceSeed.length > 30 && pack.skills.length >= 3 && pack.strengths.length >= 2 && pack.proofLines.length >= 2
  )
);
check(
  "starter packs never invent numbers or credentials",
  starterPacks.every(
    (pack) =>
      !/\d/.test(pack.situation + pack.experienceSeed + pack.proofLines.join(" ")) &&
      !/certified|degree|licensed/i.test(pack.situation + pack.experienceSeed + pack.proofLines.join(" "))
  )
);

const sportsbookPack = starterPacks.find((pack) => pack.key === "sportsbook");
const seeded = applyStarterPack(emptyProfile(), sportsbookPack);
check(
  "applied pack writes a clean first-person situation sentence",
  seeded.currentSituation.startsWith("I'm transitioning from sportsbook operations") && seeded.currentSituation.endsWith(".")
);
check("applied pack merges skills as readable phrases", seeded.transferableSkills.includes("policy enforcement"));
check("applied pack writes proof points as lines", seeded.proofPoints.split("\n").length === sportsbookPack.proofLines.length);
const doubleSeeded = applyStarterPack(seeded, sportsbookPack);
check("applying the same pack twice adds nothing", doubleSeeded.currentSituation === seeded.currentSituation && doubleSeeded.proofPoints === seeded.proofPoints);
const stacked = applyStarterPack(seeded, starterPacks.find((pack) => pack.key === "builder"));
check(
  "stacking packs reads as sentences, not tags",
  stacked.currentSituation ===
    "I'm transitioning from sportsbook operations into fraud/risk, trust and safety, product support, or AI support. I'm building software products on the side while looking for a salaried role."
);

// --- Profile completeness warnings ---------------------------------------------
const emptyIssues = assessProfile(emptyProfile());
check("empty profile flags all core sections", emptyIssues.filter((issue) => issue.severity === "warn").length === 5);
check("empty profile marks optional fields info, not warn", emptyIssues.filter((issue) => issue.severity === "info").length === 3);
check(
  "thin situation is flagged",
  assessProfile({ ...emptyProfile(), currentSituation: "looking for work" }).some(
    (issue) => issue.field === "currentSituation" && /thin/i.test(issue.message)
  )
);
check(
  "two skills is flagged as thin",
  assessProfile({ ...emptyProfile(), transferableSkills: ["a", "b"] }).some(
    (issue) => issue.field === "transferableSkills" && issue.message.includes("Only 2")
  )
);
const fullProfile = {
  ...emptyProfile(),
  currentSituation: "I'm transitioning from sportsbook operations into fraud/risk or AI support roles.",
  targetRoles: "Fraud/Risk Operations, AI Support",
  transferableSkills: ["policy enforcement", "de-escalation", "fraud spotting", "AI tools"],
  experienceSummary: "Years of sportsbook operations: payments, tickets, escalations, and policy enforcement under pressure.",
  strengths: ["pattern recognition"],
  proofPoints: "Shipped a product to TestFlight and ran real feedback loops with testers.",
  constraints: "Salaried with benefits.",
  workStyle: "Independent execution."
};
check("complete profile has no warnings", assessProfile(fullProfile).length === 0);

// --- Job post quality ------------------------------------------------------------
check("empty post → empty status", assessJobPost("   ").status === "empty");
check("10-word post → too_short", assessJobPost("Support specialist needed for busy team apply now via portal").status === "too_short");
check("too_short message says the analysis will be shallow", /shallow/i.test(assessJobPost("short post here").message));
const thinPost = Array(60).fill("word").join(" ");
check("60-word post → thin", assessJobPost(thinPost).status === "thin");
const goodPost = Array(150).fill("word").join(" ");
check("150-word post → good", assessJobPost(goodPost).status === "good");
check("word count reported", assessJobPost(goodPost).wordCount === 150);

// --- Application validation -------------------------------------------------------
check("missing company flagged on input", validateApplicationInput({ company: "", roleTitle: "QA Tester" }).length === 1);
check("missing both flagged on input", validateApplicationInput({ company: " ", roleTitle: "" }).length === 2);
check("complete input passes", validateApplicationInput({ company: "Acme", roleTitle: "QA Tester" }).length === 0);
const placeholderApp = {
  id: "a",
  company: "Unknown company",
  roleTitle: "Untitled role",
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
  createdAt: "2026-07-06T00:00:00.000Z"
};
check("placeholder application flagged", assessApplication(placeholderApp).length === 2);
check("real application passes", assessApplication({ ...placeholderApp, company: "Acme", roleTitle: "QA Tester" }).length === 0);

// --- Interview answer guidance -----------------------------------------------------
check(
  "base scaffold is situation/action/result",
  answerScaffold("role").length === 3 && /situation/i.test(answerScaffold("role")[0]) && /result/i.test(answerScaffold("role")[2])
);
check(
  "gap defense scaffold opens with acknowledgment and ends with a plan",
  /acknowledge/i.test(answerScaffold("gap_defense")[0]) && /plan/i.test(answerScaffold("gap_defense")[4])
);
check("transition scaffold adds a bridge", /bridge/i.test(answerScaffold("transition")[3]));
check(
  "gap defense template prompts plain gap admission",
  scaffoldTemplate("gap_defense").startsWith("What I don't have yet") && /plan to close the gap/i.test(scaffoldTemplate("gap_defense"))
);
check("standard template is fillable lines", scaffoldTemplate("role").split("\n").length === 3);

// --- Outreach relationships ---------------------------------------------------------
check("five relationship types", relationshipPhrases.length === 5);
check(
  "relationship notes are plain sentences",
  relationshipPhrases.every((item) => /^[A-Z]/.test(item.note) && item.note.endsWith(".") && !item.note.includes("_"))
);
check(
  "each relationship maps to a real template",
  relationshipPhrases.every((item) => ["recruiter_intro", "hiring_manager", "referral_request", "informational"].includes(item.templateKey))
);

// --- Result -------------------------------------------------------------------------
console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
